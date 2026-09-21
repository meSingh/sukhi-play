"use strict";
/* LEVEL: Magic tracing (shapes, numbers, letters)
   Domain · Geometry / shapes · Concept · Age band 3–5 · Success = Child traces shapes and symbols accurately. */
const GLYPHS = {
  "1": [[[.5, .06], [.5, .94]], [[.33, .22], [.5, .06]]],
  "2": [[[.26, .28], [.4, .12], [.62, .12], [.74, .3], [.58, .52], [.3, .8], [.26, .94], [.78, .94]]],
  "3": [[[.28, .16], [.62, .1], [.74, .3], [.5, .5], [.74, .7], [.6, .92], [.28, .86]]],
  "4": [[[.66, .94], [.66, .06], [.22, .62], [.8, .62]]],
  "5": [[[.74, .06], [.32, .06], [.3, .46], [.56, .42], [.76, .58], [.66, .9], [.32, .92], [.24, .8]]],
  "A": [[[.2, .94], [.5, .06], [.8, .94]], [[.33, .62], [.67, .62]]],
  "B": [[[.25, .06], [.25, .94]], [[.25, .06], [.6, .06], [.74, .22], [.6, .48], [.25, .48]], [[.25, .48], [.66, .48], [.8, .72], [.64, .94], [.25, .94]]],
  "C": [[[.78, .2], [.5, .06], [.26, .2], [.18, .5], [.26, .8], [.5, .94], [.78, .8]]],
  "D": [[[.25, .06], [.25, .94]], [[.25, .06], [.55, .08], [.78, .3], [.78, .7], [.55, .92], [.25, .94]]],
  "E": [[[.76, .06], [.28, .06], [.28, .94], [.76, .94]], [[.28, .5], [.64, .5]]],
  "F": [[[.32, .06], [.32, .94]], [[.32, .06], [.84, .06]], [[.32, .48], [.74, .48]]],
  "G": [[[.78, .2], [.5, .06], [.26, .2], [.18, .5], [.26, .8], [.5, .94], [.78, .82], [.78, .54], [.56, .54]]],
  "H": [[[.25, .06], [.25, .94]], [[.75, .06], [.75, .94]], [[.25, .5], [.75, .5]]],
  "I": [[[.5, .06], [.5, .94]]],
  "J": [[[.7, .06], [.7, .76], [.56, .92], [.36, .88], [.3, .72]]],
  "K": [[[.28, .06], [.28, .94]], [[.74, .06], [.28, .5], [.76, .94]]],
  "L": [[[.3, .06], [.3, .94], [.74, .94]]],
  "M": [[[.2, .94], [.2, .06], [.5, .58], [.8, .06], [.8, .94]]],
  "N": [[[.26, .94], [.26, .06], [.74, .94], [.74, .06]]],
  "P": [[[.28, .94], [.28, .06], [.62, .06], [.78, .24], [.62, .46], [.28, .46]]],
  "Q": [[[.7, .18], [.5, .06], [.3, .18], [.2, .5], [.3, .82], [.5, .94], [.7, .82], [.8, .5], [.7, .18]], [[.58, .68], [.84, .96]]],
  "R": [[[.28, .94], [.28, .06], [.62, .06], [.78, .24], [.62, .46], [.28, .46]], [[.5, .46], [.78, .94]]],
  "S": [[[.76, .2], [.5, .06], [.28, .18], [.3, .42], [.6, .54], [.74, .72], [.6, .92], [.3, .9], [.22, .78]]],
  "T": [[[.14, .06], [.86, .06]], [[.5, .06], [.5, .94]]],
  "U": [[[.25, .06], [.25, .68], [.4, .9], [.6, .9], [.75, .68], [.75, .06]]],
  "V": [[[.2, .06], [.5, .94], [.8, .06]]],
  "W": [[[.14, .06], [.32, .94], [.5, .4], [.68, .94], [.86, .06]]],
  "X": [[[.24, .06], [.76, .94]], [[.76, .06], [.24, .94]]],
  "Y": [[[.24, .06], [.5, .5], [.76, .06]], [[.5, .5], [.5, .94]]],
  "Z": [[[.24, .06], [.76, .06], [.26, .94], [.78, .94]]]
};
function sampleStrokes(strokes, w, h) {
  const padX = w * 0.30, padY = h * 0.13;
  const X = u => padX + u * (w - 2 * padX), Y = v => padY + v * (h - 2 * padY);
  const pts = [];
  for (const st of strokes) {
    for (let i = 0; i < st.length - 1; i++) {
      const [ax, ay] = st[i], [bx, by] = st[i + 1];
      const segLen = Math.hypot((bx - ax) * w, (by - ay) * h);
      const steps = Math.max(2, Math.round(segLen / 22));
      for (let j = 0; j < steps; j++) { const t = j / steps; pts.push({ x: X(ax + (bx - ax) * t), y: Y(ay + (by - ay) * t), hit: false }); }
    }
    const last = st[st.length - 1]; pts.push({ x: X(last[0]), y: Y(last[1]), hit: false });
  }
  return pts;
}
function glyphPoints(item, w, h) {
  const cx = w / 2, cy = h / 2, size = Math.min(w, h) * .33, pts = [];
  const ring = (rx, ry, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, hit: false }); } };
  const poly = (v, per) => { for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; for (let j = 0; j < per; j++) { const t = j / per; pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, hit: false }); } } };
  switch (item) {
    case "circle": ring(size, size, 44); return pts;
    case "oval":   ring(size * 1.2, size * .8, 44); return pts;
    case "square": poly([{ x: cx - size, y: cy - size }, { x: cx + size, y: cy - size }, { x: cx + size, y: cy + size }, { x: cx - size, y: cy + size }], 11); return pts;
    case "triangle": poly([{ x: cx, y: cy - size }, { x: cx + size, y: cy + size * .8 }, { x: cx - size, y: cy + size * .8 }], 14); return pts;
    case "diamond": poly([{ x: cx, y: cy - size }, { x: cx + size, y: cy }, { x: cx, y: cy + size }, { x: cx - size, y: cy }], 12); return pts;
    case "star": { const v = []; for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? size * 1.15 : size * .5; const a = i / 10 * Math.PI * 2 - Math.PI / 2; v.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } poly(v, 5); return pts; }
    case "heart": { for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; pts.push({ x: cx + 16 * Math.pow(Math.sin(t), 3) * size / 14, y: cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * size / 14, hit: false }); } return pts; }
    case "O": ring(size * .85, size * 1.05, 44); return pts;
    default: return sampleStrokes(GLYPHS[item], w, h);
  }
}
function traceLabel(item) {
  if (/[0-9]/.test(item)) return { say: t("trace_number", { x: item }), show: "✨ " + t("trace_number", { x: item }) };
  if (/[A-Z]/.test(item)) return { say: t("trace_letter", { x: item }), show: "✨ " + t("trace_letter", { x: item }) };
  return { say: t("trace_shape", { x: theWord(item) }), show: "✨ " + t("trace_shape", { x: theWord(item) }) };
}
const traceLevel = {
  theme: "theme-trace", rounds: 5,
  startRound() {
    if (state.round === 0) {
      this.order = this.buildOrder();
      this.rounds = this.order.length;
      drawProgress();
    }
    const item = this.order[state.round];
    this.item = item; this.done = false; this.hue = 0; this.last = null; this.hits = 0;
    const lab = traceLabel(item);
    setInstruction(lab.show, lab.say + " " + t("follow_dots"));
    const area = $("playArea");
    area.innerHTML =
      // no mid/ground/frame: the glyph is drawn anywhere in this box and her finger follows it
      scene.html("space", { seed: 21 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) +
      `<canvas id="guideC"></canvas><canvas id="inkC"></canvas><div class="trace-start" id="traceStart"></div><button class="round-btn trace-shuffle" id="traceShuffle" aria-label="New shapes to trace">🎲</button>`;
    const rect = area.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    for (const id of ["guideC", "inkC"]) { const c = $(id); c.width = rect.width * dpr; c.height = rect.height * dpr; c.getContext("2d").scale(dpr, dpr); }
    this.pts = glyphPoints(item, rect.width, rect.height);
    this.drawGuide();
    const start = $("traceStart"); start.style.left = this.pts[0].x + "px"; start.style.top = this.pts[0].y + "px";   // "start here"
    const ink = $("inkC");
    // map to the canvas's own coordinate space via the live ratio, so ink stays under the finger
    // even if the container was resized after setup (mobile address bar collapse, rotation, etc.)
    const pos = e => { const b = ink.getBoundingClientRect(); return { x: (e.clientX - b.left) * (ink.width / dpr) / b.width, y: (e.clientY - b.top) * (ink.height / dpr) / b.height }; };
    ink.addEventListener("pointerdown", e => { e.preventDefault(); try { ink.setPointerCapture(e.pointerId); } catch (_) {} const ts = $("traceStart"); if (ts) ts.style.display = "none"; this.last = pos(e); this.paint(this.last); trail.add(e.clientX, e.clientY, this.hue, 4); });
    ink.addEventListener("pointermove", e => { if (this.last) { const p = pos(e); this.paint(p); this.last = p; trail.add(e.clientX, e.clientY, this.hue, this.done ? 0 : 2); } });
    const stop = () => this.last = null;
    ink.addEventListener("pointerup", stop); ink.addEventListener("pointercancel", stop);
    const sh = $("traceShuffle"); if (sh) sh.onclick = () => this.regenerate();
  },
  // Build a fresh set of shapes/glyphs for the current tier. Shuffled each time so the trace
  // set varies every play (tier 0 used to be a fixed circle→square→… list — same every session).
  buildOrder() {
    if (state.tier === 2) {
      const letters = NAME.toUpperCase().replace(/[^A-Z]/g, "").split("").slice(0, 8);
      return letters.length ? letters : ["S", "T", "A", "R"];   // tier 2 spells the child's name!
    }
    const pool = state.tier === 1
      ? ["triangle", "star", "oval", "diamond", "square", "circle", "1", "2", "3"]
      : ["circle", "square", "triangle", "star", "heart", "oval", "diamond"];
    return shuffle(pool).slice(0, 5);
  },
  // 🎲 button: reshuffle to a brand-new set and restart from the first shape.
  regenerate() {
    if (state.busy) return;
    state.round = 0;
    sfx.tap(); tone(620, 0, .16, "triangle", .15);
    const b = $("traceShuffle"); if (b) { const r = b.getBoundingClientRect(); miniStar(r.left + r.width / 2, r.top + r.height / 2); }
    speak(t("new_shapes"));
    this.startRound();   // round === 0 → buildOrder() produces a fresh shuffled set
  },
  // re-sync both canvas buffers to the live play-area size after a resize (rotation, mobile bar).
  // Guide points are scaled (keeping hit state) and the child's ink is stretched onto the new buffer.
  resize() {
    const area = $("playArea"), ink = $("inkC"), guide = $("guideC");
    if (!area || !ink || !guide || !this.pts) return;
    const rect = area.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!rect.width || !rect.height) return;
    const oldW = ink.width / dpr, oldH = ink.height / dpr;
    if (Math.abs(oldW - rect.width) < 1 && Math.abs(oldH - rect.height) < 1) return;
    const snap = document.createElement("canvas"); snap.width = ink.width; snap.height = ink.height;
    snap.getContext("2d").drawImage(ink, 0, 0);
    const sx = rect.width / oldW, sy = rect.height / oldH;
    for (const p of this.pts) { p.x *= sx; p.y *= sy; }
    for (const c of [guide, ink]) { c.width = rect.width * dpr; c.height = rect.height * dpr; c.getContext("2d").scale(dpr, dpr); }
    this.drawGuide();
    ink.getContext("2d").drawImage(snap, 0, 0, rect.width, rect.height);
    this.last = null;
    const ts = $("traceStart");
    if (ts && ts.style.display !== "none") { ts.style.left = this.pts[0].x + "px"; ts.style.top = this.pts[0].y + "px"; }
  },
  drawGuide() {
    const c = $("guideC"), ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    // faint ghost "road" through the points so the child sees the shape; gaps between strokes are skipped
    ctx.strokeStyle = "rgba(255,255,255,.32)"; ctx.lineWidth = 12; ctx.lineCap = ctx.lineJoin = "round";
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 46) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (const p of this.pts) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.hit ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = p.hit ? "#ffd23e" : "rgba(255,255,255,.85)";
      if (p.hit) { ctx.shadowColor = "#ffd23e"; ctx.shadowBlur = 12; } else ctx.shadowBlur = 0;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  },
  paint(p) {
    if (this.done || state.busy || !this.last) return;
    const ctx = $("inkC").getContext("2d");
    ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = 13;
    ctx.strokeStyle = `hsl(${this.hue}, 90%, 62%)`; this.hue = (this.hue + 5) % 360;
    ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    let newHits = false;
    for (const pt of this.pts) {
      if (!pt.hit && Math.hypot(pt.x - p.x, pt.y - p.y) < 38) { pt.hit = true; this.hits++; newHits = true; if (this.hits % 4 === 0) sfx.tick(); }
    }
    if (newHits) {
      this.drawGuide();
      if (this.hits / this.pts.length >= 0.82) {
        this.done = true; this.pts.forEach(pt => pt.hit = true); this.drawGuide(); confetti(14);
        sfx.good();
        const ir = $("inkC").getBoundingClientRect(); floaters(["✨", "🌟", "💫"], ir.left + p.x, ir.top + p.y, 7);
        speak(t("traced_it") + " " + praise()); roundComplete();
      }
    }
  }
};

registerGame({
  id: "trace", world: "shape", icon: "✨", name: "Tracing", es: "Trazar", yue: "描畫", lvl: 2, cue: "sparkle",
  level: traceLevel
});
