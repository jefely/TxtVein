/* TxtVein · 规则层
 * 周期规则（PLAN）：*d / *m / *y，到期生成真实流水，只推进 last_run。
 * 事件规则（RULES）：关键字 + 金额条件 → 预测式录入模板。
 *
 * 规则本身也是纯文本，存在 ledger.txt 末尾的 [PLAN] / [RULES] 区块里。
 * 取消规则只改状态，历史流水一行不动。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  const STATUS = ['active', 'canceled'];

  function periodLabel(p) {
    return p === 'd' ? '每天' : p === 'm' ? '每月' : p === 'y' ? '每年' : p;
  }

  function parsePlanLine(line, index) {
    const raw = S(line).trim();
    if (!raw || raw.startsWith('#')) return null;
    const m = raw.match(/^(\S+)\s+(active|canceled)\s*:\s*(\S*)\s+(\S+)\s*>\s*(\S+)\s+(\d+)\s*(.*)$/i);
    if (!m) return { error: '无法解析计划行：' + raw, raw, line: index };
    const rest = m[7] || '';
    let period = '';
    let lastRun = '';
    const tagIds = [];
    let name = '';
    rest.split(/[\s\u3000]+/).filter(Boolean).forEach((tok) => {
      if (/^\*[dmy]$/i.test(tok)) { period = tok.slice(1).toLowerCase(); return; }
      if (/^last_run=/i.test(tok)) { lastRun = tok.split('=')[1] || ''; return; }
      if (/^name=/i.test(tok)) { name = decodeURIComponent(tok.slice(5)); return; }
      if (/^T_[A-Za-z0-9_]+$/.test(tok)) { tagIds.push(tok); return; }
    });
    if (!period) return { error: '计划缺少周期 *d/*m/*y：' + raw, raw, line: index };
    const d = date.parseDate(lastRun || '');
    return {
      ok: true,
      id: m[1],
      status: m[2].toLowerCase(),
      flags: m[3] || '',
      from: m[4],
      to: m[5],
      amountCents: Number(m[6]),
      period,
      tagIds,
      name,
      lastRun: d.ok ? d.stamp : '',
      start: d.ok ? d.stamp : '',
      raw,
      line: index,
    };
  }

  function serializePlan(plan) {
    const p = plan || {};
    const tagPart = (p.tagIds || []).join(' ');
    const nm = p.name ? ' name=' + (/[\s\u3000]/.test(p.name) ? encodeURIComponent(p.name) : p.name) : '';
    return [
      p.id || 'R_???',
      (p.status || 'active') + ':',
      '0',
      p.from,
      '>',
      p.to,
      String(Math.round(Number(p.amountCents) || 0)),
      tagPart,
      '*' + (p.period || 'm'),
      p.lastRun ? 'last_run=' + p.lastRun : '',
      nm.trim(),
    ].filter(Boolean).join(' ');
  }

  function parseRuleLine(line, index) {
    const raw = S(line).trim();
    if (!raw || raw.startsWith('#')) return null;
    const arrow = raw.indexOf('->');
    if (arrow < 0) return { error: '规则缺少 ->：' + raw, raw, line: index };
    const head = raw.slice(0, arrow).trim();
    const tail = raw.slice(arrow + 2).trim();
    const hm = head.match(/^(\S+)\s+(active|canceled)\s*:\s*(.*)$/i);
    if (!hm) return { error: '无法解析规则头：' + raw, raw, line: index };
    const cond = hm[3] || '';
    const flow = tail.match(/^(\S+)\s*>\s*(\S+)(?:\s+(.*))?$/);
    if (!flow) return { error: '规则右侧不是 A > B：' + raw, raw, line: index };
    const rest = flow[3] || '';
    let tags = [];
    let name = '';
    rest.split(/[\s\u3000]+/).filter(Boolean).forEach((tok) => {
      if (/^tags=/i.test(tok)) {
        tags = tok.slice(5).split(',').map((x) => x.trim()).filter(Boolean);
      } else if (/^name=/i.test(tok)) {
        name = decodeURIComponent(tok.slice(5));
      }
    });
    const keywords = [];
    let amountOp = '';
    let amountCents = 0;
    const km = cond.match(/keywords\s*=\s*\(([^)]*)\)/i);
    if (km) {
      km[1].split('|').map((x) => x.trim()).filter(Boolean).forEach((x) => {
        keywords.push(x.replace(/^[#T_]+/, ''));
      });
    }
    const am = cond.match(/amount\s*([<>=])\s*(\d+(?:\.\d+)?[kK]?)/);
    if (am) {
      amountOp = am[1];
      const q = amount.parseAmount(am[2]);
      amountCents = q.ok ? q.cents : 0;
    }
    return {
      ok: true,
      id: hm[1],
      status: hm[2].toLowerCase(),
      condition: cond,
      keywords,
      amountOp,
      amountCents,
      from: flow[1],
      to: flow[2],
      tagIds: tags,
      name,
      raw,
      line: index,
    };
  }

  function serializeRule(rule) {
    const r = rule || {};
    const kw = (r.keywords || []).join('|');
    const cond = 'keywords=(' + kw + ')'
      + (r.amountOp ? '&amount' + r.amountOp + (Number(r.amountCents) / 100) : '');
    const tags = (r.tagIds || []).length ? ' tags=' + r.tagIds.join(',') : '';
    const name = r.name ? ' name=' + (/[\s\u3000]/.test(r.name) ? encodeURIComponent(r.name) : r.name) : '';
    return (r.id || 'R_???') + ' ' + (r.status || 'active') + ': ' + cond
      + ' -> ' + r.from + ' > ' + r.to + tags + name;
  }

  function parseBlocks(source) {
    const lines = S(source).replace(/\r\n?/g, '\n').split('\n');
    const plans = [];
    const rules = [];
    const warnings = [];
    let section = '';
    lines.forEach((line, i) => {
      const s = line.trim();
      if (!s || s.startsWith('#')) return;
      const sec = s.match(/^\[(PLAN|RULES?)\]$/i);
      if (sec) {
        section = sec[1].toUpperCase().startsWith('PLAN') ? 'plan' : 'rule';
        return;
      }
      if (section === 'plan') {
        const p = parsePlanLine(s, i);
        if (!p) return;
        if (p.error) warnings.push(p.error);
        else plans.push(p);
      } else if (section === 'rule') {
        const r = parseRuleLine(s, i);
        if (!r) return;
        if (r.error) warnings.push(r.error);
        else rules.push(r);
      }
    });
    return { plans, rules, warnings };
  }

  function serializeBlocks(plans, rules) {
    const out = [];
    if ((plans || []).length) {
      out.push('[PLAN]');
      plans.forEach((p) => out.push(serializePlan(p)));
    }
    if ((rules || []).length) {
      out.push('[RULES]');
      rules.forEach((r) => out.push(serializeRule(r)));
    }
    return out.join('\n');
  }

  function upsertPlan(plans, plan) {
    const arr = plans || [];
    const i = arr.findIndex((x) => x.id === plan.id);
    if (i >= 0) arr[i] = Object.assign({}, arr[i], plan);
    else arr.push(plan);
    return arr;
  }

  function nextDue(plan, now) {
    if (!plan || plan.status !== 'active') return '';
    const base = plan.lastRun || plan.start;
    if (!base) return '';
    const next = date.addPeriod(base, plan.period, 1);
    if (!next) return '';
    const today = date.todayStamp(now);
    return next <= today ? next : next;
  }

  function isDue(plan, now) {
    const next = nextDue(plan, now);
    return !!next && next <= date.todayStamp(now);
  }

  /**
   * 到期生成真实流水。
   * 返回的 events 还没有 id；由 app 统一分配 E_xxx。
   */
  function runDuePlans(dict, plans, now, opts) {
    const o = opts || {};
    const today = date.todayStamp(now);
    const generated = [];
    let changed = false;
    const max = o.max || 120;
    (plans || []).forEach((plan) => {
      if (!plan || plan.status !== 'active') return;
      let guard = 0;
      let next = date.addPeriod(plan.lastRun || plan.start, plan.period, 1);
      while (next && next <= today && guard < max) {
        generated.push({
          domain: plan.domain || 'P',
          date: next,
          from: plan.from,
          to: plan.to,
          amountCents: Math.round(Number(plan.amountCents) || 0),
          minutes: 0,
          tagIds: (plan.tagIds || []).slice(),
          chainId: '',
          planId: plan.id,
          raw: '[plan ' + plan.id + ']',
          crossDomain: !!(dict && dict.nodes[plan.from] && dict.nodes[plan.to]
            && dict.nodes[plan.from].domain !== dict.nodes[plan.to].domain),
        });
        plan.lastRun = next;
        changed = true;
        next = date.addPeriod(next, plan.period, 1);
        guard += 1;
      }
    });
    return { events: generated, plans, generated: generated.length, changed };
  }

  function cancelPlan(plans, id) {
    const p = (plans || []).find((x) => x.id === id);
    if (!p) return { ok: false, error: '规则不存在：' + id };
    p.status = 'canceled';
    p.updatedAt = new Date().toISOString();
    return { ok: true, plan: p };
  }

  function resumePlan(plans, id) {
    const p = (plans || []).find((x) => x.id === id);
    if (!p) return { ok: false, error: '规则不存在：' + id };
    p.status = 'active';
    p.updatedAt = new Date().toISOString();
    return { ok: true, plan: p };
  }

  function guessAmountCents(input) {
    const tokens = S(input).split(/[\s\u3000]+/);
    for (const tok of tokens) {
      const q = amount.parseQuantity(tok);
      if (q.ok && q.unit === 'money') return q.cents;
    }
    return 0;
  }

  function matchRule(rule, input, cents) {
    if (!rule || rule.status !== 'active') return false;
    const s = S(input);
    if (!rule.keywords || !rule.keywords.length) return false;
    const hit = rule.keywords.some((k) => s.includes(k));
    if (!hit) return false;
    if (rule.amountOp && rule.amountCents) {
      const v = Number(cents) || guessAmountCents(s);
      if (rule.amountOp === '<' && !(v < rule.amountCents)) return false;
      if (rule.amountOp === '>' && !(v > rule.amountCents)) return false;
      if (rule.amountOp === '=' && v !== rule.amountCents) return false;
    }
    return true;
  }

  function templateOf(rule, dict) {
    const code = (id) => {
      const n = dict && dict.nodes[id];
      return n ? (n.zh_code || n.en_code || id) : id;
    };
    const tags = (rule.tagIds || [])
      .map((id) => (dict && dict.tags[id] ? dict.tags[id].zh_name : id))
      .filter(Boolean);
    const base = code(rule.from) + ' > ' + code(rule.to) + ' ' + (Number(rule.amountCents) / 100);
    const tagPart = tags.concat(rule.name ? [rule.name] : []).map((x) => ' < ' + x).join('');
    return base + tagPart;
  }

  function predict(input, rules, dict) {
    const cents = guessAmountCents(input);
    const hits = (rules || []).filter((r) => matchRule(r, input, cents));
    return hits.map((r) => ({ rule: r, text: templateOf(r, dict) }));
  }

  function summarize(plans) {
    const active = (plans || []).filter((p) => p.status === 'active');
    const canceled = (plans || []).filter((p) => p.status === 'canceled');
    const monthly = active.filter((p) => p.period === 'm')
      .reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
    return { active: active.length, canceled: canceled.length, monthlyCents: monthly };
  }

  TV.rules = {
    STATUS,
    periodLabel,
    parsePlanLine,
    serializePlan,
    parseRuleLine,
    serializeRule,
    parseBlocks,
    serializeBlocks,
    upsertPlan,
    nextDue,
    isDue,
    runDuePlans,
    cancelPlan,
    resumePlan,
    guessAmountCents,
    matchRule,
    templateOf,
    predict,
    summarize,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
