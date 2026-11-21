/* TxtVein · 规则层
 * 周期规则（PLAN）：*d / *m / *y。
 *
 * 过去 / 现在 / 未来（与 NT账本 README §8 一致）：
 *   · 过去：不补历史。每月计划只补**本月**这一期；每日计划过期不补。
 *   · 现在：每月到期自动确认，落成真实流水；每日只把**今天**摆出来待确认，
 *           不确认就过期（不落账、不追问）。
 *   · 未来：只在列表里显示下次到期，不预先写流水。
 *
 * 计划字段：
 *   *m 保留流水记录的「日」→ 每月该日自动添加（31 号在小月钳到月末）。
 *   *d 不保留日期 → 每天自动生成「今天」这一期待确认项。
 *   *y 保留月 + 日 → 每年该月该日自动添加。
 *
 * 规则本身也是纯文本，存在导出用的 [PLAN] / [RULES] 区块里。
 * 取消规则只改状态，历史流水一行不动。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  const STATUS = ['active', 'canceled'];

  const PERIOD_LABEL = { d: '每日', m: '每月', y: '每年' };
  const PERIOD_LABEL_EN = { d: 'Daily', m: 'Monthly', y: 'Yearly' };

  function periodLabel(p) {
    return PERIOD_LABEL[p] || p;
  }

  function clampDay(year, month, day) {
    return Math.max(1, Math.min(Number(day) || 1, date.daysInMonth(year, month)));
  }

  /** 计划里的「日」：缺省时从首期 / 上次执行 / 起始日期推断。 */
  function dayOf(plan) {
    const n = Number(plan && plan.day);
    if (n >= 1 && n <= 31) return Math.round(n);
    const p = date.parseDate((plan && (plan.firstDue || plan.lastRun || plan.start)) || '');
    return p.ok ? p.day : 1;
  }

  /** 年计划的「月」：缺省时从首期 / 上次执行 / 起始日期推断。 */
  function monthOf(plan) {
    const n = Number(plan && plan.month);
    if (n >= 1 && n <= 12) return Math.round(n);
    const p = date.parseDate((plan && (plan.firstDue || plan.lastRun || plan.start)) || '');
    return p.ok ? p.month : 1;
  }

  /**
   * 人能读的周期：每月 16 日 / 每天 / 每年 11 月 16 日。
   * 每日计划不写日期（用户 2026-11 定的口径）。
   */
  function scheduleText(plan, lang) {
    const p = plan || {};
    const en = lang === 'en';
    if (p.period === 'd' || p.period == null) return en ? 'Daily' : '每日';
    if (p.period === 'm') return en ? ('Monthly · day ' + dayOf(p)) : ('每月' + dayOf(p) + '日');
    if (p.period === 'y') {
      return en
        ? ('Yearly · ' + monthOf(p) + '/' + dayOf(p))
        : ('每年' + monthOf(p) + '月' + dayOf(p) + '日');
    }
    return periodLabel(p.period);
  }

  /** 内部短日期：261116 → 11-16。 */
  function shortDate(stamp) {
    const s = S(stamp);
    return /^\d{6}$/.test(s) ? s.slice(2, 4) + '-' + s.slice(4, 6) : (s || '—');
  }

  /** 当月（年计划为当年）的应发生日，无论是否已过。 */
  function dueStampIn(plan, now) {
    if (!plan) return '';
    const today = date.parseDate(date.todayStamp(now));
    if (!today.ok) return '';
    if (plan.period === 'm') {
      const d = clampDay(today.year, today.month, dayOf(plan));
      return date.pad2(today.year % 100) + date.pad2(today.month) + date.pad2(d);
    }
    if (plan.period === 'y') {
      const m = monthOf(plan);
      const d = clampDay(today.year, m, dayOf(plan));
      return date.pad2(today.year % 100) + date.pad2(m) + date.pad2(d);
    }
    return '';
  }

  /**
   * 列表里显示的「下次」：这一次还没处理就是本期，已经处理过就跳到下期。
   * 计划本身不存状态 —— 「处理过没有」由真实流水决定（同一期有没有同流向同额的一条）。
   * 每日计划：今天还没记就是今天，记了就不摆（每日不做未来预测）。
   */
  /* ---------------- NT 对齐的计划发生（固定 / 分期） ----------------
   *
   * 和 NT账本 core/plan-occurrence.js + timeline/time-state.js 同一套口径：
   *   · 每月固定：到期自动落成真实流水（日期=当月应发生日，备注=模板备注）；
   *   · 每日固定：不自动，只在未来区摆今天一条，确认才落账；
   *   · 分期：不自动落账，未来区按月份摆出每一期（确认才落账）；
   *   · 确认 = 把这一期落成它自己的日期（NT confirmOccurrence 记到今天；
   *     TxtVein 的未来记录按具体日期排，确认后保留该日期）；
   *   · 每一期用「月 key」去重：生成 / 已确认 / 已作废 三张表都记在计划行上；
   *   · 作废的一期不再补；计划行删掉状态就从头算。
   */

  /** '261116' → '2611'；也接受 '2026-11' / '2026-11-16'。 */
  function monthKeyOf(raw) {
    const s = S(raw).replace(/[^\d]/g, '');
    if (/^\d{4}$/.test(s)) return s;
    if (s.length >= 6 && s.length <= 8) {
      const y4 = s.slice(0, 4);
      if (/^(19|20)\d{2}$/.test(y4)) return y4.slice(2) + s.slice(4, 6);
      return s.slice(0, 4);
    }
    return '';
  }

  /** '2611' → '2026-11'（给 NT 的 inst.firstMonth 用）。 */
  function isoMonthOf(key) {
    const s = S(key);
    if (!/^\d{4}$/.test(s)) return '';
    return '20' + s.slice(0, 2) + '-' + s.slice(2, 4);
  }

  function addMonthKey(key, n) {
    const s = S(key);
    if (!/^\d{4}$/.test(s)) return '';
    let y = Number(s.slice(0, 2));
    let m = Number(s.slice(2, 4)) + Number(n || 0);
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12 + 12) % 12 + 1;
    return date.pad2(y % 100) + date.pad2(m);
  }

  function monthsBetweenKeys(a, b) {
    const x = S(a);
    const y = S(b);
    if (!/^\d{4}$/.test(x) || !/^\d{4}$/.test(y)) return NaN;
    return (Number(y.slice(0, 2)) * 12 + Number(y.slice(2, 4)))
      - (Number(x.slice(0, 2)) * 12 + Number(x.slice(2, 4)));
  }

  /** 某个月的「应发生日」：day 钳到月末。 */
  function dueStampInMonth(plan, monthKey) {
    const mk = S(monthKey);
    if (!/^\d{4}$/.test(mk)) return '';
    const year = 2000 + Number(mk.slice(0, 2));
    const month = Number(mk.slice(2, 4));
    return mk + date.pad2(clampDay(year, month, dayOf(plan)));
  }

  /** NT 的计划状态：生成 / 确认 / 作废（月 key；每日用 YYMMDD）。 */
  function planState(plan) {
    const st = (plan && plan.state) || {};
    const list = (x) => (Array.isArray(x) ? x.filter((k) => /^\d{4,8}$/.test(S(k))).map(String) : []);
    return { generated: list(st.generated), confirmed: list(st.confirmed), voided: list(st.voided) };
  }

  function stateHas(plan, kind, key) {
    if (!kind || !key) return false;
    return planState(plan)[kind].includes(String(key));
  }

  function addPlanState(plan, kind, key) {
    if (!plan || !kind || !key) return false;
    plan.state = plan.state || {};
    const list = Array.isArray(plan.state[kind]) ? plan.state[kind] : [];
    if (list.includes(String(key))) return false;
    list.push(String(key));
    /* 状态只保留最近 120 个 key，避免一行越写越长 */
    plan.state[kind] = list.slice(-120);
    return true;
  }

  function stateTokenOf(plan) {
    const st = planState(plan);
    const parts = [];
    ['generated', 'confirmed', 'voided'].forEach((k) => {
      if (st[k].length) parts.push(k + '=' + st[k].join(','));
    });
    return parts.join(' ');
  }

  /** 分期宏观状态（NT installment-engine.computeInstallment 的同一口径）。 */
  function installmentInfo(plan, fromKey) {
    const inst = (plan && plan.inst) || {};
    const periods = Math.max(0, Math.floor(Number(inst.periods) || 0));
    const firstMonth = monthKeyOf(inst.firstMonth);
    const principal = Math.round(Number(inst.principalCents) || 0);
    const interest = Math.round(Number(inst.interestCents) || 0);
    const total = principal + interest;
    const per = periods > 0
      ? Math.round(Number(plan.amountCents) || total / periods)
      : 0;
    const principalPer = periods > 0 ? Math.round(principal / periods) : 0;
    const interestPer = periods > 0 ? Math.round(interest / periods) : 0;
    const lastMonth = periods > 0 && firstMonth ? addMonthKey(firstMonth, periods - 1) : '';
    const ref = fromKey || date.todayStamp().slice(0, 4);
    const elapsed = firstMonth ? monthsBetweenKeys(firstMonth, ref) : NaN;
    const paid = Number.isFinite(elapsed) ? Math.min(periods, Math.max(0, elapsed)) : 0;
    return {
      periods,
      firstMonth,
      lastMonth,
      principalCents: principal,
      interestCents: interest,
      totalCents: total,
      perPeriodCents: per,
      principalPerCents: principalPer,
      interestPerCents: interestPer,
      paidPeriods: paid,
      remainingPeriods: Math.max(0, periods - paid),
      remainingPrincipalCents: principalPer * Math.max(0, periods - paid),
      remainingInterestCents: interestPer * Math.max(0, periods - paid),
      finished: periods > 0 && paid >= periods,
    };
  }

  function hasSameMonthEvent(events, plan, monthKey, amountCents) {
    const mk = S(monthKey);
    const cents = Math.round(Number(amountCents == null ? plan.amountCents : amountCents) || 0);
    return (events || []).some((e) => e && S(e.date).slice(0, 4) === mk
      && e.from === plan.from && e.to === plan.to
      && Math.round(Number(e.amountCents) || 0) === cents);
  }

  function hasSameDayEvent(events, plan, stamp) {
    const cents = Math.round(Number(plan.amountCents) || 0);
    return (events || []).some((e) => e && e.date === stamp && e.from === plan.from
      && e.to === plan.to && Math.round(Number(e.amountCents) || 0) === cents);
  }

  /** 固定收支生成的流水备注：固定每月/每日/每年 + 原备注。 */
  function noteWithFixed(plan) {
    const p = plan || {};
    const n = S(p.note).trim();
    const mark = p.period === 'd' ? '固定每日'
      : p.period === 'y' ? '固定每年' : '固定每月';
    return '< ' + mark + (n ? ' ' + n : '');
  }

  /** 分期某一期的备注：只写 2612分期 第4/7期。 */
  function installmentNote(plan, monthKey) {
    const info = installmentInfo(plan, monthKey);
    if (!info.periods) return '< ' + '分期还款';
    const n = (Number.isFinite(monthsBetweenKeys(info.firstMonth, monthKey))
      ? monthsBetweenKeys(info.firstMonth, monthKey) + 1 : 0);
    const tag = info.firstMonth ? info.firstMonth + '分期' : '分期还款';
    return '< ' + tag + ' 第' + Math.max(1, n) + '/' + info.periods + '期';
  }

  /**
   * 未来区：每月固定往后 24 个月，分期一次铺完所有剩余期，每日只摆今天一条；
   * 已经生成 / 已确认 / 已作废的期不再出现。
   * @returns {Array<{plan, month, date, kind, amountCents, note, periodIndex, principalCents, interestCents}>}
   */
  function futureOccurrences(plan, now, events, horizon) {
    if (!plan || plan.status !== 'active') return [];
    const today = date.todayStamp(now);
    const out = [];
    const st = planState(plan);
    const skip = (key) => st.generated.includes(key) || st.confirmed.includes(key) || st.voided.includes(key);
    if (plan.period === 'd') {
      /* 每日是「当天常驻快捷项」：不判断今天是否已添加，可重复确认多条；
       * 只有固定表删掉这一行时才不再出现。 */
      out.push({
        plan, month: today, date: today, kind: 'daily',
        amountCents: Math.round(Number(plan.amountCents) || 0),
        note: noteWithFixed(plan), periodIndex: '', principalCents: 0, interestCents: 0,
      });
      return out;
    }
    if (plan.period === 'y') {
      const base = date.parseDate(today);
      const y = base.year;
      const m = monthOf(plan);
      const d = clampDay(y, m, dayOf(plan));
      let due = date.pad2(y % 100) + date.pad2(m) + date.pad2(d);
      if (due < today) {
        const ny = y + 1;
        const nd = clampDay(ny, m, dayOf(plan));
        due = date.pad2(ny % 100) + date.pad2(m) + date.pad2(nd);
      }
      const mk = due.slice(0, 4);
      if (!skip(mk) && !hasSameMonthEvent(events, plan, mk)) {
        out.push({
          plan, month: mk, date: due, kind: 'yearly',
          amountCents: Math.round(Number(plan.amountCents) || 0),
          note: noteWithFixed(plan), periodIndex: '', principalCents: 0, interestCents: 0,
        });
      }
      return out;
    }
    const cur = today.slice(0, 4);
    const months = Math.max(1, Math.min(360, Number(horizon) || 24));
    if (plan.kind === 'installment') {
      const info = installmentInfo(plan, cur);
      if (!info.periods || !info.firstMonth) return out;
      /* 分期一次铺完：从当前月一直排到最后一期，不再只给 6 个月。 */
      const span = Math.max(months, (monthsBetweenKeys(cur, info.lastMonth) || 0) + 1);
      for (let i = 0; i < span; i += 1) {
        const mk = addMonthKey(cur, i);
        if (!mk) continue;
        if (monthsBetweenKeys(info.firstMonth, mk) < 0) continue;
        if (monthsBetweenKeys(info.firstMonth, mk) >= info.periods) continue;
        const due = dueStampInMonth(plan, mk);
        if (!due || due < today) continue;
        if (skip(mk) || hasSameMonthEvent(events, plan, mk)) continue;
        const n = monthsBetweenKeys(info.firstMonth, mk) + 1;
        /* 最后一期补掉「每期四舍五入」的差额，保证各期合计 = 本金 + 利息。 */
        let amountCents = info.perPeriodCents;
        if (n === info.periods) {
          const adjusted = info.totalCents - info.perPeriodCents * (info.periods - 1);
          if (adjusted > 0) amountCents = adjusted;
        }
        out.push({
          plan, month: mk, date: due, kind: 'installment',
          amountCents,
          note: installmentNote(plan, mk),
          periodIndex: n + '/' + info.periods,
          principalCents: info.principalPerCents,
          interestCents: info.interestPerCents,
        });
      }
      return out;
    }
    for (let i = 0; i < months; i += 1) {
      const mk = addMonthKey(cur, i);
      if (!mk) continue;
      const due = dueStampInMonth(plan, mk);
      if (!due || due < today) continue;
      if (skip(mk) || hasSameMonthEvent(events, plan, mk)) continue;
      out.push({
        plan, month: mk, date: due, kind: 'monthly',
        amountCents: Math.round(Number(plan.amountCents) || 0),
        note: noteWithFixed(plan), periodIndex: '', principalCents: 0, interestCents: 0,
      });
    }
    return out;
  }

  /** 一条计划在未来区里的全部期（每月 24 个月 / 分期全部 / 今天一条）。 */
  function planOccurrences(plans, now, events, horizon) {
    const out = [];
    (plans || []).forEach((p) => {
      futureOccurrences(p, now, events, horizon).forEach((x) => out.push(x));
    });
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      || (a.plan.id < b.plan.id ? -1 : 1));
    return out;
  }


  /* ---------------- 导出用的 [PLAN] / [RULES] 机器格式 ---------------- */

  function parsePlanLine(line, index) {
    const raw = S(line).trim();
    if (!raw || raw.startsWith('#')) return null;
    const m = raw.match(/^(\S+)\s+(active|canceled)\s*:\s*(\S*)\s+(\S+)\s*>\s*(\S+)\s+(\d+)\s*(.*)$/i);
    if (!m) return { error: '无法解析计划行：' + raw, raw, line: index };
    const rest = m[7] || '';
    let period = '';
    let lastRun = '';
    let day = 0;
    let month = 0;
    const tagIds = [];
    let name = '';
    rest.split(/[\s\u3000]+/).filter(Boolean).forEach((tok) => {
      if (/^\*[dmy]$/i.test(tok)) { period = tok.slice(1).toLowerCase(); return; }
      if (/^day=\d{1,2}$/i.test(tok)) { day = Number(tok.slice(4)); return; }
      if (/^month=\d{1,2}$/i.test(tok)) { month = Number(tok.slice(6)); return; }
      if (/^last_run=/i.test(tok)) { lastRun = tok.split('=')[1] || ''; return; }
      if (/^name=/i.test(tok)) { name = decodeURIComponent(tok.slice(5)); return; }
      if (/^T_[A-Za-z0-9_]+$/.test(tok)) { tagIds.push(tok); return; }
    });
    if (!period) return { error: '计划缺少周期 *d/*m/*y：' + raw, raw, line: index };
    const d = date.parseDate(lastRun || '');
    const plan = {
      ok: true,
      id: m[1],
      status: m[2].toLowerCase(),
      flags: m[3] || '',
      from: m[4],
      to: m[5],
      amountCents: Number(m[6]),
      period,
      tagIds,
      name,
      lastRun: d.ok ? d.stamp : '',
      start: d.ok ? d.stamp : '',
      raw,
      line: index,
    };
    if (period !== 'd') {
      plan.day = day >= 1 && day <= 31 ? day : (d.ok ? d.day : 1);
      if (period === 'y') plan.month = month >= 1 && month <= 12 ? month : (d.ok ? d.month : 1);
    } else {
      plan.day = 0;
    }
    return plan;
  }

  function serializePlan(plan) {
    const p = plan || {};
    const tagPart = (p.tagIds || []).join(' ');
    const nm = p.name ? ' name=' + (/[\s\u3000]/.test(p.name) ? encodeURIComponent(p.name) : p.name) : '';
    const period = p.period || 'm';
    const parts = [
      p.id || 'R_???',
      (p.status || 'active') + ':',
      '0',
      p.from,
      '>',
      p.to,
      String(Math.round(Number(p.amountCents) || 0)),
    ];
    if (tagPart) parts.push(tagPart);
    parts.push('*' + period);
    if (period === 'm') parts.push('day=' + dayOf(p));
    if (period === 'y') {
      parts.push('month=' + monthOf(p));
      parts.push('day=' + dayOf(p));
    }
    if (p.lastRun) parts.push('last_run=' + p.lastRun);
    if (nm.trim()) parts.push(nm.trim());
    return parts.join(' ');
  }

  function parseRuleLine(line, index) {
    const raw = S(line).trim();
    if (!raw || raw.startsWith('#')) return null;
    const arrow = raw.indexOf('->');
    if (arrow < 0) return { error: '规则缺少 ->：' + raw, raw, line: index };
    const head = raw.slice(0, arrow).trim();
    const tail = raw.slice(arrow + 2).trim();
    const hm = head.match(/^(\S+)\s+(active|canceled)\s*:\s*(.*)$/i);
    if (!hm) return { error: '无法解析规则头：' + raw, raw, line: index };
    const cond = hm[3] || '';
    const flow = tail.match(/^(\S+)\s*>\s*(\S+)(?:\s+(.*))?$/);
    if (!flow) return { error: '规则右侧不是 A > B：' + raw, raw, line: index };
    const rest = flow[3] || '';
    let tags = [];
    let name = '';
    rest.split(/[\s\u3000]+/).filter(Boolean).forEach((tok) => {
      if (/^tags=/i.test(tok)) {
        tags = tok.slice(5).split(',').map((x) => x.trim()).filter(Boolean);
      } else if (/^name=/i.test(tok)) {
        name = decodeURIComponent(tok.slice(5));
      }
    });
    const keywords = [];
    let amountOp = '';
    let amountCents = 0;
    const km = cond.match(/keywords\s*=\s*\(([^)]*)\)/i);
    if (km) {
      km[1].split('|').map((x) => x.trim()).filter(Boolean).forEach((x) => {
        keywords.push(x.replace(/^[#T_]+/, ''));
      });
    }
    const am = cond.match(/amount\s*([<>=])\s*(\d+(?:\.\d+)?[kK]?)/);
    if (am) {
      amountOp = am[1];
      const q = amount.parseAmount(am[2]);
      amountCents = q.ok ? q.cents : 0;
    }
    return {
      ok: true,
      id: hm[1],
      status: hm[2].toLowerCase(),
      condition: cond,
      keywords,
      amountOp,
      amountCents,
      from: flow[1],
      to: flow[2],
      tagIds: tags,
      name,
      raw,
      line: index,
    };
  }

  function serializeRule(rule) {
    const r = rule || {};
    const kw = (r.keywords || []).join('|');
    const cond = 'keywords=(' + kw + ')'
      + (r.amountOp ? '&amount' + r.amountOp + (Number(r.amountCents) / 100) : '');
    const tags = (r.tagIds || []).length ? ' tags=' + r.tagIds.join(',') : '';
    const name = r.name ? ' name=' + (/[\s\u3000]/.test(r.name) ? encodeURIComponent(r.name) : r.name) : '';
    return (r.id || 'R_???') + ' ' + (r.status || 'active') + ': ' + cond
      + ' -> ' + r.from + ' > ' + r.to + tags + name;
  }

  function parseBlocks(source) {
    const lines = S(source).replace(/\r\n?/g, '\n').split('\n');
    const plans = [];
    const rules = [];
    const warnings = [];
    let section = '';
    lines.forEach((line, i) => {
      const s = line.trim();
      if (!s || s.startsWith('#')) return;
      const sec = s.match(/^\[(PLAN|RULES?)\]$/i);
      if (sec) {
        section = sec[1].toUpperCase().startsWith('PLAN') ? 'plan' : 'rule';
        return;
      }
      if (section === 'plan') {
        const p = parsePlanLine(s, i);
        if (!p) return;
        if (p.error) warnings.push(p.error);
        else plans.push(p);
      } else if (section === 'rule') {
        const r = parseRuleLine(s, i);
        if (!r) return;
        if (r.error) warnings.push(r.error);
        else rules.push(r);
      }
    });
    return { plans, rules, warnings };
  }

  function serializeBlocks(plans, rules) {
    const out = [];
    if ((plans || []).length) {
      out.push('[PLAN]');
      plans.forEach((p) => out.push(serializePlan(p)));
    }
    if ((rules || []).length) {
      out.push('[RULES]');
      rules.forEach((r) => out.push(serializeRule(r)));
    }
    return out.join('\n');
  }

  function upsertPlan(plans, plan) {
    const arr = plans || [];
    const i = arr.findIndex((x) => x.id === plan.id);
    if (i >= 0) arr[i] = Object.assign({}, arr[i], plan);
    else arr.push(plan);
    return arr;
  }

  function nextDue(plan, now) {
    if (!plan || plan.status !== 'active') return '';
    const base = plan.lastRun || plan.start;
    if (!base) return dueStampIn(plan, now);
    const next = date.addPeriod(base, plan.period, 1);
    return next || '';
  }

  function isDue(plan, now) {
    const next = nextDue(plan, now);
    return !!next && next <= date.todayStamp(now);
  }

  function planEvent(plan, stamp, dict) {
    return {
      domain: plan.domain || 'P',
      date: stamp,
      from: plan.from,
      to: plan.to,
      amountCents: Math.round(Number(plan.amountCents) || 0),
      minutes: 0,
      tagIds: (plan.tagIds || []).slice(),
      chainId: '',
      planId: plan.id,
      note: noteWithFixed(plan),
      raw: '[plan ' + plan.id + ']',
      crossDomain: !!(dict && dict.nodes[plan.from] && dict.nodes[plan.to]
        && dict.nodes[plan.from].domain !== dict.nodes[plan.to].domain),
    };
  }

  function hasSameEvent(events, plan, stamp) {
    const cents = Math.round(Number(plan.amountCents) || 0);
    return (events || []).some((e) => e && e.date === stamp && e.from === plan.from
      && e.to === plan.to && Math.round(Number(e.amountCents) || 0) === cents);
  }

  /**
   * 每月固定：到期自动落账（分期、每日都不在这里）。
   * NT 的口径：只处理当前月，日期=当月应发生日，备注=模板备注。
   * 生成后把月 key 记进 generated；同一期已有真实流水也记 generated（删了不会复活）。
   */
  function materializeDue(plans, now, opts) {
    const o = opts || {};
    const today = date.todayStamp(now);
    const existing = o.existing || [];
    const generated = [];
    (plans || []).forEach((plan) => {
      if (!plan || plan.status !== 'active') return;
      if (plan.period !== 'm' || plan.kind === 'installment') return;
      const mk = today.slice(0, 4);
      const due = dueStampInMonth(plan, mk);
      if (!due || due > today) return;
      if (stateHas(plan, 'generated', mk) || stateHas(plan, 'confirmed', mk) || stateHas(plan, 'voided', mk)) return;
      if (hasSameMonthEvent(existing, plan, mk)) {
        addPlanState(plan, 'generated', mk);
        return;
      }
      generated.push(planEvent(plan, due, o.dict));
      addPlanState(plan, 'generated', mk);
    });
    return { events: generated, generated: generated.length, changed: generated.length > 0 };
  }

  /** 手动确认：把这一期落成它自己的日期（NT 记到今天；文本表保留该期日期）。 */
  function confirmOccurrence(plan, occurrence, now, opts) {
    if (!plan || !occurrence) return null;
    const o = opts || {};
    const today = date.todayStamp(now);
    const key = plan.period === 'd' ? today : S(occurrence.month);
    if (!key) return null;
    /* 确认 = 把这一期落成它自己的日期（未来记录原来就按这个日期排） */
    const stamp = plan.period === 'd' ? today : (S(occurrence.date) || today);
    const ev = planEvent(plan, stamp, o.dict);
    ev.amountCents = Math.round(Number(occurrence.amountCents == null
      ? plan.amountCents : occurrence.amountCents) || 0);
    ev.note = S(occurrence.note == null ? plan.note : occurrence.note);
    /* 每日确认后的流水不再带「固定每日」前缀，只留原备注。 */
    if (plan.period === 'd') {
      const note = S(plan.note).trim();
      ev.note = note ? '< ' + note : '';
    }
    ev.periodIndex = S(occurrence.periodIndex || '');
    addPlanState(plan, 'confirmed', key);
    return ev;
  }

  /** 作废这一期：只记 key，不动计划本身。 */
  function voidOccurrence(plan, occurrence) {
    if (!plan || !occurrence) return false;
    const key = occurrence.month || occurrence.date;
    return addPlanState(plan, 'voided', key);
  }

  /** 未来行 → 给 app 的确认 / 作废参数（不依赖 plan 对象引用）。 */
  function occurrenceSpec(row) {
    if (!row) return null;
    return {
      planId: row.plan ? row.plan.id : row.planId,
      month: S(row.month),
      date: S(row.date),
      kind: S(row.kind),
      amountCents: Math.round(Number(row.amountCents) || 0),
      note: S(row.note),
      periodIndex: S(row.periodIndex),
      principalCents: Math.round(Number(row.principalCents) || 0),
      interestCents: Math.round(Number(row.interestCents) || 0),
    };
  }

  /** 每日待确认（NT：只摆今天一条）。 */
  function pendingDaily(plans, events, now) {
    const out = [];
    (plans || []).forEach((p) => {
      const rows = futureOccurrences(p, now, events, 1);
      rows.forEach((r) => { if (r.kind === 'daily') out.push(r); });
    });
    return out;
  }

  /** 固定表顶部聚合（NT getSchedulerSummary 的口径）。 */
  function summarizePlans(plans, dict, now) {
    const list = (plans || []).filter((p) => p && p.status === 'active' && p.kind !== 'installment');
    const typeOf = (id) => (dict && dict.nodes && dict.nodes[id] ? dict.nodes[id].type : '');
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let dailyIncome = 0;
    let dailyExpense = 0;
    list.forEach((p) => {
      const cents = Math.round(Number(p.amountCents) || 0);
      const income = S(typeOf(p.to)).replace(/类$/, '') === '收入';
      if (p.period === 'd') {
        if (income) dailyIncome += cents; else dailyExpense += cents;
      } else if (p.period === 'm') {
        if (income) monthlyIncome += cents; else monthlyExpense += cents;
      }
    });
    let remainingPrincipal = 0;
    let remainingInterest = 0;
    (plans || []).forEach((p) => {
      if (!p || p.status !== 'active' || p.kind !== 'installment') return;
      const info = installmentInfo(p);
      remainingPrincipal += info.remainingPrincipalCents;
      remainingInterest += info.remainingInterestCents;
    });
    return {
      fixedCount: list.length,
      installCount: (plans || []).filter((p) => p && p.status === 'active' && p.kind === 'installment').length,
      monthlyIncome, monthlyExpense, dailyIncome, dailyExpense,
      remainingPrincipal, remainingInterest,
    };
  }

  /**
   * 计划的跨会话身份：底层 ID 每次编译都会重新随机，不能持久化。
   * 持久化的是「域:源码简码」（例 `P:wx1` / `P:rent`），加载后用当次字典解析回来。
   */
  function codeIndex(dict) {
    const out = { node: new Map(), tag: new Map() };
    let map = null;
    try {
      if (TV.source && TV.source.sourceCodeMap) map = TV.source.sourceCodeMap(dict);
    } catch (e) { map = null; }
    const key = (rec, id) => {
      const x = rec[id];
      if (!x) return '';
      const domain = S(x.domain || 'P').toUpperCase();
      const code = (map && map.get(id)) || S(x.zh_code) || S(x.en_code);
      return code ? domain + ':' + code : '';
    };
    Object.keys((dict && dict.nodes) || {}).forEach((id) => {
      const k = key(dict.nodes, id);
      if (k && !out.node.has(k)) out.node.set(k, id);
    });
    Object.keys((dict && dict.tags) || {}).forEach((id) => {
      const k = key(dict.tags, id);
      if (k && !out.tag.has(k)) out.tag.set(k, id);
    });
    return out;
  }

  /** 把当前 ID 写成可持久化的引用（fromRef / toRef / tagRefs）。 */
  function syncPlanRefs(dict, list) {
    const arr = list || [];
    if (!dict) return arr;
    /* 一次建表，避免每条都重算 sourceCodeMap */
    let map = null;
    try { map = TV.source && TV.source.sourceCodeMap ? TV.source.sourceCodeMap(dict) : null; } catch (e) { map = null; }
    const refFor = (kind, id) => {
      const rec = kind === 'tag' ? (dict.tags || {}) : (dict.nodes || {});
      const x = rec[id];
      if (!x) return '';
      const code = (map && map.get(id)) || S(x.zh_code) || S(x.en_code);
      return code ? S(x.domain || 'P').toUpperCase() + ':' + code : '';
    };
    arr.forEach((p) => {
      if (!p) return;
      p.fromRef = refFor('node', p.from) || p.fromRef || '';
      p.toRef = refFor('node', p.to) || p.toRef || '';
      if (Array.isArray(p.tagIds) && p.tagIds.length) {
        p.tagRefs = p.tagIds.map((id) => refFor('tag', id)).filter(Boolean);
      }
    });
    return arr;
  }

  /** 用持久化的引用把计划的 from / to / tagIds 挂回当次字典。 */
  function resolvePlanRefs(dict, list) {
    const arr = list || [];
    if (!dict) return arr;
    const idx = codeIndex(dict);
    arr.forEach((p) => {
      if (!p) return;
      if (p.fromRef && idx.node.has(p.fromRef)) p.from = idx.node.get(p.fromRef);
      if (p.toRef && idx.node.has(p.toRef)) p.to = idx.node.get(p.toRef);
      if (Array.isArray(p.tagRefs) && p.tagRefs.length) {
        const ids = p.tagRefs.map((r) => idx.tag.get(r)).filter(Boolean);
        if (ids.length) p.tagIds = ids;
      }
    });
    return arr;
  }

  /**
   * 字典重编译后 ID 会重新编号（源码按简码重建节点），计划 / 规则里存的
   * from / to / tagIds 必须跟着改，否则界面上只剩底层 ID、到期也找不到节点。
   * 只按「域 + 源码简码」配对；同一个键有歧义时不动。
   */
  function remapRefs(list, oldDict, newDict) {
    const arr = list || [];
    if (!oldDict || !newDict || oldDict === newDict) return arr;
    const oldNodes = oldDict.nodes || {};
    const newNodes = newDict.nodes || {};
    const newIds = Object.keys(newNodes);
    /* 源码里写的是 sourceCodeMap 的简码（同码重名会变成 wx1 / wx2），
     * 不是节点自己的 zh_code —— 必须用同一套映射来配对新旧 ID。 */
    let oldCodeMap = null;
    try {
      if (TV.source && TV.source.sourceCodeMap) oldCodeMap = TV.source.sourceCodeMap(oldDict);
    } catch (e) { oldCodeMap = null; }
    const codeOf = (kind, id) => {
      if (oldCodeMap && oldCodeMap.get(id)) return oldCodeMap.get(id);
      const rec = (kind === 'tag' ? oldDict.tags : oldNodes) || {};
      return S((rec[id] || {}).zh_code);
    };
    const findIn = (kind, oldId) => {
      const rec = (kind === 'tag' ? oldDict.tags : oldNodes) || {};
      const n = rec[oldId];
      if (!n) return '';
      const target = (kind === 'tag' ? newDict.tags : newNodes) || {};
      if (target[oldId]) return oldId;
      const code = codeOf(kind, oldId);
      const hits = Object.keys(target).filter((id) => target[id]
        && S(target[id].domain).toUpperCase() === S(n.domain).toUpperCase()
        && (S(target[id].zh_code) === code || S(target[id].zh_code) === S(n.zh_code)));
      return hits.length === 1 ? hits[0] : '';
    };
    const nodeMap = new Map();
    Object.keys(oldNodes).forEach((id) => {
      const hit = findIn('node', id);
      if (hit && hit !== id) nodeMap.set(id, hit);
    });
    const tagMap = new Map();
    Object.keys(oldDict.tags || {}).forEach((id) => {
      const hit = findIn('tag', id);
      if (hit && hit !== id) tagMap.set(id, hit);
    });
    if (!nodeMap.size && !tagMap.size) return arr;
    arr.forEach((p) => {
      if (!p) return;
      if (nodeMap.has(p.from)) p.from = nodeMap.get(p.from);
      if (nodeMap.has(p.to)) p.to = nodeMap.get(p.to);
      if (Array.isArray(p.tagIds) && tagMap.size) {
        p.tagIds = p.tagIds.map((t) => tagMap.get(t) || t);
      }
    });
    return arr;
  }


  /**
   * 到期生成真实流水。
   * 返回的 events 还没有 id；由 app 统一分配 E_xxx。
   */
  function runDuePlans(dict, plans, now, opts) {
    const o = opts || {};
    const today = date.todayStamp(now);
    const generated = [];
    let changed = false;
    const max = o.max || 120;
    (plans || []).forEach((plan) => {
      if (!plan || plan.status !== 'active') return;
      let guard = 0;
      let next = date.addPeriod(plan.lastRun || plan.start, plan.period, 1);
      while (next && next <= today && guard < max) {
        generated.push({
          domain: plan.domain || 'P',
          date: next,
          from: plan.from,
          to: plan.to,
          amountCents: Math.round(Number(plan.amountCents) || 0),
          minutes: 0,
          tagIds: (plan.tagIds || []).slice(),
          chainId: '',
          planId: plan.id,
          raw: '[plan ' + plan.id + ']',
          crossDomain: !!(dict && dict.nodes[plan.from] && dict.nodes[plan.to]
            && dict.nodes[plan.from].domain !== dict.nodes[plan.to].domain),
        });
        plan.lastRun = next;
        changed = true;
        next = date.addPeriod(next, plan.period, 1);
        guard += 1;
      }
    });
    return { events: generated, plans, generated: generated.length, changed };
  }

  function cancelPlan(plans, id) {
    const p = (plans || []).find((x) => x.id === id);
    if (!p) return { ok: false, error: '规则不存在：' + id };
    p.status = 'canceled';
    p.updatedAt = new Date().toISOString();
    return { ok: true, plan: p };
  }

  function resumePlan(plans, id) {
    const p = (plans || []).find((x) => x.id === id);
    if (!p) return { ok: false, error: '规则不存在：' + id };
    p.status = 'active';
    p.updatedAt = new Date().toISOString();
    return { ok: true, plan: p };
  }

  function guessAmountCents(input) {
    const tokens = S(input).split(/[\s\u3000]+/);
    for (const tok of tokens) {
      const q = amount.parseQuantity(tok);
      if (q.ok && q.unit === 'money') return q.cents;
    }
    return 0;
  }

  function matchRule(rule, input, cents) {
    if (!rule || rule.status !== 'active') return false;
    const s = S(input);
    if (!rule.keywords || !rule.keywords.length) return false;
    const hit = rule.keywords.some((k) => s.includes(k));
    if (!hit) return false;
    if (rule.amountOp && rule.amountCents) {
      const v = Number(cents) || guessAmountCents(s);
      if (rule.amountOp === '<' && !(v < rule.amountCents)) return false;
      if (rule.amountOp === '>' && !(v > rule.amountCents)) return false;
      if (rule.amountOp === '=' && v !== rule.amountCents) return false;
    }
    return true;
  }

  function templateOf(rule, dict) {
    const code = (id) => {
      const n = dict && dict.nodes[id];
      return n ? (n.zh_code || n.en_code || id) : id;
    };
    const tags = (rule.tagIds || [])
      .map((id) => (dict && dict.tags[id] ? dict.tags[id].zh_name : id))
      .filter(Boolean);
    const base = code(rule.from) + ' > ' + code(rule.to) + ' ' + (Number(rule.amountCents) / 100);
    const tagPart = tags.concat(rule.name ? [rule.name] : []).map((x) => ' < ' + x).join('');
    return base + tagPart;
  }

  function predict(input, rules, dict) {
    const cents = guessAmountCents(input);
    const hits = (rules || []).filter((r) => matchRule(r, input, cents));
    return hits.map((r) => ({ rule: r, text: templateOf(r, dict) }));
  }

  function summarize(plans) {
    const active = (plans || []).filter((p) => p.status === 'active');
    const canceled = (plans || []).filter((p) => p.status === 'canceled');
    const monthly = active.filter((p) => p.period === 'm')
      .reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
    return {
      active: active.length,
      canceled: canceled.length,
      monthlyCents: monthly,
      monthly: active.filter((p) => p.period === 'm').length,
      daily: active.filter((p) => p.period === 'd').length,
      yearly: active.filter((p) => p.period === 'y').length,
    };
  }

  TV.rules = {
    STATUS,
    PERIOD_LABEL,
    PERIOD_LABEL_EN,
    periodLabel,
    dayOf,
    monthOf,
    clampDay,
    scheduleText,
    shortDate,
    dueStampIn,
    monthKeyOf,
    isoMonthOf,
    addMonthKey,
    monthsBetweenKeys,
    dueStampInMonth,
    planState,
    stateHas,
    addPlanState,
    stateTokenOf,
    installmentInfo,
    installmentNote,
    futureOccurrences,
    planOccurrences,
    confirmOccurrence,
    voidOccurrence,
    occurrenceSpec,
    parsePlanLine,
    serializePlan,
    parseRuleLine,
    serializeRule,
    parseBlocks,
    serializeBlocks,
    upsertPlan,
    nextDue,
    isDue,
    planEvent,
    hasSameEvent,
    runDuePlans,
    materializeDue,
    pendingDaily,
    summarizePlans,
    codeIndex,
    syncPlanRefs,
    resolvePlanRefs,
    remapRefs,
    remapPlans: remapRefs,
    cancelPlan,
    resumePlan,
    guessAmountCents,
    matchRule,
    templateOf,
    predict,
    summarize,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
