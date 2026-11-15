/* TxtVein · 字典文本（dict.json）
 * 流水只存 ID；名字、简码、极性、域、树关系、别名全在这里。
 *
 * 哈希互锁：link 字段不参与自身哈希（否则互为哈希死循环）。
 * 规范化 JSON 用「键排序 + 无空格」的 canonical 形式，格式化差异不会破坏校验。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  function sortValue(v) {
    if (Array.isArray(v)) return v.map(sortValue);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach((k) => { out[k] = sortValue(v[k]); });
      return out;
    }
    return v;
  }

  function canonicalJson(obj) {
    return JSON.stringify(sortValue(obj));
  }

  function bodyForHash(dict) {
    const copy = normalizeDict(dict);
    delete copy.link;
    return canonicalJson(copy) + '\n';
  }

  function normalizeDict(dict) {
    const src = dict && typeof dict === 'object' ? dict : {};
    const out = {
      format: 'txtvein-dict',
      version: 1,
      vaultId: S(src.vaultId || src.vault_id || ''),
      link: S(src.link || ''),
      meta: Object.assign({}, src.meta || {}),
      nodes: {},
      tags: {},
      behaviors: {},
      aliases: {},
    };
    Object.keys(src.nodes || {}).forEach((id) => {
      if (!/^N_[A-Za-z0-9_]+$/.test(id)) return;
      out.nodes[id] = normalizeNode(id, src.nodes[id]);
    });
    Object.keys(src.tags || {}).forEach((id) => {
      if (!/^T_[A-Za-z0-9_]+$/.test(id)) return;
      out.tags[id] = normalizeTag(id, src.tags[id]);
    });
    Object.keys(src.behaviors || {}).forEach((id) => {
      if (!/^H_[A-Za-z0-9_]+$/.test(id)) return;
      out.behaviors[id] = normalizeBehavior(id, src.behaviors[id]);
    });
    Object.keys(src.aliases || {}).forEach((k) => {
      const arr = src.aliases[k];
      if (!Array.isArray(arr)) return;
      const valid = Array.from(new Set(arr.filter((id) => out.nodes[id] || out.tags[id] || out.behaviors[id])));
      if (valid.length) out.aliases[k] = valid;
    });
    if (src.updatedAt) out.updatedAt = S(src.updatedAt);
    return out;
  }

  function serializeDict(dict) {
    return JSON.stringify(normalizeDict(dict), null, 2) + '\n';
  }

  function normalizeNode(id, raw) {
    const n = raw && typeof raw === 'object' ? raw : {};
    let type = n.type || '';
    let pole = S(n.polarity).toUpperCase();
    if (!type && pole) type = pole === 'A' ? '资产' : '权益';
    const t = dictMod.normalizeType(type);
    if (!t.ok && pole) type = pole === 'A' ? '资产' : '权益';
    const tt = dictMod.normalizeType(type);
    const domain = dictMod.isDomain(n.domain) ? S(n.domain).toUpperCase() : 'P';
    return {
      zh_name: S(n.zh_name || n.name || id),
      en_name: S(n.en_name || n.name || n.zh_name || id),
      zh_code: S(n.zh_code || n.code || ''),
      en_code: S(n.en_code || ''),
      polarity: tt.ok ? tt.pole : (pole === 'A' ? 'A' : 'B'),
      type: tt.ok ? tt.type : '资产',
      form: tt.pole === 'B' ? 'outside' : (n.form || tt.form || 'fluid'),
      domain,
      parent_id: S(n.parent_id || ''),
      weight: dictMod.normalizeWeight(n.weight, 100),
      system: !!n.system,
      created_at: S(n.created_at || ''),
    };
  }

  function normalizeTag(id, raw) {
    const t = raw && typeof raw === 'object' ? raw : {};
    return {
      zh_name: S(t.zh_name || t.name || id),
      en_name: S(t.en_name || t.name || t.zh_name || id),
      zh_code: S(t.zh_code || t.code || ''),
      en_code: S(t.en_code || ''),
      domain: dictMod.isDomain(t.domain) ? S(t.domain).toUpperCase() : 'P',
      parent_id: S(t.parent_id || ''),
      weight: dictMod.normalizeWeight(t.weight, 10),
      kind: t.kind || dictMod.tagKindOf(t.zh_name || id),
      created_at: S(t.created_at || ''),
    };
  }

  function normalizeBehavior(id, raw) {
    const h = raw && typeof raw === 'object' ? raw : {};
    return {
      zh_name: S(h.zh_name || h.name || id),
      en_name: S(h.en_name || h.name || h.zh_name || id),
      zh_code: S(h.zh_code || h.code || ''),
      en_code: S(h.en_code || ''),
      domain: dictMod.isDomain(h.domain) ? S(h.domain).toUpperCase() : 'P',
      parent_id: S(h.parent_id || ''),
      weight: dictMod.normalizeWeight(h.weight, 10),
      created_at: S(h.created_at || ''),
    };
  }

  function parseDict(src, opts) {
    const o = opts || {};
    let obj;
    try {
      obj = JSON.parse(text.normalize(src).trim());
    } catch (e) {
      return { ok: false, error: '字典不是合法 JSON：' + e.message };
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, error: '字典根必须是对象' };
    }
    if (obj.format && obj.format !== 'txtvein-dict') {
      return { ok: false, error: '不是 TxtVein 字典（format=' + obj.format + '）' };
    }
    const warnings = [];
    const dict = {
      format: 'txtvein-dict',
      version: 1,
      vaultId: S(obj.vaultId || obj.vault_id || ''),
      link: S(obj.link || ''),
      meta: Object.assign({}, obj.meta || {}),
      nodes: {},
      tags: {},
      behaviors: {},
      aliases: {},
    };
    /* 兼容早期版本误写在顶层的 updatedAt，否则哈希校验会因字段丢失而误报 */
    if (obj.updatedAt) dict.updatedAt = S(obj.updatedAt);
    const nodes = obj.nodes && typeof obj.nodes === 'object' ? obj.nodes : {};
    Object.keys(nodes).forEach((id) => {
      if (!/^N_[A-Za-z0-9_]+$/.test(id)) {
        warnings.push('节点 ID 不合规，已跳过：' + id);
        return;
      }
      dict.nodes[id] = normalizeNode(id, nodes[id]);
    });
    const tags = obj.tags && typeof obj.tags === 'object' ? obj.tags : {};
    Object.keys(tags).forEach((id) => {
      if (!/^T_[A-Za-z0-9_]+$/.test(id)) {
        warnings.push('标签 ID 不合规，已跳过：' + id);
        return;
      }
      dict.tags[id] = normalizeTag(id, tags[id]);
    });
    const behaviors = obj.behaviors && typeof obj.behaviors === 'object' ? obj.behaviors : {};
    Object.keys(behaviors).forEach((id) => {
      if (!/^H_[A-Za-z0-9_]+$/.test(id)) {
        warnings.push('行为项 ID 不合规，已跳过：' + id);
        return;
      }
      dict.behaviors[id] = normalizeBehavior(id, behaviors[id]);
    });
    const aliases = obj.aliases && typeof obj.aliases === 'object' ? obj.aliases : {};
    Object.keys(aliases).forEach((k) => {
      const arr = aliases[k];
      if (!Array.isArray(arr)) return;
      const valid = arr.filter((id) => dict.nodes[id] || dict.tags[id] || dict.behaviors[id]);
      if (valid.length) dict.aliases[k] = Array.from(new Set(valid));
      if (valid.length !== arr.length) warnings.push('别名 ' + k + ' 有失效目标，已清理');
    });
    dictMod.ensureMeta(dict);
    dictMod.bumpMeta(dict);
    if (!o.keepLink && !dict.link) warnings.push('字典没有 LINK 字段，无法与流水互锁');
    const normalized = normalizeDict(dict);
    const validation = dictMod.validateDict(normalized);
    return { ok: true, dict: normalized, warnings, issues: validation.issues };
  }

  function syncMeta(dict, events, plans) {
    dictMod.ensureMeta(dict);
    dictMod.bumpMeta(dict);
    const count = (events || []).length;
    dict.meta.nextEvent = Math.max(Number(dict.meta.nextEvent) || 1, count + 1);
    (plans || []).forEach((p) => {
      const m = S(p.id).match(/^R_(\d+)$/);
      if (m) dict.meta.nextRule = Math.max(Number(dict.meta.nextRule) || 1, Number(m[1]) + 1);
      if (m) dict.meta.nextPlan = Math.max(Number(dict.meta.nextPlan) || 1, Number(m[1]) + 1);
    });
    const chainMax = (events || []).reduce((max, e) => {
      const m = S(e.chainId).match(/^C_(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    dict.meta.nextChain = Math.max(Number(dict.meta.nextChain) || 1, chainMax + 1);
    dict.meta.updatedAt = new Date().toISOString();
    return dict;
  }

  function getLink(src) {
    const r = parseDict(src);
    return r.ok ? r.dict.link : '';
  }

  function setLink(src, hash) {
    const r = parseDict(src, { keepLink: true });
    if (!r.ok) return src;
    r.dict.link = S(hash);
    return serializeDict(r.dict);
  }

  function isDict(src) {
    const s = text.normalize(src).trim();
    if (!s.startsWith('{')) return false;
    try {
      const o = JSON.parse(s);
      return !!(o && (o.format === 'txtvein-dict' || o.nodes || o.aliases));
    } catch (e) {
      return false;
    }
  }

  function emptyText(vaultId) {
    return serializeDict(dictMod.emptyDict(vaultId));
  }

  TV.dictFile = {
    canonicalJson,
    bodyForHash,
    normalizeDict,
    serializeDict,
    parseDict,
    normalizeNode,
    normalizeTag,
    normalizeBehavior,
    syncMeta,
    getLink,
    setLink,
    isDict,
    emptyText,
    sortValue,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.dictFile;
})(typeof globalThis !== 'undefined' ? globalThis : this);
