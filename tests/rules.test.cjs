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
  assert.equal(s.monthly, 2);
  assert.equal(s.daily, 0);
});

/* ---------------- 固定收支 / 分期：NT 对齐口径 ---------------- */

const PLAN_NOW = new Date(2026, 10, 20, 10, 0, 0); /* 2026-11-20 */

function fixedBook(fixedLines, instLines, ledger) {
  const head = (ledger || ['261101 wx1 > din 35']).join('\n') + '\n';
  return head + '\n'.repeat(20) + '[固定]\n' + (fixedLines || []).join('\n') + '\n\n[分期]\n'
    + (instLines || []).join('\n') + '\n';
}

function compileFixed(book) {
  const ex = TV.example.createExample('plan02', PLAN_NOW);
  const dictSource = TV.source.dictToSource(ex.dict);
  const r = TV.source.compileAll(dictSource, book, { vaultId: 'plan02', now: PLAN_NOW, domain: 'P', system: TV.systemDict });
  const fp = TV.source.compileFixed(book, r.dict, { now: PLAN_NOW, domain: 'P' });
  return { dict: r.dict, events: r.events, plans: fp.plans, diags: fp.diagnostics, ledger: book };
}

test('固定表：行形同流水，备注放 //，状态放 | 之后', () => {
  const b = compileFixed(fixedBook(
    ['每月16日 wx1 > rent 1000 < xf *m // 房租', '每日 wx1 > din 5 *d // 早餐'],
    [],
  ));
  assert.equal(b.diags.filter((d) => d.severity === 'error').length, 0, JSON.stringify(b.diags));
  assert.equal(b.plans.length, 2);
  const rent = b.plans.find((p) => p.period === 'm');
  assert.equal(rent.day, 16);
  assert.equal(rent.note, '房租');
  assert.equal(TV.rules.scheduleText(rent), '每月16日');
  assert.equal(TV.rules.stateTokenOf(rent), '');
  assert.equal(b.plans.find((p) => p.period === 'd').note, '早餐');
});

test('固定表：分期带 期数/首月/本金/利息，金额仍是每期', () => {
  const b = compileFixed(fixedBook([], [
    '每月16日 wx1 > mac 900 *m 期数=2 首月=2612 本金=1200 利息=0 // 电脑',
  ]));
  assert.equal(b.plans.length, 1, JSON.stringify(b.diags));
  const p = b.plans[0];
  assert.equal(p.kind, 'installment');
  assert.equal(p.periods, 2);
  assert.equal(p.firstMonth, '2612');
  assert.equal(p.principalCents, 120000);
  assert.equal(p.interestCents, 0);
  assert.equal(p.amountCents, 90000, '每期金额');
  const info = TV.rules.installmentInfo(p, '2701');
  assert.equal(info.periods, 2);
  assert.equal(info.firstMonth, '2612');
  assert.equal(info.perPeriodCents, 90000);
});

test('未来区：每月固定往后 6 个月，每日只有今天，分期按月铺开', () => {
  const b = compileFixed(fixedBook(
    ['每月16日 wx1 > rent 1000 *m', '每日 wx1 > din 5 *d'],
    ['每月10日 wx1 > mac 900 *m 期数=2 首月=2612 本金=1200 利息=0'],
  ));
  const rows = TV.rules.planOccurrences(b.plans, PLAN_NOW, b.events, 6);
  const rentRows = rows.filter((r) => r.plan.period === 'm' && r.plan.kind !== 'installment')
    .map((r) => r.date);
  assert.deepEqual(rentRows, ['261216', '270116', '270216', '270316', '270416']);
  const daily = rows.filter((r) => r.kind === 'daily');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].date, '261120');
  const inst = rows.filter((r) => r.kind === 'installment');
  assert.deepEqual(inst.map((r) => r.date), ['261210', '270110']);
  assert.equal(inst[0].periodIndex, '1/2');
  assert.equal(inst[0].note, '分期还款 第 1/2 期');
});

test('每月固定：到期自动落账（日期=应发生日，备注=模板备注），分期/每日不自动', () => {
  const b = compileFixed(fixedBook(
    ['每月16日 wx1 > rent 1000 *m // 房租', '每日 wx1 > din 5 *d'],
    ['每月10日 wx1 > mac 900 *m 期数=2 首月=2612 本金=1200 利息=0'],
  ));
  const out = TV.rules.materializeDue(b.plans, PLAN_NOW, { existing: b.events, dict: b.dict });
  assert.equal(out.generated, 1);
  const ev = out.events[0];
  assert.equal(ev.date, '261116');
  assert.equal(ev.note, '房租');
  assert.ok(TV.rules.stateHas(b.plans.find((p) => p.period === 'm' && p.kind !== 'installment'), 'generated', '2611'));
  const again = TV.rules.materializeDue(b.plans, PLAN_NOW, { existing: b.events, dict: b.dict });
  assert.equal(again.generated, 0, '同一期不再生成');
});

