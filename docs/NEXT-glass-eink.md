# 下一步任务：液态玻璃按钮 + TxtVein 电纸书主题

> **2026-11-21 已完成并发布 v2.7.0。** 现行实现是 96px 第一版折射；设计说明见 [glass.md](glass.md)。以下 320 / 3×3 高斯磨边是中间实验记录，已不再采用。

> 建立时间：2026-11-20
> 触发：用户提供了液态玻璃教程视频，要求把玻璃质感加到 NT 账本的单输入框悬浮按钮；
> 若性能可接受，同步到 TxtVein；TxtVein 还要一个电纸书质感主题。
> 本文是**未完成工作的交接**，不是完成报告。
>
> **2026-11-20 本轮更新**：玻璃已扩到两个应用的展开输入条，染色改为中性冷白，
> 位移贴图 96 → 320 并加 3×3 高斯磨边；TxtVein 电纸书主题第一版已落地
> （设置 → 主题 → 电纸书）。**仍缺：NT 应用内目视验证、真机玻璃/纸主题打磨、提交上传。**
>
> 纸主题收尾：新增 `css/paper.css`（最后加载），专门压住 `editor.css` 里后出现的
> `#050505` 规则；页签条/选中页签、编辑器底部空高、查询页、统计中缝、反馈条都已改纸色。
>
> **再更新**：TxtVein 的圆钮和展开条已合成**同一个 `.composer` 胶囊**（40px ↔ 340px
> 宽度过渡，玻璃只装在胶囊上），不再像两个独立控件叠加。两个软件的布局/设置页
> 都加了 5 个玻璃滑块：不透明度 / scale / 高光亮度 / 阴影范围 / 背景模糊；
> TxtVein 在「设置 → 液态玻璃」，NT 在「设置 → 布局」调试面板底部，值存本机。

---

## 0. 参考

- 视频：`C:\Users\Administrator\Desktop\新建文件夹\e882eec68cd287cc1c9f105091684daa.mp4`
- 视频内容（4m14s，960×448）：液态玻璃的三步实现
  1. 生成**位移 / 法线贴图**：R = 横向偏移，G = 纵向偏移，128 = 不偏移；
  2. 存成图片，交给 SVG `feImage`；
  3. `feDisplacementMap` + `backdrop-filter: url(#liquidGlass)` 让浏览器折射背景。
  另加：`feBlend mode="screen"` 高光、外阴影、可选背景模糊。
  视频里参数：不透明度 26%、scale 60、高光 50%、阴影 80%、背景模糊 0。
- 视频帧抽取（临时脚本，需要时重跑）：

```python
import av
c = av.open(video_path)
vs = c.streams.video[0]
c.seek(int(t / float(vs.time_base)), stream=vs)
frame = next(f for f in c.decode(vs) if f.time and f.time >= t - 0.5)
frame.to_image().save(out_png)
```

---

## 1. 已经写了什么（工作区未提交）

### 1.1 TxtVein

| 文件 | 改动 |
|---|---|
| `js/ui/glass.js` | 新增。生成圆角矩形位移贴图（320px，缓存；3×3 高斯磨边）；创建 `<svg id="tv-glass-defs">` + `feImage/feDisplacementMap`；`TV.glass.install(el, opts)`；支持 `openWidth/openHeight/openId` 生成展开态宽条贴图；Chrome 157 实测 `backdrop-filter: url(#...)` 生效；不支持 / `hardwareConcurrency <= 4` / `prefers-reduced-transparency` 时退回毛玻璃 |
| `index.html` | 在 `js/ui/app.js` 前引入 `js/ui/glass.js` |
| `js/ui/app.js` | `bindComposer()` 里给 `#composer-toggle` 装玻璃：40×40、radius 12、scale 14、id `tv-lg-composer`；再给展开条 `.entry-row` 装玻璃：340×40、radius 8、scale 12、id `tv-lg-bar` |
| `css/ledger.css` | 末尾追加 `.liquid-glass` / `.liquid-glass-fallback` / `.entry-row.liquid-glass` 的样式；玻璃使用**中性冷白**（不再混绿色主色）；圆钮和展开条各有高光、内阴影、外阴影 |

