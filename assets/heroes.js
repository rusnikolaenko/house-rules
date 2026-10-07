/* House Rules: the two little heroes who meet under the seals.
 *
 * Each hero is a 16x18 pixel picture, drawn here as rows of letters; every letter is a colour from the
 * palette next to it ("." is empty). Three frames each: standing, and two steps for the walk.
 * Change a colour in a palette to change the hair, the tunic or the dress. The pictures are turned into
 * a small SVG strip at load time (no image files). ceremony.js tells the heroes when to walk.
 */
(function () {
  "use strict";

  var W = 16, H = 18, SCALE = 4;

  var HEROES = {
    him: {
      // h, H hair and its highlight; t, T tunic and its shade; p trousers; w belt and grip; a, A steel
      palette: {
        h: "#3b2417",
        H: "#6a4529",
        t: "#4c7a2c",
        T: "#355a1d",
        p: "#5a3a1f",
        w: "#74441f",
        k: "#22120a",
        s: "#e9b98a",
        S: "#c98f5c",
        e: "#22120a",
        m: "#a3201c",
        r: "#e08a72",
        g: "#f6d36b",
        G: "#dca12c",
        j: "#86b6cc",
        J: "#3d6b8a",
        b: "#42230e",
        a: "#d5dbdd",
        A: "#8d969b"
      },
      frames: [
      // standing
      [
        "................",
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhhhhhhhk...",
        "...khsssssshkkkk",
        "...kssessesskkak",
        "...kssessesskkak",
        "...krssmmssrkkak",
        "....kkkkkkkk.kak",
        "....kTttttTk.kak",
        "....kTwggwTk.kAk",
        "....kTttttTksgg.",
        "....kttttttk.wk.",
        "....kppkkppk....",
        "....kbbkkbbk....",
        "....kkkkkkkk...."
      ],
      // step, left foot out
      [
        "................",
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhhhhhhhk...",
        "...khsssssshkkkk",
        "...kssessesskkak",
        "...kssessesskkak",
        "...krssmmssrkkak",
        "....kkkkkkkk.kak",
        "....kTttttTk.kak",
        "....kTwggwTk.kAk",
        "....kTttttTksgg.",
        "....kttttttk.wk.",
        "...kppk.kbbk....",
        "...kbbk.kkkk....",
        "...kkkk........."
      ],
      // step, right foot out
      [
        "................",
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhhhhhhhk...",
        "...khsssssshkkkk",
        "...kssessesskkak",
        "...kssessesskkak",
        "...krssmmssrkkak",
        "....kkkkkkkk.kak",
        "....kTttttTk.kak",
        "....kTwggwTk.kAk",
        "....kTttttTksgg.",
        "....kttttttk.wk.",
        "....kbbk.kppk...",
        "....kkkk.kbbk...",
        ".........kkkk..."
      ]
      ]
    },
    her: {
      // h, H hair (chestnut) and its highlight; d, D, u dress, its shade and its light; j, J gem; g, G gold
      palette: {
        h: "#6e3b1e",
        H: "#a0602f",
        d: "#a3201c",
        D: "#64100f",
        u: "#d4473b",
        k: "#22120a",
        s: "#e9b98a",
        S: "#c98f5c",
        e: "#22120a",
        m: "#a3201c",
        r: "#e08a72",
        g: "#f6d36b",
        G: "#dca12c",
        j: "#86b6cc",
        J: "#3d6b8a",
        b: "#42230e",
        a: "#d5dbdd",
        A: "#8d969b"
      },
      frames: [
      // standing
      [
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhgjjghhk...",
        "...khsssssshk...",
        "...khsesseshk...",
        "...kHsesseshk...",
        "...khrsmmsrhk...",
        "...khkkkkkkhk...",
        "...khddjjddhk...",
        "...kHgggggghk...",
        "...khddddddhk...",
        "...kuddddddDk...",
        "..kuddddddddDk..",
        "..kGGkbbkkbbkk..",
        ".....kkkkkkkk...",
        "................"
      ],
      // step, left foot out
      [
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhgjjghhk...",
        "...khsssssshk...",
        "...khsesseshk...",
        "...kHsesseshk...",
        "...khrsmmsrhk...",
        "...khkkkkkkhk...",
        "...khddjjddhk...",
        "...kHgggggghk...",
        "...khddddddhk...",
        "...kuddddddDk...",
        "..kuddddddddDk..",
        "..kGkbbkGGGGGk..",
        "....kkkk........",
        "................"
      ],
      // step, right foot out
      [
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhHHhhhk...",
        "...khhgjjghhk...",
        "...khsssssshk...",
        "...khsesseshk...",
        "...kHsesseshk...",
        "...khrsmmsrhk...",
        "...khkkkkkkhk...",
        "...khddjjddhk...",
        "...kHgggggghk...",
        "...khddddddhk...",
        "...kuddddddDk...",
        "..kuddddddddDk..",
        "..kGGGGGGGkbbk..",
        "..........kkkk..",
        "................"
      ]
      ]
    }
  };

  function sheetUrl(hero) {
    var rects = [];
    hero.frames.forEach(function (rows, f) {
      rows.forEach(function (row, y) {
        var x = 0;
        while (x < row.length) {
          var ch = row.charAt(x), run = 1;
          while (x + run < row.length && row.charAt(x + run) === ch) run++;
          if (ch !== ".") {
            rects.push('<rect x="' + (f * W + x) + '" y="' + y + '" width="' + run + '" height="1" fill="' + hero.palette[ch] + '"/>');
          }
          x += run;
        }
      });
    });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (W * 3) + " " + H + '" width="' + (W * 3 * SCALE) +
      '" height="' + (H * SCALE) + '" shape-rendering="crispEdges">' + rects.join("") + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function $(id) { return document.getElementById(id); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var stage = null;
  var state = "met";          // "met" (standing together), "apart" (waiting at the edges), "walking"

  function setState(next) {
    var before = state;
    state = next;
    stage.classList.toggle("is-met", next === "met");
    stage.classList.toggle("is-walking", next === "walking");
    // Others (the dragon) can watch the story: they set off, and then they meet.
    if (next === "walking") announce("heroes:walk");
    else if (next === "met" && before === "walking") announce("heroes:met");
  }

  function announce(name) {
    try { stage.dispatchEvent(new CustomEvent(name, { bubbles: true })); } catch (e) { /* very old browser: no show */ }
  }

  /** Put the heroes at the two edges of the stage, standing and waiting. */
  function reset() {
    if (stage) setState("apart");
  }

  /** Meet at once, without walking. */
  function settle() {
    if (stage) setState("met");
  }

  /** Walk towards each other and meet. Does nothing unless they are waiting at the edges. */
  function walk() {
    if (!stage || state !== "apart") return;
    if (reducedMotion()) { setState("met"); return; }
    setState("walking");
  }

  function hop() {
    if (!stage || state !== "met" || reducedMotion()) return;
    stage.classList.remove("is-hop");
    void stage.offsetWidth;
    stage.classList.add("is-hop");
    window.setTimeout(function () { stage.classList.remove("is-hop"); }, 560);
  }

  function init() {
    stage = $("stage");
    if (!stage) return;
    $("hero-him").style.backgroundImage = sheetUrl(HEROES.him);
    $("hero-her").style.backgroundImage = sheetUrl(HEROES.her);
    stage.addEventListener("animationend", function (e) {
      if ((e.animationName === "hr-walk-him" || e.animationName === "hr-walk-her") && state === "walking") {
        setState("met");
      }
    });
    stage.addEventListener("click", hop);
  }
  init();

  window.Heroes = { reset: reset, walk: walk, settle: settle, hop: hop };
})();
