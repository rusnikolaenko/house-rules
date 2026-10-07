/* House Rules: the little dragon who circles over the two heroes while they walk towards each other.
 *
 * The dragon is a 26x22 pixel picture, drawn here as rows of letters; every letter is a colour from the
 * palette next to it ("." is empty). Six frames: three wing poses (up, middle, low), each with the mouth
 * closed and with the mouth open. The flame and the shadow are tiny pictures of their own. Like the heroes,
 * they are turned into small SVG strips at load time (no image files).
 *
 * heroes.js sends "heroes:walk" when the heroes set off and "heroes:met" when they meet. The dragon flies in
 * at the first one, circles twice over the stage, breathes fire and roars at the second, and flies away.
 * Click it while it flies: it loops the loop and breathes fire. Dragon.fly() starts a flight by hand, and
 * opening the page with ?dragon in the address does the same. With "reduce motion" on, there is no dragon.
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
  var EXIT = 2.0;           // seconds: flying away
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
  function snap(v) { return Math.round(v / SCALE) * SCALE; }
  function bezier(p0, p1, p2, u) {
    var a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y };
  }

  var flight = null;        // the flight in progress, or null

  /** The stage must be on screen, or the circle goes over the middle of the window instead. */
  function stageVisible() {
    var stage = $("stage");
    if (!stage) return false;
    var r = stage.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  /** Where the circle goes: over the heroes' stage if it was on screen when the flight began, else over the window. */
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

  function place(f, t) {
    var vw = window.innerWidth;
    var m = measure(f);
    var dir = f.dir;
    var offX = dir > 0 ? -150 : vw + 150;                 // where it comes in from
    var p;
    if (t < ENTRY) {
      p = bezier({ x: offX, y: m.cy - m.ry - 130 }, { x: m.cx - dir * (m.rx + vw * 0.2), y: m.cy - m.ry },
        { x: m.cx, y: m.cy - m.ry }, t / ENTRY);
    } else if (t < ENTRY + LOOPS * LOOP) {
      var a = -Math.PI / 2 + dir * 2 * Math.PI * (t - ENTRY) / LOOP;
      p = { x: m.cx + m.rx * Math.cos(a), y: m.cy + m.ry * Math.sin(a) };
    } else {
      var u = Math.min(1, (t - ENTRY - LOOPS * LOOP) / EXIT);
      p = bezier({ x: m.cx, y: m.cy - m.ry }, { x: m.cx + dir * (m.rx + vw * 0.2), y: m.cy - m.ry },
        { x: vw - offX, y: m.cy - m.ry - 150 }, u);
    }
    p.y += 4 * Math.sin(2 * Math.PI * 1.9 * t);           // a little bobbing
    return { x: p.x, y: p.y, anchor: m };
  }

  function draw(f, t) {
    var at = place(f, t);
    var x = snap(at.x), y = snap(at.y);
    if (f.lastX !== null && x !== f.lastX) f.facing = x > f.lastX ? 1 : -1;
    f.lastX = x;

    var pose = FLAP[Math.floor(t * 7.5) % FLAP.length] + (f.breathing ? 3 : 0);
    f.body.style.backgroundPositionX = (-pose * BODY_W) + "px";
    f.root.style.transform = "translate3d(" + (x - CENTER_X) + "px," + (y - CENTER_Y) + "px,0) scaleX(" + f.facing + ")";
    if (f.breathing) f.fire.style.backgroundPositionX = (-(Math.floor(t * 10) % 3) * FW * SCALE) + "px";

    // the shadow slides over the ground of the stage, smaller and paler the higher the dragon is
    var g = at.anchor.ground;
    if (g && x > g.left + 16 && x < g.right - 16) {
      var height = g.y - y;
      var k = height > 160 ? 0.5 : height > 110 ? 0.75 : 1;
      f.shadow.style.opacity = height > 160 ? "0.2" : height > 110 ? "0.28" : "0.38";
      f.shadow.style.transform = "translate3d(" + (x - 32) + "px," + (g.y - 8) + "px,0) scale(" + k + ")";
      f.shadow.style.display = "block";
    } else {
      f.shadow.style.display = "none";
    }
  }

  function roar() {
    if (window.Ceremony && window.Ceremony.roar) window.Ceremony.roar();
  }

  function breathe(seconds) {
    if (!flight || flight.breathing) return;
    flight.breathing = true;
    flight.root.classList.add("is-breathing");
    roar();
    window.setTimeout(function () {
      if (!flight) return;
      flight.breathing = false;
      flight.root.classList.remove("is-breathing");
    }, seconds * 1000);
  }

  /** A click on the dragon: a loop-the-loop, and then a puff of fire. */
  function tease() {
    if (!flight || flight.looping || flight.breathing) return;
    flight.looping = true;
    flight.root.classList.add("is-looping");
    roar();
    window.setTimeout(function () {
      if (!flight) return;
      flight.looping = false;
      flight.root.classList.remove("is-looping");
      breathe(1.1);
    }, 800);
  }

  function finish() {
    if (!flight) return;
    if (flight.raf) window.cancelAnimationFrame(flight.raf);
    [flight.root, flight.shadow].forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    flight = null;
  }

  /** Fly in, circle over the heroes, fly away. opts.dir: 1 comes in from the left, -1 from the right. */
  function fly(opts) {
    if (flight || reducedMotion()) return false;
    opts = opts || {};

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

    var dir = opts.dir === -1 ? -1 : opts.dir === 1 ? 1 : (Math.random() < 0.5 ? 1 : -1);
    flight = {
      root: root, body: body, fire: fire, shadow: shadow, dir: dir, facing: dir, lastX: null,
      breathing: false, looping: false, raf: 0, onStage: stageVisible(), anchor: null
    };
    document.body.appendChild(shadow);
    document.body.appendChild(root);
    root.addEventListener("click", tease);

    var t = 0, acc = 0, last = null, wall = 0;
    draw(flight, 0);
    function tick(now) {
      if (!flight) return;
      if (last === null) last = now;
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      wall += dt;
      var moved = false;
      while (acc >= STEP) { acc -= STEP; t += STEP; moved = true; }
      if (moved) draw(flight, t);
      if (t >= ENTRY + LOOPS * LOOP + EXIT || wall > 40) finish();
      else flight.raf = window.requestAnimationFrame(tick);
    }
    flight.raf = window.requestAnimationFrame(tick);
    return true;
  }

  document.addEventListener("heroes:walk", function () { fly(); });
  document.addEventListener("heroes:met", function () {
    // The heroes have just met: a roar and a puff of fire from above.
    if (flight && !flight.breathing) breathe(1.5);
  });

  if (/[?&]dragon(=|&|$)/.test(window.location.search)) {
    window.setTimeout(function () { fly(); }, 900);
  }

  window.Dragon = {
    fly: fly,
    breathe: function () { breathe(1.5); },
    tease: tease,
    flying: function () { return !!flight; }
  };
})();