已验证：

- `node tools/build.cjs` → `TxtVein.html 1,359.7 KB`（48 JS）。
- `node --test tests/*.test.cjs` → 260 pass / 0 fail。
- `node tools/check.cjs` → 181 pass / 0 fail。
- Chrome 157：`CSS.supports('backdrop-filter','url(#x)') = true`；
  `#composer-toggle` 的 `backdrop-filter` 为 `url("#tv-lg-composer") saturate(1.25) brightness(1.03)`，
  展开后 `.entry-row` 为 `url("#tv-lg-bar") saturate(1.25) brightness(1.03)`；
  `#tv-glass-defs filter` 数量 = 2；圆钮 40×40、展开条 340×40，均完全在视口内。
- 截图观感：深色主题下是「烟熏玻璃珠 / 玻璃条」——中性冷白，不再有绿色染色；
  背景是纯黑编辑器，折射看不出来；拖到有文字/彩色区域时才会看到折射。
- 主 E2E 已过；贴图从 96 提到 320，并做 3×3 高斯磨边，边缘锯齿应明显减轻（需真机复核）。

**注意**：`liquid-glass` 初版误加过 `position: relative`，会把 `.composer-toggle` 的 `absolute`
覆盖掉、按钮跑到屏幕外；已删除。**不要再给 `.liquid-glass` 加 position。**

### 1.2 NT 账本

| 文件 | 改动 |
|---|---|
| `js/ui/liquid-glass.js` | 新增 ES module：同样的 320px 贴图 + 3×3 磨边 + SVG 滤镜 + `installLiquidGlass(el, opts)`；支持 `openWidth/openHeight/openId` 生成展开宽条滤镜；返回是否启用；低端/不支持时 `liquid-glass-fallback` |
| `js/views/flow.js` | `import { installLiquidGlass } from '../ui/liquid-glass.js'`；`mountComposer` 后给 `composer.bar`（`.nt-composer`，54×54 圆形）装玻璃：radius 27、scale 18、id `nt-lg-composer`；展开态 360×54、id `nt-lg-composer-open` |
| `css/flow.css` | 末尾追加 `.nt-composer.liquid-glass` / `.open` / `.liquid-glass-fallback` 样式；收起和展开都是**中性冷白玻璃**（不再混主色），展开使用宽条贴图而不是 blur |

已验证：

- `node --check`（复制成 `.mjs` 检查）`liquid-glass.js` / `flow.js` 均通过。
- 独立测试页（已删除）：Chrome 157 中 `backdrop-filter: url(#test-glass)` 生效，
  54px 圆形玻璃后的 “Glass” 文字出现明显折射/放大；说明滤镜链路是通的。
- **未在 NT 应用内目视验证**：NT 要过门禁 / IndexedDB，当前上下文不够跑完整登录。

---

## 2. 下一步：先验证 NT 玻璃

1. 用本地 HTTP 服务打开 NT（ES module 需要 HTTP，不能 file://）：
   ```powershell
   cd D:\myproject\money-way\nt
   python -m http.server 8765
   ```
   浏览器打开 `http://127.0.0.1:8765/index.html`，设密码 / 进入示例账本。
2. 检查流水页右下角 `.nt-composer`：
   - 收起：应有中性冷白玻璃、白边、高光、外阴影，NT 字清楚；
   - 拖动到文字/彩色区域：边缘应有折射；
   - 展开：应变成宽条玻璃（`nt-lg-composer-open`），输入框文字清楚；
   - 四套主题（light/alt1/dark/alt2）都看一遍；深色主题下玻璃不要变成纯黑。
