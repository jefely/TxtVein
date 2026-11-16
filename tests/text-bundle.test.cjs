'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const B = TV.textBundle;

test('bundle：多文件打包/解包', () => {
  const text = B.pack([
    { name: 'ledger.enc', text: '# [SECURE_START: P, AES-GCM-256]\nABC\n# [SECURE_END]\n' },
    { name: 'dict.enc', text: '# [SECURE_START: P, AES-GCM-256]\nDEF\n# [SECURE_END]\n' },
  ], { mode: 'deep' });
  assert.equal(B.isBundle(text), true);
  const r = B.unpack(text);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'deep');
  assert.deepEqual(r.files.map((x) => x.name), ['ledger.enc', 'dict.enc']);
  assert.ok(r.files[0].text.includes('ABC'));
});

test('bundle：普通 # 注释不受影响', () => {
  const text = B.pack([{ name: 'ledger.shadow', text: '// # 不是块标记\n261116 wx > din 35\n' }]);
  const r = B.unpack(text);
  assert.equal(r.ok, true);
  assert.ok(r.files[0].text.includes('不是块标记'));
});

test('bundle：缺结尾报错', () => {
  const text = '# [TXTVEIN_BUNDLE: 1]\n# [FILE: x]\nabc\n';
  const r = B.unpack(text);
  assert.equal(r.ok, false);
  assert.match(r.error, /文件块没有/);
});
