/* TxtVein · 面板：规则 / 字典 / 文本 / 导入导出 / 帮助 / 密码
 * 所有面板都只读 app.getState()，写操作调用 app 的方法；不直接碰核心数据。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;
  const amount = TV.amount;
  const dictMod = TV.dict;
  const dateMod = TV.date;
  const rulesMod = TV.rules;

  const PREFS_KEY = 'txtvein.prefs.v1';
  const COLOR_DEFS = [
    ['invalid', '无效/未识别', '--tv-invalid', '#B9C2CE'],
    ['linenumber', '行号', '--tv-linenumber', '#8f8f8f'],
    ['lineerror', '问题行号', '--tv-lineerror', '#ff7a45'],
    ['date', '日期', '--tv-date', '#DCDCAA'],
    ['node', '节点', '--tv-node', '#9CDCFE'],
    ['operator', '运算符', '--tv-operator', '#D4D4D4'],
    ['amount', '金额', '--tv-amount', '#B5CEA8'],
    ['note', '备注', '--tv-note', '#6A9955'],
  ];
  const DEFAULT_PREFS = {
    colors: COLOR_DEFS.reduce((m, x) => { m[x[0]] = x[3]; return m; }, {}),
    fontSize: 13,
  };

  function loadPrefs() {
    const out = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (p && p.colors) Object.keys(out.colors).forEach((k) => { if (p.colors[k]) out.colors[k] = p.colors[k]; });
      if (p && Number(p.fontSize)) out.fontSize = Math.max(11, Math.min(22, Number(p.fontSize)));
    } catch (e) { /* ignore */ }
    return out;
  }

  function applyPrefs(p) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    COLOR_DEFS.forEach((x) => root.style.setProperty(x[2], p.colors[x[0]] || x[3]));
    root.style.setProperty('--tv-editor-font-size', p.fontSize + 'px');
  }

  function savePrefs(p) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
    applyPrefs(p);
  }

  applyPrefs(loadPrefs());

  function create(ui) {
    const modal = ui.modal;
    const titleEl = ui.title;
    const bodyEl = ui.body;
    const footEl = ui.foot;
    const closeBtn = ui.close;
    const toastEl = ui.toast;
    const toastText = ui.toastText;
    const toastAction = ui.toastAction;

    let toastTimer = 0;
    let motherSel = '';
    let motherSelCode = '';

    function open(title, body, foot) {
      titleEl.textContent = title;
      clear(bodyEl);
      clear(footEl);
      (Array.isArray(body) ? body : [body]).forEach((n) => n && bodyEl.appendChild(n));
      (Array.isArray(foot) ? foot : foot ? [foot] : []).forEach((n) => n && footEl.appendChild(n));
      modal.hidden = false;
      bodyEl.scrollTop = 0;
      setTimeout(() => {
        const first = bodyEl.querySelector('input, select, textarea, button');
        if (first && ui.autofocus !== false) first.focus();
      }, 30);
    }

    function close() {
      modal.hidden = true;
      clear(bodyEl);
      clear(footEl);
    }

    closeBtn.addEventListener('click', close);
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) {
        const panel = bodyEl.querySelector('[data-escape-stop]');
        if (panel) return;
        close();
      }
    });

    function toast(msg, type, action) {
      toastText.textContent = msg || '';
      toastEl.hidden = false;
      toastEl.classList.toggle('is-error', type === 'error');
      toastEl.classList.toggle('is-ok', type === 'ok');
      clearTimeout(toastTimer);
      if (action && action.label) {
        toastAction.hidden = false;
        toastAction.textContent = action.label;
        toastAction.onclick = () => {
          toastAction.hidden = true;
          action.fn && action.fn();
        };
      } else {
        toastAction.hidden = true;
        toastAction.onclick = null;
      }
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, action ? 6500 : 3200);
    }

    function section(title, children, note) {
      return el('section', { class: 'panel-section' }, [
        el('h3', {}, [title, note ? el('span', {}, [note]) : null]),
        ...(Array.isArray(children) ? children : [children]),
      ]);
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [
        el('label', {}, [label]),
        input,
      ]);
    }

    function input(opts) {
      return el('input', Object.assign({ class: 'input', type: 'text', autocomplete: 'off', spellcheck: 'false' }, opts || {}));
    }

    function select(options, value) {
      const s = el('select', { class: 'select' });
      (options || []).forEach((o) => {
        const opt = el('option', { value: o.value }, [o.label]);
        if (String(o.value) === String(value)) opt.selected = true;
        s.appendChild(opt);
      });
      return s;
    }

    function button(label, cls, fn) {
      const b = el('button', { class: 'btn ' + (cls || ''), type: 'button' }, [label]);
      b.addEventListener('click', fn);
      return b;
    }

    function mini(label, cls, fn) {
      const b = el('button', { class: 'mini-btn ' + (cls || ''), type: 'button' }, [label]);
      b.addEventListener('click', fn);
      return b;
    }

    function closeFoot(extra) {
      return el('div', { class: 'row-gap' }, [
        ...(extra || []),
        button('关闭', 'btn-ghost', close),
      ]);
    }

    /* ---------------- 规则 ---------------- */

    function showRules(app) {
      const s = app.getState();
      const plansActive = s.plans.filter((p) => p.status === 'active');
      const plansOff = s.plans.filter((p) => p.status !== 'active');
      const planCard = (p) => {
        const from = dictMod.renderNode(s.dict, p.from, s.mode, s.lang);
        const to = dictMod.renderNode(s.dict, p.to, s.mode, s.lang);
        const tags = (p.tagIds || []).map((id) => dictMod.renderTag(s.dict, id, s.mode, s.lang)).filter(Boolean);
        const due = rulesMod.nextDue(p, new Date());
        return el('div', { class: 'plan-card' + (p.status !== 'active' ? ' is-canceled' : '') }, [
          el('div', { class: 'plan-top' }, [
            el('span', { class: 'plan-id' }, [p.id]),
            el('span', { class: 'plan-status' + (p.status !== 'active' ? ' is-off' : '') }, [p.status === 'active' ? 'ACTIVE' : 'CANCELED']),
            el('span', { class: 'plan-meta' }, [
              '从 ' + (p.start || '—') + ' 起',
              p.lastRun ? '上次 ' + p.lastRun : '未执行',
              due ? '下次 ' + due : '不再生成',
            ]),
          ]),
          el('div', { class: 'plan-text' }, [
            from + ' > ' + to + '  ' + amount.formatPlain(p.amountCents)
              + '  *' + p.period + (tags.length ? '  < ' + tags.join(' < ') : ''),
          ]),
          el('div', { class: 'plan-actions' }, [
            p.status === 'active'
              ? mini('取消未来', 'is-danger', () => {
                app.cancelPlan(p.id);
                toast('已取消 ' + p.id + '；历史流水未动', 'ok');
                showRules(app);
              })
              : mini('恢复', 'is-accent', () => {
                app.resumePlan(p.id);
                toast('已恢复 ' + p.id, 'ok');
                showRules(app);
              }),
            mini('删除规则', '', () => {
              confirm(app, '删除规则', '删除 ' + p.id + '？只删规则，不删已经生成的流水。', () => {
                app.deletePlan(p.id);
                toast('已删除规则 ' + p.id, 'ok');
                showRules(app);
              });
            }),
          ]),
        ]);
      };

      const ruleCard = (r) => {
        const from = dictMod.renderNode(s.dict, r.from, s.mode, s.lang);
        const to = dictMod.renderNode(s.dict, r.to, s.mode, s.lang);
        return el('div', { class: 'rule-card' }, [
          el('div', { class: 'rule-top' }, [
            el('span', { class: 'rule-id' }, [r.id]),
            el('span', { class: 'rule-status' + (r.status !== 'active' ? ' is-off' : '') }, [r.status === 'active' ? 'ACTIVE' : 'OFF']),
            el('span', { class: 'rule-meta' }, [
              '关键字 ' + (r.keywords || []).join(' / '),
              r.amountOp ? '金额 ' + r.amountOp + ' ' + amount.centsToDisplay(r.amountCents) : '',
            ]),
          ]),
          el('div', { class: 'rule-text' }, [from + ' > ' + to + '  ' + (r.name || '')]),
          el('div', { class: 'rule-actions' }, [
            mini('删除规则', 'is-danger', () => {
              confirm(app, '删除事件规则', '删除 ' + r.id + '？只删除预测模板，不改历史流水。', () => {
                app.deleteRule(r.id);
                toast('已删除规则 ' + r.id, 'ok');
                showRules(app);
              });
            }),
          ]),
        ]);
      };

      const body = [
        section('周期规则 · PLAN', plansActive.length || plansOff.length
          ? plansActive.concat(plansOff).map(planCard)
          : el('div', { class: 'import-note' }, ['还没有周期规则。录入 微信 > 房租 1000*m 即可挂一条。']),
          plansActive.length + ' active / ' + plansOff.length + ' canceled'),
        section('事件规则 · RULES', s.rules.length
          ? s.rules.map(ruleCard)
          : el('div', { class: 'import-note' }, ['还没有事件规则。可以在这里理解预测式录入的模板结构。']),
          s.rules.length + ' 条'),
      ];
      open('规则引擎', body, closeFoot([
        el('span', { class: 'help-text' }, ['取消只改状态；历史流水一行不动。']),
      ]));
    }

    /* ---------------- 字典 ---------------- */

    function showDict(app, tab, query) {
      const s = app.getState();
      const q = String(query || '');
      const current = tab || 'nodes';
      const v4 = !!(s.dict && s.dict.format === 'v4' && TV.dictV4);
      const tabs = el('div', { class: 'panel-tabs' }, [
        tabBtn('节点 · NODES', 'nodes', current),
        tabBtn('标签 · TAGS', 'tags', current),
        v4 ? tabBtn('统计分类 · CAT', 'cats', current) : null,
      ].filter(Boolean));
      function tabBtn(label, key, active) {
        const b = el('button', { class: 'panel-tab' + (key === active ? ' is-active' : ''), type: 'button' }, [label]);
        b.addEventListener('click', () => showDict(app, key, q));
        return b;
      }

      const search = input({ class: 'input panel-search', placeholder: current === 'nodes' ? '搜索名字 / 简码' : current === 'cats' ? '搜索统计分类' : '搜索标签', value: q });
      search.addEventListener('input', () => {
        const val = search.value;
        clearTimeout(search._t);
        search._t = setTimeout(() => showDict(app, current, val), 180);
      });

      const addBtn = button(current === 'nodes' ? '+ 新建节点' : current === 'cats' ? '+ 新建统计分类' : '+ 新建标签', 'btn-primary', () => {
        if (current === 'nodes') nodeForm(app);
        else if (current === 'cats') categoryForm(app);
        else tagForm(app);
      });

      const toolbar = el('div', { class: 'panel-toolbar' }, [
        search, el('span', { class: 'grow' }),
        v4 ? button('补英文', '', () => {
          const st = app.getState();
          const r = TV.dictV4.backfillEnglish(st.dict, TV.systemDict);
          if (!r.filled) {
            toast('没有可补：已填写 ' + r.kept + ' 个，未绑定跳过 ' + r.unbound + ' 个', 'ok');
            return;
          }
          app.syncDict();
          toast('已补英文 ' + r.filled + ' 个节点' + (r.unbound ? '；未绑定跳过 ' + r.unbound + ' 个' : ''), 'ok');
        }) : null,
        v4 ? button('校验', '', () => validateDict(app)) : null,
        v4 ? button('+ 从母树', '', () => motherPicker(app, '')) : null,
        addBtn,
      ].filter(Boolean));

      let list;
      if (current === 'nodes') list = nodeList(app, q);
      else if (current === 'cats') list = categoryList(app, q);
      else list = tagList(app, q);

      open('字典 · ' + (current === 'nodes' ? '节点' : current === 'cats' ? '统计分类' : '标签'), [tabs, toolbar, list], closeFoot([
        el('span', { class: 'help-text' }, [v4
          ? '三级：会计类型 → 统计分类 → 节点；归属（母树）只挂在统计分类上。'
          : '流水只存 ID；改名只改这里，历史不断链。']),
      ]));
    }

    function shortPathOf(id) {
      const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
      const chain = [];
      let cur = id;
      let guard = 0;
      while (cur && nodes[cur] && guard < 64) { chain.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
      return chain.filter((x) => nodes[x].kind !== 'root' && nodes[x].kind !== 'type').map((x) => nodes[x].zh_name).join(' / ');
    }

    function motherNodesOf(type) {
      const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
      const typeId = Object.keys(nodes).find((id) => nodes[id].kind === 'type' && (nodes[id].type === type || nodes[id].zh_name === type));
      if (!typeId) return [];
      const out = [];
      Object.keys(nodes).forEach((id) => {
        if (id === typeId) return;
        let cur = nodes[id].parent_id;
        let guard = 0;
        while (cur && guard < 64) {
          if (cur === typeId) { out.push(id); return; }
          cur = nodes[cur] && nodes[cur].parent_id;
          guard += 1;
        }
      });
      return out;
    }

    function validateDict(app) {
      const s = app.getState();
      const issues = TV.dictV4.validateBindings(s.dict, TV.systemDict);
      if (!issues.length) {
        toast('绑定检查通过：没有未绑定 / 失效 / 可疑项', 'ok');
        return;
      }
      const counts = issues.reduce((m, x) => { m[x.code] = (m[x.code] || 0) + 1; return m; }, {});
      const body = el('div', { class: 'dict-list' }, [
        el('div', { class: 'dict-row is-head' }, [
          el('span', {}, ['节点']), el('span', {}, ['问题']), el('span', {}, ['操作']),
        ]),
      ]);
      issues.slice(0, 80).forEach((it) => {
        const n = s.dict.nodes[it.id] || {};
        body.appendChild(el('div', { class: 'dict-row' }, [
          el('span', { class: 'dict-name' }, [n.zh_name || it.id]),
          el('span', { class: 'dict-dim', style: 'grid-column: span 2; white-space: normal' }, [it.message]),
          el('span', { class: 'dict-actions' }, [mini('编辑', '', () => nodeForm(app, null, it.id))]),
        ]));
      });
      const summary = Object.keys(counts).map((k) => k + ' ' + counts[k]).join(' · ');
      open('绑定校验 · ' + issues.length + ' 项', [
        el('p', { class: 'help-text' }, ['只做确定性检查：未绑定、失效、类型不一致、名字更像另一支。母树只是先验框架，最终以你的绑定为准。', ' ', summary]),
        body,
      ], closeFoot([button('关闭', '', close)]));
    }

    function categoryList(app, q) {
      const s = app.getState();
      const needle = String(q || '').toLowerCase();
      const cats = (s.dict.categories || []).slice()
        .filter((c) => !needle || (c.name + ' ' + (c.en_name || '') + ' ' + c.type).toLowerCase().indexOf(needle) >= 0)
        .sort((a, b) => String(a.type).localeCompare(String(b.type), 'zh') || (a.order || 0) - (b.order || 0));
      if (!cats.length) return el('div', { class: 'import-note' }, ['还没有统计分类。点右上角新建。']);
      const counts = {};
      const bound = {};
      Object.keys(s.dict.nodes || {}).forEach((id) => {
        const n = s.dict.nodes[id];
        if (n.system) return;
        const k = n.category_key || '';
        counts[k] = (counts[k] || 0) + 1;
        if (n.anchor_id) bound[k] = (bound[k] || 0) + 1;
      });
      const list = el('div', { class: 'dict-list' }, [
        el('div', { class: 'dict-row is-head' }, [
          el('span', {}, ['统计分类']), el('span', {}, ['会计类型']), el('span', {}, ['节点']),
          el('span', {}, ['已绑定']), el('span', {}, ['操作']),
        ]),
      ]);
      cats.forEach((c) => {
        list.appendChild(el('div', { class: 'dict-row' }, [
          el('span', { class: 'dict-name' }, [c.name, c.en_name && !c.en_auto ? el('i', {}, [c.en_name]) : null]),
          el('span', { class: 'dict-dim' }, [c.type]),
          el('span', { class: 'dict-code' }, [String(counts[c.key] || 0)]),
          el('span', { class: 'dict-dim' }, [String(bound[c.key] || 0)]),
          el('span', { class: 'dict-actions' }, [
            mini('编辑', '', () => categoryForm(app, c.key)),
            mini('删除', 'is-danger', () => {
              const n = counts[c.key] || 0;
              confirm(app, '删除统计分类', '删除「' + c.name + '」？它的 ' + n + ' 个节点会变成未分类。', () => {
                const r = app.deleteCategory(c.key);
                if (r.ok) { toast('已删除统计分类', 'ok'); showDict(app, 'cats', q); } else toast(r.error, 'error');
              });
            }),
          ]),
        ]));
      });
      return list;
    }

    function categoryForm(app, key) {
      const s = app.getState();
      const cat = key ? (s.dict.categories || []).find((c) => c.key === key) : null;
      const typeSel = select(dictMod.TYPE_ALL.map((t) => ({ value: t, label: t + ' · ' + dictMod.TYPES[t].pole + ' 极' })), cat ? cat.type : '费用');
      if (cat) typeSel.disabled = true;
      const name = input({ value: cat ? cat.name : '', placeholder: '如：餐饮 / 通勤' });
      const enName = input({ value: cat && !cat.en_auto ? cat.en_name : '', placeholder: '可留空' });
      const error = el('div', { class: 'form-error' });
      const submit = button(cat ? '保存修改' : '创建统计分类', 'btn-primary', () => {
        if (!name.value.trim()) { error.textContent = '统计分类要有名称'; return; }
        const r = cat
          ? app.updateCategory(key, { name: name.value.trim(), en_name: enName.value.trim() })
          : app.addCategory({ name: name.value.trim(), type: typeSel.value, en_name: enName.value.trim() });
        if (!r.ok) { error.textContent = r.error; return; }
        toast(cat ? '已保存统计分类' : '已创建统计分类', 'ok');
        close();
        showDict(app, 'cats', '');
      });
      const actions = [];
      if (!cat) actions.push(submit);
      else {
        actions.push(button('删除', 'is-danger', () => {
          close();
          const n = Object.keys(s.dict.nodes || {}).filter((id) => !s.dict.nodes[id].system && s.dict.nodes[id].category_key === key).length;
          confirm(app, '删除统计分类', '删除「' + cat.name + '」？它的 ' + n + ' 个节点会变成未分类。', () => {
            const r = app.deleteCategory(key);
            if (r.ok) { toast('已删除统计分类', 'ok'); showDict(app, 'cats', ''); } else toast(r.error, 'error');
          });
        }));
        actions.push(submit);
      }
      open(cat ? '编辑统计分类 · ' + cat.name : '新建统计分类', [
        el('div', { class: 'form-row' }, [field('名称', name), field('会计类型', typeSel)]),
        field('英文名（可选）', enName),
        error,
        el('p', { class: 'help-text' }, ['统计分类只是你的分组；母树绑定在节点的编辑卡里选，固定在该节点上。']),
      ], closeFoot(actions));
    }

    function nodeTreeRow(app, x, depth, calc) {
      const n = x.n;
      const stat = calc.byId.get(x.id);
      const bal = stat ? stat.closing : 0;
      const row = el('div', { class: 'dict-tree-row', style: 'padding-left:' + (8 + depth * 18) + 'px' }, [
        el('span', { class: 'dict-tree-name' }, [n.zh_name]),
        el('span', { class: 'dict-code' }, [n.zh_code || '—']),
        el('span', { class: 'dict-tree-meta' }, [n.anchor_id ? shortPathOf(n.anchor_id) : '未归类']),
        el('span', { class: 'dict-code' }, [amount.centsToDisplay(bal)]),
        el('span', { class: 'dict-actions' }, [
          mini('编辑', '', () => nodeForm(app, null, x.id)),
          mini('删除', 'is-danger', () => {
            const used = app.countNodeRefs(x.id);
            if (used > 0) { toast('该节点被 ' + used + ' 笔流水引用，不能删；可改名', 'error'); return; }
            confirm(app, '删除节点', '删除「' + n.zh_name + '」？', () => {
              const r = app.deleteNode(x.id);
              if (r.ok) { toast('已删除节点', 'ok'); showDict(app, 'nodes', ''); } else toast(r.error, 'error');
            });
          }),
        ]),
      ]);
      return row;
    }

    function nodeTreeV4(app, q) {
      const s = app.getState();
      const calc = app.getCalcAll();
      const needle = String(q || '').toLowerCase();
      const all = Object.keys(s.dict.nodes)
        .map((id) => ({ id, n: s.dict.nodes[id] }))
        .filter((x) => !x.n.system);
      const hit = (x) => !needle || (x.n.zh_name + ' ' + x.n.zh_code + ' ' + x.n.en_name + ' ' + (x.n.category || '')).toLowerCase().indexOf(needle) >= 0;
      const cats = (s.dict.categories || []).slice();
      const typeOrder = ['费用', '收入', '资产', '负债', '成本', '权益'];
      const wrap = el('div', { class: 'dict-list' });
      typeOrder.forEach((type) => {
        const tNodes = all.filter((x) => x.n.type === type);
        if (!tNodes.length) return;
        wrap.appendChild(el('div', { class: 'dict-tree-head' }, [
          el('span', {}, [type]), el('span', {}, ['简码']), el('span', {}, ['归属']),
          el('span', {}, ['余额']), el('span', {}, ['操作']),
        ]));
        const typeCats = cats.filter((c) => c.type === type).sort((a, b) => (a.order || 0) - (b.order || 0));
        typeCats.forEach((c) => {
          const kids = tNodes.filter((x) => x.n.category_key === c.key);
          const shown = kids.filter(hit);
          if (!shown.length && needle) return;
          wrap.appendChild(el('div', { class: 'dict-tree-cat' }, [
            el('span', { class: 'dict-tree-name' }, ['▾ ' + c.name]),
            el('span', { class: 'dict-tree-meta' }, ['分类']),
            el('span', { class: 'dict-tree-meta' }, ['绑定 ' + kids.filter((x) => x.n.anchor_id).length + '/' + kids.length]),
            el('span', { class: 'dict-tree-count' }, [String(kids.length)]),
            el('span', { class: 'dict-actions' }, [
              mini('编辑分类', '', () => categoryForm(app, c.key)),
            ]),
          ]));
          shown.sort((a, b) => a.n.zh_name.localeCompare(b.n.zh_name, 'zh'))
            .forEach((x) => wrap.appendChild(nodeTreeRow(app, x, 1, calc)));
        });
        const orphans = tNodes.filter((x) => !cats.some((c) => c.key === x.n.category_key) && hit(x));
        if (orphans.length) {
          wrap.appendChild(el('div', { class: 'dict-tree-cat' }, [
            el('span', { class: 'dict-tree-name' }, ['▾ 未分类']),
            el('span', { class: 'dict-tree-meta' }, ['分类']),
            el('span', { class: 'dict-tree-meta' }, ['没有统计分类']),
            el('span', { class: 'dict-tree-count' }, [String(orphans.length)]),
            el('span', {}, ['']),
          ]));
          orphans.forEach((x) => wrap.appendChild(nodeTreeRow(app, x, 1, calc)));
        }
      });
      if (!wrap.children.length) return el('div', { class: 'import-note' }, ['没有匹配的节点。']);
      return wrap;
    }

    function nodeList(app, q) {
      const s0 = app.getState();
      if (s0.dict && s0.dict.format === 'v4' && TV.dictV4) return nodeTreeV4(app, q);
      const s = app.getState();
      const calc = app.getCalcAll();
      const rows = Object.keys(s.dict.nodes)
        .map((id) => ({ id, node: s.dict.nodes[id], stat: calc.byId.get(id) }))
        .filter((x) => !q || (x.node.zh_name + x.node.en_name + x.node.zh_code + x.node.en_code).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (a.node.type || '').localeCompare(b.node.type || '') || (a.node.zh_name || '').localeCompare(b.node.zh_name || ''));
      if (!rows.length) return el('div', { class: 'import-note' }, ['没有匹配的节点。']);
      const list = el('div', { class: 'dict-list' }, [
        el('div', { class: 'dict-row is-head' }, [
          el('span', {}, ['名称']), el('span', {}, ['简码']), el('span', {}, ['类型']),
          el('span', {}, ['域']), el('span', {}, ['余额']), el('span', {}, ['操作']),
        ]),
      ]);
      rows.forEach((x) => {
        const n = x.node;
        const bal = x.stat ? x.stat.closing : 0;
        list.appendChild(el('div', { class: 'dict-row' }, [
          el('span', { class: 'dict-name' }, [
            n.zh_name,
            n.system ? el('i', {}, ['SYS']) : null,
            el('span', { class: 'pole-badge ' + (n.polarity === 'A' ? 'a' : 'b') }, [n.polarity]),
          ]),
          el('span', { class: 'dict-code' }, [n.zh_code || n.en_code || '—']),
          el('span', { class: 'dict-dim' }, [s.dict && s.dict.format === 'v4'
            ? n.type + ' / ' + (n.category || '未分类')
            : n.type + (n.form && n.form !== 'outside' ? ' · ' + (dictMod.FORMS[n.form] || n.form) : '')]),
          el('span', { class: 'dict-domain' }, [el('span', { class: 'domain-badge' }, [n.domain])]),
          el('span', { class: 'dict-code' }, [amount.centsToDisplay(bal)]),
          el('span', { class: 'dict-actions' }, [
            mini('编辑', '', () => nodeForm(app, null, x.id)),
            mini('删除', 'is-danger', () => {
              const used = app.countNodeRefs(x.id);
              if (used > 0) { toast('该节点被 ' + used + ' 笔流水引用，不能删；可改名', 'error'); return; }
              confirm(app, '删除节点', '删除「' + n.zh_name + '」？ID 作废，别名一并清理。', () => {
                const r = app.deleteNode(x.id);
                if (r.ok) { toast('已删除节点', 'ok'); showDict(app, 'nodes', q); } else toast(r.error, 'error');
              });
            }),
          ]),
        ]));
      });
      return list;
    }

    function tagList(app, q) {
      const s = app.getState();
      const rows = Object.keys(s.dict.tags)
        .map((id) => ({ id, tag: s.dict.tags[id] }))
        .filter((x) => !q || (x.tag.zh_name + x.tag.en_name + x.tag.zh_code).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (a.tag.kind || '').localeCompare(b.tag.kind || '') || (a.tag.zh_name || '').localeCompare(b.tag.zh_name || ''));
      if (!rows.length) return el('div', { class: 'import-note' }, ['没有匹配的标签。']);
      const list = el('div', { class: 'dict-list' }, [
        el('div', { class: 'dict-row is-head' }, [
          el('span', {}, ['名称']), el('span', {}, ['简码']), el('span', {}, ['类型']),
          el('span', {}, ['域']), el('span', {}, ['父级']), el('span', {}, ['操作']),
        ]),
      ]);
      rows.forEach((x) => {
        const t = x.tag;
        const parent = t.parent_id && s.dict.tags[t.parent_id] ? s.dict.tags[t.parent_id].zh_name : '—';
        list.appendChild(el('div', { class: 'dict-row' }, [
          el('span', { class: 'dict-name' }, [t.zh_name, el('span', { class: 'pole-badge ' + (t.kind === 'gain' ? 'a' : t.kind === 'suppress' ? 'b' : '') }, [t.kind || 'plain'])]),
          el('span', { class: 'dict-code' }, [t.zh_code || '—']),
          el('span', { class: 'dict-dim' }, [dictMod.KIND_TAG[t.kind] || t.kind || '普通']),
          el('span', { class: 'dict-domain' }, [el('span', { class: 'domain-badge' }, [t.domain])]),
          el('span', { class: 'dict-code' }, [parent]),
          el('span', { class: 'dict-actions' }, [
            mini('编辑', '', () => tagForm(app, null, x.id)),
            mini('删除', 'is-danger', () => {
              confirm(app, '删除标签', '删除「' + t.zh_name + '」？流水里的标签引用会保留 ID，但字典不再解析。', () => {
                const r = app.deleteTag(x.id);
                if (r.ok) { toast('已删除标签', 'ok'); showDict(app, 'tags', q); } else toast(r.error, 'error');
              });
            }),
          ]),
        ]));
      });
      return list;
    }

    function nodeFormV4(app, preset, id, opts) {
      const o = opts || {};
      const s = app.getState();
      const n = id ? s.dict.nodes[id] : null;
      const p = preset || {};
      const cats = (s.dict.categories || []).slice();
      if (!cats.length) {
        toast('还没有统计分类：先在字典里建一个统计分类', 'error');
        return;
      }
      const fallback = n && n.category_key && cats.some((c) => c.key === n.category_key) ? n.category_key : cats[0].key;
      const catSel = select(cats.map((c) => ({ value: c.key, label: c.type + ' / ' + c.name })), p.category_key || fallback);
      const sysNodes = (TV.systemDict && TV.systemDict.nodes) || {};
      const bindTargets = Object.keys(sysNodes).filter((id) => sysNodes[id].kind === 'category');
      const bindLabel = (id) => {
        const eff = TV.systemDictCore ? TV.systemDictCore.effectiveType(sysNodes, id) : null;
        return (eff ? eff.type + ' / ' : '') + (shortPathOf(id) || id);
      };
      const bindSel = select([{ value: '', label: '（不绑定）' }].concat(bindTargets.map((id) => ({
        value: id, label: bindLabel(id),
      }))), n ? (n.anchor_id || '') : (p.anchor_id || ''));
      const zhName = input({ value: n ? n.zh_name : (p.zh_name || ''), placeholder: '如：招行储' });
      const zhCode = input({ value: n ? n.zh_code : (p.zh_code || ''), placeholder: 'ZHC' });
      const enName = input({ value: n && !n.en_auto ? n.en_name : '', placeholder: '可留空（英文界面回退中文）' });
      const enCode = input({ value: n && !n.en_code_auto ? n.en_code : '', placeholder: '可留空（默认中码小写）' });
      const domain = select(dictMod.DOMAIN_ORDER.map((d) => ({ value: d, label: d + ' · ' + dictMod.DOMAINS[d].zh })), n ? n.domain : (p.domain || s.domain));
      const error = el('div', { class: 'form-error' });
      const submit = button(id ? '保存修改' : '创建节点', 'btn-primary', () => {
        const spec = {
          zh_name: zhName.value.trim(),
          en_name: enName.value.trim(),
          zh_code: zhCode.value.trim(),
          en_code: enCode.value.trim(),
          domain: domain.value,
          category_key: catSel.value,
          anchor_id: bindSel.value,
        };
        if (!spec.zh_name) { error.textContent = '节点要有名称'; return; }
        if (!spec.zh_code) { error.textContent = '节点要有简码'; return; }
        const r = id ? app.updateNode(id, spec) : app.addNode(spec);
        if (!r.ok) { error.textContent = r.error; return; }
        toast(id ? '已保存节点（ID 不变，历史不断链）' : '已创建节点 ' + r.id, 'ok');
        close();
        app.afterDataChange();
        if (o.reopen === false) {
          if (TV.inputApi) TV.inputApi.focus();
        } else {
          showDict(app, 'nodes', '');
        }
      });
      open(id ? '编辑节点 · ' + n.zh_name : '新建节点', [
        el('div', { class: 'form-row' }, [field('名称', zhName), field('简码', zhCode)]),
        el('div', { class: 'form-row' }, [field('英文名（可选）', enName), field('英文简码（可选）', enCode)]),
        el('div', { class: 'form-row' }, [field('统计分类', catSel), field('域', domain)]),
        field('母树绑定（固定）', bindSel),
        error,
        el('p', { class: 'help-text' }, ['母树只提供先验框架；账本运算与统计以本地分组/类型为准。绑定固定在这个节点上（分支或叶子），只影响公共归属。']),
      ], closeFoot([submit]));
    }

    function nodeForm(app, preset, id, opts) {
      const s0 = app.getState();
      if (s0.dict && s0.dict.format === 'v4' && TV.dictV4) { nodeFormV4(app, preset, id, opts); return; }
      const o = opts || {};
      const s = app.getState();
      const n = id ? s.dict.nodes[id] : null;
      const p = preset || {};
      const zhName = input({ value: n ? n.zh_name : (p.zh_name || ''), placeholder: '如：微信钱包' });
      const enName = input({ value: n ? n.en_name : (p.en_name || ''), placeholder: 'WeChat Wallet' });
      const zhCode = input({ value: n ? n.zh_code : (p.zh_code || ''), placeholder: 'wx' });
      const enCode = input({ value: n ? n.en_code : (p.en_code || ''), placeholder: 'wc' });
      const type = select(dictMod.TYPE_ALL.map((t) => ({ value: t, label: t + ' · ' + dictMod.TYPES[t].pole + ' 极' })), n ? n.type : (p.type || '资产'));
      const form = select(Object.keys(dictMod.FORMS).map((f) => ({ value: f, label: dictMod.FORMS[f] })), n ? n.form : (p.form || 'fluid'));
      const domain = select(dictMod.DOMAIN_ORDER.map((d) => ({ value: d, label: d + ' · ' + dictMod.DOMAINS[d].zh })), n ? n.domain : (p.domain || s.domain));
      const parent = select([{ value: '', label: '（无）' }].concat(Object.keys(s.dict.nodes)
        .filter((k) => k !== id)
        .map((k) => ({ value: k, label: s.dict.nodes[k].zh_name }))), n ? n.parent_id : '');
      const weight = input({ type: 'number', value: n ? n.weight : 100, min: '0', max: '1000' });
      const sort = input({ type: 'number', value: n ? n.sort : 100, min: '0', max: '100000' });
      const pin = select([{ value: '0', label: '否' }, { value: '1', label: '是' }], n && n.pin ? '1' : '0');
      const systemLeaves = Object.keys((TV.systemDict && TV.systemDict.nodes) || {})
        .filter((sid) => TV.systemDictCore && TV.systemDictCore.isPostable(TV.systemDict.nodes, sid))
        .map((sid) => ({
          value: sid,
          label: (TV.systemDictCore.pathLabel(TV.systemDict.nodes, sid, s.lang) || sid)
            + '  ·  ' + (TV.systemDict.nodes[sid].zh_code || ''),
        }));
      const anchor = select([{ value: '', label: '（未归类）' }].concat(systemLeaves), n ? (n.anchor_id || '') : '');
      const suggestBox = el('div', { class: 'suggest-box' });
      const suggestBtn = mini('建议归属', '', () => {
        const list = TV.suggester ? TV.suggester.suggestForSpec(s.dict, {
          id: id || '',
          zh_name: zhName.value.trim(),
          en_name: enName.value.trim(),
          zh_code: zhCode.value.trim(),
          en_code: enCode.value.trim(),
          type: type.value,
          parent_id: parent.value,
          anchor_id: anchor.value,
        }, TV.systemDict, { limit: 5, lang: s.lang }) : [];
        clear(suggestBox);
        if (!list.length) {
          suggestBox.appendChild(el('span', { class: 'suggest-empty' }, ['没有匹配建议；可手动选择或保持未归类。']));
          return;
        }
        list.forEach((x) => {
          const b = el('button', { class: 'suggest-item', type: 'button' }, [
            el('b', {}, [x.path || x.id]),
            el('span', {}, [x.reason + ' · ' + x.score]),
          ]);
          b.addEventListener('click', () => {
            anchor.value = x.id;
            suggestBox.appendChild(el('span', { class: 'suggest-picked' }, ['已填入选择，保存后才写入。']));
          });
          suggestBox.appendChild(b);
        });
      });
      const error = el('div', { class: 'form-error' });

      function syncForm() {
        const t = dictMod.normalizeType(type.value);
        form.disabled = !t.ok || t.pole === 'B';
        if (t.pole === 'B') form.value = 'outside';
        else if (form.value === 'outside') form.value = t.form || 'fluid';
        error.textContent = '';
      }
      type.addEventListener('change', syncForm);
      syncForm();

      const submit = button(id ? '保存修改' : '创建节点', 'btn-primary', () => {
        const spec = {
          zh_name: zhName.value.trim(),
          en_name: enName.value.trim(),
          zh_code: zhCode.value.trim(),
          en_code: enCode.value.trim(),
          type: type.value,
          form: form.value,
          domain: domain.value,
          parent_id: parent.value,
          weight: Number(weight.value),
          sort: Number(sort.value),
          pin: Number(pin.value),
          anchor_id: anchor.value,
        };
        if (!spec.zh_name && !spec.en_name) { error.textContent = '节点要有名字'; return; }
        const r = id ? app.updateNode(id, spec) : app.addNode(spec);
        if (!r.ok) { error.textContent = r.error; return; }
        toast(id ? '已保存节点（ID 不变，历史不断链）' : '已创建节点 ' + r.id, 'ok');
        close();
        app.afterDataChange();
        if (o.reopen === false) {
          if (TV.inputApi) TV.inputApi.focus();
        } else {
          showDict(app, 'nodes', '');
        }
      });

      open(id ? '编辑节点 · ' + n.zh_name : '新建节点', [
        el('div', { class: 'form-row' }, [field('中文名', zhName), field('英文名', enName)]),
        el('div', { class: 'form-row' }, [field('中文简码', zhCode), field('英文简码', enCode)]),
        el('div', { class: 'form-row-3' }, [field('大类', type), field('A 极形态', form), field('域', domain)]),
        el('div', { class: 'form-row-3' }, [field('权重', weight), field('排序', sort), field('置顶', pin)]),
        field('父节点（可选）', parent),
        field('公共归属（可选）', el('div', { class: 'anchor-pick' }, [
          el('div', { class: 'anchor-row' }, [anchor, suggestBtn]),
          suggestBox,
        ])),
        error,
        el('p', { class: 'help-text' }, ['极性由大类决定：资产/费用/成本 = A，负债/收入/权益 = B。流水只存 ID。']),
      ], closeFoot([submit]));
    }

    function tagForm(app, preset, id) {
      const s = app.getState();
      const t = id ? s.dict.tags[id] : null;
      const p = preset || {};
      const zhName = input({ value: t ? t.zh_name : (p.zh_name || ''), placeholder: '如：咖啡' });
      const enName = input({ value: t ? t.en_name : (p.en_name || ''), placeholder: 'Coffee' });
      const zhCode = input({ value: t ? t.zh_code : (p.zh_code || ''), placeholder: 'cof' });
      const domain = select(dictMod.DOMAIN_ORDER.map((d) => ({ value: d, label: d + ' · ' + dictMod.DOMAINS[d].zh })), t ? t.domain : (p.domain || s.domain));
      const parent = select([{ value: '', label: '（无 / 根标签）' }].concat(Object.keys(s.dict.tags)
        .filter((k) => k !== id)
        .map((k) => ({ value: k, label: s.dict.tags[k].zh_name }))), t ? t.parent_id : '');
      const kind = select(Object.keys(dictMod.KIND_TAG).map((k) => ({ value: k, label: dictMod.KIND_TAG[k] })), t ? t.kind : 'plain');
      const weight = input({ type: 'number', value: t ? t.weight : 10, min: '0', max: '1000' });
      const sort = input({ type: 'number', value: t ? t.sort : 100, min: '0', max: '100000' });
      const pin = select([{ value: '0', label: '否' }, { value: '1', label: '是' }], t && t.pin ? '1' : '0');
      const error = el('div', { class: 'form-error' });
      const submit = button(id ? '保存修改' : '创建标签', 'btn-primary', () => {
        const spec = {
          zh_name: zhName.value.trim(),
          en_name: enName.value.trim(),
          zh_code: zhCode.value.trim(),
          domain: domain.value,
          parent_id: parent.value,
          kind: kind.value,
          weight: Number(weight.value),
          sort: Number(sort.value),
          pin: Number(pin.value),
        };
        if (!spec.zh_name) { error.textContent = '标签要有名字'; return; }
        const r = id ? app.updateTag(id, spec) : app.addTag(spec);
        if (!r.ok) { error.textContent = r.error; return; }
        toast(id ? '已保存标签' : '已创建标签 ' + r.id, 'ok');
        close();
        app.afterDataChange();
        showDict(app, 'tags', '');
      });
      open(id ? '编辑标签 · ' + t.zh_name : '新建标签', [
        el('div', { class: 'form-row' }, [field('中文名', zhName), field('英文名', enName)]),
        el('div', { class: 'form-row-3' }, [field('简码', zhCode), field('域', domain), field('类型', kind)]),
        el('div', { class: 'form-row-3' }, [field('权重', weight), field('排序', sort), field('置顶', pin)]),
        field('父标签（可选）', parent),
        error,
        el('p', { class: 'help-text' }, ['标签是语义层；< 表达从属层级，空格表达同级。']),
      ], closeFoot([submit]));
    }

    /* ---------------- 文本 ---------------- */

    async function showText(app, tab) {
      const texts = await app.buildTexts();
      const current = tab || 'ledger';
      const tabs = el('div', { class: 'tab-bar' }, [
        textTab('ledger.txt', 'ledger'),
        textTab('dict.json', 'dict'),
      ]);
      function textTab(label, key) {
        const b = el('button', { class: current === key ? 'is-active' : '', type: 'button' }, [label]);
        b.addEventListener('click', () => showText(app, key));
        return b;
      }
      const text = current === 'ledger' ? texts.ledger : texts.dict;
      const meta = el('div', { class: 'text-meta' }, [
        el('span', {}, ['VAULT_ID ', el('b', {}, [texts.vaultId || '—'])]),
        el('span', {}, ['LINK ', el('b', {}, [(current === 'ledger' ? texts.dictHash : texts.ledgerHash || '').slice(0, 16) + '…'])]),
        el('span', {}, ['SHA-256 ', el('b', {}, [((current === 'ledger' ? texts.ledgerHash : texts.dictHash) || '').slice(0, 16) + '…'])]),
        el('span', {}, [text.length + ' 字符']),
      ]);
      const pre = el('pre', { class: 'text-pre' }, [text]);
      const toolbar = el('div', { class: 'panel-toolbar' }, [
        button('复制', '', async () => {
          await TV.files.copyText(text);
          toast('已复制 ' + (current === 'ledger' ? 'ledger.txt' : 'dict.json'), 'ok');
        }),
        button('下载', '', () => {
          TV.files.downloadText(current === 'ledger' ? 'ledger.txt' : 'dict.json', text);
          toast('已下载', 'ok');
        }),
        el('span', { class: 'grow' }),
        el('span', { class: 'help-text' }, ['这是底层唯一事实源，含 ID。']),
      ]);
      open('底层纯文本', [tabs, meta, toolbar, pre], closeFoot());
    }

    /* ---------------- 导出 ---------------- */

    function showExport(app) {
      const out = el('textarea', {
        class: 'export-output',
        spellcheck: 'false',
        placeholder: '点一个生成按钮，文本框就显示那个文件的文本；点「复制」带走。',
      });
      const note = el('div', { class: 'import-note' });
      const cache = new Map();

      // 一次导出只生成一份快照：流水和字典必须来自同一次 buildTexts。
      // 否则 buildTexts 会更新 meta.updatedAt，两个文件各自生成会导致 LINK 指纹不匹配。
      async function pack(mode) {
        if (cache.has(mode)) return cache.get(mode);
        const r = await app.exportText(mode);
        if (!r.ok) { toast(r.error || '导出失败', 'error'); return null; }
        cache.set(mode, r);
        return r;
      }

      async function gen(mode, part) {
        try {
          const r = await pack(mode);
          if (!r) return;
          const f = mode === 'single' ? { text: r.text, name: '明文单文件' }
            : (part === 'dict' ? r.files[1] : r.files[0]);
          out.value = f.text;
          out.scrollTop = 0;
          note.className = 'import-note';
          note.textContent = '已生成 ' + f.name + ' · ' + f.text.length + ' 字符。点「复制」带走。';
        } catch (e) {
          toast(e.message || '导出失败', 'error');
        }
      }

      async function dl(mode, part) {
        try {
          const r = await pack(mode);
          if (!r) return;
          if (mode === 'single') {
            const f = r.files[0] || { name: 'txtvein-export.txt', text: r.text };
            TV.files.downloadText(f.name, f.text, 'text/plain');
          } else {
            const f = part === 'dict' ? r.files[1] : r.files[0];
            TV.files.downloadText(f.name, f.text);
          }
          note.className = 'import-note';
          note.textContent = '已开始下载：' + (mode === 'single' ? '明文单文件'
            : (part === 'dict' ? '字典密文' : '流水密文'));
          toast('已开始下载', 'ok');
        } catch (e) {
          toast(e.message || '下载失败', 'error');
        }
      }

      async function copy() {
        if (!out.value) { toast('先生成文本', 'error'); return; }
        let ok = false;
        try { ok = await TV.files.copyText(out.value); } catch (e) { ok = false; }
        if (!ok) {
          out.focus();
          out.select();
          if (out.setSelectionRange) out.setSelectionRange(0, out.value.length);
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        }
        note.className = 'import-note ' + (ok ? 'is-ok' : 'is-bad');
        note.textContent = ok ? '已复制 ' + out.value.length + ' 个字符。' : '复制失败：请长按文本框，全选后复制。';
        if (ok) toast('已复制', 'ok');
      }

      open('导出', [
        el('div', { class: 'panel-section' }, [
          el('h3', {}, ['导出文件']),
          el('div', { class: 'row-gap' }, [button('导出明文', '', () => dl('single'))]),
          el('div', { class: 'row-gap', style: 'margin-top:6px' }, [
            button('导出初级流水密文', '', () => dl('shadow', 'ledger')),
            button('导出初级字典密文', '', () => dl('shadow', 'dict')),
          ]),
          el('div', { class: 'row-gap', style: 'margin-top:6px' }, [
            button('导出深度流水密文', '', () => dl('deep', 'ledger')),
            button('导出深度字典密文', 'btn-primary', () => dl('deep', 'dict')),
          ]),
        ]),
        el('div', { class: 'panel-section' }, [
          el('h3', {}, ['复制内容']),
          el('div', { class: 'row-gap', style: 'margin-bottom:6px' }, [
            button('生成明文', '', () => gen('single')),
          ]),
          el('div', { class: 'row-gap', style: 'margin-bottom:6px' }, [
            button('生成初级流水密文', '', () => gen('shadow', 'ledger')),
            button('生成初级字典密文', '', () => gen('shadow', 'dict')),
          ]),
          el('div', { class: 'row-gap', style: 'margin-bottom:8px' }, [
            button('生成深度流水密文', '', () => gen('deep', 'ledger')),
            button('生成深度字典密文', '', () => gen('deep', 'dict')),
            button('复制', 'btn-primary', copy),
          ]),
          out,
          note,
        ]),
        el('div', { class: 'import-note' }, [
          '文本框只有一个：点哪个按钮，文本框就是哪个文件的文本，复制的也是它。',
          '密文按 TxtVein 的 PBKDF2 + AES-GCM 信封生成；流水和字典分别导出/复制。',
        ]),
      ], closeFoot());
    }

    function exportCard(app, mode, title, files, desc, output, note) {
      const gen = button('生成文本', mode === 'deep' ? 'btn-primary' : '', async () => {
        gen.disabled = true;
        gen.textContent = '生成中…';
        try {
          const r = await app.exportText(mode);
          if (!r.ok) { toast(r.error || '导出失败', 'error'); return; }
          output.value = r.text;
          note.className = 'import-note';
          note.textContent = '已生成 ' + files.join(' + ') + ' · ' + r.text.length + ' 字符；点「复制内容」带走。';
          output.scrollTop = 0;
        } catch (e) {
          toast(e.message || '导出失败', 'error');
        } finally {
          gen.disabled = false;
          gen.textContent = '生成文本';
        }
      });
      const dl = mini('下载', '', async () => {
        try {
          const r = await app.exportMode(mode);
          if (!r.ok) { toast(r.error || '导出失败', 'error'); return; }
          toast('已生成下载', 'ok');
        } catch (e) {
          toast(e.message || '导出失败', 'error');
        }
      });
      return el('div', { class: 'export-card' }, [
        el('h4', {}, [title]),
        el('p', {}, [desc]),
        el('div', { class: 'file-list-mini' }, [files.join('  +  ')]),
        el('div', { class: 'row-gap' }, [gen, dl]),
      ]);
    }

    /* ---------------- 导入 ---------------- */

    function showImport(app) {
      let result = null;
      const top = el('textarea', {
        class: 'import-textarea import-top cipher-import-ledger',
        spellcheck: 'false',
        placeholder: '粘贴单文本（TxtVein 单 TXT / NT 明文），或粘贴流水密文（ledger.shadow / ledger.enc）。',
      });
      const bottom = el('textarea', {
        class: 'import-textarea import-dict cipher-import-dict',
        spellcheck: 'false',
        placeholder: '粘贴字典密文（dict.vault / dict.enc）；单文本导入时留空。',
      });
      const note = el('div', { class: 'import-note' });
      const cipherNote = el('div', { class: 'import-note cipher-note' });
      const password = input({ type: 'password', placeholder: '密文密码（单文本留空）' });
      const force = el('input', { type: 'checkbox' });
      const forceWrap = el('label', { class: 'row-gap', style: 'font-size:11px;color:var(--dim)' }, [
        force, '指纹不匹配时仍然导入（不推荐）',
      ]);

      async function pasteTo(target, tag) {
        const clip = navigator.clipboard;
        if (!clip || typeof clip.readText !== 'function') {
          target.focus();
          note.className = 'import-note is-bad';
          note.textContent = '这个浏览器不能直接读剪贴板：长按框，用系统「粘贴」。';
          return;
        }
        try {
          const t = await clip.readText();
          if (!t || !t.trim()) { note.className = 'import-note is-bad'; note.textContent = '剪贴板里没有文字。'; return; }
          target.value = t;
          note.className = 'import-note';
          note.textContent = '已粘贴到' + tag + '，共 ' + t.length + ' 个字符。';
          refresh();
        } catch (e) {
          target.focus();
          note.className = 'import-note is-bad';
          note.textContent = '浏览器不让读剪贴板：长按框，用系统「粘贴」。';
        }
      }

      function refresh() {
        const t = top.value.trim();
        const d = bottom.value.trim();
        note.className = 'import-note';
        cipherNote.className = 'import-note cipher-note';
        if (d) {
          if (!t) {
            cipherNote.className = 'import-note cipher-note is-bad';
            cipherNote.textContent = '已经有字典密文，还缺流水密文。';
          } else {
            cipherNote.textContent = '流水、字典两份都齐了；输入密码后导入。';
          }
          password.parentElement.hidden = false;
          return;
        }
        if (!t) {
          note.textContent = '两个框：上面单文本或流水密文，下面字典密文。';
          password.parentElement.hidden = true;
          return;
        }
        const kind = TV.ntBridge.detect(t);
        if (kind === 'txtvein-single' || kind === 'nt-text') {
          note.textContent = '识别：' + (kind === 'nt-text' ? 'NT 明文' : 'TxtVein 单 TXT') + ' · 单文本导入。';
          password.parentElement.hidden = true;
        } else {
          note.textContent = '上面像是密文：请把字典密文粘到下面的框；只导单文本时上面放单 TXT。';
          password.parentElement.hidden = false;
        }
      }

      top.addEventListener('input', refresh);
      bottom.addEventListener('input', refresh);

      async function pickInto(target, tag) {
        const picked = await TV.files.pickFiles(false);
        const file = Array.from(picked || [])[0];
        if (!file) return;
        const read = await TV.files.readFiles([file]);
        const f = read[0];
        if (!f) return;
        let kind = TV.files.classify(f.name, f.text);
        if (kind === 'secure') {
          try { kind = TV.envelope.extractSecure(f.text).kind || kind; } catch (e) { /* 保持 */ }
        }
        const isDict = kind === 'dict' || /dict|vault|字典/i.test(f.name);
        const isLedger = kind === 'ledger' || /ledger|shadow|流水/i.test(f.name);
        if (target === top && isDict) {
          note.className = 'import-note is-bad';
          note.textContent = '这是字典密文，请点「选字典密文」。';
          return;
        }
        if (target === bottom && isLedger) {
          note.className = 'import-note is-bad';
          note.textContent = '这是流水密文，请点「选流水密文」。';
          return;
        }
        target.value = f.text;
        note.className = 'import-note';
        note.textContent = '已选' + tag + '：' + (f.name || '文件') + '，共 ' + f.text.length + ' 个字符。';
        refresh();
      }

      const openLedger = button('选流水密文', '', () => pickInto(top, '流水密文'));
      const openDict = button('选字典密文', '', () => pickInto(bottom, '字典密文'));

      async function runImport(btn) {
        const t = top.value.trim();
        const d = bottom.value.trim();
        if (!t && !d) {
          note.className = 'import-note is-bad';
          note.textContent = '先选择文件，或粘贴单文本 / 两份密文。';
          return;
        }
        const label = btn ? btn.textContent : '导入';
        if (btn) { btn.disabled = true; btn.textContent = '导入中…'; }
        try {
          let r;
          if (d) {
            if (!t) {
              cipherNote.className = 'import-note cipher-note is-bad';
              cipherNote.textContent = '还缺流水密文。';
              return;
            }
            if (/##\s*字典/.test(t)) {
              cipherNote.className = 'import-note cipher-note is-bad';
              cipherNote.textContent = '上面是单文本，不能和字典密文配对；请把流水密文放上面。';
              return;
            }
            r = await app.importBundle([
              { name: 'ledger.enc', text: t },
              { name: 'dict.enc', text: d },
            ], { password: password.value, force: force.checked });
          } else {
            const kind = TV.ntBridge.detect(t);
            if (kind === 'txtvein-bundle' || kind === 'txtvein-secure') {
              note.className = 'import-note is-bad';
              note.textContent = '双文件密文要两个框都有内容：上面流水、下面字典。';
              return;
            }
            r = await app.importText(t, { password: password.value, force: force.checked });
          }
          result = r;
          if (!r.ok) {
            note.className = 'import-note is-bad';
            note.textContent = r.error || '导入失败';
            if (r.needsForce) forceWrap.hidden = false;
            return;
          }
          note.className = 'import-note is-ok';
          note.textContent = r.message || '导入成功';
          toast(r.message || '导入成功', 'ok');
          setTimeout(() => { close(); app.afterDataChange(); }, 350);
        } catch (e) {
          note.className = 'import-note is-bad';
          note.textContent = e.message || '导入失败';
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = label; }
        }
      }

      const fileSubmit = button('导入文件', 'btn-primary', () => runImport(fileSubmit));
      const pasteSubmit = button('导入粘贴', 'btn-primary', () => runImport(pasteSubmit));

      open('导入', [
        el('div', { class: 'panel-section import-area' }, [
          el('h3', {}, ['文件导入']),
          el('div', { class: 'row-gap' }, [openLedger, openDict]),
          el('div', { class: 'help-text' }, ['手机不能一次选两个文件时，分两次点：先选流水，再选字典。']),
          el('div', { class: 'form-row', style: 'margin-top:8px' }, [field('密文密码', password), el('div', {}, [])]),
          forceWrap,
          el('div', { class: 'row-gap import-dictbar' }, [fileSubmit]),
        ]),
        el('div', { class: 'panel-section import-area' }, [
          el('h3', {}, ['粘贴导入']),
          el('div', { class: 'row-gap' }, [
            button('粘贴单文本', '', () => pasteTo(top, '上面的框')),
            button('粘贴流水密文', '', () => pasteTo(top, '上面的框')),
          ]),
          top,
          note,
          el('div', { class: 'row-gap import-dictbar' }, [
            button('粘贴字典密文', '', () => pasteTo(bottom, '下面的框')),
            pasteSubmit,
          ]),
          bottom,
          cipherNote,
          el('div', { class: 'help-text' }, ['两个框：单文本只填上面；密文上面放流水、下面放字典。密文密码用文件导入区的密码框；导入会替换当前账本，先备份。']),
        ]),
      ], closeFoot());
      forceWrap.hidden = true;
      password.parentElement.hidden = true;
      refresh();
    }

    /* ---------------- 帮助 ---------------- */

    function showHelp(app) {
      const help = el('div', { class: 'help-grid' }, [        el('div', {}, [
          el('h3', {}, ['一句语法']),
          el('p', {}, [
            el('code', {}, ['转出 > 转入 金额 < 标签']),
            el('br'),
            '只有 > 和 <。资金从左流向右；< 把语义收敛到标签层级。',
          ]),
          el('h3', {}, ['示例']),
          el('ul', {}, [
            el('li', {}, [el('code', {}, ['wx1 > din 35 < 咖啡 < 拿铁'])]),
            el('li', {}, [el('code', {}, ['sav > wx1 > din 1000 995']), ' 链式转移，差额进损耗']),
            el('li', {}, [el('code', {}, ['261110 wx1 > din 12.5']), ' 指定日期']),
            el('li', {}, [el('code', {}, ['-1 wx1 > din 35']), ' 昨天（落盘固化）']),
            el('li', {}, [el('code', {}, ['wx1 > rent 1000*m']), ' 周期规则']),
            el('li', {}, [el('code', {}, ['P:wx1 > C:cbiz 1000 < 垫付']), ' 跨域']),
            el('li', {}, [el('code', {}, ['wx1 > din 60m < 时间']), ' 时间代币']),
          ]),
          el('h3', {}, ['录入宏']),
          el('p', {}, ['连按两次空格 → >；再连按两次 → <。Backspace 删掉符号后会自动重新判断。数字键 1–9 可在气泡里秒选，并把 wx1/wx2 固化进别名。']),
        ]),
        el('div', {}, [
          el('h3', {}, ['快捷键']),
          shortcut('回车', '落盘 / 气泡选中'),
          shortcut('↑ ↓', '行间穿梭 / 气泡选择'),
          shortcut('Tab', '补全气泡 / 采用预测'),
          shortcut('Ctrl+Z', '撤销刚固化的别名'),
          shortcut('Delete', '删除选中的流水'),
          shortcut('Ctrl+S', '立即保存'),
          shortcut('Ctrl+R', '规则面板'),
          shortcut('Ctrl+Shift+P', '简码 / 明文'),
          shortcut('Ctrl+Shift+L', '中文 / 英文'),
          shortcut('Ctrl+Shift+K', '锁定'),
          shortcut('?', '本页'),
          el('h3', { style: 'margin-top:16px' }, ['三大铁律']),
          el('ul', {}, [
            el('li', {}, ['流水是唯一事实；UI/报表/统计都是派生视图。']),
            el('li', {}, ['关闭软件，数据不死；导出必须能被记事本打开。']),
            el('li', {}, ['灯下黑：复杂都在底层，界面只留发光的输入框。']),
          ]),
          el('h3', { style: 'margin-top:16px' }, ['自动锁定']),
          el('p', {}, ['无操作 5 分钟，或退到后台 30 秒，自动锁定；不再提供手动锁按钮。']),
          el('h3', { style: 'margin-top:16px' }, ['文件']),
          el('p', {}, ['ledger 只存 ID 与整数分；dict 存名字/简码/极性/域/树。改名只改 dict，历史流水不动。加密：PBKDF2-SHA-256 150,000 → AES-GCM-256。']),
        ]),
      ]);
      const update = button(app.getState().lang === 'en' ? 'Update' : '更新', 'btn-primary', async () => {
        update.disabled = true;
        const old = update.textContent;
        update.textContent = app.getState().lang === 'en' ? 'Updating…' : '更新中…';
        try {
          if (navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              await reg.update().catch(() => {});
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
          await fetch(location.pathname + '?fresh=' + Date.now(), { cache: 'reload' }).catch(() => {});
          location.reload();
        } catch (e) {
          update.disabled = false;
          update.textContent = old;
        }
      });
      update.title = app.getState().lang === 'en'
        ? 'Check and switch to the latest version'
        : '检查并切换到最新版本';
      open('帮助与协议 · v' + (TV.version ? TV.version.VERSION : '2.2.0'), help, closeFoot([
        el('span', { class: 'help-text' }, ['TxtVein · 纯文本双极账本 · v' + (TV.version ? TV.version.VERSION : '2.2.0')]),
        update,
      ]));
    }

    function shortcut(k, v) {
      return el('div', { class: 'shortcut-row' }, [el('span', {}, [k]), el('span', {}, [v])]);
    }

    /* ---------------- 改密码 ---------------- */

    function showPassword(app) {
      const oldPw = input({ type: 'password', placeholder: '当前密码' });
      const newPw = input({ type: 'password', placeholder: '新密码（至少 4 位）' });
      const pw2 = input({ type: 'password', placeholder: '再输一次' });
      const hint = input({ type: 'text', placeholder: '密码提示（可选）' });
      hint.value = TV.store && TV.store.readHint ? TV.store.readHint() : '';
      const error = el('div', { class: 'form-error' });
      const submit = button('改密码并重新加密', 'btn-primary', async () => {
        if (newPw.value.length < 4) { error.textContent = '新密码至少 4 位'; return; }
        if (newPw.value !== pw2.value) { error.textContent = '两次新密码不一致'; return; }
        const r = await app.changePassword(oldPw.value, newPw.value, hint.value);
        if (!r.ok) { error.textContent = r.error; return; }
        toast('主密码已更换；旧密码失效', 'ok');
        close();
      });
      open('安全 · 修改主密码', [
        field('当前密码', oldPw),
        el('div', { class: 'form-row' }, [field('新密码', newPw), field('确认', pw2)]),
        field('提示语（可选）', hint),
        error,
        el('p', { class: 'help-text' }, ['会用新盐、新 IV、新密钥重新加密整本账。旧密码立即失效。']),
      ], closeFoot([submit]));
    }

    /* ---------------- 确认框 ---------------- */

    function motherPicker(app, token, onDone) {
      const s = app.getState();
      const q = input({ value: token || '', placeholder: '输入词，例如 星巴克 / 早餐 / 地铁' });
      const results = el('div', { class: 'suggest-box' });
      const note = el('p', { class: 'help-text' }, [
        '只列母树叶子。采纳后自动建节点，并挂到该叶子所属的统计分类（顶级分支）。',
      ]);
      function search() {
        clear(results);
        const t = q.value.trim();
        if (!t) return;
        const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
        const all = Object.keys(nodes).filter((id) => nodes[id].kind === 'category');
        const low = t.toLowerCase();
        const byCode = all.filter((id) => {
          const n = nodes[id];
          return (n.zh_code && n.zh_code.toLowerCase().indexOf(low) === 0)
            || (n.en_code && n.en_code.toLowerCase().indexOf(low) === 0);
        }).slice(0, 6).map((id) => ({ id, path: shortPathOf(id) || id, reason: '推荐码 / 拼音首字母', score: 99 }));
        const base = (TV.suggester ? TV.suggester.suggestForToken(t, TV.systemDict, { limit: 8, lang: s.lang }) : [])
          .filter((x) => nodes[x.id] && nodes[x.id].kind === 'category');
        const seen = new Set();
        const list = [];
        byCode.concat(base).forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); list.push(x); } });
        list.splice(10);
        if (list.length) {
          /* 同支推荐：给第一个命中补上它旁边的分支/叶子 */
          TV.dictV4.siblingSuggestions(list[0].id, TV.systemDict, 6).forEach((x) => {
            if (seen.has(x.id)) return;
            seen.add(x.id);
            list.push({ id: x.id, path: x.path, reason: '同支推荐', score: 0, token: x.name });
          });
        }
        if (!list.length) {
          results.appendChild(el('div', { class: 'import-note' }, ['没有匹配的母树叶子；可「新建节点」手动选分类。']));
          return;
        }
        list.forEach((x) => {
          const b = el('button', { class: 'suggest-item', type: 'button' }, [
            el('b', {}, [x.path || x.id]),
            el('span', {}, [x.reason + (x.score ? ' · ' + x.score : '')]),
          ]);
          b.addEventListener('click', () => {
            const token = x.token || t;
            const r = app.adoptMother(x.id, token);
            if (!r.ok) { toast(r.error, 'error'); return; }
            toast('已建节点「' + token + '」[' + r.code + '] · ' + r.category, 'ok');
            close();
            if (onDone) onDone(r);
            else if (app.getState && app.getState().view === 'mother' && app.setView) app.setView('mother');
            else showDict(app, 'nodes', '');
          });
          results.appendChild(b);
        });
      }
      q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(search, 160); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      open('从母树建节点', [field('搜索母树叶子', q), results, note], closeFoot([
        button('取消', '', close),
      ]));
      setTimeout(search, 0);
    }

    /* 整页「母树」：左私人字典，右母树；点母树分支/叶子即绑定 */
    function renderMotherPage(app, host) {
      const s = app.getState();
      clear(host);
      const page = el('div', { class: 'mother-page' });
      host.appendChild(page);
      if (!s.dict || s.dict.format !== 'v4') {
        page.appendChild(el('div', { class: 'mother-empty' }, [
          '当前字典不是 v4。先到「字典」页改成 v4（或导入 v4 样本），这里才能做绑定。',
        ]));
        return;
      }
      const nodes = s.dict.nodes || {};
      const cats = s.dict.categories || [];
      const ids = Object.keys(nodes).filter((id) => !nodes[id].system);
      const keyOf = (n) => ((n.domain && n.domain !== 'P' ? n.domain + ':' : '') + (n.zh_code || '')) || n.zh_name;
      motherSel = '';
      if (motherSelCode) {
        const hit = ids.find((id) => keyOf(nodes[id]) === motherSelCode);
        if (hit) motherSel = hit;
        else motherSelCode = '';
      }
      const typeOrder = dictMod.TYPE_ALL.slice();

      const qPriv = input({ placeholder: '搜索私人节点 / 简码 / 绑定' });
      qPriv.className = 'mother-search';
      const qMom = input({ placeholder: '搜索母树分支 / 叶子 / 推荐码' });
      qMom.className = 'mother-search';

      const hint = el('div', { class: 'mother-hint' }, ['左：点一个私人节点选中；右：点母树的分支或叶子即绑定。']);
      const left = el('div', { class: 'mother-tree' });
      const right = el('div', { class: 'mother-tree' });

      function bindTo(targetId) {
        if (!motherSel || !nodes[motherSel]) { toast('先在左边点一个节点', 'error'); return; }
        const name = nodes[motherSel].zh_name;
        const r = app.updateNode(motherSel, { anchor_id: targetId });
        if (!r.ok) { toast(r.error, 'error'); return; }
        toast('已绑定：' + name + ' → ' + shortPathOf(targetId), 'ok');
        renderMotherPage(app, host);
      }

      function select(id) {
        motherSel = id;
        motherSelCode = keyOf(nodes[id] || {});
        left.querySelectorAll('.mother-row.is-node').forEach((row) => {
          row.classList.toggle('is-sel', row.dataset.id === id);
        });
        right.querySelectorAll('.mother-row.is-bound').forEach((row) => row.classList.remove('is-bound'));
        const n = nodes[id];
        if (n && n.anchor_id) {
          const hit = right.querySelector('[data-id="' + n.anchor_id + '"]');
          if (hit) hit.classList.add('is-bound');
        }
        hint.textContent = '已选：' + (n ? (n.zh_code || '—') + '，' + n.zh_name : '') + '；点右边母树的分支或叶子即绑定。';
      }

      function nodeRow(id, depth) {
        const n = nodes[id];
        const bin = n.anchor_id ? shortPathOf(n.anchor_id) : '未绑定';
        const row = el('div', {
          class: 'mother-row is-node' + (motherSel === id ? ' is-sel' : ''),
          'data-id': id,
          style: 'padding-left:' + (10 + depth * 18) + 'px',
        }, [
          el('span', { class: 'mother-code' }, [n.zh_code || '—']),
          el('span', { class: 'mother-name' }, ['，' + n.zh_name]),
          el('span', { class: 'mother-bind' }, ['→ ' + bin]),
          el('span', { class: 'mother-actions' }, [
            mini('编辑', '', () => nodeForm(app, null, id)),
            mini('删除', '', () => {
              const r = app.deleteNode(id);
              if (r.ok) toast('已删除节点', 'ok');
              else toast(r.error || '删除失败', 'error');
            }),
          ]),
        ]);
        row.dataset.q = ((n.zh_code || '') + ' ' + n.zh_name + ' ' + bin).toLowerCase();
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          select(id);
        });
        return row;
      }

      typeOrder.forEach((type) => {
        const typeCats = cats.filter((c) => c.type === type);
        const typeNodes = ids.filter((id) => nodes[id].type === type);
        if (!typeCats.length && !typeNodes.length) return;
        left.appendChild(el('div', { class: 'mother-row is-type' }, [
          el('b', {}, [type]),
          el('span', { class: 'mother-count' }, [String(typeNodes.length)]),
        ]));
        typeCats.forEach((cat) => {
          const kids = typeNodes.filter((id) => nodes[id].category_key === cat.key);
          const catRow = el('div', { class: 'mother-row is-cat', style: 'padding-left:10px' }, [
            el('span', { class: 'mother-name' }, [cat.name + (cat.en_name && !cat.en_auto ? '，' + cat.en_name : '')]),
            el('span', { class: 'mother-count' }, [String(kids.length)]),
            el('span', { class: 'mother-actions' }, [
              mini('改', '', () => categoryForm(app, cat.key)),
              mini('删', '', () => {
                confirm(app, '删除统计分类', '删除「' + cat.name + '」？它的 ' + kids.length + ' 个节点会变成未分类；绑定不动。', () => {
                  const r = app.deleteCategory(cat.key);
                  if (r.ok) toast('已删除统计分类', 'ok');
                  else toast(r.error, 'error');
                });
              }),
            ]),
          ]);
          catRow.dataset.q = cat.name.toLowerCase();
          left.appendChild(catRow);
          kids.forEach((id) => left.appendChild(nodeRow(id, 1)));
        });
        const orphans = typeNodes.filter((id) => !cats.some((c) => c.key === nodes[id].category_key));
        if (orphans.length) {
          left.appendChild(el('div', { class: 'mother-row is-cat', style: 'padding-left:10px' }, [
            el('span', { class: 'mother-name' }, ['未分类']),
            el('span', { class: 'mother-count' }, [String(orphans.length)]),
          ]));
          orphans.forEach((id) => left.appendChild(nodeRow(id, 1)));
        }
      });

      const sn = (TV.systemDict && TV.systemDict.nodes) || {};
      const children = {};
      Object.keys(sn).forEach((id) => {
        const p = sn[id].parent_id;
        if (p) (children[p] = children[p] || []).push(id);
      });
      function walk(id, depth) {
        const n = sn[id];
        if (!n) return;
        if (n.kind === 'category') {
          const row = el('div', {
            class: 'mother-row is-target' + (children[id] && children[id].length ? ' is-branch' : '')
              + (motherSel && nodes[motherSel] && nodes[motherSel].anchor_id === id ? ' is-bound' : ''),
            'data-id': id,
            title: shortPathOf(id) || id,
            style: 'padding-left:' + (10 + depth * 20) + 'px',
          }, [
            el('span', { class: 'mother-name' }, [n.zh_name]),
            n.zh_code ? el('span', { class: 'mother-code' }, [n.zh_code]) : null,
            n.en_name ? el('span', { class: 'mother-en' }, [n.en_name]) : null,
          ]);
          row.dataset.q = (n.zh_name + ' ' + (n.en_name || '') + ' ' + (n.zh_code || '')).toLowerCase();
          row.addEventListener('click', () => bindTo(id));
          right.appendChild(row);
        }
        (children[id] || []).forEach((cid) => walk(cid, n.kind === 'type' ? 1 : depth + 1));
      }
      typeOrder.forEach((type) => {
        const typeId = Object.keys(sn).find((id) => sn[id].kind === 'type' && sn[id].zh_name === type);
        if (!typeId) return;
        right.appendChild(el('div', { class: 'mother-row is-type' }, [el('b', {}, [type])]));
        (children[typeId] || []).forEach((cid) => walk(cid, 1));
      });

      function filterTree(tree, q) {
        const needle = q.trim().toLowerCase();
        const rows = Array.from(tree.children);
        rows.forEach((row) => {
          if (row.classList.contains('is-type')) return;
          row.hidden = !!needle && (row.dataset.q || '').indexOf(needle) < 0;
        });
        rows.forEach((row, i) => {
          if (!row.classList.contains('is-type')) return;
          let any = false;
          for (let j = i + 1; j < rows.length && !rows[j].classList.contains('is-type'); j += 1) {
            if (!rows[j].hidden) { any = true; break; }
          }
          row.hidden = !!needle && !any;
        });
      }
      qPriv.addEventListener('input', () => filterTree(left, qPriv.value));
      qMom.addEventListener('input', () => filterTree(right, qMom.value));

      const bar = el('div', { class: 'mother-bar' }, [
        qPriv, qMom, el('span', { class: 'grow' }),
        button('补英文', '', () => {
          const r = TV.dictV4.backfillEnglish(s.dict, TV.systemDict);
          if (!r.filled) {
            toast('没有可补：已填写 ' + r.kept + ' 个，未绑定跳过 ' + r.unbound + ' 个', 'ok');
            return;
          }
          app.syncDict();
          toast('已补英文 ' + r.filled + ' 个节点' + (r.unbound ? '；未绑定跳过 ' + r.unbound + ' 个' : ''), 'ok');
          renderMotherPage(app, host);
        }),
        button('校验', '', () => validateDict(app)),
        button('+ 分类', '', () => categoryForm(app)),
        button('+ 节点', '', () => nodeForm(app)),
        button('+ 从母树', '', () => motherPicker(app, '')),
      ]);

      page.appendChild(bar);
      page.appendChild(el('div', { class: 'mother-cols' }, [
        el('div', { class: 'mother-pane' }, [
          el('div', { class: 'mother-pane-head' }, [
            el('b', {}, ['私人字典']),
            el('span', { class: 'mother-count' }, [ids.length + ' 节点 · ' + cats.length + ' 分组']),
          ]),
          left,
        ]),
        el('div', { class: 'mother-pane' }, [
          el('div', { class: 'mother-pane-head' }, [
            el('b', {}, ['母树']),
            el('span', { class: 'mother-count' }, ['先选左边节点，再点分支/叶子']),
          ]),
          right,
        ]),
      ]));
      page.appendChild(hint);
      if (motherSel && nodes[motherSel]) select(motherSel);
    }

    function showSettings(app) {
      const p = loadPrefs();
      const font = el('input', { type: 'number', min: '11', max: '22', value: String(p.fontSize) });
      font.addEventListener('input', () => {
        p.fontSize = Math.max(11, Math.min(22, Number(font.value) || 13));
        savePrefs(p);
        if (app.refreshEditors) app.refreshEditors();
      });
      const colorRows = COLOR_DEFS.map((x) => {
        const swatch = el('input', { type: 'color', value: p.colors[x[0]] || x[3] });
        swatch.addEventListener('input', () => {
          p.colors[x[0]] = swatch.value;
          savePrefs(p);
        });
        return el('div', { class: 'settings-row' }, [
          el('span', {}, [x[1]]),
          swatch,
          el('code', {}, [x[3]]),
        ]);
      });
      open('设置', [
        el('h3', { class: 'settings-h' }, ['修改密码']),
        el('div', { class: 'form-row' }, [
          button('修改密码', '', () => { close(); showPassword(app); }),
        ]),
        el('h3', { class: 'settings-h' }, ['字号']),
        el('div', { class: 'settings-row' }, [
          el('span', {}, ['编辑器字号']), font, el('span', { class: 'help-text' }, ['11–22 px']),
        ]),
        el('h3', { class: 'settings-h' }, ['颜色']),
        ...colorRows,
        el('p', { class: 'help-text' }, ['颜色与字号只保存在本机浏览器；不写入账本。']),
        el('div', {}, [button('恢复默认颜色', '', () => {
          const d = JSON.parse(JSON.stringify(DEFAULT_PREFS));
          savePrefs(d);
          close();
          showSettings(app);
        })]),
      ], closeFoot([button('关闭', '', close)]));
    }

    function confirm(app, title, text, onOk, danger) {      const ok = button('确认', danger === false ? 'btn-primary' : 'btn-danger', () => {
        close();
        onOk && onOk();
      });
      open(title || '确认', [
        el('p', { class: 'help-text', style: 'font-size:12px;color:var(--text-2);line-height:1.8' }, [text || '']),
      ], closeFoot([ok]));
    }

    return {
      open,
      close,
      toast,
      showRules,
      showDict,
      renderMotherPage,
      nodeForm,
      tagForm,
      motherPicker,
      showText,
      showExport,
      showImport,
      showHelp,
      showSettings,
      showPassword,
      confirm,
    };
  }

  TV.panels = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
