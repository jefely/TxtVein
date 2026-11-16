/* TxtVein · 母树生成器
 *
 * 读 js/core/system.dict
 *   → 用 system-dict-core 解析 + 图算法校验
 *   → 规范化 JSON + SHA-256
 *   → 写 js/core/system-dict.js（浏览器/Node 直接加载）
 *
 * 只改 system.dict；不要手改生成物。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'js', 'core', 'system.dict');
const OUT = path.join(ROOT, 'js', 'core', 'system-dict.js');

function readCore() {
  return require(path.join(ROOT, 'js', 'core', 'system-dict-core.js'));
}

function generate(opts) {
  const o = opts || {};
  const core = readCore();
  if (!fs.existsSync(SOURCE)) throw new Error('缺少母树源：js/core/system.dict');
  const source = fs.readFileSync(SOURCE, 'utf8');
  const parsed = core.parse(source);
  if (!parsed.ok) {
    const errors = parsed.diagnostics.filter((x) => x.severity === 'error');
    const text = errors.map((x) => '  line ' + x.line + ' [' + x.code + '] ' + x.message).join('\n');
    throw new Error('母树校验失败（' + errors.length + ' 个错误）：\n' + text);
  }

  const data = core.publicData(parsed);
  const canonical = core.canonical(data);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  const versionString = data.version + '+' + hash.slice(0, 12);

  const payload = {
    FORMAT: data.format,
    VERSION: data.version,
    HASH: hash,
    VERSION_STRING: versionString,
    nodes: data.nodes,
    merchants: data.merchants,
    banks: data.banks,
    aliases: data.aliases,
    stats: parsed.stats,
  };

  const body = [
    '/* TxtVein · system-dict.js',
    ' * 生成物，请勿手改。',
    ' * source: js/core/system.dict',
    ' * version: ' + data.version,
    ' * hash: ' + hash,
    ' */',
    '(function (root) {',
    "  'use strict';",
    '  const TV = (root.TxtVein = root.TxtVein || {});',
    '  function deepFreeze(o) {',
    "    if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;",
    '    Object.freeze(o);',
    '    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });',
    '    return o;',
    '  }',
    '  TV.systemDict = deepFreeze(' + JSON.stringify(payload, null, 2) + ');',
    "})(typeof globalThis !== 'undefined' ? globalThis : this);",
    '',
  ].join('\n');

  fs.writeFileSync(OUT, body, 'utf8');
  if (!o.quiet) {
    const st = parsed.stats;
    console.log('built js/core/system-dict.js');
    console.log('  version ' + versionString);
    console.log('  nodes ' + st.nodeCount + '  leaves ' + st.leafCount
      + '  merchants ' + st.merchantCount + '  banks ' + st.bankCount
      + '  aliases ' + st.aliasCount
      + '  depth ' + st.maxDepth + '  branch ' + st.maxBranching);
  }
  return {
    version: data.version,
    versionString,
    hash,
    stats: parsed.stats,
    sourcePath: SOURCE,
    outPath: OUT,
  };
}

if (require.main === module) {
  try {
    generate();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

module.exports = { generate, SOURCE, OUT };
