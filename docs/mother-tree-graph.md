# 母树的图论模型

> 回答：**能。** 但“结构清晰”不是靠把分类画得更细，而是靠三条约束：
> **单一父级、层叠集合、叶子可记账。**
>
> 母树不是 DAG，不是格（lattice），也不是一张大网。
> 它是一棵**层叠树（laminar arborescence）**，外加几组**分离的 facet 图**。
> 细节留给私人子树，语义交叉留给 facet，计数只走树。

---

## 一、先把四个图分开

TxtVein 里同时存在四种图，混在一起就会“看起来复杂”：

| 图 | 节点 | 边 | 用途 |
|---|---|---|---|
| **账本图 L** | 会计节点、事件 | `from → to`，金额/时间/标签/行为 | 记账事实 |
| **私人树 F** | 用户自己的节点 | `parent_id` | 用户习惯的层级 |
| **母树 T** | 公共分类 | `parent_id` | 公共共识与汇总 |
| **锚点映射 a** | 私人节点 → 母树叶子 | `anchor_id` | 把私人账挂到公共分类 |

再加两组 facet：

```text
商户 facet M     商户 → default_category（横边，不参与汇总）
标签/行为 facet G/B   标签/行为 → 叶子（横边，不参与汇总）
```

**关键**：`a` 是一个**部分函数**（每个私人节点最多一个锚点），不是关系表。
一个私人节点只能挂一个母树叶子；很多私人节点可以挂同一个叶子。
这样公共报表就是一次**前推（pushforward）**，不会重复计数。

---

## 二、母树的正式定义

设：

- `T = (V, E, r)` 是一棵有向根树；
- `r = SYS` 是虚拟根，界面上不显示；
- 每个非根节点 `v` 恰好有一个父节点 `p(v)`；
- 无环、连通，`|E| = |V| - 1`。

给每个节点 `v` 对应一个集合 `S(v) ⊆ U`（`U` 是所有可能的私人记账节点）：

1. `S(r) = U`；
2. 若 `v` 的子节点是 `c1 … ck`，则 `S(c1) … S(ck)` **两两不交**，且并集等于 `S(v)`；
3. 叶子节点 `L` 的集合**两两不交**，并集等于 `U`。

这三条合起来，就是一个**层叠集合族（laminar family）**：

```text
对任意 u, v：S(u) ∩ S(v) 只能是 ∅、S(u)、S(v) 三者之一。
```

一个包含全集、且对任意两个集合要么不交要么包含的集合族，
在数学上**等价于一棵根树**。这就是“清晰”的形式化定义：

> **树的每个内部节点 = 若干子节点的并集；兄弟节点互不重叠；叶子是原子。**

### 2.1 叶子才可记账

```text
postable(v) = true   当且仅当 v 是叶子
```

- 内部节点只做汇总，不能挂 `anchor_id`；
- 叶子是记账原子，只有叶子能挂；
- 每个内部节点补一个 `.GENERAL` 叶子，表示“这一组里未细分”的剩余部分。

例如：

```text
SYS.ACC.EXPENSE                 费用（内部，不可挂）
└─ SYS.CAT.DINING              餐饮（内部，不可挂）
   ├─ SYS.CAT.DINING.GENERAL    餐饮·未细分（叶子，可挂）
   ├─ SYS.CAT.DINING.COFFEE     咖啡茶饮（叶子，可挂）
   ├─ SYS.CAT.DINING.TAKEOUT    外卖（叶子，可挂）
   └─ …
```

为什么一定要 `.GENERAL`：
没有它，`DINING` 的子节点并集只是“已列出的子类”，不覆盖“没细分的餐饮”，
层叠集合的“并集等于父集”就不成立；用户也没法表达“就是一顿饭，不想分类”。

### 2.2 锚点与前推

私人树 `F` 的节点集合记作 `N`，每个节点 `n` 有余额 `b(n)`。
锚点映射：

```text
a : N ⇀ L(T)        部分函数；每个 n 最多一个 a(n)
```

公共报表：

```text
leaf_balance(l) = Σ_{n: a(n)=l} b(n)
node_balance(v) = Σ_{l ∈ leaves(v)} leaf_balance(l)
```

