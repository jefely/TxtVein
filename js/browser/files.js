/* TxtVein · 浏览器文件输入输出
 * 不联网、不上传；只做 Blob 下载、File 读取、剪贴板。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  function downloadText(filename, content, mime) {
    const blob = new Blob([String(content == null ? '' : content)], {
      type: mime || 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function downloadAll(files) {
    const list = files || [];
    for (let i = 0; i < list.length; i += 1) {
      downloadText(list[i].name, list[i].text, list[i].mime);
      if (i < list.length - 1) await sleep(350);
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(new Error('读取文件失败：' + (file && file.name)));
      fr.readAsText(file, 'utf-8');
    });
  }

  async function readFiles(fileList) {
    const files = Array.from(fileList || []);
    const out = [];
    for (const f of files) {
      out.push({ name: f.name || '未命名', size: f.size || 0, text: await readFile(f) });
    }
    return out;
  }

  function pickFiles(multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple !== false;
      input.accept = '.txt,.json,.md,.shadow,.vault,.enc,.bak,text/plain,application/json';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        input.remove();
        resolve(files);
      }, { once: true });
      input.click();
    });
  }

  async function copyText(s) {
    const text = String(s == null ? '' : s);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }

  function classify(name, text) {
    if (TV.envelope && TV.envelope.isEncrypted(text)) return 'secure';
    if (TV.dictFile && TV.dictFile.isDict(text)) return 'dict';
    if (TV.ledgerFile && TV.ledgerFile.isLedger(text)) return 'ledger';
    if (TV.legacy && TV.legacy.detectLegacy(text)) return 'legacy';
    const n = String(name || '').toLowerCase();
    if (/\.json$/.test(n)) return 'dict';
    return 'unknown';
  }

  function ext(name) {
    const m = String(name || '').match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  }

  function bytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return v + ' B';
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
    return (v / 1024 / 1024).toFixed(2) + ' MB';
  }

  TV.files = {
    downloadText,
    downloadAll,
    readFiles,
    pickFiles,
    copyText,
    classify,
    ext,
    bytes,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
