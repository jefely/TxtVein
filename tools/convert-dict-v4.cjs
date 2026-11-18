'use strict';

/* v3 字典 → v4（逗号列 / 三层）一次性转换。
 *
 *   node tools/convert-dict-v4.cjs [源文件] [--out 目标] [--report 报告]
 *
 * 规则（见 docs/private-dict-v4.md §九）：
 *   - 单支旧分组保留原名，补第三列（通勤 → 交通）；
 *   - 多支旧分组按母树顶级分支拆开，拆完的名字用分支名（隐式归属）；
 *   - 无归属节点进「未分类」；
 *   - 旧标签/行为父链压成两层，更深的压到根并写进报告。
 *
 * 不写保险库、不改 app；只产出文本 + 报告。转换后必须过等价校验才写出。
 */
const fs = require('fs');
const path = require('path');
const { loadTV } = require('../tests/helpers/load.cjs');

const TV = loadTV();
const args = process.argv.slice(2);
const srcArg = args[0] && args[0].indexOf('--') !== 0 ? args[0] : '';
const srcPath = path.resolve(srcArg || path.join(__dirname, '..', 'local', 'private.dict.tv'));
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : fallback;
};
const base = srcPath.replace(/\.dict\.(tv|txt)$/i, '').replace(/\.(tv|txt|dict)$/i, '');
const outPath = flag('--out', base + '.v4.tv');
const reportPath = flag('--report', base + '.v4.report.json');

function topBranch(id, nodes) {
  const chain = [];
  let cur = id;
  let guard = 0;
  while (cur && nodes[cur] && guard < 64) { chain.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
  const ti = chain.findIndex((x) => nodes[x].kind === 'type');
  return ti >= 0 ? chain[ti + 1] || '' : '';
}

function fail(msg) {
  console.error('转换失败：' + msg);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(srcPath)) fail('源文件不存在：' + srcPath);
  const text = fs.readFileSync(srcPath, 'utf8');
  const v3 = TV.source.compileDictSource(text, { now: new Date() });
  if (v3.dict && v3.dict.format === 'v4') fail('源文件已经是 v4');
  if (!v3.ok) fail('v3 编译有错：' + JSON.stringify(v3.diagnostics.slice(0, 3)));

  const conv = TV.dictV4.fromV3(v3.dict, { now: new Date() });
  const out = TV.dictV4.emit(conv.dict);
  const back = TV.dictV4.parse(out, { now: new Date() });
  if (!back.ok) fail('转换结果不能编译：' + JSON.stringify(back.diagnostics.slice(0, 3)));

  const sys = TV.systemDict.nodes;
  const oldNodes = {};
  Object.keys(v3.dict.nodes).forEach((id) => {
    const n = v3.dict.nodes[id];
    if (n.system || !n.anchor_id) return;
    oldNodes[n.zh_code] = n;
  });
  const newNodes = {};
  Object.keys(back.dict.nodes).forEach((id) => {
    const n = back.dict.nodes[id];
    if (!n.system) newNodes[n.zh_code] = n;
  });
  const diffs = [];
  Object.keys(oldNodes).forEach((code) => {
    const a = oldNodes[code];
    const b = newNodes[code];
    if (!b) { diffs.push(code + ' 丢失'); return; }
    if (b.zh_name !== a.zh_name) diffs.push(code + ' 名称 ' + a.zh_name + '→' + b.zh_name);
    if (b.type !== a.type) diffs.push(code + ' 类型 ' + a.type + '→' + b.type);
    if (b.domain !== a.domain) diffs.push(code + ' 域 ' + a.domain + '→' + b.domain);
    if (b.anchor_id !== a.anchor_id) diffs.push(code + ' 绑定 ' + a.anchor_id + '→' + b.anchor_id);
  });
  if (diffs.length) fail('等价校验不通过：\n  ' + diffs.slice(0, 12).join('\n  '));
  if (diffs.length) fail('等价校验不通过：\n  ' + diffs.slice(0, 12).join('\n  '));

  fs.writeFileSync(outPath, out, 'utf8');
  const report = Object.assign({}, conv.report, {
    source: srcPath,
    output: outPath,
    bytes: Buffer.byteLength(out, 'utf8'),
    lines: out.split('\n').length - 1,
    verified: { oldNodes: Object.keys(oldNodes).length, newNodes: Object.keys(newNodes).length, diffs: 0 },
  });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('源        ' + srcPath);
  console.log('输出      ' + outPath + '  (' + report.lines + ' 行 / ' + report.bytes + ' 字节)');
  console.log('节点      ' + report.nodes + '  → 校验 ' + Object.keys(newNodes).length + '，0 差异');
  console.log('统计分类  ' + report.categories + '（保留 ' + report.groups.length + ' 个旧分组；固定绑定 ' + report.bindings + ' 个节点）');
  if (report.groupNodesDropped) console.log('组节点    ' + report.groupNodesDropped + ' 个降为分组标签');
  if (report.unmapped.length) console.log('未归类    ' + report.unmapped.length);
  if (report.tagFlattened.length) console.log('标签压平  ' + report.tagFlattened.length);

  if (args.indexOf('--single') >= 0) {
    const singlePath = flag('--single-out', base + '.v4.txt');
    const single = '## 统计\n## 流水\n## 行为\n## 备注\n## 字典\n' + out;
    fs.writeFileSync(singlePath, single, 'utf8');
    console.log('单文本    ' + singlePath + '（可直接从「导入 → 单文本」载入）');
  }
  console.log('报告      ' + reportPath);
}

main();
