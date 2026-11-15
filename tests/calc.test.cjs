'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);
const EX = TV.example.createExample('test0001', NOW);

function calc(opts) {
  return TV.calc.compute(EX.dict, EX.events, Object.assign({ range: TV.date.parseRange('全部') }, opts || {}));
}

test('计算：双极转移公式（processTransfer）', () => {
  const a = { balance: 1000, polarity: 'A' };
  const b = { balance: 0, polarity: 'A' };
  TV.calc.processTransfer(a, b, 300);
  assert.equal(a.balance, 700);
  assert.equal(b.balance, 300);
  const li = { balance: 0, polarity: 'B' };
  const inc = { balance: 0, polarity: 'B' };
  TV.calc.processTransfer(li, inc, 200); // 负债转出=增加；收入转入=减少
  assert.equal(li.balance, 200);
  assert.equal(inc.balance, -200);
});

test('计算：示例账本双极守恒、A=B', () => {
  const r = calc();
  assert.equal(r.unbalanced, 0);
  assert.equal(r.totals.A.closing, 1660000);
  assert.equal(r.totals.B.closing, 1660000);
  assert.equal(r.globalInvariant, true);
  assert.equal(r.closingNet, 0);
  assert.equal(r.flowCents, 2127000);
});

test('计算：单节点余额', () => {
  assert.equal(TV.calc.calcBalance(EX.dict, EX.events, 'N_002'), 1330000); // 储蓄卡
  assert.equal(TV.calc.calcBalance(EX.dict, EX.events, 'N_001'), -77000); // 微信
  assert.equal(TV.calc.calcBalance(EX.dict, EX.events, 'N_003'), 87000); // 餐饮
  assert.equal(TV.calc.calcBalance(EX.dict, EX.events, 'N_010'), 600000); // 期初权益
});

test('计算：区间把区间前流水折进期初', () => {
  const r = calc({ range: TV.date.parseRange('本月', NOW) });
  const bank = r.byId.get('N_002');
  assert.ok(bank);
  assert.equal(bank.opening, 500000);
  assert.equal(bank.closing, 1330000);
  const wx = r.byId.get('N_001');
  assert.equal(wx.opening, 100000);
  assert.equal(wx.closing, -77000);
  assert.equal(r.globalInvariant, true);
});

test('计算：域视角只出本域节点，跨域单列', () => {
  const r = calc({ domain: 'C' });
  const ids = r.rows.map((x) => x.id);
  assert.deepEqual(ids.sort(), ['N_011', 'N_012', 'N_013'].sort());
  assert.equal(r.flowCents > 0, true);
  assert.equal(r.globalInvariant, true);
  assert.equal(r.crossDomainCents, 100000);
});

test('计算：域内净额加回跨域调整', () => {
  const p = calc({ domain: 'P', range: TV.date.parseRange('本月', NOW) });
  assert.equal(p.crossNetDelta, -100000);
  assert.equal(p.adjustedNet, 0);
  const c = calc({ domain: 'C', range: TV.date.parseRange('本月', NOW) });
  assert.equal(c.crossNetDelta, 100000);
  assert.equal(c.adjustedNet, 0);
});

test('计算：时间代币只进时间统计，不进金额', () => {
  const r = calc();
  assert.equal(r.timeMinutes, 60);
  assert.ok(r.timeByNode.some((x) => x.id === 'N_001' && x.minutes === 60));
  assert.equal(r.flowCents, 2127000);
});

test('计算：标签统计与增益/阻抑', () => {
  const r = calc();
  const gain = r.tagRows.find((x) => x.tag.zh_name === '增益');
  assert.ok(gain);
  assert.equal(gain.amountCents, 3500);
  assert.equal(r.gainCents, 3500);
  assert.equal(r.suppressCents, 0);
  assert.equal(r.unlabeledOutflow, 50000); // 公司公户 > 办公费（无标签）
});

test('计算：全局重算与逐节点一致', () => {
  const all = TV.calc.recalculateAllBalances(EX.dict, EX.events);
  assert.equal(all.N_002, 1330000);
  assert.equal(all.N_001, -77000);
  assert.equal(all.N_011, 50000);
});

test('计算：引用不存在的节点被计为不平衡，不崩溃', () => {
  const events = EX.events.concat([{ date: '261115', from: 'N_NOPE', to: 'N_001', amountCents: 100, tagIds: [] }]);
  const r = TV.calc.compute(EX.dict, events, { range: TV.date.parseRange('全部') });
  assert.equal(r.unbalanced, 1);
  assert.equal(r.globalInvariant, true);
});

test('计算：链式中间节点净额 0', () => {
  const dict = JSON.parse(JSON.stringify(EX.dict));
  const r = TV.parser.parseEntry('sav > wx1 > din 1000 995', dict, { now: NOW, domain: 'P' });
  assert.equal(r.ok, true);
  const c = TV.calc.compute(dict, r.events, { range: TV.date.parseRange('全部') });
  const wx = c.byId.get('N_001');
  assert.equal(wx.closing, 0);
  assert.equal(c.globalInvariant, true);
});
