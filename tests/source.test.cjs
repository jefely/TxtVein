'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);

const DICT = `// test dict
[ACCOUNT]
node P 资产 fluid wx wc 微信钱包 | WeChat Wallet 120 -
node P 费用 steam din din 晚餐 | Dinner 120 -
[NOTE]
tag P plain xf con 消费 | Consume 30 -
tag P plain kf coffee 咖啡 | Coffee 20 xf
[BEHAVIOR]
item P body body 身体行为 | Physical 0 -
item P mind mind 心理行为 | Mental 0 -
item P movie movie 看电影 | Watch Movie 10 body
item P happy happy 开心 | Happy 10 mind
item P din din 晚餐 | Dinner 10 -
alias wx -> N:wx
`;

function dictCompile() {
  return TV.source.compileDictSource(DICT, { vaultId: 'test', now: NOW });
}

test('字典源码：三段与行为项', () => {
  const r = dictCompile();
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(Object.keys(r.dict.nodes).length, 4); // 2 + 2 system
  assert.equal(Object.keys(r.dict.tags).length, 2);
  assert.equal(Object.keys(r.dict.behaviors).length, 5);
  assert.ok(Object.keys(r.dict.behaviors).every((id) => /^H_[0-9a-f]{8}$/.test(id)));
});

test('字典源码：双角色同 code 可分别解析', () => {
  const r = dictCompile();
  const byCode = (map, code) => Object.keys(map).find((id) => map[id].zh_code === code);
  assert.ok(byCode(r.dict.nodes, 'din'));
  assert.ok(byCode(r.dict.behaviors, 'din'));
});

test('流水源码：会计 / 行为 / 备注 / 错误 四通道', () => {
  const d = dictCompile();
  const src = [
    '[P] 261115 wx > din 120 < xf',
    '[P] 261115 movie > happy 3',
    '[P] 261115 35 < xf < kf',
    '[P] 261115 wx > nope 35',
  ].join('\n');
  const r = TV.source.compileLedgerSource(src, d.dict, { now: NOW, domain: 'P' });
  assert.equal(r.events.length, 1);
  assert.equal(r.behaviors.length, 1);
  assert.equal(r.behaviors[0].weight, 3);
  assert.equal(r.notes.length, 2);
  assert.equal(r.notes[0].kind, 'note');
  assert.equal(r.notes[0].amountCents, 3500);
  assert.ok(r.notes[0].categoryId);
  assert.ok(r.notes[0].keywordIds.length >= 1);
  assert.equal(r.notes[1].kind, 'invalid');
  assert.ok(r.diagnostics.some((x) => /nope/.test(x.message)));
});

test('流水源码：会计 + 行为混合展开为两条原子记录', () => {
  const d = dictCompile();
  const src = '[P] 261115 wx > din > happy 120 1';
  const r = TV.source.compileLedgerSource(src, d.dict, { now: NOW, domain: 'P' });
  assert.equal(r.events.length, 1);
  assert.equal(r.behaviors.length, 1);
  assert.equal(r.events[0].amountCents, 12000);
  assert.equal(r.behaviors[0].weight, 1);
  assert.equal(r.events[0].chainId, r.behaviors[0].chainId);
  assert.ok(/^E_[0-9a-f]{12}$/.test(r.events[0].id));
  assert.ok(/^B_[0-9a-f]{12}$/.test(r.behaviors[0].id));
});

test('流水源码：备注两级分类', () => {
  const d = dictCompile();
  const src = '[P] 261115 35 < xf < kf';
  const r = TV.source.compileLedgerSource(src, d.dict, { now: NOW, domain: 'P' });
  assert.equal(r.notes.length, 1);
  const n = r.notes[0];
  assert.equal(n.kind, 'note');
  assert.equal(n.amountCents, 3500);
  assert.equal(d.dict.tags[n.categoryId].zh_code, 'xf');
  assert.equal(d.dict.tags[n.keywordIds[0]].zh_code, 'kf');
});

test('字典源码往返：三段保留', () => {
  const d = dictCompile();
  const text = TV.source.dictToSource(d.dict);
  assert.ok(text.includes('[会计]'));
  assert.ok(text.includes('[备注]'));
  assert.ok(text.includes('[行为]'));
  const r2 = TV.source.compileDictSource(text, { vaultId: 'test', now: NOW });
  assert.equal(r2.ok, true, JSON.stringify(r2.diagnostics));
  assert.equal(Object.keys(r2.dict.behaviors).length, 5);
});

