/* TxtVein · system-dict.js
 * 生成物，请勿手改。
 * source: js/core/system.dict
 * version: 2026.11.1
 * hash: bfbcaa7ef973de2ea0dab3924337f04c5c899f048b6601bda4d22fc026f9fd51
 */
(function (root) {
  'use strict';
  const TV = (root.TxtVein = root.TxtVein || {});
  function deepFreeze(o) {
    if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    return o;
  }
  TV.systemDict = deepFreeze({
  "FORMAT": 1,
  "VERSION": "2026.11.1",
  "HASH": "bfbcaa7ef973de2ea0dab3924337f04c5c899f048b6601bda4d22fc026f9fd51",
  "VERSION_STRING": "2026.11.1+bfbcaa7ef973",
  "nodes": {
    "SYS": {
      "id": "SYS",
      "zh_name": "母树",
      "en_name": "System",
      "parent_id": "",
      "kind": "root",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 0,
      "sort": 0
    },
    "SYS.ACC.ASSET": {
      "id": "SYS.ACC.ASSET",
      "zh_name": "资产",
      "en_name": "Asset",
      "parent_id": "SYS",
      "kind": "type",
      "type": "资产",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 30
    },
    "SYS.ACC.ASSET.GENERAL": {
      "id": "SYS.ACC.ASSET.GENERAL",
      "zh_name": "资产·未细分",
      "en_name": "Asset General",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "asset_gen",
      "en_code": "asset_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.ACC.COST": {
      "id": "SYS.ACC.COST",
      "zh_name": "成本",
      "en_name": "Cost",
      "parent_id": "SYS",
      "kind": "type",
      "type": "成本",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 20
    },
    "SYS.ACC.COST.GENERAL": {
      "id": "SYS.ACC.COST.GENERAL",
      "zh_name": "成本·未细分",
      "en_name": "Cost General",
      "parent_id": "SYS.ACC.COST",
      "kind": "category",
      "type": "",
      "zh_code": "cost_gen",
      "en_code": "cost_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.ACC.EQUITY": {
      "id": "SYS.ACC.EQUITY",
      "zh_name": "权益",
      "en_name": "Equity",
      "parent_id": "SYS",
      "kind": "type",
      "type": "权益",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 60
    },
    "SYS.ACC.EQUITY.GENERAL": {
      "id": "SYS.ACC.EQUITY.GENERAL",
      "zh_name": "权益·未细分",
      "en_name": "Equity General",
      "parent_id": "SYS.ACC.EQUITY",
      "kind": "category",
      "type": "",
      "zh_code": "eq_gen",
      "en_code": "eq_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.ACC.EXPENSE": {
      "id": "SYS.ACC.EXPENSE",
      "zh_name": "费用",
      "en_name": "Expense",
      "parent_id": "SYS",
      "kind": "type",
      "type": "费用",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 10
    },
    "SYS.ACC.EXPENSE.GENERAL": {
      "id": "SYS.ACC.EXPENSE.GENERAL",
      "zh_name": "费用·未细分",
      "en_name": "Expense General",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "fee_gen",
      "en_code": "fee_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.ACC.INCOME": {
      "id": "SYS.ACC.INCOME",
      "zh_name": "收入",
      "en_name": "Income",
      "parent_id": "SYS",
      "kind": "type",
      "type": "收入",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 50
    },
    "SYS.ACC.INCOME.GENERAL": {
      "id": "SYS.ACC.INCOME.GENERAL",
      "zh_name": "收入·未细分",
      "en_name": "Income General",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "inc_gen",
      "en_code": "inc_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.ACC.LIABILITY": {
      "id": "SYS.ACC.LIABILITY",
      "zh_name": "负债",
      "en_name": "Liability",
      "parent_id": "SYS",
      "kind": "type",
      "type": "负债",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 40
    },
    "SYS.ACC.LIABILITY.GENERAL": {
      "id": "SYS.ACC.LIABILITY.GENERAL",
      "zh_name": "负债·未细分",
      "en_name": "Liability General",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "liab_gen",
      "en_code": "liab_gen",
      "weight": 20,
      "sort": 99
    },
    "SYS.CAT.BANK": {
      "id": "SYS.CAT.BANK",
      "zh_name": "银行存款",
      "en_name": "Bank",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 20
    },
    "SYS.CAT.BANK.CURRENT": {
      "id": "SYS.CAT.BANK.CURRENT",
      "zh_name": "对公账户",
      "en_name": "Current Account",
      "parent_id": "SYS.CAT.BANK",
      "kind": "category",
      "type": "",
      "zh_code": "dg",
      "en_code": "current",
      "weight": 60,
      "sort": 20
    },
    "SYS.CAT.BANK.DEBIT": {
      "id": "SYS.CAT.BANK.DEBIT",
      "zh_name": "储蓄卡",
      "en_name": "Debit Card",
      "parent_id": "SYS.CAT.BANK",
      "kind": "category",
      "type": "",
      "zh_code": "cxk",
      "en_code": "debit",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.BANK.GENERAL": {
      "id": "SYS.CAT.BANK.GENERAL",
      "zh_name": "银行存款·未细分",
      "en_name": "Bank General",
      "parent_id": "SYS.CAT.BANK",
      "kind": "category",
      "type": "",
      "zh_code": "bank_gen",
      "en_code": "bank_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.BONUS": {
      "id": "SYS.CAT.BONUS",
      "zh_name": "奖金年终奖",
      "en_name": "Bonus",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "jiangjin",
      "en_code": "bonus",
      "weight": 60,
      "sort": 20
    },
    "SYS.CAT.BUSINESS_REVENUE": {
      "id": "SYS.CAT.BUSINESS_REVENUE",
      "zh_name": "经营收入",
      "en_name": "Business Revenue",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "jingying",
      "en_code": "business_revenue",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.CAPITAL": {
      "id": "SYS.CAT.CAPITAL",
      "zh_name": "实收资本",
      "en_name": "Paid-in Capital",
      "parent_id": "SYS.ACC.EQUITY",
      "kind": "category",
      "type": "",
      "zh_code": "ssz",
      "en_code": "capital",
      "weight": 45,
      "sort": 30
    },
    "SYS.CAT.CAR_LOAN": {
      "id": "SYS.CAT.CAR_LOAN",
      "zh_name": "车贷",
      "en_name": "Car Loan",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "cd",
      "en_code": "car_loan",
      "weight": 50,
      "sort": 40
    },
    "SYS.CAT.CASH": {
      "id": "SYS.CAT.CASH",
      "zh_name": "现金",
      "en_name": "Cash",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.CASH.ALIPAY": {
      "id": "SYS.CAT.CASH.ALIPAY",
      "zh_name": "支付宝余额",
      "en_name": "Alipay Balance",
      "parent_id": "SYS.CAT.CASH",
      "kind": "category",
      "type": "",
      "zh_code": "zfb",
      "en_code": "alipay",
      "weight": 80,
      "sort": 30
    },
    "SYS.CAT.CASH.GENERAL": {
      "id": "SYS.CAT.CASH.GENERAL",
      "zh_name": "现金·未细分",
      "en_name": "Cash General",
      "parent_id": "SYS.CAT.CASH",
      "kind": "category",
      "type": "",
      "zh_code": "cash_gen",
      "en_code": "cash_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.CASH.PREPAID": {
      "id": "SYS.CAT.CASH.PREPAID",
      "zh_name": "储值卡饭卡",
      "en_name": "Prepaid Card",
      "parent_id": "SYS.CAT.CASH",
      "kind": "category",
      "type": "",
      "zh_code": "czk",
      "en_code": "prepaid",
      "weight": 55,
      "sort": 40
    },
    "SYS.CAT.CASH.WALLET": {
      "id": "SYS.CAT.CASH.WALLET",
      "zh_name": "钱包现金",
      "en_name": "Wallet Cash",
      "parent_id": "SYS.CAT.CASH",
      "kind": "category",
      "type": "",
      "zh_code": "xj",
      "en_code": "wallet",
      "weight": 60,
      "sort": 10
    },
    "SYS.CAT.CASH.WECHAT": {
      "id": "SYS.CAT.CASH.WECHAT",
      "zh_name": "微信零钱",
      "en_name": "WeChat Wallet",
      "parent_id": "SYS.CAT.CASH",
      "kind": "category",
      "type": "",
      "zh_code": "wx",
      "en_code": "wechat",
      "weight": 80,
      "sort": 20
    },
    "SYS.CAT.COMMUNICATION": {
      "id": "SYS.CAT.COMMUNICATION",
      "zh_name": "通讯",
      "en_name": "Communication",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 50
    },
    "SYS.CAT.COMMUNICATION.BROADBAND": {
      "id": "SYS.CAT.COMMUNICATION.BROADBAND",
      "zh_name": "宽带网络",
      "en_name": "Broadband",
      "parent_id": "SYS.CAT.COMMUNICATION",
      "kind": "category",
      "type": "",
      "zh_code": "kd",
      "en_code": "broadband",
      "weight": 65,
      "sort": 20
    },
    "SYS.CAT.COMMUNICATION.CLOUD": {
      "id": "SYS.CAT.COMMUNICATION.CLOUD",
      "zh_name": "云服务",
      "en_name": "Cloud",
      "parent_id": "SYS.CAT.COMMUNICATION",
      "kind": "category",
      "type": "",
      "zh_code": "yun",
      "en_code": "cloud",
      "weight": 50,
      "sort": 40
    },
    "SYS.CAT.COMMUNICATION.GENERAL": {
      "id": "SYS.CAT.COMMUNICATION.GENERAL",
      "zh_name": "通讯·未细分",
      "en_name": "Communication General",
      "parent_id": "SYS.CAT.COMMUNICATION",
      "kind": "category",
      "type": "",
      "zh_code": "com_gen",
      "en_code": "com_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.COMMUNICATION.MOBILE": {
      "id": "SYS.CAT.COMMUNICATION.MOBILE",
      "zh_name": "手机话费",
      "en_name": "Mobile",
      "parent_id": "SYS.CAT.COMMUNICATION",
      "kind": "category",
      "type": "",
      "zh_code": "hf",
      "en_code": "mobile",
      "weight": 70,
      "sort": 10
    },
    "SYS.CAT.COMMUNICATION.SOFTWARE": {
      "id": "SYS.CAT.COMMUNICATION.SOFTWARE",
      "zh_name": "软件订阅",
      "en_name": "Software",
      "parent_id": "SYS.CAT.COMMUNICATION",
      "kind": "category",
      "type": "",
      "zh_code": "rj",
      "en_code": "software",
      "weight": 60,
      "sort": 30
    },
    "SYS.CAT.CONSUMER_LOAN": {
      "id": "SYS.CAT.CONSUMER_LOAN",
      "zh_name": "消费贷",
      "en_name": "Consumer Loan",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "xfd",
      "en_code": "consumer_loan",
      "weight": 50,
      "sort": 50
    },
    "SYS.CAT.COST": {
      "id": "SYS.CAT.COST",
      "zh_name": "成本项目",
      "en_name": "Cost Items",
      "parent_id": "SYS.ACC.COST",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.COST.FACTORY_RENT": {
      "id": "SYS.CAT.COST.FACTORY_RENT",
      "zh_name": "厂房租金",
      "en_name": "Factory Rent",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "cfzj",
      "en_code": "factory_rent",
      "weight": 50,
      "sort": 60
    },
    "SYS.CAT.COST.GENERAL": {
      "id": "SYS.CAT.COST.GENERAL",
      "zh_name": "成本项目·未细分",
      "en_name": "Cost Items General",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "cost_item_gen",
      "en_code": "cost_item_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.COST.INVENTORY": {
      "id": "SYS.CAT.COST.INVENTORY",
      "zh_name": "库存商品",
      "en_name": "Inventory",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "kc",
      "en_code": "inventory",
      "weight": 55,
      "sort": 20
    },
    "SYS.CAT.COST.LABOR": {
      "id": "SYS.CAT.COST.LABOR",
      "zh_name": "生产人工",
      "en_name": "Labor",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "rg",
      "en_code": "labor",
      "weight": 55,
      "sort": 40
    },
    "SYS.CAT.COST.MATERIAL": {
      "id": "SYS.CAT.COST.MATERIAL",
      "zh_name": "原材料",
      "en_name": "Material",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "yl",
      "en_code": "material",
      "weight": 60,
      "sort": 10
    },
    "SYS.CAT.COST.OVERHEAD": {
      "id": "SYS.CAT.COST.OVERHEAD",
      "zh_name": "制造费用",
      "en_name": "Overhead",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "zzfy",
      "en_code": "overhead",
      "weight": 50,
      "sort": 50
    },
    "SYS.CAT.COST.PACKAGING": {
      "id": "SYS.CAT.COST.PACKAGING",
      "zh_name": "包装",
      "en_name": "Packaging",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "bz",
      "en_code": "packaging",
      "weight": 50,
      "sort": 30
    },
    "SYS.CAT.COST.QUALITY": {
      "id": "SYS.CAT.COST.QUALITY",
      "zh_name": "质检",
      "en_name": "Quality Control",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "zj",
      "en_code": "quality",
      "weight": 40,
      "sort": 80
    },
    "SYS.CAT.COST.UTILITIES": {
      "id": "SYS.CAT.COST.UTILITIES",
      "zh_name": "厂房水电",
      "en_name": "Factory Utilities",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "cfsd",
      "en_code": "factory_utilities",
      "weight": 45,
      "sort": 70
    },
    "SYS.CAT.COST.WASTE": {
      "id": "SYS.CAT.COST.WASTE",
      "zh_name": "损耗",
      "en_name": "Waste",
      "parent_id": "SYS.CAT.COST",
      "kind": "category",
      "type": "",
      "zh_code": "sh",
      "en_code": "waste",
      "weight": 40,
      "sort": 90
    },
    "SYS.CAT.CREDIT_CARD": {
      "id": "SYS.CAT.CREDIT_CARD",
      "zh_name": "信用卡",
      "en_name": "Credit Card",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "xyk",
      "en_code": "credit_card",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.DINING": {
      "id": "SYS.CAT.DINING",
      "zh_name": "餐饮",
      "en_name": "Dining",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 100,
      "sort": 10
    },
    "SYS.CAT.DINING.BREAKFAST": {
      "id": "SYS.CAT.DINING.BREAKFAST",
      "zh_name": "早餐",
      "en_name": "Breakfast",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "zc",
      "en_code": "breakfast",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.DINING.COFFEE": {
      "id": "SYS.CAT.DINING.COFFEE",
      "zh_name": "咖啡茶饮",
      "en_name": "Coffee",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "kf",
      "en_code": "coffee",
      "weight": 90,
      "sort": 40
    },
    "SYS.CAT.DINING.DINNER": {
      "id": "SYS.CAT.DINING.DINNER",
      "zh_name": "晚餐",
      "en_name": "Dinner",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "wancan",
      "en_code": "dinner",
      "weight": 80,
      "sort": 30
    },
    "SYS.CAT.DINING.GENERAL": {
      "id": "SYS.CAT.DINING.GENERAL",
      "zh_name": "餐饮·未细分",
      "en_name": "Dining General",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "din_gen",
      "en_code": "din_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.DINING.GROUP_MEAL": {
      "id": "SYS.CAT.DINING.GROUP_MEAL",
      "zh_name": "聚餐",
      "en_name": "Group Meal",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "jc",
      "en_code": "dining_group",
      "weight": 60,
      "sort": 60
    },
    "SYS.CAT.DINING.LUNCH": {
      "id": "SYS.CAT.DINING.LUNCH",
      "zh_name": "午餐",
      "en_name": "Lunch",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "wucan",
      "en_code": "lunch",
      "weight": 80,
      "sort": 20
    },
    "SYS.CAT.DINING.TAKEOUT": {
      "id": "SYS.CAT.DINING.TAKEOUT",
      "zh_name": "外卖",
      "en_name": "Takeout",
      "parent_id": "SYS.CAT.DINING",
      "kind": "category",
      "type": "",
      "zh_code": "wm",
      "en_code": "takeout",
      "weight": 85,
      "sort": 50
    },
    "SYS.CAT.DIVIDEND": {
      "id": "SYS.CAT.DIVIDEND",
      "zh_name": "股息分红",
      "en_name": "Dividend",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "gx",
      "en_code": "dividend",
      "weight": 45,
      "sort": 60
    },
    "SYS.CAT.EDUCATION": {
      "id": "SYS.CAT.EDUCATION",
      "zh_name": "教育",
      "en_name": "Education",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 70
    },
    "SYS.CAT.EDUCATION.EXAM": {
      "id": "SYS.CAT.EDUCATION.EXAM",
      "zh_name": "考试考证",
      "en_name": "Exam",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "ks",
      "en_code": "exam",
      "weight": 55,
      "sort": 30
    },
    "SYS.CAT.EDUCATION.GENERAL": {
      "id": "SYS.CAT.EDUCATION.GENERAL",
      "zh_name": "教育·未细分",
      "en_name": "Education General",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "edu_gen",
      "en_code": "edu_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.EDUCATION.ONLINE_COURSE": {
      "id": "SYS.CAT.EDUCATION.ONLINE_COURSE",
      "zh_name": "在线课程",
      "en_name": "Online Course",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "wk",
      "en_code": "online_course",
      "weight": 50,
      "sort": 50
    },
    "SYS.CAT.EDUCATION.TEXTBOOK": {
      "id": "SYS.CAT.EDUCATION.TEXTBOOK",
      "zh_name": "教材",
      "en_name": "Textbook",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "jiaocai",
      "en_code": "textbook",
      "weight": 50,
      "sort": 40
    },
    "SYS.CAT.EDUCATION.TRAINING": {
      "id": "SYS.CAT.EDUCATION.TRAINING",
      "zh_name": "培训",
      "en_name": "Training",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "px",
      "en_code": "training",
      "weight": 65,
      "sort": 20
    },
    "SYS.CAT.EDUCATION.TUITION": {
      "id": "SYS.CAT.EDUCATION.TUITION",
      "zh_name": "学费",
      "en_name": "Tuition",
      "parent_id": "SYS.CAT.EDUCATION",
      "kind": "category",
      "type": "",
      "zh_code": "xf",
      "en_code": "tuition",
      "weight": 75,
      "sort": 10
    },
    "SYS.CAT.ENTERTAINMENT": {
      "id": "SYS.CAT.ENTERTAINMENT",
      "zh_name": "娱乐",
      "en_name": "Entertainment",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 75,
      "sort": 80
    },
    "SYS.CAT.ENTERTAINMENT.GAME": {
      "id": "SYS.CAT.ENTERTAINMENT.GAME",
      "zh_name": "游戏",
      "en_name": "Game",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "yx",
      "en_code": "game",
      "weight": 55,
      "sort": 30
    },
    "SYS.CAT.ENTERTAINMENT.GENERAL": {
      "id": "SYS.CAT.ENTERTAINMENT.GENERAL",
      "zh_name": "娱乐·未细分",
      "en_name": "Entertainment General",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "ent_gen",
      "en_code": "ent_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.ENTERTAINMENT.HOBBY": {
      "id": "SYS.CAT.ENTERTAINMENT.HOBBY",
      "zh_name": "爱好玩具",
      "en_name": "Hobby",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "ah",
      "en_code": "hobby",
      "weight": 45,
      "sort": 50
    },
    "SYS.CAT.ENTERTAINMENT.MOVIE": {
      "id": "SYS.CAT.ENTERTAINMENT.MOVIE",
      "zh_name": "电影",
      "en_name": "Movie",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "dy",
      "en_code": "movie",
      "weight": 65,
      "sort": 10
    },
    "SYS.CAT.ENTERTAINMENT.SHOW": {
      "id": "SYS.CAT.ENTERTAINMENT.SHOW",
      "zh_name": "演出展览",
      "en_name": "Show",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "yc",
      "en_code": "show",
      "weight": 55,
      "sort": 20
    },
    "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION": {
      "id": "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION",
      "zh_name": "内容订阅",
      "en_name": "Subscription",
      "parent_id": "SYS.CAT.ENTERTAINMENT",
      "kind": "category",
      "type": "",
      "zh_code": "dingyue",
      "en_code": "subscription",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.FAMILY": {
      "id": "SYS.CAT.FAMILY",
      "zh_name": "家庭",
      "en_name": "Family",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 80,
      "sort": 110
    },
    "SYS.CAT.FAMILY.CHILDCARE": {
      "id": "SYS.CAT.FAMILY.CHILDCARE",
      "zh_name": "育儿",
      "en_name": "Childcare",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "ye",
      "en_code": "childcare",
      "weight": 60,
      "sort": 10
    },
    "SYS.CAT.FAMILY.DIAPERS": {
      "id": "SYS.CAT.FAMILY.DIAPERS",
      "zh_name": "奶粉尿布",
      "en_name": "Diapers",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "nn",
      "en_code": "diapers",
      "weight": 60,
      "sort": 20
    },
    "SYS.CAT.FAMILY.ELDER_CARE": {
      "id": "SYS.CAT.FAMILY.ELDER_CARE",
      "zh_name": "赡养老人",
      "en_name": "Elder Care",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "sy",
      "en_code": "elder_care",
      "weight": 55,
      "sort": 40
    },
    "SYS.CAT.FAMILY.GENERAL": {
      "id": "SYS.CAT.FAMILY.GENERAL",
      "zh_name": "家庭·未细分",
      "en_name": "Family General",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "fam_gen",
      "en_code": "fam_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.FAMILY.PET_FOOD": {
      "id": "SYS.CAT.FAMILY.PET_FOOD",
      "zh_name": "宠物食品",
      "en_name": "Pet Food",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "cw",
      "en_code": "pet_food",
      "weight": 45,
      "sort": 50
    },
    "SYS.CAT.FAMILY.PET_VET": {
      "id": "SYS.CAT.FAMILY.PET_VET",
      "zh_name": "宠物医疗",
      "en_name": "Pet Vet",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "cwyy",
      "en_code": "pet_vet",
      "weight": 40,
      "sort": 60
    },
    "SYS.CAT.FAMILY.PRESCHOOL": {
      "id": "SYS.CAT.FAMILY.PRESCHOOL",
      "zh_name": "幼儿园托育",
      "en_name": "Preschool",
      "parent_id": "SYS.CAT.FAMILY",
      "kind": "category",
      "type": "",
      "zh_code": "yey",
      "en_code": "preschool",
      "weight": 55,
      "sort": 30
    },
    "SYS.CAT.FIXED_ASSET": {
      "id": "SYS.CAT.FIXED_ASSET",
      "zh_name": "固定资产",
      "en_name": "Fixed Asset",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 60,
      "sort": 50
    },
    "SYS.CAT.FIXED_ASSET.EQUIPMENT": {
      "id": "SYS.CAT.FIXED_ASSET.EQUIPMENT",
      "zh_name": "设备",
      "en_name": "Fixed Equipment",
      "parent_id": "SYS.CAT.FIXED_ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "gdsb",
      "en_code": "fixed_equipment",
      "weight": 50,
      "sort": 10
    },
    "SYS.CAT.FIXED_ASSET.GENERAL": {
      "id": "SYS.CAT.FIXED_ASSET.GENERAL",
      "zh_name": "固定资产·未细分",
      "en_name": "Fixed Asset General",
      "parent_id": "SYS.CAT.FIXED_ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "fixed_gen",
      "en_code": "fixed_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.FIXED_ASSET.VEHICLE": {
      "id": "SYS.CAT.FIXED_ASSET.VEHICLE",
      "zh_name": "车辆",
      "en_name": "Vehicle",
      "parent_id": "SYS.CAT.FIXED_ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "cheliang",
      "en_code": "vehicle",
      "weight": 50,
      "sort": 20
    },
    "SYS.CAT.HEALTH": {
      "id": "SYS.CAT.HEALTH",
      "zh_name": "医疗健康",
      "en_name": "Health",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 85,
      "sort": 60
    },
    "SYS.CAT.HEALTH.CHECKUP": {
      "id": "SYS.CAT.HEALTH.CHECKUP",
      "zh_name": "体检",
      "en_name": "Checkup",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "tj",
      "en_code": "checkup",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.HEALTH.CLINIC": {
      "id": "SYS.CAT.HEALTH.CLINIC",
      "zh_name": "门诊",
      "en_name": "Clinic",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "menzhen",
      "en_code": "clinic",
      "weight": 75,
      "sort": 10
    },
    "SYS.CAT.HEALTH.DENTAL": {
      "id": "SYS.CAT.HEALTH.DENTAL",
      "zh_name": "牙科",
      "en_name": "Dental",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "yk",
      "en_code": "dental",
      "weight": 55,
      "sort": 50
    },
    "SYS.CAT.HEALTH.FITNESS": {
      "id": "SYS.CAT.HEALTH.FITNESS",
      "zh_name": "健身运动",
      "en_name": "Fitness",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "js",
      "en_code": "fitness",
      "weight": 55,
      "sort": 60
    },
    "SYS.CAT.HEALTH.GENERAL": {
      "id": "SYS.CAT.HEALTH.GENERAL",
      "zh_name": "医疗健康·未细分",
      "en_name": "Health General",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "health_gen",
      "en_code": "health_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.HEALTH.HOSPITAL": {
      "id": "SYS.CAT.HEALTH.HOSPITAL",
      "zh_name": "住院",
      "en_name": "Hospital",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "zy",
      "en_code": "hospital",
      "weight": 70,
      "sort": 20
    },
    "SYS.CAT.HEALTH.PHARMACY": {
      "id": "SYS.CAT.HEALTH.PHARMACY",
      "zh_name": "药品",
      "en_name": "Pharmacy",
      "parent_id": "SYS.CAT.HEALTH",
      "kind": "category",
      "type": "",
      "zh_code": "yp",
      "en_code": "pharmacy",
      "weight": 75,
      "sort": 30
    },
    "SYS.CAT.HOUSING": {
      "id": "SYS.CAT.HOUSING",
      "zh_name": "居住",
      "en_name": "Housing",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 95,
      "sort": 30
    },
    "SYS.CAT.HOUSING.CLEANING": {
      "id": "SYS.CAT.HOUSING.CLEANING",
      "zh_name": "家政保洁",
      "en_name": "Cleaning",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "bj",
      "en_code": "cleaning",
      "weight": 50,
      "sort": 70
    },
    "SYS.CAT.HOUSING.FURNITURE_APPLIANCE": {
      "id": "SYS.CAT.HOUSING.FURNITURE_APPLIANCE",
      "zh_name": "家具家电",
      "en_name": "Furniture",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "jj",
      "en_code": "furniture",
      "weight": 55,
      "sort": 60
    },
    "SYS.CAT.HOUSING.GENERAL": {
      "id": "SYS.CAT.HOUSING.GENERAL",
      "zh_name": "居住·未细分",
      "en_name": "Housing General",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "hou_gen",
      "en_code": "hou_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.HOUSING.MORTGAGE_INTEREST": {
      "id": "SYS.CAT.HOUSING.MORTGAGE_INTEREST",
      "zh_name": "房贷利息",
      "en_name": "Mortgage Interest",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "fd",
      "en_code": "mortgage_interest",
      "weight": 70,
      "sort": 20
    },
    "SYS.CAT.HOUSING.PROPERTY_FEE": {
      "id": "SYS.CAT.HOUSING.PROPERTY_FEE",
      "zh_name": "物业费",
      "en_name": "Property Fee",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "wy",
      "en_code": "property_fee",
      "weight": 75,
      "sort": 30
    },
    "SYS.CAT.HOUSING.RENT": {
      "id": "SYS.CAT.HOUSING.RENT",
      "zh_name": "房租",
      "en_name": "Rent",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "fz",
      "en_code": "rent",
      "weight": 90,
      "sort": 10
    },
    "SYS.CAT.HOUSING.REPAIR": {
      "id": "SYS.CAT.HOUSING.REPAIR",
      "zh_name": "维修",
      "en_name": "Home Repair",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "weixiu",
      "en_code": "repair",
      "weight": 55,
      "sort": 50
    },
    "SYS.CAT.HOUSING.UTILITIES": {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "zh_name": "水电燃气",
      "en_name": "Utilities",
      "parent_id": "SYS.CAT.HOUSING",
      "kind": "category",
      "type": "",
      "zh_code": "sdrq",
      "en_code": "utilities",
      "weight": 75,
      "sort": 40
    },
    "SYS.CAT.HOUSING_FUND": {
      "id": "SYS.CAT.HOUSING_FUND",
      "zh_name": "公积金",
      "en_name": "Housing Fund",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "gjj",
      "en_code": "housing_fund",
      "weight": 45,
      "sort": 80
    },
    "SYS.CAT.HUABEI": {
      "id": "SYS.CAT.HUABEI",
      "zh_name": "花呗白条",
      "en_name": "Huabei",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "huabei",
      "en_code": "huabei",
      "weight": 60,
      "sort": 20
    },
    "SYS.CAT.INCOME_SUMMARY": {
      "id": "SYS.CAT.INCOME_SUMMARY",
      "zh_name": "收入汇总",
      "en_name": "Income Summary",
      "parent_id": "SYS.ACC.EQUITY",
      "kind": "category",
      "type": "",
      "zh_code": "srz",
      "en_code": "income_summary",
      "weight": 40,
      "sort": 40
    },
    "SYS.CAT.INSURANCE": {
      "id": "SYS.CAT.INSURANCE",
      "zh_name": "保险",
      "en_name": "Insurance",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 75,
      "sort": 120
    },
    "SYS.CAT.INSURANCE.ACCIDENT": {
      "id": "SYS.CAT.INSURANCE.ACCIDENT",
      "zh_name": "意外险",
      "en_name": "Accident Insurance",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "ywx",
      "en_code": "accident",
      "weight": 50,
      "sort": 30
    },
    "SYS.CAT.INSURANCE.CAR": {
      "id": "SYS.CAT.INSURANCE.CAR",
      "zh_name": "车险",
      "en_name": "Car Insurance",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "cx",
      "en_code": "car",
      "weight": 50,
      "sort": 40
    },
    "SYS.CAT.INSURANCE.GENERAL": {
      "id": "SYS.CAT.INSURANCE.GENERAL",
      "zh_name": "保险·未细分",
      "en_name": "Insurance General",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "ins_gen",
      "en_code": "ins_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.INSURANCE.LIFE": {
      "id": "SYS.CAT.INSURANCE.LIFE",
      "zh_name": "寿险",
      "en_name": "Life Insurance",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "sx",
      "en_code": "life",
      "weight": 55,
      "sort": 10
    },
    "SYS.CAT.INSURANCE.MEDICAL": {
      "id": "SYS.CAT.INSURANCE.MEDICAL",
      "zh_name": "医疗险",
      "en_name": "Medical Insurance",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "ylx",
      "en_code": "medical",
      "weight": 55,
      "sort": 20
    },
    "SYS.CAT.INSURANCE.TRAVEL": {
      "id": "SYS.CAT.INSURANCE.TRAVEL",
      "zh_name": "旅行险",
      "en_name": "Travel Insurance",
      "parent_id": "SYS.CAT.INSURANCE",
      "kind": "category",
      "type": "",
      "zh_code": "lxx",
      "en_code": "travel",
      "weight": 40,
      "sort": 50
    },
    "SYS.CAT.INSURANCE_CLAIM": {
      "id": "SYS.CAT.INSURANCE_CLAIM",
      "zh_name": "保险理赔",
      "en_name": "Insurance Claim",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "lipei",
      "en_code": "claim",
      "weight": 35,
      "sort": 90
    },
    "SYS.CAT.INTEREST_INCOME": {
      "id": "SYS.CAT.INTEREST_INCOME",
      "zh_name": "利息收入",
      "en_name": "Interest Income",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "lxs",
      "en_code": "interest_income",
      "weight": 45,
      "sort": 50
    },
    "SYS.CAT.INVESTMENT": {
      "id": "SYS.CAT.INVESTMENT",
      "zh_name": "投资",
      "en_name": "Investment",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.INVESTMENT.BROKERAGE": {
      "id": "SYS.CAT.INVESTMENT.BROKERAGE",
      "zh_name": "证券账户",
      "en_name": "Brokerage",
      "parent_id": "SYS.CAT.INVESTMENT",
      "kind": "category",
      "type": "",
      "zh_code": "zq",
      "en_code": "brokerage",
      "weight": 55,
      "sort": 10
    },
    "SYS.CAT.INVESTMENT.GENERAL": {
      "id": "SYS.CAT.INVESTMENT.GENERAL",
      "zh_name": "投资·未细分",
      "en_name": "Investment General",
      "parent_id": "SYS.CAT.INVESTMENT",
      "kind": "category",
      "type": "",
      "zh_code": "inv_gen",
      "en_code": "inv_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.MISC": {
      "id": "SYS.CAT.MISC",
      "zh_name": "其他支出",
      "en_name": "Misc",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 40,
      "sort": 150
    },
    "SYS.CAT.MISC.GENERAL": {
      "id": "SYS.CAT.MISC.GENERAL",
      "zh_name": "其他支出·未细分",
      "en_name": "Misc General",
      "parent_id": "SYS.CAT.MISC",
      "kind": "category",
      "type": "",
      "zh_code": "misc_gen",
      "en_code": "misc_gen",
      "weight": 30,
      "sort": 99
    },
    "SYS.CAT.MISC.LOSS": {
      "id": "SYS.CAT.MISC.LOSS",
      "zh_name": "损失",
      "en_name": "Loss",
      "parent_id": "SYS.CAT.MISC",
      "kind": "category",
      "type": "",
      "zh_code": "ss",
      "en_code": "loss",
      "weight": 30,
      "sort": 20
    },
    "SYS.CAT.MISC.SERVICE_FEE": {
      "id": "SYS.CAT.MISC.SERVICE_FEE",
      "zh_name": "服务费",
      "en_name": "Service Fee",
      "parent_id": "SYS.CAT.MISC",
      "kind": "category",
      "type": "",
      "zh_code": "fwf",
      "en_code": "service_fee",
      "weight": 35,
      "sort": 10
    },
    "SYS.CAT.MORTGAGE": {
      "id": "SYS.CAT.MORTGAGE",
      "zh_name": "房贷",
      "en_name": "Mortgage",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "fangdai",
      "en_code": "mortgage",
      "weight": 60,
      "sort": 30
    },
    "SYS.CAT.OPENING_EQUITY": {
      "id": "SYS.CAT.OPENING_EQUITY",
      "zh_name": "期初权益",
      "en_name": "Opening Equity",
      "parent_id": "SYS.ACC.EQUITY",
      "kind": "category",
      "type": "",
      "zh_code": "qcqy",
      "en_code": "opening",
      "weight": 50,
      "sort": 10
    },
    "SYS.CAT.PART_TIME": {
      "id": "SYS.CAT.PART_TIME",
      "zh_name": "兼职",
      "en_name": "Part Time",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "jianzhi",
      "en_code": "part_time",
      "weight": 50,
      "sort": 30
    },
    "SYS.CAT.PAYABLE": {
      "id": "SYS.CAT.PAYABLE",
      "zh_name": "应付款",
      "en_name": "Payable",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "yingfu",
      "en_code": "payable",
      "weight": 50,
      "sort": 60
    },
    "SYS.CAT.PERSONAL_LOAN": {
      "id": "SYS.CAT.PERSONAL_LOAN",
      "zh_name": "亲友借款",
      "en_name": "Personal Loan",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "jk",
      "en_code": "personal_loan",
      "weight": 40,
      "sort": 70
    },
    "SYS.CAT.PREPAYMENT": {
      "id": "SYS.CAT.PREPAYMENT",
      "zh_name": "预付款",
      "en_name": "Prepayment",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "yfk",
      "en_code": "prepayment",
      "weight": 45,
      "sort": 60
    },
    "SYS.CAT.RECEIVABLE": {
      "id": "SYS.CAT.RECEIVABLE",
      "zh_name": "应收款",
      "en_name": "Receivable",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 60,
      "sort": 30
    },
    "SYS.CAT.RECEIVABLE.ADVANCE": {
      "id": "SYS.CAT.RECEIVABLE.ADVANCE",
      "zh_name": "代付借出",
      "en_name": "Advance",
      "parent_id": "SYS.CAT.RECEIVABLE",
      "kind": "category",
      "type": "",
      "zh_code": "df",
      "en_code": "advance",
      "weight": 50,
      "sort": 20
    },
    "SYS.CAT.RECEIVABLE.GENERAL": {
      "id": "SYS.CAT.RECEIVABLE.GENERAL",
      "zh_name": "应收款·未细分",
      "en_name": "Receivable General",
      "parent_id": "SYS.CAT.RECEIVABLE",
      "kind": "category",
      "type": "",
      "zh_code": "recv_gen",
      "en_code": "recv_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.RECEIVABLE.REIMBURSEMENT": {
      "id": "SYS.CAT.RECEIVABLE.REIMBURSEMENT",
      "zh_name": "报销垫付",
      "en_name": "Reimbursement",
      "parent_id": "SYS.CAT.RECEIVABLE",
      "kind": "category",
      "type": "",
      "zh_code": "bx",
      "en_code": "reimbursement",
      "weight": 55,
      "sort": 10
    },
    "SYS.CAT.REFUND": {
      "id": "SYS.CAT.REFUND",
      "zh_name": "退款",
      "en_name": "Refund",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "tk",
      "en_code": "refund",
      "weight": 40,
      "sort": 70
    },
    "SYS.CAT.RETAINED_EARNINGS": {
      "id": "SYS.CAT.RETAINED_EARNINGS",
      "zh_name": "留存收益",
      "en_name": "Retained Earnings",
      "parent_id": "SYS.ACC.EQUITY",
      "kind": "category",
      "type": "",
      "zh_code": "lc",
      "en_code": "retained",
      "weight": 40,
      "sort": 20
    },
    "SYS.CAT.SALARY": {
      "id": "SYS.CAT.SALARY",
      "zh_name": "工资",
      "en_name": "Salary",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "gz",
      "en_code": "salary",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.SALARY_PAYABLE": {
      "id": "SYS.CAT.SALARY_PAYABLE",
      "zh_name": "应付薪酬",
      "en_name": "Salary Payable",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "yfx",
      "en_code": "salary_payable",
      "weight": 45,
      "sort": 90
    },
    "SYS.CAT.SHOPPING": {
      "id": "SYS.CAT.SHOPPING",
      "zh_name": "购物",
      "en_name": "Shopping",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 90,
      "sort": 40
    },
    "SYS.CAT.SHOPPING.BEAUTY": {
      "id": "SYS.CAT.SHOPPING.BEAUTY",
      "zh_name": "美妆个护",
      "en_name": "Beauty",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "mz",
      "en_code": "beauty",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.SHOPPING.CLOTHING": {
      "id": "SYS.CAT.SHOPPING.CLOTHING",
      "zh_name": "服装鞋帽",
      "en_name": "Clothing",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "yifu",
      "en_code": "clothing",
      "weight": 60,
      "sort": 30
    },
    "SYS.CAT.SHOPPING.DAILY": {
      "id": "SYS.CAT.SHOPPING.DAILY",
      "zh_name": "日用百货",
      "en_name": "Daily Goods",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "ry",
      "en_code": "daily",
      "weight": 70,
      "sort": 10
    },
    "SYS.CAT.SHOPPING.ELECTRONICS": {
      "id": "SYS.CAT.SHOPPING.ELECTRONICS",
      "zh_name": "数码电子",
      "en_name": "Electronics",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "sm",
      "en_code": "electronics",
      "weight": 55,
      "sort": 50
    },
    "SYS.CAT.SHOPPING.GENERAL": {
      "id": "SYS.CAT.SHOPPING.GENERAL",
      "zh_name": "购物·未细分",
      "en_name": "Shopping General",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "shop_gen",
      "en_code": "shop_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.SHOPPING.GIFTS": {
      "id": "SYS.CAT.SHOPPING.GIFTS",
      "zh_name": "礼品礼盒",
      "en_name": "Gifts",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "lp",
      "en_code": "gifts",
      "weight": 50,
      "sort": 60
    },
    "SYS.CAT.SHOPPING.SUPERMARKET": {
      "id": "SYS.CAT.SHOPPING.SUPERMARKET",
      "zh_name": "超市生鲜",
      "en_name": "Supermarket",
      "parent_id": "SYS.CAT.SHOPPING",
      "kind": "category",
      "type": "",
      "zh_code": "cs",
      "en_code": "supermarket",
      "weight": 80,
      "sort": 20
    },
    "SYS.CAT.SOCIAL": {
      "id": "SYS.CAT.SOCIAL",
      "zh_name": "人情社交",
      "en_name": "Social",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 70,
      "sort": 100
    },
    "SYS.CAT.SOCIAL.DONATION": {
      "id": "SYS.CAT.SOCIAL.DONATION",
      "zh_name": "捐赠",
      "en_name": "Donation",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "jz",
      "en_code": "donation",
      "weight": 40,
      "sort": 50
    },
    "SYS.CAT.SOCIAL.GENERAL": {
      "id": "SYS.CAT.SOCIAL.GENERAL",
      "zh_name": "人情社交·未细分",
      "en_name": "Social General",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "soc_gen",
      "en_code": "soc_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.SOCIAL.GIFT": {
      "id": "SYS.CAT.SOCIAL.GIFT",
      "zh_name": "礼物",
      "en_name": "Social Gift",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "lw",
      "en_code": "social_gift",
      "weight": 55,
      "sort": 20
    },
    "SYS.CAT.SOCIAL.RED_PACKET": {
      "id": "SYS.CAT.SOCIAL.RED_PACKET",
      "zh_name": "红包",
      "en_name": "Red Packet",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "hb",
      "en_code": "red_packet",
      "weight": 60,
      "sort": 10
    },
    "SYS.CAT.SOCIAL.TREAT": {
      "id": "SYS.CAT.SOCIAL.TREAT",
      "zh_name": "请客",
      "en_name": "Treat",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "qk",
      "en_code": "treat",
      "weight": 55,
      "sort": 30
    },
    "SYS.CAT.SOCIAL.WEDDING": {
      "id": "SYS.CAT.SOCIAL.WEDDING",
      "zh_name": "婚丧嫁娶",
      "en_name": "Wedding",
      "parent_id": "SYS.CAT.SOCIAL",
      "kind": "category",
      "type": "",
      "zh_code": "hs",
      "en_code": "wedding",
      "weight": 50,
      "sort": 40
    },
    "SYS.CAT.SOCIAL_SECURITY": {
      "id": "SYS.CAT.SOCIAL_SECURITY",
      "zh_name": "社保账户",
      "en_name": "Social Security",
      "parent_id": "SYS.ACC.ASSET",
      "kind": "category",
      "type": "",
      "zh_code": "sby",
      "en_code": "social_security",
      "weight": 45,
      "sort": 70
    },
    "SYS.CAT.SUBSIDY": {
      "id": "SYS.CAT.SUBSIDY",
      "zh_name": "补贴",
      "en_name": "Subsidy",
      "parent_id": "SYS.ACC.INCOME",
      "kind": "category",
      "type": "",
      "zh_code": "bt",
      "en_code": "subsidy",
      "weight": 40,
      "sort": 80
    },
    "SYS.CAT.TAX_FINANCE": {
      "id": "SYS.CAT.TAX_FINANCE",
      "zh_name": "税费金融",
      "en_name": "Tax & Finance",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 70,
      "sort": 130
    },
    "SYS.CAT.TAX_FINANCE.BANK_FEE": {
      "id": "SYS.CAT.TAX_FINANCE.BANK_FEE",
      "zh_name": "银行手续费",
      "en_name": "Bank Fee",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "sxf",
      "en_code": "bank_fee",
      "weight": 60,
      "sort": 40
    },
    "SYS.CAT.TAX_FINANCE.GENERAL": {
      "id": "SYS.CAT.TAX_FINANCE.GENERAL",
      "zh_name": "税费金融·未细分",
      "en_name": "Tax Finance General",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "tax_gen",
      "en_code": "tax_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.TAX_FINANCE.INCOME_TAX": {
      "id": "SYS.CAT.TAX_FINANCE.INCOME_TAX",
      "zh_name": "个人所得税",
      "en_name": "Income Tax",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "gs",
      "en_code": "income_tax",
      "weight": 55,
      "sort": 10
    },
    "SYS.CAT.TAX_FINANCE.INTEREST": {
      "id": "SYS.CAT.TAX_FINANCE.INTEREST",
      "zh_name": "利息支出",
      "en_name": "Interest Expense",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "lx",
      "en_code": "interest",
      "weight": 55,
      "sort": 50
    },
    "SYS.CAT.TAX_FINANCE.INVESTMENT_LOSS": {
      "id": "SYS.CAT.TAX_FINANCE.INVESTMENT_LOSS",
      "zh_name": "投资亏损",
      "en_name": "Investment Loss",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "tz",
      "en_code": "investment_loss",
      "weight": 40,
      "sort": 70
    },
    "SYS.CAT.TAX_FINANCE.LOAN_INTEREST": {
      "id": "SYS.CAT.TAX_FINANCE.LOAN_INTEREST",
      "zh_name": "贷款利息",
      "en_name": "Loan Interest",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "dk",
      "en_code": "loan_interest",
      "weight": 55,
      "sort": 60
    },
    "SYS.CAT.TAX_FINANCE.PROPERTY_TAX": {
      "id": "SYS.CAT.TAX_FINANCE.PROPERTY_TAX",
      "zh_name": "房产税",
      "en_name": "Property Tax",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "fcs",
      "en_code": "property_tax",
      "weight": 40,
      "sort": 30
    },
    "SYS.CAT.TAX_FINANCE.VAT": {
      "id": "SYS.CAT.TAX_FINANCE.VAT",
      "zh_name": "增值税",
      "en_name": "VAT",
      "parent_id": "SYS.CAT.TAX_FINANCE",
      "kind": "category",
      "type": "",
      "zh_code": "zzs",
      "en_code": "vat",
      "weight": 50,
      "sort": 20
    },
    "SYS.CAT.TAX_PAYABLE": {
      "id": "SYS.CAT.TAX_PAYABLE",
      "zh_name": "应交税费",
      "en_name": "Tax Payable",
      "parent_id": "SYS.ACC.LIABILITY",
      "kind": "category",
      "type": "",
      "zh_code": "yjsf",
      "en_code": "tax_payable",
      "weight": 45,
      "sort": 80
    },
    "SYS.CAT.TRANSPORT": {
      "id": "SYS.CAT.TRANSPORT",
      "zh_name": "交通",
      "en_name": "Transport",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 95,
      "sort": 20
    },
    "SYS.CAT.TRANSPORT.CAR_MAINTENANCE": {
      "id": "SYS.CAT.TRANSPORT.CAR_MAINTENANCE",
      "zh_name": "车辆保养维修",
      "en_name": "Car Care",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "qc",
      "en_code": "car_care",
      "weight": 50,
      "sort": 70
    },
    "SYS.CAT.TRANSPORT.FLIGHT": {
      "id": "SYS.CAT.TRANSPORT.FLIGHT",
      "zh_name": "飞机",
      "en_name": "Flight",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "fj",
      "en_code": "flight",
      "weight": 60,
      "sort": 60
    },
    "SYS.CAT.TRANSPORT.FUEL": {
      "id": "SYS.CAT.TRANSPORT.FUEL",
      "zh_name": "加油",
      "en_name": "Fuel",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "jy",
      "en_code": "fuel",
      "weight": 70,
      "sort": 30
    },
    "SYS.CAT.TRANSPORT.GENERAL": {
      "id": "SYS.CAT.TRANSPORT.GENERAL",
      "zh_name": "交通·未细分",
      "en_name": "Transport General",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "tra_gen",
      "en_code": "tra_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.TRANSPORT.PARKING": {
      "id": "SYS.CAT.TRANSPORT.PARKING",
      "zh_name": "停车",
      "en_name": "Parking",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "tc",
      "en_code": "parking",
      "weight": 65,
      "sort": 40
    },
    "SYS.CAT.TRANSPORT.PUBLIC_TRANSIT": {
      "id": "SYS.CAT.TRANSPORT.PUBLIC_TRANSIT",
      "zh_name": "公交地铁",
      "en_name": "Public Transit",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "gjdt",
      "en_code": "transit",
      "weight": 80,
      "sort": 10
    },
    "SYS.CAT.TRANSPORT.RIDE_HAILING": {
      "id": "SYS.CAT.TRANSPORT.RIDE_HAILING",
      "zh_name": "打车网约车",
      "en_name": "Ride Hailing",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "dc",
      "en_code": "ride",
      "weight": 85,
      "sort": 20
    },
    "SYS.CAT.TRANSPORT.TRAIN": {
      "id": "SYS.CAT.TRANSPORT.TRAIN",
      "zh_name": "火车高铁",
      "en_name": "Train",
      "parent_id": "SYS.CAT.TRANSPORT",
      "kind": "category",
      "type": "",
      "zh_code": "hc",
      "en_code": "train",
      "weight": 65,
      "sort": 50
    },
    "SYS.CAT.TRAVEL": {
      "id": "SYS.CAT.TRAVEL",
      "zh_name": "旅行",
      "en_name": "Travel",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 75,
      "sort": 90
    },
    "SYS.CAT.TRAVEL.ACCOMMODATION": {
      "id": "SYS.CAT.TRAVEL.ACCOMMODATION",
      "zh_name": "住宿",
      "en_name": "Lodging",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "zs",
      "en_code": "lodging",
      "weight": 70,
      "sort": 20
    },
    "SYS.CAT.TRAVEL.FOOD": {
      "id": "SYS.CAT.TRAVEL.FOOD",
      "zh_name": "旅行餐饮",
      "en_name": "Travel Food",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "cy",
      "en_code": "travel_food",
      "weight": 55,
      "sort": 30
    },
    "SYS.CAT.TRAVEL.GENERAL": {
      "id": "SYS.CAT.TRAVEL.GENERAL",
      "zh_name": "旅行·未细分",
      "en_name": "Travel General",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "trav_gen",
      "en_code": "trav_gen",
      "weight": 50,
      "sort": 99
    },
    "SYS.CAT.TRAVEL.TICKETS": {
      "id": "SYS.CAT.TRAVEL.TICKETS",
      "zh_name": "门票",
      "en_name": "Tickets",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "mp",
      "en_code": "tickets",
      "weight": 55,
      "sort": 40
    },
    "SYS.CAT.TRAVEL.TRANSPORT": {
      "id": "SYS.CAT.TRAVEL.TRANSPORT",
      "zh_name": "大交通",
      "en_name": "Travel Transport",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "djt",
      "en_code": "travel_transport",
      "weight": 70,
      "sort": 10
    },
    "SYS.CAT.TRAVEL.VISA": {
      "id": "SYS.CAT.TRAVEL.VISA",
      "zh_name": "签证",
      "en_name": "Visa",
      "parent_id": "SYS.CAT.TRAVEL",
      "kind": "category",
      "type": "",
      "zh_code": "qz",
      "en_code": "visa",
      "weight": 40,
      "sort": 50
    },
    "SYS.CAT.WORK": {
      "id": "SYS.CAT.WORK",
      "zh_name": "工作公司",
      "en_name": "Work",
      "parent_id": "SYS.ACC.EXPENSE",
      "kind": "category",
      "type": "",
      "zh_code": "",
      "en_code": "",
      "weight": 70,
      "sort": 140
    },
    "SYS.CAT.WORK.BUSINESS_MEAL": {
      "id": "SYS.CAT.WORK.BUSINESS_MEAL",
      "zh_name": "业务招待",
      "en_name": "Business Meal",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "zd",
      "en_code": "business_meal",
      "weight": 50,
      "sort": 70
    },
    "SYS.CAT.WORK.EQUIPMENT": {
      "id": "SYS.CAT.WORK.EQUIPMENT",
      "zh_name": "办公设备",
      "en_name": "Equipment",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "sb",
      "en_code": "equipment",
      "weight": 45,
      "sort": 40
    },
    "SYS.CAT.WORK.GENERAL": {
      "id": "SYS.CAT.WORK.GENERAL",
      "zh_name": "工作公司·未细分",
      "en_name": "Work General",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "work_gen",
      "en_code": "work_gen",
      "weight": 50,
      "sort": 199
    },
    "SYS.CAT.WORK.LEGAL": {
      "id": "SYS.CAT.WORK.LEGAL",
      "zh_name": "法务",
      "en_name": "Legal",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "fw",
      "en_code": "legal",
      "weight": 40,
      "sort": 110
    },
    "SYS.CAT.WORK.LOGISTICS": {
      "id": "SYS.CAT.WORK.LOGISTICS",
      "zh_name": "快递物流",
      "en_name": "Logistics",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "wl",
      "en_code": "logistics",
      "weight": 45,
      "sort": 140
    },
    "SYS.CAT.WORK.MARKETING": {
      "id": "SYS.CAT.WORK.MARKETING",
      "zh_name": "市场推广",
      "en_name": "Marketing",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "tg",
      "en_code": "marketing",
      "weight": 45,
      "sort": 80
    },
    "SYS.CAT.WORK.OFFICE_RENT": {
      "id": "SYS.CAT.WORK.OFFICE_RENT",
      "zh_name": "办公租金",
      "en_name": "Office Rent",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "bgzj",
      "en_code": "office_rent",
      "weight": 55,
      "sort": 10
    },
    "SYS.CAT.WORK.OFFICE_SUPPLIES": {
      "id": "SYS.CAT.WORK.OFFICE_SUPPLIES",
      "zh_name": "办公用品",
      "en_name": "Office Supplies",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "bgyp",
      "en_code": "office_supplies",
      "weight": 50,
      "sort": 30
    },
    "SYS.CAT.WORK.OFFICE_UTILITIES": {
      "id": "SYS.CAT.WORK.OFFICE_UTILITIES",
      "zh_name": "办公水电",
      "en_name": "Office Utilities",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "bgsd",
      "en_code": "office_utilities",
      "weight": 50,
      "sort": 20
    },
    "SYS.CAT.WORK.OUTSOURCING": {
      "id": "SYS.CAT.WORK.OUTSOURCING",
      "zh_name": "外包",
      "en_name": "Outsourcing",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "wb",
      "en_code": "outsourcing",
      "weight": 40,
      "sort": 100
    },
    "SYS.CAT.WORK.PAYROLL": {
      "id": "SYS.CAT.WORK.PAYROLL",
      "zh_name": "员工薪酬",
      "en_name": "Payroll",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "xc",
      "en_code": "payroll",
      "weight": 55,
      "sort": 120
    },
    "SYS.CAT.WORK.RND": {
      "id": "SYS.CAT.WORK.RND",
      "zh_name": "研发",
      "en_name": "R&D",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "yf",
      "en_code": "rnd",
      "weight": 45,
      "sort": 90
    },
    "SYS.CAT.WORK.SOCIAL_INSURANCE": {
      "id": "SYS.CAT.WORK.SOCIAL_INSURANCE",
      "zh_name": "社保公积金",
      "en_name": "Social Insurance",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "sbyj",
      "en_code": "social_insurance",
      "weight": 50,
      "sort": 130
    },
    "SYS.CAT.WORK.SOFTWARE": {
      "id": "SYS.CAT.WORK.SOFTWARE",
      "zh_name": "企业软件",
      "en_name": "Work Software",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "qyrj",
      "en_code": "work_software",
      "weight": 50,
      "sort": 50
    },
    "SYS.CAT.WORK.TRAVEL": {
      "id": "SYS.CAT.WORK.TRAVEL",
      "zh_name": "差旅",
      "en_name": "Work Travel",
      "parent_id": "SYS.CAT.WORK",
      "kind": "category",
      "type": "",
      "zh_code": "cl",
      "en_code": "work_travel",
      "weight": 55,
      "sort": 60
    }
  },
  "merchants": {
    "SYS.MERCHANT.CAINIAO": {
      "id": "SYS.MERCHANT.CAINIAO",
      "zh_name": "菜鸟",
      "en_name": "Cainiao",
      "default_category": "SYS.CAT.WORK.LOGISTICS",
      "zh_code": "cn",
      "en_code": "cainiao",
      "weight": 50
    },
    "SYS.MERCHANT.CHINA_MOBILE": {
      "id": "SYS.MERCHANT.CHINA_MOBILE",
      "zh_name": "中国移动",
      "en_name": "China Mobile",
      "default_category": "SYS.CAT.COMMUNICATION.MOBILE",
      "zh_code": "yd",
      "en_code": "chinamobile",
      "weight": 60
    },
    "SYS.MERCHANT.CHINA_TELECOM": {
      "id": "SYS.MERCHANT.CHINA_TELECOM",
      "zh_name": "中国电信",
      "en_name": "China Telecom",
      "default_category": "SYS.CAT.COMMUNICATION.MOBILE",
      "zh_code": "dx",
      "en_code": "chinatelecom",
      "weight": 55
    },
    "SYS.MERCHANT.CHINA_UNICOM": {
      "id": "SYS.MERCHANT.CHINA_UNICOM",
      "zh_name": "中国联通",
      "en_name": "China Unicom",
      "default_category": "SYS.CAT.COMMUNICATION.MOBILE",
      "zh_code": "lt",
      "en_code": "chinaunicom",
      "weight": 55
    },
    "SYS.MERCHANT.CTRIP": {
      "id": "SYS.MERCHANT.CTRIP",
      "zh_name": "携程",
      "en_name": "Ctrip",
      "default_category": "SYS.CAT.TRAVEL.ACCOMMODATION",
      "zh_code": "ctrip",
      "en_code": "ctrip",
      "weight": 55
    },
    "SYS.MERCHANT.DIDI": {
      "id": "SYS.MERCHANT.DIDI",
      "zh_name": "滴滴",
      "en_name": "Didi",
      "default_category": "SYS.CAT.TRANSPORT.RIDE_HAILING",
      "zh_code": "dd",
      "en_code": "didi",
      "weight": 75
    },
    "SYS.MERCHANT.ELEME": {
      "id": "SYS.MERCHANT.ELEME",
      "zh_name": "饿了么",
      "en_name": "Eleme",
      "default_category": "SYS.CAT.DINING.TAKEOUT",
      "zh_code": "elm",
      "en_code": "eleme",
      "weight": 75
    },
    "SYS.MERCHANT.FLIGGY": {
      "id": "SYS.MERCHANT.FLIGGY",
      "zh_name": "飞猪",
      "en_name": "Fliggy",
      "default_category": "SYS.CAT.TRAVEL.ACCOMMODATION",
      "zh_code": "feizhu",
      "en_code": "fliggy",
      "weight": 50
    },
    "SYS.MERCHANT.GYM": {
      "id": "SYS.MERCHANT.GYM",
      "zh_name": "健身房",
      "en_name": "Gym",
      "default_category": "SYS.CAT.HEALTH.FITNESS",
      "zh_code": "gym",
      "en_code": "gym",
      "weight": 45
    },
    "SYS.MERCHANT.HEMA": {
      "id": "SYS.MERCHANT.HEMA",
      "zh_name": "盒马",
      "en_name": "Hema",
      "default_category": "SYS.CAT.SHOPPING.SUPERMARKET",
      "zh_code": "hm",
      "en_code": "hema",
      "weight": 65
    },
    "SYS.MERCHANT.HOSPITAL": {
      "id": "SYS.MERCHANT.HOSPITAL",
      "zh_name": "医院",
      "en_name": "Hospital",
      "default_category": "SYS.CAT.HEALTH.HOSPITAL",
      "zh_code": "yy",
      "en_code": "hosp",
      "weight": 50
    },
    "SYS.MERCHANT.IQIYI": {
      "id": "SYS.MERCHANT.IQIYI",
      "zh_name": "爱奇艺",
      "en_name": "iQIYI",
      "default_category": "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION",
      "zh_code": "aqy",
      "en_code": "iqiyi",
      "weight": 40
    },
    "SYS.MERCHANT.JD": {
      "id": "SYS.MERCHANT.JD",
      "zh_name": "京东",
      "en_name": "JD",
      "default_category": "SYS.CAT.SHOPPING.GENERAL",
      "zh_code": "jd",
      "en_code": "jd",
      "weight": 70
    },
    "SYS.MERCHANT.KFC": {
      "id": "SYS.MERCHANT.KFC",
      "zh_name": "肯德基",
      "en_name": "KFC",
      "default_category": "SYS.CAT.DINING.GENERAL",
      "zh_code": "kfc",
      "en_code": "kfc",
      "weight": 60
    },
    "SYS.MERCHANT.LUCKIN": {
      "id": "SYS.MERCHANT.LUCKIN",
      "zh_name": "瑞幸",
      "en_name": "Luckin",
      "default_category": "SYS.CAT.DINING.COFFEE",
      "zh_code": "lk",
      "en_code": "luckin",
      "weight": 75
    },
    "SYS.MERCHANT.MCDONALDS": {
      "id": "SYS.MERCHANT.MCDONALDS",
      "zh_name": "麦当劳",
      "en_name": "McDonalds",
      "default_category": "SYS.CAT.DINING.GENERAL",
      "zh_code": "mcd",
      "en_code": "mcdonalds",
      "weight": 60
    },
    "SYS.MERCHANT.MEITUAN": {
      "id": "SYS.MERCHANT.MEITUAN",
      "zh_name": "美团",
      "en_name": "Meituan",
      "default_category": "SYS.CAT.DINING.TAKEOUT",
      "zh_code": "mt",
      "en_code": "meituan",
      "weight": 80
    },
    "SYS.MERCHANT.NETFLIX": {
      "id": "SYS.MERCHANT.NETFLIX",
      "zh_name": "Netflix",
      "en_name": "Netflix",
      "default_category": "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION",
      "zh_code": "nf",
      "en_code": "netflix",
      "weight": 45
    },
    "SYS.MERCHANT.PDD": {
      "id": "SYS.MERCHANT.PDD",
      "zh_name": "拼多多",
      "en_name": "Pinduoduo",
      "default_category": "SYS.CAT.SHOPPING.GENERAL",
      "zh_code": "pdd",
      "en_code": "pdd",
      "weight": 60
    },
    "SYS.MERCHANT.PHARMACY": {
      "id": "SYS.MERCHANT.PHARMACY",
      "zh_name": "药店",
      "en_name": "Pharmacy",
      "default_category": "SYS.CAT.HEALTH.PHARMACY",
      "zh_code": "yaodian",
      "en_code": "pharm",
      "weight": 50
    },
    "SYS.MERCHANT.PROPERTY": {
      "id": "SYS.MERCHANT.PROPERTY",
      "zh_name": "物业公司",
      "en_name": "Property Management",
      "default_category": "SYS.CAT.HOUSING.PROPERTY_FEE",
      "zh_code": "wuye",
      "en_code": "property",
      "weight": 55
    },
    "SYS.MERCHANT.RAIL12306": {
      "id": "SYS.MERCHANT.RAIL12306",
      "zh_name": "12306",
      "en_name": "Rail 12306",
      "default_category": "SYS.CAT.TRAVEL.TRANSPORT",
      "zh_code": "12306",
      "en_code": "rail12306",
      "weight": 55
    },
    "SYS.MERCHANT.SAM": {
      "id": "SYS.MERCHANT.SAM",
      "zh_name": "山姆",
      "en_name": "Sam's Club",
      "default_category": "SYS.CAT.SHOPPING.SUPERMARKET",
      "zh_code": "sam",
      "en_code": "sams",
      "weight": 60
    },
    "SYS.MERCHANT.SCHOOL": {
      "id": "SYS.MERCHANT.SCHOOL",
      "zh_name": "学校",
      "en_name": "School",
      "default_category": "SYS.CAT.EDUCATION.TUITION",
      "zh_code": "xx",
      "en_code": "school",
      "weight": 50
    },
    "SYS.MERCHANT.SF": {
      "id": "SYS.MERCHANT.SF",
      "zh_name": "顺丰",
      "en_name": "SF Express",
      "default_category": "SYS.CAT.WORK.LOGISTICS",
      "zh_code": "sf",
      "en_code": "sf",
      "weight": 55
    },
    "SYS.MERCHANT.SPOTIFY": {
      "id": "SYS.MERCHANT.SPOTIFY",
      "zh_name": "Spotify",
      "en_name": "Spotify",
      "default_category": "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION",
      "zh_code": "sp",
      "en_code": "spotify",
      "weight": 40
    },
    "SYS.MERCHANT.STARBUCKS": {
      "id": "SYS.MERCHANT.STARBUCKS",
      "zh_name": "星巴克",
      "en_name": "Starbucks",
      "default_category": "SYS.CAT.DINING.COFFEE",
      "zh_code": "sbk",
      "en_code": "starbucks",
      "weight": 80
    },
    "SYS.MERCHANT.STATE_GRID": {
      "id": "SYS.MERCHANT.STATE_GRID",
      "zh_name": "国家电网",
      "en_name": "State Grid",
      "default_category": "SYS.CAT.HOUSING.UTILITIES",
      "zh_code": "gw",
      "en_code": "stategrid",
      "weight": 55
    },
    "SYS.MERCHANT.TAOBAO": {
      "id": "SYS.MERCHANT.TAOBAO",
      "zh_name": "淘宝",
      "en_name": "Taobao",
      "default_category": "SYS.CAT.SHOPPING.GENERAL",
      "zh_code": "tb",
      "en_code": "taobao",
      "weight": 70
    },
    "SYS.MERCHANT.TENCENT_VIDEO": {
      "id": "SYS.MERCHANT.TENCENT_VIDEO",
      "zh_name": "腾讯视频",
      "en_name": "Tencent Video",
      "default_category": "SYS.CAT.ENTERTAINMENT.SUBSCRIPTION",
      "zh_code": "tx",
      "en_code": "txvideo",
      "weight": 45
    }
  },
  "banks": {
    "SYS.BANK.ABC": {
      "id": "SYS.BANK.ABC",
      "zh_name": "中国农业银行",
      "en_name": "Agricultural Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 100
    },
    "SYS.BANK.ADBC": {
      "id": "SYS.BANK.ADBC",
      "zh_name": "中国农业发展银行",
      "en_name": "Agricultural Development Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "",
      "weight": 55
    },
    "SYS.BANK.BOA": {
      "id": "SYS.BANK.BOA",
      "zh_name": "美国银行",
      "en_name": "Bank of America",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 40
    },
    "SYS.BANK.BOB": {
      "id": "SYS.BANK.BOB",
      "zh_name": "渤海银行",
      "en_name": "China Bohai Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 70
    },
    "SYS.BANK.BOBJ": {
      "id": "SYS.BANK.BOBJ",
      "zh_name": "北京银行",
      "en_name": "Bank of Beijing",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 70
    },
    "SYS.BANK.BOC": {
      "id": "SYS.BANK.BOC",
      "zh_name": "中国银行",
      "en_name": "Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 100
    },
    "SYS.BANK.BOCOM": {
      "id": "SYS.BANK.BOCOM",
      "zh_name": "交通银行",
      "en_name": "Bank of Communications",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 95
    },
    "SYS.BANK.BOS": {
      "id": "SYS.BANK.BOS",
      "zh_name": "上海银行",
      "en_name": "Bank of Shanghai",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 70
    },
    "SYS.BANK.CCB": {
      "id": "SYS.BANK.CCB",
      "zh_name": "中国建设银行",
      "en_name": "China Construction Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 100
    },
    "SYS.BANK.CDB": {
      "id": "SYS.BANK.CDB",
      "zh_name": "国家开发银行",
      "en_name": "China Development Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "",
      "weight": 60
    },
    "SYS.BANK.CEB": {
      "id": "SYS.BANK.CEB",
      "zh_name": "中国光大银行",
      "en_name": "China Everbright Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 85
    },
    "SYS.BANK.CGB": {
      "id": "SYS.BANK.CGB",
      "zh_name": "广发银行",
      "en_name": "China Guangfa Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 85
    },
    "SYS.BANK.CHENGDU": {
      "id": "SYS.BANK.CHENGDU",
      "zh_name": "成都银行",
      "en_name": "Bank of Chengdu",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 55
    },
    "SYS.BANK.CIB": {
      "id": "SYS.BANK.CIB",
      "zh_name": "兴业银行",
      "en_name": "Industrial Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 85
    },
    "SYS.BANK.CITI": {
      "id": "SYS.BANK.CITI",
      "zh_name": "花旗银行",
      "en_name": "Citibank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.CITIC": {
      "id": "SYS.BANK.CITIC",
      "zh_name": "中信银行",
      "en_name": "China CITIC Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 90
    },
    "SYS.BANK.CMB": {
      "id": "SYS.BANK.CMB",
      "zh_name": "招商银行",
      "en_name": "China Merchants Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 95
    },
    "SYS.BANK.CMBC": {
      "id": "SYS.BANK.CMBC",
      "zh_name": "中国民生银行",
      "en_name": "China Minsheng Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 85
    },
    "SYS.BANK.CQB": {
      "id": "SYS.BANK.CQB",
      "zh_name": "重庆银行",
      "en_name": "Bank of Chongqing",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 55
    },
    "SYS.BANK.CREDIT_UNION": {
      "id": "SYS.BANK.CREDIT_UNION",
      "zh_name": "农村信用社",
      "en_name": "Rural Credit Union",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "",
      "weight": 50
    },
    "SYS.BANK.CSB": {
      "id": "SYS.BANK.CSB",
      "zh_name": "长沙银行",
      "en_name": "Bank of Changsha",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 55
    },
    "SYS.BANK.CZB": {
      "id": "SYS.BANK.CZB",
      "zh_name": "浙商银行",
      "en_name": "China Zheshang Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 75
    },
    "SYS.BANK.DGB": {
      "id": "SYS.BANK.DGB",
      "zh_name": "东莞银行",
      "en_name": "Bank of Dongguan",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 40
    },
    "SYS.BANK.EXIM": {
      "id": "SYS.BANK.EXIM",
      "zh_name": "中国进出口银行",
      "en_name": "Export-Import Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "",
      "weight": 55
    },
    "SYS.BANK.FDB": {
      "id": "SYS.BANK.FDB",
      "zh_name": "富滇银行",
      "en_name": "Fudian Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 35
    },
    "SYS.BANK.GLB": {
      "id": "SYS.BANK.GLB",
      "zh_name": "桂林银行",
      "en_name": "Bank of Guilin",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 35
    },
    "SYS.BANK.GYB": {
      "id": "SYS.BANK.GYB",
      "zh_name": "贵阳银行",
      "en_name": "Bank of Guiyang",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.GZB": {
      "id": "SYS.BANK.GZB",
      "zh_name": "广州银行",
      "en_name": "Bank of Guangzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.HFB": {
      "id": "SYS.BANK.HFB",
      "zh_name": "恒丰银行",
      "en_name": "Hengfeng Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 70
    },
    "SYS.BANK.HKB": {
      "id": "SYS.BANK.HKB",
      "zh_name": "汉口银行",
      "en_name": "Hankou Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 40
    },
    "SYS.BANK.HRB": {
      "id": "SYS.BANK.HRB",
      "zh_name": "哈尔滨银行",
      "en_name": "Harbin Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.HSB": {
      "id": "SYS.BANK.HSB",
      "zh_name": "徽商银行",
      "en_name": "Huishang Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 55
    },
    "SYS.BANK.HSBC": {
      "id": "SYS.BANK.HSBC",
      "zh_name": "汇丰银行",
      "en_name": "HSBC",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 60
    },
    "SYS.BANK.HXB": {
      "id": "SYS.BANK.HXB",
      "zh_name": "华夏银行",
      "en_name": "Huaxia Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 80
    },
    "SYS.BANK.HZB": {
      "id": "SYS.BANK.HZB",
      "zh_name": "杭州银行",
      "en_name": "Bank of Hangzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 60
    },
    "SYS.BANK.ICBC": {
      "id": "SYS.BANK.ICBC",
      "zh_name": "中国工商银行",
      "en_name": "Industrial and Commercial Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 100
    },
    "SYS.BANK.JSB": {
      "id": "SYS.BANK.JSB",
      "zh_name": "江苏银行",
      "en_name": "Bank of Jiangsu",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 65
    },
    "SYS.BANK.LZB": {
      "id": "SYS.BANK.LZB",
      "zh_name": "兰州银行",
      "en_name": "Bank of Lanzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 35
    },
    "SYS.BANK.MUFG": {
      "id": "SYS.BANK.MUFG",
      "zh_name": "三菱日联银行",
      "en_name": "MUFG Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 35
    },
    "SYS.BANK.NBB": {
      "id": "SYS.BANK.NBB",
      "zh_name": "宁波银行",
      "en_name": "Bank of Ningbo",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 60
    },
    "SYS.BANK.NJB": {
      "id": "SYS.BANK.NJB",
      "zh_name": "南京银行",
      "en_name": "Bank of Nanjing",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 60
    },
    "SYS.BANK.OTHER": {
      "id": "SYS.BANK.OTHER",
      "zh_name": "其他银行",
      "en_name": "Other Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 10
    },
    "SYS.BANK.PAB": {
      "id": "SYS.BANK.PAB",
      "zh_name": "平安银行",
      "en_name": "Ping An Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 85
    },
    "SYS.BANK.PSBC": {
      "id": "SYS.BANK.PSBC",
      "zh_name": "中国邮政储蓄银行",
      "en_name": "Postal Savings Bank of China",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 95
    },
    "SYS.BANK.QDB": {
      "id": "SYS.BANK.QDB",
      "zh_name": "青岛银行",
      "en_name": "Bank of Qingdao",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 55
    },
    "SYS.BANK.QLB": {
      "id": "SYS.BANK.QLB",
      "zh_name": "齐鲁银行",
      "en_name": "Qilu Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.RURAL": {
      "id": "SYS.BANK.RURAL",
      "zh_name": "农村商业银行",
      "en_name": "Rural Commercial Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    },
    "SYS.BANK.SCB": {
      "id": "SYS.BANK.SCB",
      "zh_name": "渣打银行",
      "en_name": "Standard Chartered",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    },
    "SYS.BANK.SJB": {
      "id": "SYS.BANK.SJB",
      "zh_name": "盛京银行",
      "en_name": "Shengjing Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    },
    "SYS.BANK.SPDB": {
      "id": "SYS.BANK.SPDB",
      "zh_name": "浦发银行",
      "en_name": "Shanghai Pudong Development Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 90
    },
    "SYS.BANK.SZB": {
      "id": "SYS.BANK.SZB",
      "zh_name": "苏州银行",
      "en_name": "Bank of Suzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    },
    "SYS.BANK.TZB": {
      "id": "SYS.BANK.TZB",
      "zh_name": "台州银行",
      "en_name": "Bank of Taizhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 40
    },
    "SYS.BANK.WZB": {
      "id": "SYS.BANK.WZB",
      "zh_name": "温州银行",
      "en_name": "Bank of Wenzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 40
    },
    "SYS.BANK.XAB": {
      "id": "SYS.BANK.XAB",
      "zh_name": "西安银行",
      "en_name": "Bank of Xi'an",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    },
    "SYS.BANK.XMB": {
      "id": "SYS.BANK.XMB",
      "zh_name": "厦门银行",
      "en_name": "Xiamen Bank",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 45
    },
    "SYS.BANK.ZZB": {
      "id": "SYS.BANK.ZZB",
      "zh_name": "郑州银行",
      "en_name": "Bank of Zhengzhou",
      "savings_category": "SYS.CAT.BANK.DEBIT",
      "credit_category": "SYS.CAT.CREDIT_CARD",
      "weight": 50
    }
  },
  "aliases": [
    {
      "id": "SYS.BANK.ABC",
      "lang": "zh",
      "alias": "农行"
    },
    {
      "id": "SYS.BANK.ABC",
      "lang": "zh",
      "alias": "农业银行"
    },
    {
      "id": "SYS.BANK.ADBC",
      "lang": "zh",
      "alias": "农发行"
    },
    {
      "id": "SYS.BANK.ADBC",
      "lang": "zh",
      "alias": "农业发展银行"
    },
    {
      "id": "SYS.BANK.BOA",
      "lang": "zh",
      "alias": "美国银行"
    },
    {
      "id": "SYS.BANK.BOB",
      "lang": "zh",
      "alias": "渤海"
    },
    {
      "id": "SYS.BANK.BOBJ",
      "lang": "zh",
      "alias": "北京银行"
    },
    {
      "id": "SYS.BANK.BOC",
      "lang": "zh",
      "alias": "中行"
    },
    {
      "id": "SYS.BANK.BOCOM",
      "lang": "zh",
      "alias": "交行"
    },
    {
      "id": "SYS.BANK.BOS",
      "lang": "zh",
      "alias": "上海银行"
    },
    {
      "id": "SYS.BANK.CCB",
      "lang": "zh",
      "alias": "建设银行"
    },
    {
      "id": "SYS.BANK.CCB",
      "lang": "zh",
      "alias": "建行"
    },
    {
      "id": "SYS.BANK.CDB",
      "lang": "zh",
      "alias": "国开行"
    },
    {
      "id": "SYS.BANK.CDB",
      "lang": "zh",
      "alias": "开发银行"
    },
    {
      "id": "SYS.BANK.CEB",
      "lang": "zh",
      "alias": "光大"
    },
    {
      "id": "SYS.BANK.CEB",
      "lang": "zh",
      "alias": "光大银行"
    },
    {
      "id": "SYS.BANK.CGB",
      "lang": "zh",
      "alias": "广发"
    },
    {
      "id": "SYS.BANK.CHENGDU",
      "lang": "zh",
      "alias": "成都银行"
    },
    {
      "id": "SYS.BANK.CIB",
      "lang": "zh",
      "alias": "兴业"
    },
    {
      "id": "SYS.BANK.CITI",
      "lang": "zh",
      "alias": "花旗"
    },
    {
      "id": "SYS.BANK.CITIC",
      "lang": "zh",
      "alias": "中信"
    },
    {
      "id": "SYS.BANK.CMB",
      "lang": "zh",
      "alias": "招行"
    },
    {
      "id": "SYS.BANK.CMBC",
      "lang": "zh",
      "alias": "民生"
    },
    {
      "id": "SYS.BANK.CMBC",
      "lang": "zh",
      "alias": "民生银行"
    },
    {
      "id": "SYS.BANK.CQB",
      "lang": "zh",
      "alias": "重庆银行"
    },
    {
      "id": "SYS.BANK.CREDIT_UNION",
      "lang": "zh",
      "alias": "信用储"
    },
    {
      "id": "SYS.BANK.CREDIT_UNION",
      "lang": "zh",
      "alias": "信用社"
    },
    {
      "id": "SYS.BANK.CSB",
      "lang": "zh",
      "alias": "长沙银行"
    },
    {
      "id": "SYS.BANK.CZB",
      "lang": "zh",
      "alias": "浙商"
    },
    {
      "id": "SYS.BANK.DGB",
      "lang": "zh",
      "alias": "东莞银行"
    },
    {
      "id": "SYS.BANK.EXIM",
      "lang": "zh",
      "alias": "进出口行"
    },
    {
      "id": "SYS.BANK.EXIM",
      "lang": "zh",
      "alias": "进出口银行"
    },
    {
      "id": "SYS.BANK.FDB",
      "lang": "zh",
      "alias": "富滇银行"
    },
    {
      "id": "SYS.BANK.GLB",
      "lang": "zh",
      "alias": "桂林银行"
    },
    {
      "id": "SYS.BANK.GYB",
      "lang": "zh",
      "alias": "贵阳银行"
    },
    {
      "id": "SYS.BANK.GZB",
      "lang": "zh",
      "alias": "广州银行"
    },
    {
      "id": "SYS.BANK.HFB",
      "lang": "zh",
      "alias": "恒丰"
    },
    {
      "id": "SYS.BANK.HKB",
      "lang": "zh",
      "alias": "汉口银行"
    },
    {
      "id": "SYS.BANK.HRB",
      "lang": "zh",
      "alias": "哈尔滨银行"
    },
    {
      "id": "SYS.BANK.HSB",
      "lang": "zh",
      "alias": "徽商银行"
    },
    {
      "id": "SYS.BANK.HSBC",
      "lang": "zh",
      "alias": "汇丰"
    },
    {
      "id": "SYS.BANK.HXB",
      "lang": "zh",
      "alias": "华夏"
    },
    {
      "id": "SYS.BANK.HXB",
      "lang": "zh",
      "alias": "华夏银行"
    },
    {
      "id": "SYS.BANK.HZB",
      "lang": "zh",
      "alias": "杭州银行"
    },
    {
      "id": "SYS.BANK.ICBC",
      "lang": "zh",
      "alias": "工商银行"
    },
    {
      "id": "SYS.BANK.ICBC",
      "lang": "zh",
      "alias": "工行"
    },
    {
      "id": "SYS.BANK.JSB",
      "lang": "zh",
      "alias": "江苏银行"
    },
    {
      "id": "SYS.BANK.LZB",
      "lang": "zh",
      "alias": "兰州银行"
    },
    {
      "id": "SYS.BANK.MUFG",
      "lang": "zh",
      "alias": "三菱日联"
    },
    {
      "id": "SYS.BANK.NBB",
      "lang": "zh",
      "alias": "宁波银行"
    },
    {
      "id": "SYS.BANK.NJB",
      "lang": "zh",
      "alias": "南京银行"
    },
    {
      "id": "SYS.BANK.OTHER",
      "lang": "zh",
      "alias": "其他银行"
    },
    {
      "id": "SYS.BANK.PAB",
      "lang": "zh",
      "alias": "平安"
    },
    {
      "id": "SYS.BANK.PSBC",
      "lang": "zh",
      "alias": "邮储"
    },
    {
      "id": "SYS.BANK.PSBC",
      "lang": "zh",
      "alias": "邮政储蓄银行"
    },
    {
      "id": "SYS.BANK.QDB",
      "lang": "zh",
      "alias": "青岛银行"
    },
    {
      "id": "SYS.BANK.QLB",
      "lang": "zh",
      "alias": "齐鲁银行"
    },
    {
      "id": "SYS.BANK.RURAL",
      "lang": "zh",
      "alias": "农商行"
    },
    {
      "id": "SYS.BANK.SCB",
      "lang": "zh",
      "alias": "渣打"
    },
    {
      "id": "SYS.BANK.SJB",
      "lang": "zh",
      "alias": "盛京银行"
    },
    {
      "id": "SYS.BANK.SPDB",
      "lang": "zh",
      "alias": "浦发"
    },
    {
      "id": "SYS.BANK.SZB",
      "lang": "zh",
      "alias": "苏州银行"
    },
    {
      "id": "SYS.BANK.TZB",
      "lang": "zh",
      "alias": "台州银行"
    },
    {
      "id": "SYS.BANK.WZB",
      "lang": "zh",
      "alias": "温州银行"
    },
    {
      "id": "SYS.BANK.XAB",
      "lang": "zh",
      "alias": "西安银行"
    },
    {
      "id": "SYS.BANK.XMB",
      "lang": "zh",
      "alias": "厦门银行"
    },
    {
      "id": "SYS.BANK.ZZB",
      "lang": "zh",
      "alias": "郑州银行"
    },
    {
      "id": "SYS.CAT.BANK.DEBIT",
      "lang": "zh",
      "alias": "银行卡"
    },
    {
      "id": "SYS.CAT.BANK",
      "lang": "en",
      "alias": "bank"
    },
    {
      "id": "SYS.CAT.BANK",
      "lang": "zh",
      "alias": "银行"
    },
    {
      "id": "SYS.CAT.CAPITAL",
      "lang": "en",
      "alias": "paid_in_capital"
    },
    {
      "id": "SYS.CAT.CAPITAL",
      "lang": "zh",
      "alias": "实收资本"
    },
    {
      "id": "SYS.CAT.CASH.ALIPAY",
      "lang": "zh",
      "alias": "支付宝"
    },
    {
      "id": "SYS.CAT.CASH.PREPAID",
      "lang": "en",
      "alias": "prepaid_card"
    },
    {
      "id": "SYS.CAT.CASH.PREPAID",
      "lang": "zh",
      "alias": "储值卡"
    },
    {
      "id": "SYS.CAT.CASH.PREPAID",
      "lang": "zh",
      "alias": "饭卡"
    },
    {
      "id": "SYS.CAT.CASH.WECHAT",
      "lang": "zh",
      "alias": "微信"
    },
    {
      "id": "SYS.CAT.CASH",
      "lang": "en",
      "alias": "cash"
    },
    {
      "id": "SYS.CAT.CASH",
      "lang": "zh",
      "alias": "现金"
    },
    {
      "id": "SYS.CAT.COMMUNICATION.MOBILE",
      "lang": "en",
      "alias": "phone"
    },
    {
      "id": "SYS.CAT.COMMUNICATION.MOBILE",
      "lang": "zh",
      "alias": "话费"
    },
    {
      "id": "SYS.CAT.COMMUNICATION",
      "lang": "en",
      "alias": "communication"
    },
    {
      "id": "SYS.CAT.COMMUNICATION",
      "lang": "zh",
      "alias": "通信"
    },
    {
      "id": "SYS.CAT.COST.INVENTORY",
      "lang": "zh",
      "alias": "存货"
    },
    {
      "id": "SYS.CAT.COST.MATERIAL",
      "lang": "zh",
      "alias": "原料"
    },
    {
      "id": "SYS.CAT.COST",
      "lang": "en",
      "alias": "cost"
    },
    {
      "id": "SYS.CAT.COST",
      "lang": "zh",
      "alias": "生产"
    },
    {
      "id": "SYS.CAT.CREDIT_CARD",
      "lang": "zh",
      "alias": "贷记卡"
    },
    {
      "id": "SYS.CAT.DINING.COFFEE",
      "lang": "en",
      "alias": "latte"
    },
    {
      "id": "SYS.CAT.DINING.COFFEE",
      "lang": "zh",
      "alias": "咖啡"
    },
    {
      "id": "SYS.CAT.DINING.COFFEE",
      "lang": "zh",
      "alias": "奶茶"
    },
    {
      "id": "SYS.CAT.DINING.GENERAL",
      "lang": "zh",
      "alias": "糕点"
    },
    {
      "id": "SYS.CAT.DINING.GENERAL",
      "lang": "zh",
      "alias": "快餐"
    },
    {
      "id": "SYS.CAT.DINING.GENERAL",
      "lang": "zh",
      "alias": "零食"
    },
    {
      "id": "SYS.CAT.DINING.TAKEOUT",
      "lang": "en",
      "alias": "delivery"
    },
    {
      "id": "SYS.CAT.DINING.TAKEOUT",
      "lang": "zh",
      "alias": "外卖"
    },
    {
      "id": "SYS.CAT.DINING",
      "lang": "en",
      "alias": "dining"
    },
    {
      "id": "SYS.CAT.DINING",
      "lang": "zh",
      "alias": "吃饭"
    },
    {
      "id": "SYS.CAT.EDUCATION.TUITION",
      "lang": "zh",
      "alias": "学校"
    },
    {
      "id": "SYS.CAT.EDUCATION",
      "lang": "en",
      "alias": "education"
    },
    {
      "id": "SYS.CAT.EDUCATION",
      "lang": "zh",
      "alias": "学习"
    },
    {
      "id": "SYS.CAT.ENTERTAINMENT.GENERAL",
      "lang": "zh",
      "alias": "彩票"
    },
    {
      "id": "SYS.CAT.ENTERTAINMENT.MOVIE",
      "lang": "zh",
      "alias": "看电影"
    },
    {
      "id": "SYS.CAT.ENTERTAINMENT",
      "lang": "en",
      "alias": "entertainment"
    },
    {
      "id": "SYS.CAT.ENTERTAINMENT",
      "lang": "zh",
      "alias": "休闲"
    },
    {
      "id": "SYS.CAT.FAMILY.DIAPERS",
      "lang": "zh",
      "alias": "尿布"
    },
    {
      "id": "SYS.CAT.FAMILY",
      "lang": "en",
      "alias": "family"
    },
    {
      "id": "SYS.CAT.FAMILY",
      "lang": "zh",
      "alias": "家用"
    },
    {
      "id": "SYS.CAT.FIXED_ASSET",
      "lang": "en",
      "alias": "fixed_asset"
    },
    {
      "id": "SYS.CAT.FIXED_ASSET",
      "lang": "zh",
      "alias": "固定资产"
    },
    {
      "id": "SYS.CAT.HEALTH.CLINIC",
      "lang": "zh",
      "alias": "挂号"
    },
    {
      "id": "SYS.CAT.HEALTH.CLINIC",
      "lang": "zh",
      "alias": "看病"
    },
    {
      "id": "SYS.CAT.HEALTH",
      "lang": "en",
      "alias": "health"
    },
    {
      "id": "SYS.CAT.HEALTH",
      "lang": "zh",
      "alias": "医疗"
    },
    {
      "id": "SYS.CAT.HOUSING.RENT",
      "lang": "zh",
      "alias": "租房"
    },
    {
      "id": "SYS.CAT.HOUSING.RENT",
      "lang": "zh",
      "alias": "租金"
    },
    {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "lang": "en",
      "alias": "electricity"
    },
    {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "lang": "en",
      "alias": "water"
    },
    {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "lang": "zh",
      "alias": "电费"
    },
    {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "lang": "zh",
      "alias": "燃气费"
    },
    {
      "id": "SYS.CAT.HOUSING.UTILITIES",
      "lang": "zh",
      "alias": "水费"
    },
    {
      "id": "SYS.CAT.HOUSING",
      "lang": "en",
      "alias": "housing"
    },
    {
      "id": "SYS.CAT.HOUSING",
      "lang": "zh",
      "alias": "住房"
    },
    {
      "id": "SYS.CAT.INCOME_SUMMARY",
      "lang": "en",
      "alias": "income_summary"
    },
    {
      "id": "SYS.CAT.INCOME_SUMMARY",
      "lang": "zh",
      "alias": "结转"
    },
    {
      "id": "SYS.CAT.INCOME_SUMMARY",
      "lang": "zh",
      "alias": "收入汇总"
    },
    {
      "id": "SYS.CAT.INSURANCE",
      "lang": "en",
      "alias": "insurance"
    },
    {
      "id": "SYS.CAT.INSURANCE",
      "lang": "zh",
      "alias": "保费"
    },
    {
      "id": "SYS.CAT.INVESTMENT",
      "lang": "en",
      "alias": "investment"
    },
    {
      "id": "SYS.CAT.INVESTMENT",
      "lang": "zh",
      "alias": "投资"
    },
    {
      "id": "SYS.CAT.MISC.SERVICE_FEE",
      "lang": "zh",
      "alias": "快递费"
    },
    {
      "id": "SYS.CAT.MISC",
      "lang": "en",
      "alias": "misc"
    },
    {
      "id": "SYS.CAT.MISC",
      "lang": "zh",
      "alias": "杂项"
    },
    {
      "id": "SYS.CAT.MORTGAGE",
      "lang": "zh",
      "alias": "按揭"
    },
    {
      "id": "SYS.CAT.PART_TIME",
      "lang": "zh",
      "alias": "临工"
    },
    {
      "id": "SYS.CAT.RECEIVABLE",
      "lang": "en",
      "alias": "receivable"
    },
    {
      "id": "SYS.CAT.RECEIVABLE",
      "lang": "zh",
      "alias": "应收"
    },
    {
      "id": "SYS.CAT.SALARY",
      "lang": "zh",
      "alias": "薪水"
    },
    {
      "id": "SYS.CAT.SHOPPING.BEAUTY",
      "lang": "zh",
      "alias": "理发"
    },
    {
      "id": "SYS.CAT.SHOPPING.SUPERMARKET",
      "lang": "en",
      "alias": "groceries"
    },
    {
      "id": "SYS.CAT.SHOPPING.SUPERMARKET",
      "lang": "zh",
      "alias": "买菜"
    },
    {
      "id": "SYS.CAT.SHOPPING",
      "lang": "en",
      "alias": "shopping"
    },
    {
      "id": "SYS.CAT.SHOPPING",
      "lang": "zh",
      "alias": "买东西"
    },
    {
      "id": "SYS.CAT.SOCIAL.RED_PACKET",
      "lang": "zh",
      "alias": "压岁钱"
    },
    {
      "id": "SYS.CAT.SOCIAL",
      "lang": "en",
      "alias": "social"
    },
    {
      "id": "SYS.CAT.SOCIAL",
      "lang": "zh",
      "alias": "人情"
    },
    {
      "id": "SYS.CAT.TAX_FINANCE.BANK_FEE",
      "lang": "zh",
      "alias": "手续费"
    },
    {
      "id": "SYS.CAT.TAX_FINANCE.INCOME_TAX",
      "lang": "zh",
      "alias": "个税"
    },
    {
      "id": "SYS.CAT.TAX_FINANCE",
      "lang": "en",
      "alias": "tax"
    },
    {
      "id": "SYS.CAT.TAX_FINANCE",
      "lang": "zh",
      "alias": "税费"
    },
    {
      "id": "SYS.CAT.TRANSPORT.FUEL",
      "lang": "en",
      "alias": "gas"
    },
    {
      "id": "SYS.CAT.TRANSPORT.FUEL",
      "lang": "zh",
      "alias": "油费"
    },
    {
      "id": "SYS.CAT.TRANSPORT.GENERAL",
      "lang": "zh",
      "alias": "汽车"
    },
    {
      "id": "SYS.CAT.TRANSPORT.PUBLIC_TRANSIT",
      "lang": "en",
      "alias": "metro"
    },
    {
      "id": "SYS.CAT.TRANSPORT.PUBLIC_TRANSIT",
      "lang": "zh",
      "alias": "地铁"
    },
    {
      "id": "SYS.CAT.TRANSPORT.PUBLIC_TRANSIT",
      "lang": "zh",
      "alias": "公交"
    },
    {
      "id": "SYS.CAT.TRANSPORT.RIDE_HAILING",
      "lang": "en",
      "alias": "taxi"
    },
    {
      "id": "SYS.CAT.TRANSPORT.RIDE_HAILING",
      "lang": "zh",
      "alias": "出租车"
    },
    {
      "id": "SYS.CAT.TRANSPORT.RIDE_HAILING",
      "lang": "zh",
      "alias": "滴滴"
    },
    {
      "id": "SYS.CAT.TRANSPORT",
      "lang": "en",
      "alias": "transport"
    },
    {
      "id": "SYS.CAT.TRANSPORT",
      "lang": "zh",
      "alias": "出行"
    },
    {
      "id": "SYS.CAT.TRAVEL.ACCOMMODATION",
      "lang": "zh",
      "alias": "酒店"
    },
    {
      "id": "SYS.CAT.TRAVEL.ACCOMMODATION",
      "lang": "zh",
      "alias": "民宿"
    },
    {
      "id": "SYS.CAT.TRAVEL",
      "lang": "en",
      "alias": "travel"
    },
    {
      "id": "SYS.CAT.TRAVEL",
      "lang": "zh",
      "alias": "旅游"
    },
    {
      "id": "SYS.CAT.WORK.LOGISTICS",
      "lang": "zh",
      "alias": "快递"
    },
    {
      "id": "SYS.CAT.WORK.TRAVEL",
      "lang": "zh",
      "alias": "出差"
    },
    {
      "id": "SYS.CAT.WORK",
      "lang": "en",
      "alias": "work"
    },
    {
      "id": "SYS.CAT.WORK",
      "lang": "zh",
      "alias": "公司"
    }
  ],
  "stats": {
    "nodeCount": 190,
    "leafCount": 162,
    "typeCount": 6,
    "categoryCount": 183,
    "merchantCount": 30,
    "bankCount": 56,
    "aliasCount": 169,
    "maxDepth": 3,
    "maxBranching": 16,
    "postableCount": 162
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
