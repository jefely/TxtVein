/* TxtVein · 统计口径（照搬 NT账本 core/ledger-stats.js + core/stats-panels.js）
 *
 * 六类 × 四列，数学只有三套：
 *   B 极（收入/负债/权益）  期初 = 历史转出 − 历史转入
 *                          本期增 = 本期转出   本期减 = 本期转入
 *   A 极（资产/成本）       期初 = 历史转入 − 历史转出
 *                          本期增 = 本期转入   本期减 = 本期转出
 *   费用（同 A 极，但第 1/4 列不同）
 *                          本期累计 = 到本期结束的累计净支出（转入 − 转出）
 *                          第 4 列   = 本期净出，不是期末余额
 *
 * 关键约定（与 NT 完全一致）：
 *   · 金额永远是正数，转出/转入只由 from/to 决定方向；不存负数流水。
 *   · 期初是「本期开始前」的历史净额；期初权益是真实流水，但它本身是隐藏
 *     虚拟账户，不出现在统计行里 —— 期初只体现在各账户第 1 列。
 *   · 费用第 1 列看「到本期结束」，所以它正好等于资产的期末。
 *   · 每类合计 = 该类各行逐列相加；全零行 / 全零类型不占表。
 *
 * 纯函数：不碰 DOM / 存储 / 时钟。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  const STAT_ORDER = ['收入', '负债', '权益', '资产', '费用', '成本'];
  const DEBIT_TYPES = ['资产', '费用', '成本'];

  const TYPE_EN = {
    收入: 'Income', 负债: 'Debt', 权益: 'Equity',
    资产: 'Asset', 费用: 'Expense', 成本: 'Cost',
  };

  const STAT_COLS = {
    收入: ['期初累计', '本期收入', '本期退回', '期末累计'],
    负债: ['期初余额', '本期新增', '本期偿还', '期末余额'],
    权益: ['期初余额', '本期增加', '本期减少', '期末余额'],
    资产: ['期初余额', '本期流入', '本期流出', '期末余额'],
    费用: ['本期累计', '本期支出', '本期退回', '本期净出'],
    成本: ['期初净值', '本期新增', '本期消耗', '期末净值'],
  };

  const STAT_COLS_EN = {
    收入: ['Open', 'Income', 'Refund', 'Close'],
    负债: ['Open', 'Borrow', 'Repay', 'Close'],
    权益: ['Open', 'Add', 'Cut', 'Close'],
    资产: ['Open', 'In', 'Out', 'Close'],
    费用: ['Total', 'Spend', 'Refund', 'Net'],
    成本: ['Open', 'Add', 'Used', 'Close'],
  };

  const FIELDS = ['c1', 'c2', 'c3', 'c4'];

  /** 类型归一：'资产类' → '资产'；未知类型原样返回。 */
  function typeOf(nodeOrType) {
    const raw = typeof nodeOrType === 'string' ? nodeOrType : (nodeOrType && nodeOrType.type);
    const t = S(raw).trim();
    return t.endsWith('类') ? t.slice(0, -1) : t;
  }

  function isDebitType(type) {
    return DEBIT_TYPES.includes(typeOf(type));
  }

  /** 期初虚拟账户：NT 导入时可能没写 system（旧版本），统计里也按隐藏处理。 */
  function isHiddenAccount(node) {
    if (!node) return true;
    if (node.system || node.hidden) return true;
    const code = S(node.zh_code);
    return typeOf(node) === '权益'
      && (code === 'nt_open' || code === 'ntg_open' || code === 'legacy_open' || code === 'open');
  }

  /** 只认已发生的金额流水；时间代币、行为边、0 金额都不进金额统计。 */
  function isPosted(e) {
    return !!e && e.kind !== 'behavior'
      && Math.round(Number(e.amountCents) || 0) > 0;
  }

  function emptyCells() {
    return { c1: 0, c2: 0, c3: 0, c4: 0 };
  }

  function addCells(target, cell) {
    FIELDS.forEach((k) => { target[k] = Math.round((target[k] || 0) + (cell[k] || 0)); });
    return target;
  }

  function hasValue(cell) {
    return FIELDS.some((k) => Math.round(Number(cell[k]) || 0) !== 0);
  }

  /**
   * 单账户汇总（NT accountSummary 的同口径，金额单位为分）。
   * @param {{id:string,type:string}} account
   * @param {Array} events
   * @param {{start?:string,end?:string}} [range]  YYMMDD
   */
  function accountSummary(account, events, range) {
    const id = account && account.id;
    const start = S(range && range.start) || '000000';
    const end = S(range && range.end) || '999999';
    const out = {
      opening: 0, balance: 0,
      periodOut: 0, periodIn: 0,
      historyOut: 0, historyIn: 0, historyBalance: 0,
    };
    if (!id) return out;

    let totalOut = 0;
    let totalIn = 0;
    for (const e of events || []) {
      if (!isPosted(e)) continue;
      const amt = Math.round(Number(e.amountCents) || 0);
      const isOut = e.from === id;
      const isIn = e.to === id;
      if (!isOut && !isIn) continue;

      if (isOut) totalOut += amt;
      if (isIn) totalIn += amt;

      const d = S(e.date);
      if (d >= start && d <= end) {
        if (isOut) out.periodOut += amt;
        if (isIn) out.periodIn += amt;
      } else if (d < start) {
        if (isOut) out.historyOut += amt;
        if (isIn) out.historyIn += amt;
      }
    }

    const debit = isDebitType(account.type);
    out.balance = debit ? totalIn - totalOut : totalOut - totalIn;
    out.historyBalance = debit
      ? out.historyIn - out.historyOut
      : out.historyOut - out.historyIn;
    return out;
  }

  /**
   * 一个账户（或一组账户的合计）在某类下的 4 列。
   * @param {{periodIn?:number,periodOut?:number,historyIn?:number,historyOut?:number}} s
   * @param {string} type
   */
  function statCells(s, type) {
    const row = s || {};
    const t = typeOf(type);
    const periodIn = Number(row.periodIn) || 0;
    const periodOut = Number(row.periodOut) || 0;
    const historyIn = Number(row.historyIn) || 0;
    const historyOut = Number(row.historyOut) || 0;

    if (t === '费用') {
      return {
        c1: Math.round((historyIn + periodIn) - (historyOut + periodOut)),
        c2: Math.round(periodIn),
        c3: Math.round(periodOut),
        c4: Math.round(periodIn - periodOut),
      };
    }

    const debit = isDebitType(t);
    const begin = debit ? historyIn - historyOut : historyOut - historyIn;
    const add = debit ? periodIn : periodOut;
    const red = debit ? periodOut : periodIn;
    return {
      c1: Math.round(begin),
      c2: Math.round(add),
      c3: Math.round(red),
      c4: Math.round(begin + add - red),
    };
  }

  /**
   * 聚合六类小表。
   *
   * @param {object} nodes  dict.nodes（id → node）
   * @param {Array} events
   * @param {{start?:string,end?:string}} range
   * @param {object} [opts]
   *   · keyOf(node) → 第一列文字（分类名 / 节点名）
   *   · includeSystem  默认 false：期初权益等虚拟账户不出现在统计行
   * @returns {Array<{type:string,total:object,rows:Array<{key,count,c1..c4,id}>}>}
   */
  function groupStats(nodes, events, range, opts) {
    const o = opts || {};
    const keyOf = typeof o.keyOf === 'function'
      ? o.keyOf
      : (n) => n.zh_name || n.zh_code || n.id;
    const includeSystem = !!o.includeSystem;
    const byType = new Map();

    Object.keys(nodes || {}).forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      if (!includeSystem && isHiddenAccount(node)) return;
      const type = typeOf(node);
      const acc = Object.assign({}, node, { id });
      const summary = accountSummary(acc, events, range);
      const cell = statCells(summary, type);
      const key = S(keyOf(acc)).trim() || '未分类';

      if (!byType.has(type)) {
        byType.set(type, { type, total: emptyCells(), map: new Map() });
      }
      const group = byType.get(type);
      addCells(group.total, cell);

      if (!group.map.has(key)) {
        group.map.set(key, { id, key, count: 0, ...emptyCells() });
      }
      const row = group.map.get(key);
      row.count += 1;
      addCells(row, cell);
    });

    const out = [];
    const emit = (type, group) => {
      const rows = [...group.map.values()]
        .filter(hasValue)
        .sort((a, b) => (Math.abs(b.c4) - Math.abs(a.c4))
          || String(a.key).localeCompare(String(b.key), 'zh'));
      if (!rows.length) return;
      out.push({ type, total: group.total, rows });
    };

    STAT_ORDER.forEach((type) => {
      const group = byType.get(type);
      if (group) { emit(type, group); byType.delete(type); }
    });
    /* 六类之外的脏类型也别吞掉 */
    byType.forEach((group, type) => emit(type, group));
    return out;
  }

  /** 统计分类显示名：优先 dict.categories 里的名字。 */
  function categoryLabel(categories, key, lang) {
    const k = S(key);
    if (!k || k === '未分类') return lang === 'en' ? 'Other' : '未分类';
    const list = Array.isArray(categories) ? categories : [];
    const c = list.find((x) => x && x.key === k) || list.find((x) => x && x.name === k);
    if (!c) return k;
    return lang === 'en' ? (c.en_name || c.name || k) : (c.name || k);
  }

  /** 统计小表的金额：1 位小数、不带 ¥、不带千分位（NT 同款）。 */
  function statMoney(cents, type, field) {
    const n = Math.round(Number(cents) || 0);
    const abs = Math.abs(n);
    const txt = abs === 0 ? '0' : (abs / 100).toFixed(1);
    /* 负债的负余额 = 多还；其余负余额保留负号（NT 口径） */
    if (n < 0 && typeOf(type) === '负债' && (field === 'c1' || field === 'c4')) {
      return '多还 ' + txt;
    }
    return (n < 0 ? '-' : '') + txt;
  }

  TV.stats = {
    STAT_ORDER,
    DEBIT_TYPES,
    FIELDS,
    TYPE_EN,
    STAT_COLS,
    STAT_COLS_EN,
    typeOf,
    isDebitType,
    isPosted,
    isHiddenAccount,
    emptyCells,
    addCells,
    hasValue,
    accountSummary,
    statCells,
    groupStats,
    categoryLabel,
    statMoney,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.stats;
})(typeof globalThis !== 'undefined' ? globalThis : this);
