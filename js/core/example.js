/* TxtVein · 示例账本
 * 第一次打开时生成：9 个节点、8 个标签、12 笔流水、2 条计划、2 条事件规则。
 * 特意保留一组冲突简码（wx / wx1 / wx2），让「气泡 + 数字后缀固化」可见。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  function createExample(vaultId, now) {
    const base = now instanceof Date ? new Date(now.getTime()) : new Date();
    const today = date.todayStamp(base);
    const day = (n) => date.addDays(today, n);
    const dict = dictMod.emptyDict(vaultId, base);
    const N = {};
    const T = {};

    const node = (key, spec) => {
      const r = dictMod.addNode(dict, spec);
      if (!r.ok) throw new Error('示例节点失败：' + key + ' / ' + r.error);
      N[key] = r.id;
      return r.id;
    };
    const tag = (key, spec) => {
      const r = dictMod.addTag(dict, spec);
      if (!r.ok) throw new Error('示例标签失败：' + key + ' / ' + r.error);
      T[key] = r.id;
      return r.id;
    };

    node('wx', {
      zh_name: '微信钱包', en_name: 'WeChat Wallet', zh_code: 'wx', en_code: 'wc',
      type: '资产', form: 'fluid', domain: 'P', weight: 120,
    });
    node('bank', {
      zh_name: '储蓄卡', en_name: 'Savings Card', zh_code: 'sav', en_code: 'sav',
      type: '资产', form: 'fluid', domain: 'P', weight: 120,
    });
    node('din', {
      zh_name: '餐饮', en_name: 'Dining', zh_code: 'din', en_code: 'din',
      type: '费用', form: 'steam', domain: 'P', weight: 110,
    });
    node('rent', {
      zh_name: '房租', en_name: 'Rent', zh_code: 'rent', en_code: 'rent',
      type: '费用', form: 'steam', domain: 'P', weight: 60,
    });
    node('salary', {
      zh_name: '工资', en_name: 'Salary', zh_code: 'sal', en_code: 'sal',
      type: '收入', domain: 'P', weight: 100,
    });
    node('cc', {
      zh_name: '信用卡', en_name: 'Credit Card', zh_code: 'cc', en_code: 'cc',
      type: '负债', domain: 'P', weight: 80,
    });
    node('coffee', {
      zh_name: '咖啡', en_name: 'Coffee', zh_code: 'cof', en_code: 'cof',
      type: '费用', form: 'steam', domain: 'P', weight: 90,
    });
    /* 冲突简码：维修费也叫 wx —— 气泡里 [1] 微信钱包 / [2] 维修费 */
    node('repair', {
      zh_name: '维修费', en_name: 'Repair', zh_code: 'wx', en_code: 'rep',
      type: '费用', form: 'steam', domain: 'P', weight: 10,
    });
    node('mac', {
      zh_name: '电脑', en_name: 'MacBook', zh_code: 'mac', en_code: 'mac',
      type: '成本', form: 'ice', domain: 'P', weight: 40,
    });
    node('equity', {
      zh_name: '期初权益', en_name: 'Opening Equity', zh_code: 'open', en_code: 'open',
      type: '权益', domain: 'P', weight: 0, system: true,
    });
    node('cbiz', {
      zh_name: '公司公户', en_name: 'Company Account', zh_code: 'cbiz', en_code: 'cbiz',
      type: '资产', form: 'fluid', domain: 'C', weight: 100,
    });
    node('adv', {
      zh_name: '老板垫付', en_name: 'Owner Advance', zh_code: 'adv', en_code: 'adv',
      type: '负债', domain: 'C', weight: 50,
    });
    node('office', {
      zh_name: '办公费', en_name: 'Office', zh_code: 'off', en_code: 'off',
      type: '费用', form: 'steam', domain: 'C', weight: 50,
    });

    tag('wife', { zh_name: '老婆', en_name: 'Wife', zh_code: 'lp', en_code: 'wife', domain: 'P', weight: 30 });
    tag('consume', { zh_name: '消费', en_name: 'Consume', zh_code: 'xf', en_code: 'con', domain: 'P', parent_id: T.wife, weight: 30 });
    tag('coffee', { zh_name: '咖啡', en_name: 'Coffee', zh_code: 'kf', en_code: 'coffee', domain: 'P', parent_id: T.consume, weight: 20 });
    tag('latte', { zh_name: '拿铁', en_name: 'Latte', zh_code: 'nt', en_code: 'latte', domain: 'P', parent_id: T.consume, weight: 20 });
    tag('takeout', { zh_name: '外卖', en_name: 'Takeout', zh_code: 'wm', en_code: 'tko', domain: 'P', parent_id: T.consume, weight: 20 });
    tag('transfer', { zh_name: '转账', en_name: 'Transfer', zh_code: 'zz', en_code: 'trf', domain: 'P', weight: 20 });
    tag('repay', { zh_name: '还款', en_name: 'Repay', zh_code: 'hk', en_code: 'rpy', domain: 'P', weight: 20 });
    tag('device', { zh_name: '设备', en_name: 'Device', zh_code: 'sb', en_code: 'dev', domain: 'P', weight: 10 });
    tag('advance', { zh_name: '垫付', en_name: 'Advance', zh_code: 'df', en_code: 'adv', domain: 'P', weight: 10 });
    tag('gain', { zh_name: '增益', en_name: 'Gain', zh_code: 'zy', en_code: 'gain', domain: 'P', kind: 'gain', weight: 10 });
    tag('drain', { zh_name: '阻抑', en_name: 'Drain', zh_code: 'zy2', en_code: 'drain', domain: 'P', kind: 'suppress', weight: 10 });
    tag('time', { zh_name: '时间', en_name: 'Time', zh_code: 'sj', en_code: 'time', domain: 'P', kind: 'time', weight: 10 });
    tag('company', { zh_name: '陪伴', en_name: 'Company', zh_code: 'pb', en_code: 'cmp', domain: 'P', weight: 10 });

    /* 行为层：只有 H_ 一种行为项，身体/心理只是树上的分支 */
    const H = {};
    const behavior = (key, spec) => {
      const id = TV.ids.newBehaviorItemId();
      dict.behaviors[id] = {
        zh_name: spec.zh_name, en_name: spec.en_name,
        zh_code: spec.zh_code, en_code: spec.en_code || spec.zh_code,
        domain: spec.domain || 'P',
        parent_id: spec.parent && H[spec.parent] ? H[spec.parent] : '',
        weight: spec.weight || 10,
        sort: spec.sort || 100,
        created_at: new Date().toISOString(),
      };
      H[key] = id;
      dictMod.addAlias(dict, spec.zh_code, id);
      dictMod.addAlias(dict, spec.zh_name, id);
      return id;
    };
    behavior('body', { zh_name: '身体行为', en_name: 'Physical', zh_code: 'body', en_code: 'body' });
    behavior('mind', { zh_name: '心理行为', en_name: 'Mental', zh_code: 'mind', en_code: 'mind' });
    behavior('movie', { zh_name: '看电影', en_name: 'Watch Movie', zh_code: 'movie', en_code: 'movie', parent: 'body' });
    behavior('happy', { zh_name: '开心', en_name: 'Happy', zh_code: 'happy', en_code: 'happy', parent: 'mind' });
    behavior('tired', { zh_name: '疲惫', en_name: 'Tired', zh_code: 'tired', en_code: 'tired', parent: 'body' });

    /* 冲突简码：wx 同时指向微信与维修费。
       不预置 wx1/wx2 —— 第一次在气泡里选 1/2 时才固化，才能看到「幽灵撤销」。 */

    const events = [];
    let seq = 0;
    const ev = (d, from, to, cents, tags, extra) => {
      seq += 1;
      events.push(Object.assign({
        id: 'E_' + String(seq).padStart(4, '0'),
        domain: (dict.nodes[from] && dict.nodes[from].domain) || 'P',
        date: d,
        from,
        to,
        amountCents: cents,
        minutes: 0,
        tagIds: tags || [],
        chainId: '',
        crossDomain: !!(dict.nodes[from] && dict.nodes[to] && dict.nodes[from].domain !== dict.nodes[to].domain),
        raw: '',
      }, extra || {}));
    };

    ev(day(-30), N.equity, N.bank, 500000, []);
    ev(day(-30), N.equity, N.wx, 100000, []);
    ev(day(-12), N.bank, N.wx, 50000, [T.transfer]);
    ev(day(-10), N.wx, N.din, 3500, [T.consume, T.coffee, T.latte]);
    ev(day(-8), N.salary, N.bank, 1000000, [], { domain: 'P' });
    ev(day(-6), N.cc, N.din, 80000, [T.consume, T.takeout]);
    ev(day(-5), N.wx, N.rent, 100000, [T.consume]);
    ev(day(-4), N.wx, N.cc, 20000, [T.repay]);
    ev(day(-3), N.bank, N.mac, 120000, [T.device]);
    ev(day(-2), N.wx, N.cbiz, 100000, [T.advance], { domain: 'P' });
    ev(day(-2), N.cbiz, N.office, 50000, [], { domain: 'C' });
    ev(day(-1), N.wx, N.din, 3500, [T.consume, T.coffee, T.latte, T.gain]);
    ev(day(-1), N.wx, N.din, 0, [T.time, T.company], { minutes: 60, amountCents: 0 });

    const behaviors = [{
      id: TV.ids.newBehaviorEventId(),
      kind: 'behavior',
      domain: 'P',
      date: day(-1),
      from: H.movie,
      to: H.happy,
      weight: 2,
      tagIds: [T.company],
      chainId: '',
      sourceLine: 0,
      raw: '',
    }];

    const plans = [
      {
        id: 'R_001', status: 'active', start: today, lastRun: today,
        period: 'm', domain: 'P', from: N.wx, to: N.rent,
        amountCents: 100000, tagIds: [T.consume], name: '房租每月',
        raw: 'R_001 active: 0 ' + N.wx + ' > ' + N.rent + ' 100000 ' + T.consume + ' *m last_run=' + today,
      },
      {
        id: 'R_002', status: 'active', start: today, lastRun: today,
        period: 'm', domain: 'P', from: N.salary, to: N.bank,
        amountCents: 1000000, tagIds: [], name: '工资每月',
        raw: 'R_002 active: 0 ' + N.salary + ' > ' + N.bank + ' 1000000 *m last_run=' + today,
      },
      {
        id: 'R_003', status: 'canceled', start: day(-90), lastRun: day(-60),
        period: 'm', domain: 'P', from: N.wx, to: N.din,
        amountCents: 1500, tagIds: [], name: '视频会员（已取消）',
        raw: 'R_003 canceled: 0 ' + N.wx + ' > ' + N.din + ' 1500 *m last_run=' + day(-60),
      },
    ];

    const rules = [
      {
        id: 'R_101', status: 'active',
        condition: 'keywords=(外卖)&amount<10000',
        keywords: ['外卖'], amountOp: '<', amountCents: 1000000,
        from: N.wx, to: N.din, tagIds: [T.takeout, T.consume], name: '外卖',
        raw: 'R_101 active: keywords=(外卖)&amount<10000 -> ' + N.wx + ' > ' + N.din + ' tags=' + T.takeout + ',' + T.consume + ' name=外卖',
      },
      {
        id: 'R_102', status: 'active',
        condition: 'keywords=(星巴克|拿铁)&amount<10000',
        keywords: ['星巴克', '拿铁'], amountOp: '<', amountCents: 1000000,
        from: N.wx, to: N.coffee, tagIds: [T.coffee, T.latte], name: '咖啡',
        raw: 'R_102 active: keywords=(星巴克|拿铁)&amount<10000 -> ' + N.wx + ' > ' + N.coffee + ' tags=' + T.coffee + ',' + T.latte + ' name=咖啡',
      },
    ];

    dict.meta.nextEvent = Math.max(Number(dict.meta.nextEvent) || 1, events.length + 1);
    dict.meta.nextRule = 200;
    dict.meta.nextPlan = 10;
    dict.meta.updatedAt = new Date().toISOString();

    return { dict, events, behaviors, plans, rules };
  }

  TV.example = { createExample };

  if (typeof module === 'object' && module.exports) module.exports = TV.example;
})(typeof globalThis !== 'undefined' ? globalThis : this);
