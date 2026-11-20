/* TxtVein · 工程门禁
 * 只做静态可验证的事：引用存在、核心层零 DOM、单文件无外链、没有 <table> 主布局。
 * 运行时正确性由 node --test 与 tools/e2e.py 负责。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  PASS  ' + name);
    return true;
  }
  fails.push(name + (detail ? '  ' + detail : ''));
  console.log('  FAIL  ' + name + (detail ? '  ' + detail : ''));
  return false;
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir, out) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  fs.readdirSync(full, { withFileTypes: true }).forEach((e) => {
    const rel = path.join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  });
  return out;
}

const CORE = [
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
  'js/core/source.js',
  'js/core/dict-v4.js',
  'js/core/calc.js',
  'js/core/stats.js',
  'js/core/domain.js',
  'js/core/rules.js',
  'js/core/report.js',
  'js/core/ledger-file.js',
  'js/core/dict-file.js',
  'js/core/crypto.js',
  'js/core/envelope.js',
  'js/core/example.js',
  'js/core/legacy.js',
];
const UI = [
  'js/browser/store.js',
  'js/browser/files.js',
  'js/ui/dom.js',
  'js/ui/gate.js',
  'js/ui/editor.js',
  'js/ui/panes.js',
  'js/ui/report-view.js',
  'js/ui/input.js',
  'js/ui/panels.js',
  'js/ui/plan-view.js',
  'js/ui/app.js',
];
const CSS = ['css/base.css', 'css/ledger.css', 'css/report.css', 'css/panels.css', 'css/editor.css'];

console.log('TxtVein gate');
console.log('1) 文件存在');
[...CORE, ...UI, ...CSS].forEach((f) => ok(f, exists(f)));
['index.html', 'serve.py', 'start.cmd', 'package.json', 'js/core/system.dict'].forEach((f) => ok(f, exists(f)));

console.log('2) index.html 引用');
const index = read('index.html');
CSS.forEach((f) => ok('index -> ' + f, index.includes('href="' + f + '"')));
[...CORE, ...UI].forEach((f) => ok('index -> ' + f, index.includes('src="' + f + '"')));
ok('index 没有外链 http(s) 资源', !/(?:src|href)="https?:/i.test(index));
ok('index 没有内联事件', !/\son[a-z]+\s*=/.test(index));
ok('index 没有 <table>', !/<table[\s>]/i.test(index));

const pkg = JSON.parse(read('package.json'));
const verSrc = read('js/core/version.js');
const swSrc = read('sw.js');
const appVer = (verSrc.match(/APP_VER\s*=\s*'([^']+)'/) || [])[1] || '';
ok('package.json 与 version.js 版本一致', appVer === 'txtvein-v' + pkg.version, appVer + ' / ' + pkg.version);
ok('sw.js 缓存版本与 package 一致', swSrc.includes("txtvein-shell-v" + pkg.version));
ok('index 的 app-version 与 package 一致', index.includes('name="app-version" content="' + pkg.version + '"'));

console.log('3) 核心层零 DOM');
CORE.forEach((f) => {
  const s = read(f);
  const bad = /(document\.|window\.|localStorage|sessionStorage|navigator\.|HTMLElement)/.test(s);
  ok(f + ' 无浏览器对象', !bad);
});

console.log('4) 视觉与结构约束');
const allCss = CSS.map(read).join('\n');
ok('CSS 不使用 <table>', !/<table[\s>]/i.test(allCss));
ok('主色 #06070A 存在', allCss.includes('#06070A'));
ok('A 极青 #22D3EE 存在', allCss.includes('#22D3EE'));
ok('B 极橙 #FB923C 存在', allCss.includes('#FB923C'));
ok('唯一点缀色 #4ADE80 存在', allCss.includes('#4ADE80'));
ok('tabular-nums 存在', allCss.includes('tabular-nums'));

console.log('5) 加密参数');
const cryptoSrc = read('js/core/crypto.js');
ok('PBKDF2 150000', cryptoSrc.includes('150000') || cryptoSrc.includes('PBKDF2_ITERATIONS = 150000'));
ok('AES-GCM-256', cryptoSrc.includes('AES-GCM') && cryptoSrc.includes('KEY_BITS = 256'));
ok('盐 16 / IV 12', cryptoSrc.includes('SALT_BYTES = 16') && cryptoSrc.includes('IV_BYTES = 12'));
const envSrc = read('js/core/envelope.js');
ok('SECURE_START 装甲', envSrc.includes('SECURE_START') && envSrc.includes('SECURE_END'));

console.log('6) 单文件构建');
if (!exists('TxtVein.html')) {
  ok('TxtVein.html 已构建', false, '先运行 node tools/build.cjs');
} else {
  const single = read('TxtVein.html');
  ok('单文件包含全部核心模块', CORE.every((f) => single.includes('/* ' + f + ' */')));
  ok('单文件包含全部 UI 模块', UI.every((f) => single.includes('/* ' + f + ' */')));
  ok('单文件无外链脚本', !/<script\s+src="/.test(single));
  ok('单文件无外链样式', !/<link\s+rel="stylesheet"/.test(single));
  ok('单文件含 TxtVein 品牌', single.includes('TXTVEIN'));
  ok('单文件体积 < 1.5MB', Buffer.byteLength(single) < 1.5 * 1024 * 1024, (Buffer.byteLength(single) / 1024).toFixed(1) + 'KB');
}

