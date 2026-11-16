# TxtVein 架构说明

> 给开发者：这一版为什么这样分层、数据怎么流、哪些不变量不能破。
> 用法与格式见 [`../README.md`](../README.md)；接续注意见 [`../HANDOFF.md`](../HANDOFF.md)。

---

## 一、四层

```text
core/        纯函数，零 DOM。账本的全部真相与算法。
browser/     浏览器边界：localStorage 保险库、文件读写。
ui/          纯渲染 + 输入编排。不存业务数据。
tools/       构建、门禁、E2E、压测。
```

`js/core/` 不允许出现 `document` / `window` / `localStorage` / `navigator` / `HTMLElement`；`tools/check.cjs` 会检查。这条规则保证核心可以在 `node --test` 里跑，也保证「报表是派生视图」不是口号。

---

## 二、数据模型

```text
Dict
├─ meta        nextNode/nextTag/nextEvent/nextChain/nextRule/nextPlan/updatedAt
├─ nodes       N_xxx → { zh/en name, zh/en code, polarity, type, form,
│                        domain, parent_id, weight, system }
├─ tags        T_xx  → { zh/en name, zh/en code, domain, parent_id, weight, kind }
└─ aliases     "wx" → [N_001, N_008], "wx1" → [N_001]

Event
{ id, domain, date, from, to, amountCents, minutes, tagIds[], chainId, crossDomain }

Plan
{ id, status, start, lastRun, period, domain, from, to, amountCents, tagIds[], name }

Rule
{ id, status, keywords[], amountOp, amountCents, from, to, tagIds[], name }
```

- 金额只有 `amountCents` 整数分；`minutes` 是并行的时钟，不参与金额。
- `type` 六选一，`polarity` 由 `type` 推导；`form` 只影响展示文案。
- `domain` 是圈层标签；`event.domain` 是「记在哪个账本」，节点各自有 `domain`。
- `chainId` 是可选扩展：`A > B > C 1000 995` 展开的原子边共享 `C_xxx`。

---

## 三、解析流水线

```text
raw
 │ text.normalizeOperators
 │ 行首 [P] / "P: "
 │ 行首日期（6/8 位、YYYY-MM-DD、0/1/±N）
 │ 第一个 < 切资金段 / 标签段
 ▼
tokenizeFlow
 │ ">" 独立；"#" 前补空格；*d*m*y 剥离
 ▼
nodes[] / quantities[] / inlineTags[] / period
 │ 校验：节点数、> 数、金额数、单位、链段
 ▼
resolveAlias × N
 │ 精确别名 → 精确简码/名字 → 数字后缀 → 前缀
 │ 失败：AMBIGUOUS / UNBOUND（绝不静默建节点）
 ▼
标签树
 │ < 块间父子；块内空格同级；# 行内
 │ ensureTag：存在复用；不存在创建（toast 明示）
 ▼
展开链
 │ 单金额继承；多金额逐段；差额 → N_sys_loss / N_sys_gain
 ▼
Plan（*d/*m/*y）
 │ 当前这笔照常生成；挂/复用一条计划；last_run = 今天
 ▼
{ events[], plan, tagsCreated[], binding[], preview, warnings }
```

**关键**：`parseEntry` 会原地修改 `dict`（标签、别名、计数器、系统节点）。所以调用方必须先 `clone(S.dict)`，成功后才把草稿提交为 live dict。失败就丢弃草稿。

---

## 四、双极计算

```js
function processTransfer(fromNode, toNode, amountCents) {
  if (fromNode.polarity === 'A') fromNode.balance -= amountCents;
  else fromNode.balance += amountCents;
  if (toNode.polarity === 'A') toNode.balance += amountCents;
  else toNode.balance -= amountCents;
}
```

`calc.compute` 不直接改节点，而是给每个节点维护：

```text
opening  区间前流水折进来的期初
inc      本期增加（A 极=转入；B 极=转出）
dec      本期减少（A 极=转出；B 极=转入）
closing  opening + inc − dec
```

全局守恒：

```text
globalClosingNet = Σ(A closing) − Σ(B closing)
globalOpeningNet = Σ(A opening) − Σ(B opening)
globalClosingNet === globalOpeningNet
```

**域子集不满足这个等式**：一笔 `P:微信 → C:公户` 会让 P 的 A 减少、C 的 A 增加；只看 P 时净额会「凭空少 1000」。所以 `compute` 额外计算 `crossNetDelta`：

```text
adjustedNet = closingNet − crossNetDelta
```

报表的「A − B」显示 `adjustedNet`，并注明「域内净额 · 跨域调整」。全局视角 `crossNetDelta = 0`。

---

## 五、哈希互锁

```text
normalizeDict(dict)              只保留已知字段，键排序
dictBody = canonicalJson(normalizeDict(dict) − link) + "\n"
Hash_B = SHA256(dictBody)
ledger.LINK = Hash_B

ledgerBody = ledger 去掉 # LINK 行 + 归一化换行
Hash_A = SHA256(ledgerBody)
dict.link = Hash_A
```

两条哈希都是对「去掉自身 LINK 字段」的 body 求的，所以不循环。

导入：