test('计算层忽略行为边', () => {
  const d = dictCompile();
  const src = [
    '[P] 261115 wx > din 120 < xf',
    '[P] 261115 movie > happy 3',
  ].join('\n');
  const r = TV.source.compileLedgerSource(src, d.dict, { now: NOW, domain: 'P' });
  const calc = TV.calc.compute(d.dict, r.events, { range: null });
  assert.equal(calc.unbalanced, 0);
  assert.equal(calc.flowCents, 12000);
});

test('行为项自动建：另一端已是行为项', () => {
  const dict = `[ACCOUNT]
node P 资产 fluid wx wc 微信钱包 | WeChat Wallet 120 -
node P 费用 steam din din 晚餐 | Dinner 120 -
[NOTE]
tag P plain xf con 消费 | Consume 30 -
[BEHAVIOR]
item P happy happy 开心 | Happy 10 -
`;
  const d = TV.source.compileDictSource(dict, { now: NOW });
  const r = TV.source.compileLedgerSource('[P] 261115 movie > happy 3', d.dict, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.behaviors.length, 1);
  assert.deepEqual(r.autoBehaviors.map((x) => x.code), ['movie']);
  assert.ok(Object.keys(r.dict.behaviors).length === 2);
});

test('行为项自动建：两端都未知、强度为正整数', () => {
  const dict = `[ACCOUNT]
node P 资产 fluid wx wc 微信钱包 | WeChat Wallet 120 -
[BEHAVIOR]
`;
  const d = TV.source.compileDictSource(dict, { now: NOW });
  const r = TV.source.compileLedgerSource('[P] 261115 看电影 > 开心 1', d.dict, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.behaviors.length, 1);
  assert.deepEqual(r.autoBehaviors.map((x) => x.code), ['看电影', '开心']);
  assert.equal(r.behaviors[0].weight, 1);
});

test('行为 + 会计叠加：会计节点自动补行为角色', () => {
  const dict = `[ACCOUNT]
node P 资产 fluid wx wc 微信钱包 | WeChat Wallet 120 -
node P 费用 steam din din 晚餐 | Dinner 120 -
[BEHAVIOR]
item P happy happy 开心 | Happy 10 -
`;
  const d = TV.source.compileDictSource(dict, { now: NOW });
  const r = TV.source.compileLedgerSource('[P] 261115 wx > din > happy 120 1', d.dict, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.events.length, 1);
  assert.equal(r.behaviors.length, 1);
  assert.deepEqual(r.autoBehaviors.map((x) => x.code), ['din']);
  assert.notEqual(r.events[0].from, r.behaviors[0].from); // N_din != H_din
});

