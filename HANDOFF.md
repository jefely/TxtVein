# TxtVein · 接续说明

> 给下一位 agent / 下一位自己：先读 [`STATUS.md`](STATUS.md) 一页看全，再读 [`README.md`](README.md) 的格式与边界。
> 本文只记「改之前必须知道」的结构与踩过的坑。

---

## 一、固定流程

```powershell
cd D:\myproject\TxtVein

node --test tests/*.test.cjs      # 1. 核心测试（198）
node tools/gen-system-dict.cjs    # 2. 母树生成（build 会自动跑）
node tools/build.cjs              # 3. 单文件
node tools/check.cjs              # 4. 工程门禁（158）
python serve.py 8899              # 5. 另开一个终端
python tools/e2e.py               # 6. 浏览器 E2E（56）
python tools/smoke_file.py        # 7. file:// 单文件冒烟
```

改动后至少跑：`test` → `build` → `check` → `e2e`。
只改 CSS/UI 也要 `build`，因为用户双击的是 `TxtVein.html`。

---

## 一之二、母树数据层

```text
js/core/system.dict        唯一可编辑源（Tree / Alias / Merchant）
        ↓ node tools/gen-system-dict.cjs
js/core/system-dict.js     生成物：VERSION / HASH / 冻结 nodes
js/core/system-dict-core.js 解析 / 索引 / 图算法 / 路径 / 类型继承
```

- **只改 `system.dict`，不要手改 `system-dict.js`**；`tools/build.cjs` 会先跑生成器。
- 首版：190 节点 / 162 叶子 / 56 银行 / 30 商户；深度 3；G1–G21。
- 一个概念一个顶点；中英名成对；推荐简码在行内，不是身份。
- 内部节点只汇总，叶子才可记账；每个内部节点有 `.GENERAL` 叶子。
- 商户是 facet，不是锚点目标；`default_category` 指向可记账叶子。
- 测试：`tests/system-graph.test.cjs`、`system-dict.test.cjs`、`system-i18n.test.cjs`。
- 门禁会校验生成物哈希是否新鲜；改了 `.dict` 没生成会失败。

### 一之三、v3 保险库与 P/C 拆分

```text
js/core/user-dict.js        split / merge / checkSide
js/browser/store.js         payload v3：dictSourceP / dictSourceC / systemVersion
```

- 新保险库直接 v3；v2 只读兼容，不做迁移。
- `dictSourceP` = P/F，`dictSourceC` = C/H；编译时合并成一个 Dict。
- 同域唯一：P/C 可以各有一个 `coffee`；`resolveAlias`/`resolveTag` 先按域过滤。
- 跨域同码的别名写成 `N:P:code` / `N:C:code`；`dictToSource` 自动加限定。
- 测试：`tests/split-dict.test.cjs`、`tree-view.test.cjs`、`anchor.test.cjs`；E2E 走新保险库 setup/save/reload。

### 一之四、私人树 sort 与锚点

```text
js/core/tree-view.js       会计类型块头 + 私人 parent_id 树；sort 优先
js/core/anchor.js          锚点 set/clear/validate；类型/极性继承
```

- `sort` 是显示顺序（0–100000，默认 100）；`weight` 仍是候选排序。
- 字典源码尾部可写 `sort:10`；`dictToSource` 只在非 100 时输出。
- 锚点在源码尾部写 `^SYS.CAT.DINING.COFFEE`；`@SYS...` 兼容读。
- 锚点必须是母树叶子；有历史时翻转极性拒绝；未确认不写。
- 顶栏不再单独开“树”弹窗；字典源码 `[树]` 段用缩进列出私人树，改缩进即改父级。
- 节点表单显示“公共：…”副标签，并提供“建议归属”按钮；建议只填选择，保存才写入。

---

## 二、唯一状态与唯一写入

```text
app.js
  S.dict / S.events / S.behaviors / S.notes / S.plans / S.rules / S.vaultId
  S.ledgerSource / S.dictSource / S.sourceDiags
  compileSources()        ← 唯一编译器入口：dict.tv + ledger.tv → ID 图
  submitEntry()           ← 唯一录入入口：写一行源码 → compileSources()
  projectEditorSource()   ← 4 态投影：合法行重渲染，错误行原位保留
  buildTexts()            ← 唯一序列化 / 双哈希出口
  saveNow()               ← 唯一写保险库出口

editor.js                 ← CM5 双文件；只管文本/诊断/补全，不碰 ID 图
panels.js                  ← 规则/导出/导入/帮助；不再有字典弹窗
```

不要在 `panes.js` / `report-view.js` 里存事件或余额；它们每次都从 `S` 重算/重渲染。

---

## 三、数据流

```text
输入 raw
  → parser.parseEntry(raw, draftDict, opts)
      · 词法/日期/域/标签/链
      · 绑定 ID（唯一命中才过；多义返回 candidates；未命中返回 suggest）
      · 链式展开 + 差额 system loss/gain
      · 周期计划
  → app 提交 draftDict，分配 E_ ID
  → S.events / S.plans
  → buildTexts(): syncMeta → dictHash → ledger LINK → ledgerHash → dict.link
  → store.save(encrypted payload)
  → renderAll(): calc.compute → panes / report
```

**解析必须先克隆 dict**：`parser.parseEntry` 会原地写标签、别名、计数器、system 节点；失败时要丢弃整个草稿，不能污染 live dict。
例如 `wx1 > rent 1000*m` 在创建标签后才发现计划非法，若 clone 前就提交，会留下孤儿标签。