这是一次**测度前推**：先把私人余额推到叶子，再沿树的祖先链上卷。
因为 `a` 是函数、叶子互不交，所以：

```text
Σ_{l∈L} leaf_balance(l) + Σ_{未归类} b(n) + Σ_{失效锚点} b(n) = Σ_{n∈N} b(n)
```

未归类和失效锚点各自单独一桶；失效锚点**不计入**公共合计。
这就是“公共/私人双视图能对上”的图论保证。

### 2.3 双语是标签，不是顶点

中英文不是两个节点，而是同一个顶点的两个 label：

```text
顶点 v = SYS.CAT.DINING.COFFEE
label(v) = { zh: "咖啡茶饮", en: "Coffee" }
```

- 不建 `SYS.CAT.DINING.COFFEE.ZH` / `*.EN` 两个节点；
- 建两个节点会让同一概念变成两个原子，层叠集合被破坏，公共汇总重复；
- 语言切换只换 label，不增加顶点、不增加边，也不改 `parent_id`；
- 简码（`zh_code` / `en_code`）是**私人顶点**的属性；母树的推荐码只是默认值，
  不参与锚点、汇总、身份；
- 母树可以给推荐码，但不承诺全局唯一；私人树按域查重后定稿。

详细规则见 [`mother-tree-bilingual.md`](mother-tree-bilingual.md)。

---

## 三、为什么不是 DAG

DAG 允许多个父级，看起来“语义更丰富”，但对会计汇总是灾难：

```text
咖啡 ──> 餐饮
  └────> 社交
```

如果“咖啡”有两个父级，那么“咖啡”的余额会同时进入餐饮和社交两条祖先链。
要避免重复计数，只有两种办法：

1. **加权**：餐饮 0.7、社交 0.3。用户看不懂，也无法审计；
2. **指定主父级**：其他父级降级为横边。

第 2 种实际上就是“一棵树 + 若干横边”，也就是本方案。
所以：

> **计数骨架必须是树；语义交叉用横边（cross-edge）表达，不进入 `parent_id`。**

DAG 可以用在：

- 商户 facet：商户 → 多个候选分类（横边，带默认值）；
- 标签 facet：一个标签关联多个分类；
- 搜索/推荐：相关分类的图。

这些图**不参与**公共汇总。它们只影响“建议”和“导航”。

### 3.1 为什么不是格（lattice）

格会把多个维度做组合：

```text
餐饮 ∧ 工作 = 商务餐
餐饮 ∧ 社交 = 请客
咖啡 ∧ 工作 = 办公咖啡
…
```

组合数随维度指数增长，用户无法维护，报表也无法解释。
**维度交叉用标签，不用格。**

### 3.2 为什么不是超图

TxtVein 的账本本身已经是超图/多重图：一笔流水可以同时带会计边、行为边、多个标签。
但母树分类的是**节点**，不是流水。把账本超图当成母树，会混淆“钱怎么流”和“钱为了什么”。
两者分开：账本图负责事实，母树负责分类。

---

## 四、三层图结构

```text
┌─────────────────────────────────────────────┐
│ 计数树 T（单父级、层叠、叶子可记账）          │
│ SYS → 六个会计大类 → 组 → 叶子               │
└───────────────▲─────────────────────────────┘
                │ a：部分函数，最多一个锚点
┌───────────────┴─────────────────────────────┐
│ 私人森林 F（P/C 两组，各自 parent_id）        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 商户 facet M（独立森林/扁平表）               │
│ 商户 --default_category--> T 的叶子（横边）   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 标签 facet G / 行为 facet B（后续）           │
│ 标签/行为 --related--> T 的叶子（横边）       │
└─────────────────────────────────────────────┘
```

### 4.1 商户为什么不能进计数树

“星巴克”通常属于咖啡，但“亚马逊”可能属于购物、图书、数码、云服务。
把商户作为分类树的子节点，会逼它选一个父级，破坏层叠性；选错了，公共报表就错。

所以：

