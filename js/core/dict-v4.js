/* TxtVein · 私有字典 v4 解析 / 发射
 *
 * 文本：会计类型 → 统计分类 → 节点；备注/行为：归属 → 关键字。
 * 一行一条，中文逗号分列（英文逗号等价）：
 *   [费用]，Expense
 *   餐饮
 *     DC，点餐
 *   通勤，Commute，交通
 *     DT，地铁
 *   [备注]，Notes
 *   商品
 *     KF，咖啡，Cof，Coffee
 *   alias 交行信，JHX，JHX2
 *
 * 设计见 docs/private-dict-v4.md。本模块零 DOM，只做文本 ↔ 编译产物。
 * 母树绑定固定在节点上：文末 [母树] 一块；统计分类只是用户分组。
 * 这样 calc / publicReport 不需要改。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const TYPE_EN = { 费用: 'Expense', 收入: 'Income', 资产: 'Asset', 负债: 'Liability', 成本: 'Cost', 权益: 'Equity' };
  const EN_TYPE = {};
const TAG_EN_DEFAULTS = {
  分期: ['INST', 'Installment'],
  固定每日: ['FD', 'Fixed Daily'],
  固定每月: ['FM', 'Fixed Monthly'],
};
  Object.keys(TYPE_EN).forEach((k) => { EN_TYPE[TYPE_EN[k].toLowerCase()] = k; });
  const SECTION_EN = { note: 'Notes', behavior: 'Behavior' };
  const SEP = /[，,]/;

  /* 小型内置英文码表：只收“母树概念码不够用”的私有名（银行/支付/现金） */
  function hintEnCode(name) {
    return TV.enCodes && TV.enCodes.codeFor ? TV.enCodes.codeFor(name) : '';
  }

  function diag(line, col, message, severity, code) {
    return { line: line || 0, col: col || 0, message, severity: severity || 'error', code: code || 'DICT' };
  }

  function norm(raw) {
    let s = S(raw).replace(/\r$/, '');
    /* 行首空白：tab / 全角空格按 2 空格计 */
    let i = 0;
    let indent = 0;
    while (i < s.length) {
      const ch = s.charAt(i);
      if (ch === ' ') { indent += 1; i += 1; }
      else if (ch === '\t') { indent += 2; i += 1; }
      else if (ch === '\u3000') { indent += 2; i += 1; }
      else if (ch === '\u00a0') return { bad: '行首有 NBSP：请改成空格' };
      else break;
    }
    return { indent, body: s.slice(i), raw: s };
  }

  /* 按中文/英文逗号切列，保留每列在行内的偏移（用于高亮） */
  function fieldsOf(body) {
    const out = [];
    let start = 0;
    for (let i = 0; i <= body.length; i += 1) {
      const ch = body.charAt(i);
      if (i === body.length || SEP.test(ch)) {
        const raw = body.slice(start, i);
        const lead = raw.match(/^\s*/)[0].length;
        const trail = raw.match(/\s*$/)[0].length;
        out.push({
          value: raw.trim(),
          from: start + lead,
          to: i - trail,
          empty: raw.trim() === '',
        });
        start = i + 1;
      }
    }
    return out;
  }

  function stripComment(body) {
    const at = body.indexOf('//');
    return at >= 0 ? body.slice(0, at) : body;
  }

  function sectionOf(name) {
    const s = S(name).trim();
    if (TYPE_EN[s]) return { kind: 'account', type: s };
    const t = EN_TYPE[s.toLowerCase()];
    if (t) return { kind: 'account', type: t };
    if (s === '备注' || /^notes?$/i.test(s)) return { kind: 'note' };
    if (s === '行为' || /^behaviors?$/i.test(s)) return { kind: 'behavior' };
    if (s === '母树' || s === '绑定' || /^bindings?$/i.test(s)) return { kind: 'binding' };
    if (s === '归属') return { kind: 'binding', legacy: true };   /* 旧块名，只读迁移 */
    return null;
  }

  function codeOf(field) {
    const v = S(field && field.value);
    const m = v.match(/^([PFCHpfch])[:：](.+)$/);
    if (!m) return { domain: '', code: v };
    return { domain: m[1].toUpperCase(), code: m[2].trim() };
  }

  function autoLower(code) {
    const s = S(code);
    return /[A-Za-z]/.test(s) ? s.toLowerCase() : s;
  }

  function typeMeta(type) {
    const d = TV.dict;
    const t = d.normalizeType(type);
    return t.ok ? t : { type, pole: 'A', form: 'fluid', en: '' };
  }

  /* 母树索引：同一会计类型下的节点，按中文名 / 英文名 / 路径 / 全 ID 查找 */
  function buildIndex(system, core, type) {
    const nodes = (system && system.nodes) || {};
    const typeId = Object.keys(nodes).find((id) => nodes[id].kind === 'type' && (nodes[id].type === type || nodes[id].zh_name === type));
    const inside = new Set();
    if (typeId) {
      Object.keys(nodes).forEach((id) => {
        let cur = id;
        let guard = 0;
        while (cur && guard < 64) {
          if (cur === typeId) { inside.add(id); return; }
          cur = nodes[cur] && nodes[cur].parent_id;
          guard += 1;
        }
      });
    }
    const byId = new Map();
    const byName = new Map();
    const byPath = new Map();
    const enByPath = new Map();
    const name = (id, lang) => S(lang === 'en' ? nodes[id].en_name : nodes[id].zh_name);
    const pathOf = (id, lang) => {
      const out = [];
      let cur = id;
      while (cur && nodes[cur] && cur !== typeId) {
        out.unshift(name(cur, lang));
        cur = nodes[cur].parent_id;
      }
      return out.join('/');
    };
    inside.forEach((id) => {
      if (id === typeId) return;
      byId.set(id, id);
      const n = nodes[id];
      [n.zh_name, n.en_name].forEach((x) => {
        if (!x) return;
        if (!byName.has(x)) byName.set(x, []);
        byName.get(x).push(id);
      });
      byPath.set(pathOf(id, 'zh'), id);
      enByPath.set(pathOf(id, 'en'), id);
    });
    return { typeId, byId, byName, byPath, enByPath, nodes };
  }

  function resolveRef(ref, index) {
    const s = S(ref).trim();
    if (!s) return { ok: false, empty: true };
    if (/^SYS\./i.test(s)) {
      if (index.byId.has(s)) return { ok: true, id: s };
      return { ok: false, error: '母树里没有这个节点：' + s };
    }
    if (s.indexOf('/') >= 0) {
      if (index.byPath.has(s)) return { ok: true, id: index.byPath.get(s) };
      if (index.enByPath.has(s)) return { ok: true, id: index.enByPath.get(s) };
      return { ok: false, error: '母树路径不存在：' + s };
    }
    const hit = index.byName.get(s) || [];
    if (hit.length === 1) return { ok: true, id: hit[0] };
    if (hit.length > 1) return { ok: false, error: '母树里同名有多处，请写路径：' + s };
    return { ok: false, error: '母树里没有：' + s };
  }

  function parse(text, opts) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const system = o.system || TV.systemDict;
    const core = TV.systemDictCore;
    const D = TV.dict;
    const I = TV.ids;
    const dict = D.emptyDict(o.vaultId || '', now);
    dict.behaviors = {};
    dict.link = '';
    const diagnostics = [];
    const tokens = [];
    const categories = [];
    const catByKey = new Map();
    const used = new Set(['N_sys_loss', 'N_sys_gain']);
    const seenCode = { node: new Map(), tag: new Map(), item: new Map() };
    const codeIndex = { node: new Map(), tag: new Map(), item: new Map() };
    const aliasLines = [];
    const bindingLines = [];
    const indexes = new Map();
    const indents = new Map();
    let section = null;
    let stack = [];
    let order = 0;

    const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((rawLine, idx) => {
      const lineNo = idx + 1;
      if (!S(rawLine).trim()) return;   /* 空行不参与栈，也不重置父级 */
      if (/^\s*\/\//.test(rawLine)) return;
      const nm = norm(rawLine);
      if (nm.bad) { diagnostics.push(diag(lineNo, 0, nm.bad, 'error', 'SPACE')); return; }
      indents.set(lineNo, nm.indent);
      const body = stripComment(nm.body).replace(/\s+$/, '');
      if (!body.trim()) return;
      const indent = nm.indent;

      const sec = body.trim().match(/^\[([^\]]+)\](?:[，,]\s*(.*))?$/);
      if (sec) {
        const s = sectionOf(sec[1]);
        if (!s) { diagnostics.push(diag(lineNo, 0, '未知段：' + sec[1], 'error', 'SECTION')); section = null; return; }
        section = s;
        section.en = S(sec[2]).trim();
        stack = [];
        return;
      }
      if (!section) { diagnostics.push(diag(lineNo, 0, '这一行不在任何段里：先写 [费用] / [备注] / [行为]', 'error', 'SECTION')); return; }
      if (/^alias\b/i.test(body.trim())) {
        const rest = body.trim().slice(5).trim();
        aliasLines.push({ line: lineNo, text: rest });
        return;
      }
      if (section.kind === 'binding') {
        const bf = fieldsOf(body);
        if (bf.length !== 2 || bf[0].empty || bf[1].empty) {
          diagnostics.push(diag(lineNo, bf.length ? bf[0].from : 0, '母树绑定要两列：简码，分支或叶子', 'error', 'COLUMNS'));
          tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
          return;
        }
        bindingLines.push({ line: lineNo, code: bf[0].value, ref: bf[1].value, from: bf[1].from, to: bf[1].to });
        return;
      }

      const fields = fieldsOf(body);
      if (!fields.length) return;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const depth = stack.length;
      const parent = depth ? stack[depth - 1] : null;
      const nameField = fields[0];

      if (depth > 1) {
        diagnostics.push(diag(lineNo, 0, '只支持两层：' + (section.kind === 'account' ? '统计分类 → 节点' : '归属 → 关键字'), 'error', 'DEPTH'));
        tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
        return;
      }

      if (section.kind === 'account') {
        if (depth === 0) {
          /* 统计分类：名称[，英文名][，母树归属] */
          if (fields.length > 3) {
            diagnostics.push(diag(lineNo, nameField.from, '统计分类最多 3 列：名称，英文名，母树归属', 'error', 'COLUMNS'));
            tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
            return;
          }
          const name = nameField.value;
          if (!name) { diagnostics.push(diag(lineNo, 0, '统计分类要有名称', 'error', 'NAME')); return; }
          const enField = fields[1] && !fields[1].empty ? fields[1] : null;
          const refField = fields[2] && !fields[2].empty ? fields[2] : null;
          if (enField && /^[A-Za-z][A-Za-z0-9_-]{0,9}$/.test(name)) {
            diagnostics.push(diag(lineNo, nameField.from, '这看起来像节点（简码，名称）：是不是少缩进了？', 'warn', 'LINT_NODE'));
          }
          const key = section.type + '\u0000' + name;
          if (catByKey.has(key)) {
            diagnostics.push(diag(lineNo, nameField.from, '统计分类重复：' + name, 'error', 'CAT_DUP'));
            tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
            return;
          }
          if (!indexes.has(section.type)) indexes.set(section.type, buildIndex(system, core, section.type));
          const index = indexes.get(section.type);
          let anchorId = '';
          let anchorRef = '';
          let anchorExplicit = false;
          if (refField) {
            anchorExplicit = true;
            anchorRef = refField.value;
            const r = resolveRef(anchorRef, index);
            if (r.ok) anchorId = r.id;
            else diagnostics.push(diag(lineNo, refField.from, r.error, 'error', 'ANCHOR'));
            tokens.push({ line: lineNo, from: refField.from, to: refField.to, role: r.ok ? 'link' : 'unknown' });
          }
          /* 统计分类只是用户分组，不挂母树；没有第三列就什么都不做（不再按名字猜） */
          if (anchorId && core) {
            const eff = core.effectiveType(system.nodes, anchorId);
            if (eff && eff.type !== section.type) {
              diagnostics.push(diag(lineNo, refField ? refField.from : nameField.from, '归属是「' + eff.type + '」，与段头「' + section.type + '」不一致', 'error', 'ANCHOR_TYPE'));
              anchorId = '';
            }
          }
          const cat = {
            key, type: section.type, name, en_name: enField ? enField.value : '',
            en_auto: !enField,
            anchor_id: anchorId, anchor_ref: anchorRef, anchor_explicit: anchorExplicit,
            line: lineNo, order: (order += 1), domain: section.domain || '',
          };
          if (!enField && anchorId && system && system.nodes && system.nodes[anchorId]) {
            cat.en_name = system.nodes[anchorId].en_name || '';   /* 显示用；en_auto 仍为 true，不写回文本 */
          }
          categories.push(cat);
          catByKey.set(key, cat);
          tokens.push({ line: lineNo, from: nameField.from, to: nameField.to, role: 'def' });
          if (enField) tokens.push({ line: lineNo, from: enField.from, to: enField.to, role: 'def' });
          stack.push({ indent, kind: 'category', key });
          return;
        }

        /* 节点：简码，名称[，英文简码][，英文名] */
        if (!parent || parent.kind !== 'category') {
          diagnostics.push(diag(lineNo, nameField.from, '节点要放在统计分类下', 'error', 'DEPTH_CAT'));
          tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
          return;
        }
        if (fields.length < 2 || fields.length > 4) {
          diagnostics.push(diag(lineNo, nameField.from, '节点要 2–4 列：简码，名称，英文简码，英文名', 'error', 'COLUMNS'));
          tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
          return;
        }
        const cf = codeOf(fields[0]);
        const code = D.normalizeCode(cf.code);
        const name = fields[1].value;
        if (/^[\u4e00-\u9fff]+$/.test(code)) {
          diagnostics.push(diag(lineNo, fields[0].from, '这看起来像统计分类：是不是多缩进了？', 'warn', 'LINT_CAT'));
        }
        if (!code) { diagnostics.push(diag(lineNo, 0, '节点缺简码', 'error', 'CODE')); return; }
        if (!name) { diagnostics.push(diag(lineNo, fields[1].from, '节点缺名称', 'error', 'NAME')); return; }
        if (name.indexOf('，') >= 0 || name.indexOf(',') >= 0) {
          diagnostics.push(diag(lineNo, fields[1].from, '名称里不能有逗号', 'error', 'NAME_COMMA'));
          return;
        }
        const dm = D.normalizeDomain(cf.domain || 'P');
        if (!dm.ok) { diagnostics.push(diag(lineNo, 0, dm.error, 'error', 'DOMAIN')); return; }
        const key = dm.domain + '\u0000' + code;
        if (seenCode.node.has(key)) {
          diagnostics.push(diag(lineNo, nameField.from, '节点简码重复：' + code, 'error', 'CODE_DUP'));
          tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
          return;
        }
        seenCode.node.set(key, true);
        const id = I.newNodeId((x) => used.has(x));
        used.add(id);
        const tm = typeMeta(section.type);
        const cat = catByKey.get(parent.key);
        const enCodeField = fields[2] && !fields[2].empty ? fields[2] : null;
        const enNameField = fields[3] && !fields[3].empty ? fields[3] : null;
        dict.nodes[id] = {
          zh_name: name, en_name: enNameField ? enNameField.value : name,
          zh_code: code, en_code: enCodeField ? enCodeField.value : autoLower(code),
          polarity: tm.pole, type: tm.type, form: tm.form, domain: dm.domain,
          parent_id: '', weight: 100, sort: 100, pin: 0,
          category_key: parent.key, category: cat ? cat.name : '',
          created_at: now.toISOString(),
        };
        if (cat && cat.anchor_id) dict.nodes[id].anchor_id = cat.anchor_id;
        if (!enCodeField) dict.nodes[id].en_code_auto = true;
        if (!enNameField) dict.nodes[id].en_auto = true;
        dict.nodes[id].source_line = lineNo;
        codeIndex.node.set(code, id);
        D.addAlias(dict, code, id);
        D.addAlias(dict, dict.nodes[id].en_code, id);
        D.addAlias(dict, name, id);
        D.addAlias(dict, dict.nodes[id].en_name, id);
        tokens.push({ line: lineNo, from: nameField.from, to: nameField.to, role: 'def' });
        tokens.push({ line: lineNo, from: fields[1].from, to: fields[1].to, role: 'def' });
        stack.push({ indent, kind: 'node', key });
        return;
      }

      /* 备注 / 行为：归属（标签，无码） → 关键字（有码） */
      const kind = section.kind === 'note' ? 'tag' : 'item';
      const map = kind === 'tag' ? dict.tags : dict.behaviors;
      if (depth === 0) {
        if (fields.length > 2) {
          diagnostics.push(diag(lineNo, nameField.from, '归属最多 2 列：名称，英文名', 'error', 'COLUMNS'));
          tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
          return;
        }
        const name = nameField.value;
        if (!name) { diagnostics.push(diag(lineNo, 0, '归属要有名称', 'error', 'NAME')); return; }
        const catKey = section.kind + '\u0000' + name;
        if (catByKey.has(catKey)) {
          diagnostics.push(diag(lineNo, nameField.from, '归属重复：' + name, 'error', 'CAT_DUP'));
          return;
        }
        const enField = fields[1] && !fields[1].empty ? fields[1] : null;
        const code = D.normalizeCode(name) || 'x';
        const ckey = 'P\u0000' + code;
        if (seenCode[kind].has(ckey)) {
          diagnostics.push(diag(lineNo, nameField.from, '归属的名称与已有' + (kind === 'tag' ? '标签' : '行为项') + '同码：' + name, 'error', 'CODE_DUP'));
          return;
        }
        seenCode[kind].set(ckey, true);
        const id = kind === 'tag' ? I.newTagId((x) => used.has(x)) : I.newBehaviorItemId((x) => used.has(x));
        used.add(id);
        map[id] = {
          zh_name: name, en_name: enField ? enField.value : name,
          zh_code: code, en_code: autoLower(code), domain: 'P',
          parent_id: '', weight: 10, sort: 100, pin: 0, is_category: true,
          category_key: catKey, created_at: now.toISOString(), source_line: lineNo,
        };
        if (kind === 'tag') map[id].kind = D.tagKindOf(name);
        if (!enField) map[id].en_auto = true;
        codeIndex[kind].set(code, id);
        D.addAlias(dict, code, id);
        D.addAlias(dict, name, id);
        D.addAlias(dict, map[id].en_name, id);
        const cat = { key: catKey, kind: section.kind, type: '', name, en_name: map[id].en_name, en_auto: !enField, anchor_id: '', line: lineNo, order: (order += 1) };
        categories.push(cat);
        catByKey.set(catKey, cat);
        tokens.push({ line: lineNo, from: nameField.from, to: nameField.to, role: 'def' });
        stack.push({ indent, kind: 'category', key: catKey });
        return;
      }

      if (!parent || parent.kind !== 'category') {
        diagnostics.push(diag(lineNo, nameField.from, '关键字要放在归属下', 'error', 'DEPTH_CAT'));
        tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
        return;
      }
      if (fields.length < 2 || fields.length > 4) {
        diagnostics.push(diag(lineNo, nameField.from, '关键字要 2–4 列：简码，名称，英文简码，英文名', 'error', 'COLUMNS'));
        tokens.push({ line: lineNo, from: 0, to: body.length, role: 'error' });
        return;
      }
      const kf = codeOf(fields[0]);
      const kcode = D.normalizeCode(kf.code);
      const kname = fields[1].value;
      if (!kcode) { diagnostics.push(diag(lineNo, 0, '关键字缺简码', 'error', 'CODE')); return; }
      if (!kname) { diagnostics.push(diag(lineNo, fields[1].from, '关键字缺名称', 'error', 'NAME')); return; }
      const kdm = D.normalizeDomain(kf.domain || 'P');
      const kkey = kdm.domain + '\u0000' + kcode;
      if (seenCode[kind].has(kkey)) {
        diagnostics.push(diag(lineNo, nameField.from, '简码重复：' + kcode, 'error', 'CODE_DUP'));
        return;
      }
      seenCode[kind].set(kkey, true);
      const kid = kind === 'tag' ? I.newTagId((x) => used.has(x)) : I.newBehaviorItemId((x) => used.has(x));
      used.add(kid);
      const catRec = catByKey.get(parent.key);
      const catId = catRec && codeIndex[kind].get(S(catRec.name).replace(/\s+/g, '')) ? codeIndex[kind].get(S(catRec.name).replace(/\s+/g, '')) : '';
      const kEnCode = fields[2] && !fields[2].empty ? fields[2].value : autoLower(kcode);
      const kEnName = fields[3] && !fields[3].empty ? fields[3].value : kname;
      const fallbackEn = kind === 'tag' ? TAG_EN_DEFAULTS[kname] : null;
      const finalEnCode = (!fields[2] || fields[2].empty) && fallbackEn ? fallbackEn[0] : kEnCode;
      const finalEnName = (!fields[3] || fields[3].empty) && fallbackEn ? fallbackEn[1] : kEnName;
      map[kid] = {
        zh_name: kname, en_name: finalEnName, zh_code: kcode, en_code: finalEnCode,
        domain: kdm.domain, parent_id: catId || '', weight: 10, sort: 100, pin: 0,
        category_key: parent.key, created_at: now.toISOString(), source_line: lineNo,
      };
      if (kind === 'tag') map[kid].kind = D.tagKindOf(kname);
      codeIndex[kind].set(kcode, kid);
      D.addAlias(dict, kcode, kid);
      D.addAlias(dict, finalEnCode, kid);
      D.addAlias(dict, kname, kid);
      D.addAlias(dict, finalEnName, kid);
      tokens.push({ line: lineNo, from: nameField.from, to: nameField.to, role: 'def' });
      tokens.push({ line: lineNo, from: fields[1].from, to: fields[1].to, role: 'def' });
      stack.push({ indent, kind: 'item', key: kkey });
    });

    /* 归属块：节点级固定绑定（分支或叶子）；覆盖统计分类的默认归属 */
    bindingLines.forEach((b) => {
      const cf = codeOf({ value: b.code });
      const code = D.normalizeCode(cf.code);
      const domain = cf.domain || '';
      const hits = Object.keys(dict.nodes).filter((id) => {
        const n = dict.nodes[id];
        return !n.system && n.zh_code === code && (!domain || (n.domain || 'P') === domain);
      });
      if (hits.length !== 1) {
        diagnostics.push(diag(b.line, 0, hits.length ? '简码有多处，请写 P:/C: 前缀：' + b.code : '母树绑定里找不到节点：' + b.code, 'error', 'BIND_NODE'));
        tokens.push({ line: b.line, from: 0, to: b.code.length + 1 + b.ref.length, role: 'error' });
        return;
      }
      const node = dict.nodes[hits[0]];
      if (!indexes.has(node.type)) indexes.set(node.type, buildIndex(system, core, node.type));
      const index = indexes.get(node.type);
      let r = resolveRef(b.ref, index);
      if (!r.ok) {
        /* 跨类型提示：目标存在，但不在这个会计类型下 */
        const globalHits = Object.keys(system.nodes).filter((id) => {
          const n = system.nodes[id];
          return n.kind === 'category' && (id === b.ref || n.zh_name === b.ref || n.en_name === b.ref);
        });
        if (globalHits.length === 1) {
          const eff = core ? core.effectiveType(system.nodes, globalHits[0]) : null;
          if (eff && eff.type !== node.type) {
            diagnostics.push(diag(b.line, b.from, '归属「' + b.ref + '」属于「' + eff.type + '」，与节点「' + node.type + '」不一致', 'error', 'BIND_MISMATCH'));
            tokens.push({ line: b.line, from: b.from, to: b.to, role: 'unknown' });
            return;
          }
        }
        diagnostics.push(diag(b.line, b.from, r.error, 'error', 'BIND_REF'));
        tokens.push({ line: b.line, from: b.from, to: b.to, role: 'unknown' });
        return;
      }
      if (system.nodes[r.id] && system.nodes[r.id].kind === 'type') {
        diagnostics.push(diag(b.line, b.from, '母树绑定要选分支或叶子，不能选会计类型本身', 'error', 'BIND_TYPE'));
        tokens.push({ line: b.line, from: b.from, to: b.to, role: 'unknown' });
        return;
      }
      const eff = core ? core.effectiveType(system.nodes, r.id) : null;
      if (eff && eff.type !== node.type) {
        diagnostics.push(diag(b.line, b.from, '母树绑定是「' + eff.type + '」，与节点「' + node.type + '」不一致', 'error', 'BIND_MISMATCH'));
        tokens.push({ line: b.line, from: b.from, to: b.to, role: 'unknown' });
        return;
      }
      node.anchor_id = r.id;
      tokens.push({ line: b.line, from: b.from, to: b.to, role: 'link' });
    });

    /* alias 第二遍：目标可以是码，也可以带 N:/T:/H: 前缀 */
    const codeOfKind = (kind, code, domain) => {
      const idx = codeIndex[kind];
      if (!idx) return '';
      if (domain) {
        const map = kind === 'node' ? dict.nodes : kind === 'tag' ? dict.tags : dict.behaviors;
        const hit = Object.keys(map).find((id) => map[id].zh_code === code && S(map[id].domain || 'P').toUpperCase() === domain);
        return hit || '';
      }
      return idx.get(code) || '';
    };
    aliasLines.forEach((a) => {
      const parts = a.text.split(/[，,]/).map((x) => x.trim()).filter(Boolean);
      if (!parts.length) return;
      const key = parts.shift();
      parts.forEach((tok) => {
        const m = tok.match(/^([NTH]):(?:([PFCH]):)?(.+)$/i);
        const kind = m ? ({ N: 'node', T: 'tag', H: 'item' })[m[1].toUpperCase()] : 'node';
        const domain = m && m[2] ? m[2].toUpperCase() : '';
        const code = m ? m[3] : tok;
        let id = codeOfKind(kind, code, domain);
        if (!id && !m) {
          const tries = ['node', 'tag', 'item'].map((k) => codeOfKind(k, code, '')).filter(Boolean);
          if (tries.length === 1) id = tries[0];
        }
        if (id) D.addAlias(dict, key, id);
        else diagnostics.push(diag(a.line, 0, '别名目标不存在：' + tok, 'error', 'ALIAS_TARGET'));
      });
      if (!dict._explicitAliases) dict._explicitAliases = {};
      dict._explicitAliases[key] = true;
    });

    /* token 偏移从行的正文起点改回整行起点（缩进要算进去，编辑器才知道列） */
    tokens.forEach((t) => {
      const d = indents.get(t.line) || 0;
      t.from += d;
      t.to += d;
    });

    /* 链路损耗/增益：与 v3 编译产物一致，calc / report 依赖它们 */
    [['N_sys_loss', 'loss', 'Loss', '费用', 'A', 'steam', '损耗'],
      ['N_sys_gain', 'gain', 'Gain', '收入', 'B', 'outside', '增益']].forEach((x) => {
      if (dict.nodes[x[0]]) return;
      dict.nodes[x[0]] = {
        zh_name: x[6], en_name: x[2], zh_code: x[1], en_code: x[1],
        polarity: x[4], type: x[3], form: x[5], domain: 'P',
        parent_id: '', weight: 0, sort: 100, pin: 0, system: true, created_at: now.toISOString(),
      };
    });

    const stats = {
      categories: categories.length,
      nodes: Object.keys(dict.nodes).filter((id) => !dict.nodes[id].system).length,
      tags: Object.keys(dict.tags).filter((id) => !dict.tags[id].is_category).length,
      items: Object.keys(dict.behaviors).length,
      aliases: Object.keys(dict.aliases).length,
    };
    const ok = diagnostics.every((d) => d.severity !== 'error');
    dict.format = 'v4';
    dict.categories = categories;
    return { ok, format: 'v4', dict, categories, diagnostics, tokens, stats };
  }

  function detect(text) {
    const s = S(text);
    if (/^\s*\[(树|会计|TREE|ACCOUNT)\]/mi.test(s)) return 'v3';
    if (/^\s*(node|tag|item)\s/mi.test(s)) return 'v3';
    return 'v4';
  }

  function indentOf(depth) {
    return '  '.repeat(depth);
  }

  function emit(result) {
    const dict = result && result.dict ? result.dict : result;
    const categories = ((result && result.categories) || (dict && dict.categories) || []).slice();
    const out = [
      '// TxtVein 字典 v4 · 会计类型 → 统计分类 → 节点：一行一条，中文逗号分列',
      '// 节点列：简码，名称，英文简码，英文名；母树绑定固定在文末 [母树]：简码，分支或叶子',
    ];
    const typeOrder = ['费用', '收入', '资产', '负债', '成本', '权益'];
    const known = new Set(categories.map((c) => c.key));
    const lost = { account: {}, note: [], behavior: [] };
    Object.keys(dict.nodes || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (n.system) return;
      if (n.category_key && known.has(n.category_key)) return;
      if (!lost.account[n.type]) lost.account[n.type] = [];
      lost.account[n.type].push(n);
    });
    const sortByLine = (arr) => arr.slice().sort((a, b) => (a.source_line || 1e9) - (b.source_line || 1e9) || S(a.zh_code).localeCompare(S(b.zh_code)));
    const nodeRow = (n) => {
      const codeCell = n.domain && n.domain !== 'P' ? n.domain + ':' + n.zh_code : n.zh_code;
      const row = [codeCell, n.zh_name];
      if (!n.en_code_auto) row.push(n.en_code || '');
      if (!n.en_auto) { while (row.length < 3) row.push(''); row.push(n.en_name || ''); }
      return row.join('，');
    };
    const nodesOf = (key) => sortByLine(Object.keys(dict.nodes || {})
      .map((id) => dict.nodes[id]).filter((n) => !n.system && n.category_key === key));
    typeOrder.forEach((type) => {
      const cats = categories.filter((c) => c.type === type).sort((a, b) => (a.order || 1e9) - (b.order || 1e9));
      const orphans = lost.account[type] || [];
      if (!cats.length && !orphans.length) return;
      out.push('');
      out.push('[' + type + ']，' + TYPE_EN[type]);
      cats.forEach((c) => {
        const parts = [c.name];
        if (!c.en_auto && c.en_name) parts.push(c.en_name);
        out.push('');
        out.push(indentOf(0) + parts.join('，'));
        nodesOf(c.key).forEach((n) => out.push(indentOf(1) + nodeRow(n)));
      });
      if (orphans.length) {
        out.push('');
        out.push(indentOf(0) + '未分类');
        sortByLine(orphans).forEach((n) => out.push(indentOf(1) + nodeRow(n)));
      }
    });
    ['note', 'behavior'].forEach((kind) => {
      const cats = categories.filter((c) => c.kind === kind).sort((a, b) => (a.order || 1e9) - (b.order || 1e9));
      const map = kind === 'note' ? dict.tags : dict.behaviors;
      const rows = Object.keys(map || {}).map((id) => map[id])
        .filter((t) => !t.is_category && !t.auto);
      const orphans = rows.filter((t) => !t.category_key || !known.has(t.category_key));
      if (!cats.length && !orphans.length) return;
      out.push('');
      out.push(kind === 'note' ? '[备注]，Notes' : '[行为]，Behavior');
      const rowOf = (t) => nodeRow(t);
      cats.forEach((c) => {
        out.push('');
        out.push(c.name + (c.en_auto ? '' : '，' + c.en_name));
        rows.filter((t) => t.category_key === c.key)
          .sort((a, b) => (a.source_line || 1e9) - (b.source_line || 1e9))
          .forEach((t) => out.push(indentOf(1) + rowOf(t)));
      });
      if (orphans.length) {
        out.push('');
        out.push(indentOf(0) + '未分类');
        orphans.sort((a, b) => (a.source_line || 1e9) - (b.source_line || 1e9))
          .forEach((t) => out.push(indentOf(1) + rowOf(t)));
      }
    });
    /* 归属块：每个绑定过的节点一行（固定绑定，不随统计分类走） */
    const bound = Object.keys(dict.nodes || {}).map((id) => dict.nodes[id])
      .filter((n) => !n.system && n.anchor_id)
      .sort((a, b) => (a.source_line || 1e9) - (b.source_line || 1e9) || S(a.zh_code).localeCompare(S(b.zh_code)));
    if (bound.length) {
      out.push('');
      out.push('[母树]，Bindings');
      bound.forEach((n) => {
        const codeCell = n.domain && n.domain !== 'P' ? n.domain + ':' + n.zh_code : n.zh_code;
        out.push(codeCell + '，' + n.anchor_id);
      });
    }

    const aliases = dict.aliases || {};
    const explicit = dict._explicitAliases || {};
    const aliasLines = [];
    Object.keys(aliases).sort().forEach((key) => {
      const ids = aliases[key] || [];
      if (!ids.length) return;
      if (!explicit[key]) return;          /* 只写用户显式写的 alias，不写自动别名 */
      if (ids.length < 2) return;
      const codes = ids.map((id) => {
        const n = dict.nodes[id] || (dict.tags && dict.tags[id]) || (dict.behaviors && dict.behaviors[id]);
        return n ? (n.zh_code || id) : id;
      });
      const lowKey = S(key).toLowerCase();
      if (new Set(codes.map((c) => S(c).toLowerCase())).size < 2
        || codes.every((c) => S(c).toLowerCase() === lowKey)) return;   /* 自我别名，旧自动添加 */
      aliasLines.push('alias ' + key + '，' + codes.join('，'));
    });
    if (aliasLines.length) { out.push(''); aliasLines.forEach((l) => out.push(l)); }
    return out.join('\n') + '\n';
  }

  /* ---------- 模型操作（UI 用；保证 emit 不丢节点） ---------- */

  function categoriesOf(dict, type) {
    const list = (dict && dict.categories) || [];
    return type ? list.filter((c) => c.type === type) : list;
  }

  function catKey(type, name) { return type + '\u0000' + name; }

  function ensureCategory(dict, type, name, opts) {
    const o = opts || {};
    if (!dict.categories) dict.categories = [];
    const key = catKey(type, name);
    let cat = dict.categories.find((c) => c.key === key);
    if (cat) return { ok: true, key, cat, created: false };
    const order = dict.categories.reduce((m, c) => Math.max(m, c.order || 0), 0) + 1;
    cat = {
      key, type, name,
      en_name: o.en_name || '', en_auto: !o.en_name,
      anchor_id: o.anchor_id || '', anchor_ref: o.anchor_ref || '', anchor_explicit: !!o.anchor_ref,
      line: 0, order,
    };
    dict.categories.push(cat);
    return { ok: true, key, cat, created: true };
  }

  function reanchorNodes(dict, categoryKey) {
    const cat = (dict.categories || []).find((c) => c.key === categoryKey);
    if (!cat) return 0;
    let n = 0;
    Object.keys(dict.nodes || {}).forEach((id) => {
      const node = dict.nodes[id];
      if (node.system || node.category_key !== categoryKey) return;
      if (cat.anchor_id) node.anchor_id = cat.anchor_id;
      else delete node.anchor_id;
      n += 1;
    });
    return n;
  }

  function placeNode(dict, nodeId, categoryKey) {
    const node = dict.nodes && dict.nodes[nodeId];
    if (!node) return { ok: false, error: '节点不存在：' + nodeId };
    const cat = (dict.categories || []).find((c) => c.key === categoryKey);
    if (!cat) return { ok: false, error: '统计分类不存在：' + categoryKey };
    if (cat.type !== node.type) return { ok: false, error: '统计分类「' + cat.name + '」属于「' + cat.type + '」，与节点「' + node.type + '」不一致' };
    node.category_key = categoryKey;
    node.category = cat.name;
    if (cat.anchor_id) node.anchor_id = cat.anchor_id;   /* 旧文本的分类默认归属；节点自己的绑定不删 */
    return { ok: true, node, cat };
  }

  function setCategoryAnchor(dict, categoryKey, ref, system) {
    const cat = (dict.categories || []).find((c) => c.key === categoryKey);
    if (!cat) return { ok: false, error: '统计分类不存在：' + categoryKey };
    const sys = system || TV.systemDict;
    const core = TV.systemDictCore;
    if (!ref) {
      cat.anchor_id = '';
      cat.anchor_ref = '';
      cat.anchor_explicit = false;
      reanchorNodes(dict, categoryKey);
      return { ok: true, cat, cleared: true };
    }
    const index = buildIndex(sys, core, cat.type);
    const r = resolveRef(ref, index);
    if (!r.ok) return { ok: false, error: r.error };
    const eff = core ? core.effectiveType(sys.nodes, r.id) : null;
    if (eff && eff.type !== cat.type) return { ok: false, error: '归属是「' + eff.type + '」，与「' + cat.type + '」不一致' };
    cat.anchor_id = r.id;
    const sameAsName = S(ref) === cat.name;
    cat.anchor_ref = sameAsName ? '' : S(ref);
    cat.anchor_explicit = !sameAsName;
    if (cat.en_auto && sys.nodes[r.id]) cat.en_name = sys.nodes[r.id].en_name || cat.en_name;
    const n = reanchorNodes(dict, categoryKey);
    return { ok: true, cat, affected: n };
  }

  function renameCategory(dict, categoryKey, name) {
    const cat = (dict.categories || []).find((c) => c.key === categoryKey);
    if (!cat) return { ok: false, error: '统计分类不存在：' + categoryKey };
    const next = S(name).trim();
    if (!next) return { ok: false, error: '统计分类要有名称' };
    if (next === cat.name) return { ok: true, cat, changed: false };
    const nk = catKey(cat.type, next);
    if ((dict.categories || []).some((c) => c.key === nk && c !== cat)) return { ok: false, error: '统计分类重名：' + next };
    const old = cat.key;
    cat.name = next;
    cat.key = nk;
    Object.keys(dict.nodes || {}).forEach((id) => {
      const node = dict.nodes[id];
      if (node.category_key !== old) return;
      node.category_key = nk;
      node.category = next;
    });
    return { ok: true, cat, key: nk, renamed: true };
  }

  function removeCategory(dict, categoryKey) {
    const idx = (dict.categories || []).findIndex((c) => c.key === categoryKey);
    if (idx < 0) return { ok: false, error: '统计分类不存在：' + categoryKey };
    const [cat] = dict.categories.splice(idx, 1);
    let moved = 0;
    Object.keys(dict.nodes || {}).forEach((id) => {
      const node = dict.nodes[id];
      if (node.category_key !== categoryKey) return;
      node.category_key = '';
      node.category = '';
      moved += 1;   /* 绑定固定在节点上，删分组不动它 */
    });
    return { ok: true, cat, moved };
  }

  /* ---------- v3 → v4 转换（有损重组；返回报告） ---------- */

  function chainOf(nodes, id) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) { out.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
    return out;
  }

  function topBranchOf(nodes, id) {
    const ch = chainOf(nodes, id);
    const ti = ch.findIndex((x) => nodes[x].kind === 'type');
    return ti >= 0 ? (ch[ti + 1] || '') : '';
  }

  function fromV3(dictV3, opts) {
    const o = opts || {};
    const system = o.system || TV.systemDict;
    const sysNodes = (system && system.nodes) || {};
    const src = dictV3 || {};
    const nodesIn = src.nodes || {};
    const idsReal = Object.keys(nodesIn).filter((id) => !nodesIn[id].system);
    const children = {};
    idsReal.forEach((id) => {
      const p = nodesIn[id].parent_id;
      if (p) children[p] = (children[p] || 0) + 1;
    });
    const isGroup = (id) => (children[id] || 0) > 0 && !nodesIn[id].anchor_id;

    const out = TV.dict.emptyDict(src.vaultId || 'v4', o.now instanceof Date ? o.now : new Date());
    out.behaviors = {};
    out.link = '';
    out.aliases = {};
    const cats = [];
    const catByKey = new Map();
    const report = { nodes: 0, categories: 0, bindings: 0, groups: [], unmapped: [], groupNodesDropped: 0, tagFlattened: [] };

    function addCat(type, name, enName, order) {
      const key = type + '\u0000' + name;
      if (catByKey.has(key)) return catByKey.get(key);
      const cat = {
        key, type, name,
        en_name: enName || '', en_auto: !enName,
        anchor_id: '', anchor_ref: '', anchor_explicit: false,
        line: 0, order: order || (cats.length + 1),
      };
      cats.push(cat);
      catByKey.set(key, cat);
      return cat;
    }

    idsReal.forEach((id) => {
      const n = nodesIn[id];
      if (isGroup(id)) { report.groupNodesDropped += 1; return; }
      const parent = n.parent_id ? nodesIn[n.parent_id] : null;
      let groupName = '未分类';
      let enName = '';
      if (parent) {
        if (isGroup(n.parent_id)) {
          groupName = parent.zh_name;
          enName = parent.en_name && parent.en_name !== parent.zh_name ? parent.en_name : '';
        } else {
          /* v3 允许节点套节点；v4 只有两层，压到父节点自己的组并报告 */
          const gp = parent.parent_id ? nodesIn[parent.parent_id] : null;
          groupName = gp && isGroup(parent.parent_id) ? gp.zh_name : '未分类';
          report.unmapped.push({ id, name: n.zh_name, reason: '嵌套节点压平' });
        }
      }
      if (!n.anchor_id) report.unmapped.push({ id, name: n.zh_name, reason: '没有归属' });
      const cat = addCat(n.type, groupName, enName, parent && isGroup(n.parent_id) ? Number(parent.sort) || 0 : 0);
      const nid = TV.ids.newNodeId((x) => !!out.nodes[x]);
      out.nodes[nid] = {
        zh_name: n.zh_name, en_name: n.en_name || n.zh_name,
        zh_code: n.zh_code || n.en_code || nid.slice(2, 6),
        en_code: n.en_code || (n.zh_code || '').toLowerCase(),
        type: n.type, polarity: n.polarity, form: n.form || 'fluid',
        domain: n.domain || 'P', parent_id: '', weight: n.weight || 0, sort: n.sort || 100, pin: 0,
        category_key: cat.key, category: cat.name,
        en_auto: !n.en_name || n.en_name === n.zh_name,
        en_code_auto: !n.en_code || n.en_code === (n.zh_code || '').toLowerCase(),
        created_at: (o.now instanceof Date ? o.now : new Date()).toISOString(),
        source_line: Number(n.sort) || 100,
      };
      if (n.anchor_id) {
        out.nodes[nid].anchor_id = n.anchor_id;
        report.bindings += 1;
      }
      TV.dict.addAlias(out, out.nodes[nid].zh_code, nid);
      TV.dict.addAlias(out, out.nodes[nid].zh_name, nid);
      TV.dict.addAlias(out, out.nodes[nid].en_code, nid);
      TV.dict.addAlias(out, out.nodes[nid].en_name, nid);
      report.nodes += 1;
    });
    report.groups = cats.filter((c) => c.type).map((c) => ({ name: c.name, type: c.type }));

    /* 标签 / 行为：v3 的父链压成两层；更深的历史压到根归属并报告 */
    [['tag', src.tags, out.tags, 'note'], ['item', src.behaviors, out.behaviors, 'behavior']].forEach(([kind, srcMap, outMap, sec]) => {
      const ids = Object.keys(srcMap || {});
      const hasKids = new Set();
      ids.forEach((id) => { if (srcMap[id].parent_id) hasKids.add(srcMap[id].parent_id); });
      const keyOf = (name) => sec + '\u0000' + name;
      const catOf = new Map();
      function catFor(name) {
        if (catOf.has(name)) return catOf.get(name);
        const key = keyOf(name);
        let cat = catByKey.get(key);
        if (!cat) {
          cat = { key, kind: sec, type: '', name, en_name: '', en_auto: true, anchor_id: '', line: 0, order: cats.length + 1 };
          cats.push(cat); catByKey.set(key, cat);
        }
        catOf.set(name, cat);
        return cat;
      }
      ids.forEach((id) => {
        const t = srcMap[id];
        if (!t || t.auto) return;
        const roots = !t.parent_id;
        if (roots && hasKids.has(id)) { catFor(t.zh_name); return; }
        let rootName = t.zh_name;
        if (t.parent_id && srcMap[t.parent_id]) {
          const p = srcMap[t.parent_id];
          rootName = p.parent_id && srcMap[p.parent_id] ? srcMap[p.parent_id].zh_name : p.zh_name;
          if (p.parent_id && srcMap[p.parent_id]) report.tagFlattened.push({ id, name: t.zh_name, from: p.zh_name, to: rootName });
        }
        const cat = catFor(rootName);
        const nid = kind === 'tag' ? TV.ids.newTagId((x) => !!outMap[x]) : TV.ids.newBehaviorItemId((x) => !!outMap[x]);
        outMap[nid] = {
          zh_name: t.zh_name, en_name: t.en_name || t.zh_name,
          zh_code: t.zh_code, en_code: t.en_code || (t.zh_code || '').toLowerCase(),
          domain: t.domain || 'P', parent_id: '', weight: t.weight || 10, sort: 100, pin: 0,
          category_key: cat.key,
          en_auto: !t.en_name || t.en_name === t.zh_name,
          en_code_auto: !t.en_code || t.en_code === (t.zh_code || '').toLowerCase(),
          created_at: (o.now instanceof Date ? o.now : new Date()).toISOString(),
        };
        if (kind === 'tag') outMap[nid].kind = t.kind || TV.dict.tagKindOf(t.zh_name);
        TV.dict.addAlias(out, outMap[nid].zh_code, nid);
        TV.dict.addAlias(out, outMap[nid].zh_name, nid);
      });
      ids.filter((id) => !srcMap[id].parent_id && !hasKids.has(id)).forEach((id) => catFor(srcMap[id].zh_name));
    });

    /* 只保留真正多义的别名（自动别名不写回） */
    Object.keys(src.aliases || {}).forEach((key) => {
      const targets = (src.aliases[key] || []).filter(Boolean);
      if (targets.length < 2) return;
      out.aliases[key] = [];
      targets.forEach((oldId) => {
        const t = src.nodes[oldId] || (src.tags && src.tags[oldId]) || (src.behaviors && src.behaviors[oldId]);
        if (!t) return;
        const hit = Object.keys(out.nodes).find((nid) => !out.nodes[nid].system && out.nodes[nid].zh_code === t.zh_code);
        if (hit) out.aliases[key].push(hit);
      });
      if (out.aliases[key].length < 2) delete out.aliases[key];
      else {
        if (!out._explicitAliases) out._explicitAliases = {};
        out._explicitAliases[key] = true;
      }
    });

    out.format = 'v4';
    out.categories = cats;
    report.categories = cats.length;
    report.emitted = 0;
    return { ok: true, dict: out, categories: cats, report };
  }

  /* ---------- 采纳母树：选分支或叶子 → 用户分组 + 节点级固定绑定 ---------- */

  function isSelectableTarget(nodes, id) {
    const n = nodes[id];
    return !!n && n.kind === 'category';   /* 排除 root / type，其余分支和叶子都可选 */
  }

  function placementForTarget(targetId, system) {
    const sys = system || TV.systemDict;
    const core = TV.systemDictCore;
    const nodes = (sys && sys.nodes) || {};
    const id = S(targetId).trim();
    if (!nodes[id]) return { ok: false, error: '母树里没有：' + id };
    if (!isSelectableTarget(nodes, id)) return { ok: false, error: '要选母树的分支或叶子：' + id };
    const eff = core ? core.effectiveType(nodes, id) : null;
    if (!eff) return { ok: false, error: '目标没有会计类型：' + id };
    const chain = [];
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) { chain.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
    const ti = chain.findIndex((x) => nodes[x].kind === 'type');
    const top = ti >= 0 ? (chain[ti + 1] || '') : '';
    return {
      ok: true, type: eff.type, targetId: id, target: nodes[id], top,
      groupName: top && nodes[top] ? nodes[top].zh_name : '未分类',
    };
  }

  function setNodeAnchor(dict, nodeId, ref, system) {
    const node = dict.nodes && dict.nodes[nodeId];
    if (!node) return { ok: false, error: '节点不存在：' + nodeId };
    if (!ref) { delete node.anchor_id; return { ok: true, cleared: true }; }
    const sys = system || TV.systemDict;
    const index = buildIndex(sys, TV.systemDictCore, node.type);
    const r = resolveRef(ref, index);
    if (!r.ok) return { ok: false, error: r.error };
    if (sys.nodes[r.id] && sys.nodes[r.id].kind === 'type') {
      return { ok: false, error: '母树绑定要选分支或叶子，不能选会计类型本身' };
    }
    const eff = TV.systemDictCore ? TV.systemDictCore.effectiveType(sys.nodes, r.id) : null;
    if (eff && eff.type !== node.type) {
      return { ok: false, error: '母树绑定是「' + eff.type + '」，与节点「' + node.type + '」不一致' };
    }
    node.anchor_id = r.id;
    return { ok: true, anchor_id: r.id, target: sys.nodes[r.id] };
  }

  /* ---------- 绑定的用途：语义理解 / 同支推荐 / 快速校验 ---------- */

  function pathNames(nodes, id, lang) {
    const chain = [];
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) { chain.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
    return chain.filter((x) => nodes[x].kind !== 'root' && nodes[x].kind !== 'type')
      .map((x) => (lang === 'en' ? (nodes[x].en_name || nodes[x].zh_name) : nodes[x].zh_name)).join(' / ');
  }

  function isAncestorOrSelf(nodes, a, b) {
    let cur = b;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) {
      if (cur === a) return true;
      cur = nodes[cur].parent_id;
      guard += 1;
    }
    return false;
  }

  /* 同支推荐：同一个父级下的其它分支/叶子；叶子优先 */
  function siblingSuggestions(targetId, system, limit) {
    const sys = system || TV.systemDict;
    const nodes = (sys && sys.nodes) || {};
    const id = S(targetId).trim();
    const t = nodes[id];
    if (!t || !t.parent_id) return [];
    const kids = Object.keys(nodes).filter((x) => nodes[x].parent_id === t.parent_id && x !== id && nodes[x].kind === 'category');
    const isLeaf = (x) => !Object.keys(nodes).some((k) => nodes[k].parent_id === x);
    return kids
      .sort((a, b) => (Number(isLeaf(b)) - Number(isLeaf(a)))
        || ((Number(nodes[a].sort) || 100) - (Number(nodes[b].sort) || 100))
        || S(nodes[a].zh_name).localeCompare(S(nodes[b].zh_name), 'zh'))
      .slice(0, limit || 6)
      .map((x) => ({ id: x, name: nodes[x].zh_name, en_name: nodes[x].en_name, path: pathNames(nodes, x), leaf: isLeaf(x) }));
  }

  /* 快速语义校验：未绑定 / 失效 / 类型不符 / 名字更像另一支 */
  function validateBindings(dict, system) {
    const sys = system || TV.systemDict;
    const nodes = (sys && sys.nodes) || {};
    const core = TV.systemDictCore;
    const issues = [];
    Object.keys((dict && dict.nodes) || {}).forEach((id) => {
      const n = dict.nodes[id];
      if (!n || n.system) return;
      if (!n.anchor_id) {
        issues.push({ id, code: 'UNBOUND', level: 'info', message: '未绑定：公共报表会记「未归类」' });
        return;
      }
      const target = nodes[n.anchor_id];
      if (!target) {
        issues.push({ id, code: 'STALE', level: 'error', message: '绑定不在当前母树：' + n.anchor_id });
        return;
      }
      const eff = core ? core.effectiveType(nodes, n.anchor_id) : null;
      if (eff && eff.type !== n.type) {
        issues.push({ id, code: 'TYPE', level: 'error', message: '绑定是「' + eff.type + '」，节点是「' + n.type + '」' });
      }
      const nameHits = Object.keys(nodes).filter((x) => nodes[x].kind === 'category'
        && (nodes[x].zh_name === n.zh_name || nodes[x].en_name === n.zh_name));
      if (nameHits.length === 1 && nameHits[0] !== n.anchor_id
        && !isAncestorOrSelf(nodes, nameHits[0], n.anchor_id)
        && !isAncestorOrSelf(nodes, n.anchor_id, nameHits[0])) {
        issues.push({
          id, code: 'NAME', level: 'warn',
          message: '节点名更像「' + pathNames(nodes, nameHits[0]) + '」，当前绑定「' + pathNames(nodes, n.anchor_id) + '」',
        });
      }
    });
    return issues;
  }

  /* ---------- P/C 物理拆分（v4）：按域拆，分类/绑定跟着走 ---------- */

  function splitByDomain(text, opts) {
    const r = parse(text, opts);
    if (!r.ok) return { ok: false, p: '', c: '', diagnostics: r.diagnostics };
    const mk = () => {
      const d = TV.dict.emptyDict('v4', new Date());
      d.behaviors = {};
      d.aliases = {};
      return { dict: d, cats: [] };
    };
    const sides = { P: mk(), C: mk() };
    const used = { P: new Set(), C: new Set() };
    const sideOf = (d) => {
      const x = S(d || 'P').toUpperCase();
      return x === 'C' || x === 'H' ? 'C' : 'P';
    };
    Object.keys(r.dict.nodes || {}).forEach((id) => {
      const n = r.dict.nodes[id];
      if (n.system) return;
      const s = sideOf(n.domain);
      sides[s].dict.nodes[id] = JSON.parse(JSON.stringify(n));
      if (n.category_key) used[s].add(n.category_key);
    });
    [['tags', 'note'], ['behaviors', 'behavior']].forEach(([key]) => {
      Object.keys(r.dict[key] || {}).forEach((id) => {
        const t = r.dict[key][id];
        if (t.is_category) return;
        const s = sideOf(t.domain);
        sides[s].dict[key][id] = JSON.parse(JSON.stringify(t));
        if (t.category_key) used[s].add(t.category_key);
      });
    });
    (r.categories || []).forEach((c) => {
      ['P', 'C'].forEach((s) => {
        if (used[s].has(c.key)) sides[s].cats.push(Object.assign({}, c));
      });
    });
    Object.keys(r.dict.aliases || {}).forEach((key) => {
      const ids = r.dict.aliases[key] || [];
      ['P', 'C'].forEach((s) => {
        const keep = ids.filter((id) => sides[s].dict.nodes[id]
          || (sides[s].dict.tags && sides[s].dict.tags[id])
          || (sides[s].dict.behaviors && sides[s].dict.behaviors[id]));
        if (!keep.length) return;
        sides[s].dict.aliases[key] = keep;
        if (r.dict._explicitAliases && r.dict._explicitAliases[key]) {
          sides[s].dict._explicitAliases = sides[s].dict._explicitAliases || {};
          sides[s].dict._explicitAliases[key] = true;
        }
      });
    });
    return {
      ok: true,
      p: emit({ dict: sides.P.dict, categories: sides.P.cats }),
      c: emit({ dict: sides.C.dict, categories: sides.C.cats }),
      diagnostics: r.diagnostics,
    };
  }

  function mergeSides(p, c, opts) {
    const a = parse(S(p), opts);
    const b = parse(S(c), opts);
    const out = TV.dict.emptyDict('v4', new Date());
    out.behaviors = {};
    out.tags = out.tags || {};
    out.aliases = {};
    const cats = [];
    const catKeys = new Set();
    [a, b].forEach((r) => {
      (r.categories || []).forEach((cat) => {
        if (catKeys.has(cat.key)) return;
        catKeys.add(cat.key);
        cats.push(Object.assign({}, cat));
      });
    });
    const idMap = { a: new Map(), b: new Map() };
    [a, b].forEach((r, i) => {
      const side = i === 0 ? 'a' : 'b';
      Object.keys(r.dict.nodes || {}).forEach((id) => {
        const n = r.dict.nodes[id];
        if (n.system) return;
        const nid = TV.ids.newNodeId((x) => !!out.nodes[x]);
        out.nodes[nid] = Object.assign({}, n);
        idMap[side].set(id, nid);
      });
    });
    [['tags', 'tag'], ['behaviors', 'item']].forEach(([key, kind]) => {
      [a, b].forEach((r, i) => {
        const side = i === 0 ? 'a' : 'b';
        Object.keys(r.dict[key] || {}).forEach((id) => {
          const t = r.dict[key][id];
          if (t.is_category) return;
          const nid = kind === 'tag'
            ? TV.ids.newTagId((x) => !!out[key][x])
            : TV.ids.newBehaviorItemId((x) => !!out[key][x]);
          out[key][nid] = Object.assign({}, t);
          idMap[side].set(id, nid);
        });
      });
    });
    [a, b].forEach((r, i) => {
      const side = i === 0 ? 'a' : 'b';
      Object.keys(r.dict.aliases || {}).forEach((key) => {
        const ids = (r.dict.aliases[key] || []).map((id) => idMap[side].get(id)).filter(Boolean);
        if (!ids.length) return;
        if (!out.aliases[key]) out.aliases[key] = [];
        ids.forEach((id) => { if (out.aliases[key].indexOf(id) < 0) out.aliases[key].push(id); });
        if (r.dict._explicitAliases && r.dict._explicitAliases[key]) {
          out._explicitAliases = out._explicitAliases || {};
          out._explicitAliases[key] = true;
        }
      });
    });
    out.format = 'v4';
    out.categories = cats;
    return {
      ok: true,
      source: emit({ dict: out, categories: cats }),
      diagnostics: (a.diagnostics || []).concat(b.diagnostics || []),
    };
  }

  /* 自动英文化：按绑定取英文名；英文码优先小型内置码表，避免多个私有节点撞同一个概念码 */
  function backfillEnglish(dict, system) {
    const sys = system || TV.systemDict;
    const nodes = (sys && sys.nodes) || {};
    const list = Object.keys((dict && dict.nodes) || {})
      .map((id) => dict.nodes[id])
      .filter((n) => n && !n.system);
    const anchorCount = {};
    list.forEach((n) => { if (n.anchor_id) anchorCount[n.anchor_id] = (anchorCount[n.anchor_id] || 0) + 1; });
    const used = new Set();
    list.forEach((n) => {
      if (n.en_code && !n.en_code_auto) used.add(S(n.en_code).toLowerCase());
    });
    let filled = 0;
    let kept = 0;
    let unbound = 0;
    list.forEach((n) => {
      const target = n.anchor_id ? nodes[n.anchor_id] : null;
      if (!target) { unbound += 1; return; }
      let changed = false;
      if (!n.en_name || n.en_auto) {
        n.en_name = target.en_name || n.zh_name;
        n.en_auto = false;
        changed = true;
      }
      if (!n.en_code || n.en_code_auto) {
        let base = hintEnCode(n.zh_name)
          || (anchorCount[n.anchor_id] === 1 ? (target.en_code || '') : '')
          || n.zh_code
          || n.en_name
          || n.zh_name
          || 'x';
        base = S(base).toLowerCase().replace(/[^a-z0-9_]/g, '') || 'x';
        let code = base;
        let i = 2;
        while (used.has(code)) { code = base + i; i += 1; }
        used.add(code);
        n.en_code = code;
        n.en_code_auto = false;
        changed = true;
      } else {
        used.add(S(n.en_code).toLowerCase());
      }
      if (changed) filled += 1;
      else kept += 1;
    });
    return { filled, kept, unbound };
  }

  TV.dictV4 = {
    parse, emit, detect, TYPE_EN, sectionOf, fieldsOf,
    categoriesOf, ensureCategory, placeNode, setCategoryAnchor, renameCategory, removeCategory, reanchorNodes,
    fromV3, placementForTarget, setNodeAnchor,
    siblingSuggestions, validateBindings, pathNames,
    splitByDomain, mergeSides, backfillEnglish,
  };
  if (typeof module === 'object' && module.exports) module.exports = TV.dictV4;
})(typeof globalThis !== 'undefined' ? globalThis : this);
