'use strict';

/* 统计口径：照搬 NT账本 core/ledger-stats.js + core/stats-panels.js
 *
 * 这套测试的数据和断言逐项对应 nt/tests/stats-panels.test.mjs，
 * 只把「元」换成「分」、日期换成 YYMMDD、类型换成短名。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const ST = TV.stats;

function node(id, type, system) {
  return { id, zh_name: id, zh_code: id, type, system: !!system };
}

const nodes = {
  a: node('a', '资产'),
  b: node('b', '资产'),
  z: node('z', '资产'),
  c: node('c', '成本'),
  l: node('l', '负债'),
  l2: node('l2', '负债'),
  i: node('i', '收入'),
  e: node('e', '费用'),
  dep: node('dep', '费用'),
  open: node('open', '权益', true),
};

const tx = (date, from, to, amountCents) => ({
  date, from, to, amountCents, kind: 'account',
});

const events = [
  /* 储蓄卡：期初 1000，1 月支出 100 → 期初 900；2 月流入 500、流出 200 → 期末 1200 */
  tx('260101', 'open', 'a', 100000),
  tx('260110', 'a', 'z', 10000),
  tx('260205', 'z', 'a', 50000),
  tx('260206', 'a', 'z', 20000),
  /* 微信：1 月充 20000、买电脑 10000 → 期初 10000（本期无进出） */
  tx('260120', 'z', 'b', 2000000),
  tx('260121', 'b', 'c', 1000000),
  /* 电脑（成本）：1 月建仓 10000；2 月折旧 2000 → 期末净值 8000 */
  tx('260220', 'c', 'dep', 200000),
  /* 负债：1 月欠 1000；2 月新增 200、还 50 → 1150 */
  tx('260111', 'l', 'z', 100000),
  tx('260210', 'l', 'z', 20000),
  tx('260211', 'z', 'l', 5000),
  /* 另一张负债卡：历史转入 1000、没有转出 —— 按应付口径是 -1000（多还） */
  tx('260115', 'z', 'l2', 100000),
  tx('260213', 'z', 'l2', 10000),
  tx('260214', 'l2', 'z', 3000),
  /* 收入：2 月收入 500、退回 20 → 期末累计 480 */
  tx('260205', 'i', 'z', 50000),
  tx('260212', 'z', 'i', 2000),
  /* 费用：1 月花 150、退回 30（都进历史累计）；2 月花 200、退回 10 */
  tx('260105', 'z', 'e', 15000),
  tx('260108', 'e', 'z', 3000),
  tx('260206', 'z', 'e', 20000),
  tx('260212', 'e', 'z', 1000),
];

const range = { start: '260201', end: '260228' };

function groups() {
  return ST.groupStats(nodes, events, range);
}
function row(type, key, list) {
  const g = (list || groups()).find((x) => x.type === type);
  return g && g.rows.find((r) => r.key === key);
}
function group(type, list) {
  return (list || groups()).find((x) => x.type === type);
}

test('收入：期初累计 / 本期收入 / 本期退回 / 期末累计', () => {
  const w = row('收入', 'i');
  assert.deepEqual({ ...w }, {
    id: 'i', key: 'i', count: 1, c1: 0, c2: 50000, c3: 2000, c4: 48000,
  });
});

test('负债：期初余额 / 本期新增（转出）/ 本期偿还（转入）/ 期末余额', () => {
  const l = row('负债', 'l');
  assert.equal(l.c1, 100000);
  assert.equal(l.c2, 20000);
  assert.equal(l.c3, 5000);
  assert.equal(l.c4, 115000);
});

test('负债转入大于转出时余额为负（多还），不硬掰成正欠款', () => {
  const l = row('负债', 'l2');
  assert.equal(l.c1, -100000);
  assert.equal(l.c2, 3000);
  assert.equal(l.c3, 10000);
  assert.equal(l.c4, -107000);
  assert.equal(ST.statMoney(l.c4, '负债', 'c4'), '多还 1070.0');
  assert.equal(ST.statMoney(l.c2, '负债', 'c2'), '30.0');
});

