/* TxtVein · 本地建议器（只建议，不写）
 *
 * 输入：私人节点/名称/类型；输出：母树叶子候选 + 理由 + 分数。
 * 规则全部本地、确定性；不调用网络，不修改 Dict。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  function core() { return TV.systemDictCore; }
  function D() { return TV.dict; }

  function norm(s) { return S(s).trim().toLowerCase(); }

  function leafList(system, polarity) {
    const c = core();
    if (!c || !system || !system.nodes) return [];
    return Object.keys(system.nodes).filter((id) => {
      const n = system.nodes[id];
      if (n.kind === 'root') return false;
      if (!c.isPostable(system.nodes, id)) return false;
      if (polarity) {
        const e = c.effectiveType(system.nodes, id);
        if (!e || e.polarity !== polarity) return false;
      }
      return true;
    });
  }

  function aliasMap(system) {
    const map = { zh: new Map(), en: new Map() };
    (system && system.aliases || []).forEach((a) => {
      if (!a || !a.alias || !map[a.lang]) return;
      map[a.lang].set(norm(a.alias), a.id);
    });
    return map;
  }

  function nameScore(query, candidate, aliases, lang) {
    const q = norm(query);
    if (!q) return 0;
    const nm = norm(lang === 'en' ? candidate.en_name : candidate.zh_name);
    const cd = norm(lang === 'en' ? candidate.en_code : candidate.zh_code);
    if (q === nm || q === cd) return 100;
    if (aliases.get(q) === candidate.id) return 95;
    if (nm.startsWith(q) || cd.startsWith(q)) return 70;
    if (nm.includes(q) || cd.includes(q)) return 45;
    return 0;
  }

  function merchantHits(system, query, aliases) {
    const q = norm(query);
    if (!q) return [];
    const c = core();
    const out = [];
    Object.keys((system && system.merchants) || {}).forEach((id) => {
      const m = system.merchants[id];
      let score = 0;
      if (q === norm(m.zh_name) || q === norm(m.en_name)) score = 100;
      else if (q === norm(m.zh_code) || q === norm(m.en_code)) score = 90;
      else if (aliases.zh.get(q) === id || aliases.en.get(q) === id) score = 90;
      else if (norm(m.zh_name).startsWith(q) || norm(m.en_name).startsWith(q)) score = 60;
      if (score && m.default_category && system.nodes[m.default_category] && c && c.isPostable(system.nodes, m.default_category)) {
        out.push({ id: m.default_category, score: 80 + score / 10, reason: '商户「' + (m.zh_name || m.en_name) + '」的默认分类' });
      }
    });
    return out;
  }

  function suggestForSpec(dict, spec, system, opts) {
    const o = opts || {};
    const limit = Math.max(1, Math.min(10, Number(o.limit) || 5));
    const s = system || TV.systemDict;
    const c = core();
    if (!s || !c) return [];
    const input = spec || {};
    const t = D() ? D().normalizeType(input.type || '') : { ok: false };
    const polarity = t.ok ? t.pole : '';
    const names = [input.zh_name, input.en_name, input.zh_code, input.en_code].filter(Boolean);
    const query = names.length ? names.join(' ') : '';
    const lang = o.lang === 'en' ? 'en' : 'zh';
    const aliases = aliasMap(s);
    const leaves = leafList(s, polarity);
    const scores = new Map();

    function add(id, score, reason) {
      if (!id) return;
      const old = scores.get(id);
      if (!old || old.score < score) scores.set(id, { id, score, reason });
      else if (old && old.score === score && reason && old.reason.indexOf(reason) < 0) old.reason += '；' + reason;
    }

    const anchor = input.anchor_id || (dict && input.id && dict.nodes[input.id] && dict.nodes[input.id].anchor_id);
    if (anchor && s.nodes[anchor] && c.isPostable(s.nodes, anchor)) {
      add(anchor, 1000, '当前已确认的锚点');
    }

    names.forEach((q) => {
      leaves.forEach((id) => {
        const n = s.nodes[id];
        const sc = nameScore(q, n, aliases[lang], lang);
        if (sc) add(id, sc, sc >= 95 ? '名称/别名精确命中' : '名称前缀/包含命中');
      });
    });

    merchantHits(s, query, aliases).forEach((h) => add(h.id, h.score, h.reason));
    names.forEach((q) => {
      merchantHits(s, q, aliases).forEach((h) => add(h.id, h.score, h.reason));
    });

    if (input.parent_id && dict && dict.nodes && dict.nodes[input.parent_id]) {
      const p = dict.nodes[input.parent_id];
      if (p.anchor_id && s.nodes[p.anchor_id]) add(p.anchor_id, 55, '父节点的锚点');
    }

    const out = [];
    scores.forEach((x) => {
      const n = s.nodes[x.id];
      if (!n) return;
      let score = x.score;
      if (polarity) {
        const e = c.effectiveType(s.nodes, x.id);
        if (e && e.polarity === polarity) score += 5;
      }
      out.push({
        id: x.id,
        score,
        reason: x.reason,
        path: c.pathLabel(s.nodes, x.id, o.lang === 'en' ? 'en' : 'zh'),
        type: n.type || '',
        zh_code: n.zh_code || '',
        en_code: n.en_code || '',
      });
    });
    out.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
    return out.slice(0, limit);
  }

  function suggestForNode(dict, nodeId, system, opts) {
    const n = dict && dict.nodes && dict.nodes[nodeId];
    if (!n) return [];
    return suggestForSpec(dict, Object.assign({ id: nodeId }, n), system, opts);
  }

  function suggestForToken(token, system, opts) {
    return suggestForSpec(null, { zh_name: token, en_name: token }, system, opts);
  }

  TV.suggester = { suggestForSpec, suggestForNode, suggestForToken };
  if (typeof module === 'object' && module.exports) module.exports = TV.suggester;
})(typeof globalThis !== 'undefined' ? globalThis : this);
