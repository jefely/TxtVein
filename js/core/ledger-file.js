/* TxtVein · 流水文本（ledger）
 * 纯文本唯一事实源。每行一笔原子转移，只写 ID：
 *
 *   # TxtVein ledger · 纯文本唯一事实源
 *   # FORMAT: 1
 *   # VAULT_ID: 8a2b1c3d
 *   # LINK: <字典 SHA-256>
 *   P 261110 N_001 > N_002 3500 T_01
 *   P 261110 N_001 > N_002 60m T_time
 *   [PLAN]
 *   R_001 active: 0 N_001 > N_002 100000 *m last_run=261110
 *   [RULES]
 *   R_001 active: keywords=(外卖)&amount<10000 -> N_001 > N_002 tags=T_01 name=外卖
 *
 * 哈希互锁：LINK 行本身不参与哈希，否则两边互为哈希会形成死循环。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);
  const rulesMod = TV.rules || (typeof require === 'function' ? require('./rules.js') : null);

  const HEADER = '# TxtVein ledger · 纯文本唯一事实源';
  const FORMAT = '1';
  const EVENT_RE = /^(?:\[([PFCH])\]|([PFCH]))\s+(\d{6})\s+(\S+)\s*>\s*(\S+)\s+(\S+)\s*(.*)$/;
  const TAG_RE = /^T_[A-Za-z0-9_]+$/;
  const CHAIN_RE = /^C_[A-Za-z0-9_]+$/;

  function eventLine(event) {
    const parts = [
      event.domain || 'P',
      event.date,
      event.from,
      '>',
      event.to,
      event.minutes > 0 ? amount.formatMinutes(event.minutes) : String(Math.round(Number(event.amountCents) || 0)),
    ];
    (event.tagIds || []).forEach((id) => parts.push(id));
    if (event.chainId) parts.push('^' + event.chainId);
    const note = S(event.note).trim();
    return parts.join(' ') + (note ? ' // ' + note.replace(/\/\//g, '/ /') : '');
  }

  function serializeLedger(state) {
    const s = state || {};
    const lines = [
      HEADER,
      '# FORMAT: ' + FORMAT,
      '# VAULT_ID: ' + S(s.vaultId),
      '# LINK: ' + S(s.link),
      '# 域: P 个人 / F 家庭 / C 公司 / H 合伙',
      '# 金额: 整数分；60m 为时间代币；标签为 T_ID',
    ];
    (s.events || []).forEach((e) => lines.push(eventLine(e)));
    const blocks = rulesMod.serializeBlocks(s.plans || [], s.rules || []);
    if (blocks) {
      lines.push(blocks);
    }
    return lines.join('\n') + '\n';
  }

  function parseMeta(lines) {
    const meta = { format: '', vaultId: '', link: '' };
    lines.forEach((line) => {
      const m = S(line).match(/^#\s*([A-Za-z_]+)\s*:\s*(.*)$/);
      if (!m) return;
      const key = m[1].toUpperCase();
      if (key === 'FORMAT') meta.format = m[2].trim();
      if (key === 'VAULT_ID') meta.vaultId = m[2].trim();
      if (key === 'LINK') meta.link = m[2].trim();
    });
    return meta;
  }

  function parseLedger(src, opts) {
    const o = opts || {};
    const raw = text.normalize(src);
    const lines = raw.split('\n');
    const meta = parseMeta(lines);
    const events = [];
    const warnings = [];
    let section = '';
    let index = 0;

    lines.forEach((line, lineNo) => {
      const s = line.trim();
      if (!s) return;
      const sec = s.match(/^\[(PLAN|RULES?)\]$/i);
      if (sec) {
        section = sec[1].toUpperCase().startsWith('PLAN') ? 'plan' : 'rule';
        return;
      }
      if (s.startsWith('#')) return;
      if (section === 'plan' || section === 'rule') return; /* 交给 rules.parseBlocks */
      const m = s.match(EVENT_RE);
      if (!m) {
        warnings.push('第 ' + (lineNo + 1) + ' 行不是合法流水：' + s);
        return;
      }
      const tagIds = [];
      let chainId = '';
      const extras = (m[7] || '').split(/[\s\u3000]+/).filter(Boolean);
      extras.forEach((tok) => {
        if (TAG_RE.test(tok)) { tagIds.push(tok); return; }
        if (tok.startsWith('^') && CHAIN_RE.test(tok.slice(1))) { chainId = tok.slice(1); return; }
        warnings.push('第 ' + (lineNo + 1) + ' 行有未知标记：' + tok);
      });
      const isTime = amount.isTimeToken(m[6]);
      let cents = 0;
      let mins = 0;
      if (isTime) {
        const q = amount.parseTime(m[6]);
        if (!q.ok) {
          warnings.push('第 ' + (lineNo + 1) + ' 行时间无法解析：' + m[6]);
          return;
        }
        mins = q.minutes;
      } else {
        cents = Math.round(Number(m[6]) || 0);
        if (!Number.isSafeInteger(cents) || cents <= 0) {
          warnings.push('第 ' + (lineNo + 1) + ' 行金额（分）不合法：' + m[6]);
          return;
        }
      }
      events.push({
        id: 'E_' + String(index + 1).padStart(4, '0'),
        domain: m[1] || m[2],
        date: m[3],
        from: m[4],
        to: m[5],
        amountCents: cents,
        minutes: mins,
        tagIds,
        chainId,
        raw: s,
        line: lineNo + 1,
      });
      index += 1;
    });

    const blocks = rulesMod.parseBlocks(raw);
    warnings.push.apply(warnings, blocks.warnings || []);

    const issues = validateLedger(o.dict, events, blocks.plans);
    return {
      ok: true,
      meta,
      vaultId: meta.vaultId,
      link: meta.link,
      events,
      plans: blocks.plans,
      rules: blocks.rules,
      warnings,
      issues,
      raw,
    };
  }

  function validateLedger(dict, events, plans) {
    const issues = [];
    const add = (level, code, message, ref) => issues.push({ level, code, message, ref: ref || '' });
    (events || []).forEach((e, i) => {
      if (!/^\d{6}$/.test(e.date) || !date.parseDate(e.date).ok) add('error', 'EVENT_DATE', '第 ' + (i + 1) + ' 笔日期不合法：' + e.date);
      if (!(e.amountCents > 0) && !(e.minutes > 0)) add('error', 'EVENT_AMOUNT', '第 ' + (i + 1) + ' 笔金额/时间必须大于 0');
      if (!dict) return;
      if (!dict.nodes[e.from]) add('error', 'EVENT_FROM', '第 ' + (i + 1) + ' 笔转出节点不存在：' + e.from);
      if (!dict.nodes[e.to]) add('error', 'EVENT_TO', '第 ' + (i + 1) + ' 笔转入节点不存在：' + e.to);
      (e.tagIds || []).forEach((tid) => {
        if (!dict.tags[tid]) add('warn', 'EVENT_TAG', '第 ' + (i + 1) + ' 笔标签不存在：' + tid);
      });
    });
    (plans || []).forEach((p) => {
      if (!p.from || !p.to) add('error', 'PLAN_NODE', '计划缺少节点：' + p.id);
      if (!(p.amountCents > 0)) add('error', 'PLAN_AMOUNT', '计划金额必须大于 0：' + p.id);
      if (['d', 'm', 'y'].indexOf(p.period) < 0) add('error', 'PLAN_PERIOD', '计划周期不合法：' + p.id);
    });
    return issues;
  }

  /** LINK 行不参与哈希；其余逐字归一化（CRLF → LF，末尾补一个换行）。 */
  function bodyForHash(src) {
    const lines = text.normalize(src).split('\n')
      .filter((line) => !/^#\s*LINK\s*:/i.test(line.trim()));
    let out = lines.join('\n');
    out = out.replace(/\n+$/, '');
    return out + '\n';
  }

  function getLink(src) {
    return parseMeta(text.normalize(src).split('\n')).link;
  }

  function getVaultId(src) {
    return parseMeta(text.normalize(src).split('\n')).vaultId;
  }

  function setLink(src, hash) {
    const lines = text.normalize(src).split('\n');
    const next = lines.filter((line) => !/^#\s*LINK\s*:/i.test(line.trim()));
    let at = 0;
    for (let i = 0; i < next.length; i += 1) {
      if (/^#\s*FORMAT\s*:/i.test(next[i].trim())) { at = i + 1; break; }
      if (next[i].trim().startsWith('#')) at = i + 1;
    }
    next.splice(at, 0, '# LINK: ' + S(hash));
    return next.join('\n').replace(/\n+$/, '') + '\n';
  }

  function isLedger(src) {
    const s = text.normalize(src).trim();
    if (!s) return false;
    if (s.startsWith('# TxtVein ledger')) return true;
    return s.split('\n').some((line) => EVENT_RE.test(line.trim()));
  }

  function summarize(events, plans) {
    let count = 0;
    let cents = 0;
    let minutes = 0;
    let minDate = '';
    let maxDate = '';
    (events || []).forEach((e) => {
      count += 1;
      cents += Math.round(Number(e.amountCents) || 0);
      minutes += Math.round(Number(e.minutes) || 0);
      if (!minDate || e.date < minDate) minDate = e.date;
      if (!maxDate || e.date > maxDate) maxDate = e.date;
    });
    return {
      count, cents, minutes, minDate, maxDate,
      plans: (plans || []).length,
      activePlans: (plans || []).filter((p) => p.status === 'active').length,
    };
  }

  TV.ledgerFile = {
    HEADER,
    FORMAT,
    eventLine,
    serializeLedger,
    parseLedger,
    validateLedger,
    bodyForHash,
    getLink,
    getVaultId,
    setLink,
    isLedger,
    parseMeta,
    summarize,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.ledgerFile;
})(typeof globalThis !== 'undefined' ? globalThis : this);
