'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;
const C = TV.source;
const U = TV.userDict;
const NOW = new Date(2026, 10, 16, 10, 0, 0);

const SRC = `// note one
[ACCOUNT]
node P 费用 steam kf coffee 咖啡 | Coffee 80 -
node C 费用 steam kf coffee 咖啡 | Coffee 80 -
node P 资产 fluid wx wx 微信钱包 | WeChat 100 -
node C 资产 fluid cbiz cbiz 公司公户 | Company 100 -
node P 费用 steam cof2 coffee2 咖啡二 | Coffee Two 70 @kf
[NOTE]
tag P plain xf con 消费 | Consume 30 -
tag C plain xf con 消费 | Consume 30 -
[BEHAVIOR]
item P happy happy 开心 | Happy 10 -
item C happy happy 开心 | Happy 10 -
alias shared -> N:P:kf, N:C:kf
`;

function compile(text) {
  return C.compileDictSource(text || SRC, { vaultId: 'test', now: NOW });
}

test('同域唯一：P/C 可以各有一个 kf/coffee', () => {
  const r = compile();
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  const nodes = Object.keys(r.dict.nodes).filter((id) => !id.startsWith('N_sys'));
  assert.equal(nodes.length, 5);
  assert.equal(Object.keys(r.dict.tags).length, 2);
  assert.equal(Object.keys(r.dict.behaviors).length, 2);
  assert.ok(nodes.some((id) => r.dict.nodes[id].domain === 'P' && r.dict.nodes[id].zh_code === 'kf'));
  assert.ok(nodes.some((id) => r.dict.nodes[id].domain === 'C' && r.dict.nodes[id].zh_code === 'kf'));
});

test('同域重复仍然拒绝', () => {
  const bad = SRC.replace(
    'node P 资产 fluid wx wx 微信钱包 | WeChat 100 -',
    'node P 资产 fluid wx wx 微信钱包 | WeChat 100 -\nnode P 资产 fluid wx wx 微信钱包2 | WeChat 100 -',
  );
  const r = compile(bad);
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.some((x) => /节点码重复/.test(x.message)));
});

test('resolveAlias 按域取：P 的 kf 不会变成多义', () => {
  const r = compile();
  const p = D.resolveAlias(r.dict, 'kf', { domain: 'P' });
  const c = D.resolveAlias(r.dict, 'kf', { domain: 'C' });
  assert.equal(p.ok, true);
  assert.equal(c.ok, true);
  assert.equal(r.dict.nodes[p.id].domain, 'P');
  assert.equal(r.dict.nodes[c.id].domain, 'C');
  assert.equal(D.displayCode(r.dict, p.id, 'zh'), 'kf');
  assert.equal(D.displayCode(r.dict, c.id, 'zh'), 'kf');
});

test('resolveAlias 不跨域猜：P 里找 C-only 的 cbiz 返回 UNBOUND', () => {
  const r = compile();
  const miss = D.resolveAlias(r.dict, 'cbiz', { domain: 'P' });
  assert.equal(miss.ok, false);
  assert.equal(miss.code, 'UNBOUND');
  assert.equal(miss.crossDomain, true);
  const ok = D.resolveAlias(r.dict, 'cbiz', { domain: 'C' });
  assert.equal(ok.ok, true);
});

test('resolveTag 按域过滤', () => {
  const r = compile();
  const p = D.resolveTag(r.dict, 'xf', { domain: 'P' });
  const c = D.resolveTag(r.dict, 'xf', { domain: 'C' });
  assert.equal(p.ok, true);
  assert.equal(c.ok, true);
  assert.equal(r.dict.tags[p.id].domain, 'P');
  assert.equal(r.dict.tags[c.id].domain, 'C');
  const miss = D.resolveTag(r.dict, 'xf', { domain: 'H' });
  assert.equal(miss.ok, false);
});

test('dictToSource 跨域同码时写 N:P: / N:C: 限定', () => {
  const r = compile();
  const text = C.dictToSource(r.dict);
  assert.ok(/alias shared -> N:P:kf, N:C:kf/.test(text), text);
});

