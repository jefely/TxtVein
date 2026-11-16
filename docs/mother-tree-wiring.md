# 母树 / 子树接线方案（无迁移版）

> 状态：**数据层与 P/C 拆分已实施，接线进行中**。
> 前提：**账本尚未开始使用**，因此不做迁移、不保留旧 ID、不做备份/回滚。
> 新保险库直接按 v3 建立；开发期的旧 v2 数据导出后清空即可。
> 已完成：`system.dict`（190 节点 / 162 叶子 / 56 银行 / 30 商户）、生成器、
> `system-dict-core`、G1–G21、双语与推荐码；v3 payload、`user_p`/`user_c` 拆分、
> 同域唯一/别名分域；`[树]` 纯文本私人树；锚点；公共报表；`weight`/`pin` 重构；建议器。
> 198 Node / 158 门禁 / 56 E2E 全绿。下一步：Event/State/Source 模型（独立文档）。
> 图论模型见 [`mother-tree-graph.md`](mother-tree-graph.md)；
> 规范原文见 [`mother-tree.md`](mother-tree.md)（§8 迁移不再执行）。

---

## 零、结论

1. **不做迁移**：没有旧账，不需要 v2→v3、`idMap`、旧 ID 对账、备份/回滚。
2. **母树是计数树**：单父级、层叠、叶子可记账；商户/标签/行为是分离的 facet。
3. **私人子树 P/C 拆分**：新保险库直接 `dictSourceP` / `dictSourceC`，编译时合并。
4. **锚点只挂叶子**：类型/极性从叶子祖先链继承；未确认不写。
5. **公共报表是前推**：私人余额 → 叶子 → 祖先链；未归类/失效单独，不重复计数。
6. **建议器只建议**：确定性匹配 + 商户 facet + 可选本地模型；永不自动写。
7. **原有 108 条 Node / 121 条门禁仍全绿**；当前 198 Node / 158 门禁；新增图算法、拆分、树视图、锚点、报表、建议器测试。

---

## 一、为什么现在可以“直接新结构”

- 没有真实用户数据，不需要兼容旧 ID、旧哈希、旧保险库。
- 仍保留**导入能力**：旧明文、旧版 TXT、v2 开发数据可以读；
  但读进来就是新保险库，不承诺旧 ID。
- `mother-tree.md` §8 的“保留旧 ID / 旧账迁移”只适用于有历史数据的场景，
  本方案不执行；文档实施时同步改写。
- 不再引入 `idMap`。理由：
  - 锚点写在源码 `^SYS...` 上，ID 漂移不影响锚点；
  - 事件/报表每次从源码重建，ID 只是会话内标识；
  - 以后若要做外部审计/同步，再单独引入稳定 ID，不在 P0 预埋复杂度。

> 如果以后账本开始使用，再按“有数据迁移”单独做一版；那时才需要
> 旧 ID 快照、备份、对账、回滚。本文不覆盖。

---

## 二、数据模型

### 2.1 `system.dict` 分区

```text
[Tree]        计数树：单父级、层叠、叶子可记账
[Alias]       别名：ID | lang | 别名（中英分开）
[Merchant]    商户 facet：default_category 横边
[Bank]        银行 facet：储蓄分类 / 借贷分类 两列
[Tag]         标签 facet（预留，P0 不接）
[Behavior]    行为 facet（预留，P0 不接）
```

`[Tree]` 行（10 列）：

```text
ID | 中文名 | 英文名 | @父ID | kind | 大类 | 中文推荐码 | 英文推荐码 | 权重 | 排序
```

例子：

```text
SYS | 母树 | System | - | root | - | - | - | 0 | 0
SYS.ACC.EXPENSE | 费用 | Expense | @SYS | type | 费用 | - | - | 100 | 10
SYS.CAT.DINING | 餐饮 | Dining | @SYS.ACC.EXPENSE | category | - | - | - | 100 | 10
SYS.CAT.DINING.COFFEE | 咖啡茶饮 | Coffee | @SYS.CAT.DINING | category | - | cof | coffee | 90 | 10
SYS.CAT.DINING.GENERAL | 餐饮·未细分 | Dining General | @SYS.CAT.DINING | category | - | din_gen | din_gen | 60 | 99
```

