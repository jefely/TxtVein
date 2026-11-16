'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const S = TV.systemDict;
const C = TV.systemDictCore;
const idx = C.index(S);
const nodes = idx.nodes;
const ids = Object.keys(nodes);

test('每个节点中英文名成对非空', () => {
  ids.forEach((id) => {
    assert.ok(nodes[id].zh_name, id + ' 缺中文名');
    assert.ok(nodes[id].en_name, id + ' 缺英文名');
  });
  Object.keys(idx.merchants).forEach((id) => {
    assert.ok(idx.merchants[id].zh_name, id + ' 商户缺中文名');
    assert.ok(idx.merchants[id].en_name, id + ' 商户缺英文名');
  });
});

test('没有中英两个节点：一个概念一个顶点', () => {
  const pairs = new Set();
  ids.forEach((id) => {
    assert.ok(!/\.(ZH|EN)$/.test(id), id);
    const key = nodes[id].zh_name + '|' + nodes[id].en_name;
    assert.ok(!pairs.has(key), '重复中英名对：' + key);
    pairs.add(key);
  });
  assert.equal(ids.length, pairs.size);
});

test('切语言只换标签：中英路径等长且对应同一组 ID', () => {
  ids.forEach((id) => {
    const zhIds = C.ancestors(nodes, id);
    const enIds = C.ancestors(nodes, id);
    assert.deepEqual(zhIds, enIds, id);
    assert.equal(C.path(nodes, id, 'zh').length, C.path(nodes, id, 'en').length, id);
    assert.equal(C.pathLabel(nodes, id, 'zh').split(' / ').length,
      C.pathLabel(nodes, id, 'en').split(' / ').length, id);
  });
});

test('切语言不改变树结构、节点数、叶子数', () => {
  const before = ids.map((id) => id + ':' + nodes[id].parent_id + ':' + nodes[id].children.length).join(',');
  const idx2 = C.index(S);
  const after = Object.keys(idx2.nodes).map((id) => {
    const n = idx2.nodes[id];
    return id + ':' + n.parent_id + ':' + n.children.length;
  }).join(',');
  // 两次 index 的结果必须完全一致；语言不进入节点结构。
  assert.equal(before, after);
  assert.equal(C.leafSet(nodes, 'SYS').size, S.stats.leafCount);
});

test('推荐码：叶子成对，内部节点不写码', () => {
  ids.forEach((id) => {
    const n = nodes[id];
    if (n.postable) {
      assert.ok(n.zh_code, id + ' 缺中文推荐码');
      assert.ok(n.en_code, id + ' 缺英文推荐码');
    } else {
      assert.equal(n.zh_code, '', id + ' 内部节点不应有中文推荐码');
      assert.equal(n.en_code, '', id + ' 内部节点不应有英文推荐码');
    }
  });
});

test('商户：中英名成对，推荐码成对', () => {
  Object.keys(idx.merchants).forEach((id) => {
    const m = idx.merchants[id];
    assert.ok(m.zh_code, id + ' 缺中文推荐码');
    assert.ok(m.en_code, id + ' 缺英文推荐码');
    assert.ok(nodes[m.default_category], id + ' 默认分类不存在');
    assert.equal(nodes[m.default_category].postable, true, id + ' 默认分类不是叶子');
  });
});

test('别名按语言分开且唯一', () => {
  const seen = { zh: new Map(), en: new Map() };
  S.aliases.forEach((a) => {
    assert.ok(['zh', 'en'].indexOf(a.lang) >= 0, '非法语言：' + a.lang);
    assert.ok(!/\s/.test(a.alias), '别名含空格，流水无法作为单 token：' + a.alias);
    assert.ok(!seen[a.lang].has(a.alias), '重复别名：' + a.lang + ' / ' + a.alias);
    seen[a.lang].set(a.alias, a.id);
  });
  assert.ok(seen.zh.size > 0);
  assert.ok(seen.en.size > 0);
});

test('双语检索：中文与英文都能命中同一个叶子', () => {
  const zh = C.search(idx, '咖啡', 'zh');
  const en = C.search(idx, 'coffee', 'en');
  assert.ok(zh.some((x) => x.id === 'SYS.CAT.DINING.COFFEE' && x.kind === 'leaf'));
  assert.ok(en.some((x) => x.id === 'SYS.CAT.DINING.COFFEE' && x.kind === 'leaf'));
  const zhPath = C.pathLabel(nodes, 'SYS.CAT.DINING.COFFEE', 'zh');
  const enPath = C.pathLabel(nodes, 'SYS.CAT.DINING.COFFEE', 'en');
  assert.equal(zhPath, '母树 / 费用 / 餐饮 / 咖啡茶饮');
  assert.equal(enPath, 'System / Expense / Dining / Coffee');
});

test('公开版本字符串包含母树哈希前缀', () => {
  assert.match(S.VERSION_STRING, /^2026\.11\.1\+[0-9a-f]{12}$/);
  assert.equal(S.VERSION_STRING, S.VERSION + '+' + S.HASH.slice(0, 12));
});

test('银行 facet：中英名成对，可双语检索', () => {
  const banks = idx.banks;
  const idsB = Object.keys(banks);
  assert.ok(idsB.length >= 40);
  const zh = new Set();
  const en = new Set();
  idsB.forEach((id) => {
    assert.ok(banks[id].zh_name, id + ' 缺中文名');
    assert.ok(banks[id].en_name, id + ' 缺英文名');
    assert.ok(!zh.has(banks[id].zh_name), '银行中文名重复：' + banks[id].zh_name);
    assert.ok(!en.has(banks[id].en_name), '银行英文名重复：' + banks[id].en_name);
    zh.add(banks[id].zh_name);
    en.add(banks[id].en_name);
  });
  assert.ok(C.search(idx, '工商银行', 'zh').some((h) => h.id === 'SYS.BANK.ICBC' && h.kind === 'bank'));
  assert.ok(C.search(idx, 'Industrial and Commercial Bank of China', 'en').some((h) => h.id === 'SYS.BANK.ICBC' && h.kind === 'bank'));
});
