'use strict';

/* 查询页列宽：纯计算部分。
 *
 * 模型照 NT 账本的流水查询（`ui/width-fit.js` + `ui/table-layout.js`）：
 * 前五列有独立宽度，备注列吃剩余；屏窄时前五列按比例压到下限。
 * 这里只测算术，DOM 行为由 e2e 覆盖。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const Q = TV.queryCols;

test('列宽：列顺序与前五列默认值', () => {
  assert.deepEqual(Q.COLS, ['seq', 'date', 'from', 'to', 'amount']);
  assert.equal(Q.DEFAULTS.seq, 34);
  assert.equal(Q.DEFAULTS.amount, 88);
  assert.equal(Q.NOTE_MIN, 90);
  assert.equal(Q.NOTE_FLOOR, 32);
  const n = Q.normalize(null);
  assert.equal(n.seq, 34);
  assert.equal(n.date, 70);
  assert.equal(n.from, 92);
  assert.equal(n.to, 92);
  assert.equal(n.amount, 88);
  assert.equal(n.note, 90);
});

test('列宽：非法值回默认，越界夹到上下限', () => {
  const n = Q.normalize({ seq: 9999, date: 'x', from: 10, to: -5, amount: 100, note: 5 });
  assert.equal(n.seq, Q.MAX_W);      // 9999 → 800
  assert.equal(n.date, Q.DEFAULTS.date);
  assert.equal(n.from, Q.MINS.from);  // 10 → 48
  assert.equal(n.to, Q.DEFAULTS.to);
  assert.equal(n.amount, 100);
  assert.equal(n.note, Q.NOTE_FLOOR); // 5 → 32
});

test('列宽：够宽时一个像素都不动', () => {
  assert.equal(Q.fitWidths([100, 100, 100], 400), null);
  assert.equal(Q.fitWidths([100, 100, 100], 300), null);
});

test('列宽：超预算按原比例压', () => {
  const out = Q.fitWidths([100, 100, 100], 240, [0, 0, 0]);
  assert.deepEqual(out, [80, 80, 80]);
  assert.equal(out.reduce((s, x) => s + x, 0), 240);
});

test('列宽：保留下限，压不下去时承认溢出', () => {
  const out = Q.fitWidths([100, 100, 100], 90, [50, 20, 50]);
  assert.deepEqual(out, [50, 20, 50]);
});

test('容器：clientWidth 扣掉行内边距和 5 条列间距', () => {
  assert.equal(Q.ROW_CHROME, 46);
  assert.equal(Q.availableFor(474), 428);
  assert.equal(Q.availableFor(0), 0);
});

test('布局：宽容器里备注吃掉剩余', () => {
  const r = Q.layout(Q.DEFAULTS, 594);
  assert.deepEqual(r.cols, [34, 70, 92, 92, 88]);
  assert.equal(r.compressed, false);
  assert.equal(r.noteMin, 594 - 376); // 218
  assert.equal(r.noteWant, 90);
});

test('布局：三分之一屏宽，前五列按比例压，备注保 90', () => {
  const r = Q.layout(Q.DEFAULTS, 428);
  assert.equal(r.compressed, true);
  assert.deepEqual(r.cols, [31, 63, 82, 83, 79]);
  assert.equal(r.cols.reduce((s, x) => s + x, 0), 338);
  assert.equal(r.noteMin, 90);
});

test('布局：手机上压到下限，备注让到 68', () => {
  const r = Q.layout(Q.DEFAULTS, 314);
  assert.deepEqual(r.cols, [26, 52, 48, 48, 72]);
  assert.equal(r.noteMin, 68);
  assert.equal(r.cols.reduce((s, x) => s + x, 0) + r.noteMin, 314);
});

test('布局：极窄时备注到下限，允许横向滚动', () => {
  const r = Q.layout(Q.DEFAULTS, 274);
  assert.deepEqual(r.cols, [26, 52, 48, 48, 72]);
  assert.equal(r.noteMin, Q.NOTE_FLOOR);
  assert.ok(r.cols.reduce((s, x) => s + x, 0) + r.noteMin > 274);
});

test('布局：拖过之后备注按保存的期望下限留空间', () => {
  const r = Q.layout({ seq: 34, date: 70, from: 92, to: 92, amount: 88, note: 60 }, 428);
  assert.equal(r.noteWant, 60);
  assert.equal(r.cols.reduce((s, x) => s + x, 0), 368);
  assert.equal(r.noteMin, 60);
});

test('拖动上限：备注让到下限为止', () => {
  assert.equal(Q.maxDragWidth(83, 90), 83 + (90 - Q.NOTE_FLOOR));
  assert.equal(Q.maxDragWidth(83, 32), 83);
  assert.equal(Q.maxDragWidth(83, 0), 83);
});
