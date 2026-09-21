"use strict";
/* ================= LEVEL: Balloon bike ride ================= */
const BALLOON_COLORS = ["#e63946", "#2f6fde", "#3fa84f", "#8e4fd0", "#f07f13", "#f06ba8"];
/* Drawn, not emoji: the cyclist is the avatar she rides with for the whole game, and
   🚴 renders as a different person on every platform. See docs/ART-STYLE-GUIDE.md. */
const RIDER_ART = `<svg viewBox="0 0 160 132" width="100%" height="100%">
  <g fill="none" stroke="#3a3f47" stroke-width="5">
    <circle cx="36" cy="96" r="26"/><circle cx="124" cy="96" r="26"/>
  </g>
  <g fill="none" stroke="#aab3bd" stroke-width="1.7" opacity=".85">
    <path d="M36 70 V122 M10 96 H62 M18 78 L54 114 M54 78 L18 114"/>
    <path d="M124 70 V122 M98 96 H150 M106 78 L142 114 M142 78 L106 114"/>
  </g>
  <g fill="none" stroke="#ffc31f" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M78 96 L66 58 L108 60 Z"/>
    <path d="M78 96 H36 M66 58 L36 96 M108 60 L124 96"/>
  </g>
  <path d="M56 56 Q66 52 76 56 Q66 61 56 56 Z" fill="#3a3f47"/>
  <path d="M100 54 H116" stroke="#3a3f47" stroke-width="5" stroke-linecap="round"/>
  <path d="M68 58 Q86 70 80 94" stroke="#e8722d" stroke-width="12" fill="none" stroke-linecap="round"/>
  <ellipse cx="78" cy="98" rx="9" ry="6" fill="#2f6fde"/>
  <circle cx="78" cy="96" r="6.5" fill="#3a3f47"/>
  <path d="M68 58 Q76 38 92 30" stroke="#f2653c" stroke-width="17" fill="none" stroke-linecap="round"/>
  <path d="M92 32 Q104 40 110 52" stroke="#f2a03d" stroke-width="9" fill="none" stroke-linecap="round"/>
  <circle cx="112" cy="53" r="6" fill="#f6cfa4"/>
  <circle cx="99" cy="22" r="13" fill="#f6cfa4"/>
  <path d="M86 20 Q88 6 100 6 Q113 6 113 19 Q100 13 86 20 Z" fill="#2f6fde"/>
  <path d="M110 15 L123 20 L109 24 Z" fill="#2f6fde"/>
  <circle cx="106" cy="23" r="2.6" fill="#3a2e2e"/>
  <circle cx="99" cy="28" r="4" fill="#ff9bb0" opacity=".6"/>
  <path d="M104 31 Q109 36 113 30" stroke="#9c3b2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>`;

