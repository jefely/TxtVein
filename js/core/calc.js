/* TxtVein · 计算层
 * 唯一核心算式（双极相对论）：
 *   A 极：转入增加，转出减少
 *   B 极：转出增加，转入减少
 * 只要一笔 Event 两端都在，系统天然平账——这里不做「借贷校验」。
 *
 * 所有报表、窗格、余额都是本模块的派生结果，不落盘。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  function emptyStat(node) {
    return {
      id: node.id,
      node,
      opening: 0,
      inc: 0,
      dec: 0,
      closing: 0,
      count: 0,
      grossIn: 0,
      grossOut: 0,
      firstDate: '',
      lastDate: '',
      minutes: 0,
    };
  }

  function addToStat(stat, node, role, cents, openingOnly) {
    if (openingOnly) {
      if (role === 'from') {
        if (node.polarity === 'A') stat.opening -= cents;
        else stat.opening += cents;
      } else {
        if (node.polarity === 'A') stat.opening += cents;
        else stat.opening -= cents;
      }
      return;
    }
    if (role === 'from') {
      if (node.polarity === 'A') {
        stat.dec += cents;
        stat.closing -= cents;
      } else {
        stat.inc += cents;
        stat.closing += cents;
      }
      stat.grossOut += cents;
    } else {
      if (node.polarity === 'A') {
        stat.inc += cents;
        stat.closing += cents;
      } else {
        stat.dec += cents;
        stat.closing -= cents;
      }
      stat.grossIn += cents;
    }
  }

  /**
   * 规范文档里的 processTransfer：原地改两个节点的 balance。
   * 计算层内部用 addToStat，但保留这个函数作为「唯一算式」的可读锚点。
   */
  function processTransfer(fromNode, toNode, amountCents) {
    const a = Math.round(Number(amountCents) || 0);
    if (fromNode.polarity === 'A') fromNode.balance = (Number(fromNode.balance) || 0) - a;
    else fromNode.balance = (Number(fromNode.balance) || 0) + a;
    if (toNode.polarity === 'A') toNode.balance = (Number(toNode.balance) || 0) + a;
    else toNode.balance = (Number(toNode.balance) || 0) - a;
    return { fromNode, toNode };
  }

  function normalizeRange(range) {
    if (!range) return { start: '000000', end: '999999', label: '全期', all: true };
    if (range.start && range.end) return Object.assign({ all: false }, range);
    return { start: '000000', end: '999999', label: '全期', all: true };
  }

  function compute(dict, events, opts) {
    const o = opts || {};
    const range = normalizeRange(o.range);
    const rowsAll = [];
    const stats = new Map();
    Object.keys(dict.nodes || {}).forEach((id) => {
      const node = Object.assign({ id }, dict.nodes[id]);
      const st = emptyStat(node);
      stats.set(id, st);
      rowsAll.push(st);
    });

    const sorted = (events || [])
      .map((e, i) => ({ e, i }))
      .sort((a, b) => S(a.e.date).localeCompare(S(b.e.date)) || a.i - b.i);

    const issues = [];
    const tagStats = new Map();
    const domainStats = new Map();
    const timeByNode = new Map();
    const chainMap = new Map();
    let flowCents = 0;
    let crossDomainCents = 0;
    let crossNetDelta = 0;
    const filterDomain = o.domain || '';
    let unbalanced = 0;
    let rangeCount = 0;
    let timeMinutes = 0;
    let unlabeledOutflow = 0;
    let gainCents = 0;
    let suppressCents = 0;

    const domainEntry = (d) => {
      if (!domainStats.has(d)) {
        domainStats.set(d, {
          domain: d, flowCents: 0, count: 0,
          inCents: 0, outCents: 0, bookedCents: 0, crossCents: 0,
        });
      }
      return domainStats.get(d);
    };

    for (const item of sorted) {
      const e = item.e || {};
      if (e.kind === 'behavior') continue; /* 行为边只进行为统计，不进 A/B */
      const from = dict.nodes[e.from];
      const to = dict.nodes[e.to];
      if (!from || !to) {
        unbalanced += 1;
        issues.push({ code: 'UNBOUND_EVENT', message: '流水引用了不存在的节点', event: e });
        continue;
      }
      const cents = Math.round(Number(e.amountCents) || 0);
      const minutes = Math.round(Number(e.minutes) || 0);
      if (cents < 0 || (cents === 0 && !minutes)) {
        unbalanced += 1;
        issues.push({ code: 'BAD_AMOUNT', message: '金额必须大于 0', event: e });
        continue;
      }
      const inRange = S(e.date) >= range.start && S(e.date) <= range.end;
      const isOpening = S(e.date) < range.start;

      /* 时间代币只进时间统计，不碰金额余额 */
      if (minutes > 0) {
        if (inRange) {
          timeMinutes += minutes;
          timeByNode.set(e.to, (timeByNode.get(e.to) || 0) + minutes);
          if (e.from) timeByNode.set(e.from, (timeByNode.get(e.from) || 0) + minutes);
          const stTo = stats.get(e.to);
          if (stTo) stTo.minutes += minutes;
        }
        continue;
      }

      const sf = stats.get(e.from);
      const st = stats.get(e.to);
      if (!sf || !st) { unbalanced += 1; continue; }

      if (isOpening) {
        addToStat(sf, from, 'from', cents, true);
        addToStat(st, to, 'to', cents, true);
        continue;
      }
      if (!inRange) continue;

      rangeCount += 1;
      flowCents += cents;
      addToStat(sf, from, 'from', cents, false);
      addToStat(st, to, 'to', cents, false);
      sf.count += 1;
      st.count += 1;
      sf.firstDate = sf.firstDate || e.date;
      st.firstDate = st.firstDate || e.date;
      sf.lastDate = e.date;
      st.lastDate = e.date;

      const isSystem = !!(e.system || from.system || to.system);
      const cross = from.domain !== to.domain && !isSystem;
      if (cross) {
        crossDomainCents += cents;
        /* 独立域视角：跨域那一端对 A−B 的影响要单独记，报表才能显示
           「域内净额」（把对外投资/划拨加回），而不是看起来凭空少了 1000。 */
        if (filterDomain) {
          if (from.domain === filterDomain) crossNetDelta += from.polarity === 'A' ? -cents : cents;
          if (to.domain === filterDomain) crossNetDelta += to.polarity === 'A' ? cents : -cents;
        }
      }
      const ds = domainEntry(e.domain || 'P');
      ds.flowCents += cents;
      ds.count += 1;
      ds.bookedCents += cents;
      if (cross) ds.crossCents += cents;
      const dOut = domainEntry(from.domain);
      const dIn = domainEntry(to.domain);
      dOut.outCents += cents;
      dIn.inCents += cents;

      const tags = Array.isArray(e.tagIds) ? e.tagIds : [];
      if (!isSystem) tags.forEach((tid) => {
        const tag = dict.tags[tid];
        if (!tag) return;
        if (!tagStats.has(tid)) tagStats.set(tid, { id: tid, tag, amountCents: 0, count: 0, minutes: 0 });
        const ts = tagStats.get(tid);
        ts.amountCents += cents;
        ts.count += 1;
        if (tag.kind === 'gain') gainCents += cents;
        if (tag.kind === 'suppress') suppressCents += cents;
      });
      if (!tags.length && from.polarity === 'A' && !isSystem) unlabeledOutflow += cents;

      if (e.chainId) {
        if (!chainMap.has(e.chainId)) chainMap.set(e.chainId, { id: e.chainId, events: [], totalCents: 0 });
        const ch = chainMap.get(e.chainId);
        ch.events.push(e);
        ch.totalCents += cents;
      }
    }

    /* 期末 = 期初 + 本期增加 − 本期减少。opening 已在处理区间前流水时累好。 */
    const rows = [];
    rowsAll.forEach((st) => {
      st.closing = st.opening + st.inc - st.dec;
      rows.push(st);
    });

    const domain = o.domain || '';
    const visible = domain ? rows.filter((r) => r.node.domain === domain) : rows;
    const totals = {
      A: { opening: 0, inc: 0, dec: 0, closing: 0, count: 0, nodes: 0, grossIn: 0, grossOut: 0 },
      B: { opening: 0, inc: 0, dec: 0, closing: 0, count: 0, nodes: 0, grossIn: 0, grossOut: 0 },
    };
    visible.forEach((r) => {
      const t = totals[r.node.polarity] || totals.A;
      t.opening += r.opening;
      t.inc += r.inc;
      t.dec += r.dec;
      t.closing += r.closing;
      t.count += r.count;
      t.nodes += 1;
      t.grossIn += r.grossIn;
      t.grossOut += r.grossOut;
    });

    const openingNet = totals.A.opening - totals.B.opening;
    const closingNet = totals.A.closing - totals.B.closing;

    /* 全局 A−B（不按域裁剪）用于验证双极守恒 */
    const globalTotals = {
      A: { opening: 0, inc: 0, dec: 0, closing: 0 },
      B: { opening: 0, inc: 0, dec: 0, closing: 0 },
    };
    rows.forEach((r) => {
      const t = globalTotals[r.node.polarity] || globalTotals.A;
      t.opening += r.opening;
      t.inc += r.inc;
      t.dec += r.dec;
      t.closing += r.closing;
    });
    const globalOpeningNet = globalTotals.A.opening - globalTotals.B.opening;
    const globalClosingNet = globalTotals.A.closing - globalTotals.B.closing;

    const tagRows = Array.from(tagStats.values()).sort((a, b) => b.amountCents - a.amountCents);
    const domainRows = Array.from(domainStats.values())
      .sort((a, b) => (dictMod ? dictMod.DOMAIN_ORDER.indexOf(a.domain) - dictMod.DOMAIN_ORDER.indexOf(b.domain) : 0));

    const chains = Array.from(chainMap.values()).map((ch) => {
      ch.events.sort((a, b) => S(a.date).localeCompare(S(b.date)));
      ch.nodes = [];
      ch.events.forEach((e) => {
        if (!ch.nodes.includes(e.from)) ch.nodes.push(e.from);
        if (!ch.nodes.includes(e.to)) ch.nodes.push(e.to);
      });
      return ch;
    });

    return {
      range,
      events: (events || []).slice(),
      rows: visible,
      allRows: rows,
      byId: new Map(rows.map((r) => [r.id, r])),
      totals,
      globalTotals,
      openingNet,
      closingNet,
      netWorth: closingNet,
      adjustedNet: closingNet - crossNetDelta,
      crossNetDelta,
      invariant: closingNet === openingNet,
      globalOpeningNet,
      globalClosingNet,
      globalInvariant: globalClosingNet === globalOpeningNet,
      balanced: globalClosingNet === globalOpeningNet && unbalanced === 0,
      flowCents,
      crossDomainCents,
      externalCents: flowCents - crossDomainCents,
      rangeCount,
      unbalanced,
      issues,
      tagRows,
      domains: domainRows,
      timeMinutes,
      timeByNode: Array.from(timeByNode.entries()).map(([id, m]) => ({ id, node: dict.nodes[id], minutes: m })),
      chains,
      unlabeledOutflow,
      gainCents,
      suppressCents,
      nodeCount: visible.length,
    };
  }

  /** 单节点余额（不传 range 就是全期）。 */
  function calcBalance(dict, events, nodeId, range) {
    const r = compute(dict, events, { range: range || null });
    const row = r.byId.get(nodeId);
    return row ? row.closing : 0;
  }

  /** 全局重算：id → 余额。 */
  function recalculateAllBalances(dict, events) {
    const out = {};
    const r = compute(dict, events, {});
    r.allRows.forEach((row) => { out[row.id] = row.closing; });
    return out;
  }

  /** 单笔双端守恒：两端金额相等、节点存在、金额正整数或时间。 */
  function checkEvent(dict, event) {
    const from = dict.nodes[event.from];
    const to = dict.nodes[event.to];
    if (!from || !to) return { ok: false, error: '节点未绑定' };
    if (!(Number(event.amountCents) > 0) && !(Number(event.minutes) > 0)) {
      return { ok: false, error: '金额/时间必须大于 0' };
    }
    return { ok: true };
  }

  TV.calc = {
    processTransfer,
    compute,
    calcBalance,
    recalculateAllBalances,
    checkEvent,
    emptyStat,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.calc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
