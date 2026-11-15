/* TxtVein · 金额层
 * 铁律：底层只存整数分。本模块是唯一允许出现「元 → 分」转换的地方。
 *
 * 输入：35 / 35.5 / 3.5k / ¥1,000.00 / 60min
 * 输出：{ ok, cents, minutes, unit, error }
 * 展示：centsToDisplay 折叠为 35 / 3.5k；formatPlain 还原 ¥3,512.34。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);

  const MAX_CENTS = 9e15; /* Number.MAX_SAFE_INTEGER 以内 */
  const MONEY_RE = /^\d+(?:\.\d{1,2})?$/;
  const K_RE = /^(\d+(?:\.\d{1,4})?)k$/i;
  /* d/h/m 是时间单位；min 与 ′ 是兼容写法。后台一律整数分钟。 */
  const TIME_UNITS = { d: 1440, h: 60, m: 1 };
  const TIME_RE = /^(\d+(?:\.\d{1,4})?)(d|h|m|min|′)$/i;
  const TIME_COMPOSITE_RE = /^(?:\d+(?:\.\d{1,4})?[dhm])+$/i;
  const MAX_MINUTES = 100 * 366 * 1440;

  function clean(raw) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (text) s = text.toHalfWidthDigits(s);
    return s
      .replace(/[¥￥$]/g, '')
      .replace(/[,，\s]/g, '')
      .replace(/^\+/, '');
  }

  /**
   * 元（或 k 缩写）→ 整数分。
   * 3.5k = 3500 元 = 350000 分。
   */
  function parseAmount(raw) {
    const s = clean(raw);
    if (!s) return { ok: false, cents: 0, minutes: 0, unit: 'money', error: '金额为空' };

    let yuan;
    let m;
    if ((m = s.match(K_RE))) {
      yuan = Number(m[1]) * 1000;
    } else if (MONEY_RE.test(s)) {
      yuan = Number(s);
    } else {
      return { ok: false, cents: 0, minutes: 0, unit: 'money', error: '金额格式不对：' + raw };
    }
    if (!Number.isFinite(yuan)) {
      return { ok: false, cents: 0, minutes: 0, unit: 'money', error: '金额超出范围' };
    }
    const cents = Math.round(yuan * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_CENTS) {
      return { ok: false, cents: 0, minutes: 0, unit: 'money', error: '金额超出范围' };
    }
    return { ok: true, cents, minutes: 0, unit: 'money', error: '' };
  }

  function unitMinutes(unit) {
    const u = String(unit || '').toLowerCase();
    if (u === 'min' || u === '′') return 1;
    return TIME_UNITS[u] || 0;
  }

  function isTimeToken(raw) {
    const s = clean(raw);
    return TIME_RE.test(s) || TIME_COMPOSITE_RE.test(s);
  }

  /** 60m / 1.5h / 1d2h30m → 分钟整数。时间代币不进入金额余额。 */
  function parseTime(raw) {
    const s = clean(raw);
    let minutes = 0;
    const single = s.match(TIME_RE);
    if (single) {
      minutes = Number(single[1]) * unitMinutes(single[2]);
    } else if (TIME_COMPOSITE_RE.test(s)) {
      const re = /(\d+(?:\.\d{1,4})?)(d|h|m)/gi;
      let m;
      while ((m = re.exec(s))) minutes += Number(m[1]) * unitMinutes(m[2]);
    } else {
      return { ok: false, cents: 0, minutes: 0, unit: 'time', error: '时间格式不对：' + raw };
    }
    const total = Math.round(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, cents: 0, minutes: 0, unit: 'time', error: '时间必须大于 0' };
    }
    if (total > MAX_MINUTES) {
      return { ok: false, cents: 0, minutes: 0, unit: 'time', error: '时间超出范围' };
    }
    return { ok: true, cents: 0, minutes: total, unit: 'time', error: '' };
  }

  /** 统一入口：金额或时间。 */
  function parseQuantity(raw) {
    const s = clean(raw);
    if (isTimeToken(s)) return parseTime(s);
    return parseAmount(s);
  }

  function splitPeriod(token) {
    const s = String(token == null ? '' : token).trim();
    const m = s.match(/^(.*?)\*([dmy])$/i);
    if (!m) return { token: s, period: '', ok: true };
    return { token: m[1], period: m[2].toLowerCase(), ok: true };
  }

  function abs(n) {
    return Math.abs(Math.round(Number(n) || 0));
  }

  /** 整数分 → 展示缩写：<1000 元不缩写；≥1000 用 k。 */
  function centsToDisplay(cents) {
    const n = Math.round(Number(cents) || 0);
    if (n === 0) return '0';
    const neg = n < 0;
    const a = Math.abs(n);
    let out;
    if (a < 100000) {
      const yuan = Math.floor(a / 100);
      const rest = a % 100;
      if (rest === 0) out = String(yuan);
      else {
        const frac = String(rest).padStart(2, '0').replace(/0+$/, '');
        out = yuan + '.' + frac;
      }
    } else {
      const k = a / 100000;
      const rounded = Math.round(k * 100) / 100;
      out = String(rounded).replace(/\.0+$/, '') + 'k';
    }
    return (neg ? '-' : '') + out;
  }

  /** 详情态：¥3,512.34（固定两位小数，千分位）。 */
  function formatPlain(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const a = Math.abs(n);
    const yuan = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const frac = String(a % 100).padStart(2, '0');
    return (neg ? '-¥' : '¥') + yuan + '.' + frac;
  }

  function formatYuan(cents) {
    return formatPlain(cents);
  }

  /** 存储层：只输出总分钟数 + m，不分解 d/h；例如 1590 -> 1590m。 */
  function formatMinutes(minutes) {
    const n = Math.round(Number(minutes) || 0);
    return n > 0 ? n + 'm' : '0';
  }

  function formatTime(minutes) {
    let n = Math.round(Number(minutes) || 0);
    if (n <= 0) return '0';
    const d = Math.floor(n / 1440);
    n -= d * 1440;
    const h = Math.floor(n / 60);
    const m = n - h * 60;
    return (d ? d + 'd' : '') + (h ? h + 'h' : '') + (m ? m + 'm' : '') || '0';
  }

  function formatQuantity(item) {
    if (!item) return '0';
    if (item.minutes > 0) return formatTime(item.minutes);
    return centsToDisplay(item.amountCents);
  }

  function sum(list, key) {
    const k = key || 'amountCents';
    return (list || []).reduce((acc, x) => acc + Math.round(Number(x && x[k]) || 0), 0);
  }

  TV.amount = {
    MAX_CENTS,
    MAX_MINUTES,
    TIME_UNITS,
    clean,
    parseAmount,
    parseTime,
    parseQuantity,
    isTimeToken,
    splitPeriod,
    centsToDisplay,
    formatPlain,
    formatYuan,
    formatTime,
    formatMinutes,
    formatQuantity,
    sum,
    abs,
    /* 规范文档里的名字 */
    displayToCents(raw) {
      const r = parseAmount(raw);
      return r.ok ? r.cents : NaN;
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.amount;
})(typeof globalThis !== 'undefined' ? globalThis : this);
