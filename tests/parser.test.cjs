'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const NOW = new Date(2026, 10, 15, 10, 0, 0);

function fresh() {
  const ex = TV.example.createExample('test0001', NOW);
  return ex;
}

function parse(text, opts) {
  const ex = fresh();
  const dict = JSON.parse(JSON.stringify(ex.dict));
  const r = TV.parser.parseEntry(text, dict, Object.assign({
    now: NOW, domain: 'P', autoCreateTags: true, plans: ex.plans,
  }, opts || {}));
  return { r, dict, ex };
}

test('解析：基础转移只落 ID', () => {
  const { r, dict } = parse('wx1 > din 35 < 咖啡 < 拿铁');
  assert.equal(r.ok, true);
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.equal(e.date, '261115');
  assert.equal(e.from, 'N_001');
  assert.equal(e.to, 'N_003');
  assert.equal(e.amountCents, 3500);
  assert.equal(e.domain, 'P');
  assert.equal(e.tagIds.length, 2);
  assert.equal(e.raw, 'wx1 > din 35 < 咖啡 < 拿铁');
  assert.ok(dict.nodes[e.from] && dict.nodes[e.to]);
  assert.equal(r.preview.text, '微信钱包 > 餐饮 35 < 咖啡 < 拿铁');
});

test('解析：冲突简码返回候选，不静默绑定', () => {
  const { r } = parse('wx > din 35');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AMBIGUOUS');
  assert.equal(r.candidates.length, 2);
  assert.equal(r.role, 'from');
});

test('解析：数字后缀固化', () => {
  const ex = fresh();
  const dict = JSON.parse(JSON.stringify(ex.dict));
  delete dict.aliases.wx2;
  const r = TV.parser.parseEntry('wx2 > din 35', dict, {
    now: NOW, domain: 'P', autoCreateTags: true, plans: ex.plans,
  });
  assert.equal(r.ok, true);
  assert.equal(r.events[0].from, 'N_008');
  assert.deepEqual(dict.aliases.wx2, ['N_008']);
  assert.equal(r.binding[0].via, 'suffix');
});

test('解析：未绑定节点给创建建议', () => {
  const { r } = parse('不存在 > din 35');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'UNBOUND_NODE');
  assert.equal(r.suggest.zh_name, '不存在');
});

test('解析：缺金额 / 缺转入 / 只有转出', () => {
  assert.equal(parse('wx1 > din').r.code, 'MISSING_AMOUNT');
  assert.equal(parse('wx1 > 35').r.code, 'MISSING_TO');
  const lone = parse('wx1').r;
  assert.equal(lone.code, 'INCOMPLETE_FROM');
  assert.equal(lone.draft, true);
});

test('解析：链式转移展开为多笔，中间节点净额 0', () => {
  const { r } = parse('sav > wx1 > din 1000');
  assert.equal(r.ok, true);
  assert.equal(r.events.length, 2);
  assert.equal(r.chainId, 'C_001');
  assert.equal(r.events[0].amountCents, 100000);
  assert.equal(r.events[1].amountCents, 100000);
  assert.equal(r.events[0].chainId, 'C_001');
  assert.equal(r.preview.lossCents, 0);
});

test('解析：多金额链的差额进入损耗池，中间节点净额 0', () => {
  const { r } = parse('sav > wx1 > din 1000 995');
  assert.equal(r.ok, true);
  assert.equal(r.events.length, 3);
  assert.equal(r.events[0].amountCents, 100000);
  assert.equal(r.events[1].amountCents, 99500);
  const loss = r.events[2];
  assert.equal(loss.amountCents, 500);
  assert.equal(loss.from, 'N_001');
  assert.equal(loss.to, 'N_sys_loss');
  assert.equal(r.preview.lossCents, 500);
});

test('解析：多金额链的差额可进入增益池', () => {
  const { r } = parse('sav > wx1 > din 995 1000');
  assert.equal(r.ok, true);
  const gain = r.events[2];
  assert.equal(gain.from, 'N_sys_gain');
  assert.equal(gain.to, 'N_001');
  assert.equal(gain.amountCents, 500);
  assert.equal(r.preview.gainCents, 500);
});

