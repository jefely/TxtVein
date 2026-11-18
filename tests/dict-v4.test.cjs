/* 私有字典 v4：逗号列 / 缩进三层 / 节点级固定绑定 / 中英文 / 别名 / tokens / 转换 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadTV, ROOT } = require('./helpers/load.cjs');

const TV = loadTV();
const V4 = TV.dictV4;
const SAMPLE = fs.readFileSync(path.join(ROOT, 'docs', 'private-dict-v4.sample.dict.tv'), 'utf8');

function errors(r) {
  return r.diagnostics.filter((d) => d.severity === 'error');
}

function codeId(dict, code) {
  return Object.keys(dict.nodes).find((id) => !dict.nodes[id].system && dict.nodes[id].zh_code === code);
}

test('v4 样本：81 节点 / 24 分组 / 81 条固定绑定', () => {
  const r = V4.parse(SAMPLE, { now: new Date('2026-01-01T00:00:00Z') });
  assert.deepEqual(errors(r), []);
  assert.equal(r.diagnostics.length, 0, '统计分类没有归属不是警告：' + JSON.stringify(r.diagnostics.slice(0, 3)));
  assert.equal(r.stats.categories, 24);
  assert.equal(r.stats.nodes, 81);
  const nodes = Object.values(r.dict.nodes).filter((n) => !n.system);
  assert.equal(nodes.filter((n) => !!n.anchor_id).length, 81, '每个节点都要有固定绑定');
  assert.ok(nodes.every((n) => !!n.category_key), '每个节点都要有统计分类');
  /* 旧分组原样保留：日常 / 生活 / 保健 … */
  const groups = r.categories.map((c) => c.name);
  ['日常', '生活', '保健', '通勤', '出行', '储蓄', '网账'].forEach((g) => {
    assert.ok(groups.indexOf(g) >= 0, '缺少旧分组：' + g);
  });
});

test('v4 往返稳定：emit(parse) 幂等，绑定不丢', () => {
  const a = V4.parse(SAMPLE);
  const text = V4.emit(a);
  const b = V4.parse(text);
  assert.deepEqual(errors(b), []);
  assert.equal(b.stats.categories, 24);
  assert.equal(b.stats.nodes, 81);
  assert.equal(Object.values(b.dict.nodes).filter((n) => !n.system && n.anchor_id).length, 81);
  assert.equal(V4.emit(b), text);
  assert.ok(text.indexOf('[母树]') >= 0);
});

test('英文逗号与中文逗号等价', () => {
  const a = V4.parse('[费用]\n日常\n  DC，点餐\n');
  const b = V4.parse('[费用]\n日常\n  DC, 点餐\n');
  assert.deepEqual(errors(a), []);
  assert.deepEqual(errors(b), []);
  assert.equal(Object.values(b.dict.nodes)[0].zh_name, '点餐');
});

test('列数与缩进：坏行报错，错位只警告', () => {
  const cases = [
    ['[费用]\n日常\n  早餐\n', 'COLUMNS'],
    ['[费用]\n日常\n  DC，点餐，dc，Dining，多余\n', 'COLUMNS'],
    ['[费用]\n日常\n  DC，点餐\n    XX，太深\n', 'DEPTH'],
  ];
  cases.forEach(([src, code]) => {
    const r = V4.parse(src);
    assert.equal(r.ok, false, src);
    assert.ok(r.diagnostics.some((d) => d.code === code), src + ' → ' + JSON.stringify(r.diagnostics));
  });
  const lint = V4.parse('[费用]\n  DC，点餐\n');
  assert.equal(lint.ok, true);
  assert.ok(lint.diagnostics.some((d) => d.code === 'LINT_NODE'));
});

