# 事件模型（Event）· 从 Behavior 到 Event

> 状态：**概念定稿，代码尚未改名**。
> 现有代码里仍用 `H_`（行为项）与 `B_`（行为边）命名；
> 本文定义“事件”作为更高层的核心实体，并给出兼容迁移路径。

---

## 一、结论

**Event 是伞，Behavior 只是 Event 的一个子集。**

- 行为：主语必须是人，强调“我主动做了什么”；
- 事件：主语可以是人、环境、身体、潜意识，强调“发生了什么、谁承受了变化”。

但“统一成 Event”不等于“所有事件用同一种计量单位”。必须保留三条量纲：

| kind | 单位 | 例子 | 是否进 A/B 平账 |
|---|---|---|---|
| `money` | 整数分 `amountCents` | `微信 > 餐饮 35` | 是 |
| `time` | 整数分钟 `minutes` | `时间 > 乒乓球 120m` | 否（时间代币） |
| `state` | 整数强度 `weight` | `写作 > 心流 1` | 否（状态池） |

以及五个场域（身心灵 + 社会）：

| field | 含义 | 例子 |
|---|---|---|
| `physical` | 物理/外部世界 | 微信、餐饮、时间、金钱 |
| `biological` | 身体/生理 | 健康、疲劳、精力、睡眠 |
| `mental` | 心理/意识 | 心流、焦虑、平静、内耗 |
| `social` | 关系/社会 | 老板、伴侣、同事、孤独、支持 |
| `spiritual` | 意义/价值 | 使命、信念、敬畏、存在感 |

**统一的是“事件语法”，不是“计量单位”。**
A/B 双极平账只属于 `money`；`state` 用权重；`time` 用分钟。

---

## 二、Event 的数据结构

```text
Event {
  id,                 // E_ 货币/时间事件；B_ 状态事件（暂保留旧前缀）
  kind,               // money | time | state
  field,              // physical | biological | mental | social | spiritual
  voice,              // id | ego | superego | external | subconscious | body
  relation,           // flow | conflict | support（默认 flow）
  date,               // YYMMDD
  from, to,           // 源节点 → 目标节点
  amountCents?,       // money
  minutes?,           // time
  weight?,            // state
  tagIds[],
  chainId,            // 同一行展开的多条原子事件共享
  sourceLine,
  raw
}
```

`voice` 是“谁在说话”，不是“谁对谁错”：

- `id`：冲动/欲望/即时满足；
- `ego`：调节/选择/边界/延迟满足；
- `superego`：应该/内疚/羞耻/自我批评；
- `external`：外部事件/他人/环境；
- `subconscious`：说不清来源的涌现；
- `body`：身体信号（疲劳、疼痛、饥饿）。

`relation` 区分“能量流动”和“冲突/支持”：

- `flow`：`from > to weight`，真实转移；
- `conflict`：两股力量拉扯，不写成 `本我 > 超我` 这种伪转移；
- `support`：支持/滋养。

一条源码行可以展开多条原子事件：

```text
老板骂我 > 内耗 > 报复性消费 500
```

展开为：

```text
B_xxx  老板骂我 > 内耗        kind=state, field=mental, voice=external
E_xxx  老板骂我 > 报复性消费   kind=money, field=physical
```

两条共享同一个 `chainId`，所以能顺着图做跨域溯源。

---

## 三、节点：从“行为项”升级为“事件节点”

节点不只分会计类型，还要分**角色**与**场域**：

```text
Node {
  id,                 // N_ 现实节点；H_ 事件节点（H = Happening）
  role,               // account | category | source | state | merchant
  field,              // physical | biological | mental | social | spiritual
  voice?,             // id | ego | superego | external | subconscious | body
  zh_name / en_name / zh_code / en_code
  parent_id, weight, sort, system
  anchor_id?          // 只有会计节点挂母树叶子
}
```

- `source`：事件源（写作、跑步、被裁员、看到朋友圈、潜意识）；
- `state`：状态池（心流、焦虑、健康、疲劳、内耗）；
- `account/category`：会计账户/分类（微信、餐饮、房租）；
- `merchant`：商户 facet；
- `tag`：横切标签（未捕捉、工作、家庭）。

