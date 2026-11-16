/* TxtVein · 基础文本层
 * 零依赖，浏览器与 Node 通用。
 * 这一层只做「字符」的事：归一化、切行、宽度、全角转半角。
 * 不认钱、不认日期、不认节点。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  const FULLWIDTH_DIGIT = /[０-９]/g;
  const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff]/g;

  function normalize(src) {
    return String(src == null ? '' : src)
      .replace(/^\uFEFF/, '')
      .replace(ZERO_WIDTH, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u2028|\u2029/g, '\n');
  }

  function splitLines(src) {
    return normalize(src).split('\n');
  }

  function isBlank(s) {
    return !String(s == null ? '' : s).trim();
  }

  function isComment(s) {
    return /^\s*#/.test(String(s == null ? '' : s));
  }

  function trim(s) {
    return String(s == null ? '' : s).replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }

  function tokens(s) {
    return trim(s).split(/[\s\u3000]+/).filter(Boolean);
  }

  function toHalfWidthDigits(s) {
    return String(s == null ? '' : s).replace(FULLWIDTH_DIGIT, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  }

  /* 手机输入法有时把负号写成 − / – / －；只归一化开头的符号。 */
  function normalizeSign(s) {
    return String(s == null ? '' : s).replace(/^[\u2212\u2013\u2014\uFF0D]/, '-')
      .replace(/^\uFF0B/, '+');
  }

  /* 全角运算符/标点 → 半角。只用于「输入层」，不用于展示层。 */
  function normalizeOperators(s) {
    return String(s == null ? '' : s)
      .replace(/[＞›]/g, '>')
      .replace(/[＜‹]/g, '<')
      .replace(/[：]/g, ':')
      .replace(/[［【]/g, '[')
      .replace(/[］】]/g, ']')
      .replace(/＃/g, '#')
      .replace(/，/g, ',');
  }

  /* 终端/报表列宽：CJK 与全角标点算 2 格，其余 1 格。 */
  function charWidth(ch) {
    if (!ch) return 0;
    const c = ch.codePointAt(0);
    if (c < 0x1100) return 1;
    if (
      c <= 0x115f ||
      c === 0x2329 || c === 0x232a ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe10 && c <= 0xfe19) ||
      (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x20000 && c <= 0x3fffd)
    ) return 2;
    return 1;
  }

  function textWidth(s) {
    let w = 0;
    const str = String(s == null ? '' : s);
    for (let i = 0; i < str.length; i += 1) {
      const cp = str.codePointAt(i);
      if (cp > 0xffff) i += 1;
      w += charWidth(String.fromCodePoint(cp));
    }
    return w;
  }

  function padEndWidth(s, width) {
    const str = String(s == null ? '' : s);
    const gap = width - textWidth(str);
    return gap > 0 ? str + ' '.repeat(gap) : str;
  }

  function padStartWidth(s, width) {
    const str = String(s == null ? '' : s);
    const gap = width - textWidth(str);
    return gap > 0 ? ' '.repeat(gap) + str : str;
  }

  function truncateWidth(s, width) {
    const str = String(s == null ? '' : s);
    if (textWidth(str) <= width) return str;
    let out = '';
    let w = 0;
    for (const ch of str) {
      const cw = charWidth(ch);
      if (w + cw > width - 1) break;
      out += ch;
      w += cw;
    }
    return out + '…';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isoNow(now) {
    return (now instanceof Date ? now : new Date()).toISOString();
  }

  TV.text = {
    normalize,
    splitLines,
    isBlank,
    isComment,
    trim,
    tokens,
    toHalfWidthDigits,
    normalizeSign,
    normalizeOperators,
    charWidth,
    textWidth,
    padEndWidth,
    padStartWidth,
    truncateWidth,
    escapeHtml,
    isoNow,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
