/* TxtVein · 统计中间列表列宽（界面胶水）
 *
 * 统计页右侧的明细表（分类/节点、备注、事件）与流水查询同一种交互：
 *   · 表头右边缘拖动改列宽；
 *   · 最后一列自动吃掉剩余宽度（分类/节点表就是「备注」列）；
 *   · 双击表头右边缘恢复该列默认宽度；
 *   · 列宽存本机 `txtvein.stats.cols.v1`，按表类型分开（list / note / event）。
 *
 * 纯计算很少，这里只做四件事：量 DOM、挂手柄、把宽度写成 CSS 变量、存本机。
 * 表格模板在 editor.css：`.stats-table[data-list="…"] .sd-row`。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const KEY = 'txtvein.stats.cols.v1';

  const SPECS = {
    /* 分类 / 节点明细：序 日期 转出 转入 金额 备注 */
    list: {
      cols: ['seq', 'date', 'from', 'to', 'amount'],
      flex: 'note',
      vars: {
        seq: '--s-c-seq', date: '--s-c-date', from: '--s-c-from',
        to: '--s-c-to', amount: '--s-c-amt',
      },
      defaults: { seq: 30, date: 58, from: 80, to: 80, amount: 68, note: 50 },
      mins: { seq: 24, date: 48, from: 44, to: 44, amount: 58, note: 44 },
    },
    /* 备注明细：序 日期 分类 关键词 金额（金额自动吃剩余） */
    note: {
      cols: ['seq', 'date', 'cat', 'key'],
      flex: 'amount',
      vars: {
        seq: '--s-c-seq', date: '--s-c-date', cat: '--s-c-cat', key: '--s-c-key',
      },
      defaults: { seq: 30, date: 58, cat: 60, key: 70, amount: 68 },
      mins: { seq: 24, date: 48, cat: 46, key: 50, amount: 58 },
    },
    /* 事件明细：序 日期 转出 转入 强度 标签 */
    event: {
      cols: ['seq', 'date', 'from', 'to', 'weight'],
      flex: 'tags',
      vars: {
        seq: '--s-c-seq', date: '--s-c-date', from: '--s-c-from',
        to: '--s-c-to', weight: '--s-c-weight',
      },
      defaults: { seq: 30, date: 58, from: 60, to: 60, weight: 34, tags: 46 },
      mins: { seq: 24, date: 48, from: 44, to: 44, weight: 28, tags: 40 },
    },
  };

  let resizeTimer = 0;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) { /* ignore */ }
  }

  /** 读某张表的一套列宽；缺省/越界回默认。 */
  function widthsFor(kind) {
    const spec = SPECS[kind];
    const raw = (readStore()[kind] || {});
    const out = {};
    spec.cols.forEach((k) => {
      const n = Number(raw[k]);
      out[k] = Number.isFinite(n) && n > 0
        ? Math.round(clamp(n, spec.mins[k], 800))
        : spec.defaults[k];
    });
    return out;
  }

  function saveWidths(kind, widths) {
    const store = readStore();
    const spec = SPECS[kind];
    const clean = {};
    spec.cols.forEach((k) => { clean[k] = Math.round(widths[k]); });
    store[kind] = clean;
    writeStore(store);
  }

  /** 行内容可用宽度（扣左右 padding 与列间距）。 */
  function availableOf(table, n) {
    const row = table.querySelector('.sd-row');
    if (!row) return 0;
    const cs = getComputedStyle(row);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const gap = (parseFloat(cs.columnGap) || 0) * Math.max(0, n - 1);
    const w = row.clientWidth - pad - gap;
    return w > 0 ? Math.round(w) : 0;
  }

  /**
   * 把固定列按比例压进预算；够宽时不动。
   * 最后一列（备注 / 金额 / 标签）用 minmax(flexMin, 1fr)，自动吃剩余。
   */
  function apply(table, kind, widths) {
    const spec = SPECS[kind];
    const n = spec.cols.length + 1;
    table.querySelectorAll('.sd-row').forEach((row) => {
      row.style.gridTemplateColumns = '';
    });

    const avail = availableOf(table, n);
    const fixed = spec.cols.map((k) => widths[k]);
    const flexMin = spec.mins[spec.flex];
    let cols = fixed.slice();

    if (avail > 0) {
      const budget = Math.max(0, avail - flexMin);
      const total = fixed.reduce((s, x) => s + x, 0);
      if (total > budget) {
        const k = budget / (total || 1);
        cols = fixed.map((w, i) => Math.max(spec.mins[spec.cols[i]], Math.round(w * k)));
        let over = cols.reduce((s, x) => s + x, 0) - budget;
        while (over > 0) {
          let widest = -1;
          for (let i = 0; i < cols.length; i += 1) {
            if (cols[i] > spec.mins[spec.cols[i]] && (widest < 0 || cols[i] > cols[widest])) widest = i;
          }
          if (widest < 0) break;
          cols[widest] -= 1;
          over -= 1;
        }
      }
    }

    spec.cols.forEach((k, i) => table.style.setProperty(spec.vars[k], cols[i] + 'px'));
    table.style.setProperty('--s-note-min', flexMin + 'px');
  }

  function startDrag(table, kind, key, cell, ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const spec = SPECS[kind];
    const widths = widthsFor(kind);
    const startX = ev.clientX;
    const startW = Math.round(cell.getBoundingClientRect().width);
    const n = spec.cols.length + 1;
    const avail = availableOf(table, n);
    const others = spec.cols
      .filter((k) => k !== key)
      .reduce((s, k) => s + widths[k], 0);
    const maxBySpace = avail > 0
      ? avail - spec.mins[spec.flex] - others
      : 800;
    const maxW = Math.max(spec.mins[key], Math.min(800, maxBySpace));
    let moved = false;
    let raf = 0;

    try { cell.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    document.body.classList.add('s-col-resizing');
    cell.classList.add('is-dragging');

    const paint = () => {
      raf = 0;
      table.style.setProperty(spec.vars[key], widths[key] + 'px');
    };

    const onMove = (e) => {
      const w = clamp(startW + (e.clientX - startX), spec.mins[key], maxW);
      if (w !== widths[key]) {
        widths[key] = Math.round(w);
        moved = true;
      }
      if (!raf) raf = requestAnimationFrame(paint);
    };

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (raf) { cancelAnimationFrame(raf); paint(); }
      cell.removeEventListener('pointermove', onMove);
      cell.removeEventListener('pointerup', finish);
      cell.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
      try { cell.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      cell.classList.remove('is-dragging');
      document.body.classList.remove('s-col-resizing');
      if (moved) saveWidths(kind, widths);
      apply(table, kind, widths);
    };

    cell.addEventListener('pointermove', onMove);
    cell.addEventListener('pointerup', finish);
    cell.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
  }

  function decorateTable(table) {
    const kind = table.dataset.list;
    const spec = SPECS[kind];
    if (!spec || table.dataset.colsReady === '1') return;
    table.dataset.colsReady = '1';
    const head = table.querySelector('.sd-row.is-head');
    if (!head) return;
    const cells = head.children;
    spec.cols.forEach((key, i) => {
      const cell = cells[i];
      if (!cell) return;
      cell.dataset.sCol = key;
      if (cell.querySelector('.q-col-handle')) return;
      const handle = document.createElement('span');
      handle.className = 'q-col-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.title = '拖动调整列宽；双击恢复默认';
      handle.addEventListener('pointerdown', (ev) => startDrag(table, kind, key, cell, ev));
      handle.addEventListener('dblclick', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const widths = widthsFor(kind);
        widths[key] = spec.defaults[key];
        saveWidths(kind, widths);
        apply(table, kind, widths);
      });
      cell.appendChild(handle);
    });
    apply(table, kind, widthsFor(kind));
  }

  /** app 每次画出右侧明细表后调用。 */
  function decorate(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.stats-table[data-list]').forEach(decorateTable);
  }

  function fitAll() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.stats-table[data-list]').forEach((table) => {
      const kind = table.dataset.list;
      if (SPECS[kind]) apply(table, kind, widthsFor(kind));
    });
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = 0;
      fitAll();
    }, 80);
  }

  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);

  TV.statsCols = { decorate, refit: fitAll };
})(typeof globalThis !== 'undefined' ? globalThis : this);
