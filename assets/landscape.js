/* House Rules: the pixel landscape behind the scroll — sky, drifting clouds, mountains and a forest.
 *
 * The sky follows the local time: dawn 5:00–8:00, day 8:00–17:00, sunset 17:00–21:00, night 21:00–5:00.
 * Add ?sky=dawn, ?sky=day, ?sky=sunset or ?sky=night to the address to look at one of them.
 *
 * Everything is drawn at 4px per art pixel on three canvases (sky, clouds, land). The mountains and
 * trees come from a fixed seed, so the landscape stays the same between visits.
 */
(function () {
  "use strict";

  var PX = 4;

  // Colours per time of day. sky: top to horizon. far/near: lit side, shaded side (+ snow for far).
  // back: distant forest light/dark. front: tree light, mid, dark, trunk. ground: top, fill.
  var PHASES = {
    dawn: {
      sky: ["#4a5d8a", "#7e86b0", "#c79bb0", "#f0b8a0", "#f8dcb8"],
      sun: { core: "#fff0c8", ring: "#f7b267", r: 8, x: 0.1, y: 0.37, stripes: false },
      clouds: ["#fbe2d6", "#d6a9b9"],
      far: ["#a29bbf", "#827fa8", "#f6ecf2"],
      near: ["#61709a", "#4d5a80"],
      back: ["#40566a", "#33465a"],
      front: ["#3a5e4a", "#2c4a3a", "#1f3529", "#2a1c14"],
      ground: ["#2c4a3a", "#1a2a22"]
    },
    day: {
      sky: ["#3f7fc4", "#5a98d3", "#7fb4e0", "#a6cfeb", "#d2e8f3"],
      sun: { core: "#fff6c8", ring: "#f6d36b", r: 6, x: 0.86, y: 0.15, stripes: false },
      clouds: ["#fbfdff", "#c6dbeb"],
      far: ["#9cb8cf", "#7d9cb8", "#f2f7fa"],
      near: ["#6f9a7c", "#58806a"],
      back: ["#4f7d46", "#3d6638"],
      front: ["#5e9134", "#4c7a2c", "#30521c", "#42230e"],
      ground: ["#93b847", "#30521c"]
    },
    sunset: {
      sky: ["#3b2a5c", "#6b3d6e", "#b2546a", "#e07a4f", "#f4b25e"],
      sun: { core: "#ffd27a", ring: "#f49a4a", r: 11, x: 0.88, y: 0.39, stripes: true },
      clouds: ["#f8c39a", "#c86f72"],
      far: ["#8a5a84", "#6b4470", "#f6c9a4"],
      near: ["#553a60", "#432d4e"],
      back: ["#3a2b46", "#2e2238"],
      front: ["#40304c", "#30243a", "#22192a", "#1a1220"],
      ground: ["#40304c", "#1a121f"]
    },
    night: {
      sky: ["#090d22", "#10173a", "#18224b", "#202d5a", "#2b3866"],
      moon: { color: "#f2ecd0", shade: "#c9c2a2", r: 6, x: 0.84, y: 0.15 },
      stars: ["#f4e6bf", "#86b6cc"],
      clouds: ["#38426c", "#283158"],
      far: ["#323c66", "#283055", "#97a3c8"],
      near: ["#222a4c", "#1b223f"],
      back: ["#171e36", "#121830"],
      front: ["#1d2640", "#151c33", "#0e1326", "#0a0d1a"],
      ground: ["#1d2640", "#0a0d1a"]
    }
  };

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // ------------------------------------------------------------ helpers
  function rgba(hex) {
    var n = parseInt(hex.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
  }
  function seeded(a) {   // mulberry32
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(x, s) {
    var h = Math.imul((x + 1013) ^ s, 0x27d4eb2d);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  function Surface(w, h) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
  }
  Surface.prototype.set = function (x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  };

  function phaseFor(date) {
    var m = /[?&]sky=(dawn|day|sunset|night)\b/.exec(window.location.search);
    if (m) return m[1];
    var h = date.getHours() + date.getMinutes() / 60;
    if (h < 5 || h >= 21) return "night";
    if (h < 8) return "dawn";
    if (h < 17) return "day";
    return "sunset";
  }

  function compile(ph) {      // hex → packed colours, once per phase
    var out = {};
    Object.keys(ph).forEach(function (k) {
      var v = ph[k];
      if (Array.isArray(v)) out[k] = v.map(rgba);
      else if (v && typeof v === "object") {
        var o = {};
        Object.keys(v).forEach(function (kk) { o[kk] = typeof v[kk] === "string" ? rgba(v[kk]) : v[kk]; });
        out[k] = o;
      }
    });
    return out;
  }

  // ------------------------------------------------------------ sky
  function skyAt(c, x, y, H) {
    var bands = c.sky;
    var f = Math.min(1, y / (H * 0.74)) * (bands.length - 1);
    var i = Math.floor(f);
    if (i >= bands.length - 1) return bands[bands.length - 1];
    var threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    return (f - i) > threshold ? bands[i + 1] : bands[i];
  }

  function disc(s, cx, cy, r, color, test) {
    for (var y = -r - 1; y <= r + 1; y++) {
      for (var x = -r - 1; x <= r + 1; x++) {
        if (x * x + y * y <= r * r + r * 0.8 && (!test || test(cx + x, cy + y))) s.set(cx + x, cy + y, color);
      }
    }
  }

  function drawSky(s, c, W, H, stars) {
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) s.px[y * W + x] = skyAt(c, x, y, H);
    }
    if (c.sun) {
      var sun = c.sun, cx = Math.round(W * sun.x), cy = Math.round(H * sun.y);
      disc(s, cx, cy, sun.r + 1, sun.ring);
      disc(s, cx, cy, sun.r, sun.core);
      if (sun.stripes) {             // the retro sunset: horizontal cuts across the lower half
        for (var yy = 2; yy <= sun.r + 1; yy += 3) {
          for (var xx = -sun.r - 1; xx <= sun.r + 1; xx++) s.set(cx + xx, cy + yy, skyAt(c, cx + xx, cy + yy, H));
        }
      }
    }
    if (c.moon) {
      var mo = c.moon, mx = Math.round(W * mo.x), my = Math.round(H * mo.y);
      disc(s, mx, my, mo.r, mo.color);
      var ox = mx + Math.round(mo.r * 0.6), oy = my - Math.round(mo.r * 0.35);
      disc(s, ox, oy, Math.round(mo.r * 0.85), 0, function (x, y) { s.set(x, y, skyAt(c, x, y, H)); return false; });
      s.set(mx - Math.round(mo.r * 0.5), my + 1, mo.shade);
      s.set(mx - Math.round(mo.r * 0.2), my + Math.round(mo.r * 0.55), mo.shade);
    }
    stars.forEach(function (st) { drawStar(s, c, st, true, H); });
  }

  function makeStars(c, W, H) {
    if (!c.stars) return [];
    var rnd = seeded(77), out = [];
    var n = Math.round(W * H * 0.0035);
    for (var i = 0; i < n; i++) {
      var st = { x: Math.floor(rnd() * W), y: Math.floor(rnd() * H * 0.55), color: rnd() < 0.8 ? c.stars[0] : c.stars[1], big: rnd() < 0.07 };
      if (c.moon) {
        var dx = st.x - W * c.moon.x, dy = st.y - H * c.moon.y;
        if (dx * dx + dy * dy < (c.moon.r + 4) * (c.moon.r + 4)) continue;
      }
      out.push(st);
    }
    return out;
  }

  function drawStar(s, c, st, on, H) {
    var pts = st.big ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]];
    pts.forEach(function (p) {
      var x = st.x + p[0], y = st.y + p[1];
      s.set(x, y, on ? st.color : skyAt(c, x, y, H));
    });
  }

  // ------------------------------------------------------------ clouds (a tile drawn twice, so it can loop)
  function drawClouds(c, T, CH) {
    var s = new Surface(2 * T, CH);
    var rnd = seeded(4242);
    var n = Math.round(T / 55) + 2;
    for (var k = 0; k < n; k++) {
      var cw = 14 + Math.floor(rnd() * 26);
      var cx = Math.floor(rnd() * T);
      var cy = Math.floor(CH * 0.2 + rnd() * CH * 0.62);
      var m = 3 + Math.floor(rnd() * 3), puffs = [], maxR = 0;
      for (var i = 0; i < m; i++) {
        var r = cw / m * 0.75 + rnd() * cw * 0.1 + (i === Math.floor(m / 2) ? cw * 0.14 : 0);
        puffs.push([cx - cw / 2 + (i + 0.5) * cw / m + (rnd() - 0.5) * 3, cy - r * 0.35, r]);
        if (r > maxR) maxR = r;
      }
      var inside = function (x, y) {
        if (y > cy) return false;
        for (var q = 0; q < puffs.length; q++) {
          var dx = x - puffs[q][0], dy = y - puffs[q][1];
          if (dx * dx + dy * dy <= puffs[q][2] * puffs[q][2]) return true;
        }
        return false;
      };
      for (var y = Math.floor(cy - maxR * 1.5); y <= cy; y++) {
        for (var x = Math.floor(cx - cw / 2 - maxR); x <= Math.ceil(cx + cw / 2 + maxR); x++) {
          if (!inside(x, y)) continue;
          var shade = y >= cy - 1 || (!inside(x + 1, y + 1) && y > cy - maxR * 0.6);
          var col = shade ? c.clouds[1] : c.clouds[0];
          for (var w = -1; w <= 2; w++) s.set(x + w * T, y, col);   // copies so the strip loops seamlessly
        }
      }
    }
    return s;
  }

  // ------------------------------------------------------------ mountains
  function ridge(W, H, seed, gap, top, valley) {
    var rnd = seeded(seed), peaks = [];
    var x = -60 - Math.floor(rnd() * 20);
    while (x < W + 80) {
      peaks.push({ x: x, y: H * (top[0] + rnd() * (top[1] - top[0])), v: valley[0] + rnd() * (valley[1] - valley[0]) });
      x += gap[0] + Math.floor(rnd() * (gap[1] - gap[0]));
    }
    var tops = new Int16Array(W), peakTop = new Int16Array(W);
    for (var i = 0; i + 1 < peaks.length; i++) {
      var a = peaks[i], b = peaks[i + 1];
      var mid = Math.round((a.x + b.x) / 2 + (noise(i, seed) - 0.5) * (b.x - a.x) * 0.3);
      var vy = Math.max(a.y, b.y) + (H * 0.9 - Math.max(a.y, b.y)) * a.v * 0.35;
      for (var xx = Math.max(0, a.x); xx < Math.min(W, b.x); xx++) {
        var y = xx < mid
          ? a.y + (vy - a.y) * (xx - a.x) / Math.max(1, mid - a.x)
          : vy + (b.y - vy) * (xx - mid) / Math.max(1, b.x - mid);
        tops[xx] = Math.round(y + (noise(xx, seed) < 0.22 ? 1 : 0));
        peakTop[xx] = Math.round(xx < mid ? a.y : b.y);
      }
    }
    return { tops: tops, peakTop: peakTop };
  }

  function drawRange(s, W, H, r, cols, snowLine) {
    var lit = true;
    for (var x = 0; x < W; x++) {
      var t = r.tops[x];
      var next = x + 1 < W ? r.tops[x + 1] : t;
      if (next < t) lit = true;            // climbing to the right: the face looks left, towards the light
      else if (next > t) lit = false;      // going down to the right: the shaded face
      var base = lit ? cols[0] : cols[1];
      for (var y = Math.max(0, t); y < H; y++) {
        var col = base;
        if (cols[2] !== undefined && r.peakTop[x] < snowLine) {
          var depth = 2 + (noise(x, 99) < 0.5 ? 1 : 0) + Math.max(0, Math.round((snowLine - r.peakTop[x]) * 0.25));
          if (y < t + depth && y < snowLine + 2) col = cols[2];
        }
        s.px[y * W + x] = col;
      }
    }
  }

  // ------------------------------------------------------------ forest
  function pine(s, x0, baseY, h, light, mid, dark, trunk) {
    var trunkH = Math.max(1, Math.round(h * 0.12));
    var crown = h - trunkH;
    var tiers = h >= 18 ? 3 : 2;
    var tierH = crown / tiers;
    for (var r = 0; r < crown; r++) {
      var k = Math.min(tiers - 1, Math.floor(r / tierH));
      var j = r - Math.floor(k * tierH);
      var hw = Math.min(Math.round(j * 0.7) + k, Math.round(h * 0.34));
      var y = baseY - h + r;
      var lastRow = j === Math.floor(tierH) - 1 && k < tiers - 1;
      for (var dx = -hw; dx <= hw; dx++) {
        var col = dx < 0 ? light : dx === hw ? dark : mid;
        if (lastRow && dx > -hw) col = dark;
        s.set(x0 + dx, y, col);
      }
    }
    for (var ty = baseY - trunkH; ty < baseY; ty++) s.set(x0, ty, trunk);
  }

  function forestRow(s, W, H, seed, baseY, spacing, height, cols) {
    var rnd = seeded(seed);
    var x = -8 - Math.floor(rnd() * 6);
    while (x < W + 10) {
      var h = height[0] + Math.floor(rnd() * (height[1] - height[0]));
      var shade = rnd() < 0.3;
      pine(s, x, baseY + Math.floor(rnd() * 2), h, shade ? cols[1] : cols[0], cols[1], cols[2], cols[3]);
      x += spacing[0] + Math.floor(rnd() * (spacing[1] - spacing[0]));
    }
  }

  function drawLand(s, c, W, H) {
    var far = ridge(W, H, 11, [26, 58], [0.3, 0.48], [0.3, 0.9]);
    drawRange(s, W, H, far, c.far, Math.round(H * 0.42));
    var near = ridge(W, H, 23, [18, 40], [0.5, 0.62], [0.2, 0.7]);
    drawRange(s, W, H, near, c.near);

    var backBase = Math.round(H * 0.84);
    forestRow(s, W, H, 31, backBase, [3, 6], [7, 13], [c.back[0], c.back[1], c.back[1], c.back[1]]);
    for (var y = backBase; y < H; y++) for (var x = 0; x < W; x++) s.px[y * W + x] = c.back[1];

    var groundH = Math.max(4, Math.round(H * 0.045));
    var frontBase = H - groundH;
    forestRow(s, W, H, 47, frontBase, [6, 11], [13, 25], c.front);
    for (var gy = frontBase; gy < H; gy++) {
      for (var gx = 0; gx < W; gx++) {
        var top = gy === frontBase || (gy === frontBase + 1 && noise(gx, 5) < 0.4);
        s.px[gy * W + gx] = top ? c.ground[0] : c.ground[1];
      }
    }
  }

  // ------------------------------------------------------------ putting it on screen
  var world, skyCv, cloudCv, landCv;
  var current = { phase: null, W: 0, H: 0, T: 0 };
  var skySurface = null, stars = [], compiled = null, twinkle = 0;

  function size(cv, w, h) {
    cv.width = w; cv.height = h;
    cv.style.width = (w * PX) + "px";
    cv.style.height = (h * PX) + "px";
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function render(force) {
    var phase = phaseFor(new Date());
    var W = Math.ceil(window.innerWidth / PX), H = Math.ceil(window.innerHeight / PX);
    if (!force && phase === current.phase && W === current.W && H === current.H) return;
    var phaseChanged = phase !== current.phase;
    compiled = compile(PHASES[phase]);

    size(skyCv, W, H);
    skySurface = new Surface(W, H);
    stars = makeStars(compiled, W, H);
    drawSky(skySurface, compiled, W, H, stars);
    skyCv.getContext("2d").putImageData(skySurface.img, 0, 0);

    var T = Math.max(W, 200);
    if (phaseChanged || T !== current.T || H !== current.H) {
      var CH = Math.ceil(H * 0.5);
      size(cloudCv, 2 * T, CH);
      cloudCv.getContext("2d").putImageData(drawClouds(compiled, T, CH).img, 0, 0);
      world.style.setProperty("--cloud-shift", (-T * PX) + "px");
      world.style.setProperty("--cloud-steps", String(T));
      world.style.setProperty("--cloud-time", (T * 0.6) + "s");
    }

    size(landCv, W, H);
    var land = new Surface(W, H);
    drawLand(land, compiled, W, H);
    landCv.getContext("2d").putImageData(land.img, 0, 0);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", PHASES[phase].sky[0]);
    world.setAttribute("data-sky", phase);
    current = { phase: phase, W: W, H: H, T: T };
  }

  function twinkleStars() {
    if (!stars.length || document.hidden || reducedMotion()) return;
    var ctx = skyCv.getContext("2d");
    for (var i = 0; i < 5; i++) {
      var st = stars[(twinkle * 7 + i * 13) % stars.length];
      st.off = !st.off;
      drawStar(skySurface, compiled, st, !st.off, current.H);
      ctx.putImageData(skySurface.img, 0, 0, st.x - 1, st.y - 1, 3, 3);
    }
    twinkle++;
  }

  function init() {
    world = document.getElementById("world");
    if (!world || typeof ImageData === "undefined") return;
    skyCv = document.getElementById("world-sky");
    cloudCv = document.getElementById("world-clouds");
    landCv = document.getElementById("world-land");
    try { render(true); } catch (e) { world.hidden = true; return; }
    world.classList.add("is-ready");

    var timer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { render(false); }, 150);
    });
    window.setInterval(function () { render(false); }, 60000);   // dawn, day, sunset, night
    window.setInterval(twinkleStars, 450);
  }
  init();

  window.Landscape = { render: function () { render(true); }, phaseFor: phaseFor, phases: PHASES };
})();