- **商户是 facet，不是锚点目标。**
- 商户节点带一个 `default_category` 横边，指向某个可记账叶子；
- 用户私人节点仍然锚到叶子（例如 `DINING.COFFEE`）；
- 建议器用“商户 → default_category”做先验，最终仍由用户选叶子。

这样“星巴克”“瑞幸”“拿铁”都可以是私人子树里的细节，
母树只保留“咖啡茶饮”这个公共分类。

### 4.1b 银行为什么是独立的银行子树

银行同时可能有储蓄账户（资产）和信用卡/贷款账户（负债）。
如果银行是一个计数树节点，它只能有一个会计大类，无法同时容纳储蓄和借贷；
如果每家银行在资产、负债各建一个节点，计数树会被 50+ 家银行撑爆。

所以银行是**独立 facet**：

```text
SYS.BANK.ICBC 中国工商银行
  ├─ 储蓄分类 → SYS.CAT.BANK.DEBIT（资产叶子）
  └─ 借贷分类 → SYS.CAT.CREDIT_CARD（负债叶子）
```

- 银行不是锚点目标；
- 选“工商银行储蓄” → 锚 `BANK.DEBIT`；
- 选“工商银行信用卡” → 锚 `CREDIT_CARD`；
- 银行子树可以列全 56 家、继续加，不影响计数树的层叠和汇总。

### 4.2 标签/行为为什么不能进计数树

- “工作”“报销”“家庭”“冲动”“开心”是横切维度，不是会计分类；
- 一个支出可以同时是“工作”“旅行”“可报销”；
- 把它们做成树节点，会逼出多父级或重复节点。

它们是 facet，挂横边；公共报表不按 facet 汇总，除非以后做专门的分析视图。

---

## 五、结构清晰的条件（可直接变成测试）

| 编号 | 条件 | 检查方法 |
|---|---|---|
| G1 | 只有一个根 `SYS` | 入度为 0 的节点恰好 1 个 |
| G2 | 每个非根恰好一个父级 | 入度恰好 1 |
| G3 | 无环、连通 | DFS 环检测 + 可达性 |
| G4 | `|E| = |V| - 1` | 边数校验 |
| G5 | 层叠：任意两节点的叶子集不交或包含 | 自底向上算叶子集，两两比较 |
| G6 | 内部节点至少 2 个子节点 | 不允许单链 |
| G7 | 每个内部节点有 `.GENERAL` 叶子 | 子节点里存在 `*.GENERAL` |
| G8 | 只有叶子可记账 | `postable = children.length === 0` |
| G9 | 深度 ≤ 3（`SYS` 算 0） | 最长路径 |
| G10 | 分支因子 2–12，最大 ≤15 | 子节点计数 |
| G11 | 别名全树唯一，一个别名只指向一个叶子 | 别名表查重 |
| G12 | 锚点是部分函数，最多一个，且目标必须是叶子 | 编译/校验 |
| G13 | 横边不是父边，不参与祖先链 | 边类型检查 |
| G14 | 公共/私人对账相等 | 前推等式 |
| G15 | 覆盖率/歧义率达标 | 用日常行为样本测 |
| G16 | 一个概念一个顶点，不建中英重复节点 | 统计 `zh_name` / `en_name`，不允许 `*.ZH` / `*.EN` |
| G17 | 每个节点中英文名成对非空 | 解析时校验 |
| G18 | 切语言不改变树、锚点、报表 | 同账本切 `zh/en`，节点/边/锚点/汇总数全等 |
| G19 | 私人简码按域唯一，P/C 可同码 | `seen[kind][domain]` |
| G20 | 母树推荐码不是身份 | 改推荐码不改 ID/锚点/哈希 |
| G21 | 银行 facet 不占计数树；储蓄/借贷两列 | 银行 ID 不在 T；储蓄→资产叶子，借贷→负债叶子 |

> G5 是核心。只要层叠成立，树就是清晰的；不成立，画得再漂亮也会在报表里打架。

---

## 六、怎么建这棵树：叶子优先

不要从“会计大类”往下拍脑袋分。反过来：

### 第一步：列叶子