`H_` 不再是“行为项”，而是 **Happening 节点**；`B_` 不再是“行为边”，
而是 **状态事件边**。用户界面统一叫“事件”。

---

## 四、语法

### 4.1 货币事件

```text
微信 > 餐饮 35
微信 > 餐饮 35 < 咖啡
```

### 4.2 时间事件

```text
时间 > 乒乓球 120m
时间 > 写作 2h30m
```

### 4.3 状态事件

```text
熬夜 > 疲劳 2
吃鱼 > 健康 1
写作 > 心流 1
看到前女友朋友圈 > 焦虑 2
潜意识 > 烦躁 1 < 未捕捉
```

- 数值是正整数强度；`+1` 可等价于 `1`；
- **不用负数表达减少**；用方向表达：
  ```text
  疲劳 > 睡眠 2       // 疲劳流出，睡眠恢复
  焦虑 > 倾诉 1       // 焦虑流出
  ```
- `source` 可以是人、外部刺激、身体、潜意识；
- `state` 是池子，不是“行为”。

### 4.4 跨域链

```text
老板骂我 > 内耗 > 报复性消费 500
```

- 第一段：`state` / `mental`；
- 第二段：`money` / `physical`；
- 共享 `chainId`，报表可按链展开。

---

## 五、A/B 平账与状态权重的边界

必须明确：

1. **A/B 只属于 money**：资产/负债/收入/费用/权益的余额与平账等式不变；
2. **time 不参与金额**：只累计分钟；
3. **state 不参与 A/B**：只累计强度，不要求“资产 = 负债 + 权益”；
4. 跨域链可以同时包含 money/state/time，但每条原子事件只带一种 kind；
5. 公共报表只对**会计节点**做锚点前推；状态节点不挂母树会计叶子。

一句话：

> **统一事件语法，不统一计量单位；统一图，不平账。**

---

## 五之二、自我 / 超我 / 本我：声音，不是账户

Freud 1923 的结构模型（本我 / 自我 / 超我）可以作为**解释性语言**进入事件图，
但**不要**把三者做成三个有余额的会计账户，也不要写成 `本我 > 超我` 这种“伪转移”。

### 推荐映射

| 结构 | 在事件图里的角色 | 典型事件 |
|---|---|---|
| 本我 `id` | 冲动/欲望/即时满足的**源** | `本我 > 刷手机 2 < 冲动` |
| 自我 `ego` | 调节/选择/边界/延迟满足的**过程** | `自我 > 放下手机 1 < 调节` |
| 超我 `superego` | 内化规范/应该/内疚/羞耻的**约束或源** | `超我 > 内疚 2 < 应该` |

- `voice` 字段记录“谁在说话”，不判断好坏；
- `自我` 不是固定实体，而是一组**调节事件**：选择、延迟、边界、反思；
- `超我` 不是道德审判，而是内化的“应该”产生的内疚/羞耻/自我批评；
- `本我` 不是罪恶，而是需求/冲动的快速通道；
- 三者冲突时，用两条事件共享 `chainId` + `relation=conflict`，不要写成转移。

例子：

```text
本我 > 刷手机 2 < 冲动
超我 > 内疚 2 < 应该
自我 > 放下手机 1 < 调节
自我 > 自我关怀 1 < 支持
```

### 重要边界

- Freud 的结构模型是**临床/解释模型**，不是经过验证的三模块脑区图；
- 现代可用 executive function、emotion regulation、self-determination theory、
  IFS/parts、schema modes 等语言，但**不要混着用**；
- `自我/超我` 适合做 `voice` 标签，不适合做 A/B 会计余额；
- 状态权重是主观强度，不是医学测量，不做诊断。

---

## 五之三、压抑 / 释放 / 激励：不是“液压模型”

最常见的错误是把它写成：

```text
压抑 → 积累 → 到阈值 → 爆炸 → 释放 → 轻松
```

这是一个**液压隐喻**，不是可靠的心理机制。更准确的是四条回路：

