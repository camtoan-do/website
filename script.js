// Theme runs right away (script sits in <head>) so the page never flashes the wrong colours.
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  root.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initTheme() {
    var buttons = document.querySelectorAll("[data-theme-set]");
    function sync() {
      var current = root.getAttribute("data-theme") || "system";
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.themeSet === current)); });
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.dataset.themeSet;
        if (v === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v);
        try { if (v === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", v); } catch (e) {}
        sync();
      });
    });
    sync();
  }

  // Hero name: each letter flies in from a random spot once the page loads.
  function initName() {
    var h1 = document.querySelector(".hero h1");
    if (!h1 || reduced) return;
    var text = h1.textContent;
    h1.textContent = "";
    var i = 0;
    // letters grouped per word so a line never breaks mid-name
    text.split(" ").forEach(function (word, w) {
      if (w) h1.appendChild(document.createTextNode(" "));
      var wrap = document.createElement("span");
      wrap.className = "word";
      wrap.setAttribute("aria-hidden", "true");
      Array.from(word).forEach(function (c) {
        var s = document.createElement("span");
        s.className = "ch";
        s.textContent = c;
        s.style.setProperty("--x", Math.round((Math.random() - .5) * 240) + "px");
        s.style.setProperty("--y", Math.round((Math.random() - .5) * 160) + "px");
        s.style.setProperty("--r", Math.round((Math.random() - .5) * 120) + "deg");
        s.style.setProperty("--d", (i++ * 0.035).toFixed(3) + "s");
        wrap.appendChild(s);
      });
      h1.appendChild(wrap);
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { h1.classList.add("built"); }); });
  }

  // Map: pieces start scattered; each chapter's text pulls its pieces into place as you scroll.
  function initStory() {
    var svg = document.querySelector(".map");
    if (!svg) return;
    var world = svg.querySelector(".world");
    var frame = svg.querySelector(".frame");
    var nodes = Array.from(svg.querySelectorAll(".node"));
    var links = Array.from(svg.querySelectorAll(".link"));
    var chapters = Array.from(document.querySelectorAll(".chapter"));
    var count = document.querySelector(".count b");

    // seeded random so the scatter looks the same on every visit
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; }
    nodes.forEach(function (n) { n._dx = rnd() * 350; n._dy = rnd() * 280; n._r = rnd() * 90; });

    var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

    var px = 0, py = 0, tx = 0, ty = 0, queued = false;

    function render() {
      queued = false;
      var vh = window.innerHeight;
      var t = chapters.map(function (c) {
        if (reduced) return 1;
        return clamp((vh * .8 - c.getBoundingClientRect().top) / (vh * .45));
      });
      chapters.forEach(function (c, i) { c.classList.toggle("in", t[i] > .2); });

      var done = 0;
      nodes.forEach(function (n) {
        var k = ease(t[n.dataset.ch - 1]);
        if (k > .98) done++;
        n.style.transform = "translate(" + (n._dx * (1 - k)).toFixed(1) + "px," + (n._dy * (1 - k)).toFixed(1) + "px) rotate(" + (n._r * (1 - k)).toFixed(1) + "deg)";
        n.style.opacity = (.25 + .75 * k).toFixed(3);
      });
      links.forEach(function (l) { l.style.strokeDashoffset = (1 - ease(t[l.dataset.ch - 1])).toFixed(3); });

      var f = ease(t[0]);
      frame.style.opacity = f.toFixed(3);
      frame.style.transform = "scale(" + (1.6 - .6 * f).toFixed(3) + ")";
      count.textContent = String(done).padStart(2, "0");

      // cursor parallax: the whole map drifts a little toward the pointer
      px += (tx - px) * .08; py += (ty - py) * .08;
      world.setAttribute("transform", "translate(" + px.toFixed(2) + " " + py.toFixed(2) + ")");
      if (Math.abs(tx - px) > .05 || Math.abs(ty - py) > .05) queue();
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(render); } }

    // hover a piece to light it and its direct neighbours
    var adj = {};
    links.forEach(function (l) {
      (adj[l.dataset.a] = adj[l.dataset.a] || []).push(l.dataset.b);
      (adj[l.dataset.b] = adj[l.dataset.b] || []).push(l.dataset.a);
    });
    nodes.forEach(function (n) {
      n.addEventListener("pointerenter", function () {
        var id = n.dataset.id, near = adj[id] || [];
        svg.classList.add("focus");
        nodes.forEach(function (m) { m.classList.toggle("lit", m === n || near.indexOf(m.dataset.id) > -1); });
        links.forEach(function (l) { l.classList.toggle("lit", l.dataset.a === id || l.dataset.b === id); });
      });
      n.addEventListener("pointerleave", function () {
        svg.classList.remove("focus");
        nodes.concat(links).forEach(function (m) { m.classList.remove("lit"); });
      });
    });

    if (!reduced) {
      window.addEventListener("pointermove", function (e) {
        tx = (e.clientX / window.innerWidth - .5) * 24;
        ty = (e.clientY / window.innerHeight - .5) * 24;
        queue();
      }, { passive: true });
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initName();
    initStory();
  });
})();
