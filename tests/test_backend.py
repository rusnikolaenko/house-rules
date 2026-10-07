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
    monkeypatch.setenv("LOCAL_SEALS_FILE", str(tmp_path / "seals.json"))
    monkeypatch.setenv("LOCAL_WORDS_FILE", str(tmp_path / "words.json"))
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


def test_first_word_registers_and_seals():
    status, body, _ = call("POST", {"party": "wonder", "word": "  Eighth  Wonder "})
    assert status == 200
    assert body["seals"]["wonder"]["at"].endswith("Z")
    assert body["seals"]["ruslan"] is None


def test_repeating_the_same_word_is_already_sealed():
    call("POST", {"party": "wonder", "word": "eighth wonder"})
    status, body, _ = call("POST", {"party": "wonder", "word": "eighth wonder"})
    assert status == 409 and body["error"] == "already_sealed"


def test_a_different_word_for_an_already_registered_party_is_refused():
    call("POST", {"party": "wonder", "word": "eighth wonder"})
    status, body, _ = call("POST", {"party": "wonder", "word": "something else"})
    assert status == 403 and body["error"] == "wrong_word"
    assert call("GET")[1]["seals"]["wonder"] is not None  # still sealed from the first call


def test_two_parties_register_independently():
    assert call("POST", {"party": "ruslan", "word": "rose garden"}, b64=True)[0] == 200
    assert call("POST", {"party": "wonder", "word": "eighth wonder"})[0] == 200
    seals = call("GET")[1]["seals"]
    assert seals["ruslan"] and seals["wonder"]


def test_resetting_the_word_file_allows_a_fresh_word(tmp_path):
    call("POST", {"party": "ruslan", "word": "first try"})
    (tmp_path / "words.json").write_text(json.dumps({"ruslan": None, "wonder": None}))
    (tmp_path / "seals.json").write_text(json.dumps({"ruslan": None, "wonder": None}))
    status, body, _ = call("POST", {"party": "ruslan", "word": "second try"})
    assert status == 200 and body["seals"]["ruslan"]


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


def test_missing_salt_never_matches(monkeypatch):
    monkeypatch.delenv("SEAL_SALT")
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
            s = api.clean_seals(other.read_raw()[0])
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
        def read_raw(self):
            raise OSError("token=secret")
    res = api.handler({"httpMethod": "GET"}, seal_store=Broken("x"))
    assert res["statusCode"] == 502
    assert "secret" not in res["body"]


class FakeGitHub:
    """Stands in for api.github.com/repos/<repo>/contents/<path>, for any number of files."""

    def __init__(self, files=None):
        self.files = {}  # path -> {"content": str, "sha": str}
        for path, content in (files or {}).items():
            self.files[path] = {"content": content, "sha": "sha-" + path}
        self.puts = []  # list of (path, payload)

    def urlopen(self, req, timeout=None):
        import io
        import urllib.error
        assert req.get_header("Authorization") == "Bearer tkn"
        path = req.full_url.split("/contents/", 1)[1].split("?")[0]
        if req.get_method() == "GET":
            assert "?ref=main" in req.full_url
            f = self.files.get(path)
            if f is None:
                raise urllib.error.HTTPError(req.full_url, 404, "missing", {}, io.BytesIO(b"{}"))
            doc = {"sha": f["sha"], "content": base64.b64encode(f["content"].encode()).decode()}
            return io.BytesIO(json.dumps(doc).encode())
        payload = json.loads(req.data)
        self.puts.append((path, payload))
        current = self.files.get(path)
        current_sha = current["sha"] if current else None
        if payload.get("sha") != current_sha:
            raise urllib.error.HTTPError(req.full_url, 409, "conflict", {}, io.BytesIO(b"{}"))
        content = base64.b64decode(payload["content"]).decode()
        self.files[path] = {"content": content, "sha": "sha-%s-%d" % (path, len(self.puts))}
        return io.BytesIO(b"{}")


def test_github_store_commits_the_word_and_the_seal(monkeypatch):
    fake = FakeGitHub({"seals.json": json.dumps({"ruslan": None, "wonder": None})})
    monkeypatch.setattr(api.urllib.request, "urlopen", fake.urlopen)
    monkeypatch.setenv("GITHUB_TOKEN", "tkn")
    monkeypatch.setenv("GITHUB_REPO", "owner/house-rules")
    status, body, _ = call("POST", {"party": "ruslan", "word": "rose garden"})
    assert status == 200

    word_puts = [p for path, p in fake.puts if path == "words.json"]
    seal_puts = [path for path, p in fake.puts if path == "seals.json"]
    assert word_puts and word_puts[-1]["branch"] == "main" and word_puts[-1]["message"] == "Set secret word: ruslan"
    assert seal_puts and seal_puts[-1] == "seals.json"
    assert json.loads(fake.files["seals.json"]["content"])["ruslan"]["at"]
    assert call("GET")[1]["seals"]["ruslan"]

    # repeating the same word now checks it against the stored hash, no new write to words.json
    puts_before = len(fake.puts)
    status, body, _ = call("POST", {"party": "ruslan", "word": "rose garden"})
    assert status == 409
    assert len(fake.puts) == puts_before
