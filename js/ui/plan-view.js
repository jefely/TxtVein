/* TxtVein · 固定收支的未来记录
 *
 * 固定表（fixed.tv）是独立的表；这里只把它算出来的「未来记录」变成
 * 流水记录表末尾的真实文本行（带行号、只读）：
 *
 *   261216 wx1 > rent 1000 < xf
 *
 * 行形和真实流水完全一样；计划 / 期状态只留在 meta 里，不进正文。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const D = TV.dict;
  const rules = TV.rules;

  function nodeName(dict, id, mode, lang) {
    if (!dict || !dict.nodes || !dict.nodes[id]) return String(id || '?');
    return D.renderNode(dict, id, mode, lang || 'zh');
  }

  function buildModel(s, now) {
    const at = now instanceof Date ? now : new Date();
    const plans = (s && s.plans) || [];
    const events = (s && s.events) || [];
    return {
      dict: s && s.dict,
      plans,
      events,
      mode: (s && s.mode) || 'CODE',
      lang: (s && s.lang) || 'zh',
      now: at,
      today: TV.date.todayStamp(at),
      summary: rules.summarizePlans(plans, s && s.dict, at),
    };
  }

  /**
   * 未来记录：按具体日期排好，行形与真实流水相同。
   * 每月固定 / 分期往后 6 个月，每日只有今天；已生成 / 已确认 / 已作废的不出现。
   * @returns {Array<{text, planId, month, date, kind, amountCents, note, periodIndex}>}
   */
  function futureLineRows(model, horizon) {
    const rows = rules.planOccurrences(model.plans || [], model.now, model.events || [], horizon || 6);
    const mode = model.mode === 'CODE' ? 'CODE' : 'PLAIN';
    return rows.map((r) => {
      const p = r.plan;
      let from = nodeName(model.dict, p.from, mode, model.lang);
      let to = nodeName(model.dict, p.to, mode, model.lang);
      const fn = model.dict.nodes && model.dict.nodes[p.from];
      const tn = model.dict.nodes && model.dict.nodes[p.to];
      if (mode === 'CODE' && fn && tn && fn.domain !== tn.domain) {
        from = fn.domain + ':' + from;
        to = tn.domain + ':' + to;
      }
      const tags = (p.tagIds || [])
        .map((id) => (model.dict.tags[id] ? ' < ' + D.renderTag(model.dict, id, mode, model.lang) : ''))
        .join('');
      const domain = String(p.domain || 'P').toUpperCase();
      const pre = domain === 'P' ? '' : domain + ' ';
      return {
        text: pre + r.date + ' ' + from + ' > ' + to + ' '
          + TV.source.formatYuanExact(r.amountCents) + tags,
        planId: p.id,
        month: r.month,
        date: r.date,
        kind: r.kind,
        amountCents: r.amountCents,
        note: r.note,
        periodIndex: r.periodIndex,
      };
    });
  }

  TV.planView = {
    buildModel,
    futureLineRows,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.planView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
