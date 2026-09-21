"use strict";
// Patterns / logic · rhythm + timing (tap to swing) with counting · age 3-5
// Success = child taps in time to swing the monkey up and grab bananas at different heights.

const moL = obj => obj[curLang()] || obj.en;

const MO_TXT = {
  show: { en: "🐒 Swing and grab the bananas!", es: "🐒 ¡Balancéate y agarra los guineos!", yue: "🐒 盪過去攞香蕉！" },
  say:  { en: "Tap the screen to swing the monkey up and catch the bananas!",
          es: "¡Toca la pantalla para que el mono salte y atrape los guineos!",
          yue: "㩒下畫面，等馬騮盪高啲，接住香蕉！" }
};


/* Drawn, not emoji: this is the avatar she steers for a whole round, and the one object
   on screen whose motion IS the game. Per docs/ART-STYLE-GUIDE.md, an emoji at 63px is
   a different picture on every device and cannot be posed. */
const MONKEY_ART = `<svg viewBox="0 0 120 124" width="100%" height="100%">
  <defs>
    <linearGradient id="moFur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b07c4a"/><stop offset="1" stop-color="#8a5c31"/>
    </linearGradient>
  </defs>
  <path d="M40 92 Q12 96 12 72 Q12 56 28 54 Q18 62 20 74 Q22 88 42 84 Z" fill="#7d5029"/>
  <ellipse cx="62" cy="88" rx="25" ry="23" fill="url(#moFur)"/>
  <ellipse cx="62" cy="94" rx="15" ry="14" fill="#e8bd8c"/>
  <path d="M44 74 Q26 56 22 38 Q34 50 48 62 Z" fill="#8a5c31"/>
  <path d="M80 74 Q98 56 102 38 Q90 50 76 62 Z" fill="#8a5c31"/>
  <circle cx="24" cy="34" r="8" fill="#a06f42"/>
  <circle cx="100" cy="34" r="8" fill="#a06f42"/>
  <ellipse cx="48" cy="106" rx="11" ry="8" fill="#8a5c31"/>
  <ellipse cx="76" cy="106" rx="11" ry="8" fill="#8a5c31"/>
  <circle cx="36" cy="44" r="10" fill="#a06f42"/><circle cx="36" cy="44" r="5.6" fill="#eec49a"/>
  <circle cx="88" cy="44" r="10" fill="#a06f42"/><circle cx="88" cy="44" r="5.6" fill="#eec49a"/>
  <circle cx="62" cy="44" r="26" fill="url(#moFur)"/>
  <ellipse cx="62" cy="50" rx="18" ry="16" fill="#f2cfa4"/>
  <path d="M44 30 Q54 18 62 28 Q70 18 80 30 Q62 24 44 30 Z" fill="#7d5029"/>
  <circle cx="54" cy="43" r="4.4" fill="#33231a"/><circle cx="55.4" cy="41.4" r="1.6" fill="#fff"/>
  <circle cx="70" cy="43" r="4.4" fill="#33231a"/><circle cx="71.4" cy="41.4" r="1.6" fill="#fff"/>
  <ellipse cx="62" cy="55" rx="10" ry="6.5" fill="#e3b485"/>
  <ellipse cx="58.6" cy="53" rx="1.5" ry="1.9" fill="#8a5c31"/>
  <ellipse cx="65.4" cy="53" rx="1.5" ry="1.9" fill="#8a5c31"/>
  <path d="M54 59 Q62 66 70 59" stroke="#8a5c31" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="44" cy="52" r="4.2" fill="#ff9bb0" opacity=".55"/>
  <circle cx="80" cy="52" r="4.2" fill="#ff9bb0" opacity=".55"/>
</svg>`;