从真实的日常记账动作出发，列出“原子分类”。
每个叶子必须是**互斥**的：一笔支出只能落在一个叶子里。
拿不准的，先放进 `.GENERAL`，不要造重复节点。

### 第二步：每层只用一个切分标准

```text
第一层：会计大类（费用/成本/资产/负债/收入/权益）
第二层：用途/生活领域（餐饮/交通/居住/…）
第三层：叶子（咖啡/外卖/公交/房租/…）
```

不要在“餐饮”下面同时按“早中晚”和“中餐西餐”切，否则交叉。
一层一个标准，层叠才成立。

### 第三步：补 `.GENERAL`

每个有子节点的组，补一个“未细分”叶子。它保证：
- 子节点并集 = 父节点；
- 用户永远有一个合法的“我就记个大类”的出口；
- “未归类”仍然是另一个独立桶，不会被 `.GENERAL` 偷走。

### 第四步：遇到语义重叠，二选一

1. **按上下文拆成两个叶子**（推荐）；
2. **移到 facet/标签**（横切维度）。

例子：

| 概念 | 不要做成 | 正确做法 |
|---|---|---|
| 商务餐 | 餐饮 + 工作 双父级 | 个人 `DINING.GROUP_MEAL`；公司 `WORK.BUSINESS_MEAL`，按上下文两个叶子 |
| 咖啡 | 餐饮 + 社交 + 工作 三父级 | 一个 `DINING.COFFEE`；“工作/社交”用标签 |
| 房租 | 居住 + 工作 双父级 | `HOUSING.RENT` 与 `WORK.OFFICE_RENT` 两个叶子 |
| 工资 | 收入 + 公司费用 双父级 | `INCOME.SALARY`（员工侧）与 `WORK.PAYROLL`（公司侧）两个叶子 |
| 社保 | 资产 + 费用 双父级 | `ASSET.SOCIAL_SECURITY`（个人账户）与 `WORK.SOCIAL_INSURANCE`（公司支出）两个叶子 |
| 信用卡还款 | 费用 | 不是费用；是资产↔负债的转账，用账户节点，不挂费用叶子 |
| 贷款月供 | 一个“房贷”叶子 | 拆本金（负债减少）与利息（`FINANCE.LOAN_INTEREST` 费用） |

**按上下文拆叶子**会增加一些节点，但保住了单父级和层叠性；
这比多父级 DAG 清晰得多。

### 第五步：商户/标签/行为另建 facet

- 商户：独立表，`default_category` 指向叶子；
- 标签：独立表，横切维度；
- 行为：独立表，行为层专用。

### 第六步：用图算法验收

```text
DFS 环检测
入度统计
叶子集自底向上合并
两两层叠检查
最长路径/分支因子
别名唯一性
锚点函数检查
公共/私人前推对账
```

这些都是纯函数，能直接进 `node --test`。

---

## 七、覆盖矩阵：日常记账行为 → 叶子

这张表用来证明“覆盖足够全”，不是用来列所有品牌。
每个日常动作都能落在一个叶子上；品牌/门店留在私人子树。

