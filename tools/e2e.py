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
    ok("five page tabs", j(sid, "Array.from(document.querySelectorAll('.page-tab')).map(function(x){return x.innerText;}).join('/')", b) == "查询/流水/字典/固定/统计")
    shot(b, sid, os.path.join(ROOT, "shots", "01-editor.png"))

    print("== input macros / mouse / space ==")
    j(sid, "document.querySelector('#composer-toggle').click()", b)
    ok("composer opens", wait(b, sid, "document.querySelector('#composer').classList.contains('open')", 3))
    j(sid, "document.querySelector('#entry').focus(); window.TxtVein.inputApi.clear();", b)
    type_text(b, sid, "wx1")
    space(b, sid); time.sleep(0.05); space(b, sid); time.sleep(0.15)
    ok("double space >", j(sid, "document.querySelector('#entry').value", b).endswith("> "))
    space(b, sid); time.sleep(0.15)
    ok("triple space <", j(sid, "document.querySelector('#entry').value", b).endswith("< "))
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "wx")
    ok("bubbles", wait(b, sid, "document.querySelectorAll('#bubbles .bubble').length >= 2", 3))
    space(b, sid); time.sleep(0.5)
    ok("space confirms", j(sid, "document.querySelector('#entry').value", b) == "wx1")
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "wx")
    wait(b, sid, "document.querySelectorAll('#bubbles .bubble').length >= 2", 3)
    key(b, sid, "2", "Digit2", 50)
    ok("number picks", j(sid, "document.querySelector('#entry').value", b) == "wx2")
    j(sid, "window.TxtVein.inputApi.clear()", b)
    type_text(b, sid, "wx")
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
    ok("invalid kept", bad.get("ok") is False and "nope 35" in j(sid, "document.querySelector('#entry').value", b))
    ok("invalid gray", j(sid, "getComputedStyle(document.querySelector('.CodeMirror-lint-mark-error')).color", b) == "rgb(201, 201, 201)")
    j(sid, "document.querySelector('#btn-mode').click()", b)
    ok("plain with error", wait(b, sid, "window.__txtvein.state().mode === 'PLAIN'", 4))
    ok("error line kept", "wx1 > nope 35" in j(sid, "window.__txtvein.source().ledger", b))
    j(sid, "document.querySelector('#btn-mode').click()", b)
    ok("code again", wait(b, sid, "window.__txtvein.state().mode === 'CODE'", 4))

    print("== inline repair ==")
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

    print("== report / tree edit ==")
    j(sid, "document.querySelector('#btn-report').click()", b)
    time.sleep(0.7)
    ok("report", "统计" in j(sid, "document.querySelector('#report-view').innerText", b))
    ok("stats tabs", j(sid, "document.querySelectorAll('.stats-tab').length", b) == 4)
    ok("stats months", j(sid, "document.querySelectorAll('.stats-month').length", b) == 12)
    ok("stats year aligns month 12", j(sid, "Math.abs(document.querySelector('.stats-year-input').getBoundingClientRect().right - document.querySelectorAll('.stats-month')[11].getBoundingClientRect().right) < 1", b) is True)
    ok("stats items", j(sid, "document.querySelectorAll('.lst-group').length", b) >= 4)
    ok("stats detail", j(sid, "document.querySelectorAll('.stats-left .sd-row:not(.is-head)').length", b) >= 2)
    j(sid, "Array.from(document.querySelectorAll('.stats-left .sd-row')).find(function(r){return !r.classList.contains('is-head');}).click()", b)
    time.sleep(0.3)
    ok("stats right list", j(sid, "document.querySelectorAll('.stats-right .sd-row:not(.is-head)').length", b) >= 1)
    ok("candidate button hidden", j(sid, "document.querySelector('#btn-candidates').hidden", b) is True)
    shot(b, sid, os.path.join(ROOT, "shots", "03-report.png"))

    print("== query / fixed / i18n ==")
    j(sid, "document.querySelector('#btn-query').click()", b)
    ok("query rows", wait(b, sid, "document.querySelectorAll('.q-panel').length === 3 && document.querySelectorAll('.q-row:not(.is-head)').length > 2", 4))
    dates = j(sid, "Array.from(document.querySelectorAll('.q-panel .q-field:first-child input')).map(function(x){return x.value;}).join('/')", b)
    ok("query default dates", len(dates.split('/')) == 3 and len(dates.split('/')[1]) == 4 and len(dates.split('/')[2]) == 2, dates)
    j(sid, "document.querySelector('.q-panel[data-query=\"A\"] .q-field:first-child input').value='261115'; document.querySelector('.q-panel[data-query=\"A\"] .q-field:first-child input').dispatchEvent(new Event('input',{bubbles:true}));", b)
    time.sleep(0.3)
    ok("query filters", j(sid, "document.querySelectorAll('.q-panel[data-query=\"A\"] .q-row:not(.is-head)').length", b) >= 1)
    j(sid, "document.querySelector('#btn-fixed').click()", b)
    ok("fixed editor", wait(b, sid, "!!document.querySelector('.fixed-editor .CodeMirror')", 4))
    fixed_src = j(sid, "document.querySelector('.fixed-editor .CodeMirror').CodeMirror.getValue()", b)
    ok("fixed text source", "[PLAN]" in fixed_src or "[RULES]" in fixed_src, fixed_src[:80])
    j(sid, "document.querySelector('#btn-lang').click()", b)
    time.sleep(0.5)
    ok("english tabs", j(sid, "document.querySelector('#page-tabs').innerText", b) == "Query\nLedger\nDictionary\nFixed\nStats")
    ok("english menu", "Security" in j(sid, "document.querySelector('.top-menu').innerText", b))
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