test('每月固定：31 号在小月钳到月末；已有同月同额流水也记已生成', () => {
  const feb = new Date(2027, 1, 28, 10, 0, 0);
  const b1 = compileFixed(fixedBook(['每月31日 wx1 > rent 1000 *m'], [], ['270101 wx1 > din 35']));
  const out = TV.rules.materializeDue(b1.plans, feb, { existing: b1.events, dict: b1.dict });
  assert.equal(out.events[0].date, '270228');

  const b2 = compileFixed(fixedBook(['每月16日 wx1 > rent 1000 *m'], [], ['261114 wx1 > rent 1000']));
  const before = JSON.stringify(b2.plans[0].state || {});
  const out2 = TV.rules.materializeDue(b2.plans, PLAN_NOW, { existing: b2.events, dict: b2.dict });
  assert.equal(out2.generated, 0);
  assert.notEqual(JSON.stringify(b2.plans[0].state || {}), before, '应记成已生成');
});

test('确认：落成这一期自己的日期，并写进 确认=；作废：只记 key，未来区不再出现', () => {
  const b = compileFixed(fixedBook(
    ['每月16日 wx1 > rent 1000 *m // 房租'],
    ['每月10日 wx1 > mac 900 *m 期数=2 首月=2612 本金=1200 利息=0'],
  ));
  const rows = TV.rules.planOccurrences(b.plans, PLAN_NOW, b.events, 6);
  const dec = rows.find((r) => r.plan.period === 'm' && r.date === '261216');
  const ev = TV.rules.confirmOccurrence(dec.plan, TV.rules.occurrenceSpec(dec), PLAN_NOW, { dict: b.dict });
  assert.equal(ev.date, '261216', '确认落在这一期自己的日期');
  assert.equal(ev.note, '房租');
  assert.ok(TV.rules.stateHas(dec.plan, 'confirmed', '2612'));

  const inst = rows.find((r) => r.kind === 'installment');
  const iev = TV.rules.confirmOccurrence(inst.plan, TV.rules.occurrenceSpec(inst), PLAN_NOW, { dict: b.dict });
  assert.equal(iev.note, '分期还款 第 1/2 期');

  const voided = rows.find((r) => r.date === '270116');
  TV.rules.voidOccurrence(voided.plan, TV.rules.occurrenceSpec(voided));
  const after = TV.rules.planOccurrences(b.plans, PLAN_NOW, b.events, 6);
  assert.ok(!after.some((r) => r.date === '270116'), '作废的一期不再出现');
});

test('固定表状态写回文本可往返', () => {
  const b = compileFixed(fixedBook(['每月16日 wx1 > rent 1000 *m // 房租']));
  const p = b.plans[0];
  TV.rules.addPlanState(p, 'generated', '2611');
  TV.rules.addPlanState(p, 'confirmed', '2612');
  TV.rules.addPlanState(p, 'voided', '2701');
  const text = TV.source.fixedSourceFromPlans(b.plans, b.dict, { mode: 'CODE', lang: 'zh' });
  assert.ok(text.includes('生成=2611'), text);
  assert.ok(text.includes('确认=2612'), text);
  assert.ok(text.includes('作废=2701'), text);
  const back = TV.source.parsePlanSection(text, b.dict, { now: PLAN_NOW, domain: 'P' });
  assert.deepEqual(back.plans[0].state, { generated: ['2611'], confirmed: ['2612'], voided: ['2701'] });
  assert.equal(back.plans[0].note, '房租');
});

test('固定表聚合：每月收入/支出、分期未还本金/利息', () => {
  const b = compileFixed(fixedBook(
    ['每月16日 wx1 > sal 10000 *m', '每月5日 wx1 > rent 1000 *m'],
    ['每月10日 wx1 > mac 900 *m 期数=2 首月=2612 本金=1200 利息=100'],
  ));
  const sum = TV.rules.summarizePlans(b.plans, b.dict, PLAN_NOW);
  assert.equal(sum.fixedCount, 2);
  assert.equal(sum.installCount, 1);
  assert.equal(sum.monthlyIncome, 1000000);
  assert.equal(sum.monthlyExpense, 100000);
  const info = TV.rules.installmentInfo(b.plans.find((p) => p.kind === 'installment'), '2612');
  assert.equal(info.remainingPrincipalCents, 120000);
  assert.equal(info.remainingInterestCents, 10000);
});
