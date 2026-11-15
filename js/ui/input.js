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
    const errorEl = dom.error;
    const row = dom.row;
    const prompt = dom.prompt;

    let suggestions = [];
    let active = 0;
    let context = null;
    let predictionData = null;
    let spaceRun = 0;
    let lastSpace = 0;
    let spaceTimer = 0;
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
          el('span', { class: 'bubble-idx' }, [String(i + 1)]),
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
      prompt.textContent = editing ? 'EDIT' : '>';
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

    input.addEventListener('keydown', (ev) => {
      if (ev.isComposing) return;

      if (ev.key !== ' ') {
        if (spaceTimer) { clearTimeout(spaceTimer); spaceTimer = 0; }
        spaceRun = 0;
      }

      if (ev.key === ' ') {
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

      const num = /^[1-9]$/.test(ev.key) ? Number(ev.key)
        : (/^Numpad[1-9]$/.test(ev.code) ? Number(ev.code.slice(-1)) : 0);
      if (num && suggestions.length && !bubbles.hidden) {
        ev.preventDefault();
        choose(num - 1);
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        if (ghost) {
          ev.preventDefault();
          undoGhost();
        }
      }
    });

    input.addEventListener('input', () => {
      clearError();
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
