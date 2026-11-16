# 私有树覆盖检查

> 对照对象：`C:\Users\Administrator\Desktop\私有树.txt`（81 个节点）。
> 母树版本：`2026.11.1+bfbcaa…`（190 节点 / 162 叶子 / 56 银行 / 30 商户）。
> 结论先行：**81 个节点全部有落点；银行已列全到独立银行子树；网贷平台不进母树。**

---

## 一、先分清三层 + 一个银行子树

私有树是两层：

```text
会计类型（权益/资产/负债/收入/费用）
  └─ 统计分类（储蓄/现金/网账/信用/网贷/日常/生活/…）
       └─ 私人节点（招行储/微信钱包/早餐/房租/…）
```

母树是三层计数树：

```text
SYS → 会计大类 → 组 → 叶子
```

银行是**独立子树（facet）**：

```text
SYS.BANK.ICBC 中国工商银行
  ├─ 储蓄分类 → SYS.CAT.BANK.DEBIT（资产叶子）
  └─ 借贷分类 → SYS.CAT.CREDIT_CARD（负债叶子）
```

- 银行本身**不是锚点目标**；
- 选“工商银行储蓄”时，私人节点锚到 `BANK.DEBIT`；
- 选“工商银行信用卡”时，私人节点锚到 `CREDIT_CARD`；
- 银行子树列全 56 家，不影响计数树的层叠和汇总。

私有树的“统计分类”是**私人父级**，不是母树的组。
映射时把私人节点挂到**母树叶子**，而不是挂到“日常/生活/保健”这种私人组。

---

## 二、总体覆盖

| 判定 | 数量（约） | 说明 |
|---|---:|---|
| 直接/强匹配 | 60+ | 早餐、房租、地铁、工资、药品等 |
| 可用 `.GENERAL` 或别名 | 10–14 | 快餐、零食、糕点、理发、快递费、彩票、汽车等 |
| 银行/信用卡：银行 facet + 通用叶子 | 11 | 6 个储蓄账户 + 5 张信用卡 |
| 网贷：走通用消费贷，不建平台节点 | 8 | 花呗/借呗/抖音月付等 |
| 结构缺口 | 0 | 实收资本、收入汇总、储值卡已补 |

**所以：能覆盖。** 银行不再要求“每家银行在计数树里建一个资产/负债叶子”，
而是银行子树列全 + 计数树只保留“储蓄/信用卡”两个公共叶子。

---

## 三、逐项映射

### 3.1 权益

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| 权益 / 权益 / QC / 期初余额 | `SYS.CAT.OPENING_EQUITY` | 直接 |
| 权益 / 结转 / SRZ / 收入汇总 | `SYS.CAT.INCOME_SUMMARY` | 直接（已补） |
| 权益 / 投资 / SSZ / 实收资本 | `SYS.CAT.CAPITAL` | 直接（已补） |

### 3.2 资产

| 私人节点 | 银行子树 | 锚点叶子 | 判定 |
|---|---|---|---|
| 储蓄 / ZHC 招行储 | `SYS.BANK.CMB` | `SYS.CAT.BANK.DEBIT` | 银行 facet + 储蓄叶子 |
| 储蓄 / JHC 交行储 | `SYS.BANK.BOCOM` | `SYS.CAT.BANK.DEBIT` | 同上 |
| 储蓄 / GHC 工行储 | `SYS.BANK.ICBC` | `SYS.CAT.BANK.DEBIT` | 同上 |
| 储蓄 / NHC 农行储 | `SYS.BANK.ABC` | `SYS.CAT.BANK.DEBIT` | 同上 |
| 储蓄 / XYC 信用储 | `SYS.BANK.CREDIT_UNION` | `SYS.CAT.BANK.DEBIT` | 同上 |
| 储蓄 / ZGC 中国储 | `SYS.BANK.BOC` | `SYS.CAT.BANK.DEBIT` | 同上 |
| 现金 / XJ 现金 | - | `SYS.CAT.CASH.WALLET` | 直接 |
| 网账 / ZFB 支付宝余额 | - | `SYS.CAT.CASH.ALIPAY` | 直接 |
| 网账 / WX 微信钱包 | - | `SYS.CAT.CASH.WECHAT` | 直接 |
| 充值 / FK 饭卡 | - | `SYS.CAT.CASH.PREPAID` | 直接（已补） |
| 应收 / QYS 其它应收 | - | `SYS.CAT.RECEIVABLE.GENERAL` | 直接 |

