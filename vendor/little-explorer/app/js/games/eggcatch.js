"use strict";
// Sorting / classification · catch by color (discriminate a named color) + counting · age 3-5
// Success = child slides a basket left/right to catch the eggs of the color the voice names, letting others fall.

// this game holds its strings inline (like Night & Day) rather than in the core DICT
const egL = obj => obj[curLang()] || obj.en;

// A round never pairs red with green (see startRound) — the most common colorblind clash.
const EGG_COLORS = [
  { id: "red",    hex: "#e8534e", shade: "#c53f3a", name: "red",    es: "rojo",     yue: "紅色" },
  { id: "blue",   hex: "#4f9fe0", shade: "#3a7fc0", name: "blue",   es: "azul",     yue: "藍色" },
  { id: "yellow", hex: "#f2c53d", shade: "#d6a521", name: "yellow", es: "amarillo", yue: "黃色" },
  { id: "green",  hex: "#6ac36a", shade: "#4fa34f", name: "green",  es: "verde",    yue: "綠色" },
  { id: "purple", hex: "#9b5de5", shade: "#7b3fd0", name: "purple", es: "morado",   yue: "紫色" }
];

const eggSVG = (c) => `<svg viewBox="0 0 44 56" width="100%" height="100%">
  <ellipse cx="22" cy="30" rx="20" ry="25" fill="${c.hex}"/>
  <path d="M22 5 Q40 26 40 34 Q40 12 22 5 Z" fill="${c.shade}" opacity=".5"/>
  <ellipse cx="15" cy="20" rx="6" ry="9" fill="#fff" opacity=".35"/>
</svg>`;

const BASKET_SVG = `<svg viewBox="0 0 128 92" width="100%" height="100%">
  <ellipse cx="64" cy="26" rx="58" ry="16" fill="#8a531f"/>
  <ellipse cx="64" cy="24" rx="50" ry="12" fill="#5e3712"/>
  <path d="M9 26 Q64 44 119 26 L107 80 Q64 94 21 80 Z" fill="#b5763a"/>
  <g stroke="#8a531f" stroke-width="3" fill="none" opacity=".8">
    <path d="M20 34 Q64 50 108 34"/><path d="M22 48 Q64 62 106 48"/><path d="M26 62 Q64 74 102 62"/>
    <path d="M40 30 L36 82"/><path d="M64 33 L64 86"/><path d="M88 30 L92 82"/>
  </g>
</svg>`;

const EG_TXT = {
  show0: { en: "🧺 Catch the eggs!", es: "🧺 ¡Atrapa los huevos!", yue: "🧺 接住啲雞蛋！" },
  say0:  { en: "Slide the basket to catch the falling eggs!", es: "¡Desliza la cesta para atrapar los huevos!", yue: "左右移動個籃，接住跌落嚟嘅蛋！" },
  keep:  { en: "Keep going!", es: "¡Sigue!", yue: "繼續！" }
};

