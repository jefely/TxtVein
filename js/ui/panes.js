/* TxtVein · 宽屏多窗格（虚拟滚动）
 * 四个派生窗格：全局时间流 / A 极资产池 / B 极外部池 / 费用蒸汽池。
 * 全部从 Event + Dict 现算，不私存任何业务数据。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;
  const amount = TV.amount;
  const dictMod = TV.dict;

  const ROW = 33;
  const OVERSCAN = 8;

  const DEFS = [
    { key: 'time', title: '全局时间流', sub: 'EVENTS', kind: 'events' },
    { key: 'asset', title: 'A 极 · 资产池', sub: 'ASSET / COST', kind: 'nodes' },
    { key: 'external', title: 'B 极 · 外部池', sub: 'LIABILITY / INCOME / EQUITY', kind: 'nodes' },
    { key: 'expense', title: '费用 · 蒸汽', sub: 'EXPENSE', kind: 'nodes' },
  ];

  function fmtDate(stamp) {
    const s = String(stamp || '');
    return /^\d{6}$/.test(s) ? s.slice(2, 4) + '-' + s.slice(4, 6) : s;
  }

  function create(host, handlers) {
    const h = handlers || {};
    const state = {
      model: null,
      panes: {},
    };

    clear(host);
    DEFS.forEach((def) => {
      const count = el('span', { class: 'pane-count' });
      const filter = el('button', { class: 'pane-filter', hidden: true });
      const title = el('div', { class: 'pane-title' });
      const head = el('header', { class: 'pane-head' }, [title, filter, count]);
      const canvas = el('div', { class: 'pane-canvas' });
      const empty = el('div', { class: 'pane-empty', text: '暂无数据' });
      const scroll = el('div', { class: 'pane-scroll', 'data-pane': def.key }, [canvas, empty]);
      const pane = el('article', { class: 'pane', 'data-pane': def.key }, [head, scroll]);
      host.appendChild(pane);
      const p = { def, pane, head, title, count, filter, canvas, empty, scroll, items: [], top: 0, raf: 0 };
      state.panes[def.key] = p;

      scroll.addEventListener('scroll', () => {
        p.top = scroll.scrollTop;
        if (p.raf) return;
        p.raf = requestAnimationFrame(() => {
          p.raf = 0;
          paint(p);
        });
      }, { passive: true });

      canvas.addEventListener('click', (ev) => {
        const row = ev.target.closest('.row');
        if (!row) return;
        const idx = Number(row.dataset.index);
        if (def.kind === 'events') {
          if (h.onSelectEvent) h.onSelectEvent(Number(row.dataset.ev));
        } else if (h.onSelectNode) {
          h.onSelectNode(row.dataset.id);
        }
      });
      canvas.addEventListener('dblclick', (ev) => {
        const row = ev.target.closest('.row');
        if (!row) return;
        if (def.kind === 'events' && h.onEditEvent) h.onEditEvent(Number(row.dataset.ev));
        if (def.kind === 'nodes' && h.onSelectNode) h.onSelectNode(row.dataset.id);
      });
      filter.addEventListener('click', () => h.onFilterNode && h.onFilterNode(''));
    });

    function paint(p) {
      if (!p.items.length) {
        clear(p.canvas);
        p.canvas.style.height = '100%';
        p.empty.hidden = false;
        return;
      }
      p.empty.hidden = true;
      const total = p.items.length * ROW;
      p.canvas.style.height = total + 'px';
      const viewH = p.scroll.clientHeight || 400;
      const start = Math.max(0, Math.floor(p.top / ROW) - OVERSCAN);
      const end = Math.min(p.items.length, Math.ceil((p.top + viewH) / ROW) + OVERSCAN);
      clear(p.canvas);
      const frag = document.createDocumentFragment();
      for (let i = start; i < end; i += 1) {
        const row = p.def.kind === 'events' ? eventRow(p.items[i], i) : nodeRow(p.items[i], i);
        row.style.top = i * ROW + 'px';
        frag.appendChild(row);
      }
      p.canvas.appendChild(frag);
    }

    function tagText(tagIds) {
      const m = state.model;
      return (tagIds || [])
        .map((id) => dictMod.renderTag(m.dict, id, m.mode, m.lang))
        .filter(Boolean)
        .map((x) => '#' + x)
        .join(' ');
    }

    function eventRow(item, i) {
      const m = state.model;
      const e = item.event;
      const from = dictMod.renderNode(m.dict, e.from, m.mode, m.lang);
      const to = dictMod.renderNode(m.dict, e.to, m.mode, m.lang);
      const fromNode = m.dict.nodes[e.from];
      const toNode = m.dict.nodes[e.to];
      const tags = tagText(e.tagIds);
      const amt = e.minutes > 0 ? amount.formatTime(e.minutes) : amount.centsToDisplay(e.amountCents);
      const row = el('div', {
        class: 'row row-event' + (item.selected ? ' is-selected' : '') + (item.linked ? ' is-linked' : ''),
        dataset: { index: i, ev: item.index, kind: 'event' },
        title: (e.date || '') + '  ' + from + ' → ' + to + '  ' + amount.formatPlain(e.amountCents),
      }, [
        el('span', { class: 'date' }, [fmtDate(e.date)]),
        el('span', { class: 'flow' }, [
          el('span', { class: 'node ' + (fromNode && fromNode.polarity === 'B' ? 'is-b' : 'is-a') }, [from]),
          el('span', { class: 'op' }, ['>']),
          el('span', { class: 'node ' + (toNode && toNode.polarity === 'B' ? 'is-b' : 'is-a') }, [to]),
          tags ? el('span', { class: 'tags', text: tags }) : null,
        ]),
        el('span', { class: 'amt' + (e.minutes > 0 ? ' is-time' : '') }, [amt]),
      ]);
      if (e.minutes > 0) row.classList.add('is-time-row');
      return row;
    }

    function nodeRow(item, i) {
      const m = state.model;
      const n = item.node;
      const name = dictMod.renderNode(m.dict, item.id, m.mode, m.lang);
      const pole = n.polarity === 'B' ? 'is-b' : 'is-a';
      const form = n.type === '成本' ? '冰块' : n.type === '费用' ? '蒸汽' : n.type === '资产' ? '流体' : '';
      return el('div', {
        class: 'row row-node' + (item.selected ? ' is-selected' : '') + (item.linked ? ' is-linked' : ''),
        dataset: { index: i, id: item.id, kind: 'node' },
        title: dictMod.pathLabel(m.dict, item.id, m.lang),
      }, [
        el('span', { class: 'node-main' }, [
          el('span', { class: 'name ' + pole }, [name]),
          form ? el('span', { class: 'form' }, [form]) : null,
        ]),
        el('span', { class: 'node-count' }, [item.count ? item.count + ' 笔' : '—']),
        el('span', { class: 'node-balance' + (item.value < 0 ? ' is-neg' : '') }, [
          amount.centsToDisplay(item.value),
        ]),
      ]);
    }

    function titleFor(def, model) {
      const parts = [];
      if (def.key === 'time') {
        parts.push(el('b', {}, ['全局']), document.createTextNode(' 时间流'));
        parts.push(el('span', { class: 'dim' }, ['  // EVENTS']));
        return parts;
      }
      if (def.key === 'asset') {
        parts.push(el('span', { class: 'a' }, ['A 极']), document.createTextNode(' · 资产池'));
        parts.push(el('span', { class: 'dim' }, ['  // ASSET + COST']));
        return parts;
      }
      if (def.key === 'external') {
        parts.push(el('span', { class: 'b' }, ['B 极']), document.createTextNode(' · 外部池'));
        parts.push(el('span', { class: 'dim' }, ['  // LIABILITY + INCOME + EQUITY']));
        return parts;
      }
      parts.push(document.createTextNode('费用'), el('span', { class: 'dim' }, [' · 蒸汽  // EXPENSE']));
      return parts;
    }

    function buildModel(model) {
      const m = model;
      const selectedEvent = m.selectedEventIndex;
      const selectedNode = m.selectedNodeId;
      const linked = m.linkedNodeIds || new Set();
      const eventFilter = m.filterNodeId
        ? (e) => e.from === m.filterNodeId || e.to === m.filterNodeId
        : () => true;

      const timeItems = m.events
        .map((e, i) => ({ event: e, index: i }))
        .filter((x) => eventFilter(x.event))
        .filter((x) => !m.domain || x.event.domain === m.domain)
        .sort((a, b) => String(b.event.date).localeCompare(String(a.event.date)) || b.index - a.index)
        .map((x) => ({
          event: x.event,
          index: x.index,
          selected: x.index === selectedEvent,
          linked: linked.has(x.event.from) || linked.has(x.event.to),
        }));

      const nodeItems = (types) => {
        const rows = (m.calcAll ? m.calcAll.rows : [])
          .filter((r) => types.includes(r.node.type))
          .filter((r) => !m.domain || r.node.domain === m.domain)
          .filter((r) => !r.node.system || r.count > 0)
          .map((r) => ({
            id: r.id,
            node: r.node,
            value: types[0] === '费用' ? r.inc : r.closing,
            count: r.count,
            selected: r.id === selectedNode,
            linked: linked.has(r.id),
          }))
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || b.count - a.count);
        return rows;
      };

      return {
        time: timeItems,
        asset: nodeItems(['资产', '成本']),
        external: nodeItems(['负债', '收入', '权益']),
        expense: nodeItems(['费用']),
      };
    }

    function render(model) {
      state.model = model;
      const data = buildModel(model);
      DEFS.forEach((def) => {
        const p = state.panes[def.key];
        const items = data[def.key] || [];
        p.items = items;
        clear(p.title);
        titleFor(def, model).forEach((x) => p.title.appendChild(x));
        p.count.textContent = items.length + (def.kind === 'events' ? ' 笔' : ' 项');
        const filterId = model.filterNodeId;
        if (def.key === 'time' && filterId) {
          p.filter.hidden = false;
          p.filter.textContent = '节点: ' + dictMod.renderNode(model.dict, filterId, model.mode, model.lang) + ' ×';
        } else {
          p.filter.hidden = true;
        }
        p.canvas.style.height = (items.length * ROW) + 'px';
        paint(p);
      });
    }

    function scrollTimeToTop() {
      const p = state.panes.time;
      if (p) p.scroll.scrollTop = 0;
    }

    function scrollTimeToEvent(index) {
      const p = state.panes.time;
      if (!p) return;
      const i = p.items.findIndex((x) => x.index === index);
      if (i < 0) return;
      const target = Math.max(0, i * ROW - p.scroll.clientHeight / 3);
      p.scroll.scrollTop = target;
    }

    function flash(index) {
      const p = state.panes.time;
      if (!p) return;
      const i = p.items.findIndex((x) => x.index === index);
      if (i < 0) return;
      scrollTimeToEvent(index);
      requestAnimationFrame(() => {
        const row = p.canvas.querySelector('.row[data-ev="' + index + '"]');
        if (row) {
          row.classList.add('is-flash');
          setTimeout(() => row.classList.remove('is-flash'), 800);
        }
      });
    }

    return { render, scrollTimeToTop, scrollTimeToEvent, flash };
  }

  TV.panes = { create, ROW };
})(typeof globalThis !== 'undefined' ? globalThis : this);
