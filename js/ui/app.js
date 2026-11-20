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
    fixedSource: '',
    dictSource: '',
    systemVersion: '',
    sourceDiags: [],
    vaultId: '',
    domain: '',
    mode: 'CODE',
    lang: 'zh',    view: 'ledger',
    reportMode: 'private',
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
    fixedDiags: [],
    planDay: '',          /* 最近一次自动记账的日期；跨日重算 */
    planDockSig: '',      /* 流水末尾清单缓存签名，避免每次编译都重排 */
  };

  const LABELS = {
    zh: {
      security: '安全', import: '导入', export: '导出', settings: '设置', help: '帮助', candidates: '候选',
      query: '查询', ledger: '流水', dict: '字典', mother: '母树', fixed: '固定', report: '统计',
      modeCode: '掩码', mask: '掩码', modePlain: '明文', language: '语言', lock: '锁',
      queryTitle: '查询流水', queryText: '关键词 / 名称 / 日期', all: '全部',
      ledgerQuery: '流水查询', clear: '清空', seq: '序', noteSearch: '备注搜索',
      amountShort: '金额', dateShort: '日期', colNote: '备注',
      fromDate: '起始日期', toDate: '结束日期', type: '收支类型', domain: '账本',
      fromNode: '转出', toNode: '转入', tag: '标签', min: '最小金额', max: '最大金额',
      reset: '重置', count: '条', total: '合计',
      colDate: '日期', colDomain: '域', colFrom: '转出', colTo: '转入', colAmount: '金额', colTags: '标签',
      category: '分类', node: '节点', note: '备注', event: '事件', allMonths: '全', statsTitle: '统计',
      reportPrivate: '私人结构', reportPublic: '公共归属',
      publicTitle: '公共归属 · 按母树汇总', anchored: '已归类', unclassified: '未归类',
      staleAnchor: '归属失效', reconcile: '对账',
      statsColName: '分类', statsColNode: '节点', statsColOther: '对方', statsWeight: '强度',
      statsMonth: '月', statsItems: '项', statsRecords: '条', statsSelect: '左侧选择一项',
      noRows: '没有匹配的流水', fixedTitle: '固定收支表',
      fixedHint: '独立的表，自动保存 · 行形同流水：每日 / 每月16日 + 转出 > 转入 金额 < 标签 *d|*m|*y // 备注 · 分期加 期数=N 首月=YYMM 本金=… 利息=… · 状态在 | 后（生成 / 确认 / 作废）',
      feedbackHint: '行首空格补日期 · 双击空格 > · 三击 < · 数字/鼠标选候选 · Ctrl+Enter 编译',
    },
    en: {
      security: 'Security', import: 'Import', export: 'Export', settings: 'Settings', help: 'Help', candidates: 'Candidates',
      query: 'Query', ledger: 'Ledger', dict: 'Dictionary', mother: 'Mother', fixed: 'Fixed', report: 'Stats',
      modeCode: 'Mask', mask: 'Mask', modePlain: 'Plain', language: 'Language', lock: 'Lock',
      queryTitle: 'Query ledger', queryText: 'Keyword / name / date', all: 'All',
      ledgerQuery: 'Ledger query', clear: 'Clear', seq: '#', noteSearch: 'Note search',
      amountShort: 'Amount', dateShort: 'Date', colNote: 'Note',
      fromDate: 'From', toDate: 'To', type: 'Type', domain: 'Book',
      fromNode: 'From account', toNode: 'To account', tag: 'Tag', min: 'Min amount', max: 'Max amount',
      reset: 'Reset', count: 'rows', total: 'Total',
      colDate: 'Date', colDomain: 'Book', colFrom: 'From', colTo: 'To', colAmount: 'Amount', colTags: 'Tags',
      category: 'Categories', node: 'Nodes', note: 'Notes', event: 'Events', allMonths: 'All', statsTitle: 'Stats',
      reportPrivate: 'Private', reportPublic: 'Public',
      publicTitle: 'Public grouping · mother tree', anchored: 'Anchored', unclassified: 'Unclassified',
      staleAnchor: 'Stale anchor', reconcile: 'Reconcile',
      statsColName: 'Category', statsColNode: 'Node', statsColOther: 'Counterpart', statsWeight: 'Weight',
      statsMonth: 'month', statsItems: 'items', statsRecords: 'records', statsSelect: 'Select an item on the left',
      noRows: 'No matching entries', fixedTitle: 'Fixed table',
      fixedHint: 'Independent table, auto-saved · same shape as ledger rows: Daily / Monthly day 16 + from > to amount < tags *d|*m|*y // note · installments add 期数=N 首月=YYMM 本金=… 利息=… · state after | (生成 / 确认 / 作废)',
      feedbackHint: 'Leading space adds date · double space > · triple < · Ctrl+Enter compile',
    },
  };

  try {
    const d = JSON.parse(localStorage.getItem('txtvein:display') || 'null');
    if (d && d.mode === 'PLAIN') S.mode = 'PLAIN';
    if (d && d.lang === 'en') S.lang = 'en';
  } catch (e) { /* ignore */ }

  function t(key) {
    const lang = S.lang === 'en' ? 'en' : 'zh';
    return (LABELS[lang] && LABELS[lang][key]) || LABELS.zh[key] || key;
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (key) node.textContent = t(key);
    });
    const cand = dom.btnCandidates;
    if (cand) cand.textContent = t('candidates');
    if (dom.btnMode) dom.btnMode.textContent = S.mode === 'CODE' ? t('modeCode') : t('modePlain');
    if (dom.btnLang) dom.btnLang.textContent = t('language');
    renderTabs();
    if (S.view === 'query') renderQuery();
    if (S.view === 'fixed') renderFixedHint();
    renderFutureBlock(true);
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
    motherView: $('#mother-view'),
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
    batchHint: $('#composer-batch-hint'),
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
    btnSettings: $('#btn-settings'),
    btnQuery: $('#btn-query'),
    btnLedger: $('#btn-ledger'),
    btnDict: $('#btn-dict'),
    btnMother: $('#btn-mother'),
    btnFixed: $('#btn-fixed'),
    btnReport: $('#btn-report'),
    btnCandidates: $('#btn-candidates'),
    btnSecurity: $('#btn-security'),
    btnImport: $('#btn-import'),
    btnExport: $('#btn-export'),
    btnHelp: $('#btn-help'),
  };

  let saveTimer = 0;
  let saving = false;
  let saveAgain = false;
  let booted = false;
  let needsOnboarding = false;
  let autoLockTimer = 0;
  let hiddenLockTimer = 0;
  let hiddenAt = 0;
  let autoLockBound = false;
  const AUTO_LOCK_IDLE = 5 * 60 * 1000;
  const AUTO_LOCK_HIDDEN = 30 * 1000;

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
    S.ledgerSource = TV.source.normalizeDomainSyntax(TV.source.ledgerToSource(
      S.dict, S.events, S.behaviors, S.notes,
    ));
    if (!S.fixedSource) {
      S.fixedSource = TV.source.fixedSourceFromPlans(S.plans || [], S.dict, { mode: S.mode, lang: S.lang });
    }
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
    const split = TV.userDict.split(S.dictSource);
    if (!split.ok) {
      const first = split.diagnostics.find((x) => x.severity === 'error') || split.diagnostics[0];
      throw new Error('字典拆分失败' + (first ? '（第 ' + first.line + ' 行）：' + first.message : ''));
    }
    S.systemVersion = TV.systemDict.VERSION_STRING;
    S.texts = {
      ledger, dict, vaultId: S.vaultId, ledgerHash, dictHash,
      ledgerSource: S.ledgerSource, fixedSource: S.fixedSource, dictSource: S.dictSource,
      dictSourceP: split.p, dictSourceC: split.c,
      plans: S.plans,
      systemVersion: S.systemVersion,
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
        vaultId: S.vaultId,
        ledgerSource: texts.ledgerSource,
        fixedSource: texts.fixedSource,
        dictSourceP: texts.dictSourceP,
        dictSourceC: texts.dictSourceC,
        systemVersion: texts.systemVersion,
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
      domain: S.domain || 'P', parent_id: '', weight: 10, sort: 100,
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
      query: dom.btnQuery, ledger: dom.btnLedger, dict: dom.btnDict, mother: dom.btnMother,
      fixed: dom.btnFixed, report: dom.btnReport,
    };
    Object.keys(views).forEach((view) => {
      if (views[view]) views[view].classList.toggle('is-active', S.view === view);
    });
    if (dom.btnMode) dom.btnMode.textContent = S.mode === 'CODE' ? t('modeCode') : t('modePlain');
    if (dom.btnLang) dom.btnLang.textContent = t('language');
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
  let plansDueRunning = false;
  let planSyncTimer = 0;

  function ensureEditor() {
    if (editorCtl || !TV.editor) return editorCtl;
    if (!S.ledgerSource || !S.dictSource) refreshSources();
    editorCtl = TV.editor.create(dom.editorView, {
      onChange: (file, text) => {
        if (file === 'ledger') S.ledgerSource = text;
        else S.dictSource = text;
        S.projCache = {};
        S.sourceDirty = true;
        if (file === 'ledger') S.pendingRepair = null;
        if (editorCtl) editorCtl.setDirty(file, true);
        clearTimeout(compileTimer);
        /* 回车后的模式投影不要等 260ms 防抖，立即编译/投影 */
        compileTimer = setTimeout(() => compileSources(), S.canonicalOnCompile ? 0 : 260);
      },
      onRun: () => {
        expandAllBatchLines();
        compileSources();
      },
      onActive: (file) => {
        S.view = file === 'dict' ? 'dict' : 'ledger';
        renderTabs();
        renderAll();
      },
      hint: sourceHint,
      onCursor: (file, line) => { if (file === 'ledger') onLedgerCursor(line); },
      onExpandBatch: (cm, line) => expandBatchInEditor(cm, line),
      onCanonicalLine: (cm, line) => markCanonicalOnEnter(cm, line),
      onConfirmVirtual: (row) => confirmPlanOccurrence(row),
      onVoidVirtual: (row) => voidPlanOccurrence(row),
      onTailDirty: () => renderFutureBlock(true),
      onAdoptMother: (id, domain) => {
        const r = adoptMother(id, '', domain);
        if (r.ok && S.dict.nodes[r.id]) r.name = S.dict.nodes[r.id].zh_name;
        return r;
      },
      toast: (msg, type) => toast(msg, type),
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

  function projectEditorSource(force, presentational) {
    if (!S.dict) return;
    if (!force && S.view !== 'ledger' && S.view !== 'dict') return;
    if (!force && S.view === 'dict') return;
    const cacheKey = S.mode + '|' + S.lang;
    if (S.projCache && S.projCache[cacheKey]) {
      S.ledgerSource = S.projCache[cacheKey];
      if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
      if (!presentational) { editorCtl && editorCtl.setDirty('ledger', true); setSaveState('dirty'); }
      return;
    }
    const byLine = new Map();
    const add = (line, rec) => {
      if (!line) return;
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line).push(rec);
    };
    (S.events || []).forEach((e) => add(e.sourceLine, { kind: 'E', e }));
    (S.behaviors || []).forEach((b) => add(b.sourceLine, { kind: 'B', b }));
    (S.notes || []).forEach((n) => add(n.line, { kind: 'X', n }));
    const recordsEnd = TV.source.recordsEndIndex(S.ledgerSource);
    const lines = S.ledgerSource.replace(/\n$/, '').split('\n').slice(0, recordsEnd);
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
      const cmtIdx = raw.indexOf('//');
      const cmt = cmtIdx >= 0 ? raw.slice(cmtIdx).trim() : '';
      const outBefore = out.length;
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
      /* 行尾注释（固定收支模板备注 / 手工注释）跟着行一起走 */
      if (cmt && out.length > outBefore) out[out.length - 1] += ' ' + cmt;
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
    if (!S.projCache) S.projCache = {};
    S.projCache[cacheKey] = S.ledgerSource;
    if (editorCtl) {
      editorCtl.setTexts(S.ledgerSource, S.dictSource);
      if (!presentational) editorCtl.setDirty('ledger', true);
    }
    if (!presentational) setSaveState('dirty');
  }

  function sourceHint(file, token, before) {
    const list = [];
    if (file === 'dict') {
      ['node', 'tag', 'item', 'alias', '->', '|', '[会计]', '[备注]', '[行为]'].forEach((x) => {
        if (!token || x.startsWith(token)) list.push({ text: x, displayText: x });
      });
      return { list };
    }
    if (file === 'ledger') {
      const res = analyzeInput(String(before || ''), String(before || '').length);
      const out = [];
      const seen = new Set();
      (res.suggestions || []).forEach((s) => {
        if (s.kind === 'mother') {
          const prefix = (res.context && res.context.prefix) || '';
          const text = '@@' + prefix + s.id + '@@';
          if (!seen.has(text)) {
            seen.add(text);
            out.push({
              text,
              displayText: (s.codeLabel ? s.codeLabel + '  ' : '') + (s.path || s.label || s.id),
              className: 'hint-mother',
            });
          }
          return;
        }
        const code = s.codeLabel || s.label || s.name;
        if (!code) return;
        const prefix = (res.context && res.context.prefix) || '';
        const text = prefix + code;
        if (seen.has(text)) return;
        seen.add(text);
        out.push({ text, displayText: text + '  ' + (s.name || s.label || '') + (s.type ? '  ' + s.type : '') });
      });
      return { list: out.slice(0, 14) };
    }
  }

  /* ---------------- 固定收支：独立的一张表（[固定] / [分期]） ----------------
   *
   * 固定收支不是流水文本的一部分，它是一张独立的表（fixed.tv）：
   *   · 行形和流水一样，只是最前面是 每日 / 每月16日 / 每年11月16日，
   *     最后面挂 *d / *m / *y；
   *   · 两个大区域：[固定] 与 [分期]（分期再加 共N期 首期=YYMMDD）；
   *   · 它定期向流水记录的未来区域添加流水：每月/分期到期自动落成真实流水，
   *     每日只摆今天，确认才落账（不确认就过期）。
   */

  function planModel() {
    return TV.planView.buildModel(S, new Date());
  }

  function planById(id) {
    return (S.plans || []).find((p) => p.id === id) || null;
  }

  function planSignature() {
    const list = (S.plans || []).map((p) => [
      p.id, p.status, p.kind, p.period, p.day, p.month, p.note,
      p.periods, p.firstMonth, p.principalCents, p.interestCents,
      p.from, p.to, p.amountCents, (p.tagIds || []).join(','), p.line,
      JSON.stringify(p.state || {}),
    ].join('\u0001'));
    const ev = S.events || [];
    const sum = ev.reduce((a, e) => a + Math.round(Number(e.amountCents) || 0), 0);
    const last = ev.length ? ev[ev.length - 1].date : '';
    return list.join('\u0002') + '|' + date.todayStamp() + '|' + S.lang + '|' + S.mode
      + '|' + ev.length + '|' + last + '|' + sum;
  }

  /** 未来记录 = 流水末尾的只读文本行；计划 / 日期 / 条数变了才重建。 */
  function renderFutureBlock(force) {
    if (!editorCtl || !editorCtl.setVirtualRows) return;
    const sig = planSignature();
    if (!force && sig === S.planDockSig) return;
    S.planDockSig = sig;
    editorCtl.setVirtualRows(TV.planView.futureLineRows(planModel(), 6));
  }

  const planActions = {
    confirm: (spec) => confirmPlanOccurrence(spec),
    void: (spec) => voidPlanOccurrence(spec),
    edit: (id) => gotoPlanLine(id),
  };

  /** 把 S.plans 写回独立的固定表文本（含生成/确认/作废状态）。 */
  function writeFixedSource() {
    if (!S.dict) return false;
    const next = TV.source.fixedSourceFromPlans(S.plans || [], S.dict, {
      mode: S.mode, lang: S.lang,
    });
    if (next === S.fixedSource) return false;
    S.fixedSource = next;
    if (fixedCtl && fixedCtl.cm && fixedCtl.cm.getValue() !== next) {
      fixedCtl.cm.setValue(next);
      fixedCtl.cm.clearHistory();
    }
    return true;
  }

  function gotoPlanLine(id) {
    const p = planById(id);
    if (!p || !p.line) return;
    setView('fixed');
    if (fixedCtl && fixedCtl.cm) {
      const l = Math.max(0, Math.min(p.line - 1, fixedCtl.cm.lineCount() - 1));
      fixedCtl.cm.setCursor({ line: l, ch: 0 });
      fixedCtl.cm.scrollIntoView({ line: l, ch: 0 }, 120);
      fixedCtl.cm.focus();
    }
  }

  /** 流水行：固定收支模板的备注作为行尾注释保留（NT 的 note）。 */
  function eventLineWithNote(e) {
    const line = renderEventLine(e);
    const note = String((e && e.note) || '').trim().replace(/\/\//g, '/ /');
    return note ? line + ' // ' + note : line;
  }

  /**
   * 确认某一期（NT 的 confirmOccurrence：记到「今天」这一笔）。
   * 固定表只多一个「确认=YYMM」状态，计划本身不动。
   */
  function confirmPlanOccurrence(spec) {
    if (!spec) return;
    const p = planById(spec.planId);
    if (!p) return;
    const ev = rulesMod.confirmOccurrence(p, spec, new Date(), { dict: S.dict });
    if (!ev) { toast('这一期认不出来', 'error'); return; }
    if (!(ev.amountCents > 0)) { toast('金额必须大于 0', 'error'); return; }
    const lineNo = insertLedgerLine(eventLineWithNote(ev));
    /* 确认是在未来行的行号菜单里点的：先把正文同步进编辑器，
     * 否则随后的未来区重建会从编辑器里读到旧正文，新流水要等切页才出现。 */
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    writeFixedSource();
    compileSources();
    /* 新流水落在它自己的日期上，把视口带到那一行（未来行在末尾，不滚会看不见） */
    if (editorCtl && lineNo) editorCtl.gotoLine('ledger', lineNo, 120);
    scheduleSave();
    toast('已确认' + (spec.periodIndex ? '（' + spec.periodIndex + ' 期）' : '') + '：' + rulesMod.shortDate(ev.date), 'ok');
  }

  /** 作废这一期：只记「作废=YYMM」，不删计划，也不写流水。 */
  function voidPlanOccurrence(spec) {
    if (!spec) return;
    const p = planById(spec.planId);
    if (!p) return;
    rulesMod.voidOccurrence(p, spec);
    writeFixedSource();
    compilePlansOnly();
    scheduleSave();
    toast('已作废这一期，固定表本身没动', 'ok');
  }

  /**
   * 到期自动落账（NT 口径）：
   *   · 只处理每月固定收支（每日、分期都不自动）；
   *   · 只补当前月这一期，日期 = 当月应发生日，备注 = 模板备注；
   *   · 生成后把月 key 记进「生成=」，删掉那一笔也不会复活。
   */
  function syncPlansDue(force) {
    if (!S.dict || !(S.plans || []).length || plansDueRunning) return false;
    const now = new Date();
    const today = date.todayStamp(now);
    if (!force && S.planDay === today) return false;
    plansDueRunning = true;
    try {
      S.planDay = today;
      const r = rulesMod.materializeDue(S.plans, now, { existing: S.events, dict: S.dict });
      const wrote = writeFixedSource();
      if (!r.generated && !wrote) return false;
      r.events.slice()
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .forEach((e) => insertLedgerLine(eventLineWithNote(e)));
      if (r.generated && editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
      compileSources();
      scheduleSave();
      if (r.generated) toast('已自动记账 ' + r.generated + ' 笔到期固定收支', 'ok');
      return true;
    } finally {
      plansDueRunning = false;
    }
  }

  function planDayTick() {
    if (!S.dict) return;
    if (S.planDay !== date.todayStamp()) syncPlansDue();
  }

  /**
   * 流水行尾录了 `*m` / `*d` / `*y`：
   *   · *m 保留这一笔的「日」；*d 不保留日期；*y 保留月 + 日；
   *   · 把它加进固定表，再把流水行尾的标记去掉。
   */
  function adoptInlinePeriods(r) {
    const plans = ((r && r.plans) || []).slice();
    let changed = false;
    const lines = String(S.ledgerSource || '').replace(/\n+$/, '').split('\n');
    ((r && r.events) || []).forEach((e) => {
      if (!e || !e.period || e.kind !== 'account' || !(e.amountCents > 0) || !e.sourceLine) return;
      const idx = e.sourceLine - 1;
      if (idx < 0 || idx >= lines.length) return;
      const period = e.period;
      const day = period === 'd' ? 0 : Number(e.date.slice(4, 6));
      const month = period === 'y' ? Number(e.date.slice(2, 4)) : 0;
      const same = plans.some((p) => p.from === e.from && p.to === e.to
        && p.amountCents === e.amountCents && p.period === period
        && (p.domain || 'P') === (e.domain || 'P')
        && (period === 'd' || rulesMod.dayOf(p) === day)
        && (period === 'y' ? rulesMod.monthOf(p) === month : true));
      if (!same) {
        plans.push({
          id: 'P_new_' + plans.length,
          kind: 'fixed',
          status: 'active',
          period,
          day,
          month,
          note: '',
          inst: null,
          /* NT 的 markPlanHandled：从哪一笔流水挂出来的，就把那个月记成已生成，
           * 避免到期自动补账时重复落一笔。 */
          state: { generated: [e.date.slice(0, 4)], confirmed: [], voided: [] },
          domain: e.domain || 'P',
          from: e.from,
          to: e.to,
          amountCents: e.amountCents,
          tagIds: (e.tagIds || []).slice(),
          line: 0,
        });
        changed = true;
      }
      const next = lines[idx].replace(/\s+\*[dmy]\b/gi, '');
      if (next !== lines[idx]) { lines[idx] = next; changed = true; }
    });
    S.plans = plans;
    if (!changed) return false;
    S.ledgerSource = lines.join('\n') + '\n';
    writeFixedSource();
    return true;
  }

  /**
   * 改了「自动落账」那一笔的金额 → 写回固定表模板（NT syncPlanFromEdit 的口径）。
   * 只认 generated 月份里唯一一条同流向流水，避免误改别的流水。
   */
  function syncPlanFromRows(plans, events) {
    let changed = false;
    (plans || []).forEach((plan) => {
      if (!plan || plan.kind === 'installment' || plan.period !== 'm') return;
      const st = plan.state || {};
      (st.generated || []).forEach((mk) => {
        const rows = (events || []).filter((e) => e && e.from === plan.from && e.to === plan.to
          && String(e.date || '').slice(0, 4) === mk);
        if (rows.length !== 1) return;
        const cents = Math.round(Number(rows[0].amountCents) || 0);
        if (cents > 0 && cents !== plan.amountCents) {
          plan.amountCents = cents;
          changed = true;
        }
      });
    });
    return changed;
  }

  function compileSources() {
    if (!S.dict || compiling) return;
    compiling = true;
    S.sourceDirty = false;
    clearTimeout(compileTimer);
    try {
      const r = TV.source.compileAll(S.dictSource, S.ledgerSource, {
        vaultId: S.vaultId, now: new Date(), domain: S.domain, system: TV.systemDict,
      });
      const prevDict = S.dict;
      S.dict = r.dict;
      rulesMod.remapRefs(S.rules, prevDict, S.dict);
      /* 独立的固定表：和流水各自编译，互不污染 */
      const fp = TV.source.compileFixed(fixedViewSource(), S.dict, {
        now: new Date(), domain: S.domain,
      });
      S.plans = fp.plans || [];
      S.fixedDiags = fp.diagnostics || [];
      S.events = r.events || [];
      S.behaviors = r.behaviors || [];
      S.notes = r.notes || [];
      S.projCache = {};
      if (syncPlanFromRows(S.plans, S.events)) writeFixedSource();
      const inlineChanged = adoptInlinePeriods({ events: r.events, plans: S.plans });
      S.sourceDiags = (r.dictDiagnostics || []).map((x) => Object.assign({ file: 'dict' }, x))
        .concat((r.ledgerDiagnostics || []).map((x) => Object.assign({ file: 'ledger' }, x)));
      if (editorCtl) editorCtl.setDiagnostics(S.sourceDiags);
      if (editorCtl && editorCtl.setSemantic) editorCtl.setSemantic('dict', r.dictTokens || []);
      renderCandidateButton();
      renderAll();
      scheduleSave();
      if (inlineChanged) {
        clearTimeout(planSyncTimer);
        planSyncTimer = setTimeout(() => {
          if (!syncPlansDue(true)) compileSources();
        }, 80);
      }
      if (r.autoTags && r.autoTags.length && editorCtl) {
        if (!isDictV4()) {
        /* v3：备注标签自动建，写回 dict.tv 的 [NOTE] 段，避免下次编译丢失 */
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
        /* v4：自动建的标签只在内存里参与本次编译，不写回字典，避免「未分类」垃圾 */
      }
      if (r.autoBehaviors && r.autoBehaviors.length && editorCtl) {
        if (!isDictV4()) {
        /* v3：行为项自动建，写回 dict.tv 的 [BEHAVIOR] 段 */
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
        /* v4：同上，不写回 */
      }
      if (editorCtl && isDictV4() && S.dictSource) {
        /* 自动标签写回会 setTexts（清空语义层），这里按新文本重新解析 tokens 补上 */
        const v4 = TV.dictV4.parse(S.dictSource, { system: TV.systemDict, now: new Date() });
        editorCtl.setSemantic('dict', v4.tokens || []);
      }
      if (S.canonicalOnCompile) {
        S.canonicalOnCompile = false;
        {
          const cm = editorCtl && editorCtl.editors ? editorCtl.editors.ledger : null;
          const saved = cm ? { cur: cm.getCursor(), scroll: cm.getScrollInfo() } : null;
          S.projCache = {};
          projectEditorSource(true, true);
          if (cm) {
            cm.setCursor({ line: Math.min(saved.cur.line, cm.lineCount() - 1), ch: saved.cur.ch });
            cm.scrollTo(saved.scroll.left, saved.scroll.top);
          }
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

  /* ---------------- 固定页：独立的固定表（文本编译器） ---------------- */
  let fixedCtl = null;

  function fixedViewSource() {
    if (!S.fixedSource) {
      S.fixedSource = TV.source.fixedSourceFromPlans(S.plans || [], S.dict, {
        mode: S.mode, lang: S.lang,
      });
    }
    return S.fixedSource;
  }

  function compilePlansOnly() {
    if (!S.dict) return false;
    const r = TV.source.compileFixed(S.fixedSource, S.dict, {
      now: new Date(), domain: S.domain,
    });
    S.plans = r.plans || [];
    S.fixedDiags = r.diagnostics || [];
    renderFixedErrors();
    renderFutureBlock(true);
    renderHUD();
    return r.ok;
  }

  function renderFixedErrors() {
    if (!fixedCtl || !fixedCtl.errors) return;
    clear(fixedCtl.errors);
    if (fixedCtl.summary) {
      const sum = rulesMod.summarizePlans(S.plans || [], S.dict, new Date());
      clear(fixedCtl.summary);
      const money = (c) => TV.amount.formatPlain(c);
      fixedCtl.summary.appendChild(el('span', {}, [
        '固定 ' + sum.fixedCount + ' 条 · 每月收入 ' + money(sum.monthlyIncome)
          + ' / 支出 ' + money(sum.monthlyExpense)
          + (sum.dailyIncome || sum.dailyExpense
            ? ' · 每日收入 ' + money(sum.dailyIncome) + ' / 支出 ' + money(sum.dailyExpense) : ''),
      ]));
      fixedCtl.summary.appendChild(el('span', {}, [
        '分期 ' + sum.installCount + ' 条 · 未还本金 ' + money(sum.remainingPrincipal)
          + ' / 利息 ' + money(sum.remainingInterest),
      ]));
    }
    const list = (S.fixedDiags || []);
    fixedCtl.note.textContent = t('fixedHint');
    if (!list.length) {
      fixedCtl.errors.appendChild(el('span', { class: 'fixed-ok' }, ['语法 OK']));
      return;
    }
    list.slice(0, 6).forEach((d) => {
      fixedCtl.errors.appendChild(el('div', { class: 'fixed-error' }, [
        '第 ' + d.line + ' 行：' + d.message,
      ]));
    });
  }

  function ensureFixed() {
    if (fixedCtl || !TV.editor) return fixedCtl;
    clear(dom.fixedView);
    const inner = el('div', { class: 'fixed-inner' });
    const head = el('div', { class: 'fixed-head' }, [
      el('div', { class: 'fixed-title' }, [t('fixedTitle')]),
      el('span', { class: 'fixed-sub' }, ['独立的表 · 定期向流水未来区域添加']),
    ]);
    const note = el('div', { class: 'fixed-note' }, [t('fixedHint')]);
    const host = el('div', { class: 'fixed-editor' });
    const summary = el('div', { class: 'fixed-summary' });
    const errors = el('div', { class: 'fixed-errors' });
    inner.appendChild(head);
    inner.appendChild(note);
    inner.appendChild(host);
    inner.appendChild(summary);
    inner.appendChild(errors);
    dom.fixedView.appendChild(inner);
    if (TV.editor && TV.editor.defineModes) TV.editor.defineModes();
    const cm = CodeMirror(host, {
      value: fixedViewSource(),
      mode: 'txtvein-ledger',
      theme: 'txtvein',
      lineNumbers: true,
      lineWrapping: window.matchMedia('(max-width: 760px)').matches,
      tabSize: 2,
      indentUnit: 2,
    });
    let timer = 0;
    cm.on('change', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        S.fixedSource = cm.getValue();
        compilePlansOnly();
        scheduleSave();
      }, 260);
    });
    fixedCtl = { cm, note, head, errors, summary };
    renderFixedErrors();
    setTimeout(() => cm.refresh(), 0);
    return fixedCtl;
  }

  function renderFixed() {
    ensureFixed();
    if (!fixedCtl) return;
    const src = fixedViewSource();
    if (fixedCtl.cm.getValue() !== src) {
      fixedCtl.cm.setValue(src);
      fixedCtl.cm.clearHistory();
    }
    fixedCtl.head.firstChild.textContent = t('fixedTitle');
    renderFixedErrors();
    setTimeout(() => fixedCtl.cm.refresh(), 0);
  }

  function renderFixedHint() {
    if (fixedCtl) {
      fixedCtl.head.firstChild.textContent = t('fixedTitle');
      renderFixedErrors();
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

  const STAT_TYPE_EN = { 收入: 'Income', 负债: 'Liabilities', 权益: 'Equity', 资产: 'Assets', 费用: 'Expenses', 成本: 'Cost' };
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
  function statsGroups(kind) {
    return TV.stats.groupStats(S.dict.nodes || {}, S.events || [], statsMonthRange(), {
      keyOf: kind === 'category'
        ? (n) => n.category_key || ''
        : (n) => n.id,
    });
  }
  function statsCategoryLabel(key) {
    return TV.stats.categoryLabel(S.dict.categories || [], key, S.lang);
  }
  function statsCellMoney(cents, type, field) {
    return TV.stats.statMoney(cents, type, field);
  }
  function statsColLabel(type, idx) {
    const zh = (TV.stats.STAT_COLS[type] || [])[idx] || ('c' + (idx + 1));
    const en = (TV.stats.STAT_COLS_EN[type] || [])[idx] || zh;
    return S.lang === 'en' ? en : zh;
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

  function statsTable(headers, rows, template, opts) {
    const o = opts || {};
    const nums = o.numCols || [];
    const wrap = el('div', { class: 'stats-table' });
    if (o.total) {
      // 收入/负债/权益这些是**单独一行**的主标题，上下居中；
      // 合计金额另起一行靠右贴底，避免同一个格子里互相拉扯。
      const title = el('div', {
        class: 'sd-row is-total is-total-title',
        style: 'grid-template-columns:' + template,
      });
      title.appendChild(el('span', { class: 'sd-total-title' }, [o.total[0]]));
      wrap.appendChild(title);

      const tr = el('div', { class: 'sd-row is-total', style: 'grid-template-columns:' + template });
      o.total.forEach((v, i) => {
        if (i === 0) {
          tr.appendChild(el('span', { class: 'sd-total-blank' }, ['']));
          return;
        }
        tr.appendChild(el('span', { class: nums.includes(i) ? 'sd-num' : '' }, [v]));
      });
      wrap.appendChild(tr);
    }
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
            const w = Math.max(28, Math.min(260, start + e.clientX - startX));
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

  function statsGroupTable(host, group, firstLabel, kind) {
    const fields = TV.stats.FIELDS;
    const headers = [firstLabel].concat(fields.map((f, i) => statsColLabel(group.type, i)));
    const total = [statsTypeLabel(group.type)]
      .concat(fields.map((f) => statsCellMoney(group.total[f], group.type, f)));
    const rows = group.rows.map((r) => ({
      id: kind === 'category' ? 'cat:' + r.key : r.key,
      cells: [(kind === 'category' ? statsCategoryLabel(r.key) : statsNodeLabel(r.key))]
        .concat(fields.map((f) => statsCellMoney(r[f], group.type, f))),
    }));
    const section = el('section', { class: 'lst-group' });
    section.appendChild(statsTable(headers, rows, 'var(--stats-first, 80px) repeat(4,minmax(0,1fr))', {
      numCols: [1, 2, 3, 4],
      resizable: true,
      selected: S.stats.selected,
      total,
      onClick: (row) => { S.stats.selected = row.id; S.stats.pane = 'detail'; renderStatsPage(); },
    }));
    host.appendChild(section);
  }

  function statsLeftCategory(host, groups) {
    groups.forEach((g) => statsGroupTable(host, g, S.lang === 'en' ? 'Category' : '分类', 'category'));
  }

  function statsLeftNode(host, groups) {
    groups.forEach((g) => statsGroupTable(host, g, S.lang === 'en' ? 'Node' : '节点', 'node'));
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
    const isCat = String(selected).startsWith('cat:');
    const rawCat = isCat ? String(selected).slice(4) : '';
    const isUncat = rawCat === '未分类' || rawCat === '';
    const evs = (S.events || []).filter((e) => {
      if (!statsDateIn(e.date, range)) return false;
      if (!isCat) return e.from === selected || e.to === selected;
      const f = S.dict.nodes[e.from];
      const t = S.dict.nodes[e.to];
      const hit = (n) => (isUncat ? !(n && n.category_key) : !!(n && n.category_key === rawCat));
      return hit(f) || hit(t);
    });
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

  function reportModeToggle() {
    const wrap = el('div', { class: 'report-mode' });
    [['private', t('reportPrivate')], ['public', t('reportPublic')]].forEach((pair) => {
      const b = el('button', {
        class: 'report-mode-btn' + (S.reportMode === pair[0] ? ' is-active' : ''),
        type: 'button',
      }, [pair[1]]);
      b.addEventListener('click', () => {
        if (S.reportMode === pair[0]) return;
        S.reportMode = pair[0];
        renderReport();
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderPublicReportPage() {
    clear(dom.reportView);
    const now = new Date();
    const pub = TV.publicReport.build(S.dict, S.events, TV.systemDict, {
      range: S.range, domain: S.domain, lang: S.lang, now,
    });
    const page = el('div', { class: 'stats-page public-report' });
    page.appendChild(reportModeToggle());
    const head = el('div', { class: 'public-head' }, [
      el('h2', { class: 'public-title' }, [t('publicTitle')]),
      el('span', { class: 'public-range' }, [pub.rangeLabel || S.range || '']),
    ]);
    page.appendChild(head);

    const cards = el('div', { class: 'public-cards' });
    const card = (label, value, cls) => el('div', { class: 'public-card ' + (cls || '') }, [
      el('span', { class: 'public-card-label' }, [label]),
      el('b', { class: 'public-card-value' }, [amount.formatPlain(value)]),
    ]);
    cards.appendChild(card(t('anchored'), pub.anchored.closing, 'is-anchored'));
    cards.appendChild(card(t('unclassified'), pub.unclassified.totals.closing, 'is-unclassified'));
    cards.appendChild(card(t('staleAnchor'), pub.stale.totals.closing, 'is-stale'));
    page.appendChild(cards);

    const treeWrap = el('div', { class: 'public-tree' });
    const renderTree = (arr, depth) => {
      (arr || []).forEach((n) => {
        treeWrap.appendChild(el('div', {
          class: 'public-tree-row',
          style: 'padding-left:' + (depth * 16) + 'px',
        }, [
          el('span', { class: 'public-tree-label' }, [n.label || n.id]),
          el('span', { class: 'public-tree-amount' }, [amount.formatPlain(n.totals.closing)]),
          el('span', { class: 'public-tree-count' }, [String(n.totals.count || 0)]),
        ]));
        renderTree(n.children, depth + 1);
      });
    };
    const root = pub.tree.children && pub.tree.children[0];
    if (root) renderTree(root.children, 0);
    if (!treeWrap.children.length) {
      treeWrap.appendChild(el('p', { class: 'help-text' }, [
        S.lang === 'en' ? 'No anchored entries in this range.' : '本期还没有已归类节点。',
      ]));
    }
    page.appendChild(treeWrap);

    const bucket = (title, b, cls) => {
      const sec = el('section', { class: 'public-bucket ' + (cls || '') }, [
        el('h3', {}, [title + ' · ' + amount.formatPlain(b.totals.closing)]),
      ]);
      (b.rows || []).slice(0, 12).forEach((row) => {
        sec.appendChild(el('div', { class: 'public-bucket-row' }, [
          el('span', {}, [statsNodeLabel(row.id)]),
          el('span', {}, [amount.formatPlain(row.closing)]),
        ]));
      });
      return sec;
    };
    page.appendChild(bucket(t('unclassified'), pub.unclassified, 'is-unclassified'));
    page.appendChild(bucket(t('staleAnchor'), pub.stale, 'is-stale'));

    const rc = pub.reconcile;
    page.appendChild(el('div', {
      class: 'public-reconcile ' + (rc.ok ? 'is-ok' : 'is-bad'),
    }, [
      t('reconcile') + '：'
        + amount.formatPlain(rc.privateTotal) + ' = '
        + amount.formatPlain(rc.anchored) + ' + '
        + amount.formatPlain(rc.unclassified) + ' + '
        + amount.formatPlain(rc.stale)
        + (rc.ok ? '  ✓' : '  ✗'),
    ]));
    dom.reportView.appendChild(page);
  }

  function renderStatsPage() {
    if (S.reportMode === 'public') {
      renderPublicReportPage();
      return;
    }
    if (!S.stats) S.stats = { tab: 'category', month: new Date().getMonth() + 1, selected: '', split: 380 };
    if (!S.stats.first) {
      const savedFirst = Number(localStorage.getItem('txtvein:stats-first'));
      S.stats.first = Number.isFinite(savedFirst) && savedFirst >= 24 ? savedFirst : 80;
    }
    const range = statsMonthRange();
    const groups = statsGroups(S.stats.tab === 'category' ? 'category' : 'node');
    clear(dom.reportView);
    const page = el('div', { class: 'stats-page' });
    page.appendChild(reportModeToggle());
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
    if (S.stats.tab === 'category') statsLeftCategory(left, groups);
    else if (S.stats.tab === 'node') statsLeftNode(left, groups);
    else if (S.stats.tab === 'note') statsLeftNote(left, range);
    else statsLeftEvent(left, range);

    const selectedName = S.stats.selected
      ? (S.stats.tab === 'note' ? statsTagLabel(S.stats.selected)
        : S.stats.tab === 'event' ? TV.dict.renderBehavior(S.dict, S.stats.selected, S.mode, S.lang)
          : S.stats.tab === 'category' && String(S.stats.selected).startsWith('cat:')
            ? statsCategoryLabel(String(S.stats.selected).slice(4))
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
    dom.motherView.hidden = S.view !== 'mother';
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
      renderFixed();
    } else if (S.view === 'report') {
      ensureReport();
      renderReport();
    } else if (S.view === 'mother') {
      renderMother();
    }
    updateFeedback();
  }

  function renderMother() {
    if (panels && panels.renderMotherPage) panels.renderMotherPage(app, dom.motherView);
  }

  function renderAll() {
    if (!S.dict) return;
    S.calcAll = calcMod.compute(S.dict, S.events, { range: null });
    renderHUD();
    renderTabs();
    renderFutureBlock();
    if (S.view === 'query') renderQuery();
    else if (S.view === 'fixed') renderFixed();
    else if (S.view === 'report') { ensureReport(); renderReport(); }
    else if (S.view === 'mother') renderMother();
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

  function eventsOfBook() {
    return (S.events || []).filter((e) => !S.domain || !e.domain || e.domain === S.domain);
  }

  function usageIndex(role) {
    const idx = {};
    eventsOfBook().forEach((e) => {
      const id = role === 'from' ? e.from : e.to;
      if (id) idx[id] = (idx[id] || 0) + 1;
    });
    return idx;
  }

  function anchorUsage(role) {
    const idx = {};
    eventsOfBook().forEach((e) => {
      const id = role === 'from' ? e.from : e.to;
      const n = S.dict && S.dict.nodes ? S.dict.nodes[id] : null;
      if (n && n.anchor_id) idx[n.anchor_id] = (idx[n.anchor_id] || 0) + 1;
    });
    return idx;
  }

  function systemDepth(id) {
    const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
    let d = 0;
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && nodes[cur].parent_id && guard < 64) {
      d += 1;
      cur = nodes[cur].parent_id;
      guard += 1;
    }
    return d;
  }

  function topOf(id) {
    const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
    const chain = [];
    let cur = id;
    let guard = 0;
    while (cur && nodes[cur] && guard < 64) { chain.unshift(cur); cur = nodes[cur].parent_id; guard += 1; }
    const at = chain.findIndex((x) => nodes[x].kind === 'type');
    return at >= 0 ? (chain[at + 1] || '') : '';
  }

  /* 用户习惯的层级：按分支统计“绑到哪一层最多”，没有分支数据就回退全局 */
  function levelPreference() {
    const byTop = {};
    const global = {};
    const add = (id) => {
      const n = S.dict && S.dict.nodes ? S.dict.nodes[id] : null;
      if (!n || !n.anchor_id) return;
      const d = systemDepth(n.anchor_id);
      if (!d) return;
      const top = topOf(n.anchor_id);
      if (top) {
        byTop[top] = byTop[top] || {};
        byTop[top][d] = (byTop[top][d] || 0) + 1;
      }
      global[d] = (global[d] || 0) + 1;
    };
    eventsOfBook().forEach((e) => { add(e.from); add(e.to); });
    const preferred = (id) => {
      const top = topOf(id);
      const m = (top && byTop[top]) || global;
      let best = 0;
      let bestD = 0;
      Object.keys(m).forEach((d) => {
        if (m[d] > best) { best = m[d]; bestD = Number(d); }
      });
      return bestD;
    };
    return { preferred };
  }

  function motherMatches(query, limit, role) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const nodes = (TV.systemDict && TV.systemDict.nodes) || {};
    const aliases = (TV.systemDict && TV.systemDict.aliases) || [];
    const use = anchorUsage(role);
    const pref = levelPreference().preferred;
    const out = [];
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      if (n.kind !== 'category') return;
      const fields = (S.lang === 'en' ? [n.en_name, n.en_code] : [n.zh_name, n.zh_code])
        .map((x) => String(x || '').toLowerCase()).filter(Boolean);
      let score = 0;
      if (fields.some((x) => x === q)) score = 100;
      else if (fields.some((x) => x.startsWith(q))) score = 70;
      else if (fields.some((x) => x.includes(q))) score = 45;
      if (!score) {
        const hit = aliases.some((a) => a.id === id && a.lang === S.lang
          && String(a.alias || '').toLowerCase().startsWith(q));
        if (hit) score = 60;
      }
      if (!score) return;
      const full = TV.systemDictCore.pathLabel(nodes, id, S.lang);
      const seg = full.split(' / ').slice(1);
      const path = seg.slice(-2).join(' / ') || full;
      out.push({
        id, kind: 'mother', kindTag: '母树', name: n.zh_name,
        label: n.zh_name, codeLabel: n.zh_code || n.en_code || '',
        path,
        score, sameLevel: systemDepth(id) === pref(id),
        used: use[id] || 0,
      });
    });
    out.sort((a, b) => (Number(b.sameLevel) - Number(a.sameLevel))
      || (b.used - a.used) || (b.score - a.score) || a.id.localeCompare(b.id));
    return out.slice(0, limit || 2);
  }

  function sortForRole(list, role) {
    const use = usageIndex(role);
    return list.slice().sort((a, b) => {
      if (role === 'from') {
        const ea = a.type === '费用' ? 1 : 0;
        const eb = b.type === '费用' ? 1 : 0;
        if (ea !== eb) return ea - eb;
      }
      return (use[b.id] || 0) - (use[a.id] || 0);
    });
  }

  function exactNodeId(token, domain, strict) {
    const low = String(token || '').toLowerCase();
    if (!low) return '';
    const nodes = (S.dict && S.dict.nodes) || {};
    const fields = [];
    const exact = new Map();
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      if (!n || n.system) return;
      if (domain && String(n.domain || 'P').toUpperCase() !== String(domain).toUpperCase()) return;
      [n.zh_code, n.en_code, n.zh_name, n.en_name].forEach((x) => {
        const v = String(x || '').toLowerCase();
        if (v) { fields.push(v); exact.set(v, id); }
      });
    });
    Object.keys(S.dict.aliases || {}).forEach((k) => {
      const targets = (S.dict.aliases[k] || []).filter((id) => {
        const n = nodes[id];
        return n && !n.system
          && (!domain || String(n.domain || 'P').toUpperCase() === String(domain).toUpperCase());
      });
      if (!targets.length) return;
      const lowK = String(k).toLowerCase();
      fields.push(lowK);
      if (!exact.has(lowK)) exact.set(lowK, targets[0]);
    });
    if (!exact.has(low)) return '';
    /* 还是更长代码/名称的前缀时，不当作“已经录完” */
    if (strict !== false && fields.some((x) => x.length > low.length && x.startsWith(low))) return '';
    return exact.get(low) || '';
  }

  function analyzeInput(value, caret) {
    if (!S.dict) return { suggestions: [], state: 'STATE_FROM', hint: '' };
    const before = value.slice(0, caret);
    const { token, start, end } = currentToken(value, caret);
    let domCode = activeDomain(value);
    let prefix = '';
    let query = token;
    const pm = token.match(/^([PFCH]):(.*)$/i);
    if (pm) {
      prefix = pm[1].toUpperCase() + ':';
      query = pm[2];
      domCode = pm[1].toUpperCase();
    }
    const clean = query.replace(/^!/, '');
    const isAmountToken = (tok) => {
      const t = String(tok || '').trim();
      if (!t) return false;
      if (t === '*' || /^\d+(?:\.\d+)?\*$/.test(t) || /^\d+(?:\.\d+)?\/$/.test(t)) return true;
      if (exactNodeId(t, domCode, false)) return false;
      const sp = amount.splitPeriod(t);
      return amount.parseQuantity(sp.token).ok;
    };

    const hasLt = before.includes('<');
    const gt = before.lastIndexOf('>');
    let role = 'from';
    let stateLabel = 'STATE_FROM';
    let hint = '转出节点 · 空格继续下一个，> 进入转入';
    if (hasLt) {
      role = 'tag';
      stateLabel = 'STATE_TAG';
      hint = '标签 · 空格同级，< 父子；#行内标签也可';
    } else if (gt >= 0) {
      const seg = before.slice(gt + 1);
      const toks = seg.trim() ? seg.trim().split(/[\s\u3000]+/) : [];
      const amountStarted = toks.some(isAmountToken);
      if (amountStarted || (clean && isAmountToken(clean))) {
        role = 'amount';
        stateLabel = 'STATE_AMOUNT';
        hint = '金额 · 35 / 3.5k；时间 90m / 1h30m / 1d；1000*m 挂周期规则';
      } else {
        role = 'to';
        stateLabel = 'STATE_TO';
        hint = '转入节点 · 空格继续下一个，金额开始后停止推荐';
      }
    }

    let suggestions = [];
    let exactId = '';
    let batchHint = '';
    if (role === 'amount' && gt >= 0 && (before.match(/>/g) || []).length === 1) {
      const left = before.slice(0, gt).trim();
      const seg = before.slice(gt + 1);
      const fromToks = left ? left.split(/[\s\u3000]+/).filter((x) => x && !/^\*[dmy]$/i.test(x)) : [];
      const all = seg.trim() ? seg.trim().split(/[\s\u3000]+/) : [];
      const firstAmt = all.findIndex((x) => isAmountToken(x));
      const toToks = (firstAmt < 0 ? all : all.slice(0, firstAmt)).filter((x) => x && !/^\*[dmy]$/i.test(x));
      const amtToks = firstAmt < 0 ? [] : all.slice(firstAmt);
      const fromCount = fromToks.length;
      const toCount = toToks.length;
      const total = (fromCount > 1 && toCount > 1)
        ? (fromCount === toCount ? fromCount : Math.max(fromCount, toCount))
        : Math.max(fromCount, toCount);
      if (total > 1 && (fromCount > 1 || toCount > 1)) {
        const trailing = /\s$/.test(seg);
        const current = amtToks.length + (trailing ? 1 : 0);
        const idx = Math.max(1, Math.min(total, current || 1));
        batchHint = '金额 ' + idx + '/' + total + ' · 可 * 循环 / 100/ 均摊';
      }
    }
    if (role === 'from' || role === 'to') {
      if (clean) {
        const r = D.resolveAlias(S.dict, clean, { domain: domCode, lang: S.lang });
        if (r.ok && r.node) exactId = r.id;
        suggestions = D.searchNodes(S.dict, clean, { domain: domCode, lang: S.lang, limit: 200 });
      } else {
        suggestions = D.searchNodes(S.dict, '', { domain: domCode, lang: S.lang, limit: 200 });
      }
      suggestions = sortForRole(suggestions, role);
      if (clean.length >= 2) {
        /* 母树匹配固定在最后两个名额；已经作为私有节点锚点出现的不重复 */
        const anchors = new Set();
        suggestions.forEach((s) => {
          const n = S.dict.nodes[s.id];
          if (n && n.anchor_id) anchors.add(n.anchor_id);
        });
        const mm = motherMatches(clean, 2, role).filter((m) => !anchors.has(m.id));
        const keep = Math.max(1, 8 - mm.length);
        suggestions = suggestions.slice(0, keep).concat(mm);
      }
      suggestions = suggestions.slice(0, 8);
      if (exactId) {
        const hit = suggestions.find((s) => s.id === exactId);
        if (hit) suggestions = [hit].concat(suggestions.filter((s) => s.id !== exactId));
      }
    } else if (role === 'tag') {
      const tq = query.replace(/^#/, '');
      if (tq) {
        const r = D.resolveTag(S.dict, tq, { domain: domCode, lang: S.lang });
        if (!r.ok) suggestions = D.searchTags(S.dict, tq, { domain: domCode, lang: S.lang, limit: 8 });
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

    const exactNode = !!clean && !!exactNodeId(clean, domCode, false);
    return {
      suggestions,
      context: {
        token, start, end, role, prefix, domain: domCode, options: suggestions,
        atNodeBoundary: role === 'to' && exactNode && !/\s$/.test(before),
        exactNode,
      },
      state: stateLabel,
      hint,
      batchHint,
      prediction,
    };
  }

  function handleChoose(ctx, s, index, list) {
    if (!ctx || !s) return;
    const value = dom.input.value;
    const token = ctx.token || '';
    if (s.kind === 'mother') {
      const raw = (ctx.prefix && token.indexOf(ctx.prefix) === 0 ? token.slice(ctx.prefix.length) : token)
        .replace(/^!/, '');
      const r = adoptMother(s.id, raw, ctx.domain);
      if (!r.ok) { toast(r.error, 'error'); return; }
      const replacement = (ctx.prefix || '') + r.code;
      TV.inputApi.setValue(value.slice(0, ctx.start) + replacement + value.slice(ctx.end),
        ctx.start + replacement.length);
      const nm = S.dict.nodes[r.id] ? S.dict.nodes[r.id].zh_name : raw;
      toast('已建节点「' + nm + '」[' + r.code + '] · ' + r.category, 'ok');
      return;
    }
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
    if (ctx.role === 'to' && !/\s$/.test(replacement)) replacement += ' ';
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
    let line = TV.text.toHalfWidthDigits(TV.text.normalize(raw)).trim();
    if (!line) return line;
    let domain = S.domain || 'P';
    let rest = line;
    const dm = line.match(/^(?:\[([PFCH])\]|([PFCH])\s+)\s*/i);
    if (dm) {
      domain = (dm[1] || dm[2]).toUpperCase();
      rest = line.slice(dm[0].length).trim();
    }
    rest = rest.replace(/^[\u2212\u2013\u2014\uFF0D]/, '-').replace(/^\uFF0B/, '+');
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

  /** 正文行（[固定]/[分期] 段之前，不含 20 行空行）。 */
  function ledgerHeadLines() {
    const src = String(S.ledgerSource || '').replace(/\n+$/, '');
    const end = TV.source.recordsEndIndex(src);
    return src.split('\n').slice(0, end);
  }

  function setLedgerHead(head) {
    S.ledgerSource = head.join('\n') + '\n';
    S.projCache = {};
  }

  function insertLedgerLine(text) {
    const lines = ledgerHeadLines();
    const dm = String(text || '').match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(\d{6})\b/i);
    let at = lines.length;
    if (dm) {
      const stamp = dm[1];
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(\d{6})\b/i);
        if (m && m[1] > stamp) { at = i; break; }
      }
    }
    lines.splice(at, 0, text);
    setLedgerHead(lines);
    return at + 1;
  }

  function fromTokenOfLine(line) {
    const m = String(line || '').match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(?:\d{6}\s+)?([^\s>]+)\s*>/);
    return m ? m[1] : '';
  }

  function onLedgerCursor(line) {
    if (!editorCtl || S.view !== 'ledger') return;
    /* [固定]/[分期] 段里的错误就地改文本，不抢到录入框里 */
    if (line > TV.source.recordsEndIndex(S.ledgerSource)) {
      if (TV.inputApi.isEditing() && S.pendingRepair) {
        S.pendingRepair = null;
        TV.inputApi.setEditing(false);
        TV.inputApi.clear();
      }
      return;
    }
    const err = (S.sourceDiags || []).find((d) => d.file === 'ledger' && d.severity === 'error' && d.line === line);
    if (!err) {
      if (TV.inputApi.isEditing() && S.pendingRepair && S.pendingRepair.line !== line) {
        S.pendingRepair = null;
        TV.inputApi.setEditing(false);
        TV.inputApi.clear();
      }
      return;
    }
    if (S.pendingRepair && S.pendingRepair.line === line && TV.inputApi.isEditing()) return;
    const lines = String(S.ledgerSource || '').replace(/\n+$/, '').split('\n');
    const text = lines[line - 1] || '';
    S.pendingRepair = { line, lineText: text };
    TV.inputApi.setEditing(true, text, '第 ' + line + ' 行错误 · 改完回车替换');
  }

  function expandBatchLine(line) {
    if (!S.dict) return null;
    if ((String(line).match(/>/g) || []).length !== 1) return null;
    const parsed = TV.source.compileLedgerSource(line, S.dict, { now: new Date(), domain: S.domain });
    if (!parsed.ok || !parsed.events || parsed.events.length < 2) return null;
    const lt = String(line).indexOf('<');
    const tagPart = lt >= 0 ? String(line).slice(lt).trim() : '';
    const pm = String(line).match(/\*([dmy])\b/i);
    return parsed.events.map((e) => {
      const pre = e.domain && e.domain !== 'P' ? e.domain + ' ' : '';
      return pre + e.date + ' ' + e.raw
        + (pm ? ' *' + pm[1].toLowerCase() : '')
        + (tagPart ? ' ' + tagPart : '');
    });
  }

  function markCanonicalOnEnter(cm, line) {
    if (line >= TV.source.recordsEndIndex(S.ledgerSource)) return false;
    const text = cm.getLine(line) || '';
    if (!text.trim() || text.trim().startsWith('//')) return false;
    const parsed = TV.source.compileLedgerSource(text, S.dict, { now: new Date(), domain: S.domain });
    if (!parsed.ok) return false;
    S.canonicalOnCompile = true;
    return false;
  }

  function expandBatchInEditor(cm, line) {
    /* [固定]/[分期] 段里的行不是流水，不参与批量拆行 */
    if (line >= TV.source.recordsEndIndex(S.ledgerSource)) return false;
    const text = cm.getLine(line) || '';
    const expanded = expandBatchLine(text);
    if (!expanded || expanded.length < 2) return false;
    if (cm.closeHint) cm.closeHint();
    S.canonicalOnCompile = true;
    cm.replaceRange(expanded.join('\n') + '\n', { line, ch: 0 }, { line, ch: text.length });
    cm.setCursor({ line: line + expanded.length, ch: 0 });
    cm.focus();
    return true;
  }

  function expandAllBatchLines() {
    const lines = ledgerHeadLines();
    let changed = false;
    const out = [];
    lines.forEach((l) => {
      if ((l.match(/>/g) || []).length === 1) {
        const expanded = expandBatchLine(l);
        if (expanded && expanded.length > 1) {
          out.push(...expanded);
          changed = true;
          return;
        }
      }
      out.push(l);
    });
    if (!changed) return false;
    setLedgerHead(out);
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    return true;
  }

  function submitExpanded(lines, rawLine, replaceLine) {
    S.canonicalOnCompile = true;
    let out = ledgerHeadLines()
      .filter((x, i, arr) => !(arr.length === 1 && x === ''));
    let at = -1;
    if (replaceLine && replaceLine > 0) {
      at = Math.max(0, Math.min(replaceLine - 1, out.length));
      out.splice(at, 1, ...lines);
    } else {
      /* 同一条批量原文之前可能已粘进源码：先去掉，避免再叠一份 */
      if (rawLine) out = out.filter((x) => String(x).trim() !== String(rawLine).trim());
      const m = String(rawLine || '').match(/^(?:\[[PFCH]\]|[PFCH]\s+)?(\d{6})\b/i);
      at = out.length;
      if (m) {
        for (let i = 0; i < out.length; i += 1) {
          const d = out[i].match(/^\s*(?:(?:\[[PFCH]\]|[PFCH])\s*)?(\d{6})\b/i);
          if (d && d[1] > m[1]) { at = i; break; }
        }
      }
      out.splice(at, 0, ...lines);
    }
    setLedgerHead(out);
    const lineNos = lines.map((_, i) => at + i + 1);
    S.pendingRepair = null;
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    S.view = 'ledger';
    applyView();
    compileSources();
    const errors = (S.sourceDiags || []).filter((d) => d.file === 'ledger' && lineNos.includes(d.line) && d.severity === 'error');
    TV.inputApi.setEditing(false);
    TV.inputApi.clear();
    if (errors.length) {
      const first = errors[0];
      S.pendingRepair = { line: first.line, lineText: lines[lineNos.indexOf(first.line)] || '' };
      toast('批量写入有 ' + errors.length + ' 行错误 · 点对应行修正：' + first.message, 'error');
    } else {
      TV.inputApi.clearError();
      toast('已写入 ' + lines.length + ' 行并编译', 'ok');
    }
    return { ok: errors.length === 0, lines: lineNos, expanded: lines, errors };
  }

  function submitEntry(raw, opts) {
    if (!S.dict) return { ok: false, error: '账本未加载' };
    const line = normalizeInputLine(raw);
    if (!line) return { ok: false, error: '空输入' };
    S.canonicalOnCompile = true;
    const sameFrom = !!(S.pendingRepair && fromTokenOfLine(S.pendingRepair.lineText)
      && fromTokenOfLine(S.pendingRepair.lineText) === fromTokenOfLine(line));
    const repairing = !!(S.pendingRepair && TV.inputApi.isEditing() && sameFrom);
    const expanded = expandBatchLine(line);
    if (expanded && expanded.length > 1) {
      return submitExpanded(expanded, line, repairing ? S.pendingRepair.line : 0);
    }
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
      /* 不自动进修正模式；用户把光标定位到波浪线那一行时才进入 */
      TV.inputApi.setEditing(false);
      TV.inputApi.clear();
      const mm0 = String(errors[0].message || '').match(/[：:]\s*([^\s，。；;、]+)/);
      const unknownToken = mm0 ? mm0[1].replace(/[「」“”"'()（）]/g, '') : '';
      const canAdopt = isDictV4() && unknownToken && /未知|UNBOUND|没有|未绑定/.test(String(errors[0].message || ''));
      if (canAdopt) {
        toast('已存为待修复文本（X_）：' + errors[0].message, 'error', {
          label: '从母树建',
          fn: () => panels.motherPicker(app, unknownToken, () => repairLine(lineNo, line)),
        });
      } else {
        toast('已存为待修复文本（X_ 第 ' + lineNo + ' 行）· 点该行修正：' + errors[0].message, 'error');
      }
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
    /* 计划行写的是简码/名字，先按新字典重新编译，再统一投影回当前模式 */
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    S.canonicalOnCompile = true;
    compileSources();
  }

  function nodeHasHistory(id) {
    return (S.events || []).some((e) => e.from === id || e.to === id);
  }

  function isDictV4() {
    return !!(S.dict && S.dict.format === 'v4' && TV.dictV4);
  }

  function pickCategoryFor(type, categoryKey) {
    const list = (S.dict.categories || []);
    if (categoryKey) {
      const hit = list.find((c) => c.key === categoryKey);
      if (hit) return hit;
    }
    const same = list.filter((c) => c.type === type);
    if (same.length) return same[0];
    return TV.dictV4.ensureCategory(S.dict, type || '费用', '未分类', {}).cat;
  }

  function addNode(spec) {
    const anchorId = spec && spec.anchor_id != null ? String(spec.anchor_id) : null;
    const clean = Object.assign({}, spec || {});
    delete clean.anchor_id;
    const catKey = clean.category_key || '';
    delete clean.category_key;
    let v4cat = null;
    if (isDictV4()) {
      v4cat = pickCategoryFor(clean.type, catKey);
      clean.type = v4cat.type;
      clean.category_key = v4cat.key;
      clean.category = v4cat.name;
      const tm = D.normalizeType(v4cat.type);
      if (tm.ok) { clean.polarity = tm.pole; clean.form = tm.form; }
    }
    const r = D.addNode(S.dict, clean);
    if (!r.ok) return r;
    if (isDictV4()) {
      const nd = S.dict.nodes[r.id];
      nd.category_key = v4cat.key;
      nd.category = v4cat.name;
      nd.en_auto = !clean.en_name;
      nd.en_code_auto = !clean.en_code;
      if (nd.en_code_auto) nd.en_code = /[A-Za-z]/.test(nd.zh_code) ? nd.zh_code.toLowerCase() : nd.zh_code;
      TV.dictV4.placeNode(S.dict, r.id, v4cat.key);
      if (anchorId) {
        const a = TV.dictV4.setNodeAnchor(S.dict, r.id, anchorId, TV.systemDict);
        if (!a.ok) { D.removeNode(S.dict, r.id); return a; }
      }
    } else if (anchorId != null && anchorId !== '') {
      const a = TV.anchor.set(S.dict, r.id, anchorId, TV.systemDict, { hasHistory: false });
      if (!a.ok) {
        D.removeNode(S.dict, r.id);
        return a;
      }
    }
    syncDictSourceAndCompile();
    return r;
  }

  function updateNode(id, spec) {
    const before = S.dict.nodes[id] ? Object.assign({}, S.dict.nodes[id]) : null;
    const hasAnchor = spec && Object.prototype.hasOwnProperty.call(spec, 'anchor_id');
    const anchorId = hasAnchor ? String(spec.anchor_id || '') : null;
    const clean = Object.assign({}, spec || {});
    delete clean.anchor_id;
    const nextCatKey = clean.category_key;
    delete clean.category_key;
    const r = D.updateNode(S.dict, id, clean);
    if (!r.ok) return r;
    if (isDictV4()) {
      const nd = S.dict.nodes[id];
      if (Object.prototype.hasOwnProperty.call(clean, 'en_name')) nd.en_auto = !clean.en_name;
      if (Object.prototype.hasOwnProperty.call(clean, 'en_code')) {
        nd.en_code_auto = !clean.en_code;
        if (nd.en_code_auto) nd.en_code = /[A-Za-z]/.test(nd.zh_code) ? nd.zh_code.toLowerCase() : nd.zh_code;
      }
      if (nextCatKey) {
        const p = TV.dictV4.placeNode(S.dict, id, nextCatKey);
        if (!p.ok) {
          if (before) { S.dict.nodes[id] = before; D.rebuildAliases(S.dict); }
          return p;
        }
      } else {
        const node = S.dict.nodes[id];
        if (!node.category_key) {
          const cat = pickCategoryFor(node.type, '');
          node.category_key = cat.key;
          node.category = cat.name;
          TV.dictV4.placeNode(S.dict, id, cat.key);
        } else {
          TV.dictV4.placeNode(S.dict, id, node.category_key);
        }
      }
      if (hasAnchor) {
        const a = TV.dictV4.setNodeAnchor(S.dict, id, anchorId, TV.systemDict);
        if (!a.ok) {
          if (before) { S.dict.nodes[id] = before; D.rebuildAliases(S.dict); }
          return a;
        }
      }
    } else if (hasAnchor) {
      const a = TV.anchor.set(S.dict, id, anchorId, TV.systemDict, { hasHistory: nodeHasHistory(id) });
      if (!a.ok) {
        if (before) {
          S.dict.nodes[id] = before;
          D.rebuildAliases(S.dict);
        }
        return a;
      }
    }
    syncDictSourceAndCompile();
    return r;
  }

  function deleteNode(id) {
    if (countNodeRefs(id)) return { ok: false, error: '节点仍被流水引用' };
    const r = D.removeNode(S.dict, id);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  /* ---------------- v4 统计分类 ---------------- */

  function addCategory(spec) {
    if (!isDictV4()) return { ok: false, error: '当前字典不是 v4' };
    const inSpec = spec || {};
    const name = String(inSpec.name || '').trim();
    if (!name) return { ok: false, error: '统计分类要有名称' };
    const tm = D.normalizeType(inSpec.type || '费用');
    if (!tm.ok) return tm;
    const r = TV.dictV4.ensureCategory(S.dict, tm.type, name, { en_name: inSpec.en_name || '' });
    if ((inSpec.anchor_ref || '').trim()) {
      const a = TV.dictV4.setCategoryAnchor(S.dict, r.key, inSpec.anchor_ref.trim(), TV.systemDict);
      if (!a.ok) return a;
    }
    syncDictSourceAndCompile();
    return { ok: true, key: r.key, cat: r.cat };
  }

  function updateCategory(key, spec) {
    if (!isDictV4()) return { ok: false, error: '当前字典不是 v4' };
    const inSpec = spec || {};
    let cur = key;
    const cat = (S.dict.categories || []).find((c) => c.key === cur);
    if (!cat) return { ok: false, error: '统计分类不存在' };
    if (inSpec.name != null && String(inSpec.name).trim() && String(inSpec.name).trim() !== cat.name) {
      const rr = TV.dictV4.renameCategory(S.dict, cur, inSpec.name);
      if (!rr.ok) return rr;
      cur = rr.key;
    }
    const now = (S.dict.categories || []).find((c) => c.key === cur);
    if (Object.prototype.hasOwnProperty.call(inSpec, 'en_name')) {
      now.en_name = String(inSpec.en_name || '').trim();
      now.en_auto = !now.en_name;
    }
    if (Object.prototype.hasOwnProperty.call(inSpec, 'anchor_ref')) {
      const a = TV.dictV4.setCategoryAnchor(S.dict, cur, inSpec.anchor_ref, TV.systemDict);
      if (!a.ok) return a;
    }
    syncDictSourceAndCompile();
    return { ok: true, key: cur, cat: now };
  }

  function deleteCategory(key) {
    if (!isDictV4()) return { ok: false, error: '当前字典不是 v4' };
    const r = TV.dictV4.removeCategory(S.dict, key);
    if (r.ok) syncDictSourceAndCompile();
    return r;
  }

  function syncDict() {
    if (isDictV4()) syncDictSourceAndCompile();
  }

  /* 采纳母树：选分支或叶子 → 建档到用户分组 + 节点级固定绑定 */
  function adoptMother(targetId, token, domain) {
    if (!isDictV4()) return { ok: false, error: '当前字典不是 v4' };
    const pl = TV.dictV4.placementForTarget(targetId, TV.systemDict);
    if (!pl.ok) return pl;
    const target = pl.target;
    const g = TV.dictV4.ensureCategory(S.dict, pl.type, pl.groupName, {});
    const cat = g.cat || (S.dict.categories || []).find((c) => c.key === g.key);
    const tok = String(token || '').trim();
    const tokLow = tok.toLowerCase();
    const isCode = !!tok && (tokLow === String(target.zh_code || '').toLowerCase()
      || tokLow === String(target.en_code || '').toLowerCase());
    const name = !tok || isCode ? target.zh_name : tok;
    let code = D.normalizeCode(target.zh_code || target.en_code || '') || D.normalizeCode(name) || 'x';
    const dom = D.DOMAINS && D.DOMAINS[String(domain || '').toUpperCase()]
      ? String(domain).toUpperCase()
      : (S.domain || 'P');
    const used = new Set(Object.keys(S.dict.nodes)
      .filter((id) => !S.dict.nodes[id].system && (S.dict.nodes[id].domain || 'P') === dom)
      .map((id) => S.dict.nodes[id].zh_code));
    if (used.has(code)) {
      let i = 2;
      while (used.has(code + i)) i += 1;
      code = code + i;
    }
    const r = addNode({
      zh_name: name, zh_code: code,
      en_name: target.en_name || '', en_code: target.en_code || '',
      domain: dom, category_key: cat.key, anchor_id: pl.targetId,
    });
    if (!r.ok) return r;
    return { ok: true, id: r.id, code, category: cat.name, anchor: pl.targetId, group: cat.name };
  }

  /* 把一条 X_ 待修复行替换成修好的文本 */
  function repairLine(lineNo, text) {
    const lines = String(S.ledgerSource || '').replace(/\n+$/, '').split('\n');
    if (lineNo < 1 || lineNo > lines.length) return { ok: false, error: '行号越界' };
    lines[lineNo - 1] = String(text || '');
    S.ledgerSource = lines.join('\n') + '\n';
    S.pendingRepair = null;
    if (TV.inputApi) {
      TV.inputApi.setEditing(false);
      TV.inputApi.clear();
      TV.inputApi.clearError();
    }
    if (editorCtl) editorCtl.setTexts(S.ledgerSource, S.dictSource);
    compileSources();
    return { ok: true };
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

  function deleteRule(id) {
    const i = S.rules.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false, error: '规则不存在' };
    S.rules.splice(i, 1);
    afterDataChange();
    return { ok: true };
  }

  /* ---------------- 视图切换 ---------------- */

  function renderActivePresentation() {
    if (S.view === 'query') renderQuery();
    else if (S.view === 'fixed') renderFixed();
    else if (S.view === 'report') { ensureReport(); renderReport(); }
    else if (S.view === 'mother') renderMother();
    else { renderHUD(); renderTabs(); }
  }

  function schedulePresentation() {
    cancelAnimationFrame(S.presentRaf || 0);
    S.presentRaf = requestAnimationFrame(() => {
      if (!S.dict) return;
      /* 刚改过文本但还没编译：先编译，否则会用旧的 events 覆盖新输入 */
      if (expandAllBatchLines()) {
        compileSources();
      } else if (S.sourceDirty) {
        compileSources();
      }
      const saved = {};
      if (editorCtl) {
        Object.keys(editorCtl.editors || {}).forEach((k) => {
          const cm = editorCtl.editors[k];
          saved[k] = { cur: cm.getCursor(), scroll: cm.getScrollInfo() };
        });
      }
      /* 即使当前在报表页，也把流水源码投影到新语言/模式，回到编辑页才一致 */
      projectEditorSource(true, true);
      if (editorCtl) {
        Object.keys(saved).forEach((k) => {
          const cm = editorCtl.editors[k];
          const s = saved[k];
          if (!cm) return;
          cm.setCursor({ line: Math.min(s.cur.line, cm.lineCount() - 1), ch: s.cur.ch });
          cm.scrollTo(s.scroll.left, s.scroll.top);
        });
      }
      if (S.view !== 'ledger' && S.view !== 'dict') renderActivePresentation();
    });
  }

  function setMode(mode) {
    const hadErrors = (S.sourceDiags || []).some((d) => d.severity === 'error');
    S.mode = mode;
    saveDisplayState();
    applyLang();
    schedulePresentation();
    if (hadErrors) toast('已切到 ' + mode + '；未编译行原样保留', 'ok');
  }

  function setLang(lang) {
    const hadErrors = (S.sourceDiags || []).some((d) => d.severity === 'error');
    S.lang = lang;
    saveDisplayState();
    applyLang();
    schedulePresentation();
    if (hadErrors) toast('已切到 ' + lang + '；未编译行原样保留', 'ok');
  }

  function setView(view) {
    S.view = view;
    applyView();
  }

  function saveDisplayState() {
    try {
      localStorage.setItem('txtvein:display', JSON.stringify({ mode: S.mode, lang: S.lang }));
    } catch (e) { /* ignore */ }
  }

  function canonicalizeDisplay() {
    if (!S.dict || !S.ledgerSource) return;
    S.projCache = {};
    projectEditorSource(true, true);
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
      vaultId: S.vaultId, now: new Date(), domain: S.domain, system: TV.systemDict,
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
    if (p.hasFixed) {
      const fp = TV.source.compileFixed(p.fixedSource, r.dict, { now: new Date(), domain: 'P' });
      if ((fp.plans || []).length !== (S.plans || []).length) {
        return { ok: false, error: '单 TXT 固定表回读不一致：' + (fp.plans || []).length + '/' + (S.plans || []).length };
      }
      if ((fp.diagnostics || []).some((d) => d.severity === 'error')) {
        return { ok: false, error: '单 TXT 固定表有错行：' + fp.diagnostics[0].message };
      }
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
    lines.push('', '## 固定', (S.fixedSource || '').trim());
    lines.push('', '## 字典', S.dictSource.trim(), '');
    return lines.join('\n');
  }

  async function buildExport(mode) {
    if (mode === 'single') {
      const text = buildSingleText();
      const v = validateSingleText(text);
      if (!v.ok) return v;
      return { ok: true, mode, files: [{ name: 'txtvein-export.txt', text }], text };
    }
    const texts = await buildTexts();
    if (mode === 'shadow') {
      const sealed = await store.encryptWithCurrent(texts.dict);
      const vault = TV.envelope.packSecure('dict', {
        vaultId: S.vaultId, iterations: sealed.iterations, salt: sealed.salt, iv: sealed.iv,
      }, sealed.ciphertext, { domain: 'P', updatedAt: new Date().toISOString() });
      const out = [
        { name: 'ledger.shadow', text: texts.ledger },
        { name: 'dict.vault', text: vault },
      ];
      return { ok: true, mode, files: out, text: TV.textBundle.pack(out, { mode }) };
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
      const out = [
        { name: 'ledger.enc', text: ledgerEnc },
        { name: 'dict.enc', text: dictEnc },
      ];
      return { ok: true, mode, files: out, text: TV.textBundle.pack(out, { mode }) };
    }
    return { ok: false, error: '未知导出模式' };
  }

  async function exportMode(mode) {
    const r = await buildExport(mode);
    if (!r.ok) return r;
    await files.downloadAll(r.files);
    return { ok: true };
  }

  async function exportText(mode) {
    return buildExport(mode);
  }

  async function importSingleText(text, opts) {
    const p = TV.source.parseSingleTxt(text);
    if (!p.ok) return p;
    const vaultId = crypto.randomVaultId();
    const r = TV.source.compileAll(p.dictSource, p.ledgerSource, {
      vaultId, now: new Date(), domain: 'P', system: TV.systemDict,
    });
    S.ledgerSource = TV.source.normalizeDomainSyntax(p.ledgerSource);
    S.dictSource = p.dictSource;
    S.fixedSource = p.fixedSource || '';
    const fp = TV.source.compileFixed(S.fixedSource, r.dict, { now: new Date(), domain: 'P' });
    S.fixedDiags = fp.diagnostics || [];
    adopt(r.dict, r.events, fp.plans || [], [], vaultId, { behaviors: r.behaviors, notes: r.notes });
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

  async function importText(text, opts) {
    const t = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!t) return { ok: false, error: '粘贴内容是空的' };
    const o = opts || {};
    const kind = TV.ntBridge.detect(t);
    if (kind === 'txtvein-single') return importSingleText(t, o);
    if (kind === 'txtvein-bundle') {
      const b = TV.textBundle.unpack(t);
      if (!b || !b.ok) return { ok: false, error: (b && b.error) || 'bundle 解析失败' };
      return importBundle(b.files, o);
    }
    if (kind === 'nt-backup') {
      if (!o.password) return { ok: false, error: 'NT 加密备份需要密码', needsPassword: true };
      let state;
      try {
        state = await TV.ntBridge.decryptBackup(t, o.password);
      } catch (e) {
        return { ok: false, error: 'NT 备份解不开：密码不对，或内容损坏' };
      }
      const built = TV.ntBridge.fromNTState(state);
      const r = await importSingleText(built.singleText, o);
      if (r.ok && built.fixedSource) {
        /* 固定表也一起搬过来（独立文件，不进流水文本） */
        S.fixedSource = built.fixedSource;
        compilePlansOnly();
        await saveNow();
        if ((S.plans || []).length) r.message += '；固定表 ' + S.plans.length + ' 条';
      }
      if (r.ok && built.errors.length) r.message += '；' + built.errors.length + ' 行未导入';
      return r;
    }
    if (kind === 'nt-text') {
      const parsed = TV.ntBridge.parseText(t);
      const built = TV.ntBridge.toTxtVein(parsed);
      const r = await importSingleText(built.singleText, o);
      if (r.ok && built.errors.length) r.message += '；' + built.errors.length + ' 行未导入';
      return r;
    }
    if (kind === 'txtvein-secure') {
      return { ok: false, error: '这是单个密文块；请用导出的完整 bundle（含流水和字典两份）' };
    }
    return { ok: false, error: '认不出这段文本：需要 TxtVein 单文件 / bundle / NT 文本 / NT 加密备份' };
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
      vaultId: S.vaultId,
      ledgerSource: texts.ledgerSource,
      fixedSource: texts.fixedSource,
      dictSourceP: texts.dictSourceP,
      dictSourceC: texts.dictSourceC,
      systemVersion: texts.systemVersion,
    }, hint);
  }

  /* ---------------- 启动 / 门禁 ---------------- */

  function enterApp() {
    dom.app.hidden = false;
    dom.gate.hidden = true;
    booted = true;
    if (S.ledgerSource && (S.events || []).some((e) => !e.sourceLine)) compileSources();
    canonicalizeDisplay();
    renderAll();
    applyView();
    applyLang();
    bindAutoLock();
    /* 打开即结算：每月到期落账、每日只摆今天这一期 */
    syncPlansDue(true);
    renderFutureBlock(true);
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
    const isV3 = Number(payload.version) >= 3 || payload.dictSourceP != null || payload.dictSourceC != null;
    const hasSources = isV3 || (payload.ledgerSource && payload.dictSource);
    let dict;
    let events = [];
    let plans = [];
    let rules = [];
    let behaviors = [];
    let notes = [];
    let diags = [];

    if (hasSources) {
      S.ledgerSource = TV.source.normalizeDomainSyntax(payload.ledgerSource || '');
      if (isV3) {
        const merged = TV.userDict.merge(payload.dictSourceP || '', payload.dictSourceC || '');
        if (!merged.ok) {
          const first = merged.diagnostics.find((x) => x.severity === 'error') || merged.diagnostics[0];
          throw new Error('保险库里的 P/C 字典无法合并'
            + (first ? '（第 ' + first.line + ' 行）：' + first.message : ''));
        }
        S.dictSource = merged.source;
        S.systemVersion = payload.systemVersion || TV.systemDict.VERSION_STRING;
      } else {
        S.dictSource = payload.dictSource;
        S.systemVersion = payload.systemVersion || TV.systemDict.VERSION_STRING;
      }
      const r = TV.source.compileAll(S.dictSource, S.ledgerSource, {
        vaultId: payload.vaultId || '', now: new Date(), domain: 'P', system: TV.systemDict,
      });
      dict = r.dict;
      events = r.events || [];
      rules = [];
      behaviors = r.behaviors || [];
      notes = r.notes || [];
      diags = (r.dictDiagnostics || []).map((x) => Object.assign({ file: 'dict' }, x))
        .concat((r.ledgerDiagnostics || []).map((x) => Object.assign({ file: 'ledger' }, x)));
      if (!r.ok) toast('源码有 ' + r.errors + ' 个错误；已按合法部分加载', 'error');
      if (isV3) S.dictSource = TV.source.dictToSource(dict);
      /* 固定表：优先读独立文本；旧数据（interim plans 或流水里的 [固定] 段）一次性迁过来 */
      S.fixedSource = String(payload.fixedSource || '');
      const legacy = TV.source.parsePlanSection(S.ledgerSource, dict, { now: new Date(), domain: 'P' });
      if (!S.fixedSource) {
        if (legacy.plans.length) {
          S.fixedSource = TV.source.fixedSourceFromPlans(legacy.plans, dict, { mode: S.mode, lang: S.lang });
        } else if (Array.isArray(payload.plans) && payload.plans.length) {
          S.fixedSource = TV.source.fixedSourceFromPlans(payload.plans, dict, { mode: S.mode, lang: S.lang });
        }
      }
      if (legacy.plans.length) {
        /* 把流水里的 [固定] 段剥掉：固定表是独立的 */
        const end = TV.source.recordsEndIndex(S.ledgerSource);
        S.ledgerSource = S.ledgerSource.split('\n').slice(0, end).join('\n') + '\n';
      }
      const fp = TV.source.compileFixed(S.fixedSource, dict, { now: new Date(), domain: 'P' });
      plans = fp.plans || [];
      S.fixedDiags = fp.diagnostics || [];
    } else {
      if (!payload.dict || !payload.ledger) throw new Error('保险库里的账本为空或格式不对');
      const dp = dictFile.parseDict(payload.dict);
      if (!dp.ok) throw new Error('字典解析失败：' + dp.error);
      const lp = ledgerFile.parseLedger(payload.ledger, { dict: dp.dict });
      dict = dp.dict;
      events = lp.events;
      plans = lp.plans || [];
      rules = lp.rules;
      S.ledgerSource = TV.source.ledgerToSource(dict, events, [], []);
      S.fixedSource = String(payload.fixedSource || '')
        || TV.source.fixedSourceFromPlans(plans, dict, { mode: 'CODE', lang: 'zh' });
      S.dictSource = TV.source.dictToSource(dict);
      S.systemVersion = payload.systemVersion || TV.systemDict.VERSION_STRING;
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
    S.fixedSource = TV.source.fixedSourceFromPlans(ex.plans || [], ex.dict, { mode: S.mode, lang: S.lang });
    refreshSources(true);
    const texts = await buildTexts();
    await store.createVault(password, {
      vaultId,
      ledgerSource: texts.ledgerSource,
      fixedSource: texts.fixedSource,
      dictSourceP: texts.dictSourceP,
      dictSourceC: texts.dictSourceC,
      systemVersion: texts.systemVersion,
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
    S.fixedSource = '';
    S.dictSource = '';
    S.systemVersion = '';
    S.sourceDiags = [];
    S.ignoredCandidates = new Set();
    S.texts = null;
    S.planDay = '';
    S.planDockSig = '';
    editorCtl = null;
    fixedCtl = null;
    clear(dom.editorView);
    clear(dom.fixedView);
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

  function armAutoLock() {
    clearTimeout(autoLockTimer);
    if (!store.isUnlocked()) return;
    autoLockTimer = setTimeout(() => {
      if (!document.hidden) lockApp();
    }, AUTO_LOCK_IDLE);
  }

  function bindAutoLock() {
    if (autoLockBound) { armAutoLock(); return; }
    autoLockBound = true;
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((name) => {
      document.addEventListener(name, armAutoLock, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        clearTimeout(hiddenLockTimer);
        clearTimeout(autoLockTimer);
        hiddenLockTimer = setTimeout(() => {
          if (document.visibilityState === 'hidden') lockApp();
        }, AUTO_LOCK_HIDDEN);
        return;
      }
      clearTimeout(hiddenLockTimer);
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (away >= AUTO_LOCK_HIDDEN) lockApp();
      else { armAutoLock(); planDayTick(); }
    });
    armAutoLock();
    /* 跨日：页面一直开着时，每分钟检查一次是否换天 */
    if (!bindAutoLock.planTimer) {
      bindAutoLock.planTimer = setInterval(() => {
        if (!document.hidden) planDayTick();
      }, 60 * 1000);
    }
  }

  async function lockApp() {
    clearTimeout(autoLockTimer);
    clearTimeout(hiddenLockTimer);
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
    S.fixedSource = '';
    S.dictSource = '';
    S.systemVersion = '';
    S.sourceDiags = [];
    S.ignoredCandidates = new Set();
    S.texts = null;
    S.planDay = '';
    S.planDockSig = '';
    editorCtl = null;
    fixedCtl = null;
    clear(dom.editorView);
    clear(dom.fixedView);
    S.calcAll = null;
    clear(dom.reportView);
    dom.input.value = '';
    dom.app.hidden = true;
    dom.gate.hidden = false;
    gateCtl.show();
  }

  /* ---------------- 事件绑定 ---------------- */

  /* 把元素吸附到物理像素格：125% 缩放下 bottom:44px 会落在 1037.5 物理像素，
   * 1px 的边线卡在半格上被抗锯齿劈成两条灰线，看着就是毛刺。
   * 用 translate 做视觉补偿，不动布局。拖动中跳过（会抖动）。 */
  function snapToDevicePixel(el) {
    if (!el) return;
    if (el.classList.contains('dragging')) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    const dx = Math.round(r.x * dpr) / dpr - r.x;
    const dy = Math.round(r.y * dpr) / dpr - r.y;
    el.style.transform = (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
      ? '' : 'translate(' + dx + 'px, ' + dy + 'px)';
  }
  function bindComposer() {
    const POS_KEY = 'txtvein:composer-pos';
    /* 悬浮单输入气泡：代码生成的液态玻璃（低端设备自动退回毛玻璃） */
    /* 收起的圆钮和展开的输入条是**同一个胶囊**（和 NT 一样）：
     * 玻璃只装在 .composer 上，按钮/输入框透明；展开时换宽条贴图。 */
    if (TV.glass && dom.composer) {
      /* 位移强度由 glass 参数按元素基准尺寸换算（40px → scale 像素），
       * 这里只给形状。收起 40×40 / 展开 340×40 各一张贴图，
       * 两张贴图短边都是 40，所以折射强度一致。 */
      TV.glass.install(dom.composer, {
        width: 40, height: 40, radius: 12, id: 'tv-lg-composer',
        openWidth: 340, openHeight: 40, openRadius: 12, openId: 'tv-lg-composer-open',
      });
    }
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
      /* 气泡向左展开：right 必须大到让 inner 的左边不越过屏幕 */
      const innerW = Math.min(w <= 760 ? 300 : 340, w - (w <= 760 ? 16 : 24));
      const maxRight = Math.max(8, w - innerW - 8);
      right = Math.max(8, Math.min(right, maxRight));
      bottom = Math.max(8, Math.min(bottom, maxBottom));
      dom.composer.style.right = right + 'px';
      dom.composer.style.bottom = bottom + 'px';
      snapToDevicePixel(dom.composer);
    };
    applyPos();
    window.addEventListener('resize', applyPos);
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
    if (dom.btnMother) dom.btnMother.addEventListener('click', () => setView('mother'));
    dom.btnFixed.addEventListener('click', () => setView('fixed'));
    dom.btnReport.addEventListener('click', () => setView('report'));
    dom.btnCandidates.addEventListener('click', () => showCandidates());
    if (dom.btnSettings) dom.btnSettings.addEventListener('click', () => panels.showSettings(app));
    if (dom.btnSecurity) dom.btnSecurity.addEventListener('click', () => panels.showPassword(app));
    dom.btnImport.addEventListener('click', () => panels.showImport(app));
    dom.btnExport.addEventListener('click', () => panels.showExport(app));
    dom.btnHelp.addEventListener('click', () => panels.showHelp(app));
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
    refreshEditors: () => { if (editorCtl) editorCtl.refresh(); },
    setView,
    buildTexts,
    afterDataChange,
    addNode,
    updateNode,
    deleteNode,
    addCategory,
    updateCategory,
    deleteCategory,
    syncDict,
    adoptMother,
    repairLine,
    addTag,
    updateTag,
    deleteTag,
    countNodeRefs,
    deleteRule,
    exportMode,
    exportText,
    importText,
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
      batchHint: dom.batchHint,
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
    version: TV.version ? TV.version.VERSION : '2.2.0',
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
    exportText: (mode) => exportText(mode),
    importText: (text, opts) => importText(text, opts || {}),
    ntText: () => TV.ntBridge.toNTText(S.dict, S.events),
    singleText: () => buildSingleText(),
    validateSingle: () => validateSingleText(buildSingleText()),
    hint: (file, token, before) => sourceHint(file, token, before),
    refreshPlanDock: () => { renderFutureBlock(true); return true; },
    realLines: () => {
      const cm = editorCtl && editorCtl.editors ? editorCtl.editors.ledger : null;
      return cm ? cm.lineCount() - (cm._virtualCount || 0) : 0;
    },
    setRange: (r) => { S.range = r; renderHUD(); renderReport(); },
    setView: (v) => setView(v),
    lock: () => lockApp(),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
