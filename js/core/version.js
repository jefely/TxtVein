/* TxtVein · 应用版本（唯一源）
 *
 * 版本号同时出现在：
 *   - package.json
 *   - js/core/version.js（APP_VER）
 *   - sw.js 的 CACHE
 *   - index.html 的 <meta name="app-version">
 *
 * 门禁会检查这几处一致；改版本只改这里 + package.json + sw.js + meta。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const APP_VER = 'txtvein-v2.5.1';

  function parseVer(v) {
    const m = String(v || '').match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (!m) return -1;
    return Number(m[1]) * 1000000 + Number(m[2]) * 1000 + Number(m[3]);
  }

  function isNewer(a, b) {
    return parseVer(a) > parseVer(b);
  }

  TV.version = {
    APP_VER,
    VERSION: APP_VER.replace(/^txtvein-v/, ''),
    parseVer,
    isNewer,
  };
  if (typeof module === 'object' && module.exports) module.exports = TV.version;
})(typeof globalThis !== 'undefined' ? globalThis : this);
