'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTV } = require('./helpers/load.cjs');

const TV = loadTV();
const P = TV.pinyin;

test('拼音首字母：常用分类名', () => {
  assert.equal(P.initialsOf('日常'), 'rc');
  assert.equal(P.initialsOf('房租'), 'fz');
  assert.equal(P.initialsOf('花呗'), 'hb');
  assert.equal(P.initialsOf('咖啡'), 'kf');
  assert.equal(P.initialsOf('出行'), 'cx');
  assert.equal(P.initialsOf(''), '');
});

test('拼音首字母：Collator 例外汇总', () => {
  /* 这些字在 zh 排序里会排到前一个字母区间，靠例外表纠正 */
  assert.equal(P.initialOf('咖'), 'k');
  assert.equal(P.initialOf('他'), 't');
  assert.equal(P.initialOf('丫'), 'y');
});

test('拼音首字母：非汉字保留字母/数字，空白跳过', () => {
  assert.equal(P.initialsOf('wx1'), 'wx1');
  assert.equal(P.initialsOf('花 呗'), 'hb');
  assert.equal(P.initialsMatch('花呗', 'hb'), true);
  assert.equal(P.initialsMatch('花呗', 'zz'), false);
});

test('英文首字母：按词取首字母', () => {
  assert.equal(P.latinInitials('WeChat Wallet'), 'ww');
  assert.equal(P.latinInitials('Coffee'), 'c');
  assert.equal(P.latinInitials('Dining out'), 'do');
  assert.equal(P.latinInitials(''), '');
});