- **一个概念一个顶点**：中英文名是同一节点的两个 label，不建 `*.ZH` / `*.EN` 两个节点。
- 中英文名都非空；不允许只写一边。
- `kind`：`root` / `type` / `category`。
- `大类` 只写在 `type` 行；`category` 继承最近 `type` 祖先。
- `postable` 由“有没有子节点”推导：**叶子可记账，内部节点只汇总**。
- 每个内部节点必须有 `.GENERAL` 叶子，表示“这一组未细分”。
- 深度：`SYS` = 0，`type` = 1，`group` = 2，`leaf` = 3。
- 分支：`SYS` ≤12，`type` ≤20，其他内部节点 ≤15。
- 叶子必须有中英两个推荐码；内部节点不写码。
- 推荐简码只是私人树创建时的默认值，**不是母树身份**；改码不改 ID/锚点/哈希。

`[Alias]` 行：

```text
ID | lang | 别名
```

```text
SYS.CAT.DINING.COFFEE | zh | 咖啡
SYS.CAT.DINING.COFFEE | zh | 奶茶
SYS.CAT.DINING.COFFEE | en | coffee
SYS.CAT.DINING.COFFEE | en | latte
```

- 同一语言内别名全树唯一；一个别名只指向一个节点。
- 中英别名分开，避免切语言后匹配错。

`[Merchant]` 行（7 列）：

```text
ID | 中文名 | 英文名 | default_category | 中文推荐码 | 英文推荐码 | 权重
```

例子：

```text
SYS.MERCHANT.STARBUCKS | 星巴克 | Starbucks | SYS.CAT.DINING.COFFEE | sbk | starbucks | 80
SYS.MERCHANT.MEITUAN | 美团 | Meituan | SYS.CAT.DINING.TAKEOUT | mt | meituan | 80
```

- `default_category` 必须指向 `[Tree]` 的**可记账叶子**。
- 商户不是锚点目标，只用于建议/归一化。
- 一个商户可以有多个候选分类；`default_category` 只是先验。
- 商户别名同样写在 `[Alias]`，`ID` 用 `SYS.MERCHANT.*`。

`[Bank]` 行（6 列）：

```text
ID | 中文名 | 英文名 | 储蓄分类 | 借贷分类 | 权重
```

- `储蓄分类` 必须是资产叶子（如 `SYS.CAT.BANK.DEBIT`）；
- `借贷分类` 可以是 `-`，或负债叶子（如 `SYS.CAT.CREDIT_CARD`）；
- 银行不是锚点目标；选银行后锚到对应储蓄/信用卡叶子；
- 银行子树立列全 56 家，后续加行不改计数树。

> 双语与简码的完整规则见 [`mother-tree-bilingual.md`](mother-tree-bilingual.md)：
> 母树给双语名称和推荐简码；简码权威在私人树；P/C 各自唯一。

### 2.2 母树只读与版本

```text
js/core/system.dict        唯一可编辑源
        ↓ node tools/gen-system-dict.cjs
js/core/system-dict.js     生成物：nodes / VERSION / HASH / SOURCE
        ↓ index.html + tools/build.cjs
TxtVein.html               单文件直接可读
```

- 生成器校验：ID 唯一、父存在、无环、层叠、深度、分支、`.GENERAL`、别名唯一。
- `VERSION_STRING = "2026.11.1+" + sha256.slice(0, 12)`。
- 模块加载后深冻结，不暴露写函数。
- `tools/build.cjs` 构建前先跑生成器；`tools/check.cjs` 校验生成物新鲜度。
- 保险库 `systemVersion` 存完整字符串；UI 只显示 `2026.11.1`。
- 升级只替换母树，不碰用户文件；失效/弃用锚点保留，不静默改挂。

### 2.3 用户子树 P/C

新保险库 payload v3：

```json
{
  "format": "txtvein-vault",
  "version": 3,
  "vaultId": "8a2b1c3d",
  "ledgerSource": "261115 wx > din 35 < 咖啡\n",
  "dictSourceP": "// user_p.dict\n[会计]\n...",
  "dictSourceC": "// user_c.dict\n[会计]\n...",
  "systemVersion": "2026.11.1+bfbcaa7ef973",
  "updatedAt": "2026-11-16T19:40:00.000Z"
}
```

