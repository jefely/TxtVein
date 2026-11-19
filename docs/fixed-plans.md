# 固定收支 · 与 NT 账本对齐的独立表

> 状态：v2.5.0 已实现
> 对应 NT 账本：`nt/README.md` §八、`core/schema.js` 的 `createScheduled`、
> `core/plan-occurrence.js`、`core/installment-engine.js`、`timeline/time-state.js`。
> 两个软件**数据互通、理念同一**，只有交互形态不同：NT 是表格，TxtVein 是文本表。

---

## 1. 定位

固定收支在 TxtVein 里是一张**独立的表**（`fixed.tv`，存在保险库里），
不并进流水文本。它有两个大区域：

```text
[固定]   固定收支（每月 / 每日）
[分期]   分期记录（带 inst 的计划流水）
```

固定表**定期向流水记录的未来区域添加流水**：

- 每月固定：到期自动落成真实流水；
- 每日固定：只在未来区摆「今天」一条，确认才落账；
- 分期：按月份摆出每一期，确认才落账。

流水文本只放已经发生的钱；未来区和固定表都是派生视图。

---

## 2. 行形

行形和流水完全一样，只是最前面的日期换成 `每日` / `每月16日` / `每年11月16日`，
最后面挂 `*d` / `*m` / `*y`：

```text
[固定]
// 与流水同形：每日 / 每月16日 / 每年11月16日 + 转出 > 转入 金额 < 标签 *d|*m|*y  // 备注
每月16日 wx1 > rent 1000 < xf *m // 房租
每日 wx1 > din 5 *d // 早餐
停用 每月20日 wx1 > din 15 *m // 视频会员（已暂停）

[分期]
// 分期：同上 + 期数=N 首月=YYMM 本金=… 利息=…；备注后用 | 接 生成=/确认=/作废=
每月5日 wx1 > mac 1060 *m 期数=12 首月=2608 本金=12000 利息=720 // 电脑
```

规则：

| 片段 | 含义 |
|---|---|
| `每日` / `每月N日` / `每年M月N日` | 频率与日期（`*d/*m/*y` 也可显式写） |
| `转出 > 转入 金额` | 每个发生期的金额（分期 = 每期本息合计） |
| `< 标签` | 与流水相同的标签语法 |
| `*d` / `*m` / `*y` | 周期标记，和流水录入一致 |
| `// 备注` | 固定表模板备注（NT 的 `note`） |
| `期数=N 首月=YYMM 本金=… 利息=…` | 仅分期 |
| `停用 ` 前缀 | 暂停（TxtVein 扩展；NT 里用删除） |
| `| 生成=… 确认=… 作废=…` | 期状态，见 §4 |

---

## 3. 与 NT `scheduled` 的字段对应

| NT `createScheduled` | TxtVein plan | 备注 |
|---|---|---|
| `freq: 'daily' \| 'monthly'` | `period: 'd' \| 'm'`（另有 `'y'` 扩展） | — |
| `day` | `day` | 每月几号；每日不用日期 |
| `from_id` / `to_id` | `from` / `to` | 编译时由简码/名字解析成节点 ID |
| `amount`（元） | `amountCents`（分） | 每期金额；分期 = 每期本息合计 |
| `note` | `note` | 行尾 `//` 注释 |
| `inst.periods` | `inst.periods` | 期数 |
| `inst.firstMonth`（`YYYY-MM`） | `firstMonth`（`YYMM`） | 桥接时互转 |
| `inst.principal` / `inst.interest` | `principalCents` / `interestCents` | 元 / 分互转 |
| `inst.cells`（手填矩阵） | — | TxtVein 暂不接收；按均摊引擎算 |
| `billDay` / `srcTxId` | — | 可选字段，TxtVein 不写 |

`installment-engine` 的口径一致：

```text
perPeriod   = (principal + interest) / periods
principalPer= principal / periods
interestPer = interest / periods
dueMonth    ∈ [firstMonth, firstMonth + periods - 1]
paid        = clamp(monthsBetween(firstMonth, 当前月), 0, periods)
```

`现金流水的备注`：固定 = 模板备注；分期 = `分期还款 第 n/N 期`（NT
`time-state.buildVirtualFixed` 同款）。备注作为行尾 `//` 注释写进流水文本。

---

## 4. 发生语义（与 NT README §八 完全一致）

### 4.1 过去 / 现在 / 未来

| 时期 | 每月固定 | 每日固定 | 分期 |
|---|---|---|---|
| **过去** | 不补历史；只补当前月这一期 | 过期不补、不追问 | 过期不补 |
| **现在** | 到期**自动**落成真实流水（日期 = 当月应发生日） | 未来区只摆**今天**一条，确认才落账 | 未来区摆出每一期，确认才落账 |
| **未来** | 未来区列未来 6 个月，可提前确认 | 不做未来多天预测 | 未来 6 个月逐期列出，可提前确认 |

- 每月固定：日期 = 当月应发生日（31 号在小月钳到月末），**不改成今天**。
- 确认（手点）= 把这一期落成**它自己的日期**的一笔（未来记录本来就按这个日期排；
  NT 的 `confirmOccurrence` 记到今天，TxtVein 在文本表里保留这一期的日期）。
