/* House Rules: what happens once both seals are set.
 *
 *  - ceremony: seals flash, the scroll shakes, pixel confetti, a banner and a chiptune fanfare
 *  - artifact: a pop-up in the manner of an adventure game ("Artifact acquired")
 *  - reign calendar: Month / Week / Day counted from the day the rules came into force
 *
 * house-rules.js calls Ceremony.update() after every render. Nothing here talks to the server.
 */
(function () {
  "use strict";

  var SEEN_KEY = "hr.ceremony.seen";   // value: the "in force since" timestamp already celebrated on this device
  var SOUND_KEY = "hr.sound";          // "off" mutes the fanfare
  var DAY_MS = 86400000;

  // Astrologers proclaim a new week every seven days; the list repeats after twelve weeks.
  var WEEKS = [
    { name: "Week of the Warm Tea", effect: "Every cup is refilled without asking." },
    { name: "Week of Slow Mornings", effect: "Alarm clocks lose half their power." },
    { name: "Week of the Soft Blanket", effect: "Blanket defense +2. Cold feet are tolerated." },
    { name: "Week of Long Walks", effect: "Movement doubled. Hand-holding is mandatory." },
    { name: "Week of Late Breakfasts", effect: "Pancakes appear on request." },
    { name: "Week of Sauna Steam", effect: "All inspections run on schedule. In person, of course." },
    { name: "Week of Endless Hugs", effect: "Hug range extended to the whole apartment." },
    { name: "Week of the Starry Night", effect: "Wishes made out loud come true. Mostly." },
    { name: "Week of Movie Nights", effect: "The remote belongs to the one who is always right." },
    { name: "Week of Pocket Kisses", effect: "Kisses may be collected at any time of day." },
    { name: "Week of the Sweet Tooth", effect: "Dessert is served before dinner." },
    { name: "Week of Golden Hours", effect: "Every sunset is watched together." }
  ];

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ small helpers
  function lsGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* private mode: fine */ } }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // ------------------------------------------------------------ reign calendar
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /** Whole calendar days (local time) between the day the rules came into force and `now`. */
  function reignDays(at, now) {
    var start = new Date(at);
    if (isNaN(start)) return 0;
    var n = Math.round((dayStart(now || new Date()) - dayStart(start)) / DAY_MS);
    return n > 0 ? n : 0;
  }

  /** n = days since the rules came into force (0 on the first day). Months have 28 days, weeks 7. */
  function describe(n) {
    var total = n + 1;
    var note = "";
    if (total === 1) note = "Day one. The rules take effect today.";
    else if (total % 100 === 0) note = "Day " + total + " of the rules. A legendary reign.";
    else if (n % 28 === 0) note = "A new month begins.";
    return {
      total: total,
      month: Math.floor(n / 28) + 1,
      week: Math.floor((n % 28) / 7) + 1,
      day: (n % 7) + 1,
      proclamation: WEEKS[Math.floor(n / 7) % WEEKS.length],
      note: note
    };
  }

  function renderCalendar(at) {
    var d = describe(reignDays(at));
    $("cal-month").textContent = d.month;
    $("cal-week").textContent = d.week;
    $("cal-day").textContent = d.day;
    $("cal-name").textContent = d.proclamation.name;
    $("cal-effect").textContent = d.proclamation.effect;
    var note = $("cal-note");
    note.textContent = d.note;
    note.hidden = !d.note;
    $("cal-total").textContent = "Day " + d.total + " since the rules came into force";
  }

  // ------------------------------------------------------------ sound (WebAudio chiptune, no files)
  var audio = null;

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audio) audio = new AC();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { /* no audio on this device */ }
  }
  // Browsers only start audio after a touch or a key press, so listen for the first one.
  ["pointerdown", "touchend", "keydown"].forEach(function (name) {
    document.addEventListener(name, unlockAudio, { capture: true, passive: true });
  });

  function soundOn() { return lsGet(SOUND_KEY) !== "off"; }

  // [frequency Hz, start s, length s]
  var LEAD = [
    [523.25, 0.00, 0.11], [659.25, 0.11, 0.11], [783.99, 0.22, 0.11], [1046.5, 0.33, 0.24],
    [783.99, 0.60, 0.11], [1046.5, 0.71, 0.11], [1318.5, 0.82, 0.70]
  ];
  var HARMONY = [[783.99, 0.82, 0.70], [659.25, 0.82, 0.70]];
  var BASS = [[130.81, 0.00, 0.30], [196.0, 0.33, 0.24], [130.81, 0.60, 0.20], [130.81, 0.82, 0.70]];

  function note(freq, start, length, type, volume, t0) {
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    var a = t0 + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, a);
    gain.gain.setValueAtTime(0.0001, a);
    gain.gain.linearRampToValueAtTime(volume, a + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, a + length);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(a);
    osc.stop(a + length + 0.02);
  }

  /** Plays the fanfare if the browser allows it and the sound is on. Returns true when it started. */
  function fanfare() {
    if (!soundOn() || !audio || audio.state !== "running") return false;
    var t0 = audio.currentTime + 0.03;
    LEAD.forEach(function (n) { note(n[0], n[1], n[2], "square", 0.06, t0); });
    HARMONY.forEach(function (n) { note(n[0], n[1], n[2], "square", 0.025, t0); });
    BASS.forEach(function (n) { note(n[0], n[1], n[2], "triangle", 0.12, t0); });
    return true;
  }

  // ------------------------------------------------------------ confetti: 4px art pixels on a small canvas
  var SPRITES = {
    heart: [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
    gem: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
    chip: ["XX", "XX"],
    plus: [".X.", "XXX", ".X."]
  };
  var HEART_COLORS = ["#d4473b", "#a3201c", "#f4e6bf", "#f6d36b"];
  var GEM_COLORS = ["#86b6cc", "#3d6b8a", "#93b847", "#f6d36b"];
  var ALL_COLORS = ["#d4473b", "#f6d36b", "#dca12c", "#86b6cc", "#93b847", "#f4e6bf"];
  var spriteCache = {};

  function sprite(kind, color) {
    var key = kind + color;
    if (spriteCache[key]) return spriteCache[key];
    var rows = SPRITES[kind];
    var c = document.createElement("canvas");
    c.width = rows[0].length;
    c.height = rows.length;
    var g = c.getContext("2d");
    g.fillStyle = color;
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        if (rows[y].charAt(x) === "X") g.fillRect(x, y, 1, 1);
      }
    }
    spriteCache[key] = c;
    return c;
  }

  function confetti() {
    var SCALE = 4;                                   // one canvas pixel = one 4px art pixel
    var W = Math.ceil(window.innerWidth / SCALE);
    var H = Math.ceil(window.innerHeight / SCALE);
    var cv = document.createElement("canvas");
    cv.className = "hr-confetti";
    cv.setAttribute("aria-hidden", "true");
    cv.width = W;
    cv.height = H;
    document.body.appendChild(cv);
    var g = cv.getContext("2d");
    var parts = [];

    function spawn(x, y, vx, vy, gravity) {
      var r = Math.random();
      var kind = r < 0.35 ? "heart" : r < 0.55 ? "gem" : r < 0.9 ? "chip" : "plus";
      var colors = kind === "heart" ? HEART_COLORS : kind === "gem" ? GEM_COLORS : ALL_COLORS;
      parts.push({ x: x, y: y, vx: vx, vy: vy, g: gravity, img: sprite(kind, pick(colors)) });
    }

    // Two party cannons in the bottom corners.
    var cannonGravity = H * 1.5;
    [0, 1].forEach(function (side) {
      for (var i = 0; i < 36; i++) {
        var peak = H * (0.45 + 0.5 * Math.random());
        var dir = side ? -1 : 1;
        spawn(side ? W - 4 : 4, H, dir * W * (0.1 + 0.35 * Math.random()),
          -Math.sqrt(2 * cannonGravity * peak), cannonGravity);
      }
    });

    var STEP = 1 / 30;                               // retro frame rate
    var elapsed = 0, acc = 0, last = null, raf = 0;

    function finish() {
      if (raf) window.cancelAnimationFrame(raf);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }

    function tick(now) {
      if (last === null) last = now;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        acc -= STEP;
        elapsed += STEP;
        if (elapsed > 0.7 && elapsed < 2.3) {         // a gentle rain after the bang
          for (var k = 0; k < 2; k++) {
            spawn(Math.random() * W, -4, (Math.random() - 0.5) * 8, H * (0.12 + 0.12 * Math.random()), H * 0.25);
          }
        }
        for (var i = parts.length - 1; i >= 0; i--) {
          var p = parts[i];
          p.vy += p.g * STEP;
          p.x += p.vx * STEP;
          p.y += p.vy * STEP;
          if (p.y > H + 8) parts.splice(i, 1);
        }
      }
      g.clearRect(0, 0, W, H);
      for (var j = 0; j < parts.length; j++) {
        g.drawImage(parts[j].img, Math.round(parts[j].x), Math.round(parts[j].y));
      }
      if ((elapsed > 2.4 && parts.length === 0) || elapsed > 8) finish();
      else raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ the ceremony itself
  var busyUntil = 0;

  function flashSeals() {
    var stamps = document.querySelectorAll(".sv-seal__stamp");
    for (var i = 0; i < stamps.length; i++) {
      stamps[i].classList.remove("hr-flash");
      void stamps[i].offsetWidth;
      stamps[i].classList.add("hr-flash");
    }
    window.setTimeout(function () {
      for (var j = 0; j < stamps.length; j++) stamps[j].classList.remove("hr-flash");
    }, 2000);
  }

  function shakeScroll() {
    var s = $("scroll");
    if (!s) return;
    s.classList.remove("hr-shake");
    void s.offsetWidth;
    s.classList.add("hr-shake");
    window.setTimeout(function () { s.classList.remove("hr-shake"); }, 700);
  }

  function showBanner() {
    var b = $("hr-banner");
    if (!b) return;
    b.hidden = false;
    b.classList.remove("is-out");
    b.classList.add("is-in");
    window.setTimeout(function () {
      b.classList.remove("is-in");
      b.classList.add("is-out");
      window.setTimeout(function () { b.hidden = true; b.classList.remove("is-out"); }, 600);
    }, 2800);
  }

  var opener = null;      // what had focus before the pop-up opened

  function openArtifact() {
    var d = $("artifact");
    if (!d || d.open) return;
    opener = document.activeElement;
    try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    document.body.classList.add("hr-modal");
  }

  function play(at, opts) {
    var now = Date.now();
    if (now < busyUntil) return;
    var calm = reducedMotion();
    var lead = opts && opts.live ? 450 : 0;          // let the last seal land first
    busyUntil = now + lead + (calm ? 1500 : 3800);
    lsSet(SEEN_KEY, at);
    if (window.Heroes) window.Heroes.reset();        // the heroes wait at the two edges until the pop-up is closed

    window.setTimeout(function () {
      fanfare();
      showBanner();
      if (!calm) {
        flashSeals();
        shakeScroll();
        confetti();
      }
    }, lead);
    window.setTimeout(function () {
      openArtifact();
      // No pop-up support: do not keep the heroes waiting.
      if (!$("artifact").open && window.Heroes) window.Heroes.walk();
    }, lead + (calm ? 900 : 3200));
  }

  // ------------------------------------------------------------ driven by house-rules.js
  var playedFor = null;      // the "in force since" value already handled in this page visit
  var observer = null;
  var current = { inForce: false, at: null };

  function stopWaiting() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // A first visit after the seals were set: wait until the signing section is on screen.
  function playWhenVisible(at) {
    var target = $("sign-title");
    function go() { stopWaiting(); play(at, { live: false }); }
    if (!target || !("IntersectionObserver" in window)) { window.setTimeout(go, 2200); return; }
    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { go(); return; }
    }, { threshold: 0.6 });
    observer.observe(target);
  }

  /**
   * info.inForce: both seals are set; info.at: when the later one was set (ISO);
   * info.live: the second seal appeared just now, during this visit.
   */
  function update(info) {
    current = info;
    var reign = $("reign");
    if (!reign) return;
    if (!info.inForce || !info.at) {
      reign.hidden = true;
      playedFor = null;
      stopWaiting();
      return;
    }
    reign.hidden = false;
    renderCalendar(info.at);
    if (playedFor === info.at) return;
    playedFor = info.at;
    stopWaiting();
    if (info.live) play(info.at, { live: true });
    else if (lsGet(SEEN_KEY) !== info.at) playWhenVisible(info.at);
  }

  // ------------------------------------------------------------ buttons and dialog
  function syncSoundButton() {
    var b = $("sound-toggle");
    if (!b) return;
    var on = soundOn();
    b.textContent = on ? "Sound: on" : "Sound: off";
    b.setAttribute("aria-checked", on ? "true" : "false");
  }

  function init() {
    var dialog = $("artifact");
    if (dialog) {
      dialog.addEventListener("close", function () {
        document.body.classList.remove("hr-modal");
        if (window.Heroes) window.Heroes.walk();
        // The seal form that had focus is gone by now; hand focus to the artifact button instead of the top of the page.
        var usable = opener && opener !== document.body && document.body.contains(opener) && opener.offsetParent !== null;
        var back = usable ? opener : $("artifact-open");
        if (back && !$("reign").hidden) window.setTimeout(function () { back.focus({ preventScroll: true }); }, 0);
      });
      dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    }
    var open = $("artifact-open");
    if (open) open.addEventListener("click", openArtifact);
    var replay = $("ceremony-replay");
    if (replay) replay.addEventListener("click", function () {
      if (current.inForce && current.at) play(current.at, { live: false });
    });
    var sound = $("sound-toggle");
    if (sound) sound.addEventListener("click", function () {
      lsSet(SOUND_KEY, soundOn() ? "off" : "on");
      syncSoundButton();
      if (soundOn()) fanfare();                      // a tap is allowed to make a sound: show what it does
    });
    syncSoundButton();
  }
  init();

  window.Ceremony = { update: update, describe: describe, reignDays: reignDays, fanfare: fanfare, weeks: WEEKS };
})();
