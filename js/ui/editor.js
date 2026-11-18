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
      let role = 'date';
      let toNode = false;
      return {
        token(stream) {
          if (stream.sol()) { role = 'date'; toNode = false; }
          if (stream.eatSpace()) return null;
          if (stream.match(/^\/\//)) { stream.skipToEnd(); return 'comment'; }
          if (stream.match(/^\[[PFCH]\]/i)) return 'atom';
          if (stream.sol() && stream.match(/^[PFCH](?=\s)/i)) return 'atom';
          if (role === 'date' && stream.match(/^\d{6}/)) { role = 'from'; return 'date'; }
          if (stream.match(/^(?:>|<)/)) {
            const op = stream.current();
            role = op === '>' ? 'to' : 'note';
            if (role === 'to') toNode = false;
            return 'operator';
          }
          if (role === 'note') {
            stream.match(/^#[^\s<>]+/) || stream.match(/^[^\s<>]+/);
            return 'note';
          }
          /* 节点位置优先：58D 这类「数字开头 + d」是简码，不是 58 天 */
          if ((role === 'date' || role === 'from' || (role === 'to' && !toNode))
            && stream.match(/^[A-Za-z0-9_\u4e00-\u9fff.:-]+/)) {
            if (role === 'to') toNode = true;
            role = role === 'to' ? 'to' : 'from';
            return 'node';
          }
          if (stream.match(/^\*[dmy]\b/i)) return 'keyword';
          if (stream.match(/^-?\d+(?:\.\d+)?(?:k|min|[dhm′])+/i)) {
            if (role === 'to' || role === 'amount') { role = 'amount'; return 'amount'; }
            return 'number';
          }
          if (stream.match(/^-?\d+(?:\.\d+)?/)) {
            if (role === 'to' || role === 'amount') { role = 'amount'; return 'amount'; }
            return 'number';
          }
          if (stream.match(/^#[^\s<>]+/)) return 'note';
          if (stream.match(/^[A-Za-z0-9_\u4e00-\u9fff.:-]+/)) {
            if (role === 'to') return 'node';
            return 'variable';
          }
          stream.next();
          return null;
        },
      };
    });
    CM.defineMode('txtvein-dict', function () {
      let header = false;
      let enTail = false;
      return {
        token(stream) {
          if (stream.sol()) {
            header = false;
            enTail = false;
          }
          if (stream.match(/^\/\//)) { stream.skipToEnd(); return 'comment'; }
          if (stream.match(/^(?:node|tag|item|alias)\b/i)) return 'keyword';
          if (stream.match(/^\[(?:资产|费用|成本|负债|收入|权益)\]/)) { header = true; return 'type'; }
          if (stream.match(/^\[(?:ACCOUNT|NOTE|BEHAVIOR|会计|备注|行为)\]$/i)) return 'atom';
          if (stream.match(/^\[[PFCH]\]/i)) return 'atom';
          if (stream.sol() && stream.match(/^[PFCH](?=\s)/i)) return 'atom';
          if (stream.match(/^[，,]/)) {
            if (/^\s*[A-Za-z]/.test(stream.string.slice(stream.pos))) enTail = true;
            return 'dict-en';
          }
          if ((header || enTail) && stream.match(/^[A-Za-z][A-Za-z -]*/)) return 'dict-en';
          if (stream.match(/^(?:资产|费用|成本|负债|收入|权益)\b/)) return 'type';
          if (stream.match(/^(?:fluid|ice|steam|outside|plain|gain|suppress|time)\b/i)) return 'atom';
          if (stream.match(/^(?:N:|T:)/)) return 'meta';
          if (stream.match(/^->/)) return 'operator';
          if (stream.match(/^\|/)) return 'operator';
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
    const semMarks = { ledger: [], dict: [] };
    const semTokens = { ledger: [], dict: [] };
    const dirty = { ledger: false, dict: false };
    const errorCount = { ledger: 0, dict: 0 };
    let active = 'ledger';
    let suspended = false;
    let lineMenu = null;
    let lineClip = '';
    let lineMenuCm = null;
    let lineMenuLine = -1;

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

    function insertEditorDate(cm) {
      if (active !== 'ledger') return false;
      const cur = cm.getCursor();
      const line = cm.getLine(cur.line) || '';
      if (line.trim() || cm.somethingSelected()) return false;
      const stamp = TV.date && TV.date.todayStamp ? TV.date.todayStamp(new Date()) : '';
      if (!stamp) return false;
      cm.replaceRange(stamp + ' ', { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
      cm.setCursor({ line: cur.line, ch: stamp.length + 1 });
      cm._spaceRun = 0;
      cm._lastSpace = Date.now();
      setTimeout(() => {
        if (!cm.state.completionActive) {
          cm.showHint({ hint: makeHint('ledger'), completeSingle: false });
        }
      }, 0);
      return true;
    }

    function handleEditorSpace(cm) {
      cm._spaceKeyAt = Date.now();
      if (insertEditorDate(cm)) return;
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

    /* 手机软键盘没有可靠的 Space keydown；从 CodeMirror 的 changes 兜底。 */
    /* 源码里也可以先用 -1/-2；一旦日期 token 后出现空格，就固化成 YYMMDD。 */
    function bindRelativeDateFix(cm) {
      let syncing = false;
      cm.on('changes', (cmx) => {
        if (syncing) return;
        const cur = cmx.getCursor();
        const line = cmx.getLine(cur.line);
        const m = line.match(/^(\s*)((?:[PFCH]\s+)?)([\u2212\u2013\u2014\uFF0D+\-]?[0-9\uFF10-\uFF19]{1,3})(?=\s)/i);
        if (!m) return;
        const d = TV.date.resolveDateToken(m[3], new Date());
        if (!d.ok || !d.relative) return;
        const start = m[1].length + m[2].length;
        syncing = true;
        cmx.replaceRange(d.stamp, { line: cur.line, ch: start }, { line: cur.line, ch: start + m[3].length });
        syncing = false;
      });
    }

    /* 母树候选在 CM 里先用占位符插入，change 时采纳并换成私有简码。 */
    function bindMotherHintPick(cm) {
      let syncing = false;
      cm.on('change', (cmx) => {
        if (syncing) return;
        const text = cmx.getValue();
        const m = text.match(/@@((?:[PFCH]:)?)(SYS[A-Z0-9_.]+)@@/i);
        if (!m) return;
        syncing = true;
        const prefix = m[1] || '';
        const id = m[2];
        const dom = prefix ? prefix.slice(0, -1).toUpperCase() : '';
        const r = h.onAdoptMother ? h.onAdoptMother(id, dom) : { ok: false, error: '当前不能采纳母树' };
        if (!r.ok) {
          syncing = false;
          const t2 = cmx.getValue();
          const idx0 = t2.indexOf(m[0]);
          if (idx0 >= 0) cmx.replaceRange('', cmx.posFromIndex(idx0), cmx.posFromIndex(idx0 + m[0].length));
          if (h.toast) h.toast(r.error || '采纳失败', 'error');
          return;
        }
        /* adopt 可能触发编译/重设文本，占位符的位置要重新找 */
        const text2 = cmx.getValue();
        const idx = text2.indexOf(m[0]);
        if (idx < 0) {
          syncing = false;
          return;
        }
        const from = cmx.posFromIndex(idx);
        const to = cmx.posFromIndex(idx + m[0].length);
        const repl = prefix + r.code;
        cmx.replaceRange(repl, from, to);
        cmx.setCursor(cmx.posFromIndex(idx + repl.length));
        if (cmx.closeHint) cmx.closeHint();
        syncing = false;
        if (h.toast) h.toast('已建节点「' + (r.name || r.code) + '」[' + r.code + ']', 'ok');
      });
    }

    function bindSoftSpaceFallback(cm) {      let run = 0;
      let last = 0;
      let timer = 0;
      let justOp = false;
      let syncing = false;

      function commit(n) {
        if (insertEditorDate(cm)) return;
        const cur = cm.getCursor();
        const start = Math.max(0, cur.ch - n);
        syncing = true;
        cm.replaceRange('', { line: cur.line, ch: start }, { line: cur.line, ch: cur.ch });
        cm.setCursor({ line: cur.line, ch: start });
        insertEditorSpaceOp(cm, n >= 3 ? '<' : '>');
        syncing = false;
        justOp = true;
      }

      cm.on('changes', (cmx, changes) => {
        if (syncing) return;
        if (cmx._spaceKeyAt && Date.now() - cmx._spaceKeyAt < 40) return;
        const lastChange = changes[changes.length - 1];
        if (!lastChange || !lastChange.text) return;
        const text = lastChange.text.join('\n');
        if (!/ +$/.test(text)) {
          run = 0;
          justOp = false;
          if (timer) { clearTimeout(timer); timer = 0; }
          return;
        }
        if (justOp) {
          const cur = cmx.getCursor();
          const before = cmx.getLine(cur.line).slice(0, cur.ch);
          const m = before.match(/ +$/);
          if (m) {
            const start = cur.ch - m[0].length;
            syncing = true;
            cmx.replaceRange(' ', { line: cur.line, ch: start }, { line: cur.line, ch: cur.ch });
            cmx.setCursor({ line: cur.line, ch: start + 1 });
            syncing = false;
          }
          return;
        }
        const now = Date.now();
        run = (now - last < 360) ? run + 1 : 1;
        last = now;
        if (run < 2) return;
        if (timer) { clearTimeout(timer); timer = 0; }
        if (run >= 3) {
          run = 0;
          commit(3);
        } else {
          timer = setTimeout(() => {
            timer = 0;
            run = 0;
            commit(2);
          }, 320);
        }
      });
    }

    function hintPick(n) {
      return function (cm, handle) {
        if (!handle || !handle.data || !handle.data.list) return;
        if (n > handle.data.list.length) return;
        handle.setFocus(n - 1);
        handle.pick();
      };
    }

    function clearLineSelection() {
      if (lineMenuCm && lineMenuLine >= 0) {
        try {
          lineMenuCm.removeLineClass(lineMenuLine, 'gutter', 'tv-line-selected');
          lineMenuCm.removeLineClass(lineMenuLine, 'background', 'tv-line-selected-bg');
        } catch (e) { /* ignore */ }
      }
      lineMenuCm = null;
      lineMenuLine = -1;
    }

    function closeLineMenu() {
      clearLineSelection();
      if (lineMenu) {
        lineMenu.remove();
        lineMenu = null;
      }
      document.removeEventListener('mousedown', onLineMenuOutside, true);
      document.removeEventListener('keydown', onLineMenuKey, true);
    }

    function onLineMenuOutside(ev) {
      if (lineMenu && !lineMenu.contains(ev.target)) closeLineMenu();
    }

    function onLineMenuKey(ev) {
      if (ev.key === 'Escape') closeLineMenu();
    }

    function removeEditorLine(cm, line) {
      const savedTop = cm.getScrollInfo().top;
      const last = cm.lineCount() - 1;
      if (last <= 0) {
        cm.replaceRange('', { line: 0, ch: 0 }, { line: 0, ch: cm.getLine(0).length });
      } else if (line >= last) {
        const prev = cm.getLine(last - 1).length;
        cm.replaceRange('', { line: last - 1, ch: prev }, { line: last, ch: cm.getLine(last).length });
      } else {
        cm.replaceRange('', { line, ch: 0 }, { line: line + 1, ch: 0 });
      }
      restoreScrollSoon(cm, savedTop);
    }

    function restoreScrollSoon(cm, top) {
      const restore = () => {
        const info = cm.getScrollInfo();
        cm.scrollTo(null, Math.min(top, Math.max(0, info.height - info.clientHeight)));
      };
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 60);
      setTimeout(restore, 150);
      setTimeout(restore, 320);
    }

    function copyEditorLine(cm, line) {
      lineClip = cm.getLine(line) || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lineClip).catch(() => {});
      }
    }

    function openLineMenu(cm, file, line, x, y) {
      closeLineMenu();
      const menu = el('div', { class: 'cm-line-menu' });
      const add = (label, fn, disabled) => {
        const b = el('button', { type: 'button' }, [label]);
        if (disabled) b.disabled = true;
        else b.addEventListener('click', () => { closeLineMenu(); fn(); cm.focus(); });
        menu.appendChild(b);
      };
      add('删除', () => removeEditorLine(cm, line));
      add('剪切', () => { copyEditorLine(cm, line); removeEditorLine(cm, line); });
      add('复制', () => copyEditorLine(cm, line));
      const readClip = (cb) => {
        if (navigator.clipboard && navigator.clipboard.readText
          && navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'clipboard-read' }).then((st) => {
            if (st && st.state === 'granted') {
              navigator.clipboard.readText().then(cb).catch(() => { if (lineClip) cb(lineClip); });
            } else if (lineClip) {
              cb(lineClip);
            }
          }).catch(() => { if (lineClip) cb(lineClip); });
        } else if (lineClip) {
          cb(lineClip);
        }
      };
      add('粘贴', () => {
        readClip((t) => {
          if (t == null || t === '') return;
          /* 粘贴 = 用复制内容替换选中行，不追加到行尾 */
          const text = String(t).replace(/\n$/, '');
          cm.replaceRange(text, { line, ch: 0 }, { line, ch: cm.getLine(line).length });
          cm.focus();
        });
      });
      add('插入', () => {
        readClip((t) => {
          if (t == null || t === '') return;
          /* 插入 = 在选中行的上一行插入复制内容 */
          const text = String(t).replace(/\n$/, '');
          cm.replaceRange(text + '\n', { line, ch: 0 });
          cm.focus();
        });
      });
      add('上移', () => {
        if (line <= 0) return;
        const a = cm.getLine(line - 1);
        const b = cm.getLine(line);
        /* 只替换 A\nB 这两行，不吞掉 B 后面的换行，保证是交换而不是拼接 */
        cm.replaceRange(b + '\n' + a, { line: line - 1, ch: 0 }, { line, ch: b.length });
      }, line <= 0);
      document.body.appendChild(menu);
      const r = menu.getBoundingClientRect();
      const wrap = cm.getWrapperElement();
      const gutter = wrap.querySelector('.CodeMirror-gutters');
      const gr = gutter ? gutter.getBoundingClientRect() : null;
      const coords = cm.charCoords({ line, ch: 0 }, 'window');
      /* 横向菜单放到行号栏右侧，并落在选中行的上方/下方，绝不压住该行行号 */
      let left = Math.max((gr ? gr.right : 0) + 8, x + 12);
      let top = coords.bottom + 6;
      if (top + r.height > window.innerHeight - 8) top = Math.max(8, coords.top - r.height - 6);
      left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      lineMenu = menu;
      lineMenuCm = cm;
      lineMenuLine = line;
      cm.addLineClass(line, 'gutter', 'tv-line-selected');
      cm.addLineClass(line, 'background', 'tv-line-selected-bg');
      setTimeout(() => {
        document.addEventListener('mousedown', onLineMenuOutside, true);
        document.addEventListener('keydown', onLineMenuKey, true);
      }, 0);
    }

    function bindLineMenu(cm, file) {
      cm.getWrapperElement().addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.classList || !t.classList.contains('CodeMirror-linenumber')) return;
        const n = Number(String(t.textContent || '').replace(/\u2007/g, '').trim());
        if (!n) return;
        ev.preventDefault();
        openLineMenu(cm, file, n - 1, ev.clientX, ev.clientY);
      });
    }

    /* 末尾 30 行滚动留白：不是正文行，不占行号 */
    function syncTailPad(cm) {
      if (!cm || !cm.lineCount) return;
      const h = Math.max(12, cm.defaultTextHeight() || 18) * 30;
      if (cm._tailPad) {
        try { cm.removeLineWidget(cm._tailPad); } catch (e) { /* ignore */ }
        cm._tailPad = null;
      }
      const pad = el('div', { class: 'cm-tail-pad', 'aria-hidden': 'true' });
      pad.style.height = h + 'px';
      cm._tailPad = cm.addLineWidget(Math.max(0, cm.lineCount() - 1), pad, { above: false });
    }

    function scheduleTailPad(cm) {
      clearTimeout(cm._tailTimer);
      cm._tailTimer = setTimeout(() => syncTailPad(cm), 60);
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
        lineNumberFormatter: (n) => String(n).padStart(5, '\u2007'),
        hintOptions: {},
        lint: {
          delay: 350,
          getAnnotations: () => annotations[file] || [],
        },
        extraKeys: {
          'Ctrl-Space': (cmx) => cmx.showHint({ hint: makeHint(active), completeSingle: false }),
          'Ctrl-Enter': () => { if (h.onRun) h.onRun(file); },
          Enter: (cmx) => {
            /* 组合行优先拆行；不完整时交回补全/默认换行 */
            if (file === 'ledger' && h.onExpandBatch
              && h.onExpandBatch(cmx, cmx.getCursor().line)) return;
            return CM.Pass;
          },
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
      bindLineMenu(cm, file);
      /* 捕获阶段先处理回车：即使补全浮层开着，完整组合行也优先拆行 */
      cm.getWrapperElement().addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || file !== 'ledger') return;
        const line = cm.getCursor().line;
        if (h.onExpandBatch && h.onExpandBatch(cm, line)) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          return;
        }
        if (h.onCanonicalLine) h.onCanonicalLine(cm, line);
      }, true);
      /* 删除键/退格删行：保持删除前的 scrollTop */
      cm.getWrapperElement().addEventListener('keydown', (ev) => {
        if (file !== 'ledger' || (ev.key !== 'Backspace' && ev.key !== 'Delete')) return;
        const top = cm.getScrollInfo().top;
        setTimeout(() => restoreScrollSoon(cm, top), 0);
      }, true);
      /* 删除末尾空行：保持原 scrollTop，不让 CM 把光标行滚回底部 */
      cm.getWrapperElement().addEventListener('keydown', (ev) => {
        if (ev.key !== 'Backspace' || file !== 'ledger') return;
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey || cm.somethingSelected()) return;
        const cur = cm.getCursor();
        if (cur.line !== cm.lineCount() - 1 || cur.ch !== 0) return;
        if ((cm.getLine(cur.line) || '').trim() !== '') return;
        const prev = cm.getLine(cur.line - 1) || '';
        const savedTop = cm.getScrollInfo().top;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        cm.operation(() => {
          cm.replaceRange('', { line: cur.line - 1, ch: prev.length }, { line: cur.line, ch: 0 });
          cm.setCursor({ line: cur.line - 1, ch: prev.length });
        });
        const restore = () => {
          const info = cm.getScrollInfo();
          cm.scrollTo(null, Math.min(savedTop, Math.max(0, info.height - info.clientHeight)));
        };
        restore();
        requestAnimationFrame(restore);
        setTimeout(restore, 50);
        setTimeout(restore, 150);
        setTimeout(restore, 300);
      }, true);
      cm.on('copy', () => { const s = cm.getSelection(); if (s) lineClip = s; });
      cm.on('cut', () => { const s = cm.getSelection(); if (s) lineClip = s; });
      cm.on('changes', () => scheduleTailPad(cm));
      syncTailPad(cm);
      const syncWrap = () => cm.setOption('lineWrapping', window.matchMedia('(max-width: 760px)').matches);
      syncWrap();
      window.addEventListener('resize', syncWrap);
      if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 760) {
        bindSoftSpaceFallback(cm);
      }
      if (file === 'ledger') {
        bindRelativeDateFix(cm);
        bindMotherHintPick(cm);
      }
      cm.on('change', () => {
        if (suspended) return;
        clearSemantic(file);   /* 文本一改，语义层立即失效，等下一次编译 */
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
      if (editors[active]) setTimeout(() => {
        editors[active].refresh();
        syncTailPad(editors[active]);
        if (active === 'ledger') scrollToTail(editors[active]);
      }, 0);
      if (h.onActive) h.onActive(active);
    }

    makePane('ledger', 'txtvein-ledger');
    makePane('dict', 'txtvein-dict');
    setActive('ledger');

    /* 语义层：编译产物里的 tokens 决定「识别状态」的颜色；改字立即清空，等下一次编译 */
    function clearSemantic(file) {
      (semMarks[file] || []).forEach((m) => { try { m.clear(); } catch (e) { /* noop */ } });
      semMarks[file] = [];
    }

    function setSemantic(file, tokens) {
      const cm = editors[file];
      if (!cm) return;
      clearSemantic(file);
      semTokens[file] = Array.isArray(tokens) ? tokens : [];
      semTokens[file].forEach((t) => {
        const line = Math.max(0, (Number(t.line) || 1) - 1);
        const text = cm.getLine(line);
        if (text == null) return;
        const from = Math.max(0, Math.min(Number(t.from) || 0, text.length));
        const to = Math.max(from, Math.min(Number(t.to) || 0, text.length));
        if (from >= to) return;
        const role = t.role === 'link' ? 'tv-link'
          : t.role === 'unknown' ? 'tv-unknown'
            : t.role === 'error' ? 'tv-error' : 'tv-def';
        semMarks[file].push(cm.markText({ line, ch: from }, { line, ch: to }, { className: 'tv-sem ' + role }));
      });
    }

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
      (invalidLines[file] || []).forEach((n) => {
        cm.removeLineClass(n, 'text', 'cm-invalid-line');
        cm.removeLineClass(n, 'gutter', 'tv-line-error');
      });
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
          cm.addLineClass(line, 'gutter', 'tv-line-error');
        }
        return {
          from: Pos(line, range.from),
          to: Pos(line, Math.max(range.to, range.from + 1)),
          message: d.message,
          severity: d.severity === 'warning' ? 'warning' : 'error',
        };
      });
      /* 简码重复：把同码的第一行也标成橘红行号（只染行号，不把正文整行变灰） */
      if (file === 'dict') {
        const dupCodes = new Set();
        (rawDiags.dict || []).forEach((d) => {
          if (d.code !== 'CODE_DUP') return;
          const m = String(d.message || '').match(/[：:]\s*([^\s，。；;、]+)\s*$/);
          if (m) dupCodes.add(m[1].toLowerCase());
        });
        if (dupCodes.size) {
          let section = '';
          for (let i = 0; i < cm.lineCount(); i += 1) {
            const text = cm.getLine(i) || '';
            const head = text.trim().match(/^\[([^\]]+)\]/);
            if (head) { section = head[1]; continue; }
            if (/母树|归属|Bindings?/i.test(section)) continue;
            const body = text.trim();
            if (!body || body.startsWith('//') || (!body.includes('，') && !body.includes(','))) continue;
            const first = body.split(/[，,]/)[0].trim();
            const m = first.match(/^(?:[PFCH]:)?([A-Za-z0-9_\u4e00-\u9fff-]+)$/i);
            if (!m || !dupCodes.has(m[1].toLowerCase())) continue;
            if (!invalidLines[file].includes(i)) {
              invalidLines[file].push(i);
              cm.addLineClass(i, 'gutter', 'tv-line-error');
            }
          }
        }
      }
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
      clearSemantic('ledger');
      clearSemantic('dict');
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

    function scrollToTail(cm) {
      if (!cm || !cm.lineCount) return;
      const last = Math.max(0, cm.lineCount() - 1);
      const info = cm.getScrollInfo();
      const padH = cm._tailPad && cm._tailPad.node ? cm._tailPad.node.offsetHeight || 0 : 0;
      /* 正文本身不足一屏：从顶部显示，不为了最后 10 行把开头藏掉 */
      if (info.height - padH <= info.clientHeight) {
        cm.scrollTo(null, 0);
        return;
      }
      /* 最后 10 行放到视口顶部，末尾留白留在下方 */
      const first = Math.max(0, last - 9);
      const coords = cm.charCoords({ line: first, ch: 0 }, 'local');
      const maxTop = Math.max(0, info.height - info.clientHeight);
      cm.scrollTo(null, Math.min(Math.max(0, coords.top), maxTop));
    }

    function refresh() {
      Object.keys(editors).forEach((k) => {
        editors[k].refresh();
        syncTailPad(editors[k]);
      });
    }

    setActive('ledger');
    return {
      setTexts,
      getTexts,
      setActive,
      getActive: () => active,
      setDiagnostics,
      setSemantic,
      setDirty,
      gotoLine,
      focus,
      refresh,
      editors,
    };
  }

  TV.editor = { create, defineModes };
})(typeof globalThis !== 'undefined' ? globalThis : this);
