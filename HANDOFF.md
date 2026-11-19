# TxtVein 交接文档

> 更新时间：2026-11-19
> 当前版本：**v2.4.2**
> 软件提交：`7e7f05b`（本文档的后续提交只含交接说明）
> 仓库：https://github.com/jefely/TxtVein.git
> 线上：https://jefely.github.io/TxtVein/TxtVein.html

---

## 1. 这一版做了什么

### 行号交互

- 流水表和字典都支持：
  - 点一次行号：选中该行，灰底，弹出横排菜单；
  - 再点同一行号：取消选中并收起菜单；
  - 点另一行：切换到新行。
- 菜单项：删除 / 剪切 / 复制 / 粘贴 / 插入 / 上移。
- 手机：
  - 整条行号栏都可轻点，不要求点中数字；
  - pointer 事件识别轻点；
  - 位移 ≤ 12px 才开菜单，超过当滚动；
  - 拖动不会误弹菜单。

### 流水页滚动

- 进入流水页时，把**最后 10 行**放到视口顶部，只执行一次。
- 删除行：
  - 记录删除前 `scrollTop`；
  - 删除后恢复；
  - 不再出现“先跳到底部，再回到最后 10 行”。
- 末尾留白：
  - 30 行高的 line widget；
  - 背景 `#050505`，深灰，不和最后一行灰白连成一片；
  - 不占行号；
  - **只在行数变化时重挂**，不会每次编辑都触发重排滚动。

### 多层组合输入（v2.4.0）

完整规范见 [`docs/multi-input.md`](docs/multi-input.md)。要点：

- `wx > s zc dt 3 3 2.5` → 3 条。
- `1 2 *` → 循环 `1, 2, 1`。
- `1 2*` → 首笔 1，其余 2。
- `100/` → 均摊。
- `1 9/` → 首笔 1，剩余均摊 9。
- `1 9*` → 首笔 1，剩余全部 9。
- `*d/*m/*y` → 当前笔 + 固定表新增周期计划。
- 金额阶段提示：`金额 2/4 · 可 * 循环 / 100/ 均摊`。
- 批量失败整批不落账。

---

## 2. 当前实现位置

| 功能 | 文件 |
|---|---|
| 行号选中/取消、菜单、删除滚动恢复 | `js/ui/editor.js` |
| 末尾留白 widget / 深色 | `js/ui/editor.js` + `css/editor.css`（`.cm-tail-pad`） |
| 进入流水最后 10 行 | `js/ui/editor.js` 的 `scrollToTail` |
| 批量语法/金额/计划 | `js/core/source.js`、`js/ui/app.js` |
| 组合输入规范 | `docs/multi-input.md` |
| 版本记录 | `CHANGELOG.md` |

### 末尾留白的关键约束

不要重复以下失败方案：

1. `.CodeMirror-sizer::after`：不计入 CodeMirror 滚动高度。
2. `.CodeMirror-sizer { margin-bottom: 600px }`：浏览器 scrollHeight 会增加，但 CodeMirror 刷新后按旧高度 clamp 回 1468。
3. `.CodeMirror-scroll { padding-bottom: 600px }`：clientHeight 也会变大，视口被破坏。
4. 每次 `changes` 都重挂 tail widget：会触发滚动。
5. 60ms 防抖重挂 widget：会“先跳再回来”。

当前方案：line widget + 只在 `lineCount()` 变化时 `syncTailPad`；删除时恢复 `scrollTop`。

---

## 3. 验证状态

```text
TxtVein.html              1,236.4 KB
Node 测试                 230 pass / 0 fail
门禁                     176 pass / 0 fail
主 E2E                   91 pass
v4 E2E                   62 pass
```

本轮实测：

- 进入 100 行流水：`top=2010`，视口首行第 91 行（最后 10 行置顶）。
- 删除最后空行：`top=2010`，差值为 0。
- 16ms 间隔采样 63 次：`top` 全部 2010，无跳变。
- 行号点两次：菜单 6 → 0，选中 class 2（两个 gutter）→ 0。
- 流水和字典都测过。

### 验证命令

```powershell
cd D:\myproject\TxtVein
node tools/build.cjs
node --test tests/*.test.cjs
node tools/check.cjs
$env:TXTVEIN_URL='file:///D:/myproject/TxtVein/index.html'
python tools/e2e.py
python tools/e2e_v4.py
```

---

## 4. 还需要在真机确认

1. GitHub Pages 是否已部署到 v2.4.2（帮助页底部版本）。
2. 手机上删除最后空行，是否**全程无上下位移**（不是跳完再回来）。
3. 末尾留白是否已是深灰 `#050505`，和最后一行明显分开。
4. 流水/字典行号：
   - 点一次选中并弹菜单；
   - 再点同一行取消；
   - 拖动行号栏只滚动。
5. 如果最后一行 active line 的灰色背景仍然让它和留白看起来连在一起：
   - 可在 `.CodeMirror-activeline-background` 上避开空行；
   - 或把留白改为更接近页面底色的 `#0b0b0b`。

> 用户口头说“20 行空行”，但实现保留 30 行。原因：手机视口约 35 行，只有留白 ≥ 25 行左右，才可能把最后 10 行顶到视口顶部；20 行会导致最后 10 行顶不到最上面。若用户坚持 20 行，需要接受最后 10 行无法完全置顶。

---

## 5. 发布流程

当前已推 v2.4.2；后续若继续改：

1. 改 `package.json`、`js/core/version.js`、`sw.js`、`index.html` meta、README 徽章、STATUS 标题。
2. 更新 `CHANGELOG.md`。
3. `node tools/build.cjs`。
4. 跑全量测试。
5. commit → push main → `git tag -a vX.Y.Z` → push tag。

Git 注意：

- `local/` 是私人账本，已加入 `.gitignore`，不要提交。
- 截图、`_tmp_cdp_profile*`、临时文件不要进仓库。
- 仓库是公开的；`docs/private-dict-v4.sample.*` 是测试样例，包含节点名，提交前留意隐私。

---

## 6. 下一步可选

- 把行号菜单的“选中”做成可键盘操作（↑↓ 选择、Enter 执行）。
- 行号菜单在窄屏改为底部动作条，避免遮挡。
- 末尾留白行数做成设置项（默认 30）。
- 增加真机触摸的 E2E 回归（目前是 CDP 触摸模拟）。