### 3.3 负债

| 私人节点 | 银行子树 | 锚点叶子 | 判定 |
|---|---|---|---|
| 信用 / ZHX 招行信 | `SYS.BANK.CMB` | `SYS.CAT.CREDIT_CARD` | 银行 facet + 信用卡叶子 |
| 信用 / JHX 交行信 | `SYS.BANK.BOCOM` | `SYS.CAT.CREDIT_CARD` | 同上 |
| 信用 / GFX 广发信 | `SYS.BANK.CGB` | `SYS.CAT.CREDIT_CARD` | 同上 |
| 信用 / ZXX 中信信 | `SYS.BANK.CITIC` | `SYS.CAT.CREDIT_CARD` | 同上 |
| 信用 / JHX2 交行信 | `SYS.BANK.BOCOM` | `SYS.CAT.CREDIT_CARD` | 同上；两张卡两个私人节点 |
| 网贷 / ZLD 招联贷 | - | `SYS.CAT.CONSUMER_LOAN` | 通用消费贷；不建平台节点 |
| 网贷 / DY 抖音月付 | - | `SYS.CAT.HUABEI` | 通用白条/BNPL；不建平台节点 |
| 网贷 / MT 美团月付 | - | `SYS.CAT.HUABEI` | 同上 |
| 应付 / QYF 其它应付 | - | `SYS.CAT.PAYABLE` | 直接 |
| 网贷 / HB 花呗 | - | `SYS.CAT.HUABEI` | 直接 |
| 网贷 / JB 借呗 | - | `SYS.CAT.CONSUMER_LOAN` | 通用消费贷 |
| 网贷 / 58D 58贷 | - | `SYS.CAT.CONSUMER_LOAN` | 通用消费贷 |
| 网贷 / YXH 宜享花 | - | `SYS.CAT.CONSUMER_LOAN` | 通用消费贷 |
| 网贷 / AYH 安逸花 | - | `SYS.CAT.CONSUMER_LOAN` | 通用消费贷 |

### 3.4 收入

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| 工资 / GZ 工资 | `SYS.CAT.SALARY` | 直接 |
| 外快 / LG 临工 | `SYS.CAT.PART_TIME` | 直接；已加别名“临工” |

### 3.5 费用 · 日常 / 生活

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| S 水 | `SYS.CAT.HOUSING.UTILITIES` | 直接（私人组是“日常”，母树归“居住”） |
| ZC 早餐 | `SYS.CAT.DINING.BREAKFAST` | 直接 |
| KC 快餐 | `SYS.CAT.DINING.GENERAL` | 可挂；GENERAL 已加别名“快餐” |
| SG 水果 | `SYS.CAT.SHOPPING.SUPERMARKET` | 直接 |
| LS 零食 | `SYS.CAT.DINING.GENERAL` | 可挂；GENERAL 已加别名“零食” |
| GD 糕点 | `SYS.CAT.DINING.GENERAL` | 可挂；GENERAL 已加别名“糕点” |
| HF 话费 | `SYS.CAT.COMMUNICATION.MOBILE` | 直接 |
| LF 理发 | `SYS.CAT.SHOPPING.BEAUTY` | 可挂；已加别名“理发” |
| RYP 日用品 | `SYS.CAT.SHOPPING.DAILY` | 直接 |
| KD 快递费 | `SYS.CAT.MISC.SERVICE_FEE` | 可挂；已加别名“快递费” |
| BZ 上班杂费 | `SYS.CAT.MISC.GENERAL` | 可挂；公司口径可用 `WORK.OFFICE_SUPPLIES` |
| MC 买菜 | `SYS.CAT.SHOPPING.SUPERMARKET` | 直接 |
| DC 点餐 | `SYS.CAT.DINING.TAKEOUT` | 近似；也可挂 `DINING.GENERAL` |
| FZ 房租 | `SYS.CAT.HOUSING.RENT` | 直接 |
| SDF 水电费 | `SYS.CAT.HOUSING.UTILITIES` | 直接 |
| WXF 维修费 | `SYS.CAT.HOUSING.REPAIR` | 直接 |

