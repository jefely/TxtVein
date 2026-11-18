# TxtVein · 现状快照

> 快照时间：**2026-11-15**。  
> 一句话：后台 ID 图是唯一数据事实；`ledger.tv` / `dict.tv` 是 CM5 源码编辑器里的投影与手稿；错误行是 `X_` 纯文本占位，不计算但不丢失。

---

## 一、这是什么

**TxtVein（文脉）v2.4.1**：纯文本、无分录、双极图论账本，外加备注层和行为层。

- 会计层：`N_` 节点 + `E_` 原子边，进 A/B 余额。
- 备注层：`T_` 标签 + `X_` 备注/错误/注释，两级统计，不进余额。
- 行为层：`H_` 行为项 + `B_` 原子边，强度统计，不进余额。
- 一条源码行可展开多条原子边：`微信 > 晚餐 > 开心 120 1` → `E_` + `B_`。
- 编辑器：CodeMirror 5（本地 vendor，MIT），行号、高亮、lint、补全、运算符工具条。
- 单文件成品 `TxtVein.html` 双击即开；本地保险库 AES-GCM-256。

---

## 二、位置

```text
D:\myproject\TxtVein\
├─ TxtVein.html          1071.4 KB 单文件成品（内置 Cascadia Code 字体）
├─ index.html            开发入口
├─ css/ (5)              base / ledger / report / panels / editor
├─ js/core/ (26)         text/system-dict-core/system-dict/user-dict/
│                        tree-view/anchor/public-report/suggester/
│                        text-bundle/nt-bridge/
│                        amount/date/dict/ids/parser/source/calc/
│                        domain/rules/report/ledger-file/dict-file/
│                        crypto/envelope/example/legacy
├─ js/browser/ (2)       store / files
├─ js/ui/ (8)            dom/gate/editor/panes/report-view/input/panels/app
├─ vendor/codemirror/    CM5 + hint/lint/matchbrackets/active-line
├─ tests/ (21 个文件)     205 条 node --test
├─ tools/                build / check / cdp / e2e / smoke_file
├─ docs/screens/         01-editor / 02-report / 03-invalid / 04-mobile /
│                        06-tree / 07-candidates / 08-tree-edit
├─ dev.cmd / stop-dev.cmd 本地 8899 调试
└─ README / STATUS / HANDOFF / NEXT / DEBUG / LICENSE
```

---

## 三、当前状态

| 项 | 现状 |
|---|---|
| 单文件 | `TxtVein.html` **1071.4 KB**；零外链、零 CDN；字体 base64 内嵌 |
| 数据事实 | 后台 ID 图；编辑器文本是投影 + 手稿；ID 不出现在 UI |
| 源码编辑器 | 流水 `ledger.tv` / 字典 `dict.tv` 双 CM5；行号、高亮、单波浪线（只标出错 token）、补全、运算符工具条 |
| 相对日期 | 输入框 `-1/-2` 提交时固化；直接编辑在日期 token 后按空格立即固化；`0/+1` 同理 |
| 母树 / 子树 | 母树数据层 + v3 保险库 + P/C 拆分 + `[树]` 纯文本树 + 锚点 + 公共报表 + 本地建议器 + `weight/pin` 重构；导入导出支持文本粘贴/复制（明文 / TxtVein 密文 bundle / NT 明文 / NT 加密备份兼容导入） |
| 时间单位 | `d/h/m`：`1d=1440m`、`1h=60m`；输入 `1d2h30m`，后台存整数分钟 `1590`，`ledger.txt` 写 `1590m`，界面显示 `1d2h30m` |
| 后台单位 | 金额只存整数分 `amountCents`；时间只存整数分钟 `minutes`；行为强度只存整数 `weight` |
| 账本域 | 顶部域栏已移除；所有流水同一列表；不写域即 `P`，只有显式写 `F`/`C`/`H` 才记录对应域 |
| 界面 | 高对比深黑；字号 15px / 编辑器 14px；字体栈 Cascadia Code + 内置 CascadiaCode.woff2 |
| 页签 | 查询 / 流水 / 字典 / 母树 / 固定 / 统计；顶栏菜单只放 导入/导出/设置/帮助/掩码/语言 |
| 反馈 | 输入框上方反馈栏；输入改成右下角可拖动 TV 气泡，点击展开单输入框 |
| 输入宏 | 输入框与编辑器都支持双击 `>`、三击 `<`；候选支持 `1 2 3`、鼠标点击、单击空格确认；缺省今日、域=P |
| 4 态 | 编辑区可切掩码/明文 × 中/英；错误行原样保留，合法行重投影；跨域自动补 `P:`/`C:` 前缀 |
| 会计 | `E_` 只认合法流水；双极平账、链式、时间代币、跨域、周期规则仍可用 |
| 备注 | `X_` 备注行 + `T_` 标签；两级统计（归属分类 → 关键字）；未知标签自动建 |
| 行为 | `H_` 行为项树 + `B_` 行为边；`看电影 > 开心 1`；强度任意正整数；不进 A/B |
| 叠加 | `微信 > 晚餐 > 开心 120 1` → 会计 + 行为两条原子边；同 code 双角色 |
| 错误行 | 输入失败先落 `X_` 纯文本，并让单输入框进入「第 N 行待修复」；改完回车替换，不弹窗、不抢光标 |
| 字典候选 | 未知节点只进候选，不自动建；顶部「候选」弹窗确认后建会计节点/行为项；一次事务写 ID 图并重编译 |
| 树编辑 | 报表行为树/备注树节点可点：重挂父级、合并；合并后引用改指目标，旧 code 保留别名 |
| 明文单文件校验 | 导出前重读并比对流水/行为/节点/标签/行为项/备注/错误行数量；检查段落齐全、无后台 ID 泄露 |
| 自动生成 | 备注标签自动；行为项自动（另一端已是行为项，或会计节点补行为角色）；会计节点只提议 |
| 报表 | 双极四列 + 能量审计 + 时间 + 链式因果 + 顶部行为/备注统计 + 行为树/备注树 |
| 存储 | localStorage 加密保险库；PBKDF2 150k → AES-GCM-256；CAS 防多标签覆盖 |
| 测试 | **230** Node · **176** 门禁 · **91 + 61** E2E · 单文件冒烟通过 |
| 字典 v4 | **已实施**：节点级固定绑定 / 无损转换 / 整页母树（点选绑定） / 同支推荐 / 语义校验 / 语义染色 / 录入流（编辑器同源 / 修正模式按波浪线启用 / 输入框收窄 / 自动别名不落盘 / v4 不自动建行为项 / 颜色与字号可配 / 改字典按 ID 重投影流水）；待打磨拖拽与状态栏计数 |