- 自动落账只处理**当前月**，不补更早月份（规则没有开始月，补历史会凭空造账）。

### 4.2 期状态：生成 / 确认 / 作废

每一期用**月 key**（`YYMM`；每日用 `YYMMDD`）记账，写在计划行注释里：

```text
每月16日 wx1 > rent 1000 *m // 房租 | 生成=2610,2611 确认=2612 作废=2701
```

| 状态 | 写入时机 | 效果 |
|---|---|---|
| `生成` | 每月到期自动落账后 | 同一期不再自动补；删掉那笔也不会复活 |
| `确认` | 手点确认后 | 这一期落成真实流水（自己日期），不再出现在未来区 |
| `作废` | 手点「作废这一期」后 | 这一期不再出现、也不再补 |

- 从哪条流水挂出 `*m`：该流水的月份直接记进 `生成`（NT `markPlanHandled`），
  避免到期自动补账时重复落一笔。
- 改了自动落账那一笔的金额：写回固定表模板（NT `syncPlanFromEdit` 的口径）；
  只认 `生成` 月份里唯一一条同流向流水，避免误改别的流水。
- 对应 NT 的 `transactions[].planKey` / `voidedPlans`；桥接函数会互转。

### 4.3 未来区

- 挂在流水最后一行之后、**20 行空行之前**；
- 每月固定 / 分期：往后 **6 个月**（含当前月；已过日子的当前月不摆）；
- 每日：只摆今天；
- **未来记录本身就是流水记录表里的真实文本行**：有最左边那列固定行号，行形和
  现在的流水完全一样（`261216 wx1 > rent 1000 < xf`），按具体日期排好；只是只读。
- 点未来记录最左边的行号，弹出的仍是流水行号菜单
  （删除 / 剪切 / 复制 / 粘贴 / 插入 / 上移），**最后多一个「确认」**。
  只读行上「粘贴 / 插入 / 上移」灰掉；**删除 / 剪切 = 作废这一期**（不改正文，
  与 NT 的 virtual delete 同义）；复制可用。确认后这一期落成真实流水，从未来区消失。
- 20 行空行在最后一条正文之后、未来记录之前；未来记录之后还有 10 行不可见的
  底部空高，保证「最后 10 条正文顶到视口上方」。

---

## 5. 固定表聚合

固定页底部两行（NT `getSchedulerSummary` 口径）：

```text
固定 N 条 · 每月收入 ¥… / 支出 ¥… · 每日收入 ¥… / 支出 ¥…
分期 M 条 · 未还本金 ¥… / 利息 ¥…
```

- 收入 = 转入节点是收入类；其余按支出。
- 分期剩余 = 每期本金/利息 × 剩余期数。

---

## 6. 互通

| 方向 | 函数（`js/core/nt-bridge.js`） |
|---|---|
| TxtVein → NT | `plansToScheduled(plans, dict)`、`toNTState(dict, events, plans)` |
| NT → TxtVein | `scheduledToPlans(scheduled, dict)`、`scheduledToFixedSource(...)`、`fromNTState(state)` |

- `toNTState` 会把 `生成/确认` 还原成流水的 `planKey`，把 `作废` 还原成 `voidedPlans`。
- `fromNTState` 会读 `state.scheduled`，把 `planKey` / `voidedPlans` 搬回计划行状态。
- 单文件 TXT 导出/导入多了一段 `## 固定`（NT 的「固定 / 分期」表可以据此搬运）。
- NT 的 `.xlsx` 四张表（流水 / 设置 / 分期 / 固定）仍是它自己的主通道；
  字段对应见 §3。

---

## 7. 与 NT 的唯一差异

- TxtVein 行形是**文本**（NT 是单元格表格），但一行就是 NT 的一行；
- TxtVein 多一个 `*y`（每年）与 `停用` 前缀（NT 用删除）；
- NT 的 `inst.cells` 手填矩阵暂不接收，统一走本息均摊；
- 备注 / 本金 / 利息都以文本里的显式字段保存，不藏在 JSON 里。

---

## 8. 实现位置

| 层 | 文件 | 职责 |
|---|---|---|
| 固定表文本 | `js/core/source.js` | `[固定]/[分期]` 段解析、投影、备注/状态/分期字段 |
| 发生语义 | `js/core/rules.js` | `materializeDue` / `futureOccurrences` / `confirmOccurrence` / `voidOccurrence` / `installmentInfo` |
| 未来区界面 | `js/ui/plan-view.js`、`js/ui/editor.js` | 6 个月虚拟期、只读文本行、行号菜单 + 确认 |
| 固定页 | `js/ui/app.js` | `fixed.tv` 编辑器、聚合行、写回 |
| 互通 | `js/core/nt-bridge.js` | scheduled ↔ plan、`toNTState` / `fromNTState` |
| 测试 | `tests/rules.test.cjs`、`tests/nt-bridge.test.cjs` | 语义 / 互通对照 |
