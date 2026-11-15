'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);
const EX = TV.example.createExample('test0001', NOW);

test('规则：计划行解析与序列化', () => {
  const line = 'R_001 active: 0 N_001 > N_004 100000 T_02 *m last_run=261111';
  const p = TV.rules.parsePlanLine(line, 3);
  assert.equal(p.ok, true);
  assert.equal(p.id, 'R_001');
  assert.equal(p.status, 'active');
  assert.equal(p.from, 'N_001');
  assert.equal(p.to, 'N_004');
  assert.equal(p.amountCents, 100000);
  assert.equal(p.period, 'm');
  assert.equal(p.lastRun, '261111');
  assert.deepEqual(p.tagIds, ['T_02']);
  const again = TV.rules.parsePlanLine(TV.rules.serializePlan(p), 0);
  assert.equal(again.ok, true);
  assert.equal(again.lastRun, '261111');
});

test('规则：事件规则解析', () => {
  const line = 'R_01 active: keywords=(美团|饿了么)&amount<100 -> N_001 > N_003 tags=T_01,T_02 name=外卖咖啡';
  const r = TV.rules.parseRuleLine(line, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.keywords, ['美团', '饿了么']);
  assert.equal(r.amountOp, '<');
  assert.equal(r.amountCents, 10000);
  assert.deepEqual(r.tagIds, ['T_01', 'T_02']);
  assert.equal(r.name, '外卖咖啡');
  assert.equal(TV.rules.serializeRule(r).includes('美团|饿了么'), true);
});

test('规则：区块往返', () => {
  const blocks = TV.rules.serializeBlocks(EX.plans, EX.rules);
  assert.ok(blocks.includes('[PLAN]'));
  assert.ok(blocks.includes('[RULES]'));
  const back = TV.rules.parseBlocks(blocks);
  assert.equal(back.plans.length, 3);
  assert.equal(back.rules.length, 2);
  assert.equal(back.warnings.length, 0);
});

test('规则：nextDue 与到期判断', () => {
  const p = { status: 'active', period: 'm', lastRun: '261001', start: '261001' };
  assert.equal(TV.rules.nextDue(p, NOW), '261101');
  assert.equal(TV.rules.isDue(p, NOW), true);
  p.lastRun = '261101';
  assert.equal(TV.rules.isDue(p, NOW), false);
});

test('规则：到期生成流水并推进 last_run', () => {
  const plans = [{ id: 'R_900', status: 'active', period: 'm', start: '261001', lastRun: '261001', from: 'N_001', to: 'N_004', amountCents: 100000, tagIds: [], domain: 'P' }];
  const out = TV.rules.runDuePlans(EX.dict, plans, NOW);
  assert.equal(out.generated, 1);
  assert.equal(out.events[0].date, '261101');
  assert.equal(out.events[0].amountCents, 100000);
  assert.equal(plans[0].lastRun, '261101');
});

test('规则：取消不改历史，只改状态', () => {
  const plans = JSON.parse(JSON.stringify(EX.plans));
  const r = TV.rules.cancelPlan(plans, 'R_001');
  assert.equal(r.ok, true);
  assert.equal(plans.find((p) => p.id === 'R_001').status, 'canceled');
  assert.equal(EX.events.length, 13);
  const back = TV.rules.resumePlan(plans, 'R_001');
  assert.equal(back.plan.status, 'active');
});

test('规则：预测式录入', () => {
  const hits = TV.rules.predict('外卖', EX.rules, EX.dict);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].text.includes('wx'));
  assert.ok(hits[0].text.includes('din'));
  assert.ok(hits[0].text.includes('外卖'));
  const two = TV.rules.predict('拿铁', EX.rules, EX.dict);
  assert.equal(two.length, 1);
});

test('规则：摘要', () => {
  const s = TV.rules.summarize(EX.plans);
  assert.equal(s.active, 2);
  assert.equal(s.canceled, 1);
  assert.equal(s.monthlyCents, 1100000);
});
