"use strict";
// Literacy · letter recognition + matching · age 3-5
// Success = child steers a descending plane and lands it on the runway whose letter matches the plane's.

const rwL = obj => obj[curLang()] || obj.en;

const RW_LETTERS = ["A", "B", "C", "D", "E", "F", "H", "K", "L", "M", "O", "P", "R", "S", "T", "U"];
const RW_PAL = [["#e8534e", "#c53f3a"], ["#4f9fe0", "#3a7fc0"], ["#f2a53d", "#d68521"], ["#6ac36a", "#4fa34f"], ["#8b6cff", "#6b4fd6"]];

const planeSVG = (body, wing, letter) => `<svg viewBox="0 0 100 122" width="100%" height="100%">
  <path d="M6 60 L44 50 L44 66 L6 74 Z" fill="${wing}"/>
  <path d="M94 60 L56 50 L56 66 L94 74 Z" fill="${wing}"/>
  <path d="M30 100 L46 95 L46 105 L30 109 Z" fill="${wing}"/>
  <path d="M70 100 L54 95 L54 105 L70 109 Z" fill="${wing}"/>
  <path d="M50 8 Q61 20 61 42 L61 102 Q61 114 50 116 Q39 114 39 102 L39 42 Q39 20 50 8 Z" fill="${body}"/>
  <ellipse cx="50" cy="30" rx="8" ry="10" fill="#bfe6ff" stroke="#fff" stroke-width="1.5"/>
  <circle cx="50" cy="68" r="15" fill="#fff"/>
  <text x="50" y="76" text-anchor="middle" font-size="22" font-weight="800" fill="#33404d" font-family="'Baloo 2',sans-serif">${letter}</text>
</svg>`;

