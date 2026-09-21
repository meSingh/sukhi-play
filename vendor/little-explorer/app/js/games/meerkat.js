"use strict";
// Sorting / classification · match pop-ups to a named target (listen + discriminate) · age 2-4
// Success = child pops only the animal the voice names as animals surface from burrows, ignoring the rest.

// this game holds its strings inline (like Night & Day) rather than in the core DICT
const mkL = obj => obj[curLang()] || obj.en;
const mkName = it => curLang() === "yue" ? it.yue : curLang() === "es" ? it.es : it.name;

const MK_ANIMALS = [
  { e: "🐵", name: "monkey",   es: "mono",       yue: "馬騮"   },
  { e: "🦁", name: "lion",     es: "león",       yue: "獅子"   },
  { e: "🐘", name: "elephant", es: "elefante",   yue: "大象"   },
  { e: "🦒", name: "giraffe",  es: "jirafa",     yue: "長頸鹿" },
  { e: "🦓", name: "zebra",    es: "cebra",      yue: "斑馬"   },
  { e: "🦛", name: "hippo",    es: "hipopótamo", yue: "河馬"   },
  { e: "🐧", name: "penguin",  es: "pingüino",   yue: "企鵝"   },
  { e: "🐼", name: "panda",    es: "panda",      yue: "熊貓"   },
  { e: "🐯", name: "tiger",    es: "tigre",      yue: "老虎"   },
  { e: "🐻", name: "bear",     es: "oso",        yue: "熊"     },
  { e: "🐨", name: "koala",    es: "koala",      yue: "樹熊"   },
  { e: "🦜", name: "parrot",   es: "loro",       yue: "鸚鵡"   }
];

// 6 burrows in a 3×2 grid (% of the play field)
const MK_HOLES = [
  { x: 22, y: 52 }, { x: 50, y: 46 }, { x: 78, y: 52 },
  { x: 30, y: 80 }, { x: 62, y: 82 }, { x: 88, y: 78 }
];

