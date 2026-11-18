/* TxtVein · 单输入框
 * 双空格宏：第一次双击 → >，第二次双击 → <。
 * 气泡：↑↓ 选择、Tab 补全、数字键秒选并固化别名。
 * 幽灵撤销：固化后 5 秒内 Ctrl+Z / 点提示可恢复。
 * 这一层只管输入框与气泡；候选计算和落盘都在 app。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;

  function create(dom, handlers) {
    const h = handlers || {};
    const input = dom.input;
    const bubbles = dom.bubbles;
    const prediction = dom.prediction;
    const stateEl = dom.state;
    const hintEl = dom.hint;
    const batchHintEl = dom.batchHint;
    const errorEl = dom.error;
    const row = dom.row;
  
    let suggestions = [];
    let active = 0;
    let context = null;
    let predictionData = null;
    let spaceRun = 0;
    let lastSpace = 0;
    let spaceTimer = 0;
    let rawSpaceTimer = 0;
    let rawSpaceCount = 0;
    let justInsertedOp = false;
    let editing = false;
    let ghost = null;
    let errorTimer = 0;

    function caret() {
      return input.selectionStart == null ? input.value.length : input.selectionStart;
    }

    function setCaret(pos) {
      const p = Math.max(0, Math.min(input.value.length, pos));
      input.setSelectionRange(p, p);
    }

    function query(show) {
      if (!h.onQuery) return;
      const res = h.onQuery(input.value, caret());
      if (!res) return;
      suggestions = res.suggestions || [];
      context = res.context || null;
      predictionData = res.prediction || null;
      active = 0;
      if (res.state) stateEl.textContent = res.state;
      if (res.hint != null) hintEl.textContent = res.hint;
      if (batchHintEl) {
        if (res.batchHint) {
          batchHintEl.textContent = res.batchHint;
          batchHintEl.hidden = false;
        } else {
          batchHintEl.hidden = true;
        }
      }
      renderBubbles(show !== false && !!input.value.trim());
      renderPrediction(!!input.value.trim());
    }

    function renderBubbles(show) {
      clear(bubbles);
      if (!show || !suggestions.length) {
        bubbles.hidden = true;
        return;
      }
      suggestions.forEach((s, i) => {
        const meta = [s.type || s.kindTag || '', s.pole ? s.pole + ' 极' : '', s.domain ? '[' + s.domain + ']' : '']
          .filter(Boolean).join(' · ');
        const b = el('div', {
          class: 'bubble' + (i === active ? ' is-active' : ''),
          dataset: { index: i },
          role: 'option',
        }, [
          el('span', { class: 'bubble-main' }, [
            el('span', { class: 'bubble-name' }, [
              s.label || s.name,
              s.codeLabel ? el('span', { class: 'code' }, [s.codeLabel]) : null,
            ]),
            el('span', { class: 'bubble-meta' }, [meta]),
          ]),
          el('span', { class: 'bubble-side' }, [
            s.kind === 'tag' ? '标签' : (s.pole === 'A'
              ? el('span', { class: 'pole-a' }, ['A'])
              : el('span', { class: 'pole-b' }, ['B'])),
          ]),
        ]);
        let chose = false;
        const doChoose = (ev) => {
          if (ev && ev.preventDefault) ev.preventDefault();
          if (chose) return;
          chose = true;
          choose(i);
        };
        b.addEventListener('pointerdown', doChoose);
        b.addEventListener('mousedown', doChoose);
        b.addEventListener('click', doChoose);
        b.addEventListener('mouseenter', () => setActive(i));
        bubbles.appendChild(b);
      });
      bubbles.hidden = false;
    }

    function renderPrediction(show) {
      clear(prediction);
      if (!show || !predictionData) {
        prediction.hidden = true;
        return;
      }
      prediction.appendChild(el('span', { class: 'pred-label' }, ['PREDICT']));
      prediction.appendChild(el('span', { class: 'pred-text' }, [predictionData.text]));
      prediction.appendChild(el('span', { class: 'pred-key' }, ['TAB 采用']));
      prediction.hidden = false;
    }

    function setActive(i) {
      if (!suggestions.length) return;
      active = (i + suggestions.length) % suggestions.length;
      Array.from(bubbles.children).forEach((b, idx) => {
        b.classList.toggle('is-active', idx === active);
      });
      const child = bubbles.children[active];
      if (child && child.scrollIntoView) child.scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
      const s = suggestions[i];
      if (!s) return;
      const ctx = context;
      bubbles.hidden = true;
      if (h.onChoose) h.onChoose(ctx, s, i, suggestions.slice());
    }

    function submit() {
      if (!input.value.trim()) return;
      if (h.onSubmit) h.onSubmit(input.value, { editing });
    }

    function showError(msg) {
      errorEl.textContent = msg || '';
      errorEl.hidden = !msg;
      row.classList.remove('is-error');
      void row.offsetWidth;
      if (msg) row.classList.add('is-error');
      clearTimeout(errorTimer);
      if (msg) {
        errorTimer = setTimeout(() => {
          row.classList.remove('is-error');
        }, 600);
      }
    }

    function clearError() {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }

    function setValue(value, pos) {
      input.value = value == null ? '' : String(value);
      setCaret(pos == null ? input.value.length : pos);
      query(true);
    }

    function setEditing(on, text, label) {
      editing = !!on;
      row.classList.toggle('is-editing', editing);
    
      if (editing && text != null) {
        input.value = text;
        setCaret(input.value.length);
        query(true);
      }
      if (label) hintEl.textContent = label;
      input.focus();
    }

    function setGhost(g) {
      ghost = g || null;
    }

    function undoGhost() {
      if (!ghost) return false;
      const g = ghost;
      ghost = null;
      if (h.onUndoAlias) h.onUndoAlias(g);
      return true;
    }

    function toggleGhost() {
      if (!ghost) return false;
      undoGhost();
      return true;
    }

    function insertSpaceOperator(op) {
      const pos = caret();
      const before = input.value.slice(0, pos);
      const after = input.value.slice(pos);
      const nextBefore = op === '>' ? before.replace(/\s*$/, '') + ' > '
        : before.replace(/\s*[<>]\s*$/, '') + ' < ';
      input.value = nextBefore + after;
      setCaret(nextBefore.length);
      query(true);
    }

    /* 手机软键盘不一定发可 preventDefault 的 Space keydown；
       从 input 事件里识别连续空格，延迟 320ms 等第三击。 */
    function commitRawSpaces(count) {
      if (!editing && !input.value.trim()) {
        const stamp = TV.date && TV.date.todayStamp ? TV.date.todayStamp(new Date()) : '';
        if (stamp) {
          input.value = stamp + ' ';
          setCaret(input.value.length);
          query(true);
          return;
        }
      }
      const pos = caret();
      const before = input.value.slice(0, pos);
      const m = before.match(/ +$/);
      if (!m) return;
      const start = pos - m[0].length;
      input.value = input.value.slice(0, start) + input.value.slice(pos);
      setCaret(start);
      insertSpaceOperator((count >= 3 || m[0].length >= 3) ? '<' : '>');
      justInsertedOp = true;
    }

    input.addEventListener('keydown', (ev) => {
      if (ev.isComposing) return;

      if (ev.key !== ' ') {
        if (spaceTimer) { clearTimeout(spaceTimer); spaceTimer = 0; }
        if (rawSpaceTimer) { clearTimeout(rawSpaceTimer); rawSpaceTimer = 0; rawSpaceCount = 0; }
        spaceRun = 0;
      }

      if (ev.key === ' ') {
        if (rawSpaceTimer) { clearTimeout(rawSpaceTimer); rawSpaceTimer = 0; rawSpaceCount = 0; }
        /* 新记录开头按空格：先把当前日期插到空格前，再开始推荐转出节点 */
        if (!editing && !input.value.trim()) {
          const stamp = TV.date && TV.date.todayStamp ? TV.date.todayStamp(new Date()) : '';
          if (stamp) {
            ev.preventDefault();
            if (spaceTimer) { clearTimeout(spaceTimer); spaceTimer = 0; }
            input.value = stamp + ' ';
            setCaret(input.value.length);
            spaceRun = 0;
            lastSpace = Date.now();
            query(true);
            return;
          }
        }
        const now = Date.now();
        spaceRun = (now - lastSpace < 360) ? spaceRun + 1 : 1;
        lastSpace = now;

        /* 2 连击 → >；3 连击 → 把刚插入的 > 换成 < */
        if (spaceRun >= 2) {
          ev.preventDefault();
          if (spaceTimer) { clearTimeout(spaceTimer); spaceTimer = 0; }
          insertSpaceOperator(spaceRun === 2 ? '>' : '<');
          spaceRun = spaceRun === 2 ? 2 : 0;
          return;
        }

        /* 精确节点后的空格只补分隔符，不自动改成候选编号/别名 */
        if (context && context.exactNode && (context.role === 'from' || context.role === 'to')) {
          ev.preventDefault();
          const pos = caret();
          input.value = input.value.slice(0, pos) + ' ' + input.value.slice(pos);
          setCaret(pos + 1);
          query(true);
          return;
        }

        /* 候选打开时，单空格延迟确认；若 360ms 内来了第二/第三个空格，走上面的 > / < */
        if (suggestions.length && !bubbles.hidden) {
          const s = suggestions[active];
          const repl = String((s && (s.codeLabel || s.label || s.name)) || '').replace(/^#/, '').trim().toLowerCase();
          const tok = String((context && context.token) || '').replace(/^#/, '').trim().toLowerCase();
          if (!tok || (repl && repl !== tok)) {
            ev.preventDefault();
            if (spaceTimer) clearTimeout(spaceTimer);
            spaceTimer = setTimeout(() => {
              spaceTimer = 0;
              spaceRun = 0;
              choose(active);
            }, 320);
            return;
          }
        }
        return;
      }

      if (ev.key === 'Enter') {
        if (suggestions.length && !bubbles.hidden) {
          const s = suggestions[active];
          const code = String((s && s.codeLabel) || '').replace(/^#/, '').toLowerCase();
          const tok = String((context && context.token) || '')
            .replace(/^#/, '').replace((context && context.prefix) || '', '').toLowerCase();
          if (s && s.kind !== 'mother' && code && tok === code) {
            ev.preventDefault();
            submit();
            return;
          }
          ev.preventDefault();
          choose(active);
          return;
        }
        ev.preventDefault();
        submit();
        return;
      }

      if (ev.key === 'Tab') {
        if (predictionData && prediction.hidden === false) {
          ev.preventDefault();
          input.value = predictionData.text;
          setCaret(input.value.length);
          query(true);
          return;
        }
        if (suggestions.length && !bubbles.hidden) {
          ev.preventDefault();
          choose(active);
        }
        return;
      }

      if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')
        && suggestions.length && !bubbles.hidden) {
        ev.preventDefault();
        if (h.onPath) h.onPath(ev.key === 'ArrowRight' ? 1 : -1, context);
        return;
      }

      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (suggestions.length && !bubbles.hidden) {
          ev.preventDefault();
          setActive(active + (ev.key === 'ArrowDown' ? 1 : -1));
          return;
        }
        if (h.onNavigate) {
          ev.preventDefault();
          h.onNavigate(ev.key === 'ArrowDown' ? 1 : -1);
        }
        return;
      }

      if (ev.key === 'Escape') {
        if (suggestions.length && !bubbles.hidden) {
          bubbles.hidden = true;
          return;
        }
        if (editing) {
          ev.preventDefault();
          if (h.onCancelEdit) h.onCancelEdit();
          return;
        }
        if (input.value) {
          input.value = '';
          clearError();
          query(false);
        }
        return;
      }

      if (ev.key === 'Backspace') {
        clearError();
        setTimeout(() => query(true), 0);
        return;
      }

      /* 转入节点刚录完、还没打空格：金额的第一个数字自动补一个空格 */
      if (context && context.atNodeBoundary && /^[0-9]$/.test(ev.key)
        && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        const pos = caret();
        const before = input.value.slice(0, pos);
        if (before && !/\s$/.test(before)) {
          ev.preventDefault();
          input.value = before + ' ' + ev.key + input.value.slice(pos);
          setCaret(pos + 2);
          query(true);
          return;
        }
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        if (ghost) {
          ev.preventDefault();
          undoGhost();
        }
      }
    });

    input.addEventListener('input', (ev) => {
      clearError();
      const type = ev.inputType || '';
      if (!ev.isComposing && type.indexOf('Composition') < 0 && type.indexOf('Paste') < 0) {
        const pos = caret();
        const before = input.value.slice(0, pos);
        const m = before.match(/ +$/);
        const n = m ? m[0].length : 0;
        if (justInsertedOp) {
          if (n >= 1) {
            const start = pos - n;
            input.value = input.value.slice(0, start) + ' ' + input.value.slice(pos);
            setCaret(start + 1);
            query(true);
            return;
          }
          justInsertedOp = false;
        }
        if (n >= 2) {
          if (rawSpaceTimer) clearTimeout(rawSpaceTimer);
          rawSpaceCount = n;
          if (n >= 3) {
            rawSpaceTimer = 0;
            commitRawSpaces(3);
          } else {
            rawSpaceTimer = setTimeout(() => {
              rawSpaceTimer = 0;
              commitRawSpaces(rawSpaceCount);
            }, 320);
          }
        } else if (n === 0 && rawSpaceTimer) {
          clearTimeout(rawSpaceTimer);
          rawSpaceTimer = 0;
          rawSpaceCount = 0;
        }
      }
      query(true);
    });

    input.addEventListener('focus', () => query(true));

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!bubbles.contains(document.activeElement)) bubbles.hidden = true;
      }, 120);
    });

    return {
      el: input,
      focus() { input.focus(); },
      value() { return input.value; },
      setValue,
      setEditing,
      select(start, end) {
        const a = Math.max(0, Math.min(Number(start) || 0, input.value.length));
        const b = Math.max(a, Math.min(Number(end) || a, input.value.length));
        input.focus();
        input.setSelectionRange(a, b);
      },
      isEditing() { return editing; },
      showError,
      clearError,
      setGhost,
      undoGhost,
      toggleGhost,
      query,
      setSuggestions(list, ctx) {
        suggestions = Array.isArray(list) ? list : [];
        context = ctx || null;
        active = 0;
        renderBubbles(true);
        renderPrediction(false);
      },
      clear() {
        input.value = '';
        clearError();
        query(false);
      },
    };
  }

  TV.input = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