test('拆分/合并往返：ID、域、父级、别名保持一致', () => {
  const r = compile();
  const text = C.dictToSource(r.dict);
  const s = U.split(text);
  assert.equal(s.ok, true, JSON.stringify(s.diagnostics));
  assert.ok(s.p.indexOf('user_p.dict') >= 0);
  assert.ok(s.c.indexOf('user_c.dict') >= 0);
  assert.ok(!/node C /.test(s.p), 'P 文件不应有 C 节点');
  assert.ok(!/node P /.test(s.c), 'C 文件不应有 P 节点');
  const m = U.merge(s.p, s.c);
  assert.equal(m.ok, true, JSON.stringify(m.diagnostics));
  const r2 = C.compileDictSource(m.source, { vaultId: 'test', now: NOW });
  assert.equal(r2.ok, true, JSON.stringify(r2.diagnostics));
  const strip = (dict) => Object.keys(dict.nodes).filter((id) => !id.startsWith('N_sys')).map((id) => ({
    domain: dict.nodes[id].domain,
    zh_code: dict.nodes[id].zh_code,
    en_code: dict.nodes[id].en_code,
    parent_id: dict.nodes[id].parent_id ? dict.nodes[dict.nodes[id].parent_id].zh_code : '',
  })).sort((a, b) => (a.domain + a.zh_code).localeCompare(b.domain + b.zh_code));
  assert.deepEqual(strip(r2.dict), strip(r.dict));
});

test('拆分：树段缩进写入 P 侧父码', () => {
  const src = `[树]
P 费用
  餐饮 [din]
    早餐 [zc]
[会计]
node P 费用 steam din din 餐饮 | Dining 100 -
node P 费用 steam zc zc 早餐 | Breakfast 100 -
`;
  const s = TV.userDict.split(src);
  assert.equal(s.ok, true, JSON.stringify(s.diagnostics));
  assert.ok(!/\[树\]/.test(s.p));
  const m = TV.userDict.merge(s.p, s.c);
  assert.equal(m.ok, true, JSON.stringify(m.diagnostics));
  const r = TV.source.compileDictSource(m.source, { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  const byCode = (code) => Object.keys(r.dict.nodes).find((id) => r.dict.nodes[id].zh_code === code);
  assert.equal(r.dict.nodes[byCode('zc')].parent_id, byCode('din'));
});

test('拆分：未限定域的同码别名报错', () => {
  const bad = SRC.replace('alias shared -> N:P:kf, N:C:kf', 'alias shared -> N:kf');
  const s = U.split(bad);
  assert.equal(s.ok, false);
  assert.ok(s.diagnostics.some((x) => x.code === 'ALIAS_DOMAIN'), JSON.stringify(s.diagnostics));
});

test('拆分：父码跨域报错', () => {
  const bad = SRC.replace('@kf', '@cbiz');
  const s = U.split(bad);
  assert.equal(s.ok, false);
  assert.ok(s.diagnostics.some((x) => x.code === 'PARENT_DOMAIN' || x.code === 'PARENT_MISSING'), JSON.stringify(s.diagnostics));
});

test('checkSide/merge：P 文件不能有 C 域', () => {
  const bad = '// TxtVein user_p.dict\n[ACCOUNT]\nnode C 费用 steam off off 办公费 | Office 50 -\n';
  const s = U.checkSide(bad, 'P');
  assert.equal(s.ok, false);
  const m = U.merge(bad, '');
  assert.equal(m.ok, false);
});

test('注释只存一份：合并再拆分不会翻倍', () => {
  const s = U.split(SRC);
  const m = U.merge(s.p, s.c);
  const s2 = U.split(m.source);
  const count = (text) => (text.match(/\/\/ note one/g) || []).length;
  assert.equal(count(s.p), 1);
  assert.equal(count(s.c), 0);
  assert.equal(count(s2.p), 1);
});

test('store v3：P/C + systemVersion；v2 只读兼容', () => {
  assert.equal(TV.store.PAYLOAD_VERSION, 3);
  const v3 = TV.store.normalizePayload({
    version: 3, vaultId: 'v', ledgerSource: 'l',
    dictSourceP: 'p', dictSourceC: 'c', systemVersion: 's',
  });
  assert.equal(v3.version, 3);
  assert.equal(v3.dictSourceP, 'p');
  assert.equal(v3.dictSourceC, 'c');
  assert.equal(v3.systemVersion, 's');
  assert.equal(v3.ledger, undefined);
  assert.equal(v3.dict, undefined);

  const v2 = TV.store.normalizePayload({
    version: 2, vaultId: 'v', ledger: 'L', dict: 'D', ledgerSource: 'l', dictSource: 'd',
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.ledger, 'L');
  assert.equal(v2.dict, 'D');
  assert.equal(v2.dictSource, 'd');
});
