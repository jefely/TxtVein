'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();

const OLD2 = [
  '# 文脉 2 · 纯文本账本',
  '# 节点：简码，财务大类，统计分类，节点名称，期初金额',
  '## 节点',
  'WX，资产，网络账户，微信钱包，1000.00',
  'JHC，资产，储蓄，交行储8380，5000.00',
  'CF，费用，餐饮，星巴克，0.00',
  'GZ，收入，工资，工资卡，0.00',
  '## 流水',
  '261105，JHC，WX，500.00，转账，内部，提现到微信',
  '261110，WX，CF，35.00，餐饮，咖啡，星巴克拿铁',
  '261115，GZ，JHC，10000.00，收入，工资，本月发薪',
].join('\n');

const OLD1 = [
  '# 文脉账本',
  '## 统计',
  '统计日期区间：',
  '26，11，01，>，26，11，30',
  '## 流水',
  '261109，WX，CF，35.00，餐饮，咖啡，拿铁',
  '## 节点',
  'WX，资产，网络账户，微信钱包，1000.00',
  'CF，费用，餐饮，星巴克，0.00',
].join('\n');

test('旧版导入：识别 old2 明文', () => {
  assert.equal(TV.legacy.detectLegacy(OLD2), true);
  const r = TV.legacy.importLegacy(OLD2, { vaultId: 'old2' });
  assert.equal(r.ok, true);
  assert.equal(r.stats.nodes, 4);
  assert.equal(r.stats.flows, 3);
  assert.equal(r.events.length, 5); // 3 笔 + 2 笔期初
  assert.equal(r.dict.vaultId, 'old2');
});

test('旧版导入：期初转成真实流水，余额正确', () => {
  const r = TV.legacy.importLegacy(OLD2, { vaultId: 'old2' });
  const byName = {};
  Object.keys(r.dict.nodes).forEach((id) => { byName[r.dict.nodes[id].zh_name] = id; });
  const calc = TV.calc.compute(r.dict, r.events, { range: TV.date.parseRange('全部') });
  assert.equal(calc.byId.get(byName['微信钱包']).closing, 146500);
  assert.equal(calc.byId.get(byName['交行储8380']).closing, 1450000);
  assert.equal(calc.byId.get(byName['星巴克']).closing, 3500);
  assert.equal(calc.byId.get(byName['工资卡']).closing, 1000000);
  assert.equal(calc.globalInvariant, true);
});

test('旧版导入：标签从三列备注建立层级', () => {
  const r = TV.legacy.importLegacy(OLD2, {});
  const names = Object.keys(r.dict.tags).map((id) => r.dict.tags[id].zh_name);
  for (const n of ['转账', '内部', '提现到微信', '餐饮', '咖啡', '星巴克拿铁', '收入', '工资', '本月发薪']) {
    assert.ok(names.includes(n), n);
  }
  const cat = Object.keys(r.dict.tags).find((id) => r.dict.tags[id].zh_name === '餐饮');
  const key = Object.keys(r.dict.tags).find((id) => r.dict.tags[id].zh_name === '咖啡');
  assert.equal(r.dict.tags[key].parent_id, cat);
});

test('旧版导入：old1 统计段被跳过', () => {
  assert.equal(TV.legacy.detectLegacy(OLD1), true);
  const r = TV.legacy.importLegacy(OLD1, {});
  assert.equal(r.ok, true);
  assert.equal(r.stats.flows, 1);
  assert.equal(r.events.length, 2); // 一笔期初 + 一笔流水
  const stats = TV.calc.compute(r.dict, r.events, { range: TV.date.parseRange('全部') });
  assert.equal(stats.globalInvariant, true);
});

test('旧版导入：拒绝新账本', () => {
  assert.equal(TV.legacy.detectLegacy('# TxtVein ledger\n[P] 261110 N_001 > N_002 100'), false);
  assert.equal(TV.legacy.importLegacy('# TxtVein ledger').ok, false);
});
