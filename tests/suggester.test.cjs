'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;
const SG = TV.suggester;

test('建议器：名称命中母树叶子', () => {
  const r = SG.suggestForSpec(null, { zh_name: '咖啡', en_name: 'Coffee' }, TV.systemDict, { limit: 5 });
  assert.ok(r.some((x) => x.id === 'SYS.CAT.DINING.COFFEE'), JSON.stringify(r));
  assert.ok(r[0].path);
});

test('建议器：商户默认分类命中', () => {
  const r = SG.suggestForToken('星巴克', TV.systemDict, { limit: 5 });
  assert.ok(r.some((x) => x.id === 'SYS.CAT.DINING.COFFEE'), JSON.stringify(r));
});

test('建议器：极性过滤，资产不会建议收入叶子', () => {
  const r = SG.suggestForSpec(null, { zh_name: '工资', type: '资产' }, TV.systemDict, { limit: 8 });
  assert.ok(!r.some((x) => x.id === 'SYS.CAT.SALARY'), JSON.stringify(r));
});

test('建议器：已有锚点排第一', () => {
  const r = SG.suggestForSpec(null, {
    zh_name: '咖啡', type: '费用', anchor_id: 'SYS.CAT.DINING.COFFEE',
  }, TV.systemDict, { limit: 5 });
  assert.equal(r[0].id, 'SYS.CAT.DINING.COFFEE');
  assert.ok(r[0].score >= 1000);
});

test('建议器：只读，不改字典', () => {
  const d = D.emptyDict('test', new Date(2026, 10, 16));
  const n = D.addNode(d, { zh_name: '咖啡', zh_code: 'cof', type: '费用', domain: 'P' });
  const before = JSON.stringify(d);
  const r = SG.suggestForNode(d, n.id, TV.systemDict, { limit: 5 });
  assert.ok(r.length > 0);
  assert.equal(JSON.stringify(d), before);
});
