/* TxtVein · VS Code 式源码编辑器
 * ledger.tv / dict.tv 两个文件；行号、语法高亮、lint、补全、运算符工具条。
 * 编辑器只产出文本；编译与数据更新由 app 负责。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;
  const CM = root.CodeMirror;
  const Pos = CM ? CM.Pos : function (l, c) { return { line: l, ch: c }; };

  function defineModes() {
    if (!CM || CM.modes && CM.modes['txtvein-ledger'] && CM.modes['txtvein-dict']) return;
    CM.defineMode('txtvein-ledger', function () {
      return {
        token(stream) {
          if (stream.match(/^\/\//)) { stream.skipToEnd(); return 'comment'; }
          if (stream.match(/^\[[PFCH]\]/i)) return 'atom';
          if (stream.sol() && stream.match(/^[PFCH](?=\s)/i)) return 'atom';
          if (stream.match(/^\d{6}/)) return 'number';
          if (stream.match(/^[+-]?\d{1,3}(?=\s)/)) return 'number';
          if (stream.match(/^(?:>|<)/)) return 'operator';
          if (stream.match(/^\*[dmy]\b/i)) return 'keyword';
          if (stream.match(/^\d+(?:\.\d+)?(?:k|min|[dhm′])+/i)) return 'number';
          if (stream.match(/^#[^\s<>]+/)) return 'tag';
          if (stream.match(/^[A-Za-z0-9_\u4e00-\u9fff.:-]+/)) return 'variable';
          stream.next();
          return null;
        },
      };
    });
    CM.defineMode('txtvein-dict', function () {
      return {
        token(stream) {
          if (stream.match(/^\/\//)) { stream.skipToEnd(); return 'comment'; }
          if (stream.match(/^(?:node|tag|item|alias)\b/i)) return 'keyword';
          if (stream.match(/^\[(?:ACCOUNT|NOTE|BEHAVIOR|会计|备注|行为)\]$/i)) return 'atom';
          if (stream.match(/^\[[PFCH]\]/i)) return 'atom';
          if (stream.sol() && stream.match(/^[PFCH](?=\s)/i)) return 'atom';
          if (stream.match(/^(?:资产|费用|成本|负债|收入|权益)\b/)) return 'type';
          if (stream.match(/^(?:fluid|ice|steam|outside|plain|gain|suppress|time)\b/i)) return 'atom';
          if (stream.match(/^(?:N:|T:)/)) return 'meta';
          if (stream.match(/^->/)) return 'operator';
          if (stream.match(/^\|/)) return 'operator';
          if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
          if (stream.match(/^[A-Za-z0-9_\u4e00-\u9fff-]+/)) return 'variable';
          stream.next();
          return null;
        },
      };
    });
    if (CM.registerHelper) {
      CM.defineMIME && CM.defineMIME('text/x-txtvein-ledger', 'txtvein-ledger');
      CM.defineMIME && CM.defineMIME('text/x-txtvein-dict', 'txtvein-dict');
    }
  }

  function create(host, handlers) {
    const h = handlers || {};
    defineModes();
    clear(host);

    const tabs = el('div', { class: 'editor-tabs' });
    const toolbar = el('div', { class: 'editor-toolbar' });
    const main = el('div', { class: 'editor-main' });
    const status = el('div', { class: 'editor-status' });
    host.appendChild(el('div', { class: 'editor-shell' }, [tabs, toolbar, main, status]));

    const panes = {};
    const editors = {};
    const annotations = { ledger: [], dict: [] };
    const rawDiags = { ledger: [], dict: [] };
    const invalidLines = { ledger: [], dict: [] };
    const dirty = { ledger: false, dict: false };
    const errorCount = { ledger: 0, dict: 0 };
    let active = 'ledger';
    let suspended = false;

    function tab(file, label, icon) {
      const errors = el('span', { class: 'file-errors', hidden: true });
      const dot = el('span', { class: 'file-dirty', hidden: true }, ['●']);
      const b = el('button', { class: 'file-tab', type: 'button' }, [
        el('span', { class: 'file-icon' }, [icon]),
        el('span', {}, [label]),
        errors,
        dot,
        el('span', { class: 'file-close', hidden: true }),
      ]);
      b.addEventListener('click', () => setActive(file));
      b._errors = errors;
      b._dot = dot;
      return b;
    }
    const tabLedger = tab('ledger', 'ledger.tv', '<>');
    const tabDict = tab('dict', 'dict.tv', '{}');
    tabs.appendChild(tabLedger);
    tabs.appendChild(tabDict);

    function op(label, text, cls, file) {
      const b = el('button', { class: 'op-btn ' + (cls || ''), type: 'button' }, [label]);
      b.addEventListener('click', () => {
        const cm = editors[active];
        if (!cm) return;
        cm.replaceSelection(text);
        cm.focus();
      });
      if (file) b.dataset.file = file;
      return b;
    }
    const ledgerOps = el('span', { class: 'op-group', dataset: { file: 'ledger' } }, [
      op('>', ' > '), op('<', ' < '), op('*m', '*m'), op('*d', '*d'), op('*y', '*y'),
      op('d', 'd'), op('h', 'h'), op('m', 'm'), op('P', 'P '), op('F', 'F '), op('C', 'C '), op('H', 'H '),
      el('span', { class: 'sep' }),
      op('新建日期', '261115 '),
    ]);
    const dictOps = el('span', { class: 'op-group', dataset: { file: 'dict' } }, [
      op('node', 'node '), op('tag', 'tag '), op('alias', 'alias '),
      el('span', { class: 'sep' }),
      op('N:', 'N:'), op('T:', 'T:'), op('→', ' -> '), op('|', ' | '),
    ]);
    const runBtn = el('button', { class: 'op-btn is-run', type: 'button' }, ['编译 ▸']);
    runBtn.addEventListener('click', () => { if (h.onRun) h.onRun(active); });
    const note = el('span', { class: 'editor-note' }, ['Ctrl+Space 补全 · Ctrl+Enter 编译 · 语法错误行不参与计算']);
    toolbar.appendChild(ledgerOps);
    toolbar.appendChild(dictOps);
    toolbar.appendChild(el('span', { class: 'grow' }));
    toolbar.appendChild(note);
    toolbar.appendChild(runBtn);

    function insertEditorSpaceOp(cm, op) {
      const cur = cm.getCursor();
      const before = cm.getLine(cur.line).slice(0, cur.ch);
      const next = op === '>' ? before.replace(/\s*$/, '') + ' > '
        : before.replace(/\s*[<>]\s*$/, '') + ' < ';
      cm.replaceRange(next, { line: cur.line, ch: 0 }, { line: cur.line, ch: cur.ch });
      cm.setCursor({ line: cur.line, ch: next.length });
    }

    function handleEditorSpace(cm) {
      const now = Date.now();
      cm._spaceRun = (cm._lastSpace && now - cm._lastSpace < 360) ? (cm._spaceRun || 0) + 1 : 1;
      cm._lastSpace = now;
      if (cm._spaceRun >= 2) {
        insertEditorSpaceOp(cm, cm._spaceRun === 2 ? '>' : '<');
        cm._spaceRun = cm._spaceRun === 2 ? 2 : 0;
        return;
      }
      cm.replaceSelection(' ');
    }

    function makePane(file, mode) {
      const pane = el('div', { class: 'editor-pane' + (file === active ? ' is-active' : ''), dataset: { file } });
      main.appendChild(pane);
      const cm = CM(pane, {
        value: '',
        mode,
        theme: 'txtvein',
        lineNumbers: true,
        lineWrapping: false,
        styleActiveLine: true,
        matchBrackets: true,
        autoCloseBrackets: false,
        indentUnit: 2,
        tabSize: 2,
        smartIndent: false,
        viewportMargin: 12,
        gutters: ['CodeMirror-lint-markers'],
        lint: {
          delay: 350,
          getAnnotations: () => annotations[file] || [],
        },
        extraKeys: {
          'Ctrl-Space': (cmx) => cmx.showHint({ hint: makeHint(active), completeSingle: false }),
          'Ctrl-Enter': () => { if (h.onRun) h.onRun(file); },
          Space: (cmx) => handleEditorSpace(cmx),
          Tab: (cmx) => {
            if (cmx.state.completionActive) cmx.execCommand('autocomplete');
            else cmx.replaceSelection('  ');
          },
        },
      });
      cm.on('keydown', (cmx, ev) => {
        if (ev.key !== ' ') cm._spaceRun = 0;
      });
      const syncWrap = () => cm.setOption('lineWrapping', window.matchMedia('(max-width: 760px)').matches);
      syncWrap();
      window.addEventListener('resize', syncWrap);
      cm.on('change', () => {
        if (suspended) return;
        dirty[file] = true;
        updateTab(file);
        if (h.onChange) h.onChange(file, cm.getValue());
      });
      cm.on('cursorActivity', () => {
        if (file === active) renderStatus();
        if (file === active && (rawDiags[file] || []).length) syncAnnotations(file);
        if (h.onCursor) h.onCursor(file, cm.getCursor().line + 1);
      });
      cm.on('blur', () => {
        setTimeout(() => {
          const hint = document.querySelector('.CodeMirror-hints');
          if (!hint || !hint.matches(':hover')) { if (cm.closeHint) cm.closeHint(); }
        }, 220);
      });
      cm.on('inputRead', (cmx, change) => {
        if (file !== active) return;
        const t = change.text.join('');
        if (!t || /^\s+$/.test(t)) return;
        clearTimeout(cm._hintTimer);
        cm._hintTimer = setTimeout(() => {
          if (!cm.state.completionActive) cm.showHint({ hint: makeHint(file), completeSingle: false });
        }, 180);
      });
      editors[file] = cm;
      panes[file] = pane;
      return cm;
    }

    function makeHint(file) {
      return function (cm) {
        if (!h.hint) return null;
        const cur = cm.getCursor();
        const line = cm.getLine(cur.line) || '';
        const before = line.slice(0, cur.ch);
        if (before.trim().startsWith('//')) return null;
        const m = before.match(/([^\s<>]*)$/);
        const token = m ? m[1] : '';
        const start = cur.ch - token.length;
        const res = h.hint(file, token, before, line);
        if (!res || !res.list || !res.list.length) return null;
        return { list: res.list, from: Pos(cur.line, start), to: Pos(cur.line, cur.ch) };
      };
    }

    function updateTab(file) {
      const t = file === 'ledger' ? tabLedger : tabDict;
      t.classList.toggle('is-active', file === active);
      t._dot.hidden = !dirty[file];
      t._errors.hidden = !errorCount[file];
      t._errors.textContent = errorCount[file] ? String(errorCount[file]) : '';
    }

    function renderStatus() {
      const cm = editors[active];
      const cur = cm ? cm.getCursor() : { line: 0, ch: 0 };
      const fileErrors = errorCount[active] || 0;
      clear(status);
      status.appendChild(el('span', {}, [active === 'ledger' ? 'ledger.tv' : 'dict.tv']));
      status.appendChild(el('span', {}, ['Ln ' + (cur.line + 1) + ', Col ' + (cur.ch + 1)]));
      status.appendChild(el('span', { class: fileErrors ? 'st-errors' : 'st-ok' }, [
        fileErrors ? fileErrors + ' 个错误' : '语法 OK',
      ]));
      status.appendChild(el('span', {}, ['TxtVein-Lang']));
      status.appendChild(el('span', { class: 'grow' }));
      status.appendChild(el('span', {}, ['Ctrl+Enter 编译 · 对话框录入同步追加']));
      if (h.onStatus) h.onStatus({ file: active, line: cur.line + 1, col: cur.ch + 1, errors: fileErrors });
    }

    function setActive(file) {
      active = file === 'dict' ? 'dict' : 'ledger';
      Object.keys(panes).forEach((k) => panes[k].classList.toggle('is-active', k === active));
      updateTab('ledger');
      updateTab('dict');
      toolbar.querySelectorAll('.op-group').forEach((g) => {
        g.style.display = g.dataset.file === active ? 'inline-flex' : 'none';
      });
      renderStatus();
      if (editors[active]) setTimeout(() => editors[active].refresh(), 0);
      if (h.onActive) h.onActive(active);
    }

    makePane('ledger', 'txtvein-ledger');
    makePane('dict', 'txtvein-dict');
    setActive('ledger');

    function tokenAt(text, ch) {
      let a = Math.max(0, Math.min(ch, text.length));
      let b = a;
      const sep = /[\s<>]/;
      while (a > 0 && !sep.test(text.charAt(a - 1))) a -= 1;
      while (b < text.length && !sep.test(text.charAt(b))) b += 1;
      return a === b ? null : { from: a, to: b };
    }

    function diagToken(d, text) {
      if (Number.isFinite(Number(d.col)) && Number(d.col) > 0) {
        const at = Math.max(0, Math.min(Number(d.col), text.length));
        const len = Number(d.length) || 0;
        if (len > 0) return { from: at, to: Math.min(text.length, at + len) };
        const tok = tokenAt(text, at);
        if (tok) return tok;
      }
      const m = String(d.message || '').match(/[：:]\s*([^\s，。；;、]+)/);
      if (m) {
        const needle = m[1].replace(/[「」“”"'()（）]/g, '');
        const at = needle ? text.indexOf(needle) : -1;
        if (at >= 0) return { from: at, to: at + needle.length };
      }
      return { from: 0, to: Math.max(1, text.length) };
    }

    function syncAnnotations(file) {
      const cm = editors[file];
      if (!cm) return;
      (invalidLines[file] || []).forEach((n) => cm.removeLineClass(n, 'text', 'cm-invalid-line'));
      invalidLines[file] = [];
      const cursor = file === active ? cm.getCursor() : null;
      annotations[file] = (rawDiags[file] || []).map((d) => {
        const line = Math.max(0, (Number(d.line) || 1) - 1);
        const text = cm.getLine(line) || '';
        let range;
        if (cursor && cursor.line === line) {
          const tok = tokenAt(text, cursor.ch);
          const word = tok ? text.slice(tok.from, tok.to) : '';
          if (tok && !/^[PFCH]$/i.test(word) && !/^\d{6}$/.test(word)) range = tok;
        }
        if (!range) range = diagToken(d, text);
        if (d.severity !== 'warning' && !invalidLines[file].includes(line)) {
          invalidLines[file].push(line);
          cm.addLineClass(line, 'text', 'cm-invalid-line');
        }
        return {
          from: Pos(line, range.from),
          to: Pos(line, Math.max(range.to, range.from + 1)),
          message: d.message,
          severity: d.severity === 'warning' ? 'warning' : 'error',
        };
      });
      if (cm.performLint) cm.performLint();
    }

    function setDiagnostics(diags) {
      rawDiags.ledger = [];
      rawDiags.dict = [];
      errorCount.ledger = 0;
      errorCount.dict = 0;
      (diags || []).forEach((d) => {
        const file = d.file === 'dict' ? 'dict' : 'ledger';
        rawDiags[file].push(d);
        if (d.severity !== 'warning') errorCount[file] += 1;
      });
      syncAnnotations('ledger');
      syncAnnotations('dict');
      updateTab('ledger');
      updateTab('dict');
      renderStatus();
    }

    function setTexts(ledgerText, dictText) {
      suspended = true;
      const a = editors.ledger;
      const b = editors.dict;
      if (a && a.getValue() !== String(ledgerText == null ? '' : ledgerText)) {
        a.setValue(String(ledgerText == null ? '' : ledgerText));
        a.clearHistory();
      }
      if (b && b.getValue() !== String(dictText == null ? '' : dictText)) {
        b.setValue(String(dictText == null ? '' : dictText));
        b.clearHistory();
      }
      suspended = false;
      dirty.ledger = false;
      dirty.dict = false;
      updateTab('ledger');
      updateTab('dict');
      renderStatus();
    }

    function getTexts() {
      return {
        ledger: editors.ledger ? editors.ledger.getValue() : '',
        dict: editors.dict ? editors.dict.getValue() : '',
      };
    }

    function setDirty(file, on) {
      if (file === 'both') {
        dirty.ledger = !!on;
        dirty.dict = !!on;
      } else {
        dirty[file] = !!on;
      }
      updateTab('ledger');
      updateTab('dict');
    }

    function gotoLine(file, line) {
      setActive(file);
      const cm = editors[active];
      if (!cm) return;
      const l = Math.max(0, Math.min((cm.lineCount() || 1) - 1, (Number(line) || 1) - 1));
      cm.setCursor({ line: l, ch: 0 });
      cm.scrollIntoView({ line: l, ch: 0 }, 120);
      cm.focus();
    }

    function focus() {
      if (editors[active]) editors[active].focus();
    }

    function refresh() {
      if (editors[active]) editors[active].refresh();
    }

    setActive('ledger');
    return {
      setTexts,
      getTexts,
      setActive,
      getActive: () => active,
      setDiagnostics,
      setDirty,
      gotoLine,
      focus,
      refresh,
      editors,
    };
  }

  TV.editor = { create, defineModes };
})(typeof globalThis !== 'undefined' ? globalThis : this);