test('母树块：节点级固定绑定，分支/叶子都可选', () => {
  const leaf = V4.parse('[费用]\n日常\n  ZC，早餐\n[归属]，Bindings\nZC，餐饮/早餐\n');
  assert.deepEqual(errors(leaf), []);
  assert.equal(leaf.dict.nodes[codeId(leaf.dict, 'ZC')].anchor_id, 'SYS.CAT.DINING.BREAKFAST');
  const branch = V4.parse('[费用]\n日常\n  DT，地铁\n[归属]\nDT，交通\n');
  assert.equal(branch.dict.nodes[codeId(branch.dict, 'DT')].anchor_id, 'SYS.CAT.TRANSPORT');
  const badRef = V4.parse('[费用]\n日常\n  ZC，早餐\n[归属]\nZC，不存在的分支\n');
  assert.equal(badRef.ok, false);
  assert.ok(badRef.diagnostics.some((d) => d.code === 'BIND_REF'));
  const badType = V4.parse('[资产]\n现金\n  XJ，现金\n[归属]\nXJ，餐饮\n');
  assert.equal(badType.ok, false);
  assert.ok(badType.diagnostics.some((d) => d.code === 'BIND_MISMATCH'));
  const typeTarget = V4.parse('[费用]\n日常\n  ZC，早餐\n[归属]\nZC，费用\n');
  assert.equal(typeTarget.ok, false);
  assert.ok(typeTarget.diagnostics.some((d) => d.code === 'BIND_REF'), JSON.stringify(typeTarget.diagnostics));
});

test('统计分类的第三列仍读作「默认绑定」，写回时变成节点绑定', () => {
  const r = V4.parse('[费用]\n通勤，Commute，交通\n  DT，地铁\n');
  assert.deepEqual(errors(r), []);
  assert.equal(r.dict.nodes[codeId(r.dict, 'DT')].anchor_id, 'SYS.CAT.TRANSPORT');
  const text = V4.emit(r);
  assert.ok(text.indexOf('通勤，Commute') >= 0, text);
  assert.ok(text.indexOf('DT，交通') >= 0, text);
  assert.ok(text.indexOf('通勤，，交通') < 0, '不再输出分类第三列');
});

test('中英文：固定列与回退', () => {
  const r = V4.parse([
    '[费用]，Expense',
    '通勤，Commute',
    '  ZHC，招行储，CMB，China Merchants Bank',
    '  DT，地铁',
    '[归属]',
    'ZHC，交通',
    'DT，交通',
  ].join('\n'));
  assert.deepEqual(errors(r), []);
  const nodes = Object.values(r.dict.nodes).filter((n) => !n.system);
  const zhc = nodes.find((n) => n.zh_code === 'ZHC');
  assert.equal(zhc.en_code, 'CMB');
  assert.equal(zhc.en_name, 'China Merchants Bank');
  const dt = nodes.find((n) => n.zh_code === 'DT');
  assert.equal(dt.en_code, 'dt');
  assert.equal(dt.en_name, '地铁');
  assert.equal(dt.en_code_auto, true);
  assert.equal(dt.en_auto, true);
  const cat = r.categories.find((c) => c.name === '通勤');
  assert.equal(cat.en_name, 'Commute');
  assert.equal(cat.anchor_id, '', '统计分类不挂母树');
});

test('备注：归属（无码）→ 关键字（有码），父级正确', () => {
  const r = V4.parse('[备注]，Notes\n商品\n  KF，咖啡，Cof，Coffee\n');
  assert.deepEqual(errors(r), []);
  const cats = Object.values(r.dict.tags).filter((t) => t.is_category);
  assert.equal(cats.length, 1);
  const kws = Object.values(r.dict.tags).filter((t) => !t.is_category);
  assert.equal(kws[0].parent_id, Object.keys(r.dict.tags).find((id) => r.dict.tags[id].is_category));
  const text = V4.emit(r);
  assert.ok(text.indexOf('[备注]，Notes') >= 0);
  assert.ok(text.indexOf('  KF，咖啡，Cof，Coffee') >= 0);
});