test('资产：期初余额 / 本期流入 / 本期流出 / 期末余额', () => {
  const a = row('资产', 'a');
  assert.equal(a.c1, 90000);
  assert.equal(a.c2, 50000);
  assert.equal(a.c3, 20000);
  assert.equal(a.c4, 120000);
});

test('费用：本期累计 = 到本期结束的累计净额（退回要扣）', () => {
  const e = row('费用', 'e');
  // 1 月 150/30 + 2 月 200/10 → (150+200) − (30+10) = 310。
  assert.equal(e.c1, 31000);
  assert.equal(e.c2, 20000);
  assert.equal(e.c3, 1000);
});

test('费用：滚动递推 —— 本期累计 = 上期累计 + 本期净出', () => {
  const jan = ST.groupStats(nodes, events, { start: '260101', end: '260131' });
  const feb = ST.groupStats(nodes, events, { start: '260201', end: '260228' });
  const j = row('费用', 'e', jan);
  const f = row('费用', 'e', feb);
  assert.equal(j.c1, 12000, '1 月累计 = 150 − 30');
  assert.equal(f.c1, j.c1 + f.c4, '2 月累计 = 1 月的 120 + 2 月净出 190');
  assert.equal(f.c1, 31000);
});

test('费用：第 4 列是本期净出，不是期末余额', () => {
  const e = row('费用', 'e');
  assert.equal(e.c4, 19000, '净出 = 本期支出 200 − 本期退回 10');
});

test('成本：期初净值 / 本期新增 / 本期消耗 / 期末净值', () => {
  const c = row('成本', 'c');
  assert.equal(c.c1, 1000000, '期初净值 = 1 月建仓 10000');
  assert.equal(c.c2, 0, '本期没有新买入');
  assert.equal(c.c3, 200000, '本期消耗 = 折旧');
  assert.equal(c.c4, 800000);
});

test('六类顺序固定为 收入 / 负债 / 权益 / 资产 / 费用 / 成本；空类不占表', () => {
  const got = groups().map((g) => g.type);
  assert.deepEqual(got, ['收入', '负债', '资产', '费用', '成本']);
});

test('每类合计 = 该类各行相加（不另算一套口径）', () => {
  for (const g of groups()) {
    for (const k of ['c1', 'c2', 'c3', 'c4']) {
      const sum = g.rows.reduce((n, r) => n + r[k], 0);
      assert.equal(g.total[k], sum, `${g.type} 的 ${k} 合计对不上`);
    }
  }
});

test('全零行 / 全零类型不占位置；期初权益虚拟账户不出统计行', () => {
  const empty = { ...nodes, zero: node('zero', '资产') };
  const g = ST.groupStats(empty, events, range);
  assert.ok(!row('资产', 'zero', g));
  assert.ok(!g.some((x) => x.type === '权益'), '只有期初权益时不该出权益表');
  assert.ok(!g.some((x) => x.rows.some((r) => r.key === 'open')));
});

test('统计行的转出 / 转入永远是正数；只有余额列可能为负', () => {
  for (const g of groups()) {
    for (const r of g.rows) {
      assert.ok(r.c2 >= 0, `${g.type}/${r.key} 的转出列不应为负`);
      assert.ok(r.c3 >= 0, `${g.type}/${r.key} 的转入列不应为负`);
    }
  }
});

test('statCells：A 极与 B 极方向相反，费用同 A 极、只差第 1 和第 4 列', () => {
  const s = { periodIn: 100, periodOut: 30, historyIn: 1000, historyOut: 400 };
  assert.deepEqual(ST.statCells(s, '负债'),
    { c1: -600, c2: 30, c3: 100, c4: -670 });
  assert.deepEqual(ST.statCells(s, '资产'),
    { c1: 600, c2: 100, c3: 30, c4: 670 });
  assert.deepEqual(ST.statCells(s, '费用'),
    { c1: 670, c2: 100, c3: 30, c4: 70 });
  assert.deepEqual(ST.statCells(s, '成本'), ST.statCells(s, '资产'));
});