- 不存 `idMap`、不存合并 `dict` JSON；导出时现算。
- `dictSourceP` = 域 P + F；`dictSourceC` = 域 C + H（F/H 分组待裁决，见 §8）。
- 编译时 P/C 合并成一个 `Dict`，再走现有 `calc` / `report`。
- 字典编辑器仍可保持一份合并文本；保存时按域拆到 P/C。
  物理拆分先落在保险库，UI 的 P/C 分栏可以后做。
- `store.normalizePayload()` 增加 v3 字段；`loadPayload()` 识别 v3。
- 旧 v2 开发数据：能读就按只读路径读；提示“导出后清空重建”，不做自动迁移。
- 新保险库 `onSetup` 直接建 v3；示例账本也走 v3。

### 2.4 源码语法

```text
node P 费用 steam cof cof 咖啡 | Coffee 90 - ^SYS.CAT.DINING.COFFEE
node P 费用 steam sbk sbk 星巴克 | Starbucks 90 @cof ^SYS.CAT.DINING.COFFEE
node C 费用 steam off off 办公费 | Office 50 - ^SYS.CAT.WORK.OFFICE_SUPPLIES
```

- `@父码`：私人父级，语义不变。
- `^SYS...`：公共锚点，最多一个；只能指向 `[Tree]` 叶子。
- 兼容读 `@SYS...`（`SYS.` 前缀保留，不可能是私人父码）；新写入统一 `^`。
- 没有 `^` 的节点合法，进入“未归类”。
- **双语是一组，不是两个节点**：一行里 `zh_code en_code 中文名 | 英文名` 成对出现；
  中英是同一私人节点的两个 label。
- **私人简码是权威**：`zh_code` / `en_code` 由用户在私人树定稿；母树行里的推荐码只是默认值。
  创建时预填，域内查重；P/C 可以各有一个 `coffee`。
- 缺英文名/英文简码时回退中文，并在 UI 标“英文缺失”，不自动翻译、不假装成对。
- 4 态投影按 `lang` 取 `zh_code` / `en_code`；母树推荐码不参与投影。

### 2.5 编译与继承

- 编译 P+C 合并源时，`seen` 按 `kind + domain` 分组：**同域唯一**，P/C 可以各有一个 `coffee`。
- `sourceCodeMap` 按 `kind + domain` 分组；跨域同码时别名目标写 `N:P:cof` / `N:C:cof`。
- `resolveAlias` / `resolveTag` 先按 `ctx.domain` 过滤，再判唯一。
- `displayCode` 只看同域别名目标。
- 锚点解析：
  - 目标必须是 `[Tree]` 叶子；
  - 物化 `type/polarity/form`；
  - 同极改类允许，给提示；
  - 异极改类报错，不静默翻转历史余额；
  - 目标失效：保留原大类，标 `stale_anchor`，不阻止编译。
- `dictToSource()` 写回继承后的 `type/form`，下一轮不再重复提示。

### 2.6 锚点校验

```js
TV.anchor.validate(dict, system)
// ANCHOR_UNKNOWN      warn   目标不在当前母树
// ANCHOR_NOT_LEAF     error  目标是内部节点/商户/标签/行为
// ANCHOR_NOT_SYSTEM   error  目标不是 SYS.*
// ANCHOR_POLARITY     error  A↔B 翻转
// ANCHOR_DUPLICATE    error  一个节点多个锚点
// ANCHOR_KIND         error  非会计节点挂锚点（P0）
```

- 一个私人节点最多一个锚点；
- `anchor_id` 不能指向私人 ID；
- P 节点不能锚到 C 节点（母树没有域，目标是叶子，天然满足）；
- 标签/行为 P0 不挂锚点。

### 2.7 公共报表

```js
TV.publicReport.build(dict, events, system, { range, domain, lang, now })
```

算法：

```text
calc = calc.compute(dict, events, { range, domain })
对每个私人节点行：
  a = node.anchor_id
  a 未定义        → 未归类
  a 不在叶子集合   → 失效锚点（不计入公共合计）
  否则            → 把 opening/inc/dec/closing/count 推到叶子，
                    再沿叶子祖先链上卷
```

- 只按节点上卷，不按事件重复计数；
- 内部节点只汇总，叶子是原子；
- 未归类 / 失效单独桶，不并进“其他”；
- 对账：

```text
已归类 + 未归类 + 失效 = 私人合计
公共 adjustedNet = 私人 adjustedNet
```

- 默认当前域；显式“全部”才跨域；跨域转账仍由 `crossNetDelta` 处理。

