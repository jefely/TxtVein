'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const N = TV.ntBridge;

const SAMPLE = `账户：
类型，分类，简码，名称，期初，账单日，还款日，
资产类，储蓄，ZHC，招行储，100.00，，
负债类，信用，XYK，信用卡，0.00，，
收入类，工资，GZ，工资，0.00，，
费用类，日常，CY，餐饮，0.00，，
流水：
260801，ZHC，CY，35.50，午饭
260802，GZ，ZHC，1000.00，工资
`;

test('NT 明文：识别、转换、编译', () => {
  assert.equal(N.detect(SAMPLE), 'nt-text');
  const parsed = N.parseText(SAMPLE);
  assert.equal(parsed.accounts.length, 4);
  assert.equal(parsed.transactions.length, 2);
  const built = N.toTxtVein(parsed, { now: new Date(2026, 10, 16) });
  assert.equal(built.errors.length, 0, JSON.stringify(built.errors));
  assert.equal(built.events.length, 3); // 1 期初 + 2 流水
  const d = TV.source.compileDictSource(built.dictSource, { now: new Date(2026, 10, 16), system: TV.systemDict });
  assert.equal(d.ok, true, JSON.stringify(d.diagnostics.filter((x) => x.severity === 'error')));
  const l = TV.source.compileLedgerSource(built.ledgerSource, d.dict, { now: new Date(2026, 10, 16), domain: 'P' });
  assert.equal((l.errors || 0), 0, JSON.stringify((l.diagnostics || []).filter((x) => x.severity === 'error')));
  assert.equal(l.events.length, 3);
});

test('NT 明文：从 TxtVein 导出再解析', () => {
  const built = N.toTxtVein(N.parseText(SAMPLE), { now: new Date(2026, 10, 16) });
  const text = N.toNTText(built.dict, built.events);
  assert.match(text, /账户：/);
  assert.match(text, /流水：/);
  const parsed = N.parseText(text);
  assert.ok(parsed.accounts.length >= 4);
  assert.equal(parsed.transactions.length, 3); // 含期初事件
});

test('NT 加密备份：解包 + 解密 + 转 TxtVein', async () => {
  const state = {
    accounts: [
      { id: 'a1', type: '资产类', category: '现金', code: 'XJ', name: '现金', opening: 10 },
      { id: 'a2', type: '费用类', category: '日常', code: 'CY', name: '餐饮', opening: 0 },
    ],
    transactions: [
      { date: '2026-08-01', from_id: 'a1', to_id: 'a2', amount: 3.5, note: '早饭' },
    ],
  };
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', enc.encode('pw1234'), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(state))));
  const b64 = (u8) => Buffer.from(u8).toString('base64');
  const text = ['-----NT账本加密备份-----', '版本: 1', '盐: ' + b64(salt), 'IV: ' + b64(iv), '密文:', b64(cipher), '-----结束-----'].join('\n');
  assert.equal(N.detect(text), 'nt-backup');
  const out = await N.decryptBackup(text, 'pw1234');
  assert.equal(out.accounts.length, 2);
  const built = N.fromNTState(out);
  assert.equal(built.events.length, 2); // 期初 + 1 流水
  assert.equal(built.errors.length, 0, JSON.stringify(built.errors));
});


/* ---------- 固定收支 / 分期：与 NT 的 scheduled 对齐 ---------- */

function nodeIdByCode(dict, code) {
  return Object.keys(dict.nodes).find((id) => dict.nodes[id].zh_code === code);
}

test('互通：固定表计划 → NT scheduled（字段一一对应）', () => {
  const now = new Date(2026, 10, 19);
  const ex = TV.example.createExample('nt02', now);
  const from = nodeIdByCode(ex.dict, 'wx');
  const to = nodeIdByCode(ex.dict, 'rent');
  const plans = [
    {
      id: 'P_1', kind: 'fixed', period: 'm', day: 16, note: '房租',
      from, to, amountCents: 100000, tagIds: [], state: { generated: [], confirmed: [], voided: [] },
    },
    {
      id: 'P_2', kind: 'installment', period: 'm', day: 5, note: '分期',
      from, to, amountCents: 106000,
      inst: { periods: 12, firstMonth: '2608', principalCents: 1200000, interestCents: 72000 },
      state: { generated: [], confirmed: [], voided: [] },
    },
  ];
  const sched = TV.ntBridge.plansToScheduled(plans, ex.dict);
  assert.equal(sched.length, 2);
  assert.equal(sched[0].isScheduled, true);
  assert.equal(sched[0].freq, 'monthly');
  assert.equal(sched[0].day, 16);
  assert.equal(sched[0].amount, 1000, '元');
  assert.equal(sched[0].note, '房租');
  assert.equal(sched[1].inst.periods, 12);
  assert.equal(sched[1].inst.firstMonth, '2026-08');
  assert.equal(sched[1].inst.principal, 12000);
  assert.equal(sched[1].inst.interest, 720);
});

