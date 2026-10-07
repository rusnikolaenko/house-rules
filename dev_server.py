"""Run the whole thing locally: the site and the seal service on one port.

    python dev_server.py
    open http://localhost:8000

Seals go to seals.local.json next to this file. Secret words for local runs:
"ruslan test" and "wonder test" (set your own with DEV_WORD_RUSLAN / DEV_WORD_WONDER).
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "backend"))
import index as seals_api  # noqa: E402

os.environ.setdefault("SEAL_SALT", "local-dev-salt")
os.environ.setdefault("LOCAL_SEALS_FILE", os.path.join(ROOT, "seals.local.json"))
os.environ.setdefault("WRONG_WORD_DELAY", "0.3")
os.environ.pop("GITHUB_TOKEN", None)
for party, default in (("RUSLAN", "ruslan test"), ("WONDER", "wonder test")):
    word = os.environ.get("DEV_WORD_" + party, default)
    os.environ["HASH_" + party] = seals_api.word_hash(os.environ["SEAL_SALT"], word)


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
    print("House Rules on http://localhost:%d  (words: %r / %r)" % (
        port, os.environ.get("DEV_WORD_RUSLAN", "ruslan test"), os.environ.get("DEV_WORD_WONDER", "wonder test")))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
