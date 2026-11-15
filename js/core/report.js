/* TxtVein · 报表层（派生视图，绝不落盘）
 * 双极四列 / 多域合并 / 时间代币 / 增益阻抑 / 能量审计 / 链式因果。
 * 所有数字都来自 calc.compute；这里只做分组、排版和文案。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const calcMod = TV.calc || (typeof require === 'function' ? require('./calc.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);
  const domainMod = TV.domain || (typeof require === 'function' ? require('./domain.js') : null);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);

  const TYPE_ORDER = ['费用', '收入', '资产', '负债', '成本', '权益'];

  function resolveRange(range, now) {
    if (range && range.start && range.end) return range;
    if (typeof range === 'string') {
      const r = date.parseRange(range, now);
      return r.ok ? r : date.parseRange('', now);
    }
    return date.parseRange('', now);
  }

  function eventInRange(e, range) {
    if (!range || !range.start) return true;
    return S(e.date) >= range.start && S(e.date) <= range.end;
  }

  function nodeLabel(dict, id, lang) {
    return dictMod.renderNode(dict, id, 'PLAIN', lang || 'zh');
  }

  function buildReport(dict, events, opts) {
    const o = opts || {};
    const lang = o.lang || 'zh';
    const range = resolveRange(o.range, o.now);
    const calc = calcMod.compute(dict, events, { range, domain: o.domain || '', now: o.now });

    const byType = new Map();
    TYPE_ORDER.forEach((t) => byType.set(t, []));
    calc.rows.forEach((r) => {
      if (!byType.has(r.node.type)) byType.set(r.node.type, []);
      byType.get(r.node.type).push(r);
    });

    const types = TYPE_ORDER.map((type) => {
      const info = dictMod.TYPES[type];
      const rows = (byType.get(type) || []).slice().sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing));
      const totals = { opening: 0, inc: 0, dec: 0, closing: 0, count: 0 };
      rows.forEach((r) => {
        totals.opening += r.opening;
        totals.inc += r.inc;
        totals.dec += r.dec;
        totals.closing += r.closing;
        totals.count += r.count;
      });
      const outRows = rows.map((r) => ({
        id: r.id,
        name: nodeLabel(dict, r.id, lang),
        en_name: dict.nodes[r.id] ? dict.nodes[r.id].en_name : '',
        code: dict.nodes[r.id] ? dictMod.displayCode(dict, r.id, lang) : '',
        type,
        pole: info.pole,
        form: dict.nodes[r.id] ? dict.nodes[r.id].form : info.form,
        system: !!(dict.nodes[r.id] && dict.nodes[r.id].system),
        domain: dict.nodes[r.id] ? dict.nodes[r.id].domain : 'P',
        balance: r.closing,
        opening: r.opening,
        inc: r.inc,
        dec: r.dec,
        closing: r.closing,
        count: r.count,
        share: totals.closing !== 0 ? r.closing / totals.closing : 0,
      }));
      return {
        type,
        pole: info.pole,
        en: info.en,
        form: info.form,
        hint: info.hint,
        rows: outRows,
        totals,
        empty: outRows.length === 0,
      };
    });

    const inflow = calc.totals.A.inc + calc.totals.B.inc;
    const outflow = calc.totals.A.dec + calc.totals.B.dec;
    const headline = {
      aBalance: calc.totals.A.closing,
      bBalance: calc.totals.B.closing,
      netWorth: calc.adjustedNet,
      rawNetWorth: calc.netWorth,
      crossNetDelta: calc.crossNetDelta,
      inflow,
      outflow,
      flowCents: calc.flowCents,
      crossDomainCents: calc.crossDomainCents,
      rangeCount: calc.rangeCount,
      timeMinutes: calc.timeMinutes,
      invariant: calc.balanced,
      unbalanced: calc.unbalanced,
      nodeCount: calc.nodeCount,
    };

    const gainByNode = new Map();
    const suppressByNode = new Map();
    const darkByNode = new Map();
    const addMap = (map, id, cents) => {
      if (!id) return;
      map.set(id, (map.get(id) || 0) + cents);
    };
    (events || []).forEach((e) => {
      if (!eventInRange(e, range)) return;
      const cents = Math.round(Number(e.amountCents) || 0);
      if (!cents) return;
      const tags = Array.isArray(e.tagIds) ? e.tagIds : [];
      const from = dict.nodes[e.from];
      const to = dict.nodes[e.to];
      if (!from || !to) return;
      const target = to.polarity === 'A' ? e.to : e.from;
      let hasEnergyTag = false;
      tags.forEach((tid) => {
        const tag = dict.tags[tid];
        if (!tag) return;
        if (tag.kind === 'gain') { addMap(gainByNode, target, cents); hasEnergyTag = true; }
        if (tag.kind === 'suppress') { addMap(suppressByNode, target, cents); hasEnergyTag = true; }
      });
      if (!hasEnergyTag && !tags.length && from.polarity === 'A') addMap(darkByNode, e.from, cents);
    });

    const topNodes = (map, limit) => Array.from(map.entries())
      .map(([id, cents]) => ({ id, name: nodeLabel(dict, id, lang), cents }))
      .sort((a, b) => b.cents - a.cents)
      .slice(0, limit || 6);

    const energy = {
      gainCents: calc.gainCents,
      suppressCents: calc.suppressCents,
      unlabeledOutflow: calc.unlabeledOutflow,
      gainNodes: topNodes(gainByNode),
      suppressNodes: topNodes(suppressByNode),
      darkNodes: topNodes(darkByNode),
      gainRatio: calc.flowCents ? calc.gainCents / calc.flowCents : 0,
      suppressRatio: calc.flowCents ? calc.suppressCents / calc.flowCents : 0,
    };

    const tagRows = calc.tagRows.map((t) => ({
      id: t.id,
      name: lang === 'en' ? (t.tag.en_name || t.tag.zh_name) : (t.tag.zh_name || t.tag.en_name),
      kind: t.tag.kind || 'plain',
      domain: t.tag.domain || 'P',
      amountCents: t.amountCents,
      count: t.count,
      share: calc.flowCents ? t.amountCents / calc.flowCents : 0,
    }));

    const timeRows = calc.timeByNode
      .map((x) => ({
        id: x.id,
        name: nodeLabel(dict, x.id, lang),
        minutes: x.minutes,
        share: calc.timeMinutes ? x.minutes / calc.timeMinutes : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const chains = calc.chains.map((ch) => {
      const nodes = [];
      ch.events.forEach((e) => {
        if (!nodes.includes(e.from)) nodes.push(e.from);
        if (!nodes.includes(e.to)) nodes.push(e.to);
      });
      const evs = ch.events.map((e) => ({
        date: e.date,
        from: e.from,
        to: e.to,
        fromName: nodeLabel(dict, e.from, lang),
        toName: nodeLabel(dict, e.to, lang),
        amountCents: e.amountCents,
        minutes: e.minutes,
        diff: e.diff || '',
      }));
      return {
        id: ch.id,
        nodes: nodes.map((id) => nodeLabel(dict, id, lang)),
        events: evs,
        totalCents: ch.totalCents,
      };
    });

    const domains = calc.domains.map((d) => ({
      domain: d.domain,
      label: domainMod.label(d.domain, lang),
      flowCents: d.flowCents,
      count: d.count,
      inCents: d.inCents,
      outCents: d.outCents,
      bookedCents: d.bookedCents,
      crossCents: d.crossCents,
    }));

    const crossAll = (events || []).filter((e) => eventInRange(e, range)
      && dict.nodes[e.from] && dict.nodes[e.to]
      && dict.nodes[e.from].domain !== dict.nodes[e.to].domain);
    const consolidated = {
      flowCents: calc.flowCents,
      internalCents: calc.crossDomainCents,
      externalCents: calc.flowCents - calc.crossDomainCents,
      crossCount: crossAll.length,
      offsetApplied: calc.crossDomainCents > 0,
    };

    const crossEvents = crossAll.slice(-12).map((e) => ({
      date: e.date,
      fromName: nodeLabel(dict, e.from, lang),
      toName: nodeLabel(dict, e.to, lang),
      fromDomain: dict.nodes[e.from].domain,
      toDomain: dict.nodes[e.to].domain,
      amountCents: e.amountCents,
    }));

    return {
      ok: true,
      range,
      rangeLabel: range.label,
      domain: o.domain || '',
      lang,
      types,
      headline,
      energy,
      tags: tagRows,
      time: { totalMinutes: calc.timeMinutes, rows: timeRows },
      chains,
      domains,
      consolidated,
      crossEvents,
      issues: (calc.issues || []).slice(),
      generatedAt: new Date().toISOString(),
    };
  }

  function reportToText(report) {
    if (!report || !report.ok) return '';
    const h = report.headline;
    const lines = [];
    lines.push('TXTVAIN // REPORT');
    lines.push(report.rangeLabel + ' · ' + h.rangeCount + ' 笔 · ' + h.nodeCount + ' 个节点'
      + (h.invariant ? ' · 双极守恒 ✓' : ' · 双极不守恒 ✗'));
    lines.push('A 极 ' + amount.formatPlain(h.aBalance)
      + '   B 极 ' + amount.formatPlain(h.bBalance)
      + '   净额 ' + amount.formatPlain(h.netWorth)
      + '   流入 ' + amount.formatPlain(h.inflow)
      + '   流出 ' + amount.formatPlain(h.outflow));
    if (report.consolidated.offsetApplied) {
      lines.push('合并视角：内部跨域划拨 ' + amount.formatPlain(report.consolidated.internalCents)
        + ' 已单列；真正对外 ' + amount.formatPlain(report.consolidated.externalCents));
    }
    lines.push('');

    for (const t of report.types) {
      lines.push('[' + t.type + '] · ' + t.pole + ' 极 · ' + t.hint);
      if (!t.rows.length) {
        lines.push('  （无）');
        lines.push('');
        continue;
      }
      const nameW = Math.min(28, Math.max(8, ...t.rows.map((r) => text.textWidth(r.name))) + 2);
      const numW = 14;
      lines.push(
        text.padEndWidth('名称', nameW)
        + text.padStartWidth('期末', numW)
        + text.padStartWidth('本期增加', numW)
        + text.padStartWidth('本期减少', numW)
        + text.padStartWidth('期初', numW)
      );
      t.rows.forEach((r) => {
        lines.push(
          text.padEndWidth(r.name + (r.system ? '·S' : ''), nameW)
          + text.padStartWidth(amount.formatPlain(r.closing), numW)
          + text.padStartWidth(amount.formatPlain(r.inc), numW)
          + text.padStartWidth(amount.formatPlain(r.dec), numW)
          + text.padStartWidth(amount.formatPlain(r.opening), numW)
        );
      });
      lines.push(
        text.padEndWidth('合计', nameW)
        + text.padStartWidth(amount.formatPlain(t.totals.closing), numW)
        + text.padStartWidth(amount.formatPlain(t.totals.inc), numW)
        + text.padStartWidth(amount.formatPlain(t.totals.dec), numW)
        + text.padStartWidth(amount.formatPlain(t.totals.opening), numW)
      );
      lines.push('');
    }

    lines.push('[能量]');
    lines.push('增益 ' + amount.formatPlain(report.energy.gainCents)
      + '   阻抑 ' + amount.formatPlain(report.energy.suppressCents)
      + '   无标签流失 ' + amount.formatPlain(report.energy.unlabeledOutflow));
    report.energy.gainNodes.slice(0, 4).forEach((x) => {
      lines.push('  + ' + x.name + ' ' + amount.formatPlain(x.cents));
    });
    report.energy.suppressNodes.slice(0, 4).forEach((x) => {
      lines.push('  − ' + x.name + ' ' + amount.formatPlain(x.cents));
    });
    lines.push('');

    if (report.time.totalMinutes > 0) {
      lines.push('[时间代币] 共 ' + report.time.totalMinutes + 'm');
      report.time.rows.slice(0, 6).forEach((x) => {
        lines.push('  ' + x.name + ' ' + x.minutes + 'm');
      });
      lines.push('');
    }

    if (report.chains.length) {
      lines.push('[链式因果]');
      report.chains.slice(0, 8).forEach((ch) => {
        lines.push('  ' + ch.id + '  ' + ch.nodes.join(' > ') + '  ' + amount.formatPlain(ch.totalCents));
      });
      lines.push('');
    }

    lines.push('[域]');
    report.domains.forEach((d) => {
      lines.push('  ' + d.label + ' · ' + d.count + ' 笔 · 记入 ' + amount.formatPlain(d.bookedCents)
        + ' · 跨域 ' + amount.formatPlain(d.crossCents));
    });
    return lines.join('\n');
  }

  TV.report = {
    TYPE_ORDER,
    resolveRange,
    buildReport,
    reportToText,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.report;
})(typeof globalThis !== 'undefined' ? globalThis : this);
