/* TxtVein · 源码层（流水 / 字典）
 *
 * 事实层是后台 ID 图；编辑器文本是投影 + 手稿。
 * 一条源码行可以展开多条原子边：
 *   微信 > 晚餐 > 开心 120 1
 *     E_ 微信>晚餐 120
 *     B_ 晚餐>开心 1
 *
 * 字典分四段：
 *   [树]      缩进树（改缩进 = 改父级；字段仍在 [会计]）
 *   [ACCOUNT] node ...   会计节点 N_
 *   [NOTE]    tag ...    备注标签 T_
 *   [BEHAVIOR] item ...  行为项 H_（身体/心理统一，树由字典定义）
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const dictMod = TV.dict;
  const amount = TV.amount;
  const dateMod = TV.date;
  const ids = TV.ids;

  const TAG_KINDS = ['plain', 'gain', 'suppress', 'time'];
  const SECTIONS = { account: 'account', note: 'note', behavior: 'behavior' };

  function diag(line, message, severity, col) {
    return { line: line, col: col || 0, message, severity: severity || 'error' };
  }

  function stripComment(line) {
    const s = S(line);
    const i = s.indexOf('//');
    return i >= 0 ? s.slice(0, i) : s;
  }

  function hasComment(line) {
    return S(line).indexOf('//') >= 0;
  }

  function formatYuanExact(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const a = Math.abs(n);
    let out = String(Math.floor(a / 100));
    const frac = a % 100;
    if (frac) out += '.' + String(frac).padStart(2, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + out;
  }

  function codeSafe(s) {
    return S(s).replace(/\s+/g, '').replace(/[<>|#，,]/g, '');
  }

  function uniqueCode(base, used) {
    let code = codeSafe(base) || 'x';
    if (!used.has(code)) { used.add(code); return code; }
    for (let i = 2; i < 10000; i += 1) {
      const next = code + i;
      if (!used.has(next)) { used.add(next); return next; }
    }
    return code;
  }

  function sourceCodeMap(dict) {
    const out = new Map();
    ['nodes', 'tags', 'behaviors'].forEach((kind) => {
      const usedByDomain = new Map();
      const groups = new Map();
      Object.keys(dict[kind] || {}).forEach((id) => {
        const x = dict[kind][id];
        const domain = S(x.domain || 'P').toUpperCase();
        const base = codeSafe(x.zh_code || x.en_code || id) || 'x';
        const key = domain + '\u0000' + base;
        if (!groups.has(key)) groups.set(key, { domain, base, ids: [] });
        groups.get(key).ids.push(id);
      });
      groups.forEach((g) => {
        if (!usedByDomain.has(g.domain)) usedByDomain.set(g.domain, new Set());
        const used = usedByDomain.get(g.domain);
        if (g.ids.length === 1) { out.set(g.ids[0], uniqueCode(g.base, used)); return; }
        g.ids.forEach((id, i) => out.set(id, uniqueCode(g.base + (i + 1), used)));
      });
    });
    return out;
  }

  function dictTail(weight, parent, system, sort, anchor, pin) {
    const parts = [];
    if (Number(weight)) parts.push(String(Number(weight)));
    if (parent && parent !== '-') parts.push('@' + parent);
    if (system) parts.push('system');
    if (sort != null && Number(sort) !== 100) parts.push('sort:' + Math.round(Number(sort)));
    if (pin) parts.push('pin');
    if (anchor) parts.push('^' + anchor);
    return parts.length ? ' ' + parts.join(' ') : '';
  }

  function treeSourceLines(dict) {
    const out = ['[树]', '// 缩进 = 父级；行尾 [简码]；改缩进即可改父级。字段仍在 [会计]。'];
    const nodes = (dict && dict.nodes) || {};
    const codeMap = sourceCodeMap(dict);
    const domains = dictMod.DOMAIN_ORDER.filter((d) => Object.keys(nodes).some((id) => nodes[id].domain === d && !nodes[id].system));
    domains.forEach((domain) => {
      dictMod.TYPE_ORDER.forEach((type) => {
        const group = Object.keys(nodes).filter((id) => !nodes[id].system && nodes[id].domain === domain && nodes[id].type === type);
        if (!group.length) return;
        const map = {};
        group.forEach((id) => { map[id] = { id, node: nodes[id], children: [] }; });
        const roots = [];
        group.forEach((id) => {
          const p = nodes[id].parent_id;
          if (p && map[p]) map[p].children.push(map[id]);
          else roots.push(map[id]);
        });
        const sortTree = (arr) => {
          arr.sort((a, b) => (Number(a.node.sort) || 100) - (Number(b.node.sort) || 100)
            || (Number(b.node.weight) || 0) - (Number(a.node.weight) || 0)
            || S(a.node.zh_name).localeCompare(S(b.node.zh_name), 'zh')
            || a.id.localeCompare(b.id));
          arr.forEach((x) => sortTree(x.children));
        };
        sortTree(roots);
        out.push(domain + ' ' + type);
        const walk = (arr, depth) => arr.forEach((x) => {
          const n = x.node;
          const code = codeMap.get(x.id) || n.zh_code || n.en_code || x.id;
          out.push('  '.repeat(depth + 1) + (n.zh_name || n.en_name || code) + ' [' + code + ']');
          walk(x.children, depth + 1);
        });
        walk(roots, 0);
      });
    });
    return out;
  }

  function dictToSource(dict) {
    if (dict && dict.format === 'v4' && TV.dictV4) return TV.dictV4.emit(dict);
    const codeMap = sourceCodeMap(dict);
    const lines = [];
    lines.push('// TxtVein 字典 · 四段：树 / 会计 / 备注 / 行为');
    lines.push('// 会计节点：域 大类 形态 中文码 英文码 中文名 | 英文名 [权重] [@父码] [system]');
    lines.push('// 备注标签：域 类型 中文码 英文码 中文名 | 英文名 [权重] [@父码]');
    lines.push('// 行为项：域 中文码 英文码 中文名 | 英文名 [权重] [@父码]');
    lines.push('// 权重=候选排序（越大越前）；@父码=树上一级；不写即根');
    lines.push('// 别名：alias 别名 -> N:节点码 / T:标签码 / H:行为码');
    lines.push('[树]');
    treeSourceLines(dict).slice(1).forEach((line) => lines.push(line));
    lines.push('[会计]');
    Object.keys(dict.nodes || {}).filter((id) => id !== 'N_sys_loss' && id !== 'N_sys_gain')
      .map((id) => ({ id, n: dict.nodes[id] }))
      .sort((a, b) => (a.n.domain + a.n.type + (codeMap.get(a.id) || '')).localeCompare(b.n.domain + b.n.type + (codeMap.get(b.id) || '')))
      .forEach((x) => {
        const n = x.n;
        const zh = S(n.zh_name || n.en_name).replace(/\|/g, '/') || '-';
        const en = S(n.en_name || n.zh_name).replace(/\|/g, '/') || '-';
        const parent = n.parent_id && codeMap.has(n.parent_id) ? codeMap.get(n.parent_id) : '-';
        lines.push('node ' + [n.domain, n.type, n.form || 'fluid', codeMap.get(x.id) || 'n', n.en_code || '-', zh].join(' ')
          + ' | ' + en + dictTail(n.weight, parent, n.system, n.sort, n.anchor_id, n.pin));
      });
    lines.push('[备注]');
    Object.keys(dict.tags || {}).map((id) => ({ id, t: dict.tags[id] }))
      .sort((a, b) => (a.t.domain + (a.t.kind || '') + (codeMap.get(a.id) || '')).localeCompare(b.t.domain + (b.t.kind || '') + (codeMap.get(b.id) || '')))
      .forEach((x) => {
        const t = x.t;
        const zh = S(t.zh_name || t.en_name).replace(/\|/g, '/') || '-';
        const en = S(t.en_name || t.zh_name).replace(/\|/g, '/') || '-';
        const parent = t.parent_id && codeMap.has(t.parent_id) ? codeMap.get(t.parent_id) : '-';
        lines.push('tag ' + [t.domain, t.kind || 'plain', codeMap.get(x.id) || 't', t.en_code || '-', zh].join(' ')
          + ' | ' + en + dictTail(t.weight, parent, false, t.sort, ''));
      });
    lines.push('[行为]');
    Object.keys(dict.behaviors || {}).map((id) => ({ id, h: dict.behaviors[id] }))
      .sort((a, b) => (a.h.domain + (codeMap.get(a.id) || '')).localeCompare(b.h.domain + (codeMap.get(b.id) || '')))
      .forEach((x) => {
        const h = x.h;
        const zh = S(h.zh_name || h.en_name).replace(/\|/g, '/') || '-';
        const en = S(h.en_name || h.zh_name).replace(/\|/g, '/') || '-';
        const parent = h.parent_id && codeMap.has(h.parent_id) ? codeMap.get(h.parent_id) : '-';
        lines.push('item ' + [h.domain, codeMap.get(x.id) || 'h', h.en_code || '-', zh].join(' ')
          + ' | ' + en + dictTail(h.weight, parent, false, h.sort, ''));
      });
    const autoKeys = new Set();
    ['nodes', 'tags', 'behaviors'].forEach((kind) => {
      Object.keys(dict[kind] || {}).forEach((id) => {
        const x = dict[kind][id];
        [x.zh_name, x.en_name, x.zh_code, x.en_code, codeMap.get(id)].forEach((k) => k && autoKeys.add(k));
      });
    });
    const codeDomains = { nodes: new Map(), tags: new Map(), behaviors: new Map() };
    ['nodes', 'tags', 'behaviors'].forEach((kind) => {
      Object.keys(dict[kind] || {}).forEach((id) => {
        const code = codeMap.get(id);
        if (!code) return;
        const d = S(dict[kind][id].domain || 'P').toUpperCase();
        if (!codeDomains[kind].has(code)) codeDomains[kind].set(code, new Set());
        codeDomains[kind].get(code).add(d);
      });
    });
    Object.keys(dict.aliases || {}).forEach((key) => {
      const targets = (dict.aliases[key] || []).filter((id) => dict.nodes[id] || dict.tags[id] || dict.behaviors[id]);
      if (!targets.length) return;
      const toks = targets.map((id) => {
        const kind = dict.nodes[id] ? 'nodes' : dict.tags[id] ? 'tags' : 'behaviors';
        const prefix = kind === 'nodes' ? 'N' : kind === 'tags' ? 'T' : 'H';
        const code = codeMap.get(id);
        if (!code) return '';
        const domains = codeDomains[kind].get(code) || new Set();
        if (domains.size > 1) {
          return prefix + ':' + S(dict[kind][id].domain || 'P').toUpperCase() + ':' + code;
        }
        return prefix + ':' + code;
      }).filter(Boolean);
      if (!toks.length) return;
      if (targets.length === 1 && autoKeys.has(key)) return;
      lines.push('alias ' + key + ' -> ' + toks.join(', '));
    });
    return lines.join('\n') + '\n';
  }

  function domainPrefix(domain) {
    const d = String(domain || 'P').toUpperCase();
    return d === 'P' ? '' : d + ' ';
  }

  function normalizeDomainSyntax(text) {
    return S(text).replace(/\r\n?/g, '\n').split('\n').map((line) => (
      line.replace(/^(\s*)\[([PFCH])\]\s+/i, (m, sp, d) => (
        d.toUpperCase() === 'P' ? sp : sp + d.toUpperCase() + ' '
      )).replace(/^(\s*)P\s+/i, '$1')
    )).join('\n');
  }

  /* ---------------- 固定收支：源码里的 [固定] 段 ----------------
   *
   * 固定收支不建单独的“软件表单”，它仍然是源码的一部分：
   *
   *   每月16日 微信钱包 > 房租 1000 < 消费 上次=261116
   *   每天 微信钱包 > 早餐 5
   *   每年11月16日 微信钱包 > 保险 3000
   *   停用 每月20日 微信钱包 > 餐饮 15
   *
   * 段在流水末尾，前面固定空 20 行；编译后得到计划对象，再投影回当前模式。
   */

  const PLAN_HEADER = '[固定]';
  const INSTALLMENT_HEADER = '[分期]';
  const PLAN_GAP = 20;
  const PLAN_COMMENT = '// 与流水同形：每日 / 19日 / 每年11月16日 + 转出 > 转入 金额 < 备注';
  const INSTALLMENT_COMMENT = '// 分期：还款日 支付节点 > 收款节点 每期计算表达式 < 首月日期/期数';

  function planSections(source) {
    const lines = S(source).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (t !== PLAN_HEADER && t !== INSTALLMENT_HEADER) continue;
      out.push({
        header: t === INSTALLMENT_HEADER ? 'installment' : 'fixed',
        head: i,
        start: i + 1,
        end: lines.length,
      });
    }
    out.forEach((sec, i) => {
      if (i + 1 < out.length) sec.end = out[i + 1].head;
    });
    return { lines, sections: out };
  }

  function planSectionRange(source) {
    const r = planSections(source);
    const first = r.sections[0];
    if (!first) return { lines: r.lines, header: -1, start: r.lines.length, end: r.lines.length };
    return { lines: r.lines, header: first.head, start: first.start, end: r.sections[r.sections.length - 1].end };
  }

  /** 流水正文的结束位置（不含 20 行空行与 [固定]/[分期] 段）。 */
  function recordsEndIndex(source) {
    const r = planSections(source);
    let end = r.sections.length ? r.sections[0].head : r.lines.length;
    while (end > 0 && !r.lines[end - 1].trim()) end -= 1;
    return end;
  }

  function planDay(plan) {
    const n = Number(plan && plan.day);
    if (n >= 1 && n <= 31) return n;
    const p = dateMod.parseDate((plan && (plan.firstDue || plan.lastRun || plan.start)) || '');
    return p.ok ? p.day : 1;
  }

  function planMonth(plan) {
    const n = Number(plan && plan.month);
    if (n >= 1 && n <= 12) return n;
    const p = dateMod.parseDate((plan && (plan.firstDue || plan.lastRun || plan.start)) || '');
    return p.ok ? p.month : 1;
  }

  /** '2608' / '2026-08' / '2026-08-16' → '2608'（固定表的月份 key）。 */
  function planMonthKey(raw) {
    const s = S(raw).replace(/[^\d]/g, '');
    if (!s) return '';
    if (s.length >= 6 && /^(19|20)\d{2}$/.test(s.slice(0, 4))) return s.slice(2, 4);
    if (s.length >= 4) return s.slice(0, 4);
    return '';
  }

  function planSchedule(plan) {
    if (!plan || plan.period === 'd') return '每日';
    if (plan.period === 'y') return '每年' + planMonth(plan) + '月' + planDay(plan) + '日';
    return '每月' + planDay(plan) + '日';
  }

  function planRef(dict, codeMap, id, kind) {
    const rec = kind === 'tag' ? (dict.tags || {}) : (dict.nodes || {});
    const x = rec[id];
    if (!x) return '?';
    return (codeMap && codeMap.get(id)) || S(x.zh_code) || S(x.en_code) || id;
  }

  const PLAN_STATE_LABEL = { generated: '生成', confirmed: '确认', voided: '作废' };

  function planStateText(plan) {
    const st = (plan && plan.state) || {};
    const parts = [];
    Object.keys(PLAN_STATE_LABEL).forEach((k) => {
      const list = Array.isArray(st[k]) ? st[k].filter((x) => /^\d{4,8}$/.test(S(x))).map(String) : [];
      if (list.length) parts.push(PLAN_STATE_LABEL[k] + '=' + list.join(','));
    });
    return parts.join(' ');
  }

  function parsePlanState(text, out) {
    const st = out || { generated: [], confirmed: [], voided: [] };
    S(text).split(/[\s\u3000]+/).filter(Boolean).forEach((tok) => {
      const m = tok.match(/^(生成|确认|作废|generated|confirmed|voided)=(.+)$/i);
      if (!m) return;
      const key = m[1] === '生成' || /^generated$/i.test(m[1]) ? 'generated'
        : m[1] === '确认' || /^confirmed$/i.test(m[1]) ? 'confirmed' : 'voided';
      m[2].split(',').map((x) => x.trim()).filter((x) => /^\d{4,8}$/.test(x))
        .forEach((x) => { if (!st[key].includes(x)) st[key].push(x); });
    });
    return st;
  }

  function planLineText(plan, dict, opts) {
    const o = opts || {};
    const mode = o.mode === 'PLAIN' ? 'PLAIN' : 'CODE';
    const lang = o.lang === 'en' ? 'en' : 'zh';
    const codeMap = sourceCodeMap(dict);
    const name = (kind, id) => {
      if (!kind || !id) return '?';
      const rec = kind === 'tag' ? (dict.tags || {}) : (dict.nodes || {});
      if (!rec[id]) return '?';
      if (mode === 'CODE') return planRef(dict, codeMap, id, kind);
      return kind === 'tag'
        ? dictMod.renderTag(dict, id, 'PLAIN', lang)
        : dictMod.renderNode(dict, id, 'PLAIN', lang);
    };
    let from = name('node', plan.from);
    let to = name('node', plan.to);
    const fn = dict.nodes && dict.nodes[plan.from];
    const tn = dict.nodes && dict.nodes[plan.to];
    if (mode === 'CODE' && fn && tn && fn.domain !== tn.domain) {
      from = fn.domain + ':' + from;
      to = tn.domain + ':' + to;
    }
    const tags = (plan.tagIds || []).map((id) => ' < ' + name('tag', id)).join('');
    let head = (plan.status === 'canceled' ? '停用 ' : '')
      + planSchedule(plan) + ' ' + from + ' > ' + to + ' ' + formatYuanExact(plan.amountCents) + tags;
    if (plan.kind === 'installment') {
      const inst = plan.inst || {};
      const periods = Number(inst.periods) || Number(plan.periods) || 0;
      const firstMonth = planMonthKey(inst.firstMonth || plan.firstMonth || '');
      head += ' 期数=' + periods;
      if (firstMonth) head += ' 首月=' + firstMonth;
      head += ' 本金=' + formatYuanExact(inst.principalCents || plan.principalCents || 0);
      head += ' 利息=' + formatYuanExact(inst.interestCents || plan.interestCents || 0);
    }
    const note = S(plan.note).trim();
    const state = planStateText(plan);
    if (plan.noteInline && note) head += ' < ' + note;
    const commentNote = plan.noteInline ? '' : note;
    const comment = commentNote ? (state ? commentNote + ' | ' + state : commentNote) : state;
    const source = S(plan.sourceDate).trim();
    return head + (source ? ' < ' + source : '') + (comment ? ' // ' + comment : '');
  }

  /** 只允许 + - * / 和括号的算术表达式（不 eval，拒绝其它字符）。 */
  function evalArithmetic(src) {
    const s = String(src || '').replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i];
    const number = () => {
      const m = s.slice(i).match(/^\d+(?:\.\d+)?/);
      if (!m) throw new Error('number');
      i += m[0].length;
      const n = Number(m[0]);
      if (!Number.isFinite(n)) throw new Error('number');
      return n;
    };
    const factor = () => {
      if (peek() === '+') { i += 1; return factor(); }
      if (peek() === '-') { i += 1; return -factor(); }
      if (peek() === '(') {
        i += 1;
        const v = expr();
        if (peek() !== ')') throw new Error('paren');
        i += 1;
        return v;
      }
      return number();
    };
    const term = () => {
      let v = factor();
      while (peek() === '*' || peek() === '/') {
        const op = s[i];
        i += 1;
        const r = factor();
        if (op === '/') {
          if (r === 0) throw new Error('zero');
          v /= r;
        } else v *= r;
      }
      return v;
    };
    const expr = () => {
      let v = term();
      while (peek() === '+' || peek() === '-') {
        const op = s[i];
        i += 1;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    try {
      const v = expr();
      if (i !== s.length || !Number.isFinite(v)) return null;
      return v;
    } catch (e) {
      return null;
    }
  }

  /**
   * 分期紧凑写法：
   *   `20000/12+2000/12 < 2612/12`：本金/期数 + 利息/期数；
   *   `(20000+2000)/12 < 2612/12`：任意 + - * / () 表达式；
   *   `9900/7 < 2612/7`：剩余应还 / 剩余期数。
   * `< 首月/期数` 的期数可单列；不写 `/N` 时从表达式最后的分母推断。
   * 统一补成标准字段，但固定页写回仍保留用户原行。
   */
  function compactInstallmentRest(rest) {
    const text = String(rest || '').trim();
    const head = text.match(/^(\S+)\s*>\s*(\S+)\s+([\s\S]+)$/);
    if (!head) return rest;
    const from = head[1];
    const to = head[2];
    const body = head[3].trim();
    let exprText = '';
    let first = '';
    let explicit = 0;
    let tail = '';
    const marker = body.match(/<\s*(\d{4})(?:\s*\/\s*(\d{1,3}))?/);
    if (marker) {
      exprText = body.slice(0, marker.index).trim();
      first = marker[1];
      explicit = Number(marker[2] || 0);
      tail = body.slice(marker.index + marker[0].length).trim();
    } else {
      const trailing = body.match(/^([\s\S]+?)\s+(\d{4})(?:\s*\/\s*(\d{1,3}))?$/);
      if (!trailing) return rest;
      exprText = trailing[1].trim();
      first = trailing[2];
      explicit = Number(trailing[3] || 0);
    }
    if (!exprText || !/[+\-*/()]/.test(exprText)) return rest;
    const monthly = evalArithmetic(exprText);
    if (!(monthly > 0)) return rest;
    let periods = explicit;
    if (!periods) {
      const split = exprText.match(/^\s*([\d.]+)\s*\/\s*(\d{1,3})\s*\+\s*([\d.]+)\s*\/\s*(\d{1,3})\s*$/);
      if (split && Number(split[2]) === Number(split[4])) periods = Number(split[2]);
      else {
        const div = exprText.match(/\/\s*(\d{1,3})\s*$/);
        if (div) periods = Number(div[1]);
      }
    }
    if (!(periods >= 1) || periods > 360) return rest;
    const split = exprText.match(/^\s*([\d.]+)\s*\/\s*(\d{1,3})\s*\+\s*([\d.]+)\s*\/\s*(\d{1,3})\s*$/);
    let principalText = '';
    let interestText = '0';
    if (split && Number(split[2]) === periods && Number(split[4]) === periods) {
      principalText = split[1];
      interestText = split[3];
    } else {
      /* 任意表达式只知道月供；总额 = 月供 × 期数，最后一期再用总额补差。 */
      principalText = (monthly * periods).toFixed(2);
    }
    return from + ' > ' + to + ' ' + monthly.toFixed(2) + ' *m 期数=' + periods
      + ' 首月=' + first + ' 本金=' + principalText + ' 利息=' + interestText
      + (tail ? ' ' + tail : '');
  }

  function parsePlanLineText(raw, dict, opts, lineNo, kind) {
    const o = opts || {};
    const type = kind === 'installment' ? 'installment' : 'fixed';
    let text = S(raw).trim();
    if (!text) return null;
    let note = '';
    let noteInline = false;
    let state = { generated: [], confirmed: [], voided: [] };
    const ci = text.indexOf('//');
    if (ci >= 0) {
      const comment = text.slice(ci + 2).trim();
      text = text.slice(0, ci).trim();
      const bar = comment.indexOf('|');
      if (bar >= 0) {
        const left = comment.slice(0, bar).trim();
        const right = parsePlanState(comment.slice(bar + 1), { generated: [], confirmed: [], voided: [] });
        const leftIsStateOnly = /^(?:\s*(?:生成|确认|作废|generated|confirmed|voided)=\d{4,8}(?:,\d{4,8})*\s*)+$/.test(left);
        if (leftIsStateOnly) {
          state = parsePlanState(left, right);
          note = '';
        } else {
          note = left;
          state = right;
        }
      } else {
        const only = parsePlanState(comment, { generated: [], confirmed: [], voided: [] });
        const hasState = only.generated.length || only.confirmed.length || only.voided.length;
        if (hasState) state = only;
        else note = comment.trim();
      }
    } else {
      text = stripComment(text).trim();
    }
    if (!text) return null;
    let status = 'active';
    if (/^停用(\s|$)/.test(text)) { status = 'canceled'; text = text.replace(/^停用\s*/, ''); }
    const sm = text.match(/^(每日|(?:每月\s*)?(\d{1,2})\s*日|每年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日)\s+(.+)$/);
    if (!sm) return { error: '固定收支行格式：19日 微信 > 房租 1000 *m', line: lineNo };
    let period = 'm';
    let day = 0;
    let month = 0;
    if (sm[1] === '每日') period = 'd';
    else if (sm[2]) { period = 'm'; day = Number(sm[2]); }
    else { period = 'y'; month = Number(sm[3]); day = Number(sm[4]); }
    let rest = sm[5];
    if (type === 'installment') rest = compactInstallmentRest(rest);
    let sourceDate = '';
    const sd = rest.match(/\s<\s*(\d{6})(?=\s|$)/);
    if (sd) {
      sourceDate = sd[1];
      rest = (rest.slice(0, sd.index) + ' ' + rest.slice(sd.index + sd[0].length)).trim();
    }
    /* 固定页里 `*m < 文本` 或没有 *m 的行尾 `< 文本` 是备注，不是标签；
     * 有 *m 且 < 在 *m 之前时仍是标签，兼容旧写法。 */
    let tailNote = rest.match(/\s+\*[dmy]\s+<\s*([^<]+?)\s*$/i);
    if (!tailNote && !/\*[dmy]\b/i.test(rest)) tailNote = rest.match(/\s+<\s*([^<]+?)\s*$/);
    if (tailNote) {
      const extra = tailNote[1].trim();
      note = note ? note + ' · ' + extra : extra;
      noteInline = true;
      rest = rest.slice(0, tailNote.index).trim();
    }
    let periods = 0;
    let firstMonth = '';
    let principalCents = 0;
    let interestCents = 0;
    const pm = rest.match(/(^|\s)\*([dmy])(?=\s|$)/i);
    if (pm) {
      period = pm[2].toLowerCase();
      rest = rest.replace(pm[0], ' ');
    }
    if (type === 'installment') {
      const take = (re, apply) => {
        const m = rest.match(re);
        if (!m) return;
        rest = rest.replace(m[0], ' ');
        apply(m);
      };
      take(/(^|\s)期数=(\d{1,3})(?=\s|$)/, (m) => { periods = Number(m[2]); });
      take(/(^|\s)首月=(\d{4}|\d{4}-\d{2})(?=\s|$)/, (m) => { firstMonth = planMonthKey(m[2]); });
      take(/(^|\s)本金=(\d+(?:\.\d{1,2})?[kK]?)(?=\s|$)/, (m) => {
        const q = amount.parseAmount(m[2]);
        principalCents = q.ok ? q.cents : 0;
      });
      take(/(^|\s)利息=(\d+(?:\.\d{1,2})?[kK]?)(?=\s|$)/, (m) => {
        const q = amount.parseAmount(m[2]);
        interestCents = q.ok ? q.cents : 0;
      });
      /* 兼容旧写法：共N期 / 首期=YYMMDD */
      if (!(periods >= 1)) {
        take(/(^|\s)共\s*(\d{1,3})\s*期(?=\s|$)/, (m) => { periods = Number(m[2]); });
        take(/(^|\s)(\d{1,3})\s*期(?=\s|$)/, (m) => { periods = Number(m[2]); });
      }
      if (!firstMonth) {
        take(/(^|\s)首期=(\d{6})(?=\s|$)/, (m) => { firstMonth = planMonthKey(m[2]); });
      }
      if (!(periods >= 1)) return { error: '分期缺少 期数=N', line: lineNo };
      if (periods > 360) return { error: '分期期数不能超过 360', line: lineNo };
      if (!/^\d{4}$/.test(firstMonth)) return { error: '分期缺少 首月=YYMM', line: lineNo };
      if (principalCents < 0 || interestCents < 0) return { error: '分期本金 / 利息不能为负', line: lineNo };
    }
    rest = rest.replace(/\s+/g, ' ').trim();
    if (!rest) return { error: '固定收支缺 转出 > 转入 金额', line: lineNo };
    const today = dateMod.todayStamp(o.now || new Date());
    const compiled = compileLedgerSource(today + ' ' + rest, dict, {
      now: o.now, domain: o.domain || 'P', autoCreateBehaviors: false,
    });
    const ev = (compiled.events || [])[0];
    if (!ev || ev.kind !== 'account') {
      const d = (compiled.diagnostics || []).find((x) => x.severity === 'error') || (compiled.diagnostics || [])[0];
      return { error: '固定收支认不出：' + (d ? d.message : rest), line: lineNo };
    }
    if (!(ev.amountCents > 0)) return { error: '固定收支金额必须大于 0', line: lineNo };
    if (type === 'installment' && period === 'd') return { error: '分期不能按天', line: lineNo };
    return {
      ok: true,
      id: 'P_' + lineNo,
      kind: type,
      status,
      period,
      day,
      month,
      note,
      state,
      periods: type === 'installment' ? periods : 0,
      firstMonth: type === 'installment' ? firstMonth : '',
      principalCents: type === 'installment' ? principalCents : 0,
      interestCents: type === 'installment' ? interestCents : 0,
      inst: type === 'installment'
        ? { periods, firstMonth, principalCents, interestCents }
        : null,
      domain: ev.domain || 'P',
      from: ev.from,
      to: ev.to,
      amountCents: ev.amountCents,
      tagIds: (ev.tagIds || []).slice(),
      line: lineNo,
      raw: S(raw).trim(),
      sourceDate,
      noteInline,
    };
  }

  function parsePlanSection(source, dict, opts) {
    const r = planSections(source);
    const plans = [];
    const diagnostics = [];
    r.sections.forEach((sec) => {
      for (let i = sec.start; i < sec.end; i += 1) {
        const line = S(r.lines[i]).trim();
        if (!line || line.startsWith('//')) continue;
        const p = parsePlanLineText(r.lines[i], dict, opts, i + 1, sec.header);
        if (!p) continue;
        if (p.error) { diagnostics.push(diag(i + 1, p.error)); continue; }
        plans.push(p);
      }
    });
    return { plans, diagnostics };
  }

  /** [固定] + [分期] 两段（含前面 20 行空行）；没有计划时返回空数组。 */
  function planSectionBlock(plans, dict, opts) {
    const list = plans || [];
    if (!list.length) return [];
    const fixed = list.filter((p) => p.kind !== 'installment');
    const inst = list.filter((p) => p.kind === 'installment');
    const out = [];
    for (let i = 0; i < PLAN_GAP; i += 1) out.push('');
    out.push(PLAN_HEADER);
    out.push(PLAN_COMMENT);
    fixed.forEach((p) => out.push(planLineText(p, dict, opts)));
    out.push('');
    out.push(INSTALLMENT_HEADER);
    out.push(INSTALLMENT_COMMENT);
    inst.forEach((p) => out.push(planLineText(p, dict, opts)));
    return out;
  }

  /** 用 [固定]/[分期] 段重建整份流水文本（正文 + 20 空行 + 计划）。 */
  function withPlanSection(source, plans, dict, opts) {
    const end = recordsEndIndex(source);
    const lines = S(source).replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
    const head = lines.slice(0, end);
    const block = planSectionBlock(plans, dict, opts);
    const all = block.length ? head.concat(block) : head;
    return all.join('\n') + '\n';
  }

  function ledgerToSource(dict, events, behaviors, notes) {
    const codeMap = sourceCodeMap(dict);
    const lines = [];
    lines.push('// TxtVein ledger source · 一行可展开多条原子边；日期 YYMMDD；// 注释');
    (events || []).forEach((e) => {
      const fn = dict.nodes[e.from];
      const tn = dict.nodes[e.to];
      const cross = fn && tn && fn.domain !== tn.domain;
      const from = (cross ? fn.domain + ':' : '') + (codeMap.get(e.from) || '?');
      const to = (cross ? tn.domain + ':' : '') + (codeMap.get(e.to) || '?');
      const amt = e.minutes > 0 ? amount.formatTime(e.minutes) : formatYuanExact(e.amountCents);
      const tags = (e.tagIds || []).map((id) => codeMap.get(id)).filter(Boolean).map((c) => ' < ' + c).join('');
      const rawNote = S(e.note).trim();
      const note = rawNote
        ? (rawNote.startsWith('<') ? ' ' + rawNote : ' // ' + rawNote.replace(/\/\//g, '/ /'))
        : '';
      lines.push(domainPrefix(e.domain) + e.date + ' ' + from + ' > ' + to + ' ' + amt + tags + note);
    });
    (behaviors || []).forEach((b) => {
      const from = codeMap.get(b.from) || '?';
      const to = codeMap.get(b.to) || '?';
      const tags = (b.tagIds || []).map((id) => codeMap.get(id)).filter(Boolean).map((c) => ' < ' + c).join('');
      lines.push(domainPrefix(b.domain) + b.date + ' ' + from + ' > ' + to + ' ' + (b.weight || 1) + tags);
    });
    (notes || []).forEach((n) => {
      if (n.kind === 'comment' || n.kind === 'invalid') {
        lines.push(n.raw || '');
        return;
      }
      const amt = n.minutes > 0 ? amount.formatTime(n.minutes) : n.amountCents ? formatYuanExact(n.amountCents) : '';
      const cat = codeMap.get(n.categoryId) || '';
      const kws = (n.keywordIds || []).map((id) => codeMap.get(id)).filter(Boolean).join(' ');
      lines.push(domainPrefix(n.domain) + n.date + ' ' + (amt ? amt + ' ' : '') + '< ' + cat + (kws ? ' < ' + kws : ''));
    });
    return lines.join('\n') + '\n';
  }

  /** 只有真正的固定表行才原样保留；规则行 / 底层 ID 行不能写进固定表。 */
  function isFixedRawLine(raw) {
    return /^(?:停用\s+)?(?:每日|每月\s*\d{1,2}\s*日|\d{1,2}\s*日|每年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s+/.test(raw);
  }

  /** 原样保留用户输入的计划行，只更新末尾的 生成/确认/作废 状态。 */
  function planSourceLine(plan) {
    const raw = S(plan && plan.raw).trim();
    if (!raw || !isFixedRawLine(raw)) return '';
    const ci = raw.indexOf('//');
    const state = planStateText(plan);
    const note = S(plan && plan.note).trim();
    const head = (ci >= 0 ? raw.slice(0, ci).trimEnd() : raw)
      .replace(/\s+\*[dmy]\b/gi, '')
      .replace(/^(\s*(?:停用\s*)?)每月\s*(\d{1,2})\s*日/, '$1$2日');
    const inlineNote = plan.noteInline && note ? note : '';
    const commentNote = inlineNote ? '' : note;
    const merged = commentNote + (state ? (commentNote ? ' | ' : '') + state : '');
    return head + (merged ? ' // ' + merged : '');
  }

  /** 独立的固定表文本（[固定] + [分期] 两个区域，不需要前面的 20 行空行）。 */
  function fixedSourceFromPlans(plans, dict, opts) {
    const list = plans || [];
    const fixed = list.filter((p) => p.kind !== 'installment');
    const inst = list.filter((p) => p.kind === 'installment');
    const line = (p) => planSourceLine(p) || planLineText(p, dict, opts);
    const out = [];
    out.push(PLAN_HEADER);
    out.push(PLAN_COMMENT);
    fixed.forEach((p) => out.push(line(p)));
    out.push('');
    out.push(INSTALLMENT_HEADER);
    out.push(INSTALLMENT_COMMENT);
    inst.forEach((p) => out.push(line(p)));
    return out.join('\n') + '\n';
  }

  /** 编译独立的固定表：返回计划对象 + 行级诊断。 */
  function compileFixed(fixedSource, dict, opts) {
    const r = parsePlanSection(S(fixedSource), dict, opts);
    const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
    return { ok: errors === 0, plans: r.plans, diagnostics: r.diagnostics, errors };
  }

  function parseNames(text) {
    const s = S(text);
    const i = s.indexOf('|');
    if (i < 0) return { left: s.trim(), right: '' };
    return { left: s.slice(0, i).trim(), right: s.slice(i + 1).trim() };
  }

  function parseTail(right) {
    const toks = S(right).split(/[\s\u3000]+/).filter(Boolean);
    let system = false;
    let sort = '100';
    let anchor = '';
    let pin = false;
    const ai = toks.findIndex((t) => /^[\^@]SYS\./i.test(t));
    if (ai >= 0) {
      anchor = toks[ai].slice(1);
      toks.splice(ai, 1);
    }
    const si = toks.findIndex((t) => /^sort:-?\d+$/i.test(t));
    if (si >= 0) {
      sort = toks[si].slice(5);
      toks.splice(si, 1);
    }
    const pi = toks.findIndex((t) => /^pin(?::[01])?$/i.test(t));
    if (pi >= 0) {
      pin = !/:0$/.test(toks[pi]);
      toks.splice(pi, 1);
    }
    if (toks.length && toks[toks.length - 1] === 'system') { system = true; toks.pop(); }
    let parent = '-';
    let weight = '0';
    if (toks.length) {
      const last = toks[toks.length - 1];
      if (last.startsWith('@') && last.length > 1) {
        parent = toks.pop().slice(1);
        if (toks.length && /^-?\d+(?:\.\d+)?$/.test(toks[toks.length - 1])) weight = toks.pop();
      } else if (/^-?\d+(?:\.\d+)?$/.test(last)) {
        weight = toks.pop();
      } else if (toks.length >= 2 && /^-?\d+(?:\.\d+)?$/.test(toks[toks.length - 2])) {
        /* 兼容旧格式：| 英文名 权重 父码（无 @） */
        parent = toks.pop();
        weight = toks.pop();
      }
    }
    return { enName: toks.join(' '), weight, parent, system, sort, anchor, pin };
  }

  function compileDictSource(text, opts) {
    if (TV.dictV4 && TV.dictV4.detect(text) === 'v4') {
      const r = TV.dictV4.parse(text, opts);
      const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
      return {
        ok: r.ok, dict: r.dict, diagnostics: r.diagnostics, errors,
        tokens: r.tokens, categories: r.categories, stats: r.stats, format: 'v4',
      };
    }
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const diagnostics = [];
    const records = [];
    const aliases = [];
    const treeLinks = [];
    let treeDomain = '';
    let treeType = '';
    let treeStack = [];
    const seen = { node: new Map(), tag: new Map(), item: new Map() };
    const codeKey = (kind, domain, code) => kind + '\u0000' + domain + '\u0000' + code;
    let section = 'account';
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');

    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = stripComment(raw).trim();
      if (!line) return;
      const sec = line.match(/^\[(ACCOUNT|NOTE|BEHAVIOR|TREE|会计|备注|行为|树)\]$/i);
      if (sec) {
        const key = sec[1].toUpperCase();
        section = key === '会计' || key === 'ACCOUNT' ? 'account'
          : key === '备注' || key === 'NOTE' ? 'note'
            : key === '树' || key === 'TREE' ? 'tree' : 'behavior';
        treeStack = [];
        return;
      }
      if (section === 'tree') {
        const rawLine = stripComment(raw).replace(/\t/g, '  ');
        const txt = rawLine.trim();
        if (!txt) return;
        const indent = rawLine.match(/^ */)[0].length;
        const h = txt.match(/^([PCFH])\s+(费用|收入|资产|负债|成本|权益)$/);
        if (h) {
          treeDomain = h[1];
          treeType = h[2];
          treeStack = [];
          return;
        }
        const m = txt.match(/^(.*?)\s*\[([^\]]+)\]$/);
        if (!m) {
          diagnostics.push(diag(lineNo, '树行格式：缩进 + 名称 + [简码]'));
          return;
        }
        if (!treeDomain) {
          diagnostics.push(diag(lineNo, '树行前缺少「域 类型」标题，例如 P 费用'));
          return;
        }
        const code = m[2].trim();
        const parent = treeStack.filter((x) => x.indent < indent).slice(-1)[0];
        treeLinks.push({
          domain: treeDomain, type: treeType, code,
          parentCode: parent ? parent.code : '', line: lineNo,
        });
        while (treeStack.length && treeStack[treeStack.length - 1].indent >= indent) treeStack.pop();
        treeStack.push({ indent, code });
        return;
      }
      if (/^alias\b/i.test(line)) {
        const m = line.match(/^alias\s+(.+?)\s*->\s*(.+)$/i);
        if (!m) { diagnostics.push(diag(lineNo, '别名格式：alias 别名 -> N:节点码 / T:标签码 / H:行为码')); return; }
        aliases.push({ key: m[1].trim(), targets: m[2].split(',').map((x) => x.trim()).filter(Boolean), line: lineNo });
        return;
      }
      const head = line.match(/^(node|tag|item)\b/i);
      if (!head) { diagnostics.push(diag(lineNo, '只认 node / tag / item / alias 开头的行')); return; }
      const kind = head[1].toLowerCase();
      const { left, right } = parseNames(line);
      const toks = left.split(/[\s\u3000]+/).filter(Boolean);
      if (kind === 'node') {
        if (section !== 'account') { diagnostics.push(diag(lineNo, 'node 只能写在 [会计] 段')); return; }
        if (toks.length < 7) { diagnostics.push(diag(lineNo, '节点格式：node 域 大类 形态 中文码 英文码 中文名 | 英文名 权重 父码')); return; }
        const dm = dictMod.normalizeDomain(toks[1], 'P');
        const ty = dictMod.normalizeType(toks[2]);
        if (!dm.ok) { diagnostics.push(diag(lineNo, dm.error)); return; }
        if (!ty.ok) { diagnostics.push(diag(lineNo, ty.error)); return; }
        const form = dictMod.normalizeForm(ty.type, toks[3]);
        if (!form.ok) { diagnostics.push(diag(lineNo, form.error)); return; }
        const code = codeSafe(toks[4]);
        const enCode = codeSafe(toks[5]) || code;
        const zhName = toks.slice(6).join(' ') || toks[4];
        const tail = parseTail(right);
        if (!code) { diagnostics.push(diag(lineNo, '节点缺中文码')); return; }
        if (seen.node.has(codeKey('node', dm.domain, code))) { diagnostics.push(diag(lineNo, '节点码重复：' + code)); return; }
        seen.node.set(codeKey('node', dm.domain, code), true);
        records.push({
          kind: 'node', line: lineNo, domain: dm.domain, type: ty.type, pole: ty.pole, form: form.form,
          code, enCode, zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0,
          sort: Number.isFinite(Number(tail.sort)) ? Number(tail.sort) : 100,
          anchor: tail.anchor || '', pin: !!tail.pin,
          parentCode: tail.parent, system: tail.system,
        });
        return;
      }
      if (kind === 'tag') {
        if (section !== 'note') { diagnostics.push(diag(lineNo, 'tag 只能写在 [备注] 段')); return; }
        if (toks.length < 6) { diagnostics.push(diag(lineNo, '标签格式：tag 域 类型 中文码 英文码 中文名 | 英文名 权重 父码')); return; }
        const dm = dictMod.normalizeDomain(toks[1], 'P');
        if (!dm.ok) { diagnostics.push(diag(lineNo, dm.error)); return; }
        const tagKind = TAG_KINDS.indexOf(toks[2]) >= 0 ? toks[2] : dictMod.tagKindOf(toks[5]);
        const code = codeSafe(toks[3]);
        const enCode = codeSafe(toks[4]) || code;
        const zhName = toks.slice(5).join(' ') || toks[3];
        const tail = parseTail(right);
        if (!code) { diagnostics.push(diag(lineNo, '标签缺中文码')); return; }
        if (seen.tag.has(codeKey('tag', dm.domain, code))) { diagnostics.push(diag(lineNo, '标签码重复：' + code)); return; }
        seen.tag.set(codeKey('tag', dm.domain, code), true);
        records.push({
          kind: 'tag', line: lineNo, domain: dm.domain, tagKind, code, enCode,
          zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0, parentCode: tail.parent,
          sort: Number.isFinite(Number(tail.sort)) ? Number(tail.sort) : 100,
        });
        return;
      }
      /* item = 行为项，身体/心理统一，层级由 parent 定义 */
      if (section !== 'behavior') { diagnostics.push(diag(lineNo, 'item 只能写在 [行为] 段')); return; }
      if (toks.length < 5) { diagnostics.push(diag(lineNo, '行为项格式：item 域 中文码 英文码 中文名 | 英文名 权重 父码')); return; }
      const dm = dictMod.normalizeDomain(toks[1], 'P');
      if (!dm.ok) { diagnostics.push(diag(lineNo, dm.error)); return; }
      const code = codeSafe(toks[2]);
      const enCode = codeSafe(toks[3]) || code;
      const zhName = toks.slice(4).join(' ') || toks[2];
      const tail = parseTail(right);
      if (!code) { diagnostics.push(diag(lineNo, '行为项缺中文码')); return; }
      if (seen.item.has(codeKey('item', dm.domain, code))) { diagnostics.push(diag(lineNo, '行为项码重复：' + code)); return; }
      seen.item.set(codeKey('item', dm.domain, code), true);
      records.push({
        kind: 'item', line: lineNo, domain: dm.domain, code, enCode,
        zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0, parentCode: tail.parent,
        sort: Number.isFinite(Number(tail.sort)) ? Number(tail.sort) : 100,
      });
    });

    const dict = dictMod.emptyDict(o.vaultId || '', now);
    dict.behaviors = {};
    dict.link = '';
    const usedIds = new Set(['N_sys_loss', 'N_sys_gain']);
    const nodeByCode = new Map();
    const tagByCode = new Map();
    const itemByCode = new Map();
    const anyCode = { node: new Map(), tag: new Map(), item: new Map() };
    const byCodeKey = (domain, code) => domain + '\u0000' + code;
    const getByCode = (kind, domain, code) => {
      if (kind === 'node') return nodeByCode.get(byCodeKey(domain, code));
      if (kind === 'tag') return tagByCode.get(byCodeKey(domain, code));
      return itemByCode.get(byCodeKey(domain, code));
    };
    const addCode = (kind, domain, code, id) => {
      if (!code) return;
      if (kind === 'node') nodeByCode.set(byCodeKey(domain, code), id);
      else if (kind === 'tag') tagByCode.set(byCodeKey(domain, code), id);
      else itemByCode.set(byCodeKey(domain, code), id);
      if (!anyCode[kind].has(code)) anyCode[kind].set(code, []);
      anyCode[kind].get(code).push({ domain, id });
    };
    records.filter((r) => r.kind === 'node').forEach((r) => {
      const id = ids.newNodeId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.nodes[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        polarity: r.pole, type: r.type, form: r.form, domain: r.domain,
        parent_id: '', weight: r.weight, sort: r.sort, pin: r.pin ? 1 : 0,
        system: !!r.system, created_at: now.toISOString(),
      };
      if (r.anchor) {
        const system = o.system || TV.systemDict;
        const core = TV.systemDictCore;
        const leaf = system && system.nodes ? system.nodes[r.anchor] : null;
        if (!leaf) {
          dict.nodes[id].anchor_id = r.anchor;
          diagnostics.push(diag(r.line, '锚点不在当前母树，保留为失效锚点：' + r.anchor, 'warn'));
        } else if (core && !core.isPostable(system.nodes, r.anchor)) {
          diagnostics.push(diag(r.line, '锚点必须是母树叶子：' + r.anchor));
        } else {
          const eff = core ? core.effectiveType(system.nodes, r.anchor) : null;
          if (eff && eff.polarity !== r.pole) {
            diagnostics.push(diag(r.line, '锚点「' + r.anchor + '」是 ' + eff.type + '（' + eff.polarity + ' 极），与节点 ' + r.type + '（' + r.pole + ' 极）冲突；不静默翻转'));
          } else {
            dict.nodes[id].anchor_id = r.anchor;
            if (eff) {
              dict.nodes[id].type = eff.type;
              dict.nodes[id].polarity = eff.polarity;
              dict.nodes[id].form = eff.form;
            }
          }
        }
      }
      addCode('node', r.domain, r.code, id);
    });
    records.filter((r) => r.kind === 'tag').forEach((r) => {
      const id = ids.newTagId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.tags[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        domain: r.domain, parent_id: '', weight: r.weight, sort: r.sort, kind: r.tagKind, created_at: now.toISOString(),
      };
      addCode('tag', r.domain, r.code, id);
    });
    records.filter((r) => r.kind === 'item').forEach((r) => {
      const id = ids.newBehaviorItemId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.behaviors[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        domain: r.domain, parent_id: '', weight: r.weight, sort: r.sort, created_at: now.toISOString(),
      };
      addCode('item', r.domain, r.code, id);
    });
    records.forEach((r) => {
      const id = getByCode(r.kind, r.domain, r.code);
      if (!id) return;
      if (r.parentCode && r.parentCode !== '-') {
        const pid = getByCode(r.kind, r.domain, r.parentCode);
        if (!pid) diagnostics.push(diag(r.line, (r.kind === 'node' ? '节点' : r.kind === 'tag' ? '标签' : '行为项') + '父码不存在或跨域：' + r.parentCode));
        else if (r.kind === 'node') dict.nodes[id].parent_id = pid;
        else if (r.kind === 'tag') dict.tags[id].parent_id = pid;
        else dict.behaviors[id].parent_id = pid;
      }
      dictMod.addAlias(dict, r.code, id);
      dictMod.addAlias(dict, r.enCode, id);
      dictMod.addAlias(dict, r.zhName, id);
      dictMod.addAlias(dict, r.enName, id);
    });
    aliases.forEach((a) => {
      a.targets.forEach((tok) => {
        const m = tok.match(/^([NTH]):(?:([PFCH]):)?(.+)$/i);
        const kind = m ? ({ N: 'node', T: 'tag', H: 'item' })[m[1].toUpperCase()] : '';
        const domain = m && m[2] ? m[2].toUpperCase() : '';
        const code = m ? m[3] : tok;
        let id = '';
        if (kind) {
          if (domain) {
            id = getByCode(kind, domain, code);
          } else {
            const arr = anyCode[kind].get(code) || [];
            if (arr.length === 1) id = arr[0].id;
            else if (arr.length > 1) {
              diagnostics.push(diag(a.line, '别名目标跨域同码，请写 N:P:码 / N:C:码：' + tok));
              return;
            }
          }
        } else {
          const arr = [];
          ['node', 'tag', 'item'].forEach((k) => {
            (anyCode[k].get(code) || []).forEach((x) => arr.push(x));
          });
          if (arr.length === 1) id = arr[0].id;
          else if (arr.length > 1) {
            diagnostics.push(diag(a.line, '别名目标跨域同码，请写域限定：' + tok));
            return;
          }
        }
        if (!id) diagnostics.push(diag(a.line, '别名目标不存在：' + tok));
        else dictMod.addAlias(dict, a.key, id);
      });
    });
    if (treeLinks.length) {
      const byKey = new Map();
      Object.keys(dict.nodes).forEach((id) => {
        const n = dict.nodes[id];
        if (n.system) return;
        const key = S(n.domain) + '\u0000' + S(n.zh_code || n.en_code || id);
        byKey.set(key, id);
        byKey.set(S(n.domain) + '\u0000' + id, id);
      });
      const seenLink = new Set();
      treeLinks.forEach((link) => {
        const key = link.domain + '\u0000' + link.code;
        const id = byKey.get(key);
        if (!id) {
          diagnostics.push(diag(link.line, '树行找不到节点：' + link.code));
          return;
        }
        if (seenLink.has(id)) {
          diagnostics.push(diag(link.line, '树行节点重复：' + link.code));
          return;
        }
        seenLink.add(id);
        if (!link.parentCode) {
          dict.nodes[id].parent_id = '';
          return;
        }
        const pid = byKey.get(link.domain + '\u0000' + link.parentCode);
        if (!pid) {
          diagnostics.push(diag(link.line, '树行父级找不到：' + link.parentCode));
          return;
        }
        if (pid === id) {
          diagnostics.push(diag(link.line, '树行不能把自己当父级：' + link.code));
          return;
        }
        if (dict.nodes[pid].type !== dict.nodes[id].type) {
          diagnostics.push(diag(link.line, '树行父子类型不同：' + link.parentCode + ' / ' + link.code));
          return;
        }
        dict.nodes[id].parent_id = pid;
      });
    }
    [['N_sys_loss', 'loss', 'Loss', '费用', 'A', 'steam', '损耗'],
      ['N_sys_gain', 'gain', 'Gain', '收入', 'B', 'outside', '增益']].forEach((x) => {
      if (dict.nodes[x[0]]) return;
      dict.nodes[x[0]] = {
        zh_name: x[6], en_name: x[2], zh_code: x[1], en_code: x[1],
        polarity: x[4], type: x[3], form: x[5], domain: 'P',
        parent_id: '', weight: 0, sort: 100, system: true, created_at: now.toISOString(),
      };
    });
    dict.meta.nextNode = 1;
    dict.meta.nextTag = 1;
    dict.meta.nextEvent = 1;
    dict.meta.nextChain = 1;
    dict.meta.nextRule = 1;
    dict.meta.nextPlan = 1;
    dict.meta.updatedAt = now.toISOString();
    const errors = diagnostics.filter((x) => x.severity === 'error').length;
    return { ok: errors === 0, dict, diagnostics, errors, lines: lines.length };
  }

  /* ---------------- 行为/会计/备注解析 ---------------- */

  function behaviorMatches(dict, token) {
    const t = S(token).trim();
    const low = t.toLowerCase();
    const idsOut = [];
    Object.keys(dict.behaviors || {}).forEach((id) => {
      const h = dict.behaviors[id];
      if (S(h.zh_code).toLowerCase() === low || S(h.en_code).toLowerCase() === low
        || h.zh_name === t || h.en_name === t) idsOut.push(id);
    });
    return idsOut;
  }

  function behaviorPrefix(dict, token) {
    const t = S(token).trim();
    if (!t) return [];
    const low = t.toLowerCase();
    const idsOut = [];
    Object.keys(dict.behaviors || {}).forEach((id) => {
      const h = dict.behaviors[id];
      if (S(h.zh_code).toLowerCase().startsWith(low) || S(h.en_code).toLowerCase().startsWith(low)
        || S(h.zh_name).startsWith(t) || S(h.en_name).toLowerCase().startsWith(low)) idsOut.push(id);
    });
    return idsOut;
  }

  function resolveBehavior(dict, token, ctx) {
    const t = S(token).trim();
    let idsOut = (dict.aliasIds ? [] : []);
    if (dict.aliases) {
      const hit = Object.keys(dict.aliases).find((k) => k.toLowerCase() === t.toLowerCase());
      if (hit) idsOut = (dict.aliases[hit] || []).filter((id) => dict.behaviors[id]);
    }
    if (idsOut.length === 1) return { ok: true, id: idsOut[0], item: dict.behaviors[idsOut[0]] };
    if (idsOut.length > 1) return { ok: false, ambiguous: idsOut.map((id) => ({ id, item: dict.behaviors[id] })) };
    idsOut = behaviorMatches(dict, t);
    if (idsOut.length === 1) return { ok: true, id: idsOut[0], item: dict.behaviors[idsOut[0]] };
    if (idsOut.length > 1) return { ok: false, ambiguous: idsOut.map((id) => ({ id, item: dict.behaviors[id] })) };
    idsOut = behaviorPrefix(dict, t);
    if (idsOut.length === 1) return { ok: true, id: idsOut[0], item: dict.behaviors[idsOut[0]] };
    if (idsOut.length > 1) return { ok: false, ambiguous: idsOut.map((id) => ({ id, item: dict.behaviors[id] })) };
    return { ok: false, unbound: true };
  }

  function resolveToken(dict, raw, ctx) {
    let token = S(raw).trim();
    let force = '';
    const fm = token.match(/^([NTH]):(.+)$/i);
    if (fm) { force = fm[1].toUpperCase(); token = fm[2]; }
    let domain = '';
    const dm = token.match(/^([PFCH]):(.+)$/i);
    if (dm) { domain = dm[1].toUpperCase(); token = dm[2]; }
    if (force === 'H') {
      const r = resolveBehavior(dict, token, { domain: domain || ctx.domain });
      return r.ok ? { ok: true, account: null, behavior: r.id, force } : { ok: false, error: '找不到行为项：' + token, force };
    }
    if (force === 'N') {
      const r = dictMod.resolveAlias(dict, token, { domain: domain || ctx.domain, lang: 'zh' });
      return r.ok ? { ok: true, account: r.id, behavior: null, force }
        : { ok: false, error: r.error, crossDomain: !!r.crossDomain, force };
    }
    const a = dictMod.resolveAlias(dict, token, { domain: domain || ctx.domain, lang: 'zh' });
    const b = resolveBehavior(dict, token, { domain: domain || ctx.domain });
    if (a.ok && b.ok) return { ok: true, account: a.id, behavior: b.id, dual: true };
    if (a.ok) return { ok: true, account: a.id, behavior: null };
    if (b.ok) return { ok: true, account: null, behavior: b.id };
    if (a.code === 'AMBIGUOUS' || b.ambiguous) {
      return { ok: false, error: '多义：' + token, ambiguous: true };
    }
    return { ok: false, error: '找不到节点/行为项：' + token, crossDomain: !!a.crossDomain };
  }

  function ensureNoteTag(dict, name, ctx, autoTags, usedIds) {
    const t = S(name).trim();
    if (!t) return '';
    const r = dictMod.resolveTag(dict, t, { domain: ctx.domain });
    if (r.ok) return r.id;
    let code = codeSafe(t) || 'tag';
    const existing = Object.keys(dict.tags || {}).find((id) => dict.tags[id].zh_code === code);
    if (existing) code = code + '_2';
    const id = ids.newTagId((x) => usedIds.has(x));
    usedIds.add(id);
    dict.tags[id] = {
      zh_name: t, en_name: t, zh_code: code, en_code: code,
      domain: ctx.domain || 'P', parent_id: ctx.parentId || '',
      weight: 10, kind: dictMod.tagKindOf(t), created_at: new Date().toISOString(), auto: true,
    };
    dictMod.addAlias(dict, code, id);
    dictMod.addAlias(dict, t, id);
    autoTags.push({ id, name: t, code });
    return id;
  }

  /** 行为项自动建：身体/心理统一，层级由字典后续维护 */
  function ensureBehaviorItem(dict, rawToken, ctx, autoBehaviors, usedIds) {
    let token = S(rawToken).trim();
    const fm = token.match(/^([NTH]):(.+)$/i);
    if (fm) token = fm[2];
    const dm = token.match(/^([PFCH]):(.+)$/i);
    if (dm) token = dm[2];
    const exist = Object.keys(dict.behaviors || {}).find((id) => {
      const h = dict.behaviors[id];
      return h.zh_code === token || h.en_code === token || h.zh_name === token || h.en_name === token;
    });
    if (exist) return exist;
    let nodeId = Object.keys(dict.nodes || {}).find((id) => {
      const n = dict.nodes[id];
      return n.zh_code === token || n.en_code === token || n.zh_name === token || n.en_name === token;
    });
    let name = token;
    let code = codeSafe(token) || 'h';
    let domain = ctx.domain || 'P';
    if (nodeId) {
      const n = dict.nodes[nodeId];
      name = n.zh_name || token;
      code = n.zh_code || code;
      domain = n.domain || domain;
    }
    code = codeSafe(code) || 'h';
    let unique = code;
    let i = 2;
    while (Object.keys(dict.behaviors || {}).some((id) => dict.behaviors[id].zh_code === unique)) {
      unique = code + i;
      i += 1;
    }
    const id = ids.newBehaviorItemId((x) => usedIds.has(x));
    usedIds.add(id);
    dict.behaviors[id] = {
      zh_name: name, en_name: name, zh_code: unique, en_code: unique,
      domain, parent_id: '', weight: 10, sort: 100, created_at: new Date().toISOString(), auto: true,
    };
    dictMod.addAlias(dict, unique, id);
    dictMod.addAlias(dict, name, id);
    if (nodeId) dictMod.addAlias(dict, token, id);
    autoBehaviors.push({ id, name, code: unique });
    return id;
  }

  function parseTagBlocks(tagPart, dict, ctx, autoTags, usedIds) {
    const out = [];
    let parentId = '';
    const blocks = S(tagPart).split('<').map((x) => x.trim()).filter(Boolean);
    blocks.forEach((block) => {
      const names = block.split(/[\s\u3000]+/).filter(Boolean);
      let firstId = '';
      names.forEach((name) => {
        if (name === '-') return;
        const id = ensureNoteTag(dict, name, { domain: ctx.domain, parentId }, autoTags, usedIds);
        if (!id) return;
        if (!firstId) firstId = id;
        if (!out.includes(id)) out.push(id);
      });
      parentId = firstId || parentId;
    });
    return out;
  }

  function parseLedgerLine(raw, dict, opts, ctxState) {
    const text = S(raw);
    const m = text.match(/<\s*(?:固定(?:每月|每日|每年)|\d{4}分期)[^<]*$/);
    if (!m) return parseLedgerLineCore(raw, dict, opts, ctxState);
    const clean = text.slice(0, m.index).trimEnd();
    const r = parseLedgerLineCore(clean, dict, opts, ctxState);
    const note = '< ' + m[0].replace(/^<\s*/, '').trim();
    (r.events || []).forEach((e) => { e.note = note; });
    return r;
  }

  function parseLedgerLineCore(raw, dict, opts, ctxState) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const diagnostics = [];
    const events = [];
    const behaviors = [];
    const notes = [];
    const autoTags = [];
    const autoBehaviors = [];
    const usedIds = ctxState.usedIds;
    const lineNo = ctxState.lineNo;
    const autoCreateBehaviors = o.autoCreateBehaviors !== false;
    function invalidNote(rawText, message, domain, stamp) {
      const id = ids.newTextId((x) => usedIds.has(x));
      usedIds.add(id);
      notes.push({
        id, kind: 'invalid', raw: String(rawText || '').trim(), line: lineNo,
        domain: domain || 'P', date: stamp || dateMod.todayStamp(new Date()),
        accounting: false, diagnostics: [diag(lineNo, message)],
      });
      diagnostics.push(diag(lineNo, message));
    }
    let src = S(raw).replace(/\r\n?/g, '\n');
    const commented = hasComment(src);
    src = stripComment(src).trim();
    if (!src) {
      if (commented) {
        notes.push({ id: ids.newTextId((x) => usedIds.has(x)), kind: 'comment', raw: S(raw).trim(), line: lineNo, domain: 'P', date: dateMod.todayStamp(now), accounting: false });
      }
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }
    if (/^\/\//.test(S(raw).trim())) {
      const id = ids.newTextId((x) => usedIds.has(x)); usedIds.add(id);
      notes.push({ id, kind: 'comment', raw: S(raw).trim(), line: lineNo, domain: 'P', date: dateMod.todayStamp(now), accounting: false });
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }
    src = TV.text.normalizeOperators(src);
    let domain = o.domain || 'P';
    let m = src.match(/^\[([PFCH])\]\s*/i);
    if (m) { domain = m[1].toUpperCase(); src = src.slice(m[0].length); }
    else if ((m = src.match(/^([PFCH])\s*:\s+/i))) { domain = m[1].toUpperCase(); src = src.slice(m[0].length); }
    else if ((m = src.match(/^([PFCH])\s+/i))) { domain = m[1].toUpperCase(); src = src.slice(m[0].length); }
    let stamp = dateMod.todayStamp(now);
    let first = src.split(/\s+/)[0] || '';
    if (TV.text && TV.text.normalizeSign) first = TV.text.normalizeSign(first);
    if (TV.text && TV.text.toHalfWidthDigits) first = TV.text.toHalfWidthDigits(first);
    if (/^\d{6}$/.test(first) || /^\d{8}$/.test(first) || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(first) || /^[+-]?\d{1,3}$/.test(first)) {
      const d = dateMod.resolveDateToken(first, now);
      if (!d.ok) { invalidNote(S(raw).trim(), d.error, domain, stamp); return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors }; }
      if (d.relative) {
        invalidNote(S(raw).trim(), '源码日期必须是 YYMMDD；相对日期请用对话框录入', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      stamp = d.stamp;
      src = src.slice(first.length).trim();
    }
    const lt = src.indexOf('<');
    const flowPart = lt >= 0 ? src.slice(0, lt).trim() : src;
    const tagPart = lt >= 0 ? src.slice(lt + 1) : '';
    if (flowPart.indexOf('>') < 0) {
      /* 备注行：金额 < 分类 < 关键字... */
      const toks = flowPart.split(/[\s\u3000]+/).filter(Boolean);
      let amt = null;
      let i = 0;
      if (toks.length) {
        const q = amount.parseQuantity(toks[0]);
        if (q.ok) { amt = q; i = 1; }
      }
      const blocks = tagPart.split('<').map((x) => x.trim()).filter(Boolean);
      if (!blocks.length) {
        invalidNote(S(raw).trim(), '备注行格式：金额 < 分类 < 关键字', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      const catBlock = blocks[0].split(/[\s\u3000]+/).filter(Boolean);
      const category = catBlock[0] || '';
      const keywordNames = catBlock.slice(1);
      blocks.slice(1).forEach((b) => b.split(/[\s\u3000]+/).filter(Boolean).forEach((k) => keywordNames.push(k)));
      if (!category) {
        invalidNote(S(raw).trim(), '备注行缺分类', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      const categoryId = ensureNoteTag(dict, category, { domain }, autoTags, usedIds);
      const keywordIds = [];
      keywordNames.forEach((k) => {
        const id = ensureNoteTag(dict, k, { domain, parentId: categoryId }, autoTags, usedIds);
        if (id && !keywordIds.includes(id)) keywordIds.push(id);
      });
      const id = ids.newTextId((x) => usedIds.has(x)); usedIds.add(id);
      notes.push({
        id, kind: 'note', raw: S(raw).trim(), line: lineNo, domain, date: stamp,
        categoryId, keywordIds, amountCents: amt && amt.ok && amt.unit === 'money' ? amt.cents : 0,
        minutes: amt && amt.ok && amt.unit === 'time' ? amt.minutes : 0,
        tagIds: keywordIds.slice(), accounting: false,
      });
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }

    /* 含 >：按段展开 */
    let flow = flowPart.replace(/\s*>\s*/g, ' > ');
    flow = flow.replace(/([^\s])#/g, '$1 #');
    const toks = flow.split(/[\s\u3000]+/).filter(Boolean);
    const nodeToks = [];
    const amountToks = [];
    const fromToks = [];
    const toToks = [];
    let gtCount = 0;
    let afterGt = false;
    let period = '';
    for (let i = 0; i < toks.length; i += 1) {
      const t = toks[i];
      if (t === '>') { gtCount += 1; afterGt = true; continue; }
      if (t === '*') { amountToks.push('*'); continue; }
      if (/^\d+(?:\.\d+)?\*$/.test(t)) { amountToks.push(t); continue; }
      if (/^\d+(?:\.\d+)?\/$/.test(t)) { amountToks.push(t); continue; }
      if (/^\*[dmy]$/i.test(t)) { period = t.slice(1).toLowerCase(); continue; }
      const sp = amount.splitPeriod(t);
      if (sp.period) period = sp.period;
      // 简码可以带数字、甚至以数字开头（58D）。在节点位置精确命中时，
      // 优先当节点，避免被 parseQuantity 当成「58 天」。
      const forceNode = /^[NH]:/i.test(t);
      const probe = forceNode ? t.replace(/^[NH]:/i, '') : sp.token;
      const exactNode = dictMod.collectMatches(dict, probe, domain);
      const nodePos = forceNode || !afterGt
        || (!amountToks.length && exactNode.length > 0)
        || toks[i - 1] === '>' || toks[i + 1] === '>';
      const q = exactNode.length && nodePos ? { ok: false } : amount.parseQuantity(sp.token);
      if (q.ok) { amountToks.push(sp.token); continue; }
      if (amountToks.length) {
        invalidNote(S(raw).trim(), '金额之后还有认不出的内容：' + t, domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      nodeToks.push(t);
      (afterGt ? toToks : fromToks).push(t);
    }
    const segments = nodeToks.length - 1;
    const batchMode = gtCount === 1 && (fromToks.length > 1 || toToks.length > 1);
    if (!batchMode) {
      if (nodeToks.length < 2) {
        invalidNote(S(raw).trim(), '至少需要两个节点', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      if (amountToks.length !== 1 && amountToks.length !== segments) {
        invalidNote(S(raw).trim(), '金额数量必须为 1 或等于段数（' + segments + '）', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
    }
    const resolved = nodeToks.map((t) => resolveToken(dict, t, { domain }));
    const tagIds = parseTagBlocks(tagPart, dict, { domain }, autoTags, usedIds);

    /* 批量：一行多个转出/转入，落到多条事件；单行单段/链式仍走下面的逻辑 */
    if (batchMode) {
      if (!fromToks.length || !toToks.length) {
        invalidNote(S(raw).trim(), '批量录入需要 > 两边都有节点', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      let pairs = [];
      if (fromToks.length === 1) pairs = toToks.map((t) => [fromToks[0], t]);
      else if (toToks.length === 1) pairs = fromToks.map((f) => [f, toToks[0]]);
      else if (fromToks.length === toToks.length) pairs = fromToks.map((f, i) => [f, toToks[i]]);
      else {
        invalidNote(S(raw).trim(), '多个转出/转入数量必须相等（或一端只有一个）', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      if (amountToks.length !== 1 && amountToks.length !== pairs.length) {
        /* 下面的金额解析会处理 1 个金额、逐笔金额、`*` 循环和 `100/` 均摊 */
      }
      let per = [];
      const rawAmts = amountToks.slice();
      if (!rawAmts.length) {
        invalidNote(S(raw).trim(), '批量录入缺金额', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      const fillIdx = rawAmts.findIndex((x) => /^\d+(?:\.\d+)?\*$/.test(x));
      const splitIdx = rawAmts.findIndex((x) => /^\d+(?:\.\d+)?\/$/.test(x));
      if (fillIdx >= 0 && splitIdx >= 0) {
        invalidNote(S(raw).trim(), '填充 * 和均摊 / 不能混用', domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      } else if (fillIdx >= 0) {
        if (fillIdx !== rawAmts.length - 1) {
          invalidNote(S(raw).trim(), '填充金额只能在最后写一个，如 1 2*', domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const head = rawAmts.slice(0, -1);
        if (head.some((x) => x.endsWith('/') || x.endsWith('*'))) {
          invalidNote(S(raw).trim(), '填充金额不能和 / 或 * 循环混用', domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const fill = rawAmts[fillIdx].slice(0, -1);
        per = Array.from({ length: pairs.length }, (_, i) => (i < head.length ? head[i] : fill));
      } else if (splitIdx >= 0) {
        if (splitIdx !== rawAmts.length - 1) {
          invalidNote(S(raw).trim(), '均摊金额只能写在最后，如 1 9/', domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const head = rawAmts.slice(0, -1);
        if (head.some((x) => x.endsWith('/') || x.endsWith('*'))) {
          invalidNote(S(raw).trim(), '均摊金额不能和填充/循环混用', domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const remaining = pairs.length - head.length;
        if (remaining <= 0) {
          invalidNote(S(raw).trim(), '均摊金额前面已经填满，没有剩余行可均摊', domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const total = amount.parseQuantity(rawAmts[splitIdx].slice(0, -1));
        if (!total.ok || total.unit !== 'money' || total.cents <= 0) {
          invalidNote(S(raw).trim(), '均摊金额必须是正数：' + rawAmts[splitIdx], domain, stamp);
          return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
        }
        const base = Math.floor(total.cents / remaining);
        const rem = total.cents % remaining;
        const tail = Array.from({ length: remaining }, (_, i) => formatYuanExact(base + (i < rem ? 1 : 0)));
        per = head.concat(tail);
      } else {
        const star = rawAmts.indexOf('*');
        if (star >= 0) {
          if (star !== rawAmts.length - 1 || star === 0) {
            invalidNote(S(raw).trim(), '循环金额只能在最后写一个 *，例如 1 2 *', domain, stamp);
            return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
          }
          const base = rawAmts.slice(0, -1);
          if (base.some((x) => x.endsWith('/') || x.endsWith('*'))) {
            invalidNote(S(raw).trim(), '循环金额里不能再混用 / 均摊或填充', domain, stamp);
            return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
          }
          per = Array.from({ length: pairs.length }, (_, i) => base[i % base.length]);
        } else {
          if (rawAmts.length !== 1 && rawAmts.length !== pairs.length) {
            invalidNote(S(raw).trim(), '批量金额数量必须为 1、等于笔数、或使用 * / 100/', domain, stamp);
            return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
          }
          per = rawAmts.length === 1
            ? Array.from({ length: pairs.length }, () => rawAmts[0])
            : rawAmts.slice();
        }
      }
      let batchError = false;
      pairs.forEach(([fTok, tTok], i) => {
        const a = resolveToken(dict, fTok, { domain });
        const b = resolveToken(dict, tTok, { domain });
        if (!a.ok || !b.ok) {
          const bad = !a.ok ? fTok : tTok;
          diagnostics.push(diag(lineNo, '无法解析：' + bad));
          batchError = true;
          return;
        }
        const canA = !!a.account && !!b.account;
        const canB = !!a.behavior && !!b.behavior;
        let layer = '';
        if (canA && !canB) layer = 'account';
        else if (canB && !canA) layer = 'behavior';
        else if (canA && canB) {
          if (a.force === 'N' || b.force === 'N') layer = 'account';
          else if (a.force === 'H' || b.force === 'H') layer = 'behavior';
        }
        if (!layer) {
          diagnostics.push(diag(lineNo, '层不匹配：' + fTok + ' > ' + tTok));
          batchError = true;
          return;
        }
        const rawSeg = fTok + ' > ' + tTok + ' ' + per[i];
        if (layer === 'account') {
          const q = amount.parseQuantity(per[i]);
          if (!q.ok) { diagnostics.push(diag(lineNo, q.error)); batchError = true; return; }
          if (q.unit === 'money' && q.cents <= 0) { diagnostics.push(diag(lineNo, '金额必须大于 0')); batchError = true; return; }
          const id = ids.newEventId((x) => usedIds.has(x)); usedIds.add(id);
          events.push({
            id, kind: 'account', domain, date: stamp,
            from: a.account, to: b.account,
            amountCents: q.unit === 'money' ? q.cents : 0,
            minutes: q.unit === 'time' ? q.minutes : 0,
            tagIds: tagIds.slice(), chainId: '', sourceLine: lineNo, raw: rawSeg,
            period: period || '',
            crossDomain: !!(dict.nodes[a.account] && dict.nodes[b.account]
              && dict.nodes[a.account].domain !== dict.nodes[b.account].domain),
          });
        } else {
          if (!/^\d+$/.test(per[i]) || Number(per[i]) <= 0) {
            diagnostics.push(diag(lineNo, '行为强度必须是正整数：' + per[i]));
            batchError = true;
            return;
          }
          const id = ids.newBehaviorEventId((x) => usedIds.has(x)); usedIds.add(id);
          behaviors.push({
            id, kind: 'behavior', domain, date: stamp,
            from: a.behavior, to: b.behavior, weight: Number(per[i]),
            tagIds: tagIds.slice(), chainId: '', sourceLine: lineNo, raw: rawSeg,
          });
        }
      });
      if (batchError) { events.length = 0; behaviors.length = 0; }
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }

    /* 行为项自动建：仅 v3 / 显式允许时；v4 由用户显式建行为项 */
    if (autoCreateBehaviors) {
    for (let i = 0; i < segments; i += 1) {
      const a = resolved[i];
      const b = resolved[i + 1];
      if (!a || !b) continue;
      const rawAmt = amountToks.length === segments ? amountToks[i] : amountToks[0];
      if (a.ok && b.ok) {
        if (a.behavior && !b.behavior && !a.account) {
          b.behavior = ensureBehaviorItem(dict, nodeToks[i + 1], { domain }, autoBehaviors, usedIds);
        } else if (b.behavior && !a.behavior && !b.account) {
          a.behavior = ensureBehaviorItem(dict, nodeToks[i], { domain }, autoBehaviors, usedIds);
        }
      } else if (!a.ok && !b.ok && /^\d+$/.test(rawAmt || '') && !a.crossDomain && !b.crossDomain) {
        /* 两端都未知、强度是正整数：默认按行为项自动建，符合“行为模板优先” */
        a.behavior = ensureBehaviorItem(dict, nodeToks[i], { domain }, autoBehaviors, usedIds);
        b.behavior = ensureBehaviorItem(dict, nodeToks[i + 1], { domain }, autoBehaviors, usedIds);
        a.ok = true; a.account = null;
        b.ok = true; b.account = null;
      } else if (a.ok && a.behavior && !b.ok && !b.crossDomain) {
        b.behavior = ensureBehaviorItem(dict, nodeToks[i + 1], { domain }, autoBehaviors, usedIds);
        b.ok = true;
        b.account = null;
      } else if (b.ok && b.behavior && !a.ok && !a.crossDomain) {
        a.behavior = ensureBehaviorItem(dict, nodeToks[i], { domain }, autoBehaviors, usedIds);
        a.ok = true;
        a.account = null;
      }
    }
    }
    resolved.forEach((r, i) => {
      if (r.ok) return;
      if (r.crossDomain) {
        diagnostics.push(diag(lineNo, '跨域节点：' + nodeToks[i] + ' 不在当前域；请写域前缀'));
        return;
      }
      diagnostics.push(diag(lineNo, r.error || ('无法解析：' + nodeToks[i])));
    });
    const layers = [];
    const segRi = [];
    for (let i = 0; i < segments; i += 1) {
      const a = resolved[i];
      const b = resolved[i + 1];
      if (!a || !a.ok || !b || !b.ok) { layers.push('invalid'); continue; }
      const canA = !!a.account && !!b.account;
      const canB = !!a.behavior && !!b.behavior;
      let layer = '';
      if (canA && !canB) layer = 'account';
      else if (canB && !canA) layer = 'behavior';
      else if (canA && canB) {
        if (a.force === 'N' || b.force === 'N') layer = 'account';
        else if (a.force === 'H' || b.force === 'H') layer = 'behavior';
        else {
          diagnostics.push(diag(lineNo, '同一段同时是会计和行为，请加 N: 或 H: 前缀：' + nodeToks[i] + ' > ' + nodeToks[i + 1]));
          layer = 'invalid';
        }
      } else {
        diagnostics.push(diag(lineNo, '层不匹配：' + nodeToks[i] + ' > ' + nodeToks[i + 1]));
        layer = 'invalid';
      }
      layers.push(layer);
    }
    const per = amountToks.length === segments ? amountToks : Array.from({ length: segments }, () => amountToks[0]);
    if (period && layers.some((l) => l === 'behavior')) {
      diagnostics.push(diag(lineNo, '行为段不能挂 *d/*m/*y 周期规则'));
    }
    let chainId = '';
    if (segments > 1) {
      chainId = ids.newChainId((x) => usedIds.has(x));
      usedIds.add(chainId);
    }
    for (let i = 0; i < segments; i += 1) {
      const layer = layers[i];
      const rawSeg = nodeToks[i] + ' > ' + nodeToks[i + 1] + ' ' + per[i];
      if (layer === 'account') {
        const q = amount.parseQuantity(per[i]);
        if (!q.ok) { diagnostics.push(diag(lineNo, q.error)); continue; }
        if (q.unit === 'money' && q.cents <= 0) { diagnostics.push(diag(lineNo, '金额必须大于 0')); continue; }
        const id = ids.newEventId((x) => usedIds.has(x)); usedIds.add(id);
        events.push({
          id, kind: 'account', domain, date: stamp,
          from: resolved[i].account, to: resolved[i + 1].account,
          amountCents: q.unit === 'money' ? q.cents : 0,
          minutes: q.unit === 'time' ? q.minutes : 0,
          tagIds: tagIds.slice(), chainId, sourceLine: lineNo, raw: rawSeg,
          period: period || '',
          crossDomain: !!(dict.nodes[resolved[i].account] && dict.nodes[resolved[i + 1].account]
            && dict.nodes[resolved[i].account].domain !== dict.nodes[resolved[i + 1].account].domain),
        });
      } else if (layer === 'behavior') {
        if (!/^\d+$/.test(per[i]) || Number(per[i]) <= 0) {
          diagnostics.push(diag(lineNo, '行为强度必须是正整数：' + per[i]));
          continue;
        }
        const id = ids.newBehaviorEventId((x) => usedIds.has(x)); usedIds.add(id);
        behaviors.push({
          id, kind: 'behavior', domain, date: stamp,
          from: resolved[i].behavior, to: resolved[i + 1].behavior,
          weight: Number(per[i]), tagIds: tagIds.slice(), chainId,
          sourceLine: lineNo, raw: rawSeg,
        });
      } else {
        const id = ids.newTextId((x) => usedIds.has(x)); usedIds.add(id);
        notes.push({
          id, kind: 'invalid', raw: S(raw).trim(), line: lineNo, domain, date: stamp,
          accounting: false, tagIds: tagIds.slice(),
          draft: { from: nodeToks[i], to: nodeToks[i + 1], amount: per[i] },
          diagnostics: [diag(lineNo, '该段未编译')],
        });
      }
    }
    return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
  }

  function compileLedgerSource(text, dict, opts) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const diagnostics = [];
    const events = [];
    const behaviors = [];
    const notes = [];
    const autoTags = [];
    const autoBehaviors = [];
    const autoCreateBehaviors = o.autoCreateBehaviors !== undefined
      ? !!o.autoCreateBehaviors
      : (!dict || dict.format !== 'v4');
    const work = JSON.parse(JSON.stringify(dict || {}));
    if (!work.behaviors) work.behaviors = {};
    const usedIds = new Set(Object.keys(work.nodes || {}).concat(Object.keys(work.tags || {}), Object.keys(work.behaviors || {})));
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
    let inPlan = false;
    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = S(raw).trim();
      if (!line) return;
      if (line === PLAN_HEADER || line === INSTALLMENT_HEADER) { inPlan = true; return; }
      if (inPlan && /^\[[^\]]+\]$/.test(line)) inPlan = false;
      if (inPlan) return; /* [固定] 段由 parsePlanSection 单独编译 */
      if (/^\[(PLAN|RULES?)\]$/i.test(line)) {
        diagnostics.push(diag(lineNo, 'PLAN/RULES 暂由规则面板管理', 'warning'));
        return;
      }
      const r = parseLedgerLine(raw, work, { now, domain: o.domain || 'P', autoCreateBehaviors }, { lineNo, usedIds });
      r.events.forEach((e) => events.push(e));
      r.behaviors.forEach((b) => behaviors.push(b));
      r.notes.forEach((n) => notes.push(n));
      r.diagnostics.forEach((d) => diagnostics.push(d));
      r.autoTags.forEach((t) => { if (!autoTags.some((x) => x.id === t.id)) autoTags.push(t); });
      (r.autoBehaviors || []).forEach((t) => { if (!autoBehaviors.some((x) => x.id === t.id)) autoBehaviors.push(t); });
    });
    const planParse = parsePlanSection(S(text), work, { now, domain: o.domain || 'P', lang: o.lang });
    planParse.diagnostics.forEach((d) => diagnostics.push(d));
    const errors = diagnostics.filter((x) => x.severity === 'error').length;
    return {
      ok: errors === 0, dict: work, events, behaviors, notes,
      plans: planParse.plans, autoTags, autoBehaviors, diagnostics, errors, lines: lines.length,
    };
  }

  function compileAll(dictSource, ledgerSource, opts) {
    const o = opts || {};
    const d = compileDictSource(dictSource, o);
    const l = compileLedgerSource(ledgerSource, d.dict, o);
    return {
      ok: d.ok && l.ok,
      dict: l.dict || d.dict,
      events: l.events,
      behaviors: l.behaviors,
      notes: l.notes,
      plans: l.plans || [],
      autoTags: l.autoTags,
      autoBehaviors: l.autoBehaviors,
      diagnostics: d.diagnostics.concat(l.diagnostics),
      dictDiagnostics: d.diagnostics,
      ledgerDiagnostics: l.diagnostics,
      dictTokens: d.tokens || [],
      errors: d.errors + l.errors,
    };
  }

  /** 单 TXT 导出格式：## 统计 / ## 流水 / ## 行为 / ## 备注 / ## 字典 */
  function parseSingleTxt(text) {
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
    const sec = { flow: [], behavior: [], notes: [], fixed: [], dict: [] };
    let cur = '';
    let sawDict = false;
    let sawFlow = false;
    let sawFixed = false;
    lines.forEach((line) => {
      const m = line.match(/^##\s*(统计|流水|固定|行为|备注|字典)\s*$/);
      if (m) {
        cur = m[1];
        if (cur === '字典') sawDict = true;
        if (cur === '流水') sawFlow = true;
        if (cur === '固定') sawFixed = true;
        return;
      }
      if (cur === '流水') sec.flow.push(line);
      else if (cur === '固定') sec.fixed.push(line);
      else if (cur === '行为') sec.behavior.push(line);
      else if (cur === '备注') sec.notes.push(line);
      else if (cur === '字典') sec.dict.push(line);
    });
    if (!sawDict) return { ok: false, error: '单 TXT 缺 ## 字典 段' };
    if (!sawFlow) return { ok: false, error: '单 TXT 缺 ## 流水 段' };
    const dictSource = sec.dict.join('\n').trim() + '\n';
    const ledgerSource = [sec.flow.join('\n'), sec.behavior.join('\n'), sec.notes.join('\n')]
      .map((x) => x.trim()).filter(Boolean).join('\n') + '\n';
    const fixedSource = sawFixed ? sec.fixed.join('\n').trim() + '\n' : '';
    return { ok: true, dictSource, ledgerSource, fixedSource, hasFixed: sawFixed };
  }

  TV.source = {
    TAG_KINDS,
    PLAN_HEADER,
    INSTALLMENT_HEADER,
    PLAN_GAP,
    PLAN_COMMENT,
    formatYuanExact,
    sourceCodeMap,
    dictToSource,
    ledgerToSource,
    normalizeDomainSyntax,
    planSectionRange,
    recordsEndIndex,
    planSchedule,
    planLineText,
    parsePlanLineText,
    parsePlanSection,
    planSectionBlock,
    withPlanSection,
    fixedSourceFromPlans,
    planSourceLine,
    compileFixed,
    compileDictSource,
    compileLedgerSource,
    compileAll,
    parseSingleTxt,
    parseLedgerLine,
    stripComment,
    parseNames,
    parseTail,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.source;
})(typeof globalThis !== 'undefined' ? globalThis : this);
