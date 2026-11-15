'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);
const EX = TV.example.createExample('test0001', NOW);

function build(opts) {
  return TV.report.buildReport(EX.dict, EX.events, Object.assign({ range: '全部', now: NOW }, opts || {}));
}

test('报表：六类分组与双极四列', () => {
  const r = build();
  assert.equal(r.ok, true);
  assert.equal(r.types.length, 6);
  const types = r.types.map((t) => t.type);
  assert.deepEqual(types, ['费用', '收入', '资产', '负债', '成本', '权益']);
  assert.equal(r.headline.aBalance, 1660000);
  assert.equal(r.headline.bBalance, 1660000);
  assert.equal(r.headline.invariant, true);
  assert.equal(r.headline.flowCents, 2127000);
});

test('报表：本月区间只计本月', () => {
  const r = build({ range: '本月' });
  assert.equal(r.range.start, '261101');
  assert.equal(r.headline.flowCents, 1527000);
  assert.equal(r.headline.rangeCount, 10);
});

test('报表：能量审计与时间代币', () => {
  const r = build({ range: '本月' });
  assert.equal(r.energy.gainCents, 3500);
  assert.equal(r.energy.suppressCents, 0);
  assert.ok(r.energy.gainNodes.length >= 1);
  assert.equal(r.energy.gainNodes[0].name, '餐饮');
  assert.equal(r.time.totalMinutes, 60);
  assert.ok(r.time.rows.some((x) => x.minutes === 60));
});

test('报表：多域与合并视角', () => {
  const r = build({ range: '本月' });
  assert.equal(r.domains.length, 2);
  assert.equal(r.consolidated.internalCents, 100000);
  assert.equal(r.consolidated.externalCents, 1427000);
  assert.equal(r.crossEvents.length, 1);
  assert.equal(r.crossEvents[0].fromDomain, 'P');
  assert.equal(r.crossEvents[0].toDomain, 'C');
});

test('报表：文本化包含各区块', () => {
  const txt = TV.report.reportToText(build({ range: '本月' }));
  assert.ok(txt.startsWith('TXTVAIN // REPORT'));
  assert.ok(txt.includes('[费用]'));
  assert.ok(txt.includes('[能量]'));
  assert.ok(txt.includes('[时间代币]'));
  assert.ok(txt.includes('[域]'));
  assert.ok(txt.includes('合并视角'));
});

test('报表：链式因果分组', () => {
  const dict = JSON.parse(JSON.stringify(EX.dict));
  const entry = TV.parser.parseEntry('sav > wx1 > din 1000 995', dict, { now: NOW, domain: 'P' });
  assert.equal(entry.ok, true);
  const r = TV.report.buildReport(dict, entry.events, { range: '全部', now: NOW });
  assert.equal(r.chains.length, 1);
  assert.equal(r.chains[0].events.length, 3);
  assert.equal(r.chains[0].totalCents, 200000);
});
