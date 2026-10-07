/* House Rules: the pixel landscape behind the scroll — sky, drifting clouds, mountains and a forest.
 *
 * The sky follows the local time: dawn 5:00–8:00, day 8:00–17:00, sunset 17:00–21:00, night 21:00–5:00.
 * Add ?sky=dawn, ?sky=day, ?sky=sunset or ?sky=night to the address to look at one of them.
 *
 * The season follows the date: spring March–May, summer June–August, autumn September–November,
 * winter December–February. Add ?season=spring|summer|autumn|winter to look at one of them.
 *
 * Everything is drawn at 4px per art pixel on four canvases: sky, clouds, land, and a layer of moving
 * things (falling leaves, snow or petals, fireflies, birds, shooting stars). The mountains and trees
 * come from a fixed seed, so the landscape stays the same between visits.
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

  // Seasonal colours as they look in daylight. Other times of day tint them towards TINT.
  // leaves: crown light, mid, dark per kind of tree. fall: what drifts down. litter: specks on the ground.
  var SEASONS = {
    spring: { leaves: [["#86c45c", "#64a043", "#3f6f2b"]], blossom: ["#f7b6c8", "#fde7ee"], fall: ["#f7b6c8", "#fde7ee"] },
    summer: { leaves: [["#6aa84f", "#4f8a3a", "#335f26"]] },
    autumn: {
      leaves: [["#f0a03c", "#cf7424", "#8f4718"], ["#f4c84e", "#d9a02c", "#9a6a1a"], ["#dd5d3c", "#b23f29", "#742719"]],
      fall: ["#f0a03c", "#f4c84e", "#dd5d3c", "#cf7424"],
      litter: ["#cf7424", "#d9a02c", "#b23f29"]
    },
    winter: { snow: ["#f4f8fb", "#cfdcea"], bare: ["#5a3a1f", "#42230e"], fall: ["#f4f8fb", "#dfe9f2"] }
  };
  var TINT = { dawn: ["#6f6f9a", 0.28], day: null, sunset: ["#5b2f5e", 0.42], night: ["#0d1330", 0.72] };

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

  function seasonFor(date) {
    var m = /[?&]season=(spring|summer|autumn|winter)\b/.exec(window.location.search);
    if (m) return m[1];
    var mo = date.getMonth();
    if (mo === 11 || mo <= 1) return "winter";
    if (mo <= 4) return "spring";
    if (mo <= 7) return "summer";
    return "autumn";
  }

  function mixHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = 0;
    for (var sh = 16; sh >= 0; sh -= 8) {
      var ca = (x >> sh) & 255, cb = (y >> sh) & 255;
      out |= Math.round(ca + (cb - ca) * t) << sh;
    }
    return "#" + ("000000" + out.toString(16)).slice(-6);
  }

  /** The season's colours for this time of day: packed for drawing, plus hex strings for the moving layer. */
  function compileSeason(season, phase) {
    var src = SEASONS[season], tint = TINT[phase], ph = PHASES[phase];
    var hex = function (h) { return tint ? mixHex(h, tint[0], tint[1]) : h; };
    var out = { name: season };
    out.leaves = src.leaves ? src.leaves.map(function (l) { return l.map(function (h) { return rgba(hex(h)); }); }) : null;
    // the distant forest is hazier: halfway to the far trees' colour
    out.backLeaves = src.leaves ? src.leaves.map(function (l) {
      return [rgba(mixHex(hex(l[0]), ph.back[0], 0.5)), rgba(mixHex(hex(l[1]), ph.back[1], 0.5)), rgba(mixHex(hex(l[2]), ph.back[1], 0.55))];
    }) : null;
    out.blossom = src.blossom ? src.blossom.map(function (h) { return rgba(hex(h)); }) : null;
    out.snow = src.snow ? src.snow.map(function (h) { return rgba(hex(h)); }) : null;
    out.bare = src.bare ? src.bare.map(function (h) { return rgba(hex(h)); }) : null;
    out.litter = src.litter ? src.litter.map(function (h) { return rgba(hex(h)); }) : null;
    out.fall = src.fall ? src.fall.map(hex) : null;
    out.farSnow = ph.far[2];
    return out;
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
  function pine(s, x0, baseY, h, light, mid, dark, trunk, snow) {
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
        if (snow && (j <= (k === 0 ? 1 : 0) || (dx === -hw && j % 2 === 0))) col = dx <= 0 ? snow[0] : snow[1];
        s.set(x0 + dx, y, col);
      }
    }
    for (var ty = baseY - trunkH; ty < baseY; ty++) s.set(x0, ty, trunk);
  }

  /** A round leafy tree; bare branches with snow in winter. */
  function leafy(s, x0, baseY, h, pal, sea, trunk) {
    var r = Math.max(2, Math.round(h * 0.34));
    var cy = baseY - h + r;
    var trunkTop = cy + Math.round(r * 0.4);
    if (sea.bare) {
      for (var by = baseY - h + 1; by < baseY; by++) s.set(x0, by, sea.bare[0]);
      for (var a = 0; a < 3; a++) {
        var yy = cy - r + 2 + a * Math.max(2, Math.round(r * 0.6));
        var len = Math.max(1, r - a);
        for (var i = 1; i <= len; i++) {
          s.set(x0 - i, yy - (i >> 1), sea.bare[1]);
          s.set(x0 + i, yy - (i >> 1) - (a === 1 ? 1 : 0), sea.bare[1]);
        }
        s.set(x0 - len, yy - (len >> 1) - 1, sea.snow[0]);
        s.set(x0 + len, yy - (len >> 1) - (a === 1 ? 2 : 1), sea.snow[0]);
      }
      s.set(x0, baseY - h, sea.snow[0]);
      return;
    }
    for (var ty = trunkTop; ty < baseY; ty++) s.set(x0, ty, trunk);
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        var d = x * x + y * y;
        if (d > r * r + r * 0.6) continue;
        var col = x + y < -r * 0.6 ? pal[0] : x + y > r * 0.5 ? pal[2] : pal[1];
        if (d > r * r - r && x + y > 0) col = pal[2];
        if (sea.blossom && noise((x0 + x) * 31 + y, 7) < 0.16) col = sea.blossom[(x + y) & 1];
        s.set(x0 + x, cy + y, col);
      }
    }
  }

  function forestRow(s, W, H, seed, baseY, spacing, height, cols, sea, front) {
    var rnd = seeded(seed);
    var x = -8 - Math.floor(rnd() * 6);
    while (x < W + 10) {
      var h = height[0] + Math.floor(rnd() * (height[1] - height[0]));
      var shade = rnd() < 0.3;
      var by = baseY + Math.floor(rnd() * 2);
      var isLeafy = rnd() < (front ? 0.38 : 0.28);
      var pick = rnd();
      var leaves = front ? sea.leaves : sea.backLeaves;
      if (isLeafy && (leaves || sea.bare)) {
        leafy(s, x, by, h, leaves ? leaves[Math.floor(pick * leaves.length)] : null, sea, cols[3]);
      } else {
        pine(s, x, by, h, shade ? cols[1] : cols[0], cols[1], cols[2], cols[3], sea.snow);
      }
      x += spacing[0] + Math.floor(rnd() * (spacing[1] - spacing[0]));
    }
  }

  function drawLand(s, c, sea, W, H) {
    var winter = !!sea.snow;
    var far = ridge(W, H, 11, [26, 58], [0.3, 0.48], [0.3, 0.9]);
    drawRange(s, W, H, far, c.far, Math.round(H * (winter ? 0.52 : 0.42)));
    var near = ridge(W, H, 23, [18, 40], [0.5, 0.62], [0.2, 0.7]);
    drawRange(s, W, H, near, winter ? [c.near[0], c.near[1], rgba(sea.farSnow)] : c.near, Math.round(H * 0.6));

    var backBase = Math.round(H * 0.84);
    forestRow(s, W, H, 31, backBase, [3, 6], [7, 13], [c.back[0], c.back[1], c.back[1], c.back[1]], sea, false);
    for (var y = backBase; y < H; y++) for (var x = 0; x < W; x++) s.px[y * W + x] = c.back[1];

    var groundH = Math.max(4, Math.round(H * 0.045));
    var frontBase = H - groundH;
    forestRow(s, W, H, 47, frontBase, [6, 11], [13, 25], c.front, sea, true);
    for (var gy = frontBase; gy < H; gy++) {
      for (var gx = 0; gx < W; gx++) {
        var top = gy === frontBase || (gy === frontBase + 1 && noise(gx, 5) < 0.4);
        var col = top ? c.ground[0] : c.ground[1];
        if (winter) col = top || noise(gx * 7 + gy, 9) < 0.7 ? sea.snow[0] : sea.snow[1];
        else if (sea.litter && gy <= frontBase + 2 && noise(gx * 13 + gy, 4) < 0.3) col = sea.litter[(gx + gy) % sea.litter.length];
        else if (sea.blossom && top && noise(gx, 12) < 0.12) col = sea.blossom[gx & 1];
        s.px[gy * W + gx] = col;
      }
    }
  }

  // ------------------------------------------------------------ putting it on screen
  var world, skyCv, cloudCv, landCv;
  var current = { phase: null, season: null, W: 0, H: 0, T: 0 };
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
    var now = new Date();
    var phase = phaseFor(now), season = seasonFor(now);
    var W = Math.ceil(window.innerWidth / PX), H = Math.ceil(window.innerHeight / PX);
    if (!force && phase === current.phase && season === current.season && W === current.W && H === current.H) return;
    var phaseChanged = phase !== current.phase;
    compiled = compile(PHASES[phase]);
    var sea = compileSeason(season, phase);

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
    drawLand(land, compiled, sea, W, H);
    landCv.getContext("2d").putImageData(land.img, 0, 0);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", PHASES[phase].sky[0]);
    world.setAttribute("data-sky", phase);
    world.setAttribute("data-season", season);
    current = { phase: phase, season: season, W: W, H: H, T: T };
    fxReset(sea);
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

  // ------------------------------------------------------------ moving things
  // Falling leaves, snow or petals; fireflies on summer nights; birds by day; shooting stars at night.
  var fx = { cv: null, ctx: null, W: 0, H: 0, t: 0, parts: [], flies: [], birds: [], star: null, trail: [], sparks: [],
             nextBirds: 0, nextStar: 0, fall: null, season: null, phase: null, running: false };
  var STEP = 1 / 20;

  function fxPart(anywhere) {
    var w = fx.season === "winter", a = fx.season === "autumn";
    return {
      x: Math.random() * fx.W,
      y: anywhere ? Math.random() * fx.H : -3,
      vy: w ? 4 + Math.random() * 7 : a ? 6 + Math.random() * 8 : 4 + Math.random() * 5,
      sway: 2 + Math.random() * (w ? 3 : 6),
      ph: Math.random() * 6.28,
      spin: 0.8 + Math.random() * 1.6,
      col: fx.fall[Math.floor(Math.random() * fx.fall.length)],
      big: Math.random() < (w ? 0.1 : 0.6)
    };
  }

  function fxReset(sea) {
    if (!fx.cv) return;
    fx.W = current.W; fx.H = current.H;
    size(fx.cv, fx.W, fx.H);
    fx.ctx = fx.cv.getContext("2d");
    fx.season = sea.name; fx.phase = current.phase; fx.fall = sea.fall;
    fx.parts = [];
    var per = { autumn: 1100, winter: 420, spring: 1500 }[fx.season];
    if (per && fx.fall) for (var i = Math.round(fx.W * fx.H / per); i > 0; i--) fx.parts.push(fxPart(true));
    fx.flies = [];
    if (fx.season === "summer" && (fx.phase === "night" || fx.phase === "sunset")) {
      for (var f = Math.round(fx.W / 10); f > 0; f--) {
        fx.flies.push({ x: Math.random() * fx.W, y: fx.H * (0.72 + Math.random() * 0.22), vx: 0, vy: 0, ph: Math.random() * 6.28, rate: 1.5 + Math.random() * 2 });
      }
    }
    fx.birds = []; fx.star = null; fx.sparks = [];
    fx.nextBirds = fx.t + 3 + Math.random() * 8;
    fx.nextStar = fx.t + 2 + Math.random() * 5;
    fxStart();
  }

  function spawnFlock() {
    var fromLeft = Math.random() < 0.5, n = 3 + Math.floor(Math.random() * 3);
    var y0 = fx.H * (0.08 + Math.random() * 0.22), speed = 16 + Math.random() * 10;
    for (var i = 0; i < n; i++) {
      fx.birds.push({ x: fromLeft ? -6 - i * 7 : fx.W + 6 + i * 7, y: y0 + (i % 2 ? 3 : 0) + i, vx: fromLeft ? speed : -speed, ph: Math.random() * 6.28 });
    }
  }

  function spawnStar() {
    var dir = Math.random() < 0.5 ? -1 : 1;
    fx.star = { x: fx.W * (0.15 + Math.random() * 0.7), y: fx.H * (0.04 + Math.random() * 0.22), vx: dir * (60 + Math.random() * 30), vy: 26 + Math.random() * 14, life: 0.9 };
  }

  function fxStep() {
    fx.t += STEP;
    var i, p;
    for (i = 0; i < fx.parts.length; i++) {
      p = fx.parts[i];
      p.y += p.vy * STEP; p.ph += p.spin * STEP;
      if (p.y > fx.H + 2) fx.parts[i] = fxPart(false);
    }
    for (i = 0; i < fx.flies.length; i++) {
      p = fx.flies[i];
      p.vx += (Math.random() - 0.5) * 6 * STEP; p.vy += (Math.random() - 0.5) * 6 * STEP;
      p.vx *= 0.96; p.vy *= 0.96;
      p.x = (p.x + p.vx * STEP + fx.W) % fx.W;
      p.y = Math.min(fx.H - 3, Math.max(fx.H * 0.68, p.y + p.vy * STEP));
    }
    if (fx.phase !== "night" && fx.t > fx.nextBirds) { spawnFlock(); fx.nextBirds = fx.t + 18 + Math.random() * 22; }
    for (i = fx.birds.length - 1; i >= 0; i--) {
      p = fx.birds[i];
      p.x += p.vx * STEP; p.ph += STEP * 9;
      if (p.x < -40 || p.x > fx.W + 40) fx.birds.splice(i, 1);
    }
    if (fx.phase === "night" && !fx.star && fx.t > fx.nextStar) spawnStar();
    if (fx.star) {
      var st = fx.star;
      st.x += st.vx * STEP; st.y += st.vy * STEP; st.life -= STEP;
      fx.trail.unshift({ x: st.x, y: st.y, t: fx.t });
      if (st.life <= 0) { fx.star = null; fx.nextStar = fx.t + 6 + Math.random() * 8; }
    }
    while (fx.trail.length && fx.t - fx.trail[fx.trail.length - 1].t > 0.8) fx.trail.pop();
    for (i = fx.sparks.length - 1; i >= 0; i--) {
      p = fx.sparks[i];
      p.x += p.vx * STEP; p.y += p.vy * STEP; p.vy += 30 * STEP; p.life -= STEP;
      if (p.life <= 0) fx.sparks.splice(i, 1);
    }
  }

  var BIRD = [[[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]], [[-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0]]];
  var BIRD_COLOR = { dawn: "#3d3a5c", day: "#2a3550", sunset: "#2a1830", night: "#0d1330" };
  var TRAIL = ["#ffffff", "#f4e6bf", "#e3d6b0", "#b9c3dd", "#8f9bc0", "#5a6390"];

  function fxDraw() {
    var g = fx.ctx, i, p;
    g.clearRect(0, 0, fx.W, fx.H);
    for (i = 0; i < fx.parts.length; i++) {
      p = fx.parts[i];
      var x = Math.round(p.x + Math.sin(p.ph) * p.sway), y = Math.round(p.y);
      g.fillStyle = p.col;
      g.fillRect(x, y, 1, 1);
      if (p.big) {
        if (fx.season === "winter") { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
        else if (Math.sin(p.ph * 2) > 0) g.fillRect(x + 1, y, 1, 1);
        else g.fillRect(x, y + 1, 1, 1);
      }
    }
    for (i = 0; i < fx.flies.length; i++) {
      p = fx.flies[i];
      if (Math.sin(fx.t * p.rate + p.ph) > 0.35) { g.fillStyle = "#f2f58a"; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }
    g.fillStyle = BIRD_COLOR[fx.phase] || "#2a3550";
    for (i = 0; i < fx.birds.length; i++) {
      p = fx.birds[i];
      var shape = BIRD[Math.floor(p.ph) % 2], by = Math.round(p.y + Math.sin(p.ph * 0.3));
      for (var k = 0; k < shape.length; k++) g.fillRect(Math.round(p.x) + shape[k][0], by + shape[k][1], 1, 1);
    }
    if (fx.star) {
      for (i = Math.min(fx.trail.length, TRAIL.length) - 1; i >= 0; i--) {
        g.fillStyle = TRAIL[i];
        g.fillRect(Math.round(fx.trail[i].x), Math.round(fx.trail[i].y), 1, 1);
      }
    }
    for (i = 0; i < fx.sparks.length; i++) {
      p = fx.sparks[i];
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }

  function fxStart() {
    if (fx.running || reducedMotion()) return;
    fx.running = true;
    var last = null, acc = 0;
    function frame(now) {
      if (last === null) last = now;
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      var stepped = false;
      while (acc >= STEP) { acc -= STEP; fxStep(); stepped = true; }
      if (stepped) fxDraw();
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  // Click the sky next to a shooting star to make a wish.
  function wish(clientX, clientY, ax, ay) {
    fx.star = null;
    fx.trail = [];
    fx.nextStar = fx.t + 5 + Math.random() * 6;
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * 6.28, v = 8 + Math.random() * 14;
      fx.sparks.push({ x: ax, y: ay, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, life: 0.6 + Math.random() * 0.5, col: i % 3 ? "#f6d36b" : "#ffffff" });
    }
    var el = document.createElement("div");
    el.className = "hr-wish";
    el.setAttribute("role", "status");
    el.innerHTML = '<span aria-hidden="true">' + (window.Svitok ? window.Svitok.emblem("heart") : "") + "</span><span>Wish made</span>";
    el.style.left = Math.min(window.innerWidth - 110, Math.max(110, clientX)) + "px";
    el.style.top = clientY + "px";
    document.body.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
  }

  function onClick(e) {
    if (!fx.cv || reducedMotion() || !fx.trail.length) return;
    if (e.target !== document.body && e.target !== document.documentElement) return;
    var top = window.innerHeight - fx.H * PX;     // the canvases sit on the bottom edge
    var ax = e.clientX / PX, ay = (e.clientY - top) / PX;
    for (var i = 0; i < fx.trail.length; i++) {
      var p = fx.trail[i], dx = p.x - ax, dy = p.y - ay;
      if (fx.t - p.t < 0.6 && dx * dx + dy * dy < 100) { wish(e.clientX, e.clientY, ax, ay); return; }
    }
  }

  function init() {
    world = document.getElementById("world");
    if (!world || typeof ImageData === "undefined") return;
    skyCv = document.getElementById("world-sky");
    cloudCv = document.getElementById("world-clouds");
    landCv = document.getElementById("world-land");
    fx.cv = document.getElementById("world-fx");
    try { render(true); } catch (e) { world.hidden = true; return; }
    world.classList.add("is-ready");

    var timer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { render(false); }, 150);
    });
    window.setInterval(function () { render(false); }, 60000);   // time of day and season
    window.setInterval(twinkleStars, 450);
    document.addEventListener("click", onClick);
  }
  init();

  window.Landscape = {
    render: function () { render(true); },
    phaseFor: phaseFor,
    seasonFor: seasonFor,
    phases: PHASES,
    seasons: SEASONS,
    // for testing: make something happen now
    debug: {
      flock: function () { spawnFlock(); },
      star: function () { spawnStar(); return fx.star; },
      state: function () { return { t: fx.t, parts: fx.parts.length, flies: fx.flies.length, birds: fx.birds.length, star: fx.star, trail: fx.trail.length, sparks: fx.sparks.length, H: fx.H, running: fx.running }; }
    }
  };
})();