| 日常动作 | 母树叶子（示例） |
|---|---|
| 早餐 / 午餐 / 晚餐 | `DINING.BREAKFAST` / `LUNCH` / `DINNER` |
| 咖啡 / 奶茶 / 外卖 / 夜宵 | `DINING.COFFEE` / `TAKEOUT` / `LATE_NIGHT` |
| 聚餐 / 请客 | `DINING.GROUP_MEAL` / `SOCIAL.TREAT` |
| 商务宴请 | `WORK.BUSINESS_MEAL` |
| 公交地铁 / 打车 / 单车 | `TRANSPORT.PUBLIC_TRANSIT` / `RIDE_HAILING` / `BIKE` |
| 加油 / 充电 / 停车 / 过路 | `TRANSPORT.FUEL` / `CHARGING` / `PARKING` / `TOLL` |
| 高铁 / 飞机 / 修车 / 违章 | `TRANSPORT.TRAIN` / `FLIGHT` / `CAR_MAINTENANCE` / `TRAFFIC_FINE` |
| 房租 / 房贷利息 / 物业 | `HOUSING.RENT` / `MORTGAGE_INTEREST` / `PROPERTY_FEE` |
| 水 / 电 / 燃气 / 取暖 | `HOUSING.WATER` / `ELECTRICITY` / `GAS` / `HEATING` |
| 维修 / 家具家电 / 保洁 / 搬家 | `HOUSING.REPAIR` / `FURNITURE_APPLIANCE` / `CLEANING` / `MOVING` |
| 超市 / 日用 / 服装 / 美妆 | `SHOPPING.SUPERMARKET` / `DAILY` / `CLOTHING` / `BEAUTY` |
| 数码 / 书籍 / 礼物 | `SHOPPING.ELECTRONICS` / `BOOKS` / `GIFTS` |
| 话费 / 宽带 / 软件 / 云 | `COMMUNICATION.MOBILE` / `BROADBAND` / `SOFTWARE` / `CLOUD` |
| 门诊 / 住院 / 药品 / 体检 | `HEALTH.CLINIC` / `HOSPITAL` / `PHARMACY` / `CHECKUP` |
| 牙科 / 眼科 / 心理咨询 / 健身 | `HEALTH.DENTAL` / `OPTICAL` / `PSYCHOLOGY` / `FITNESS` |
| 学费 / 培训 / 考试 / 留学 | `EDUCATION.TUITION` / `TRAINING` / `EXAM` / `STUDY_ABROAD` |
| 电影 / 演出 / 游戏 / 订阅 | `ENTERTAINMENT.MOVIE` / `SHOW` / `GAME` / `SUBSCRIPTION` |
| 旅行交通 / 住宿 / 门票 / 签证 | `TRAVEL.TRANSPORT` / `ACCOMMODATION` / `TICKETS` / `VISA` |
| 红包 / 礼物 / 婚礼 / 捐赠 | `SOCIAL.RED_PACKET` / `GIFT` / `WEDDING` / `DONATION` |
| 育儿 / 奶粉 / 托育 / 赡养 | `FAMILY.CHILDCARE` / `DIAPERS` / `PRESCHOOL` / `ELDER_CARE` |
| 宠物食品 / 医疗 / 用品 | `FAMILY.PET_FOOD` / `PET_VET` / `PET_SUPPLIES` |
| 寿险 / 医疗险 / 车险 / 旅行险 | `INSURANCE.LIFE` / `MEDICAL` / `CAR` / `TRAVEL` |
| 个税 / 增值税 / 房产税 | `TAX.INCOME_TAX` / `VAT` / `PROPERTY_TAX` |
| 手续费 / 利息 / 投资亏损 / 外汇 | `FINANCE.BANK_FEE` / `INTEREST` / `INVESTMENT_LOSS` / `FX_FEE` |
| 办公租金 / 水电 / 用品 / 设备 | `WORK.OFFICE_RENT` / `OFFICE_UTILITIES` / `OFFICE_SUPPLIES` / `EQUIPMENT` |
| 差旅 / 住宿 / 招待 | `WORK.TRAVEL` / `TRAVEL_HOTEL` / `BUSINESS_MEAL` |
| 推广 / 研发 / 外包 / 咨询 | `WORK.MARKETING` / `RND` / `OUTSOURCING` / `CONSULTING` |
| 法务 / 会计 / 薪酬 / 社保 | `WORK.LEGAL` / `ACCOUNTING` / `PAYROLL` / `SOCIAL_INSURANCE` |
| 物流 / 仓储 / 样品 / 展会 | `WORK.LOGISTICS` / `WAREHOUSING` / `SAMPLE` / `EXHIBITION` |
| 原材料 / 库存 / 包装 / 生产人工 | `COST.MATERIAL` / `INVENTORY` / `PACKAGING` / `LABOR` |
| 厂房租金 / 水电 / 制造费用 / 质检 | `COST.FACTORY_RENT` / `UTILITIES` / `OVERHEAD` / `QUALITY` |
| 现金 / 微信 / 支付宝 / 银行卡 | `ASSET.CASH.*` / `BANK.*` |
| 信用卡 / 花呗 / 房贷 / 车贷 | `LIABILITY.CREDIT_CARD` / `HUABEI` / `MORTGAGE` / `CAR_LOAN` |
| 应收 / 预付 / 押金 / 投资 | `ASSET.RECEIVABLE.*` / `PREPAYMENT` / `DEPOSIT` / `INVESTMENT.*` |
| 社保账户 / 公积金 | `ASSET.SOCIAL_SECURITY` / `HOUSING_FUND` |
| 工资 / 奖金 / 兼职 / 经营 | `INCOME.SALARY` / `BONUS` / `PART_TIME` / `BUSINESS_REVENUE` |
| 利息 / 股息 / 租金 / 投资收益 | `INCOME.INTEREST` / `DIVIDEND` / `RENT` / `INVESTMENT_GAIN` |
| 退款 / 礼金 / 补贴 / 理赔 | `INCOME.REFUND` / `GIFT` / `SUBSIDY` / `INSURANCE_CLAIM` |
| 期初 / 留存 / 资本 / 分红 | `EQUITY.OPENING` / `RETAINED` / `CAPITAL` / `DIVIDEND` |

