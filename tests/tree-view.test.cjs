'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;

function small() {
  const d = D.emptyDict('test', new Date(2026, 10, 16));
  D.addNode(d, { zh_name: '现金', zh_code: 'xj', en_name: 'Cash', en_code: 'cash', type: '资产', domain: 'P', sort: 30 });
  D.addNode(d, { zh_name: '微信', zh_code: 'wx', en_name: 'WeChat', en_code: 'wechat', type: '资产', domain: 'P', sort: 10 });
  D.addNode(d, { zh_name: '支付宝', zh_code: 'zfb', en_name: 'Alipay', en_code: 'alipay', type: '资产', domain: 'P', sort: 20 });
  const parent = D.addNode(d, { zh_name: '餐饮', zh_code: 'din', en_name: 'Dining', en_code: 'dining', type: '费用', domain: 'P', sort: 10 });
  D.addNode(d, { zh_name: '早餐', zh_code: 'zc', en_name: 'Breakfast', en_code: 'breakfast', type: '费用', domain: 'P', parent_id: parent.id, sort: 10 });
  D.addNode(d, { zh_name: '晚餐', zh_code: 'wc', en_name: 'Dinner', en_code: 'dinner', type: '费用', domain: 'P', parent_id: parent.id, sort: 20 });
  return d;
}

test('私人树：按会计类型分块，不混类型', () => {
  const t = TV.treeView.build(small());
  assert.deepEqual(t.blocks.map((b) => b.type), ['资产', '费用']);
  assert.equal(t.blocks[0].count, 3);
  assert.equal(t.blocks[1].count, 3);
  const asset = t.blocks[0];
  const flat = TV.treeView.flatten(asset);
  assert.deepEqual(flat.map((x) => x.node.zh_name), ['微信', '支付宝', '现金']);
});

test('私人树：sort 升序优先于 weight/名字', () => {
  const t = TV.treeView.build(small());
  const asset = t.blocks.find((b) => b.type === '资产');
  assert.deepEqual(TV.treeView.flatten(asset).map((x) => x.node.zh_code), ['wx', 'zfb', 'xj']);
});

test('私人树：parent_id 形成嵌套，flatten 有 depth', () => {
  const t = TV.treeView.build(small());
  const fee = t.blocks.find((b) => b.type === '费用');
  const flat = TV.treeView.flatten(fee);
  assert.equal(flat[0].node.zh_name, '餐饮');
  assert.equal(flat[0].depth, 0);
  assert.deepEqual(flat.filter((x) => x.depth === 1).map((x) => x.node.zh_name), ['早餐', '晚餐']);
});

test('私人树：默认排除 system 节点，总数正确', () => {
  const d = small();
  D.addNode(d, { zh_name: '期初', zh_code: 'qc', en_name: 'Opening', en_code: 'opening', type: '权益', domain: 'P', system: true });
  const t = TV.treeView.build(d);
  assert.equal(t.total, 6);
  assert.ok(!t.blocks.some((b) => b.type === '权益'));
});

test('私人树：空字典返回空块', () => {
  const t = TV.treeView.build(D.emptyDict('x'));
  assert.deepEqual(t.blocks, []);
  assert.equal(t.total, 0);
});
