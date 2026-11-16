/* TxtVein · 私人树视图模型
 *
 * 只读：把 Dict.nodes 投影成“会计类型块头 → 私人 parent_id 树”。
 * 排序：sort 升序 → weight 降序 → 名字。
 * 不碰数据；UI 只消费这个结构。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const TYPE_ORDER = ['资产', '负债', '收入', '费用', '成本', '权益'];

  function cmp(a, b, lang) {
    const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 100;
    const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 100;
    if (sa !== sb) return sa - sb;
    const wa = Number(a.weight) || 0;
    const wb = Number(b.weight) || 0;
    if (wa !== wb) return wb - wa;
    const na = lang === 'en' ? (a.en_name || a.zh_name) : (a.zh_name || a.en_name);
    const nb = lang === 'en' ? (b.en_name || b.zh_name) : (b.zh_name || b.en_name);
    return S(na).localeCompare(S(nb), 'zh') || S(a.id).localeCompare(S(b.id));
  }

  function build(dict, opts) {
    const o = opts || {};
    const lang = o.lang === 'en' ? 'en' : 'zh';
    const includeSystem = !!o.includeSystem;
    const nodes = (dict && dict.nodes) || {};
    const blocks = [];
    let total = 0;

    TYPE_ORDER.forEach((type) => {
      const entries = {};
      Object.keys(nodes).forEach((id) => {
        const n = nodes[id];
        if (!n || n.type !== type) return;
        if (!includeSystem && n.system) return;
        entries[id] = {
          id,
          type,
          zh_name: n.zh_name,
          en_name: n.en_name,
          zh_code: n.zh_code,
          en_code: n.en_code,
          sort: n.sort,
          weight: n.weight,
          anchor_id: n.anchor_id || '',
          children: [],
        };
      });
      const ids = Object.keys(entries);
      if (!ids.length) return;
      const roots = [];
      ids.forEach((id) => {
        const e = entries[id];
        const p = (nodes[id] && nodes[id].parent_id) || '';
        if (p && entries[p]) entries[p].children.push(e);
        else roots.push(e);
      });
      const sortTree = (arr, path) => {
        const p = path || new Set();
        arr.sort((a, b) => cmp(a, b, lang));
        arr.forEach((x) => {
          if (p.has(x.id)) { x.children = []; return; }
          p.add(x.id);
          sortTree(x.children, p);
          p.delete(x.id);
        });
      };
      sortTree(roots);
      // 环保护：如果某节点既不是根也不在任何根下，补到根，避免视图丢节点。
      const seen = new Set();
      const walk = (arr) => arr.forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); walk(x.children); } });
      walk(roots);
      ids.forEach((id) => { if (!seen.has(id)) roots.push(entries[id]); });
      if (roots.length) {
        sortTree(roots);
        const count = ids.length;
        total += count;
        blocks.push({
          type,
          label: type,
          count,
          roots,
        });
      }
    });

    return { blocks, total, lang, typeOrder: TYPE_ORDER.slice() };
  }

  function flatten(block) {
    const out = [];
    const seen = new Set();
    const walk = (arr, depth) => arr.forEach((x) => {
      if (seen.has(x.id)) return;
      seen.add(x.id);
      out.push({ id: x.id, depth, node: x });
      walk(x.children, depth + 1);
    });
    walk((block && block.roots) || [], 0);
    return out;
  }

  TV.treeView = { build, flatten, TYPE_ORDER };
  if (typeof module === 'object' && module.exports) module.exports = TV.treeView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
