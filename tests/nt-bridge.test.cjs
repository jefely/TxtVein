'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const N = TV.ntBridge;

const SAMPLE = `账户：
类型，分类，简码，名称，期初，账单日，还款日，
资产类，储蓄，ZHC，招行储，100.00，，
负债类，信用，XYK，信用卡，0.00，，
收入类，工资，GZ，工资，0.00，，
费用类，日常，CY，餐饮，0.00，，
流水：
260801，ZHC，CY，35.50，午饭
260802，GZ，ZHC，1000.00，工资
`;

test('NT 明文：识别、转换、编译', () => {
  assert.equal(N.detect(SAMPLE), 'nt-text');
  const parsed = N.parseText(SAMPLE);
  assert.equal(parsed.accounts.length, 4);
  assert.equal(parsed.transactions.length, 2);
  const built = N.toTxtVein(parsed, { now: new Date(2026, 10, 16) });
  assert.equal(built.errors.length, 0, JSON.stringify(built.errors));
  assert.equal(built.events.length, 3); // 1 期初 + 2 流水
  const d = TV.source.compileDictSource(built.dictSource, { now: new Date(2026, 10, 16), system: TV.systemDict });
  assert.equal(d.ok, true, JSON.stringify(d.diagnostics.filter((x) => x.severity === 'error')));
  const l = TV.source.compileLedgerSource(built.ledgerSource, d.dict, { now: new Date(2026, 10, 16), domain: 'P' });
  assert.equal((l.errors || 0), 0, JSON.stringify((l.diagnostics || []).filter((x) => x.severity === 'error')));
  assert.equal(l.events.length, 3);
});

test('NT 明文：从 TxtVein 导出再解析', () => {
  const built = N.toTxtVein(N.parseText(SAMPLE), { now: new Date(2026, 10, 16) });
  const text = N.toNTText(built.dict, built.events);
  assert.match(text, /账户：/);
  assert.match(text, /流水：/);
  const parsed = N.parseText(text);
  assert.ok(parsed.accounts.length >= 4);
  assert.equal(parsed.transactions.length, 3); // 含期初事件
});

test('NT 加密备份：解包 + 解密 + 转 TxtVein', async () => {
  const state = {
    accounts: [
      { id: 'a1', type: '资产类', category: '现金', code: 'XJ', name: '现金', opening: 10 },
      { id: 'a2', type: '费用类', category: '日常', code: 'CY', name: '餐饮', opening: 0 },
    ],
    transactions: [
      { date: '2026-08-01', from_id: 'a1', to_id: 'a2', amount: 3.5, note: '早饭' },
    ],
  };
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', enc.encode('pw1234'), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(state))));
  const b64 = (u8) => Buffer.from(u8).toString('base64');
  const text = ['-----NT账本加密备份-----', '版本: 1', '盐: ' + b64(salt), 'IV: ' + b64(iv), '密文:', b64(cipher), '-----结束-----'].join('\n');
  assert.equal(N.detect(text), 'nt-backup');
  const out = await N.decryptBackup(text, 'pw1234');
  assert.equal(out.accounts.length, 2);
  const built = N.fromNTState(out);
  assert.equal(built.events.length, 2); // 期初 + 1 流水
  assert.equal(built.errors.length, 0, JSON.stringify(built.errors));
});
