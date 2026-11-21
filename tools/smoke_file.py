# -*- coding: utf-8 -*-
"""Single-file TxtVein smoke: file:// gate -> setup -> reload -> unlock."""
import os
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from cdp import Cdp, launch, new_page, shot

URL = "file:///" + os.path.join(ROOT, "TxtVein.html").replace("\\", "/")
PW = "test1234"


def j(b, sid, expr):
    v = b.js(expr, sid)
    if isinstance(v, dict) and "__jsError" in v:
        raise RuntimeError(v["__jsError"])
    return v


def wait(b, sid, expr, timeout=8):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if j(b, sid, expr):
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


def main():
    print("file:", URL)
    ws = launch()
    b = Cdp(ws)
    tid, sid = new_page(b, URL)
    print("title:", j(b, sid, "document.title"))
    print("gate:", j(b, sid, "!document.querySelector('#gate').hidden"))
    j(b, sid, """
(function(){
  var pw=document.querySelector('#gate-pw'), pw2=document.querySelector('#gate-pw2');
  pw.value='%s'; pw2.value='%s';
  pw.dispatchEvent(new Event('input',{bubbles:true}));
  pw2.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('#gate form').requestSubmit(); return true;
})()
""" % (PW, PW))
    ok = wait(b, sid, "!document.querySelector('#app').hidden")
    print("app after setup:", ok)
    print("editors:", j(b, sid, "document.querySelectorAll('.CodeMirror').length"))
    j(b, sid, "document.querySelector('#btn-query').click()")
    time.sleep(0.4)
    print("query rows:", j(b, sid, "document.querySelectorAll('#query-view .q-row:not(.is-head)').length"))
    print("state:", j(b, sid, "JSON.stringify(window.__txtvein.state())"))
    shot(b, sid, os.path.join(ROOT, "shots", "05-single-file.png"))
    b.call("Page.reload", {}, sid)
    time.sleep(1.0)
    print("gate after reload:", wait(b, sid, "!document.querySelector('#gate').hidden && !!document.querySelector('#gate-pw')"))
    j(b, sid, """
(function(){
  var pw=document.querySelector('#gate-pw'); pw.value='%s';
  document.querySelector('#gate form').requestSubmit(); return true;
})()
""" % PW)
    ok2 = wait(b, sid, "!document.querySelector('#app').hidden", 12)
    print("unlock after reload:", ok2)
    print("events after reload:", j(b, sid, "window.__txtvein.state().events"))
    errs = [m for m in b.drain() if m.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
    print("errors:", len(errs))
    for e in errs[:5]:
        print(" ", str(e)[:300])
    b.call("Browser.close")
    if not (ok and ok2):
        sys.exit(1)


if __name__ == "__main__":
    main()
