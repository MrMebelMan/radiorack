#!/usr/bin/env python3
"""Local dev server for the simulator: like `python3 -m http.server` but with no caching,
so a normal reload always picks up edited files."""
import http.server, functools, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8225
handler = functools.partial(NoCache, directory=os.path.dirname(os.path.abspath(__file__)))
print(f'GTR 225 simulator: http://localhost:{port}')
http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
