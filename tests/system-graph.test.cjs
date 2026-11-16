'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const S = TV.systemDict;
const C = TV.systemDictCore;
const idx = C.index(S);
const nodes = idx.nodes;

function ids() { return Object.keys(nodes); }

test('G1 单根：恰好一个 SYS', () => {
  const roots = ids().filter((id) => nodes[id].kind === 'root');
  assert.deepEqual(roots, ['SYS']);
});

test('G2 单父：每个非根恰好一个父级', () => {
  ids().forEach((id) => {
    if (id === 'SYS') {
      assert.equal(nodes[id].parent_id, '');
      return;
    }
    assert.ok(nodes[id].parent_id, id + ' 缺父级');
    assert.ok(nodes[nodes[id].parent_id], id + ' 父级不存在');
  });
});

test('G3 无环、连通', () => {
  ids().forEach((id) => assert.ok(nodes[id].depth >= 0, id + ' 不可达/成环'));
  const v = C.validate(idx);
  assert.equal(v.ok, true, JSON.stringify(v.issues.filter((x) => x.severity === 'error').slice(0, 5)));
});

test('G4 边数 = 节点数 - 1', () => {
  const edges = ids().filter((id) => nodes[id].parent_id).length;
  assert.equal(edges, ids().length - 1);
});

test('G5 层叠：任意两节点的叶子集不交或包含', () => {
  const all = ids();
  const sets = {};
  all.forEach((id) => { sets[id] = C.leafSet(nodes, id); });
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = sets[all[i]];
      const b = sets[all[j]];
      let inter = 0;
      a.forEach((x) => { if (b.has(x)) inter += 1; });
      assert.ok(inter === 0 || inter === a.size || inter === b.size,
        all[i] + ' / ' + all[j] + ' 叶子集相交但不包含');
    }
  }
});

test('G6/G7 内部节点至少 2 个子节点，且有 .GENERAL', () => {
  ids().forEach((id) => {
    const n = nodes[id];
    if (n.children.length === 0) return;
    assert.ok(n.children.length >= 2, id + ' 只有 1 个子节点');
    if (id !== 'SYS') {
      assert.ok(nodes[id + '.GENERAL'], id + ' 缺 .GENERAL');
      assert.equal(nodes[id + '.GENERAL'].parent_id, id);
    }
  });
});

test('G8 只有叶子可记账', () => {
  ids().forEach((id) => {
    const n = nodes[id];
    if (id === 'SYS') {
      assert.equal(n.postable, false);
      return;
    }
    assert.equal(n.postable, n.children.length === 0, id + ' postable 错');
  });
});

test('G9 深度 ≤3', () => {
  const max = Math.max(...ids().map((id) => nodes[id].depth));
  assert.ok(max <= 3, 'maxDepth=' + max);
});

test('G10 分支：SYS≤12，type≤20，其他内部≤15', () => {
  ids().forEach((id) => {
    const n = nodes[id];
    if (n.children.length === 0) return;
    const max = id === 'SYS' ? 12 : (n.kind === 'type' ? 20 : 15);
    assert.ok(n.children.length <= max, id + ' 分支 ' + n.children.length + ' > ' + max);
  });
});

test('G11 别名按语言唯一', () => {
  const seen = { zh: new Map(), en: new Map() };
  S.aliases.forEach((a) => {
    const key = a.lang + ':' + a.alias;
    assert.ok(!seen[a.lang].has(a.alias), '重复别名 ' + key);
    seen[a.lang].set(a.alias, a.id);
  });
});

test('G12 锚点是部分函数：母树节点没有 anchor_id', () => {
  ids().forEach((id) => assert.equal(nodes[id].anchor_id, undefined));
});

test('G13 商户 default_category 指向可记账叶子', () => {
  Object.keys(idx.merchants).forEach((id) => {
    const m = idx.merchants[id];
    assert.ok(nodes[m.default_category], id + ' 默认分类不存在');
    assert.equal(nodes[m.default_category].postable, true, id + ' 默认分类不是叶子');
  });
});

test('G14 前推前置：根叶子集 = 全部叶子', () => {
  const rootLeaves = C.leafSet(nodes, 'SYS');
  const leaves = ids().filter((id) => nodes[id].postable);
  assert.equal(rootLeaves.size, leaves.length);
  leaves.forEach((id) => assert.ok(rootLeaves.has(id), id + ' 不在根叶子集'));
});

