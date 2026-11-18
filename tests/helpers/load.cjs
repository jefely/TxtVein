/* 测试与脚本共用的加载器：按依赖顺序把浏览器 IIFE 模块装进 globalThis.TxtVein。 */
'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = [
  'js/core/version.js',
  'js/core/text.js',
  'js/core/system-dict-core.js',
  'js/core/system-dict.js',
  'js/core/user-dict.js',
  'js/core/tree-view.js',
  'js/core/anchor.js',
  'js/core/public-report.js',
  'js/core/suggester.js',
  'js/core/text-bundle.js',
  'js/core/nt-bridge.js',
  'js/core/amount.js',
  'js/core/date.js',
  'js/core/dict.js',
  'js/core/ids.js',
  'js/core/parser.js',
  'js/core/calc.js',
  'js/core/domain.js',
  'js/core/rules.js',
  'js/core/report.js',
  'js/core/ledger-file.js',
  'js/core/dict-file.js',
  'js/core/crypto.js',
  'js/core/envelope.js',
  'js/browser/store.js',
  'js/core/example.js',
  'js/core/legacy.js',
  'js/core/source.js',
  'js/core/en-codes.js',
  'js/core/dict-v4.js',
];

function loadTV() {
  globalThis.TxtVein = globalThis.TxtVein || {};
  for (const rel of FILES) {
    const full = path.join(ROOT, rel);
    try {
      require(full);
    } catch (e) {
      if (e && e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(rel)) continue;
      throw e;
    }
  }
  return globalThis.TxtVein;
}

module.exports = { loadTV, ROOT };