const eggcatchLevel = {
  theme: "theme-farm", rounds: 5, raf: null,

  startRound() {
    this.cleanup();
    this.done = false;
    this.caught = 0;
    this.goal = [4, 5, 6][state.tier];
    this.goalSpeed = [1, 1.2, 1.45][state.tier];
    this.spawnMin = [0.85, 0.7, 0.55][state.tier];
    this.spawnMax = [1.5, 1.2, 0.95][state.tier];
    this.spawnIn = 0.5;
    this.sinceTarget = 0;
    this.miss = 0;
    this.eggs = [];
    this.reduced = reducedMotion();
    if (this.reduced) this.goalSpeed *= 0.6;   // calmer fall for reduced-motion

    const nColors = [1, 2, 3][state.tier];
    let palette;
    do { palette = shuffle(EGG_COLORS).slice(0, nColors); }              // never red + green together (colorblind clash)
    while (palette.some(c => c.id === "red") && palette.some(c => c.id === "green"));
    this.target = palette[0];
    this.palette = palette;
    this.sortByColor = nColors > 1;

    const cName = egL({ en: this.target.name, es: this.target.es, yue: this.target.yue });
    if (this.sortByColor) {
      setInstruction(
        "🧺 " + egL({ en: `Catch the ${cName} eggs!`, es: `¡Atrapa los huevos ${cName}!`, yue: `接住${cName}嘅蛋！` }),
        egL({ en: `Move the basket under the ${cName} eggs — let the other colors drop!`,
              es: `¡Pon la cesta bajo los huevos ${cName} — deja caer los otros!`,
              yue: `將個籃移到${cName}蛋下面，其他顏色由佢跌！` })
      );
    } else {
      setInstruction(egL(EG_TXT.show0), egL(EG_TXT.say0));
    }

    const pips = Array.from({ length: this.goal }, (_, i) => `<span class="eg-pip" data-i="${i}">◯</span>`).join("");
    $("playArea").innerHTML = `
      <style>
        .eg-stage{position:absolute;inset:0;overflow:hidden;z-index:5;touch-action:none;cursor:grab}
        .eg-stage:active{cursor:grabbing}
        .eg-ground{position:absolute;left:0;right:0;bottom:0;height:16%;background:linear-gradient(#f3e2a8,#e0c06a);pointer-events:none;z-index:1}
        .eg-hen{position:absolute;top:3%;left:50%;transform:translateX(-50%);font-size:clamp(46px,13vmin,96px);z-index:2;pointer-events:none;animation:egBob 1.6s ease-in-out infinite}
        @keyframes egBob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8%)}}
        .eg-perch{position:absolute;top:15.5%;left:18%;right:18%;height:clamp(6px,1.6vmin,12px);border-radius:6px;background:linear-gradient(#a9702e,#7a4e1e);z-index:1;pointer-events:none}
        .eg-hud{position:absolute;top:2%;left:2%;display:flex;gap:clamp(3px,1vmin,7px);z-index:9;background:rgba(90,60,20,.3);padding:clamp(3px,1vmin,7px) clamp(8px,2.2vmin,14px);border-radius:999px}
        .eg-pip{font-size:clamp(15px,4vmin,26px);color:#fff6e0;line-height:1}
        .eg-pip.on{color:#ffd23e}
        .eg-egg{position:absolute;width:clamp(30px,8vmin,58px);height:auto;transform:translate(-50%,-50%);z-index:4;pointer-events:none;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2))}
        .eg-egg.eg-caught{animation:egCatch .3s ease forwards}
        @keyframes egCatch{0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-30%) scale(.4);opacity:0}}
        .eg-egg.eg-splat{animation:egSplat .3s ease forwards}
        @keyframes egSplat{0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scaleY(.3) scaleX(1.3);opacity:0}}
        .eg-egg.eg-reject{animation:egReject .35s ease}
        @keyframes egReject{0%,100%{transform:translate(-50%,-50%) rotate(0)}30%{transform:translate(-70%,-50%) rotate(-18deg)}70%{transform:translate(-30%,-50%) rotate(18deg)}}
        .eg-basket{position:absolute;width:clamp(92px,25vmin,180px);height:auto;transform:translate(-50%,-50%);z-index:6;pointer-events:none;filter:drop-shadow(0 5px 5px rgba(0,0,0,.28))}
      </style>
      <div class="eg-stage" id="egStage">
        ${scene.html("meadow", { seed: 11 + state.round * 4, layers: ["canopy", "far", "drift", "mid", "motes", "frame"] })}
        <div class="eg-ground"></div>
        <div class="eg-perch"></div>
        <div class="eg-hen">🐔</div>
        <div class="eg-hud" id="egHud">${pips}</div>
        <div class="eg-eggfield" id="egEggs"></div>
        <div class="eg-basket" id="egBasket">${BASKET_SVG}</div>
      </div>`;

    const stage = $("egStage");
    const H0 = stage.clientHeight || $("playArea").clientHeight;
    const W0 = stage.clientWidth || $("playArea").clientWidth;
    this.basketY = H0 * 0.82;
    this.bx = W0 * 0.5;
    this.btx = this.bx;
    this.basket = $("egBasket");
    this.basket.style.top = this.basketY + "px";
    this.basket.style.left = this.bx + "px";

    const setTarget = ev => {
      const r = stage.getBoundingClientRect();
      this.btx = clamp(ev.clientX - r.left, stage.clientWidth * 0.09, stage.clientWidth * 0.91);
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
    if (!$("playArea").isConnected || !$("egEggs") || this.done) return;
    const stage = this._stage;
    const W = stage.clientWidth, H = stage.clientHeight;
    this.basketY = H * 0.82;

    // ease basket toward the finger
    this.bx += (this.btx - this.bx) * Math.min(1, dt * 12);
    this.basket.style.left = this.bx + "px";
    this.basket.style.top = this.basketY + "px";

    const targetFalling = this.eggs.some(e => !e.done && e.color.id === this.target.id);
    this.sinceTarget = targetFalling ? 0 : this.sinceTarget + dt;

    // spawn eggs from the hen
    const assist = this.miss >= 3;   // after repeated misses, help the child succeed
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.eggs.filter(e => !e.done).length < 3 && this.caught < this.goal) {
      let color;
      if (!this.sortByColor || assist) color = this.target;   // in assist mode, only target-color eggs fall
      else {
        const forceTarget = !targetFalling && this.sinceTarget > 1.7;
        color = forceTarget ? this.target : (Math.random() < 0.5 ? this.target : rand(this.palette));
      }
      // assist steers the egg toward wherever the basket is right now
      const spawnX = assist ? clamp(this.bx + randBetween(-W * 0.06, W * 0.06), W * 0.12, W * 0.88) : null;
      this.spawnEgg(W, H, color, spawnX);
      this.spawnIn = randBetween(this.spawnMin, this.spawnMax);
    }

    // fall + catch/miss
    const catchTol = W * (assist ? 0.15 : 0.09);   // more forgiving hit-box while assisting
    for (const e of this.eggs) {
      if (e.done) continue;
      e.y += e.vy * dt;
      e.el.style.top = e.y + "px";
      if (e.y >= this.basketY - H * 0.05 && e.y <= this.basketY + H * 0.04 && Math.abs(e.x - this.bx) < catchTol) {
        this.landInBasket(e);
      } else if (e.y > H + 40) {
        if (!this.sortByColor || e.color.id === this.target.id) this.miss++;   // a catchable egg slipped past
        e.done = true; if (e.el.isConnected) e.el.remove();
      }
    }
    this.eggs = this.eggs.filter(e => !e.done || e.el.isConnected);
  },

  spawnEgg(W, H, color, forcedX) {
    const el = document.createElement("div");
    el.className = "eg-egg";
    el.innerHTML = eggSVG(color);
    const x = forcedX != null ? forcedX : randBetween(W * 0.12, W * 0.88);
    const y = H * 0.2;
    el.style.left = x + "px";
    el.style.top = y + "px";
    $("egEggs").appendChild(el);
    this.eggs.push({ el, x, y, color, vy: H * 0.26 * this.goalSpeed, done: false });
  },

  landInBasket(e) {
    e.done = true;
    const r = e.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

    if (!this.sortByColor || e.color.id === this.target.id) {
      // right egg — score it
      e.el.classList.add("eg-caught");
      core.wait(() => { if (e.el.isConnected) e.el.remove(); }, 300);
      sfx.tap();
      this.caught++;
      tone(520 + this.caught * 70, 0, .14, "sine", .14);
      miniStar(cx, cy);
      floaters(["⭐", "✨"], cx, cy, 3);
      const pip = $("egHud") && $("egHud").querySelector(`.eg-pip[data-i="${this.caught - 1}"]`);
      if (pip) { pip.textContent = "⬤"; pip.classList.add("on"); }
      if (this.caught >= this.goal) { this.finish(); return; }
      if (this.caught === Math.ceil(this.goal / 2)) speak(egL(EG_TXT.keep));
    } else {
      // wrong color caught — no penalty, it just bounces out with a gentle cue
      e.el.classList.add("eg-reject");
      core.wait(() => { if (e.el.isConnected) e.el.remove(); }, 340);
      sfx.bad();
      const cName = egL({ en: this.target.name, es: this.target.es, yue: this.target.yue });
      speak(egL({ en: `Only ${cName} eggs!`, es: `¡Solo los huevos ${cName}!`, yue: `淨係接${cName}蛋！` }));
    }
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
    this.eggs = [];
  }
};

registerGame({
  id: "eggcatch", world: "shape", icon: "🥚", name: "Egg Catch", es: "Atrapa Huevos",
  yue: "接雞蛋", lvl: 0, cue: "pop", level: eggcatchLevel
});
