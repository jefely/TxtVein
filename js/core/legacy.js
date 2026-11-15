/* TxtVein · 旧版导入
 * 兼容 old1（TxtVein.html 七列/五列合订账本）与 old2（文脉 2 节点/流水）。
 *
 * 旧版流水存的是简码或名字；导入时一次性绑定到新的 N_xxx，之后改名不断链。
 * 旧版没有「期初」字段的新模型，这里把期初转成「期初权益 → 节点」的真实流水。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  const SEP_RE = /[，\t]/;

  function cutFields(line, n) {
    const all = S(line).split(SEP_RE).map((x) => x.trim());
    if (all.length <= n) {
      while (all.length < n) all.push('');
      return all;
    }
    const head = all.slice(0, n - 1);
    head.push(all.slice(n - 1).join('，'));
    return head;
  }

  function classify(line) {
    const s = S(line).trim();
    if (!s) return '';
    if (/^#{1,3}\s*(节点|流水|统计|报表)$/.test(s)) return 'section';
    if (/^\[(节点|流水|统计|报表)\]$/.test(s)) return 'section';
    if (/^\d{6}[，\t]/.test(s)) return 'flow';
    if (dictMod.normalizeType(cutFields(s, 5)[1]).ok) return 'node';
    return '';
  }

  function detectLegacy(src) {
    const s = text.normalize(src);
    if (/^#\s*TxtVein ledger/m.test(s)) return false;
    return /##\s*(节点|流水)/.test(s) || /#\s*文脉/.test(s) || /简码.*财务大类/.test(s);
  }

  function importLegacy(src, opts) {
    const o = opts || {};
    const raw = text.normalize(src);
    if (!detectLegacy(raw)) return { ok: false, error: '不是可识别的旧版明文账本' };
    const lines = raw.split('\n');
    const nodeLines = [];
    const flowLines = [];
    let section = '';
    const warnings = [];

    lines.forEach((line) => {
      const s = line.trim();
      if (!s) return;
      if (/^##\s*(节点|流水|统计|报表)/.test(s)) {
        section = /节点/.test(s) ? 'node' : /流水/.test(s) ? 'flow' : 'skip';
        return;
      }
      if (/^#/.test(s)) return;
      if (section === 'skip') return;
      if (section === 'node') { nodeLines.push(s); return; }
      if (section === 'flow') { flowLines.push(s); return; }
      const kind = classify(s);
      if (kind === 'node') nodeLines.push(s);
      else if (kind === 'flow') flowLines.push(s);
    });

    if (!nodeLines.length) return { ok: false, error: '旧账本里没有节点段，无法建立 ID 字典' };

    const dict = dictMod.emptyDict(o.vaultId || '');
    const byCode = new Map();
    const byName = new Map();
    const nodeIds = [];
    let importedNodes = 0;
    let skippedNodes = 0;

    nodeLines.forEach((line) => {
      const f = cutFields(line, 5);
      const code = dictMod.normalizeCode(f[0]);
      const t = dictMod.normalizeType(f[1]);
      const name = f[3] || code;
      if (!code || !t.ok || !name) { skippedNodes += 1; return; }
      const made = dictMod.addNode(dict, {
        zh_name: name,
        en_name: name,
        zh_code: code,
        en_code: code,
        type: t.type,
        domain: 'P',
        weight: 50,
      });
      if (!made.ok) { skippedNodes += 1; return; }
      const id = made.id;
      const opening = amount.parseAmount(f[4] || '0');
      made.node.legacy_opening = opening.ok ? opening.cents : 0;
      byCode.set(code.toLowerCase(), id);
      byName.set(name, id);
      nodeIds.push({ id, node: made.node, opening: opening.ok ? opening.cents : 0 });
      importedNodes += 1;
    });
    if (!importedNodes) return { ok: false, error: '旧账本节点全部无法识别' };

    /* 期初权益：把旧版 opening 变成一笔真实流水 */
    const openingNode = dictMod.addNode(dict, {
      zh_name: '期初权益', en_name: 'Opening Equity', zh_code: 'legacy_open', en_code: 'legacy_open',
      type: '权益', domain: 'P', weight: 0, system: true,
    });
    const openingId = openingNode.ok ? openingNode.id : '';
    const events = [];
    let seq = 0;
    const push = (d, from, to, cents, tagIds) => {
      seq += 1;
      events.push({
        id: 'E_' + String(seq).padStart(4, '0'),
        domain: 'P',
        date: d,
        from,
        to,
        amountCents: cents,
        minutes: 0,
        tagIds: tagIds || [],
        chainId: '',
        crossDomain: false,
        raw: '',
      });
    };
    if (openingId) {
      nodeIds.forEach((x) => {
        if (!x.opening) return;
        if (x.node.polarity === 'A') push('000101', openingId, x.id, Math.abs(x.opening), []);
        else push('000101', x.id, openingId, Math.abs(x.opening), []);
      });
    }

    const find = (token) => {
      const t = S(token).trim();
      if (!t) return '';
      return byCode.get(t.toLowerCase()) || byName.get(t) || '';
    };

    let importedFlows = 0;
    let skippedFlows = 0;
    flowLines.forEach((line) => {
      const f = cutFields(line, 7);
      const d = date.parseDate(f[0]);
      if (!d.ok) { skippedFlows += 1; return; }
      const from = find(f[1]);
      const to = find(f[2]);
      const q = amount.parseAmount(f[3]);
      if (!from || !to || !q.ok || q.cents <= 0) { skippedFlows += 1; return; }

      const tagIds = [];
      const cat = S(f[4]).trim();
      const key = S(f[5]).trim();
      const memo = S(f[6]).trim();
      const addTag = (name, parentId) => {
        if (!name || name === '-') return '';
        const r = dictMod.ensureTag(dict, name, { domain: 'P', parentId: parentId || '' });
        if (!r.ok) return '';
        if (!tagIds.includes(r.id)) tagIds.push(r.id);
        return r.id;
      };
      const catId = addTag(cat, '');
      const keyId = addTag(key, catId);
      addTag(memo, keyId || catId);
      push(d.stamp, from, to, q.cents, tagIds);
      importedFlows += 1;
    });

    dict.meta.nextEvent = Math.max(Number(dict.meta.nextEvent) || 1, events.length + 1);
    dict.meta.updatedAt = new Date().toISOString();
    if (skippedNodes) warnings.push(skippedNodes + ' 个节点无法识别，已跳过');
    if (skippedFlows) warnings.push(skippedFlows + ' 笔流水无法映射，已跳过');

    return {
      ok: true,
      dict,
      events,
      plans: [],
      rules: [],
      stats: {
        nodes: importedNodes,
        flows: importedFlows,
        skippedNodes,
        skippedFlows,
        openingEvents: events.filter((e) => e.date === '000101').length,
      },
      warnings,
    };
  }

  TV.legacy = { detectLegacy, importLegacy, cutFields };

  if (typeof module === 'object' && module.exports) module.exports = TV.legacy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
