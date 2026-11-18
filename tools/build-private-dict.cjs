'use strict';

/* 把桌面 私有树.txt 转成 TxtVein 私人字典：
 *   local/private.dict.tv   单文件字典源码（可直接粘进“字典”页）
 *   local/user_p.dict       P/F 侧
 *   local/user_c.dict       C/H 侧
 *   local/private-tree.json 统计/冲突/锚点报告
 *
 * 不写保险库、不改 system.dict；只生成本地文件。
 */
const fs = require('fs');
const path = require('path');
const { loadTV } = require('../tests/helpers/load.cjs');

const TV = loadTV();
const D = TV.dict;
const A = TV.anchor;
const SRC = process.env.PRIVATE_TREE || 'C:\\Users\\Administrator\\Desktop\\私有树.txt';
const OUT = path.join(__dirname, '..', 'local');

const TYPE_MAP = {
  权益类: '权益', 资产类: '资产', 负债类: '负债', 收入类: '收入', 费用类: '费用', 成本类: '成本',
};
const GROUP_EN = {
  权益: 'Equity', 储蓄: 'Savings', 现金: 'Cash', 网账: 'Online', 充值: 'Prepaid',
  应收: 'Receivable', 信用: 'Credit', 网贷: 'Online Loans', 应付: 'Payable',
  工资: 'Salary', 外快: 'Side Income', 结转: 'Closing', 投资: 'Capital',
  日常: 'Daily', 生活: 'Living', 保健: 'Health', 通勤: 'Commute', 出行: 'Travel',
  服饰: 'Clothing', 休闲: 'Leisure', 学习: 'Study', 应酬: 'Social', 公益: 'Charity', 损失: 'Loss',
};
const GROUP_CODE = {
  权益: 'g_equity', 储蓄: 'g_savings', 现金: 'g_cash', 网账: 'g_online', 充值: 'g_prepaid',
  应收: 'g_receivable', 信用: 'g_credit', 网贷: 'g_loans', 应付: 'g_payable',
  工资: 'g_salary', 外快: 'g_side', 结转: 'g_closing', 投资: 'g_capital',
  日常: 'g_daily', 生活: 'g_life', 保健: 'g_health', 通勤: 'g_commute', 出行: 'g_travel',
  服饰: 'g_clothing', 休闲: 'g_leisure', 学习: 'g_study', 应酬: 'g_social', 公益: 'g_charity', 损失: 'g_loss',
};
const ANCHOR = {
  QC: 'SYS.CAT.OPENING_EQUITY', SRZ: 'SYS.CAT.INCOME_SUMMARY', SSZ: 'SYS.CAT.CAPITAL',
  ZHC: 'SYS.CAT.BANK.DEBIT', JHC: 'SYS.CAT.BANK.DEBIT', GHC: 'SYS.CAT.BANK.DEBIT',
  NHC: 'SYS.CAT.BANK.DEBIT', XYC: 'SYS.CAT.BANK.DEBIT', ZGC: 'SYS.CAT.BANK.DEBIT',
  XJ: 'SYS.CAT.CASH.WALLET', ZFB: 'SYS.CAT.CASH.ALIPAY', WX: 'SYS.CAT.CASH.WECHAT',
  FK: 'SYS.CAT.CASH.PREPAID', QYS: 'SYS.CAT.RECEIVABLE.GENERAL',
  ZHX: 'SYS.CAT.CREDIT_CARD', JHX: 'SYS.CAT.CREDIT_CARD', GFX: 'SYS.CAT.CREDIT_CARD',
  ZXX: 'SYS.CAT.CREDIT_CARD', JHX2: 'SYS.CAT.CREDIT_CARD',
  ZLD: 'SYS.CAT.CONSUMER_LOAN', DY: 'SYS.CAT.HUABEI', MT: 'SYS.CAT.HUABEI',
  HB: 'SYS.CAT.HUABEI', JB: 'SYS.CAT.CONSUMER_LOAN', '58D': 'SYS.CAT.CONSUMER_LOAN',
  YXH: 'SYS.CAT.CONSUMER_LOAN', AYH: 'SYS.CAT.CONSUMER_LOAN', QYF: 'SYS.CAT.PAYABLE',
  GZ: 'SYS.CAT.SALARY', LG: 'SYS.CAT.PART_TIME',
  S: 'SYS.CAT.HOUSING.UTILITIES', ZC: 'SYS.CAT.DINING.BREAKFAST',
  KC: 'SYS.CAT.DINING.GENERAL', LS: 'SYS.CAT.DINING.GENERAL', GD: 'SYS.CAT.DINING.GENERAL',
  SG: 'SYS.CAT.SHOPPING.SUPERMARKET', MC: 'SYS.CAT.SHOPPING.SUPERMARKET',
  HF: 'SYS.CAT.COMMUNICATION.MOBILE', LF: 'SYS.CAT.SHOPPING.BEAUTY',
  RYP: 'SYS.CAT.SHOPPING.DAILY', KD: 'SYS.CAT.MISC.SERVICE_FEE', BZ: 'SYS.CAT.MISC.GENERAL',
  DC: 'SYS.CAT.DINING.TAKEOUT', FZ: 'SYS.CAT.HOUSING.RENT', SDF: 'SYS.CAT.HOUSING.UTILITIES',
  WXF: 'SYS.CAT.HOUSING.REPAIR', YP: 'SYS.CAT.HEALTH.PHARMACY', ZL: 'SYS.CAT.HEALTH.CLINIC',
  JK: 'SYS.CAT.HEALTH.GENERAL', DT: 'SYS.CAT.TRANSPORT.PUBLIC_TRANSIT',
  GJ: 'SYS.CAT.TRANSPORT.PUBLIC_TRANSIT', GXC: 'SYS.CAT.TRANSPORT.GENERAL',
  CZC: 'SYS.CAT.TRANSPORT.RIDE_HAILING', QCAR: 'SYS.CAT.TRANSPORT.GENERAL',
  HC: 'SYS.CAT.TRANSPORT.TRAIN', FJ: 'SYS.CAT.TRANSPORT.FLIGHT', JY: 'SYS.CAT.TRANSPORT.FUEL',
  GLF: 'SYS.CAT.TRANSPORT.GENERAL', TCF: 'SYS.CAT.TRANSPORT.PARKING',
  YF: 'SYS.CAT.SHOPPING.CLOTHING', KZ: 'SYS.CAT.SHOPPING.CLOTHING', XZ: 'SYS.CAT.SHOPPING.CLOTHING',
  SP: 'SYS.CAT.SHOPPING.CLOTHING', LY: 'SYS.CAT.TRAVEL.GENERAL', WJ: 'SYS.CAT.ENTERTAINMENT.HOBBY',
  JS: 'SYS.CAT.HEALTH.FITNESS', YX: 'SYS.CAT.ENTERTAINMENT.GAME', YY: 'SYS.CAT.ENTERTAINMENT.MOVIE',
  CP: 'SYS.CAT.ENTERTAINMENT.GENERAL', SJ: 'SYS.CAT.EDUCATION.TEXTBOOK', JC: 'SYS.CAT.EDUCATION.ONLINE_COURSE',
  ZK: 'SYS.CAT.SOCIAL.GIFT', SL: 'SYS.CAT.SOCIAL.GIFT', QK: 'SYS.CAT.SOCIAL.TREAT',
  JZ: 'SYS.CAT.SOCIAL.DONATION', BX: 'SYS.CAT.INSURANCE.GENERAL',
  PC: 'SYS.CAT.MISC.LOSS', YS: 'SYS.CAT.MISC.LOSS', FD: 'SYS.CAT.MISC.LOSS',
  SXF: 'SYS.CAT.TAX_FINANCE.BANK_FEE', QZC: 'SYS.CAT.MISC.GENERAL',
};

