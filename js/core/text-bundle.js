/* TxtVein · 可粘贴的多文件包
 *
 * 手机不能存文件时，把「流水 + 字典」两份内容装进一个纯文本块：
 *
 *   # [TXTVEIN_BUNDLE: 1]
 *   # MODE: deep
 *   # [FILE: ledger.enc]
 *   ...
 *   # [/FILE]
 *   # [FILE: dict.enc]
 *   ...
 *   # [/FILE]
 *   # [/BUNDLE]
 *
 * 标记只认整行；文件内容里的普通 # 注释不受影响。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const HEAD = '# [TXTVEIN_BUNDLE: 1]';
  const END = '# [/BUNDLE]';
  const FILE_RE = /^#\s*\[FILE:\s*(.+?)\]\s*$/;
  const FILE_END = '# [/FILE]';

  function pack(files, opts) {
    const o = opts || {};
    const list = Array.isArray(files) ? files : [];
    const lines = [HEAD, '# MODE: ' + S(o.mode || 'bundle')];
    list.forEach((f) => {
      lines.push('# [FILE: ' + S(f.name || 'file') + ']');
      lines.push(S(f.text).replace(/\s+$/, ''));
      lines.push(FILE_END);
    });
    lines.push(END);
    return lines.join('\n') + '\n';
  }

  function isBundle(text) {
    return S(text).replace(/^\uFEFF/, '').split(/\r?\n/).some((l) => l.trim() === HEAD);
  }

  function unpack(text) {
    const raw = S(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n');
    const hi = lines.findIndex((l) => l.trim() === HEAD);
    if (hi < 0) return null;
    let mode = '';
    const files = [];
    let cur = null;
    for (let i = hi + 1; i < lines.length; i += 1) {
      const line = lines[i];
      const t = line.trim();
      if (t === END) break;
      const m = t.match(/^#\s*MODE:\s*(.+)$/i);
      if (m) { mode = m[1].trim(); continue; }
      const fm = t.match(FILE_RE);
      if (fm) {
        if (cur) return { ok: false, error: '文件块嵌套：' + fm[1] };
        cur = { name: fm[1].trim(), lines: [] };
        continue;
      }
      if (t === FILE_END) {
        if (!cur) return { ok: false, error: '多余的 [/FILE]' };
        files.push({ name: cur.name, text: cur.lines.join('\n') + '\n' });
        cur = null;
        continue;
      }
      if (cur) cur.lines.push(line);
    }
    if (cur) return { ok: false, error: '文件块没有 [/FILE] 结尾' };
    if (!files.length) return { ok: false, error: '包里没有文件' };
    return { ok: true, mode, files };
  }

  TV.textBundle = { pack, unpack, isBundle, HEAD, END };
  if (typeof module === 'object' && module.exports) module.exports = TV.textBundle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