---

## 四、哈希互锁（最容易改坏）

```text
Hash_B = sha256(dictForHash(dict))       # link 字段不参与
ledger.LINK = Hash_B
Hash_A = sha256(ledgerBody(ledger))      # # LINK 行不参与
dict.link = Hash_A
```

- `dict-file.bodyForHash()` 先 `normalizeDict()`，再 `canonicalJson`。
- `normalizeDict()` 只保留已知字段；未知字段会被丢掉，所以 **哈希必须基于 normalize 后的对象**，否则「导出的文件自己校验不过」。
- `ledger-file.bodyForHash()` 过滤 `# LINK:` 行、统一换行、去尾部空行，再加一个换行。
- 导入时 `VAULT_ID` 与两条哈希都要校验；不匹配返回 `needsForce:true`，UI 勾选强制才继续。

**踩过的真实 bug（2026-11-15）**：
`dict.js` 里 `ensureMeta(dict).updatedAt = ...` 把 `updatedAt` 写到了 dict 顶层（`ensureMeta` 返回 dict，不是 meta），parseDict 丢字段 → 自己导出的明文导入时报「指纹不匹配」。
修复：`ensureMeta(dict); dict.meta.updatedAt = ...`，并让 `normalizeDict` 兼容旧顶层 `updatedAt`。

---

## 五、双极与域（不要退回）

- `processTransfer`：from A `-=`，from B `+=`；to A `+=`，to B `-=`。
- 期末 = 期初 + 本期增加 − 本期减少；`opening` 由区间前流水折入。
- 全局守恒：`globalClosingNet === globalOpeningNet`；不要拿域子集去断言守恒。
- 独立域视角：跨域那一端会让 A−B 变化；`calc.js` 算 `crossNetDelta`，报表用 `adjustedNet = closingNet - crossNetDelta` 显示「域内净额」。
- 跨域不做镜像双记；一笔真实边 + 报表抵消。要镜像时必须先解决「同一笔钱被算两次」。

---

## 六、UI 里踩过的坑

1. **双空格宏**：只在「前一个字符是空格」且 250ms 内触发；否则金额后的第一个空格会被吞掉，第二次空格才变普通空格。
2. **宏的光标**：替换后光标要落在 `pos - 1 + insert.length`（插入串末尾），不是 `pos + op.length`；否则 `>` 后没有空格会变成 `wx1 >din`。
3. **冲突简码**：`displayCode()` 按别名数组顺序给 `wx1/wx2`；不要退回直接 `zh_code`，否则屏幕上两个 `wx`。
4. **气泡**：`analyzeInput` 不要用「首项等于输入」就隐藏；`wx` 多义会被误吞。唯一命中由 `resolveAlias/resolveTag` 返回 `ok` 处理。
5. **Enter**：有气泡时先选候选；没有气泡才提交。精确命中时 `resolveAlias` 已 `ok`，不产生气泡。
6. **Delete**：条件是 `S.editingIndex < 0`（不是 `!S.editingIndex`，因为 -1 是 truthy）。
7. **模式切换**：如果当前在报表视图，`renderAll()` 不会重绘隐藏的窗格；E2E 要先切回流水再断言窗格文本。
8. **单文件构建**：`tools/build.cjs` 从 `index.html` 内联 `<link>` / `<script>`；新增 JS/CSS 必须加进 `index.html`，否则构建产物没有它。

---

## 七、格式速查

```txt
ledger 行：
[域] YYMMDD 转出ID > 转入ID 金额整数分 [T_ID...] [^C_ID]
时间行：
[P] 261115 N_001 > N_003 60min T_time

dict 节点：
{ zh_name, en_name, zh_code, en_code, polarity, type, form,
  domain, parent_id, weight, system, created_at }

dict 标签：
{ zh_name, en_name, zh_code, en_code, domain, parent_id, weight, kind, created_at }

[PLAN]
R_001 active: 0 N_001 > N_004 100000 T_02 *m last_run=261111

[RULES]
R_101 active: keywords=(外卖)&amount<10000 -> N_001 > N_003 tags=T_05,T_02 name=外卖

加密装甲：
# [SECURE_START: P, AES-GCM-256]
...
# [SECURE_END]
```

---

## 八、测试的边界

- Node tests cover: amount/date/dict/parser/calc/rules/file/crypto/report/legacy/example.
- E2E covers UI 主链路；不测真实文件下载（下载由浏览器行为决定），加密导入通过 `store.encryptWithCurrent` + `importFiles` 覆盖。
- `smoke_file.py` 只证明 `file://` 单文件可设密码/刷新解锁；不替代 E2E。
- 若新增格式字段：先加 Node 往返测试，再加 E2E；不要只改 UI。

---

## 九、已知未做

见 `NEXT.md`：自动锁屏、IndexedDB、万行压测、规则编辑 UI、穿戴、审计插件、深水掩码、多币种。

---

## 十、工作区约定

- 中文思考、中文反馈；中文术语（素参、沉积、意义权…）不翻译。
- 默认 **B 档**；改论文/主张表/对外发布用 **C 档**；想撑开可能性用 **A 档**（A 档产出只能是假说）。
- 动手前读 `AGENTS.md`；本子项目只依赖自身 `js/`，不引入第三方库。
