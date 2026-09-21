"use strict";
/* Paint Studio (free drawing)
   Domain · Scientific thinking · Concept · Age band 2–5 · Success = Child observes color mixing and predicts drawing outcomes. */
const paint = {
  colors: ["#e63946", "#f07f13", "#f4c726", "#3fa84f", "#2f6fde", "#8e4fd0", "#f06ba8", "#8a5a2b", "#2b2b2b"],
  colorNames: ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black"],
  stamps: ["⭐", "❤️", "🌸", "🦋", "❄️", "🐠", "🌈", "🍩"],
  outlines: ["snowman", "flower", "fish", "butterfly", "star", "heart"],
  color: "#e63946", mode: "draw", stampIdx: 0, last: null, trailHue: 0, challenge: null,
  show() {
    cleanupLevel();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    hideAllScreens();
    $("paint").classList.remove("hidden");
    document.body.className = "theme-trace";
    this.mode = "draw";
    this.outline = rand(this.outlines);
    this.buildSwatches();
    $("paintStamp").textContent = this.stamps[this.stampIdx];
    $("paintStamp").classList.remove("on"); $("paintErase").classList.remove("on");
    this.setup();
    speak(t("paint_intro"));
    this.challenge = null;
    $("paintInstruct").classList.remove("on");
    core.wait(() => this.nextChallenge(), 4000);
  },
  nextChallenge() {
    if (!$("paint") || $("paint").classList.contains("hidden")) return;
    const type = rand(["color", "stamp", "outline"]);
    if (type === "color") {
      const idx = Math.floor(Math.random() * this.colors.length);
      this.challenge = { type: "color", val: this.colors[idx], name: this.colorNames[idx] };
      this.setInstruct(t("paint_color_q", { color: colorName(this.challenge.name) }));
    } else if (type === "stamp") {
      const idx = Math.floor(Math.random() * this.stamps.length);
      this.challenge = { type: "stamp", val: this.stamps[idx] };
      this.setInstruct(t("paint_stamp_q", { x: this.challenge.val }));
    } else {
      this.setInstruct(t("paint_outline_q", { x: theWord(this.outline) }));
      this.challenge = { type: "outline" };
    }
  },
  setInstruct(txt) {
    const el = $("paintInstruct"); el.textContent = txt; el.classList.add("on");
    speak(txt);
  },
  checkChallenge(type, val) {
    if (!this.challenge || this.challenge.type !== type) return;
    if (type === "color" && val === this.challenge.val) this.winChallenge(t("found_it", { item: colorName(this.challenge.name) }));
    else if (type === "stamp" && val === this.challenge.val) this.winChallenge(t("paint_stamp_win", { x: this.challenge.val }));
    else if (type === "outline") this.winChallenge(t("paint_finish"));
  },
  winChallenge(txt) {
    this.challenge = null;
    $("paintInstruct").classList.remove("on");
    speak(txt + " " + praise());
    confetti();
    core.wait(() => this.nextChallenge(), 7000);
  },
  buildSwatches() {
    const w = $("swatches"); w.innerHTML = "";
    this.colors.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "swatch" + (i === 0 ? " sel" : ""); b.style.background = c;
      b.onclick = () => { 
        this.color = c; this.mode = "draw"; this.markSel(b); 
        $("paintStamp").classList.remove("on"); $("paintErase").classList.remove("on");
        this.checkChallenge("color", c);
      };
      w.appendChild(b);
    });
    this.color = this.colors[0];
  },
  markSel(b) { document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s === b)); },
  setup() {
    const wrap = $("paintCanvasWrap"), c = $("paintC");
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    this.w = r.width; this.h = r.height; this.ctx = ctx;
    this.redraw();
    // map to the canvas's own coordinate space via the live ratio, so paint stays under the finger
    // even if the container was resized after setup (mobile address bar collapse, rotation, etc.)
    const pos = e => { const b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * (c.width / dpr) / b.width, y: (e.clientY - b.top) * (c.height / dpr) / b.height }; };
    c.onpointerdown = e => {
      e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) {}
      const p = pos(e);
      if (this.mode === "stamp") this.stamp(p);
      else { 
        this.last = p; this.draw(p); 
        if (this.mode !== "erase") {
          trail.add(e.clientX, e.clientY, this.trailHue = (this.trailHue + 24) % 360, 4);
          this.checkChallenge("outline");
        }
      }
    };
    c.onpointermove = e => { if (this.last && this.mode !== "stamp") { const p = pos(e); this.draw(p); this.last = p; if (this.mode !== "erase") trail.add(e.clientX, e.clientY, this.trailHue = (this.trailHue + 12) % 360, 2); } };
    const stop = () => this.last = null;
    c.onpointerup = stop; c.onpointercancel = stop;
  },
  redraw() { this.ctx.clearRect(0, 0, this.w, this.h); this.drawOutline(); },
  // re-sync the canvas buffer to the live container size after a resize (rotation, mobile bar),
  // stretching the existing painting onto the new buffer so it (and the outline) stays crisp.
  resize() {
    const wrap = $("paintCanvasWrap"), c = $("paintC");
    if (!wrap || !c || !this.ctx) return;
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return;
    if (Math.abs(this.w - r.width) < 1 && Math.abs(this.h - r.height) < 1) return;
    const snap = document.createElement("canvas"); snap.width = c.width; snap.height = c.height;
    snap.getContext("2d").drawImage(c, 0, 0);
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    this.w = r.width; this.h = r.height; this.ctx = ctx; this.last = null;
    ctx.drawImage(snap, 0, 0, r.width, r.height);
  },
  drawOutline() {
    const ctx = this.ctx, cx = this.w / 2, cy = this.h / 2, s = Math.min(this.w, this.h) * 0.3;
    ctx.save(); ctx.strokeStyle = "rgba(150,150,160,.45)"; ctx.lineWidth = 4; ctx.setLineDash([9, 9]); ctx.lineCap = "round";
    const o = this.outline;
    if (o === "snowman") { ctx.beginPath(); ctx.arc(cx, cy + s * 0.6, s * 0.62, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.5, s * 0.42, 0, 7); ctx.stroke(); }
    else if (o === "flower") { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62, s * 0.32, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.arc(cx, cy, s * 0.34, 0, 7); ctx.stroke(); }
    else if (o === "fish") { ctx.beginPath(); ctx.ellipse(cx - s * 0.2, cy, s * 0.8, s * 0.5, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.6, cy); ctx.lineTo(cx + s, cy - s * 0.45); ctx.lineTo(cx + s, cy + s * 0.45); ctx.closePath(); ctx.stroke(); }
    else if (o === "butterfly") { [[-0.45, -0.3, 0.4, 0.5], [0.45, -0.3, 0.4, 0.5], [-0.4, 0.42, 0.33, 0.42], [0.4, 0.42, 0.33, 0.42]].forEach(([dx, dy, rx, ry]) => { ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, rx * s, ry * s, 0, 0, 7); ctx.stroke(); }); }
    else if (o === "star") { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.46 : s; const a = i / 10 * Math.PI * 2 - Math.PI / 2; const X = cx + Math.cos(a) * r, Y = cy + Math.sin(a) * r; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); ctx.stroke(); }
    else { ctx.beginPath(); for (let t = 0; t <= Math.PI * 2 + 0.1; t += 0.12) { const X = cx + 16 * Math.pow(Math.sin(t), 3) * s / 16; const Y = cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s / 16; t ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); ctx.stroke(); }
    ctx.restore();
  },
  draw(p) {
    const ctx = this.ctx;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = this.mode === "erase" ? 38 : 18;
    ctx.globalCompositeOperation = this.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = this.color;
    ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  },
  stamp(p) {
    const ctx = this.ctx;
    ctx.font = `${Math.min(this.w, this.h) * 0.13}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this.stamps[this.stampIdx], p.x, p.y);
    sfx.tick();
    this.checkChallenge("stamp", this.stamps[this.stampIdx]);
  }
};

registerGame({
  id: "paint", world: "create", icon: "🎨", name: "Paint", es: "Pintar", yue: "畫畫", lvl: 0, cue: "sparkle"
});
