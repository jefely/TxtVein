'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadTV, ROOT } = require('./helpers/load.cjs');

const TV = loadTV();
const C = TV.systemDictCore;
const S = TV.systemDict;
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'core', 'system.dict'), 'utf8');

function edit(id, fn) {
  const lines = SOURCE.split('\n');
  const i = lines.findIndex((l) => l.startsWith(id + ' | '));
  assert.ok(i >= 0, '找不到行：' + id);
  const cols = lines[i].split('|').map((x) => x.trim());
  fn(cols);
  lines[i] = cols.join(' | ');
  return lines.join('\n');
}

function inserted(line, before) {
  return SOURCE.replace('\n' + before, '\n' + line + '\n' + before);
}

function hasError(src, code) {
  const r = C.parse(src);
  return { r, hit: r.diagnostics.some((x) => x.code === code && x.severity === 'error') };
}

test('解析真实母树：ok、统计、无 error', () => {
  const r = C.parse(SOURCE);
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics.filter((x) => x.severity === 'error').slice(0, 5)));
  assert.equal(r.version, '2026.11.1');
  assert.equal(r.format, 1);
  assert.ok(r.stats.leafCount >= 140 && r.stats.leafCount <= 175);
  assert.ok(r.stats.bankCount >= 40);
  assert.equal(r.stats.maxDepth, 3);
  assert.equal(r.diagnostics.filter((x) => x.severity === 'error').length, 0);
});

test('生成物与源一致：版本 + 哈希', () => {
  const r = C.parse(SOURCE);
  const data = C.publicData(r);
  const hash = crypto.createHash('sha256').update(C.canonical(data), 'utf8').digest('hex');
  assert.equal(S.VERSION, r.version);
  assert.equal(S.HASH, hash);
  assert.equal(S.VERSION_STRING, r.version + '+' + hash.slice(0, 12));
});

test('生成物深冻结', () => {
  assert.ok(Object.isFrozen(S));
  assert.ok(Object.isFrozen(S.nodes));
  assert.ok(Object.isFrozen(S.nodes['SYS.CAT.DINING']));
  assert.ok(Object.isFrozen(S.merchants));
  assert.ok(Object.isFrozen(S.aliases));
});

test('路径、类型继承、可记账', () => {
  const nodes = C.parse(SOURCE).nodes;
  assert.equal(C.pathLabel(nodes, 'SYS.CAT.DINING.COFFEE', 'zh'), '母树 / 费用 / 餐饮 / 咖啡茶饮');
  assert.equal(C.pathLabel(nodes, 'SYS.CAT.DINING.COFFEE', 'en'), 'System / Expense / Dining / Coffee');
  assert.deepEqual(C.effectiveType(nodes, 'SYS.CAT.DINING.COFFEE'), {
    id: 'SYS.ACC.EXPENSE', type: '费用', polarity: 'A', form: 'steam', en: 'Expense',
  });
  assert.equal(C.effectiveType(nodes, 'SYS.CAT.CASH.WECHAT').type, '资产');
  assert.equal(C.effectiveType(nodes, 'SYS.CAT.CREDIT_CARD').polarity, 'B');
  assert.equal(C.isPostable(nodes, 'SYS.CAT.DINING.COFFEE'), true);
  assert.equal(C.isPostable(nodes, 'SYS.CAT.DINING'), false);
  assert.equal(C.isPostable(nodes, 'SYS.ACC.EXPENSE'), false);
  assert.equal(C.isPostable(nodes, 'SYS'), false);
  assert.equal(C.leafSet(nodes, 'SYS.CAT.DINING').size, 7);
});

test('canonical 稳定；publicData 去掉计算字段', () => {
  const a = C.parse(SOURCE);
  const b = C.parse(SOURCE);
  assert.equal(C.canonical(C.publicData(a)), C.canonical(C.publicData(b)));
  const data = C.publicData(a);
  Object.keys(data.nodes).forEach((id) => {
    assert.equal(data.nodes[id].children, undefined);
    assert.equal(data.nodes[id].depth, undefined);
    assert.equal(data.nodes[id].postable, undefined);
  });
});

