/* TxtVein · 字典层
 * 流水只存 ID；这一层负责 ID ⇄ 名字/简码/极性/域/树关系。
 * 改名只改这里，历史流水一行不动。
 *
 * 四维一体：zh_name / en_name / zh_code / en_code
 * 双极：A（资产/费用/成本）与 B（负债/收入/权益）
 * 多域：P 个人 / F 家庭 / C 公司 / H 合伙
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  const DOMAINS = {
    P: { code: 'P', zh: '个人', en: 'Personal' },
    F: { code: 'F', zh: '家庭', en: 'Family' },
    C: { code: 'C', zh: '公司', en: 'Company' },
    H: { code: 'H', zh: '合伙', en: 'Partnership' },
  };
  const DOMAIN_ORDER = ['P', 'F', 'C', 'H'];

  const TYPES = {
    资产: { type: '资产', pole: 'A', form: 'fluid', en: 'Asset', hint: '流体：现金/流动资产' },
    费用: { type: '费用', pole: 'A', form: 'steam', en: 'Expense', hint: '蒸汽：花掉就离开池子' },
    成本: { type: '成本', pole: 'A', form: 'ice', en: 'Cost', hint: '冰块：实物/固定资产' },
    负债: { type: '负债', pole: 'B', form: 'outside', en: 'Liability', hint: '外面：欠别人的' },
    收入: { type: '收入', pole: 'B', form: 'outside', en: 'Income', hint: '外面：流进来的' },
    权益: { type: '权益', pole: 'B', form: 'outside', en: 'Equity', hint: '外面：属于你的权益' },
  };
  const TYPE_ALL = ['资产', '费用', '成本', '负债', '收入', '权益'];
  const TYPE_ORDER = ['费用', '收入', '资产', '负债', '成本', '权益'];

  const TYPE_ALIAS = {
    资产类: '资产', 费用类: '费用', 成本类: '成本',
    负债类: '负债', 收入类: '收入', 权益类: '权益',
    所有者权益: '权益', 净资产: '权益',
    asset: '资产', assets: '资产',
    expense: '费用', expenses: '费用',
    cost: '成本', costs: '成本',
    liability: '负债', liabilities: '负债',
    income: '收入', revenue: '收入',
    equity: '权益',
  };

  const FORMS = { fluid: '流体', ice: '冰块', steam: '蒸汽', outside: '外部' };
  const KIND_TAG = { gain: '增益', suppress: '阻抑', time: '时间', plain: '普通' };

  function isDomain(d) {
    return !!DOMAINS[S(d).toUpperCase()];
  }

  function domainInfo(code) {
    return DOMAINS[S(code || 'P').toUpperCase()] || DOMAINS.P;
  }

  function domainLabel(code, lang) {
    const d = domainInfo(code);
    return lang === 'en' ? d.en : d.zh;
  }

  function normalizeDomain(raw, fallback) {
    const s = S(raw).trim().toUpperCase();
    if (DOMAINS[s]) return { ok: true, domain: s, error: '' };
    if (!s) return { ok: true, domain: fallback || 'P', error: '' };
    return { ok: false, domain: fallback || 'P', error: '域只认 P/F/C/H：' + raw };
  }

  function normalizeType(raw) {
    const s = S(raw).trim();
    if (!s) return { ok: false, type: '', pole: '', form: '', error: '财务大类不能为空' };
    const t = TYPES[s] ? s : TYPE_ALIAS[s.toLowerCase()] || TYPE_ALIAS[s];
    if (!t) {
      return { ok: false, type: '', pole: '', form: '', error: '大类只认：资产/费用/成本/负债/收入/权益' };
    }
    const info = TYPES[t];
    return { ok: true, type: t, pole: info.pole, form: info.form, en: info.en, error: '' };
  }

  function normalizeForm(type, raw) {
    const t = normalizeType(type);
    if (!t.ok) return { ok: false, form: '', error: t.error };
    const s = S(raw).trim().toLowerCase();
    if (!s) return { ok: true, form: t.form, error: '' };
    if (t.pole === 'B') return { ok: true, form: 'outside', error: '' };
    const zhMap = { 流体: 'fluid', 冰块: 'ice', 蒸汽: 'steam' };
    const f = FORMS[s] ? s : zhMap[s];
    if (!f || f === 'outside') return { ok: false, form: t.form, error: 'A 极形态只认 fluid/ice/steam' };
    return { ok: true, form: f, error: '' };
  }

  function normalizeCode(raw) {
    return S(raw).replace(/[\s\u3000]+/g, '').trim();
  }

  function normalizeWeight(raw, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback == null ? 100 : fallback;
    return Math.max(0, Math.min(1000, Math.round(n)));
  }

  function normalizeSort(raw, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback == null ? 100 : fallback;
    return Math.max(0, Math.min(100000, Math.round(n)));
  }

  function slug(raw) {
    return S(raw).trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u4e00-\u9fff-]/g, '');
  }

  function emptyDict(vaultId, now) {
    const ts = (now instanceof Date ? now : new Date()).toISOString();
    return {
      format: 'txtvein-dict',
      version: 1,
      vaultId: vaultId || '',
      link: '',
      meta: {
        nextNode: 1, nextTag: 1, nextEvent: 1, nextChain: 1,
        nextRule: 1, nextPlan: 1, createdAt: ts, updatedAt: ts,
      },
      nodes: {}, tags: {}, behaviors: {}, aliases: {},
    };
  }

  function ensureMeta(dict) {
    if (!dict.meta || typeof dict.meta !== 'object') dict.meta = {};
    const m = dict.meta;
    ['nextNode', 'nextTag', 'nextEvent', 'nextChain', 'nextRule', 'nextPlan'].forEach((k) => {
      if (!Number.isFinite(Number(m[k])) || Number(m[k]) < 1) m[k] = 1;
      m[k] = Math.floor(Number(m[k]));
    });
    if (!m.createdAt) m.createdAt = new Date().toISOString();
    if (!m.updatedAt) m.updatedAt = m.createdAt;
    return dict;
  }

  function maxSeq(map, prefix) {
    let max = 0;
    Object.keys(map || {}).forEach((id) => {
      const m = S(id).match(new RegExp('^' + prefix + '_(\\d+)$'));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
  }

  function bumpMeta(dict) {
    ensureMeta(dict);
    dict.meta.nextNode = Math.max(dict.meta.nextNode, maxSeq(dict.nodes, 'N') + 1);
    dict.meta.nextTag = Math.max(dict.meta.nextTag, maxSeq(dict.tags, 'T') + 1);
    return dict;
  }

  function nextId(dict, kind) {
    ensureMeta(dict);
    const m = dict.meta;
    if (kind === 'node') {
      let n = m.nextNode;
      while (dict.nodes['N_' + String(n).padStart(3, '0')]) n += 1;
      m.nextNode = n + 1;
      return 'N_' + String(n).padStart(3, '0');
    }
    if (kind === 'tag') {
      let n = m.nextTag;
      while (dict.tags['T_' + String(n).padStart(2, '0')]) n += 1;
      m.nextTag = n + 1;
      return 'T_' + String(n).padStart(2, '0');
    }
    if (kind === 'event') {
      const id = 'E_' + String(m.nextEvent).padStart(4, '0');
      m.nextEvent += 1;
      return id;
    }
    if (kind === 'chain') {
      const id = 'C_' + String(m.nextChain).padStart(3, '0');
      m.nextChain += 1;
      return id;
    }
    if (kind === 'rule') {
      const id = 'R_' + String(m.nextRule).padStart(3, '0');
      m.nextRule += 1;
      return id;
    }
    if (kind === 'plan') {
      const id = 'R_' + String(m.nextPlan).padStart(3, '0');
      m.nextPlan += 1;
      return id;
    }
    throw new Error('unknown id kind: ' + kind);
  }

  function aliasesFor(dict, id) {
    const out = [];
    Object.keys(dict.aliases || {}).forEach((k) => {
      if ((dict.aliases[k] || []).includes(id)) out.push(k);
    });
    return out;
  }

  function addAlias(dict, alias, id) {
    const key = S(alias).trim();
    if (!key || !id) return { created: false, previous: [] };
    if (!dict.aliases) dict.aliases = {};
    let oldKey = key;
    if (!Object.prototype.hasOwnProperty.call(dict.aliases, key)) {
      const hit = Object.keys(dict.aliases).find((k) => k.toLowerCase() === key.toLowerCase());
      if (hit) oldKey = hit;
    }
    const prev = Array.isArray(dict.aliases[oldKey]) ? dict.aliases[oldKey].slice() : [];
    if (prev.includes(id)) return { created: false, previous: prev, key: oldKey };
    dict.aliases[oldKey] = Array.from(new Set(prev.concat(id)));
    return { created: true, previous: prev, key: oldKey };
  }

  function removeAlias(dict, alias, id) {
    const key = S(alias).trim();
    if (!key || !dict.aliases || !dict.aliases[key]) return false;
    dict.aliases[key] = dict.aliases[key].filter((x) => x !== id);
    if (!dict.aliases[key].length) delete dict.aliases[key];
    return true;
  }

  /* 基础别名：名字与简码。显式数字后缀别名（wx1/wx2）保留。 */
  function rebuildAliases(dict) {
    const old = dict.aliases || {};
    const keep = {};
    Object.keys(old).forEach((k) => {
      if (/^.+\d{1,2}$/.test(k) && Array.isArray(old[k])) keep[k] = old[k].slice();
    });
    dict.aliases = {};
    const put = (alias, id) => {
      const a = S(alias).trim();
      if (!a) return;
      const hit = Object.keys(dict.aliases).find((k) => k.toLowerCase() === a.toLowerCase());
      const key = hit || a;
      const arr = dict.aliases[key] || [];
      if (!arr.includes(id)) arr.push(id);
      dict.aliases[key] = arr;
    };
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      [n.zh_name, n.en_name, n.zh_code, n.en_code].forEach((a) => put(a, id));
    });
    Object.keys(dict.tags || {}).forEach((id) => {
      const t = dict.tags[id];
      [t.zh_name, t.en_name, t.zh_code, t.en_code].forEach((a) => put(a, id));
    });
    Object.keys(keep).forEach((k) => {
      const ids = keep[k].filter((id) => dict.nodes[id] || dict.tags[id]);
      if (ids.length) dict.aliases[k] = ids;
    });
    return dict;
  }

  function addNode(dict, input) {
    const p = input || {};
    const t = normalizeType(p.type || p.zh_type || p.en_type);
    let type = t.type;
    let pole = t.pole;
    let form = t.form;
    if (!t.ok) {
      const pol = S(p.polarity).toUpperCase();
      if (pol === 'A' || pol === 'B') {
        type = pol === 'A' ? '资产' : '权益';
        pole = pol;
        form = pol === 'A' ? 'fluid' : 'outside';
      } else {
        return { ok: false, error: t.error };
      }
    }
    const formCheck = normalizeForm(type, p.form);
    if (!formCheck.ok) return { ok: false, error: formCheck.error };
    form = formCheck.form;

    const zhName = S(p.zh_name || p.name).trim();
    const enName = S(p.en_name).trim() || zhName;
    if (!zhName && !enName) return { ok: false, error: '节点要有名字' };
    const zhCode = normalizeCode(p.zh_code || p.code || zhName);
    const enCode = normalizeCode(p.en_code || slug(enName));
    if (!zhCode && !enCode) return { ok: false, error: '节点要有至少一个简码' };

    const dm = normalizeDomain(p.domain, 'P');
    if (!dm.ok) return { ok: false, error: dm.error };
    if (p.parent_id && !dict.nodes[p.parent_id]) return { ok: false, error: '父节点不存在：' + p.parent_id };
    if (p.polarity && S(p.polarity).toUpperCase() !== pole) {
      return { ok: false, error: '极性与大类不一致：' + type + ' 是 ' + pole + ' 极' };
    }

    const id = nextId(dict, 'node');
    dict.nodes[id] = {
      zh_name: zhName || enName,
      en_name: enName || zhName,
      zh_code: zhCode,
      en_code: enCode,
      polarity: pole,
      type,
      form,
      domain: dm.domain,
      parent_id: S(p.parent_id),
      weight: normalizeWeight(p.weight, 100),
      sort: normalizeSort(p.sort, 100),
      pin: p.pin ? 1 : 0,
      uses: Number.isFinite(Number(p.uses)) ? Math.max(0, Math.round(Number(p.uses))) : 0,
      lastUsed: S(p.lastUsed || p.last_used || ''),
      system: !!p.system,
      created_at: new Date().toISOString(),
    };
    addAlias(dict, zhCode, id);
    addAlias(dict, enCode, id);
    addAlias(dict, dict.nodes[id].zh_name, id);
    addAlias(dict, dict.nodes[id].en_name, id);
    ensureMeta(dict);
    dict.meta.updatedAt = new Date().toISOString();
    return { ok: true, id, node: dict.nodes[id] };
  }

  function updateNode(dict, id, patch) {
    const node = dict.nodes[id];
    if (!node) return { ok: false, error: '节点不存在：' + id };
    const p = patch || {};
    if (p.type != null) {
      const t = normalizeType(p.type);
      if (!t.ok) return { ok: false, error: t.error };
      node.type = t.type;
      node.polarity = t.pole;
      node.form = normalizeForm(t.type, p.form).form;
    } else if (p.polarity && S(p.polarity).toUpperCase() !== node.polarity) {
      return { ok: false, error: '极性由大类决定，不能单独改' };
    }
    ['zh_name', 'en_name', 'zh_code', 'en_code', 'parent_id'].forEach((k) => {
      if (p[k] != null) node[k] = S(p[k]).trim();
    });
    if (p.domain != null) {
      const d = normalizeDomain(p.domain, node.domain);
      if (!d.ok) return { ok: false, error: d.error };
      node.domain = d.domain;
    }
    if (p.weight != null) node.weight = normalizeWeight(p.weight, node.weight);
    if (p.sort != null) node.sort = normalizeSort(p.sort, node.sort);
    if (p.pin != null) node.pin = p.pin ? 1 : 0;
    if (p.parent_id && !dict.nodes[p.parent_id]) return { ok: false, error: '父节点不存在' };
    if (!node.zh_name && !node.en_name) return { ok: false, error: '节点要有名字' };
    rebuildAliases(dict);
    ensureMeta(dict);
    dict.meta.updatedAt = new Date().toISOString();
    return { ok: true, node };
  }

  function removeNode(dict, id) {
    if (!dict.nodes[id]) return { ok: false, error: '节点不存在' };
    delete dict.nodes[id];
    Object.keys(dict.aliases || {}).forEach((k) => {
      dict.aliases[k] = (dict.aliases[k] || []).filter((x) => x !== id);
      if (!dict.aliases[k].length) delete dict.aliases[k];
    });
    Object.keys(dict.nodes).forEach((k) => {
      if (dict.nodes[k].parent_id === id) dict.nodes[k].parent_id = '';
    });
    return { ok: true };
  }

  function tagKindOf(name) {
    const s = S(name);
    if (/增益|回血|滋养|高光|gain/i.test(s)) return 'gain';
    if (/阻抑|内耗|流失|暗域|suppress|drain/i.test(s)) return 'suppress';
    if (/时间|time|min/i.test(s)) return 'time';
    return 'plain';
  }

  function addTag(dict, input) {
    const p = input || {};
    const name = S(p.zh_name || p.name).trim();
    if (!name) return { ok: false, error: '标签要有名字' };
    const dm = normalizeDomain(p.domain, 'P');
    if (!dm.ok) return { ok: false, error: dm.error };
    if (p.parent_id && !dict.tags[p.parent_id]) return { ok: false, error: '父标签不存在' };
    const id = nextId(dict, 'tag');
    const enName = S(p.en_name).trim() || name;
    dict.tags[id] = {
      zh_name: name,
      en_name: enName,
      zh_code: normalizeCode(p.zh_code || name),
      en_code: normalizeCode(p.en_code || slug(enName)),
      domain: dm.domain,
      parent_id: S(p.parent_id),
      weight: normalizeWeight(p.weight, 10),
      sort: normalizeSort(p.sort, 100),
      pin: p.pin ? 1 : 0,
      uses: Number.isFinite(Number(p.uses)) ? Math.max(0, Math.round(Number(p.uses))) : 0,
      lastUsed: S(p.lastUsed || p.last_used || ''),
      kind: p.kind || tagKindOf(name),
      created_at: new Date().toISOString(),
    };
    addAlias(dict, dict.tags[id].zh_code, id);
    addAlias(dict, dict.tags[id].zh_name, id);
    ensureMeta(dict);
    dict.meta.updatedAt = new Date().toISOString();
    return { ok: true, id, tag: dict.tags[id] };
  }

  function updateTag(dict, id, patch) {
    const tag = dict.tags[id];
    if (!tag) return { ok: false, error: '标签不存在' };
    const p = patch || {};
    ['zh_name', 'en_name', 'zh_code', 'en_code', 'parent_id'].forEach((k) => {
      if (p[k] != null) tag[k] = S(p[k]).trim();
    });
    if (p.domain != null) {
      const d = normalizeDomain(p.domain, tag.domain);
      if (!d.ok) return { ok: false, error: d.error };
      tag.domain = d.domain;
    }
    if (p.weight != null) tag.weight = normalizeWeight(p.weight, tag.weight);
    if (p.sort != null) tag.sort = normalizeSort(p.sort, tag.sort);
    if (p.pin != null) tag.pin = p.pin ? 1 : 0;
    if (p.kind) tag.kind = p.kind;
    if (!tag.zh_name && !tag.en_name) return { ok: false, error: '标签要有名字' };
    rebuildAliases(dict);
    ensureMeta(dict);
    dict.meta.updatedAt = new Date().toISOString();
    return { ok: true, tag };
  }

  function removeTag(dict, id) {
    if (!dict.tags[id]) return { ok: false, error: '标签不存在' };
    delete dict.tags[id];
    Object.keys(dict.aliases || {}).forEach((k) => {
      dict.aliases[k] = (dict.aliases[k] || []).filter((x) => x !== id);
      if (!dict.aliases[k].length) delete dict.aliases[k];
    });
    Object.keys(dict.tags).forEach((k) => {
      if (dict.tags[k].parent_id === id) dict.tags[k].parent_id = '';
    });
    return { ok: true };
  }

  function aliasIds(dict, token) {
    const t = S(token).trim();
    if (!t || !dict.aliases) return [];
    if (dict.aliases[t]) return dict.aliases[t].slice();
    const hit = Object.keys(dict.aliases).find((k) => k.toLowerCase() === t.toLowerCase());
    return hit ? dict.aliases[hit].slice() : [];
  }

  function langFields(x, lang) {
    const en = lang === 'en';
    return {
      code: S(en ? x.en_code : x.zh_code).toLowerCase(),
      otherCode: S(en ? x.zh_code : x.en_code).toLowerCase(),
      name: S(en ? x.en_name : x.zh_name).toLowerCase(),
      otherName: S(en ? x.zh_name : x.en_name).toLowerCase(),
    };
  }

  function aliasLangOk(x, token, lang) {
    const t = S(token).trim().toLowerCase();
    const f = langFields(x, lang);
    if (f.code === t || f.name === t) return true;
    return f.otherName !== t && f.otherCode !== t;   /* 另一种语言的名称/码不能当本语言别名 */
  }

  function candidateInfo(dict, id, ctx) {
    const node = dict.nodes[id];
    const tag = dict.tags[id];
    const x = node || tag;
    if (!x) return null;
    const lang = (ctx && ctx.lang) || 'zh';
    return {
      id,
      kind: node ? 'node' : 'tag',
      name: x.zh_name,
      en_name: x.en_name,
      code: x.zh_code,
      en_code: x.en_code,
      label: lang === 'en' ? (x.en_name || x.zh_name) : (x.zh_name || x.en_name),
      codeLabel: lang === 'en' ? (x.en_code || x.zh_code) : (x.zh_code || x.en_code),
      type: x.type || '',
      pole: x.polarity || '',
      form: x.form || '',
      domain: x.domain || 'P',
      weight: Number(x.weight) || 0,
      sort: Number(x.sort) || 100,
      pin: Number(x.pin) || 0,
      uses: Number(x.uses) || 0,
      lastUsed: x.lastUsed || '',
      score: candidateScore(x),
      system: !!x.system,
      kindTag: tag ? tag.kind : '',
    };
  }

  function candidateScore(x) {
    const base = Number(x.weight) || 0;
    const pin = x.pin ? 300 : 0;
    const uses = Math.min(30, Number(x.uses) || 0) * 3;
    let recent = 0;
    if (x.lastUsed) {
      const t = Date.parse(x.lastUsed);
      if (Number.isFinite(t) && Date.now() - t <= 7 * 24 * 3600 * 1000) recent = 20;
    }
    return base + pin + uses + recent;
  }

  function rankCandidates(dict, ids, ctx) {
    const c = ctx || {};
    return ids.map((id) => candidateInfo(dict, id, c)).filter(Boolean).sort((a, b) => {
      const da = c.domain && a.domain === c.domain ? 1 : 0;
      const db = c.domain && b.domain === c.domain ? 1 : 0;
      if (da !== db) return db - da;
      if (c.polarity) {
        const pa = a.pole === c.polarity ? 1 : 0;
        const pb = b.pole === c.polarity ? 1 : 0;
        if (pa !== pb) return pb - pa;
      }
      if (b.score !== a.score) return b.score - a.score;
      if (a.domain !== b.domain) return DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain);
      return a.id.localeCompare(b.id);
    });
  }

  function collectMatches(dict, token, domain, lang) {
    const t = S(token).trim();
    const low = t.toLowerCase();
    const d = domain ? S(domain).toUpperCase() : '';
    const ids = [];
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (n.system) return;
      if (d && S(n.domain).toUpperCase() !== d) return;
      const f = langFields(n, lang);
      if (f.code === low || f.name === low) ids.push(id);
    });
    return ids;
  }

  function collectPrefix(dict, token, domain, lang) {
    const t = S(token).trim();
    if (!t) return [];
    const low = t.toLowerCase();
    const d = domain ? S(domain).toUpperCase() : '';
    const ids = [];
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (n.system) return;
      if (d && S(n.domain).toUpperCase() !== d) return;
      const f = langFields(n, lang);
      if (f.code.startsWith(low) || f.name.startsWith(low)) ids.push(id);
    });
    return ids;
  }

  function inDomain(dict, ids, domain) {
    if (!domain) return ids.slice();
    const d = S(domain).toUpperCase();
    return ids.filter((id) => dict.nodes[id] && S(dict.nodes[id].domain).toUpperCase() === d);
  }

  function notInDomain(dict, ids, domain) {
    if (!domain) return [];
    const d = S(domain).toUpperCase();
    return ids.filter((id) => dict.nodes[id] && S(dict.nodes[id].domain).toUpperCase() !== d);
  }

  function ambiguous(token, ranked) {
    return { ok: false, code: 'AMBIGUOUS', token, candidates: ranked, error: token + ' 有 ' + ranked.length + ' 个候选' };
  }

  function resolveAlias(dict, rawToken, ctx) {
    const c = ctx || {};
    const domain = c.domain ? S(c.domain).toUpperCase() : '';
    let token = S(rawToken).trim();
    const forced = token.startsWith('!');
    if (forced) token = token.slice(1).trim();
    if (!token) return { ok: false, code: 'EMPTY', error: '缺节点' };

    const lang = c.lang === 'en' ? 'en' : 'zh';
    const allAlias = aliasIds(dict, token).filter((id) => dict.nodes[id] && aliasLangOk(dict.nodes[id], token, lang));
    let ids = inDomain(dict, allAlias, domain);
    if (ids.length === 1) return { ok: true, id: ids[0], node: dict.nodes[ids[0]], via: 'alias', forced };
    if (ids.length > 1) {
      const ranked = rankCandidates(dict, ids, c);
      if (forced) return { ok: true, id: ranked[0].id, node: dict.nodes[ranked[0].id], via: 'forced', forced, candidates: ranked };
      return ambiguous(token, ranked);
    }

    ids = collectMatches(dict, token, domain, lang);
    if (ids.length === 1) return { ok: true, id: ids[0], node: dict.nodes[ids[0]], via: 'code', forced };
    if (ids.length > 1) {
      const ranked = rankCandidates(dict, ids, c);
      if (forced) return { ok: true, id: ranked[0].id, node: dict.nodes[ranked[0].id], via: 'forced', forced, candidates: ranked };
      return ambiguous(token, ranked);
    }

    const m = token.match(/^(.+?)(\d{1,2})$/);
    if (m) {
      const base = m[1];
      const idx = Number(m[2]);
      let pool = inDomain(dict, aliasIds(dict, base).filter((id) => dict.nodes[id]), domain);
      if (!pool.length) pool = collectMatches(dict, base, domain, lang);
      if (!pool.length) pool = collectPrefix(dict, base, domain, lang);
      const ranked = rankCandidates(dict, pool, c);
      if (idx >= 1 && idx <= ranked.length) {
        const pick = ranked[idx - 1];
        const added = addAlias(dict, token, pick.id);
        return {
          ok: true, id: pick.id, node: dict.nodes[pick.id], via: 'suffix',
          aliasAdded: added.created, aliasKey: token, candidates: ranked, forced,
        };
      }
    }

    ids = collectPrefix(dict, token, domain, lang);
    if (ids.length === 1) return { ok: true, id: ids[0], node: dict.nodes[ids[0]], via: 'prefix', forced };
    const ranked = rankCandidates(dict, ids, c);
    if (ranked.length > 1) return ambiguous(token, ranked);
    const cross = domain
      ? notInDomain(dict, allAlias.concat(collectMatches(dict, token, '', lang), collectPrefix(dict, token, '', lang)), domain)
      : [];
    return {
      ok: false, code: 'UNBOUND', token, error: '找不到节点：' + token,
      suggest: token, crossDomain: cross.length > 0,
    };
  }

  function tagMatches(dict, name, domain, lang) {
    const t = S(name).trim();
    const low = t.toLowerCase();
    const d = domain ? S(domain).toUpperCase() : '';
    const ids = [];
    Object.keys(dict.tags || {}).forEach((id) => {
      const x = dict.tags[id];
      if (d && S(x.domain).toUpperCase() !== d) return;
      const f = langFields(x, lang);
      if (f.name === low || f.code === low) ids.push(id);
    });
    return ids;
  }

  function resolveTag(dict, name, ctx) {
    const c = ctx || {};
    const d = c.domain ? S(c.domain).toUpperCase() : '';
    const t = S(name).trim().replace(/^#/, '');
    if (!t) return { ok: false, code: 'EMPTY', error: '标签为空' };
    const aliasKey = Object.keys(dict.aliases || {}).find((k) => k.toLowerCase() === t.toLowerCase());
    if (aliasKey) {
      let aliasIds = (dict.aliases[aliasKey] || []).filter((id) => dict.tags[id] && aliasLangOk(dict.tags[id], t, c.lang));
      if (d) aliasIds = aliasIds.filter((id) => S(dict.tags[id].domain).toUpperCase() === d);
      if (aliasIds.length === 1) return { ok: true, id: aliasIds[0], tag: dict.tags[aliasIds[0]], via: 'alias' };
      if (aliasIds.length > 1) return ambiguous(t, rankCandidates(dict, aliasIds, c));
    }
    const ids = tagMatches(dict, t, c.domain, c.lang);
    if (ids.length === 1) return { ok: true, id: ids[0], tag: dict.tags[ids[0]], via: 'exact' };
    if (ids.length > 1) return ambiguous(t, rankCandidates(dict, ids, c));
    return { ok: false, code: 'UNBOUND', token: t, error: '还没有标签：' + t };
  }

  function ensureTag(dict, name, ctx) {
    const c = ctx || {};
    const r = resolveTag(dict, name, c);
    if (r.ok) return { ok: true, id: r.id, tag: r.tag, created: false };
    if (r.code === 'AMBIGUOUS') return r;
    const made = addTag(dict, {
      zh_name: r.token,
      en_name: r.token,
      domain: c.domain || 'P',
      parent_id: c.parentId || '',
      kind: tagKindOf(r.token),
    });
    if (!made.ok) return made;
    return { ok: true, id: made.id, tag: made.tag, created: true };
  }

  function getAncestorPath(dict, id) {
    const out = [];
    let cur = dict.nodes[id] ? id : dict.tags[id] ? id : '';
    let guard = 0;
    while (cur && guard < 64) {
      const pool = dict.nodes[cur] ? dict.nodes : dict.tags;
      const item = pool[cur];
      if (!item) break;
      out.push({ id: cur, item });
      cur = item.parent_id;
      guard += 1;
    }
    return out;
  }

  function pathLabel(dict, id, lang) {
    return getAncestorPath(dict, id).reverse()
      .map((x) => (lang === 'en' ? x.item.en_name || x.item.zh_name : x.item.zh_name || x.item.en_name))
      .join(' / ');
  }

  function getSiblingNodes(dict, id) {
    const node = dict.nodes[id];
    if (!node) return [];
    const parent = node.parent_id || '';
    return Object.keys(dict.nodes)
      .filter((k) => k !== id && (dict.nodes[k].parent_id || '') === parent && dict.nodes[k].domain === node.domain)
      .map((k) => Object.assign({ id: k }, dict.nodes[k]))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  function getChildren(dict, id) {
    return Object.keys(dict.nodes)
      .filter((k) => dict.nodes[k].parent_id === id)
      .map((k) => Object.assign({ id: k }, dict.nodes[k]))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  function listNodes(dict, opts) {
    const o = opts || {};
    return Object.keys(dict.nodes)
      .filter((id) => (o.includeSystem ? true : !dict.nodes[id].system))
      .filter((id) => (!o.domain || dict.nodes[id].domain === o.domain))
      .filter((id) => (!o.type || dict.nodes[id].type === o.type))
      .map((id) => Object.assign({ id }, dict.nodes[id]))
      .sort((a, b) => (normalizeSort(a.sort, 100) - normalizeSort(b.sort, 100))
        || ((b.weight || 0) - (a.weight || 0))
        || S(a.zh_name).localeCompare(S(b.zh_name), 'zh')
        || a.id.localeCompare(b.id));
  }

  function searchNodes(dict, query, opts) {
    const o = opts || {};
    const q = S(query).trim();
    const low = q.toLowerCase();
    const ids = [];
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (n.system) return;
      if (!q) { ids.push(id); return; }
      const f = langFields(n, o.lang);
      if (f.code.includes(low) || f.name.includes(low)) ids.push(id);
    });
    return rankCandidates(dict, ids, { domain: o.domain, lang: o.lang }).slice(0, o.limit || 8);
  }

  function searchTags(dict, query, opts) {
    const o = opts || {};
    const q = S(query).trim();
    const low = q.toLowerCase();
    const ids = Object.keys(dict.tags || {}).filter((id) => {
      const t = dict.tags[id];
      if (!q) return true;
      const f = langFields(t, o.lang);
      return f.code.includes(low) || f.name.includes(low);
    });
    return rankCandidates(dict, ids, { domain: o.domain, lang: o.lang }).slice(0, o.limit || 8);
  }

  function bumpWeight(dict, id, n) {
    const x = dict.nodes[id] || dict.tags[id];
    if (!x) return;
    const step = n == null ? 1 : Math.max(0, Math.round(Number(n) || 0));
    x.uses = Math.min(100000, (Number(x.uses) || 0) + step);
    x.lastUsed = new Date().toISOString();
  }

  function uniqueAliases(dict, id) {
    const out = [];
    Object.keys(dict.aliases || {}).forEach((k) => {
      const arr = dict.aliases[k] || [];
      if (arr.length === 1 && arr[0] === id) out.push(k);
    });
    return out;
  }

  /**
   * 展示用简码：优先 zh_code/en_code；若该码是多义（wx），
   * 自动挑 wx1 / wx2 这类已固化的唯一后缀，保证屏幕上不出现两个 wx。
   */
  function displayCode(dict, id, lang) {
    const x = dict.nodes[id] || dict.tags[id];
    if (!x) return id;
    const domain = S(x.domain || 'P').toUpperCase();
    const primary = lang === 'en' ? (x.en_code || x.zh_code) : (x.zh_code || x.en_code);
    const arrAll = primary ? (dict.aliases[primary] || []) : [];
    /* 只把同域目标算进多义判断：P 的 wx 不会因为 C 也有 wx 而变成 wx1。 */
    const arr = arrAll.filter((other) => {
      const y = dict.nodes[other] || dict.tags[other];
      return y && S(y.domain || 'P').toUpperCase() === domain;
    });
    if (primary && arr.length === 1 && arr[0] === id) return primary;
    const esc = String(primary || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixed = uniqueAliases(dict, id)
      .filter((a) => primary && new RegExp('^' + esc + '\\d+$').test(a))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (suffixed.length) return suffixed[0];
    /* 还没有显式固化 wx1/wx2 时，按同域别名顺序临时编号，保证屏幕不出现两个 wx */
    if (primary && arr.length > 1 && arr.includes(id)) return primary + (arr.indexOf(id) + 1);
    const ascii = uniqueAliases(dict, id).filter((a) => /^[A-Za-z0-9_]+$/.test(a));
    if (ascii.length) return ascii.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
    return primary || id;
  }

  function renderNode(dict, id, mode, lang) {
    const n = dict.nodes[id];
    if (!n) return id;
    if (mode === 'CODE') return displayCode(dict, id, lang);
    return lang === 'en' ? (n.en_name || n.zh_name) : (n.zh_name || n.en_name);
  }

  function renderTag(dict, id, mode, lang) {
    const t = dict.tags[id];
    if (!t) return id;
    if (mode === 'CODE') return displayCode(dict, id, lang);
    return lang === 'en' ? (t.en_name || t.zh_name) : (t.zh_name || t.en_name);
  }

  function renderBehavior(dict, id, mode, lang) {
    const h = dict.behaviors && dict.behaviors[id];
    if (!h) return id;
    if (mode === 'CODE') {
      const primary = lang === 'en' ? (h.en_code || h.zh_code) : (h.zh_code || h.en_code);
      return primary || id;
    }
    return lang === 'en' ? (h.en_name || h.zh_name) : (h.zh_name || h.en_name);
  }

  function nodeLabel(dict, id, lang) {
    return renderNode(dict, id, 'PLAIN', lang || 'zh');
  }

  function validateDict(dict) {
    const issues = [];
    const add = (level, code, message, id) => {
      issues.push({ level, code, message, id: id || '' });
    };
    if (!dict || typeof dict !== 'object') {
      add('fatal', 'NOT_OBJECT', '字典不是对象');
      return { ok: false, issues };
    }
    if (dict.format && dict.format !== 'txtvein-dict') add('warn', 'FORMAT', 'format 不是 txtvein-dict');
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (!/^N_[A-Za-z0-9_]+$/.test(id)) add('error', 'NODE_ID', '节点 ID 不合规：' + id, id);
      if (!n.zh_name && !n.en_name) add('error', 'NODE_NAME', '节点缺名字：' + id, id);
      const t = normalizeType(n.type);
      if (!t.ok) add('error', 'NODE_TYPE', '节点大类不合法：' + id, id);
      else if (t.pole !== n.polarity) add('error', 'NODE_POLARITY', '极性与大类不一致：' + id, id);
      if (!DOMAINS[n.domain]) add('error', 'NODE_DOMAIN', '节点域不合法：' + id, id);
      if (n.parent_id && !dict.nodes[n.parent_id]) add('warn', 'NODE_PARENT', '父节点不存在：' + id, id);
    });
    Object.keys(dict.tags || {}).forEach((id) => {
      const t = dict.tags[id];
      if (!/^T_[A-Za-z0-9_]+$/.test(id)) add('error', 'TAG_ID', '标签 ID 不合规：' + id, id);
      if (!t.zh_name && !t.en_name) add('error', 'TAG_NAME', '标签缺名字：' + id, id);
      if (!DOMAINS[t.domain]) add('error', 'TAG_DOMAIN', '标签域不合法：' + id, id);
      if (t.parent_id && !dict.tags[t.parent_id]) add('warn', 'TAG_PARENT', '父标签不存在：' + id, id);
    });
    Object.keys(dict.behaviors || {}).forEach((id) => {
      const h = dict.behaviors[id];
      if (!/^H_[A-Za-z0-9_]+$/.test(id)) add('error', 'BEHAVIOR_ID', '行为项 ID 不合规：' + id, id);
      if (!h.zh_name && !h.en_name) add('error', 'BEHAVIOR_NAME', '行为项缺名字：' + id, id);
      if (!DOMAINS[h.domain]) add('error', 'BEHAVIOR_DOMAIN', '行为项域不合法：' + id, id);
      if (h.parent_id && !dict.behaviors[h.parent_id]) add('warn', 'BEHAVIOR_PARENT', '父行为项不存在：' + id, id);
    });
    const seen = new Map();
    Object.keys(dict.aliases || {}).forEach((k) => {
      const arr = dict.aliases[k];
      if (!Array.isArray(arr) || !arr.length) add('warn', 'ALIAS_EMPTY', '空别名：' + k);
      (arr || []).forEach((id) => {
        if (!dict.nodes[id] && !dict.tags[id] && !(dict.behaviors && dict.behaviors[id])) {
          add('warn', 'ALIAS_TARGET', '别名指向不存在的 ID：' + k + ' → ' + id);
        }
      });
      const low = k.toLowerCase();
      if (seen.has(low)) add('warn', 'ALIAS_DUP', '别名大小写重复：' + k + ' / ' + seen.get(low));
      else seen.set(low, k);
    });
    Object.keys(dict.nodes || {}).forEach((id) => {
      let cur = dict.nodes[id] && dict.nodes[id].parent_id;
      let guard = 0;
      while (cur && guard < 64) {
        if (cur === id) { add('error', 'NODE_CYCLE', '节点父链成环：' + id, id); break; }
        cur = dict.nodes[cur] && dict.nodes[cur].parent_id;
        guard += 1;
      }
    });
    return { ok: issues.filter((x) => x.level !== 'warn').length === 0, issues };
  }

  TV.dict = {
    DOMAINS, DOMAIN_ORDER, TYPES, TYPE_ALL, TYPE_ORDER, TYPE_ALIAS, FORMS, KIND_TAG,
    isDomain, domainInfo, domainLabel, normalizeDomain, normalizeType, normalizeForm,
    normalizeCode, normalizeWeight, normalizeSort, slug, emptyDict, ensureMeta, bumpMeta, nextId,
    aliasesFor, addAlias, removeAlias, rebuildAliases,
    addNode, updateNode, removeNode, addTag, updateTag, removeTag, tagKindOf,
    aliasIds, candidateInfo, rankCandidates, resolveAlias, resolveTag, ensureTag,
    collectMatches, collectPrefix,
    getAncestorPath, pathLabel, getSiblingNodes, getChildren, listNodes, searchNodes,
    searchTags, bumpWeight, renderNode, renderTag, renderBehavior, nodeLabel, validateDict,
    uniqueAliases, displayCode,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.dict;
})(typeof globalThis !== 'undefined' ? globalThis : this);
