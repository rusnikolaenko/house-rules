/* House Rules: the little dragon of the rules.
 *
 * The dragon is a 26x22 pixel picture, drawn here as rows of letters; every letter is a colour from the
 * palette next to it ("." is empty). Six frames: three wing poses (up, middle, low), each with the mouth
 * closed and with the mouth open. The flame and the shadow are tiny pictures of their own. Like the heroes,
 * they are turned into small SVG strips at load time (no image files).
 *
 * Two lives:
 *  - near: while the heroes walk towards each other (heroes.js sends "heroes:walk" and "heroes:met") the dragon
 *    flies in, circles twice over the stage, breathes fire and roars when they meet, and then flies off into
 *    the distance, getting smaller;
 *  - far: from then on, for as long as both seals stand, it keeps circling high in the sky behind the scroll
 *    (a half-size dragon inside the landscape; on a phone, where the scroll hides the sky, it flies in front of the scroll), and now and then puffs a little fire. It is there on every
 *    visit after the signing, not only after the ceremony. ceremony.js says when the rules are in force
 *    ("rules:state") and when a ceremony starts ("ceremony:play").
 *
 * Click the dragon while it flies near (or tap it where it shows when it is far):
 * it loops the loop and breathes fire. Dragon.fly() starts the near flight by hand; opening the page with
 * ?dragon does the same, ?dragon=far goes straight to the far orbit. With "reduce motion" on, there is no dragon.
 */