最近验证（2026-11-18）：

```text
node tests/*.test.cjs（沙箱下逐个运行）   223 pass / 0 fail
node tools/build.cjs                     TxtVein.html 1,233.3 KB
node tools/check.cjs                     176 pass / 0 fail
python tools/e2e.py    (file://)         91 pass / E2E PASSED
python tools/e2e_v4.py (file://)        61 pass / E2E v4 PASSED
```

> 沙箱下 E2E 能跑的原因：`tools/cdp.py` 把 Chrome 的 stdout/stderr 重定向到
> `%TEMP%\txtvein-chrome.log`（DEVNULL 会让 debug port 起不来）。

最近验证（2026-11-16）：

```text
node --test tests/*.test.cjs    205 pass / 0 fail
node tools/check.cjs            172 pass / 0 fail
python tools/e2e.py             71 pass / 0 fail
python tools/smoke_file.py      setup + render + reload unlock；manifest CORS 为 file:// 既有警告
```

最近验证（2026-11-15）：

```text
node --test tests/*.test.cjs    198 pass / 0 fail
node tools/check.cjs            158 pass / 0 fail
python tools/e2e.py             56 pass / 0 fail
python tools/smoke_file.py      setup + render + reload unlock, 0 runtime errors
```

---

## 四、这一版落地的关键结构

```text
js/core/ids.js        N_/T_/H_/X_ 8 hex；E_/B_ 12 hex；查重
js/core/dict-v4.js    私有字典 v4：逗号列 / 缩进三层 / 用户统计分类 / [母树] 节点绑定 / tokens / v3 转换
js/core/source.js     dict.tv 四段编译；ledger 一行多原子边；
                      备注 X_、行为 B_、错误 X_；双角色 N_↔H_
js/ui/editor.js       CM5 双文件、模式、lint、hint（工具条/状态栏已隐藏）
js/ui/app.js          S 状态；compileSources 单一编译入口；
                      projectEditorSource 4 态投影；对话框写源码
js/core/calc.js       只消费 E_；行为/备注结构隔离
```

**唯一状态**：`S = { dict, events, behaviors, notes, plans, rules, ledgerSource, dictSource, vaultId, domain, mode, lang, view, range, ... }`。

**唯一编译入口**：`compileSources()` → `TV.source.compileAll(dictSource, ledgerSource)` → `S.dict/events/behaviors/notes/diagnostics` → `renderAll()` → `scheduleSave()`。

**唯一输入入口**：对话框 `submitEntry()` 把一行写进 `ledger.tv`，再走同一编译器；失败也保留为 `X_`。

---

## 五、不能回退的决定

1. **ID 图是数据事实；编辑器文本不是事实**。错误行是 `X_` 纯文本，不计算。
2. **错误行仍然有 ID**，但用独立 `X_` 命名空间；`E_` 只放合法会计边。
3. **行为项只有一种 `H_`**；身体/心理只是字典树的分支，不是枚举。
4. **一条源码行可展开多条原子边**，每条独立 ID、独立诊断。
5. **运算符固定**；字典可扩充，运算符不开放新语义。
6. **会计节点不静默创建**；备注标签和行为项可自动，会计节点必须提议 + 确认。
7. **明文单文件已接**；结构：统计 → 流水 → 行为 → 备注 → 字典明文（无 ID 附录）。
8. **UI 不展示 ID**；`X_`/`E_`/`B_` 都只在后台。
9. **CM5 是本地 vendor**；不引 CDN、不加打包器。
10. **单文件是构建产物**；改 `index.html` / `css/` / `js/` 后跑 `node tools/build.cjs`。

---

## 六、已知边界 / 下一步

- 单输入框失败后在输入框内联修复，不弹窗；X_ 文本持久化，刷新后原文仍在。
- 明文单文件可导出/回导；双文件明文导出已取消，保留初级/深度密文。
- 备注两级统计目前是报表顶部简表；完整分类树/关键字明细待做。
- 行为树的重挂父级/合并 UI 未做；当前可直接编辑 `[行为]`。
- 会计 + 行为同 code 的双角色链接是“同 code 自动”，尚无显式 `dual` 标记 UI。
- 错误行跨刷新会保留（源码手稿持久化）；旧版 `ledger.txt + dict.json` 导入会自动生成源码。
- 4 态编辑投影对“一行多原子边”会展开成多行；这是当前取舍。
