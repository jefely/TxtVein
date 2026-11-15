/* TxtVein · 门禁（设密码 / 解锁 / 重置）
 * 只负责界面与表单校验；真正的密钥派生在 store 里。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const { el, clear } = TV.dom;

  function createGate(host, handlers) {
    const h = handlers || {};
    let mode = 'unlock';
    let busy = false;
    let resetArmed = false;

    function panel(head, body, foot) {
      clear(host);
      host.appendChild(el('div', { class: 'gate-panel' }, [
        el('div', { class: 'gate-brand' }, ['TXT', el('span', {}, ['VEIN'])]),
        el('div', { class: 'gate-tag' }, ['PURE TEXT · DUAL POLARITY · ZERO KNOWLEDGE']),
        head,
        body,
        foot,
      ]));
    }

    function errBox() {
      return el('div', { class: 'form-error', id: 'gate-error' });
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [
        el('label', { for: input.id }, [label]),
        input,
      ]);
    }

    function passwordInput(id, placeholder) {
      return el('input', {
        class: 'input', id, type: 'password', placeholder: placeholder || '',
        autocomplete: id === 'gate-pw' ? 'current-password' : 'new-password',
        spellcheck: 'false',
      });
    }

    function foot() {
      return el('div', { class: 'gate-foot' }, [
        el('span', { id: 'gate-foot-note' }, ['本地加密 · 无网络 · 无找回']),
        el('span', { id: 'gate-foot-action' }),
      ]);
    }

    function showSetup() {
      mode = 'setup';
      resetArmed = false;
      const pw = passwordInput('gate-pw', '至少 4 位');
      const pw2 = passwordInput('gate-pw2', '再输一次');
      const hint = el('input', {
        class: 'input', id: 'gate-hint', type: 'text', placeholder: '可选：一句只有你懂的提示',
        autocomplete: 'off',
      });
      const err = errBox();
      const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, ['建立保险库']);
      const form = el('form', {
        onsubmit: async (ev) => {
          ev.preventDefault();
          if (busy) return;
          const a = pw.value;
          const b = pw2.value;
          if (a.length < 4) return setError('主密码至少 4 位');
          if (a !== b) return setError('两次输入不一致');
          setBusy(true, submit, '正在派生密钥…');
          try {
            await h.onSetup(a, hint.value);
            setBusy(false, submit, '建立保险库');
          } catch (e) {
            setBusy(false, submit, '建立保险库');
            setError(e.message || '建立失败');
          }
        },
      }, [
        el('h2', {}, ['设置主密码']),
        el('p', {}, ['账本只在本机加密保存。忘记密码 = 数据永久销毁；没有服务器，也没有找回。']),
        field('主密码', pw),
        field('确认', pw2),
        field('提示（可选）', hint),
        err,
        submit,
      ]);
      const f = foot();
      const action = f.querySelector('#gate-foot-action');
      action.appendChild(el('span', {}, ['纯文本是本体 · 加密是外壳']));
      panel(null, form, f);
      setTimeout(() => pw.focus(), 30);
    }

    function showUnlock() {
      mode = 'unlock';
      resetArmed = false;
      const pw = passwordInput('gate-pw', '主密码');
      const err = errBox();
      const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, ['解锁']);
      const hintText = (h.readHint && h.readHint()) || '';
      const hintEl = el('div', { class: 'gate-hint', id: 'gate-hint-text' }, [
        hintText ? '提示：' + hintText : '',
      ]);
      hintEl.hidden = !hintText;
      const form = el('form', {
        onsubmit: async (ev) => {
          ev.preventDefault();
          if (busy) return;
          if (!pw.value) return setError('输入主密码');
          setBusy(true, submit, '正在解锁…');
          try {
            const ok = await h.onUnlock(pw.value);
            if (ok) {
              setBusy(false, submit, '解锁');
              return;
            }
            setBusy(false, submit, '解锁');
            setError('密码不对');
            pw.select();
          } catch (e) {
            setBusy(false, submit, '解锁');
            setError(e.message || '解锁失败');
          }
        },
      }, [
        el('h2', {}, ['解锁账本']),
        el('p', {}, ['密钥只在内存里。刷新或锁定后需要重新输入。']),
        field('主密码', pw),
        hintEl,
        err,
        submit,
      ]);
      const f = foot();
      const action = f.querySelector('#gate-foot-action');
      const resetBtn = el('button', { type: 'button' }, ['忘记密码？重置保险库']);
      resetBtn.addEventListener('click', () => {
        if (!resetArmed) {
          resetArmed = true;
          resetBtn.textContent = '确认销毁？再点一次';
          resetBtn.style.color = '#D98A8A';
          setError('重置会删除本地保险库，且无法恢复。');
          return;
        }
        h.onReset && h.onReset();
      });
      action.appendChild(resetBtn);
      panel(null, form, f);
      setTimeout(() => pw.focus(), 30);
    }

    function show() {
      host.hidden = false;
      if (h.hasVault && h.hasVault()) showUnlock();
      else showSetup();
    }

    function hide() {
      host.hidden = true;
      clear(host);
    }

    function setError(msg) {
      const box = host.querySelector('#gate-error');
      if (box) box.textContent = msg || '';
    }

    function setBusy(on, button, label) {
      busy = !!on;
      if (button) {
        button.disabled = !!on;
        button.textContent = label || button.textContent;
      }
    }

    function note(msg) {
      const box = host.querySelector('#gate-foot-note');
      if (box) box.textContent = msg;
    }

    return { show, hide, setError, note, get mode() { return mode; } };
  }

  TV.gate = { createGate };
})(typeof globalThis !== 'undefined' ? globalThis : this);
