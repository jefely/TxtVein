/* TxtVein · 文件装甲（ASCII armor）
 * 加密后的 Base64 不是裸奔的，而是有起止标记、可被清洗、可被截断检测：
 *
 *   # TxtVein ledger (encrypted)
 *   # FORMAT: 1
 *   # VAULT_ID: 8a2b1c3d
 *   # KIND: ledger
 *   # CIPHER: AES-GCM-256
 *   # ITER: 150000
 *   # SALT: ...
 *   # IV: ...
 *   # [SECURE_START: P, AES-GCM-256]
 *   U2FsdGVkX1+...
 *   # [SECURE_END]
 *
 * 解析器只认起止标记之间的 Base64；旁边的日记、空行、BOM 全部忽略。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);
  const crypto = TV.crypto || (typeof require === 'function' ? require('./crypto.js') : null);

  const BEGIN_RE = /^#\s*\[SECURE_START:\s*([A-Za-z0-9_-]+)\s*,\s*([A-Za-z0-9-]+)\s*\]\s*$/i;
  const END_RE = /^#\s*\[SECURE_END\]\s*$/i;

  function wrap64(b64) {
    const s = S(b64);
    const out = [];
    for (let i = 0; i < s.length; i += 64) out.push(s.slice(i, i + 64));
    return out.join('\n');
  }

  function packSecure(kind, parts, ciphertextB64, opts) {
    const p = parts || {};
    const o = opts || {};
    const domain = o.domain || 'P';
    const algorithm = o.algorithm || 'AES-GCM-256';
    const lines = [
      '# TxtVein ' + kind + ' (encrypted)',
      '# FORMAT: 1',
      '# VAULT_ID: ' + S(p.vaultId),
      '# KIND: ' + kind,
      '# CIPHER: ' + algorithm,
      '# ITER: ' + (Number(p.iterations) || crypto.PBKDF2_ITERATIONS),
      '# SALT: ' + S(p.salt),
      '# IV: ' + S(p.iv),
    ];
    if (o.updatedAt) lines.push('# TIME: ' + o.updatedAt);
    lines.push('# [SECURE_START: ' + domain + ', ' + algorithm + ']');
    lines.push(wrap64(ciphertextB64));
    lines.push('# [SECURE_END]');
    return lines.join('\n') + '\n';
  }

  function parseHeader(lines) {
    const h = {};
    lines.forEach((line) => {
      const m = S(line).match(/^#\s*([A-Za-z_]+)\s*:\s*(.*)$/);
      if (m) h[m[1].toUpperCase()] = m[2].trim();
    });
    return h;
  }

  function extractSecure(src) {
    const raw = text.normalize(src);
    const lines = raw.split('\n');
    let begin = -1;
    let end = -1;
    let domain = '';
    let algorithm = '';
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].trim().match(BEGIN_RE);
      if (m) {
        if (begin >= 0) throw new Error('文件里有多个密文块，无法确定用哪一个');
        begin = i;
        domain = m[1];
        algorithm = m[2];
        continue;
      }
      if (END_RE.test(lines[i].trim())) {
        if (begin >= 0) { end = i; break; }
        throw new Error('[SECURE_END] 出现在 [SECURE_START] 之前');
      }
    }
    if (begin < 0) throw new Error('没有找到 [SECURE_START] 装甲头');
    if (end < 0) throw new Error('密文被截断：找到 [SECURE_START] 但没有 [SECURE_END]');
    const body = lines.slice(begin + 1, end).join('').replace(/[\s\u3000]+/g, '');
    if (!body) throw new Error('密文块是空的');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
      throw new Error('密文块含有非 Base64 字符（可能被编辑器/聊天软件污染）');
    }
    const header = parseHeader(lines.slice(0, begin));
    const pair = {
      kind: S(header.KIND || '').toLowerCase(),
      vaultId: S(header.VAULT_ID || ''),
      cipher: S(header.CIPHER || algorithm),
      iterations: Number(header.ITER) || crypto.PBKDF2_ITERATIONS,
      salt: S(header.SALT || ''),
      iv: S(header.IV || ''),
      ciphertext: body,
      domain,
      algorithm,
      header,
    };
    if (!pair.salt || !pair.iv) throw new Error('密文头缺少 SALT 或 IV');
    return pair;
  }

  function isEncrypted(src) {
    const s = text.normalize(src);
    return BEGIN_RE.test(s.split('\n').map((x) => x.trim()).find((x) => BEGIN_RE.test(x)) || '');
  }

  function detect(src) {
    try {
      return { kind: 'secure', ...extractSecure(src) };
    } catch (e) {
      return null;
    }
  }

  function sealFile(kind, header, plaintext, password, opts) {
    const o = opts || {};
    return crypto.sealText(password, plaintext, o.salt, o.iterations).then((sealed) => packSecure(kind, {
      vaultId: header.vaultId,
      iterations: sealed.iterations,
      salt: sealed.salt,
      iv: sealed.iv,
    }, sealed.ciphertext, { domain: header.domain || 'P', updatedAt: o.updatedAt }));
  }

  async function openFile(src, password) {
    const pair = extractSecure(src);
    const plain = await crypto.openText(password, {
      salt: pair.salt,
      iv: pair.iv,
      ciphertext: pair.ciphertext,
      iterations: pair.iterations,
    });
    return { plain, pair };
  }

  TV.envelope = {
    BEGIN_RE,
    END_RE,
    wrap64,
    packSecure,
    extractSecure,
    isEncrypted,
    detect,
    sealFile,
    openFile,
    parseHeader,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.envelope;
})(typeof globalThis !== 'undefined' ? globalThis : this);
