'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;

function mk() {
  const d = D.emptyDict('test0001');
  const a = D.addNode(d, {
    zh_name: '微信钱包', en_name: 'WeChat Wallet', zh_code: 'wx', en_code: 'wc',
    type: '资产', domain: 'P', weight: 100,
  });
  const b = D.addNode(d, {
    zh_name: '餐饮', en_name: 'Dining', zh_code: 'cy', en_code: 'din',
    type: '费用', domain: 'P', weight: 80,
  });
  const c = D.addNode(d, {
    zh_name: '维修费', en_name: 'Repair', zh_code: 'wx', en_code: 'rep',
    type: '费用', domain: 'P', weight: 10,
  });
  return { d, a, b, c };
}

test('字典：空字典与节点分配', () => {
  const { d, a, b } = mk();
  assert.equal(a.id, 'N_001');
  assert.equal(b.id, 'N_002');
  assert.equal(d.nodes.N_001.polarity, 'A');
  assert.equal(d.nodes.N_002.type, '费用');
  assert.equal(d.nodes.N_002.form, 'steam');
  assert.equal(d.meta.nextNode, 4);
});

test('字典：六类 → 极性', () => {
  assert.equal(D.normalizeType('资产').pole, 'A');
  assert.equal(D.normalizeType('费用').pole, 'A');
  assert.equal(D.normalizeType('成本').pole, 'A');
  assert.equal(D.normalizeType('负债').pole, 'B');
  assert.equal(D.normalizeType('收入').pole, 'B');
  assert.equal(D.normalizeType('权益').pole, 'B');
  assert.equal(D.normalizeType('Asset').type, '资产');
  assert.equal(D.normalizeType('费用类').type, '费用');
  assert.equal(D.normalizeType('乱写').ok, false);
});

test('字典：冲突简码产生多义候选', () => {
  const { d } = mk();
  assert.deepEqual(d.aliases.wx, ['N_001', 'N_003']);
  const r = D.resolveAlias(d, 'wx', { domain: 'P' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AMBIGUOUS');
  assert.equal(r.candidates.length, 2);
  assert.equal(r.candidates[0].id, 'N_001'); // weight 更高
});

test('字典：pin 优先于 weight；bump 只加 uses 不改 weight', () => {
  const { d } = mk();
  D.updateNode(d, 'N_003', { pin: 1 });
  const r = D.resolveAlias(d, 'wx', { domain: 'P' });
  assert.equal(r.candidates[0].id, 'N_003');
  const before = d.nodes.N_002.weight;
  D.bumpWeight(d, 'N_002', 1);
  assert.equal(d.nodes.N_002.weight, before);
  assert.equal(d.nodes.N_002.uses, 1);
  assert.ok(d.nodes.N_002.lastUsed);
});

test('字典：数字后缀固化并写入别名', () => {
  const { d } = mk();
  const r = D.resolveAlias(d, 'wx2', { domain: 'P' });
  assert.equal(r.ok, true);
  assert.equal(r.id, 'N_003');
  assert.equal(r.via, 'suffix');
  assert.deepEqual(d.aliases.wx2, ['N_003']);
  const again = D.resolveAlias(d, 'wx2', {});
  assert.equal(again.via, 'alias');
});

test('字典：唯一简码 / 前缀 / 未命中 / 强制', () => {
  const { d } = mk();
  assert.equal(D.resolveAlias(d, 'cy', {}).id, 'N_002');
  assert.equal(D.resolveAlias(d, 'ca', {}).ok, false); // 前缀 cy 只有一个时才命中；ca 不命中
  assert.equal(D.resolveAlias(d, 'nope', {}).code, 'UNBOUND');
  assert.equal(D.resolveAlias(d, '!wx', {}).ok, true); // 强制取最高权重
});

test('字典：标签树与祖先路径', () => {
  const d = D.emptyDict('t');
  const root = D.addTag(d, { zh_name: '消费', zh_code: 'xf', domain: 'P' });
  const child = D.addTag(d, { zh_name: '咖啡', zh_code: 'cof', domain: 'P', parent_id: root.id });
  const leaf = D.addTag(d, { zh_name: '拿铁', zh_code: 'lat', domain: 'P', parent_id: root.id });
  assert.equal(child.tag.parent_id, root.id);
  assert.equal(leaf.tag.parent_id, root.id);
  assert.deepEqual(D.getAncestorPath(d, child.id).map((x) => x.id), [child.id, root.id]);
  assert.equal(D.pathLabel(d, child.id), '消费 / 咖啡');
  assert.equal(D.tagKindOf('增益'), 'gain');
  assert.equal(D.tagKindOf('阻抑'), 'suppress');
});

test('字典：ensureTag 自动创建、重复复用', () => {
  const d = D.emptyDict('t');
  const a = D.ensureTag(d, '咖啡', { domain: 'P' });
  assert.equal(a.created, true);
  const b = D.ensureTag(d, '咖啡', { domain: 'P' });
  assert.equal(b.created, false);
  assert.equal(a.id, b.id);
});

test('字典：改名只改字典，ID 不变', () => {
  const { d } = mk();
  const before = d.nodes.N_001;
  const r = D.updateNode(d, 'N_001', { zh_name: '微信零钱' });
  assert.equal(r.ok, true);
  assert.equal(d.nodes.N_001.zh_name, '微信零钱');
  assert.equal(d.nodes.N_001.zh_code, before.zh_code);
  assert.equal(D.renderNode(d, 'N_001', 'PLAIN', 'zh'), '微信零钱');
  assert.equal(D.renderNode(d, 'N_001', 'CODE', 'zh'), 'wx1');
  assert.equal(D.renderNode(d, 'N_003', 'CODE', 'zh'), 'wx2');
  assert.equal(D.renderNode(d, 'N_001', 'PLAIN', 'en'), 'WeChat Wallet');
});

test('字典：四态渲染', () => {
  const { d } = mk();
  assert.equal(D.renderNode(d, 'N_002', 'CODE', 'zh'), 'cy');
  assert.equal(D.renderNode(d, 'N_002', 'CODE', 'en'), 'din');
  assert.equal(D.renderNode(d, 'N_002', 'PLAIN', 'zh'), '餐饮');
  assert.equal(D.renderNode(d, 'N_002', 'PLAIN', 'en'), 'Dining');
});

test('字典：校验能抓出极性与大类不一致', () => {
  const { d } = mk();
  d.nodes.N_001.polarity = 'B';
  const v = D.validateDict(d);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((x) => x.code === 'NODE_POLARITY'));
});

test('字典：搜索与同级', () => {
  const { d } = mk();
  const s = D.searchNodes(d, 'wx', { domain: 'P' });
  assert.equal(s.length, 2);
  assert.equal(s[0].id, 'N_001');
  assert.ok(Array.isArray(D.getSiblingNodes(d, 'N_001')));
});
