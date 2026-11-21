/* TxtVein · 查询页列宽（纯计算，零 DOM）
 *
 * 查询页三张表同构：序 / 日期 / 转出 / 转入 / 金额 / 备注。
 * 前五列有独立列宽，可拖；备注列不写死宽度，吃掉剩余空间。
 * 这套模型照 NT 账本的流水查询（`ui/width-fit.js` 的 fitShareTable +
 * `ui/table-layout.js` 的拖动），区别只有一处：
 *
 *   NT 把「备注列上次量到的实际宽度」当期望值存下来；
 *   这里只存 [NOTE_FLOOR, NOTE_MIN] 之间的**期望下限** ——
 *   窗口变宽时备注自动吃掉多出来的空间，不会把变宽后的实际值记成需求，
 *   下次窗口变窄时就不会反过来把五列压到最小。
 *
 * 所以「谁让步」的次序是：
 *   1. 先按保存的前五列宽度画；
 *   2. 放不下时前五列按比例压（不改变比例，只压到各自下限）；
 *   3. 备注列至少 NOTE_FLOOR；实在放不下才横向滚动。
 *
 * 本文件不读写 DOM、也不碰浏览器存储；界面胶水在 `js/ui/query-cols.js`。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  /** 列顺序必须与 app.js 的表头 / 行模板一致。 */
  const COLS = ['seq', 'date', 'from', 'to', 'amount'];
  /** 默认调宽（px）。首次打开时用；拖动后存本机。 */
  const DEFAULTS = { seq: 34, date: 70, from: 92, to: 92, amount: 88 };
  /** 压到极限的下限（px）。字号 11.5px 下「序」26 / 日期 52 / 金额 72 仍能看。 */
  const MINS = { seq: 26, date: 52, from: 48, to: 48, amount: 72 };
  /** 没拖过时备注列的期望下限；也是前五列压缩预算的依据。 */
  const NOTE_MIN = 90;
  /** 拖动时备注列最多让到这么窄（再窄就没法读）。 */
  const NOTE_FLOOR = 32;
  /** 单列拖动的硬上限。 */
  const MAX_W = 800;
  /**
   * 行内边距 + 列间距（px）：`padding: 6px 8px` 左右共 16，
   * `gap: 6px` × 5 条 = 30。
   */
  const ROW_CHROME = 46;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * 把本机存的值洗成可用的列宽。
   * 缺省 / 非数字 / 越界都回默认；备注只收 [NOTE_FLOOR, NOTE_MIN]。
   */
  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    COLS.forEach((k) => {
      const n = Number(src[k]);
      out[k] = Number.isFinite(n) && n > 0
        ? Math.round(clamp(n, MINS[k], MAX_W))
        : DEFAULTS[k];
    });
    const note = Number(src.note);
    out.note = Number.isFinite(note) && note > 0
      ? Math.round(clamp(note, NOTE_FLOOR, NOTE_MIN))
      : NOTE_MIN;
    return out;
  }

  /**
   * 把一组固定列按比例压进预算。
   *
   * 够宽时返回 `null` —— 调用方据此判断「一个像素都不用动」。
   * 压过之后如果仍超（屏特别窄），从最宽的列往下扣到预算为止；
   * 全部到了下限就认了，让表格略微溢出、横向滚动，而不是压成看不清。
   *
   * @param {number[]} widths 期望宽度（px）
   * @param {number} budget   这组列可用的总宽（px）
   * @param {number[]} [mins] 每列下限（同下标）
   * @returns {number[]|null}
   */
  function fitWidths(widths, budget, mins) {
    const n = (widths || []).length;
    if (!n) return null;
    const total = widths.reduce((s, w) => s + w, 0);
    if (total <= budget) return null;
    const k = budget / (total || 1);
    const out = widths.map((w, i) => Math.max((mins && mins[i]) || 0, Math.round(w * k)));
    let over = out.reduce((s, w) => s + w, 0) - budget;
    while (over > 0) {
      let widest = -1;
      for (let i = 0; i < n; i += 1) {
        const floor = (mins && mins[i]) || 0;
        if (out[i] > floor && (widest < 0 || out[i] > out[widest])) widest = i;
      }
      if (widest < 0) break;
      out[widest] -= 1;
      over -= 1;
    }
    return out;
  }

  /** 容器 clientWidth → 六列可用宽度（扣掉行内边距与列间距）。 */
  function availableFor(clientWidth) {
    return Math.max(0, Math.round(Number(clientWidth) || 0) - ROW_CHROME);
  }

  /**
   * 算一次布局。
   *
   * @param {object} widths 保存的列宽（normalize 过的或原始值都行）
   * @param {number} available 六列可用宽度（不是容器宽）
   * @returns {{cols:number[], noteMin:number, noteWant:number, compressed:boolean}}
   */
  function layout(widths, available) {
    const w = normalize(widths);
    const avail = Math.max(0, Math.round(Number(available) || 0));
    const want = COLS.map((k) => w[k]);
    if (!avail) {
      return { cols: want.slice(), noteMin: w.note, noteWant: w.note, compressed: false };
    }
    const noteWant = clamp(w.note, NOTE_FLOOR, NOTE_MIN);
    const budget = avail - noteWant;
    const fitted = fitWidths(want, budget, COLS.map((k) => MINS[k]));
    const cols = fitted || want.slice();
    const sum = cols.reduce((s, x) => s + x, 0);
    /* 备注列至少 NOTE_FLOOR；五列已经放不下时它保持 FLOOR，由容器横向滚动。 */
    const noteMin = Math.max(NOTE_FLOOR, avail - sum);
    return { cols, noteMin, noteWant, compressed: !!fitted };
  }

  /**
   * 拖动一列时它能到的最大宽度。
   * 唯一让得出空间的是备注列：上限 = 当前宽 + 备注还能让多少（到 NOTE_FLOOR 为止）。
   */
  function maxDragWidth(startW, noteNow) {
    const slack = Math.max(0, Number(noteNow || 0) - NOTE_FLOOR);
    return Math.round(Number(startW || 0) + slack);
  }

  TV.queryCols = {
    COLS, DEFAULTS, MINS, NOTE_MIN, NOTE_FLOOR, MAX_W, ROW_CHROME,
    clamp, normalize, fitWidths, availableFor, layout, maxDragWidth,
  };
  if (typeof module === 'object' && module.exports) module.exports = TV.queryCols;
})(typeof globalThis !== 'undefined' ? globalThis : this);