1. 解析两个文件；
2. `VAULT_ID` 一致？
3. `ledger.LINK === SHA256(dictBody)`？
4. `dict.link === SHA256(ledgerBody)`？
5. 不一致 → `needsForce`；强制导入要写明警告。

**改任何 dict 字段都要先跑 `normalizeDict` 再哈希**，否则导出/导入会自己跟自己对不上。

---

## 六、输入状态机

```text
STATE_FROM    还没有 >
STATE_TO      有 >，转入节点还没输完
STATE_AMOUNT  有 > + 转入，正在输金额
STATE_TAG     有 <
```

`analyzeInput(value, caret)` 只看光标前的文本，决定当前 token、角色、候选：

- 角色 `from` / `to`：`searchNodes`，按域、权重、极性排序；
- 角色 `tag`：`searchTags`；
- 角色 `amount`：不弹候选；
- 无 `>` 时：跑 `rules.predict`，命中则显示预测条。

**精确命中**由 `resolveAlias/resolveTag` 返回 `ok` 处理；不要再用「候选首项等于输入」去隐藏，否则 `wx` 多义会被误吞。

---

## 七、渲染

```text
panes.js
  四个 pane，每个 pane 一个独立滚动容器 + 绝对定位行画布
  只渲染 [scrollTop, scrollTop+viewH] ± 8 行
  行内容由 S + calcAll 现算，不缓存业务数据

report-view.js
  只消费 report.buildReport 的纯数据
  六类卡片 + 能量 + 时间 + 链 + 域

input.js
  双空格宏 / 气泡 / 预测 / 幽灵撤销 / 编辑态
  不计算候选；候选由 app.analyzeInput 提供
```

`content-visibility` 没有用在虚拟行上（虚拟滚动已经只画可视区）；`will-change: transform` 用在滚动容器；数字统一 `font-variant-numeric: tabular-nums`。

---

## 八、错误码

| code | 含义 | UI 行为 |
|---|---|---|
| `EMPTY` | 空输入 | 提示 |
| `INVALID_DATE` | 日期不合法 | 提示，保留输入 |
| `MISSING_FROM` / `MISSING_TO` | 缺一端 | 提示，保留输入 |
| `MISSING_AMOUNT` | 有 > 没金额 | 提示「数据没吞」 |
| `INCOMPLETE_FROM` | 只写了转出 | `draft:true`，保留输入 |
| `AMBIGUOUS` | 多义 | 气泡候选，数字键/点击 |
| `UNBOUND_NODE` | 未绑定 | toast「新建节点」 |
| `CROSS_DOMAIN_PREFIX_REQUIRED` | 跨域没写前缀 | 提示示例 |
| `AMOUNT_COUNT` / `MIXED_UNIT` / `TIME_CHAIN` | 链金额/单位错 | 提示 |
| `DOMAIN_MISMATCH` | 前缀与节点域不符 | 提示 |

---

## 九、测试矩阵

| 层 | 文件 | 关注 |
|---|---|---|
| 基础 | `amount/date/dict` | 分、YYMMDD、四态、别名冲突 |
| 语法 | `parser` | 绑定、链、标签树、跨域、计划、错误 |
| 算法 | `calc/report` | 双极、区间、域、能量、时间、链 |
| 规则 | `rules` | 解析、到期、取消、预测 |
| 文件 | `file` | 序列化/往返/哈希/校验 |
| 加密 | `crypto` | SHA-256 向量、AES-GCM 往返、装甲、截断 |
| 迁移 | `legacy` | old1/old2 期初与三列备注 |
| UI | `tools/e2e.py` | 门禁、录入、气泡、编辑、删除、导入、移动端、改密码 |

---

## 十、性能边界

- `panes.js` 每帧只重建可视行（约 30 × 4）；10k 行滚动应无感。
- `calc.compute` 是全量遍历；10 万行需要按区间预筛或增量索引。
- `buildTexts` 每次保存全量序列化 + 两次 SHA-256；10 万行需要 Worker 或增量哈希。
- localStorage 5–10MB；换 IndexedDB 是下一步。

---

## 十一、母树 / 子树（数据层已接，接线进行中）

当前 `Dict.nodes` 已有 `parent_id`、`domain`、`system`，但还没有 `anchor_id`。
母树的**数据层**已经接上：

- `js/core/system.dict` 是唯一可编辑源；
- `tools/gen-system-dict.cjs` 生成 `js/core/system-dict.js`（版本 + SHA-256 + 冻结数据）；
- `js/core/system-dict-core.js` 负责解析、索引、图算法校验、双语路径、类型继承；
- 首版 190 节点 / 162 叶子 / 56 银行 / 30 商户 / 169 别名；深度 3；G1–G21 全过；
- 生成物与源的一致性由 `tools/check.cjs` 和 `tests/system-*.test.cjs` 强制。

仍未接：`user_p` / `user_c` 拆分、`anchor_id`、公共报表、建议器。
详见 [`mother-tree-graph.md`](mother-tree-graph.md)、
[`mother-tree-wiring.md`](mother-tree-wiring.md)、
[`mother-tree-bilingual.md`](mother-tree-bilingual.md)。

账本尚未开始使用，**不做迁移**；`dict.tv` 仍是当前用户字典来源。

