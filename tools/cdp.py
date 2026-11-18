# -*- coding: utf-8 -*-
"""Minimal Chrome DevTools Protocol helper for TxtVein E2E.

No third-party deps except websocket-client. Reuses a dedicated profile.
"""
import base64
import json
import os
import shutil
import subprocess
import time
import urllib.request

import websocket

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9333
PROFILE = r"D:\myproject\TxtVein\_tmp_cdp_profile"


class Cdp:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=60)
        self.mid = 0
        self.events = []

    def call(self, method, params=None, sid=None, timeout=60):
        self.mid += 1
        mid = self.mid
        msg = {"id": mid, "method": method, "params": params or {}}
        if sid:
            msg["sessionId"] = sid
        self.ws.send(json.dumps(msg))
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = self.ws.recv()
            if not raw:
                continue
            try:
                m = json.loads(raw)
            except Exception:
                continue
            if m.get("id") == mid:
                if "error" in m:
                    raise RuntimeError("%s: %s" % (method, m["error"]))
                return m.get("result", {})
            self.events.append(m)
        raise TimeoutError(method)

    def js(self, expr, sid=None, timeout=60):
        r = self.call("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True,
            "userGesture": True,
        }, sid, timeout)
        if "exceptionDetails" in r:
            desc = r["exceptionDetails"].get("exception", {}).get("description")
            return {"__jsError": desc or str(r["exceptionDetails"])[:600]}
        return r.get("result", {}).get("value")

    def drain(self):
        out = self.events[:]
        self.events = []
        return out


def kill_old(port=PORT):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/json/version" % port, timeout=2) as r:
            wsurl = json.load(r)["webSocketDebuggerUrl"]
        c = Cdp(wsurl)
        c.call("Browser.close")
        time.sleep(1.0)
    except Exception:
        pass


def launch(port=PORT, profile=PROFILE, width=1600, height=1000):
    kill_old(port)
    shutil.rmtree(profile, ignore_errors=True)
    os.makedirs(profile, exist_ok=True)
    args = [
        CHROME,
        "--remote-debugging-port=%d" % port,
        "--user-data-dir=%s" % profile,
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--window-size=%d,%d" % (width, height),
        "--remote-allow-origins=http://127.0.0.1:%d" % port,
        "about:blank",
    ]
    # 沙箱里 DEVNULL/继承句柄可能让 Chrome 起不来；重定向到文件更稳，也便于排错。
    import tempfile
    log_path = os.path.join(tempfile.gettempdir(), "txtvein-chrome.log")
    log = open(log_path, "wb")
    try:
        subprocess.Popen(args, stdout=log, stderr=log, close_fds=True)
    finally:
        log.close()
    for i in range(40):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json/version" % port, timeout=2) as r:
                v = json.load(r)
            print("[chrome] up after %.1fs: %s" % ((i + 1) * 0.5, v["Browser"]))
            return v["webSocketDebuggerUrl"]
        except Exception:
            continue
    raise RuntimeError("chrome debug port did not open")


def new_page(browser, url):
    t = browser.call("Target.createTarget", {"url": "about:blank"})
    tid = t["targetId"]
    a = browser.call("Target.attachToTarget", {"targetId": tid, "flatten": True})
    sid = a["sessionId"]
    browser.call("Page.enable", {}, sid)
    browser.call("Runtime.enable", {}, sid)
    browser.call("Log.enable", {}, sid)
    browser.call("Page.navigate", {"url": url}, sid)
    time.sleep(1.2)
    return tid, sid


def shot(browser, sid, path):
    r = browser.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, sid)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(base64.b64decode(r["data"]))
    return path