test('拒绝：缺英文名', () => {
  const r = hasError(edit('SYS.CAT.DINING.COFFEE', (c) => { c[2] = ''; }), 'EN_NAME');
  assert.equal(r.hit, true, JSON.stringify(r.r.diagnostics.slice(0, 5)));
});

test('拒绝：别名重复', () => {
  const r = hasError(inserted('SYS.CAT.DINING.LUNCH | zh | 咖啡', '[Merchant]'), 'ALIAS_DUP');
  assert.equal(r.hit, true);
});

test('拒绝：父级不存在', () => {
  const r = hasError(edit('SYS.CAT.DINING', (c) => { c[3] = '@SYS.NOPE'; }), 'PARENT_MISSING');
  assert.equal(r.hit, true);
});

test('拒绝：内部节点缺 .GENERAL', () => {
  const src = SOURCE.split('\n').filter((l) => !l.startsWith('SYS.CAT.DINING.GENERAL | ')).join('\n');
  const r = hasError(src, 'GENERAL');
  assert.equal(r.hit, true);
});

test('拒绝：商户默认分类不是叶子', () => {
  const r = hasError(edit('SYS.MERCHANT.STARBUCKS', (c) => { c[3] = 'SYS.CAT.DINING'; }), 'MERCHANT_DEFAULT_LEAF');
  assert.equal(r.hit, true);
});

test('拒绝：别名语言不合法', () => {
  const r = hasError(inserted('SYS.CAT.DINING.COFFEE | fr | café', '[Merchant]'), 'ALIAS_LANG');
  assert.equal(r.hit, true);
});

test('拒绝：深度超过 3', () => {
  const line = 'SYS.CAT.DINING.COFFEE.LATTE | 拿铁 | Latte | @SYS.CAT.DINING.COFFEE | category | - | nt | latte | 10 | 1';
  const r = hasError(inserted(line, '[Alias]'), 'DEPTH');
  assert.equal(r.hit, true);
});

test('拒绝：推荐码重复', () => {
  const r = hasError(edit('SYS.CAT.DINING.LUNCH', (c) => { c[6] = 'kf'; }), 'ZH_CODE_DUP');
  assert.equal(r.hit, true);
});

test('拒绝：中文名重复', () => {
  const r = hasError(edit('SYS.CAT.DINING.LUNCH', (c) => { c[1] = '咖啡茶饮'; }), 'ZH_NAME_DUP');
  assert.equal(r.hit, true);
});

test('拒绝：建 .ZH 节点', () => {
  const line = 'SYS.CAT.DINING.COFFEE.ZH | 咖啡中文 | Coffee ZH | @SYS.CAT.DINING.COFFEE | category | - | z1 | z1 | 1 | 1';
  const r = hasError(inserted(line, '[Alias]'), 'LANG_NODE');
  assert.equal(r.hit, true);
});

test('拒绝：叶子缺推荐码', () => {
  const r = hasError(edit('SYS.CAT.DINING.COFFEE', (c) => { c[6] = '-'; }), 'LEAF_CODE');
  assert.equal(r.hit, true);
});

test('拒绝：缺版本 / format 不对', () => {
  const noVersion = SOURCE.replace(/^# version:.*$/m, '');
  assert.equal(hasError(noVersion, 'VERSION').hit, true);
  const badFormat = SOURCE.replace(/^# format:.*$/m, '# format: 2');
  assert.equal(hasError(badFormat, 'FORMAT').hit, true);
});

test('拒绝：银行储蓄分类不是叶子', () => {
  const r = hasError(edit('SYS.BANK.ICBC', (c) => { c[3] = 'SYS.CAT.BANK'; }), 'BANK_SAVINGS_LEAF');
  assert.equal(r.hit, true, JSON.stringify(r.r.diagnostics.slice(0, 5)));
});

test('拒绝：银行借贷分类不是负债', () => {
  const r = hasError(edit('SYS.BANK.ICBC', (c) => { c[4] = 'SYS.CAT.BANK.DEBIT'; }), 'BANK_CREDIT_TYPE');
  assert.equal(r.hit, true);
});

test('拒绝：银行中文名重复', () => {
  const r = hasError(edit('SYS.BANK.ABC', (c) => { c[1] = '中国工商银行'; }), 'BANK_ZH_DUP');
  assert.equal(r.hit, true);
});
