/* TxtVein · DOM 小工具（只服务 UI 层） */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  function $(sel, node) {
    return (node || document).querySelector(sel);
  }

  function $$(sel, node) {
    return Array.from((node || document).querySelectorAll(sel));
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach((k) => {
      const v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') Object.keys(v).forEach((dk) => { node.dataset[dk] = v[dk]; });
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
  }

  function show(node, on) {
    if (!node) return;
    node.hidden = !on;
  }

  function debounce(fn, ms) {
    let t = 0;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function raf(fn) {
    return requestAnimationFrame(fn);
  }

  function emit(node, name, detail) {
    node.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  TV.dom = { $, $$, el, clear, show, debounce, raf, emit };

  if (typeof module === 'object' && module.exports) module.exports = TV.dom;
})(typeof globalThis !== 'undefined' ? globalThis : this);