test('别名：1:n 保留并可往返；自动别名不写回', () => {
  const r = V4.parse([
    '[负债]',
    '信用卡',
    '  JHX，交行信',
    '  JHX2，交行信',
    '[归属]',
    'JHX，信用卡',
    'JHX2，信用卡',
    'alias 交行信，JHX，JHX2',
  ].join('\n'));
  assert.deepEqual(errors(r), []);
  assert.equal((r.dict.aliases['交行信'] || []).length, 2);
  assert.ok(/alias 交行信，JHX，JHX2/.test(V4.emit(r)));
  /* 自动别名（D.addAlias 产生）不应被发射 */
  const d = V4.parse('[费用]\n日常\n  ZC，早餐\n').dict;
  const id = codeId(d, 'ZC');
  TV.dict.addAlias(d, '早餐', id);
  TV.dict.addAlias(d, 'zc', id);
  assert.equal(V4.emit(d).indexOf('alias'), -1);
});

test('tokens：def / link / error 与行内偏移', () => {
  const src = '[费用]\n日常\n  ZC，早餐\n[归属]\nZC，餐饮\n保险箱\n  BX，保险\n';
  const r = V4.parse(src);
  const lines = src.split('\n');
  assert.ok(r.tokens.some((t) => t.role === 'def'));
  assert.ok(r.tokens.some((t) => t.role === 'link'));
  r.tokens.forEach((t) => {
    const line = lines[t.line - 1] || '';
    assert.ok(t.from >= 0 && t.to <= line.length && t.from <= t.to, JSON.stringify(t) + ' / ' + line);
  });
  const bad = V4.parse('[费用]\n日常\n  早餐\n');
  assert.ok(bad.tokens.some((t) => t.role === 'error'));
});

test('detect：旧格式走 v3', () => {
  assert.equal(V4.detect('[树]\nP 费用\n  xx [X]\n'), 'v3');
  assert.equal(V4.detect('node P 费用 steam a a 甲 | 甲\n'), 'v3');
  assert.equal(V4.detect(SAMPLE), 'v4');
});

test('编译接线：compileAll / dictToSource 走 v4', () => {
  const r = TV.source.compileAll(SAMPLE, '');
  assert.equal(r.dict.format, 'v4');
  assert.equal(Object.keys(r.dict.nodes).filter((id) => !r.dict.nodes[id].system).length, 81);
  const text = TV.source.dictToSource(r.dict);
  assert.ok(text.indexOf('// TxtVein 字典 v4') === 0);
  const r2 = TV.source.compileAll(text, '');
  assert.equal(r2.ok, true);
  assert.equal(Object.keys(r2.dict.nodes).filter((id) => !r2.dict.nodes[id].system).length, 81);
  assert.equal(Object.values(r2.dict.nodes).filter((n) => !n.system && n.anchor_id).length, 81);
});

test('模型操作：落分组、改绑定、孤儿兜底', () => {
  const r = V4.parse('[费用]\n日常\n  ZC，早餐\n');
  const d = r.dict;
  const id = TV.ids.newNodeId(() => false);
  d.nodes[id] = {
    zh_name: '午饭', en_name: '午饭', zh_code: 'WF', en_code: 'wf',
    type: '费用', polarity: 'A', form: 'steam', domain: 'P',
    category_key: '', parent_id: '', weight: 100, sort: 100, pin: 0,
    en_auto: true, en_code_auto: true,
  };
  const key = V4.ensureCategory(d, '费用', '日常').key;
  const p = V4.placeNode(d, id, key);
  assert.equal(p.ok, true);
  assert.equal(d.nodes[id].anchor_id, undefined);
  const a = V4.setNodeAnchor(d, id, '交通');
  assert.equal(a.ok, true);
  assert.equal(d.nodes[id].anchor_id, 'SYS.CAT.TRANSPORT');
  const text = V4.emit(d);
  assert.ok(text.indexOf('  WF，午饭') >= 0, text);
  assert.ok(text.indexOf('WF，交通') >= 0, text);
  d.nodes[id].category_key = '';
  const orphan = V4.emit(d);
  assert.ok(orphan.indexOf('未分类') >= 0 && orphan.indexOf('WF，午饭') >= 0, orphan);
});

