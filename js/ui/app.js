/* TxtVein · 应用外壳
 * 唯一状态：dict + events + plans + rules（全部可序列化成两份纯文本）。
 * 所有视图都从这里派生；这里不做业务计算，只做编排。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { $, el, clear } = TV.dom;
  const D = TV.dict;
  const amount = TV.amount;
  const date = TV.date;
  const rulesMod = TV.rules;
  const calcMod = TV.calc;
  const ledgerFile = TV.ledgerFile;
  const dictFile = TV.dictFile;
  const crypto = TV.crypto;
  const store = TV.store;
  const files = TV.files;

  const S = {
    dict: null,
    events: [],
    behaviors: [],
    notes: [],
    plans: [],
    rules: [],
    ledgerSource: '',
    dictSource: '',
    sourceDiags: [],
    vaultId: '',
    domain: '',
    mode: 'CODE',
    lang: 'zh',
    view: 'ledger',
    range: '本月',
    query: { text: '', fromDate: '', toDate: '', type: '', domain: '', from: '', to: '', tag: '', min: '', max: '' },
    queries: [],
    stats: { tab: 'category', year: new Date().getFullYear(), month: new Date().getMonth() + 1, selected: '', pane: 'list', first: 0, split: 430 },
    selectedEventIndex: -1,
    selectedNodeId: '',
    filterNodeId: '',
    linkedNodeIds: new Set(),
    ignoredCandidates: new Set(),
    pendingRepair: null,
    editingIndex: -1,
    saveState: 'saved',
    calcAll: null,
    texts: null,
    lastAliasUndo: null,
  };

  const LABELS = {
    zh: {
      security: '安全', import: '导入', export: '导出', help: '帮助', candidates: '候选',
      query: '查询', ledger: '流水', dict: '字典', fixed: '固定', report: '统计',
      modeCode: '简码', modePlain: '明文', lock: '锁',
      queryTitle: '查询流水', queryText: '关键词 / 名称 / 日期', all: '全部',
      ledgerQuery: '流水查询', clear: '清空', seq: '序', noteSearch: '备注搜索',
      amountShort: '金额', dateShort: '日期', colNote: '备注',
      fromDate: '起始日期', toDate: '结束日期', type: '收支类型', domain: '账本',
      fromNode: '转出', toNode: '转入', tag: '标签', min: '最小金额', max: '最大金额',
      reset: '重置', count: '条', total: '合计',
      colDate: '日期', colDomain: '域', colFrom: '转出', colTo: '转入', colAmount: '金额', colTags: '标签',
      category: '分类', node: '节点', note: '备注', event: '事件', allMonths: '全', statsTitle: '统计',
      statsColName: '分类', statsColNode: '节点', statsColOther: '对方', statsWeight: '强度',
      statsMonth: '月', statsItems: '项', statsRecords: '条', statsSelect: '左侧选择一项',
      noRows: '没有匹配的流水', fixedTitle: '固定收支与规则',
      fixedHint: '文本编辑，自动保存 · [PLAN] 固定收支 / [RULES] 自动规则',
      feedbackHint: '双击空格 > · 三击 < · 数字/鼠标选候选 · Ctrl+Enter 编译',
    },
    en: {
      security: 'Security', import: 'Import', export: 'Export', help: 'Help', candidates: 'Candidates',
      query: 'Query', ledger: 'Ledger', dict: 'Dictionary', fixed: 'Fixed', report: 'Stats',
      modeCode: 'Code', modePlain: 'Plain', lock: 'Lock',
      queryTitle: 'Query ledger', queryText: 'Keyword / name / date', all: 'All',
      ledgerQuery: 'Ledger query', clear: 'Clear', seq: '#', noteSearch: 'Note search',
      amountShort: 'Amount', dateShort: 'Date', colNote: 'Note',
      fromDate: 'From', toDate: 'To', type: 'Type', domain: 'Book',
      fromNode: 'From account', toNode: 'To account', tag: 'Tag', min: 'Min amount', max: 'Max amount',
      reset: 'Reset', count: 'rows', total: 'Total',
      colDate: 'Date', colDomain: 'Book', colFrom: 'From', colTo: 'To', colAmount: 'Amount', colTags: 'Tags',
      category: 'Categories', node: 'Nodes', note: 'Notes', event: 'Events', allMonths: 'All', statsTitle: 'Stats',
      statsColName: 'Category', statsColNode: 'Node', statsColOther: 'Counterpart', statsWeight: 'Weight',
      statsMonth: 'month', statsItems: 'items', statsRecords: 'records', statsSelect: 'Select an item on the left',
      noRows: 'No matching entries', fixedTitle: 'Fixed entries & rules',
      fixedHint: 'Text editor, auto-saved · [PLAN] fixed entries / [RULES] auto rules',
      feedbackHint: 'Double space > · triple < · number/click candidate · Ctrl+Enter compile',
    },
  };

  function t(key) {
    const lang = S.lang === 'en' ? 'en' : 'zh';
    return (LABELS[lang] && LABELS[lang][key]) || LABELS.zh[key] || key;
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (key) node.textContent = t(key);
    });
    const lock = dom.btnLock;
    if (lock) lock.textContent = t('lock');
    const cand = dom.btnCandidates;
    if (cand) cand.textContent = t('candidates');
    if (dom.btnMode) dom.btnMode.textContent = S.mode === 'CODE' ? t('modeCode') : t('modePlain');
    if (dom.btnLang) dom.btnLang.textContent = S.lang === 'zh' ? '中' : 'EN';
    renderTabs();
    if (S.view === 'query') renderQuery();
    if (S.view === 'fixed') renderFixedHint();
    updateFeedback();
  }

  const dom = {
    gate: $('#gate'),
    app: $('#app'),
    hud: $('#hud'),
    editorView: $('#editor-view'),
    queryView: $('#query-view'),
    fixedView: $('#fixed-view'),
    reportView: $('#report-view'),
    feedback: $('#feedback'),
    feedbackText: $('#feedback-text'),
    feedbackAction: $('#feedback-action'),
    composer: $('#composer'),
    composerToggle: $('#composer-toggle'),
    input: $('#entry'),
    bubbles: $('#bubbles'),
    prediction: $('#prediction'),
    state: $('#entry-state'),
    hint: $('#entry-hint'),
    error: $('#entry-error'),
    row: $('.entry-row'),
    prompt: $('#entry-prompt'),
    modal: $('#modal'),
    modalTitle: $('#modal-title'),
    modalBody: $('#modal-body'),
    modalFoot: $('#modal-foot'),
    modalClose: $('#modal-close'),
    toast: $('#toast'),
    toastText: $('#toast-text'),
    toastAction: $('#toast-action'),
    btnMode: $('#btn-mode'),
    btnLang: $('#btn-lang'),
    btnQuery: $('#btn-query'),
    btnLedger: $('#btn-ledger'),
    btnDict: $('#btn-dict'),
    btnFixed: $('#btn-fixed'),
    btnReport: $('#btn-report'),
    btnCandidates: $('#btn-candidates'),
    btnSecurity: $('#btn-security'),
    btnImport: $('#btn-import'),
    btnExport: $('#btn-export'),
    btnHelp: $('#btn-help'),
    btnLock: $('#btn-lock'),
  };

  let saveTimer = 0;
  let saving = false;
  let saveAgain = false;
  let booted = false;
  let needsOnboarding = false;

  const panels = TV.panels.create({
    modal: dom.modal,
    title: dom.modalTitle,
    body: dom.modalBody,
    foot: dom.modalFoot,
    close: dom.modalClose,
    toast: dom.toast,
    toastText: dom.toastText,
    toastAction: dom.toastAction,
  });

  function toast(msg, type, action) {
    updateFeedback(msg, type, action);
  }

  function padId(n, width) {
    return String(n).padStart(width, '0');
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function setSaveState(state) {
    S.saveState = state;
    renderHUD();
  }

  function assignEventIds(events) {
    (events || []).forEach((e) => {
      if (!e.id) e.id = D.nextId(S.dict, 'event');
    });
    return events;
  }

  function adopt(dict, events, plans, rules, vaultId, extras) {
    const e = extras || {};
    S.dict = dict;
    S.events = events || [];
    S.behaviors = e.behaviors || [];
    S.notes = e.notes || [];
    S.plans = plans || [];
    S.rules = rules || [];
    S.vaultId = vaultId || dict.vaultId || crypto.randomVaultId();
    S.selectedEventIndex = -1;
    S.selectedNodeId = '';
    S.filterNodeId = '';
    S.editingIndex = -1;
    S.lastAliasUndo = null;
    D.ensureMeta(S.dict);
    D.bumpMeta(S.dict);
    dictFile.syncMeta(S.dict, S.events, S.plans);
    S.calcAll = calcMod.compute(S.dict, S.events, { range: null });
  }

  function refreshSources(force) {
    if (!S.dict) return;
    if (!force && S.ledgerSource && S.dictSource) return;
    S.dictSource = TV.source.dictToSource(S.dict);
    S.ledgerSource = TV.source.normalizeDomainSyntax(TV.source.ledgerToSource(S.dict, S.events, S.behaviors, S.notes));
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
  }

  /* ---------------- 序列化 / 保存 ---------------- */

  async function buildTexts() {
    dictFile.syncMeta(S.dict, S.events, S.plans);
    const dictHash = await crypto.sha256Hex(dictFile.bodyForHash(S.dict));
    let ledger = ledgerFile.serializeLedger({
      vaultId: S.vaultId,
      link: dictHash,
      events: S.events,
      plans: S.plans,
      rules: S.rules,
    });
    const ledgerHash = await crypto.sha256Hex(ledgerFile.bodyForHash(ledger));
    S.dict.link = ledgerHash;
    const dict = dictFile.serializeDict(S.dict);
    S.texts = {
      ledger, dict, vaultId: S.vaultId, ledgerHash, dictHash,
      ledgerSource: S.ledgerSource, dictSource: S.dictSource,
    };
    return S.texts;
  }

  async function saveNow(reason) {
    if (!S.dict || !store.isUnlocked()) return;
    if (saving) { saveAgain = true; return; }
    saving = true;
    setSaveState('saving');
    try {
      const texts = await buildTexts();
      await store.save({
        ledger: texts.ledger,
        dict: texts.dict,
        ledgerSource: texts.ledgerSource,
        dictSource: texts.dictSource,
      });
      if (editorCtl) editorCtl.setDirty('both', false);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast(e.message || '保存失败', 'error');
    } finally {
      saving = false;
      if (saveAgain) {
        saveAgain = false;
        setTimeout(() => saveNow(), 60);
      }
    }
  }

  function scheduleSave() {
    if (!S.dict || !store.isUnlocked()) return;
    setSaveState('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(), 420);
  }

  /* ---------------- 渲染 ---------------- */

  function renderHUD() {
    if (!dom.hud) return;
    if (!S.dict) { clear(dom.hud); return; }
    const nodeCount = Object.keys(S.dict.nodes).filter((id) => !S.dict.nodes[id].system).length;
    const tagCount = Object.keys(S.dict.tags).length;
    const behaviorCount = Object.keys(S.dict.behaviors || {}).length;
    const calc = S.calcAll || calcMod.compute(S.dict, S.events, {});
    const inv = calc.balanced;
    const saveLabel = {
      saved: 'SAVED', saving: 'SAVING', dirty: 'UNSAVED', error: 'SAVE ERROR',
    }[S.saveState] || '';
    clear(dom.hud);
    const sep = () => el('span', { class: 'hud-sep' }, ['/']);
    const item = (label, value, cls) => el('span', {}, [
      label + ' ', el('b', { class: cls || '' }, [String(value)]),
    ]);
    dom.hud.appendChild(item('FLOWS', S.events.length));
    dom.hud.appendChild(sep());
    dom.hud.appendChild(item('NODES', nodeCount));
    dom.hud.appendChild(sep());
    dom.hud.appendChild(item('TAGS', tagCount));
    if (behaviorCount) {
      dom.hud.appendChild(sep());
      dom.hud.appendChild(item('BHV', behaviorCount));
    }
    dom.hud.appendChild(sep());
    dom.hud.appendChild(item('A', amount.formatPlain(calc.totals.A.closing), 'hud-a'));
    dom.hud.appendChild(item('B', amount.formatPlain(calc.totals.B.closing), 'hud-b'));
    dom.hud.appendChild(sep());
    dom.hud.appendChild(el('span', {}, [
      'A−B ', el('b', { class: inv ? 'hud-ok' : 'hud-bad' }, [amount.formatPlain(calc.netWorth)]),
    ]));
    dom.hud.appendChild(el('span', { class: inv ? 'hud-ok' : 'hud-bad' }, [inv ? 'BALANCED' : 'UNBALANCED']));
    const right = el('span', { class: 'hud-right' }, [
      el('span', {}, ['RANGE ', el('b', {}, [S.range])]),
      el('span', {}, ['RULES ', el('b', {}, [String(S.plans.filter((p) => p.status === 'active').length)])]),
      el('span', { class: S.saveState === 'error' ? 'hud-bad' : (S.saveState === 'saved' ? 'hud-ok' : '') }, [saveLabel]),
    ]);
    dom.hud.appendChild(right);
  }

  function candidateList() {
    const out = [];
    const seen = new Set();
    (S.sourceDiags || []).forEach((d) => {
      if (d.file !== 'ledger' || d.severity !== 'error') return;
      const m = String(d.message || '').match(/找不到(?:节点\/行为项|节点|行为项)：(.+)$/);
      if (!m) return;
      const token = m[1].trim();
      if (!token || S.ignoredCandidates.has(token)) return;
      const key = token + '|' + d.line;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ token, line: d.line, domain: S.domain || 'P', behavior: /^找不到行为项：/.test(String(d.message || '')) });
    });
    return out;
  }

  function renderCandidateButton() {
    if (!dom.btnCandidates) return;
    const n = candidateList().length;
    dom.btnCandidates.hidden = !n;
    dom.btnCandidates.textContent = n ? ('候选 ' + n) : '候选';
  }

  function createBehaviorCandidate(token) {
    const d = S.dict;
    const code = String(token).replace(/[\s<>|#]/g, '') || 'h';
    const id = TV.ids.newBehaviorItemId((x) => !!d.behaviors[x]);
    d.behaviors[id] = {
      zh_name: token, en_name: token, zh_code: code, en_code: code,
      domain: S.domain || 'P', parent_id: '', weight: 10,
      created_at: new Date().toISOString(),
    };
    D.addAlias(d, token, id);
    D.addAlias(d, code, id);
    d.meta.updatedAt = new Date().toISOString();
    syncDictSourceAndCompile();
    toast('已建行为项 ' + code, 'ok');
  }

  function showCandidates() {
    const list = candidateList();
    const body = el('div', { class: 'candidate-list' });
    if (!list.length) body.appendChild(el('div', { class: 'help-text' }, ['当前没有未绑定的候选。']));
    list.forEach((c) => {
      const row = el('div', { class: 'candidate-row' }, [
        el('div', { class: 'candidate-token' }, [
          el('b', {}, [c.token]),
          el('span', {}, ['第 ' + c.line + ' 行 · ' + (c.behavior ? '行为' : '会计')]),
        ]),
        el('div', { class: 'candidate-actions' }),
      ]);
      const actions = row.querySelector('.candidate-actions');
      const nodeBtn = el('button', { class: 'mini-btn is-accent', type: 'button' }, ['新建会计节点']);
      nodeBtn.addEventListener('click', () => {
        panels.nodeForm(app, {
          zh_name: c.token, en_name: c.token,
          zh_code: c.token.replace(/[\s<>|#]/g, '') || 'n',
          en_code: c.token.replace(/[\s<>|#]/g, '') || 'n',
          domain: c.domain, type: '费用', form: 'steam',
        }, null, { reopen: false });
      });
      const bhvBtn = el('button', { class: 'mini-btn', type: 'button' }, ['新建行为项']);
      bhvBtn.addEventListener('click', () => createBehaviorCandidate(c.token));
      const ignore = el('button', { class: 'mini-btn', type: 'button' }, ['忽略']);
      ignore.addEventListener('click', () => {
        S.ignoredCandidates.add(c.token);
        renderCandidateButton();
        panels.close();
      });
      actions.appendChild(nodeBtn);
      actions.appendChild(bhvBtn);
      actions.appendChild(ignore);
      body.appendChild(row);
    });
    panels.open('字典候选', body, [
      el('button', { class: 'btn', type: 'button' }, ['关闭']),
    ]);
    const footBtn = document.querySelector('#modal-foot .btn');
    if (footBtn) footBtn.addEventListener('click', () => panels.close());
  }
  function renderTabs() {
    const views = {
      query: dom.btnQuery, ledger: dom.btnLedger, dict: dom.btnDict,
      fixed: dom.btnFixed, report: dom.btnReport,
    };
    Object.keys(views).forEach((view) => {
      if (views[view]) views[view].classList.toggle('is-active', S.view === view);
    });
    if (dom.btnMode) dom.btnMode.textContent = S.mode === 'CODE' ? t('modeCode') : t('modePlain');
    if (dom.btnLang) dom.btnLang.textContent = S.lang === 'zh' ? '中' : 'EN';
  }

  function paneModel() {
    const selected = S.events[S.selectedEventIndex];
    const linked = new Set();
    if (selected) { linked.add(selected.from); linked.add(selected.to); }
    return {
      dict: S.dict,
      events: S.events,
      calcAll: S.calcAll || calcMod.compute(S.dict, S.events, {}),
      domain: S.domain,
      mode: S.mode,
      lang: S.lang,
      selectedEventIndex: S.selectedEventIndex,
      selectedNodeId: S.selectedNodeId,
      filterNodeId: S.filterNodeId,
      linkedNodeIds: linked,
    };
  }

  let editorCtl = null;
  let lastEditorStatus = null;
  let feedbackTimer = 0;
  let feedbackHold = false;
  let feedbackFn = null;
  let compileTimer = 0;
  let compiling = false;

  function ensureEditor() {
    if (editorCtl || !TV.editor) return editorCtl;
    if (!S.ledgerSource || !S.dictSource) refreshSources();
    editorCtl = TV.editor.create(dom.editorView, {
      onChange: (file, text) => {
        if (file === 'ledger') S.ledgerSource = text;
        else S.dictSource = text;
        if (file === 'ledger') S.pendingRepair = null;
        if (editorCtl) editorCtl.setDirty(file, true);
        clearTimeout(compileTimer);
        compileTimer = setTimeout(() => compileSources(), 260);
      },
      onRun: () => compileSources(),
      onActive: (file) => {
        S.view = file === 'dict' ? 'dict' : 'ledger';
        renderTabs();
        renderAll();
      },
      hint: sourceHint,
      onStatus: (st) => {
        lastEditorStatus = st;
        if (!feedbackHold) updateFeedback();
      },
    });
    editorCtl.setTexts(S.ledgerSource, S.dictSource);
    return editorCtl;
  }

  function domainPrefix(domain) {
    const d = String(domain || 'P').toUpperCase();
    return d === 'P' ? '' : d + ' ';
  }

  function renderEventLine(e) {
    const fn = S.dict.nodes[e.from];
    const tn = S.dict.nodes[e.to];
    const cross = fn && tn && fn.domain !== tn.domain;
    const from = (cross ? fn.domain + ':' : '') + TV.dict.renderNode(S.dict, e.from, S.mode, S.lang);
    const to = (cross ? tn.domain + ':' : '') + TV.dict.renderNode(S.dict, e.to, S.mode, S.lang);
    const amt = e.minutes > 0 ? TV.amount.formatTime(e.minutes) : TV.source.formatYuanExact(e.amountCents);
    const tags = (e.tagIds || []).map((id) => ' < ' + TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join('');
    return domainPrefix(e.domain) + e.date + ' ' + from + ' > ' + to + ' ' + amt + tags;
  }

  function renderBehaviorLine(b) {
    const from = TV.dict.renderBehavior(S.dict, b.from, S.mode, S.lang);
    const to = TV.dict.renderBehavior(S.dict, b.to, S.mode, S.lang);
    const tags = (b.tagIds || []).map((id) => ' < ' + TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join('');
    return domainPrefix(b.domain) + b.date + ' ' + from + ' > ' + to + ' ' + (b.weight || 1) + tags;
  }

  function renderNoteLine(n) {
    if (n.kind !== 'note') return n.raw || '';
    const amt = n.minutes > 0 ? TV.amount.formatTime(n.minutes)
      : n.amountCents ? TV.source.formatYuanExact(n.amountCents) : '';
    const cat = TV.dict.renderTag(S.dict, n.categoryId, S.mode, S.lang);
    const kws = (n.keywordIds || []).map((id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join(' ');
    return domainPrefix(n.domain) + n.date + ' ' + (amt ? amt + ' ' : '') + '< ' + cat + (kws ? ' < ' + kws : '');
  }

  function projectEditorSource() {
    if (!S.dict || (S.view !== 'ledger' && S.view !== 'dict')) return;
    if (S.view === 'dict') return;
    const byLine = new Map();
    const add = (line, rec) => {
      if (!line) return;
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line).push(rec);
    };
    (S.events || []).forEach((e) => add(e.sourceLine, { kind: 'E', e }));
    (S.behaviors || []).forEach((b) => add(b.sourceLine, { kind: 'B', b }));
    (S.notes || []).forEach((n) => add(n.line, { kind: 'X', n }));
    const lines = S.ledgerSource.replace(/\n$/, '').split('\n');
    const out = [];
    lines.forEach((raw, idx) => {
      const recs = byLine.get(idx + 1) || [];
      const semantic = recs.filter((r) => r.kind === 'E' || r.kind === 'B');
      const notes = recs.filter((r) => r.kind === 'X');
      const hasInvalid = notes.some((r) => r.n.kind === 'invalid' || r.n.kind === 'comment');
      if (semantic.length && hasInvalid) { out.push(raw); return; }
      const noteRec = notes.find((r) => r.n.kind === 'note');
      if (!semantic.length) {
        if (noteRec) {
          const n = noteRec.n;
          const amt = n.minutes > 0 ? TV.amount.formatTime(n.minutes)
            : n.amountCents ? TV.source.formatYuanExact(n.amountCents) : '';
          const cat = TV.dict.renderTag(S.dict, n.categoryId, S.mode, S.lang);
          const kws = (n.keywordIds || []).map((id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join(' ');
          out.push(domainPrefix(n.domain) + n.date + ' ' + (amt ? amt + ' ' : '') + '< ' + cat + (kws ? ' < ' + kws : ''));
        } else {
          out.push(raw);
        }
        return;
      }
      semantic.forEach((r) => {
        if (r.kind === 'E') {
          const e = r.e;
          const fn = S.dict.nodes[e.from];
          const tn = S.dict.nodes[e.to];
          const cross = fn && tn && fn.domain !== tn.domain;
          const from = (cross ? fn.domain + ':' : '') + TV.dict.renderNode(S.dict, e.from, S.mode, S.lang);
          const to = (cross ? tn.domain + ':' : '') + TV.dict.renderNode(S.dict, e.to, S.mode, S.lang);
          const amt = e.minutes > 0 ? TV.amount.formatTime(e.minutes) : TV.source.formatYuanExact(e.amountCents);
          const tags = (e.tagIds || []).map((id) => ' < ' + TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join('');
          out.push(domainPrefix(e.domain) + e.date + ' ' + from + ' > ' + to + ' ' + amt + tags);
        } else {
          const b = r.b;
          const from = TV.dict.renderBehavior(S.dict, b.from, S.mode, S.lang);
          const to = TV.dict.renderBehavior(S.dict, b.to, S.mode, S.lang);
          const tags = (b.tagIds || []).map((id) => ' < ' + TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join('');
          out.push(domainPrefix(b.domain) + b.date + ' ' + from + ' > ' + to + ' ' + (b.weight || 1) + tags);
        }
      });
      /* 同一行还有备注节点（通常没有）时保留原文，避免丢失 */
      if (notes.some((r) => r.n.kind === 'note')) {
        notes.filter((r) => r.n.kind === 'note').forEach((r) => {
          const n = r.n;
          const amt = n.minutes > 0 ? TV.amount.formatTime(n.minutes)
            : n.amountCents ? TV.source.formatYuanExact(n.amountCents) : '';
          const cat = TV.dict.renderTag(S.dict, n.categoryId, S.mode, S.lang);
          const kws = (n.keywordIds || []).map((id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join(' ');
          out.push(domainPrefix(n.domain) + n.date + ' ' + (amt ? amt + ' ' : '') + '< ' + cat + (kws ? ' < ' + kws : ''));
        });
      }
    });
    S.ledgerSource = out.join('\n') + '\n';
    if (editorCtl) {
      editorCtl.setTexts(S.ledgerSource, S.dictSource);
      editorCtl.setDirty('ledger', true);
    }
    setSaveState('dirty');
  }

  function sourceHint(file, token, before) {
    const list = [];
    if (file === 'dict') {
      ['node', 'tag', 'item', 'alias', '->', '|', '[会计]', '[备注]', '[行为]'].forEach((x) => {
        if (!token || x.startsWith(token)) list.push({ text: x, displayText: x });
      });
      return { list };
    }
    const low = String(token || '').toLowerCase();
    if (before.includes('<')) {
      Object.keys(S.dict.tags || {}).forEach((id) => {
        const t = S.dict.tags[id];
        const code = t.zh_code || t.en_code;
        if (code && code.toLowerCase().startsWith(low)) list.push({ text: code, displayText: code + '  ' + (t.zh_name || '') });
      });
    } else {
      Object.keys(S.dict.nodes || {}).forEach((id) => {
        const n = S.dict.nodes[id];
        if (n.system) return;
        const code = n.zh_code || n.en_code;
        if (code && code.toLowerCase().startsWith(low)) list.push({ text: code, displayText: code + '  ' + (n.zh_name || '') + '  ' + n.polarity });
      });
      Object.keys(S.dict.behaviors || {}).forEach((id) => {
        const h = S.dict.behaviors[id];
        const code = h.zh_code || h.en_code;
        if (code && code.toLowerCase().startsWith(low)) list.push({ text: code, displayText: code + '  ' + (h.zh_name || '') + '  H' });
      });
    }
    ['>', '<', '*m', '*d', '*y', 'd', 'h', 'm'].forEach((x) => {
      if (!token) list.push({ text: x, displayText: x });
    });
    return { list: list.slice(0, 12) };
  }

  function compileSources() {
    if (!S.dict || compiling) return;
    compiling = true;
    clearTimeout(compileTimer);
    try {
      const r = TV.source.compileAll(S.dictSource, S.ledgerSource, {
        vaultId: S.vaultId, now: new Date(), domain: S.domain,
      });
      S.dict = r.dict;
      S.events = r.events || [];
      S.behaviors = r.behaviors || [];
      S.notes = r.notes || [];
      S.sourceDiags = (r.dictDiagnostics || []).map((x) => Object.assign({ file: 'dict' }, x))
        .concat((r.ledgerDiagnostics || []).map((x) => Object.assign({ file: 'ledger' }, x)));
      if (editorCtl) editorCtl.setDiagnostics(S.sourceDiags);
      renderCandidateButton();
      renderAll();
      scheduleSave();
      if (r.autoTags && r.autoTags.length && editorCtl) {
        /* 备注标签自动建：写回 dict.tv 的 [NOTE] 段，避免下次编译丢失 */
        let src = S.dictSource;
        const tagLines = r.autoTags.map((t) => {
          const tag = S.dict.tags[t.id];
          if (!tag) return '';
          return 'tag ' + [tag.domain, tag.kind || 'plain', tag.zh_code || t.code, tag.en_code || t.code, tag.zh_name].join(' ')
            + ' | ' + (tag.en_name || tag.zh_name) + ' ' + (tag.weight || 10) + ' -';
        }).filter(Boolean).join('\n');
        if (tagLines) {
          if (/^\[NOTE\]\s*$/m.test(src)) src = src.replace(/^\[NOTE\]\s*$/m, '[NOTE]\n' + tagLines);
          else src += '\n[NOTE]\n' + tagLines + '\n';
          S.dictSource = src;
          editorCtl.setTexts(S.ledgerSource, S.dictSource);
        }
      }
      if (r.autoBehaviors && r.autoBehaviors.length && editorCtl) {
        /* 行为项自动建：写回 dict.tv 的 [BEHAVIOR] 段 */
        let src = S.dictSource;
        const itemLines = r.autoBehaviors.map((t) => {
          const h = S.dict.behaviors[t.id];
          if (!h) return '';
          return 'item ' + [h.domain, h.zh_code || t.code, h.en_code || t.code, h.zh_name].join(' ')
            + ' | ' + (h.en_name || h.zh_name) + ' ' + (h.weight || 10) + ' -';
        }).filter(Boolean).join('\n');
        if (itemLines) {
          if (/^\[BEHAVIOR\]\s*$/m.test(src)) src = src.replace(/^\[BEHAVIOR\]\s*$/m, '[BEHAVIOR]\n' + itemLines);
          else src += '\n[BEHAVIOR]\n' + itemLines + '\n';
          S.dictSource = src;
          editorCtl.setTexts(S.ledgerSource, S.dictSource);
        }
      }
    } catch (e) {
      toast('编译失败：' + e.message, 'error');
    } finally {
      compiling = false;
    }
  }
  function renderPanes() {
    if (S.view === 'query') renderQuery();
  }

  /* ---------------- 查询页：三段独立流水查询（NT 风格） ---------------- */
  let queryCtl = null;
  let fixedCtl = null;
  const QUERY_PANELS = [
    { key: 'A', kind: 'day' },
    { key: 'B', kind: 'month' },
    { key: 'C', kind: 'year' },
  ];

  function q2(n) { return String(n).padStart(2, '0'); }
  function queryToday() {
    const d = new Date();
    return q2(d.getFullYear() % 100) + q2(d.getMonth() + 1) + q2(d.getDate());
  }
  function queryMonthText() {
    const d = new Date();
    return q2(d.getFullYear() % 100) + q2(d.getMonth() + 1);
  }
  function queryYearText() {
    return q2(new Date().getFullYear() % 100);
  }
  function queryPreset(kind) {
    if (kind === 'month') return queryMonthText();
    if (kind === 'year') return queryYearText();
    return queryToday();
  }
  function queryMonthEnd(yy, mm) {
    return q2(new Date(2000 + Number(yy), Number(mm), 0).getDate());
  }
  function queryDateRange(text) {
    const s = String(text || '').trim().replace(/\s+/g, '');
    if (!s) return { from: '', to: '' };
    const parts = s.split(/[-~～—到]/).filter(Boolean);
    const single = (t) => {
      if (/^\d{6}$/.test(t)) return { from: t, to: t };
      if (/^\d{4}$/.test(t)) {
        const yy = t.slice(0, 2); const mm = t.slice(2, 4);
        return { from: yy + mm + '01', to: yy + mm + queryMonthEnd(yy, mm) };
      }
      if (/^\d{2}$/.test(t)) return { from: t + '0101', to: t + '1231' };
      return { from: '', to: '' };
    };
    const a = single(parts[0]);
    const b = parts.length > 1 ? single(parts[1]) : a;
    return { from: a.from, to: b.to };
  }
  function queryInitialState(kind) {
    const dateText = queryPreset(kind);
    const r = queryDateRange(dateText);
    return { dateText, dateFrom: r.from, dateTo: r.to, from: '', to: '', amount: '', note: '' };
  }
  function ensureQueryState() {
    if (!Array.isArray(S.queries) || S.queries.length !== QUERY_PANELS.length) {
      S.queries = QUERY_PANELS.map((p) => queryInitialState(p.kind));
    }
  }

  function queryNodeText(id) {
    const n = S.dict.nodes[id];
    if (!n) return '';
    return [n.zh_code, n.en_code, n.zh_name, n.en_name].filter(Boolean).join(' ').toLowerCase();
  }
  function queryMatchNode(id, q) {
    if (!q) return true;
    return queryNodeText(id).includes(String(q).toLowerCase());
  }
  function queryAmountMatch(cents, text) {
    const s = String(text || '').trim().replace(/\s+/g, '');
    if (!s) return true;
    const amount = Number(cents) || 0;
    let m = s.match(/^([<>])(\d+(?:\.\d+)?)$/);
    if (m) {
      const v = Math.round(Number(m[2]) * 100);
      return m[1] === '>' ? amount > v : amount < v;
    }
    m = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (m) return amount >= Math.round(Number(m[1]) * 100) && amount <= Math.round(Number(m[2]) * 100);
    const n = Number(s);
    if (Number.isNaN(n)) return true;
    return amount === Math.round(n * 100);
  }
  function queryNoteText(e) {
    const tags = (e.tagIds || []).map((id) => TV.dict.renderTag(S.dict, id, 'PLAIN', S.lang)).join(' ');
    return [tags, e.domain || 'P'].filter(Boolean).join(' ').toLowerCase();
  }
  function queryFilter(state) {
    const q = state || {};
    return (S.events || []).filter((e) => {
      if (q.dateFrom && e.date < q.dateFrom) return false;
      if (q.dateTo && e.date > q.dateTo) return false;
      if (!queryMatchNode(e.from, q.from)) return false;
      if (!queryMatchNode(e.to, q.to)) return false;
      if (!queryAmountMatch(e.amountCents, q.amount)) return false;
      if (q.note && !queryNoteText(e).includes(String(q.note).toLowerCase())) return false;
      return true;
    });
  }

  function queryField(label, input) {
    return el('label', { class: 'q-field' }, [el('span', {}, [label]), input]);
  }

  function buildQueryPanel(grid, def, state, index) {
    const panel = el('section', { class: 'q-panel', dataset: { query: def.key } });
    const head = el('div', { class: 'q-head' }, [
      el('span', { class: 'q-title' }, [t('ledgerQuery') + ' ' + def.key]),
    ]);
    const clear = el('button', { class: 'q-clear', type: 'button' }, [t('clear')]);
    const total = el('span', { class: 'q-total' }, ['¥0.00']);
    head.appendChild(clear);
    head.appendChild(total);

    const filters = el('div', { class: 'q-filters' });
    const date = el('input', { class: 'q-input', type: 'text', placeholder: 'YYMMDD / YYMM / YY', maxlength: '17' });
    date.value = state.dateText || '';
    const from = el('input', { class: 'q-input', type: 'text', placeholder: t('fromNode') });
    from.value = state.from || '';
    const to = el('input', { class: 'q-input', type: 'text', placeholder: t('toNode') });
    to.value = state.to || '';
    const amount = el('input', { class: 'q-input', type: 'text', placeholder: t('amountShort') });
    amount.value = state.amount || '';
    const note = el('input', { class: 'q-input', type: 'text', placeholder: t('noteSearch') || t('tag') });
    note.value = state.note || '';

    filters.appendChild(queryField(t('dateShort'), date));
    filters.appendChild(queryField(t('fromNode'), from));
    filters.appendChild(queryField(t('toNode'), to));
    filters.appendChild(queryField(t('amountShort'), amount));
    filters.appendChild(queryField(t('noteSearch'), note));

    const table = el('div', { class: 'q-table' });
    panel.appendChild(head);
    panel.appendChild(filters);
    panel.appendChild(table);
    grid.appendChild(panel);

    const ctl = { def, state, panel, table, total, date, from, to, amount, note, index };
    const render = () => renderQueryPanel(ctl);
    date.addEventListener('input', () => {
      state.dateText = date.value;
      const r = queryDateRange(date.value);
      state.dateFrom = r.from; state.dateTo = r.to;
      render();
    });
    from.addEventListener('input', () => { state.from = from.value; render(); });
    to.addEventListener('input', () => { state.to = to.value; render(); });
    amount.addEventListener('input', () => { state.amount = amount.value; render(); });
    note.addEventListener('input', () => { state.note = note.value; render(); });
    clear.addEventListener('click', () => {
      Object.assign(state, { dateText: '', dateFrom: '', dateTo: '', from: '', to: '', amount: '', note: '' });
      date.value = ''; from.value = ''; to.value = ''; amount.value = ''; note.value = '';
      render();
    });
    render();
    return ctl;
  }

  function renderQueryPanel(panel) {
    if (!panel) return;
    const rows = queryFilter(panel.state);
    const sum = rows.reduce((s, e) => s + (Number(e.amountCents) || 0), 0);
    panel.total.textContent = TV.amount.formatPlain(sum);
    clear(panel.table);
    panel.table.appendChild(el('div', { class: 'q-row is-head' }, [
      el('span', {}, [t('seq')]),
      el('span', {}, [t('dateShort')]),
      el('span', {}, [t('fromNode')]),
      el('span', {}, [t('toNode')]),
      el('span', { class: 'q-num' }, [t('amountShort')]),
      el('span', {}, [t('colNote')]),
    ]));
    if (!rows.length) {
      panel.table.appendChild(el('div', { class: 'q-empty' }, [t('noRows')]));
      return;
    }
    rows.forEach((e, i) => {
      const fromText = TV.dict.renderNode(S.dict, e.from, S.mode, S.lang);
      const toText = TV.dict.renderNode(S.dict, e.to, S.mode, S.lang);
      const noteText = (e.tagIds || []).map((id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join(' ');
      panel.table.appendChild(el('div', { class: 'q-row' }, [
        el('span', { class: 'q-muted' }, [String(i + 1)]),
        el('span', { class: 'q-muted' }, [e.date]),
        el('span', { class: 'q-cell' }, [fromText]),
        el('span', { class: 'q-cell' }, [toText]),
        el('span', { class: 'q-num' }, [e.minutes > 0 ? TV.amount.formatTime(e.minutes) : TV.amount.formatPlain(e.amountCents)]),
        el('span', { class: 'q-cell q-muted' }, [noteText || '—']),
      ]));
    });
  }

  function ensureQuery() {
    if (queryCtl && queryCtl.lang === S.lang) return;
    ensureQueryState();
    queryCtl = null;
    clear(dom.queryView);
    const grid = el('div', { class: 'q-grid' });
    dom.queryView.appendChild(grid);
    const panels = QUERY_PANELS.map((def, i) => buildQueryPanel(grid, def, S.queries[i], i));
    queryCtl = { lang: S.lang, panels };
  }

  function renderQuery() {
    if (!S.dict) return;
    ensureQuery();
    (queryCtl.panels || []).forEach((p) => renderQueryPanel(p));
  }

  /* ---------------- 固定页 ---------------- */
  function fixedSource() {
    const body = TV.rules.serializeBlocks(S.plans || [], S.rules || []).trim();
    return '// 固定收支与规则 · [PLAN] 固定收支 / [RULES] 自动规则\n'
      + (body ? body + '\n' : '');
  }

  function ensureFixed() {
    if (fixedCtl) return;
    clear(dom.fixedView);
    const inner = el('div', { class: 'fixed-inner' });
    const head = el('div', { class: 'fixed-head' }, [
      el('div', { class: 'fixed-title' }, [t('fixedTitle')]),
    ]);
    const note = el('div', { class: 'fixed-note' }, [t('fixedHint')]);
    const host = el('div', { class: 'fixed-editor' });
    inner.appendChild(head);
    inner.appendChild(note);
    inner.appendChild(host);
    dom.fixedView.appendChild(inner);
    if (TV.editor && TV.editor.defineModes) TV.editor.defineModes();
    const cm = CodeMirror(host, {
      value: fixedSource(),
      mode: 'txtvein-ledger',
      theme: 'txtvein',
      lineNumbers: true,
      lineWrapping: false,
      tabSize: 2,
      indentUnit: 2,
    });
    let timer = 0;
    cm.on('change', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const parsed = TV.rules.parseBlocks(cm.getValue());
        S.plans = parsed.plans || [];
        S.rules = parsed.rules || [];
        scheduleSave();
        renderHUD();
        if (parsed.warnings && parsed.warnings.length) {
          updateFeedback(parsed.warnings[0], 'error');
        }
      }, 320);
    });
    fixedCtl = { cm, note, head };
    setTimeout(() => cm.refresh(), 0);
  }

  function renderFixed() {
    ensureFixed();
    fixedCtl.head.firstChild.textContent = t('fixedTitle');
    fixedCtl.note.textContent = t('fixedHint');
    setTimeout(() => fixedCtl.cm.refresh(), 0);
  }

  function renderFixedHint() {
    if (fixedCtl) {
      fixedCtl.head.firstChild.textContent = t('fixedTitle');
      fixedCtl.note.textContent = t('fixedHint');
    }
  }

  /* ---------------- 反馈栏 ---------------- */
  function defaultFeedback() {
    const base = t('feedbackHint');
    if (!lastEditorStatus || (S.view !== 'ledger' && S.view !== 'dict')) return base;
    const name = lastEditorStatus.file === 'dict' ? 'dict.tv' : 'ledger.tv';
    const state = lastEditorStatus.errors
      ? (S.lang === 'en' ? lastEditorStatus.errors + ' errors' : lastEditorStatus.errors + ' 个错误')
      : (S.lang === 'en' ? 'syntax OK' : '语法 OK');
    return name + ' · Ln ' + lastEditorStatus.line + ', Col ' + lastEditorStatus.col + ' · ' + state + ' · ' + base;
  }

  function updateFeedback(msg, type, action) {
    if (!dom.feedback) return;
    clearTimeout(feedbackTimer);
    feedbackHold = !!msg;
    feedbackFn = action && action.fn ? action.fn : null;
    dom.feedback.classList.toggle('is-error', type === 'error');
    dom.feedback.classList.toggle('is-ok', type === 'ok');
    dom.feedbackText.textContent = msg || defaultFeedback();
    if (action && action.label && msg) {
      dom.feedbackAction.hidden = false;
      dom.feedbackAction.textContent = action.label;
    } else {
      dom.feedbackAction.hidden = true;
      dom.feedbackAction.textContent = '';
    }
    if (msg) {
      feedbackTimer = setTimeout(() => {
        feedbackHold = false;
        feedbackFn = null;
        dom.feedback.classList.remove('is-error', 'is-ok');
        dom.feedbackText.textContent = defaultFeedback();
        dom.feedbackAction.hidden = true;
      }, 4800);
    }
  }


  function renderReport() {
    if (!S.dict) return;
    ensureReport();
    const rep = TV.report.buildReport(S.dict, S.events, {
      range: S.range, domain: S.domain, lang: S.lang, now: new Date(),
    });
    const dictIssues = D.validateDict(S.dict).issues.filter((x) => x.level !== 'warn');
    rep.issues = (rep.issues || []).concat(dictIssues);
    renderStatsPage();
  }

  function treeDescendants(map, id) {
    const out = new Set();
    const walk = (pid) => {
      Object.keys(map || {}).forEach((x) => {
        if (map[x].parent_id === pid && !out.has(x)) { out.add(x); walk(x); }
      });
    };
    walk(id);
    return out;
  }

  function refreshDictSource() {
    if (!S.dict) return;
    S.dictSource = TV.source.dictToSource(S.dict);
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    S.calcAll = calcMod.compute(S.dict, S.events, { range: null });
    scheduleSave();
  }

  function mergeTreeItem(kind, source, target) {
    const d = S.dict;
    const map = kind === 'behavior' ? d.behaviors : d.tags;
    if (!map[source] || !map[target] || source === target) return { ok: false, error: '目标不存在' };
    const src = map[source];
    Object.keys(map).forEach((id) => {
      if (map[id].parent_id === source) map[id].parent_id = target;
    });
    if (kind === 'behavior') {
      (S.behaviors || []).forEach((b) => {
        if (b.from === source) b.from = target;
        if (b.to === source) b.to = target;
      });
    } else {
      (S.notes || []).forEach((n) => {
        if (n.categoryId === source) n.categoryId = target;
        n.keywordIds = (n.keywordIds || []).map((id) => (id === source ? target : id));
        n.tagIds = (n.tagIds || []).map((id) => (id === source ? target : id));
      });
      (S.events || []).forEach((e) => { e.tagIds = (e.tagIds || []).map((id) => (id === source ? target : id)); });
      (S.behaviors || []).forEach((b) => { b.tagIds = (b.tagIds || []).map((id) => (id === source ? target : id)); });
    }
    Object.keys(d.aliases || {}).forEach((k) => {
      const arr = d.aliases[k] || [];
      if (!arr.includes(source)) return;
      d.aliases[k] = arr.filter((x) => x !== source);
      if (!d.aliases[k].includes(target)) d.aliases[k].push(target);
    });
    [src.zh_code, src.en_code, src.zh_name, src.en_name].forEach((k) => {
      if (k) D.addAlias(d, k, target);
    });
    delete map[source];
    d.meta.updatedAt = new Date().toISOString();
    return { ok: true };
  }

  function openTreeEditor(kind, id) {
    const d = S.dict;
    const map = kind === 'behavior' ? d.behaviors : d.tags;
    const item = map && map[id];
    if (!item) return;
    const label = kind === 'behavior' ? '行为项' : '备注标签';
    const name = kind === 'behavior'
      ? TV.dict.renderBehavior(d, id, S.mode, S.lang)
      : TV.dict.renderTag(d, id, S.mode, S.lang);
    const excluded = treeDescendants(map, id);
    excluded.add(id);
    const candidates = Object.keys(map).filter((x) => !excluded.has(x));
    const opt = (value, text, selected) => {
      const attrs = { value };
      if (selected) attrs.selected = 'selected';
      return el('option', attrs, [text]);
    };
    const parentSel = el('select', { class: 'repair-input' }, [opt('', '（根）', !item.parent_id)]
      .concat(candidates.map((x) => opt(x,
        (kind === 'behavior' ? TV.dict.renderBehavior(d, x, S.mode, S.lang) : TV.dict.renderTag(d, x, S.mode, S.lang)),
        item.parent_id === x))));
    const mergeSel = el('select', { class: 'repair-input' }, [opt('', '选择目标…', true)]
      .concat(candidates.map((x) => opt(x,
        (kind === 'behavior' ? TV.dict.renderBehavior(d, x, S.mode, S.lang) : TV.dict.renderTag(d, x, S.mode, S.lang))))));

    const body = [
      el('div', { class: 'tree-edit-head' }, [
        el('b', {}, [name]),
        el('code', {}, [item.zh_code || item.en_code || id]),
        el('span', {}, [label]),
      ]),
      el('label', { class: 'repair-field' }, [el('span', {}, ['重挂父级（改分支）']), parentSel]),
      el('div', { class: 'help-text' }, ['父级只能选同类型的节点；移动到根就选「（根）」。']),
      el('label', { class: 'repair-field' }, [el('span', {}, ['合并到']), mergeSel]),
      el('div', { class: 'help-text' }, ['合并后：子节点、行为边、备注引用、标签引用都改指目标；旧 code 保留为目标别名。']),
    ];
    const save = el('button', { class: 'btn-primary', type: 'button' }, ['保存父级']);
    save.addEventListener('click', () => {
      map[id].parent_id = parentSel.value || '';
      d.meta.updatedAt = new Date().toISOString();
      refreshDictSource();
      panels.close();
      renderReport();
      toast('已重挂父级', 'ok');
    });
    const merge = el('button', { class: 'btn-danger', type: 'button' }, ['合并到所选']);
    merge.addEventListener('click', () => {
      const target = mergeSel.value;
      if (!target) { toast('先选择合并目标', 'error'); return; }
      panels.confirm(app, '合并' + label,
        '把「' + name + '」合并到目标？子节点、行为/备注引用会改指目标，旧 code 保留为别名。',
        () => {
          const r = mergeTreeItem(kind, id, target);
          if (!r.ok) { toast(r.error || '合并失败', 'error'); return; }
          refreshDictSource();
          renderReport();
          toast('已合并', 'ok');
        });
    });
    const close = el('button', { class: 'btn', type: 'button' }, ['关闭']);
    close.addEventListener('click', () => panels.close());
    panels.open('编辑' + label, body, [
      close,
      el('span', { class: 'grow' }),
      merge,
      save,
    ]);
  }

  function statsTreeView(items, countMap, renderName, fmt, kind) {
    const children = new Map();
    const roots = [];
    Object.keys(items || {}).forEach((id) => {
      const pid = items[id].parent_id;
      if (pid && items[pid]) {
        if (!children.has(pid)) children.set(pid, []);
        children.get(pid).push(id);
      } else {
        roots.push(id);
      }
    });
    const memo = new Map();
    function total(id, stack) {
      if (memo.has(id)) return memo.get(id);
      const s = stack || new Set();
      if (s.has(id)) return { ids: new Set(), weights: new Map() };
      s.add(id);
      const out = { ids: new Set(), weights: new Map() };
      const own = countMap[id];
      if (own) {
        own.ids.forEach((x) => out.ids.add(x));
        own.weights.forEach((w, k) => out.weights.set(k, w));
      }
      (children.get(id) || []).forEach((k) => {
        const x = total(k, s);
        x.ids.forEach((n) => out.ids.add(n));
        x.weights.forEach((w, key) => out.weights.set(key, w));
      });
      s.delete(id);
      memo.set(id, out);
      return out;
    }
    const host = el('div', { class: 'behavior-tree' });
    let rendered = 0;
    function walk(id, depth) {
      const a = total(id, new Set());
      const childHas = (children.get(id) || []).some((k) => total(k, new Set()).ids.size > 0);
      if (!a.ids.size && !childHas) return;
      rendered += 1;
      const weight = Array.from(a.weights.values()).reduce((s, x) => s + x, 0);
      host.appendChild(el('div', { class: 'bt-row', dataset: { kind, id }, style: 'padding-left:' + (depth * 14) + 'px' }, [
        el('span', { class: 'bt-name' }, [renderName(id)]),
        el('span', { class: 'bt-count' }, [fmt(a.ids.size, weight)]),
      ]));
      const row = host.lastChild;
      row.addEventListener('click', () => openTreeEditor(kind, id));
      (children.get(id) || []).slice(0, 12).forEach((k) => walk(k, depth + 1));
    }
    roots.sort((a, b) => total(b, new Set()).ids.size - total(a, new Set()).ids.size
      || String(renderName(a)).localeCompare(String(renderName(b))));
    roots.forEach((id) => walk(id, 0));
    if (!rendered) host.appendChild(el('div', { class: 'bt-empty' }, ['（还没有条目）']));
    return host;
  }

  function statsPanel(host, title, subtitle) {
    const head = el('div', { class: 'stats-panel-head' }, [
      el('b', {}, [title]),
      el('span', {}, [subtitle || '']),
    ]);
    const body = el('div', { class: 'stats-panel-body' });
    host.appendChild(head);
    host.appendChild(body);
    return { head, body };
  }

  function renderBehaviorColumn(host) {
    const behaviors = S.behaviors || [];
    const total = behaviors.reduce((s, b) => s + (Number(b.weight) || 0), 0);
    const panel = statsPanel(host, '行为统计', behaviors.length + ' 条 · 强度 ' + total);
    if (!behaviors.length) {
      panel.body.appendChild(el('div', { class: 'bt-empty' }, ['（还没有行为记录）']));
      return;
    }
    const bCounts = {};
    behaviors.forEach((b) => {
      [b.from, b.to].forEach((id) => {
        bCounts[id] = bCounts[id] || { ids: new Set(), weights: new Map() };
        bCounts[id].ids.add(b.id);
        bCounts[id].weights.set(b.id, Number(b.weight) || 0);
      });
    });
    panel.body.appendChild(el('div', { class: 'stats-facts' }, [
      el('span', {}, ['总强度 ', el('b', {}, [String(total)])]),
      el('span', {}, ['行为项 ', el('b', {}, [String(Object.keys(S.dict.behaviors || {}).length)])]),
    ]));
    panel.body.appendChild(el('div', { class: 'stats-subhead' }, ['行为树']));
    panel.body.appendChild(statsTreeView(S.dict.behaviors || {}, bCounts,
      (id) => TV.dict.renderBehavior(S.dict, id, S.mode, S.lang),
      (n, w) => n + '次 / ' + w + '强度', 'behavior'));
    panel.body.appendChild(el('div', { class: 'stats-subhead' }, ['最近行为']));
    const list = el('div', { class: 'behavior-list' });
    behaviors.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-40).reverse().forEach((b) => {
      list.appendChild(el('div', { class: 'behavior-row' }, [
        el('span', { class: 'b-date' }, [b.date]),
        el('span', { class: 'b-from' }, [TV.dict.renderBehavior(S.dict, b.from, S.mode, S.lang)]),
        el('span', { class: 'b-arrow' }, ['>']),
        el('span', { class: 'b-to' }, [TV.dict.renderBehavior(S.dict, b.to, S.mode, S.lang)]),
        el('span', { class: 'b-weight' }, ['×' + (b.weight || 1)]),
      ]));
    });
    panel.body.appendChild(list);
  }

  function renderNotesColumn(host) {
    const notes = (S.notes || []).filter((x) => x.kind === 'note');
    const total = notes.reduce((s, n) => s + (Number(n.amountCents) || 0), 0);
    const panel = statsPanel(host, '备注统计', notes.length + ' 条' + (total ? ' · ' + amount.formatPlain(total) : ''));
    if (!notes.length) {
      panel.body.appendChild(el('div', { class: 'bt-empty' }, ['（还没有备注）']));
      return;
    }
    const byCat = {};
    const nCounts = {};
    notes.forEach((n) => {
      const cat = n.categoryId && S.dict.tags[n.categoryId]
        ? TV.dict.renderTag(S.dict, n.categoryId, S.mode, S.lang) : '未分类';
      byCat[cat] = byCat[cat] || { n: 0, cents: 0, keys: {} };
      byCat[cat].n += 1;
      byCat[cat].cents += Number(n.amountCents) || 0;
      [n.categoryId].concat(n.keywordIds || []).filter(Boolean).forEach((id) => {
        nCounts[id] = nCounts[id] || { ids: new Set(), weights: new Map() };
        nCounts[id].ids.add(n.id);
        nCounts[id].weights.set(n.id, Number(n.amountCents) || 0);
      });
      (n.keywordIds || []).forEach((id) => {
        const k = TV.dict.renderTag(S.dict, id, S.mode, S.lang);
        byCat[cat].keys[k] = (byCat[cat].keys[k] || 0) + 1;
      });
    });
    panel.body.appendChild(el('div', { class: 'stats-subhead' }, ['分类汇总']));
    const summary = el('div', { class: 'stats-summary' });
    Object.keys(byCat).forEach((cat) => {
      const x = byCat[cat];
      const keys = Object.keys(x.keys).map((k) => k + ' ' + x.keys[k]).join(' / ');
      summary.appendChild(el('div', { class: 'stats-summary-row' }, [
        el('span', {}, [cat]),
        el('span', {}, [x.n + '次' + (x.cents ? ' / ' + amount.formatPlain(x.cents) : '')]),
        el('small', {}, [keys]),
      ]));
    });
    panel.body.appendChild(summary);
    panel.body.appendChild(el('div', { class: 'stats-subhead' }, ['备注树']));
    panel.body.appendChild(statsTreeView(S.dict.tags || {}, nCounts,
      (id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang),
      (n, w) => n + '次 / ' + amount.formatPlain(w), 'tag'));
    panel.body.appendChild(el('div', { class: 'stats-subhead' }, ['最近备注']));
    const list = el('div', { class: 'note-list' });
    notes.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-40).reverse().forEach((n) => {
      const cat = n.categoryId ? TV.dict.renderTag(S.dict, n.categoryId, S.mode, S.lang) : '未分类';
      const kws = (n.keywordIds || []).map((id) => TV.dict.renderTag(S.dict, id, S.mode, S.lang)).join(' ');
      list.appendChild(el('div', { class: 'note-row' }, [
        el('span', { class: 'n-date' }, [n.date]),
        el('span', { class: 'n-cat' }, [cat]),
        el('span', { class: 'n-kw' }, [kws]),
        el('span', { class: 'n-amt' }, [amount.formatPlain(n.amountCents || 0)]),
      ]));
    });
    panel.body.appendChild(list);
  }

  function renderStatsColumns() {
    const inner = dom.reportView.querySelector('.report-inner');
    if (!inner) return;
    const grid = el('div', { class: 'stats-grid' });
    const acc = el('section', { class: 'stats-col stats-accounting' });
    acc.appendChild(inner);
    const beh = el('section', { class: 'stats-col stats-behavior' });
    const notes = el('section', { class: 'stats-col stats-notes' });
    renderBehaviorColumn(beh);
    renderNotesColumn(notes);
    grid.appendChild(acc);
    grid.appendChild(beh);
    grid.appendChild(notes);
    dom.reportView.appendChild(grid);
  }

  const STAT_TYPE_COLS = {
    收入: [['期初累计', 'opening'], ['本期收入', 'inc'], ['本期退回', 'dec'], ['期末累计', 'closing']],
    负债: [['期初余额', 'opening'], ['本期新增', 'inc'], ['本期偿还', 'dec'], ['期末余额', 'closing']],
    权益: [['期初余额', 'opening'], ['本期增加', 'inc'], ['本期减少', 'dec'], ['期末余额', 'closing']],
    资产: [['期初余额', 'opening'], ['本期流入', 'inc'], ['本期流出', 'dec'], ['期末余额', 'closing']],
    费用: [['本期累计', 'closing'], ['本期支出', 'inc'], ['本期退回', 'dec'], ['本期净出', 'net']],
    成本: [['期初净值', 'opening'], ['本期新增', 'inc'], ['本期消耗', 'dec'], ['期末净值', 'closing']],
  };
  const STAT_TYPE_EN = { 收入: 'Income', 负债: 'Liabilities', 权益: 'Equity', 资产: 'Assets', 费用: 'Expenses', 成本: 'Cost' };
  const STAT_COL_EN = { opening: 'Opening', inc: 'In', dec: 'Out', closing: 'Closing', net: 'Net' };
  const STAT_TABS = [
    { id: 'category', label: 'category' },
    { id: 'node', label: 'node' },
    { id: 'note', label: 'note' },
    { id: 'event', label: 'event' },
  ];

  function statsYear() { return String(Number(S.stats.year || new Date().getFullYear()) % 100).padStart(2, '0'); }
  function statsMonthRange() {
    const yy = statsYear();
    const m = Number(S.stats.month) || 0;
    if (!m) return { start: yy + '0101', end: yy + '1231', all: true };
    const mm = q2(m);
    return { start: yy + mm + '01', end: yy + mm + queryMonthEnd(yy, mm), all: false };
  }
  function statsDateIn(date, range) { return String(date) >= range.start && String(date) <= range.end; }
  function statsCalc() { return calcMod.compute(S.dict, S.events, { range: statsMonthRange() }); }
  function statsTypeValue(row, key) {
    if (key === 'net') return (Number(row.closing) || 0) - (Number(row.opening) || 0);
    return Number(row[key]) || 0;
  }
  function statsMoney(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const yuan = Math.abs(n) / 100;
    const rounded = Math.round(yuan * 10) / 10;
    const whole = rounded % 1 === 0;
    const text = whole ? rounded.toFixed(0) : rounded.toFixed(1);
    return (neg ? '-¥' : '¥') + text;
  }
  function statsTagLabel(id) { return TV.dict.renderTag(S.dict, id, S.mode, S.lang); }
  function statsNodeLabel(id) { return TV.dict.renderNode(S.dict, id, S.mode, S.lang); }
  function statsTypeLabel(type) { return S.lang === 'en' ? (STAT_TYPE_EN[type] || type) : type; }
  function statsColLabel(col) { return S.lang === 'en' ? (STAT_COL_EN[col[1]] || col[0]) : col[0]; }

  function statsTable(headers, rows, template, opts) {
    const o = opts || {};
    const nums = o.numCols || [];
    const wrap = el('div', { class: 'stats-table' });
    const head = el('div', { class: 'sd-row is-head', style: 'grid-template-columns:' + template });
    headers.forEach((h, i) => {
      const cell = el('span', {
        class: (nums.includes(i) ? 'sd-num' : '') + (i === 0 && o.resizable ? ' sd-head-first' : ''),
      }, [h]);
      if (i === 0 && o.resizable) {
        const grip = el('i', { class: 'col-grip' });
        grip.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const page = wrap.closest('.stats-page');
          const startX = ev.clientX;
          const start = Number(S.stats.first) || 80;
          const move = (e) => {
            const w = Math.max(50, Math.min(260, start + e.clientX - startX));
            S.stats.first = Math.round(w);
            if (page) page.style.setProperty('--stats-first', S.stats.first + 'px');
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            try { localStorage.setItem('txtvein:stats-first', String(S.stats.first)); } catch (e) { /* ignore */ }
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        });
        cell.appendChild(grip);
      }
      head.appendChild(cell);
    });
    wrap.appendChild(head);
    if (!rows.length) {
      wrap.appendChild(el('div', { class: 'sd-empty' }, [o.empty || t('noRows')]));
      return wrap;
    }
    rows.forEach((row) => {
      const line = el('div', {
        class: 'sd-row' + (o.selected && o.selected === row.id ? ' is-active' : ''),
        style: 'grid-template-columns:' + template,
      });
      row.cells.forEach((v, ci) => line.appendChild(el('span', { class: nums.includes(ci) ? 'sd-num' : '' }, [v])));
      if (o.onClick) {
        line.dataset.id = row.id;
        line.addEventListener('click', () => o.onClick(row));
      }
      wrap.appendChild(line);
    });
    return wrap;
  }

  function statsLeftCategory(host, calc) {
    const order = ['收入', '负债', '权益', '资产', '费用', '成本'];
    order.forEach((type) => {
      const cols = STAT_TYPE_COLS[type] || STAT_TYPE_COLS['资产'];
      const rows = (calc.rows || []).filter((r) => r.node && r.node.type === type);
      if (!rows.length) return;
      const group = el('section', { class: 'lst-group' });
      const total = rows.reduce((s, r) => s + (Number(r.closing) || 0), 0);
      group.appendChild(el('div', { class: 'lst-group-head' }, [
        el('b', {}, [statsTypeLabel(type)]),
        el('span', {}, [statsMoney(total)]),
      ]));
      const lineRows = rows.map((r) => ({
        id: r.id,
        cells: [statsNodeLabel(r.id)].concat(cols.map((c) => statsMoney(statsTypeValue(r, c[1])))),
      }));
      group.appendChild(statsTable([S.lang === 'en' ? 'Category' : '分类'].concat(cols.map((c) => statsColLabel(c))), lineRows,
        'var(--stats-first, 80px) repeat(4,minmax(0,1fr))',
        { numCols: [1, 2, 3, 4], resizable: true, selected: S.stats.selected, onClick: (row) => { S.stats.selected = row.id; S.stats.pane = 'detail'; renderStatsPage(); } }));
      host.appendChild(group);
    });
  }

  function statsLeftNode(host, calc) {
    const rows = (calc.rows || []).filter((r) => r.node).map((r) => ({
      id: r.id,
      cells: [r.node.type || '', statsNodeLabel(r.id),
        statsMoney(r.opening || 0), statsMoney(r.inc || 0),
        statsMoney(r.dec || 0), statsMoney(r.closing || 0)],
    }));
    host.appendChild(statsTable(S.lang === 'en' ? ['Type', 'Node', 'Opening', 'In', 'Out', 'Closing'] : ['类型', '节点', '期初', '流入', '流出', '期末'], rows,
      'var(--stats-first, 80px) minmax(58px,1.1fr) repeat(4,minmax(0,1fr))',
      { numCols: [2, 3, 4, 5], resizable: true, selected: S.stats.selected, onClick: (row) => { S.stats.selected = row.id; S.stats.pane = 'detail'; renderStatsPage(); } }));
  }

  function statsLeftNote(host, range) {
    const notes = (S.notes || []).filter((n) => n.kind === 'note' && statsDateIn(n.date, range));
    const map = new Map();
    notes.forEach((n) => {
      [n.categoryId].concat(n.keywordIds || []).filter(Boolean).forEach((id) => {
        if (!map.has(id)) map.set(id, { n: 0, cents: 0 });
        const x = map.get(id); x.n += 1; x.cents += Number(n.amountCents) || 0;
      });
    });
    if (!map.size) Object.keys(S.dict.tags || {}).forEach((id) => map.set(id, { n: 0, cents: 0 }));
    const rows = Array.from(map.entries()).map(([id, x]) => ({
      id,
      cells: [statsTagLabel(id), String(x.n), statsMoney(x.cents)],
    }));
    host.appendChild(statsTable(S.lang === 'en' ? ['Tag', 'Count', 'Amount'] : ['标签', '次数', '金额'], rows, 'var(--stats-first, 90px) 52px 90px',
      { numCols: [2], resizable: true, selected: S.stats.selected, onClick: (row) => { S.stats.selected = row.id; S.stats.pane = 'detail'; renderStatsPage(); } }));
  }

  function statsLeftEvent(host, range) {
    const behaviors = (S.behaviors || []).filter((b) => statsDateIn(b.date, range));
    const map = new Map();
    behaviors.forEach((b) => {
      [b.from, b.to].filter(Boolean).forEach((id) => {
        if (!map.has(id)) map.set(id, { n: 0, weight: 0 });
        const x = map.get(id); x.n += 1; x.weight += Number(b.weight) || 0;
      });
    });
    Object.keys(S.dict.behaviors || {}).forEach((id) => {
      if (!map.has(id)) map.set(id, { n: 0, weight: 0 });
    });
    const rows = Array.from(map.entries()).map(([id, x]) => ({
      id,
      cells: [TV.dict.renderBehavior(S.dict, id, S.mode, S.lang), String(x.n), String(x.weight)],
    }));
    host.appendChild(statsTable(S.lang === 'en' ? ['Behavior', 'Count', 'Weight'] : ['行为项', '次数', '强度'], rows, 'var(--stats-first, 90px) 52px 58px',
      { numCols: [1, 2], resizable: true, selected: S.stats.selected, onClick: (row) => { S.stats.selected = row.id; S.stats.pane = 'detail'; renderStatsPage(); } }));
  }

  function statsRightEvents(selected, range) {
    const evs = (S.events || []).filter((e) => (e.from === selected || e.to === selected) && statsDateIn(e.date, range));
    const rows = evs.slice().reverse().map((e, i) => ({
      id: e.id || String(i),
      cells: [String(i + 1), e.date,
        statsNodeLabel(e.from), statsNodeLabel(e.to),
        e.minutes > 0 ? TV.amount.formatTime(e.minutes) : statsMoney(e.amountCents),
        (e.tagIds || []).map((id) => statsTagLabel(id)).join(' ') || '—'],
    }));
    return statsTable(S.lang === 'en' ? ['#', 'Date', 'From', 'To', 'Amount', 'Note'] : ['序', '日期', '转出', '转入', '金额', '备注'], rows,
      '30px 58px minmax(50px,1fr) minmax(50px,1fr) 68px minmax(50px,.8fr)',
      { numCols: [4], empty: S.lang === 'en' ? 'Pick a category on the left, or type a name/initial' : '点左侧分类，或输入名字/首字母' });
  }

  function statsRightNotes(selected, range) {
    const notes = (S.notes || []).filter((n) => n.kind === 'note' && statsDateIn(n.date, range)
      && (n.categoryId === selected || (n.keywordIds || []).includes(selected)));
    const rows = notes.slice().reverse().map((n, i) => ({
      id: n.id || String(i),
      cells: [String(i + 1), n.date, n.categoryId ? statsTagLabel(n.categoryId) : '—',
        (n.keywordIds || []).map((id) => statsTagLabel(id)).join(' ') || '—',
        statsMoney(n.amountCents || 0)],
    }));
    return statsTable(S.lang === 'en' ? ['#', 'Date', 'Category', 'Keyword', 'Amount'] : ['序', '日期', '分类', '关键词', '金额'], rows,
      '30px 58px minmax(46px,.8fr) minmax(50px,1fr) 68px', { numCols: [4], empty: S.lang === 'en' ? 'Pick a note tag on the left' : '点左侧备注标签查看明细' });
  }

  function statsRightBehaviors(selected, range) {
    const rows = (S.behaviors || []).filter((b) => (b.from === selected || b.to === selected) && statsDateIn(b.date, range))
      .slice().reverse().map((b, i) => ({
        id: b.id || String(i),
        cells: [String(i + 1), b.date,
          TV.dict.renderBehavior(S.dict, b.from, S.mode, S.lang),
          TV.dict.renderBehavior(S.dict, b.to, S.mode, S.lang),
          '×' + (b.weight || 1),
          (b.tagIds || []).map((id) => statsTagLabel(id)).join(' ') || '—'],
      }));
    return statsTable(S.lang === 'en' ? ['#', 'Date', 'From', 'To', 'Weight', 'Tags'] : ['序', '日期', '转出', '转入', '强度', '标签'], rows,
      '30px 58px minmax(46px,1fr) minmax(46px,1fr) 34px minmax(46px,.8fr)', { numCols: [4], empty: S.lang === 'en' ? 'Pick a behavior on the left' : '点左侧行为项查看明细' });
  }

  function renderStatsPage() {
    if (!S.stats) S.stats = { tab: 'category', month: new Date().getMonth() + 1, selected: '', split: 380 };
    if (!S.stats.first) {
      const savedFirst = Number(localStorage.getItem('txtvein:stats-first'));
      S.stats.first = Number.isFinite(savedFirst) && savedFirst >= 50 ? savedFirst : 80;
    }
    const range = statsMonthRange();
    const calc = statsCalc();
    clear(dom.reportView);
    const page = el('div', { class: 'stats-page' });
    page.dataset.pane = S.stats.pane || 'list';
    page.style.setProperty('--stats-first', (Number(S.stats.first) || 80) + 'px');
    const top = el('div', { class: 'stats-top' });
    const tabsWrap = el('div', { class: 'stats-tabs-wrap' });
    tabsWrap.appendChild(el('b', { class: 'stats-title' }, [t('statsTitle')]));
    const tabs = el('div', { class: 'stats-tabs' });
    STAT_TABS.forEach((tab) => {
      const b = el('button', { class: 'stats-tab' + (S.stats.tab === tab.id ? ' is-active' : ''), type: 'button' }, [t(tab.label)]);
      b.addEventListener('click', () => { S.stats.tab = tab.id; S.stats.selected = ''; S.stats.pane = 'list'; renderStatsPage(); });
      tabs.appendChild(b);
    });
    tabsWrap.appendChild(tabs);
    const topRow = el('div', { class: 'stats-top-row' });
    const months = el('div', { class: 'stats-months' });
    const yearInput = el('input', { class: 'stats-year-input', type: 'text', inputmode: 'numeric', maxlength: '4', title: '年份' });
    yearInput.value = String(S.stats.year || new Date().getFullYear());
    const applyYear = () => {
      let y = parseInt(yearInput.value, 10);
      if (!Number.isFinite(y)) y = new Date().getFullYear();
      if (y < 100) y += 2000;
      y = Math.max(1900, Math.min(2999, y));
      yearInput.value = String(y);
      if (y === Number(S.stats.year)) return;
      S.stats.year = y;
      S.stats.selected = '';
      S.stats.pane = 'list';
      renderStatsPage();
    };
    yearInput.addEventListener('change', applyYear);
    yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyYear(); yearInput.blur(); }
    });
    topRow.appendChild(tabsWrap);
    topRow.appendChild(yearInput);
    for (let m = 1; m <= 12; m += 1) {
      const b = el('button', { class: 'stats-month' + (Number(S.stats.month) === m ? ' is-active' : ''), type: 'button' }, [String(m)]);
      b.addEventListener('click', () => {
        S.stats.month = Number(S.stats.month) === m ? 0 : m;
        S.stats.selected = '';
        S.stats.pane = 'list';
        renderStatsPage();
      });
      months.appendChild(b);
    }
    top.appendChild(topRow);
    top.appendChild(months);

    const split = el('div', { class: 'stats-split' });
    const left = el('aside', { class: 'stats-left' });
    const gutter = el('div', { class: 'stats-gutter', title: '拖动调整宽度' });
    const right = el('main', { class: 'stats-right' });
    split.appendChild(left); split.appendChild(gutter); split.appendChild(right);

    left.appendChild(el('div', { class: 'stats-left-head' }, [
      el('b', {}, [t(S.stats.tab) + (S.lang === 'en' ? '' : '统计')]),
      el('span', {}, [t('statsSelect')]),
    ]));
    if (S.stats.tab === 'category') statsLeftCategory(left, calc);
    else if (S.stats.tab === 'node') statsLeftNode(left, calc);
    else if (S.stats.tab === 'note') statsLeftNote(left, range);
    else statsLeftEvent(left, range);

    const selectedName = S.stats.selected
      ? (S.stats.tab === 'note' ? statsTagLabel(S.stats.selected)
        : S.stats.tab === 'event' ? TV.dict.renderBehavior(S.dict, S.stats.selected, S.mode, S.lang)
          : statsNodeLabel(S.stats.selected))
      : '';
    const rh = el('div', { class: 'stats-right-head' });
    const back = el('button', { class: 'stats-back', type: 'button' }, ['‹ 返回']);
    back.addEventListener('click', () => { S.stats.pane = 'list'; renderStatsPage(); });
    rh.appendChild(back);
    rh.appendChild(el('b', {}, [t(S.stats.tab) + (S.lang === 'en' ? ' list' : '列表') + (selectedName ? ' · ' + selectedName : '')]));
    const clearBtn = el('button', { class: 'stats-clear', type: 'button' }, [t('clear')]);
    clearBtn.addEventListener('click', () => { S.stats.selected = ''; S.stats.pane = 'list'; renderStatsPage(); });
    rh.appendChild(clearBtn);
    right.appendChild(rh);

    if (!S.stats.selected) {
      right.appendChild(el('div', { class: 'stats-right-empty' }, [
        t('statsSelect'),
        el('small', {}, [S.lang === 'en' ? ' · Click any row on the left to show its full list' : ' · 点左侧任意一行，右侧显示对应完整列表']),
      ]));
    } else if (S.stats.tab === 'note') {
      right.appendChild(statsRightNotes(S.stats.selected, range));
    } else if (S.stats.tab === 'event') {
      right.appendChild(statsRightBehaviors(S.stats.selected, range));
    } else {
      right.appendChild(statsRightEvents(S.stats.selected, range));
    }

    page.appendChild(top);
    page.appendChild(split);
    dom.reportView.appendChild(page);
    const initialLeft = Math.min(Number(S.stats.split) || 430, Math.max(150, Math.round(window.innerWidth * 0.46)));
    split.style.gridTemplateColumns = initialLeft + 'px 5px minmax(0, 1fr)';
    gutter.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const move = (e) => {
        const box = split.getBoundingClientRect();
        const maxW = Math.min(560, Math.max(150, Math.round(box.width * 0.55)));
        const w = Math.max(150, Math.min(maxW, e.clientX - box.left));
        S.stats.split = Math.round(w);
        split.style.gridTemplateColumns = Math.round(w) + 'px 5px minmax(0, 1fr)';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        try { localStorage.setItem('txtvein:stats-left', String(S.stats.split)); } catch (e) { /* ignore */ }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  let reportCtl = null;
  function ensureReport() {
    if (!reportCtl) {
      reportCtl = TV.reportView.create(dom.reportView, {
        onRange: (text) => { S.range = text; renderReport(); renderHUD(); },
        onNodeClick: (id) => {
          S.filterNodeId = id;
          S.query.from = id || '';
          S.view = 'query';
          applyView();
          renderAll();
        },
      });
    }
  }

  function applyView() {
    const isEditor = S.view === 'ledger' || S.view === 'dict';
    dom.editorView.hidden = !isEditor;
    dom.queryView.hidden = S.view !== 'query';
    dom.fixedView.hidden = S.view !== 'fixed';
    dom.reportView.hidden = S.view !== 'report';
    renderTabs();
    if (isEditor) {
      ensureEditor();
      if (editorCtl) {
        editorCtl.setActive(S.view === 'dict' ? 'dict' : 'ledger');
        editorCtl.refresh();
      }
    } else if (S.view === 'query') {
      ensureQuery();
      renderQuery();
    } else if (S.view === 'fixed') {
      ensureFixed();
      renderFixed();
    } else if (S.view === 'report') {
      ensureReport();
      renderReport();
    }
    updateFeedback();
  }

  function renderAll() {
    if (!S.dict) return;
    S.calcAll = calcMod.compute(S.dict, S.events, { range: null });
    renderHUD();
    renderTabs();
    if (S.view === 'query') renderQuery();
    else if (S.view === 'fixed') renderFixed();
    else if (S.view === 'report') { ensureReport(); renderReport(); }
  }

  /* ---------------- 输入分析 / 气泡 ---------------- */

  function activeDomain(value) {
    const m = String(value || '').match(/^\s*(?:\[([PFCH])\]|([PFCH])\s)/i);
    return m ? (m[1] || m[2]).toUpperCase() : (S.domain || 'P');
  }

  function currentToken(value, caret) {
    const before = value.slice(0, caret);
    const m = before.match(/([^\s<>]*)$/);
    const token = m ? m[1] : '';
    const start = caret - token.length;
    let end = caret;
    while (end < value.length && !/[\s<>]/.test(value[end])) end += 1;
    return { token, start, end };
  }

  function analyzeInput(value, caret) {
    if (!S.dict) return { suggestions: [], state: 'STATE_FROM', hint: '' };
    const before = value.slice(0, caret);
    const { token, start, end } = currentToken(value, caret);
    const hasLt = before.includes('<');
    const gt = before.lastIndexOf('>');
    let role = 'from';
    let stateLabel = 'STATE_FROM';
    let hint = '转出节点 · wx1 / 微信钱包 / C:公司公户';
    if (hasLt) {
      role = 'tag';
      stateLabel = 'STATE_TAG';
      hint = '标签 · 空格同级，< 父子；#行内标签也可';
    } else if (gt >= 0) {
      const seg = before.slice(gt + 1);
      const toks = seg.trim() ? seg.trim().split(/[\s\u3000]+/) : [];
      if (toks.length <= 1) {
        role = 'to';
        stateLabel = 'STATE_TO';
        hint = '转入节点 · 支持 C: 前缀跨域';
      } else {
        role = 'amount';
        stateLabel = 'STATE_AMOUNT';
        hint = '金额 · 35 / 3.5k；时间 90m / 1h30m / 1d；1000*m 挂周期规则';
      }
    }

    let domCode = activeDomain(value);
    let prefix = '';
    let query = token;
    const pm = token.match(/^([PFCH]):(.*)$/i);
    if (pm) {
      prefix = pm[1].toUpperCase() + ':';
      query = pm[2];
      domCode = pm[1].toUpperCase();
    }

    let suggestions = [];
    if (role === 'from' || role === 'to') {
      const clean = query.replace(/^!/, '');
      if (clean) {
        const r = D.resolveAlias(S.dict, clean, { domain: domCode, lang: S.lang });
        if (!r.ok) suggestions = D.searchNodes(S.dict, clean, { domain: domCode, lang: S.lang, limit: 8 });
      } else {
        suggestions = D.searchNodes(S.dict, '', { domain: domCode, lang: S.lang, limit: 8 });
      }
    } else if (role === 'tag') {
      const clean = query.replace(/^#/, '');
      if (clean) {
        const r = D.resolveTag(S.dict, clean, { domain: domCode, lang: S.lang });
        if (!r.ok) suggestions = D.searchTags(S.dict, clean, { domain: domCode, lang: S.lang, limit: 8 });
      } else {
        suggestions = D.searchTags(S.dict, '', { domain: domCode, lang: S.lang, limit: 8 });
      }
    }

    /* 精确命中由 resolveAlias / resolveTag 提前返回 ok 处理；
       这里不做「首项等于输入就隐藏」，否则 wx 这种多义会被误吞。 */

    let prediction = null;
    if (!hasLt && gt < 0 && value.trim()) {
      const hits = rulesMod.predict(value, S.rules, S.dict);
      if (hits.length) prediction = { text: hits[0].text, rule: hits[0].rule, count: hits.length };
    }

    return {
      suggestions,
      context: { token, start, end, role, prefix, domain: domCode, options: suggestions },
      state: stateLabel,
      hint,
      prediction,
    };
  }

  function handleChoose(ctx, s, index, list) {
    if (!ctx || !s) return;
    const value = dom.input.value;
    const token = ctx.token || '';
    const base = token.replace(/^#/, '').replace(ctx.prefix || '', '');
    let replacement;
    let aliasKey = '';
    const labels = (list || []).map((x) => String(x.codeLabel || x.label || x.name || '').toLowerCase());
    const sameCode = list && list.length > 1 && labels.length > 1
      && labels.every((x) => x === labels[0]);
    if (sameCode) {
      /* 旧数据里 wx 同时指多个节点：按位置编号，否则源码无法区分 */
      replacement = base + (index + 1);
      aliasKey = replacement;
    } else {
      /* 普通候选只插入它的简码，不把临时输入固化成别名 */
      replacement = s.codeLabel || s.label || s.name || base;
    }
    if (ctx.role === 'tag') replacement = '#' + replacement.replace(/^#/, '');
    else if (ctx.prefix) replacement = ctx.prefix + replacement;
    if (ctx.role === 'from' || ctx.role === 'to') {
      if (replacement.startsWith('#')) replacement = replacement.slice(1);
    }
    const prevValue = value;
    const prevCaret = dom.input.selectionStart;
    const aliasPrev = aliasKey && S.dict.aliases[aliasKey] ? S.dict.aliases[aliasKey].slice() : null;
    const added = aliasKey ? D.addAlias(S.dict, aliasKey, s.id) : { created: false };
    const next = value.slice(0, ctx.start) + replacement + value.slice(ctx.end);
    const caret = ctx.start + replacement.length;
    TV.inputApi.setValue(next, caret);
    if (added.created) {
      S.lastAliasUndo = {
        key: aliasKey, prev: aliasPrev, prevValue, prevCaret,
      };
      toast('歧义候选编号：' + (ctx.prefix || '') + aliasKey, 'ok', {
        label: '撤销编号',
        fn: undoAlias,
      });
    }
  }

  function undoAlias() {
    const g = S.lastAliasUndo;
    if (!g) return;
    if (g.prev && g.prev.length) S.dict.aliases[g.key] = g.prev;
    else delete S.dict.aliases[g.key];
    S.lastAliasUndo = null;
    TV.inputApi.setValue(g.prevValue, g.prevCaret);
    scheduleSave();
    toast('已撤销候选编号', 'ok');
  }

  function tokenContext(token, role) {
    const value = dom.input.value;
    const pos = value.lastIndexOf(token);
    const start = pos >= 0 ? pos : 0;
    const end = pos >= 0 ? pos + token.length : token.length;
    return { token, start, end, role, prefix: '', options: [] };
  }

  function handleParseError(r) {
    const msg = r.error || r.message || '解析失败';
    TV.inputApi.showError(msg);
    if (r.code === 'AMBIGUOUS') {
      TV.inputApi.setSuggestions(r.candidates || [], tokenContext(r.token, r.role));
      return;
    }
    if (r.code === 'UNBOUND_NODE') {
      toast(msg, 'error', {
        label: '新建节点',
        fn: () => panels.nodeForm(app, r.suggest || { zh_name: r.token, zh_code: r.token }, null, { reopen: false }),
      });
      return;
    }
    if (r.code === 'CROSS_DOMAIN_PREFIX_REQUIRED') {
      toast('跨域要写明确前缀，例如 P:微信 > C:公司公户', 'error');
      return;
    }
    if (r.code === 'INCOMPLETE_FROM') {
      toast('数据没吞：补全「转入 金额」再回车', 'error');
    }
  }

  /* ---------------- 录入 / 编辑 ---------------- */

  function normalizeInputLine(raw) {
    const now = new Date();
    let line = String(raw == null ? '' : raw).trim();
    if (!line) return line;
    let domain = S.domain || 'P';
    let rest = line;
    const dm = line.match(/^(?:\[([PFCH])\]|([PFCH])\s+)\s*/i);
    if (dm) {
      domain = (dm[1] || dm[2]).toUpperCase();
      rest = line.slice(dm[0].length).trim();
    }
    let date = '';
    const rel = rest.match(/^(0|[+-][1-9]\d?)(?=\s)/);
    if (rel) {
      const d = TV.date.resolveDateToken(rel[1], now);
      if (d.ok) {
        date = d.stamp;
        rest = rest.slice(rel[0].length).trim();
      }
    }
    if (!date) {
      const abs = rest.match(/^(\d{6})\s+/);
      if (abs) {
        date = abs[1];
        rest = rest.slice(abs[0].length).trim();
      }
    }
    if (!date) date = TV.date.todayStamp(now);
    return (domain === 'P' ? '' : domain + ' ') + date + ' ' + rest.trim();
  }

  function insertLedgerLine(text) {
    const lines = String(S.ledgerSource || '').replace(/\n+$/, '').split('\n');
    const dm = String(text || '').match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(\d{6})\b/i);
    if (!dm) {
      lines.push(text);
      S.ledgerSource = lines.join('\n') + '\n';
      return lines.length;
    }
    const stamp = dm[1];
    let at = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(\d{6})\b/i);
      if (m && m[1] > stamp) { at = i; break; }
    }
    lines.splice(at, 0, text);
    S.ledgerSource = lines.join('\n') + '\n';
    return at + 1;
  }

  function fromTokenOfLine(line) {
    const m = String(line || '').match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(?:\d{6}\s+)?([^\s>]+)\s*>/);
    return m ? m[1] : '';
  }

  function submitEntry(raw, opts) {
    if (!S.dict) return { ok: false, error: '账本未加载' };
    const line = normalizeInputLine(raw);
    if (!line) return { ok: false, error: '空输入' };
    const sameFrom = !!(S.pendingRepair && fromTokenOfLine(S.pendingRepair.lineText)
      && fromTokenOfLine(S.pendingRepair.lineText) === fromTokenOfLine(line));
    const repairing = !!(S.pendingRepair && TV.inputApi.isEditing() && sameFrom);
    let lineNo;
    if (repairing) {
      const lines = String(S.ledgerSource || '').replace(/\n+$/, '').split('\n');
      const at = S.pendingRepair.line - 1;
      if (at >= 0 && at < lines.length && lines[at] === S.pendingRepair.lineText) {
        lines[at] = line;
        S.ledgerSource = lines.join('\n') + '\n';
        lineNo = S.pendingRepair.line;
      } else {
        lineNo = insertLedgerLine(line);
      }
    } else {
      if (S.pendingRepair) S.pendingRepair = null;
      lineNo = insertLedgerLine(line);
    }
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    S.view = 'ledger';
    applyView();
    compileSources();
    const errors = (S.sourceDiags || []).filter((d) => d.file === 'ledger' && d.line === lineNo && d.severity === 'error');
    if (errors.length) {
      S.pendingRepair = { line: lineNo, lineText: line };
      const rawText = String(raw == null ? line : raw).trim();
      TV.inputApi.setEditing(true, rawText,
        (repairing ? '第 ' + lineNo + ' 行仍有错误 · 改完回车替换' : '已存为 X_ 第 ' + lineNo + ' 行 · 改完回车替换'));
      const mm = String(errors[0].message || '').match(/[：:]\s*([^\s，。；;、]+)/);
      if (mm) {
        const needle = mm[1].replace(/[「」“”"'()（）]/g, '');
        const at = needle ? rawText.indexOf(needle) : -1;
        if (at >= 0) TV.inputApi.select(at, at + needle.length);
      }
      toast('已保存为待修复文本（X_）：' + errors[0].message, 'error');
    } else {
      S.pendingRepair = null;
      TV.inputApi.setEditing(false);
      TV.inputApi.clear();
      TV.inputApi.clearError();
      toast(repairing ? '已修复第 ' + lineNo + ' 行' : '已写入源码并编译', 'ok');
    }
    return { ok: errors.length === 0, line: lineNo, errors };
  }

  function editEvent(index) {
    const e = S.events[index];
    if (!e) return;
    S.selectedEventIndex = index;
    S.view = 'ledger';
    applyView();
    const line = e.sourceLine || 1;
    if (editorCtl) editorCtl.gotoLine('ledger', line);
  }

  function cancelEdit() {
    S.editingIndex = -1;
    S.pendingRepair = null;
    TV.inputApi.setEditing(false);
    TV.inputApi.clear();
  }

  function selectEvent(index) {
    S.selectedEventIndex = index;
    const e = S.events[index];
    S.linkedNodeIds = e ? new Set([e.from, e.to]) : new Set();
    renderPanes();
  }

  function deleteSelectedEvent() {
    const index = S.selectedEventIndex;
    const e = S.events[index];
    if (!e) return;
    const lineNo = e.sourceLine || 0;
    const lines = S.ledgerSource.split('\n');
    const removedLine = lineNo > 0 ? lines[lineNo - 1] : '';
    panels.confirm(app, '删除源码行', '删除第 ' + (lineNo || '?') + ' 行？该行如果有会计 + 行为多条原子边会一起删除。', () => {
      if (lineNo > 0) {
        lines.splice(lineNo - 1, 1);
        S.ledgerSource = lines.join('\n');
        if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
        compileSources();
      }
      toast('已删除该源码行', 'ok', {
        label: '撤销删除',
        fn: () => {
          if (lineNo > 0) {
            lines.splice(lineNo - 1, 0, removedLine);
            S.ledgerSource = lines.join('\n');
            if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
            compileSources();
          }
          toast('已恢复', 'ok');
        },
      });
    });
  }

  function toggleNodeFilter(id) {
    if (!id) { S.filterNodeId = ''; renderAll(); return; }
    if (S.filterNodeId === id) S.filterNodeId = '';
    else S.filterNodeId = id;
    S.selectedNodeId = id;
    S.query.from = id || '';
    S.view = 'query';
    applyView();
    renderAll();
  }

  function navigate(dir) {
    if (!S.events.length) return;
    const order = S.events.map((e, i) => ({ e, i }))
      .sort((a, b) => String(b.e.date).localeCompare(String(a.e.date)) || b.i - a.i);
    let pos = order.findIndex((x) => x.i === S.selectedEventIndex);
    pos = pos < 0 ? 0 : Math.max(0, Math.min(order.length - 1, pos + dir));
    S.selectedEventIndex = order[pos].i;
    const e = order[pos].e;
    S.linkedNodeIds = new Set([e.from, e.to]);
    renderPanes();
  }

  /** 气泡打开时 ← → 在祖先/子级路径里游走（v1.1 §6.3）。 */
  function navigatePath(dir, ctx) {
    const value = dom.input.value;
    const { token, start, end } = currentToken(value, dom.input.selectionStart);
    if (!token) return;
    const tagMode = (ctx && ctx.role === 'tag') || token.startsWith('#');
    const pm = token.replace(/^#/, '').match(/^([PFCH]):(.+)$/i);
    const prefix = tagMode ? '#' : pm ? pm[1].toUpperCase() + ':' : '';
    const clean = token.replace(/^#/, '').replace(/^([PFCH]):/i, '');
    const ctxDomain = pm ? pm[1].toUpperCase() : (S.domain || 'P');
    let node = null;
    let parentId = '';
    let childList = [];
    if (tagMode) {
      let r = D.resolveTag(S.dict, clean, { domain: ctxDomain });
      if (!r.ok) {
        const cand = D.searchTags(S.dict, clean, { domain: ctxDomain, lang: S.lang, limit: 1 })[0];
        if (cand) r = { ok: true, id: cand.id };
      }
      if (!r.ok) { toast('先精确命中一个标签，再用 ← → 走树', 'error'); return; }
      parentId = S.dict.tags[r.id].parent_id;
      childList = Object.keys(S.dict.tags).filter((k) => S.dict.tags[k].parent_id === r.id);
    } else {
      const r = D.resolveAlias(S.dict, clean, { domain: ctxDomain });
      if (!r.ok) { toast('先精确命中一个节点，再用 ← → 走树', 'error'); return; }
      node = r.node;
      parentId = node.parent_id;
      childList = D.getChildren(S.dict, r.id).map((x) => x.id);
    }
    let targetId = '';
    if (dir < 0) {
      if (!parentId) { toast('已经是根' + (tagMode ? '标签' : '节点'), 'error'); return; }
      targetId = parentId;
    } else {
      if (!childList.length) { toast('没有子' + (tagMode ? '标签' : '节点'), 'error'); return; }
      targetId = childList[0];
    }
    const code = tagMode ? D.renderTag(S.dict, targetId, 'CODE', S.lang) : D.renderNode(S.dict, targetId, 'CODE', S.lang);
    const name = tagMode ? D.renderTag(S.dict, targetId, 'PLAIN', S.lang) : D.renderNode(S.dict, targetId, 'PLAIN', S.lang);
    const repl = prefix + code;
    const next = value.slice(0, start) + repl + value.slice(end);
    TV.inputApi.setValue(next, start + repl.length);
    toast((dir < 0 ? '父级：' : '子级：') + name, 'ok');
  }

  /* ---------------- 数据变更 ---------------- */

  function afterDataChange() {
    if (!S.dict) return;
    dictFile.syncMeta(S.dict, S.events, S.plans);
    renderAll();
    scheduleSave();
  }

  function countNodeRefs(id) {
    return S.events.filter((e) => e.from === id || e.to === id).length;
  }

  function syncDictSourceAndCompile() {
    if (!S.dict) return;
    S.dictSource = TV.source.dictToSource(S.dict);
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    compileSources();
  }

  function addNode(spec) {
    const r = D.addNode(S.dict, spec);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  function updateNode(id, spec) {
    const r = D.updateNode(S.dict, id, spec);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  function deleteNode(id) {
    if (countNodeRefs(id)) return { ok: false, error: '节点仍被流水引用' };
    const r = D.removeNode(S.dict, id);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  function addTag(spec) {
    const r = D.addTag(S.dict, spec);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }
  function updateTag(id, spec) {
    const r = D.updateTag(S.dict, id, spec);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }
  function deleteTag(id) {
    const r = D.removeTag(S.dict, id);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  function cancelPlan(id) {
    const r = rulesMod.cancelPlan(S.plans, id);
    if (r.ok) afterDataChange();
    return r;
  }

  function resumePlan(id) {
    const r = rulesMod.resumePlan(S.plans, id);
    if (r.ok) afterDataChange();
    return r;
  }

  function deletePlan(id) {
    const i = S.plans.findIndex((p) => p.id === id);
    if (i < 0) return { ok: false, error: '规则不存在' };
    S.plans.splice(i, 1);
    afterDataChange();
    return { ok: true };
  }

  function deleteRule(id) {
    const i = S.rules.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false, error: '规则不存在' };
    S.rules.splice(i, 1);
    afterDataChange();
    return { ok: true };
  }

  /* ---------------- 视图切换 ---------------- */

  function setMode(mode) {
    const hadErrors = (S.sourceDiags || []).some((d) => d.severity === 'error');
    S.mode = mode;
    if (S.view === 'ledger') { projectEditorSource(); compileSources(); }
    if (hadErrors) toast('已切到 ' + mode + '；未编译行原样保留', 'ok');
    renderAll();
    applyLang();
  }

  function setLang(lang) {
    const hadErrors = (S.sourceDiags || []).some((d) => d.severity === 'error');
    S.lang = lang;
    if (S.view === 'ledger') { projectEditorSource(); compileSources(); }
    if (hadErrors) toast('已切到 ' + lang + '；未编译行原样保留', 'ok');
    renderAll();
    applyLang();
  }

  function setView(view) {
    S.view = view;
    applyView();
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function validateSingleText(text) {
    const s = String(text || '');
    const sections = ['## 统计', '## 流水', '## 行为', '## 备注', '## 字典'];
    const miss = sections.filter((x) => s.indexOf(x) < 0);
    if (miss.length) return { ok: false, error: '单 TXT 缺段：' + miss.join(' / ') };
    if (/\b(?:N|T|H|E|B|C|R|X)_[0-9a-f]{8,16}\b/.test(s)) {
      return { ok: false, error: '单 TXT 泄露了后台 ID' };
    }
    const p = TV.source.parseSingleTxt(s);
    if (!p.ok) return p;
    const rep = TV.report.buildReport(S.dict, S.events, {
      range: S.range, domain: S.domain, lang: S.lang, now: new Date(),
    });
    const stats = TV.report.reportToText(rep).trim();
    if (stats && s.indexOf(stats) < 0) return { ok: false, error: '单 TXT 统计段与当前报表不一致' };
    const r = TV.source.compileAll(p.dictSource, p.ledgerSource, {
      vaultId: S.vaultId, now: new Date(), domain: S.domain,
    });
    const countNotes = (arr) => {
      const out = { note: 0, invalid: 0, comment: 0 };
      (arr || []).forEach((n) => { if (out[n.kind] != null) out[n.kind] += 1; });
      return out;
    };
    const checks = [
      ['流水', r.events.length, (S.events || []).length],
      ['行为', r.behaviors.length, (S.behaviors || []).length],
      ['节点', Object.keys(r.dict.nodes || {}).length, Object.keys(S.dict.nodes || {}).length],
      ['标签', Object.keys(r.dict.tags || {}).length, Object.keys(S.dict.tags || {}).length],
      ['行为项', Object.keys(r.dict.behaviors || {}).length, Object.keys(S.dict.behaviors || {}).length],
    ];
    const a = countNotes(r.notes);
    const b = countNotes(S.notes);
    checks.push(['备注', a.note, b.note]);
    checks.push(['错误行', a.invalid, b.invalid]);
    checks.push(['注释', a.comment, b.comment]);
    const bad = checks.filter((x) => x[1] !== x[2]);
    if (bad.length) {
      return { ok: false, error: '单 TXT 回读不一致：' + bad.map((x) => x[0] + ' ' + x[1] + '/' + x[2]).join('，') };
    }
    return { ok: true, events: r.events.length, behaviors: r.behaviors.length, notes: a.note };
  }

  function buildSingleText() {
    const rep = TV.report.buildReport(S.dict, S.events, {
      range: S.range, domain: S.domain, lang: S.lang, now: new Date(),
    });
    const lines = ['## 统计', TV.report.reportToText(rep).trim(), ''];
    const noteRows = (S.notes || []).filter((n) => n.kind === 'note');
    const behaviorTotal = (S.behaviors || []).reduce((s, b) => s + (Number(b.weight) || 0), 0);
    lines.push('备注：' + noteRows.length + ' 条；行为：' + (S.behaviors || []).length + ' 条 / 总强度 ' + behaviorTotal);
    lines.push('', '## 流水');
    (S.events || []).forEach((e) => lines.push(renderEventLine(e)));
    lines.push('', '## 行为');
    (S.behaviors || []).forEach((b) => lines.push(renderBehaviorLine(b)));
    lines.push('', '## 备注');
    (S.notes || []).forEach((n) => lines.push(renderNoteLine(n)));
    lines.push('', '## 字典', S.dictSource.trim(), '');
    return lines.join('\n');
  }

  async function exportMode(mode) {
    if (mode === 'single') {
      const text = buildSingleText();
      const v = validateSingleText(text);
      if (!v.ok) return v;
      files.downloadText('txtvein-export.txt', text);
      return { ok: true };
    }
    const texts = await buildTexts();
    if (mode === 'shadow') {
      const sealed = await store.encryptWithCurrent(texts.dict);
      const vault = TV.envelope.packSecure('dict', {
        vaultId: S.vaultId, iterations: sealed.iterations, salt: sealed.salt, iv: sealed.iv,
      }, sealed.ciphertext, { domain: 'P', updatedAt: new Date().toISOString() });
      await files.downloadAll([
        { name: 'ledger.shadow', text: texts.ledger },
        { name: 'dict.vault', text: vault },
      ]);
      return { ok: true };
    }
    if (mode === 'deep') {
      const l = await store.encryptWithCurrent(texts.ledger);
      const d = await store.encryptWithCurrent(texts.dict);
      const ledgerEnc = TV.envelope.packSecure('ledger', {
        vaultId: S.vaultId, iterations: l.iterations, salt: l.salt, iv: l.iv,
      }, l.ciphertext, { domain: S.domain || 'P', updatedAt: new Date().toISOString() });
      const dictEnc = TV.envelope.packSecure('dict', {
        vaultId: S.vaultId, iterations: d.iterations, salt: d.salt, iv: d.iv,
      }, d.ciphertext, { domain: S.domain || 'P', updatedAt: new Date().toISOString() });
      await files.downloadAll([
        { name: 'ledger.enc', text: ledgerEnc },
        { name: 'dict.enc', text: dictEnc },
      ]);
      return { ok: true };
    }
    return { ok: false, error: '未知导出模式' };
  }

  async function importSingleText(text, opts) {
    const p = TV.source.parseSingleTxt(text);
    if (!p.ok) return p;
    const vaultId = crypto.randomVaultId();
    const r = TV.source.compileAll(p.dictSource, p.ledgerSource, {
      vaultId, now: new Date(), domain: 'P',
    });
    S.ledgerSource = TV.source.normalizeDomainSyntax(p.ledgerSource);
    S.dictSource = p.dictSource;
    adopt(r.dict, r.events, [], [], vaultId, { behaviors: r.behaviors, notes: r.notes });
    S.sourceDiags = (r.dictDiagnostics || []).map((x) => Object.assign({ file: 'dict' }, x))
      .concat((r.ledgerDiagnostics || []).map((x) => Object.assign({ file: 'ledger' }, x)));
    if (editorCtl) {
      editorCtl.setTexts(S.ledgerSource, S.dictSource);
      editorCtl.setDiagnostics(S.sourceDiags);
      renderCandidateButton();
    }
    applyView();
    await saveNow();
    return {
      ok: true,
      message: '已导入单 TXT：' + Object.keys(r.dict.nodes).length + ' 节点 / '
        + r.events.length + ' 流水 / ' + r.behaviors.length + ' 行为 / '
        + r.notes.filter((n) => n.kind === 'note').length + ' 备注'
        + (r.errors ? '（' + r.errors + ' 行未编译，已保留为 X_）' : ''),
    };
  }

  async function importBundle(inputFiles, opts) {
    const o = opts || {};
    const list = Array.isArray(inputFiles) ? inputFiles : [];
    if (!list.length) return { ok: false, error: '没有文件' };
    if (list.length === 1 && /##\s*字典/.test(list[0].text || '') && /##\s*流水/.test(list[0].text || '')) {
      return importSingleText(list[0].text, o);
    }
    let ledgerText = null;
    let dictText = null;
    let legacyText = null;
    const warnings = [];

    for (const f of list) {
      let kind = files.classify(f.name, f.text);
      let text = f.text;
      if (kind === 'secure') {
        if (!o.password) return { ok: false, error: '加密文件需要输入密码' };
        let pair;
        try { pair = TV.envelope.extractSecure(text); } catch (e) { return { ok: false, error: e.message }; }
        try {
          text = await crypto.openText(o.password, pair);
        } catch (e) {
          return { ok: false, error: '密码不对，或文件已损坏' };
        }
        if (pair.kind === 'ledger' || pair.kind === 'dict') kind = pair.kind;
        else kind = files.classify(f.name, text);
      }
      if (kind === 'ledger') ledgerText = text;
      else if (kind === 'dict') dictText = text;
      else if (kind === 'legacy') legacyText = text;
      else warnings.push('忽略无法识别的文件：' + f.name);
    }

    if (legacyText && !ledgerText) {
      const legacy = TV.legacy.importLegacy(legacyText, { vaultId: crypto.randomVaultId() });
      if (!legacy.ok) return { ok: false, error: legacy.error };
      adopt(legacy.dict, legacy.events, [], [], legacy.dict.vaultId);
      refreshSources(true);
      afterDataChange();
      await saveNow();
      return {
        ok: true,
        message: '已导入旧版：' + legacy.stats.nodes + ' 节点 / ' + legacy.stats.flows + ' 笔流水'
          + (legacy.warnings.length ? '（' + legacy.warnings.join('；') + '）' : ''),
      };
    }
    if (!ledgerText || !dictText) {
      return {
        ok: false,
        error: !ledgerText ? '缺失流水文件（ledger）' : '缺失字典文件（dict）——只有流水无法还原语义',
      };
    }

    const dp = dictFile.parseDict(dictText);
    if (!dp.ok) return { ok: false, error: dp.error };
    const lp = ledgerFile.parseLedger(ledgerText, { dict: dp.dict });
    const errors = (lp.issues || []).filter((x) => x.level === 'error');
    if (errors.length && !o.force) {
      return {
        ok: false,
        error: '流水有 ' + errors.length + ' 条未绑定/非法记录：' + errors[0].message,
        needsForce: true,
      };
    }
    if (lp.vaultId && dp.dict.vaultId && lp.vaultId !== dp.dict.vaultId && !o.force) {
      return {
        ok: false,
        error: '两个文件的 VAULT_ID 不一致：' + lp.vaultId + ' / ' + dp.dict.vaultId,
        needsForce: true,
      };
    }
    const dictHash = await crypto.sha256Hex(dictFile.bodyForHash(dp.dict));
    const ledgerHash = await crypto.sha256Hex(ledgerFile.bodyForHash(ledgerText));
    const linkA = lp.link ? lp.link === dictHash : true;
    const linkB = dp.dict.link ? dp.dict.link === ledgerHash : true;
    if (!linkA || !linkB) {
      if (!o.force) {
        return {
          ok: false,
          error: 'SHA-256 指纹不匹配：流水与字典可能不是同一份账本。确认无误可勾选强制导入。',
          needsForce: true,
        };
      }
      warnings.push('指纹不匹配，已强制导入');
    }

    const events = (lp.events || []).map((e, i) => Object.assign({}, e, {
      id: 'E_' + String(i + 1).padStart(4, '0'),
    }));
    adopt(dp.dict, events, lp.plans, lp.rules, dp.dict.vaultId || crypto.randomVaultId());
    refreshSources(true);
    afterDataChange();
    await saveNow();
    return {
      ok: true,
      message: '已导入 ' + Object.keys(dp.dict.nodes).length + ' 节点 / ' + events.length + ' 笔流水'
        + (warnings.length ? '（' + warnings.join('；') + '）' : ''),
    };
  }

  async function changePassword(oldPw, newPw, hint) {
    const texts = await buildTexts();
    return store.changePassword(oldPw, newPw, {
      ledger: texts.ledger, dict: texts.dict,
      ledgerSource: texts.ledgerSource, dictSource: texts.dictSource,
    }, hint);
  }

  /* ---------------- 启动 / 门禁 ---------------- */

  function enterApp() {
    dom.app.hidden = false;
    dom.gate.hidden = true;
    booted = true;
    if (S.ledgerSource && (S.events || []).some((e) => !e.sourceLine)) compileSources();
    renderAll();
    applyView();
    applyLang();
    if (needsOnboarding) {
      needsOnboarding = false;
      toast('盲打一笔试试：wx1 > din 35 < 咖啡', 'ok', {
        label: '看帮助',
        fn: () => panels.showHelp(app),
      });
    }
  }

  async function loadPayload(payload) {
    if (!payload) throw new Error('保险库里的账本为空');
    const hasSources = payload.ledgerSource && payload.dictSource;
    let dict;
    let events = [];
    let plans = [];
    let rules = [];
    let behaviors = [];
    let notes = [];
    let diags = [];

    if (hasSources) {
      S.ledgerSource = TV.source.normalizeDomainSyntax(payload.ledgerSource);
      S.dictSource = payload.dictSource;
      const r = TV.source.compileAll(S.dictSource, S.ledgerSource, {
        vaultId: payload.vaultId || '', now: new Date(), domain: 'P',
      });
      dict = r.dict;
      events = r.events || [];
      plans = [];
      rules = [];
      behaviors = r.behaviors || [];
      notes = r.notes || [];
      diags = (r.dictDiagnostics || []).map((x) => Object.assign({ file: 'dict' }, x))
        .concat((r.ledgerDiagnostics || []).map((x) => Object.assign({ file: 'ledger' }, x)));
      if (!r.ok) toast('源码有 ' + r.errors + ' 个错误；已按合法部分加载', 'error');
    } else {
      if (!payload.dict || !payload.ledger) throw new Error('保险库里的账本为空或格式不对');
      const dp = dictFile.parseDict(payload.dict);
      if (!dp.ok) throw new Error('字典解析失败：' + dp.error);
      const lp = ledgerFile.parseLedger(payload.ledger, { dict: dp.dict });
      dict = dp.dict;
      events = lp.events;
      plans = lp.plans;
      rules = lp.rules;
      S.ledgerSource = TV.source.ledgerToSource(dict, events, [], []);
      S.dictSource = TV.source.dictToSource(dict);
    }

    adopt(dict, events, plans, rules, dict.vaultId || payload.vaultId);
    S.behaviors = behaviors;
    S.notes = notes;
    S.sourceDiags = diags;
    if (editorCtl) {
      editorCtl.setTexts(S.ledgerSource, S.dictSource);
      editorCtl.setDiagnostics(S.sourceDiags);
      renderCandidateButton();
    }
    enterApp();
  }

  async function onSetup(password, hint) {
    const vaultId = crypto.randomVaultId();
    const ex = TV.example.createExample(vaultId, new Date());
    adopt(ex.dict, ex.events, ex.plans, ex.rules, vaultId, { behaviors: ex.behaviors || [], notes: [] });
    refreshSources(true);
    const texts = await buildTexts();
    await store.createVault(password, {
      ledger: texts.ledger, dict: texts.dict,
      ledgerSource: texts.ledgerSource, dictSource: texts.dictSource,
    });
    store.saveHint(hint || '');
    needsOnboarding = true;
    enterApp();
  }

  async function onUnlock(password) {
    const r = await store.unlockVault(password);
    if (!r.ok) return false;
    await loadPayload(r.payload);
    return true;
  }

  function onReset() {
    store.destroy();
    S.dict = null;
    S.events = [];
    S.behaviors = [];
    S.notes = [];
    S.plans = [];
    S.rules = [];
    S.ledgerSource = '';
    S.dictSource = '';
    S.sourceDiags = [];
    S.ignoredCandidates = new Set();
    S.texts = null;
    editorCtl = null;
    clear(dom.editorView);
    clear(dom.reportView);
    dom.input.value = '';
    dom.app.hidden = true;
    dom.gate.hidden = false;
    gateCtl.show();
    toast('本地保险库已销毁', 'ok');
  }

  let gateCtl = null;

  /* ---------------- 快捷键 ---------------- */

  function bindShortcuts() {
    document.addEventListener('keydown', (ev) => {
      const target = ev.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      const mod = ev.ctrlKey || ev.metaKey;
      const inComposer = target === dom.input;
      if (ev.key === 'Delete' && S.selectedEventIndex >= 0 && S.editingIndex < 0
        && (!typing || inComposer) && !(inComposer && dom.input.value)) {
        ev.preventDefault();
        deleteSelectedEvent();
        return;
      }
      if (mod && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        saveNow();
        return;
      }
      if (mod && ev.key.toLowerCase() === 'r') {
        ev.preventDefault();
        setView('fixed');
        return;
      }
      if (mod && ev.shiftKey && ev.key.toLowerCase() === 'p') {
        ev.preventDefault();
        setMode(S.mode === 'CODE' ? 'PLAIN' : 'CODE');
        return;
      }
      if (mod && ev.shiftKey && ev.key.toLowerCase() === 'l') {
        ev.preventDefault();
        setLang(S.lang === 'zh' ? 'en' : 'zh');
        return;
      }
      if (mod && ev.shiftKey && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        lockApp();
        return;
      }
      if (!typing && ev.key === '?') {
        ev.preventDefault();
        panels.showHelp(app);
        return;
      }
      if (ev.altKey && ev.key === '1') { ev.preventDefault(); setView('ledger'); }
      if (ev.altKey && ev.key === '2') { ev.preventDefault(); setView('report'); }
    });
  }

  async function lockApp() {
    if (!store.isUnlocked()) return;
    await saveNow();
    store.lock();
    S.dict = null;
    S.events = [];
    S.behaviors = [];
    S.notes = [];
    S.plans = [];
    S.rules = [];
    S.ledgerSource = '';
    S.dictSource = '';
    S.sourceDiags = [];
    S.ignoredCandidates = new Set();
    S.texts = null;
    editorCtl = null;
    clear(dom.editorView);
    S.calcAll = null;
    clear(dom.reportView);
    dom.input.value = '';
    dom.app.hidden = true;
    dom.gate.hidden = false;
    gateCtl.show();
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindComposer() {
    const POS_KEY = 'txtvein:composer-pos';
    let right = 16;
    let bottom = 44;
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (saved && Number.isFinite(saved.right)) right = saved.right;
      if (saved && Number.isFinite(saved.bottom)) bottom = saved.bottom;
    } catch (e) { /* ignore */ }
    const applyPos = () => {
      const w = window.innerWidth || 360;
      const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 640;
      const maxBottom = Math.max(8, Math.floor(h / 2) - 44);
      right = Math.max(8, Math.min(right, w - 48));
      bottom = Math.max(8, Math.min(bottom, maxBottom));
      dom.composer.style.right = right + 'px';
      dom.composer.style.bottom = bottom + 'px';
    };
    applyPos();
    const setOpen = (open) => {
      dom.composer.classList.toggle('open', !!open);
      if (open) setTimeout(() => dom.input.focus(), 20);
    };
    dom.input.addEventListener('focus', () => setOpen(true));
    let drag = null;
    let suppressClick = false;
    dom.composerToggle.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, right, bottom, moved: false };
      try { dom.composerToggle.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    });
    dom.composerToggle.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      right = drag.right - dx;
      bottom = drag.bottom - dy;
      applyPos();
    });
    dom.composerToggle.addEventListener('pointerup', (ev) => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      try { dom.composerToggle.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      if (moved) {
        suppressClick = true;
        try { localStorage.setItem(POS_KEY, JSON.stringify({ right, bottom })); } catch (e) { /* ignore */ }
      }
    });
    dom.composerToggle.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      if (!dom.composer.classList.contains('open')) { setOpen(true); return; }
      if (dom.input.value.trim()) {
        submitEntry(dom.input.value, { editing: TV.inputApi.isEditing() });
        return;
      }
      setOpen(false);
    });
    window.addEventListener('resize', applyPos);
    setOpen(false);
  }

  function bindButtons() {
    dom.btnMode.addEventListener('click', () => setMode(S.mode === 'CODE' ? 'PLAIN' : 'CODE'));
    dom.btnLang.addEventListener('click', () => setLang(S.lang === 'zh' ? 'en' : 'zh'));
    dom.btnQuery.addEventListener('click', () => setView('query'));
    dom.btnLedger.addEventListener('click', () => setView('ledger'));
    dom.btnDict.addEventListener('click', () => setView('dict'));
    dom.btnFixed.addEventListener('click', () => setView('fixed'));
    dom.btnReport.addEventListener('click', () => setView('report'));
    dom.btnCandidates.addEventListener('click', () => showCandidates());
    dom.btnSecurity.addEventListener('click', () => panels.showPassword(app));
    dom.btnImport.addEventListener('click', () => panels.showImport(app));
    dom.btnExport.addEventListener('click', () => panels.showExport(app));
    dom.btnHelp.addEventListener('click', () => panels.showHelp(app));
    dom.btnLock.addEventListener('click', () => lockApp());
    dom.feedbackAction.addEventListener('click', () => {
      const fn = feedbackFn;
      feedbackFn = null;
      dom.feedbackAction.hidden = true;
      if (fn) fn();
    });
    $('#btn-submit').addEventListener('click', () => {
      if (dom.input.value.trim()) submitEntry(dom.input.value, { editing: TV.inputApi.isEditing() });
      else TV.inputApi.focus();
    });
  }

  /* ---------------- 对外 app 对象 ---------------- */

  const app = {
    getState: () => S,
    getCalcAll: () => S.calcAll || calcMod.compute(S.dict, S.events, {}),
    buildTexts,
    afterDataChange,
    addNode,
    updateNode,
    deleteNode,
    addTag,
    updateTag,
    deleteTag,
    countNodeRefs,
    cancelPlan,
    resumePlan,
    deletePlan,
    deleteRule,
    exportMode,
    importBundle,
    importSingleText,
    changePassword,
    saveNow,
  };

  /* ---------------- 启动 ---------------- */

  function boot() {
    if (booted) return;
    TV.inputApi = TV.input.create({
      input: dom.input,
      bubbles: dom.bubbles,
      prediction: dom.prediction,
      state: dom.state,
      hint: dom.hint,
      error: dom.error,
      row: dom.row,
      prompt: dom.prompt,
    }, {
      onQuery: analyzeInput,
      onChoose: handleChoose,
      onSubmit: (raw, opts) => submitEntry(raw, opts),
      onNavigate: (dir) => navigate(dir),
      onPath: (dir, ctx) => navigatePath(dir, ctx),
      onCancelEdit: () => cancelEdit(),
      onUndoAlias: () => undoAlias(),
      onPrediction: (p) => p,
    });

    gateCtl = TV.gate.createGate(dom.gate, {
      hasVault: () => store.hasVault(),
      readHint: () => store.readHint(),
      onSetup: (pw, hint) => onSetup(pw, hint),
      onUnlock: (pw) => onUnlock(pw),
      onReset: () => onReset(),
    });

    bindButtons();
    bindComposer();
    bindShortcuts();

    if (!store.storageAvailable()) {
      dom.gate.hidden = false;
      gateCtl.show();
      gateCtl.setError('浏览器禁用了 localStorage：账本无法保存。请换 Chrome/Edge，或允许本站存储。');
      return;
    }
    gateCtl.show();
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  boot();

  /* 测试/调试用只读入口：不暴露密钥，不提供写入钩子。 */
  root.__txtvein = {
    version: '2.0.0',
    state: () => ({
      domain: S.domain, mode: S.mode, lang: S.lang, view: S.view,
      events: S.events.length, behaviors: S.behaviors.length, notes: S.notes.length,
      nodes: S.dict ? Object.keys(S.dict.nodes).length : 0,
      saved: S.saveState, diagnostics: S.sourceDiags.length,
    }),
    source: () => ({ ledger: S.ledgerSource, dict: S.dictSource }),
    getState: () => S,
    compile: () => compileSources(),
    texts: async () => buildTexts(),
    submit: (text) => submitEntry(text, { editing: false }),
    importTexts: (ledger, dict, opts) => app.importBundle([
      { name: 'ledger.txt', text: ledger },
      { name: 'dict.json', text: dict },
    ], opts || {}),
    importFiles: (list, opts) => app.importBundle(list, opts || {}),
    importSingle: (text, opts) => importSingleText(text, opts || {}),
    exportMode: (mode) => exportMode(mode),
    singleText: () => buildSingleText(),
    validateSingle: () => validateSingleText(buildSingleText()),
    hint: (file, token, before) => sourceHint(file, token, before),
    setRange: (r) => { S.range = r; renderHUD(); renderReport(); },
    setView: (v) => setView(v),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
