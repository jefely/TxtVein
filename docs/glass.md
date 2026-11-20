# TxtVein 液态玻璃折射设计

> 版本：v2.7.0
> 参考：用户 2026-11 提供的液态玻璃教程视频
> 实现位置：[`js/ui/glass.js`](../js/ui/glass.js) · [`css/ledger.css`](../css/ledger.css) · [`css/paper.css`](../css/paper.css)

## 1. 设计目标

不是给按钮加一层半透明白底，而是让悬浮输入胶囊**真的折射背后的文字**：

- 收起时是一个 40×40 的圆角玻璃钮；
- 展开时是同一个元素的宽度过渡到 340px；
- 圆钮和展开条共用一张「胶囊」玻璃，不再分成两个控件；
- 折射强度、不透明度、高光、阴影、模糊都可调；
- 不支持 `backdrop-filter: url(...)` 或低端设备自动退回普通毛玻璃。

## 2. 为什么用位移贴图

教程里的核心是三步：

```text
算偏移 → 存成图 → 交给浏览器
```

浏览器能直接做背景采样的是 `backdrop-filter`，但它只接受滤镜函数或 SVG 滤镜引用。于是：

1. 用圆角矩形的 SDF 求法线；
2. 把横向/纵向偏移编码进一张贴图：
   - `R = 横向偏移`
   - `G = 纵向偏移`
   - `128 = 不偏移`
3. 用 `feImage` 把贴图喂给 `feDisplacementMap`；
4. 元素用 `backdrop-filter: url(#filter)` 取折射结果。

这比普通 `blur()` 多了一个关键东西：**边缘会按法线方向推开背景像素**，所以文字经过玻璃边缘时会弯折，而不是只变糊。

## 3. 贴图生成

代码：[`js/ui/glass.js`](../js/ui/glass.js) 的 `buildMap()`。

- 贴图尺寸：`maxSide = 96`，按元素长宽比缩放；
- 圆角形状用 `sdfRoundRect()`；
- 内部距离 `d` 决定斜面位置；
- 法线用中心差分求：

```text
gx = (sdf(x+ε) - sdf(x-ε)) / 2ε
gy = (sdf(x,y+ε) - sdf(x,y-ε)) / 2ε
```

- 只在边缘一圈做折射，中心保持 `128`，所以中间的文字不会整体扭曲；
- 输出 `canvas.toDataURL('image/png')`，按「宽 × 高 × 圆角」缓存。

第一版刻意保持 96px：贴图只生成一次，成本低；放大到 54px 时折射足够，边缘也不会因为过高分辨率产生额外采样噪声。

## 4. 滤镜链

代码：[`js/ui/glass.js`](../js/ui/glass.js) 的 `makeFilter()`。

```text
feImage(位移贴图)
  → feDisplacementMap(scale = 用户 scale, R→x, G→y)
  → feGaussianBlur(stdDeviation = 0.22)
  → 输出
```

元素：

```css
backdrop-filter: url(#tv-lg-composer) blur(var(--lg-blur, 0px)) ...;
```

- 圆钮：`tv-lg-composer`，40×40、radius 12；
- 展开条：`tv-lg-composer-open`，340×40、radius 12；
- 展开时用 `--lg-filter-open` 切到宽条贴图，避免把圆形贴图拉成椭圆。

## 5. 融合胶囊

[`js/ui/app.js`](../js/ui/app.js) 的 `bindComposer()` 把玻璃装在**整个 `.composer`** 上：

```text
.composer
├── .composer-inner
│   └── .entry-row（输入框，透明）
└── .composer-toggle（VE，透明/主题色）
```

收起 40×40，展开 340×40，背景、边框、内阴影、高光都只有一层；内部文字和按钮不再各自带玻璃。

> 注意：`.liquid-glass` 不能加 `position: relative/absolute`，否则会覆盖 `.composer` 的 `position: fixed`，按钮会跑到屏幕外。

## 6. 参数

设置入口：**设置 → 液态玻璃**。

| 参数 | CSS 变量 | 默认 |
|---|---|---|
| 不透明度 | `--lg-alpha` | 12% |
| scale | `feDisplacementMap@scale` | 14 |
| 高光亮度 | `--lg-highlight` | 60% |
| 阴影范围 | `--lg-shadow` | 80% |
| 背景模糊 | `--lg-blur` | 0px |

存在本机 `txtvein.glass.v1`，不写进账本。

- 不透明度 0% 时 `lg-clear` 只保留折射，清掉填充/边框/阴影；
- 背景模糊为 0 时就是教程里的「透明折射」；
- 把模糊拉到 8–12px 会变成磨砂厚玻璃，和视频不是同一种质感。

## 7. 电纸书主题

纸主题不是把深色玻璃反色，而是：

- 胶囊底色改为纸色 + 主题色淡染；
- 高光/阴影降低对比；
- 背景模糊仍读取同一个滑块；
- `liquid-glass.lg-clear` 在纸主题下同样清填充，保留折射。

## 8. 降级与性能

`supportsLiquid()` 检查：

- `CSS.supports('backdrop-filter', 'url(#...)')`；
- `navigator.hardwareConcurrency > 4`；
- `prefers-reduced-transparency` 不为 reduce；
- 不支持时加 `.liquid-glass-fallback`，用 `blur(14px)`。

贴图按尺寸缓存，只生成一次；滤镜只作用于 40×40 / 340×40 的悬浮元素，不参与整页渲染。

## 9. 已知限制

- 这是 **CSS 屏幕空间折射**，不是 3D 厚玻璃；
- 没有真实折射率、厚度、菲涅耳高光；
- 54px 圆形上 1px 硬描边会出现阶梯感，所以第一版用 96px 贴图 + 0.22px 边缘模糊，不再叠加 conic/mask 硬高光线；
- 浏览器对 `backdrop-filter` 边缘的采样仍可能有极细白边，属于合成器行为；
- 如果需要视频里那种厚透镜的中央暗部 + 边缘强折射，需要 WebGL 渲染，而不是 `backdrop-filter`。

## 10. 验收

- 圆钮和展开条是同一个 `.composer`，没有两个独立玻璃面；
- 拖动参数时折射/透明度即时变化；
- 刷新后参数保留；
- 不支持的环境显示毛玻璃，而不是空白；
- `node tools/build.cjs`、260 项 Node 测试、181 项门禁、主 E2E 全绿。
