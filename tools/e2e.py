# -*- coding: utf-8 -*-
"""TxtVein browser E2E (editor / input / source / behavior).

Covers: setup, CM5 editors, domain folding, double/triple-space,
mouse/number/space candidate selection, default date/domain, behavior/note,
invalid X_ and gray syntax, 4-state with errors, inline repair, single TXT
validation/import, tree edit, candidate node, reload and lock.
"""
import json
import os
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from cdp import Cdp, launch, new_page, shot

URL = os.environ.get("TXTVEIN_URL", "http://127.0.0.1:8899/")
PW = "test1234"
FAILS = []


def ok(name, cond, detail=""):
    if cond:
        print("  PASS  " + name)
    else:
        FAILS.append(name + ("  " + str(detail) if detail else ""))
        print("  FAIL  " + name + ("  " + str(detail) if detail else ""))


def j(sid, expr, b):
    v = b.js(expr, sid)
    if isinstance(v, dict) and "__jsError" in v:
        raise RuntimeError(expr[:100] + " -> " + v["__jsError"])
    return v


def wait(b, sid, expr, timeout=8.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if j(sid, expr, b):
                return True
        except Exception:
            pass
        time.sleep(0.12)
    return False


def type_text(b, sid, text):
    b.call("Input.insertText", {"text": text}, sid)
    time.sleep(0.04)


def key(b, sid, name, code=None, vk=None, text=None):
    p = {"type": "keyDown", "key": name, "code": code or name}
    if vk:
        p["windowsVirtualKeyCode"] = vk
        p["nativeVirtualKeyCode"] = vk
    if text is not None:
        p["text"] = text
    b.call("Input.dispatchKeyEvent", p, sid)
    b.call("Input.dispatchKeyEvent", {
        "type": "keyUp", "key": name, "code": code or name,
        "windowsVirtualKeyCode": vk or 0,
    }, sid)


def space(b, sid):
    key(b, sid, " ", "Space", 32, " ")


def click_at(b, sid, x, y):
    b.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y}, sid)
    b.call("Input.dispatchMouseEvent", {
        "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1,
    }, sid)
    b.call("Input.dispatchMouseEvent", {
        "type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1,
    }, sid)


def drag(b, sid, x1, y1, dx):
    """Pointer drag for column-width handles (button must be on every move)."""
    b.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x1, "y": y1}, sid)
    b.call("Input.dispatchMouseEvent", {
        "type": "mousePressed", "x": x1, "y": y1, "button": "left", "buttons": 1, "clickCount": 1,
    }, sid)
    for i in range(1, 6):
        b.call("Input.dispatchMouseEvent", {
            "type": "mouseMoved", "x": x1 + dx * i / 5.0, "y": y1,
            "button": "left", "buttons": 1,
        }, sid)
        time.sleep(0.03)
    b.call("Input.dispatchMouseEvent", {
        "type": "mouseReleased", "x": x1 + dx, "y": y1, "button": "left", "clickCount": 1,
    }, sid)
    time.sleep(0.45)


def js_drag_handle(b, sid, sel, dx):
    """Synthetic pointer drag on a column handle (bypasses sticky-header hit-testing)."""
    j(sid, """(function(){
      var hd=document.querySelector(%s); if(!hd) return false;
      var cell=hd.parentElement, r=hd.getBoundingClientRect();
      var x=r.left+r.width/2, y=r.top+r.height/2;
      function pe(type,cx){return new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',
        button:0,buttons:type==='pointerup'?0:1,clientX:cx,clientY:y});}
      hd.dispatchEvent(pe('pointerdown',x));
      cell.dispatchEvent(pe('pointermove',x+%d));
      cell.dispatchEvent(pe('pointerup',x+%d));
      return true;
    })()""" % (json.dumps(sel), dx, dx), b)
    time.sleep(0.35)


def setup(b, sid):
    j(sid, "(function(){localStorage.clear(); location.reload(); return true;})()", b)
    time.sleep(0.9)
    ok("gate setup form", j(sid, "!!document.querySelector('#gate-pw2')", b))
    j(sid, """
(function(){
  var p=document.querySelector('#gate-pw'), q=document.querySelector('#gate-pw2');
  p.value='%s'; q.value='%s';
  p.dispatchEvent(new Event('input',{bubbles:true}));
  q.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('#gate form').requestSubmit();
  return true;
})()
""" % (PW, PW), b)
    return wait(b, sid, "!document.querySelector('#app').hidden", 12)


