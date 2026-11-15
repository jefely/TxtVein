/* TxtVein · 后台 ID（两层）
 *
 * 用户永远看不到 ID。ID 只存在于编译后的图里：
 *   字典条目：N_ + 8 hex / T_ + 8 hex / C_ + 8 / R_ + 8
 *   流水记录：E_ + 12 hex
 *
 * 8 hex = 32 bit；字典条目通常几百到几千，配合插入查重足够。
 * 12 hex = 48 bit；流水可能上万到十万，留更大余量。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  function randomHex(bytes) {
    const n = Math.max(1, Number(bytes) || 4);
    const c = root.crypto;
    if (c && c.getRandomValues) {
      const arr = new Uint8Array(n);
      c.getRandomValues(arr);
      return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let s = '';
    for (let i = 0; i < n; i += 1) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return s;
  }

  function newId(prefix, bytes) {
    return prefix + '_' + randomHex(bytes);
  }

  /** 带查重：exists(id) 返回 true 就重抽；最多 100 次。 */
  function newUnique(prefix, bytes, exists) {
    for (let i = 0; i < 100; i += 1) {
      const id = newId(prefix, bytes);
      if (!exists || !exists(id)) return id;
    }
    throw new Error('ID 随机生成连续碰撞：' + prefix);
  }

  function isId(id, prefix) {
    const re = new RegExp('^' + (prefix || '[NTHXCBRE]') + '_[0-9a-f]{8,16}$');
    return re.test(String(id || ''));
  }

  TV.ids = {
    randomHex,
    newId,
    newUnique,
    newNodeId: (exists) => newUnique('N', 4, exists),
    newTagId: (exists) => newUnique('T', 4, exists),
    newBehaviorItemId: (exists) => newUnique('H', 4, exists),
    newEventId: (exists) => newUnique('E', 6, exists),
    newBehaviorEventId: (exists) => newUnique('B', 6, exists),
    newChainId: (exists) => newUnique('C', 4, exists),
    newRuleId: (exists) => newUnique('R', 4, exists),
    newTextId: (exists) => newUnique('X', 4, exists),
    isId,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.ids;
})(typeof globalThis !== 'undefined' ? globalThis : this);
