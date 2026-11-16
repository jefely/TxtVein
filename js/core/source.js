/* TxtVein · 源码层（流水 / 字典）
 *
 * 事实层是后台 ID 图；编辑器文本是投影 + 手稿。
 * 一条源码行可以展开多条原子边：
 *   微信 > 晚餐 > 开心 120 1
 *     E_ 微信>晚餐 120
 *     B_ 晚餐>开心 1
 *
 * 字典分三段：
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
      const used = new Set();
      const groups = new Map();
      Object.keys(dict[kind] || {}).forEach((id) => {
        const x = dict[kind][id];
        const base = codeSafe(x.zh_code || x.en_code || id) || 'x';
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base).push(id);
      });
      groups.forEach((arr, base) => {
        if (arr.length === 1) { out.set(arr[0], uniqueCode(base, used)); return; }
        arr.forEach((id, i) => out.set(id, uniqueCode(base + (i + 1), used)));
      });
    });
    return out;
  }

  function dictTail(weight, parent, system) {
    const parts = [];
    if (Number(weight)) parts.push(String(Number(weight)));
    if (parent && parent !== '-') parts.push('@' + parent);
    if (system) parts.push('system');
    return parts.length ? ' ' + parts.join(' ') : '';
  }

  function dictToSource(dict) {
    const codeMap = sourceCodeMap(dict);
    const lines = [];
    lines.push('// TxtVein 字典 · 三段：会计 / 备注 / 行为');
    lines.push('// 会计节点：域 大类 形态 中文码 英文码 中文名 | 英文名 [权重] [@父码] [system]');
    lines.push('// 备注标签：域 类型 中文码 英文码 中文名 | 英文名 [权重] [@父码]');
    lines.push('// 行为项：域 中文码 英文码 中文名 | 英文名 [权重] [@父码]');
    lines.push('// 权重=候选排序（越大越前）；@父码=树上一级；不写即根');
    lines.push('// 别名：alias 别名 -> N:节点码 / T:标签码 / H:行为码');
    lines.push('[会计]');
    Object.keys(dict.nodes || {}).map((id) => ({ id, n: dict.nodes[id] }))
      .sort((a, b) => (a.n.domain + a.n.type + (codeMap.get(a.id) || '')).localeCompare(b.n.domain + b.n.type + (codeMap.get(b.id) || '')))
      .forEach((x) => {
        const n = x.n;
        const zh = S(n.zh_name || n.en_name).replace(/\|/g, '/') || '-';
        const en = S(n.en_name || n.zh_name).replace(/\|/g, '/') || '-';
        const parent = n.parent_id && codeMap.has(n.parent_id) ? codeMap.get(n.parent_id) : '-';
        lines.push('node ' + [n.domain, n.type, n.form || 'fluid', codeMap.get(x.id) || 'n', n.en_code || '-', zh].join(' ')
          + ' | ' + en + dictTail(n.weight, parent, n.system));
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
          + ' | ' + en + dictTail(t.weight, parent, false));
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
          + ' | ' + en + dictTail(h.weight, parent, false));
      });
    const autoKeys = new Set();
    ['nodes', 'tags', 'behaviors'].forEach((kind) => {
      Object.keys(dict[kind] || {}).forEach((id) => {
        const x = dict[kind][id];
        [x.zh_name, x.en_name, x.zh_code, x.en_code, codeMap.get(id)].forEach((k) => k && autoKeys.add(k));
      });
    });
    Object.keys(dict.aliases || {}).forEach((key) => {
      const targets = (dict.aliases[key] || []).filter((id) => dict.nodes[id] || dict.tags[id] || dict.behaviors[id]);
      if (!targets.length) return;
      const toks = targets.map((id) => (dict.nodes[id] ? 'N:' : dict.tags[id] ? 'T:' : 'H:') + codeMap.get(id));
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
      lines.push(domainPrefix(e.domain) + e.date + ' ' + from + ' > ' + to + ' ' + amt + tags);
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

  function parseNames(text) {
    const s = S(text);
    const i = s.indexOf('|');
    if (i < 0) return { left: s.trim(), right: '' };
    return { left: s.slice(0, i).trim(), right: s.slice(i + 1).trim() };
  }

  function parseTail(right) {
    const toks = S(right).split(/[\s\u3000]+/).filter(Boolean);
    let system = false;
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
    return { enName: toks.join(' '), weight, parent, system };
  }

  function compileDictSource(text, opts) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const diagnostics = [];
    const records = [];
    const aliases = [];
    const seen = { node: new Map(), tag: new Map(), item: new Map() };
    let section = 'account';
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');

    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = stripComment(raw).trim();
      if (!line) return;
      const sec = line.match(/^\[(ACCOUNT|NOTE|BEHAVIOR|会计|备注|行为)\]$/i);
      if (sec) {
        const key = sec[1].toUpperCase();
        section = key === '会计' || key === 'ACCOUNT' ? 'account'
          : key === '备注' || key === 'NOTE' ? 'note' : 'behavior';
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
        if (seen.node.has(code)) { diagnostics.push(diag(lineNo, '节点码重复：' + code)); return; }
        seen.node.set(code, true);
        records.push({
          kind: 'node', line: lineNo, domain: dm.domain, type: ty.type, pole: ty.pole, form: form.form,
          code, enCode, zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0,
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
        if (seen.tag.has(code)) { diagnostics.push(diag(lineNo, '标签码重复：' + code)); return; }
        seen.tag.set(code, true);
        records.push({
          kind: 'tag', line: lineNo, domain: dm.domain, tagKind, code, enCode,
          zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0, parentCode: tail.parent,
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
      if (seen.item.has(code)) { diagnostics.push(diag(lineNo, '行为项码重复：' + code)); return; }
      seen.item.set(code, true);
      records.push({
        kind: 'item', line: lineNo, domain: dm.domain, code, enCode,
        zhName, enName: tail.enName || zhName, weight: Number(tail.weight) || 0, parentCode: tail.parent,
      });
    });

    const dict = dictMod.emptyDict(o.vaultId || '', now);
    dict.behaviors = {};
    dict.link = '';
    const usedIds = new Set(['N_sys_loss', 'N_sys_gain']);
    const nodeByCode = new Map();
    const tagByCode = new Map();
    const itemByCode = new Map();
    records.filter((r) => r.kind === 'node').forEach((r) => {
      const id = ids.newNodeId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.nodes[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        polarity: r.pole, type: r.type, form: r.form, domain: r.domain,
        parent_id: '', weight: r.weight, system: !!r.system, created_at: now.toISOString(),
      };
      nodeByCode.set(r.code, id);
    });
    records.filter((r) => r.kind === 'tag').forEach((r) => {
      const id = ids.newTagId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.tags[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        domain: r.domain, parent_id: '', weight: r.weight, kind: r.tagKind, created_at: now.toISOString(),
      };
      tagByCode.set(r.code, id);
    });
    records.filter((r) => r.kind === 'item').forEach((r) => {
      const id = ids.newBehaviorItemId((x) => usedIds.has(x));
      usedIds.add(id);
      dict.behaviors[id] = {
        zh_name: r.zhName, en_name: r.enName, zh_code: r.code, en_code: r.enCode,
        domain: r.domain, parent_id: '', weight: r.weight, created_at: now.toISOString(),
      };
      itemByCode.set(r.code, id);
    });
    records.forEach((r) => {
      const id = r.kind === 'node' ? nodeByCode.get(r.code) : r.kind === 'tag' ? tagByCode.get(r.code) : itemByCode.get(r.code);
      if (!id) return;
      if (r.parentCode && r.parentCode !== '-') {
        const pid = r.kind === 'node' ? nodeByCode.get(r.parentCode) : r.kind === 'tag' ? tagByCode.get(r.parentCode) : itemByCode.get(r.parentCode);
        if (!pid) diagnostics.push(diag(r.line, (r.kind === 'node' ? '节点' : r.kind === 'tag' ? '标签' : '行为项') + '父码不存在：' + r.parentCode));
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
        const m = tok.match(/^([NTH]):(.+)$/i);
        const kind = m ? m[1].toUpperCase() : '';
        const code = m ? m[2] : tok;
        const id = kind === 'T' ? tagByCode.get(code)
          : kind === 'H' ? itemByCode.get(code)
            : kind === 'N' ? nodeByCode.get(code)
              : (nodeByCode.get(code) || tagByCode.get(code) || itemByCode.get(code));
        if (!id) diagnostics.push(diag(a.line, '别名目标不存在：' + tok));
        else dictMod.addAlias(dict, a.key, id);
      });
    });
    [['N_sys_loss', 'loss', 'Loss', '费用', 'A', 'steam', '损耗'],
      ['N_sys_gain', 'gain', 'Gain', '收入', 'B', 'outside', '增益']].forEach((x) => {
      if (dict.nodes[x[0]]) return;
      dict.nodes[x[0]] = {
        zh_name: x[6], en_name: x[2], zh_code: x[1], en_code: x[1],
        polarity: x[4], type: x[3], form: x[5], domain: 'P',
        parent_id: '', weight: 0, system: true, created_at: now.toISOString(),
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
      return r.ok ? { ok: true, account: r.id, behavior: null, force } : { ok: false, error: r.error, force };
    }
    const a = dictMod.resolveAlias(dict, token, { domain: domain || ctx.domain, lang: 'zh' });
    const b = resolveBehavior(dict, token, { domain: domain || ctx.domain });
    if (a.ok && b.ok) return { ok: true, account: a.id, behavior: b.id, dual: true };
    if (a.ok) return { ok: true, account: a.id, behavior: null };
    if (b.ok) return { ok: true, account: null, behavior: b.id };
    if (a.code === 'AMBIGUOUS' || b.ambiguous) {
      return { ok: false, error: '多义：' + token, ambiguous: true };
    }
    return { ok: false, error: '找不到节点/行为项：' + token };
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
      weight: 10, kind: dictMod.tagKindOf(t), created_at: new Date().toISOString(),
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
      domain, parent_id: '', weight: 10, created_at: new Date().toISOString(),
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
    let period = '';
    for (let i = 0; i < toks.length; i += 1) {
      const t = toks[i];
      if (t === '>') continue;
      if (/^\*[dmy]$/i.test(t)) { period = t.slice(1).toLowerCase(); continue; }
      const sp = amount.splitPeriod(t);
      if (sp.period) period = sp.period;
      const q = amount.parseQuantity(sp.token);
      if (q.ok) { amountToks.push(sp.token); continue; }
      if (amountToks.length) {
        invalidNote(S(raw).trim(), '金额之后还有认不出的内容：' + t, domain, stamp);
        return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
      }
      nodeToks.push(t);
    }
    if (nodeToks.length < 2) {
      invalidNote(S(raw).trim(), '至少需要两个节点', domain, stamp);
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }
    const segments = nodeToks.length - 1;
    if (amountToks.length !== 1 && amountToks.length !== segments) {
      invalidNote(S(raw).trim(), '金额数量必须为 1 或等于段数（' + segments + '）', domain, stamp);
      return { events, behaviors, notes, diagnostics, autoTags, autoBehaviors };
    }
    const resolved = nodeToks.map((t) => resolveToken(dict, t, { domain }));
    /* 行为项自动建：当一段另一端已经是行为项时，把这一端补成行为项 */
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
      } else if (!a.ok && !b.ok && /^\d+$/.test(rawAmt || '')) {
        /* 两端都未知、强度是正整数：默认按行为项自动建，符合“行为模板优先” */
        a.behavior = ensureBehaviorItem(dict, nodeToks[i], { domain }, autoBehaviors, usedIds);
        b.behavior = ensureBehaviorItem(dict, nodeToks[i + 1], { domain }, autoBehaviors, usedIds);
        a.ok = true; a.account = null;
        b.ok = true; b.account = null;
      } else if (a.ok && a.behavior && !b.ok) {
        b.behavior = ensureBehaviorItem(dict, nodeToks[i + 1], { domain }, autoBehaviors, usedIds);
        b.ok = true;
        b.account = null;
      } else if (b.ok && b.behavior && !a.ok) {
        a.behavior = ensureBehaviorItem(dict, nodeToks[i], { domain }, autoBehaviors, usedIds);
        a.ok = true;
        a.account = null;
      }
    }
    resolved.forEach((r, i) => {
      if (!r.ok) diagnostics.push(diag(lineNo, r.error || ('无法解析：' + nodeToks[i])));
    });
    const tagIds = parseTagBlocks(tagPart, dict, { domain }, autoTags, usedIds);
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
          id, kind: 'invalid', raw: rawSeg, line: lineNo, domain, date: stamp,
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
    const work = JSON.parse(JSON.stringify(dict || {}));
    if (!work.behaviors) work.behaviors = {};
    const usedIds = new Set(Object.keys(work.nodes || {}).concat(Object.keys(work.tags || {}), Object.keys(work.behaviors || {})));
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = S(raw).trim();
      if (!line) return;
      if (/^\[(PLAN|RULES?)\]$/i.test(line)) {
        diagnostics.push(diag(lineNo, 'PLAN/RULES 暂由规则面板管理', 'warning'));
        return;
      }
      const r = parseLedgerLine(raw, work, { now, domain: o.domain || 'P' }, { lineNo, usedIds });
      r.events.forEach((e) => events.push(e));
      r.behaviors.forEach((b) => behaviors.push(b));
      r.notes.forEach((n) => notes.push(n));
      r.diagnostics.forEach((d) => diagnostics.push(d));
      r.autoTags.forEach((t) => { if (!autoTags.some((x) => x.id === t.id)) autoTags.push(t); });
      (r.autoBehaviors || []).forEach((t) => { if (!autoBehaviors.some((x) => x.id === t.id)) autoBehaviors.push(t); });
    });
    const errors = diagnostics.filter((x) => x.severity === 'error').length;
    return { ok: errors === 0, dict: work, events, behaviors, notes, autoTags, autoBehaviors, diagnostics, errors, lines: lines.length };
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
      autoTags: l.autoTags,
      autoBehaviors: l.autoBehaviors,
      diagnostics: d.diagnostics.concat(l.diagnostics),
      dictDiagnostics: d.diagnostics,
      ledgerDiagnostics: l.diagnostics,
      errors: d.errors + l.errors,
    };
  }

  /** 单 TXT 导出格式：## 统计 / ## 流水 / ## 行为 / ## 备注 / ## 字典 */
  function parseSingleTxt(text) {
    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
    const sec = { flow: [], behavior: [], notes: [], dict: [] };
    let cur = '';
    let sawDict = false;
    let sawFlow = false;
    lines.forEach((line) => {
      const m = line.match(/^##\s*(统计|流水|行为|备注|字典)\s*$/);
      if (m) {
        cur = m[1];
        if (cur === '字典') sawDict = true;
        if (cur === '流水') sawFlow = true;
        return;
      }
      if (cur === '流水') sec.flow.push(line);
      else if (cur === '行为') sec.behavior.push(line);
      else if (cur === '备注') sec.notes.push(line);
      else if (cur === '字典') sec.dict.push(line);
    });
    if (!sawDict) return { ok: false, error: '单 TXT 缺 ## 字典 段' };
    if (!sawFlow) return { ok: false, error: '单 TXT 缺 ## 流水 段' };
    const dictSource = sec.dict.join('\n').trim() + '\n';
    const ledgerSource = [sec.flow.join('\n'), sec.behavior.join('\n'), sec.notes.join('\n')]
      .map((x) => x.trim()).filter(Boolean).join('\n') + '\n';
    return { ok: true, dictSource, ledgerSource };
  }

  TV.source = {
    TAG_KINDS,
    formatYuanExact,
    sourceCodeMap,
    dictToSource,
    ledgerToSource,
    normalizeDomainSyntax,
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
