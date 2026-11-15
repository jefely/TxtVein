#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""TxtVein local dev server.

Usage:
    python serve.py 8899            # start on 8899 (auto-increments if busy)
    python serve.py 8899 --no-open  # do not open a browser (agent/CI)

Static files only: no build step. Edit index.html / css / js, then refresh.
The single-file TxtVein.html needs `node tools/build.cjs` after source edits.
"""
import http.server
import os
import socketserver
import sys
import webbrowser


class DevServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)

    args = [a for a in sys.argv[1:]]
    no_open = '--no-open' in args
    ports = [a for a in args if not a.startswith('-')]
    start_port = int(ports[0]) if ports else 8899

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root, **kw)

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            super().end_headers()

        def log_message(self, fmt, *a):
            sys.stderr.write('[txtvein] ' + (fmt % a) + '\n')

    httpd = None
    port = start_port
    for port in range(start_port, start_port + 20):
        try:
            httpd = DevServer(('127.0.0.1', port), Handler)
            break
        except OSError:
            continue
    if httpd is None:
        raise SystemExit('no free port near %d' % start_port)

    url = 'http://127.0.0.1:%d/' % port
    print('TxtVein dev -> ' + url, flush=True)
    print('  index.html  : %sindex.html' % url, flush=True)
    print('  single file : %sTxtVein.html' % url, flush=True)
    print('  F5 refresh after editing css/js; Ctrl+C to stop.', flush=True)
    if not no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nbye', flush=True)
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
