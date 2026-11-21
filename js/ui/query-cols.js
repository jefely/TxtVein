/* TxtVein · 查询列宽（界面胶水）
 *
 * 任何带 `data-q-scope` 的容器里，`.q-table` 共用一套列宽：
 *   · 表头右边缘拖动改列宽（前五列：序 / 日期 / 转出 / 转入 / 金额）；
 *   · 备注列没有手柄，自动吃掉剩余宽度；
 *   · 双击表头右边缘恢复该列默认宽度；
 *   · 列宽存在本机 localStorage（不写进账本，和主题/字号同级）。
 *
 * 作用域让同一个组件能放进两个地方：
 *   `#query-view`（三段流水查询）——三张表等宽，共用一套变量；
 *   统计页右侧 `.q-panel[data-q-scope="stats"]`（单张流水查询）。
 * 两个作用域宽度不同，所以按作用域分别 fit；列宽本身共享，改哪边都一样。
 *
 * 纯计算在 `js/core/query-cols.js`；这里只做三件事：
 * 量 DOM、挂手柄/指针事件、把结果写成 CSS 变量。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const core = TV.queryCols;
  const COLS = core.COLS;
  const KEY = 'txtvein.query.cols.v1';
  /** 边界左侧的命中宽度；可视线左移 EDGE，避免正好压在列线上。 */
  const HIT = 10;
  const EDGE = 2;
  /** CSS 变量名（金额列用短名 amt，和 grid-template 保持一致）。 */
  const VAR = { seq: 'seq', date: 'date', from: 'from', to: 'to', amount: 'amt' };

  let widths = core.normalize(read());
  let bound = false;
  let resizeTimer = 0;
  let drag = null;
  let raf = 0;

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(widths));
    } catch (e) { /* ignore */ }
  }

  function setVars(scope, layout) {
    if (!scope || !layout) return;
    COLS.forEach((k, i) => scope.style.setProperty('--q-c-' + VAR[k], layout.cols[i] + 'px'));
    scope.style.setProperty('--q-note-min', layout.noteMin + 'px');
  }

  /** 作用域里第一张有宽度的表（隐藏页为 0，跳过）。 */
  function scopeWidth(scope) {
    const tables = scope.querySelectorAll('.q-table');
    for (const t of tables) {
      const w = t.clientWidth;
      if (w > 0) return w;
    }
    return 0;
  }

  function fitScope(scope) {
    const avail = core.availableFor(scopeWidth(scope));
    if (!avail) return null;
    const layout = core.layout(widths, avail);
    setVars(scope, layout);
    return layout;
  }

  function allScopes() {
    if (typeof document === 'undefined') return [];
    return Array.prototype.slice.call(document.querySelectorAll('[data-q-scope]'));
  }

  function fit() {
    allScopes().forEach(fitScope);
  }

  function scheduleFit() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = 0;
      fit();
    }, 80);
  }

  /** 表头每一格：前五列记下列名并挂手柄，最后一格（备注）标 q-note。 */
  function decorateHead(row) {
    if (!row) return;
    const cells = row.children;
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (i < COLS.length) {
        cell.dataset.col = COLS[i];
        if (!cell.querySelector('.q-col-handle')) {
          const handle = document.createElement('span');
          handle.className = 'q-col-handle';
          handle.setAttribute('aria-hidden', 'true');
          handle.title = '拖动调整列宽；双击恢复默认';
          cell.appendChild(handle);
        }
      } else if (i === COLS.length) {
        cell.classList.add('q-note');
      }
    }
  }

  /** 在表头行里找 clientX 命中的列边界（列右边缘左移 EDGE）。 */
  function edgeTarget(row, x) {
    let best = null;
    let bestD = Infinity;
    for (const cell of row.children) {
      const col = cell.dataset ? cell.dataset.col : '';
      if (!col || COLS.indexOf(col) < 0) continue;
      const r = cell.getBoundingClientRect();
      /* 允许落在边界右侧 4px（列间距里），但不能越过下一列左边缘 */
      if (x > r.right + 4) continue;
      const d = Math.abs((r.right - EDGE) - x);
      if (d <= HIT && d < bestD) { best = cell; bestD = d; }
    }
    return best;
  }

  function measure(head) {
    const out = {};
    COLS.forEach((k, i) => {
      const cell = head.children[i];
      out[k] = cell ? Math.round(cell.getBoundingClientRect().width) : widths[k];
    });
    return out;
  }

  function onDown(ev) {
    if (!ev.target || !ev.target.closest) return;
    const scope = ev.target.closest('[data-q-scope]');
    if (!scope) return;
    const table = ev.target.closest('.q-table');
    if (!table || !scope.contains(table)) return;
    const head = ev.target.closest('.q-row.is-head');
    if (!head) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const cell = edgeTarget(head, ev.clientX);
    if (!cell) return;
    ev.preventDefault();
    ev.stopPropagation();
    startDrag(scope, head, cell, ev);
  }

  function startDrag(scope, head, cell, ev) {
    const col = cell.dataset.col;
    const idx = COLS.indexOf(col);
    if (idx < 0) return;

    const noteCell = head.children[COLS.length];
    const noteNow = noteCell
      ? Math.round(noteCell.getBoundingClientRect().width)
      : core.NOTE_MIN;
    const startX = ev.clientX;
    const minW = core.MINS[col];
    const startW = Math.round(cell.getBoundingClientRect().width);
    const maxW = Math.min(core.MAX_W, Math.max(startW, core.maxDragWidth(startW, noteNow)));
    const before = widths;
    /* 拖动期间先按屏幕上量到的宽度画（含窗口窄时的压缩值），松手再存。 */
    const measured = measure(head);
    const frozen = core.normalize(Object.assign({}, measured, { note: widths.note }));
    const baseCols = COLS.map((k) => measured[k]);

    widths = frozen;
    let applied = { cols: baseCols.slice(), noteMin: noteNow, noteWant: widths.note, compressed: false };
    setVars(scope, applied);
    document.body.classList.add('q-col-resizing');
    cell.classList.add('is-dragging');
    try { cell.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    drag = { moved: false, before };

    let next = startW;
    const flush = () => {
      raf = 0;
      if (!drag || !applied) return;
      const cols = applied.cols.slice();
      cols[idx] = Math.round(next);
      const noteMin = Math.max(core.NOTE_FLOOR, noteNow - (cols[idx] - startW));
      applied = { cols, noteMin, noteWant: widths.note, compressed: false };
      setVars(scope, applied);
    };

    const onMove = (e) => {
      if (!drag) return;
      next = core.clamp(startW + (e.clientX - startX), minW, maxW);
      drag.moved = true;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (raf) { cancelAnimationFrame(raf); flush(); }
      cell.removeEventListener('pointermove', onMove);
      cell.removeEventListener('pointerup', finish);
      cell.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
      try { cell.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      cell.classList.remove('is-dragging');
      document.body.classList.remove('q-col-resizing');
      const moved = drag.moved;
      const beforeW = drag.before;
      drag = null;
      if (!moved) {
        /* 只是点了一下边界：不写盘，恢复原样 */
        widths = beforeW;
        fit();
        return;
      }
      /* 松手时量一遍：五列存实际宽，备注存 [FLOOR, MIN] 之间的期望下限。
         窗口变宽时备注会自己吃满多出来的空间，不会把变宽后的实际值
         记成「需求」，下次窗口变窄就不会反过来压五列。 */
      const after = measure(head);
      const noteAfter = noteCell ? Math.round(noteCell.getBoundingClientRect().width) : widths.note;
      widths = core.normalize(Object.assign({}, after, {
        note: Math.min(core.NOTE_MIN, Math.max(core.NOTE_FLOOR, noteAfter)),
      }));
      write();
      fit();
    };

    cell.addEventListener('pointermove', onMove);
    cell.addEventListener('pointerup', finish);
    cell.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
  }

  function onDouble(ev) {
    if (!ev.target || !ev.target.closest) return;
    const scope = ev.target.closest('[data-q-scope]');
    if (!scope) return;
    const table = ev.target.closest('.q-table');
    if (!table || !scope.contains(table)) return;
    const head = ev.target.closest('.q-row.is-head');
    if (!head) return;
    const cell = edgeTarget(head, ev.clientX);
    if (!cell) return;
    ev.preventDefault();
    const col = cell.dataset.col;
    if (!col) return;
    const next = Object.assign({}, widths);
    next[col] = core.DEFAULTS[col];
    widths = core.normalize(next);
    write();
    fit();
  }

  function attach() {
    if (bound || typeof document === 'undefined') return;
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('dblclick', onDouble);
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    bound = true;
  }

  attach();

  TV.queryLayout = { attach, decorateHead, refit: fit };
})(typeof globalThis !== 'undefined' ? globalThis : this);
