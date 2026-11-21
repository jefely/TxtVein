'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const A = TV.amount;

test('金额：元 → 整数分', () => {
  assert.equal(A.parseAmount('35').cents, 3500);
  assert.equal(A.parseAmount('35.5').cents, 3550);
  assert.equal(A.parseAmount('35.55').cents, 3555);
  assert.equal(A.parseAmount('0.01').cents, 1);
  assert.equal(A.parseAmount('¥1,000.00').cents, 100000);
  assert.equal(A.parseAmount('3.5k').cents, 350000);
  assert.equal(A.parseAmount('1k').cents, 100000);
  assert.equal(A.parseAmount('１００').cents, 10000);
});

test('金额：拒绝非法输入', () => {
  for (const s of ['', 'abc', '1.234', '-5', '3k.5', '1e3', '35元']) {
    assert.equal(A.parseAmount(s).ok, false, s);
  }
});

test('时间代币：d / h / m', () => {
  assert.deepEqual(A.parseTime('60m'), { ok: true, cents: 0, minutes: 60, unit: 'time', error: '' });
  assert.equal(A.parseTime('1.5h').minutes, 90);
  assert.equal(A.parseTime('1d2h30m').minutes, 1590);
  assert.equal(A.parseTime('1.5d').minutes, 2160);
  assert.equal(A.parseTime('0m').ok, false);
  assert.equal(A.parseQuantity('60m').unit, 'time');
  assert.equal(A.formatTime(60), '1h');
  assert.equal(A.formatTime(90), '1h30m');
  assert.equal(A.formatTime(1440), '1d');
  assert.equal(A.formatTime(1590), '1d2h30m');
  assert.equal(A.parseTime('60min').minutes, 60); /* 旧写法兼容 */
  assert.equal(A.parseQuantity('60').unit, 'money');
});

test('展示折叠：<1000 不缩写，≥1000 用 k', () => {
  assert.equal(A.centsToDisplay(0), '0');
  assert.equal(A.centsToDisplay(3500), '35');
  assert.equal(A.centsToDisplay(3550), '35.5');
  assert.equal(A.centsToDisplay(3555), '35.55');
  assert.equal(A.centsToDisplay(99900), '999');
  assert.equal(A.centsToDisplay(100000), '1k');
  assert.equal(A.centsToDisplay(350000), '3.5k');
  assert.equal(A.centsToDisplay(1000000), '10k');
  assert.equal(A.centsToDisplay(100000000), '1000k');
});

test('详情金额：¥3,512.34', () => {
  assert.equal(A.formatPlain(351234), '¥3,512.34');
  assert.equal(A.formatPlain(-351234), '-¥3,512.34');
  assert.equal(A.formatPlain(5), '¥0.05');
});

test('查询金额：无千分位、不强制两位小数', () => {
  assert.equal(A.formatCompact(0), '¥0');
  assert.equal(A.formatCompact(3500), '¥35');
  assert.equal(A.formatCompact(3550), '¥35.5');
  assert.equal(A.formatCompact(3555), '¥35.55');
  assert.equal(A.formatCompact(123456789), '¥1234567.89');
  assert.equal(A.formatCompact(-3500), '-¥35');
  assert.equal(A.formatCompact(5), '¥0.05');
});

test('周期后缀拆分', () => {
  assert.deepEqual(A.splitPeriod('1000*m'), { token: '1000', period: 'm', ok: true });
  assert.deepEqual(A.splitPeriod('35'), { token: '35', period: '', ok: true });
});

test('displayToCents 兼容入口', () => {
  assert.equal(A.displayToCents('3.5k'), 350000);
  assert.ok(Number.isNaN(A.displayToCents('abc')));
});
