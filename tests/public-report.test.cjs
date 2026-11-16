'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;
const A = TV.anchor;
const NOW = new Date(2026, 10, 16, 10, 0, 0);

function fixture() {
  const d = D.emptyDict('test', NOW);
  const cash = D.addNode(d, { zh_name: '现金', zh_code: 'xj', en_name: 'Cash', en_code: 'cash', type: '资产', domain: 'P' }).id;
  const dining = D.addNode(d, { zh_name: '餐饮', zh_code: 'din', en_name: 'Dining', en_code: 'dining', type: '费用', domain: 'P' }).id;
  const salary = D.addNode(d, { zh_name: '工资', zh_code: 'gz', en_name: 'Salary', en_code: 'salary', type: '收入', domain: 'P' }).id;
  const misc = D.addNode(d, { zh_name: '杂项', zh_code: 'misc', en_name: 'Misc', en_code: 'misc', type: '费用', domain: 'P' }).id;
  const stale = D.addNode(d, { zh_name: '失效', zh_code: 'old', en_name: 'Old', en_code: 'old', type: '费用', domain: 'P' }).id;
  A.set(d, cash, 'SYS.CAT.CASH.WALLET', TV.systemDict, { hasHistory: false });
  A.set(d, dining, 'SYS.CAT.DINING.GENERAL', TV.systemDict, { hasHistory: false });
  A.set(d, salary, 'SYS.CAT.SALARY', TV.systemDict, { hasHistory: false });
  d.nodes[stale].anchor_id = 'SYS.CAT.NOPE';
  const events = [
    { id: 'E_1', domain: 'P', date: '261116', from: salary, to: cash, amountCents: 1000000, minutes: 0, tagIds: [] },
    { id: 'E_2', domain: 'P', date: '261116', from: cash, to: dining, amountCents: 35000, minutes: 0, tagIds: [] },
    { id: 'E_3', domain: 'P', date: '261116', from: cash, to: misc, amountCents: 10000, minutes: 0, tagIds: [] },
    { id: 'E_4', domain: 'P', date: '261116', from: cash, to: stale, amountCents: 5000, minutes: 0, tagIds: [] },
  ];
  return { d, events, cash, dining, salary, misc, stale };
}

test('公共报表：锚点前推、未归类/失效分桶、对账相等', () => {
  const f = fixture();
  const before = JSON.stringify(f.d);
  const p = TV.publicReport.build(f.d, f.events, TV.systemDict, { range: null });
  assert.equal(JSON.stringify(f.d), before, '不应改 dict');

  assert.ok(p.anchored.count >= 3);
  assert.ok(p.unclassified.totals.count >= 1);
  assert.ok(p.stale.totals.count >= 1);
  assert.equal(p.reconcile.ok, true, JSON.stringify(p.reconcile));
  assert.equal(p.reconcile.privateTotal, p.reconcile.sum);
  assert.equal(p.stale.totals.closing, 5000);
  assert.equal(p.unclassified.totals.closing, 10000);
});

test('公共报表：母树树包含锚点祖先，金额不重复加到父子两层总和', () => {
  const f = fixture();
  const p = TV.publicReport.build(f.d, f.events, TV.systemDict, { range: null });
  const sys = p.tree.children[0];
  assert.equal(sys.id, 'SYS');
  assert.ok(sys.children.some((x) => x.id === 'SYS.ACC.EXPENSE'));
  const expense = sys.children.find((x) => x.id === 'SYS.ACC.EXPENSE');
  assert.ok(expense.children.some((x) => x.id === 'SYS.CAT.DINING'));
  const dining = expense.children.find((x) => x.id === 'SYS.CAT.DINING');
  assert.equal(dining.totals.closing, 35000);
  assert.equal(expense.totals.closing, 35000);
  // 父层是子层并集，不是重复相加；DINING 自身 totals 已经等于其子叶子和。
  assert.equal(expense.totals.closing, dining.totals.closing);
});

test('公共报表：域过滤只算本域', () => {
  const f = fixture();
  const c = D.addNode(f.d, { zh_name: '公户', zh_code: 'cbiz', en_name: 'Company', en_code: 'company', type: '资产', domain: 'C' }).id;
  A.set(f.d, c, 'SYS.CAT.BANK.CURRENT', TV.systemDict, { hasHistory: false });
  const events = f.events.concat([
    { id: 'E_C1', domain: 'C', date: '261116', from: c, to: c, amountCents: 1000, minutes: 0, tagIds: [] },
  ]);
  const p = TV.publicReport.build(f.d, events, TV.systemDict, { range: null, domain: 'C' });
  assert.ok(p.anchored.count >= 1);
  assert.equal(p.unclassified.totals.closing, 0);
  const pAll = TV.publicReport.build(f.d, events, TV.systemDict, { range: null });
  assert.ok(pAll.reconcile.privateTotal !== p.reconcile.privateTotal);
});

test('公共报表：adjustedNet 与私人 calc 一致', () => {
  const f = fixture();
  const p = TV.publicReport.build(f.d, f.events, TV.systemDict, { range: null });
  const calc = TV.calc.compute(f.d, f.events, { range: null });
  assert.equal(p.adjustedNet, calc.adjustedNet);
});