const meerkatLevel = {
  theme: "theme-zoo", rounds: 5, raf: null,

  startRound() {
    this.cleanup();
    this.done = false;
    this.popped = 0;
    this.miss = 0;
    this.goal = [4, 5, 6][state.tier];
    this.maxActive = [2, 3, 4][state.tier];
    this.upDur = [2.2, 1.8, 1.4][state.tier];
    this.spawnMin = [0.65, 0.5, 0.4][state.tier];
    this.spawnMax = [1.1, 0.85, 0.7][state.tier];
    if (reducedMotion()) { this.upDur *= 1.4; this.spawnMin *= 1.3; this.spawnMax *= 1.3; }  // calmer, slower pace
    this.spawnIn = 0.4;
    this.sinceTarget = 0;

    const nDistract = [1, 2, 3][state.tier];
    const pool = shuffle(MK_ANIMALS);
    this.target = pool[0];
    this.distractors = pool.slice(1, 1 + nDistract);

    const tName = mkName(this.target);
    setInstruction(
      "🐾 " + mkL({ en: `Pop the ${tName}!`, es: `¡Toca el ${tName}!`, yue: `㩒個${tName}！` }),
      mkL({ en: `Tap the ${tName} when they pop up — leave the others alone!`,
            es: `¡Toca el ${tName} cuando salga — deja los otros!`,
            yue: `${tName}彈出嚟就㩒佢，其他唔好掂！` })
    );

    const pips = Array.from({ length: this.goal }, (_, i) => `<span class="mk-pip" data-i="${i}">◯</span>`).join("");
    const holes = MK_HOLES.map((h, i) =>
      `<div class="mk-hole" data-h="${i}" style="left:${h.x}%;top:${h.y}%">
         <div class="mk-clip"><button class="mk-animal" data-h="${i}"></button></div>
         <div class="mk-mound"></div>
       </div>`).join("");

    $("playArea").innerHTML =
      // no mid/ground/frame: .mk-ground owns the bottom 62% and the burrows are placed
      // across it, so anything the kit drew down there would be buried or in her way
      scene.html("savanna", { seed: 22 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) + `
      <style>
        /* this screen's horizon is high — .mk-ground owns the bottom 62% — so the far hills
           are lifted to sit on it instead of at the kit's default height */
        #playArea .sc-far{bottom:57%;height:13%;opacity:.5}
        .mk-stage{position:absolute;inset:0;overflow:hidden;z-index:5}
        .mk-sun{position:absolute;top:5%;right:8%;width:clamp(40px,11vmin,86px);height:clamp(40px,11vmin,86px);border-radius:50%;background:radial-gradient(circle,#fff3ad,#ffd23e 65%,rgba(255,210,62,0) 72%);pointer-events:none}
        .mk-ground{position:absolute;left:0;right:0;bottom:0;height:62%;background:linear-gradient(#c8e89a,#8fc85a 40%,#6fb23f);pointer-events:none;z-index:1}
        .mk-grass{position:absolute;left:0;right:0;top:38%;height:5%;background:repeating-linear-gradient(85deg,#6fb23f 0 10px,#7cbd4a 10px 20px);opacity:.5;pointer-events:none;z-index:1}
        .mk-hud{position:absolute;top:2%;left:50%;transform:translateX(-50%);display:flex;gap:clamp(3px,1vmin,7px);z-index:9;background:rgba(60,40,10,.28);padding:clamp(3px,1vmin,7px) clamp(8px,2.4vmin,16px);border-radius:999px}
        .mk-pip{font-size:clamp(16px,4.4vmin,30px);color:#fff6e0;line-height:1}
        .mk-pip.on{color:#ffd23e}
        .mk-hole{position:absolute;transform:translate(-50%,-50%);width:clamp(78px,21vmin,138px);height:clamp(96px,26vmin,172px);z-index:4}
        .mk-clip{position:absolute;left:0;right:0;bottom:16%;top:0;overflow:hidden;display:flex;align-items:flex-end;justify-content:center}
        .mk-animal{border:none;background:none;padding:0;font-size:clamp(46px,13vmin,92px);line-height:1;cursor:pointer;touch-action:manipulation;
                   transform:translateY(122%);transition:transform .28s cubic-bezier(.34,1.5,.55,1)}
        .mk-animal.up{transform:translateY(4%)}
        .mk-animal.mk-tgt{filter:drop-shadow(0 0 9px #ffd23e) drop-shadow(0 0 4px #ffd23e)}
        .mk-animal.pop{animation:mkPop .34s ease forwards}
        @keyframes mkPop{0%{transform:translateY(4%) scale(1)}100%{transform:translateY(-46%) scale(1.35);opacity:0}}
        .mk-animal.mk-miss{animation:mkShake .3s}
        @keyframes mkShake{0%,100%{transform:translateY(4%) rotate(0)}25%{transform:translateY(4%) rotate(-9deg)}75%{transform:translateY(4%) rotate(9deg)}}
        .mk-mound{position:absolute;left:-8%;right:-8%;bottom:0;height:32%;border-radius:50%;
                  background:radial-gradient(ellipse at 50% 25%,#b9843f,#7b4f27);box-shadow:0 5px 7px rgba(0,0,0,.28);z-index:6}
        .mk-mound::before{content:"";position:absolute;left:22%;right:22%;top:14%;height:44%;border-radius:50%;background:#4a2f16}
      </style>
      <div class="mk-stage" id="mkStage">
        <div class="mk-sun"></div>
        <div class="mk-grass"></div>
        <div class="mk-ground"></div>
        <div class="mk-hud" id="mkHud">${pips}</div>
        ${holes}
      </div>`;

    this.holes = MK_HOLES.map((_, i) => ({
      el: $("mkStage").querySelector(`.mk-animal[data-h="${i}"]`),
      occupied: false, isTarget: false, upUntil: 0, def: null
    }));
    this.holes.forEach(h => { h.el.onclick = () => this.tap(h); });

    this.lastT = performance.now();
    const loop = t => { this.frame(t); if (this.raf !== null) this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  frame(t) {
    const dt = Math.min(50, t - this.lastT) / 1000;
    this.lastT = t;
    if (!$("playArea").isConnected || !$("mkStage") || this.done) return;

    const targetUp = this.holes.some(h => h.occupied && h.isTarget);
    this.sinceTarget = targetUp ? 0 : this.sinceTarget + dt;

    // duck any animal whose time is up
    for (const h of this.holes) if (h.occupied && t > h.upUntil) this.duck(h);

    // spawn a new pop-up
    this.spawnIn -= dt;
    const active = this.holes.filter(h => h.occupied).length;
    if (this.spawnIn <= 0 && active < this.maxActive && this.popped < this.goal) {
      const free = this.holes.filter(h => !h.occupied);
      if (free.length) {
        const forceTarget = !targetUp && this.sinceTarget > 1.6;
        const def = forceTarget ? this.target : (Math.random() < 0.5 ? this.target : rand(this.distractors));
        this.pop(rand(free), def, t);
      }
      this.spawnIn = randBetween(this.spawnMin, this.spawnMax);
    }
  },

  pop(h, def, t) {
    h.occupied = true;
    h.def = def;
    h.isTarget = def.e === this.target.e;
    const assist = h.isTarget && this.miss >= 3;                    // after misses, the target lingers + glows
    h.upUntil = t + (assist ? this.upDur * 1.9 : this.upDur) * 1000; // t is performance.now() in ms; upDur is seconds
    h.el.textContent = def.e;
    h.el.classList.remove("pop", "mk-miss", "mk-tgt");
    void h.el.offsetWidth;
    h.el.classList.add("up");
    if (assist) h.el.classList.add("mk-tgt");
  },

  duck(h) {
    if (h.isTarget) this.miss++;                                    // a wanted animal ducked before it was tapped
    h.occupied = false;
    h.isTarget = false;
    h.def = null;
    h.el.classList.remove("up", "mk-tgt");
  },

  tap(h) {
    if (this.done || state.busy) return;
    if (!h.occupied || !h.el.classList.contains("up")) return;

    if (h.isTarget) {
      h.occupied = false; h.isTarget = false;
      h.el.classList.remove("up");
      h.el.classList.add("pop");
      const r = h.el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      sfx.tap();
      this.popped++;
      tone(520 + this.popped * 70, 0, .14, "sine", .14);
      miniStar(cx, cy);
      floaters(["⭐", "✨"], cx, cy, 4);
      const pip = $("mkHud") && $("mkHud").querySelector(`.mk-pip[data-i="${this.popped - 1}"]`);
      if (pip) { pip.textContent = "⬤"; pip.classList.add("on"); }
      core.wait(() => { h.el.classList.remove("pop"); }, 360);
      if (this.popped >= this.goal) { this.finish(); return; }
      // light praise only occasionally so it never chatters
      if (this.popped === Math.ceil(this.goal / 2)) speak(mkL({ en: "Keep going!", es: "¡Sigue!", yue: "繼續！" }));
    } else {
      sfx.bad();
      h.el.classList.remove("mk-miss"); void h.el.offsetWidth; h.el.classList.add("mk-miss");
      const other = mkName(h.def), tgt = mkName(this.target);
      speak(mkL({ en: `That's a ${other}! Pop the ${tgt}!`, es: `¡Es un ${other}! ¡Toca el ${tgt}!`, yue: `嗰個係${other}！㩒個${tgt}！` }));
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
    this.holes = [];
  }
};

registerGame({
  id: "meerkat", world: "animal", icon: "🦁", name: "Zoo Pop", es: "Zoológico", yue: "動物園",
  lvl: 0, cue: "chirp", level: meerkatLevel
});