test('统计金额：1 位小数、不带 ¥ / 千分位；负债负余额写「多还」', () => {
  assert.equal(ST.statMoney(123456, '资产', 'c1'), '1234.6');
  assert.equal(ST.statMoney(0, '资产', 'c1'), '0.0');
  assert.equal(ST.statMoney(-30000, '负债', 'c1'), '多还 300.0');
  assert.equal(ST.statMoney(-30000, '资产', 'c4'), '-300.0');
  assert.equal(ST.statMoney(50000, '收入', 'c2'), '500.0');
});


test('分类汇总：多个节点按 category_key 合成一行，未分类单独一行', () => {
  const ns = {
    a1: { id: 'a1', zh_name: 'a1', zh_code: 'a1', type: '资产', category_key: 'cash' },
    a2: { id: 'a2', zh_name: 'a2', zh_code: 'a2', type: '资产', category_key: 'cash' },
    a3: { id: 'a3', zh_name: 'a3', zh_code: 'a3', type: '资产', category_key: 'transit' },
    a4: { id: 'a4', zh_name: 'a4', zh_code: 'a4', type: '资产' },
  };
  const evs = [
    tx('260101', 'open', 'a1', 10000),
    tx('260205', 'a1', 'a2', 5000),
    tx('260206', 'a2', 'a3', 2000),
    /* a4 没有流水：分类行应被过滤 */
  ];
  const g = ST.groupStats(ns, evs, range, { keyOf: (n) => n.category_key || '' });
  const assets = g.find((x) => x.type === '资产');
  const cash = assets.rows.find((r) => r.key === 'cash');
  const transit = assets.rows.find((r) => r.key === 'transit');
  assert.ok(cash && transit);
  assert.deepEqual({ c1: cash.c1, c2: cash.c2, c3: cash.c3, c4: cash.c4 },
    { c1: 10000, c2: 5000, c3: 7000, c4: 8000 });
  assert.deepEqual({ c1: transit.c1, c2: transit.c2, c3: transit.c3, c4: transit.c4 },
    { c1: 0, c2: 2000, c3: 0, c4: 2000 });
  /* 合计 = 各行相加 */
  for (const k of ['c1', 'c2', 'c3', 'c4']) {
    assert.equal(assets.total[k], cash[k] + transit[k]);
  }
  /* 无 classification 的 a4 没流水，不出现；open 是系统账户，也不出现 */
  assert.equal(cash.count, 2, 'cash 两个节点合成一行');
  assert.ok(!assets.rows.some((r) => r.key === '未分类'));
});


test('统计分类显示名：dict.categories 优先，未分类兜底', () => {
  const cats = [
    { key: 'C_1', name: '日常', en_name: 'Daily' },
    { key: 'C_2', name: '生活', en_name: '' },
  ];
  assert.equal(ST.categoryLabel(cats, 'C_1', 'zh'), '日常');
  assert.equal(ST.categoryLabel(cats, 'C_1', 'en'), 'Daily');
  assert.equal(ST.categoryLabel(cats, 'C_2', 'en'), '生活');
  assert.equal(ST.categoryLabel(cats, '', 'zh'), '未分类');
  assert.equal(ST.categoryLabel(cats, 'C_9', 'zh'), 'C_9');
});


test('期初虚拟账户：旧导入没写 system 时，统计里也按隐藏处理', () => {
  const ns = {
    open: { id: 'open', zh_name: '期初权益', zh_code: 'nt_open', type: '权益' },
    a1: { id: 'a1', zh_name: 'a1', zh_code: 'a1', type: '资产' },
  };
  const evs = [tx('000101', 'open', 'a1', 10000)];
  const g = ST.groupStats(ns, evs, range);
  assert.ok(!g.some((x) => x.type === '权益'), '旧期初账户不应出权益表');
  assert.equal(g.find((x) => x.type === '资产').rows[0].c1, 10000);
  assert.equal(ST.isHiddenAccount(ns.open), true);
});