console.log('7) 数据文件与测试');
['tests/amount.test.cjs', 'tests/date.test.cjs', 'tests/dict.test.cjs', 'tests/parser.test.cjs',
  'tests/calc.test.cjs', 'tests/rules.test.cjs', 'tests/file.test.cjs', 'tests/crypto.test.cjs',
  'tests/report.test.cjs', 'tests/legacy.test.cjs', 'tests/source.test.cjs',
  'tests/system-graph.test.cjs', 'tests/system-dict.test.cjs', 'tests/system-i18n.test.cjs',
  'tests/split-dict.test.cjs', 'tests/tree-view.test.cjs', 'tests/anchor.test.cjs',
  'tests/public-report.test.cjs', 'tests/suggester.test.cjs',
  'tests/text-bundle.test.cjs', 'tests/nt-bridge.test.cjs', 'tests/dict-v4.test.cjs'].forEach((f) => ok(f, exists(f)));
ok('示例账本存在', exists('js/core/example.js'));
['vendor/codemirror/codemirror.min.js', 'vendor/codemirror/codemirror.min.css',
  'vendor/codemirror/addon/hint/show-hint.min.js', 'vendor/codemirror/addon/lint/lint.min.js',
  'vendor/codemirror/LICENSE'].forEach((f) => ok('vendor -> ' + f, exists(f)));

console.log('8) 母树');
const core = require(path.join(ROOT, 'js/core/system-dict-core.js'));
const parsedSystem = core.parse(read('js/core/system.dict'));
const systemErrors = parsedSystem.diagnostics.filter((x) => x.severity === 'error');
ok('system.dict 解析与图算法', parsedSystem.ok, systemErrors.slice(0, 3).map((x) => x.code + ':' + x.message).join(' | '));
const systemCanonical = core.canonical(core.publicData(parsedSystem));
const systemHash = crypto.createHash('sha256').update(systemCanonical, 'utf8').digest('hex');
const genSystem = read('js/core/system-dict.js');
const genHash = (genSystem.match(/"HASH":\s*"([0-9a-f]{64})"/) || [])[1] || '';
const genVersion = (genSystem.match(/"VERSION":\s*"([^"]+)"/) || [])[1] || '';
ok('system-dict.js 哈希新鲜', genHash === systemHash, genHash + ' vs ' + systemHash);
ok('system-dict.js 版本一致', genVersion === parsedSystem.version, genVersion + ' vs ' + parsedSystem.version);
ok('母树叶子 140–175', parsedSystem.stats.leafCount >= 140 && parsedSystem.stats.leafCount <= 175, String(parsedSystem.stats.leafCount));
ok('母树银行 ≥40', parsedSystem.stats.bankCount >= 40, String(parsedSystem.stats.bankCount));
ok('母树深度 ≤3', parsedSystem.stats.maxDepth <= 3, String(parsedSystem.stats.maxDepth));
ok('母树分支 ≤20', parsedSystem.stats.maxBranching <= 20, String(parsedSystem.stats.maxBranching));

console.log('');
console.log('gate: ' + pass + ' passed, ' + fails.length + ' failed');
if (fails.length) {
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
