(function () {
  "use strict";

  var PARTIES = [
    { id: "ruslan", name: "Ruslan", mark: "R" },
    { id: "wonder", name: "8th Wonder", mark: { emblem: "gem" } }
  ];
  var cfg = window.HOUSE_RULES_CONFIG || {};
  var API = String(cfg.api || "").trim();
  var POLL_MS = 20000;

  var state = { ruslan: null, wonder: null };
  var loaded = false;
  var sealing = null; // party id whose form is open

  function $(id) { return document.getElementById(id); }
  function byId(pid) {
    for (var i = 0; i < PARTIES.length; i++) if (PARTIES[i].id === pid) return PARTIES[i];
    return null;
  }
  function fmt(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function clean(seals) {
    var out = { ruslan: null, wonder: null };
    if (seals && typeof seals === "object") {
      PARTIES.forEach(function (p) {
        var v = seals[p.id];
        if (v && typeof v.at === "string") out[p.id] = { at: v.at };
      });
    }
    return out;
  }
  function note(text) {
    var n = $("note");
    n.textContent = text || "";
    n.hidden = !text;
  }

  function render(animateId) {
    var set = 0, latest = null;
    PARTIES.forEach(function (p) {
      var btn = $("seal-" + p.id), date = $("date-" + p.id);
      var s = state[p.id];
      if (s) {
        set++;
        if (!latest || s.at > latest) latest = s.at;
        if (btn.getAttribute("data-state") !== "stamped" || animateId === p.id) {
          Svitok.stamp(btn, p.mark, animateId === p.id);
        }
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-label", "Sealed by " + p.name + " on " + fmt(s.at));
        date.textContent = "Sealed " + fmt(s.at);
      } else {
        Svitok.unstamp(btn);
        btn.removeAttribute("aria-disabled");
        btn.setAttribute("aria-label", "Press to seal as " + p.name);
        date.textContent = loaded ? "Not sealed yet" : "…";
      }
    });
    var st = $("status");
    st.setAttribute("data-in-force", set === 2 ? "true" : "false");
    st.textContent = !loaded ? "Checking the seals…"
      : set === 2 ? "In force since " + fmt(latest)
      : set === 1 ? "Awaiting one more seal" : "Awaiting both seals";
    // The ceremony, the artifact and the reign calendar live in ceremony.js.
    if (window.Ceremony) {
      window.Ceremony.update({ inForce: set === 2, at: set === 2 ? latest : null, live: set === 2 && !!animateId });
    }
  }

  function apply(seals, allowAnimation) {
    var next = clean(seals);
    var newly = null;
    if (allowAnimation && loaded) {
      PARTIES.forEach(function (p) { if (next[p.id] && !state[p.id]) newly = p.id; });
    }
    state = next;
    loaded = true;
    render(newly);
    if (sealing && state[sealing]) closeForm();
  }

  function load(allowAnimation) {
    var url = API || "seals.json";
    return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        apply(API ? data.seals : data, allowAnimation);
        if (!API) note("The seal service isn't connected yet, so the seals can't be pressed. See README.");
      })
      .catch(function () {
        if (!loaded) { loaded = true; render(null); }
        note("Couldn't reach the seal service. The seals will show up once it answers.");
      });
  }

  // ------------------------------------------------------------ seal form
  function openForm(pid) {
    var p = byId(pid);
    sealing = pid;
    $("form-title").textContent = "Sealing as " + p.name;
    $("word").value = "";
    $("form-error").textContent = "";
    $("seal-form").hidden = false;
    $("word").focus();
  }
  function closeForm() {
    sealing = null;
    $("seal-form").hidden = true;
    $("form-error").textContent = "";
    setBusy(false);
  }
  function setBusy(busy) {
    var b = $("seal-submit");
    b.disabled = busy;
    b.textContent = busy ? "Sealing…" : "Seal it";
  }

  PARTIES.forEach(function (p) {
    $("seal-" + p.id).addEventListener("click", function () {
      if (state[p.id]) return;
      if (!API) {
        note("The seal service isn't connected yet, so the seals can't be pressed. See README.");
        return;
      }
      openForm(p.id);
    });
  });

  $("seal-cancel").addEventListener("click", closeForm);

  $("seal-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pid = sealing;
    var word = $("word").value;
    if (!pid || !word.trim()) return;
    setBusy(true);
    $("form-error").textContent = "";
    fetch(API, {
      method: "POST",
      // text/plain keeps this a "simple" request: no CORS preflight
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ party: pid, word: word })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; });
      })
      .then(function (res) {
        if (res.status === 200 || res.status === 409) {
          var wasSealed = !!state[pid];
          closeForm();
          note("");
          var next = clean(res.data.seals);
          var animate = !wasSealed && next[pid] ? pid : null;
          state = next;
          loaded = true;
          render(animate);
          return;
        }
        setBusy(false);
        $("form-error").textContent =
          res.status === 403 ? "That's not the secret word. The seal won't take."
          : res.status === 400 ? "Type the secret word first."
          : "The seal service didn't answer. Try again in a minute.";
        if (res.status === 403) { $("word").select(); }
      })
      .catch(function () {
        setBusy(false);
        $("form-error").textContent = "The seal service didn't answer. Try again in a minute.";
      });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sealing) closeForm();
  });

  // ------------------------------------------------------------ start
  Svitok.mountIcons();
  render(null);
  load(false);
  setInterval(function () {
    if (document.visibilityState === "visible" && !sealing) load(true);
  }, POLL_MS);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !sealing) load(true);
  });
})();
