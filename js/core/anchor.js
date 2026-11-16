/* TxtVein · 锚点（私人节点 → 母树叶子）
 *
 * 不变量：
 *   - 一个私人节点最多一个 anchor_id；
 *   - 锚点必须是母树叶子，不能是内部节点/商户/银行；
 *   - 类型/极性默认继承锚点；
 *   - 改锚点若翻转极性且节点已有历史，拒绝，不静默改账。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);

  function core() {
    return TV.systemDictCore;
  }

  function leafOf(system, anchorId) {
    const id = S(anchorId).trim();
    if (!id || !system || !system.nodes || !system.nodes[id]) return null;
    const c = core();
    if (!c || !c.isPostable(system.nodes, id)) return null;
    return system.nodes[id];
  }

  function effective(system, anchorId) {
    const leaf = leafOf(system, anchorId);
    if (!leaf) return null;
    const c = core();
    return c ? c.effectiveType(system.nodes, leaf.id) : null;
  }

  function set(dict, id, anchorId, system, opts) {
    const o = opts || {};
    const node = dict && dict.nodes && dict.nodes[id];
    if (!node) return { ok: false, code: 'NODE_MISSING', error: '节点不存在：' + id };
    const target = S(anchorId).trim();
    if (!target) {
      delete node.anchor_id;
      return { ok: true, node, cleared: true };
    }
    if (!system || !system.nodes || !system.nodes[target]) {
      return { ok: false, code: 'ANCHOR_UNKNOWN', error: '母树里没有这个叶子：' + target };
    }
    const c = core();
    if (!c || !c.isPostable(system.nodes, target)) {
      return { ok: false, code: 'ANCHOR_NOT_LEAF', error: '锚点必须是母树叶子：' + target };
    }
    const eff = c.effectiveType(system.nodes, target);
    if (!eff) return { ok: false, code: 'ANCHOR_NO_TYPE', error: '母树叶子没有会计大类：' + target };
    if (eff.polarity !== node.polarity && o.hasHistory) {
      return {
        ok: false, code: 'ANCHOR_POLARITY',
        error: '改到【' + eff.type + '】会把历史余额从 ' + node.polarity + ' 极翻到 ' + eff.polarity + ' 极；请先处理历史或新建节点',
      };
    }
    const before = { type: node.type, polarity: node.polarity, form: node.form };
    node.anchor_id = target;
    node.type = eff.type;
    node.polarity = eff.polarity;
    node.form = eff.form;
    return { ok: true, node, before, inherited: { type: eff.type, polarity: eff.polarity, form: eff.form } };
  }

  function clear(dict, id) {
    return set(dict, id, '', null, {});
  }

  function validate(dict, system) {
    const issues = [];
    const nodes = (dict && dict.nodes) || {};
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      if (!n.anchor_id) return;
      const target = S(n.anchor_id);
      if (!/^SYS\./.test(target) || !system || !system.nodes || !system.nodes[target]) {
        issues.push({ code: 'ANCHOR_UNKNOWN', level: 'warn', id, message: '锚点不在当前母树：' + target });
        return;
      }
      const c = core();
      if (!c || !c.isPostable(system.nodes, target)) {
        issues.push({ code: 'ANCHOR_NOT_LEAF', level: 'error', id, message: '锚点不是叶子：' + target });
        return;
      }
      const eff = c.effectiveType(system.nodes, target);
      if (!eff) {
        issues.push({ code: 'ANCHOR_NO_TYPE', level: 'error', id, message: '锚点没有会计大类：' + target });
        return;
      }
      if (n.polarity !== eff.polarity) {
        issues.push({ code: 'ANCHOR_POLARITY', level: 'error', id, message: '极性与锚点不一致：' + target });
      } else if (n.type !== eff.type) {
        issues.push({ code: 'ANCHOR_TYPE', level: 'warn', id, message: '大类与锚点不一致：' + target });
      }
    });
    return issues;
  }

  TV.anchor = { set, clear, validate, effective, leafOf };
  if (typeof module === 'object' && module.exports) module.exports = TV.anchor;
})(typeof globalThis !== 'undefined' ? globalThis : this);