test('字典文件规范化保留行为项', () => {
  const d = dictCompile();
  const norm = TV.dictFile.normalizeDict(d.dict);
  assert.equal(Object.keys(norm.behaviors).length, 5);
  assert.ok(Object.keys(norm.behaviors).every((id) => /^H_/.test(id)));
});
test('单 TXT 解析：统计/流水/行为/备注/字典', () => {
  const d = dictCompile();
  const single = [
    '## 统计', 'TXTVAIN // REPORT', '',
    '## 流水', '[P] 261115 wx > din 120', '',
    '## 行为', '[P] 261115 movie > happy 2', '',
    '## 备注', '[P] 261115 35 < xf < kf', '',
    '## 字典', TV.source.dictToSource(d.dict), '',
  ].join('\n');
  const p = TV.source.parseSingleTxt(single);
  assert.equal(p.ok, true, JSON.stringify(p));
  const r = TV.source.compileAll(p.dictSource, p.ledgerSource, { vaultId: 'single', now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.events.length, 1);
  assert.equal(r.behaviors.length, 1);
  assert.equal(r.notes.filter((n) => n.kind === 'note').length, 1);
});

test('域标记迁移：[P] 输出 P', () => {
  const src = '[P] 261115 wx > din 1\n[C] 261115 cbiz > off 1';
  const out = TV.source.normalizeDomainSyntax(src);
  assert.equal(out, '261115 wx > din 1\nC 261115 cbiz > off 1');
});

test('ID 长度：N/T/H/X 8 位，E/B 12 位', () => {
  const d = dictCompile();
  const src = '[P] 261115 wx > din > happy 120 1\n[P] 261115 35 < xf < kf\n[P] 261115 wx > nope 1';
  const r = TV.source.compileLedgerSource(src, d.dict, { now: NOW, domain: 'P' });
  const ids = []
    .concat(Object.keys(d.dict.nodes), Object.keys(d.dict.tags), Object.keys(d.dict.behaviors))
    .concat(r.events.map((x) => x.id), r.behaviors.map((x) => x.id), r.notes.map((x) => x.id));
  ids.forEach((id) => {
    if (/^[NTHX]_/.test(id) && !id.startsWith("N_sys_")) assert.match(id, /^[NTHX]_[0-9a-f]{8}$/, id);
    if (/^[EB]_/.test(id)) assert.match(id, /^[EB]_[0-9a-f]{12}$/, id);
  });
});

test('字典源码：[树] 缩进编辑父级并往返', () => {
  const src = `[树]
P 费用
  餐饮 [din]
    早餐 [zc]
[ACCOUNT]
node P 费用 steam din din 餐饮 | Dining 100 -
node P 费用 steam zc zc 早餐 | Breakfast 100 -
`;
  const r = TV.source.compileDictSource(src, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  const byCode = (code) => Object.keys(r.dict.nodes)
    .map((id) => r.dict.nodes[id]).find((x) => x.zh_code === code);
  const idOf = (code) => Object.keys(r.dict.nodes).find((id) => r.dict.nodes[id].zh_code === code);
  assert.equal(byCode('zc').parent_id, idOf('din'));
  const text = TV.source.dictToSource(r.dict);
  assert.ok(/\[树\]/.test(text));
  assert.ok(/    早餐 \[zc\]/.test(text), text);
  const r2 = TV.source.compileDictSource(text, { now: NOW });
  const byCode2 = (code) => Object.keys(r2.dict.nodes)
    .map((id) => r2.dict.nodes[id]).find((x) => x.zh_code === code);
  const idOf2 = (code) => Object.keys(r2.dict.nodes).find((id) => r2.dict.nodes[id].zh_code === code);
  assert.equal(byCode2('zc').parent_id, idOf2('din'));
});

test('字典源码：[树] 父子类型不同报错', () => {
  const src = `[树]
P 费用
  餐饮 [din]
P 资产
  现金 [xj]
    早餐 [zc]
[ACCOUNT]
node P 费用 steam din din 餐饮 | Dining 100 -
node P 资产 fluid xj xj 现金 | Cash 100 -
node P 费用 steam zc zc 早餐 | Breakfast 100 -
`;
  const r = TV.source.compileDictSource(src, { now: NOW });
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.some((x) => /父子类型不同/.test(x.message)));
});

test('简码以数字开头：58D 在节点位置优先于时间数量', () => {
  const src = `[ACCOUNT]
node P 资产 fluid GHC ghc 工行储 | ICBC 100 -
node P 负债 outside 58D 58d 58贷 | 58 Loan 100 -
`;
  const d = TV.source.compileDictSource(src, { now: NOW });
  assert.equal(d.ok, true, JSON.stringify(d.diagnostics));
  const r = TV.source.compileLedgerSource('260824 GHC > 58D 948.08\n', d.dict, { now: NOW, domain: 'P' });
  assert.equal(r.errors, 0, JSON.stringify(r.diagnostics));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].amountCents, 94808);
  assert.equal(d.dict.nodes[r.events[0].to].zh_code, '58D');
});

test('字典源码：sort 往返', () => {
  const src = `[ACCOUNT]
node P 资产 fluid wx wc 微信 | WeChat 120 - sort:10 pin
node P 费用 steam din din 晚餐 | Dinner 120 - sort:20
`;
  const r = TV.source.compileDictSource(src, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  const byCode = (code) => Object.keys(r.dict.nodes)
    .map((id) => r.dict.nodes[id]).find((x) => x.zh_code === code);
  assert.equal(byCode('wx').sort, 10);
  assert.equal(byCode('wx').pin, 1);
  assert.equal(byCode('din').sort, 20);
  const text = TV.source.dictToSource(r.dict);
  assert.ok(/sort:10/.test(text), text);
  assert.ok(/pin/.test(text), text);
  const r2 = TV.source.compileDictSource(text, { now: NOW });
  const byCode2 = (code) => Object.keys(r2.dict.nodes)
    .map((id) => r2.dict.nodes[id]).find((x) => x.zh_code === code);
  assert.equal(byCode2('wx').sort, 10);
  assert.equal(byCode2('wx').pin, 1);
  assert.equal(byCode2('din').sort, 20);
});