test('模型操作：重命名分类、删除分类', () => {
  const r = V4.parse('[费用]\n日常\n  ZC，早餐\n[归属]\nZC，餐饮/早餐\n');
  const d = r.dict;
  const key = r.categories[0].key;
  const rr = V4.renameCategory(d, key, '吃喝');
  assert.equal(rr.ok, true);
  const node = d.nodes[codeId(d, 'ZC')];
  assert.equal(node.category_key, rr.key);
  assert.equal(node.category, '吃喝');
  const del = V4.removeCategory(d, rr.key);
  assert.equal(del.ok, true);
  assert.equal(del.moved, 1);
  assert.equal(node.category_key, '');
  assert.equal(node.anchor_id, 'SYS.CAT.DINING.BREAKFAST', '删除分组不动节点绑定');
  assert.ok(V4.emit(d).indexOf('未分类') >= 0);
});

test('v3 → v4 无损：24 个旧分组原样保留，81 个绑定精确相等', () => {
  const src = fs.readFileSync(path.join(ROOT, 'local', 'private.dict.tv'), 'utf8');
  const v3 = TV.source.compileDictSource(src, { now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(v3.ok, true);
  const conv = V4.fromV3(v3.dict, { now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(conv.report.nodes, 81);
  assert.equal(conv.report.categories, 24);
  assert.equal(conv.report.groups.length, 24);
  assert.equal(conv.report.bindings, 81);
  assert.equal(conv.report.groupNodesDropped, 24);
  assert.equal(conv.report.unmapped.filter((x) => x.reason === '没有归属').length, 0);
  const text = V4.emit(conv.dict);
  const r2 = V4.parse(text);
  assert.deepEqual(errors(r2), []);
  assert.equal(r2.stats.nodes, 81);
  assert.equal(r2.stats.categories, 24);
  const oldByCode = {};
  Object.keys(v3.dict.nodes).forEach((id) => {
    const n = v3.dict.nodes[id];
    if (!n.system && n.anchor_id) oldByCode[n.zh_code] = n;
  });
  const newByCode = {};
  Object.keys(r2.dict.nodes).forEach((id) => {
    const n = r2.dict.nodes[id];
    if (!n.system) newByCode[n.zh_code] = n;
  });
  Object.keys(oldByCode).forEach((code) => {
    const a = oldByCode[code];
    const b = newByCode[code];
    assert.ok(b, '缺少节点 ' + code);
    assert.equal(b.zh_name, a.zh_name);
    assert.equal(b.type, a.type);
    assert.equal(b.domain, a.domain);
    assert.equal(b.anchor_id, a.anchor_id, code + ' 绑定必须精确相等');
  });
  assert.ok(text.indexOf('[母树]') >= 0);
});

test('采纳母树：分支或叶子 → 用户分组 + 固定绑定', () => {
  const leaf = V4.placementForTarget('SYS.CAT.DINING.BREAKFAST');
  assert.equal(leaf.ok, true);
  assert.equal(leaf.type, '费用');
  assert.equal(leaf.groupName, '餐饮');
  assert.equal(leaf.targetId, 'SYS.CAT.DINING.BREAKFAST');
  const branch = V4.placementForTarget('SYS.CAT.DINING');
  assert.equal(branch.ok, true, '分支也可选');
  assert.equal(branch.targetId, 'SYS.CAT.DINING');
  assert.equal(V4.placementForTarget('SYS.ACC.EXPENSE').ok, false, '会计类型本身不可选');
  const r = V4.parse('[费用]\n日常\n  ZC，早餐\n');
  const d = r.dict;
  const id = codeId(d, 'ZC');
  assert.equal(V4.setNodeAnchor(d, id, '餐饮', TV.systemDict).ok, true);
  assert.equal(d.nodes[id].anchor_id, 'SYS.CAT.DINING');
  assert.equal(V4.setNodeAnchor(d, id, '交通', TV.systemDict).ok, true);
  assert.equal(d.nodes[id].anchor_id, 'SYS.CAT.TRANSPORT');
  assert.equal(V4.setNodeAnchor(d, id, '不存在', TV.systemDict).ok, false);
});

test('绑定的用途：同支推荐与快速语义校验', () => {
  const sib = V4.siblingSuggestions('SYS.CAT.DINING.BREAKFAST', TV.systemDict, 6);
  const names = sib.map((x) => x.name);
  assert.ok(names.indexOf('午餐') >= 0 && names.indexOf('晚餐') >= 0, JSON.stringify(names));
  assert.ok(names.indexOf('早餐') < 0);
  const sample = V4.parse(SAMPLE);
  const issues = V4.validateBindings(sample.dict, TV.systemDict);
  assert.equal(issues.filter((i) => i.code === 'UNBOUND').length, 0);
  const d = V4.parse('[费用]\n日常\n  ZC，早餐\n  TT，午餐\n[归属]\nZC，早餐\nTT，交通\n').dict;
  const iss = V4.validateBindings(d, TV.systemDict);
  assert.ok(iss.some((i) => i.code === 'NAME' && d.nodes[i.id] && d.nodes[i.id].zh_name === '午餐'), JSON.stringify(iss));
  const unbound = V4.parse('[费用]\n日常\n  ZC，早餐\n');
  assert.ok(V4.validateBindings(unbound.dict, TV.systemDict).some((i) => i.code === 'UNBOUND'));
});

test('域：C 节点在 v4 文本 / 拆分 / 合并里保留 C: 前缀', () => {
  const src = '[费用]\n日常\n  S，水\n  C:CZC，出租车\n[归属]\nS，居住/水电燃气\nC:CZC，交通\n';
  const r = V4.parse(src);
  assert.equal(r.ok, true);
  const c = Object.values(r.dict.nodes).find((n) => n.zh_code === 'CZC');
  assert.equal(c.domain, 'C');
  const text = V4.emit(r.dict);
  assert.ok(text.indexOf('C:CZC，出租车') >= 0, text);
  assert.ok(text.indexOf('C:CZC，交通') >= 0, text);
  const sp = TV.userDict.split(src);
  assert.equal(sp.ok, true);
  assert.ok(sp.c.indexOf('C:CZC，出租车') >= 0, sp.c);
  assert.ok(sp.p.indexOf('CZC') < 0, sp.p);
  const mg = TV.userDict.merge(sp.p, sp.c);
  const r2 = TV.source.compileAll(mg.source, '');
  assert.equal(r2.ok, true);
  const c2 = Object.values(r2.dict.nodes).find((n) => n.zh_code === 'CZC');
  assert.equal(c2.domain, 'C');
  assert.equal(c2.anchor_id, 'SYS.CAT.TRANSPORT');
});

test('自动英文化：按绑定补第 3/4 列', () => {
  const r = V4.parse('[费用]\n日常\n  ZC，早餐\n[归属]\nZC，餐饮/早餐\n');
  const b = V4.backfillEnglish(r.dict, TV.systemDict);
  assert.equal(b.filled, 1);
  const n = r.dict.nodes[codeId(r.dict, 'ZC')];
  assert.equal(n.en_name, 'Breakfast');
  assert.equal(n.en_code, 'breakfast');
  const text = V4.emit(r.dict);
  assert.ok(text.indexOf('ZC，早餐，breakfast，Breakfast') >= 0, text);
  const r2 = V4.parse('[费用]\n日常\n  ZC，早餐，zc_my，MyBreakfast\n[归属]\nZC，餐饮/早餐\n');
  const b2 = V4.backfillEnglish(r2.dict, TV.systemDict);
  assert.equal(b2.kept, 1);
  assert.equal(r2.dict.nodes[codeId(r2.dict, 'ZC')].en_name, 'MyBreakfast');
});

test('补英文码：银行/支付用内置码表，且全局唯一', () => {
  const r = V4.parse([
    '[资产]', '储蓄',
    '  ZHC，招行储', '  GHC，工行储', '  JHC，交行储', '  XYC，信用储',
    '[归属]',
    'ZHC，储蓄卡', 'GHC，储蓄卡', 'JHC，储蓄卡', 'XYC，储蓄卡',
  ].join('\n'));
  const b = V4.backfillEnglish(r.dict, TV.systemDict);
  assert.equal(b.filled, 4);
  const code = (c) => r.dict.nodes[codeId(r.dict, c)].en_code;
  assert.deepEqual([code('ZHC'), code('GHC'), code('JHC'), code('XYC')], ['cmb', 'icbc', 'bocom', 'xyc']);
  assert.equal(new Set(['cmb', 'icbc', 'bocom', 'xyc']).size, 4);
  const pay = V4.parse('[资产]\n现金\n  ZFB，支付宝余额\n  WX，微信钱包\n[归属]\nZFB，现金\nWX，现金\n');
  V4.backfillEnglish(pay.dict, TV.systemDict);
  assert.equal(pay.dict.nodes[codeId(pay.dict, 'ZFB')].en_code, 'alipay');
  assert.equal(pay.dict.nodes[codeId(pay.dict, 'WX')].en_code, 'wechat');
});

test('英文码表：覆盖常用账本词，可直接查', () => {
  assert.ok(TV.enCodes && TV.enCodes.HINTS.length >= 200, '码表至少 200 条');
  const cases = [
    ['房租', 'rent'], ['地铁', 'metro'], ['工资', 'salary'], ['信用卡', 'creditcard'],
    ['支付宝', 'alipay'], ['工行', 'icbc'], ['水费', 'water'], ['话费', 'phone'],
    ['保险', 'insurance'], ['个税', 'tax'], ['基金', 'fund'], ['酒店', 'hotel'],
    ['电影', 'movie'], ['学费', 'tuition'], ['捐赠', 'donation'], ['押金', 'deposit'],
    ['手续费', 'fee'], ['水果', 'fruit'], ['早餐', 'breakfast'],
  ];
  cases.forEach(([name, code]) => assert.equal(TV.enCodes.codeFor(name), code, name));
});

test('v4 不自动建行为项，自动标签不写回未分类', () => {
  const r = TV.source.compileAll(SAMPLE, '261119 wx1 > dc 3 < coffee');
  assert.deepEqual(r.autoBehaviors || [], []);
  const text = V4.emit(r.dict);
  assert.equal(text.indexOf('[行为]'), -1);
  assert.equal(text.indexOf('未分类'), -1);
  const r2 = TV.source.compileAll(SAMPLE, '261119 wx1 > dc 3 < 新标签');
  assert.ok((r2.autoTags || []).length >= 1);
  const text2 = V4.emit(r2.dict);
  assert.equal(text2.indexOf('未分类'), -1);
});

test('语言模式：中文不匹配英文名，英文不匹配中文名', () => {
  const r = V4.parse('[费用]\n日常\n  ZC，早餐，breakfast，Breakfast\n');
  const d = r.dict;
  assert.equal(TV.dict.searchNodes(d, 'Breakfast', { lang: 'zh', limit: 5 }).length, 0);
  assert.equal(TV.dict.searchNodes(d, 'Breakfast', { lang: 'en', limit: 5 }).length, 1);
  assert.equal(TV.dict.resolveAlias(d, 'Breakfast', { lang: 'zh' }).ok, false);
  assert.equal(TV.dict.resolveAlias(d, 'Breakfast', { lang: 'en' }).ok, true);
  assert.equal(TV.dict.searchNodes(d, '早餐', { lang: 'en', limit: 5 }).length, 0);
});

test('空字典：v4 也能编译与往返', () => {
  const r = TV.source.compileAll('', '');
  assert.equal(r.ok, true);
  assert.equal(r.dict.format, 'v4');
  assert.ok(r.dict.nodes.N_sys_loss && r.dict.nodes.N_sys_gain);
  const text = TV.source.dictToSource(r.dict);
  assert.ok(text.indexOf('// TxtVein 字典 v4') === 0);
  const r2 = TV.source.compileAll(text, '');
  assert.equal(r2.ok, true);
  assert.ok(r2.dict.nodes.N_sys_loss);
});