3. 调参：
   - `scale` 18 对 54px 可能偏强；视频里 60–98 是给大玻璃的，若文字扭曲太厉害降到 10–14。
   - 玻璃色已是中性冷白（`rgba(255,255,255,.13/.16)`），不再跟主色走；浅色主题若太淡，
     提高白色 alpha 到 .18–.22，深色主题可降到 .10。
   - 低端机：`hardwareConcurrency <= 4` 会走 fallback；如仍卡，增加 `max-width: 760px` 直接 fallback。
4. 性能：
   - 只对 54px 元素跑滤镜；贴图 96px、缓存，不随滚动重建；
   - 滚动时 `backdrop-filter` 会重采样，观察 NT 流水长表滚动是否掉帧；
   - 若明显掉帧，移动端直接 `liquid-glass-fallback`（blur 更便宜）。

---

## 3. TxtVein 电纸书主题（第一版已做，待打磨）

目标：暖纸底、墨色字、无发光/无玻璃、低饱和；不是简单反色。

### 3.1 偏好与设置

`js/ui/panels.js`：

- `DEFAULT_PREFS` 增加 `theme: 'paper' | 'dark'`，默认 `'dark'`；
- `loadPrefs` 读取并校验；
- `applyPrefs`：
  ```js
  document.documentElement.dataset.theme = p.theme === 'paper' ? 'paper' : 'dark';
  ```
  并更新 `<meta name="theme-color">`（paper `#f3efe3` / dark `#06070A`）。
- **关键**：现在 `applyPrefs` 把 8 个 `--tv-*` 颜色写成 inline style；
  电纸书主题需要覆盖它们，二选一：
  1. paper 时**移除**这些 inline 属性，让 CSS `html[data-theme="paper"]` 里的墨色变量生效；
  2. paper 时写入一套纸墨默认值（用户自定义颜色只在 dark 生效）。
  推荐 1，切回 dark 时重新 apply 用户颜色。
- 设置面板加「主题」行（深色 / 电纸书），保存后 `applyPrefs` + `app.refreshEditors()`。

### 3.2 CSS 变量

在 `base.css` 末尾加：

```css
html[data-theme="paper"] {
  --bg:#f3efe3; --bg-1:#f7f3e8; --bg-2:#efeadc; --bg-3:#e9e3d4;
  --line:rgba(70,62,48,.16); --line-strong:rgba(70,62,48,.30);
  --text:#2b2924; --text-2:#4a463d; --text-3:#6c665a; --dim:#8a8273; --date:#8a8375;
  --a:#2f5d50; --b:#8a5a32; --op:#6b6558; --tag:#5f5a4e;
  --accent:#3f6b52; --accent-dim:rgba(63,107,82,.12);
  --err:#8a3f3f; --err-dim:rgba(138,63,63,.10);
  --shadow:none;
  --tv-date:#7a4a20; --tv-node:#2f5d50; --tv-amount:#3f5f3f; --tv-note:#6b6558;
  --tv-operator:#4a463d; --tv-linenumber:#8a8273; --tv-invalid:#8a3f3f; --tv-lineerror:#a04a2a;
}
html[data-theme="paper"] body {
  background-color:#f3efe3; color:var(--text);
  background-image: radial-gradient(rgba(90,80,60,.035) 1px, transparent 1px);
  background-size: 3px 3px;
}
html[data-theme="paper"] body::before { display:none; } /* 去掉深色网格 */
```

### 3.3 CodeMirror

`editor.css` 里 `.cm-s-txtvein` 有大量 `!important` 深色 token 色（约 762 行起）。
需要**同等或更高优先级**覆盖：

