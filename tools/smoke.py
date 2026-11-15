# -*- coding: utf-8 -*-
"""Quick TxtVein browser smoke: gate -> example -> ledger/report screenshots."""
import json
import os
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Cdp, launch, new_page, shot

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get("TXTVEIN_URL", "http://127.0.0.1:8899/")
PW = "test1234"


def errors(browser, sid):
    out = []
    for m in browser.drain():
        if m.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded", "Runtime.consoleAPICalled"):
            out.append(m)
    return out


def main():
    ws = launch()
    b = Cdp(ws)
    tid, sid = new_page(b, URL)
    print("title:", b.js("document.title", sid))
    print("gate:", b.js("document.querySelector('#gate .gate-brand') ? document.querySelector('#gate').innerText.slice(0,120) : 'NO GATE'", sid))
    b.js("""
(function(){
  var pw=document.querySelector('#gate-pw');
  var pw2=document.querySelector('#gate-pw2');
  pw.value='test1234'; pw2.value='test1234';
  pw.dispatchEvent(new Event('input',{bubbles:true}));
  pw2.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('#gate form').requestSubmit();
  return true;
})()
""", sid)
    time.sleep(2.0)
    print("app hidden:", b.js("document.querySelector('#app').hidden", sid))
    print("body head:", b.js("document.body.innerText.slice(0,300)", sid))
    print("has N_ id in UI:", b.js("/N_\\d/.test(document.querySelector('#app').innerText)", sid))
    print("hud:", b.js("document.querySelector('#hud').innerText", sid))
    print("panes rows:", b.js("document.querySelectorAll('.pane .row').length", sid))
    print("state:", b.js("JSON.stringify(window.__txtvein ? window.__txtvein.state() : null)", sid))
    print("errors:", json.dumps(errors(b, sid), ensure_ascii=False)[:2000])
    shot(b, sid, os.path.join(ROOT, "shots", "01-ledger.png"))
    b.js("document.querySelector('#btn-report').click()", sid)
    time.sleep(0.8)
    print("report:", b.js("document.querySelector('#report-view').innerText.slice(0,400)", sid))
    print("errors2:", json.dumps(errors(b, sid), ensure_ascii=False)[:2000])
    shot(b, sid, os.path.join(ROOT, "shots", "02-report.png"))
    b.call("Browser.close")


if __name__ == "__main__":
    main()