### 3.6 费用 · 保健 / 通勤 / 出行

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| YP 药品 | `SYS.CAT.HEALTH.PHARMACY` | 直接 |
| ZL 治疗 | `SYS.CAT.HEALTH.CLINIC` | 近似；住院用 `HOSPITAL` |
| JK 健康 | `SYS.CAT.HEALTH.GENERAL` | 可挂 |
| DT 地铁、GJ 公交 | `SYS.CAT.TRANSPORT.PUBLIC_TRANSIT` | 直接 |
| GXC 共享车 | `SYS.CAT.TRANSPORT.BIKE_SHARING` | 近似；已加别名“共享车” |
| CZC 出租车 | `SYS.CAT.TRANSPORT.RIDE_HAILING` | 直接 |
| QC 汽车 | `SYS.CAT.TRANSPORT.GENERAL` | 可挂；已加别名“汽车” |
| HC 火车 | `SYS.CAT.TRANSPORT.TRAIN` | 直接 |
| FJ 飞机 | `SYS.CAT.TRANSPORT.FLIGHT` | 直接 |
| JY 加油 | `SYS.CAT.TRANSPORT.FUEL` | 直接 |
| GLF 过路费 | `SYS.CAT.TRANSPORT.TOLL` | 直接 |
| TCF 停车费 | `SYS.CAT.TRANSPORT.PARKING` | 直接 |

### 3.7 费用 · 服饰 / 休闲 / 学习

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| YF 衣服、KZ 裤子、XZ 鞋子、SP 饰品 | `SYS.CAT.SHOPPING.CLOTHING` | 直接；细项留私人树 |
| LY 旅游 | `SYS.CAT.TRAVEL.GENERAL` | 直接 |
| WJ 玩具 | `SYS.CAT.ENTERTAINMENT.HOBBY` | 直接 |
| JS 健身 | `SYS.CAT.HEALTH.FITNESS` | 直接 |
| YX 游戏 | `SYS.CAT.ENTERTAINMENT.GAME` | 直接 |
| YY 影音 | `SYS.CAT.ENTERTAINMENT.MOVIE` / `SUBSCRIPTION` | 近似 |
| CP 彩票 | `SYS.CAT.ENTERTAINMENT.GENERAL` | 可挂；已加别名“彩票” |
| SJ 书籍 | `SYS.CAT.SHOPPING.BOOKS` | 直接 |
| JC 教程 | `SYS.CAT.EDUCATION.ONLINE_COURSE` | 直接；也可挂 `TRAINING` |

### 3.8 费用 · 应酬 / 公益 / 损失