const bikeLevel = {
  theme: "theme-bike", rounds: 5, raf: null,
  startRound() {
    this.cleanup();
    const maxN = [5, 8, 10][state.tier];
    if (state.round === 0) {
      const pool = shuffle([...Array(maxN).keys()].map(i => i + 1));
      this.order = pool.slice(0, 5);
    }
    this.target = this.order[state.round];
    this.mistakes = 0;                 // same bug ocean.js had: never initialised, so
                                       // `undefined++` is NaN and the hint ladder below
                                       // never matched === 2 or >= 3.
    this.maxN = maxN;
    this.speedMul = [1, 1.25, 1.5][state.tier];
    this.maxBalloons = [3, 4, 5][state.tier];
    setInstruction("🎈 " + t("pop_balloon_show", { target: this.target }), t("pop_balloon_say", { target: this.target }));
    const far  = scene.strip("meadow", { band: "far",  seed: 6 }).repeat(6);
    const near = scene.strip("meadow", { band: "near", seed: 6 }).repeat(6);
    $("playArea").innerHTML =
      scene.html("meadow", { seed: 12 + state.round * 4, layers: ["canopy", "drift", "motes"] }) + `
      <div class="treeline far"><div class="marquee" style="animation-duration:26s;">${far}</div></div>
      <div class="treeline"><div class="marquee" style="animation-duration:13s;">${near}</div></div>
      <div class="road"></div>
      <div class="rider">${RIDER_ART}</div>
      <div id="balloonField"></div>`;
    this.balloons = [];
    this.spawnIn = randBetween(0.2, 0.6);
    this.sinceTarget = 0;
    this.spawnCount = 0;
    this.lastT = performance.now();
    const loop = t => { this.frame(t); if (this.raf !== null) this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  frame(t) {
    const dt = Math.min(50, t - this.lastT) / 1000;
    this.lastT = t;
    const area = $("playArea");
    if (!area.isConnected || !$("balloonField")) { this.cleanup(); return; }
    const W = area.clientWidth;
    const targetAlive = this.balloons.some(b => b.num === this.target && !b.el.classList.contains("popped"));
    this.sinceTarget = targetAlive ? 0 : this.sinceTarget + dt;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.balloons.length < this.maxBalloons) {
      let num;
      if (this.spawnCount === 0) {
        // the FIRST balloon is never the target, so she has to scan & wait
        do { num = Math.ceil(Math.random() * this.maxN); } while (num === this.target && this.maxN > 1);
      } else {
        const forceTarget = !targetAlive && this.sinceTarget > 2.5;
        num = forceTarget ? this.target
            : (!targetAlive && Math.random() < 0.35 ? this.target
            : Math.ceil(Math.random() * this.maxN));
      }
      this.spawnCount++;
      this.spawn(W, num);
      this.spawnIn = randBetween(1.0, 1.8);
    }
    for (const b of this.balloons) { b.x -= b.speed * dt; b.el.style.left = b.x + "px"; }
    this.balloons = this.balloons.filter(b => { if (b.x < -160) { b.el.remove(); return false; } return true; });
  },
  spawn(W, num) {
    const el = document.createElement("button");
    el.className = "balloon";
    if (num === this.target) el.dataset.target = "1";
    const color = rand(BALLOON_COLORS);
    el.innerHTML = `<div class="b-body" style="background:${color}; animation-delay:${Math.random() * 2}s;"><span class="b-shine"></span><span class="b-num">${num}</span></div><div class="b-knot" style="border-top-color:${color}"></div><div class="b-string"></div>`;
    el.style.top = randBetween(3, 48) + "%";
    el.style.left = W + 20 + "px";
    const b = { el, num, x: W + 20, speed: randBetween(55, 95) * (W / 700) * this.speedMul };
    el.onclick = e => this.tap(b, e);
    $("balloonField").appendChild(el);
    this.balloons.push(b);
  },
  tap(b, e) {
    if (state.busy || b.el.classList.contains("popped")) return;
    if (b.num === this.target) {
      b.el.classList.add("popped");
      tone(1100, 0, .04, "square", .2); tone(180, .03, .14, "sawtooth", .12);   // snappy balloon pop
      floaters(["🎈", "⭐", "✨"], e.clientX, e.clientY, b.num);                  // burst exactly b.num pieces = the quantity
      miniStar(e.clientX, e.clientY);
      speak(t("thats_that_num", { num: numWord(b.num), target: b.num }) + " " + praise()); roundComplete();
    } else {
      this.mistakes++;
      sfx.bad(); wiggle(b.el);
      if (this.mistakes === 2) {
        document.querySelectorAll(".balloon[data-target='1']").forEach(el => el.classList.add("hint-highlight"));
      } else if (this.mistakes >= 3) {
        document.querySelectorAll(".balloon[data-target='1']").forEach(el => wiggle(el));
      }
      speak(t("thats_find_num", { num: b.num, target: this.target }));
    }
  },
  cleanup() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.balloons = []; }
};

registerGame({
  id: "bike", world: "num", icon: "🚲", name: "Numbers", es: "Números", yue: "數字", lvl: 1, cue: "pop",
  level: bikeLevel
});
