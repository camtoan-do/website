// Liquid glass. Every .glass element becomes a thick lens: whatever sits behind it bends at the rim,
// colours split slightly at the edge, and the rim light turns toward the pointer.
// External file because the strict Content-Security-Policy allows no inline code. No library.
(() => {
  const els = [...document.querySelectorAll(".glass")];
  if (!els.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Rim light: the bright edge faces the pointer, like light catching real glass. ---
  if (!reduce) {
    let ev = null;
    addEventListener("pointermove", (e) => {
      if (!ev) requestAnimationFrame(() => {
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const a = Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
          el.style.setProperty("--glint", `${Math.round((a * 180) / Math.PI + 270)}deg`);
        }
        ev = null;
      });
      ev = e;
    }, { passive: true });
  }

  // --- Refraction ---
  // shortcut: only Chromium can run an SVG filter on the backdrop, and navigator.userAgentData exists only there.
  // Other browsers keep the frosted fallback from styles.css. Swap for a real feature test if one appears.
  if (!navigator.userAgentData) return;

  const NS = "http://www.w3.org/2000/svg";
  const make = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const defs = make("svg", { class: "glass-defs", "aria-hidden": "true", focusable: "false" });
  document.body.append(defs);

  // Displacement map for a rounded rectangle: neutral grey in the middle (no bending); inside the bezel the
  // red/green channels push each pixel to sample from further inside, more steeply the closer it is to the rim.
  function lensMap(w, h, radius, bezel) {
    const s = 0.5; // half resolution is plenty for a smooth map
    const cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(cw, ch);
    const hx = w / 2, hy = h / 2, r = Math.min(radius, hx, hy);
    for (let y = 0, i = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++, i += 4) {
        const px = (x + 0.5) / s - hx, py = (y + 0.5) / s - hy;
        const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
        let nx = 0, ny = 0, dist; // outward normal, and distance in from the edge
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(qx, qy) || 1;
          dist = r - l; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py);
        } else if (qx > qy) { dist = r - qx; nx = Math.sign(px); }
        else { dist = r - qy; ny = Math.sign(py); }
        const t = dist < 0 ? 0 : Math.max(0, 1 - dist / bezel);
        const mag = 1 - Math.sqrt(1 - t * t); // circular lens profile: flat inside, steep at the rim
        img.data[i] = 128 - nx * mag * 127;
        img.data[i + 1] = 128 - ny * mag * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  let count = 0;
  function apply(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const cs = getComputedStyle(el);
    const radius = parseFloat(cs.borderTopLeftRadius) || 0;
    const bezel = Math.min(parseFloat(cs.getPropertyValue("--glass-bezel")) || 26, w / 2, h / 2);
    const scale = bezel * 2.6;
    const id = (el.dataset.glassId ||= `glass-${++count}`);
    document.getElementById(id)?.remove();

    const f = make("filter", { id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
    f.append(make("feImage", { href: lensMap(w, h, radius, bezel), x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" }));
    // Three passes, one per colour, each bent a little less: the rim gets a faint rainbow fringe.
    const keep = { r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" };
    [["r", 1], ["g", 0.975], ["b", 0.95]].forEach(([c, k]) => {
      f.append(make("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: scale * k, xChannelSelector: "R", yChannelSelector: "G", result: `d${c}` }));
      f.append(make("feColorMatrix", { in: `d${c}`, type: "matrix", values: keep[c], result: c }));
    });
    f.append(make("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }));
    f.append(make("feBlend", { in: "rg", in2: "b", mode: "screen" }));
    defs.append(f);

    const css = `url(#${id}) blur(${cs.getPropertyValue("--glass-blur").trim() || "2px"}) saturate(1.8)`;
    el.style.backdropFilter = css;
  }

  // Glass inside glass only sees its parent's fill, so bending it would be wasted work.
  const lenses = els.filter((el) => !el.parentElement.closest(".glass"));
  const pending = new Set();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) pending.add(e.target);
    requestAnimationFrame(() => { pending.forEach(apply); pending.clear(); });
  });
  lenses.forEach((el) => ro.observe(el));
})();
