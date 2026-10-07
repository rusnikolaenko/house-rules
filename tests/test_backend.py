import base64
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
import index as api  # noqa: E402

SALT = "test-salt"


@pytest.fixture(autouse=True)
def env(monkeypatch, tmp_path):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("SEAL_SALT", SALT)
    monkeypatch.setenv("HASH_RUSLAN", api.word_hash(SALT, "rose garden"))
    monkeypatch.setenv("HASH_WONDER", api.word_hash(SALT, "eighth wonder"))
    monkeypatch.setenv("LOCAL_SEALS_FILE", str(tmp_path / "seals.json"))
    monkeypatch.setenv("WRONG_WORD_DELAY", "0")
    monkeypatch.setenv("ALLOWED_ORIGIN", "https://example.github.io")


def call(method, payload=None, b64=False):
    body = json.dumps(payload) if payload is not None else ""
    if b64:
        body = base64.b64encode(body.encode()).decode()
    res = api.handler({"httpMethod": method, "body": body, "isBase64Encoded": b64})
    return res["statusCode"], (json.loads(res["body"]) if res["body"] else None), res["headers"]


def test_starts_unsealed():
    status, body, _ = call("GET")
    assert status == 200
    assert body == {"seals": {"ruslan": None, "wonder": None}}


def test_wrong_word_is_refused_and_nothing_is_written():
    status, body, _ = call("POST", {"party": "wonder", "word": "rose garden"})
    assert status == 403 and body["error"] == "wrong_word"
    assert call("GET")[1]["seals"]["wonder"] is None


def test_right_word_seals_once():
    status, body, _ = call("POST", {"party": "wonder", "word": "  Eighth  Wonder "})
    assert status == 200
    assert body["seals"]["wonder"]["at"].endswith("Z")
    assert body["seals"]["ruslan"] is None
    status, body, _ = call("POST", {"party": "wonder", "word": "eighth wonder"})
    assert status == 409 and body["error"] == "already_sealed"


def test_both_seals_and_base64_body():
    assert call("POST", {"party": "ruslan", "word": "rose garden"}, b64=True)[0] == 200
    assert call("POST", {"party": "wonder", "word": "eighth wonder"})[0] == 200
    seals = call("GET")[1]["seals"]
    assert seals["ruslan"] and seals["wonder"]


@pytest.mark.parametrize("payload", [
    {"party": "someone", "word": "rose garden"},
    {"party": "ruslan"},
    {"party": "ruslan", "word": "   "},
    {"party": "ruslan", "word": "x" * 500},
    ["ruslan", "rose garden"],
])
def test_bad_requests(payload):
    assert call("POST", payload)[0] == 400


def test_not_json():
    res = api.handler({"httpMethod": "POST", "body": "{nope", "isBase64Encoded": False})
    assert res["statusCode"] == 400


def test_cors_and_preflight():
    status, _, headers = call("OPTIONS")
    assert status == 204
    assert headers["Access-Control-Allow-Origin"] == "https://example.github.io"
    assert "POST" in headers["Access-Control-Allow-Methods"]


def test_missing_config_never_matches(monkeypatch):
    monkeypatch.delenv("HASH_RUSLAN")
    assert call("POST", {"party": "ruslan", "word": "rose garden"})[0] == 403


class RacyStore(api.LocalStore):
    """The other party seals between our read and our write, once."""

    def __init__(self, path):
        super().__init__(path)
        self.raced = False

    def write(self, seals, version, message):
        if not self.raced:
            self.raced = True
            other = api.LocalStore(self.path)
            s, _ = other.read()
            s["ruslan"] = {"at": "2026-10-01T10:00:00Z"}
            other.write(s, None, "")
            raise api.Conflict()
        super().write(seals, version, message)


def test_write_race_keeps_both_seals(tmp_path):
    store = RacyStore(str(tmp_path / "race.json"))
    status, seals = api.seal(store, "wonder")
    assert status == 200
    assert seals["ruslan"] == {"at": "2026-10-01T10:00:00Z"} and seals["wonder"]


def test_storage_failure_is_a_502_without_details():
    class Broken(api.LocalStore):
        def read(self):
            raise OSError("token=secret")
    res = api.handler({"httpMethod": "GET"}, store=Broken("x"))
    assert res["statusCode"] == 502
    assert "secret" not in res["body"]


class FakeGitHub:
    """Stands in for api.github.com/repos/<repo>/contents/<path>."""

    def __init__(self):
        self.content = json.dumps({"ruslan": None, "wonder": None})
        self.sha = "sha-1"
        self.puts = []

    def urlopen(self, req, timeout=None):
        import io
        import urllib.error
        assert req.get_header("Authorization") == "Bearer tkn"
        if req.get_method() == "GET":
            assert "?ref=main" in req.full_url
            doc = {"sha": self.sha, "content": base64.b64encode(self.content.encode()).decode()}
            return io.BytesIO(json.dumps(doc).encode())
        payload = json.loads(req.data)
        self.puts.append(payload)
        if payload.get("sha") != self.sha:
            raise urllib.error.HTTPError(req.full_url, 409, "conflict", {}, io.BytesIO(b"{}"))
        self.content = base64.b64decode(payload["content"]).decode()
        self.sha = "sha-%d" % (len(self.puts) + 1)
        return io.BytesIO(b"{}")


def test_github_store_commits_the_seal(monkeypatch):
    fake = FakeGitHub()
    monkeypatch.setattr(api.urllib.request, "urlopen", fake.urlopen)
    monkeypatch.setenv("GITHUB_TOKEN", "tkn")
    monkeypatch.setenv("GITHUB_REPO", "owner/house-rules")
    status, body, _ = call("POST", {"party": "ruslan", "word": "rose garden"})
    assert status == 200
    put = fake.puts[-1]
    assert put["sha"] == "sha-1" and put["branch"] == "main" and put["message"] == "Seal: ruslan"
    assert json.loads(fake.content)["ruslan"]["at"]
    assert call("GET")[1]["seals"]["ruslan"]
