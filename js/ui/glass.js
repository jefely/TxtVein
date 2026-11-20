/* TxtVein · 液态玻璃（代码实现，无图片资源）
 *
 * 四层（对应用户 2026-11 提供的教程视频）：
 *   ① 透明：rgba 底，让背后内容透出来
 *   ② 折射：位移贴图，边缘按 Snell 定律弯折背景
 *   ③ 高光：CSS 双环（外灰暗线 + 内白高光）勾出轮廓
 *   ④ 阴影：外投影，把玻璃从页面上抬起来
 *
 * 折射不是"沿法线推像素"那么简单：
 *   1. 先描述形状 —— height = f(到边缘的距离)，边缘陡、中间平；
 *   2. 求导得斜率 → 法线；
 *   3. 用 Snell 定律 n1·sinθ1 = n2·sinθ2 求偏移量（n = 1.5 玻璃）；
 *   4. 整张图按最大偏移归一化到 [-1,1]，写进 R/G，128 = 不偏移；
 *   5. feImage → feDisplacementMap → backdrop-filter。
 *
 * 关键点：边缘处斜率最大，所以**位移在边缘最大、中间为 0**。
 * 旧版用 sin(πt) / 4t(1-t)，边缘是 0，会留下一圈"不折射的硬边"，
 * 那正是阶梯感和白边的来源。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const MAP_CACHE = new Map();
  const PARAMS_KEY = 'txtvein.glass.v1';

  /* 玻璃折射率：视频里的 n = 1.50（空气 1.00）。 */
  const REFRACT = 1.5;
  /* 边缘弯曲区占短边的比例（默认值）。视频剖面里这段是"一圈"，
   * 但太窄会看不出弯折，所以在设置里可调。 */
  const BEVEL = 0.32;
  /* 基准尺寸：scale 的语义是"40px 元素上的最大位移像素数"，其它尺寸等比。 */
  const BASE = 40;
  /* filter region 相对元素外扩的比例；位移贴图要按同一比例加大，
   * 否则 feImage 铺满 region 时和元素错位。 */
  const REGION_EXT = 0.2;

  const DEFAULT_PARAMS = {
    opacity: 34,      // ① 透明层：视频推荐 35%
    scale: 8,         // ② 位移强度（40px 元素上的像素）
    bevel: 32,        // ② 折射环宽度（短边的 %）
    highlight: 60,    // ③ 迎光高光
    shadow: 34,       // ④ 外投影
    blur: 1.5,        // 背景柔化（0 = 纯透明折射，视频教程值）
    ring: 1.2,        // 高光环宽度（px）
    veil: 1,          // 边缘暗线宽度（px）：贴合外框的那道缝
    ringBlur: 0.4,    // 高光环模糊（px）：抗锯齿用，0 = 完全锐利
    angle: 0,         // 光源方位（deg，0 = 正上方，顺时针）
    distance: 55,     // 光源远近（%）：越近方向性越强，越远越接近均匀
    ringAlpha: 62,    // 内白环透明度
    darkRing: 34,     // 外灰暗线透明度
  };
  const PARAM_KEYS = Object.keys(DEFAULT_PARAMS);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function loadParams() {
    const out = Object.assign({}, DEFAULT_PARAMS);
    try {
      const raw = JSON.parse(localStorage.getItem(PARAMS_KEY) || 'null');
      if (raw) {
        PARAM_KEYS.forEach((k) => {
          const n = Number(raw[k]);
          if (Number.isFinite(n)) out[k] = n;
        });
        /* 旧版 scale 是写死的像素值（12–18），语义和现在一致，继续用 */
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  /** 把参数写到元素的 CSS 变量上；scale 按元素基准尺寸换算。 */
  function applyTo(el, params) {
    if (!el) return;
    const p = params || loadParams();
    el.style.setProperty('--lg-alpha', String(clamp(p.opacity / 100, 0, 1)));
    el.style.setProperty('--lg-highlight', String(clamp(p.highlight / 100, 0, 1)));
    el.style.setProperty('--lg-shadow', String(clamp(p.shadow / 100, 0, 1)));
    el.style.setProperty('--lg-blur', String(Math.max(0, Number(p.blur) || 0)) + 'px');
    /* 环宽**不做物理像素取整**：取整后 0.1 步进只剩 1/2/3 三档，滑块等于废了。
     * 抗锯齿交给 --lg-ring-blur（设置里可调）。 */
    const ringPx = Math.max(0, Number(p.ring) || 0);
    el.style.setProperty('--lg-ring-width', String(ringPx) + 'px');
    /* veil = 边缘暗线宽度（px） */
  el.style.setProperty('--lg-edge-w', String(Math.max(0, Number(p.veil) || 0)) + 'px');
    el.style.setProperty('--lg-ring-blur', String(Math.max(0, Number(p.ringBlur) || 0)) + 'px');
    el.style.setProperty('--lg-ring-alpha', String(clamp((Number(p.ringAlpha) || 0) / 100, 0, 1)));
    el.style.setProperty('--lg-dark-ring', String(clamp((Number(p.darkRing) || 0) / 100, 0, 1)));
    el.style.setProperty('--lg-ring-angle', String(Number(p.angle) || 0) + 'deg');
    /* 光源越近，环上背光侧越暗（方向性越强）；越远越接近平行光，整圈趋匀。 */
    const near = clamp((Number(p.distance == null ? 55 : p.distance)) / 100, 0, 1);
    el.style.setProperty('--lg-ring-min', String(1 - near * 0.55));
    el.classList.toggle('lg-clear', Number(p.opacity) <= 0);

    /* 内缩层的包含块是 padding-box，要把四边 padding 记下来才能顶回 border-box。
     * 直接读运行态 —— CSS 里同选择器有两处定义，硬编码会踩空。 */
    try {
      const cs = window.getComputedStyle(el);
      el.style.setProperty('--lg-pad-t', cs.paddingTop);
      el.style.setProperty('--lg-pad-r', cs.paddingRight);
      el.style.setProperty('--lg-pad-b', cs.paddingBottom);
      el.style.setProperty('--lg-pad-l', cs.paddingLeft);
    } catch (e) { /* ignore */ }

    /* 折射环宽度改变要重建贴图（形状变了），只改 scale 不用。 */
    if (el.dataset.lgBevel !== String(p.bevel)) rebuild(el, p);
    else setDispScaleFor(el, p);
  }

  function setDispScaleFor(el, p) {
    const px = Math.max(0, Number(p.scale) || 0);
    const base = Number(el.dataset.lgBase) || BASE;
    const openBase = Number(el.dataset.lgOpenBase) || BASE;
    setDispScale(el.dataset.lgId, px * (base / BASE));
    setDispScale(el.dataset.lgOpenId, px * (openBase / BASE));
  }

  /** 按当前 bevel 重建贴图与滤镜（保留 id / 尺寸）。 */
  function rebuild(el, p) {
    const w = Number(el.dataset.lgW) || 40;
    const h = Number(el.dataset.lgH) || 40;
    const radius = Number(el.dataset.lgR) || Math.min(w, h) / 2;
    const o = p || loadParams();
    const bevel = clamp((Number(o.bevel) || 32) / 100, 0.04, 0.6);
    if (!el.dataset.lgId) return;
    try {
      const map = buildMap(w, h, radius, { bevel });
      if (!map) return;
      makeFilter(el.dataset.lgId, map, 0);
      const ow = Number(el.dataset.lgOpenW) || 0;
      const oh = Number(el.dataset.lgOpenH) || 0;
      if (ow > 0 && el.dataset.lgOpenId) {
        const orad = Number(el.dataset.lgOpenR) || Math.min(ow, oh) / 2;
        const omap = buildMap(ow, oh, orad, { bevel });
        if (omap) makeFilter(el.dataset.lgOpenId, omap, 0);
      }
      el.dataset.lgBevel = String(o.bevel);
      setDispScaleFor(el, o);
    } catch (e) { /* ignore */ }
  }

  function setDispScale(id, px) {
    if (!id) return;
    const disp = document.querySelector('#' + id + ' feDisplacementMap');
    if (disp) disp.setAttribute('scale', String(Math.max(0, px)));
  }

  function setParams(patch) {
    const next = Object.assign(loadParams(), patch || {});
    try { localStorage.setItem(PARAMS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-liquid-glass="1"]').forEach((el) => applyTo(el, next));
    return next;
  }

  function sdfRoundRect(px, py, w, h, r) {
    const qx = Math.abs(px - w / 2) - (w / 2 - r);
    const qy = Math.abs(py - h / 2) - (h / 2 - r);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /** 高度场斜率 dh/dt：t=0（最外沿）最陡，t=1（进平面）为 0。
   *  h(t) = sin(π/2·t)，h'(t) = (π/2)·cos(π/2·t)。 */
  function heightSlope(t) {
    return (Math.PI / 2) * Math.cos((Math.PI / 2) * t);
  }

  /**
   * 位移贴图：R = 横向偏移，G = 纵向偏移，128 = 不偏移。
   * 先把整场的偏移向量归一化到 [-1,1] 再写 8 位通道，
   * 所以贴图只描述形状，强度完全交给 feDisplacementMap 的 scale。
   *
   * 贴图**连 filter region 一起画**：region 比元素大 20%（见 makeFilter），
   * feImage 默认铺满 region，所以贴图必须按 region 的尺寸出图，
   * 元素形状画在中间 1/1.4 处。否则贴图被拉伸到 region 上，
   * 位移环跑到元素外面 —— 玻璃看起来完全没折射。
   */
  function buildMap(w, h, radius, opts) {
    const o = opts || {};
    const bevelRatio = Number(o.bevel) || BEVEL;
    const ext = Number(o.ext) || REGION_EXT;
    const key = ['v4', w, h, radius, bevelRatio, o.refract || REFRACT, ext].join('|');
    if (MAP_CACHE.has(key)) return MAP_CACHE.get(key);

    const rw = w * (1 + 2 * ext);
    const rh = h * (1 + 2 * ext);
    /* 贴图分辨率跟元素走：边缘只有 14% 短边，2× 超采样，长边上限 512。 */
    const sc = Math.min(2, 512 / Math.max(rw, rh));
    const mw = Math.max(24, Math.round(rw * sc));
    const mh = Math.max(24, Math.round(rh * sc));
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(mw, mh);
    const data = img.data;

    const bevel = Math.max(2, Math.min(w, h) * bevelRatio);
    const eps = Math.max(0.2, Math.min(rw / mw, rh / mh) * 0.75);
    const n = Number(o.refract) || REFRACT;
    const vec = new Float32Array(mw * mh * 2);
    let maxLen = 1e-6;

    /* 第一遍：算物理偏移向量（未归一化）。坐标从 region 换算回元素。 */
    for (let y = 0; y < mh; y += 1) {
      for (let x = 0; x < mw; x += 1) {
        const px = ((x + 0.5) / mw) * rw - w * ext;
        const py = ((y + 0.5) / mh) * rh - h * ext;
        const d = -sdfRoundRect(px, py, w, h, radius); // 正 = 内部
        const i = (y * mw + x) * 2;
        if (d <= 0) { vec[i] = 0; vec[i + 1] = 0; continue; }

        const t = Math.min(1, d / bevel);
        /* 表面斜率 → 入射角 → Snell → 横向位移 tan(θ1-θ2) */
        const th1 = Math.atan(heightSlope(t));
        const sin2 = Math.min(1, Math.sin(th1) / n);
        const th2 = Math.asin(sin2);
        let amount = Math.tan(th1 - th2);
        if (!Number.isFinite(amount) || amount > 6) amount = 6;

        /* 法线方向：圆角矩形 SDF 的梯度（指向外） */
        const gx = (sdfRoundRect(px + eps, py, w, h, radius)
          - sdfRoundRect(px - eps, py, w, h, radius)) / (2 * eps);
        const gy = (sdfRoundRect(px, py + eps, w, h, radius)
          - sdfRoundRect(px, py - eps, w, h, radius)) / (2 * eps);
        const len = Math.hypot(gx, gy) || 1;
        const vx = (gx / len) * amount;
        const vy = (gy / len) * amount;
        vec[i] = vx;
        vec[i + 1] = vy;
        const m = Math.hypot(vx, vy);
        if (m > maxLen) maxLen = m;
      }
    }

    /* 第二遍：归一化写通道。128 + 127·(v/max) ∈ [1,255]，永不溢出。 */
    for (let k = 0; k < mw * mh; k += 1) {
      const o4 = k * 4;
      data[o4] = Math.round(clamp(128 + (vec[k * 2] / maxLen) * 127, 1, 255));
      data[o4 + 1] = Math.round(clamp(128 + (vec[k * 2 + 1] / maxLen) * 127, 1, 255));
      data[o4 + 2] = 128;
      data[o4 + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    MAP_CACHE.set(key, url);
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

  /**
   * 滤镜链只有两步：贴图 → 位移。
   * 高光不在这里做 —— 交给 CSS 双环，因为参考效果的"勾轮廓"是几何亮边，
   * 不是对背景做一次 specular lighting（那会把背后的内容一起点亮）。
   */
  function makeFilter(id, mapUrl, scale) {
    const svg = defsRoot();
    const old = document.getElementById(id);
    if (old) old.remove();
    const filter = document.createElementNS(NS, 'filter');
    filter.id = id;
    /* region 比元素大一圈：位移采样要不越界，结果也不会在边界被裁掉。
       feImage 默认铺满 region —— 贴图就是按这个尺寸生成的（见 buildMap）。 */
    filter.setAttribute('x', (-REGION_EXT * 100) + '%');
    filter.setAttribute('y', (-REGION_EXT * 100) + '%');
    filter.setAttribute('width', ((1 + 2 * REGION_EXT) * 100) + '%');
    filter.setAttribute('height', ((1 + 2 * REGION_EXT) * 100) + '%');
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

    /* 只柔化一点点，把通道量化后的锯齿磨掉，不做磨砂 */
    const blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('in', 'refracted');
    blur.setAttribute('stdDeviation', '0.35');
    filter.appendChild(blur);

    svg.appendChild(filter);
    return id;
  }

  function supportsLiquid() {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) return false;
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
   * @param {{width?:number,height?:number,radius?:number,scale?:number,id?:string,
   *          openWidth?:number,openHeight?:number,openRadius?:number,openId?:string}} opts
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
      const base = Math.min(w, h);
      const p = loadParams();
      const bevel = clamp((Number(p.bevel) || 32) / 100, 0.04, 0.6);
      const map = buildMap(w, h, radius, { bevel });
      if (!map) { el.classList.add('liquid-glass-fallback'); return false; }
      const id = o.id || ('tv-glass-' + Math.random().toString(36).slice(2, 8));
      makeFilter(id, map, p.scale * (base / BASE));
      el.dataset.liquidGlass = '1';
      el.dataset.lgId = id;
      el.dataset.lgBase = String(base);
      el.dataset.lgW = String(w);
      el.dataset.lgH = String(h);
      el.dataset.lgR = String(radius);
      el.dataset.lgBevel = String(p.bevel);
      el.classList.add('liquid-glass');
      el.style.setProperty('--lg-filter', 'url(#' + id + ')');
      el.style.setProperty('--lg-radius', radius + 'px');

      /* 展开态（宽条）单独一张贴图：同一个元素宽度变化时不会被拉伸 */
      const ow = Number(o.openWidth) || 0;
      const oh = Number(o.openHeight) || 0;
      if (ow > 0 && oh > 0) {
        const orad = o.openRadius == null ? Math.min(ow, oh) / 2 : o.openRadius;
        const omap = buildMap(ow, oh, orad, { bevel });
        if (omap) {
          const oid = o.openId || (id + '-open');
          const obase = Math.min(ow, oh);
          makeFilter(oid, omap, p.scale * (obase / BASE));
          el.dataset.lgOpenId = oid;
          el.dataset.lgOpenBase = String(obase);
          el.dataset.lgOpenW = String(ow);
          el.dataset.lgOpenH = String(oh);
          el.dataset.lgOpenR = String(orad);
          el.style.setProperty('--lg-filter-open', 'url(#' + oid + ')');
        }
      }
      applyTo(el, p);
      /* 展开 / 收起会改 padding，动画结束后重新量一次 */
      el.addEventListener('transitionend', (ev) => {
        if (ev.target === el) applyTo(el);
      });
      /* DPR 变了（换屏 / 系统缩放）要重算环宽的物理像素整数倍 */
      if (typeof window !== 'undefined' && !el.dataset.lgDprWatch) {
        el.dataset.lgDprWatch = '1';
        let lastDpr = window.devicePixelRatio || 1;
        window.addEventListener('resize', () => {
          const d = window.devicePixelRatio || 1;
          if (d !== lastDpr) { lastDpr = d; applyTo(el); }
        });
      }
      return true;
    } catch (e) {
      el.classList.add('liquid-glass-fallback');
      return false;
    }
  }

  TV.glass = {
    install,
    buildMap,
    getParams: loadParams,
    setParams,
    defaults: DEFAULT_PARAMS,
    /* 暴露给测试/校验：物理量本身 */
    REFRACT,
    BEVEL,
    BASE,
    heightSlope,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.glass;
})(typeof globalThis !== 'undefined' ? globalThis : this);
