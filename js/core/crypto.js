/* TxtVein · 加密层
 * PBKDF2-SHA-256 150,000 → AES-GCM-256；盐 16B、IV 12B，每次加密换新 IV。
 * 密钥只在内存（不可导出）；本模块不碰浏览器存储、不碰 DOM。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  const PBKDF2_ITERATIONS = 150000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const KEY_BITS = 256;

  function webcrypto() {
    const c = root.crypto;
    if (!c || !c.subtle) throw new Error('当前环境不支持 WebCrypto（请用 Chrome/Edge，或 Node 18+）');
    return c;
  }

  function supportsCrypto() {
    return !!(root.crypto && root.crypto.subtle && root.crypto.getRandomValues);
  }

  function randomBytes(n) {
    const len = Math.max(1, Number(n) || 1);
    const out = new Uint8Array(len);
    webcrypto().getRandomValues(out);
    return out;
  }

  function randomHex(bytes) {
    const arr = randomBytes(bytes || 4);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomVaultId() {
    return randomHex(4);
  }

  function bytesToBase64(bytes) {
    const arr = new Uint8Array(bytes);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) {
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
    }
    if (typeof root.btoa === 'function') return root.btoa(bin);
    if (typeof Buffer !== 'undefined') return Buffer.from(arr).toString('base64');
    throw new Error('当前环境没有 base64 编码器');
  }

  function base64ToBytes(str) {
    const s = String(str == null ? '' : str).replace(/\s+/g, '');
    if (!s) return new Uint8Array(0);
    if (typeof root.atob === 'function') {
      const bin = root.atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
    throw new Error('当前环境没有 base64 解码器');
  }

  function hexToBytes(hex) {
    const s = String(hex || '').replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(Math.floor(s.length / 2));
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function sha256Hex(str) {
    const data = new TextEncoder().encode(String(str == null ? '' : str));
    const buf = await webcrypto().subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(buf));
  }

  async function deriveKey(password, salt, iterations) {
    if (!password) throw new Error('密码不能为空');
    if (!salt || !salt.byteLength) throw new Error('盐不能为空');
    const iter = Number(iterations) || PBKDF2_ITERATIONS;
    const material = await webcrypto().subtle.importKey(
      'raw', new TextEncoder().encode(String(password)),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return webcrypto().subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: KEY_BITS },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptData(key, plaintext) {
    if (!key) throw new Error('没有密钥');
    const iv = randomBytes(IV_BYTES);
    const buf = await webcrypto().subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(String(plaintext == null ? '' : plaintext))
    );
    return { iv, ciphertext: new Uint8Array(buf) };
  }

  async function decryptData(key, iv, ciphertext) {
    if (!key) throw new Error('没有密钥');
    if (!iv || !iv.byteLength) throw new Error('IV 不能为空');
    const buf = await webcrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(buf);
  }

  async function sealText(password, plaintext, salt, iterations) {
    const useSalt = salt || randomBytes(SALT_BYTES);
    const key = await deriveKey(password, useSalt, iterations || PBKDF2_ITERATIONS);
    const { iv, ciphertext } = await encryptData(key, plaintext);
    return {
      salt: bytesToBase64(useSalt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
      iterations: iterations || PBKDF2_ITERATIONS,
    };
  }

  async function openText(password, parts) {
    const key = await deriveKey(password, base64ToBytes(parts.salt), parts.iterations || PBKDF2_ITERATIONS);
    return decryptData(key, base64ToBytes(parts.iv), base64ToBytes(parts.ciphertext));
  }

  TV.crypto = {
    PBKDF2_ITERATIONS,
    SALT_BYTES,
    IV_BYTES,
    KEY_BITS,
    supportsCrypto,
    randomBytes,
    randomHex,
    randomVaultId,
    bytesToBase64,
    base64ToBytes,
    bytesToHex,
    hexToBytes,
    sha256Hex,
    deriveKey,
    encryptData,
    decryptData,
    sealText,
    openText,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.crypto;
})(typeof globalThis !== 'undefined' ? globalThis : this);
