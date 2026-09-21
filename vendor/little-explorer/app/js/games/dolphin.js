"use strict";
// Spatial reasoning · directional steering + positional language (up high / down low) · age 3-5
// Success = child steers the dolphin up and down through a scrolling ocean to swim through the hoops.

// Drawn hero dolphin (side view, facing right, mid-leap).
const DOLPHIN_ART = `<svg viewBox="0 0 150 108" width="100%" height="100%">
  <defs>
    <linearGradient id="dlBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9fd2ee"/><stop offset="1" stop-color="#4d84ab"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-10 75 60)">
    <path d="M20 58 Q2 44 16 44 Q14 54 30 60 Z" fill="#3f6e90"/>
    <path d="M18 64 Q4 80 18 74 Q18 64 32 62 Z" fill="#3a6484"/>
    <path d="M26 60 Q60 40 104 42 Q132 43 144 30 Q140 46 126 52
            Q140 56 146 50 Q134 70 100 70 Q60 72 34 66 Q26 64 26 60 Z" fill="url(#dlBody)"/>
    <path d="M40 65 Q72 74 112 68 Q96 74 66 73 Q50 72 40 65 Z" fill="#eaf6fd" opacity=".95"/>
    <path d="M126 52 Q142 52 150 56 Q142 60 126 58 Z" fill="#4d84ab"/>
    <path d="M66 45 Q74 24 90 40 Q80 42 66 45 Z" fill="#3f6e90"/>
    <path d="M78 66 Q86 84 104 74 Q92 70 78 66 Z" fill="#3a6484"/>
    <circle cx="114" cy="55" r="4.5" fill="#ff7fb6" opacity=".38"/>
    <circle cx="121" cy="52" r="4.2" fill="#12303f"/>
    <circle cx="122.5" cy="50.3" r="1.7" fill="#fff"/>
    <path d="M128 60 Q136 65 145 60" stroke="#12303f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

// this game holds its strings inline (like Night & Day) rather than in the core DICT
const dlL = obj => obj[curLang()] || obj.en;

const DL_TXT = {
  show: { en: "🐬 Swim through the hoops!", es: "🐬 ¡Pasa por los aros!", yue: "🐬 游過啲圈圈！" },
  say:  { en: "Slide your finger up and down to steer the dolphin through the hoops!",
          es: "¡Desliza el dedo arriba y abajo para guiar al delfín por los aros!",
          yue: "上下滑動手指，帶海豚游過啲圈圈！" },
  high: { en: "Up high!",       es: "¡Arriba!",       yue: "上面高高！" },
  low:  { en: "Down low!",      es: "¡Abajo!",        yue: "下面低低！" },
  mid:  { en: "In the middle!", es: "¡En el medio!",  yue: "中間！" }
};

// The scrolling seabed comes from the scene kit as a tileable band (scene.strip), not a
// row of emoji: an even repeat count keeps the marquee's translateX(-50%) loop seamless.

const dolphinLevel = {
  theme: "theme-ocean", rounds: 5, raf: null,

  startRound() {
    this.cleanup();
    this.done = false;
    this.collected = 0;
    this.goal = [4, 5, 6][state.tier];
    this.miss = 0;
    this.reduced = reducedMotion();
    this.speedMul = [1, 1.3, 1.6][state.tier] * (this.reduced ? 0.6 : 1);
    this.rings = [];
    this.spawnIn = 0.4;
    this.saidHeight = false;

    setInstruction(dlL(DL_TXT.show), dlL(DL_TXT.say));

    const pips = Array.from({ length: this.goal }, (_, i) => `<span class="dl-pip" data-i="${i}">◯</span>`).join("");
    $("playArea").innerHTML = `
      <style>
        .dl-stage{position:absolute;inset:0;overflow:hidden;z-index:5;touch-action:none;cursor:grab}
        .dl-stage:active{cursor:grabbing}
        .dl-surface{position:absolute;left:-2%;right:-2%;top:2%;height:9%;pointer-events:none;opacity:.85}
        .dl-surface svg{width:100%;height:100%}
        /* z-index 2: above .dl-floor, or the sand gradient buries the reef it grows out of */
        .dl-layer{position:absolute;width:100%;overflow:hidden;white-space:nowrap;pointer-events:none;line-height:1;z-index:2}
        /* vmin, not %: the strip tile is 6:1, so its height is what sets coral size */
        .dl-far{bottom:12%;height:clamp(34px,11vmin,92px);opacity:.8}
        .dl-near{bottom:5%;height:clamp(52px,19vmin,150px);opacity:.95}
        .dl-layer .marquee{height:100%;white-space:nowrap}
        .dl-floor{position:absolute;left:0;right:0;bottom:0;height:14%;background:linear-gradient(rgba(226,201,140,0),#e2c98c 55%);pointer-events:none;z-index:1}
        .dl-bubble{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.9),rgba(255,255,255,.12));animation:dlRise linear infinite;pointer-events:none;z-index:3}
        @keyframes dlRise{0%{transform:translateY(0);opacity:.7}100%{transform:translateY(-72vh);opacity:0}}
        .dl-hoop{position:absolute;width:clamp(66px,17vmin,132px);height:clamp(66px,17vmin,132px);transform:translate(-50%,-50%);
                 border-radius:50%;border:clamp(8px,2.1vmin,16px) solid rgba(255,255,255,.9);background:rgba(120,220,255,.12);
                 box-shadow:0 0 15px rgba(255,255,255,.5),inset 0 0 12px rgba(140,220,255,.5);pointer-events:none;z-index:6}
        .dl-hoop.dl-collected{animation:dlPop .35s ease forwards}
        @keyframes dlPop{0%{transform:translate(-50%,-50%) scale(1);border-color:#ffe36b}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0;border-color:#ffe36b}}
        .dl-dolphin{position:absolute;width:clamp(86px,24vmin,168px);height:auto;transform:translate(-50%,-50%);z-index:8;pointer-events:none;filter:drop-shadow(0 6px 8px rgba(0,40,70,.35))}
        .dl-dolphin.dl-cheer{animation:dlCheer .4s ease}
        @keyframes dlCheer{0%,100%{filter:drop-shadow(0 6px 8px rgba(0,40,70,.35))}50%{filter:drop-shadow(0 0 14px rgba(255,227,107,.95))}}
        .dl-hud{position:absolute;top:2%;left:50%;transform:translateX(-50%);display:flex;gap:clamp(3px,1vmin,7px);z-index:9;
                background:rgba(0,40,70,.28);padding:clamp(3px,1vmin,7px) clamp(8px,2.4vmin,16px);border-radius:999px}
        .dl-pip{font-size:clamp(16px,4.4vmin,30px);color:#eaf7ff;line-height:1}
        .dl-pip.on{color:#ffe36b}
      </style>
      <div class="dl-stage" id="dlStage">
        <div class="dl-surface">
          <svg viewBox="0 0 400 40" preserveAspectRatio="none">
            <path d="M0 22 Q25 6 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22 V0 H0 Z" fill="rgba(255,255,255,.25)"/>
            <path d="M0 22 Q25 6 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
          </svg>
        </div>
        <div class="dl-layer dl-far"><span class="marquee" style="animation-duration:${(30 / this.speedMul).toFixed(1)}s">${scene.strip("reef", { band: "far", seed: 4 }).repeat(6)}</span></div>
        <div class="dl-layer dl-near"><span class="marquee" style="animation-duration:${(15 / this.speedMul).toFixed(1)}s">${scene.strip("reef", { band: "near", seed: 4 }).repeat(6)}</span></div>
        <div class="dl-floor"></div>
        <div class="dl-hud" id="dlHud">${pips}</div>
        <div class="dl-hoopfield" id="dlHoops"></div>
        <div class="dl-dolphin" id="dlDolphin">${DOLPHIN_ART}</div>
      </div>`;

    const stage = $("dlStage");
    for (let i = 0; i < (this.reduced ? 0 : 9); i++) {
      const b = document.createElement("span");
      b.className = "dl-bubble";
      const sz = randBetween(6, 16);
      b.style.width = b.style.height = sz + "px";
      b.style.left = randBetween(3, 97) + "%";
      b.style.bottom = randBetween(-10, 40) + "%";
      b.style.animationDuration = randBetween(6, 11) + "s";
      b.style.animationDelay = -randBetween(0, 8) + "s";
      stage.appendChild(b);
    }

    // steering: the dolphin follows the finger/mouse up and down
    const H0 = stage.clientHeight || $("playArea").clientHeight;
    this.zoneTop = H0 * 0.14; this.zoneBot = H0 * 0.84;
    this.y = H0 * 0.5;
    this.targetY = this.y;
    this.dolphin = $("dlDolphin");
    this.dolphin.style.left = "22%";
    this.dolphin.style.top = this.y + "px";

    const setTarget = ev => {
      const r = stage.getBoundingClientRect();
      this.targetY = clamp(ev.clientY - r.top, this.zoneTop, this.zoneBot);
    };
    this._down = ev => { this._steer = true; setTarget(ev); };
    this._move = ev => { if (this._steer) setTarget(ev); };
    this._up = () => { this._steer = false; };
    stage.addEventListener("pointerdown", this._down);
    stage.addEventListener("pointermove", this._move);
    stage.addEventListener("pointerup", this._up);
    stage.addEventListener("pointercancel", this._up);
    this._stage = stage;

    this.lastT = performance.now();
    const loop = t => { this.frame(t); if (this.raf !== null) this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  frame(t) {
    const dt = Math.min(50, t - this.lastT) / 1000;
    this.lastT = t;
    const area = $("playArea");
    if (!area.isConnected || !$("dlHoops") || this.done) { return; }
    const stage = this._stage;
    const W = stage.clientWidth, H = stage.clientHeight;
    this.zoneTop = H * 0.14; this.zoneBot = H * 0.84;

    // ease the dolphin toward the finger and tilt by vertical velocity
    const prevY = this.y;
    this.y += (this.targetY - this.y) * Math.min(1, dt * 9);
    this.y = clamp(this.y, this.zoneTop, this.zoneBot);
    const dy = this.y - prevY;
    const tilt = clamp(dy * 3.2, -24, 24);
    this.dolphin.style.top = this.y + "px";
    this.dolphin.style.transform = `translate(-50%,-50%) rotate(${tilt.toFixed(1)}deg)`;

    // spawn hoops from the right at varied heights
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.rings.length < 3 && this.collected < this.goal) {
      this.spawnHoop(W, H);
      this.spawnIn = randBetween(0.9, 1.6) / this.speedMul;
    }

    // move hoops left; collect on overlap with the dolphin
    const assist = this.miss >= 3;                               // after repeated misses, make hoops easy to catch
    const dolCX = W * 0.22;
    const speed = (W / 700) * 105 * this.speedMul;
    const tolX = assist ? 0.95 : 0.6, tolY = assist ? 1.1 : 0.55;
    for (const r of this.rings) {
      if (r.hit) continue;
      r.x -= speed * dt;
      r.el.style.left = r.x + "px";
      if (Math.abs(r.x - dolCX) < r.w * tolX && Math.abs(r.cy - this.y) < r.h * tolY) {
        this.collect(r);
      }
    }
    this.rings = this.rings.filter(r => {
      if (r.hit) return false;                                   // collected: its element self-removes after the pop
      if (r.x < -r.w) { this.miss++; if (r.el.isConnected) r.el.remove(); return false; }
      return true;
    });
  },

  spawnHoop(W, H) {
    const el = document.createElement("div");
    el.className = "dl-hoop";
    $("dlHoops").appendChild(el);
    const w = el.offsetWidth || 100, h = el.offsetHeight || 100;
    // once assisting, spawn the hoop right at the dolphin's height so steering barely matters
    const cy = this.miss >= 3
      ? clamp(this.y + randBetween(-h * 0.3, h * 0.3), this.zoneTop + h * 0.5, this.zoneBot - h * 0.5)
      : randBetween(this.zoneTop + h * 0.5, this.zoneBot - h * 0.5);
    const x = W + w;
    el.style.left = x + "px";
    el.style.top = cy + "px";
    this.rings.push({ el, x, cy, w, h, hit: false });
  },

  collect(r) {
    r.hit = true;
    r.el.classList.add("dl-collected");
    core.wait(() => { if (r.el.isConnected) r.el.remove(); }, 360);

    this.collected++;
    const pip = $("dlHud") && $("dlHud").querySelector(`.dl-pip[data-i="${this.collected - 1}"]`);
    if (pip) { pip.textContent = "⬤"; pip.classList.add("on"); }

    const rect = r.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cyPx = rect.top + rect.height / 2;
    sfx.tap();
    tone(520 + this.collected * 70, 0, .16, "sine", .14);
    miniStar(cx, cyPx);
    floaters(["✨", "💧", "🫧"], cx, cyPx, 4);
    this.dolphin.classList.remove("dl-cheer"); void this.dolphin.offsetWidth; this.dolphin.classList.add("dl-cheer");

    // reinforce positional language on ~every other hoop (kept sparse so it never chatters)
    if (!this.saidHeight && this.collected < this.goal) {
      const frac = (r.cy - this.zoneTop) / (this.zoneBot - this.zoneTop);
      const key = frac < 0.34 ? "high" : frac > 0.66 ? "low" : "mid";
      speak(dlL(DL_TXT[key]));
      this.saidHeight = true;
    } else {
      this.saidHeight = false;
    }

    if (this.collected >= this.goal) this.finish();
  },

  finish() {
    if (this.done) return;
    this.done = true;
    this.cleanup();
    speak(praise());
    roundComplete();
  },

  cleanup() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    if (this._stage) {
      this._stage.removeEventListener("pointerdown", this._down);
      this._stage.removeEventListener("pointermove", this._move);
      this._stage.removeEventListener("pointerup", this._up);
      this._stage.removeEventListener("pointercancel", this._up);
      this._stage = null;
    }
    this._steer = false;
    this.rings = [];
  }
};

registerGame({
  id: "dolphin", world: "animal", icon: "🐬", name: "Dolphin Dive", es: "Delfín", yue: "海豚",
  lvl: 0, cue: "splash", level: dolphinLevel
});