test('G15 覆盖抽样：日常词能命中叶子', () => {
  const words = ['咖啡', '外卖', '打车', '房租', '超市', '话费', '看病', '学费',
    '电影', '酒店', '红包', '奶粉', '车险', '个税', '手续费', '差旅', '快递',
    '工资', '信用卡', '房贷', '微信', '支付宝', '公积金'];
  words.forEach((w) => {
    const hits = C.search(idx, w, 'zh');
    assert.ok(hits.some((h) => h.kind === 'leaf'), w + ' 没命中叶子：' + JSON.stringify(hits));
  });
});

test('G16 一个概念一个顶点：不建 .ZH / .EN 节点', () => {
  ids().forEach((id) => assert.ok(!/\.(ZH|EN)$/.test(id), id));
  const pairs = new Set();
  ids().forEach((id) => {
    const key = nodes[id].zh_name + '|' + nodes[id].en_name;
    assert.ok(!pairs.has(key), '中英名对重复：' + key);
    pairs.add(key);
  });
});

test('G17 中英文名成对非空', () => {
  ids().forEach((id) => {
    assert.ok(nodes[id].zh_name, id + ' 缺中文名');
    assert.ok(nodes[id].en_name, id + ' 缺英文名');
  });
});

test('G18 切语言不改变树：中英路径等长', () => {
  ids().forEach((id) => {
    const zh = C.path(nodes, id, 'zh');
    const en = C.path(nodes, id, 'en');
    assert.equal(zh.length, en.length, id);
    assert.ok(zh.every(Boolean), id + ' 中文路径有空');
    assert.ok(en.every(Boolean), id + ' 英文路径有空');
  });
});

test('G19 推荐码按语言唯一（Tree + Merchant）', () => {
  const seen = { zh: new Map(), en: new Map() };
  const add = (id, node) => {
    ['zh', 'en'].forEach((lang) => {
      const code = node[lang + '_code'];
      if (!code) return;
      assert.ok(!seen[lang].has(code), lang + ' 推荐码重复：' + code);
      seen[lang].set(code, id);
    });
  };
  ids().forEach((id) => { if (nodes[id].postable) add(id, nodes[id]); });
  Object.keys(idx.merchants).forEach((id) => add(id, idx.merchants[id]));
});

test('G20 推荐码不是身份：改码不改节点 ID', () => {
  const copy = C.index(S);
  const before = Object.keys(copy.nodes).sort().join(',');
  copy.nodes['SYS.CAT.DINING.COFFEE'].zh_code = 'changed';
  copy.nodes['SYS.CAT.DINING.COFFEE'].en_code = 'changed_en';
  const after = Object.keys(copy.nodes).sort().join(',');
  assert.equal(before, after);
});

test('统计：规模、版本与冻结', () => {
  assert.ok(S.stats.leafCount >= 140 && S.stats.leafCount <= 175, 'leaf=' + S.stats.leafCount);
  assert.ok(S.stats.nodeCount >= 170 && S.stats.nodeCount <= 210, 'node=' + S.stats.nodeCount);
  assert.ok(S.stats.merchantCount >= 20, 'merchant=' + S.stats.merchantCount);
  assert.ok(S.stats.bankCount >= 40, 'bank=' + S.stats.bankCount);
  assert.equal(S.stats.maxDepth, 3);
  assert.ok(S.stats.maxBranching <= 20);
  assert.match(S.VERSION_STRING, /^2026\.11\.1\+[0-9a-f]{12}$/);
  assert.ok(Object.isFrozen(S));
  assert.ok(Object.isFrozen(S.nodes));
  assert.ok(Object.isFrozen(S.nodes['SYS']));
  assert.ok(Object.isFrozen(S.banks));
});

test('G21 银行 facet：不占计数树，储蓄/借贷分列', () => {
  const banks = idx.banks;
  const bankIds = Object.keys(banks);
  assert.ok(bankIds.length >= 40, 'bankCount=' + bankIds.length);
  bankIds.forEach((id) => {
    const b = banks[id];
    assert.equal(nodes[id], undefined, id + ' 不应在计数树');
    assert.ok(nodes[b.savings_category], id + ' 储蓄分类不存在');
    assert.equal(nodes[b.savings_category].postable, true, id + ' 储蓄分类不是叶子');
    assert.equal(C.effectiveType(nodes, b.savings_category).type, '资产', id + ' 储蓄分类不是资产');
    if (b.credit_category) {
      assert.ok(nodes[b.credit_category], id + ' 借贷分类不存在');
      assert.equal(nodes[b.credit_category].postable, true, id + ' 借贷分类不是叶子');
      assert.equal(C.effectiveType(nodes, b.credit_category).type, '负债', id + ' 借贷分类不是负债');
    }
  });
  assert.ok(C.search(idx, '工商银行', 'zh').some((h) => h.id === 'SYS.BANK.ICBC' && h.kind === 'bank'));
});