```css
html[data-theme="paper"] .cm-s-txtvein.CodeMirror { background:#f7f3e8; color:#2b2924; }
html[data-theme="paper"] .cm-s-txtvein .CodeMirror-gutters { background:#efeada; border-right-color:#d9d2c2; }
html[data-theme="paper"] .cm-s-txtvein .CodeMirror-linenumber { color:#8a8273; }
html[data-theme="paper"] .cm-s-txtvein .CodeMirror-cursor { border-left-color:#2b2924; }
html[data-theme="paper"] .cm-s-txtvein .CodeMirror-selected { background:#ddd5c2 !important; }
html[data-theme="paper"] .cm-s-txtvein .cm-comment { color:#6b6558 !important; }
html[data-theme="paper"] .cm-s-txtvein .cm-number,
html[data-theme="paper"] .cm-s-txtvein .cm-atom { color:#7a4a20 !important; }
html[data-theme="paper"] .cm-s-txtvein .cm-variable,
html[data-theme="paper"] .cm-s-txtvein .cm-variable-2,
html[data-theme="paper"] .cm-s-txtvein .cm-def { color:#2f5d50 !important; }
html[data-theme="paper"] .cm-s-txtvein .cm-keyword,
html[data-theme="paper"] .cm-s-txtvein .cm-tag,
html[data-theme="paper"] .cm-s-txtvein .cm-string { color:#6a4f2a !important; }
html[data-theme="paper"] .cm-s-txtvein .cm-error { color:#8a3f3f !important; }
```

### 3.4 面板 / 顶部 / 统计 / 固定

这些区域很多写死 `#050505/#0b0b0b/#111`，只改变量不够。需要逐块覆盖：

- `.topbar`、`.tabs`、`.tab.is-active`、`.hud`、`.btn`、`.chip`；
- `.modal-panel`、`.modal-head`、`.modal-foot`、`.toast`；
- `.editor-pane`、`.CodeMirror`、`.cm-tail-pad`（空白留白背景改成纸色）；
- `.composer`、`.entry-row`、`.composer-toggle`（paper 下玻璃关闭，做成墨色纸按钮）；
- 固定页 `.fixed-head/.fixed-note/.fixed-editor/.fixed-summary/.fixed-errors`；
- 统计 `.stats-page/.stats-top/.stats-tabs/.lst-group/.sd-row/.sd-row.is-head/.sd-row.is-total/.stats-right`；
- 报表/公共归属卡片。

一律用 `html[data-theme="paper"]` 前缀 + `!important` 盖过写死色；
统一 `box-shadow:none; text-shadow:none; backdrop-filter:none`。

### 3.5 玻璃在电纸书主题下

```css
html[data-theme="paper"] .composer-toggle.liquid-glass,
html[data-theme="paper"] .composer-toggle.liquid-glass-fallback {
  background:#e9e3d3 !important;
  background-image:none !important;
  -webkit-backdrop-filter:none !important;
  backdrop-filter:none !important;
  color:#2b2924 !important;
  border-color:#b9b09c !important;
  box-shadow:0 2px 6px rgba(40,35,25,.12) !important;
  text-shadow:none !important;
}
```

### 3.6 验证

- 设置切「电纸书」→ 刷新 → 主题保持；
- 流水页/字典页 CodeMirror 可读，行号/错误行/选中行正常；
- 固定页、统计页、查询页、母树页、模态框无黑块；
- 玻璃按钮变成纸墨按钮，不再跑 SVG 滤镜；
- `node tools/build.cjs`、260 tests、181 gate、e2e/e2e_v4 全绿；
- 截图对比深色 / 电纸书。

---

## 4. 收尾

- 版本：玻璃 + 电纸书主题建议 `v2.7.0`；NT 侧单独记录/提交。
- 文档：补 `docs/glass.md` / `docs/theme-paper.md`，更新 `HANDOFF`、`CHANGELOG`、`README`、`STATUS`。
- 上传：TxtVein `main` + tag；NT 仓库按它自己的发布流程。
- 当前 TxtVein `TxtVein.html` 已用玻璃 + 电纸书主题 + 融合胶囊 + 滑块构建（1,353.2 KB）；
  260 tests / 181 gate / 主 E2E 全绿；**NT 未目视验证，纸主题待真机打磨**。
- 本次改动未 commit / push。