(function () {
  "use strict";

  var W = 26, H = 22, SCALE = 4;
  var FW = 14, FH = 8;                 // the flame
  var BODY_W = W * SCALE, BODY_H = H * SCALE;
  var CENTER_X = 52, CENTER_Y = 48;    // the middle of the dragon's body inside its picture, in screen px

  var SPRITE = {
    // g, G body; c belly; y horns; o wing; O wing bones; w, e eye; r cheek; m mouth; t tongue; n nostril
    palette: {
      k: "#22120a",
      g: "#7cc04a",
      G: "#4c8f33",
      c: "#f6e4a0",
      y: "#f6d36b",
      o: "#f4a04a",
      O: "#c4561e",
      w: "#ffffff",
      e: "#22120a",
      r: "#e8806a",
      m: "#7a1c18",
      t: "#d4473b",
      n: "#2f5f22"
    },
    frames: [
      // wings up, mouth closed
      [
        "......k...kOk.............",
        ".....kOk.koOk.............",
        ".....kOokkoOk.............",
        ".....koOkooOk...k..k......",
        "..k..koOoooOk..kykkyk.....",
        ".kOkkoooOooOk..kykkyk.....",
        "..kOkoooOooOk.kggggggk....",
        ".kkkOOkkkkkkkkggggggggk...",
        "kyykkkggggggggggggwegggk..",
        "kyykkgggggggggggggwegggk..",
        ".kggkgggggggggggggrgggggk.",
        ".kggkgggccccccggggggmmggk.",
        "..kgkgggccccccggggggggkk..",
        "...kgkgggccccccggkkkkk....",
        "....kkkgggccccggk.........",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ],
      // wings in the middle, mouth closed
      [
        "..........................",
        "..........................",
        "...k.....k................",
        "..kOk...kOk.....k..k......",
        "..koOk..kOk....kykkyk.....",
        "..kooOkkoOk....kykkyk.....",
        "..koooOkooOk..kggggggk....",
        "kkkoookkkkkkkkggggggggk...",
        "OOoookggggggggggggwegggk..",
        "kkOOkgggggggggggggwegggk..",
        ".kkkkgggggggggggggrgggggk.",
        ".kggkgggccccccggggggmmggk.",
        "..kgkgggccccccggggggggkk..",
        "...kgkgggccccccggkkkkk....",
        "....kkkgggccccggk.........",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ],
      // wings low, mouth closed
      [
        "..........................",
        "..........................",
        "..........................",
        "................k..k......",
        "...............kykkyk.....",
        "...............kykkyk.....",
        ".......k......kggggggk....",
        ".kk...kkkkkkkkggggggggk...",
        "kOOkkkggggggggggggwegggk..",
        "kkoOkgggggggggggggwegggk..",
        "kkookgggggggggggggrgggggk.",
        "OOOOkgggccccccggggggmmggk.",
        "kkkkkgggccccccggggggggkk..",
        "...kgkgggccccccggkkkkk....",
        "....kkkgggccccggk.........",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ],
      // wings up, mouth open
      [
        "......k...kOk.............",
        ".....kOk.koOk.............",
        ".....kOokkoOk.............",
        ".....koOkooOk...k..k......",
        "..k..koOoooOk..kykkyk.....",
        ".kOkkoooOooOk..kykkyk.....",
        "..kOkoooOooOk.kggggggk....",
        ".kkkOOkkkkkkkkggggggggk...",
        "kyykkkggggggggggggwegggk..",
        "kyykkgggggggggggggwegggk..",
        ".kggkgggggggggggggrgggggkk",
        ".kggkgggccccccggggggmmmmmm",
        "..kgkgggccccccgggggGtttmmm",
        "...kgkgggccccccgggggggggkk",
        "....kkkgggccccggkkkkkkkk..",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ],
      // wings in the middle, mouth open
      [
        "..........................",
        "..........................",
        "...k.....k................",
        "..kOk...kOk.....k..k......",
        "..koOk..kOk....kykkyk.....",
        "..kooOkkoOk....kykkyk.....",
        "..koooOkooOk..kggggggk....",
        "kkkoookkkkkkkkggggggggk...",
        "OOoookggggggggggggwegggk..",
        "kkOOkgggggggggggggwegggk..",
        ".kkkkgggggggggggggrgggggkk",
        ".kggkgggccccccggggggmmmmmm",
        "..kgkgggccccccgggggGtttmmm",
        "...kgkgggccccccgggggggggkk",
        "....kkkgggccccggkkkkkkkk..",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ],
      // wings low, mouth open
      [
        "..........................",
        "..........................",
        "..........................",
        "................k..k......",
        "...............kykkyk.....",
        "...............kykkyk.....",
        ".......k......kggggggk....",
        ".kk...kkkkkkkkggggggggk...",
        "kOOkkkggggggggggggwegggk..",
        "kkoOkgggggggggggggwegggk..",
        "kkookgggggggggggggrgggggkk",
        "OOOOkgggccccccggggggmmmmmm",
        "kkkkkgggccccccgggggGtttmmm",
        "...kgkgggccccccgggggggggkk",
        "....kkkgggccccggkkkkkkkk..",
        ".......kggkkkggk..........",
        "......kgggkkgggk..........",
        ".......kkk..kkk...........",
        "..........................",
        "..........................",
        "..........................",
        ".........................."
      ]
    ]
  };

  var FIRE = {
    palette: { r: "#d4473b", o: "#f08a3a", y: "#f6d36b", w: "#fff3c0" },
    frames: [
      [
        "......rr......",
        "...rrrroor.rr.",
        ".rrooooyyoooor",
        "rooyyyyywyyyoo",
        "rooyyyyywyyyoo",
        ".rrooooyyoooor",
        "...rrrroor.rr.",
        "......rr......"
      ],
      [
        "...rr.........",
        ".rrrooor..rr..",
        "rroooyyyoorooo",
        "rooyyyywwyyyoo",
        "rooyyyywwyyyoo",
        "rrooooyyyoorro",
        ".rrrooor.rrr..",
        "....rr........"
      ],
      [
        "........rr....",
        "..rr.rrroor...",
        ".rooooyyyoooor",
        "rooyyyyywyyoo.",
        "rooyyyyywyyyoo",
        ".rooooyyoooor.",
        "...rrrooor.rr.",
        ".....rr......."
      ]
    ]
  };

  // a flat oval on the ground, in the grass colour's shadow
  var SHADOW = {
    palette: { s: "rgba(34,18,10,1)" },
    frames: [[
      "....ssssssss....",
      ".ssssssssssssss.",
      ".ssssssssssssss.",
      "....ssssssss...."
    ]]
  };

  var ENTRY = 1.8;          // seconds: flying in
  var LOOP = 2.8;           // seconds for one circle
  var LOOPS = 2;
  var EXIT = 2.6;           // seconds: flying off into the distance
  var NEAR_END = ENTRY + LOOPS * LOOP + EXIT;
  var FAR_SCALE = 0.5;      // far away it is half the size: 2px art pixels instead of 4px
  var FLAP = [0, 1, 2, 1];  // wing poses in order
  var STEP = 1 / 30;        // retro frame rate

  function sheetUrl(sprite, w, h) {
    var rects = [];
    sprite.frames.forEach(function (rows, f) {
      rows.forEach(function (row, y) {
        var x = 0;
        while (x < row.length) {
          var ch = row.charAt(x), run = 1;
          while (x + run < row.length && row.charAt(x + run) === ch) run++;
          if (ch !== ".") {
            rects.push('<rect x="' + (f * w + x) + '" y="' + y + '" width="' + run + '" height="1" fill="' + sprite.palette[ch] + '"/>');
          }
          x += run;
        }
      });
    });
    var n = sprite.frames.length;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (w * n) + " " + h + '" width="' + (w * n * SCALE) +
      '" height="' + (h * SCALE) + '" shape-rendering="crispEdges">' + rects.join("") + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function $(id) { return document.getElementById(id); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function snap(v, unit) { return Math.round(v / unit) * unit; }
  function bezier(p0, p1, p2, u) {
    var a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y };
  }
  function cubic(p0, p1, p2, p3, u) {
    var v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  }

  var flight = null;        // the dragon, or null: { mode: "near" | "far", ... }
  var forced = false;       // opened with ?dragon: keep it whatever the rules say
  var holdFar = false;      // a ceremony is on: no far dragon until the near flight takes over
  var inForce = false;      // both seals are set

  /** The stage must be on screen, or the circle goes over the middle of the window instead. */
  function stageVisible() {
    var stage = $("stage");
    if (!stage) return false;
    var r = stage.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  /** Where the near circle goes: over the heroes' stage if it was on screen when the flight began, else over the window. */
  function measure(f) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var rx = Math.max(60, Math.min(130, vw / 2 - 64));
    var stage = f.onStage ? $("stage") : null;
    var r = stage ? stage.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
      rx = Math.max(60, Math.min(130, r.width * 0.42, vw / 2 - 64));
      f.anchor = {
        cx: r.left + r.width / 2,
        cy: Math.max(r.top - 44, 56 + 30),          // keep the circle on screen, above the heroes' heads
        rx: rx,
        ry: 30,
        ground: { left: r.left, right: r.right, y: r.bottom - 10 }
      };
    } else if (!f.onStage || !f.anchor) {
      f.anchor = { cx: vw / 2, cy: Math.max(vh * 0.4, 120), rx: rx, ry: 36, ground: null };
    }
    return f.anchor;
  }

  /** The far orbit: a wide, flat loop high in the sky; it passes behind the scroll and comes out at the sides. */
  function orbit() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var rx = Math.max(150, vw * 0.44), ry = Math.max(28, vh * 0.07);
    var circ = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    var lap = Math.min(40, Math.max(16, circ / 95));        // roughly 95 px per second
    return { cx: vw / 2, cy: Math.max(110, vh * 0.25), rx: rx, ry: ry, omega: 2 * Math.PI / lap };
  }

  /** Position (the middle of the body), size and bobbing of the dragon at the time f.t. */
  function place(f) {
    var t = f.t, vw = window.innerWidth, dir = f.dir, p, scale = 1, bob = 4, m = null;
    if (f.mode === "near") {
      m = measure(f);
      var offX = dir > 0 ? -150 : vw + 150;                 // where it comes in from
      if (t < ENTRY) {
        p = bezier({ x: offX, y: m.cy - m.ry - 130 }, { x: m.cx - dir * (m.rx + vw * 0.2), y: m.cy - m.ry },
          { x: m.cx, y: m.cy - m.ry }, t / ENTRY);
      } else if (t < ENTRY + LOOPS * LOOP) {
        var a = -Math.PI / 2 + dir * 2 * Math.PI * (t - ENTRY) / LOOP;
        p = { x: m.cx + m.rx * Math.cos(a), y: m.cy + m.ry * Math.sin(a) };
      } else {
        // off into the distance: up and out to the edge of the far orbit, shrinking on the way
        var u = Math.min(1, (t - ENTRY - LOOPS * LOOP) / EXIT);
        var o = orbit();
        var from = { x: m.cx, y: m.cy - m.ry }, to = { x: o.cx + dir * o.rx, y: o.cy };
        var d = Math.max(140, Math.abs(to.x - from.x) * 0.55);
        p = cubic(from, { x: from.x + dir * d, y: from.y }, { x: to.x, y: to.y - d }, to, u);
        scale = 1 - (1 - FAR_SCALE) * (u * u * (3 - 2 * u));
      }
    } else {
      var far = orbit();
      var b = (dir > 0 ? 0 : Math.PI) + dir * far.omega * (t - f.farT0);
      p = { x: far.cx + far.rx * Math.cos(b), y: far.cy + far.ry * Math.sin(b) };
      scale = FAR_SCALE;
      bob = 2;
    }
    p.y += bob * Math.sin(2 * Math.PI * 1.9 * t);           // a little bobbing
    return { x: p.x, y: p.y, scale: scale, anchor: m };
  }

  function draw(f) {
    var at = place(f), t = f.t;
    var unit = SCALE * at.scale;
    var x = snap(at.x, unit), y = snap(at.y, unit);
    if (f.lastX !== null && x !== f.lastX) f.facing = x > f.lastX ? 1 : -1;
    f.lastX = x;

    var pose = FLAP[Math.floor(t * (f.mode === "far" ? 5.5 : 7.5)) % FLAP.length] + (f.breathing ? 3 : 0);
    f.body.style.backgroundPositionX = (-pose * BODY_W) + "px";
    f.root.style.transform = "translate3d(" + (x - CENTER_X) + "px," + (y - CENTER_Y) + "px,0) scale(" +
      (f.facing * at.scale) + "," + at.scale + ")";
    if (f.breathing) f.fire.style.backgroundPositionX = (-(Math.floor(t * 10) % 3) * FW * SCALE) + "px";

    // near: the shadow slides over the ground of the stage, smaller and paler the higher the dragon is
    var g = at.anchor && f.mode === "near" ? at.anchor.ground : null;
    if (g && at.scale === 1 && x > g.left + 16 && x < g.right - 16) {
      var height = g.y - y;
      var k = height > 160 ? 0.5 : height > 110 ? 0.75 : 1;
      f.shadow.style.opacity = height > 160 ? "0.2" : height > 110 ? "0.28" : "0.38";
      f.shadow.style.transform = "translate3d(" + (x - 32) + "px," + (g.y - 8) + "px,0) scale(" + k + ")";
      f.shadow.style.display = "block";
    } else {
      f.shadow.style.display = "none";
    }

    // far away it sometimes breathes a little fire, quietly, just for itself
    if (f.mode === "far" && !f.breathing && !f.looping && t >= f.nextPuff) {
      f.nextPuff = t + 24 + Math.random() * 20;
      breathe(1.1, true);
    }
  }

  function roar() {
    if (window.Ceremony && window.Ceremony.roar) window.Ceremony.roar(flight && flight.mode === "far" ? 0.4 : 1);
  }

  function breathe(seconds, silent) {
    var f = flight;
    if (!f || f.breathing) return;
    f.breathing = true;
    f.root.classList.add("is-breathing");
    if (!silent) roar();
    window.setTimeout(function () {
      f.breathing = false;
      f.root.classList.remove("is-breathing");
    }, seconds * 1000);
  }

  /** A click on the dragon: a loop-the-loop, and then a puff of fire. */
  function tease() {
    var f = flight;
    if (!f || f.looping || f.breathing) return;
    f.looping = true;
    f.root.classList.add("is-looping");
    roar();
    window.setTimeout(function () {
      f.looping = false;
      f.root.classList.remove("is-looping");
      if (flight === f) breathe(1.1);
    }, 800);
  }

  /** Take the dragon off the page. fade: let a far dragon melt into the sky first. */
  function remove(fade) {
    var f = flight;
    if (!f) return;
    flight = null;
    if (f.raf) window.cancelAnimationFrame(f.raf);
    function drop() { [f.root, f.shadow].forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); }
    if (fade && f.mode === "far") {
      f.root.classList.add("is-leaving");
      window.setTimeout(drop, 800);
    } else {
      drop();
    }
  }

  /**
   * Behind the scroll the far dragon would be hidden almost all the time on a phone, where the scroll nearly fills the
   * width. So when the strips of sky beside the scroll are narrow, it flies in front of the scroll instead.
   */
  function settleFar(f) {
    var world = $("world"), scroll = $("scroll"), vw = window.innerWidth;
    var sky = world ? world.getAttribute("data-sky") : null;
    if (sky) f.root.setAttribute("data-sky", sky);
    var over = false;
    if (scroll) {
      var r = scroll.getBoundingClientRect();
      over = r.width > 0 && Math.min(r.left, vw - r.right) < 60;
    }
    if (!world) over = true;
    if (f.over === over && f.root.parentNode) return;
    f.over = over;
    f.root.classList.toggle("is-over", over);
    if (over) document.body.appendChild(f.root);
    else world.insertBefore(f.root, $("world-land"));      // above the clouds, below the hills and trees
  }

  /** The near dragon is a speck by now: it moves into the sky behind the scroll and goes on circling there. */
  function becomeFar(f) {
    f.mode = "far";
    f.farT0 = f.t;
    f.nextPuff = f.t + 12 + Math.random() * 12;
    f.root.classList.add("is-far");
    f.over = null;
    settleFar(f);
    if (f.shadow.parentNode) f.shadow.parentNode.removeChild(f.shadow);
  }

  function tick(f, now) {
    if (flight !== f) return;
    if (f.last === null) f.last = now;
    var dt = Math.min(0.1, (now - f.last) / 1000);
    f.last = now;
    f.acc += dt;
    f.wall += dt;
    var moved = false;
    while (f.acc >= STEP) { f.acc -= STEP; f.t += STEP; moved = true; }
    if (f.mode === "near" && (f.t >= NEAR_END || f.wall > 40)) {
      f.t = Math.max(f.t, NEAR_END);
      becomeFar(f);
    }
    if (moved) draw(f);
    if (f.mode === "far" && now - f.layerCheck > 1000) { f.layerCheck = now; settleFar(f); }
    f.raf = window.requestAnimationFrame(function (n) { tick(f, n); });
  }

  /** mode "near": comes in from a side, circles over the heroes. mode "far": appears in the high orbit. */
  function launch(mode, dir) {
    var root = document.createElement("div");
    root.className = "hr-dragon";
    root.setAttribute("aria-hidden", "true");
    var body = document.createElement("div");
    body.className = "hr-dragon__body";
    body.style.backgroundImage = sheetUrl(SPRITE, W, H);
    var fire = document.createElement("div");
    fire.className = "hr-dragon__fire";
    fire.style.backgroundImage = sheetUrl(FIRE, FW, FH);
    root.appendChild(body);
    root.appendChild(fire);
    var shadow = document.createElement("div");
    shadow.className = "hr-dragon-shadow";
    shadow.setAttribute("aria-hidden", "true");
    shadow.style.backgroundImage = sheetUrl(SHADOW, 16, 4);

    var f = {
      mode: mode, root: root, body: body, fire: fire, shadow: shadow,
      dir: dir === -1 ? -1 : dir === 1 ? 1 : (Math.random() < 0.5 ? 1 : -1), facing: 1, lastX: null,
      breathing: false, looping: false, onStage: stageVisible(), anchor: null,
      t: 0, acc: 0, last: null, wall: 0, raf: 0, farT0: 0, nextPuff: 0, over: null, layerCheck: 0
    };
    f.facing = f.dir;
    flight = f;
    document.body.appendChild(shadow);
    if (mode === "far") {
      root.classList.add("is-far");
      root.style.opacity = "0";                         // fades in
      f.over = null;
      settleFar(f);
      f.nextPuff = 10 + Math.random() * 15;
      draw(f);
      window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { root.style.opacity = ""; }); });
    } else {
      document.body.appendChild(root);
      draw(f);
    }
    root.addEventListener("click", tease);
    f.raf = window.requestAnimationFrame(function (n) { tick(f, n); });
    return f;
  }

  /** Fly in, circle over the heroes, then off into the distance. opts.dir: 1 comes in from the left, -1 from the right. */
  function fly(opts) {
    if (reducedMotion()) return false;
    if (flight && flight.mode === "near") return false;
    if (flight) remove(false);
    holdFar = false;
    launch("near", opts && opts.dir);
    return true;
  }

  /** Put a dragon in the far orbit, if there is none yet. */
  function startFar(dir) {
    if (reducedMotion() || flight) return false;
    launch("far", dir);
    return true;
  }

  document.addEventListener("heroes:walk", function () { fly(); });
  document.addEventListener("heroes:met", function () {
    // The heroes have just met: a roar and a puff of fire from above.
    if (flight && flight.mode === "near" && !flight.breathing) breathe(1.5);
  });

  // The rules are in force: a dragon lives in the sky. A ceremony is about to play: it will fly in on its own.
  document.addEventListener("rules:state", function (e) {
    inForce = !!(e.detail && e.detail.inForce);
    if (!inForce) { holdFar = false; if (!forced) remove(true); return; }
    if (e.detail.ceremony) {                                  // the ceremony is coming: the dragon will fly in during it
      holdFar = true;
      if (!forced && flight && flight.mode === "far") remove(true);
      return;
    }
    if (!flight && !holdFar) startFar();
  });
  document.addEventListener("ceremony:play", function () {
    holdFar = true;
    if (!forced && flight && flight.mode === "far") remove(true);
  });

  // The far dragon sits behind the scroll and cannot be clicked itself, so watch for clicks on the sky around it.
  document.addEventListener("click", function (e) {
    if (!flight || flight.mode !== "far") return;
    var el = e.target;
    var skip = flight.over ? "#roll-toggle, #rolled-seal, dialog, button, a, input, label" : "#scroll, #roll-toggle, #rolled-seal, dialog, button, a, input, label";
    if (el && el.closest && el.closest(skip)) return;
    var r = flight.root.getBoundingClientRect(), pad = 16;
    if (e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad) tease();
  });

  var preview = /[?&]dragon(?:=([a-z]*))?(?:&|$)/.exec(window.location.search);
  if (preview) {
    forced = true;
    window.setTimeout(function () { if (preview[1] === "far") startFar(); else fly(); }, 900);
  }

  window.Dragon = {
    fly: fly,
    startFar: startFar,
    stop: function () { remove(true); },
    breathe: function () { breathe(1.5); },
    tease: tease,
    flying: function () { return !!flight; },
    mode: function () { return flight ? flight.mode : null }
  };
})();
