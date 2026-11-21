# 主题与页面字号

> 2026-11-21 / v2.8.2。深色与电纸书各有一套**颜色**；**字号只有一套，两套主题共用**，
> 并且按页面分开：查询 / 流水 / 字典 / 母树 / 固定 / 统计。

## 一、存储

```js
localStorage['txtvein.prefs.v3'] = {
  theme: 'dark' | 'paper',
  dark:  { colors: { invalid, linenumber, lineerror, date, node, operator, amount, note } },
  paper: { colors: { …同上一套键… } },
  fonts: { query: 11.5, ledger: 13, dict: 13, mother: 12.5, fixed: 14, stats: 11.5 }
}
```

- **旧版只有单个编辑器字号**：迁移时把它给「流水 / 字典」，其余页面用默认值；
  颜色仍按各自主题保留。
- 字号范围 9–24px，步长 0.5；两套主题读同一份 `fonts`。
- 颜色与字号只存本机浏览器，不写进账本、不随导出迁移。
- 纸主题默认色：无效 `#8a3f3f`、行号 `#8a8273`、问题行号 `#a04a2a`、日期 `#7a4a20`、
  节点 `#2f5d50`、运算符 `#4a463d`、金额 `#3f5f3f`、备注 `#6b6558`。

## 二、页面字号

设置 → 页面字号：六个数字框，分别写查询 / 流水 / 字典 / 母树 / 固定 / 统计。
写入 `:root` 的 `--tv-font-<page>`；编辑器按 `data-file` 分页读取，查询 / 统计 / 母树 /
固定各自有自己的变量。改完立即生效，两套主题共用。

## 三、切换

- 顶栏「语言」后面是「主题」按钮：点击在深色 / 电纸书之间切换；
  `title` 显示当前主题，语言切到英文时按钮显示 `Theme`。
- 设置 → 主题：下拉选择；切主题只换 8 个颜色，页面字号不变，
  不需要关闭面板。提示文字会写明「当前改的是深色 / 电纸书这一套颜色」。
- 设置 → 恢复默认字号：六页字号回到默认值。
- 设置 → 恢复默认颜色：只恢复**当前主题**那一套的 8 个颜色。

## 三、生效范围

`applyPrefs()` 把当前主题的 8 个颜色写成根元素上的 `--tv-*`，
再把六页字号写成 `--tv-font-query / ledger / dict / mother / fixed / stats`：

- 编辑器 token：日期 / 节点 / 运算符 / 金额 / 备注 / 无效 / 行号 / 问题行号；
- 纸主题的 token 覆盖也改为读这些变量，所以纸主题下改颜色同样生效；
- 字号按页面生效：流水 / 字典走 `data-file` 选择器，查询 / 统计 / 母树 / 固定
  在各自 CSS 里读变量；两套主题共用同一组值。

## 四、验证

```powershell
node --test tests/*.test.cjs
python tools/e2e.py     # settings / theme 段
```

浏览器里可查：

```js
document.documentElement.dataset.theme
localStorage.getItem('txtvein.prefs.v3')
getComputedStyle(document.documentElement).getPropertyValue('--tv-invalid')
getComputedStyle(document.documentElement).getPropertyValue('--tv-font-query')
```