### 2.8 建议器

```text
清洗 → 母树叶子别名精确匹配 → 私人同域别名精确匹配
     → 商户 facet：商户 → default_category
     → 可选本地模型：只从候选叶子里排序
     → 置信度 + 用户确认
```

- 只返回 `[Tree]` 叶子候选，不返回内部节点/商户/标签；
- 模型输入只含 token + 候选 ID/路径，不含金额/余额/流水；
- 输出校验：`system_id` 必须在候选里，编造丢弃；
- 置信度阈值：`>=0.85` 气泡高亮，`0.60–0.85` 展示 2–3 个，`<0.60` 进未归类；
- 永不自动写；只有“采纳”才写源码 `^SYS...`；
- 缓存键：`规范化词 + systemVersion`，只放内存；
- 模型不可用：确定性匹配 + 手动选择仍完整可用；
- `file://` 下 Ollama 可能受跨域限制，模型是可选增强，不是 P0 验收前提。

---

## 三、UI

- 统计页顶部：私人 / 公共切换；公共视图显示树形汇总、未归类、失效警告。
- 顶栏“归属”按钮：搜索优先的树形选择器；
  - 输入“咖啡” → 显示“费用 / 餐饮 / 咖啡茶饮”；
  - 组头可折叠；常用/最近在前；
  - 不显示 `SYS.` ID，只显示路径；
  - `.GENERAL` 显示为“餐饮（未细分）”，不是“其他”。
- 建议气泡文案沿用 `mother-tree.md` §7。
- 归属卡片分两行：私人父级 / 公共归属，不合成一个“父级”。
- 友好界面不显示后台随机 ID，也不显示母树 ID。

---

## 四、实施顺序

| 步骤 | 内容 | 产出 | 回退 |
|---|---|---|---|
| 1 | 图论模型 + 叶子清单 + 生成器/校验器 | `system.dict` 骨架、图算法测试 | 不接 UI |
| 2 | v3 payload + P/C 拆分/合并 + 同域唯一/别名分域 | 新保险库直接 v3 | 旧路径保留只读 |
| 3 | 锚点语法/校验/继承 + 公共报表 | 归属与双视图 | 不写锚点 |
| 4 | 建议器（确定性 + 可选模型） | 只建议 | 关掉建议 |
| 5 | 全量回归 + 文档更新 | STATUS/NEXT/HANDOFF | —— |

> 第 1–4 步已完成（2026-11-16）。下一步是 Event/State/Source 模型，见 `docs/event-model.md`。

每一步都要求：`node --test` 全绿 → `node tools/build.cjs` → `node tools/check.cjs`；
第 2 步起加 E2E；最后跑 `smoke_file.py`。

---

## 五、测试矩阵

| 层 | 文件 | 关注点 | 精确断言 |
|---|---|---|---|
| 图 | `system-graph.test.cjs` | G1–G21 | 单根、单父、无环、层叠、深度、分支、`.GENERAL`、叶子可记账、别名唯一、双语不增点、银行 facet |
| 母树 | `system-dict.test.cjs` | 解析/冻结/版本 | 哈希稳定、生成物新鲜、改不动 |
| 双语 | `system-i18n.test.cjs` | 中英成对/切语言不变 | 每节点中英名非空；切 `zh/en` 节点数/边数/锚点数/汇总数不变 |
| 简码 | `private-code.test.cjs` | 预填/域内查重/回退 | 从母树叶子创建预填双语码；P/C 可同码；缺英文回退并标记 |
| 拆分 | `split-dict.test.cjs` | P/C 拆分/合并 | 往返一致；同码可共存；别名域限定 |
| 编译 | `source.test.cjs` 增补 | 锚点/继承 | `^`/`@SYS` 等价；异极报错；失效保留 |
| 校验 | `anchor.test.cjs` | 锚点不变量 | 只能挂叶子；最多一个；不挂商户/内部节点 |
| 报表 | `public-report.test.cjs` | 前推/对账 | 不重复计数；未归类/失效单独；等式成立 |
| 建议器 | `suggest.test.cjs` | 只建议 | 调用前后锚点不变；编造 ID 丢弃；模型失败降级 |
| 兼容 | 原有 108 条 | 不回退 | 原样全绿；当前总数 198 |
| 门禁 | `check.cjs` | 新文件 | 存在、被引用、单文件包含、核心零 DOM |
| E2E | `e2e.py` | 新账本 | 直接建 v3；拆分保存/刷新；归属采纳/忽略；公共视图 |
| 冒烟 | `smoke_file.py` | 单文件 | 设密码、刷新解锁、0 runtime error |

