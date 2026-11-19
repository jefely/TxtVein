# -*- coding: utf-8 -*-
"""TxtVein v4 私有字典浏览器冒烟。

覆盖：导入 v4 样例 → 编译（25 分类 / 81 节点）→ 语义染色 → 三级树面板 →
统计分类页 → v4 节点表单（有统计分类、无父节点/公共归属）。

运行（本机 Chrome；沙箱里 cdp.py 已把 stdio 重定向到文件）：

    python tools/e2e_v4.py
    $env:TXTVEIN_URL='file:///D:/.../index.html'; python tools/e2e_v4.py
"""
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from cdp import Cdp, launch, new_page

URL = os.environ.get("TXTVEIN_URL", "file:///" + os.path.join(ROOT, "index.html").replace("\\", "/"))
PW = "test1234"
SAMPLE = open(os.path.join(ROOT, "docs", "private-dict-v4.sample.dict.tv"), "r", encoding="utf-8").read()
FAILS = []


def ok(name, cond, detail=""):
    if cond:
        print("  PASS  " + name)
    else:
        FAILS.append(name)
        print("  FAIL  " + name + ("  " + str(detail) if detail else ""))


def j(sid, expr, b):
    v = b.js(expr, sid)
    if isinstance(v, dict) and "__jsError" in v:
        raise RuntimeError(expr[:80] + " -> " + v["__jsError"])
    return v


