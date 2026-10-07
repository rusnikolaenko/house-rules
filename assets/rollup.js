/* House Rules: roll the scroll up and unroll it again.
 * The button sits in the bottom-right corner. A rolled-up scroll is tied with a ribbon and a wax seal;
 * clicking the seal or the rollers unrolls it. The ceremony unrolls it by itself.
 */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var scroll, toggle, seal, rolled = false, busy = false;

  function syncToggle() {
    var label = rolled ? "Unroll the scroll" : "Roll up the scroll";
    toggle.setAttribute("aria-expanded", rolled ? "false" : "true");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    toggle.querySelector(".hr-roll__text").textContent = rolled ? "Unroll" : "Roll up";
  }

  function finishRoll() {
    scroll.classList.remove("is-rolling-up");
    scroll.classList.add("is-rolled");
    document.body.classList.add("hr-is-rolled");
    seal.hidden = false;
    rolled = true;
    busy = false;
    syncToggle();
  }

  function rollUp() {
    if (rolled || busy) return;
    busy = true;
    var go = function () {
      window.Svitok.measure(scroll);
      scroll.classList.remove("sv-scroll--unroll");
      if (reducedMotion()) { finishRoll(); return; }
      void scroll.offsetWidth;
      scroll.classList.add("is-rolling-up");
    };
    if (window.scrollY > 4) {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      window.setTimeout(go, 450);
    } else {
      go();
    }
  }

  function unroll() {
    if (!rolled || busy) return;
    seal.hidden = true;
    document.body.classList.remove("hr-is-rolled");
    rolled = false;
    syncToggle();
    window.Svitok.unroll(scroll);
  }

  function init() {
    scroll = $("scroll");
    toggle = $("roll-toggle");
    seal = $("rolled-seal");
    if (!scroll || !toggle || !seal || !window.Svitok) return;
    var mark = seal.querySelector(".sv-seal__mark");
    if (mark) mark.innerHTML = window.Svitok.emblem("heart");
    scroll.querySelector(".sv-sheet-wrap").addEventListener("animationend", function (e) {
      if (e.animationName === "hr-roll-up") finishRoll();
    });
    toggle.addEventListener("click", function () { if (rolled) unroll(); else rollUp(); });
    seal.addEventListener("click", unroll);
    scroll.addEventListener("click", function (e) {
      if (rolled && e.target.classList && e.target.classList.contains("sv-roller")) unroll();
    });
    toggle.hidden = false;
    syncToggle();
  }
  init();

  window.ScrollToggle = { rollUp: rollUp, unroll: unroll, isRolled: function () { return rolled; } };
})();
