# 流水查询列宽

> 2026-11-21 / v2.8.1。查询页三张表与统计页右侧「流水查询」共用一套列宽。

## 一、口径

查询表六列：`序 / 日期 / 转出 / 转入 / 金额 / 备注`。

| 列 | 宽度 | 可拖 | 对齐 |
|---|---|---|---|
| 序 | 34px（默认） | 是 | 居中 |
| 日期 | 70px | 是 | 居中 |
| 转出 | 92px | 是 | 居中 |
| 转入 | 92px | 是 | 居中 |
| 金额 | 88px | 是 | **靠右** |
| 备注 | 吃剩余 | 否 | **靠左** |

- 列宽存本机 `localStorage['txtvein.query.cols.v1']`，不写进账本；
  清掉本机存储即回默认。
- 双击某一列表头右边缘 = 恢复该列默认宽度。

## 二、谁让谁（参考 NT 账本）

NT 的流水查询在 `nt/js/ui/width-fit.js` `fitShareTable()` +
`nt/js/ui/table-layout.js`：前五列有独立宽度，备注列吃剩余；
屏放不下时前五列按原比例压缩，到各自下限为止。TxtVein 照抄这个模型，
只把「备注列上次量到的实际宽度」改成 **[32, 90] 之间的期望下限**：

```
1. 先按保存的五列宽度画；
2. 放不下时五列按比例压到各自下限（seq 26 / date 52 / from 48 / to 48 / amount 72）；
3. 备注至少 32px；实在放不下才横向滚动。
```

如果保存的备注期望是 90，前五列总共只能用到 `可用宽 - 90`；
拖动某一列时备注会让出空间（最多让到 32），松手后存下**实际列宽和
备注的期望下限**。窗口变宽时备注自动吃满多出来的空间，不会把变宽后的
实际值记成需求，所以下次窗口变窄不会反过来把五列压到最小。

## 三、实现分工

| 文件 | 职责 |
|---|---|
| `js/core/query-cols.js` | 纯计算：默认值 / 下限 / `fitWidths` / `layout` / `maxDragWidth` |
| `js/ui/query-cols.js` | 量 DOM、拖动、双击复位、写 CSS 变量、存本机 |
| `css/editor.css` | `--q-c-*` 与 `--q-note-min` 的默认值、grid 模板、对齐、手柄样式 |
| `tests/query-cols.test.cjs` | 12 条纯计算测试 |

作用域用 `data-q-scope` 标记：

- `#query-view` —— 三段查询，三张表等宽，共用一套变量；
- 统计页的 `.q-panel[data-q-scope="stats"]` —— 单张查询区，独立 fit。

列宽变量写在作用域元素上；两个作用域宽度不同，所以各量各的，但列宽值共享。

## 四、验证

```powershell
node --test tests/query-cols.test.cjs
node --test tests/*.test.cjs
python tools/e2e.py
```

浏览器里可量：

```js
// 表头 / 数据行的每一列宽度与对齐
Array.from(document.querySelectorAll('#query-view .q-row.is-head')[0].children)
  .map((c) => [c.textContent.trim(), Math.round(c.getBoundingClientRect().width), getComputedStyle(c).textAlign]);
```

拖动验证要看三件事：只有目标列变、备注跟着反向变、松手后
`localStorage['txtvein.query.cols.v1']` 写入的是五列 + note。