test('互通：NT scheduled → 固定表文本 → 再回 scheduled', () => {
  const now = new Date(2026, 10, 19);
  const ex = TV.example.createExample('nt03', now);
  const from = nodeIdByCode(ex.dict, 'wx');
  const to = nodeIdByCode(ex.dict, 'mac');
  const sched = [{
    id: 's1', isScheduled: true, freq: 'monthly', day: 10,
    from_id: from, to_id: to, amount: 1060, note: '电脑',
    inst: { periods: 12, firstMonth: '2026-08', principal: 12000, interest: 720 },
  }];
  const plans = TV.ntBridge.scheduledToPlans(sched, ex.dict);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].kind, 'installment');
  assert.equal(plans[0].day, 10);
  assert.equal(plans[0].amountCents, 106000);
  assert.equal(plans[0].inst.firstMonth, '2608');
  assert.equal(plans[0].inst.principalCents, 1200000);
  const text = TV.ntBridge.scheduledToFixedSource(sched, ex.dict);
  assert.ok(text.includes('[固定]') && text.includes('[分期]'), text);
  assert.ok(text.includes('期数=12') && text.includes('首月=2608'), text);
  assert.ok(text.includes('本金=12000') && text.includes('利息=720'), text);
  const back = TV.source.parsePlanSection(text, ex.dict, { now, domain: 'P' });
  assert.equal(back.plans.length, 1);
  assert.equal(back.plans[0].note, '电脑');
  const again = TV.ntBridge.plansToScheduled(back.plans, ex.dict);
  assert.equal(again[0].amount, 1060);
  assert.equal(again[0].inst.periods, 12);
  assert.equal(again[0].inst.firstMonth, '2026-08');
});

test('互通：toNTState 还原 planKey / voidedPlans', () => {
  const now = new Date(2026, 10, 19);
  const ex = TV.example.createExample('nt04', now);
  const from = nodeIdByCode(ex.dict, 'wx');
  const to = nodeIdByCode(ex.dict, 'rent');
  const plans = [{
    id: 'P_1', kind: 'fixed', period: 'm', day: 16, note: '',
    from, to, amountCents: 100000, tagIds: [],
    state: { generated: ['2611'], confirmed: [], voided: ['2701'] },
  }];
  const events = [{ date: '261116', from, to, amountCents: 100000, note: '' }];
  const state = TV.ntBridge.toNTState(ex.dict, events, plans);
  assert.equal(state.scheduled.length, 1);
  assert.equal(state.transactions[0].planKey, state.scheduled[0].id + '|2026-11');
  assert.deepEqual(state.voidedPlans, [state.scheduled[0].id + '|2027-01']);
});

test('互通：fromNTState 带回固定表文本与状态', () => {
  const state = {
    accounts: [
      { id: 'a1', type: '资产类', category: '现金', code: 'XJ', name: '现金', opening: 0 },
      { id: 'a2', type: '费用类', category: '日常', code: 'CY', name: '餐饮', opening: 0 },
    ],
    transactions: [],
    scheduled: [
      { id: 's1', isScheduled: true, freq: 'monthly', day: 5, from_id: 'a1', to_id: 'a2', amount: 30, note: '早饭' },
      {
        id: 's2', isScheduled: true, freq: 'monthly', day: 10, from_id: 'a1', to_id: 'a2', amount: 100,
        note: '分期', inst: { periods: 2, firstMonth: '2026-11', principal: 200, interest: 0 },
      },
    ],
    voidedPlans: ['s1|2026-12'],
  };
  const built = TV.ntBridge.fromNTState(state);
  assert.ok(built.fixedSource.includes('[固定]'), built.fixedSource);
  assert.ok(built.fixedSource.includes('每月5日'), built.fixedSource);
  assert.ok(built.fixedSource.includes('期数=2') && built.fixedSource.includes('首月=2611'), built.fixedSource);
  assert.equal(built.plans.length, 2);
  assert.deepEqual(built.plans[0].state.voided, ['2612']);
});


test('互通：NT 期初虚拟账户是隐藏账户，统计只看到账户期初', () => {
  const state = {
    accounts: [
      { id: 'a1', type: '资产类', category: '现金', code: 'XJ', name: '现金', opening: 10 },
      { id: 'a2', type: '费用类', category: '日常', code: 'CY', name: '餐饮', opening: 0 },
    ],
    transactions: [],
    scheduled: [],
  };
  const built = TV.ntBridge.fromNTState(state);
  const open = Object.values(built.dict.nodes).find((n) => n.zh_code === 'nt_open');
  assert.ok(open && open.system, '期初权益必须是 system（统计行隐藏）');
  const groups = TV.stats.groupStats(built.dict.nodes, built.events, { start: '260101', end: '261231' });
  assert.ok(!groups.some((g) => g.type === '权益'), '期初虚拟账户不应出权益表');
  const asset = groups.find((g) => g.type === '资产');
  assert.equal(asset.rows[0].c1, 1000, '期初 10 元 = 1000 分');
});
