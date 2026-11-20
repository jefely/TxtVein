/* TxtVein ↔ NT账本 文本桥
 *
 * NT 的纯文本格式：
 *   账户：
 *   资产类，储蓄，ZHC，招行储，0.00，
 *   流水：
 *   260801，ZHC，S，3.5，午饭
 *
 * TxtVein 不直接依赖 NT 的 state；这里只做纯文本 ↔ TxtVein 源码。
 * NT 加密备份：-----NT账本加密备份-----（PBKDF2-SHA256 150000 + AES-GCM）
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const TYPE_IN = { 资产类: '资产', 负债类: '负债', 权益类: '权益', 收入类: '收入', 费用类: '费用', 成本类: '成本' };
  const TYPE_OUT = { 资产: '资产类', 负债: '负债类', 权益: '权益类', 收入: '收入类', 费用: '费用类', 成本: '成本类' };

  function norm(s) { return S(s).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); }
  function cells(line) { return S(line).split(/[，,\t|、]/).map((x) => x.trim()).filter((x, i, a) => !(i === a.length - 1 && !x)); }
  function dateShort(v) {
    const d = S(v).replace(/[^0-9]/g, '');
    if (d.length >= 8) return d.slice(-6);
    if (d.length === 6) return d;
    return d;
  }
  function cents(v) {
    const n = Number(String(v == null ? 0 : v).replace(/[¥,\s]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  function codeSafe(v) {
    return S(v).trim().replace(/[\s\u3000]+/g, '_').replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, '') || 'x';
  }

  function isNTBackup(text) {
    return norm(text).replace(/\s+/g, '').includes('-----NT账本加密备份-----');
  }

  function isNTText(text) {
    return /(^|\n)\s*(账户|流水)\s*[:：]/.test(norm(text));
  }

  function parseText(text) {
    const lines = norm(text).split('\n');
    const accounts = [];
    const transactions = [];
    const errors = [];
    let cur = '';
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      if (/^(账户|賬戶)\s*[:：]?$/.test(line)) { cur = 'account'; return; }
      if (/^流水\s*[:：]?$/.test(line)) { cur = 'tx'; return; }
      const c = cells(line);
      if (!c.length) return;
      if (cur === 'account') {
        if (c[0] === '类型') return;
        const type = TYPE_IN[c[0]];
        if (!type) { errors.push({ line: i + 1, message: '账户类型认不出：' + c[0] }); return; }
        if (!c[3]) { errors.push({ line: i + 1, message: '账户缺名称' }); return; }
        accounts.push({
          type, category: c[1] || '', code: codeSafe(c[2] || c[3]),
          name: c[3], openingCents: cents(c[4] || 0), line: i + 1,
        });
        return;
      }
      if (cur === 'tx') {
        if (c[0] === '日期') return;
        const date = dateShort(c[0]);
        if (!date || c.length < 4 || !c[1] || !c[2]) {
          errors.push({ line: i + 1, message: '流水行不足：日期 / 转出 / 转入 / 金额' });
          return;
        }
        transactions.push({
          date, fromCode: c[1], toCode: c[2], amountCents: cents(c[3]),
          note: c[4] || '', line: i + 1,
        });
      }
    });
    return { accounts, transactions, errors };
  }

  function toTxtVein(parsed, opts) {
    const o = opts || {};
    const D = TV.dict;
    const source = TV.source;
    const d = D.emptyDict(o.vaultId || 'nt', o.now ? new Date(o.now) : new Date());
    const groups = {};
    const byCode = new Map();
    const byName = new Map();
    const used = new Set();
    const errors = (parsed.errors || []).slice();
    let groupNo = 0;
    let sort = 10;

    parsed.accounts.forEach((a) => {
      const gkey = a.type + '\u0000' + a.category;
      if (!groups[gkey]) {
        groupNo += 1;
        const gcode = 'ntg_' + groupNo;
        const g = D.addNode(d, {
          zh_name: a.category || a.type, en_name: a.category || a.type,
          zh_code: gcode, en_code: gcode, type: a.type, domain: 'P',
          weight: 100, sort,
        });
        if (g.ok) groups[gkey] = g.id;
        sort += 10;
      }
      let code = a.code;
      while (used.has(code)) code += '2';
      used.add(code);
      const n = D.addNode(d, {
        zh_name: a.name, en_name: a.name, zh_code: code, en_code: code.toLowerCase(),
        type: a.type, domain: 'P', parent_id: groups[gkey] || '',
        weight: 100, sort: 100,
      });
      if (!n.ok) { errors.push({ line: a.line, message: '账户建节点失败：' + n.error }); return; }
      byCode.set(a.code, n.id);
      byCode.set(code, n.id);
      byName.set(a.name, n.id);
    });

    const events = [];
    let eventNo = 0;
    const nextEvent = () => {
      eventNo += 1;
      return 'E_nt' + String(eventNo).padStart(10, '0');
    };
    const needsOpening = parsed.accounts.some((a) => a.openingCents !== 0);
    let openingId = '';
    if (needsOpening) {
      /* NT 的期初虚拟账户是隐藏账户：它只提供期初那一笔真实流水，
       * 本身不进统计行；期初只体现在各账户第 1 列。 */
      const g = D.addNode(d, {
        zh_name: '期初', en_name: 'Opening', zh_code: 'ntg_open', en_code: 'ntg_open',
        type: '权益', domain: 'P', weight: 100, sort: 1, system: true,
      });
      const n = D.addNode(d, {
        zh_name: '期初权益', en_name: 'Opening Equity', zh_code: 'nt_open', en_code: 'nt_open',
        type: '权益', domain: 'P', parent_id: g.ok ? g.id : '', weight: 100, sort: 10, system: true,
      });
      openingId = n.ok ? n.id : '';
    }
    if (openingId) {
      parsed.accounts.forEach((a) => {
        if (!a.openingCents) return;
        const id = byCode.get(a.code);
        if (!id) return;
        const asset = d.nodes[id].polarity === 'A';
        events.push({
          id: nextEvent(), domain: 'P', date: '000101',
          from: asset ? openingId : id, to: asset ? id : openingId,
          amountCents: Math.abs(a.openingCents), minutes: 0, tagIds: [], chainId: '',
        });
      });
    }

    parsed.transactions.forEach((t) => {
      const from = byCode.get(t.fromCode) || byName.get(t.fromCode);
      const to = byCode.get(t.toCode) || byName.get(t.toCode);
      if (!from || !to) {
        errors.push({ line: t.line, message: '流水账户认不出：' + t.fromCode + ' / ' + t.toCode });
        return;
      }
      events.push({
        id: nextEvent(), domain: 'P', date: t.date,
        from, to, amountCents: t.amountCents, minutes: 0, tagIds: [], chainId: '',
        note: t.note || '',
      });
    });

    const dictSource = source.dictToSource(d);
    const ledgerSource = source.ledgerToSource(d, events, [], []);
    const singleText = ['## 统计', '## 流水', ledgerSource, '## 行为', '## 备注', '## 字典', dictSource].join('\n');
    return {
      ok: errors.length === 0,
      dict: d, events, dictSource, ledgerSource, singleText, errors,
      stats: { accounts: parsed.accounts.length, transactions: events.length, errors: errors.length },
    };
  }

  function centsToYuan(c) {
    return Math.round(Number(c) || 0) / 100;
  }

  function yuanToCents(v) {
    const n = Number(String(v == null ? 0 : v).replace(/[¥￥,\s]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  /** NT 的月份是 'YYYY-MM'；TxtVein 固定表用 'YYMM'。 */
  function isoToMonthKey(m) {
    const s = S(m).match(/^(\d{4})-(\d{2})$/);
    return s ? s[1].slice(2) + s[2] : '';
  }

  function monthKeyToIso(k) {
    const s = S(k);
    return /^\d{4}$/.test(s) ? '20' + s.slice(0, 2) + '-' + s.slice(2, 4) : '';
  }

  function monthKeyOfStamp(stamp) {
    const s = S(stamp).replace(/[^\d]/g, '');
    if (/^\d{6}$/.test(s)) return s.slice(0, 4);
    if (/^\d{8}$/.test(s)) return s.slice(2, 6);
    const m = S(stamp).match(/^(\d{4})-(\d{2})/);
    return m ? m[1].slice(2) + m[2] : '';
  }

  function dayOfPlan(plan) {
    const d = Number(plan && plan.day);
    return d >= 1 && d <= 31 ? d : 1;
  }

  /**
   * TxtVein 固定表 → NT 的 scheduled（计划流水）。
   * 字段一一对应：freq / day / from_id / to_id / amount(元) / note / inst。
   */
  function plansToScheduled(plans, dict, opts) {
    const o = opts || {};
    const tag = o.idPrefix || 'tv';
    return (plans || []).filter(Boolean).map((p, i) => {
      const sched = {
        id: tag + '_sched_' + String(i + 1).padStart(3, '0'),
        isScheduled: true,
        freq: p.period === 'd' ? 'daily' : 'monthly',
        day: p.period === 'd' ? 1 : dayOfPlan(p),
        from_id: p.from || null,
        to_id: p.to || null,
        amount: centsToYuan(p.amountCents),
        note: S(p.note),
      };
      if (p.kind === 'installment') {
        const inst = p.inst || {};
        sched.inst = {
          periods: Math.max(0, Math.floor(Number(inst.periods || p.periods) || 0)),
          firstMonth: monthKeyToIso(inst.firstMonth || p.firstMonth),
          principal: centsToYuan(inst.principalCents != null ? inst.principalCents : p.principalCents),
          interest: centsToYuan(inst.interestCents != null ? inst.interestCents : p.interestCents),
        };
      }
      return sched;
    });
  }

  /** NT 的 scheduled → TxtVein 固定表行（plan 对象，cents）。 */
  function scheduledToPlans(scheduled, dict, opts) {
    const o = opts || {};
    const mapId = typeof o.mapId === 'function' ? o.mapId : (id) => id;
    const out = [];
    (scheduled || []).filter(Boolean).forEach((s, i) => {
      if (!s.from_id || !s.to_id) return;
      const inst = s.inst && Number(s.inst.periods) > 0 ? s.inst : null;
      const periods = inst ? Math.max(0, Math.floor(Number(inst.periods) || 0)) : 0;
      const firstMonth = inst ? isoToMonthKey(inst.firstMonth) : '';
      const principalCents = inst ? yuanToCents(inst.principal) : 0;
      const interestCents = inst ? yuanToCents(inst.interest) : 0;
      const amountCents = yuanToCents(s.amount)
        || (periods ? Math.round((principalCents + interestCents) / periods) : 0);
      out.push({
        id: 'P_' + (i + 1),
        kind: inst ? 'installment' : 'fixed',
        status: 'active',
        period: s.freq === 'daily' ? 'd' : 'm',
        day: s.freq === 'daily' ? 0 : dayOfPlan(s),
        month: 0,
        note: S(s.note),
        state: { generated: [], confirmed: [], voided: [] },
        inst: inst ? { periods, firstMonth, principalCents, interestCents } : null,
        periods,
        firstMonth,
        principalCents,
        interestCents,
        domain: 'P',
        from: mapId(s.from_id),
        to: mapId(s.to_id),
        amountCents,
        tagIds: [],
      });
    });
    return out;
  }

  /** NT 的 scheduled → 固定表文本（[固定] / [分期] 两段）。 */
  function scheduledToFixedSource(scheduled, dict, opts) {
    const o = opts || {};
    const plans = scheduledToPlans(scheduled, dict, o);
    if (!TV.source || !TV.source.fixedSourceFromPlans) return '';
    return TV.source.fixedSourceFromPlans(plans, dict, o);
  }

  /**
   * TxtVein → NT state（账户 / 流水 / 计划 / 作废期）。
   * 行尾注释里带 planKey 的流水也会被还原成 NT 的 planKey。
   */
  function toNTState(dict, events, plans, opts) {
    const o = opts || {};
    const codeMap = TV.source && TV.source.sourceCodeMap ? TV.source.sourceCodeMap(dict) : null;
    const nodes = (dict && dict.nodes) || {};
    const accounts = [];
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      if (!n || n.system || n.domain !== 'P') return;
      accounts.push({
        id,
        type: TYPE_OUT[n.type] || n.type,
        category: n.category || (n.parent_id && nodes[n.parent_id] ? nodes[n.parent_id].zh_name : ''),
        code: (codeMap && codeMap.get(id)) || n.zh_code || n.en_code || id,
        name: n.zh_name || n.en_name || id,
        opening: 0,
      });
    });
    const scheduled = plansToScheduled(plans, dict, o);
    const keyById = new Map();
    scheduled.forEach((s, i) => {
      keyById.set((plans || [])[i] && plans[i].id, s.id);
    });
    const used = new Set();
    const transactions = (events || []).map((e, i) => {
      const tx = {
        id: 'tx_' + String(i + 1).padStart(6, '0'),
        date: e.date && e.date.length === 6
          ? '20' + e.date.slice(0, 2) + '-' + e.date.slice(2, 4) + '-' + e.date.slice(4, 6)
          : S(e.date),
        from_id: e.from || null,
        to_id: e.to || null,
        amount: centsToYuan(e.amountCents),
        note: S(e.note),
      };
      const plan = (plans || []).find((p) => p.from === e.from && p.to === e.to
        && Math.round(p.amountCents) === Math.round(Number(e.amountCents) || 0));
      if (plan) {
        const mk = monthKeyOfStamp(e.date);
        const st = plan.state || {};
        const hit = (st.generated || []).includes(mk) || (st.confirmed || []).includes(mk)
          || (st.confirmed || []).includes(S(e.date));
        if (hit && !used.has(plan.id + '|' + mk)) {
          tx.planKey = (keyById.get(plan.id) || plan.id) + '|' + monthKeyToIso(mk);
          tx.planSourceId = keyById.get(plan.id) || plan.id;
          used.add(plan.id + '|' + mk);
        }
      }
      return tx;
    });
    const voidedPlans = [];
    (plans || []).forEach((p) => {
      const st = p.state || {};
      const sid = keyById.get(p.id) || p.id;
      (st.voided || []).forEach((k) => {
        const iso = k.length === 8 ? monthKeyToIso(k.slice(0, 4)) : monthKeyToIso(k);
        if (iso) voidedPlans.push(sid + '|' + iso);
      });
    });
    return { accounts, transactions, scheduled, voidedPlans };
  }

  /**
   * 在 NT 明文里追加固定表两段（NT 侧若还不认识这两段，可忽略；
   * 真正无损的互通走 toNTState / fromNTState 的 JSON state）。
   */
  function toNTText(dict, events) {
    const source = TV.source;
    const codeMap = source.sourceCodeMap(dict);
    const nodes = (dict && dict.nodes) || {};
    const children = {};
    Object.keys(nodes).forEach((id) => {
      const p = nodes[id].parent_id;
      if (p) children[p] = (children[p] || 0) + 1;
    });
    const lines = ['账户：'];
    Object.keys(nodes).sort().forEach((id) => {
      const n = nodes[id];
      if (n.system || n.domain !== 'P' || children[id]) return;
      const code = codeMap.get(id) || n.zh_code || n.en_code || id;
      const parent = n.parent_id && nodes[n.parent_id] ? nodes[n.parent_id].zh_name : '';
      lines.push([TYPE_OUT[n.type] || n.type, parent, code, n.zh_name || n.en_name, '0.00', ''].join('，'));
    });
    lines.push('', '流水：');
    (events || []).forEach((e) => {
      if (e.minutes > 0) return;
      const from = nodes[e.from] && nodes[e.from].domain === 'P' ? codeMap.get(e.from) : '';
      const to = nodes[e.to] && nodes[e.to].domain === 'P' ? codeMap.get(e.to) : '';
      if (!from || !to) return;
      lines.push([e.date, from, to, ((Number(e.amountCents) || 0) / 100).toFixed(2), e.note || ''].join('，'));
    });
    return lines.join('\n') + '\n';
  }

  async function decryptBackup(text, password) {
    const flat = norm(text).replace(/\s+/g, '').replace(/：/g, ':');
    const pick = (key, next) => {
      const i = flat.indexOf(key);
      if (i < 0) return '';
      const from = i + key.length;
      let to = flat.length;
      next.forEach((n) => {
        const j = flat.indexOf(n, from);
        if (j >= 0 && j < to) to = j;
      });
      return flat.slice(from, to);
    };
    const salt = pick('盐:', ['IV:']);
    const iv = pick('IV:', ['时间:', '密文:']);
    const cipher = pick('密文:', ['-----结束-----']);
    if (!salt || !iv || !cipher) throw new Error('不是 NT 加密备份');
    const b64 = (s) => {
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    };
    const c = root.crypto;
    if (!c || !c.subtle) throw new Error('当前环境不支持解密');
    const material = await c.subtle.importKey('raw', new TextEncoder().encode(String(password)), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await c.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(salt), iterations: 150000, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    const plain = await c.subtle.decrypt({ name: 'AES-GCM', iv: b64(iv) }, key, b64(cipher));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function fromNTState(state) {
    const idToCode = {};
    (state.accounts || []).forEach((a) => { idToCode[a.id] = a.code || a.name; });
    const parsed = {
      accounts: (state.accounts || []).map((a) => ({
        type: TYPE_IN[a.type] || a.type, category: a.category || '', code: a.code || a.name,
        name: a.name, openingCents: cents(a.opening || 0), line: 0,
      })),
      transactions: (state.transactions || []).map((t) => ({
        date: dateShort(t.date), fromCode: idToCode[t.from_id] || t.from || '',
        toCode: idToCode[t.to_id] || t.to || '', amountCents: cents(t.amount || 0),
        note: t.note || '', line: 0,
      })),
      errors: [],
    };
    const built = toTxtVein(parsed);
    const dict = built.dict;
    const byCode = new Map();
    Object.keys((dict && dict.nodes) || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (n && n.zh_code) byCode.set(String(n.zh_code).toUpperCase(), id);
    });
    const mapId = (ntId) => {
      const code = idToCode[ntId] || ntId;
      return byCode.get(String(code).toUpperCase()) || byCode.get(String(ntId).toUpperCase()) || ntId;
    };
    const plans = scheduledToPlans(state.scheduled || [], dict, { mapId });
    /* NT 的状态在 transactions.planKey / voidedPlans 里；搬回计划行的 state */
    const bySched = new Map();
    plans.forEach((p, i) => bySched.set((state.scheduled || [])[i] && state.scheduled[i].id, p));
    (state.transactions || []).forEach((t) => {
      const key = S(t.planKey);
      const m = key.match(/^(.*)\|(\d{4})-(\d{2})$/);
      if (!m) return;
      const plan = bySched.get(m[1]);
      if (!plan) return;
      const mk = m[2].slice(2) + m[3];
      if (!plan.state.generated.includes(mk)) plan.state.generated.push(mk);
    });
    (state.voidedPlans || []).forEach((key) => {
      const m = S(key).match(/^(.*)\|(\d{4})-(\d{2})$/);
      if (!m) return;
      const plan = bySched.get(m[1]);
      if (!plan) return;
      const mk = m[2].slice(2) + m[3];
      if (!plan.state.voided.includes(mk)) plan.state.voided.push(mk);
    });
    let fixedSource = '';
    if (TV.source && TV.source.fixedSourceFromPlans) {
      fixedSource = TV.source.fixedSourceFromPlans(plans, dict, { mode: 'CODE', lang: 'zh' });
    }
    return Object.assign({}, built, { plans, fixedSource });
  }

  function detect(text) {
    const t = norm(text);
    if (isNTBackup(t)) return 'nt-backup';
    if (TV.textBundle && TV.textBundle.isBundle(t)) return 'txtvein-bundle';
    if (/##\s*字典/.test(t) && /##\s*流水/.test(t)) return 'txtvein-single';
    if (TV.envelope && TV.envelope.isEncrypted(t)) return 'txtvein-secure';
    if (isNTText(t)) return 'nt-text';
    return 'unknown';
  }

  TV.ntBridge = {
    parseText, toTxtVein, toNTText, decryptBackup, fromNTState, detect, isNTBackup, isNTText,
    plansToScheduled, scheduledToPlans, scheduledToFixedSource, toNTState,
    isoToMonthKey, monthKeyToIso, monthKeyOfStamp,
  };
  if (typeof module === 'object' && module.exports) module.exports = TV.ntBridge;
})(typeof globalThis !== 'undefined' ? globalThis : this);