这张表覆盖了个人、家庭、公司、合伙的常见流水。
品牌（星巴克、美团、滴滴、京东…）不在这张表里，它们在商户 facet 或私人子树里。

---

## 八、借鉴的先进模式

| 模式 | 出处 | 借什么 | 不借什么 |
|---|---|---|---|
| **会计科目树**：主分支是汇总，叶子是账户/费用类；科目码用于排序；报表只显示主分支 | [GnuCash · Creating a Chart of Accounts](https://code.gnucash.org/website/docs/v2.2/C/gnucash-help/chart-create.html) | 单父级树、内部节点汇总、叶子可记账、`sort` 排序 | 4 层以上的深树；TxtVein 控制在 3 层 |
| **五类根 + 冒号命名 + 开/关账户** | [Beancount 账户管理指南](https://beancount.io/blog/2026/02/08/beancount-account-management-complete-guide) | 六类根（加成本）、稳定 ID、账户生命周期/弃用 | 冒号语法；TxtVein 用 `SYS.*` |
| **两级 primary/detailed 分类；转账、贷款发放/还款、银行费用单列；多数组有 Other/兜底** | [Plaid PFC 文档](https://plaid.com/docs/api/products/transactions/#personal-finance-category) · [PFCv2 全表 CSV](https://plaid.com/documents/pfc-taxonomy-all.csv) | 两级封顶、转账/贷款本金与利息分开、每组 `.GENERAL`/`OTHER` 兜底 | 交易级标签；TxtVein 锚的是节点 |
| **类别组 + 类别；折叠/隐藏/合并/备注；收入单独一组** | [Actual Budget · Categories](https://actualbudget.org/docs/budgeting/categories/) | 组头、折叠、隐藏、合并时迁移引用、备注、收入独立 | 信封预算语义；TxtVein 不做预算 |
| **搜索优先的树形选择器**：输入过滤、空状态、可新增 | [Planview · Combobox Tree](https://design.planview.com/components/forms/combobox-tree/anatomy) | 搜索框 + 树、面包屑、空状态、从搜索直接新增 | 深层逐级点击 |
| **分面分类（faceted classification）**：不同维度分开，不塞进一棵树 | [FAA · Utilization of Faceted Classification](https://www.faa.gov/sites/faa.gov/files/air_traffic/technology/swim/governance/Utilization%20of%20Faceted%20Classification-SWIM%20Service%20Registry.pdf)（类比参考） | 类型/用途/商户/标签/行为分开 | 把横切维度做成树节点 |

这些模式的共同点不是“树越深越专业”，而是：

> **一棵浅的计数树 + 若干分离的 facet + 严格的单一父级。**
> 成熟的系统都把“分类”和“标签/商户/预算”分开，只有 TxtVein 这种图账本更需要明确边界。

---

## 九、落到 TxtVein

### 9.1 `system.dict` 分区

```text
[Tree]        计数树：单父级、层叠、叶子可记账
[Alias]       别名：ID | lang | 别名（中英分开）
[Merchant]    商户 facet：default_category 横边
[Bank]        银行 facet：储蓄分类 / 借贷分类 两列
[Tag]         标签 facet（预留）
[Behavior]    行为 facet（预留）
```

`[Tree]` 行（10 列）：

```text
ID | 中文名 | 英文名 | @父ID | kind | 大类 | 中文推荐码 | 英文推荐码 | 权重 | 排序
```

- `kind`：`root` / `type` / `category`；
- `大类` 只写在 `type` 行；
- `postable` 由“是否有子节点”推导，不手写；
- `.GENERAL` 叶子显式写；内部节点必须有；
- 叶子有中英推荐码；内部节点不写码；
- 别名全树按语言唯一。

`[Merchant]` 行（7 列）：

```text
ID | 中文名 | 英文名 | default_category | 中文推荐码 | 英文推荐码 | 权重
```

- `default_category` 必须指向 `[Tree]` 的可记账叶子；
- 商户不是锚点目标，只用于建议；
- 一个商户可以有多个候选分类（横边），`default_category` 只是先验。

`[Bank]` 行（6 列）：

```text
ID | 中文名 | 英文名 | 储蓄分类 | 借贷分类 | 权重
```

- 储蓄分类必须是资产叶子；借贷分类可以是 `-` 或负债叶子；
- 银行不是锚点目标；选银行后锚到储蓄/信用卡叶子；
- 银行子树列全，不参与计数树。

### 9.2 锚点规则

- 私人节点 `anchor_id` 只能指向 `[Tree]` 的**叶子**；
- 不指向内部节点、商户、标签、行为；
- 一个私人节点最多一个锚点；
- 类型/极性从叶子的祖先链继承；
- 异极改锚点要显式确认，不能静默翻转历史余额。

### 9.3 公共报表

```text
private balance --a--> leaf balance --ancestors--> public tree balance
```

- 未归类：`a(n)` 未定义；
- 失效锚点：`a(n)` 不在当前 `[Tree]` 叶子集合；
- 失效锚点单独警告，不计入公共合计；
- 对账等式必须成立。

### 9.4 建议器

```text
清洗 → 母树别名/私人别名精确匹配 → 商户 facet 的 default_category → 本地模型排序
```

- 模型只从候选叶子里选；
- 编造的 ID 丢弃；
- 永不自动写 `anchor_id`；
- 模型不可用，确定性匹配 + 手动选择仍然完整。

### 9.5 UI

- 搜索优先的树形选择器：输入“咖啡”，直接显示“费用 / 餐饮 / 咖啡茶饮”；
- 组头可折叠；常用/最近放前面；
- 不显示 `SYS.` ID，只显示路径；
- “未归类”是独立入口，不是“其他”；
- `.GENERAL` 叶子显示为“餐饮（未细分）”，不是“其他”。

---

## 十、结论

**能构建结构清晰的母树，但清晰来自约束，不来自节点数量。**

一句话版本：

> **母树 = 一棵以可记账叶子为原子的层叠树（laminar arborescence）
> + 商户/标签/行为等分离的 facet 图
> + 一个从私人节点到叶子的部分函数锚点。
> 计数只走树，语义交叉走横边。**

这样做的好处：

1. **单一父级** → 每个节点只有一条路径，面包屑清晰；
2. **层叠集合** → 兄弟不重叠，汇总可加，不重复计数；
3. **叶子可记账** → 内部节点只汇总，锚点目标明确；
4. **facet 分离** → 商户、标签、行为不破坏树；
5. **部分函数锚点** → 公共报表是前推，天然对账；
6. **图算法可验收** → 环、入度、层叠、深度、分支、覆盖率都能测。

下一步不是继续加节点，而是：
1. ~~按“叶子优先”列出一版叶子（约 140–160 个）；~~ **已落地：190 节点 / 162 叶子 / 56 银行 / 30 商户。**
2. ~~用 G1–G21 跑图算法验收；~~ **已落地：`tests/system-*.test.cjs` 51 条全过。**
3. 再写 `system.dict` 和接线代码——`system.dict`、数据层、v3 保险库、
   P/C 拆分已完成；下一步是锚点与公共报表。
