/* TxtVein · 报表视图
 * 双极四列、能量审计、时间代币、链式因果、多域合并。
 * 所有数字来自 report.buildReport；这里只负责 DOM。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;
  const amount = TV.amount;

  function create(host, handlers) {
    const h = handlers || {};
    let model = null;
    let report = null;
    let customRange = '';

    function render(nextReport, nextModel) {
      report = nextReport;
      model = nextModel || model;
      if (!report || !report.ok) return;
      clear(host);
      const inner = el('div', { class: 'report-inner' });
      inner.appendChild(head());
      inner.appendChild(kpi());
      inner.appendChild(typeGrid());
      inner.appendChild(sideGrid());
      inner.appendChild(chainCard());
      inner.appendChild(domainCard());
      if (report.issues && report.issues.length) inner.appendChild(issuesCard());
      host.appendChild(inner);
    }

    function head() {
      const chips = el('div', { class: 'range-bar' });
      ['本月', '上月', '今年', '全部'].forEach((label) => {
        const b = el('button', {
          class: 'range-chip' + (report.rangeLabel.startsWith(label) || (label === '全部' && report.rangeLabel === '全期') ? ' is-active' : ''),
          type: 'button',
        }, [label]);
        b.addEventListener('click', () => { customRange = ''; h.onRange && h.onRange(label); });
        chips.appendChild(b);
      });
      const input = el('input', {
        class: 'range-input', type: 'text', placeholder: '261101~261130',
        value: customRange || '',
      });
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          customRange = input.value.trim();
          if (customRange) h.onRange && h.onRange(customRange);
        }
        if (ev.key === 'Escape') { input.value = ''; input.blur(); }
      });
      chips.appendChild(input);
      return el('header', { class: 'report-head' }, [
        el('div', {}, [
          el('div', { class: 'report-title' }, [
            (model && model.lang === 'en' ? 'STATS ' : '统计 '), el('span', {}, ['// 双极 · 四列 · 派生视图']),
          ]),
          el('div', { class: 'report-sub' }, [
            report.rangeLabel + ' · ' + report.headline.rangeCount + ' 笔 · '
              + report.headline.nodeCount + ' 个节点',
          ]),
        ]),
        chips,
      ]);
    }

    function kpi() {
      const hd = report.headline;
      const inv = hd.invariant;
      const netNote = report.domain
        ? '域内净额 · 跨域调整 ' + amount.formatPlain(Math.abs(hd.crossNetDelta || 0))
        : '净额（期初差恒定）';
      return el('div', { class: 'kpi-row' }, [
        kpiCell('A 极余额', amount.formatPlain(hd.aBalance), 'a', report.domain ? '本域 · 资产/费用/成本' : '资产 / 费用 / 成本'),
        kpiCell('B 极余额', amount.formatPlain(hd.bBalance), 'b', report.domain ? '本域 · 负债/收入/权益' : '负债 / 收入 / 权益'),
        kpiCell('A − B', amount.formatPlain(hd.netWorth), '', netNote),
        kpiCell('本期流水', amount.formatPlain(hd.flowCents), '', hd.rangeCount + ' 笔'),
        kpiCell('跨域划拨', amount.formatPlain(hd.crossDomainCents), '', '合并时抵消'),
        kpiCell('双极守恒', inv ? 'OK' : 'BROKEN', inv ? 'ok' : 'bad', inv ? 'A − B 未变' : '检查未绑定节点'),
      ]);
    }

    function kpiCell(label, value, cls, note) {
      return el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi-label' }, [label]),
        el('div', { class: 'kpi-value ' + (cls || '') }, [value]),
        el('div', { class: 'kpi-note' }, [note || '']),
      ]);
    }

    function typeGrid() {
      const grid = el('div', { class: 'report-grid' });
      report.types.forEach((t) => grid.appendChild(typeCard(t)));
      return grid;
    }

    const TYPE_COLS = {
      收入: [['期初累计', 'opening'], ['本期收入', 'inc'], ['本期退回', 'dec'], ['期末累计', 'closing']],
      负债: [['期初余额', 'opening'], ['本期新增', 'inc'], ['本期偿还', 'dec'], ['期末余额', 'closing']],
      权益: [['期初余额', 'opening'], ['本期增加', 'inc'], ['本期减少', 'dec'], ['期末余额', 'closing']],
      资产: [['期初余额', 'opening'], ['本期流入', 'inc'], ['本期流出', 'dec'], ['期末余额', 'closing']],
      费用: [['本期累计', 'closing'], ['本期支出', 'inc'], ['本期退回', 'dec'], ['本期净出', 'net']],
      成本: [['期初净值', 'opening'], ['本期新增', 'inc'], ['本期消耗', 'dec'], ['期末净值', 'closing']],
    };

    function typeValue(row, key) {
      if (key === 'net') return (Number(row.closing) || 0) - (Number(row.opening) || 0);
      return Number(row[key]) || 0;
    }

    function typeCard(t) {
      const card = el('section', { class: 'report-card', dataset: { type: t.type } });
      const cols = TYPE_COLS[t.type] || TYPE_COLS.资产;
      const head = el('div', { class: 'card-head' }, [
        el('h3', {}, [t.type]),
        el('span', { class: 'pole ' + (t.pole === 'A' ? 'a' : 'b') }, [t.pole + ' 极']),
        el('span', { class: 'hint' }, [t.hint]),
        el('span', { class: 'total' }, [amount.formatPlain(t.totals.closing)]),
      ]);
      card.appendChild(head);
      if (!t.rows.length) {
        card.appendChild(el('div', { class: 'rtable-empty' }, ['（本期无记录）']));
        return card;
      }
      const table = el('div', { class: 'rtable' }, [
        el('div', { class: 'rtable-row is-head' }, [
          el('span', {}, ['分类']),
          ...cols.map((c) => el('span', { class: 'rtable-num' }, [c[0]])),
        ]),
      ]);
      t.rows.forEach((r) => {
        const code = model && model.mode === 'CODE' ? r.code : '';
        const nameEl = el('span', { class: 'rtable-name' }, [
          code ? code : r.name,
          code ? el('span', { class: 'code' }, [r.name]) : null,
          r.system ? el('span', { class: 'sys' }, ['SYS']) : null,
        ]);
        const row = el('div', { class: 'rtable-row', dataset: { id: r.id } }, [
          nameEl,
          ...cols.map((c) => {
            const v = typeValue(r, c[1]);
            return el('span', { class: 'rtable-num' + (v < 0 ? ' is-neg' : '') + (c[1] === 'net' ? ' is-sub' : '') }, [
              amount.formatPlain(v),
            ]);
          }),
        ]);
        row.style.cursor = 'pointer';
        row.title = '在查询页中筛选该节点';
        row.addEventListener('click', () => h.onNodeClick && h.onNodeClick(r.id));
        table.appendChild(row);
      });
      table.appendChild(el('div', { class: 'rtable-row is-total' }, [
        el('span', {}, ['合计']),
        ...cols.map((c) => el('span', { class: 'rtable-num' }, [amount.formatPlain(typeValue(t.totals, c[1]))])),
      ]));
      card.appendChild(table);
      return card;
    }

    function sideGrid() {
      return el('div', { class: 'report-grid' }, [energyCard(), timeCard()]);
    }

    function energyCard() {
      const e = report.energy;
      const max = Math.max(e.gainCents, e.suppressCents, e.unlabeledOutflow, 1);
      const card = el('section', { class: 'report-card' });
      card.appendChild(el('div', { class: 'card-head' }, [
        el('h3', {}, ['能量审计']),
        el('span', { class: 'hint' }, ['增益 / 阻抑 / 无标签流失']),
      ]));
      card.appendChild(el('div', { class: 'energy-grid' }, [
        el('div', { class: 'energy-cell' }, [
          el('div', { class: 'l' }, ['天赋驱动 · 增益']),
          el('div', { class: 'v gain' }, [amount.formatPlain(e.gainCents)]),
        ]),
        el('div', { class: 'energy-cell' }, [
          el('div', { class: 'l' }, ['短板流失 · 阻抑']),
          el('div', { class: 'v drain' }, [amount.formatPlain(e.suppressCents)]),
        ]),
        el('div', { class: 'energy-cell' }, [
          el('div', { class: 'l' }, ['精神暗域 · 无标签']),
          el('div', { class: 'v dark' }, [amount.formatPlain(e.unlabeledOutflow)]),
        ]),
      ]));
      const list = el('div', { class: 'energy-list' });
      const addLine = (x, cls) => {
        const pct = Math.max(2, Math.round((x.cents / max) * 100));
        list.appendChild(el('div', { class: 'energy-line' + (cls || '') }, [
          el('span', { class: 'n' }, [x.name]),
          el('span', { class: 'v' }, [amount.formatPlain(x.cents)]),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })]),
        ]));
      };
      e.gainNodes.slice(0, 3).forEach((x) => addLine(x));
      e.suppressNodes.slice(0, 3).forEach((x) => addLine(x, 'is-drain'));
      e.darkNodes.slice(0, 3).forEach((x) => addLine(x, 'is-drain'));
      if (!e.gainNodes.length && !e.suppressNodes.length && !e.darkNodes.length) {
        list.appendChild(el('div', { class: 'rtable-empty' }, ['（本期没有可归因的能量标签）']));
      }
      card.appendChild(list);
      return card;
    }

    function timeCard() {
      const t = report.time;
      const card = el('section', { class: 'report-card' });
      card.appendChild(el('div', { class: 'card-head' }, [
        el('h3', {}, ['时间代币']),
        el('span', { class: 'hint' }, ['m · 不进入金额余额']),
      ]));
      card.appendChild(el('div', { class: 'time-big' }, [
        el('b', {}, [String(t.totalMinutes)]),
        el('span', {}, ['m']),
      ]));
      const list = el('div', { class: 'energy-list' });
      const max = Math.max.apply(null, [t.totalMinutes, 1].concat(t.rows.map((x) => x.minutes)));
      t.rows.forEach((x) => {
        const pct = Math.max(2, Math.round((x.minutes / max) * 100));
        list.appendChild(el('div', { class: 'energy-line' }, [
          el('span', { class: 'n' }, [x.name]),
          el('span', { class: 'v' }, [x.minutes + 'm']),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })]),
        ]));
      });
      if (!t.rows.length) list.appendChild(el('div', { class: 'rtable-empty' }, ['（还没有 60m 这类时间流水）']));
      card.appendChild(list);
      return card;
    }

    function chainCard() {
      const card = el('section', { class: 'report-card', style: 'margin-top:14px' });
      card.appendChild(el('div', { class: 'card-head' }, [
        el('h3', {}, ['链式因果']),
        el('span', { class: 'hint' }, ['同一次 > 链展开的原子边，中间节点净额 0']),
        el('span', { class: 'total' }, [report.chains.length + ' 组']),
      ]));
      if (!report.chains.length) {
        card.appendChild(el('div', { class: 'rtable-empty' }, ['（还没有 A > B > C 这样的链式流水）']));
        return card;
      }
      const list = el('div', { class: 'chain-list' });
      report.chains.forEach((ch) => {
        const item = el('div', { class: 'chain-item' }, [
          el('div', { class: 'chain-head' }, [
            el('span', { class: 'id' }, [ch.id]),
            el('span', {}, [ch.nodes.join(' > ')]),
            el('span', { class: 'sum' }, [amount.formatPlain(ch.totalCents)]),
          ]),
          el('div', { class: 'chain-events' }, ch.events.map((e) => el('span', {}, [
            e.date + ' ' + e.fromName + '>' + e.toName + ' ',
            el('span', { class: 'amt' }, [amount.formatPlain(e.amountCents)]),
            e.diff === 'loss' ? ' 损耗' : e.diff === 'gain' ? ' 增益' : '',
          ]))),
        ]);
        list.appendChild(item);
      });
      card.appendChild(list);
      return card;
    }

    function domainCard() {
      const card = el('section', { class: 'report-card', style: 'margin-top:14px' });
      card.appendChild(el('div', { class: 'card-head' }, [
        el('h3', {}, ['多域 · 合并视角']),
        el('span', { class: 'hint' }, ['独立账本严格隔离；内部划拨单列并抵消']),
        el('span', { class: 'total' }, [report.domains.length + ' 域']),
      ]));
      const list = el('div', { class: 'domain-list' });
      report.domains.forEach((d) => {
        list.appendChild(el('div', { class: 'domain-line' }, [
          el('span', { class: 'd' }, [d.domain, el('i', {}, [d.label])]),
          el('span', { class: 'n' }, [d.count + ' 笔 · 记入 ' + amount.formatPlain(d.bookedCents)]),
          el('span', { class: 'v' }, ['流入 ' + amount.formatPlain(d.inCents)]),
          el('span', { class: 'v cross' }, ['跨域 ' + amount.formatPlain(d.crossCents)]),
        ]));
      });
      if (!report.domains.length) list.appendChild(el('div', { class: 'rtable-empty' }, ['（本期没有流水）']));
      card.appendChild(list);
      const c = report.consolidated;
      card.appendChild(el('div', { class: 'consolidate-note' }, [
        '合并：内部跨域 ' + amount.formatPlain(c.internalCents) + '，真正对外 '
          + el('b', {}, [amount.formatPlain(c.externalCents)]) + '。',
        report.crossEvents.length
          ? el('span', {}, [' 最近跨域：' + report.crossEvents.map((x) => x.fromDomain + '→' + x.toDomain + ' ' + amount.formatPlain(x.amountCents)).join(' · ')])
          : null,
      ]));
      return card;
    }

    function issuesCard() {
      const lines = report.issues.slice(0, 8).map((x) => '· ' + (x.message || x.code));
      return el('div', { class: 'report-issues' }, [
        '底层数据有 ' + report.issues.length + ' 条提示：',
        el('br'),
        lines.join(' '),
      ]);
    }

    return { render };
  }

  TV.reportView = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