const runwayLevel = {
  theme: "theme-sky", rounds: 5, raf: null,

  startRound() {
    this.cleanup();
    this.done = false;
    this.mistakes = 0;
    const nPads = [2, 3, 4][state.tier];
    this.descRate = [0.13, 0.17, 0.22][state.tier] * (reducedMotion() ? 0.7 : 1);

    const letters = shuffle(RW_LETTERS).slice(0, nPads);
    this.target = rand(letters);
    const [body, wing] = rand(RW_PAL);

    setInstruction(
      "✈️ " + rwL({ en: `Land on ${this.target}!`, es: `¡Aterriza en la ${this.target}!`, yue: `降落喺 ${this.target}！` }),
      rwL({ en: `Steer the plane and land it on the runway with the letter ${this.target}!`,
            es: `¡Guía el avión y aterriza en la pista con la letra ${this.target}!`,
            yue: `控制架飛機，降落喺有 ${this.target} 字嘅跑道！` })
    );

    const pads = letters.map((L, i) =>
      `<div class="rw-pad" data-letter="${L}" data-i="${i}" style="left:${((i + 0.5) / nPads * 100).toFixed(2)}%">
         <div class="rw-strip"></div><div class="rw-letter">${L}</div>
       </div>`).join("");

    $("playArea").innerHTML =
      // no canopy: this screen makes its own clouds. No mid/ground/frame: the landing
      // strips fill the bottom quarter and she flies the plane down onto them.
      scene.html("meadow", { seed: 30 + state.round * 4, layers: ["far", "drift", "motes"] }) + `
      <style>
        .rw-stage{position:absolute;inset:0;overflow:hidden;z-index:5;touch-action:none;cursor:grab}
        .rw-stage:active{cursor:grabbing}
        .rw-cloud{position:absolute;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,rgba(255,255,255,.7));opacity:.85;pointer-events:none;z-index:1}
        .rw-ground{position:absolute;left:0;right:0;bottom:0;height:26%;background:linear-gradient(#bfe08a,#8fc85a);pointer-events:none;z-index:1}
        .rw-pads{position:absolute;left:0;right:0;bottom:2%;height:24%;z-index:2}
        .rw-pad{position:absolute;bottom:0;transform:translateX(-50%);width:clamp(60px,20vmin,150px);height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
        .rw-strip{width:86%;height:70%;background:repeating-linear-gradient(#4a4f57 0 14px,#3d424a 14px 28px);border-radius:8px 8px 0 0;position:relative;box-shadow:inset 0 0 0 3px #6b7078}
        .rw-strip::after{content:"";position:absolute;left:50%;top:8%;bottom:8%;width:5px;transform:translateX(-50%);background:repeating-linear-gradient(#ffd23e 0 12px,transparent 12px 24px)}
        .rw-letter{position:absolute;bottom:34%;font-size:clamp(26px,7.5vmin,54px);font-weight:800;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.5)}
        .rw-pad.rw-hint .rw-strip{box-shadow:inset 0 0 0 3px #ffd23e,0 0 20px 5px rgba(255,210,62,.85);animation:rwPulse .7s ease-in-out infinite}
        @keyframes rwPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .rw-plane{position:absolute;width:clamp(64px,17vmin,128px);height:auto;transform:translate(-50%,-50%);z-index:6;pointer-events:none;filter:drop-shadow(0 5px 6px rgba(0,0,0,.28))}
        .rw-plane.rw-land{animation:rwLand .4s ease forwards}
        @keyframes rwLand{0%{transform:translate(-50%,-50%) scale(1)}60%{transform:translate(-50%,-46%) scale(1.05)}100%{transform:translate(-50%,-50%) scale(1)}}
      </style>
      <div class="rw-stage" id="rwStage">
        <div class="rw-ground"></div>
        <div class="rw-pads" id="rwPads">${pads}</div>
        <div class="rw-plane" id="rwPlane">${planeSVG(body, wing, this.target)}</div>
      </div>`;

    const stage = $("rwStage");
    for (let i = 0; i < 5; i++) {
      const c = document.createElement("span");
      c.className = "rw-cloud";
      const w = randBetween(40, 90);
      c.style.width = w + "px"; c.style.height = w * 0.6 + "px";
      c.style.left = randBetween(2, 88) + "%"; c.style.top = randBetween(6, 40) + "%";
      stage.appendChild(c);
    }

    const H0 = stage.clientHeight || $("playArea").clientHeight;
    const W0 = stage.clientWidth || $("playArea").clientWidth;
    this.topY = H0 * 0.12;
    this.landY = H0 * 0.70;
    this.y = this.topY;
    this.x = W0 * 0.5;
    this.tx = this.x;
    this.plane = $("rwPlane");
    this.plane.style.left = this.x + "px";
    this.plane.style.top = this.y + "px";

    const setTarget = ev => { const r = stage.getBoundingClientRect(); this.tx = clamp(ev.clientX - r.left, W0 * 0.08, W0 * 0.92); };
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
    if (!$("playArea").isConnected || !$("rwPads") || this.done) return;
    const stage = this._stage;
    const H = stage.clientHeight;
    this.landY = H * 0.70;

    this.x += (this.tx - this.x) * Math.min(1, dt * 10);
    this.y += this.descRate * H * dt;
    const bank = clamp((this.tx - this.x) * 0.4, -18, 18);   // tilt toward steering direction
    this.plane.style.left = this.x + "px";
    this.plane.style.top = this.y + "px";
    this.plane.style.transform = `translate(-50%,-50%) rotate(${bank.toFixed(1)}deg)`;

    if (this.y >= this.landY) this.tryLand();
  },

  tryLand() {
    const padsEl = [...$("rwPads").querySelectorAll(".rw-pad")];
    let best = null, bestD = Infinity;
    for (const p of padsEl) {
      const r = p.getBoundingClientRect();
      const sr = this._stage.getBoundingClientRect();
      const cx = r.left + r.width / 2 - sr.left;
      const d = Math.abs(cx - this.x);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return;

    if (best.dataset.letter === this.target) {
      this.done = true;
      this.cleanup();
      this.plane.classList.add("rw-land");
      const r = this.plane.getBoundingClientRect();
      sfx.tap();
      tone(660, 0, .16, "sine", .15);
      miniStar(r.left + r.width / 2, r.top + r.height / 2);
      floaters(["✨", "⭐", "☁️"], r.left + r.width / 2, r.top + r.height / 2, 5);
      speak(this.target + "! " + rwL({ en: "Great landing!", es: "¡Buen aterrizaje!", yue: "降得好好！" }) + " " + praise());
      state.busy = true;
      roundComplete();
    } else {
      // wrong runway — no fail, the plane climbs back up to try again
      this.mistakes++;
      sfx.bad();
      this.y = this.topY;
      speak(rwL({ en: `That's ${best.dataset.letter}! Find ${this.target}!`, es: `¡Es la ${best.dataset.letter}! ¡Busca la ${this.target}!`, yue: `嗰個係 ${best.dataset.letter}！搵 ${this.target}！` }));
      if (this.mistakes >= 2) {
        const good = $("rwPads").querySelector(`.rw-pad[data-letter="${this.target}"]`);
        if (good) good.classList.add("rw-hint");
        if (this.mistakes >= 3) this.descRate = Math.min(this.descRate, 0.12);   // ease off so it's always winnable
      }
    }
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
  }
};

registerGame({
  id: "runway", world: "brain", icon: "✈️", name: "Plane Land", es: "Aterriza", yue: "降落",
  lvl: 1, cue: "engine", level: runwayLevel
});