function rows() {
  const raw = fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '');
  const out = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || /^会计类型/.test(t)) return;
    const c = t.split(/[，,]/).map((x) => x.trim());
    if (c.length < 4) return;
    const type = TYPE_MAP[c[0]];
    if (!type) return;
    out.push({ line: i + 1, type, group: c[1], code: c[2], name: c[3], opening: c[4] || '0.00' });
  });
  return out;
}

function main() {
  const list = rows();
  const d = D.emptyDict('private', new Date());
  const groups = {};
  const leafSort = {};
  const used = new Set();
  const codeChanges = [];
  const anchorReport = [];
  let sort = 10;

  list.forEach((r) => {
    const gkey = r.type + '\u0000' + r.group;
    if (!groups[gkey]) {
      const gcode = GROUP_CODE[r.group] || ('g_' + String(sort));
      const g = D.addNode(d, {
        zh_name: r.group, en_name: GROUP_EN[r.group] || r.group,
        zh_code: gcode, en_code: gcode, type: r.type, domain: 'P',
        weight: 100, sort,
      });
      if (!g.ok) throw new Error('组创建失败：' + r.group + ' / ' + g.error);
      groups[gkey] = g.id;
      sort += 10;
    }
    let code = r.code;
    if (used.has(code)) {
      const next = r.type === '费用' && r.code === 'QC' ? 'QCAR' : code + '2';
      codeChanges.push({ from: r.code, to: next, name: r.name, type: r.type });
      code = next;
    }
    while (used.has(code)) code += '2';
    used.add(code);
    leafSort[gkey] = (leafSort[gkey] || 0) + 10;
    const n = D.addNode(d, {
      zh_name: r.name, en_name: r.name,
      zh_code: code, en_code: code.toLowerCase(),
      type: r.type, domain: 'P', parent_id: groups[gkey],
      weight: 100, sort: leafSort[gkey],
    });
    if (!n.ok) throw new Error('节点创建失败：' + r.name + ' / ' + n.error);
    const anchor = ANCHOR[code] || ANCHOR[r.code];
    if (anchor) {
      const a = A.set(d, n.id, anchor, TV.systemDict, { hasHistory: false });
      anchorReport.push({ code, name: r.name, anchor, ok: a.ok, error: a.error || '' });
    }
  });

  const source = TV.source.dictToSource(d);
  const split = TV.userDict.split(source);
  if (!split.ok) throw new Error('拆分失败：' + JSON.stringify(split.diagnostics.slice(0, 5)));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'private.dict.tv'), source, 'utf8');
  fs.writeFileSync(path.join(OUT, 'user_p.dict'), split.p, 'utf8');
  fs.writeFileSync(path.join(OUT, 'user_c.dict'), split.c, 'utf8');
  fs.writeFileSync(path.join(OUT, 'private-tree.txt'), [
    '## 统计',
    '## 流水',
    '## 行为',
    '## 备注',
    '## 字典',
    source,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT, 'private-tree.json'), JSON.stringify({
    source: SRC,
    rows: list.length,
    groups: Object.keys(groups).length,
    nodes: Object.keys(d.nodes).length,
    trees: source.split(/\r?\n/).filter((x) => /^[PCFH] (费用|收入|资产|负债|成本|权益)$/.test(x)).length,
    codeChanges,
    anchors: anchorReport,
  }, null, 2), 'utf8');

  console.log('rows', list.length, 'groups', Object.keys(groups).length, 'nodes', Object.keys(d.nodes).length);
  console.log('codeChanges', codeChanges);
  console.log('anchors', anchorReport.filter((x) => x.ok).length, '/', anchorReport.length);
  console.log('wrote', OUT);
}

main();
