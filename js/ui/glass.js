/* TxtVein · 液态玻璃（代码实现，无图片资源）
 *
 * 原理与 NT 教程一致：
 *   1. 生成一张「法线 / 位移贴图」：R/G 通道存横向/纵向偏移，128 = 不偏移；
 *   2. 把贴图塞进 SVG feImage，交给 feDisplacementMap 折射背景；
 *   3. 元素用 backdrop-filter: url(#...) 把折射结果当背景。
 *
 * 只给小型悬浮按钮用（40–54px），贴图 96×96、只生成一次；
 * 低端设备 / 不支持 backdrop-filter 时退回普通毛玻璃，不跑 SVG 滤镜。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const MAP_CACHE = new Map();
  const HEIGHT_CACHE = new Map();
  const PARAMS_KEY = 'txtvein.glass.v1';
  const DEFAULT_PARAMS = { opacity: 12, scale: 14, highlight: 60, shadow: 80, blur: 0, ring: 1, ringAlpha: 58 };

  function loadParams() {
    const out = Object.assign({}, DEFAULT_PARAMS);
    try {
      const raw = JSON.parse(localStorage.getItem(PARAMS_KEY) || 'null');
      if (raw) {
        ['opacity', 'scale', 'highlight', 'shadow', 'blur', 'ring', 'ringAlpha'].forEach((k) => {
          const n = Number(raw[k]);
          if (Number.isFinite(n)) out[k] = n;
        });
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  function applyTo(el, params) {
    if (!el) return;
    const p = params || loadParams();
    el.style.setProperty('--lg-alpha', String(Math.max(0, Math.min(1, p.opacity / 100))));
    el.style.setProperty('--lg-highlight', String(Math.max(0, Math.min(1, p.highlight / 100))));
    el.style.setProperty('--lg-shadow', String(Math.max(0, Math.min(1, p.shadow / 100))));
    el.style.setProperty('--lg-blur', String(Math.max(0, Number(p.blur) || 0)) + 'px');
    el.style.setProperty('--lg-ring-width', String(Math.max(0, Number(p.ring) || 0)) + 'px');
    el.style.setProperty('--lg-ring-alpha', String(Math.max(0, Math.min(1, p.ringAlpha / 100))));
    el.classList.toggle('lg-clear', Number(p.opacity) <= 0);
    const ids = [el.dataset.lgId, el.dataset.lgOpenId].filter(Boolean);
    ids.forEach((id) => {
      const disp = document.querySelector('#' + id + ' feDisplacementMap');
      if (disp) disp.setAttribute('scale', String(Math.max(0, Number(p.scale) || 0)));
    });
  }

  function setParams(patch) {
    const next = Object.assign(loadParams(), patch || {});
    try { localStorage.setItem(PARAMS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-liquid-glass="1"]').forEach((el) => applyTo(el, next));
    return next;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function sdfRoundRect(px, py, w, h, r) {
    const qx = Math.abs(px - w / 2) - (w / 2 - r);
    const qy = Math.abs(py - h / 2) - (h / 2 - r);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /** 生成位移贴图（data URL）。w/h 是元素 CSS 像素，贴图只关心比例。 */
  function buildMap(w, h, radius, opts) {
    const o = opts || {};
    const key = ['v1', w, h, radius, o.strength || 1].join('|');
    if (MAP_CACHE.has(key)) return MAP_CACHE.get(key);
    /* 256 的贴图：96 在 54px 上放大后边缘会一圈锯齿；贴图只生成一次，
     * 256² 的生成成本可以忽略，换来的边缘平滑是肉眼可见的。 */
    const maxSide = 96;
    const mw = Math.max(32, Math.round(maxSide * (w / Math.max(w, h))));
    const mh = Math.max(48, Math.round(maxSide * (h / Math.max(w, h))));
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(mw, mh);
    const data = img.data;
    const bevel = Math.max(3, Math.min(w, h) * 0.34);
    const strength = Number(o.strength) || 1;
    /* 法线用「一个贴图像素」做中心差分：低分辨率时固定 0.6 会在环上产生台阶 */
    const eps = Math.max(0.18, Math.min(w / mw, h / mh) * 0.55);

    for (let y = 0; y < mh; y += 1) {
      const py = ((y + 0.5) / mh) * h;
      for (let x = 0; x < mw; x += 1) {
        const px = ((x + 0.5) / mw) * w;
        const d = -sdfRoundRect(px, py, w, h, radius); // 正 = 内部
        let r = 128;
        let g = 128;
        if (d > 0) {
          const gx = (sdfRoundRect(px + eps, py, w, h, radius)
            - sdfRoundRect(px - eps, py, w, h, radius)) / (2 * eps);
          const gy = (sdfRoundRect(px, py + eps, w, h, radius)
            - sdfRoundRect(px, py - eps, w, h, radius)) / (2 * eps);
          const len = Math.hypot(gx, gy) || 1;
          const t = clamp(d / bevel, 0, 1);
          /* sin 曲线在边缘和中心都为 0、中段为 1：只折射边缘一圈，中心保持清楚，
           * 比 4t(1-t) 的导数更平滑，放大后没有折线 */
          const slope = Math.sin(Math.PI * t);
          const k = 127 * strength * slope;
          r = clamp(Math.round(128 + (gx / len) * k), 0, 255);
          g = clamp(Math.round(128 + (gy / len) * k), 0, 255);
        }
        const i = (y * mw + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }

    /* R/G 各做一次 3×3 高斯模糊（256 上约 0.3px）：把贴图量化留下的
     * 锯齿磨掉；B/A 不动，128 = 不偏移的语义保持不变。 */
    const src = new Uint8ClampedArray(data);
    const at = (x, y, c) => ((y * mw + x) * 4 + c);
    for (let y = 0; y < mh; y += 1) {
      for (let x = 0; x < mw; x += 1) {
        for (let c = 0; c < 2; c += 1) {
          let sum = 0;
          let wsum = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            const yy = y + dy;
            if (yy < 0 || yy >= mh) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              const xx = x + dx;
              if (xx < 0 || xx >= mw) continue;
              const wgt = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
              sum += src[at(xx, yy, c)] * wgt;
              wsum += wgt;
            }
          }
          data[at(x, y, c)] = Math.round(sum / wsum);
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    MAP_CACHE.set(key, url);
    return url;
  }

  /** 高度图：给 feSpecularLighting 算真正的边缘高光。
   * 中心平、边缘降到 0；alpha = 高度，RGB 白色。 */
  function buildHeightMap(w, h, radius) {
    const key = ['h', w, h, radius].join('|');
    if (HEIGHT_CACHE.has(key)) return HEIGHT_CACHE.get(key);
    const maxSide = 96;
    const mw = Math.max(32, Math.round(maxSide * (w / Math.max(w, h))));
    const mh = Math.max(32, Math.round(maxSide * (h / Math.max(w, h))));
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(mw, mh);
    const data = img.data;
    const bevel = Math.max(2.5, Math.min(w, h) * 0.22);
    for (let y = 0; y < mh; y += 1) {
      const py = ((y + 0.5) / mh) * h;
      for (let x = 0; x < mw; x += 1) {
        const px = ((x + 0.5) / mw) * w;
        const d = -sdfRoundRect(px, py, w, h, radius);
        let a = 0;
        if (d > 0) {
          const t = clamp(d / bevel, 0, 1);
          a = t * t * (3 - 2 * t);
        }
        const i = (y * mw + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    HEIGHT_CACHE.set(key, url);
    return url;
  }

  function defsRoot() {
    let svg = document.getElementById('tv-glass-defs');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.id = 'tv-glass-defs';
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
      document.body.appendChild(svg);
    }
    return svg;
  }

  function makeFilter(id, mapUrl, scale, heightUrl) {
    const svg = defsRoot();
    const old = document.getElementById(id);
    if (old) old.remove();
    const filter = document.createElementNS(NS, 'filter');
    filter.id = id;
    filter.setAttribute('x', '-30%');
    filter.setAttribute('y', '-30%');
    filter.setAttribute('width', '160%');
    filter.setAttribute('height', '160%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const img = document.createElementNS(NS, 'feImage');
    img.setAttribute('href', mapUrl);
    img.setAttributeNS(XLINK, 'xlink:href', mapUrl);
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('result', 'map');
    filter.appendChild(img);

    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(scale));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', 'refracted');
    filter.appendChild(disp);

    const blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('in', 'refracted');
    blur.setAttribute('stdDeviation', '0.22');
    blur.setAttribute('result', 'refractedBlur');
    filter.appendChild(blur);

    if (heightUrl) {
      const hm = document.createElementNS(NS, 'feImage');
      hm.setAttribute('href', heightUrl);
      hm.setAttributeNS(XLINK, 'xlink:href', heightUrl);
      hm.setAttribute('preserveAspectRatio', 'none');
      hm.setAttribute('result', 'heightMap');
      filter.appendChild(hm);

      const spec = document.createElementNS(NS, 'feSpecularLighting');
      spec.setAttribute('in', 'heightMap');
      spec.setAttribute('surfaceScale', '2.2');
      spec.setAttribute('specularConstant', '0.9');
      spec.setAttribute('specularExponent', '20');
      spec.setAttribute('lighting-color', '#ffffff');
      spec.setAttribute('result', 'specular');
      const light = document.createElementNS(NS, 'feDistantLight');
      light.setAttribute('azimuth', '225');
      light.setAttribute('elevation', '55');
      spec.appendChild(light);
      filter.appendChild(spec);

      const clip = document.createElementNS(NS, 'feComposite');
      clip.setAttribute('in', 'specular');
      clip.setAttribute('in2', 'SourceAlpha');
      clip.setAttribute('operator', 'in');
      clip.setAttribute('result', 'specularClip');
      filter.appendChild(clip);

      const blend = document.createElementNS(NS, 'feBlend');
      blend.setAttribute('in', 'refractedBlur');
      blend.setAttribute('in2', 'specularClip');
      blend.setAttribute('mode', 'screen');
      filter.appendChild(blend);
    }

    svg.appendChild(filter);
    return id;
  }

  function supportsLiquid() {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) return false;
    /* Chromium 支持 backdrop-filter: url(#filter)；不支持时会退回毛玻璃 */
    if (!CSS.supports('backdrop-filter', 'url(#tv-glass-probe)')) return false;
    const cores = Number(navigator.hardwareConcurrency) || 8;
    if (cores <= 4) return false;
    try {
      if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return false;
    } catch (e) { /* ignore */ }
    return true;
  }

  /**
   * 给一个元素装液态玻璃。
   * @param {HTMLElement} el
   * @param {{width?:number,height?:number,radius?:number,scale?:number,id?:string,strength?:number}} opts
   */
  function install(el, opts) {
    if (!el || el.dataset.liquidGlass === '1') return false;
    const o = opts || {};
    const rect = el.getBoundingClientRect();
    const w = Math.round(o.width || rect.width || 40);
    const h = Math.round(o.height || rect.height || 40);
    const radius = o.radius == null ? Math.min(w, h) / 2 : o.radius;

    if (!supportsLiquid()) {
      el.classList.add('liquid-glass-fallback');
      return false;
    }

    try {
      const map = buildMap(w, h, radius, { strength: o.strength || 1 });
      if (!map) { el.classList.add('liquid-glass-fallback'); return false; }
      const id = o.id || ('tv-glass-' + Math.random().toString(36).slice(2, 8));
      makeFilter(id, map, Number(o.scale) || 14);
      el.dataset.liquidGlass = '1';
      el.dataset.lgId = id;
      el.classList.add('liquid-glass');
      el.style.setProperty('--lg-filter', 'url(#' + id + ')');
      applyTo(el, loadParams());
      el.style.setProperty('--lg-radius', radius + 'px');
      /* 展开态（宽条）单独一张贴图：同一个元素宽度变化时不会被拉伸 */
      const ow = Number(o.openWidth) || 0;
      const oh = Number(o.openHeight) || 0;
      if (ow > 0 && oh > 0) {
        const orad = o.openRadius == null ? Math.min(ow, oh) / 2 : o.openRadius;
        const omap = buildMap(ow, oh, orad, { strength: o.strength || 1 });
        if (omap) {
          const oid = o.openId || (id + '-open');
          makeFilter(oid, omap, Number(o.openScale) || Number(o.scale) || 14);
          el.dataset.lgOpenId = oid;
          el.style.setProperty('--lg-filter-open', 'url(#' + oid + ')');
          applyTo(el, loadParams());
        }
      }
      return true;
    } catch (e) {
      el.classList.add('liquid-glass-fallback');
      return false;
    }
  }

  TV.glass = { install, buildMap, getParams: loadParams, setParams, defaults: DEFAULT_PARAMS };

  if (typeof module === 'object' && module.exports) module.exports = TV.glass;
})(typeof globalThis !== 'undefined' ? globalThis : this);