| 私人节点 | 建议母树叶子 | 判定 |
|---|---|---|
| ZK 做客 | `SYS.CAT.SOCIAL.GIFT` | 近似；也可挂 `SOCIAL.GENERAL` |
| SL 送礼 | `SYS.CAT.SOCIAL.GIFT` | 直接 |
| QK 请客 | `SYS.CAT.SOCIAL.TREAT` | 直接 |
| JZ 捐赠 | `SYS.CAT.SOCIAL.DONATION` | 直接 |
| BX 保险 | `SYS.CAT.INSURANCE.GENERAL` | 直接；具体用寿险/医疗险/车险 |
| PC 赔偿 | `SYS.CAT.MISC.LOSS` | 直接 |
| FD 罚单 | `SYS.CAT.TRANSPORT.TRAFFIC_FINE` / `MISC.LOSS` | 二选一；交通罚单用前者 |
| YS 遗失 | `SYS.CAT.MISC.LOSS` | 直接 |
| SXF 手续费 | `SYS.CAT.TAX_FINANCE.BANK_FEE` | 直接 |
| QZC 其它支出 | `SYS.CAT.MISC.GENERAL` | 直接 |

---

## 四、这次已经补上的缺口

### 新增叶子

- `SYS.CAT.CAPITAL` 实收资本（权益）；
- `SYS.CAT.INCOME_SUMMARY` 收入汇总（权益）；
- `SYS.CAT.CASH.PREPAID` 储值卡饭卡（资产）。

### 新增别名

- `DINING.GENERAL`：快餐、零食、糕点；
- `SHOPPING.BEAUTY`：理发；
- `MISC.SERVICE_FEE`：快递费；
- `ENTERTAINMENT.GENERAL`：彩票；
- `TRANSPORT.GENERAL`：汽车；
- `PART_TIME`：临工；
- `CASH.PREPAID`：饭卡、储值卡。

### 银行子树

- `[Bank]` 56 家：6 大行、12 股份制、3 政策性、27 城商、2 农商/信用社、5 外资、1 其他；
- 每家银行两列：`储蓄分类` / `借贷分类`；
- 银行不是锚点目标；选银行后锚到 `BANK.DEBIT` 或 `CREDIT_CARD`；
- 想再加银行，只加一行 `[Bank]`，不动计数树。

### 网贷

- 不在母树建平台节点；
- 私人花呗/借呗/抖音月付等仍可挂 `HUABEI`/`CONSUMER_LOAN`，公共报表合并为“花呗白条/消费贷”；
- 如果以后要平台级汇总，再加网贷 facet，不塞进计数树。

---

## 五、简码冲突：你的树正好暴露了 C 方案的必要性

你的私有简码很短，很多和母树推荐码“同形不同义”：

| 私有简码 | 私有含义 | 母树推荐码同形 | 母树含义 |
|---|---|---|---|
| `QC` | 汽车 | `qc` | 车辆保养维修 |
| `YF` | 衣服 | `yf` | 研发 |
| `KD` | 快递费 | `kd` | 宽带网络 |
| `KC` | 快餐 | `kc` | 库存商品 |
| `DC` | 点餐 | `dc` | 打车网约车 |
| `JC` | 教程 | `jc` | 聚餐 |
| `BX` | 保险 | `bx` | 报销垫付 |
| `FD` | 罚单 | `fd` | 房贷利息 |
| `HB` | 花呗 | `hb` | 红包 |
| `BZ` | 上班杂费 | `bz` | 包装 |

按现在的 C 方案：

- 私有简码是权威；
- 母树推荐码只是创建时的默认值；
- 预填时先查同域唯一，冲突就加后缀或让用户改；
- 母树推荐码不参与锚点/汇总/身份。

---

## 六、结论

1. **81 个节点全部有落点**；60+ 直接，10–14 用 GENERAL/别名，11 个银行/信用卡走银行 facet，8 个网贷走通用消费贷。
2. **银行已列全到独立子树**（56 家），储蓄/借贷两列；计数树仍只有 `BANK.DEBIT` / `CREDIT_CARD` 两个公共叶子。
3. **网贷平台不进母树**；要平台级汇总时再加 facet。
4. **私人“统计分类”不是母树组**：`parent_id` 留私人分组，`anchor_id` 挂具体叶子。
5. **简码冲突用 C 方案解决**：私人权威、母树建议、域内查重。
