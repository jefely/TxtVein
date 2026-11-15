'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const C = TV.crypto;
const E = TV.envelope;
const NOW = new Date(2026, 10, 15, 10, 0, 0);
const EX = TV.example.createExample('test0001', NOW);

test('加密：SHA-256 已知向量', async () => {
  assert.equal(
    await C.sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('加密：sealText / openText 往返', async () => {
  const sealed = await C.sealText('pw1234', 'hello 文脉');
  assert.equal(C.base64ToBytes(sealed.salt).length, 16);
  assert.equal(C.base64ToBytes(sealed.iv).length, 12);
  const plain = await C.openText('pw1234', sealed);
  assert.equal(plain, 'hello 文脉');
});

test('加密：错误密码被 AES-GCM 拒绝', async () => {
  const sealed = await C.sealText('pw1234', 'secret');
  await assert.rejects(() => C.openText('wrong', sealed));
});

test('装甲：packSecure / extractSecure 往返', async () => {
  const sealed = await C.sealText('pw1234', 'ledger body', null, 150000);
  const txt = E.packSecure('ledger', {
    vaultId: 'abcd1234', iterations: sealed.iterations,
    salt: sealed.salt, iv: sealed.iv,
  }, sealed.ciphertext, { domain: 'P', updatedAt: '2026-11-15' });
  assert.ok(txt.includes('# [SECURE_START: P, AES-GCM-256]'));
  assert.ok(txt.includes('# [SECURE_END]'));
  const pair = E.extractSecure(txt);
  assert.equal(pair.kind, 'ledger');
  assert.equal(pair.vaultId, 'abcd1234');
  const plain = await C.openText('pw1234', pair);
  assert.equal(plain, 'ledger body');
});

test('装甲：缺结束标记被报为截断', () => {
  const txt = '# [SECURE_START: P, AES-GCM-256]\nAAAA\n';
  assert.throws(() => E.extractSecure(txt), /截断/);
});

test('装甲：污染字符被拒绝', () => {
  const txt = '# [SECURE_START: P, AES-GCM-256]\nAA!A\n# [SECURE_END]\n';
  assert.throws(() => E.extractSecure(txt), /Base64/);
});

test('装甲：旁边有日记也能提取', async () => {
  const sealed = await C.sealText('pw1234', 'x');
  const txt = '今天记一笔\n' + E.packSecure('dict', {
    vaultId: 'x', iterations: sealed.iterations, salt: sealed.salt, iv: sealed.iv,
  }, sealed.ciphertext) + '\n后面还有字\n';
  const pair = E.extractSecure(txt);
  assert.equal(pair.kind, 'dict');
  assert.equal(await C.openText('pw1234', pair), 'x');
});

test('互锁：字典哈希 → 流水 LINK；流水哈希 → 字典 LINK', async () => {
  const dict = JSON.parse(JSON.stringify(EX.dict));
  dict.meta.updatedAt = '2026-11-15T00:00:00.000Z';
  const dictBody = TV.dictFile.bodyForHash(dict);
  const dictHash = await C.sha256Hex(dictBody);

  let ledger = TV.ledgerFile.serializeLedger({
    vaultId: 'test0001', link: dictHash, events: EX.events, plans: EX.plans, rules: EX.rules,
  });
  const ledgerHash = await C.sha256Hex(TV.ledgerFile.bodyForHash(ledger));
  dict.link = ledgerHash;
  const dictText = TV.dictFile.serializeDict(dict);
  ledger = TV.ledgerFile.setLink(ledger, dictHash);

  assert.equal(TV.ledgerFile.getLink(ledger), dictHash);
  assert.equal(TV.dictFile.getLink(dictText), ledgerHash);
  assert.equal(await C.sha256Hex(TV.ledgerFile.bodyForHash(ledger)), ledgerHash);
  assert.equal(await C.sha256Hex(TV.dictFile.bodyForHash(JSON.parse(dictText))), dictHash);
});

test('加密：Node 环境支持 WebCrypto', () => {
  assert.equal(C.supportsCrypto(), true);
  assert.match(C.randomVaultId(), /^[0-9a-f]{8}$/);
});