test('解析：相对日期落盘前固化', () => {
  const { r } = parse('-1 wx1 > din 35');
  assert.equal(r.ok, true);
  assert.equal(r.events[0].date, '261114');
  assert.ok(r.warnings.some((x) => x.includes('固化')));
});

test('解析：周期规则同时生成当前流水与计划', () => {
  const { r } = parse('wx1 > rent 1000*m');
  assert.equal(r.ok, true);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].amountCents, 100000);
  assert.ok(r.plan);
  assert.equal(r.plan.period, 'm');
  assert.equal(r.plan.lastRun, '261115');
  assert.equal(r.plan.status, 'active');
});

test('解析：周期规则复用同签名计划', () => {
  const { r, ex } = parse('wx1 > rent 1000*m');
  // 示例里 R_001 就是 wx1 > rent 1000 *m，last_run 今天
  assert.equal(r.plan.id, 'R_001');
  assert.equal(ex.plans.length, 3);
});

test('解析：全角运算符与中文冒号', () => {
  const { r } = parse('wx1 ＞ din 35 ＜ 咖啡');
  assert.equal(r.ok, true);
  assert.equal(r.events[0].amountCents, 3500);
});

test('解析：# 行内标签', () => {
  const { r } = parse('wx1 > din 35 #拿铁 #咖啡');
  assert.equal(r.ok, true);
  assert.equal(r.events[0].tagIds.length, 2);
});

test('解析：标签层级 < 块间父子、块内同级', () => {
  const { r, dict } = parse('wx1 > din 35 < 老婆 < 新父 < 子一 子二');
  assert.equal(r.ok, true);
  const names = r.events[0].tagIds.map((id) => dict.tags[id].zh_name);
  const wifeId = r.events[0].tagIds.find((id) => dict.tags[id].zh_name === '老婆');
  const fatherId = r.events[0].tagIds.find((id) => dict.tags[id].zh_name === '新父');
  const one = r.events[0].tagIds.find((id) => dict.tags[id].zh_name === '子一');
  const two = r.events[0].tagIds.find((id) => dict.tags[id].zh_name === '子二');
  assert.ok(names.includes('老婆') && names.includes('新父') && names.includes('子一') && names.includes('子二'));
  assert.equal(dict.tags[fatherId].parent_id, wifeId);
  assert.equal(dict.tags[one].parent_id, fatherId);
  assert.equal(dict.tags[two].parent_id, fatherId);
});

test('解析：未知标签自动创建并报告', () => {
  const { r, dict } = parse('wx1 > din 35 < 新标签');
  assert.equal(r.ok, true);
  assert.equal(r.tagsCreated.length, 1);
  assert.equal(r.tagsCreated[0].name, '新标签');
  assert.ok(dict.tags[r.tagsCreated[0].id]);
});

test('解析：时间代币 60m 不进金额', () => {
  const { r } = parse('wx1 > din 60m < 时间');
  assert.equal(r.ok, true);
  assert.equal(r.events[0].minutes, 60);
  assert.equal(r.events[0].amountCents, 0);
  assert.equal(r.preview.amountLabel, '1h');
});

test('解析：跨域必须写明确前缀', () => {
  const noPrefix = parse('wx1 > cbiz 100').r;
  assert.equal(noPrefix.ok, false);
  assert.equal(noPrefix.code, 'CROSS_DOMAIN_PREFIX_REQUIRED');
  const ok = parse('wx1 > C:cbiz 100').r;
  assert.equal(ok.ok, true);
  assert.equal(ok.events[0].domain, 'P');
  assert.equal(ok.crossDomain, true);
});

test('解析：兼容旧写法（省略 >）', () => {
  const { r } = parse('wx1 din 35');
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((x) => x.includes('兼容')));
});

test('解析：金额数量与链段数不匹配被拒绝', () => {
  const { r } = parse('sav > wx1 > din 1000 900 800');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AMOUNT_COUNT');
});

test('解析：entryTextForEvent 用简码还原', () => {
  const { r, dict } = parse('wx1 > din 35 < 咖啡');
  const line = TV.parser.entryTextForEvent(r.events[0], dict);
  assert.ok(/^\d{6} /.test(line));
  assert.ok(line.includes('wx'));
  assert.ok(line.includes('>'));
  assert.ok(line.includes('din'));
  assert.ok(line.includes('3500'));
});
