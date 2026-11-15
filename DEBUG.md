# TxtVein · 本地调试环境

> 目标：改一行代码 → 刷新浏览器就能看到；出错时能在 Console / Sources 里直接定位。
> 这个项目是**零依赖静态站点**：不需要 npm install、不需要打包器、不需要后端。

---

## 一、最快启动

### 方式 A：双击 `dev.cmd`

```text
dev.cmd
→ python serve.py 8899
→ 自动打开 http://127.0.0.1:8899/
```

### 方式 B：命令行

```powershell
cd D:\myproject\TxtVein
python serve.py 8899
```

浏览器打开：**http://127.0.0.1:8899/index.html**

- `index.html` 是开发入口：外链 `css/*.css` 与 `js/**/*.js`，改完 **F5** 即可，不用构建。
- `TxtVein.html` 是单文件成品：改源码后要 `node tools/build.cjs` 才会更新。
- 端口被占（例如 8787 已被别的项目用了），`serve.py` 会自动顺延；看终端打印的实际 URL。
- 不想自动开浏览器：`python serve.py 8899 --no-open`。

---

## 二、开发循环

| 你改了什么 | 要做什么 |
|---|---|
| `index.html` / `css/*.css` / `js/**/*.js` | F5 刷新 |
| `js/core/*`（纯逻辑） | F5；同时跑 `node --test tests/*.test.cjs` |
| 想让 `TxtVein.html` 也更新 | `node tools/build.cjs` |
| 改了格式/哈希 | `node --test` + `python tools/e2e.py` |
| 只改 UI | `node tools/build.cjs && python tools/e2e.py` |

推荐顺序：

```powershell
node --test tests/*.test.cjs
node tools/build.cjs
node tools/check.cjs
python serve.py 8899 --no-open     # 另开终端
$env:TXTVEIN_URL='http://127.0.0.1:8899/'; python tools/e2e.py
```

---

## 三、浏览器里怎么查

### Console 可用入口

```js
// 当前状态（只读快照）
window.__txtvein.state()
// => {domain, mode, lang, view, events, nodes, saved}

// 当前两份纯文本 + 双哈希（会触发一次 buildTexts）
await window.__txtvein.texts()

// 直接提交一行（绕过键盘，适合快速造数据）
window.__txtvein.submit('wx1 > din 35 < 咖啡')

// 导入两份文本（force 可跳过指纹）
await window.__txtvein.importTexts(ledgerText, dictText, { force: false })
```

### localStorage

| key | 内容 |
|---|---|
| `txtvein:v2:vault` | `{v, iterations, salt, iv, ciphertext, updatedAt}`，只有密文 |
| `txtvein:v2:hint` | 密码提示（可选，明文） |

重置本地账本：

```js
localStorage.removeItem('txtvein:v2:vault');
localStorage.removeItem('txtvein:v2:hint');
location.reload();
```

或用 UI：锁屏 → 「忘记密码？重置保险库」→ 连点两次确认。

> `file://` 与 `http://127.0.0.1:8899` 是**两个不同的浏览器源**，localStorage 不互通。
> 调试请固定用 `http://127.0.0.1:8899`；单文件冒烟用 `file://` 另测。

### 断点

在 DevTools → Sources 里直接给这些文件下断点：

- `js/core/parser.js` `parseEntry()`：看输入如何变成 Event。
- `js/core/calc.js` `compute()`：看余额/域/区间。
- `js/ui/app.js` `submitEntry()` / `analyzeInput()`：看 UI 编排与气泡候选。
- `js/core/dict-file.js` `bodyForHash()`：看哈希是否被字段污染。

### Network

正常情况只有本地静态文件请求，**没有外部请求**。
如果看到任何 `https://` 请求，说明引入了外部依赖——这是 bug。

---

## 四、造数据 / 复位

- 空账本：锁屏 → 重置保险库 → 重设密码。
- 示例账本：首次设密码后自动生成；示例含 `wx` 冲突（微信钱包 / 维修费），用来测气泡与 `wx1/wx2`。
- 想回到干净示例：重置保险库即可。
- 大量数据：用 `tools/e2e.py` 里的 `__txtvein.submit` 循环，或直接 `importTexts` 导入生成的 ledger。

---

## 五、E2E / 单文件调试

```powershell
# 用本地服务
python serve.py 8899 --no-open
$env:TXTVEIN_URL='http://127.0.0.1:8899/'; python tools/e2e.py

# 或直接 file://（不启服务器）
$env:TXTVEIN_URL='file:///D:/myproject/TxtVein/index.html'; python tools/e2e.py

# 单文件 file:// 冒烟：设密码 + 刷新解锁
python tools/smoke_file.py
```

E2E 使用独立 Chrome profile `_tmp_cdp_profile/`，不会碰你的日常浏览器。
截图写到 `shots/`。

---

## 六、可选：Chrome 远程调试

如果需要用 CDP / 自动化工具连接：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9223 `
  --user-data-dir="D:\myproject\TxtVein\_tmp_dev_profile" `
  --new-window "http://127.0.0.1:8899/index.html"
```

然后访问 `http://127.0.0.1:9223/json/version` 拿 `webSocketDebuggerUrl`。
`tools/cdp.py` 里的 `Cdp` 类是现成的最小封装。

---

## 七、常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `http://127.0.0.1:8787` 打开是别的项目 | 8787 被旧项目占用；TxtVein 用 **8899**，或看 `serve.py` 打印的端口 |
| 改了 JS 但页面没变 | 没刷新；或你看的是 `TxtVein.html`（单文件需 build） |
| 刷新后回到锁屏 | 正常：密钥只在内存；输入主密码解锁 |
| 换端口后账本空了 | localStorage 按 origin 隔离；旧数据在旧端口下 |
| E2E 报连接失败 | 没起服务，或端口不是 8899；`python serve.py 8899 --no-open`，或用 `TXTVEIN_URL` 指定实际 URL |
| Chrome 控制台有 password form 警告 | 只是可访问性建议，不影响功能 |
| `npm run dev` 不识别 python | 用 `dev.cmd` 或 `python serve.py 8899`；项目没有 npm 依赖 |

---

## 八、最短路径

```powershell
cd D:\myproject\TxtVein
dev.cmd
```

浏览器里：`F12` → Console → `window.__txtvein.state()`。
改 `css/base.css` → F5。
改 `js/core/parser.js` → F5 + `node --test tests/parser.test.cjs`。
交付前：`node --test tests/*.test.cjs && node tools/build.cjs && node tools/check.cjs`。