---

## 六、文件清单

```text
js/core/system.dict            母树源（Tree / Alias / Merchant / Bank / Tag / Behavior）
js/core/system-dict-core.js    纯解析/校验/图算法
js/core/system-dict.js         生成物（nodes / VERSION / HASH / SOURCE）
js/core/user-dict.js           P/C 拆分/合并/域校验
js/core/anchor.js              锚点校验/继承
js/core/public-report.js       公共报表前推
js/core/suggest.js             确定性建议/阈值/缓存
js/browser/suggest-ollama.js   可选模型适配器
tools/gen-system-dict.cjs      生成器
tools/check.cjs                新增系统字典/图算法/模块检查
tests/system-graph.test.cjs
tests/system-dict.test.cjs
tests/system-i18n.test.cjs
tests/private-code.test.cjs
tests/split-dict.test.cjs
tests/anchor.test.cjs
tests/public-report.test.cjs
tests/suggest.test.cjs
```

`index.html`、`tests/helpers/load.cjs`、`tools/build.cjs`、`tools/check.cjs`
的硬编码清单都要同步新增。

---

## 七、明确不做

- 不做 v2→v3 迁移、不保旧 ID、不做备份/回滚；
- 不做多父级 DAG 计数、不做格/多继承；
- 不把商户/标签/行为塞进计数树；
- 不让模型自动写锚点；
- 不让内部节点可记账；
- 不做云端同步；
- 不把“归属”和“私人父级”合成一个字段。

---

## 八、待裁决

| # | 问题 | 推荐 | 备选 |
|---|---|---|---|
| 1 | F（家庭）/ H（合伙）放哪？ | **F 并入 `user_p`，H 并入 `user_c`，域标签保留** | 四个独立文件 |
| 2 | 商户是否可作为锚点目标？ | **不可以**；商户只是建议 facet | 可挂商户（会破坏计数树） |
| 3 | 内部节点是否允许泛化记账？ | **不允许**；用 `.GENERAL` 叶子 | 允许挂内部节点（会产生汇总歧义） |
| 4 | 公共视图默认域？ | **默认当前域，显式“全部”才跨域** | 总是全局 |
| 5 | 首版叶子规模？ | **约 140–160 个叶子（总节点约 180–200）**，覆盖矩阵先行 | 先做 60–80 个核心，长尾后补 |
| 6 | 母树是否给“权威简码”？ | **只给推荐简码**；简码权威在私人树，按域查重 | 母树权威简码（会变成公共契约，P/C 冲突难解） |
| 7 | 中英是否建两个节点？ | **不建**；一个节点一对 label | 建 `*.ZH` / `*.EN` 两个节点（会破坏层叠与汇总） |

---

## 九、验收清单

- [ ] 母树是单根、单父、无环、层叠的计数树；
- [ ] 每个内部节点有 `.GENERAL` 叶子；只有叶子可记账；
- [ ] 深度 ≤3，分支 2–12，别名全树唯一；
- [ ] 一个概念一个顶点；每个节点中英文名成对非空；
- [ ] 切 `zh/en` 不改变树、锚点、汇总数字；
- [ ] 母树只给推荐简码；私人树按域定稿简码，P/C 可同码；
- [ ] 商户/标签/行为是 facet，不进计数树；
- [ ] 新保险库直接 v3，P/C 拆分；同码可共存、各域各自解析；
- [ ] 锚点只能挂叶子；未确认不写；异极不静默翻转；
- [ ] 公共报表前推对账相等；未归类/失效单独；
- [ ] 建议器只建议；编造 ID 被拒；模型不可用可降级；
- [ ] 原有 108 条 Node、121 条门禁仍全绿（当前 198 / 158）；
- [ ] 新增图算法/拆分/锚点/报表/建议器测试全绿；
- [ ] 单文件构建、`file://` 冒烟、E2E 全绿。

---

## 十、本次没有做什么

- 没有改任何代码；
- 没有改任何用户数据/保险库；
- 没有执行迁移；
- 没有生成最终 `system.dict`（先定图论模型和叶子清单，再生成）。
