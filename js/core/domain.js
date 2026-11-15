/* TxtVein · 多域层
 * 域只是账本的「圈层」标签，不是另一套账：
 *   节点有 domain；流水行有 domain（记在哪个圈层）。
 * 跨域转移必须显式写前缀（P: / C: / …），解析层已在绑定阶段拦截。
 * 报表：独立视角只看本域节点；合并视角把跨域内部划拨单独列出并抵消。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  const ORDER = ['P', 'F', 'C', 'H'];

  function order(domain) {
    const i = ORDER.indexOf(S(domain).toUpperCase());
    return i < 0 ? 99 : i;
  }

  function label(domain, lang) {
    return dictMod ? dictMod.domainLabel(domain, lang) : S(domain);
  }

  function isCross(event, dict) {
    const from = dict && dict.nodes[event.from];
    const to = dict && dict.nodes[event.to];
    if (!from || !to) return false;
    return from.domain !== to.domain;
  }

  function filterEvents(events, domain) {
    if (!domain) return (events || []).slice();
    return (events || []).filter((e) => e.domain === domain);
  }

  function crossEvents(events, dict) {
    return (events || []).filter((e) => isCross(e, dict));
  }

  function groupByDomain(events) {
    const map = new Map();
    (events || []).forEach((e) => {
      const d = e.domain || 'P';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(e);
    });
    return ORDER.filter((d) => map.has(d)).map((d) => ({ domain: d, events: map.get(d) }));
  }

  /**
   * 合并视角：
   * internal = 跨域流水金额（家族/集团内部的划拨）
   * external = 全部流水 − internal（真正流出总盘子的部分）
   * 注意这里是「流量口径」，不是余额口径。
   */
  function consolidate(calcResult, dict) {
    const events = calcResult && calcResult.events ? calcResult.events : [];
    let internal = 0;
    let count = 0;
    events.forEach((e) => {
      if (isCross(e, dict)) {
        internal += Math.round(Number(e.amountCents) || 0);
        count += 1;
      }
    });
    const flow = Number(calcResult && calcResult.flowCents) || 0;
    return {
      internalCents: internal,
      externalCents: flow - internal,
      crossCount: count,
      flowCents: flow,
      offsetApplied: internal > 0,
    };
  }

  /** 域切换器需要的计数。 */
  function counts(dict, events) {
    const out = {};
    ORDER.forEach((d) => { out[d] = { nodes: 0, events: 0 }; });
    Object.keys((dict && dict.nodes) || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (out[n.domain]) out[n.domain].nodes += 1;
    });
    (events || []).forEach((e) => {
      const d = e.domain || 'P';
      if (out[d]) out[d].events += 1;
    });
    return out;
  }

  /**
   * 明确接口节点：同一域对之间，若确实需要镜像挂账，用这个固定 ID 家族。
   * MVP 不自动双记（否则同一笔钱会被算两次）；报表按跨域边界抵消。
   * 这个函数保留给后续「必须镜像」的场景，ID 规则固定、可审计。
   */
  function interfaceId(fromDomain, toDomain) {
    return 'N_iface_' + S(fromDomain).toUpperCase() + '_' + S(toDomain).toUpperCase();
  }

  function findInterfaceNodes(dict, fromDomain, toDomain) {
    const id = interfaceId(fromDomain, toDomain);
    return Object.keys((dict && dict.nodes) || {})
      .filter((k) => k === id || (dict.nodes[k].interface
        && dict.nodes[k].domain === toDomain
        && dict.nodes[k].peer_domain === fromDomain));
  }

  TV.domain = {
    ORDER,
    order,
    label,
    isCross,
    filterEvents,
    crossEvents,
    groupByDomain,
    consolidate,
    counts,
    interfaceId,
    findInterfaceNodes,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.domain;
})(typeof globalThis !== 'undefined' ? globalThis : this);
