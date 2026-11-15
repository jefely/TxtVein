'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);
const EX = TV.example.createExample('test0001', NOW);

function ledgerText(link) {
  return TV.ledgerFile.serializeLedger({
    vaultId: 'test0001', link: link || '', events: EX.events, plans: EX.plans, rules: EX.rules,
  });
}

test('流水文件：序列化只写 ID，不写名字', () => {
  const txt = ledgerText();
  assert.ok(txt.startsWith('# TxtVein ledger'));
  assert.ok(txt.includes('N_001'));
  assert.ok(!txt.includes('微信钱包'));
  assert.ok(txt.includes('T_03'));
  assert.ok(txt.includes('[PLAN]'));
  assert.ok(txt.includes('[RULES]'));
});

test('流水文件：往返不丢事件/计划/规则', () => {
  const txt = ledgerText('deadbeef');
  const p = TV.ledgerFile.parseLedger(txt, { dict: EX.dict });
  assert.equal(p.events.length, 13);
  assert.equal(p.plans.length, 3);
  assert.equal(p.rules.length, 2);
  assert.equal(p.warnings.length, 0);
  assert.equal(p.vaultId, 'test0001');
  assert.equal(p.link, 'deadbeef');
  assert.equal(p.events[0].from, 'N_010');
  assert.equal(p.events[0].amountCents, 500000);
  assert.equal(p.events[12].minutes, 60);
});

test('后台换算：金额存整数分，时间存整数分钟', () => {
  const e1 = Object.assign({}, EX.events[0], { id: 'E_9001', amountCents: 12345, minutes: 0 });
  const e2 = Object.assign({}, EX.events[0], { id: 'E_9002', amountCents: 0, minutes: 1590 });
  const txt = TV.ledgerFile.serializeLedger({
    vaultId: 'test0001', link: '', events: [e1, e2], plans: [], rules: [],
  });
  assert.ok(/P \d{6} \S+ > \S+ 12345/.test(txt), txt);
  assert.ok(/1590m/.test(txt), txt);
  const p = TV.ledgerFile.parseLedger(txt, { dict: EX.dict });
  assert.equal(p.events[0].amountCents, 12345);
  assert.equal(p.events[0].minutes, 0);
  assert.equal(p.events[1].amountCents, 0);
  assert.equal(p.events[1].minutes, 1590);
});

test('流水文件：LINK 行不参与哈希', () => {
  const a = ledgerText('aaaa');
  const b = ledgerText('bbbb');
  assert.equal(TV.ledgerFile.bodyForHash(a), TV.ledgerFile.bodyForHash(b));
});

test('流水文件：setLink / getLink', () => {
  const txt = TV.ledgerFile.setLink(ledgerText(''), 'abc123');
  assert.equal(TV.ledgerFile.getLink(txt), 'abc123');
  const again = TV.ledgerFile.setLink(txt, 'def456');
  assert.equal(TV.ledgerFile.getLink(again), 'def456');
  assert.equal((again.match(/# LINK:/g) || []).length, 1);
});

test('流水文件：校验能抓出未绑定节点', () => {
  const bad = EX.events.concat([{ date: '261115', from: 'N_X', to: 'N_001', amountCents: 1, tagIds: [] }]);
  const issues = TV.ledgerFile.validateLedger(EX.dict, bad, EX.plans);
  assert.ok(issues.some((x) => x.code === 'EVENT_FROM'));
});

test('字典文件：往返与 canonical 稳定', () => {
  const txt = TV.dictFile.serializeDict(EX.dict);
  const p = TV.dictFile.parseDict(txt);
  assert.equal(p.ok, true);
  assert.equal(Object.keys(p.dict.nodes).length, 13);
  assert.equal(Object.keys(p.dict.tags).length, 13);
  assert.equal(p.dict.aliases.wx.length, 2);
  const a = TV.dictFile.bodyForHash(EX.dict);
  const b = TV.dictFile.bodyForHash(Object.assign(JSON.parse(JSON.stringify(EX.dict)), { link: 'x' }));
  assert.equal(a, b);
  const reordered = {};
  Object.keys(EX.dict).sort().reverse().forEach((k) => { reordered[k] = EX.dict[k]; });
  assert.equal(TV.dictFile.bodyForHash(reordered), a);
});

test('字典文件：拒绝坏 JSON', () => {
  assert.equal(TV.dictFile.parseDict('{oops').ok, false);
  assert.equal(TV.dictFile.parseDict('[1,2]').ok, false);
});

test('字典文件：setLink', () => {
  const txt = TV.dictFile.serializeDict(EX.dict);
  const next = TV.dictFile.setLink(txt, 'abc123');
  assert.equal(TV.dictFile.getLink(next), 'abc123');
});

test('流水文件：链式与时间行可往返', () => {
  const dict = JSON.parse(JSON.stringify(EX.dict));
  const r = TV.parser.parseEntry('sav > wx1 > din 1000 995', dict, { now: NOW, domain: 'P' });
  assert.equal(r.ok, true);
  const txt = TV.ledgerFile.serializeLedger({ vaultId: 'x', link: '', events: r.events, plans: [], rules: [] });
  assert.ok(txt.includes('^C_001'));
  const p = TV.ledgerFile.parseLedger(txt, { dict });
  assert.equal(p.events.length, 3);
  assert.equal(p.events[0].chainId, 'C_001');
  assert.equal(p.events[2].amountCents, 500);
});
