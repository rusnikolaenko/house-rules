/* House Rules: every rule has its own little scene.
 *
 * Once both seals are set, tapping a rule opens a small pixel window where the knight and the princess act it
 * out (4 to 6 seconds, with an 8-bit sound when Sound is on), and then the window closes by itself.
 * The scenes are drawn on a 128x80 canvas, scaled up without smoothing. Every scene is a function of time,
 * draw(t), so a frame can be drawn for any moment (Scenes.frame(n, t) does that, handy for checking a scene).
 * The heroes come from heroes.js, the sound from ceremony.js. Preview without seals: ?scenes, or ?scene=4.
 */
(function () {
  "use strict";

  var W = 128, H = 80, FPS = 12, HOLD = 3;   // canvas size, frames per second, seconds to linger at the end

  // ------------------------------------------------------------ colours (the Svitok palette, plus a pink)
  var C = {
    k: "#22120a", K: "#2a1a0e",
    w: "#fff4dc", W: "#f4e6bf", c: "#e8d3a0", C: "#d4b67a", q: "#b48c52", Q: "#8a6436",
    r: "#d4473b", R: "#a3201c", D: "#64100f",
    p: "#f3a6b0", P: "#e0607a",
    y: "#f6d36b", Y: "#dca12c", o: "#95621a",
    b: "#86b6cc", B: "#3d6b8a", N: "#24435a",
    g: "#93b847", G: "#4c7a2c", h: "#2f4a22",
    s: "#d5dbdd", S: "#8d969b", T: "#59606a",
    n: "#a86d3b", m: "#74441f", M: "#42230e",
    f: "#e9b98a", z: "#1f1813", Z: "#2e241c", v: "#3b3152", V: "#2a2340", u: "#4f4470"
  };

  // ------------------------------------------------------------ a 3x5 pixel font for signs and stamps
  var FONT = {
    A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
    D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
    G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
    J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
    M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
    P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
    S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
    V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["##.", "..#", ".#.", "..#", "##."], "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
    "6": [".##", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "##."], "#": [".#.#.", "#####", ".#.#.", "#####", ".#.#."], "!": [".#.", ".#.", ".#.", "...", ".#."],
    "?": ["##.", "..#", ".#.", "...", ".#."], "+": ["...", ".#.", "###", ".#.", "..."], "-": ["...", "...", "###", "...", "..."],
    ":": ["...", ".#.", "...", ".#.", "..."], ".": ["...", "...", "...", "...", ".#."], "=": ["...", "###", "...", "###", "..."],
    "/": ["..#", "..#", ".#.", "#..", "#.."], "%": ["#.#", "..#", ".#.", "#..", "#.#"], "'": [".#.", ".#.", "...", "...", "..."],
    " ": ["...", "...", "...", "...", "..."]
  };

  // ------------------------------------------------------------ small pictures: rows of letters from C ("." is empty)
  var ART = {
    heart: [".kk.kk.", "kprkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."],
    heart5: ["rr.rr", "prrrr", "rrrrr", ".rrr.", "..r.."],
    heart3: ["r.r", "rrr", ".r."],
    pheart3: ["p.p", "ppp", ".p."],
    lips: [".RR.RR.", "RrrRrrR", ".RrrrR.", "..RRR.."],
    crown: ["y..y..y", "yy.y.yy", "yyyyyyy", "yryyyby", "YYYYYYY"],
    flower: [".p.p.", "ppypp", ".ppp.", "..G..", ".GG..", "..G..", "..GG.", "..G.."],
    check: ["......G", ".....GG", "G...GG.", "GG.GG..", ".GGG...", "..G...."],
    cross: ["R...R", ".R.R.", "..R..", ".R.R.", "R...R"],
    magnifier: [".kkkk....", "kwbbbk...", "kbbbbk...", "kbbbbk...", ".kkkkm...", ".....mm..", "......mm.", ".......mm"],
    steam: [".ww..", "wwww.", "wwwww", ".www."],
    bubble: [".bbb.", "b..wb", "b...b", "b...b", ".bbb."],
    duck: ["...yyy..", "..yyyky.", "..yyyyoo", "y.yyyy..", "yyyyyyy.", "yyyyyyy.", ".YYYYY.."],
    towel: ["wwwwwwww", "wwwwwwww", "bbbbbbbb", "wwwwwwww", "wwwwwwww", "w.w.w.w."],
    turban: ["...kkkkkk...", "..kwwwwwwkk.", ".kwwwcwwwwwk", ".kwwwwwwcwwk", ".kcwwwwwwwck", "..kkkkkkkkk."],
    tunic: ["GG....GG", "GGGGGGGG", ".GGGGGG.", ".GyyyyG.", ".GGGGGG.", ".GGGGGG.", ".hGGGGh."],
    dress: [".R....R.", ".RRRRRR.", "..RyyR..", "..RRRR..", ".RRRRRR.", ".RRRRRR.", "RRRRRRRR", "DRRRRRRD"],
    sock: ["ww..", "BB..", "BB..", "BB..", "BBBB", "BBBB"],
    moon: ["..wwww", ".www..", "www...", "www...", "www...", ".www..", "..wwww"],
    note: ["..kkk", "..k.k", "..k..", "..k..", "kkk..", "kkk.."],
    padlock: [".sss.", "s...s", "s...s", "YYYYY", "YYkYY", "YYkYY", "YYYYY"],
    cat1: [".k.k........", "kSkSk.......", "kSSSk.....k.", "kySyk....kSk", "kSSSkkkkkkSk", ".kSSSSSSSSk.", ".kSSSSSSSSk.", ".kSk.kk.kSk.", ".kk..kk..kk."],
    cat2: [".k.k........", "kSkSk.......", "kSSSk.....k.", "kySyk....kSk", "kSSSkkkkkkSk", ".kSSSSSSSSk.", ".kSSSSSSSSk.", "..kSkk..kSk.", "..kk.k...kk."],
    star: ["..y..", ".yyy.", "yyyyy", ".yyy.", "..y.."],
    tick: ["...G", "G.G.", ".G.."],
    spark: [".y.", "yyy", ".y."]
  };

  // ------------------------------------------------------------ pictures to canvases (once), plain and mirrored
  var cache = {};
  function canvasOf(w, h) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    return cv;
  }
  function paint(rows, pal, flip) {
    var w = rows[0].length, h = rows.length, cv = canvasOf(w, h), x2 = cv.getContext("2d");
    rows.forEach(function (row, y) {
      for (var x = 0; x < w; x++) {
        var ch = row.charAt(x);
        if (ch === "." || !pal[ch]) continue;
        x2.fillStyle = pal[ch];
        x2.fillRect(flip ? w - 1 - x : x, y, 1, 1);
      }
    });
    return cv;
  }
  function art(name, flip) {
    var key = name + (flip ? "|f" : "");
    if (!cache[key]) cache[key] = paint(ART[name], C, flip);
    return cache[key];
  }
  function heroArt(who, frame, flip) {
    var key = "hero|" + who + "|" + frame + (flip ? "|f" : "");
    if (!cache[key]) {
      var sp = window.Heroes && window.Heroes.sprites && window.Heroes.sprites[who];
      cache[key] = sp ? paint(sp.frames[frame] || sp.frames[0], sp.palette, flip) : canvasOf(16, 18);
    }
    return cache[key];
  }

  // ------------------------------------------------------------ drawing helpers (g is the scene canvas)
  var g = null;
  function R0(v) { return Math.round(v); }
  function rect(x, y, w, h, col) { g.fillStyle = C[col] || col; g.fillRect(R0(x), R0(y), R0(w), R0(h)); }
  function px(x, y, col) { rect(x, y, 1, 1, col); }
  function put(name, x, y, flip, scale) {
    var a = art(name, flip), s = scale || 1;
    g.drawImage(a, R0(x), R0(y), a.width * s, a.height * s);
  }
  function putC(name, cx, cy, flip, scale) {   // centred on (cx, cy)
    var a = art(name), s = scale || 1;
    put(name, cx - Math.floor(a.width * s / 2), cy - Math.floor(a.height * s / 2), flip, s);
  }
  function alpha(a, fn) { var old = g.globalAlpha; g.globalAlpha = old * Math.max(0, Math.min(1, a)); fn(); g.globalAlpha = old; }

  /** A hero, 16x18. o.frame (0 standing, 1/2 steps), o.flip, o.sleep (eyes shut), o.rows (draw only the top rows). */
  function hero(who, x, y, o) {
    o = o || {};
    var a = heroArt(who, o.frame || 0, o.flip), rows = o.rows || 18;
    var cols = o.rows && who === "him" ? 13 : 16;   // in bed the knight leaves his sword out of it
    g.drawImage(a, o.flip ? 16 - cols : 0, 0, cols, rows, R0(x) + (o.flip ? 16 - cols : 0), R0(y), cols, rows);
    if (o.sleep) {                                 // eyes shut: the upper half of each eye becomes skin
      var ey = who === "him" ? 7 : 6, cols = who === "him" ? [6, 9] : [5, 8];
      cols.forEach(function (cx) { px(x + (o.flip ? 15 - cx : cx), y + ey, "f"); });
    }
  }
  function walkFrame(t) { return 1 + (Math.floor(t * 6) % 2); }

  function text(s, x, y, col, scale) {
    s = String(s).toUpperCase();
    var k = scale || 1, at = 0;
    g.fillStyle = C[col] || col;
    for (var i = 0; i < s.length; i++) {
      var gl = FONT[s.charAt(i)] || FONT[" "], gw = gl[0].length;
      for (var r = 0; r < 5; r++) for (var c = 0; c < gw; c++) {
        if (gl[r].charAt(c) === "#") g.fillRect(R0(x) + (at + c) * k, R0(y) + r * k, k, k);
      }
      at += gw + 1;
    }
  }
  function textW(s, scale) {
    s = String(s).toUpperCase();
    var w = -1;
    for (var i = 0; i < s.length; i++) w += (FONT[s.charAt(i)] || FONT[" "])[0].length + 1;
    return Math.max(0, w) * (scale || 1);
  }
  function textC(s, cx, y, col, scale) { text(s, cx - Math.floor(textW(s, scale) / 2), y, col, scale); }

  function line(x0, y0, x1, y1, col) {
    x0 = R0(x0); y0 = R0(y0); x1 = R0(x1); y1 = R0(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 400; n++) {
      px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function ring(cx, cy, r, col, dash) {        // a pixel circle; dash = draw every other pair of dots
    var x = r, y = 0, err = 1 - r, i = 0;
    while (x >= y) {
      if (!dash || (i >> 1) % 2 === 0) {
        [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) { px(cx + p[0], cy + p[1], col); });
      }
      i++; y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  function disc(cx, cy, r, col) {
    for (var yy = -r; yy <= r; yy++) {
      var half = Math.floor(Math.sqrt(r * r - yy * yy) + 0.3);
      rect(cx - half, cy + yy, half * 2 + 1, 1, col);
    }
  }
  function box(x, y, w, h, fill, edge) {        // a filled box with a 1px outline
    rect(x, y, w, h, edge || "k");
    rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  // ------------------------------------------------------------ time helpers
  function P(t, a, b) { return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a); }   // 0..1 between a and b
  function E(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; } // ease in and out
  function L(a, b, p) { return a + (b - a) * p; }
  function on(t, a, b) { return t >= a && (b === undefined || t < b); }
  function rnd(i) { var v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  function blink(t, hz) { return Math.floor(t * (hz || 4)) % 2 === 0; }

  // ------------------------------------------------------------ effects
  /** Things rising and swaying: n of them from (x, y), one every gap seconds after t0, each living life seconds. */
  function rise(t, t0, x, y, n, o) {
    o = o || {};
    var gap = o.gap || 0.18, life = o.life || 1.4, speed = o.speed || 18, spread = o.spread || 14, name = o.art || "heart5";
    for (var i = 0; i < n; i++) {
      var age = t - t0 - i * gap;
      if (age < 0 || age > life) continue;
      var sx = x + (rnd(i + 3) - 0.5) * spread + Math.sin(age * 5 + i) * 2;
      var sy = y - age * speed;
      var name2 = Array.isArray(name) ? name[i % name.length] : name;
      alpha(age > life - 0.3 ? (life - age) / 0.3 : 1, function () { putC(name2, sx, sy); });
    }
  }
  /** A burst outwards from (x, y) at t0. */
  function burst(t, t0, x, y, n, o) {
    o = o || {};
    var age = t - t0, life = o.life || 0.9, name = o.art || "spark";
    if (age < 0 || age > life) return;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + rnd(i) * 0.5, dist = (o.dist || 20) * E(Math.min(1, age / life)) + 2;
      var name2 = Array.isArray(name) ? name[i % name.length] : name;
      alpha(age > life - 0.25 ? (life - age) / 0.25 : 1, function () {
        putC(name2, x + Math.cos(ang) * dist, y + Math.sin(ang) * dist * 0.8 - age * (o.lift || 0));
      });
    }
  }
  /** A rubber stamp: slams in at t0 (twice the size for a moment), then stays. */
  function stamp(t, t0, word, cx, cy, col) {
    if (t < t0) return;
    var k = t - t0 < 0.1 ? 2 : 1, w = textW(word, k) + 6 * k, h = 5 * k + 6 * k;
    var x = R0(cx - w / 2), y = R0(cy - h / 2), c = col || "R";
    alpha(0.95, function () {
      rect(x, y, w, h, c);
      rect(x + k, y + k, w - 2 * k, h - 2 * k, "W");
      text(word, x + 3 * k, y + 3 * k, c, k);
    });
  }
  /** A speech bubble with a little tail pointing down at (tx, bottom). */
  function bubble(x, y, w, h, tx) {
    box(x, y, w, h, "w");
    rect(tx - 1, y + h - 1, 3, 1, "w");
    rect(tx - 1, y + h, 3, 1, "k"); rect(tx - 2, y + h - 1, 1, 1, "k"); rect(tx + 2, y + h - 1, 1, 1, "k");
    px(tx, y + h, "w"); px(tx, y + h + 1, "k");
  }
  /** A parchment sign with words on it. */
  function sign(word, cx, y, col, fill) {
    var w = textW(word) + 8;
    box(cx - Math.floor(w / 2), y, w, 11, fill || "W");
    rect(cx - Math.floor(w / 2) + 1, y + 9, w - 2, 1, "C");
    textC(word, cx, y + 3, col || "K");
  }

  // ------------------------------------------------------------ backgrounds and furniture
  function room(o) {
    o = o || {};
    var wall = o.wall || "c", dot = o.dot || "C", floor = o.floor || "n", seam = o.seam || "m", top = o.top || 60;
    rect(0, 0, W, top, wall);
    for (var yy = 4; yy < top - 4; yy += 8) for (var xx = (yy / 8) % 2 ? 4 : 0; xx < W; xx += 8) px(xx + 2, yy, dot);
    rect(0, top - 2, W, 2, o.board || "m");
    rect(0, top, W, H - top, floor);
    for (var y2 = top + 4; y2 < H; y2 += 5) rect(0, y2, W, 1, seam);
    for (var i = 0; i < 6; i++) rect(((i * 37) % W), top + 1 + (i % 4) * 5, 1, 4, seam);
  }
  function outdoors(o) {
    o = o || {};
    var bands = o.sky || ["b", "#9cc6d6", "#b5d6df"];
    rect(0, 0, W, 22, bands[0]); rect(0, 22, W, 16, bands[1]); rect(0, 38, W, 24, bands[2]);
    for (var x = 0; x < W; x += 2) {                           // far hills
      var hh = 6 + Math.round(Math.sin(x * 0.07) * 3 + Math.sin(x * 0.19) * 2);
      rect(x, 56 - hh, 2, hh + 6, o.hill || "#7aa35b");
    }
    rect(0, 60, W, H - 60, o.grass || "g");
    for (var i = 0; i < 26; i++) px((i * 29) % W, 62 + (i * 7) % 16, o.tuft || "G");
  }
  function sun(cx, cy, r) {
    disc(cx, cy, r, "y");
    disc(cx - 1, cy - 1, Math.max(1, r - 3), "#fbe7a1");
  }
  function windowFrame(x, y, w, h, sky, inside) {
    box(x - 2, y - 2, w + 4, h + 4, "n", "k");
    rect(x, y, w, h, sky);
    if (inside) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); inside(); g.restore(); }
    rect(x + Math.floor(w / 2), y, 1, h, "m");
    rect(x, y + Math.floor(h / 2), w, 1, "m");
    rect(x - 3, y + h + 2, w + 6, 2, "m");
  }
  /** A bed seen from its foot: headboard, two pillows, a blanket. heads() draws whatever lies on the pillows. */
  function bed(x, y, w, heads, blanket) {
    rect(x - 2, y - 4, 4, 34, "M"); rect(x + w - 2, y - 4, 4, 34, "M");      // posts
    box(x, y, w, 18, "n", "k");                                              // headboard
    rect(x + 2, y + 2, w - 4, 1, "m");
    box(x + 5, y + 10, Math.floor(w / 2) - 7, 7, "w", "C");                    // pillows
    box(x + Math.floor(w / 2) + 2, y + 10, Math.floor(w / 2) - 7, 7, "w", "C");
    if (heads) heads();
    var by = y + 17;
    box(x - 1, by, w + 2, 13, blanket || "R", "k");                           // blanket
    rect(x, by + 1, w, 2, "r");
    for (var i = 6; i < w - 4; i += 10) putC("heart3", x + i, by + 7);
    rect(x - 2, by + 13, 3, 4, "M"); rect(x + w - 1, by + 13, 3, 4, "M");     // feet of the bed
  }
  function door(x, y, w, h, open) {               // open 0..1
    box(x - 3, y - 3, w + 6, h + 3, "M", "k");
    if (open > 0) {
      rect(x, y, w, h, "z");
      var dw = Math.max(2, Math.round(w * (1 - open * 0.8)));
      box(x, y, dw, h, "n", "k");
      return;
    }
    box(x, y, w, h, "n", "k");
    box(x + 3, y + 4, w - 6, Math.floor(h / 2) - 6, "m", "M");
    box(x + 3, y + Math.floor(h / 2) + 2, w - 6, Math.floor(h / 2) - 6, "m", "M");
    rect(x + w - 6, y + Math.floor(h / 2) - 1, 3, 3, "Y");                    // knob
    rect(x + w - 5, y + Math.floor(h / 2) + 3, 1, 3, "k");                    // keyhole
  }
  function clockFace(cx, cy, r, minutes, hours) {
    disc(cx, cy, r + 1, "k"); disc(cx, cy, r, "W");
    for (var i = 0; i < 12; i += 3) {
      var a = i / 12 * Math.PI * 2;
      px(cx + Math.round(Math.sin(a) * (r - 1)), cy - Math.round(Math.cos(a) * (r - 1)), "q");
    }
    var am = minutes / 60 * Math.PI * 2, ah = hours / 12 * Math.PI * 2;
    line(cx, cy, cx + Math.sin(am) * (r - 1), cy - Math.cos(am) * (r - 1), "K");
    line(cx, cy, cx + Math.sin(ah) * (r - 3), cy - Math.cos(ah) * (r - 3), "R");
  }
  function gavel(x, y, down) {                    // x, y = the hand
    if (down) {
      rect(x - 8, y, 9, 2, "m");                   // handle swung flat to the left, head struck down at its end
      box(x - 11, y - 3, 4, 8, "n", "k");
      putC("spark", x - 9, y + 7);
    } else {
      rect(x, y - 7, 2, 8, "m");                   // handle up, head on top
      box(x - 3, y - 11, 8, 4, "n", "k");
    }
  }

  // ------------------------------------------------------------ sound: tiny synth on top of ceremony.js's audio
  var noiseBuf = null;
  function audioOut() { return window.Ceremony && window.Ceremony.audioOut ? window.Ceremony.audioOut() : null; }
  function tone(a, type, f0, f1, at, len, vol) {
    var t0 = a.currentTime + 0.02 + at, o = a.createOscillator(), gn = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + len);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(gn); gn.connect(a.destination);
    o.start(t0); o.stop(t0 + len + 0.03);
  }
  function hush(a, at, len, vol, kind, f0, f1) {
    if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = a.currentTime + 0.02 + at, src = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = kind || "lowpass";
    f.frequency.setValueAtTime(f0 || 1000, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + len);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, len / 3));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(f); f.connect(gn); gn.connect(a.destination);
    src.start(t0); src.stop(t0 + len + 0.03);
  }
  function notes(a, list, type, len, vol, gap) {
    list.forEach(function (fq, i) { tone(a, type || "square", fq, 0, i * (gap || 0.07), len || 0.12, vol || 0.035); });
  }
  var SFX = {
    step: function (a) { hush(a, 0, 0.05, 0.05, "lowpass", 600); },
    smack: function (a) { hush(a, 0, 0.05, 0.08, "highpass", 1800); tone(a, "sine", 650, 1500, 0, 0.08, 0.09); },
    ding: function (a) { tone(a, "square", 1318.5, 0, 0, 0.2, 0.04); tone(a, "square", 1975.5, 0, 0, 0.16, 0.014); },
    dong: function (a) { tone(a, "square", 1568, 0, 0, 0.22, 0.04); tone(a, "square", 2349, 0, 0, 0.16, 0.014); },
    buzz: function (a) { tone(a, "square", 98, 92, 0, 0.34, 0.05); tone(a, "square", 104, 96, 0, 0.34, 0.03); },
    thud: function (a) { tone(a, "triangle", 170, 45, 0, 0.24, 0.3); hush(a, 0, 0.09, 0.12, "lowpass", 500); },
    pop: function (a) { tone(a, "sine", 480, 1400, 0, 0.07, 0.11); },
    chime: function (a) { notes(a, [1046.5, 1318.5, 1568, 2093], "square", 0.18, 0.035, 0.07); },
    sparkle: function (a) { notes(a, [2093, 2637, 3136, 4186], "square", 0.08, 0.018, 0.045); },
    rise: function (a) { notes(a, [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5], "square", 0.12, 0.03, 0.17); },
    fanfare: function (a) {
      notes(a, [523.25, 659.25, 783.99, 1046.5], "square", 0.14, 0.04, 0.1);
      tone(a, "square", 1318.5, 0, 0.42, 0.5, 0.04); tone(a, "square", 783.99, 0, 0.42, 0.5, 0.02);
      tone(a, "triangle", 130.81, 0, 0, 0.3, 0.12); tone(a, "triangle", 130.81, 0, 0.42, 0.5, 0.12);
    },
    whoosh: function (a) { hush(a, 0, 0.3, 0.07, "bandpass", 350, 2600); },
    swish: function (a) { hush(a, 0, 0.35, 0.06, "bandpass", 2600, 700); },
    tick: function (a) { tone(a, "square", 2600, 0, 0, 0.018, 0.03); },
    beep: function (a) { tone(a, "square", 988, 0, 0, 0.08, 0.035); },
    ring: function (a) { for (var i = 0; i < 12; i++) tone(a, "square", i % 2 ? 1568 : 1318.5, 0, i * 0.045, 0.04, 0.03); },
    squeak: function (a) { tone(a, "sine", 1200, 2100, 0, 0.08, 0.07); tone(a, "sine", 2100, 1300, 0.08, 0.1, 0.06); },
    thunder: function (a) { hush(a, 0, 0.8, 0.22, "lowpass", 260, 80); },
    rumble: function (a) { hush(a, 0, 0.9, 0.2, "lowpass", 180, 60); tone(a, "triangle", 60, 40, 0, 0.6, 0.12); },
    hiss: function (a) { hush(a, 0, 1.4, 0.035, "highpass", 2400); },
    shower: function (a) { hush(a, 0, 3.6, 0.03, "bandpass", 3200); },
    giggle: function (a) { notes(a, [1568, 1760, 1568, 1760, 1976], "square", 0.05, 0.025, 0.06); },
    grumble: function (a) { tone(a, "sawtooth", 150, 110, 0, 0.16, 0.035); tone(a, "sawtooth", 140, 100, 0.18, 0.16, 0.035); },
    creak: function (a) { tone(a, "sawtooth", 210, 360, 0, 0.4, 0.02); },
    click: function (a) { tone(a, "square", 3000, 0, 0, 0.012, 0.04); tone(a, "square", 1300, 0, 0.03, 0.03, 0.04); },
    chalk: function (a) { hush(a, 0, 0.06, 0.03, "highpass", 3500); },
    snore: function (a) { tone(a, "sawtooth", 82, 66, 0, 0.55, 0.025); },
    nope: function (a) { tone(a, "square", 392, 0, 0, 0.1, 0.035); tone(a, "square", 311.1, 0, 0.12, 0.16, 0.035); },
    yes: function (a) { tone(a, "square", 659.25, 0, 0, 0.09, 0.035); tone(a, "square", 987.8, 0, 0.1, 0.16, 0.035); },
    purr: function (a) { for (var i = 0; i < 8; i++) tone(a, "triangle", 64, 58, i * 0.09, 0.07, 0.09); },
    heartbeat: function (a) { tone(a, "sine", 80, 45, 0, 0.1, 0.25); tone(a, "sine", 80, 45, 0.15, 0.1, 0.18); },
    gavel: function (a) { tone(a, "triangle", 420, 160, 0, 0.1, 0.25); hush(a, 0, 0.05, 0.12, "bandpass", 1600); },
    meow: function (a) { tone(a, "sawtooth", 600, 900, 0, 0.12, 0.018); tone(a, "sawtooth", 900, 500, 0.12, 0.2, 0.018); },
    blip: function (a) { tone(a, "square", 1760, 0, 0, 0.04, 0.025); },
    whistle: function (a) { notes(a, [1568, 1318.5, 1568, 1760, 1568], "sine", 0.16, 0.05, 0.22); }
  };
  function sfx(name) {
    var a = audioOut();
    if (!a || !SFX[name]) return;
    try { SFX[name](a); } catch (e) { /* no sound on this device */ }
  }

  // ------------------------------------------------------------ the scenes
  // Each scene: dur (seconds), sfx: [[time, sound], ...], shake: [times the picture jolts], draw(t).
  var SCENES = {};

  function lean(t, times, len) {               // 1 while a kiss is happening, else 0
    for (var i = 0; i < times.length; i++) if (t >= times[i] && t < times[i] + (len || 0.13)) return 1;
    return 0;
  }
  function zzz(t, x, y) {
    for (var i = 0; i < 3; i++) {
      var age = (t + i * 0.5) % 1.5;
      alpha(1 - age / 1.5, function () { text("Z", x + age * 6 + i, y - age * 12, "W"); });
    }
  }

  // #1 Your happiness is the top priority: first place on the podium, a flower, the happiness meter goes to MAX.
  SCENES[1] = {
    dur: 5.2,
    sfx: [[0.1, "step"], [0.45, "step"], [0.8, "step"], [1.15, "step"], [1.5, "whoosh"], [2.0, "rise"], [3.5, "fanfare"], [3.7, "sparkle"]],
    draw: function (t) {
      outdoors();
      sun(14, 12, 6);
      box(37, 58, 19, 10, "q", "k"); textC("2", 46, 61, "Q");          // nobody is anywhere near first place
      box(74, 61, 19, 7, "q", "k"); textC("3", 83, 62, "Q");
      box(55, 50, 20, 18, "y", "k"); rect(56, 51, 18, 1, "#fbe7a1"); textC("1", 65, 55, "o", 2);
      var happy = t > 3.5 && blink(t, 4) ? -1 : 0;
      hero("her", 57, 34 + happy);
      var kx = L(-18, 22, E(P(t, 0, 1.3))), hop = t > 3.6 && blink(t, 5) ? -2 : 0;
      hero("him", kx, 48 + hop, { frame: t < 1.3 ? walkFrame(t) : 0 });
      var fp = P(t, 1.5, 2.0);
      if (fp <= 0) put("flower", kx + 1, 52);
      else put("flower", L(kx + 1, 70, fp), L(52, 41, fp) - Math.sin(fp * Math.PI) * 14 + (fp >= 1 ? happy : 0));
      var full = E(P(t, 2.0, 3.45));
      textC("HAPPINESS", 64, 2, "K");
      box(33, 9, 62, 8, "W", "k");
      rect(34, 10, Math.round(60 * full), 6, full >= 1 && blink(t, 6) ? "r" : "R");
      if (full >= 1) textC("MAX", 64, 10, "w");
      burst(t, 3.5, 65, 40, 10, { art: ["heart5", "star"], dist: 26 });
      rise(t, 3.7, 65, 40, 8, { gap: 0.2, life: 1.2, speed: 14 });
    }
  };

  // #2 You're always right, even when you're wrong: 2+2=5, a puzzled knight, "see rule #2", a tick, a crown.
  SCENES[2] = {
    dur: 5.2,
    sfx: [[0.3, "chalk"], [0.5, "chalk"], [0.7, "chalk"], [0.9, "chalk"], [1.1, "chalk"], [1.5, "buzz"], [2.3, "swish"],
      [3.1, "ding"], [3.25, "dong"], [3.6, "whoosh"], [3.9, "sparkle"], [4.3, "yes"]],
    draw: function (t) {
      room();
      box(30, 5, 68, 31, "#2f4a32", "M");
      rect(31, 6, 66, 1, "#41643f");
      rect(28, 36, 72, 2, "m");
      var shown = Math.max(0, Math.min(5, Math.floor((t - 0.3) / 0.2) + 1));
      if (t >= 0.3) text("2+2=5".slice(0, shown), 41, 13, "w", 2);
      if (t >= 3.1) put("check", 82, 11, false, 2);
      var nod = on(t, 3.9, 4.6) && blink(t, 6) ? 1 : 0;
      hero("him", 16, 48 + nod);
      hero("her", 86, 48 + (on(t, 0.3, 1.3) && blink(t, 8) ? -1 : 0));
      if (t >= 3.6) put("crown", 90, Math.round(L(-8, 44, E(P(t, 3.6, 3.9)))));
      burst(t, 3.9, 93, 46, 8, { art: "spark", dist: 12 });
      if (on(t, 1.5, 2.3)) { bubble(18, 33, 11, 11, 24); textC("?", 24, 36, "R"); }
      if (t >= 2.3) {
        var wv = Math.round(54 * E(P(t, 2.3, 2.6)));
        g.save(); g.beginPath(); g.rect(64 - wv / 2, 0, wv, H); g.clip();
        sign("SEE RULE #2", 64, 39, "R");
        g.restore();
      }
    }
  };

  // #3 Post-sauna inspections in person: steam, a magnifying glass, a checklist, APPROVED, then hands-on.
  SCENES[3] = {
    dur: 5.4,
    sfx: [[0.05, "hiss"], [0.4, "step"], [0.75, "step"], [1.1, "step"], [1.45, "step"], [1.9, "tick"], [2.3, "tick"], [2.7, "tick"],
      [2.95, "thud"], [3.35, "step"], [3.6, "step"], [3.8, "chime"], [4.2, "giggle"]],
    draw: function (t) {
      rect(0, 0, W, 60, "n");
      for (var x = 0; x < W; x += 8) rect(x, 0, 1, 60, "m");
      rect(0, 60, W, 20, "m");
      for (var y = 64; y < H; y += 5) rect(0, y, W, 1, "M");
      box(60, 40, 66, 5, "q", "M"); rect(66, 45, 3, 15, "M"); rect(118, 45, 3, 15, "M");
      box(4, 40, 20, 22, "T", "k"); rect(6, 44, 16, 3, blink(t, 3) ? "R" : "r");
      disc(9, 38, 3, "S"); disc(16, 37, 3, "T"); disc(21, 38, 2, "S");
      sign("SAUNA", 104, 6, "M", "c");
      alpha(0.75, function () { rise(t, 0, 14, 32, 16, { art: t < 3.8 ? "steam" : "heart5", gap: 0.32, life: 2.4, speed: 11, spread: 12 }); });
      var kx = t < 3.3 ? L(-18, 50, E(P(t, 0.3, 1.5))) : L(50, 77, E(P(t, 3.3, 3.75)));
      var walking = on(t, 0.3, 1.5) || on(t, 3.3, 3.75);
      hero("her", 88, 48);
      put("turban", 89, 47);
      hero("him", kx, 48, { frame: walking ? walkFrame(t) : 0 });
      if (on(t, 1.6, 3.0)) {
        var p = P(t, 1.6, 2.9), tri = p < 0.5 ? p * 2 : 2 - p * 2;
        put("magnifier", 86 + Math.round(Math.sin(p * Math.PI * 4) * 3), 44 + Math.round(tri * 13));
      } else if (t < 3.3) put("magnifier", kx + 11, 52);
      if (on(t, 1.7, 3.3)) {
        bubble(kx - 2, 22, 22, 22, kx + 8);
        for (var i = 0; i < 3; i++) {
          box(kx + 1, 25 + i * 6, 5, 5, "W", "K");
          rect(kx + 8, 27 + i * 6, 10, 1, "q");
          if (t >= 1.9 + i * 0.4) put("tick", kx + 1, 26 + i * 6);
        }
      }
      stamp(t, 2.95, "APPROVED", 64, 15, "G");
      rise(t, 3.8, 88, 44, 10, { gap: 0.18 });
    }
  };

  // #4 Kissing is mandatory, preferably excessive: a kiss counter that speeds up until it runs out of digits.
  var KISSES = [0.6, 1.3, 1.85, 2.3, 2.65, 2.95, 3.2, 3.4, 3.56, 3.7, 3.82, 3.93];
  SCENES[4] = {
    dur: 5.2,
    sfx: KISSES.map(function (k) { return [k, "smack"]; }).concat([[4.0, "sparkle"], [4.35, "chime"]]),
    draw: function (t) {
      outdoors({ sky: ["#e8a07a", "#f0b98a", "#f6d3a0"], hill: "#a77a5c", grass: "#8fae55" });
      sun(106, 30, 7);
      var n = 0;
      KISSES.forEach(function (k) { if (t >= k) n++; });
      if (t >= 3.95) n = Math.min(99, 12 + Math.floor((t - 3.95) * 70));
      textC("KISSES", 64, 3, "M");
      textC(n >= 99 ? "99+" : String(n), 64, 10, "R", 2);
      var l = lean(t, KISSES, 0.12) || (on(t, 3.95, 4.3) && blink(t, 12) ? 1 : 0);
      hero("him", 50 + l, 48);
      hero("her", 61 - l, 48);
      KISSES.forEach(function (k, i) {
        var age = t - k;
        if (age < 0 || age > 1.1) return;
        alpha(age > 0.8 ? (1.1 - age) / 0.3 : 1, function () {
          putC(i % 3 === 2 ? "heart5" : "lips", 62 + Math.sin(age * 6 + i) * 3 + (i % 2 ? 7 : -7) * age, 44 - age * 22);
        });
      });
      rise(t, 3.95, 62, 44, 16, { gap: 0.07, art: ["lips", "heart5", "heart3"], spread: 44, speed: 24 });
      if (t >= 4.35) sign("PREFERABLY EXCESSIVE", 64, 25, "R");
    }
  };

  // #5 Clothes are optional when circumstances permit: it warms up, they step behind a screen, the clothes fly out.
  SCENES[5] = {
    dur: 5.4,
    sfx: [[0.2, "rise"], [0.4, "step"], [0.75, "step"], [1.1, "step"], [1.45, "step"], [1.8, "yes"], [2.1, "whoosh"], [2.55, "whoosh"],
      [3.0, "whoosh"], [3.4, "whoosh"], [3.9, "giggle"], [4.4, "thud"]],
    draw: function (t) {
      room({ wall: "W", dot: "c" });
      var heat = E(P(t, 0.2, 1.8));
      box(7, 14, 7, 36, "w", "k");
      for (var m = 0; m < 5; m++) rect(14, 18 + m * 6, 2, 1, "k");
      disc(10, 51, 4, "k"); disc(10, 51, 3, "R");
      rect(9, Math.round(47 - heat * 30), 3, Math.round(heat * 30) + 2, "R");
      text("CIRCUMSTANCES:", 20, 3, "K");
      if (t >= 1.8) text("PERMIT", 80, 3, t > 2.6 || blink(t, 4) ? "G" : "W");
      var lineY = function (x) { return 13 + Math.round(Math.sin((x - 22) / 104 * Math.PI) * 4); };
      for (var x = 22; x <= 126; x++) px(x, lineY(x), "T");
      rect(20, 11, 3, 3, "T"); rect(125, 11, 3, 3, "T");
      hero("him", L(-18, 70, E(P(t, 0.3, 1.6))), 48, { frame: on(t, 0.3, 1.6) ? walkFrame(t) : 0 });
      hero("her", L(-36, 82, E(P(t, 0.4, 1.8))), 48, { frame: on(t, 0.4, 1.8) ? walkFrame(t + 0.1) : 0 });
      var wob = t >= 3.9 && blink(t, 5) ? 1 : 0;
      for (var i = 0; i < 3; i++) {
        var x0 = 60 + i * 16 + (i === 1 ? wob : 0);
        box(x0, 24, 17, 42, "R", "M");
        rect(x0 + 2, 26, 13, 38, "r");
        putC("heart3", x0 + 8, 34); putC("heart3", x0 + 8, 46); putC("heart3", x0 + 8, 58);
        rect(x0 + 1, 66, 2, 2, "M"); rect(x0 + 14, 66, 2, 2, "M");
      }
      [["tunic", 2.1, 30], ["dress", 2.55, 44], ["sock", 3.0, 104], ["sock", 3.4, 114]].forEach(function (c, i) {
        var p = P(t, c[1], c[1] + 0.5);
        if (p <= 0) return;
        var ty = lineY(c[2]), sway = p >= 1 ? Math.round(Math.sin(t * 4 + i)) : 0;
        put(c[0], L(84, c[2], p) - 4 + sway, L(26, ty, p) - Math.sin(p * Math.PI) * 18, i === 3);
      });
      rise(t, 3.9, 84, 24, 10, { gap: 0.15, speed: 14, spread: 30 });
      stamp(t, 4.4, "OPTIONAL", 40, 38, "R");
    }
  };

  // #6 Any argument is resolved by kissing, and escalation is encouraged: a storm, a kiss, a rain of hearts.
  var MAKEUP = [2.6, 3.3, 3.8, 4.2];
  SCENES[6] = {
    dur: 5.6,
    sfx: [[0.2, "grumble"], [0.5, "thunder"], [0.85, "grumble"], [1.25, "thunder"], [1.75, "step"], [2.05, "step"], [2.35, "step"],
      [2.6, "smack"], [2.75, "chime"], [3.2, "rise"], [3.3, "smack"], [3.8, "smack"], [4.2, "smack"], [4.6, "yes"]],
    shake: [0.5, 1.25],
    draw: function (t) {
      var calm = t >= 2.6;
      outdoors(calm ? { sky: ["#f3a6b0", "#f6bfc4", "#f8d6d6"], hill: "#c98f9a" }
        : { sky: ["#6f777d", "#858c91", "#9aa0a4"], hill: "#5d6b55", grass: "#6f8d45" });
      var cc = calm ? "p" : "T";
      disc(52, 12, 7, cc); disc(64, 9, 9, cc); disc(77, 12, 7, cc); rect(46, 12, 38, 7, cc);
      disc(61, 6, 4, calm ? "w" : "S");
      if (!calm && (on(t, 0.5, 0.67) || on(t, 1.25, 1.42))) {
        var lx = t < 1 ? 56 : 72;
        line(lx, 19, lx - 4, 28, "y"); line(lx - 4, 28, lx + 2, 30, "y"); line(lx + 2, 30, lx - 3, 44, "y");
        alpha(0.25, function () { rect(0, 0, W, H, "w"); });
      }
      if (calm) for (var i = 0; i < 14; i++) {
        var age = t - 2.7 - i * 0.12;
        if (age >= 0) putC("heart3", 46 + Math.round(rnd(i) * 36), 19 + ((age * 26) % 32));
      }
      var angry = !calm && t < 1.7 && blink(t, 8) ? 1 : 0, p = E(P(t, 1.7, 2.55)), walking = on(t, 1.7, 2.55);
      var l = lean(t, MAKEUP, 0.14);
      hero("him", L(24, 50, p) + angry + l, 48, { frame: walking ? walkFrame(t) : 0 });
      hero("her", L(88, 61, p) - angry - l, 48, { frame: walking ? walkFrame(t + 0.1) : 0 });
      if (on(t, 0.2, 0.9)) { bubble(18, 33, 17, 11, 30); text("#!?", 21, 36, "R"); }
      if (on(t, 0.85, 1.6)) { bubble(88, 33, 15, 11, 96); textC("!!!", 95, 36, "R"); }
      if (calm) rise(t, 2.6, 62, 44, 14, { gap: 0.14, art: ["heart5", "lips", "heart3"], spread: 18 });
      if (t >= 3.2) {                                   // escalation: necessary and highly encouraged
        var lvl = E(P(t, 3.2, 4.5));
        box(6, 22, 9, 38, "W", "k");
        rect(7, Math.round(59 - lvl * 36), 7, Math.round(lvl * 36), "r");
        for (var c = 0; c < 2; c++) {
          var col = (Math.floor(t * 6) + c) % 2 ? "R" : "r";
          line(7, 19 - c * 4, 10, 16 - c * 4, col); line(10, 16 - c * 4, 13, 19 - c * 4, col);
        }
      }
      if (t >= 4.6) sign("HIGHLY ENCOURAGED", 64, 67, "G");
    }
  };

  // #7 Cuddling is compulsory, personal space suspended: two personal-space bubbles pop, they run into a hug.
  SCENES[7] = {
    dur: 5.0,
    sfx: [[0.3, "blip"], [1.2, "thud"], [1.5, "pop"], [1.62, "pop"], [1.75, "step"], [1.95, "step"], [2.15, "step"], [2.35, "step"],
      [2.5, "purr"], [2.6, "chime"]],
    draw: function (t) {
      room({ wall: "#e9c9b0", dot: "#d9ab90" });
      rect(26, 64, 76, 9, "R"); rect(28, 65, 72, 7, "r");
      for (var i = 32; i < 98; i += 8) putC("heart3", i, 68);
      textC("PERSONAL SPACE", 64, 4, "K");
      stamp(t, 1.2, "SUSPENDED", 64, 17, "R");
      if (t < 1.5) {
        var r = 13 + (blink(t, 3) ? 1 : 0);
        ring(24, 57, r, "B", true);
        if (t < 1.62) ring(104, 57, r, "B", true);
      } else if (t < 1.62) ring(104, 57, 13, "B", true);
      burst(t, 1.5, 24, 57, 10, { art: "bubble", dist: 14, life: 0.5 });
      burst(t, 1.62, 104, 57, 10, { art: "bubble", dist: 14, life: 0.5 });
      var p = E(P(t, 1.7, 2.45)), running = on(t, 1.7, 2.45);
      var sway = t > 2.5 ? Math.round(Math.sin((t - 2.5) * 3)) : 0;
      hero("her", L(96, 62, p) + sway, 48, { frame: running ? walkFrame(t * 1.5) : 0 });
      hero("him", L(16, 52, p) + sway, 48, { frame: running ? walkFrame(t * 1.5) : 0 });
      rise(t, 2.5, 63, 44, 12, { gap: 0.2, art: ["heart5", "pheart3"] });
    }
  };

  // #8 Showering together, for classified reasons; towels negotiable: a curtain, bubbles, a duck, CLASSIFIED.
  SCENES[8] = {
    dur: 5.4,
    sfx: [[0.15, "shower"], [0.3, "step"], [0.6, "step"], [0.9, "step"], [1.35, "swish"], [2.0, "pop"], [2.3, "pop"], [2.45, "squeak"],
      [2.65, "pop"], [2.95, "thud"], [3.6, "whoosh"], [4.1, "giggle"]],
    draw: function (t) {
      rect(0, 0, W, 60, "#b9dbe6");
      for (var x = 0; x < W; x += 8) rect(x, 0, 1, 60, "#9cc6d6");
      for (var y = 7; y < 60; y += 8) rect(0, y, W, 1, "#9cc6d6");
      rect(0, 60, W, 20, "s");
      for (var x2 = 4; x2 < W; x2 += 10) rect(x2, 60, 1, 20, "S");
      rect(0, 66, W, 1, "S"); rect(0, 73, W, 1, "S");
      rect(110, 24, 5, 2, "T"); rect(110, 22, 1, 2, "T");
      rect(66, 0, 2, 8, "S"); box(60, 8, 14, 4, "s", "T");
      if (t >= 0.15) for (var i = 0; i < 20; i++) {
        var dy = (t * 70 + i * 17) % 48;
        rect(61 + (i * 7) % 12 + Math.round(dy / 24 * ((i % 3) - 1)), 12 + dy, 1, 2, "B");
      }
      hero("him", L(-18, 50, E(P(t, 0.2, 1.2))), 48, { frame: on(t, 0.2, 1.2) ? walkFrame(t) : 0 });
      hero("her", L(-34, 64, E(P(t, 0.3, 1.3))), 48, { frame: on(t, 0.3, 1.3) ? walkFrame(t + 0.1) : 0 });
      var cw = Math.round(L(8, 58, E(P(t, 1.35, 1.9))));
      rect(36, 5, 62, 1, "T");
      for (var c = 0; c < cw; c++) rect(38 + c, 6, 1, 54 + ((c % 6) < 3 ? 0 : 1), (Math.floor(c / 3) % 2) ? "w" : "p");
      rect(38, 6, cw, 1, "P");
      if (t >= 1.9) alpha(0.85, function () { rise(t, 1.9, 67, 6, 12, { art: ["steam", "bubble"], gap: 0.22, life: 1.8, speed: 9, spread: 44 }); });
      if (on(t, 2.45, 4.7)) put("duck", 84, -1 + (t < 2.6 ? Math.round((2.6 - t) * 40) : 0));
      stamp(t, 2.95, "CLASSIFIED", 64, 34, "R");
      var tp = P(t, 3.6, 4.1);
      if (tp > 0) put("towel", L(70, 108, tp), L(4, 26, tp) - Math.sin(tp * Math.PI) * 12);
      if (t >= 4.1) textC("TOWELS: NEGOTIABLE", 64, 69, "B");
    }
  };

  // #9 Bedtime is flexible, bedroom cardio is not: the clock races to dawn, the heart monitor races too.
  var BEATS = (function () {
    var list = [], t = 0.6, gap = 0.55;
    while (t < 4.1) { list.push(Math.round(t * 1000) / 1000); t += gap; gap = Math.max(0.33, gap * 0.86); }
    return list;
  })();
  function onBeat(t, w) {
    for (var i = 0; i < BEATS.length; i++) if (t >= BEATS[i] && t < BEATS[i] + w) return true;
    return false;
  }
  SCENES[9] = {
    dur: 5.6,
    sfx: BEATS.map(function (b) { return [b, "beep"]; }).concat([[0.15, "heartbeat"], [4.3, "chime"], [4.8, "thud"]])
      .sort(function (a, b) { return a[0] - b[0]; }),
    draw: function (t) {
      var dawn = E(P(t, 4.1, 4.6));
      room({ wall: "v", dot: "V", floor: "M", seam: "z", board: "z" });
      windowFrame(10, 8, 22, 18, dawn < 0.5 ? "N" : "#e8a07a", function () {
        if (dawn < 0.5) {
          px(14, 11, "w"); px(28, 13, "w"); px(19, 22, "y");
          put("moon", 21, Math.round(L(10, 22, P(t, 0, 4.1))));
        } else disc(21, Math.round(L(30, 20, dawn)), 4, "y");
      });
      var hrs = 10 + 8 * E(P(t, 0.4, 4.2));
      clockFace(64, 14, 8, (hrs % 1) * 60, hrs % 12);
      box(92, 6, 32, 25, "z", "k");
      for (var c = 0; c < 30; c++) {
        var tc = t - (29 - c) * 0.035, yv = 0;
        for (var i = 0; i < BEATS.length; i++) {
          var d = tc - BEATS[i];
          if (d >= 0 && d < 0.035) yv = -6; else if (d >= 0.035 && d < 0.07) yv = 3;
        }
        rect(93 + c, Math.min(17, 17 + yv), 1, Math.abs(yv) + 1, "g");
      }
      var bpm = 62;
      for (var j = 1; j < BEATS.length; j++) if (t >= BEATS[j]) bpm = Math.round(60 / (BEATS[j] - BEATS[j - 1]));
      if (t > 4.3) bpm = Math.max(70, bpm - Math.round((t - 4.3) * 80));
      text(bpm, 95, 23, "g");
      if (onBeat(t, 0.12) || t > 4.3) putC("heart3", 118, 25);
      var bob = t < 4.2 && onBeat(t, 0.08) ? -1 : 0, tired = t > 4.6;
      bed(40, 34 + bob, 48, function () {
        hero("him", 45, 36 + bob, { rows: 12, sleep: tired });
        hero("her", 67, 36 + bob, { rows: 12, sleep: tired });
      });
      stamp(t, 4.8, "NO LIABILITY", 64, 70, "R");
    }
  };

  // #10 Waking the other for reasons unrelated to sleep is always valid: a request that can't be declined.
  SCENES[10] = {
    dur: 5.6,
    sfx: [[0.1, "snore"], [0.9, "snore"], [1.25, "step"], [1.55, "tick"], [1.7, "tick"], [1.85, "pop"], [2.2, "whoosh"], [2.8, "blip"],
      [3.3, "nope"], [3.7, "thud"], [4.0, "chime"], [4.1, "step"], [4.45, "giggle"]],
    draw: function (t) {
      room({ wall: "V", dot: "v", floor: "M", seam: "z", board: "z" });
      var fl = Math.floor(t * 8) % 3;
      alpha(0.1, function () { disc(103, 38, 9 + (fl === 1 ? 1 : 0), "y"); });
      box(96, 48, 15, 14, "m", "k"); rect(97, 50, 13, 1, "n");
      rect(101, 40, 4, 8, "w"); rect(101, 40, 1, 8, "W"); px(103, 39, "k");
      if (t >= 4.0) putC("heart3", 103, 36);
      else { rect(102, 35 + (fl === 1 ? 1 : 0), 2, fl === 1 ? 3 : 4, "y"); px(102 + (fl % 2), 37, "r"); }
      var inBed = t >= 4.45, awake = t >= 1.85;
      bed(34, 34, 56, function () {
        hero("her", 66, 36, { rows: 12, sleep: !awake });
        if (inBed) hero("him", 41, 36, { rows: 12 });
      });
      if (!awake) zzz(t, 80, 34);
      if (!inBed) {
        var kx = t < 4.05 ? L(8, 18, E(P(t, 1.2, 1.5))) : L(18, 30, P(t, 4.05, 4.45));
        hero("him", kx, 48, { frame: on(t, 1.2, 1.5) || on(t, 4.05, 4.45) ? walkFrame(t) : 0 });
        if (on(t, 1.55, 1.85)) text("TAP", kx + 13, 40 - (blink(t, 8) ? 1 : 0), "W");
      }
      if (on(t, 1.85, 2.2)) { bubble(70, 22, 9, 11, 74); textC("!", 74, 25, "R"); }
      if (t >= 2.2) {
        var k = t < 2.32 ? 0 : 1;
        if (k) { box(40, 2, 48, 24, "W", "k"); textC("REQUEST", 64, 5, "K"); putC("heart", 64, 14); }
        else box(52, 10, 24, 11, "W", "k");
      }
      if (t >= 2.8) {
        var ok = t >= 3.7 && blink(t, 4), no = t >= 3.3;
        box(33, 28, 29, 9, ok ? "g" : "G", "k"); textC("ACCEPT", 47, 30, "w");
        box(66, 28, 31, 9, no ? "S" : "R", "k"); textC("DECLINE", 81, 30, no ? "T" : "w");
        if (no) { line(66, 28, 96, 36, "R"); line(66, 36, 96, 28, "R"); }
      }
      stamp(t, 3.7, "VALID", 64, 21, "G");
      rise(t, 4.0, 62, 40, 10, { gap: 0.2 });
    }
  };

  // #11 Morning cuddles first; getting up before them needs authorization: ACCESS DENIED, a heart lasso, AUTHORIZED.
  SCENES[11] = {
    dur: 5.6,
    sfx: [[0.1, "sparkle"], [0.6, "ring"], [1.3, "step"], [1.55, "step"], [1.8, "step"], [1.95, "buzz"], [2.55, "whoosh"], [3.05, "pop"],
      [3.35, "smack"], [3.55, "chime"], [3.8, "smack"], [4.3, "thud"], [4.5, "yes"]],
    draw: function (t) {
      room({ wall: "c", dot: "C" });
      var up = E(P(t, 0, 1.4));
      windowFrame(12, 8, 24, 18, up < 1 ? "#f2b48a" : "b", function () { disc(24, Math.round(L(30, 15, up)), 4, "y"); });
      box(100, 48, 16, 14, "m", "k"); rect(101, 50, 14, 1, "n");
      var sh = on(t, 0.6, 1.2) && blink(t, 16) ? 1 : 0;
      disc(104 + sh, 37, 2, "Y"); disc(112 + sh, 37, 2, "Y");
      disc(108 + sh, 42, 5, "k"); disc(108 + sh, 42, 4, "R"); disc(108 + sh, 42, 3, "W");
      rect(108 + sh, 40, 1, 3, "k"); rect(108 + sh, 42, 2, 1, "k");
      if (on(t, 0.6, 1.2)) { text("!", 98, 32, "R"); text("!", 116, 32, "R"); }
      var inBed = t < 1.2 || t >= 3.05, awake = t >= 0.7, snug = Math.round(E(P(t, 3.1, 3.4)) * 2);
      bed(38, 34, 56, function () {
        if (inBed) hero("him", 45 + snug, 36, { rows: 12, sleep: !awake });
        hero("her", 70 - snug, 36, { rows: 12, sleep: !awake });
      });
      if (on(t, 1.95, 3.05)) {
        rect(2, 44, 2, 22, "T");
        for (var b = 0; b < 7; b++) rect(4 + b * 4, 46, 4, 3, b % 2 ? "w" : "r");
      }
      if (!inBed) {
        var ox = t < 1.95 ? L(22, 4, E(P(t, 1.25, 1.95))) : t < 2.55 ? 4 : L(4, 24, E(P(t, 2.55, 3.05)));
        hero("him", ox, 48, { frame: on(t, 1.25, 1.95) ? walkFrame(t) : 0, flip: t < 2.55 });
        if (t >= 2.55) { line(ox + 10, 57, 77, 44, "P"); putC("heart5", ox + 10, 57); }
      }
      if (on(t, 1.95, 2.55)) sign("ACCESS DENIED", 64, 4, blink(t, 6) ? "R" : "D", "W");
      rise(t, 3.3, 64, 40, 12, { gap: 0.17, art: ["heart5", "lips"] });
      stamp(t, 4.3, "AUTHORIZED", 64, 15, "G");
    }
  };

  // #12 A locked door means a very important meeting: in they go, click, MEETING IN PROGRESS, a curious cat.
  SCENES[12] = {
    dur: 6.0,
    sfx: [[0.2, "step"], [0.5, "step"], [0.8, "creak"], [0.85, "step"], [1.15, "step"], [1.5, "creak"], [1.75, "thud"], [1.95, "click"],
      [2.25, "blip"], [2.8, "giggle"], [3.0, "tick"], [3.35, "tick"], [4.35, "meow"], [4.85, "blip"]],
    shake: [3.0, 3.35],
    draw: function (t) {
      room({ wall: "#cfe0c8", dot: "#b5cdb0" });
      box(14, 50, 10, 10, "n", "k"); disc(19, 44, 5, "G"); disc(17, 42, 3, "g");
      var open = t < 0.8 ? 0 : t < 1.5 ? E(P(t, 0.8, 1.0)) : 1 - E(P(t, 1.5, 1.75));
      door(50, 18, 28, 42, open);
      if (t < 1.45) {
        var fade = t > 1.25 ? 1 - P(t, 1.25, 1.45) : 1;
        alpha(fade, function () {
          hero("him", L(-18, 50, E(P(t, 0, 1.2))), 48, { frame: t < 1.2 ? walkFrame(t) : 0 });
          hero("her", L(-34, 60, E(P(t, 0.1, 1.3))), 48, { frame: t < 1.3 ? walkFrame(t + 0.1) : 0 });
        });
      }
      if (t >= 1.95) put("padlock", 69, 40);
      if (t >= 2.25) {
        var fh = Math.round(17 * E(P(t, 2.25, 2.45)));
        if (fh > 2) {
          line(56, 19, 64, 15, "k"); line(64, 15, 72, 19, "k");
          box(38, 20 + Math.floor((17 - fh) / 2), 52, fh, "W", "k");
          if (fh >= 17) { textC("MEETING", 64, 23, "R"); textC("IN PROGRESS", 64, 30, "K"); }
        }
      }
      rise(t, 2.6, 64, 58, 10, { art: "heart3", gap: 0.28, speed: 10, spread: 22, life: 1.6 });
      if (t >= 3.5) {
        var back = t >= 5.0;
        var cx = back ? L(84, 132, P(t, 5.0, 5.8)) : L(130, 84, E(P(t, 3.5, 4.3)));
        var moving = on(t, 3.5, 4.3) || back;
        put(moving && Math.floor(t * 6) % 2 ? "cat2" : "cat1", cx, 55, back);
        if (on(t, 4.35, 4.85)) { bubble(cx - 1, 40, 9, 11, cx + 3); textC("?", cx + 3, 43, "K"); }
        if (on(t, 4.85, 5.2)) { bubble(cx - 1, 40, 9, 11, cx + 3); textC("!", cx + 3, 43, "R"); }
      }
    }
  };

  // #13 Privacy is respected, unless both decide it's overrated: two votes, and the wall between them comes down.
  var BRICKS = (function () {
    var list = [];
    for (var r = 0; r < 11; r++) for (var c = 0; c < 3; c++) {
      var x = 56 + c * 8 - (r % 2 ? 4 : 0), w = 8;
      if (x < 56) { w -= 56 - x; x = 56; }
      if (x + w > 72) w = 72 - x;
      if (w > 0) list.push([x, 18 + r * 4, w]);
    }
    return list;
  })();
  SCENES[13] = {
    dur: 5.6,
    sfx: [[0.3, "blip"], [1.2, "blip"], [1.6, "ding"], [2.0, "dong"], [2.4, "swish"], [2.6, "rumble"], [3.3, "step"], [3.6, "step"],
      [3.9, "step"], [4.2, "chime"], [4.4, "purr"]],
    shake: [2.6],
    draw: function (t) {
      outdoors();
      textC("PRIVACY", 64, 2, "K");
      if (t < 2.6) {
        textC("RESPECTED", 64, 9, t < 2.4 ? "G" : "S");
        if (t >= 2.4) rect(46, 11, 36, 1, "R");
      } else textC("OVERRATED", 64, 9, "R");
      var fall = t - 2.6;
      BRICKS.forEach(function (b, i) {
        var x = b[0], y = b[1];
        if (fall > 0) {
          var d = fall - rnd(i) * 0.4;
          if (d > 0) {
            y = Math.min(62 + Math.round(rnd(i + 9) * 6), y + 90 * d * d);
            x += (rnd(i + 5) - 0.5) * 40 * Math.min(d, 0.5);
          }
        }
        rect(x, y, b[2], 4, "c");
        rect(x, y, b[2] - 1, 3, "R");
      });
      var p = E(P(t, 3.3, 4.1)), walking = on(t, 3.3, 4.1);
      hero("her", L(92, 63, p), 48, { frame: walking ? walkFrame(t + 0.1) : 0 });
      hero("him", L(20, 52, p), 48, { frame: walking ? walkFrame(t) : 0 });
      if (on(t, 1.2, 2.6)) {
        bubble(21, 33, 13, 11, 28);
        if (t >= 1.6) put("check", 24, 35); else textC("?", 28, 36, "K");
        bubble(93, 33, 13, 11, 100);
        if (t >= 2.0) put("check", 96, 35); else textC("?", 100, 36, "K");
      }
      rise(t, 4.2, 63, 44, 10, { gap: 0.2 });
    }
  };

  // #14 Repeated violations mean disciplinary action, behind closed doors: a tally, ORDER!, the doors shut.
  function doorPanel(x, left) {
    box(x, 0, 64, 80, "n", "k");
    rect(x + 3, 3, 58, 1, "q");
    box(x + 6, 6, 52, 30, "m", "M");
    box(x + 6, 42, 52, 30, "m", "M");
    ring(left ? x + 57 : x + 6, 39, 3, "Y");
  }
  SCENES[14] = {
    dur: 5.8,
    sfx: [[0.2, "whistle"], [0.3, "tick"], [0.6, "tick"], [0.9, "tick"], [1.2, "tick"], [1.5, "tick"], [1.8, "gavel"], [2.1, "gavel"],
      [2.3, "blip"], [2.6, "whoosh"], [3.3, "thud"], [3.6, "thud"], [4.0, "giggle"], [4.4, "tick"], [4.9, "tick"]],
    shake: [1.8, 2.1, 3.3, 4.4, 4.9],
    draw: function (t) {
      room();
      box(8, 6, 46, 26, "W", "k");
      text("VIOLATIONS", 10, 9, "R");
      for (var i = 0; i < 4; i++) if (t >= 0.3 + i * 0.3) rect(16 + i * 5, 18, 1, 10, "K");
      if (t >= 1.5) line(13, 26, 35, 19, "K");
      hero("him", 26, 48);
      if (t < 1.8) rise(t, 0.2, 38, 46, 4, { art: "note", gap: 0.35, life: 1.0, speed: 12, spread: 6 });
      hero("her", 92, 45);
      var down = on(t, 1.8, 1.95) || on(t, 2.1, 2.25);
      box(80, 59, 46, 12, "m", "k"); rect(82, 61, 42, 1, "n"); putC("heart", 103, 66);
      gavel(109, 57, down);
      if (on(t, 1.8, 2.3)) { bubble(85, 28, 27, 11, 100); textC("ORDER!", 98, 31, "R"); }
      if (t >= 2.3) sign("DISCIPLINARY ACTION", 64, 38, "R");
      var d = E(P(t, 2.6, 3.3));
      if (d > 0) {
        var dw = Math.round(64 * d);
        doorPanel(dw - 64, true);
        doorPanel(128 - dw, false);
      }
      stamp(t, 3.6, "CONFIDENTIAL", 64, 30, "R");
      rise(t, 3.9, 64, 66, 12, { gap: 0.2, spread: 6, speed: 16, art: ["heart5", "heart3"] });
    }
  };

  // #15 Hearings in the bedroom, both present, appeals by kisses: court in session, roll call, appeal GRANTED.
  var APPEAL = [3.3, 3.6, 3.85];
  SCENES[15] = {
    dur: 6.0,
    sfx: [[0.3, "gavel"], [0.45, "gavel"], [1.2, "ding"], [1.6, "dong"], [2.2, "step"], [2.5, "step"], [2.8, "step"], [3.1, "step"],
      [3.3, "smack"], [3.6, "smack"], [3.85, "smack"], [4.3, "gavel"], [4.4, "thud"], [4.6, "fanfare"]],
    draw: function (t) {
      room({ wall: "D", dot: "R", floor: "M", seam: "z", board: "z" });
      var fl = Math.floor(t * 8) % 2;
      [30, 98].forEach(function (cx) {
        alpha(0.1, function () { disc(cx, 21, 6 + fl, "y"); });
        rect(cx - 5, 28, 10, 2, "m");
        rect(cx - 1, 22, 3, 6, "w");
        rect(cx, 18 + fl, 1, 3 - fl, "y"); px(cx, 20, "r");
      });
      if (t >= 0.3) { box(24, 3, 80, 11, "W", "k"); textC("COURT IN SESSION", 64, 6, "R"); }
      bed(40, 34, 48, null);
      var p = E(P(t, 2.2, 3.2)), l = lean(t, APPEAL);
      hero("her", 104 - l, 48);
      var bang = on(t, 0.3, 0.38) || on(t, 0.45, 0.53) || on(t, 4.3, 4.45);
      gavel(118, bang ? 56 : 52, false);
      hero("him", L(8, 93, p) + l, 48, { frame: on(t, 2.2, 3.2) ? walkFrame(t) : 0 });
      if (on(t, 1.0, 2.2)) {
        bubble(6, 33, 13, 11, 16);
        if (t >= 1.2) put("check", 9, 35); else textC("?", 12, 36, "K");
        bubble(102, 33, 13, 11, 112);
        if (t >= 1.6) put("check", 105, 35); else textC("?", 108, 36, "K");
      }
      if (on(t, 1.6, 2.2)) sign("BOTH PARTIES PRESENT", 64, 18, "G");
      if (on(t, 2.2, 4.3)) sign("APPEAL: KISSES", 64, 18, "R");
      APPEAL.forEach(function (k, i) {
        var age = t - k;
        if (age < 0 || age > 1) return;
        alpha(age > 0.7 ? (1 - age) / 0.3 : 1, function () { putC(i === 1 ? "heart5" : "lips", 106 + (i - 1) * 4, 44 - age * 18); });
      });
      stamp(t, 4.3, "GRANTED", 64, 23, "G");
      burst(t, 4.4, 104, 42, 12, { art: ["heart5", "star"], dist: 24 });
      rise(t, 4.5, 104, 40, 8, { gap: 0.18 });
    }
  };

  // ------------------------------------------------------------ the window that plays them
  function $(id) { return document.getElementById(id); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var dialog = null, screen = null, current = 0, start = 0, lastFrame = -1, fired = 0, raf = 0, closer = 0, opener = null;
  var live = false, forced = false;

  /** Draw scene n at time t on a canvas context (the window's, unless another is given). */
  function frame(n, t, ctx) {
    var sc = SCENES[n];
    if (!sc) return;
    g = ctx || screen.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.save();
    g.clearRect(0, 0, W, H);
    var jolt = 0;
    (sc.shake || []).forEach(function (s) { if (t >= s && t < s + 0.17) jolt = Math.floor((t - s) * FPS) % 2 ? -1 : 1; });
    if (jolt) g.translate(jolt, 0);
    sc.draw(Math.min(t, sc.dur));
    g.restore();
  }

  function ruleInfo(n) {
    var li = $("rule-" + n);
    if (!li) return { lead: "", text: "" };
    var lead = li.querySelector(".sv-rule__lead"), txt = li.querySelector(".sv-rule__text");
    return { lead: lead ? lead.textContent : "", text: txt ? txt.textContent : "" };
  }

  function build() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "hr-dialog hr-scene";
    dialog.id = "scene";
    dialog.setAttribute("aria-labelledby", "scene-title");
    dialog.innerHTML =
      '<form class="hr-dialog__frame" method="dialog">' +
      '<p class="hr-dialog__kicker" id="scene-kicker"></p>' +
      '<div class="hr-scene__screen"><canvas width="' + W + '" height="' + H + '" id="scene-canvas" role="img"></canvas>' +
      '<span class="hr-scene__bar" id="scene-bar"></span></div>' +
      '<h2 class="hr-scene__title" id="scene-title"></h2>' +
      '<p class="hr-scene__text" id="scene-text"></p>' +
      '<div class="hr-scene__actions">' +
      '<button class="sv-btn sv-btn--quiet" type="button" id="scene-again">Again</button>' +
      '<button class="sv-btn sv-btn--quiet" type="button" id="scene-next">Next</button>' +
      '<button class="sv-btn" value="close" id="scene-close">Close</button>' +
      "</div></form>";
    document.body.appendChild(dialog);
    screen = $("scene-canvas");
    $("scene-again").addEventListener("click", function () { play(current); });
    $("scene-next").addEventListener("click", function () { play(current % 15 + 1); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () {
      stop();
      document.body.classList.remove("hr-modal");
      if (opener && document.body.contains(opener)) {
        var back = opener;
        window.setTimeout(function () { back.focus({ preventScroll: true }); }, 0);
      }
    });
    window.addEventListener("resize", fit);
  }

  /** Whole multiples of the art pixel where they fit: 3x on a computer, 2x on a phone. */
  function fit() {
    if (!screen) return;
    var room = Math.min(480, window.innerWidth - 32) - (window.innerWidth <= 420 ? 40 : 56) - 16;
    var k = Math.floor(room / W);
    if (k < 2) k = Math.max(1, room / W);
    screen.style.width = Math.floor(W * k) + "px";
    screen.style.height = Math.floor(H * k) + "px";
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(closer);
    closer = 0;
  }

  function tick(now) {
    var sc = SCENES[current];
    var t = (now - start) / 1000;
    var f = Math.floor(t * FPS);
    if (f !== lastFrame) {
      lastFrame = f;
      var tq = f / FPS;
      frame(current, tq);
      while (sc.sfx && fired < sc.sfx.length && sc.sfx[fired][0] <= tq) sfx(sc.sfx[fired++][1]);
      var bar = $("scene-bar");
      if (bar) bar.style.transform = "scaleX(" + Math.min(1, tq / sc.dur).toFixed(3) + ")";
    }
    if (t < sc.dur) { raf = window.requestAnimationFrame(tick); return; }
    raf = 0;
    frame(current, sc.dur);
    closer = window.setTimeout(function () { if (dialog.open) dialog.close(); }, HOLD * 1000);
  }

  /** Open the window (if it isn't open) and play rule n's scene from the start. */
  function play(n) {
    n = +n;
    if (!SCENES[n]) return;
    build();
    stop();
    current = n;
    var info = ruleInfo(n);
    $("scene-kicker").textContent = "Rule #" + n;
    $("scene-title").textContent = info.lead;
    $("scene-text").textContent = info.text;
    $("scene-text").hidden = !info.text;
    screen.setAttribute("aria-label", "A little scene: the knight and the princess act out rule " + n + ".");
    if (!dialog.open) {
      opener = document.activeElement;
      fit();
      try { dialog.showModal(); } catch (e) { dialog.setAttribute("open", ""); }
      document.body.classList.add("hr-modal");
    }
    var sc = SCENES[n];
    if (reducedMotion()) {                           // no motion: show how it ends, and stay until closed
      frame(n, sc.dur);
      $("scene-bar").style.transform = "scaleX(1)";
      return;
    }
    start = performance.now();
    lastFrame = -1;
    fired = 0;
    raf = window.requestAnimationFrame(tick);
  }

  function close() { if (dialog && dialog.open) dialog.close(); }

  // ------------------------------------------------------------ the rules become buttons once both seals are set
  function setLive(on) {
    on = !!(on || forced);
    if (on === live) return;
    live = on;
    var list = document.querySelector(".sv-rules");
    if (!list) return;
    list.classList.toggle("is-live", on);
    var hint = $("scene-hint");
    if (on && !hint) {
      hint = document.createElement("p");
      hint.className = "hr-scene-hint";
      hint.id = "scene-hint";
      hint.textContent = "Tap a rule to see it in action";
      list.parentNode.insertBefore(hint, list);
    }
    if (hint) hint.hidden = !on;
    Array.prototype.forEach.call(list.querySelectorAll(".sv-rule"), function (li) {
      var n = +String(li.id).replace("rule-", "");
      var btn = li.querySelector(".hr-play");
      if (on && !btn && SCENES[n]) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hr-play";
        btn.setAttribute("aria-haspopup", "dialog");
        var lead = li.querySelector(".sv-rule__lead");
        btn.setAttribute("aria-label", "Play rule " + n + (lead ? ": " + lead.textContent : ""));
        btn.addEventListener("click", function () { play(n); });
        li.appendChild(btn);
      }
      if (!on && btn) btn.parentNode.removeChild(btn);
    });
  }

  document.addEventListener("rules:state", function (e) { setLive(e.detail && e.detail.inForce); });

  function init() {
    var q = window.location.search || "";
    var m = q.match(/[?&]scene=(\d+)/);
    forced = /[?&]scenes?\b/.test(q);
    var st = $("status");
    setLive(st && st.getAttribute("data-in-force") === "true");
    if (m) window.setTimeout(function () { play(+m[1]); }, 400);
  }
  init();

  window.Scenes = {
    play: play,
    close: close,
    frame: function (n, t, ctx) { if (ctx) frame(n, t, ctx); else { build(); frame(n, t); } },
    duration: function (n) { return SCENES[n] ? SCENES[n].dur : 0; },
    count: function () { return Object.keys(SCENES).length; },
    live: function () { return live; },
    size: { w: W, h: H }
  };
})();
