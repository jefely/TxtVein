/* TxtVein · 单文件构建
 * 读 index.html，把本地 <link rel="stylesheet"> 与 <script src> 内联，
 * 生成 TxtVein.html（双击即开、零外链、零依赖）。
 *
 * 不写构建时间戳：正文一变，哈希与截图都会跳。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'TxtVein.html');

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error('缺少文件：' + rel);
  return fs.readFileSync(p, 'utf8');
}

function fontData() {
  const p = path.join(ROOT, 'assets', 'cascadia', 'CascadiaCode.woff2');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p).toString('base64');
}

function inlineCss(html) {
  const font = fontData();
  return html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) => {
    if (/^https?:/i.test(href)) throw new Error('不允许外链 CSS：' + href);
    let css = read(href);
    if (font) {
      css = css.replace(
        /url\(["']?\.\.\/assets\/cascadia\/CascadiaCode\.woff2["']?\)/g,
        'url("data:font/woff2;base64,' + font + '")',
      );
    }
    return '<style>\n/* ' + href + ' */\n' + css + '\n</style>';
  });
}

function inlineJs(html) {
  return html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (m, src) => {
    if (/^https?:/i.test(src)) throw new Error('不允许外链 JS：' + src);
    let js = read(src);
    /* 防止提前闭合 script；本仓库代码目前没有这个串，保留护栏 */
    js = js.replace(/<\/script/gi, '<\\/script');
    return '<script>\n/* ' + src + ' */\n' + js + '\n</script>';
  });
}

function build() {
  let html = fs.readFileSync(INDEX, 'utf8');
  if (!/<link\s+rel="stylesheet"/.test(html)) throw new Error('index.html 没有 CSS 引用');
  if (!/<script\s+src="/.test(html)) throw new Error('index.html 没有 JS 引用');
  html = inlineCss(html);
  html = inlineJs(html);
  html = html.replace('<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- TxtVein single-file build · source: index.html + css/ + js/ -->');
  if (/<link\s+rel="stylesheet"/.test(html)) throw new Error('仍有未内联的 CSS');
  if (/<script\s+src="/.test(html)) throw new Error('仍有未内联的 JS');
  fs.writeFileSync(OUT, html, 'utf8');
  const stat = fs.statSync(OUT);
  console.log('built ' + path.relative(ROOT, OUT) + '  ' + (stat.size / 1024).toFixed(1) + ' KB');
  console.log('  css: ' + (html.match(/<style>/g) || []).length
    + '  js: ' + (html.match(/<script>/g) || []).length
    + '  external: ' + ((html.match(/https?:\/\//g) || []).length));
}

build();