### 1. 压抑：负强化 + 回避习惯

- Freud 的“压抑”（repression）指把不可接受的内容排除在意识之外；
- 现代研究更多测量的是**抑制**（suppression）与**经验性回避**（experiential avoidance）；
- 机制不是“能量憋住”，而是：
  ```text
  不适 → 压制 → 短期缓解（负强化）→ 压制变成习惯 → 长期负荷上升
  ```
- 短期可能有效，长期可能代价高；不是“压抑一定坏”。

事件写法：

```text
冲动 > 压抑 2 < 抑制
压抑 > 刷手机 1 < 逃避
自我 > 延迟 1 < 调节
```

### 2. 释放：不是所有“发泄”都有效

- “发泄能消气”的 catharsis 假设证据很弱；对愤怒的反复发泄可能**增强**攻击性；
- 更可靠的是：
  - 表达性写作（expressive writing）；
  - 暴露/抑制性学习（exposure / inhibitory learning）；
  - 认知重评（reappraisal）；
  - 社会支持与安全情境；
- “释放”应建模为**具体事件**，不是万能阀门。

事件写法：

```text
压抑 > 写作 2 < 表达
焦虑 > 倾诉 1 < 支持
愤怒 > 运动 2 < 释放
```

### 3. 激励：不是“打鸡血”

- 旧模型：驱力还原（drive reduction）；
- 现代模型：
  - **激励显著性**：想要（wanting）≠ 喜欢（liking）；
  - **奖励预测误差**：多巴胺编码“比预期好/差”；
  - **自我决定理论**：自主、胜任、关系；
  - **心流**：挑战与技能匹配；
  - **目标设定**：具体、有难度、有反馈；
- 激励不是一种“能量”，而是**需要 × 预期 × 反馈**的选择梯度。

事件写法：

```text
需要 > 行动 1 < 内在
行动 > 反馈 1 < 胜任
自我 > 目标 1 < 计划
```

### 4. 动力学：状态池，不是锅炉

```text
load(t+1) = load(t) + inflow(压力/冲动) - outflow(重评/支持/表达)
```

- 只作为**状态池的记账隐喻**，不是精确方程；
- `load` 是主观强度，不是血压/皮质醇；
- 压抑减少短期 outflow，但可能增加长期 load；
- 释放不必然降低 load；关键看是否带来**新学习**（安全、胜任、控制感）。

### 5. 对 TxtVein 的设计含义

- 加 `voice`（本我/自我/超我/外部/潜意识/身体）；
- 加 `relation`（flow/conflict/support）；
- 状态池用 `kind=state`，不参与 A/B；
- 标签可用：`抑制`、`表达`、`逃避`、`支持`、`冲突`、`觉察`；
- 报表看：负荷、短期缓解 vs 长期代价、动机质量（内在/外在）、冲突链；
- 不做诊断，不做道德评判。

### 身心灵整体框架（补充）

