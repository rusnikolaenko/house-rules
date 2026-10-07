"""Run the whole thing locally: the site and the seal service on one port.

    python dev_server.py
    open http://localhost:8000

Seals go to seals.local.json, word hashes to words.local.json, both next to
this file, in git it doesn't go. Nothing is pre-set — type any word the
first time you press each seal, that becomes its secret word.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "backend"))
import index as seals_api  # noqa: E402

os.environ.setdefault("SEAL_SALT", "local-dev-salt")
os.environ.setdefault("LOCAL_SEALS_FILE", os.path.join(ROOT, "seals.local.json"))
os.environ.setdefault("LOCAL_WORDS_FILE", os.path.join(ROOT, "words.local.json"))
os.environ.setdefault("WRONG_WORD_DELAY", "0.3")
os.environ.pop("GITHUB_TOKEN", None)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _api(self, method):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8") if length else ""
        res = seals_api.handler({"httpMethod": method, "body": body, "isBase64Encoded": False})
        self.send_response(res["statusCode"])
        for k, v in res["headers"].items():
            self.send_header(k, v)
        data = res["body"].encode("utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/api":
            return self._api("GET")
        if self.path.split("?")[0] == "/config.js":
            data = b'window.HOUSE_RULES_CONFIG = { api: "/api" };\n'
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api":
            return self._api("POST")
        self.send_error(404)

    def do_OPTIONS(self):
        return self._api("OPTIONS")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print("House Rules on http://localhost:%d  (type any word the first time you press each seal)" % port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
