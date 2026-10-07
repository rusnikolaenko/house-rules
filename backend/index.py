"""House Rules — seal service.

A Yandex Cloud Function (Python 3.12, no dependencies) with two routes:

    GET  <function-url>            -> {"seals": {"ruslan": {...} | null, "wonder": {...} | null}}
    POST <function-url>  {"party": "wonder", "word": "..."}
                                   -> 200 {"seals": ...}   sealed now
                                   -> 403 {"error": "wrong_word"}
                                   -> 409 {"error": "already_sealed", "seals": ...}

Seals are kept in seals.json in the site's GitHub repository, so every seal is
also a commit. The secret words are never stored: only salted SHA-256 hashes,
made with tools/make_hashes.py.

Environment variables:
    GITHUB_TOKEN    fine-grained token, "Contents: Read and write" on the site repo
    GITHUB_REPO     "owner/house-rules"
    GITHUB_BRANCH   branch GitHub Pages serves (default "main")
    SEALS_PATH      file in the repo (default "seals.json")
    SEAL_SALT       random salt from tools/make_hashes.py
    HASH_RUSLAN     hash of Ruslan's secret word
    HASH_WONDER     hash of the 8th Wonder's secret word
    ALLOWED_ORIGIN  the site's origin, e.g. "https://owner.github.io" (default "*")

Without GITHUB_TOKEN the service keeps seals in a local file (LOCAL_SEALS_FILE,
default ./seals.local.json) — that is what dev_server.py and the tests use.
"""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PARTIES = ("ruslan", "wonder")
MAX_WORD = 200


# --------------------------------------------------------------------- words

def normalize(word):
    """Phones love to capitalise the first letter and add a trailing space."""
    return " ".join(str(word).split()).casefold()


def word_hash(salt, word):
    return hashlib.sha256((salt + normalize(word)).encode("utf-8")).hexdigest()


def word_matches(party, word):
    expected = os.environ.get("HASH_" + party.upper(), "")
    salt = os.environ.get("SEAL_SALT", "")
    if not expected or not salt:
        return False
    return hmac.compare_digest(word_hash(salt, word), expected.strip().lower())


# --------------------------------------------------------------------- stores

def empty_seals():
    return {p: None for p in PARTIES}


def clean(seals):
    out = empty_seals()
    if isinstance(seals, dict):
        for p in PARTIES:
            v = seals.get(p)
            if isinstance(v, dict) and isinstance(v.get("at"), str):
                out[p] = {"at": v["at"]}
    return out


class Conflict(Exception):
    """The stored file changed between our read and our write."""


class LocalStore:
    def __init__(self, path):
        self.path = path

    def read(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                return clean(json.load(f)), None
        except (FileNotFoundError, ValueError):
            return empty_seals(), None

    def write(self, seals, version, message):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(seals, f, ensure_ascii=False, indent=2)
            f.write("\n")


class GitHubStore:
    API = "https://api.github.com"

    def __init__(self, token, repo, branch, path):
        self.token, self.repo, self.branch, self.path = token, repo, branch, path

    def _request(self, method, url, payload=None):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": "Bearer " + self.token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "house-rules-seals",
            "Content-Type": "application/json",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _url(self):
        return "%s/repos/%s/contents/%s" % (self.API, self.repo, self.path)

    def read(self):
        try:
            doc = self._request("GET", self._url() + "?ref=" + self.branch)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return empty_seals(), None
            raise
        raw = base64.b64decode(doc.get("content", "")).decode("utf-8") or "{}"
        return clean(json.loads(raw)), doc.get("sha")

    def write(self, seals, version, message):
        body = json.dumps(seals, ensure_ascii=False, indent=2) + "\n"
        payload = {
            "message": message,
            "content": base64.b64encode(body.encode("utf-8")).decode("ascii"),
            "branch": self.branch,
        }
        if version:
            payload["sha"] = version
        try:
            self._request("PUT", self._url(), payload)
        except urllib.error.HTTPError as e:
            if e.code in (409, 422):
                raise Conflict() from e
            raise


def make_store():
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return GitHubStore(
            token,
            os.environ["GITHUB_REPO"].strip(),
            os.environ.get("GITHUB_BRANCH", "main").strip() or "main",
            os.environ.get("SEALS_PATH", "seals.json").strip() or "seals.json",
        )
    return LocalStore(os.environ.get("LOCAL_SEALS_FILE", "seals.local.json"))


# --------------------------------------------------------------------- http

def cors_headers():
    return {
        "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*").strip() or "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }


def respond(status, payload=None):
    headers = cors_headers()
    headers["Cache-Control"] = "no-store"
    if payload is None:
        return {"statusCode": status, "headers": headers, "body": ""}
    headers["Content-Type"] = "application/json; charset=utf-8"
    return {"statusCode": status, "headers": headers, "body": json.dumps(payload, ensure_ascii=False)}


def read_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    return json.loads(body) if body else {}


def seal(store, party, now=None):
    """Write the seal; returns (status, seals). Retries once on a write race."""
    for attempt in range(2):
        seals, version = store.read()
        if seals[party]:
            return 409, seals
        at = (now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        seals[party] = {"at": at}
        try:
            store.write(seals, version, "Seal: %s" % party)
            return 200, seals
        except Conflict:
            if attempt:
                raise
    raise RuntimeError("unreachable")


def handler(event, context=None, store=None):
    method = (event.get("httpMethod") or "GET").upper()
    store = store or make_store()
    try:
        if method == "OPTIONS":
            return respond(204)
        if method == "GET":
            seals, _ = store.read()
            return respond(200, {"seals": seals})
        if method != "POST":
            return respond(405, {"error": "method_not_allowed"})

        try:
            data = read_body(event)
        except (ValueError, UnicodeDecodeError):
            return respond(400, {"error": "bad_json"})
        party = data.get("party") if isinstance(data, dict) else None
        word = data.get("word") if isinstance(data, dict) else None
        if party not in PARTIES or not isinstance(word, str) or not word.strip() or len(word) > MAX_WORD:
            return respond(400, {"error": "bad_request"})
        if not word_matches(party, word):
            time.sleep(float(os.environ.get("WRONG_WORD_DELAY", "1")))
            return respond(403, {"error": "wrong_word"})

        status, seals = seal(store, party)
        if status == 409:
            return respond(409, {"error": "already_sealed", "seals": seals})
        return respond(200, {"seals": seals})
    except Exception as e:  # never leak the token or a traceback to the page
        print("seal service error:", type(e).__name__, e)
        return respond(502, {"error": "storage_unavailable"})
