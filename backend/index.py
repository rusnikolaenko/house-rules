"""House Rules — seal service.

A Yandex Cloud Function (Python 3.12, no dependencies) with two routes:

    GET  <function-url>            -> {"seals": {"ruslan": {...} | null, "wonder": {...} | null}}
    POST <function-url>  {"party": "wonder", "word": "..."}
        The first word anyone sends for a party becomes that party's secret
        word (remembered as a salted hash in WORDS_PATH) and seals right
        away. Every later call for that party must repeat the same word.
                                   -> 200 {"seals": ...}   sealed now
                                   -> 403 {"error": "wrong_word"}
                                   -> 409 {"error": "already_sealed", "seals": ...}

Seals live in SEALS_PATH, word hashes in WORDS_PATH — both in the site's
GitHub repository, so every seal and every word registration is a commit.
The secret words themselves are never stored, only salted SHA-256 hashes.

Environment variables:
    GITHUB_TOKEN    fine-grained token, "Contents: Read and write" on the site repo
    GITHUB_REPO     "owner/house-rules"
    GITHUB_BRANCH   branch GitHub Pages serves (default "main")
    SEALS_PATH      seals file in the repo (default "seals.json")
    WORDS_PATH      word-hash file in the repo (default "words.json")
    SEAL_SALT       random salt shared by both parties — not secret itself
    ALLOWED_ORIGIN  the site's origin, e.g. "https://owner.github.io" (default "*")

Without GITHUB_TOKEN the service keeps both files locally (LOCAL_SEALS_FILE /
LOCAL_WORDS_FILE) — that is what dev_server.py and the tests use.

To let someone pick a new word, open WORDS_PATH in the repo, set their entry
back to null, and commit — same as resetting a seal in SEALS_PATH.
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


# --------------------------------------------------------------------- stores

def empty_seals():
    return {p: None for p in PARTIES}


def clean_seals(seals):
    out = empty_seals()
    if isinstance(seals, dict):
        for p in PARTIES:
            v = seals.get(p)
            if isinstance(v, dict) and isinstance(v.get("at"), str):
                out[p] = {"at": v["at"]}
    return out


def empty_words():
    return {p: None for p in PARTIES}


def clean_words(words):
    out = empty_words()
    if isinstance(words, dict):
        for p in PARTIES:
            v = words.get(p)
            if isinstance(v, str) and v:
                out[p] = v
    return out


class Conflict(Exception):
    """The stored file changed between our read and our write."""


class LocalStore:
    def __init__(self, path):
        self.path = path

    def read_raw(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f), None
        except (FileNotFoundError, ValueError):
            return {}, None

    def write(self, data, version, message):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
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

    def read_raw(self):
        try:
            doc = self._request("GET", self._url() + "?ref=" + self.branch)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}, None
            raise
        raw = base64.b64decode(doc.get("content", "")).decode("utf-8") or "{}"
        return json.loads(raw), doc.get("sha")

    def write(self, data, version, message):
        body = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
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


def _make_store(path, local_path):
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return GitHubStore(
            token,
            os.environ["GITHUB_REPO"].strip(),
            os.environ.get("GITHUB_BRANCH", "main").strip() or "main",
            path,
        )
    return LocalStore(local_path)


def make_seal_store():
    return _make_store(
        os.environ.get("SEALS_PATH", "seals.json").strip() or "seals.json",
        os.environ.get("LOCAL_SEALS_FILE", "seals.local.json"),
    )


def make_word_store():
    return _make_store(
        os.environ.get("WORDS_PATH", "words.json").strip() or "words.json",
        os.environ.get("LOCAL_WORDS_FILE", "words.local.json"),
    )


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


def check_word(word_store, party, word):
    """True if `word` is (now, or already was) this party's secret word.

    The first call for a party registers its word; every later call must
    repeat it. Retries once on a write race, same pattern as seal().
    """
    salt = os.environ.get("SEAL_SALT", "")
    if not salt:
        return False
    h = word_hash(salt, word)
    for attempt in range(2):
        raw, version = word_store.read_raw()
        words = clean_words(raw)
        existing = words[party]
        if existing:
            return hmac.compare_digest(h, existing)
        words[party] = h
        try:
            word_store.write(words, version, "Set secret word: %s" % party)
            return True
        except Conflict:
            if attempt:
                raise
    raise RuntimeError("unreachable")


def seal(seal_store, party, now=None):
    """Write the seal; returns (status, seals). Retries once on a write race."""
    for attempt in range(2):
        raw, version = seal_store.read_raw()
        seals = clean_seals(raw)
        if seals[party]:
            return 409, seals
        at = (now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        seals[party] = {"at": at}
        try:
            seal_store.write(seals, version, "Seal: %s" % party)
            return 200, seals
        except Conflict:
            if attempt:
                raise
    raise RuntimeError("unreachable")


def handler(event, context=None, seal_store=None, word_store=None):
    method = (event.get("httpMethod") or "GET").upper()
    seal_store = seal_store or make_seal_store()
    word_store = word_store or make_word_store()
    try:
        if method == "OPTIONS":
            return respond(204)
        if method == "GET":
            seals = clean_seals(seal_store.read_raw()[0])
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
        if not check_word(word_store, party, word):
            time.sleep(float(os.environ.get("WRONG_WORD_DELAY", "1")))
            return respond(403, {"error": "wrong_word"})

        status, seals = seal(seal_store, party)
        if status == 409:
            return respond(409, {"error": "already_sealed", "seals": seals})
        return respond(200, {"seals": seals})
    except Exception as e:  # never leak the token or a traceback to the page
        print("seal service error:", type(e).__name__, e)
        return respond(502, {"error": "storage_unavailable"})
