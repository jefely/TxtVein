/* TxtVein · 日期层
 * 账本内部唯一写法：YYMMDD（如 261110）。
 * 输入层允许：261110 / 20261110 / 2026-11-10 / 26-11-10 / 0 / -1 / +1。
 * 铁律：相对日期只活在输入层，落盘前必须固化为绝对日期。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);

  const YEAR_MIN = 1900;
  const YEAR_MAX = 2199;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function fail(error, extra) {
    return Object.assign({ ok: false, error }, extra || {});
  }

  function mk(year, month, day) {
    return {
      ok: true,
      year,
      month,
      day,
      key: year * 10000 + month * 100 + day,
      stamp: pad2(year % 100) + pad2(month) + pad2(day),
      iso: year + '-' + pad2(month) + '-' + pad2(day),
      error: '',
    };
  }

  function parseParts(y, m, d) {
    let ys = String(y == null ? '' : y).trim();
    const ms = String(m == null ? '' : m).trim();
    const ds = String(d == null ? '' : d).trim();
    if (text) {
      ys = text.toHalfWidthDigits(ys);
    }
    if (!/^\d{2}(\d{2})?$/.test(ys) || !/^\d{1,2}$/.test(ms) || !/^\d{1,2}$/.test(ds)) {
      return fail('日期应写成 261110 或 2026-11-10');
    }
    let year = Number(ys);
    if (ys.length === 2) year += 2000;
    const month = Number(ms);
    const day = Number(ds);
    if (year < YEAR_MIN || year > YEAR_MAX) return fail('年份超出 ' + YEAR_MIN + '–' + YEAR_MAX);
    if (month < 1 || month > 12) return fail('月份必须在 1–12 之间');
    const maxDay = daysInMonth(year, month);
    if (day < 1 || day > maxDay) return fail('这个月没有 ' + day + ' 号');
    return mk(year, month, day);
  }

  function parseDate(raw) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return fail('日期不能为空');
    if (text) s = text.toHalfWidthDigits(s);
    let m;
    if (/^\d{8}$/.test(s)) return parseParts(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
    if (/^\d{6}$/.test(s)) return parseParts(s.slice(0, 2), s.slice(2, 4), s.slice(4, 6));
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
      return parseParts(m[1], m[2], m[3]);
    }
    if ((m = s.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
      return parseParts(m[1], m[2], m[3]);
    }
    return fail('日期应写成 261110 或 2026-11-10');
  }

  /** 相对日期语法糖。offset 单位：天。 */
  function resolveDateToken(raw, now) {
    let s = String(raw == null ? '' : raw).trim();
    if (text) {
      s = text.toHalfWidthDigits(s);
      s = text.normalizeSign(s);
    }
    if (/^[+-]?\d{1,3}$/.test(s)) {
      const offset = parseInt(s, 10);
      if (Math.abs(offset) > 366) return fail('相对日期最多前后 366 天');
      const base = now instanceof Date ? new Date(now.getTime()) : new Date();
      base.setDate(base.getDate() + offset);
      const d = mk(base.getFullYear(), base.getMonth() + 1, base.getDate());
      d.relative = true;
      d.offset = offset;
      return d;
    }
    const d = parseDate(s);
    if (d.ok) {
      d.relative = false;
      d.offset = 0;
    }
    return d;
  }

  function stampOf(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date();
    return pad2(d.getFullYear() % 100) + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function todayStamp(now) {
    return stampOf(now || new Date());
  }

  function toDate(stamp) {
    const p = String(stamp || '');
    if (!/^\d{6}$/.test(p)) return null;
    return new Date(2000 + Number(p.slice(0, 2)), Number(p.slice(2, 4)) - 1, Number(p.slice(4, 6)));
  }

  function addDays(stamp, n) {
    const d = toDate(stamp);
    if (!d) return '';
    d.setDate(d.getDate() + Number(n || 0));
    return stampOf(d);
  }

  function addMonths(stamp, n) {
    const p = parseDate(stamp);
    if (!p.ok) return '';
    const target = new Date(p.year, p.month - 1 + Number(n || 0), 1);
    const y = target.getFullYear();
    const m = target.getMonth() + 1;
    const d = Math.min(p.day, daysInMonth(y, m));
    return mk(y, m, d).stamp;
  }

  function addYears(stamp, n) {
    const p = parseDate(stamp);
    if (!p.ok) return '';
    const y = p.year + Number(n || 0);
    const m = p.month;
    const d = Math.min(p.day, daysInMonth(y, m));
    return mk(y, m, d).stamp;
  }

  function addPeriod(stamp, period, n) {
    const k = String(period || '').toLowerCase();
    if (k === 'd') return addDays(stamp, n == null ? 1 : n);
    if (k === 'm') return addMonths(stamp, n == null ? 1 : n);
    if (k === 'y') return addYears(stamp, n == null ? 1 : n);
    return '';
  }

  function compare(a, b) {
    return String(a || '').localeCompare(String(b || ''));
  }

  function inRange(stamp, range) {
    if (!range || !range.start) return true;
    return stamp >= range.start && stamp <= range.end;
  }

  function mkRange(start, end, label) {
    const a = parseDate(start);
    const b = parseDate(end);
    if (!a.ok) return fail(a.error);
    if (!b.ok) return fail(b.error);
    if (a.key > b.key) return fail('区间起点晚于终点');
    return {
      ok: true,
      start: a.stamp,
      end: b.stamp,
      startISO: a.iso,
      endISO: b.iso,
      text: a.stamp + '~' + b.stamp,
      label: label || (a.iso + ' ~ ' + b.iso),
      error: '',
    };
  }

  function monthRange(base, offset) {
    const d = base instanceof Date ? base : new Date();
    const first = new Date(d.getFullYear(), d.getMonth() + (offset || 0), 1);
    const y = first.getFullYear();
    const m = first.getMonth() + 1;
    const last = daysInMonth(y, m);
    return mkRange(
      pad2(y % 100) + pad2(m) + '01',
      pad2(y % 100) + pad2(m) + pad2(last),
      (offset === -1 ? '上月 ' : offset === 0 ? '本月 ' : '') + y + '-' + pad2(m)
    );
  }

  function yearRange(base, offset) {
    const d = base instanceof Date ? base : new Date();
    const y = d.getFullYear() + (offset || 0);
    return mkRange(String(y) + '0101', String(y) + '1231', (offset === -1 ? '去年 ' : '今年 ') + y);
  }

  function allRange() {
    return mkRange('000101', '991231', '全期');
  }

  function ymdToken(y, m, d) {
    const ys = String(y || '').replace(/[^\d]/g, '');
    const mm = pad2(String(m || '').replace(/[^\d]/g, ''));
    const dd = pad2(String(d || '').replace(/[^\d]/g, ''));
    return ys.length === 4 ? ys + '-' + mm + '-' + dd : pad2(ys) + mm + dd;
  }

  /**
   * 区间解析。空输入默认「本月」，与报表页一致。
   * 支持：全部 / 本月 / 上月 / 今年 / 261101~261130 / 2026-11 /
   *       26，11，01，>，26，11，30 / 2026-11-01 ~ 2026-11-30 / 单日。
   */
  function parseRange(raw, now) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s || s === '本月' || /^month$/i.test(s)) return monthRange(now, 0);
    if (s === '上月') return monthRange(now, -1);
    if (s === '今年' || s === '本年' || /^year$/i.test(s)) return yearRange(now, 0);
    if (s === '去年') return yearRange(now, -1);
    if (s === '全部' || s === '全期' || /^all$/i.test(s)) return allRange();

    let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mm = Number(m[2]);
      if (mm < 1 || mm > 12) return fail('月份不对：' + s);
      return mkRange(
        String(y) + pad2(mm) + '01',
        String(y) + pad2(mm) + pad2(daysInMonth(y, mm)),
        y + '-' + pad2(mm)
      );
    }

    m = s.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*[~～至]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})$/);
    if (m) return mkRange(m[1], m[2]);

    m = s.match(/^(\d{6})\s*[~～至>]\s*(\d{6})$/);
    if (m) return mkRange(m[1], m[2]);

    const f = s.split(/[，,\t]/).map((x) => x.trim()).filter(Boolean);
    if (f.length === 7 && /^[>＞]$/.test(f[3])) {
      return mkRange(ymdToken(f[0], f[1], f[2]), ymdToken(f[4], f[5], f[6]));
    }
    if (f.length === 6) {
      return mkRange(ymdToken(f[0], f[1], f[2]), ymdToken(f[3], f[4], f[5]));
    }

    const one = parseDate(s);
    if (one.ok) return mkRange(one.stamp, one.stamp, one.iso);
    return fail(one.error || '认不出区间：' + s);
  }

  TV.date = {
    YEAR_MIN,
    YEAR_MAX,
    pad2,
    daysInMonth,
    parseParts,
    parseDate,
    resolveDateToken,
    stampOf,
    todayStamp,
    toDate,
    addDays,
    addMonths,
    addYears,
    addPeriod,
    compare,
    inRange,
    mkRange,
    monthRange,
    yearRange,
    allRange,
    parseRange,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.date;
})(typeof globalThis !== 'undefined' ? globalThis : this);
