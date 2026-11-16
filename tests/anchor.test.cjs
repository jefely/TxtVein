'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;
const A = TV.anchor;
const NOW = new Date(2026, 10, 16, 10, 0, 0);

function mini() {
  const d = D.emptyDict('test', NOW);
  const a = D.addNode(d, { zh_name: '咖啡', zh_code: 'cof', en_name: 'Coffee', en_code: 'coffee', type: '费用', domain: 'P' });
  const b = D.addNode(d, { zh_name: '工资', zh_code: 'gz', en_name: 'Salary', en_code: 'salary', type: '收入', domain: 'P' });
  return { d, a: a.id, b: b.id };
}

test('锚点：挂到母树叶子并继承类型/极性', () => {
  const { d, a } = mini();
  const r = A.set(d, a, 'SYS.CAT.DINING.COFFEE', TV.systemDict, { hasHistory: false });
  assert.equal(r.ok, true, r.error);
  assert.equal(d.nodes[a].anchor_id, 'SYS.CAT.DINING.COFFEE');
  assert.equal(d.nodes[a].type, '费用');
  assert.equal(d.nodes[a].polarity, 'A');
});

test('锚点：内部节点/用户 ID 拒绝', () => {
  const { d, a } = mini();
  const r = A.set(d, a, 'SYS.CAT.DINING', TV.systemDict, { hasHistory: false });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ANCHOR_NOT_LEAF');
  const r2 = A.set(d, a, a, TV.systemDict, { hasHistory: false });
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'ANCHOR_UNKNOWN');
});

test('锚点：有历史时翻转极性拒绝；无历史允许', () => {
  const { d, a } = mini();
  const r = A.set(d, a, 'SYS.CAT.SALARY', TV.systemDict, { hasHistory: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ANCHOR_POLARITY');
  assert.equal(d.nodes[a].anchor_id, undefined);
  const r2 = A.set(d, a, 'SYS.CAT.SALARY', TV.systemDict, { hasHistory: false });
  assert.equal(r2.ok, true);
  assert.equal(d.nodes[a].type, '收入');
  assert.equal(d.nodes[a].polarity, 'B');
});

test('锚点：清空保留当前类型', () => {
  const { d, a } = mini();
  A.set(d, a, 'SYS.CAT.DINING.COFFEE', TV.systemDict, { hasHistory: false });
  A.clear(d, a);
  assert.equal(d.nodes[a].anchor_id, undefined);
  assert.equal(d.nodes[a].type, '费用');
});

test('锚点：validate 发现失效/极性冲突', () => {
  const { d, a } = mini();
  d.nodes[a].anchor_id = 'SYS.CAT.NOPE';
  let issues = A.validate(d, TV.systemDict);
  assert.ok(issues.some((x) => x.code === 'ANCHOR_UNKNOWN'));
  d.nodes[a].anchor_id = 'SYS.CAT.SALARY';
  issues = A.validate(d, TV.systemDict);
  assert.ok(issues.some((x) => x.code === 'ANCHOR_POLARITY'));
});

test('源码：^SYS 挂锚点并继承；@SYS 兼容读', () => {
  const src = `[ACCOUNT]
node P 费用 steam cof cof 咖啡 | Coffee 80 - ^SYS.CAT.DINING.COFFEE
node P 费用 steam din din 晚餐 | Dinner 80 - @SYS.CAT.DINING.COFFEE
`;
  const r = TV.source.compileDictSource(src, { now: NOW, system: TV.systemDict });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics.filter((x) => x.severity === 'error')));
  const nodes = Object.keys(r.dict.nodes).map((id) => r.dict.nodes[id]).filter((n) => !n.system);
  assert.equal(nodes.length, 2);
  nodes.forEach((n) => {
    assert.equal(n.anchor_id, 'SYS.CAT.DINING.COFFEE');
    assert.equal(n.type, '费用');
  });
  const text = TV.source.dictToSource(r.dict);
  assert.ok(/\^SYS\.CAT\.DINING\.COFFEE/.test(text), text);
  const r2 = TV.source.compileDictSource(text, { now: NOW, system: TV.systemDict });
  assert.equal(r2.ok, true);
  assert.equal(Object.keys(r2.dict.nodes).filter((id) => r2.dict.nodes[id].anchor_id).length, 2);
});

test('源码：锚点极性冲突报错，不静默翻转', () => {
  const src = `[ACCOUNT]
node P 费用 steam cof cof 咖啡 | Coffee 80 - ^SYS.CAT.SALARY
`;
  const r = TV.source.compileDictSource(src, { now: NOW, system: TV.systemDict });
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.some((x) => /冲突/.test(x.message)));
});

test('源码：失效锚点保留并警告', () => {
  const src = `[ACCOUNT]
node P 费用 steam cof cof 咖啡 | Coffee 80 - ^SYS.CAT.NOPE
`;
  const r = TV.source.compileDictSource(src, { now: NOW, system: TV.systemDict });
  assert.equal(r.ok, true);
  const n = Object.keys(r.dict.nodes).map((id) => r.dict.nodes[id]).find((x) => x.zh_code === 'cof');
  assert.equal(n.anchor_id, 'SYS.CAT.NOPE');
  assert.ok(r.diagnostics.some((x) => x.severity === 'warn' && /失效锚点/.test(x.message)));
});