const monkeyLevel = {
  theme: "theme-zoo", rounds: 5, raf: null,

  startRound() {
    this.cleanup();
    this.done = false;
    this.got = 0;
    this.goal = [4, 5, 6][state.tier];
    this.miss = 0;
    this.reduced = reducedMotion();
    this.speedMul = [1, 1.25, 1.5][state.tier] * (this.reduced ? 0.6 : 1);
    this.bananas = [];
    this.spawnIn = 0.6;

    setInstruction(moL(MO_TXT.show), moL(MO_TXT.say));

    const pips = Array.from({ length: this.goal }, (_, i) => `<span class="mo-pip" data-i="${i}">◯</span>`).join("");
    $("playArea").innerHTML =
      // drift + motes only: the jungle floor and canopy are scrolling strips, and the
      // sky in between is where she jumps, so it stays walkable
      scene.html("forest", { seed: 14 + state.round * 4, layers: ["drift", "motes"] }) + `
      <style>
        .mo-stage{position:absolute;inset:0;overflow:hidden;z-index:5;touch-action:none;cursor:pointer}
        /* vmin, not %: a strip tile is 6:1, so the band's height is what sets tree size */
        .mo-canopy{position:absolute;top:0;left:0;right:0;height:clamp(40px,13vmin,104px);overflow:hidden;white-space:nowrap;z-index:1;opacity:.9}
        .mo-far{position:absolute;bottom:19%;left:0;right:0;height:clamp(56px,18vmin,140px);overflow:hidden;white-space:nowrap;opacity:.85;z-index:1}
        .mo-near{position:absolute;bottom:11%;left:0;right:0;height:clamp(64px,21vmin,165px);overflow:hidden;white-space:nowrap;opacity:.95;z-index:2}
        .mo-canopy .marquee, .mo-far .marquee, .mo-near .marquee{height:100%;white-space:nowrap;display:inline-block}
        .mo-ground{position:absolute;left:0;right:0;bottom:0;height:20%;background:linear-gradient(#c8e89a,#8fc85a 55%,#6fb23f);pointer-events:none;z-index:1}
        .mo-hud{position:absolute;top:17%;left:50%;transform:translateX(-50%);display:flex;gap:clamp(3px,1vmin,7px);z-index:9;background:rgba(30,80,20,.32);padding:clamp(3px,1vmin,7px) clamp(8px,2.4vmin,16px);border-radius:999px}
        .mo-pip{font-size:clamp(15px,4vmin,26px);line-height:1;color:#eafbe0}
        .mo-pip.on{color:#ffd23e}
        .mo-banana{position:absolute;font-size:clamp(30px,8.5vmin,60px);line-height:1;transform:translate(-50%,-50%);z-index:4;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))}
        .mo-banana.got{animation:moPop .3s ease forwards}
        @keyframes moPop{0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
        .mo-monkey{position:absolute;width:clamp(62px,18vmin,132px);height:auto;transform:translate(-50%,-50%);z-index:6;pointer-events:none;filter:drop-shadow(0 5px 6px rgba(0,0,0,.3));will-change:top,transform}
        .mo-monkey svg{display:block;width:100%;height:auto}
      </style>
      <div class="mo-stage" id="moStage">
        <div class="mo-canopy"><span class="marquee" style="animation-duration:${(18 / this.speedMul).toFixed(1)}s">${scene.strip("forest", { band: "canopy", seed: 9 }).repeat(6)}</span></div>
        <div class="mo-far"><span class="marquee" style="animation-duration:${(26 / this.speedMul).toFixed(1)}s">${scene.strip("forest", { band: "far", seed: 9 }).repeat(6)}</span></div>
        <div class="mo-ground"></div>
        <div class="mo-near"><span class="marquee" style="animation-duration:${(16 / this.speedMul).toFixed(1)}s">${scene.strip("forest", { band: "near", seed: 9 }).repeat(6)}</span></div>
        <div class="mo-hud" id="moHud">${pips}</div>
        <div class=.mo-bananas" id="moBananas"></div>
        <div class="mo-monkey" id="moMonkey">${MONKEY_ART}</div>
      </div>`;

    const stage = $("moStage");
    const H0 = stage.clientHeight || $("playArea").clientHeight;
    this.groundY = H0 * 0.78;
    this.ceilY = H0 * 0.24;
    this.y = this.groundY;
    this.vy = 0;
    this.g = H0 * 2.4;
    this.jumpV = H0 * 1.5;
    this.monkey = $("moMonkey");
    this.monkey.style.left = "22%";
    this.monkey.style.top = this.y + "px";

    this._tap = () => this.jump();
    stage.addEventListener("pointerdown", this._tap);
    this._stage = stage;

    this.lastT = performance.now();
    const loop = t => { this.frame(t); if (this.raf !== null) this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  jump() {
    if (this.done) return;
    this.vy = -this.jumpV;   // tap swings the monkey up; taps chain for extra lift
    sfx.tap();
    tone(500, 0, .08, "sine", .1);
  },

  frame(t) {
    const dt = Math.min(50, t - this.lastT) / 1000;
    this.lastT = t;
    if (!$("playArea").isConnected || !$("moBananas") || this.done) return;
    const stage = this._stage;
    const W = stage.clientWidth, H = stage.clientHeight;
    this.groundY = H * 0.78; this.ceilY = H * 0.24;

    // monkey physics: tap = up impulse, gravity pulls back to the ground (never falls off)
    this.vy += this.g * dt;
    this.y += this.vy * dt;
    if (this.y >= this.groundY) { this.y = this.groundY; this.vy = 0; }
    if (this.y < this.ceilY) { this.y = this.ceilY; this.vy = 0; }
    const rot = clamp(this.vy * 0.03, -22, 26);
    this.monkey.style.top = this.y + "px";
    this.monkey.style.transform = `translate(-50%,-50%) rotate(${rot.toFixed(1)}deg) scaleX(-1)`;

    // spawn bananas — bias toward reachable heights, some low enough to grab while running
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.bananas.filter(b => !b.hit).length < 3 && this.got < this.goal) {
      this.spawnBanana(W, H);
      this.spawnIn = randBetween(0.85, 1.4) / this.speedMul;
    }

    const monkeyCX = W * 0.22;
    const speed = (W / 700) * 150 * this.speedMul;
    for (const bn of this.bananas) {
      if (bn.hit) continue;
      bn.x -= speed * dt;
      bn.el.style.left = bn.x + "px";
      if (Math.abs(bn.x - monkeyCX) < W * 0.1 && Math.abs(bn.y - this.y) < H * 0.07) this.grab(bn);
    }
    this.bananas = this.bananas.filter(bn => {
      if (bn.hit) return false;
      if (bn.x < -60) { this.miss++; if (bn.el.isConnected) bn.el.remove(); return false; }
      return true;
    });
  },

  spawnBanana(W, H) {
    const el = document.createElement("div");
    el.className = "mo-banana";
    el.textContent = "🍌";
    // 45% low (grabbable at a run / small hop), rest spread up toward the canopy.
    // After repeated misses, spawn only low bananas so a run or tiny hop always collects.
    const low = this.miss >= 3 ? true : Math.random() < 0.45;
    const y = low
      ? randBetween(this.groundY - H * 0.06, this.groundY)
      : randBetween(this.ceilY + H * 0.02, this.groundY - H * 0.08);
    const x = W + 50;
    el.style.left = x + "px";
    el.style.top = y + "px";
    $("moBananas").appendChild(el);
    this.bananas.push({ el, x, y, hit: false });
  },

  grab(bn) {
    bn.hit = true;
    bn.el.classList.add("got");
    core.wait(() => { if (bn.el.isConnected) bn.el.remove(); }, 300);
    const r = bn.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    sfx.tap();
    this.got++;
    tone(560 + this.got * 70, 0, .14, "sine", .14);
    miniStar(cx, cy);
    floaters(["⭐", "✨"], cx, cy, 3);
    const pip = $("moHud") && $("moHud").querySelector(`.mo-pip[data-i="${this.got - 1}"]`);
    if (pip) { pip.textContent = "🍌"; pip.classList.add("on"); }
    if (this.got >= this.goal) this.finish();
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
    if (this._stage) { this._stage.removeEventListener("pointerdown", this._tap); this._stage = null; }
    this.bananas = [];
  }
};

registerGame({
  id: "monkey", world: "animal", icon: "🐒", name: "Monkey Swing", es: "Mono", yue: "馬騮",
  lvl: 1, cue: "whoosh", level: monkeyLevel
});
