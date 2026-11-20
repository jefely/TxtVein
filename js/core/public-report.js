/* TxtVein · 公共报表（按锚点前推）
 *
 * 私人余额 → 母树叶子 → 祖先链。
 * 未归类 / 失效锚点单独桶，不并进“其他”，不计入公共合计。
 * 这是纯函数，不写回 Dict。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  function calcModule() {
    return TV.calc || (typeof require === 'function' ? require('./calc.js') : null);
  }
  function dateModule() {
    return TV.date || (typeof require === 'function' ? require('./date.js') : null);
  }
  function coreModule() {
    return TV.systemDictCore || null;
  }

  function emptyTotals() {
    return { opening: 0, inc: 0, dec: 0, closing: 0, count: 0 };
  }

  function addTotals(dst, row) {
    dst.opening += Number(row.opening) || 0;
    dst.inc += Number(row.inc) || 0;
    dst.dec += Number(row.dec) || 0;
    dst.closing += Number(row.closing) || 0;
    dst.count += Number(row.count) || 0;
  }

  function build(dict, events, system, opts) {
    const o = opts || {};
    const lang = o.lang === 'en' ? 'en' : 'zh';
    const now = o.now instanceof Date ? o.now : new Date();
    const calcMod = calcModule();
    const dateMod = dateModule();
    const core = coreModule();
    if (!calcMod) throw new Error('publicReport: calc module missing');
    const range = typeof o.range === 'string' && dateMod
      ? dateMod.parseRange(o.range, now)
      : o.range;
    const calc = calcMod.compute(dict, events, { range, domain: o.domain, now });
    const sysNodes = (system && system.nodes) || {};
    const buckets = {};
    const unclassified = { totals: emptyTotals(), rows: [] };
    const stale = { totals: emptyTotals(), rows: [] };
    const anchored = emptyTotals();
    let privateTotal = 0;

    (calc.rows || []).forEach((row) => {
      const node = row.node || {};
      /* 期初权益等虚拟账户：不进公共统计（与 NT 一样，它是隐藏账户） */
      if (TV.stats && TV.stats.isHiddenAccount(node)) return;
      privateTotal += Number(row.closing) || 0;
      const anchor = S(node.anchor_id).trim();
      if (!anchor) {
        addTotals(unclassified.totals, row);
        unclassified.rows.push(row);
        return;
      }
      /* v4 允许绑到分支或叶子：只要是母树里的分类节点就参与上卷 */
      if (!sysNodes[anchor] || sysNodes[anchor].kind !== 'category' || !core) {
        addTotals(stale.totals, row);
        stale.rows.push(row);
        return;
      }
      addTotals(anchored, row);
      core.ancestors(sysNodes, anchor).forEach((aid) => {
        if (!buckets[aid]) buckets[aid] = emptyTotals();
        addTotals(buckets[aid], row);
      });
    });

    // 只保留有贡献的分支；祖先链全部保留。
    const active = new Set();
    Object.keys(buckets).forEach((id) => {
      core.ancestors(sysNodes, id).forEach((a) => active.add(a));
    });
    const entries = {};
    active.forEach((id) => {
      const n = sysNodes[id];
      if (!n) return;
      entries[id] = {
        id,
        label: lang === 'en' ? n.en_name : n.zh_name,
        en_name: n.en_name,
        zh_name: n.zh_name,
        kind: n.kind,
        type: n.type,
        postable: core.isPostable(sysNodes, id),
        totals: buckets[id] || emptyTotals(),
        children: [],
      };
    });
    const roots = [];
    active.forEach((id) => {
      const e = entries[id];
      if (!e) return;
      const p = sysNodes[id].parent_id;
      if (p && entries[p]) entries[p].children.push(e);
      else roots.push(e);
    });
    const sortTree = (arr) => {
      arr.sort((a, b) => (sysNodes[a.id].sort - sysNodes[b.id].sort) || a.id.localeCompare(b.id));
      arr.forEach((x) => sortTree(x.children));
    };
    sortTree(roots);

    const reconcile = {
      privateTotal,
      anchored: anchored.closing,
      unclassified: unclassified.totals.closing,
      stale: stale.totals.closing,
      sum: anchored.closing + unclassified.totals.closing + stale.totals.closing,
      ok: privateTotal === (anchored.closing + unclassified.totals.closing + stale.totals.closing),
    };

    return {
      range: calc.range,
      rangeLabel: calc.range && calc.range.label ? calc.range.label : '',
      domain: o.domain || '',
      lang,
      tree: { id: 'SYS', label: lang === 'en' ? 'System' : '母树', totals: anchored, children: roots },
      anchored,
      unclassified,
      stale,
      reconcile,
      adjustedNet: calc.adjustedNet,
      privateTotal,
    };
  }

  TV.publicReport = { build };
  if (typeof module === 'object' && module.exports) module.exports = TV.publicReport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