def main():
    ws = launch()
    b = Cdp(ws)
    tid, sid = new_page(b, URL)

    print("== boot / editor ==")
    ok("setup succeeds", setup(b, sid))
    ok("two editors", j(sid, "document.querySelectorAll('.CodeMirror').length", b) == 2)
    ledger = j(sid, "document.querySelectorAll('.CodeMirror')[0].CodeMirror.getValue()", b)
    data_lines = [l for l in ledger.splitlines() if l and not l.startswith("//")]
    ok("ledger defaults to P", any(l[:6].isdigit() for l in data_lines) and all(not l.startswith("P ") for l in data_lines))
    ok("no bracket domain", "[P]" not in ledger and "[C]" not in ledger)
    ok("no raw IDs", "N_" not in ledger)
    ok("hud removed", j(sid, "!document.querySelector('#hud')", b))
    ok("domain bar removed", j(sid, "!document.querySelector('#domains')", b))
    ok("all records one stream", j(sid, "window.__txtvein.state().domain", b) == "")
    ok("six page tabs", j(sid, "Array.from(document.querySelectorAll('.page-tab')).map(function(x){return x.innerText;}).join('/')", b) == "统计/查询/字典/流水/固定/节点")
    shot(b, sid, os.path.join(ROOT, "shots", "01-editor.png"))

    print("== input macros / mouse / space ==")
    j(sid, "document.querySelector('#composer-toggle').click()", b)
    ok("composer opens", wait(b, sid, "document.querySelector('#composer').classList.contains('open')", 3))
    ok("no composer prompt", j(sid, "document.querySelector('#entry-prompt') === null", b) is True)
    ok("composer in viewport",
       j(sid, """(function(){var r=document.querySelector('.composer-inner').getBoundingClientRect();
         return r.left >= 0 && r.right <= window.innerWidth + 1;})()""", b) is True)
    j(sid, "document.querySelector('#entry').focus(); window.TxtVein.inputApi.clear();", b)
    type_text(b, sid, "wx1")
    space(b, sid); time.sleep(0.12); space(b, sid); time.sleep(0.18)
    ok("double space >", j(sid, "document.querySelector('#entry').value", b).endswith("> "))
    space(b, sid); time.sleep(0.15)
    ok("triple space <", j(sid, "document.querySelector('#entry').value", b).endswith("< "))
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "w")
    ok("bubbles", wait(b, sid, "document.querySelectorAll('#bubbles .bubble').length >= 2", 3))
    space(b, sid); time.sleep(0.5)
    ok("space confirms", j(sid, "document.querySelector('#entry').value", b) == "wx1")
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "w")
    wait(b, sid, "document.querySelectorAll('#bubbles .bubble').length >= 2", 3)
    key(b, sid, "2", "Digit2", 50, "2")
    time.sleep(0.2)
    ok("number types instead of picking", j(sid, "document.querySelector('#entry').value", b) == "w2")
    ok("no bubble numbers", j(sid, "document.querySelectorAll('#bubbles .bubble-idx').length", b) == 0)
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "w")
    wait(b, sid, "document.querySelectorAll('#bubbles .bubble').length >= 2", 3)
    box = j(sid, """(function(){var r=document.querySelector('#bubbles .bubble').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()""", b)
    click_at(b, sid, box["x"], box["y"])
    time.sleep(0.2)
    ok("mouse picks", j(sid, "document.querySelector('#entry').value", b) == "wx1")
    j(sid, "window.TxtVein.inputApi.clear()", b)
    today = j(sid, "TxtVein.date.todayStamp(new Date())", b)
    j(sid, "window.__txtvein.submit('F wx1 > din 35')", b)
    time.sleep(0.5)
    ok("default F today", ("F " + today + " wx1 > din 35") in j(sid, "window.__txtvein.source().ledger", b))

    print("== behavior / note ==")
    before_b = j(sid, "window.__txtvein.state().behaviors", b)
    j(sid, "window.__txtvein.submit('movie > happy 3')", b)
    time.sleep(0.7)
    ok("behavior lands", j(sid, "window.__txtvein.state().behaviors", b) == before_b + 1)
    before_n = j(sid, "window.__txtvein.state().notes", b)
    j(sid, "window.__txtvein.submit('35 < xf < kf')", b)
    time.sleep(0.7)
    ok("note lands", j(sid, "window.__txtvein.state().notes", b) > before_n)

    print("== invalid / 4-state / gray ==")
    bad = j(sid, "window.__txtvein.submit('wx1 > nope 35')", b)
    ok("invalid kept", bad.get("ok") is False and "nope 35" in j(sid, "window.__txtvein.source().ledger", b)
       and j(sid, "document.querySelector('#entry').value", b) == "")
    ok("invalid gray", j(sid, "getComputedStyle(document.querySelector('.CodeMirror-lint-mark-error')).color", b) == "rgb(201, 201, 201)")
    ok("line number orange",
       j(sid, "getComputedStyle(document.querySelector('.CodeMirror-gutter-wrapper.tv-line-error .CodeMirror-linenumber')).color", b) == "rgb(255, 122, 69)")
    j(sid, """(function(){var e=document.querySelector('.CodeMirror-gutter-wrapper.tv-line-error .CodeMirror-linenumber');
      if(!e)return false; e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:70,clientY:120})); return true;})()""", b)
    time.sleep(0.3)
    ok("line number menu", j(sid, "document.querySelectorAll('.cm-line-menu button').length", b) == 6)
    ok("line number selected",
       j(sid, "document.querySelectorAll('.CodeMirror-gutter-wrapper.tv-line-selected').length", b) == 1
       and j(sid, "getComputedStyle(document.querySelector('.CodeMirror-gutter-wrapper.tv-line-selected .CodeMirror-linenumber')).backgroundColor", b) == "rgb(58, 58, 58)")
    ok("line menu horizontal", j(sid, """(function(){var m=document.querySelector('.cm-line-menu');
      if(!m)return false; var tops=Array.from(m.querySelectorAll('button')).map(function(x){return Math.round(x.getBoundingClientRect().top);});
      return getComputedStyle(m).flexDirection==='row' && tops.length===6 && tops.every(function(x){return x===tops[0];});})()""", b) is True)
    ok("line menu clear of selected", j(sid, """(function(){var m=document.querySelector('.cm-line-menu');
      var n=document.querySelector('.CodeMirror-gutter-wrapper.tv-line-selected .CodeMirror-linenumber');
      if(!m||!n)return false; var mr=m.getBoundingClientRect(), nr=n.getBoundingClientRect();
      return mr.top>=nr.bottom || mr.bottom<=nr.top;})()""", b) is True)
    j(sid, "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))", b)
    ok("line selection cleared",
       j(sid, "document.querySelectorAll('.CodeMirror-gutter-wrapper.tv-line-selected,.CodeMirror-linebackground.tv-line-selected-bg').length", b) == 0)
    j(sid, "window.__ev = window.__txtvein.getState().events; true", b)
    j(sid, "document.querySelector('#btn-mode').click()", b)
    ok("plain with error", wait(b, sid, "window.__txtvein.state().mode === 'PLAIN'", 4))
    ok("mode button plain", j(sid, "document.querySelector('#btn-mode').textContent", b) == "明文")
    ok("mode switch reuses graph", j(sid, "window.__ev === window.__txtvein.getState().events", b) is True)
    ok("mode changes ledger text", wait(b, sid, "window.__txtvein.source().ledger.indexOf('微信钱包') >= 0", 4))
    ok("error line kept", "wx1 > nope 35" in j(sid, "window.__txtvein.source().ledger", b))
    j(sid, "document.querySelector('#btn-mode').click()", b)
    ok("code again", wait(b, sid, "window.__txtvein.state().mode === 'CODE'", 4))
    ok("mode button code", j(sid, "document.querySelector('#btn-mode').textContent", b) == "掩码")
    ok("code restores ledger text", wait(b, sid, "window.__txtvein.source().ledger.indexOf('微信钱包') < 0", 4))

    print("== inline repair ==")
    j(sid, """(function(){var s=window.__txtvein.getState();
      var d=(s.sourceDiags||[]).find(function(x){return x.file==='ledger'&&x.severity==='error';});
      if(!d)return false; var cm=document.querySelectorAll('.CodeMirror')[0].CodeMirror;
      cm.setCursor({line:d.line-1,ch:0}); cm.focus(); return true;})()""", b)
    time.sleep(0.4)
    ok("repair only on error line", j(sid, "window.TxtVein.inputApi.isEditing()", b) is True)
    r = j(sid, "window.__txtvein.submit('wx1 > din 35')", b)
    ok("inline repair ok", r.get("ok") is True)
    ok("repair cleared input", j(sid, "document.querySelector('#entry').value", b) == "")
    ok("repair line", "wx1 > din 35" in j(sid, "window.__txtvein.source().ledger", b))

    print("== single TXT ==")
    single = j(sid, "window.__txtvein.singleText()", b)
    ok("sections", all(x in single for x in ["## 统计", "## 流水", "## 行为", "## 备注", "## 字典"]))
    ok("no IDs", "N_" not in single and "E_" not in single and "B_" not in single)
    ok("validates", j(sid, "window.__txtvein.validateSingle().ok", b) is True)
    r = j(sid, "window.__txtvein.importSingle(%s)" % json.dumps(single), b)
    ok("import single", r.get("ok") is True)
    time.sleep(0.5)
    ok("import behavior", j(sid, "window.__txtvein.state().behaviors", b) >= 1)

    print("== paste export / import ==")
    j(sid, "document.querySelector('#btn-export').click()", b)
    ok("export buttons", all(x in j(sid, "document.querySelector('#modal-body').innerText", b)
       for x in ["导出初级流水密文", "导出深度字典密文", "生成初级流水密文", "生成深度字典密文"]))
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(b){return b.textContent==='生成明文';}).click()", b)
    ok("export text", wait(b, sid, "document.querySelector('.export-output').value.length > 100", 8))
    ok("export has dict", "## 字典" in j(sid, "document.querySelector('.export-output').value", b))
    j(sid, "document.querySelector('#modal-close').click()", b)

    j(sid, "document.querySelector('#btn-import').click()", b)
    ok("import textarea", j(sid, "!!document.querySelector('.import-textarea')", b) is True)
    ok("two-step file pickers", all(x in j(sid, "document.querySelector('#modal-body').innerText", b)
       for x in ["选流水密文", "选字典密文", "导入文件"]))
    j(sid, "var ta=document.querySelector('.import-textarea'); ta.value=window.__txtvein.singleText(); ta.dispatchEvent(new Event('input',{bubbles:true}));", b)
    ok("import recognizes single", "TxtVein 单 TXT" in j(sid, "document.querySelector('.import-note').innerText", b))
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent.indexOf('导入粘贴')>=0;}).click()", b)
    ok("import single via paste", wait(b, sid, "document.querySelector('#modal').hidden", 8))

    bundle = j(sid, "(async()=>{const r=await window.__txtvein.exportText('deep'); window.__deep=r.files; return r.ok && r.files.length===2;})()", b)
    ok("export deep bundle", bundle is True)

    j(sid, "document.querySelector('#btn-export').click()", b)
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent==='生成深度流水密文';}).click()", b)
    wait(b, sid, "document.querySelector('.export-output').value.length > 100", 8)
    j(sid, "window.__ledText=document.querySelector('.export-output').value", b)
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent==='生成深度字典密文';}).click()", b)
    wait(b, sid, "document.querySelector('.export-output').value !== window.__ledText", 8)
    j(sid, "window.__dictText=document.querySelector('.export-output').value", b)
    j(sid, "document.querySelector('#modal-close').click()", b)
    pair_import = j(sid, "(async()=>await window.__txtvein.importFiles([{name:'ledger.enc',text:window.__ledText},{name:'dict.enc',text:window.__dictText}],{password:'test1234'}))()", b)
    ok("deep snapshot pair import", pair_import.get("ok") is True, json.dumps(pair_import, ensure_ascii=False)[:200])
    split_import = j(sid, "(async()=>{const a=await window.__txtvein.exportText('deep');const b=await window.__txtvein.exportText('deep');return await window.__txtvein.importFiles([a.files[0],b.files[1]],{password:'test1234'});})()", b)
    ok("deep separate exports still match", split_import.get("ok") is True, json.dumps(split_import, ensure_ascii=False)[:200])

    deep_import = j(sid, "(async()=>await window.__txtvein.importFiles(window.__deep,{password:'test1234'}))()", b)
    ok("deep files import", deep_import.get("ok") is True, json.dumps(deep_import, ensure_ascii=False)[:200])
    j(sid, "document.querySelector('#btn-import').click()", b)
    j(sid, "document.querySelector('.cipher-import-ledger').value=window.__deep[0].text; document.querySelector('.cipher-import-dict').value=window.__deep[1].text; document.querySelector('.cipher-import-ledger').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#modal-body input[type=password]').value='test1234';", b)
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent.indexOf('导入文件')>=0;}).click()", b)
    ok("deep files import via file button", wait(b, sid, "document.querySelector('#modal').hidden", 12))
    j(sid, "document.querySelector('#btn-import').click()", b)
    j(sid, "document.querySelector('.cipher-import-ledger').value=window.__deep[0].text; document.querySelector('.cipher-import-ledger').dispatchEvent(new Event('input',{bubbles:true}));", b)
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent.indexOf('导入粘贴')>=0;}).click()", b)
    time.sleep(0.4)
    ok("cipher needs both boxes", j(sid, "!document.querySelector('#modal').hidden", b) is True
       and "两个框" in j(sid, "document.querySelector('#modal-body').innerText", b))
    j(sid, "document.querySelector('.cipher-import-dict').value=window.__deep[1].text; document.querySelector('.cipher-import-dict').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#modal-body input[type=password]').value='test1234';", b)
    ok("import recognizes cipher", "两份都齐" in j(sid, "document.querySelector('.cipher-note').innerText", b))
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent.indexOf('导入粘贴')>=0;}).click()", b)
    ok("import bundle via paste", wait(b, sid, "document.querySelector('#modal').hidden", 12))

    print("== report / tree edit ==")
    j(sid, "document.querySelector('#btn-report').click()", b)
    time.sleep(0.7)
    ok("report", "统计" in j(sid, "document.querySelector('#report-view').innerText", b))
    ok("stats tabs", j(sid, "document.querySelectorAll('.stats-tab').length", b) == 4)
    ok("no stats scope controls", j(sid, "!document.querySelector('.stats-scope') && !document.querySelector('.report-mode-btn')", b) is True
       and "私人结构" not in j(sid, "document.querySelector('#report-view').innerText", b)
       and "公共归属" not in j(sid, "document.querySelector('#report-view').innerText", b))
    ok("stats third query", j(sid, """(function(){
      var rows=document.querySelectorAll('.stats-query .q-row:not(.is-head)').length;
      var m=document.querySelector('.stats-right');
      var q=document.querySelector('.stats-query');
      var g=document.querySelector('.stats-gutter-query');
      if(!rows || !m || !q || g) return false;
      var rw=Math.abs(m.getBoundingClientRect().width - q.getBoundingClientRect().width);
      return rw <= 2;
    })()""", b) is True)
    ok("stats months", j(sid, "document.querySelectorAll('.stats-month').length", b) == 12)
    ok("stats year after title", j(sid, """(function(){
      var wrap=document.querySelector('.stats-tabs-wrap');
      var kids=Array.from(wrap.children);
      var y=wrap.querySelector('.stats-year-input');
      return !!y && kids.indexOf(y) === 1 && kids[0].classList.contains('stats-title');
    })()""", b) is True)
    ok("stats controls same size", j(sid, """(function(){
      var y=document.querySelector('.stats-year-input');
      var yr=y.getBoundingClientRect();
      return Array.from(document.querySelectorAll('.stats-tab')).every(function(t){
        var r=t.getBoundingClientRect();
        return Math.abs(r.width - yr.width) < 1 && Math.abs(r.height - yr.height) < 1;
      });
    })()""", b) is True)
    ok("stats control gaps equal", j(sid, """(function(){
      var wrap=document.querySelector('.stats-tabs-wrap');
      var tabs=document.querySelector('.stats-tabs');
      var a=parseFloat(getComputedStyle(wrap).columnGap) || 0;
      var c=parseFloat(getComputedStyle(tabs).columnGap) || 0;
      return a > 0 && Math.abs(a - c) < 0.5;
    })()""", b) is True)
    ok("stats months left", j(sid, """(function(){
      var m=document.querySelector('.stats-months');
      var first=m.querySelector('.stats-month');
      return Math.abs(first.getBoundingClientRect().left - m.getBoundingClientRect().left) < 6;
    })()""", b) is True)
    ok("stats items", j(sid, "document.querySelectorAll('.lst-group').length", b) >= 4)
    ok("stats detail", j(sid, "document.querySelectorAll('.stats-left .sd-row:not(.is-head)').length", b) >= 2)
    j(sid, "Array.from(document.querySelectorAll('.stats-left .sd-row')).find(function(r){return !r.classList.contains('is-head') && !r.classList.contains('is-total');}).click()", b)
    time.sleep(0.3)
    ok("stats right list", j(sid, """(function(){
      var rows=Array.from(document.querySelectorAll('.stats-right .sd-row:not(.is-head)'));
      if(!rows.length) return false;
      return rows.every(function(r){
        var t=r.children[r.children.length-1].textContent.trim();
        return t !== '—' && t !== '-' && t !== '–';
      });
    })()""", b) is True)
    # 统计页第三区「流水查询」同样支持多节点
    def s_from(text):
        j(sid, """(function(){var i=document.querySelector('.stats-query .q-field:nth-child(2) input');
          i.value=%s; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""" % json.dumps(text), b)
        time.sleep(0.25)
        return j(sid, "document.querySelectorAll('.stats-query .q-row:not(.is-head)').length", b)
    s_sal = s_from("sal")
    s_wx1 = s_from("wx1")
    s_multi = s_from("sal,wx1")
    s_space = s_from("sal wx1")
    ok("stats query multi node", s_multi > 0 and s_multi == s_sal + s_wx1 and s_space == s_multi,
       "%s + %s = %s / space %s" % (s_sal, s_wx1, s_multi, s_space))
    s_from("")
    ok("stats total centered / first column centered", j(sid, """(function(){
      var t=document.querySelector('.stats-left .sd-total-title');
      var row=t.parentElement;
      var amt=document.querySelector('.stats-left .sd-row.is-total:not(.is-total-title)');
      var head=document.querySelector('.stats-left .sd-row.is-head');
      var cs=getComputedStyle(t), rs=getComputedStyle(row);
      var cells=Array.from(document.querySelectorAll('.stats-left .sd-row:not(.is-total-title):not(.is-total) > span:first-child'));
      var centered=cells.length && cells.every(function(c){return getComputedStyle(c).textAlign==='center';});
      return cs.textAlign==='left' && cs.alignSelf==='center' && rs.borderBottomWidth==='0px' && rs.alignItems==='center'
        && amt.getBoundingClientRect().height >= 20
        && head.getBoundingClientRect().height < 26
        && centered;
    })()""", b) is True)
    ok("stats headers aligned", j(sid, """(function(){
      var heads=Array.from(document.querySelectorAll('.stats-left .sd-row.is-head'));
      var mid=Array.from(document.querySelectorAll('.stats-right .sd-row.is-head > span'));
      if(!heads.length || !mid.length) return false;
      var leftOk=heads.every(function(h){
        var c=Array.from(h.children);
        return c.length > 1
          && getComputedStyle(c[0]).textAlign === 'center'
          && c.slice(1).every(function(s){
            return s.classList.contains('sd-num') && getComputedStyle(s).textAlign === 'right';
          });
      });
      var midOk=mid.every(function(s){ return getComputedStyle(s).textAlign === 'center'; });
      var rows=Array.from(document.querySelectorAll('.stats-right .sd-row:not(.is-head)'));
      var dataOk=rows.length > 0 && rows.every(function(r){
        var c=Array.from(r.children);
        var last=getComputedStyle(c[c.length-1]).textAlign;
        return c.length >= 6
          && c.slice(0,4).every(function(s){ return getComputedStyle(s).textAlign === 'center'; })
          && getComputedStyle(c[c.length-2]).textAlign === 'right'
          && (last === 'left' || last === 'start');
      });
      return leftOk && midOk && dataOk;
    })()""", b) is True)
    ok("stats list fonts match query", j(sid, """(function(){
      var m=document.querySelector('.stats-right .sd-row.is-head');
      var q=document.querySelector('.stats-query .q-row.is-head');
      var mc=document.querySelector('.stats-right-head .stats-clear');
      var qc=document.querySelector('.stats-query .q-clear');
      return !!m && !!q && !!mc && !!qc
        && getComputedStyle(m).fontSize === getComputedStyle(q).fontSize
        && getComputedStyle(mc).fontSize === getComputedStyle(qc).fontSize;
    })()""", b) is True)
    # 中间列表列宽：拖动「序」右边缘 +24px，备注列自动让宽；双击复位
    before = j(sid, """(function(){
      var h=document.querySelector('.stats-right .stats-table[data-list="list"] .sd-row.is-head');
      var c=h.children; return [Math.round(c[0].getBoundingClientRect().width),
        Math.round(c[c.length-1].getBoundingClientRect().width)];
    })()""", b)
    js_drag_handle(b, sid, '.stats-right .stats-table[data-list="list"] .sd-row.is-head > span:first-child .q-col-handle', 24)
    after = j(sid, """(function(){
      var h=document.querySelector('.stats-right .stats-table[data-list="list"] .sd-row.is-head');
      var c=h.children; return [Math.round(c[0].getBoundingClientRect().width),
        Math.round(c[c.length-1].getBoundingClientRect().width)];})()""", b)
    j(sid, """(function(){
      var h=document.querySelector('.stats-right .stats-table[data-list="list"] .sd-row.is-head');
      var hd=h.children[0].querySelector('.q-col-handle');
      hd.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); return true;})()""", b)
    time.sleep(0.3)
    reset = j(sid, """(function(){
      var h=document.querySelector('.stats-right .stats-table[data-list="list"] .sd-row.is-head');
      return Math.round(h.children[0].getBoundingClientRect().width);})()""", b)
    ok("stats list resize", after[0] >= before[0] + 20
       and after[1] <= before[1] - 20
       and reset == before[0], "%s -> %s, note %s -> %s, reset %s" % (before[0], after[0], before[1], after[1], reset))
    ok("stats header title/clear", j(sid, """(function(){
      var h=document.querySelector('.stats-right-head');
      var t=h.querySelector('.stats-list-title');
      return !!t && t.nextElementSibling && t.nextElementSibling.classList.contains('stats-clear');
    })()""", b) is True)
    ok("stats selected centered", j(sid, """(function(){
      var h=document.querySelector('.stats-right-head');
      var s=h.querySelector('.stats-selected');
      if(!s || s.hidden) return false;
      var r=h.getBoundingClientRect(), x=s.getBoundingClientRect();
      return Math.abs((r.left+r.width/2)-(x.left+x.width/2)) < 2;
    })()""", b) is True)
    j(sid, "document.querySelector('.stats-clear').click()", b)
    time.sleep(0.2)
    ok("stats clear focuses search",
       j(sid, "document.activeElement === document.querySelector('.stats-search-input')", b) is True)
    j(sid, "document.querySelectorAll('.stats-tab')[1].click()", b)
    time.sleep(0.3)
    j(sid, """(function(){var i=document.querySelector('.stats-search-input');
      i.value='wx1'; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""", b)
    time.sleep(0.3)
    ok("stats search node code", j(sid, "document.querySelectorAll('.stats-search-hit').length", b) >= 1)
    j(sid, """(function(){var i=document.querySelector('.stats-search-input');
      i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true;})()""", b)
    time.sleep(0.4)
    ok("stats search selects", j(sid, "document.querySelector('.stats-selected').textContent", b) == "wx1")
    j(sid, "document.querySelectorAll('.stats-tab')[2].click()", b)
    time.sleep(0.3)
    j(sid, """(function(){var i=document.querySelector('.stats-search-input');
      i.value='kf'; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""", b)
    time.sleep(0.3)
    ok("stats search pinyin initials", j(sid, "document.querySelectorAll('.stats-search-hit').length", b) >= 1)
    j(sid, "document.querySelectorAll('.stats-tab')[0].click()", b)
    time.sleep(0.3)
    j(sid, "document.querySelector('.stats-clear').click()", b)
    time.sleep(0.2)
    for _ in range(4):
        if j(sid, "document.querySelector('#btn-candidates').hidden", b) is True:
            break
        j(sid, "document.querySelector('#btn-candidates').click()", b)
        time.sleep(0.2)
        j(sid, """(function(){var row=document.querySelector('.candidate-row');
          if(!row)return false; var bs=Array.from(row.querySelectorAll('button'));
          var x=bs.find(function(b){return b.textContent.trim()==='忽略';});
          if(x)x.click(); return !!x;})()""", b)
        time.sleep(0.3)
    ok("candidate button hidden", j(sid, "document.querySelector('#btn-candidates').hidden", b) is True)
    shot(b, sid, os.path.join(ROOT, "shots", "03-report.png"))

    print("== query / fixed / i18n ==")
    j(sid, "document.querySelector('#btn-query').click()", b)
    ok("query rows", wait(b, sid, "document.querySelectorAll('#query-view .q-panel').length === 3 && document.querySelectorAll('#query-view .q-row:not(.is-head)').length > 2", 4))
    dates = j(sid, "Array.from(document.querySelectorAll('#query-view .q-panel .q-field:first-child input')).map(function(x){return x.value;}).join('/')", b)
    ok("query default dates", len(dates.split('/')) == 3 and len(dates.split('/')[1]) == 4 and len(dates.split('/')[2]) == 2, dates)
    # 转出/转入支持多节点：逗号/空格分隔，字段内 OR
    def q_from(text):
        j(sid, """(function(){var i=document.querySelector('.q-panel[data-query="B"] .q-field:nth-child(2) input');
          i.value=%s; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""" % json.dumps(text), b)
        time.sleep(0.25)
        return j(sid, "document.querySelectorAll('.q-panel[data-query=\"B\"] .q-row:not(.is-head)').length", b)
    n_sal = q_from("sal")
    n_wx1 = q_from("wx1")
    n_multi = q_from("sal,wx1")
    n_space = q_from("sal wx1")
    ok("query multi node", n_multi > 0 and n_multi == n_sal + n_wx1 and n_space == n_multi,
       "%s + %s = %s / space %s" % (n_sal, n_wx1, n_multi, n_space))
    q_from("")
    q_date = j(sid, "document.querySelector('.q-panel[data-query=\"A\"] .q-row:not(.is-head)').children[1].textContent", b)
    j(sid, """(function(){var i=document.querySelector('.q-panel[data-query="A"] .q-field:first-child input');
      i.value=%s; i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""" % json.dumps(q_date), b)
    time.sleep(0.3)
    ok("query filters", j(sid, "document.querySelectorAll('.q-panel[data-query=\"A\"] .q-row:not(.is-head)').length", b) >= 1, q_date)
    # 列宽：拖 B 的「转出」右边缘 +24px，只有它变宽、备注反向变窄，松手写本机
    qw_before = j(sid, """Array.from(document.querySelectorAll('#query-view .q-panel[data-query="B"] .q-row.is-head')[0].children)
      .map(function(c){return Math.round(c.getBoundingClientRect().width);})""", b)
    qbox = j(sid, """(function(){
      var h=document.querySelector('#query-view .q-panel[data-query="B"] .q-row.is-head');
      var c=h.children[2]; var r=c.getBoundingClientRect();
      return {x:r.right-1, y:r.top+r.height/2};
    })()""", b)
    drag(b, sid, qbox["x"], qbox["y"], 24)
    qw_after = j(sid, """Array.from(document.querySelectorAll('#query-view .q-panel[data-query="B"] .q-row.is-head')[0].children)
      .map(function(c){return Math.round(c.getBoundingClientRect().width);})""", b)
    ok("query column drag only target", qw_after[2] >= qw_before[2] + 12
       and qw_after[5] <= qw_before[5] - 12
       and qw_after[0] == qw_before[0] and qw_after[4] == qw_before[4], str(qw_before) + ' -> ' + str(qw_after))
    ok("query columns stored", j(sid, "!!localStorage.getItem('txtvein.query.cols.v1')", b) is True)
    ok("query header centered", j(sid, """(function(){
      return Array.from(document.querySelector('#query-view .q-row.is-head').children)
        .every(function(c){return getComputedStyle(c).textAlign === 'center';});
    })()""", b) is True)
    ok("query data alignment", j(sid, """(function(){
      var row=document.querySelector('#query-view .q-panel[data-query="B"] .q-row:not(.is-head)');
      if(!row) return false;
      var a=Array.from(row.children).map(function(c){return getComputedStyle(c).textAlign;});
      return a[0]==='center' && a[1]==='center' && a[2]==='center' && a[3]==='center'
        && a[4]==='right' && a[5]==='left';
    })()""", b) is True)
    ok("query amount compact", j(sid, """(function(){
      var row=document.querySelector('#query-view .q-panel[data-query="B"] .q-row:not(.is-head)');
      var s=row && row.children[4] ? row.children[4].textContent.trim() : '';
      return /^¥\\d+(?:\\.\\d{1,2})?$/.test(s) && s.indexOf(',') < 0;
    })()""", b) is True)
    j(sid, "document.querySelector('#btn-fixed').click()", b)
    ok("fixed editor", wait(b, sid, "!!document.querySelector('.fixed-editor .CodeMirror')", 4))
    fixed_src = j(sid, "document.querySelector('.fixed-editor .CodeMirror').CodeMirror.getValue()", b)
    ok("fixed table has two areas", "[固定]" in fixed_src and "[分期]" in fixed_src, fixed_src[:120])
    ok("fixed no raw IDs", "N_" not in fixed_src and "T_" not in fixed_src, fixed_src[:160])
    ok("fixed space macro", j(sid, """(function(){
      var cm=document.querySelector('.fixed-editor .CodeMirror').CodeMirror;
      var orig=cm.getValue();
      cm.setValue(orig+'\\nTEST');
      var line=cm.lineCount()-1;
      cm.setCursor({line:line,ch:4});
      cm.focus();
      var ta=cm.getInputField();
      function sp(){ta.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,cancelable:true}));}
      sp(); sp(); var two=cm.getLine(line);
      sp(); var three=cm.getLine(line);
      cm.setValue(orig+'\\n');
      var blank=cm.lineCount()-1;
      cm.setCursor({line:blank,ch:0});
      sp(); var daily=cm.getLine(blank);
      cm.setValue(orig+'\\n19');
      var dayLine=cm.lineCount()-1;
      cm.setCursor({line:dayLine,ch:2});
      sp(); var dayNo=cm.getLine(dayLine);
      cm.setValue(orig); cm.clearHistory();
      return two === 'TEST > ' && three === 'TEST < '
        && daily === '每日 ' && dayNo === '19日 ';
    })()""", b) is True)
    ok("fixed line menu", j(sid, """(function(){
      var cm=document.querySelector('.fixed-editor .CodeMirror').CodeMirror;
      cm.focus();
      var ln=cm.getWrapperElement().querySelector('.CodeMirror-linenumber');
      if(!ln) return false;
      ln.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:20,clientY:20}));
      var menu=document.querySelector('.cm-line-menu');
      if(!menu) return false;
      var labels=Array.from(menu.querySelectorAll('button')).map(function(b){return b.textContent;}).join('/');
      menu.remove();
      return labels === '删除/剪切/复制/粘贴/插入/上移';
    })()""", b) is True)
    ok("top menu order",
       j(sid, "Array.from(document.querySelectorAll('.top-menu .menu-btn')).map(function(x){return x.textContent.trim();}).join('/')", b)
       == "导入/导出/语言/帮助/设置/主题/掩码")
    ok("theme button label", j(sid, "document.querySelector('#btn-theme').textContent", b) == "主题")
    j(sid, "document.querySelector('#btn-theme').click()", b)
    time.sleep(0.4)
    ok("theme toggles to paper", j(sid, "document.documentElement.dataset.theme", b) == "paper")
    j(sid, "document.querySelector('#btn-theme').click()", b)
    time.sleep(0.4)
    ok("theme toggles back", j(sid, "document.documentElement.dataset.theme", b) == "dark")
    j(sid, "document.querySelector('#btn-settings').click()", b)
    time.sleep(0.3)
    ok("settings opens", j(sid, "document.querySelector('#modal-title').textContent", b) == "设置")
    ok("settings colors", j(sid, "document.querySelectorAll('#modal-body input[type=color]').length", b) == 12)
    ok("settings page fonts", j(sid, "document.querySelectorAll('#modal-body input[type=number]').length", b) == 6)
    j(sid, """(function(){
      var fs=document.querySelectorAll('#modal-body input[type=number]');
      fs[1].value='15'; fs[1].dispatchEvent(new Event('input',{bubbles:true}));
      var s=document.querySelector('#modal-body select');
      s.value='paper'; s.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })()""", b)
    time.sleep(0.3)
    ok("page fonts shared across themes", j(sid, "document.documentElement.dataset.theme", b) == "paper"
       and j(sid, "document.querySelectorAll('#modal-body input[type=number]')[1].value", b) == "15"
       and j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-font-ledger')", b).strip() == "15px"
       and j(sid, "getComputedStyle(document.querySelector('.editor-pane[data-file=\"ledger\"] .CodeMirror')).fontSize", b) == "15px")
    j(sid, """(function(){
      var fs=document.querySelectorAll('#modal-body input[type=number]');
      fs[0].value='14'; fs[0].dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    })()""", b)
    time.sleep(0.25)
    ok("page fonts independent", j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-font-query')", b).strip() == "14px"
       and j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-font-ledger')", b).strip() == "15px"
       and j(sid, "getComputedStyle(document.querySelector('#query-view .q-row:not(.is-head)')).fontSize", b) == "14px")
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent==='恢复默认字号';}).click()", b)
    time.sleep(0.3)
    ok("settings reset fonts", j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-font-query')", b).strip() == "11.5px"
       and j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-font-ledger')", b).strip() == "13px")
    j(sid, """(function(){var s=document.querySelector('#modal-body select');
      s.value='dark'; s.dispatchEvent(new Event('change',{bubbles:true})); return true;})()""", b)
    time.sleep(0.25)
    j(sid, """(function(){var c=document.querySelector('#modal-body input[type=color]');
      c.value='#112233'; c.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""", b)
    time.sleep(0.2)
    ok("settings applies color",
       j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-invalid')", b).strip() == "#112233")
    j(sid, "Array.from(document.querySelectorAll('#modal-body button')).find(function(x){return x.textContent==='恢复默认颜色';}).click()", b)
    time.sleep(0.3)
    ok("settings reset color",
       j(sid, "getComputedStyle(document.documentElement).getPropertyValue('--tv-invalid')", b).strip() == "#B9C2CE")
    j(sid, "document.querySelector('#modal-close').click()", b)
    j(sid, "document.querySelector('#btn-lang').click()", b)
    time.sleep(0.5)
    ok("english tabs", j(sid, "document.querySelector('#page-tabs').innerText", b) == "Stats\nQuery\nDict\nLedger\nFixed\nNode")
    ok("english menu", "Settings" in j(sid, "document.querySelector('.top-menu').innerText", b)
       and "Mask" in j(sid, "document.querySelector('.top-menu').innerText", b)
       and "Language" in j(sid, "document.querySelector('.top-menu').innerText", b)
       and "Theme" in j(sid, "document.querySelector('.top-menu').innerText", b))
    j(sid, "document.querySelector('#btn-lang').click()", b)
    time.sleep(0.3)

    print("== reload / lock ==")
    b.call("Page.reload", {}, sid)
    time.sleep(1.0)
    ok("unlock form", wait(b, sid, "!document.querySelector('#gate').hidden && !!document.querySelector('#gate-pw')", 6))
    j(sid, "document.querySelector('#gate-pw').value='%s'; document.querySelector('#gate form').requestSubmit();" % PW, b)
    ok("unlock", wait(b, sid, "!document.querySelector('#app').hidden", 12))
    ok("source survives", "wx1 > din 35" in j(sid, "window.__txtvein.source().ledger", b))
    j(sid, "window.__txtvein.lock()", b)
    ok("lock", wait(b, sid, "!document.querySelector('#gate').hidden && document.querySelector('#app').hidden", 6))

    print("")
    if FAILS:
        print("E2E FAILED: %d" % len(FAILS))
        for f in FAILS:
            print("  - " + f)
        b.call("Browser.close")
        sys.exit(1)
    print("E2E PASSED")
    b.call("Browser.close")


if __name__ == "__main__":
    main()


