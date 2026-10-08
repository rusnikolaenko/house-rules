/* House Rules: our map (map.html).
 *
 * A live map of the whole world, from OpenStreetMap data, drawn in the colours of the scroll and at a quarter of
 * the screen resolution, so every map pixel is a 4x4 block: pixel art at any zoom, from the planet to one street.
 * The engine is MapLibre (assets/vendor/maplibre), the map data comes from OpenFreeMap (free, no keys).
 * On top of it: our places (hearts, from places.json), the countries we have been to, the two heroes at home,
 * and a few drawn touches: a castle, ships, a compass. If the map server can't be reached, a drawn world map
 * (assets/map/world.png) is shown instead, with the same hearts on it.
 * Preview the drawn map: map.html?fallback
 */
(function () {
  "use strict";

  var TILES = "https://tiles.openfreemap.org/planet";
  var PX = 4;                       // one map pixel = 4 CSS pixels, the art pixel of the whole site
  var NEAR = 8.5, STREET = 11.5, WORLD = 4.5;   // zoom levels where the decorations change

  var C = {
    land: "#e8d3a0", town: "#ddc58f", sea: "#86b6cc", seaEdge: "#3d6b8a", grass: "#93b847", wood: "#4c7a2c",
    wet: "#7aa35b", sand: "#efd893", ice: "#f4f0e0", farm: "#e2cf96", building: "#d4b67a", buildingEdge: "#b48c52",
    road: "#f4e6bf", roadEdge: "#8a6436", major: "#f6d36b", majorEdge: "#95621a", steel: "#8d969b",
    wax: "#d4473b", waxDark: "#a3201c", border: "#b48c52"
  };

  // ------------------------------------------------------------ small pictures (rows of letters, like heroes.js)
  var PAL = { k: "#22120a", r: "#d4473b", R: "#a3201c", p: "#f3a6b0", y: "#f6d36b", Y: "#dca12c", w: "#f4e6bf",
    n: "#a86d3b", M: "#42230e", b: "#3d6b8a" };
  var ART = {
    heart: [".kk.kk.", "kprkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."],
    castle: ["....y....", "...kyk...", "..krrrk..", "k.krRrk.k", "krkrRrkrk", "krrrrrrrk", "krrkkkrrk", "krrkMkrrk", "kkkkkkkkk"],
    ship: ["....k....", "...kwk...", "..kwwwk..", ".kwwwwwk.", "....k....", "kkkkkkkkk", ".knnnnnk.", "..kkkkk.."],
    compass: [".......r.......", "......rrr......", ".......k.......", ".......k.......", "...k...k...k...", "....k..k..k....",
      ".....k.k.k.....", "kkkkkkkykkkkkkk", ".....k.k.k.....", "....k..k..k....", "...k...k...k...", ".......k.......",
      ".......k.......", ".......k.......", "..............."]
  };
  function svg(rows, pal) {
    var rects = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var ch = row.charAt(x), run = 1;
        while (x + run < row.length && row.charAt(x + run) === ch) run++;
        if (ch !== ".") rects.push('<rect x="' + x + '" y="' + y + '" width="' + run + '" height="1" fill="' + pal[ch] + '"/>');
        x += run;
      }
    });
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + rows[0].length + " " + rows.length +
      '" shape-rendering="crispEdges">' + rects.join("") + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  }
  function sprite(name, cls, label) {
    var el = document.createElement(label ? "button" : "span");
    el.className = "hr-sprite " + cls;
    el.style.backgroundImage = svg(ART[name], PAL);
    el.style.width = ART[name][0].length * PX + "px";
    el.style.height = ART[name].length * PX + "px";
    if (label) { el.type = "button"; el.setAttribute("aria-label", label); } else el.setAttribute("aria-hidden", "true");
    return el;
  }

  function $(id) { return document.getElementById(id); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function fmtDate(s) {
    s = String(s || "");
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
    if (!m) return s;
    var d = new Date(+m[1], +m[2] - 1, +(m[3] || 1));
    return d.toLocaleDateString("en-GB", m[3] ? { day: "numeric", month: "long", year: "numeric" } : { month: "long", year: "numeric" });
  }

  // ------------------------------------------------------------ our data (places.json)
  var data = { home: { name: "Moscow", lng: 37.6176, lat: 55.7558 }, countries: [], places: [] };
  function loadPlaces() {
    return fetch("places.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        if (d && typeof d === "object") {
          if (d.home && isFinite(d.home.lng) && isFinite(d.home.lat)) data.home = d.home;
          if (Array.isArray(d.countries)) data.countries = d.countries.map(function (c) { return String(c).toUpperCase(); });
          if (Array.isArray(d.places)) data.places = d.places.filter(function (p) { return p && isFinite(p.lng) && isFinite(p.lat); });
        }
        data.places.sort(function (a, b) { return String(a.date || "9999") < String(b.date || "9999") ? -1 : 1; });
        var st = $("map-stats");
        if (st) {
          var n = data.places.length, c = data.countries.length;
          st.textContent = n + (n === 1 ? " place" : " places") + " · " + c + (c === 1 ? " country" : " countries") + " together";
        }
      });
  }

  // ------------------------------------------------------------ the look: our own style over OpenMapTiles data
  function zoomed(stops) { return ["interpolate", ["linear"], ["zoom"]].concat(stops); }
  function is(field, values) { return ["in", ["get", field], ["literal", values]]; }
  var NOT_TUNNEL = ["!=", ["get", "brunnel"], "tunnel"];

  function style() {
    var omt = "omt";
    var line = function (id, filter, color, width, minzoom) {
      return { id: id, type: "line", source: omt, "source-layer": "transportation", minzoom: minzoom || 0,
        filter: ["all", filter, NOT_TUNNEL], layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": width } };
    };
    var MAJOR = is("class", ["motorway", "trunk", "primary"]), MID = is("class", ["secondary", "tertiary"]);
    return {
      version: 8,
      sources: {
        omt: { type: "vector", url: TILES, attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
          '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
          'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
        countries: { type: "geojson", data: "assets/map/countries.json",
          attribution: '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>' }
      },
      layers: [
        { id: "land", type: "background", paint: { "background-color": C.land } },
        { id: "landcover", type: "fill", source: omt, "source-layer": "landcover",
          filter: is("class", ["wood", "grass", "wetland", "sand", "ice", "farmland"]),
          paint: { "fill-antialias": false, "fill-color": ["match", ["get", "class"], "wood", C.wood, "grass", C.grass,
            "wetland", C.wet, "sand", C.sand, "ice", C.ice, "farmland", C.farm, C.land] } },
        { id: "town", type: "fill", source: omt, "source-layer": "landuse", minzoom: 9, filter: is("class", ["residential"]),
          paint: { "fill-antialias": false, "fill-color": C.town } },
        { id: "park", type: "fill", source: omt, "source-layer": "park", filter: ["!=", ["get", "class"], "protected_area"],
          paint: { "fill-antialias": false, "fill-color": C.grass } },
        { id: "visited", type: "fill", source: "countries", filter: ["in", ["get", "iso"], ["literal", []]],
          paint: { "fill-antialias": false, "fill-color": C.wax, "fill-opacity": zoomed([0, 0.28, 6, 0.16, 9, 0]) } },
        { id: "water", type: "fill", source: omt, "source-layer": "water", paint: { "fill-antialias": false, "fill-color": C.sea } },
        { id: "water-edge", type: "line", source: omt, "source-layer": "water", paint: { "line-color": C.seaEdge, "line-width": PX } },
        { id: "river", type: "line", source: omt, "source-layer": "waterway", minzoom: 6, filter: is("class", ["river"]),
          paint: { "line-color": C.sea, "line-width": zoomed([8, PX, 13, 2 * PX, 16, 4 * PX]) } },
        { id: "stream", type: "line", source: omt, "source-layer": "waterway", minzoom: 13, filter: is("class", ["canal", "stream"]),
          paint: { "line-color": C.sea, "line-width": PX } },
        { id: "building", type: "fill", source: omt, "source-layer": "building", minzoom: 13,
          paint: { "fill-antialias": false, "fill-color": C.building, "fill-outline-color": C.buildingEdge } },
        line("rail", is("class", ["rail"]), C.steel, PX, 11),
        line("road-minor", is("class", ["minor", "service"]), C.road, zoomed([13, PX, 16, 3 * PX]), 13),
        line("road-mid-edge", MID, C.roadEdge, zoomed([10, PX, 12, 2 * PX, 16, 5 * PX]), 10),
        line("road-mid", MID, C.road, zoomed([11.9, 0, 12, PX, 16, 3 * PX]), 12),
        line("road-major-edge", MAJOR, C.majorEdge, zoomed([5, PX, 8, PX, 12, 3 * PX, 16, 7 * PX]), 5),
        line("road-major", MAJOR, C.major, zoomed([7.9, 0, 8, PX, 12, 2 * PX, 16, 5 * PX]), 8),
        { id: "border-region", type: "line", source: omt, "source-layer": "boundary", minzoom: 4,
          filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
          paint: { "line-color": C.border, "line-width": PX, "line-dasharray": [1, 1] } },
        { id: "border", type: "line", source: omt, "source-layer": "boundary",
          filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
          paint: { "line-color": C.waxDark, "line-opacity": zoomed([0, 0.5, 4, 0.85]), "line-width": zoomed([0, PX, 7, PX, 10, 2 * PX]),
            "line-dasharray": [2, 1] } },
        { id: "visited-edge", type: "line", source: "countries", filter: ["in", ["get", "iso"], ["literal", []]],
          paint: { "line-color": C.waxDark, "line-width": PX, "line-opacity": zoomed([0, 0.9, 6, 0.6, 8, 0]) } }
      ]
    };
  }

  // ------------------------------------------------------------ names, in the pixel fonts of the site
  var labels = [];
  function nameOf(p) {
    var n = p.name_en || p.name_int || p["name:en"] || p["name:latin"] || p.name || "";
    return n.length > 1 ? n : "";
  }
  function wanted(p, z) {
    var cls = p["class"], rank = +p.rank || 99, cap = +p.capital || 0;
    if (cls === "country") return z < 5.5 && rank <= (z < 2 ? 2 : z < 3 ? 4 : 6);
    if (cls === "city") return z >= 5 || (z >= 3 && cap === 2);
    if (cls === "town") return z >= 8;
    if (cls === "suburb") return z >= 12;
    return false;
  }
  function weight(p) {
    var cls = p["class"];
    return (cls === "country" ? 0 : +p.capital === 2 ? 100 : cls === "city" ? 200 : cls === "town" ? 300 : 400) + (+p.rank || 50);
  }
  function updateLabels() {
    if (!map) return;
    labels.forEach(function (m) { m.remove(); });
    labels = [];
    var z = map.getZoom(), seen = {}, boxes = [], cand = [];
    var w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
    var feats = [];
    try { feats = map.querySourceFeatures("omt", { sourceLayer: "place" }); } catch (e) { return; }
    var cx = map.getCenter().lng;
    feats.forEach(function (f) {
      var p = f.properties, name = nameOf(p), gm = f.geometry;
      if (!name || !wanted(p, z)) return;
      var ll = gm.type === "Point" ? gm.coordinates : gm.type === "MultiPoint" ? gm.coordinates[0] : null;
      if (!ll) return;
      var key = p["class"] + "|" + name;
      if (seen[key]) return;
      seen[key] = true;
      var lng = ll[0];                               // the copy of the world we are looking at
      while (lng - cx > 180) lng -= 360;
      while (lng - cx < -180) lng += 360;
      cand.push({ p: p, name: name, ll: [lng, ll[1]] });
    });
    cand.sort(function (a, b) { return weight(a.p) - weight(b.p); });
    // our home and our hearts keep their space
    data.places.concat([data.home]).forEach(function (pl) {
      var pt = map.project([pl.lng, pl.lat]);
      boxes.push([pt.x - 16, pt.y - 28, pt.x + 16, pt.y + 4]);
    });
    for (var i = 0; i < cand.length && labels.length < 40; i++) {
      var c = cand[i], country = c.p["class"] === "country";
      var pt = map.project(c.ll);
      var bw = country ? c.name.length * 8 + 8 : c.name.length * 8 + 16, bh = country ? 16 : 20;
      var box = country ? [pt.x - bw / 2, pt.y - bh / 2, pt.x + bw / 2, pt.y + bh / 2] : [pt.x - 6, pt.y - bh / 2, pt.x + bw, pt.y + bh / 2];
      if (box[2] < 0 || box[0] > w || box[3] < 0 || box[1] > h) continue;
      var hit = boxes.some(function (b) { return !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]); });
      if (hit) continue;
      boxes.push(box);
      var el = document.createElement("span");
      el.className = "hr-label " + (country ? "hr-label--country" : "hr-label--place");
      el.setAttribute("aria-hidden", "true");
      el.textContent = c.name;
      labels.push(new maplibregl.Marker({ element: el, anchor: country ? "center" : "left", offset: country ? [0, 0] : [-4, 0] })
        .setLngLat(c.ll).addTo(map));
    }
  }

  // ------------------------------------------------------------ our places, the heroes, the drawn touches
  function heroesCanvas() {
    var cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = 30; cv.height = 18;
    var sp = window.Heroes && window.Heroes.sprites;
    if (!sp) return cv;
    [["him", 0], ["her", 13]].forEach(function (h) {
      var hero = sp[h[0]];
      hero.frames[0].forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) {
          var ch = row.charAt(x);
          if (ch === "." || !hero.palette[ch]) continue;
          g.fillStyle = hero.palette[ch];
          g.fillRect(h[1] + x - 1, y, 1, 1);
        }
      });
    });
    cv.className = "hr-heroes";
    cv.setAttribute("aria-hidden", "true");
    return cv;
  }

  var card = null, current = null;
  function openCard(pl) {
    current = pl;
    card = $("map-card");
    $("card-date").textContent = fmtDate(pl.date) || "";
    $("card-date").hidden = !pl.date;
    $("card-title").textContent = pl.name || "A place of ours";
    $("card-note").textContent = pl.note || "";
    $("card-note").hidden = !pl.note;
    $("card-example").hidden = !pl.example;
    $("card-closer").hidden = !map;
    card.hidden = false;
  }
  function closeCard() { if (card) card.hidden = true; current = null; }

  function go(center, zoom) {
    if (!map) return;
    if (reducedMotion()) map.jumpTo({ center: center, zoom: zoom });
    else map.flyTo({ center: center, zoom: zoom, duration: 2600, essential: true });
  }

  function addMarkers() {
    var home = data.home;
    var castle = sprite("castle", "hr-castle", "Home: " + (home.name || "home"));
    castle.addEventListener("click", function () { go([home.lng, home.lat], 11); });
    new maplibregl.Marker({ element: castle, anchor: "bottom" }).setLngLat([home.lng, home.lat]).addTo(map);
    var heroes = heroesCanvas();
    new maplibregl.Marker({ element: heroes, anchor: "bottom-right", offset: [-6, -2] }).setLngLat([home.lng, home.lat]).addTo(map);
    [[-35, 25], [-140, 10], [75, -25], [-150, -38], [-30, -35]].forEach(function (ll, i) {
      var wrap = document.createElement("div"), ship = sprite("ship", "hr-ship", null);
      wrap.className = "hr-ship-wrap";
      ship.style.animationDelay = -i * 0.4 + "s";
      wrap.appendChild(ship);
      new maplibregl.Marker({ element: wrap, anchor: "center" }).setLngLat(ll).addTo(map);
    });
    data.places.forEach(function (pl) {
      var wrap = document.createElement("div");
      wrap.className = "hr-pin";
      // seen from far away, the castle stands for every place in our home city
      if (Math.abs(pl.lat - home.lat) < 0.5 && Math.abs(pl.lng - home.lng) < 0.9) wrap.classList.add("is-home-city");
      var heart = sprite("heart", "hr-pin__heart", (pl.name || "A place") + (pl.date ? ", " + fmtDate(pl.date) : ""));
      heart.addEventListener("click", function (e) { e.stopPropagation(); openCard(pl); });
      var name = document.createElement("span");
      name.className = "hr-pin__name";
      name.setAttribute("aria-hidden", "true");
      name.textContent = pl.name || "";
      wrap.appendChild(heart);
      wrap.appendChild(name);
      new maplibregl.Marker({ element: wrap, anchor: "bottom" }).setLngLat([pl.lng, pl.lat]).addTo(map);
    });
  }

  function zoomClasses() {
    var z = map.getZoom(), el = map.getContainer();
    el.classList.toggle("is-world", z < WORLD);
    el.classList.toggle("is-near", z >= NEAR);
    el.classList.toggle("is-street", z >= STREET);
  }

  function buildList() {
    var ol = $("map-list-items");
    ol.innerHTML = "";
    data.places.forEach(function (pl) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<span class="hr-list__date"></span><span class="hr-list__name"></span>';
      b.firstChild.textContent = fmtDate(pl.date) || "—";
      b.lastChild.textContent = pl.name || "A place of ours";
      b.addEventListener("click", function () {
        go([pl.lng, pl.lat], 15);
        openCard(pl);
        if (window.innerWidth < 640) toggleList(false);
      });
      li.appendChild(b);
      ol.appendChild(li);
    });
    if (!data.places.length) {
      var li = document.createElement("li");
      li.className = "hr-list__empty";
      li.textContent = "No places yet: add them to places.json";
      ol.appendChild(li);
    }
  }
  function toggleList(force) {
    var panel = $("map-list"), btn = $("map-places");
    var open = typeof force === "boolean" ? force : panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // ------------------------------------------------------------ the drawn map, when the live one can't load
  var fellBack = false;
  function mercY(lat) { var s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); }
  function fallback(reason) {
    if (fellBack) return;
    fellBack = true;
    if (map) { try { map.remove(); } catch (e) { /* already gone */ } map = null; }
    document.body.classList.add("is-fallback");
    var box = $("map-fallback");
    box.hidden = false;
    var stage = $("drawn-stage"), y0 = mercY(82), y1 = mercY(-58);
    var put = function (el, lng, lat) {
      el.style.left = ((lng + 180) / 360 * 100).toFixed(3) + "%";
      el.style.top = ((mercY(Math.max(-58, Math.min(82, lat))) - y0) / (y1 - y0) * 100).toFixed(3) + "%";
      stage.appendChild(el);
    };
    put(sprite("castle", "hr-drawn__mark hr-castle", null), data.home.lng, data.home.lat);
    data.places.forEach(function (pl) {
      var heart = sprite("heart", "hr-drawn__mark hr-pin__heart", (pl.name || "A place") + (pl.date ? ", " + fmtDate(pl.date) : ""));
      heart.addEventListener("click", function () { openCard(pl); });
      put(heart, pl.lng, pl.lat);
    });
    fitDrawn();
    window.addEventListener("resize", fitDrawn);
    if (reason && window.console) console.info("House Rules map: showing the drawn map (" + reason + ")");
  }
  function fitDrawn() {
    var stage = $("drawn-stage");
    if (!stage) return;
    var room = Math.min(window.innerWidth - 32, (window.innerHeight - 200) * 1.6);
    var k = room / 512;
    k = k >= 1 ? Math.floor(k) || 1 : k;
    stage.style.width = Math.round(512 * k) + "px";
    stage.style.height = Math.round(320 * k) + "px";
  }

  // ------------------------------------------------------------ start
  var map = null;
  function start() {
    var q = window.location.search;
    $("map-places").addEventListener("click", function () { toggleList(); });
    $("card-close").addEventListener("click", closeCard);
    $("card-closer").addEventListener("click", function () { if (current) go([current.lng, current.lat], 16); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeCard(); toggleList(false); }
    });
    buildList();
    var compass = document.querySelector(".hr-map__compass");
    if (compass) compass.style.backgroundImage = svg(ART.compass, PAL);
    if (/[?&]fallback\b/.test(q)) { fallback("asked for it"); return; }
    if (!window.maplibregl) { fallback("no map engine"); return; }

    var home = [data.home.lng, data.home.lat];
    var intro = !/^#\d/.test(window.location.hash) && !reducedMotion();
    try {
      map = new maplibregl.Map({
        container: "map", style: style(), hash: true,
        center: intro ? [home[0], 35] : home, zoom: intro ? 0.6 : 10,
        minZoom: 0, maxZoom: 16.5, pixelRatio: 1 / PX, antialias: false, fadeDuration: 0,
        dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false
      });
    } catch (e) { fallback("no WebGL"); return; }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    var tilesSeen = false;
    map.on("sourcedata", function (e) { if (e.sourceId === "omt" && e.tile) tilesSeen = true; });
    map.on("error", function (e) {
      var src = e && e.sourceId;
      if (!tilesSeen && (src === "omt" || /openfreemap/i.test(String(e && e.error && e.error.message)))) {
        window.setTimeout(function () { if (!tilesSeen) fallback("map server unreachable"); }, 2500);
      }
    });
    window.setTimeout(function () { if (!tilesSeen) fallback("map server too slow"); }, 15000);
    map.on("webglcontextlost", function () { fallback("WebGL lost"); });

    map.on("load", function () {
      var filter = ["in", ["get", "iso"], ["literal", data.countries]];
      map.setFilter("visited", filter);
      map.setFilter("visited-edge", filter);
      addMarkers();
      zoomClasses();
      var attrib = document.querySelector(".maplibregl-ctrl-attrib");    // the credits stay one tap away
      if (attrib) attrib.classList.remove("maplibregl-compact-show");
      if (intro) window.setTimeout(function () { map.flyTo({ center: home, zoom: 10, duration: 4800, essential: true }); }, 700);
    });
    map.on("zoom", zoomClasses);
    map.on("idle", updateLabels);
    map.on("movestart", function () { map.getContainer().classList.add("is-moving"); });
    map.on("moveend", function () { map.getContainer().classList.remove("is-moving"); });
    map.on("click", function (e) {                    // a click on the map, not on a heart, puts the card away
      var t = e.originalEvent && e.originalEvent.target;
      if (t && t.closest && t.closest(".maplibregl-marker")) return;
      closeCard();
    });

    $("map-in").addEventListener("click", function () { map && map.zoomIn(); });
    $("map-out").addEventListener("click", function () { map && map.zoomOut(); });
    $("map-home").addEventListener("click", function () { go([data.home.lng, data.home.lat], 10); });
    $("map-world").addEventListener("click", function () {
      if (!map) return;
      var z = Math.max(0, Math.log(map.getContainer().clientWidth / 512) / Math.LN2);
      go([20, 30], z);
    });
  }

  loadPlaces().then(start);
  window.HouseMap = { map: function () { return map; }, data: data, fallback: fallback };
})();