def wait(sid, expr, b, timeout=12.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if j(sid, expr, b):
                return True
        except Exception:
            pass
        time.sleep(0.15)
    return False


def send_space(b, sid):
    b.call("Input.dispatchKeyEvent", {
        "type": "keyDown", "key": " ", "code": "Space",
        "windowsVirtualKeyCode": 32, "nativeVirtualKeyCode": 32, "text": " ",
    }, sid)
    b.call("Input.dispatchKeyEvent", {
        "type": "keyUp", "key": " ", "code": "Space",
        "windowsVirtualKeyCode": 32, "nativeVirtualKeyCode": 32,
    }, sid)


def send_key(b, sid, key, code, vk, text=None):
    p = {"type": "keyDown", "key": key, "code": code,
         "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk}
    if text is not None:
        p["text"] = text
    b.call("Input.dispatchKeyEvent", p, sid)
    b.call("Input.dispatchKeyEvent", {
        "type": "keyUp", "key": key, "code": code,
        "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk,
    }, sid)


def main():
    ws = launch(port=9336, profile=os.path.join(ROOT, "_tmp_cdp_profile_v4"))
    b = Cdp(ws)
    tid, sid = new_page(b, URL)

    j(sid, """(function(){var p=document.querySelector('#gate-pw'), q=document.querySelector('#gate-pw2');
      p.value='%s'; q.value='%s';
      p.dispatchEvent(new Event('input',{bubbles:true})); q.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('#gate form').requestSubmit(); return true;})()""" % (PW, PW), b)
    ok("setup", wait(sid, "!document.querySelector('#app').hidden", b, 15))

    # 走真实编辑器 onChange → 260ms 编译
    j(sid, "var cm=document.querySelectorAll('.CodeMirror')[1].CodeMirror; cm.setValue(%s); true" % json.dumps(SAMPLE), b)
    time.sleep(2.2)
    st = j(sid, """(function(){var s=window.__txtvein.getState();
      return {format:s.dict.format, nodes:Object.keys(s.dict.nodes||{}).length,
              cats:(s.dict.categories||[]).length,
              derrs:(s.sourceDiags||[]).filter(function(d){return d.file==='dict'&&d.severity==='error';}).length};})()""", b)
    ok("v4 compiled", st.get("format") == "v4", st)
    ok("81 nodes + 2 sys", st.get("nodes") == 83, st)
    ok("24 groups", st.get("cats") == 24, st)
    ok("no dict errors", st.get("derrs") == 0, st)
    ok("dict groups spaced", j(sid, "window.__txtvein.source().dict", b).find("\n\n日常，Daily") >= 0
       and j(sid, "window.__txtvein.source().dict", b).find("\n\n生活，Living") >= 0)
    tails = j(sid, """(function(){return Array.from(document.querySelectorAll('.CodeMirror')).map(function(w){
      var cm=w.CodeMirror, pad=w.querySelector('.cm-tail-pad');
      return {pad:!!pad, h:pad?Math.round(pad.getBoundingClientRect().height):0,
        lines:cm.lineCount(), textLines:cm.getValue().split('\\n').length};});})()""", b)
    ok("tail pad 30 lines", len(tails) == 2 and all(x["pad"] and x["lines"] == x["textLines"] for x in tails)
       and max(x["h"] for x in tails) >= 300, tails)
    ok("81 fixed bindings", j(sid, """(function(){var s=window.__txtvein.getState();
      return Object.keys(s.dict.nodes).filter(function(id){var n=s.dict.nodes[id];return !n.system&&n.anchor_id;}).length;})()""", b) == 81)

    ok("semantic marks", j(sid, "document.querySelectorAll('.CodeMirror')[1].CodeMirror.getAllMarks().length", b) > 200,
       j(sid, "document.querySelectorAll('.CodeMirror')[1].CodeMirror.getAllMarks().length", b))
    j(sid, "document.querySelector('#btn-dict').click()", b)
    time.sleep(0.8)
    ok("semantic def visible", j(sid, "document.querySelectorAll('.tv-def').length", b) > 0)
    ok("no semantic error", j(sid, "document.querySelectorAll('.tv-error').length", b) == 0)

    # 新输入流：前置空格 → 日期 + 转出推荐；2 字符 → 母树最后两位；to 完成 → 无推荐
    j(sid, "document.querySelector('#composer-toggle').click()", b)
    time.sleep(0.3)
    j(sid, "document.querySelector('#entry').focus()", b)
    send_space(b, sid)
    time.sleep(0.4)
    val = j(sid, "document.querySelector('#entry').value", b)
    ok("leading space inserts date", bool(re.match(r"^\d{6} $", str(val))), val)
    ok("from suggestions", j(sid, "document.querySelectorAll('#bubbles .bubble').length", b) > 0)
    b.call("Input.insertText", {"text": "kf"}, sid)
    time.sleep(0.4)
    bub = j(sid, "Array.from(document.querySelectorAll('#bubbles .bubble')).map(function(x){return x.innerText;})", b)
    ok("mother suggestions last", len(bub) >= 1 and "母树" in bub[-1], bub[-2:])
    j(sid, "window.TxtVein.inputApi.setValue('261119 wx', 999)", b)
    time.sleep(0.4)
    ok("from exact keeps suggestions",
       j(sid, "document.querySelectorAll('#bubbles .bubble').length", b) > 0
       and j(sid, "document.querySelector('#entry-state').textContent", b) == "STATE_FROM")
    j(sid, "window.TxtVein.inputApi.setValue('261119 wx1 > dc', 999)", b)
    time.sleep(0.4)
    ok("to exact keeps suggestions",
       j(sid, "document.querySelector('#entry-state').textContent", b) == "STATE_TO"
       and j(sid, "document.querySelectorAll('#bubbles .bubble').length", b) > 0)
    j(sid, "window.TxtVein.inputApi.setValue('261119 wx > s zc dt 3', 999)", b)
    time.sleep(0.4)
    ok("batch amount hint",
       j(sid, "document.querySelector('#composer-batch-hint').hidden", b) is False
       and "1/3" in j(sid, "document.querySelector('#composer-batch-hint').textContent", b)
       and "*" in j(sid, "document.querySelector('#composer-batch-hint').textContent", b))
    j(sid, "window.TxtVein.inputApi.setValue('261119 wx1 > dc', 999)", b)
    time.sleep(0.3)
    send_key(b, sid, "3", "Digit3", 51, "3")
    time.sleep(0.4)
    val = j(sid, "document.querySelector('#entry').value", b)
    ok("amount digit stays amount", "> dc 3" in str(val)
       and j(sid, "document.querySelector('#entry-state').textContent", b) == "STATE_AMOUNT"
       and j(sid, "document.querySelectorAll('#bubbles .bubble').length", b) == 0, val)
    j(sid, "document.querySelector('#composer-toggle').click()", b)
    time.sleep(0.2)

    # 整页母树：左私人 / 右母树，点右边分支或叶子即绑定
    j(sid, "document.querySelector('#btn-mother').click()", b)
    ok("mother page opens", wait(sid, "!document.querySelector('#mother-view').hidden && !!document.querySelector('.mother-page')", b, 5))
    ok("private nodes 81", j(sid, "document.querySelectorAll('.mother-row.is-node').length", b) == 81,
       j(sid, "document.querySelectorAll('.mother-row.is-node').length", b))
    ok("mother targets 183", j(sid, "document.querySelectorAll('.mother-row.is-target').length", b) == 183,
       j(sid, "document.querySelectorAll('.mother-row.is-target').length", b))
    ok("two panes", j(sid, "document.querySelectorAll('.mother-pane').length", b) == 2)

    j(sid, """(function(){var rows=document.querySelectorAll('.mother-row.is-node');
      for(var i=0;i<rows.length;i++){if(rows[i].textContent.trim().indexOf('ZC')===0){rows[i].click();return true;}}
      return false;})()""", b)
    time.sleep(0.3)
    ok("select private node", j(sid, "document.querySelectorAll('.mother-row.is-node.is-sel').length", b) == 1)
    j(sid, """(function(){var x=document.querySelector('.mother-row.is-target[data-id="SYS.CAT.TRANSPORT"]');
      if(x) x.click(); return !!x;})()""", b)
    time.sleep(1.0)
    anchor = j(sid, """(function(){var s=window.__txtvein.getState();var hit=null;
      Object.keys(s.dict.nodes).forEach(function(id){var n=s.dict.nodes[id];if(n.zh_code==='ZC'&&!n.system)hit=n.anchor_id;});
      return hit;})()""", b)
    ok("click binds target", anchor == "SYS.CAT.TRANSPORT", anchor)
    ok("binding highlighted", j(sid, "document.querySelectorAll('.mother-row.is-bound').length", b) >= 1)

    j(sid, """(function(){var row=document.querySelector('.mother-row.is-node.is-sel');
      var b=row&&Array.from(row.querySelectorAll('button')).find(function(x){return x.textContent==='编辑';});
      if(b)b.click(); return !!b;})()""", b)
    time.sleep(0.4)
    txt = j(sid, "document.querySelector('#modal-body').innerText", b)
    ok("v4 form has category", "统计分类" in txt)
    ok("v4 form has binding", "母树绑定" in txt)
    ok("v4 form no legacy fields", ("父节点" not in txt) and ("公共归属（可选）" not in txt))
    j(sid, "document.querySelector('#modal-close').click()", b)
    time.sleep(0.3)

    # 采纳母树：页面工具栏「+ 从母树」→ 搜「咖啡」→ 采纳
    j(sid, """(function(){var x=Array.from(document.querySelectorAll('.mother-bar button'))
      .find(function(b){return b.textContent.indexOf('从母树')>=0;}); if(x)x.click(); return !!x;})()""", b)
    time.sleep(0.4)
    j(sid, """(function(){var q=document.querySelector('#modal-body input'); q.value='咖啡'; q.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""", b)
    ok("adopt suggestions", wait(sid, "document.querySelectorAll('.suggest-item').length > 0", b, 5))
    j(sid, "document.querySelector('.suggest-item').click()", b)
    time.sleep(1.4)
    st2 = j(sid, """(function(){var s=window.__txtvein.getState(); var hit=null;
      Object.keys(s.dict.nodes).forEach(function(id){var n=s.dict.nodes[id];
        if(n.zh_name==='咖啡') hit={code:n.zh_code,cat:n.category,anchor:n.anchor_id,en:n.en_name,enc:n.en_code};});
      return {hit:hit, total:Object.keys(s.dict.nodes).length};})()""", b)
    ok("adopt creates node", st2.get("hit") is not None, st2)
    ok("adopt binds leaf", bool(st2.get("hit")) and st2["hit"]["anchor"] == "SYS.CAT.DINING.COFFEE", st2)
    ok("adopt carries english", bool(st2.get("hit")) and st2["hit"]["en"] == "Coffee" and st2["hit"]["enc"] == "coffee", st2)
    ok("adopt placed under category", bool(st2.get("hit")) and st2["hit"]["cat"] == "餐饮", st2)

    # 原文编辑器：任意空行（含中间插入的行）开头空格 → 日期 + 同一套推荐
    j(sid, "document.querySelector('#btn-ledger').click()", b)
    time.sleep(0.6)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue(''); cm.setCursor({line:0,ch:0}); cm.focus(); return true;})()""", b)
    time.sleep(0.4)
    send_space(b, sid)
    time.sleep(0.6)
    line = j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.getLine(0)", b)
    ok("editor blank line date", bool(re.match(r"^\d{6} $", str(line))), line)
    ok("editor hints", j(sid, "document.querySelectorAll('.CodeMirror-hints li').length", b) > 0)
    items = j(sid, "Array.from(document.querySelectorAll('.CodeMirror-hints li')).map(function(x){return x.textContent.trim();})", b)
    ok("editor hints no numbers", bool(items) and not re.match(r"^\d+\s+", str(items[0])), items[:2])
    ok("editor no operator hints", not any(x in {">", "<", "*m", "*d", "*y", "d", "h", "m"} for x in items), items)
    hw = j(sid, "window.__txtvein.hint('ledger','w','261119 w')", b)
    ok("editor private first with code", bool(hw.get("list")) and hw["list"][0].get("text") == "WX", hw)
    hx = j(sid, "window.__txtvein.hint('ledger','wx','261119 wx')", b)
    ok("editor from continues hints", bool(hx.get("list")), hx)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('260731 58D > QC 5858.91\\n'); cm.focus(); return true;})()""", b)
    time.sleep(1.0)
    ok("58D is node token",
       j(sid, """(function(){var s=Array.from(document.querySelectorAll('.CodeMirror-code span'))
         .find(function(x){return x.textContent==='58D';}); return !!s && s.className.indexOf('cm-node')>=0;})()""", b))
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('AAA\\nBBB\\nCCC\\n'); return true;})()""", b)
    time.sleep(0.4)
    j(sid, """(function(){var n=document.querySelectorAll('.CodeMirror-linenumber')[1];
      n.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:50,clientY:120})); return true;})()""", b)
    time.sleep(0.2)
    j(sid, """(function(){var b=Array.from(document.querySelectorAll('.cm-line-menu button'))
      .find(function(x){return x.textContent==='上移';}); if(b)b.click(); return true;})()""", b)
    time.sleep(0.4)
    ok("上移 swaps lines",
       j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.getValue()", b) == "BBB\nAAA\nCCC\n")
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('AAA\\nBBB\\nCCC\\nDDD\\n'); return true;})()""", b)
    time.sleep(0.3)
    def line_action(idx, label):
        j(sid, """(function(){var n=document.querySelectorAll('.CodeMirror-linenumber')[%d];
          n.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:50,clientY:120})); return true;})()""" % idx, b)
        time.sleep(0.15)
        j(sid, """(function(){var b=Array.from(document.querySelectorAll('.cm-line-menu button'))
          .find(function(x){return x.textContent===%s;}); if(b)b.click(); return true;})()""" % json.dumps(label), b)
        time.sleep(0.3)
    line_action(1, '复制')
    line_action(3, '粘贴')
    line_action(2, '插入')
    ok("paste replaces / insert before",
       j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.getValue()", b) == "AAA\nBBB\nBBB\nCCC\nBBB\n")
    long_lines = "".join("260101 WX > DC 3\n" for _ in range(100))
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue(%s); true" % json.dumps(long_lines), b)
    time.sleep(0.6)
    j(sid, "document.querySelector('#btn-dict').click()", b); time.sleep(0.4)
    j(sid, "document.querySelector('#btn-ledger').click()", b); time.sleep(0.8)
    ok("ledger opens at tail", j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      var info=cm.getScrollInfo(), last=cm.lineCount()-1;
      var c=cm.charCoords({line:last,ch:0},'local');
      return info.top>0 && cm.lineAtHeight(info.top,'local')>=last-9 && c.bottom<=info.top+info.clientHeight+2;})()""", b) is True)
    pt = j(sid, """(function(){var ns=document.querySelectorAll('.CodeMirror')[0].querySelectorAll('.CodeMirror-linenumber');
      for(var i=0;i<ns.length;i++){var r=ns[i].getBoundingClientRect();if(r.top>120&&r.top<600)return {x:r.left+r.width/2,y:r.top+r.height/2};}
      return null;})()""", b)
    for _ in range(2):
        b.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": pt["x"], "y": pt["y"], "button": "left", "clickCount": 1}, sid)
        b.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": pt["x"], "y": pt["y"], "button": "left", "clickCount": 1}, sid)
        time.sleep(0.35)
    ok("line number toggles selection",
       j(sid, "document.querySelectorAll('.cm-line-menu button').length", b) == 0
       and j(sid, "document.querySelectorAll('.tv-line-selected').length", b) == 0)
    before_top = j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.getScrollInfo().top", b)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setCursor({line:cm.lineCount()-1,ch:0}); cm.focus(); return true;})()""", b)
    time.sleep(0.2)
    send_key(b, sid, "Backspace", "Backspace", 8)
    time.sleep(0.8)
    ok("delete tail keeps scroll top", j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      return Math.abs(cm.getScrollInfo().top - %s) <= 2;})()""" % before_top, b) is True)

    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b)
    time.sleep(0.4)
    batch = j(sid, "window.__txtvein.submit('261119 wx > s zc dt 3 3 2.5')", b)
    time.sleep(1.0)
    evs = j(sid, """window.__txtvein.getState().events.map(function(e){
      var d=window.__txtvein.getState().dict;
      return {f:d.nodes[e.from].zh_code,t:d.nodes[e.to].zh_code,a:e.amountCents};})""", b)
    ok("batch expands to 3 source lines",
       batch.get("ok") is True and len(evs) == 3
       and batch.get("expanded") == ["261119 wx > s 3", "261119 wx > zc 3", "261119 wx > dt 2.5"]
       and [x["a"] for x in evs] == [300, 300, 250], evs)
    j(sid, "document.querySelector('#btn-mode').click()", b); time.sleep(0.7)
    j(sid, "document.querySelector('#btn-mode').click()", b); time.sleep(0.7)
    ok("batch mode toggle keeps 3 rows", j(sid, """(function(){
      var src=window.__txtvein.source().ledger;
      var ls=src.split('\\n').filter(function(x){return x.trim();});
      return ls.length===3 && new Set(ls).size===3 && window.__txtvein.getState().events.length===3;})()""", b) is True)
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    loop = j(sid, "window.__txtvein.submit('261119 wx > s zc dt 1 2 *')", b); time.sleep(0.8)
    ok("loop amount fills 1 2 1",
       loop.get("expanded") == ["261119 wx > s 1", "261119 wx > zc 2", "261119 wx > dt 1"]
       and j(sid, "window.__txtvein.getState().events.slice(-3).map(function(e){return e.amountCents;})", b) == [100, 200, 100])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    fill = j(sid, "window.__txtvein.submit('261119 wx > s zc dt 1 2*')", b); time.sleep(0.8)
    ok("attached star fills rest with 2",
       fill.get("expanded") == ["261119 wx > s 1", "261119 wx > zc 2", "261119 wx > dt 2"]
       and j(sid, "window.__txtvein.getState().events.slice(-3).map(function(e){return e.amountCents;})", b) == [100, 200, 200])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    split = j(sid, "window.__txtvein.submit('261119 wx > s zc dt 100/')", b); time.sleep(0.8)
    ok("slash amount splits evenly",
       split.get("expanded") == ["261119 wx > s 33.34", "261119 wx > zc 33.33", "261119 wx > dt 33.33"]
       and j(sid, "window.__txtvein.getState().events.slice(-3).map(function(e){return e.amountCents;})", b) == [3334, 3333, 3333])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    part = j(sid, "window.__txtvein.submit('261119 wx > dc zc s dt 1 9/')", b); time.sleep(0.8)
    ok("partial slash splits rest",
       part.get("expanded") == ["261119 wx > dc 1", "261119 wx > zc 3", "261119 wx > s 3", "261119 wx > dt 3"]
       and j(sid, "window.__txtvein.getState().events.slice(-4).map(function(e){return e.amountCents;})", b) == [100, 300, 300, 300])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    partfill = j(sid, "window.__txtvein.submit('261119 wx > dc zc s dt 1 9*')", b); time.sleep(0.8)
    ok("partial star fills rest",
       partfill.get("expanded") == ["261119 wx > dc 1", "261119 wx > zc 9", "261119 wx > s 9", "261119 wx > dt 9"]
       and j(sid, "window.__txtvein.getState().events.slice(-4).map(function(e){return e.amountCents;})", b) == [100, 900, 900, 900])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    cycle4 = j(sid, "window.__txtvein.submit('261119 wx > dc zc s dt 1 9 *')", b); time.sleep(0.8)
    ok("four targets make four rows",
       cycle4.get("expanded") == ["261119 wx > dc 1", "261119 wx > zc 9", "261119 wx > s 1", "261119 wx > dt 9"]
       and j(sid, "window.__txtvein.getState().events.slice(-4).map(function(e){return e.amountCents;})", b) == [100, 900, 100, 900])
    j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue('');", b); time.sleep(0.4)
    plan = j(sid, "window.__txtvein.submit('261119 wx > dc 3 *m')", b); time.sleep(0.8)
    ok("period adds fixed plan", plan.get("ok") is True
       and j(sid, """(function(){var ps=window.__txtvein.getState().plans;
         return ps.some(function(p){return p.period==='m' && p.amountCents===300 && p.status==='active';});})()""", b) is True)
    j(sid, "document.querySelector('#btn-fixed').click()", b); time.sleep(0.6)
    ok("fixed table shows period", "*m" in j(sid, "document.querySelector('.fixed-editor .CodeMirror').CodeMirror.getValue()", b))
    j(sid, "document.querySelector('#btn-ledger').click()", b); time.sleep(0.5)
    j(sid, "if(window.__txtvein.state().mode!=='CODE'){document.querySelector('#btn-mode').click();} true", b)
    time.sleep(0.7)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('261119 wx > s zc dt 3 3 2.5\\n'); cm.setCursor({line:0,ch:34}); cm.focus(); return true;})()""", b)
    time.sleep(0.4)
    send_key(b, sid, "Enter", "Enter", 13)
    time.sleep(1.0)
    ok("editor Enter expands batch", j(sid, """(function(){
      var ls=window.__txtvein.source().ledger.split('\\n').filter(function(x){return x.trim();});
      return ls.length===3 && ls[0].indexOf('WX > S 3')>=0
        && ls[1].indexOf('WX > ZC 3')>=0 && ls[2].indexOf('WX > DT 2.5')>=0
        && window.__txtvein.getState().events.length===3;})()""", b) is True)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('261119 wx > s zc dt 3 3 2.5\\n'); cm.setCursor({line:0,ch:34}); cm.focus();
      var c=cm.getCursor(); cm.showHint({completeSingle:false,hint:function(){return {list:[{text:'X'}],
        from:{line:c.line,ch:c.ch},to:{line:c.line,ch:c.ch}};}}); return true;})()""", b)
    time.sleep(0.4)
    send_key(b, sid, "Enter", "Enter", 13)
    time.sleep(0.8)
    ok("editor Enter wins over hint", j(sid, """(function(){
      var ls=window.__txtvein.source().ledger.split('\\n').filter(function(x){return x.trim();});
      return ls.length===3 && ls[2].indexOf('WX > DT 2.5')>=0;})()""", b) is True)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('261119 微信钱包 > 早餐 3\\n'); cm.setCursor({line:0,ch:20}); cm.focus(); return true;})()""", b)
    time.sleep(0.4)
    send_key(b, sid, "Enter", "Enter", 13)
    time.sleep(1.0)
    ok("Enter canonicalizes to code", j(sid, """(function(){
      var src=window.__txtvein.source().ledger;
      return src.indexOf('261119 WX > ZC 3')>=0 && src.indexOf('微信钱包')<0;})()""", b) is True)
    j(sid, "document.querySelector('#btn-mode').click()", b); time.sleep(0.7)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setValue('261119 WX > ZC 3\\n'); cm.setCursor({line:0,ch:17}); cm.focus(); return true;})()""", b)
    time.sleep(0.4)
    send_key(b, sid, "Enter", "Enter", 13)
    time.sleep(1.0)
    ok("Enter canonicalizes to plain", j(sid, """(function(){
      var src=window.__txtvein.source().ledger;
      return src.indexOf('微信钱包 > 早餐 3')>=0 && src.indexOf('WX > ZC')<0;})()""", b) is True)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[1].CodeMirror;
      cm.setValue('[费用]，Expense\\n\\n日常，Daily\\n  ZC，早餐\\n\\n负债\\n\\n  58D，58贷\\n'); return true;})()""", b)
    time.sleep(0.8)
    j(sid, "document.querySelector('#btn-dict').click()", b); time.sleep(0.5)
    ok("dict type yellow / english gray / 58D normal", j(sid, """(function(){var w=document.querySelectorAll('.CodeMirror')[1];
      var ss=Array.from(w.querySelectorAll('.CodeMirror-code span'));
      var type=ss.find(function(x){return x.textContent==='费用';});
      var en=ss.find(function(x){return x.textContent.indexOf('Expense')>=0 && x.className.indexOf('cm-dict-en')>=0;});
      var daily=ss.find(function(x){return x.textContent.indexOf('Daily')>=0 && x.className.indexOf('cm-dict-en')>=0;});
      var comma=ss.find(function(x){return x.textContent.indexOf('，')>=0 && x.className.indexOf('cm-dict-en')>=0;});
      var code=ss.find(function(x){return x.textContent==='58D';});
      return !!type && getComputedStyle(type).color==='rgb(215, 186, 125)'
        && !!en && getComputedStyle(en).color==='rgb(143, 143, 143)'
        && !!daily && getComputedStyle(daily).color==='rgb(143, 143, 143)'
        && !!comma && getComputedStyle(comma).color==='rgb(143, 143, 143)'
        && !!code && code.className.indexOf('cm-number')<0;})()""", b) is True)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[1].CodeMirror;
      cm.setValue('[费用]\\n日常\\n  ZC，早餐\\n  ZC，午餐\\n'); return true;})()""", b)
    time.sleep(1.0)
    j(sid, "document.querySelector('#btn-dict').click()", b); time.sleep(0.5)
    ok("duplicate codes both orange", j(sid, """(function(){var w=document.querySelectorAll('.CodeMirror')[1];
      var ns=Array.from(w.querySelectorAll('.CodeMirror-gutter-wrapper.tv-line-error .CodeMirror-linenumber'));
      return ns.length===2 && ns.every(function(n){return getComputedStyle(n).color==='rgb(255, 122, 69)';});})()""", b) is True)
    j(sid, """(function(){var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      if(cm.closeHint)cm.closeHint(); cm.setValue(''); return true;})()""", b)
    time.sleep(0.3)

    errs = [e for e in b.drain() if e.get("method") == "Runtime.exceptionThrown"]
    ok("no runtime exceptions", len(errs) == 0, errs[:1])

    b.call("Browser.close")
    if FAILS:
        print("E2E v4 FAILED: " + ", ".join(FAILS))
        sys.exit(1)
    print("E2E v4 PASSED")


if __name__ == "__main__":
    main()
