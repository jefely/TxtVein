/* TxtVein · 浏览器本地保险库
 * localStorage 里只有 { v, iterations, salt, iv, ciphertext, updatedAt }。
 * 明文 payload 只有解锁后存在于内存；密钥不可导出，刷新/锁定即消失。
 * 保存用「读-比对-写」：另一个窗口先写过就拒绝覆盖，不悄悄吞数据。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const crypto = TV.crypto;
  const envelope = TV.envelope;

  const VAULT_KEY = 'txtvein:v2:vault';
  const HINT_KEY = 'txtvein:v2:hint';
  const PAYLOAD_VERSION = 2;

  let key = null;
  let expectedCipher = '';
  let frozenError = '';
  let chain = Promise.resolve();

  function isoNow() {
    return new Date().toISOString();
  }

  function storageAvailable() {
    try {
      const k = '__tv_probe__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasVault() {
    try {
      return !!root.localStorage.getItem(VAULT_KEY);
    } catch (e) {
      return false;
    }
  }

  function readRecord() {
    try {
      const raw = root.localStorage.getItem(VAULT_KEY);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      return rec && rec.ciphertext && rec.salt && rec.iv ? rec : null;
    } catch (e) {
      return null;
    }
  }

  function writeRecord(rec) {
    try {
      root.localStorage.setItem(VAULT_KEY, JSON.stringify(rec));
    } catch (e) {
      throw new Error('本地存储写入失败（可能空间不足或被浏览器禁用）');
    }
  }

  function normalizePayload(p) {
    const o = p && typeof p === 'object' ? p : {};
    return {
      format: 'txtvein-vault',
      version: PAYLOAD_VERSION,
      ledger: String(o.ledger == null ? '' : o.ledger),
      dict: String(o.dict == null ? '' : o.dict),
      ledgerSource: String(o.ledgerSource == null ? '' : o.ledgerSource),
      dictSource: String(o.dictSource == null ? '' : o.dictSource),
      updatedAt: String(o.updatedAt || ''),
    };
  }

  function encodePayload(p) {
    return JSON.stringify(Object.assign(normalizePayload(p), { updatedAt: isoNow() }));
  }

  function decodePayload(s) {
    const o = JSON.parse(String(s || '{}'));
    return normalizePayload(o);
  }

  function isUnlocked() {
    return !!key;
  }

  function lock() {
    key = null;
    expectedCipher = '';
    frozenError = '';
  }

  function readHint() {
    try {
      return root.localStorage.getItem(HINT_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function saveHint(v) {
    try {
      const s = String(v == null ? '' : v).trim();
      if (s) root.localStorage.setItem(HINT_KEY, s);
      else root.localStorage.removeItem(HINT_KEY);
    } catch (e) { /* 提示写不进去不影响解锁 */ }
  }

  function makeRecord(salt, iv, ciphertext, iterations, old) {
    return {
      v: PAYLOAD_VERSION,
      iterations: iterations || (old && old.iterations) || crypto.PBKDF2_ITERATIONS,
      salt: crypto.bytesToBase64(salt),
      iv: crypto.bytesToBase64(iv),
      ciphertext: crypto.bytesToBase64(ciphertext),
      updatedAt: isoNow(),
    };
  }

  async function createVault(password, payload) {
    if (hasVault()) throw new Error('已经存在保险库');
    if (!password || String(password).length < 4) throw new Error('主密码至少 4 位');
    const salt = crypto.randomBytes(crypto.SALT_BYTES);
    const k = await crypto.deriveKey(password, salt, crypto.PBKDF2_ITERATIONS);
    const { iv, ciphertext } = await crypto.encryptData(k, encodePayload(payload));
    const rec = makeRecord(salt, iv, ciphertext, crypto.PBKDF2_ITERATIONS, null);
    writeRecord(rec);
    key = k;
    expectedCipher = rec.ciphertext;
    return rec;
  }

  async function unlockVault(password) {
    const rec = readRecord();
    if (!rec) return { ok: false, error: hasVault() ? '保险库记录已损坏，只能重置' : '还没有保险库' };
    try {
      const salt = crypto.base64ToBytes(rec.salt);
      const k = await crypto.deriveKey(password, salt, rec.iterations);
      const plain = await crypto.decryptData(k, crypto.base64ToBytes(rec.iv), crypto.base64ToBytes(rec.ciphertext));
      const payload = decodePayload(plain);
      key = k;
      expectedCipher = rec.ciphertext;
      frozenError = '';
      return { ok: true, payload };
    } catch (e) {
      return { ok: false, error: '密码不对，或这个保险库已损坏' };
    }
  }

  function assertWritable() {
    if (frozenError) throw new Error(frozenError);
    if (!key) throw new Error('尚未解锁，拒绝写入');
    const rec = readRecord();
    if (!rec) throw new Error('保险库不存在，请重新加载');
    if (expectedCipher && rec.ciphertext !== expectedCipher) {
      frozenError = '另一个窗口已经保存过。这次没有覆盖，请刷新后再改。';
      throw new Error(frozenError);
    }
    return rec;
  }

  async function persistNow(payload) {
    const rec = assertWritable();
    const { iv, ciphertext } = await crypto.encryptData(key, encodePayload(payload));
    const next = Object.assign({}, rec, {
      v: PAYLOAD_VERSION,
      iv: crypto.bytesToBase64(iv),
      ciphertext: crypto.bytesToBase64(ciphertext),
      updatedAt: isoNow(),
    });
    writeRecord(next);
    expectedCipher = next.ciphertext;
    return next;
  }

  function save(payload) {
    const job = chain.then(() => persistNow(payload));
    chain = job.then(() => undefined, () => undefined);
    return job;
  }

  function flush() {
    return chain;
  }

  async function changePassword(oldPassword, newPassword, payload, hint) {
    const rec = readRecord();
    if (!rec) return { ok: false, error: '还没有保险库' };
    if (expectedCipher && rec.ciphertext !== expectedCipher) {
      return { ok: false, error: '另一个窗口已经保存过，请先刷新再改密码' };
    }
    if (!newPassword || String(newPassword).length < 4) return { ok: false, error: '新密码至少 4 位' };
    try {
      const oldSalt = crypto.base64ToBytes(rec.salt);
      const oldKey = await crypto.deriveKey(oldPassword, oldSalt, rec.iterations);
      await crypto.decryptData(oldKey, crypto.base64ToBytes(rec.iv), crypto.base64ToBytes(rec.ciphertext));
    } catch (e) {
      return { ok: false, error: '旧密码不对' };
    }
    const salt = crypto.randomBytes(crypto.SALT_BYTES);
    const newKey = await crypto.deriveKey(newPassword, salt, crypto.PBKDF2_ITERATIONS);
    const { iv, ciphertext } = await crypto.encryptData(newKey, encodePayload(payload));
    const next = makeRecord(salt, iv, ciphertext, crypto.PBKDF2_ITERATIONS, rec);
    writeRecord(next);
    if (hint !== undefined) saveHint(hint);
    key = newKey;
    expectedCipher = next.ciphertext;
    frozenError = '';
    return { ok: true };
  }

  /** 用当前内存密钥加密一段文本（导出密文文件时用）。 */
  async function encryptWithCurrent(plaintext) {
    if (!key) throw new Error('尚未解锁');
    const rec = readRecord();
    if (!rec) throw new Error('保险库不存在');
    const { iv, ciphertext } = await crypto.encryptData(key, plaintext);
    return {
      salt: rec.salt,
      iterations: rec.iterations,
      iv: crypto.bytesToBase64(iv),
      ciphertext: crypto.bytesToBase64(ciphertext),
    };
  }

  function destroy() {
    try {
      root.localStorage.removeItem(VAULT_KEY);
      root.localStorage.removeItem(HINT_KEY);
    } catch (e) { /* 忽略 */ }
    lock();
  }

  TV.store = {
    VAULT_KEY,
    HINT_KEY,
    PAYLOAD_VERSION,
    storageAvailable,
    hasVault,
    readRecord,
    readHint,
    saveHint,
    normalizePayload,
    isUnlocked,
    createVault,
    unlockVault,
    save,
    flush,
    changePassword,
    encryptWithCurrent,
    lock,
    destroy,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
