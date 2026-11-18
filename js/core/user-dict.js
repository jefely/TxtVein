/* TxtVein · 用户字典拆分 / 合并
 *
 * 物理拆分：user_p.dict（P/F）与 user_c.dict（C/H）。
 * 编译时仍合并成一个 Dict；拆分只发生在存储边界。
 *
 * 规则：
 *   - P 文件只允许 P/F 域；C 文件只允许 C/H 域；
 *   - 同域唯一，P/C 可以各有一个同码；
 *   - alias 目标跨域时必须写 N:P:code / N:C:code；
 *   - 拆不开的行不静默丢，返回错误 + 行号。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  const SECTION = {
    account: '[会计]',
    note: '[备注]',
    behavior: '[行为]',
  };
  const SECTION_ALIAS = {
    '会计': 'account', ACCOUNT: 'account',
    '备注': 'note', NOTE: 'note',
    '行为': 'behavior', BEHAVIOR: 'behavior',
    '树': 'tree', TREE: 'tree',
  };
  const KIND_PREFIX = { node: 'N', tag: 'T', item: 'H' };
  const PREFIX_KIND = { N: 'node', T: 'tag', H: 'item' };

  function diag(line, message, severity, code) {
    return { line: line || 0, message, severity: severity || 'error', code: code || 'SPLIT' };
  }

  function groupOf(domain) {
    const d = S(domain).toUpperCase();
    if (d === 'P' || d === 'F') return 'P';
    if (d === 'C' || d === 'H') return 'C';
    return '';
  }

  function groupLabel(group) {
    return group === 'P' ? 'P/F' : 'C/H';
  }

  function cleanLine(line) {
    return S(line).replace(/\/\/.*$/, '').trim();
  }

  function parseData(line) {
    const clean = cleanLine(line);
    const m = clean.match(/^(node|tag|item)\s+/i);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    const toks = clean.split(/[\s\u3000]+/).filter(Boolean);
    let domain = '';
    let code = '';
    if (kind === 'node') {
      if (toks.length < 7) return { kind, error: '节点行不足 7 列' };
      domain = toks[1];
      code = toks[4];
    } else if (kind === 'tag') {
      if (toks.length < 6) return { kind, error: '标签行不足 6 列' };
      domain = toks[1];
      code = toks[3];
    } else {
      if (toks.length < 5) return { kind, error: '行为项行不足 5 列' };
      domain = toks[1];
      code = toks[2];
    }
    const right = S(line).split('|')[1] || '';
    const pm = right.match(/(?:^|\s)@([^\s]+)(?:\s|$)/);
    return {
      kind,
      domain: S(domain).toUpperCase(),
      code: S(code),
      parent: pm ? pm[1] : '',
      raw: S(line),
    };
  }

  function parseAlias(line) {
    const clean = cleanLine(line);
    const m = clean.match(/^alias\s+(.+?)\s*->\s*(.+)$/i);
    if (!m) return null;
    return {
      key: m[1].trim(),
      targets: m[2].split(',').map((x) => x.trim()).filter(Boolean),
      raw: S(line),
    };
  }

  function isV3Text(src) {
    const s = S(src);
    return /^\s*\[(树|会计|TREE|ACCOUNT)\]/mi.test(s) || /^\s*(node|tag|item)\s/mi.test(s);
  }

  function split(source) {
    if (TV.dictV4 && !isV3Text(source)) return TV.dictV4.splitByDomain(source);
    const lines = S(source).replace(/\r\n?/g, '\n').split('\n');
    const diagnostics = [];
    const common = [];
    const sides = {
      P: { account: [], note: [], behavior: [], aliases: [] },
      C: { account: [], note: [], behavior: [], aliases: [] },
    };
    const codes = { node: {}, tag: {}, item: {} };
    const byCode = { node: new Map(), tag: new Map(), item: new Map() };
    const records = [];
    const aliases = [];
    const treeLinks = [];
    let section = 'account';
    let treeDomain = '';
    let treeType = '';
    let treeStack = [];

    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = raw.trim();
      if (!line) return;
      if (line.indexOf('//') === 0) {
        if (!/^\/\/\s*TxtVein/i.test(line)) common.push(line);
        return;
      }
      const sm = line.match(/^\[([^\]]+)\]$/);
      if (sm) {
        const key = SECTION_ALIAS[sm[1].trim().toUpperCase()] || SECTION_ALIAS[sm[1].trim()];
        if (!key) {
          diagnostics.push(diag(lineNo, '未知段：' + sm[1], 'error', 'SECTION'));
          return;
        }
        section = key;
        treeStack = [];
        return;
      }
      if (section === 'tree') {
        const rawLine = raw.replace(/\t/g, '  ');
        const txt = rawLine.trim();
        if (!txt) return;
        const indent = rawLine.match(/^ */)[0].length;
        const h = txt.match(/^([PCFH])\s+(费用|收入|资产|负债|成本|权益)$/);
        if (h) {
          treeDomain = h[1];
          treeType = h[2];
          treeStack = [];
          return;
        }
        const m = txt.match(/^(.*?)\s*\[([^\]]+)\]$/);
        if (!m) {
          diagnostics.push(diag(lineNo, '树行格式：缩进 + 名称 + [简码]', 'error', 'TREE'));
          return;
        }
        if (!treeDomain) {
          diagnostics.push(diag(lineNo, '树行前缺少「域 类型」标题', 'error', 'TREE'));
          return;
        }
        const code = m[2].trim();
        const parent = treeStack.filter((x) => x.indent < indent).slice(-1)[0];
        treeLinks.push({ domain: treeDomain, type: treeType, code, parentCode: parent ? parent.code : '', line: lineNo });
        while (treeStack.length && treeStack[treeStack.length - 1].indent >= indent) treeStack.pop();
        treeStack.push({ indent, code });
        return;
      }
      if (/^alias\b/i.test(line)) {
        const a = parseAlias(line);
        if (!a) { diagnostics.push(diag(lineNo, '别名格式不对', 'error', 'ALIAS')); return; }
        a.line = lineNo;
        aliases.push(a);
        return;
      }
      const rec = parseData(line);
      if (!rec) {
        diagnostics.push(diag(lineNo, '无法识别的行：' + line, 'error', 'LINE'));
        return;
      }
      if (rec.error) {
        diagnostics.push(diag(lineNo, rec.error, 'error', 'COLUMNS'));
        return;
      }
      const group = groupOf(rec.domain);
      if (!group) {
        diagnostics.push(diag(lineNo, '域只认 P/F/C/H：' + rec.domain, 'error', 'DOMAIN'));
        return;
      }
      if (!rec.code) {
        diagnostics.push(diag(lineNo, '缺简码', 'error', 'CODE'));
        return;
      }
      rec.group = group;
      rec.section = section;
      rec.line = lineNo;
      records.push(rec);
      const key = rec.domain + '\u0000' + rec.code;
      codes[rec.kind][key] = true;
      if (!byCode[rec.kind].has(rec.code)) byCode[rec.kind].set(rec.code, new Set());
      byCode[rec.kind].get(rec.code).add(rec.domain);
    });

    if (treeLinks.length) {
      const recByKey = new Map();
      records.forEach((rec) => recByKey.set(rec.domain + '\u0000' + rec.code, rec));
      treeLinks.forEach((link) => {
        const rec = recByKey.get(link.domain + '\u0000' + link.code);
        if (!rec) {
          diagnostics.push(diag(link.line, '树行找不到节点：' + link.code, 'error', 'TREE'));
          return;
        }
        if (link.parentCode && !recByKey.get(link.domain + '\u0000' + link.parentCode)) {
          diagnostics.push(diag(link.line, '树行父级找不到：' + link.parentCode, 'error', 'TREE'));
          return;
        }
        rec.parent = link.parentCode || '';
        const base = S(rec.raw).replace(/\s+@(?!SYS\.)\S+/g, '').trim();
        rec.raw = base + (rec.parent ? ' @' + rec.parent : '');
      });
    }

    if (diagnostics.length) {
      return { ok: false, p: '', c: '', diagnostics, stats: null };
    }

    // 私人父级必须同域、同 kind。
    records.forEach((rec) => {
      if (!rec.parent || rec.parent === '-') return;
      if (/^SYS\./i.test(rec.parent)) return; // 锚点
      const key = rec.domain + '\u0000' + rec.parent;
      if (codes[rec.kind][key]) return;
      const domains = byCode[rec.kind].get(rec.parent);
      if (domains && domains.size) {
        diagnostics.push(diag(rec.line, '父码跨域：' + rec.parent + ' 不在 ' + rec.domain + ' 域', 'error', 'PARENT_DOMAIN'));
      } else {
        diagnostics.push(diag(rec.line, '父码不存在：' + rec.parent, 'error', 'PARENT_MISSING'));
      }
    });

    // 别名目标按域拆；跨域同码必须写域限定。
    aliases.forEach((a) => {
      const buckets = { P: [], C: [] };
      a.targets.forEach((tok) => {
        const m = tok.match(/^([NTH]):(?:([PFCH]):)?(.+)$/i);
        if (!m) {
          diagnostics.push(diag(a.line, '别名目标格式：N:码 / T:码 / H:码', 'error', 'ALIAS_TARGET'));
          return;
        }
        const kind = PREFIX_KIND[m[1].toUpperCase()];
        const explicit = m[2] ? m[2].toUpperCase() : '';
        const code = m[3];
        let domain = explicit;
        if (!domain) {
          const domains = byCode[kind].get(code);
          if (!domains || !domains.size) {
            diagnostics.push(diag(a.line, '别名目标不存在：' + tok, 'error', 'ALIAS_TARGET'));
            return;
          }
          if (domains.size > 1) {
            diagnostics.push(diag(a.line, '别名目标跨域同码，请写 N:P:码 / N:C:码：' + tok, 'error', 'ALIAS_DOMAIN'));
            return;
          }
          domain = Array.from(domains)[0];
        } else if (!codes[kind][domain + '\u0000' + code]) {
          diagnostics.push(diag(a.line, '别名目标的域限定不存在：' + tok, 'error', 'ALIAS_TARGET'));
          return;
        }
        const group = groupOf(domain);
        if (!group) {
          diagnostics.push(diag(a.line, '别名目标域不合法：' + tok, 'error', 'ALIAS_DOMAIN'));
          return;
        }
        buckets[group].push(tok);
      });
      ['P', 'C'].forEach((g) => {
        if (buckets[g].length) {
          sides[g].aliases.push('alias ' + a.key + ' -> ' + buckets[g].join(', '));
        }
      });
    });

    records.forEach((rec) => {
      sides[rec.group][rec.section].push(rec.raw);
    });

    function render(group) {
      const s = sides[group];
      const out = [];
      out.push('// TxtVein user_' + (group === 'P' ? 'p' : 'c') + '.dict · ' + groupLabel(group));
      /* 注释统一放 P 侧，避免 P/C 各存一份、每次合并翻倍。 */
      if (group === 'P') common.forEach((c) => out.push(c));
      ['account', 'note', 'behavior'].forEach((sec) => {
        out.push(SECTION[sec]);
        s[sec].forEach((line) => out.push(line));
      });
      s.aliases.forEach((line) => out.push(line));
      return out.join('\n').replace(/\n+$/, '') + '\n';
    }

    const p = render('P');
    const c = render('C');
    const ok = diagnostics.filter((x) => x.severity === 'error').length === 0;
    const stats = {
      p: countSide(sides.P),
      c: countSide(sides.C),
      aliases: aliases.length,
    };
    return { ok, p, c, diagnostics, stats };
  }

  function countSide(s) {
    return {
      nodes: s.account.filter((l) => /^node\b/i.test(cleanLine(l))).length,
      tags: s.note.filter((l) => /^tag\b/i.test(cleanLine(l))).length,
      items: s.behavior.filter((l) => /^item\b/i.test(cleanLine(l))).length,
      aliases: s.aliases.length,
    };
  }

  function checkSide(source, group) {
    const allowed = group === 'P' ? ['P', 'F'] : ['C', 'H'];
    const forbidden = group === 'P' ? ['C', 'H'] : ['P', 'F'];
    const diagnostics = [];
    const lines = S(source).replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const clean = cleanLine(raw);
      if (!clean) return;
      if (/^\[/.test(clean)) return;
      if (/^alias\b/i.test(clean)) {
        const targets = clean.split('->')[1] || '';
        targets.split(',').forEach((tok) => {
          const m = tok.trim().match(/^([NTH]):([PFCH]):/i);
          if (m && forbidden.indexOf(m[2].toUpperCase()) >= 0) {
            diagnostics.push(diag(lineNo, '别名目标跨组：' + tok.trim(), 'error', 'ALIAS_GROUP'));
          }
        });
        return;
      }
      const rec = parseData(raw);
      if (!rec || rec.error) return;
      const d = S(rec.domain).toUpperCase();
      if (forbidden.indexOf(d) >= 0) {
        diagnostics.push(diag(lineNo, 'user_' + (group === 'P' ? 'p' : 'c') + '.dict 不能有 ' + d + ' 域', 'error', 'SIDE_DOMAIN'));
      } else if (allowed.indexOf(d) < 0) {
        diagnostics.push(diag(lineNo, '域只认 P/F/C/H：' + d, 'error', 'DOMAIN'));
      }
    });
    return { ok: diagnostics.length === 0, diagnostics };
  }

  function stripHeader(src, group) {
    return S(src).replace(/\r\n?/g, '\n').split('\n')
      .filter((line) => !/^\/\/\s*TxtVein/i.test(line.trim()))
      .join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  }

  function merge(p, c) {
    if (TV.dictV4 && !isV3Text(p) && !isV3Text(c)) return TV.dictV4.mergeSides(p, c);
    const a = checkSide(p, 'P');
    const b = checkSide(c, 'C');
    const diagnostics = a.diagnostics.concat(b.diagnostics);
    if (!a.ok || !b.ok) {
      return { ok: false, source: '', diagnostics };
    }
    const body = [stripHeader(p, 'P'), stripHeader(c, 'C')].filter(Boolean).join('\n\n');
    const source = '// TxtVein dict · P + C\n' + body + (body ? '\n' : '');
    return { ok: true, source, diagnostics };
  }

  TV.userDict = {
    groupOf,
    split,
    merge,
    checkSide,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.userDict;
})(typeof globalThis !== 'undefined' ? globalThis : this);
