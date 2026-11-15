'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.date;
const NOW = new Date(2026, 10, 15, 10, 0, 0); // 2026-11-15

test('日期：YYMMDD / YYYYMMDD / 分隔符', () => {
  assert.equal(D.parseDate('261115').iso, '2026-11-15');
  assert.equal(D.parseDate('20261115').iso, '2026-11-15');
  assert.equal(D.parseDate('2026-11-05').iso, '2026-11-05');
  assert.equal(D.parseDate('26/11/05').iso, '2026-11-05');
});

test('日期：拒绝不存在的日期', () => {
  for (const s of ['261132', '261100', '2026-02-30', 'abc', '']) {
    assert.equal(D.parseDate(s).ok, false, s);
  }
});

test('相对日期：0 / -1 / -2 / +1', () => {
  assert.equal(D.resolveDateToken('0', NOW).stamp, '261115');
  assert.equal(D.resolveDateToken('-1', NOW).stamp, '261114');
  assert.equal(D.resolveDateToken('-2', NOW).stamp, '261113');
  assert.equal(D.resolveDateToken('+1', NOW).stamp, '261116');
  assert.equal(D.resolveDateToken('1', NOW).stamp, '261116');
  assert.equal(D.resolveDateToken('-1', NOW).relative, true);
});

test('月份边界与闰年', () => {
  assert.equal(D.addMonths('260131', 1), '260228');
  assert.equal(D.addMonths('240131', 1), '240229');
  assert.equal(D.addMonths('261130', -1), '261030');
  assert.equal(D.addYears('240229', 1), '250228');
  assert.equal(D.addDays('261231', 1), '270101');
});

test('区间：本月 / 中文逗号 / 紧凑 / 月份', () => {
  const m = D.parseRange('本月', NOW);
  assert.equal(m.start, '261101');
  assert.equal(m.end, '261130');
  assert.equal(D.parseRange('26，11，01，>，26，11，30').text, '261101~261130');
  assert.equal(D.parseRange('261101~261130').text, '261101~261130');
  assert.equal(D.parseRange('2026-11').text, '261101~261130');
  assert.equal(D.parseRange('261115').text, '261115~261115');
  assert.equal(D.parseRange('全部').text, '000101~991231');
});

test('区间：拒绝反向', () => {
  assert.equal(D.parseRange('261201~261101').ok, false);
});

test('inRange / addPeriod', () => {
  const r = D.parseRange('261101~261130');
  assert.equal(D.inRange('261115', r), true);
  assert.equal(D.inRange('261201', r), false);
  assert.equal(D.addPeriod('261115', 'm'), '261215');
  assert.equal(D.addPeriod('261115', 'd'), '261116');
  assert.equal(D.addPeriod('261115', 'y'), '271115');
});
