/* TxtVein · 母树数据层
 *
 * 纯函数：解析 / 索引 / 图算法校验 / 路径 / 类型继承。
 * 不依赖 DOM、不依赖 dict.js；生成器、测试、浏览器共用同一套规则。
 *
 * 母树是计数树：
 *   - 单根 SYS；
 *   - 每个非根恰好一个父级；
 *   - 内部节点只汇总，叶子可记账；
 *   - 每个内部节点（SYS 除外）必须有 .GENERAL 叶子；
 *   - 中英名成对；推荐简码不是身份。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  const TYPE_INFO = {
    资产: { type: '资产', pole: 'A', form: 'fluid', en: 'Asset' },
    费用: { type: '费用', pole: 'A', form: 'steam', en: 'Expense' },
    成本: { type: '成本', pole: 'A', form: 'ice', en: 'Cost' },
    负债: { type: '负债', pole: 'B', form: 'outside', en: 'Liability' },
    收入: { type: '收入', pole: 'B', form: 'outside', en: 'Income' },
    权益: { type: '权益', pole: 'B', form: 'outside', en: 'Equity' },
  };
  const TYPE_ORDER = ['费用', '成本', '资产', '负债', '收入', '权益'];
  const KINDS = ['root', 'type', 'category'];
  const LANGS = ['zh', 'en'];
  const TREE_ID_RE = /^SYS(\.[A-Z0-9_]+)*$/;
  const MERCHANT_ID_RE = /^SYS\.MERCHANT\.[A-Z0-9_]+$/;
  const BANK_ID_RE = /^SYS\.BANK\.[A-Z0-9_]+$/;
  const CODE_RE = /^[^\s|]+$/;

  function diag(severity, code, message, line, id) {
    return { severity, code, message, line: line || 0, id: id || '' };
  }

  function splitRow(line) {
    return S(line).split('|').map((x) => x.trim());
  }

  function num(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function sortObject(v) {
    if (Array.isArray(v)) return v.map(sortObject);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach((k) => { out[k] = sortObject(v[k]); });
      return out;
    }
    return v;
  }

  function canonical(data) {
    return JSON.stringify(sortObject(data));
  }

  function deepFreeze(o) {
    if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;
    Object.freeze(o);
    Object.keys(o).forEach((k) => deepFreeze(o[k]));
    return o;
  }

  /* ---------------- 解析 ---------------- */

  function parse(source, opts) {
    const o = opts || {};
    const issues = [];
    const nodes = {};
    const merchants = {};
    const banks = {};
    const aliases = [];
    let version = '';
    let format = 0;
    let section = '';
    const lines = S(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');

    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = raw.trim();
      if (!line) return;

      if (line.charAt(0) === '#') {
        const vm = line.match(/^#\s*version\s*:\s*(.+)$/i);
        if (vm) version = vm[1].trim();
        const fm = line.match(/^#\s*format\s*:\s*(\d+)/i);
        if (fm) format = Number(fm[1]);
        return;
      }

      const sm = line.match(/^\[([A-Za-z]+)\]$/);
      if (sm) {
        section = sm[1].toLowerCase();
        if (['tree', 'alias', 'merchant', 'bank', 'tag', 'behavior'].indexOf(section) < 0) {
          issues.push(diag('error', 'SECTION', '未知分区：' + sm[1], lineNo));
        }
        return;
      }

      if (!section) {
        issues.push(diag('error', 'NO_SECTION', '行不在任何分区里', lineNo));
        return;
      }
      if (section === 'tag' || section === 'behavior') return;

      const cols = splitRow(line);
      if (cols[0] && cols[0].toUpperCase() === 'ID') return;

      if (section === 'tree') {
        if (cols.length !== 10) {
          issues.push(diag('error', 'TREE_COLS', 'Tree 行需要 10 列，实际 ' + cols.length, lineNo));
          return;
        }
        const id = cols[0];
        if (!TREE_ID_RE.test(id)) {
          issues.push(diag('error', 'TREE_ID', 'Tree ID 不合规：' + id, lineNo, id));
          return;
        }
        if (nodes[id]) {
          issues.push(diag('error', 'TREE_DUP', 'Tree ID 重复：' + id, lineNo, id));
          return;
        }
        const parent = cols[3] === '-' ? '' : cols[3].replace(/^@/, '');
        const kind = cols[4].toLowerCase();
        if (KINDS.indexOf(kind) < 0) {
          issues.push(diag('error', 'TREE_KIND', 'kind 只认 root/type/category：' + cols[4], lineNo, id));
          return;
        }
        const type = cols[5] === '-' ? '' : cols[5];
        const zhCode = cols[6] === '-' ? '' : cols[6];
        const enCode = cols[7] === '-' ? '' : cols[7];
        if (zhCode && !CODE_RE.test(zhCode)) {
          issues.push(diag('error', 'TREE_CODE', '中文推荐码含空格或竖线：' + zhCode, lineNo, id));
        }
        if (enCode && !CODE_RE.test(enCode)) {
          issues.push(diag('error', 'TREE_CODE', '英文推荐码含空格或竖线：' + enCode, lineNo, id));
        }
        nodes[id] = {
          id,
          zh_name: cols[1],
          en_name: cols[2],
          parent_id: parent,
          kind,
          type,
          zh_code: zhCode,
          en_code: enCode,
          weight: num(cols[8], 0),
          sort: num(cols[9], 0),
        };
        return;
      }

      if (section === 'merchant') {
        if (cols.length !== 7) {
          issues.push(diag('error', 'MERCHANT_COLS', 'Merchant 行需要 7 列，实际 ' + cols.length, lineNo));
          return;
        }
        const id = cols[0];
        if (!MERCHANT_ID_RE.test(id)) {
          issues.push(diag('error', 'MERCHANT_ID', 'Merchant ID 不合规：' + id, lineNo, id));
          return;
        }
        if (merchants[id]) {
          issues.push(diag('error', 'MERCHANT_DUP', 'Merchant ID 重复：' + id, lineNo, id));
          return;
        }
        const zhCode = cols[4] === '-' ? '' : cols[4];
        const enCode = cols[5] === '-' ? '' : cols[5];
        if (zhCode && !CODE_RE.test(zhCode)) {
          issues.push(diag('error', 'MERCHANT_CODE', '商户中文推荐码含空格或竖线：' + zhCode, lineNo, id));
        }
        if (enCode && !CODE_RE.test(enCode)) {
          issues.push(diag('error', 'MERCHANT_CODE', '商户英文推荐码含空格或竖线：' + enCode, lineNo, id));
        }
        merchants[id] = {
          id,
          zh_name: cols[1],
          en_name: cols[2],
          default_category: cols[3] === '-' ? '' : cols[3],
          zh_code: zhCode,
          en_code: enCode,
          weight: num(cols[6], 0),
        };
        return;
      }

      if (section === 'bank') {
        if (cols.length !== 6) {
          issues.push(diag('error', 'BANK_COLS', 'Bank 行需要 6 列，实际 ' + cols.length, lineNo));
          return;
        }
        const id = cols[0];
        if (!BANK_ID_RE.test(id)) {
          issues.push(diag('error', 'BANK_ID', 'Bank ID 不合规：' + id, lineNo, id));
          return;
        }
        if (banks[id]) {
          issues.push(diag('error', 'BANK_DUP', 'Bank ID 重复：' + id, lineNo, id));
          return;
        }
        banks[id] = {
          id,
          zh_name: cols[1],
          en_name: cols[2],
          savings_category: cols[3] === '-' ? '' : cols[3],
          credit_category: cols[4] === '-' ? '' : cols[4],
          weight: num(cols[5], 0),
        };
        return;
      }

      if (section === 'alias') {
        if (cols.length !== 3) {
          issues.push(diag('error', 'ALIAS_COLS', 'Alias 行需要 3 列，实际 ' + cols.length, lineNo));
          return;
        }
        const id = cols[0];
        const lang = cols[1].toLowerCase();
        const alias = cols[2];
        if (LANGS.indexOf(lang) < 0) {
          issues.push(diag('error', 'ALIAS_LANG', '别名语言只认 zh/en：' + cols[1], lineNo, id));
          return;
        }
        if (!alias) {
          issues.push(diag('error', 'ALIAS_EMPTY', '别名为空', lineNo, id));
          return;
        }
        if (alias.indexOf('|') >= 0) {
          issues.push(diag('error', 'ALIAS_PIPE', '别名不能含竖线：' + alias, lineNo, id));
          return;
        }
        aliases.push({ id, lang, alias });
      }
    });

    if (!version) issues.push(diag('error', 'VERSION', '缺 # version: 头', 0));
    if (format !== 1) issues.push(diag('error', 'FORMAT', 'format 必须是 1，实际 ' + format, 0));

    const indexed = index({ nodes, merchants, banks, aliases });
    const validation = validate(indexed, { version, format });
    const all = issues.concat(validation.issues);
    return {
      ok: all.filter((x) => x.severity === 'error').length === 0,
      version: version || o.version || '',
      format: format || 1,
      nodes: indexed.nodes,
      merchants: indexed.merchants,
      banks: indexed.banks,
      aliases: indexed.aliases,
      diagnostics: all,
      stats: validation.stats,
      index: indexed,
    };
  }

  /* ---------------- 索引 ---------------- */

  function index(data) {
    const nodes = {};
    Object.keys(data.nodes || {}).forEach((id) => {
      nodes[id] = Object.assign({}, data.nodes[id]);
    });
    const merchants = {};
    Object.keys(data.merchants || {}).forEach((id) => {
      merchants[id] = Object.assign({}, data.merchants[id]);
    });
    const banks = {};
    Object.keys(data.banks || {}).forEach((id) => {
      banks[id] = Object.assign({}, data.banks[id]);
    });
    const aliases = (data.aliases || []).map((a) => Object.assign({}, a));

    Object.keys(nodes).forEach((id) => {
      nodes[id].children = [];
      nodes[id].depth = -1;
      nodes[id].postable = false;
    });
    Object.keys(nodes).forEach((id) => {
      const p = nodes[id].parent_id;
      if (p && nodes[p]) nodes[p].children.push(id);
    });
    Object.keys(nodes).forEach((id) => {
      nodes[id].children.sort((a, b) => {
        const x = nodes[a];
        const y = nodes[b];
        return (x.sort - y.sort) || a.localeCompare(b);
      });
    });

    function depthOf(id, seen) {
      if (!nodes[id]) return -1;
      if (nodes[id].depth >= 0) return nodes[id].depth;
      if (seen.has(id)) return -1;
      seen.add(id);
      const p = nodes[id].parent_id;
      if (!p) return 0;
      const d = depthOf(p, seen);
      return d < 0 ? -1 : d + 1;
    }
    Object.keys(nodes).forEach((id) => {
      nodes[id].depth = depthOf(id, new Set());
      nodes[id].postable = nodes[id].kind !== 'root' && nodes[id].children.length === 0;
    });

    const aliasIndex = { zh: new Map(), en: new Map() };
    aliases.forEach((a) => {
      if (!aliasIndex[a.lang]) return;
      if (!aliasIndex[a.lang].has(a.alias)) aliasIndex[a.lang].set(a.alias, []);
      aliasIndex[a.lang].get(a.alias).push(a.id);
    });

    const codeIndex = { zh: new Map(), en: new Map() };
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      if (!n.postable) return;
      if (n.zh_code) {
        if (!codeIndex.zh.has(n.zh_code)) codeIndex.zh.set(n.zh_code, []);
        codeIndex.zh.get(n.zh_code).push(id);
      }
      if (n.en_code) {
        if (!codeIndex.en.has(n.en_code)) codeIndex.en.set(n.en_code, []);
        codeIndex.en.get(n.en_code).push(id);
      }
    });
    Object.keys(merchants).forEach((id) => {
      const m = merchants[id];
      if (m.zh_code) {
        if (!codeIndex.zh.has(m.zh_code)) codeIndex.zh.set(m.zh_code, []);
        codeIndex.zh.get(m.zh_code).push(id);
      }
      if (m.en_code) {
        if (!codeIndex.en.has(m.en_code)) codeIndex.en.set(m.en_code, []);
        codeIndex.en.get(m.en_code).push(id);
      }
    });

    return { nodes, merchants, banks, aliases, aliasIndex, codeIndex };
  }

  /* ---------------- 校验 ---------------- */

  function validate(indexed, opts) {
    const nodes = indexed.nodes || {};
    const merchants = indexed.merchants || {};
    const banks = indexed.banks || {};
    const aliases = indexed.aliases || [];
    const issues = [];
    const err = (code, message, id) => issues.push(diag('error', code, message, 0, id));
    const warn = (code, message, id) => issues.push(diag('warn', code, message, 0, id));

    const ids = Object.keys(nodes);
    const roots = ids.filter((id) => nodes[id].kind === 'root');

    if (roots.length !== 1 || roots[0] !== 'SYS') {
      err('ROOT', '必须恰好有一个根 SYS，实际：' + roots.join(','));
    }
    if (nodes.SYS) {
      if (nodes.SYS.parent_id) err('ROOT_PARENT', 'SYS 不能有父级');
      if (nodes.SYS.type || nodes.SYS.zh_code || nodes.SYS.en_code) {
        err('ROOT_FIELDS', 'SYS 不能有类型或推荐码');
      }
    }

    const types = ids.filter((id) => nodes[id].kind === 'type');
    const seenTypes = new Set();
    types.forEach((id) => {
      const n = nodes[id];
      if (n.parent_id !== 'SYS') err('TYPE_PARENT', 'type 的父级必须是 SYS：' + id, id);
      if (!TYPE_INFO[n.type]) err('TYPE_VALUE', 'type 大类不合法：' + id + ' / ' + n.type, id);
      if (seenTypes.has(n.type)) err('TYPE_DUP', '大类重复：' + n.type, id);
      seenTypes.add(n.type);
      if (n.zh_code || n.en_code) err('TYPE_CODE', 'type 不写推荐码：' + id, id);
    });
    TYPE_ORDER.forEach((t) => {
      if (!seenTypes.has(t)) err('TYPE_MISSING', '缺大类：' + t, '');
    });

    const zhNames = new Map();
    const enNames = new Map();
    const zhCodes = new Map();
    const enCodes = new Map();
    const leafSets = {};

    ids.forEach((id) => {
      const n = nodes[id];
      if (!TREE_ID_RE.test(id)) err('ID', 'Tree ID 不合规：' + id, id);
      if (/\.(ZH|EN)$/.test(id)) err('LANG_NODE', '不要建中英两个节点：' + id, id);
      if (!n.zh_name) err('ZH_NAME', '缺中文名：' + id, id);
      if (!n.en_name) err('EN_NAME', '缺英文名：' + id, id);
      if (n.zh_name && zhNames.has(n.zh_name)) err('ZH_NAME_DUP', '中文名重复：' + n.zh_name, id);
      if (n.en_name && enNames.has(n.en_name)) err('EN_NAME_DUP', '英文名重复：' + n.en_name, id);
      if (n.zh_name) zhNames.set(n.zh_name, id);
      if (n.en_name) enNames.set(n.en_name, id);

      if (n.kind === 'type') {
        if (n.children.length < 2) err('TYPE_BRANCH', 'type 至少 2 个子节点：' + id, id);
        if (!nodes[id + '.GENERAL'] || nodes[id + '.GENERAL'].parent_id !== id) {
          err('TYPE_GENERAL', 'type 缺 .GENERAL 叶子：' + id, id);
        }
      } else if (n.kind === 'category') {
        if (!n.parent_id) err('PARENT', 'category 必须有父级：' + id, id);
        else if (!nodes[n.parent_id]) err('PARENT_MISSING', '父级不存在：' + id + ' → ' + n.parent_id, id);
        else if (['type', 'category'].indexOf(nodes[n.parent_id].kind) < 0) {
          err('PARENT_KIND', 'category 的父级必须是 type/category：' + id, id);
        }
        if (n.type) err('CATEGORY_TYPE', 'category 不写大类：' + id, id);
        if (n.children.length > 0) {
          if (n.children.length < 2) err('BRANCH', '内部节点至少 2 个子节点：' + id, id);
          if (!nodes[id + '.GENERAL'] || nodes[id + '.GENERAL'].parent_id !== id) {
            err('GENERAL', '内部节点缺 .GENERAL 叶子：' + id, id);
          }
        } else {
          if (!n.zh_code || !n.en_code) err('LEAF_CODE', '叶子必须有中英推荐码：' + id, id);
        }
      }

      if (n.depth < 0) err('CYCLE', '父链成环或不可达：' + id, id);
      else if (n.depth > 3) err('DEPTH', '深度超过 3：' + id + ' = ' + n.depth, id);

      if (n.children.length > 0) {
        if (n.zh_code || n.en_code) err('INTERNAL_CODE', '内部节点不写推荐码：' + id, id);
        const max = id === 'SYS' ? 12 : (n.kind === 'type' ? 20 : 15);
        if (n.children.length > max) err('BRANCH_MAX', '分支超过 ' + max + '：' + id + ' = ' + n.children.length, id);
      }

      if (n.postable) {
        if (n.zh_code) {
          if (zhCodes.has(n.zh_code)) err('ZH_CODE_DUP', '中文推荐码重复：' + n.zh_code, id);
          zhCodes.set(n.zh_code, id);
        }
        if (n.en_code) {
          if (enCodes.has(n.en_code)) err('EN_CODE_DUP', '英文推荐码重复：' + n.en_code, id);
          enCodes.set(n.en_code, id);
        }
      }
    });

    // 层叠：任意两节点的叶子集，只能不交、包含、被包含。
    ids.forEach((id) => { leafSets[id] = leafSet(nodes, id); });
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = leafSets[ids[i]];
        const b = leafSets[ids[j]];
        let inter = 0;
        a.forEach((x) => { if (b.has(x)) inter += 1; });
        if (inter > 0 && inter !== a.size && inter !== b.size) {
          err('LAMINAR', '叶子集相交但不包含：' + ids[i] + ' / ' + ids[j], ids[i]);
        }
      }
    }

    const mIds = Object.keys(merchants);
    const mZhCodes = new Map();
    const mEnCodes = new Map();
    const mZhNames = new Map();
    const mEnNames = new Map();
    mIds.forEach((id) => {
      const m = merchants[id];
      if (!MERCHANT_ID_RE.test(id)) err('MERCHANT_ID', '商户 ID 不合规：' + id, id);
      if (!m.zh_name) err('MERCHANT_ZH', '商户缺中文名：' + id, id);
      if (!m.en_name) err('MERCHANT_EN', '商户缺英文名：' + id, id);
      if (m.zh_name && mZhNames.has(m.zh_name)) err('MERCHANT_ZH_DUP', '商户中文名重复：' + m.zh_name, id);
      if (m.en_name && mEnNames.has(m.en_name)) err('MERCHANT_EN_DUP', '商户英文名重复：' + m.en_name, id);
      if (m.zh_name) mZhNames.set(m.zh_name, id);
      if (m.en_name) mEnNames.set(m.en_name, id);
      if (!m.zh_code || !m.en_code) err('MERCHANT_CODE_MISS', '商户必须有中英推荐码：' + id, id);
      if (m.zh_code) {
        if (mZhCodes.has(m.zh_code)) err('MERCHANT_ZH_CODE_DUP', '商户中文推荐码重复：' + m.zh_code, id);
        mZhCodes.set(m.zh_code, id);
      }
      if (m.en_code) {
        if (mEnCodes.has(m.en_code)) err('MERCHANT_EN_CODE_DUP', '商户英文推荐码重复：' + m.en_code, id);
        mEnCodes.set(m.en_code, id);
      }
      if (!m.default_category || !nodes[m.default_category]) {
        err('MERCHANT_DEFAULT', '商户默认分类不存在：' + id + ' → ' + m.default_category, id);
      } else if (!nodes[m.default_category].postable) {
        err('MERCHANT_DEFAULT_LEAF', '商户默认分类不是叶子：' + id + ' → ' + m.default_category, id);
      }
    });

    // 银行 facet：独立子树，不是锚点目标；储蓄/借贷两列指向计数树叶子。
    const bIds = Object.keys(banks);
    const bZhNames = new Map();
    const bEnNames = new Map();
    bIds.forEach((id) => {
      const b = banks[id];
      if (!BANK_ID_RE.test(id)) err('BANK_ID', '银行 ID 不合规：' + id, id);
      if (!b.zh_name) err('BANK_ZH', '银行缺中文名：' + id, id);
      if (!b.en_name) err('BANK_EN', '银行缺英文名：' + id, id);
      if (b.zh_name && bZhNames.has(b.zh_name)) err('BANK_ZH_DUP', '银行中文名重复：' + b.zh_name, id);
      if (b.en_name && bEnNames.has(b.en_name)) err('BANK_EN_DUP', '银行英文名重复：' + b.en_name, id);
      if (b.zh_name) bZhNames.set(b.zh_name, id);
      if (b.en_name) bEnNames.set(b.en_name, id);
      if (!b.savings_category || !nodes[b.savings_category]) {
        err('BANK_SAVINGS', '银行储蓄分类不存在：' + id + ' → ' + b.savings_category, id);
      } else if (!nodes[b.savings_category].postable) {
        err('BANK_SAVINGS_LEAF', '银行储蓄分类不是叶子：' + id + ' → ' + b.savings_category, id);
      } else {
        const t = effectiveType(nodes, b.savings_category);
        if (!t || t.type !== '资产') err('BANK_SAVINGS_TYPE', '银行储蓄分类必须是资产：' + id, id);
      }
      if (b.credit_category) {
        if (!nodes[b.credit_category]) {
          err('BANK_CREDIT', '银行借贷分类不存在：' + id + ' → ' + b.credit_category, id);
        } else if (!nodes[b.credit_category].postable) {
          err('BANK_CREDIT_LEAF', '银行借贷分类不是叶子：' + id + ' → ' + b.credit_category, id);
        } else {
          const t = effectiveType(nodes, b.credit_category);
          if (!t || t.type !== '负债') err('BANK_CREDIT_TYPE', '银行借贷分类必须是负债：' + id, id);
        }
      }
    });

    // 推荐码跨 Tree / Merchant 也不重复，避免输入歧义。
    zhCodes.forEach((id, code) => {
      if (mZhCodes.has(code)) err('CODE_CROSS_DUP', '中文推荐码跨树/商户重复：' + code + ' / ' + id + ' / ' + mZhCodes.get(code), id);
    });
    enCodes.forEach((id, code) => {
      if (mEnCodes.has(code)) err('CODE_CROSS_DUP', '英文推荐码跨树/商户重复：' + code + ' / ' + id + ' / ' + mEnCodes.get(code), id);
    });

    const aliasSeen = { zh: new Map(), en: new Map() };
    aliases.forEach((a) => {
      if (!a.id || (!nodes[a.id] && !merchants[a.id] && !banks[a.id])) {
        err('ALIAS_TARGET', '别名目标不存在：' + a.id + ' / ' + a.alias, a.id);
        return;
      }
      if (LANGS.indexOf(a.lang) < 0) {
        err('ALIAS_LANG', '别名语言只认 zh/en：' + a.lang, a.id);
        return;
      }
      if (/\s/.test(a.alias)) {
        warn('ALIAS_SPACE', '别名含空格，只用于搜索；流水输入请用简码：' + a.alias, a.id);
      }
      const key = a.alias;
      const seen = aliasSeen[a.lang];
      if (seen.has(key) && seen.get(key) !== a.id) {
        err('ALIAS_DUP', '别名重复：' + a.lang + ' / ' + key, a.id);
      }
      seen.set(key, a.id);
    });

    const leafIds = ids.filter((id) => nodes[id].postable);
    const maxDepth = ids.reduce((m, id) => Math.max(m, nodes[id].depth), 0);
    const maxBranching = ids.reduce((m, id) => Math.max(m, nodes[id].children.length), 0);
    const stats = {
      nodeCount: ids.length,
      leafCount: leafIds.length,
      typeCount: types.length,
      categoryCount: ids.filter((id) => nodes[id].kind === 'category').length,
      merchantCount: mIds.length,
      bankCount: bIds.length,
      aliasCount: aliases.length,
      maxDepth,
      maxBranching,
      postableCount: leafIds.length,
    };
    const errors = issues.filter((x) => x.severity === 'error').length;
    return { ok: errors === 0, issues, stats };
  }

  function leafSet(nodes, id, cache) {
    const c = cache || {};
    if (c[id]) return c[id];
    const n = nodes[id];
    if (!n) return new Set();
    if (!n.children || n.children.length === 0) {
      const s = new Set([id]);
      c[id] = s;
      return s;
    }
    const out = new Set();
    n.children.forEach((child) => {
      leafSet(nodes, child, c).forEach((x) => out.add(x));
    });
    c[id] = out;
    return out;
  }

  /* ---------------- 查询 ---------------- */

  function ancestors(nodes, id) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) {
      out.unshift(cur);
      cur = nodes[cur].parent_id;
      guard += 1;
    }
    return out;
  }

  function path(nodes, id, lang) {
    const l = lang === 'en' ? 'en' : 'zh';
    return ancestors(nodes, id).map((x) => (l === 'en' ? nodes[x].en_name : nodes[x].zh_name));
  }

  function pathLabel(nodes, id, lang) {
    return path(nodes, id, lang).join(' / ');
  }

  function effectiveType(nodes, id) {
    const chain = ancestors(nodes, id);
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const n = nodes[chain[i]];
      if (n && n.kind === 'type' && TYPE_INFO[n.type]) {
        const info = TYPE_INFO[n.type];
        return { id: n.id, type: info.type, polarity: info.pole, form: info.form, en: info.en };
      }
    }
    return null;
  }

  function isPostable(nodes, id) {
    const n = nodes[id];
    if (!n || n.kind === 'root') return false;
    if (Array.isArray(n.children)) return n.children.length === 0;
    return !Object.keys(nodes).some((k) => nodes[k].parent_id === id);
  }

  function search(indexed, query, lang) {
    const q = S(query).trim().toLowerCase();
    if (!q) return [];
    const nodes = indexed.nodes || {};
    const merchants = indexed.merchants || {};
    const banks = indexed.banks || {};
    const l = lang === 'en' ? 'en' : 'zh';
    const hits = [];
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      const name = (l === 'en' ? n.en_name : n.zh_name) || '';
      const code = (l === 'en' ? n.en_code : n.zh_code) || '';
      if (name.toLowerCase() === q || code.toLowerCase() === q) hits.push({ id, kind: n.postable ? 'leaf' : 'node', exact: true });
      else if (name.toLowerCase().indexOf(q) === 0 || code.toLowerCase().indexOf(q) === 0) hits.push({ id, kind: n.postable ? 'leaf' : 'node', exact: false });
    });
    Object.keys(merchants).forEach((id) => {
      const m = merchants[id];
      const name = (l === 'en' ? m.en_name : m.zh_name) || '';
      const code = (l === 'en' ? m.en_code : m.zh_code) || '';
      if (name.toLowerCase() === q || code.toLowerCase() === q) hits.push({ id, kind: 'merchant', exact: true });
    });
    Object.keys(banks).forEach((id) => {
      const b = banks[id];
      const name = (l === 'en' ? b.en_name : b.zh_name) || '';
      if (name.toLowerCase() === q) hits.push({ id, kind: 'bank', exact: true });
      else if (name.toLowerCase().indexOf(q) === 0) hits.push({ id, kind: 'bank', exact: false });
    });
    if (indexed.aliasIndex && indexed.aliasIndex[l] && indexed.aliasIndex[l].has(q)) {
      indexed.aliasIndex[l].get(q).forEach((id) => {
        const kind = nodes[id] ? (nodes[id].postable ? 'leaf' : 'node') : banks[id] ? 'bank' : 'merchant';
        hits.push({ id, kind, exact: true });
      });
    }
    const seen = new Set();
    return hits.filter((h) => {
      const k = h.id + '|' + h.kind;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, b) => (b.exact - a.exact) || a.id.localeCompare(b.id));
  }

  function publicData(parsed) {
    const nodes = {};
    Object.keys(parsed.nodes || {}).sort().forEach((id) => {
      const n = parsed.nodes[id];
      nodes[id] = {
        id: n.id,
        zh_name: n.zh_name,
        en_name: n.en_name,
        parent_id: n.parent_id,
        kind: n.kind,
        type: n.type,
        zh_code: n.zh_code,
        en_code: n.en_code,
        weight: n.weight,
        sort: n.sort,
      };
    });
    const merchants = {};
    Object.keys(parsed.merchants || {}).sort().forEach((id) => {
      const m = parsed.merchants[id];
      merchants[id] = {
        id: m.id,
        zh_name: m.zh_name,
        en_name: m.en_name,
        default_category: m.default_category,
        zh_code: m.zh_code,
        en_code: m.en_code,
        weight: m.weight,
      };
    });
    const aliases = (parsed.aliases || []).map((a) => ({ id: a.id, lang: a.lang, alias: a.alias }))
      .sort((a, b) => (a.id + '|' + a.lang + '|' + a.alias).localeCompare(b.id + '|' + b.lang + '|' + b.alias));
    const banks = {};
    Object.keys(parsed.banks || {}).sort().forEach((id) => {
      const b = parsed.banks[id];
      banks[id] = {
        id: b.id,
        zh_name: b.zh_name,
        en_name: b.en_name,
        savings_category: b.savings_category,
        credit_category: b.credit_category,
        weight: b.weight,
      };
    });
    return { format: parsed.format || 1, version: parsed.version || '', nodes, merchants, banks, aliases };
  }

  TV.systemDictCore = {
    TYPE_INFO,
    TYPE_ORDER,
    KINDS,
    LANGS,
    TREE_ID_RE,
    MERCHANT_ID_RE,
    parse,
    index,
    validate,
    leafSet,
    ancestors,
    path,
    pathLabel,
    effectiveType,
    isPostable,
    search,
    publicData,
    canonical,
    sortObject,
    deepFreeze,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.systemDictCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
