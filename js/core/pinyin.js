/* TxtVein · 拼音首字母（纯函数，零 DOM）
 *
 * 不做字表：中文 Intl.Collator 是按拼音排序的，拿它与 23 个字母代表字
 * 逐一比较，就能定位任意常用汉字落在哪个字母区间。账本里的分类/节点名
 * 是用户自己起的，字表一定会漏生僻字。
 *
 * 已知局限（都是退化，不是算错）：
 *   · 生僻字可能落在拼音区之外 → 返回空串，调用方回退到名字匹配；
 *   · 多音字按 ICU 默认读音；
 *   · 环境不支持 Intl.Collator 时整体返回空串。
 *
 * 英文侧另给 latinInitials：按非字母数字切词，取每词首字母（WeChat Wallet → ww）。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});

  const BOUNDS = [
    ['a', '阿'], ['b', '八'], ['c', '嚓'], ['d', '搭'], ['e', '鹅'], ['f', '发'],
    ['g', '噶'], ['h', '哈'], ['j', '击'], ['k', '喀'], ['l', '拉'], ['m', '妈'],
    ['n', '拿'], ['o', '哦'], ['p', '啪'], ['q', '七'], ['r', '然'], ['s', '撒'],
    ['t', '塌'], ['w', '挖'], ['x', '夕'], ['y', '压'], ['z', '匝'],
  ];

  let collator;
  function getCollator() {
    if (collator !== undefined) return collator;
    try {
      collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });
    } catch (e) {
      collator = null;
    }
    return collator;
  }

  /**
   * Collator 边界法的例外表（基本区 180 字，来自 mozillazg/pinyin-data 的首读音）。
   * 例：咖啡的「咖」在 zh 排序里排在「喀」之前，会被误判成 j；这里纠正为 k。
   * 用「字+首字母」成对拼成字符串，比 180 个对象字面量省体积。
   */
  const EXC_PAIRS = '丌j丫y丷b乼z亇g他t仨s伬c伽g佦y傀g劸w厖p叚j吖y呇q呒w呚q呥r呷g咁g咑d咔k咖k咳k哒d唝g嗒d嘎g嘠g嘬c噦y噱j噷x圧y圫y坻c垃l埔p埫c堨y堲c她t妑p妧w婤c婼c孅q它t尜g尢y屲w峿y嶦z巬g巭g帀z廆g徔c恷q扞g拏n挱s挲s掞s旮g柁d柷c椎c楪y橵z橺x櫵q欹y欻c氞n氿g洓s湞z溚t漴z焘d煀q煷h燝z爠q牠t玚c瑱z瓲t癿q皅p硊w硍x硘h碈m碡d祂t穜z穵w窨x笚d笹s篒y紦h緕z繌z繧w纥g耷d肰r脦t舥p芎q芘p茋z荅d菹j葰s蔈b蕃f薁y蚦r蚺r螁t螩d衻r袇r袡r袷j裄h讥j豉s趴p趿t辗n酂c酢c釐l釓g鉄t錻b鎆j鏱j钆g钭t铊t铤d阘d阚h陂b隗k餎g饧t鵤z鸀c龈k龬w龵s龻l鿃s鿄l鿌l鿔g鿕d鿬t鿭n鿰h鿱b鿲l鿳t鿴d鿶l鿸t鿹m鿺m鿻b鿼j鿾l鿿x';
  const EXC = new Map();
  for (let i = 0; i + 1 < EXC_PAIRS.length; i += 2) {
    EXC.set(EXC_PAIRS.charAt(i), EXC_PAIRS.charAt(i + 1));
  }

  function isHanzi(ch) {
    return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(ch || ''));
  }

  /** 单字 → 小写拼音首字母；非汉字原样小写。 */
  function initialOf(ch) {
    const s = String(ch || '');
    if (!s) return '';
    if (!isHanzi(s)) return s.toLowerCase();
    if (EXC.has(s)) return EXC.get(s);
    const coll = getCollator();
    if (!coll) return '';
    let ans = '';
    for (const [letter, bound] of BOUNDS) {
      if (coll.compare(s, bound) >= 0) ans = letter;
      else break;
    }
    return ans;
  }

  /** 一段文字 → 逐字首字母；空白跳过。 */
  function initialsOf(text) {
    let out = '';
    for (const ch of String(text || '')) {
      if (/\s/.test(ch)) continue;
      out += initialOf(ch);
    }
    return out;
  }

  /** 名字/首字母是否命中查询串（只输入字母时走首字母，汉字先按名字匹配）。 */
  function initialsMatch(text, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return false;
    return initialsOf(text).includes(q);
  }

  /** 英文名首字母：WeChat Wallet → ww；Coffee → c。 */
  function latinInitials(text) {
    return String(text || '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toLowerCase())
      .join('');
  }

  TV.pinyin = { BOUNDS, isHanzi, initialOf, initialsOf, initialsMatch, latinInitials };
  if (typeof module === 'object' && module.exports) module.exports = TV.pinyin;
})(typeof globalThis !== 'undefined' ? globalThis : this);