| 主题 | 出处 |
|---|---|
| 生物心理社会模型 | [Engel 1977](https://doi.org/10.1126/science.847460) |
| 生物心理社会-灵性模型 | [Sulmasy 2002](https://doi.org/10.1093/geront/42.suppl_3.24) |
| 社会孤立与死亡风险 | [Holt-Lunstad et al. 2015](https://doi.org/10.1177/1745691614568352) |
| 冥想/正念干预 | [Goyal et al. 2014](https://doi.org/10.1001/jamainternmed.2013.13018) |
| 建构情绪/内感受 | [Barrett 2017](https://doi.org/10.1093/scan/nsw154) |
| 意义与存在 | Frankl, *Man's Search for Meaning* (1946) |
| 创伤与身体 | van der Kolk, *The Body Keeps the Score* (2014) |
| 正念减压实践 | Kabat-Zinn, *Full Catastrophe Living* (1990) |

### 研究锚点

| 主题 | 出处 |
|---|---|
| 结构模型（本我/自我/超我） | [Freud, The Ego and the Id (1923)](https://www.cambridge.org/core/books/abs/what-freud-really-meant/new-architecture-of-the-mind-the-ego-and-the-id-1923/0AD4457BB32F602F1BD872E5E6973FF7) |
| 情绪调节过程模型 | [Gross 1998](https://doi.org/10.1037/1089-2680.2.3.271) |
| 经验性回避 | [Hayes et al. 1996](https://doi.org/10.1037/0022-006X.64.6.1152) |
| 表达性写作 | [Pennebaker & Beall 1986](https://doi.org/10.1037/0021-843X.95.3.274) |
| 发泄与愤怒 | [Bushman 2002](https://doi.org/10.1177/0146167202289002) |
| 暴露/抑制性学习 | [Craske et al. 2014](https://doi.org/10.1016/j.brat.2014.04.006) |
| 想要 vs 喜欢 | [Berridge & Robinson 2016](https://doi.org/10.1037/amp0000059) |
| 奖励预测误差 | [Schultz 1997](https://doi.org/10.1126/science.275.5306.1593) |
| 自我决定理论 | [Ryan & Deci 2000](https://doi.org/10.1037/0003-066X.55.1.68) |
| 心流 | Csikszentmihalyi, *Flow* (1990) |
| 主动推断/预测加工 | [Friston 2010](https://doi.org/10.1038/nrn2787) |
| 稳态负荷 | [McEwen 1998](https://doi.org/10.1056/NEJM199801153380307) |
| 自我效能 | [Bandura 1977](https://doi.org/10.1037/0033-295X.84.2.191) |
| 目标设定 | [Locke & Latham 2002](https://doi.org/10.1037/0003-066X.57.9.705) |
| 意志力损耗的复现争议 | [Hagger et al. 2016](https://doi.org/10.1177/1745691616652873) |

> 这些是**解释与设计锚点**，不是诊断标准。状态权重是主观记录，
> 不能替代医学/心理评估。

---

## 六、报表

| 报表 | 消费 | 输出 |
|---|---|---|
| 货币 | `kind=money` | A/B 四列、余额、流量、跨域 |
| 时间 | `kind=time` | 分钟、时间去向 |
| 生理 | `field=biological, kind=state` | 健康/疲劳/精力池的净强度 |
| 心理 | `field=mental, kind=state` | 心流/焦虑/内耗池的净强度 |
| 溯源 | 共享 `chainId` | 外部事件 → 心理 → 物理消费 |

跨域溯源示例：

```text
老板骂我 (external) > 内耗 (mental) > 报复性消费 500 (money)
```

系统可以回答：“外部事件正在吞噬心理能量，并转化为物理支出。”

---

## 七、命名与兼容

现有代码：

- `S.events`：货币/时间事件（`E_`）；
- `S.behaviors`：状态事件（`B_`）；
- `H_`：行为项，升级为事件节点；
- `B_`：行为边，升级为状态事件。

建议：

1. **UI/文案先改**：行为 → 事件；行为项 → 事件节点；
2. **数据字段增量加**：`kind` / `field` / `role`，旧数据默认推断；
3. **`E_` 保留给货币/时间**，避免和状态事件混用；
4. **`B_` 暂保留**，语义改为 state event；若以后要彻底改名，可迁移到 `S_`，
   但这是一次机械重命名，等 Event 模型稳定后再做；
5. `H_` 可以解释为 **Happening**，不必改前缀。

---

## 八、落地顺序

1. **文案层**：页签/报表/帮助里的“行为”改“事件”；输入示例加 `写作 > 心流 1`；
2. **数据层**：给 `H_` 节点加 `role/field`，给 `B_` 事件加 `kind/field`；
3. **解析层**：状态事件推断 `kind=state`；货币/时间保持 `E_`；
4. **报表层**：生理/心理状态池、跨域链；
5. **可选**：`B_` → `S_`、`behaviors` → `stateEvents` 的内部重命名。

---

## 九、结论

> **Event 是事实，Behavior 只是 Event 的子集。**
> 双极图论记录的不只是“我做了什么”，而是“发生了什么、谁承受了变化”。
> 但货币、时间、状态必须各自计量；A/B 平账只属于货币。
