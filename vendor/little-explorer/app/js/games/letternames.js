"use strict";
/* LEVEL: Letter Lights
   STEM objective · Phonological awareness / literacy · letter-NAME recognition + symbol→sound link · age 3–4.
   Success = child sees a glowing letter, hears its name + a keyword whole-word, and taps the picture that
   starts with that letter — bridging the printed symbol to its name and beginning sound.

   NOTE (audio): this project ships no audio files and Web Speech reads an isolated phoneme (e.g. "/b/") as
   the LETTER NAME, so the teaching never voices a bare phoneme. It says the letter name and a whole keyword
   with emphasis ("A — like AIRPLANE! Airplane starts with A"), which is the reliable, on-brand cue.
   Cross-lingual: keyword pictures are chosen so the English AND Panamanian-Spanish word both begin with the
   target letter (avión, bebé, mono, sol, flor, león, dinosaurio, pizza — banana=guineo is deliberately avoided).
   Cantonese has no alphabet, so YUE teaches the English letter name and names the picture in Cantonese. */

const llL = obj => obj[curLang()] || obj.en;

// Each letter → its keyword picture (whole-object emoji) with a name per language.
// EN + ES words both start with the letter; YUE names the object (letter stays English).
const LL_LETTERS = {
  A: { pic: "✈️", word: { en: "airplane", es: "avión",       yue: "飛機" } },
  B: { pic: "👶", word: { en: "baby",     es: "bebé",        yue: "BB" } },
  M: { pic: "🐒", word: { en: "monkey",   es: "mono",        yue: "馬騮" } },
  S: { pic: "☀️", word: { en: "sun",      es: "sol",         yue: "太陽" } },
  F: { pic: "🌸", word: { en: "flower",   es: "flor",        yue: "花" } },
  L: { pic: "🦁", word: { en: "lion",     es: "león",        yue: "獅子" } },
  D: { pic: "🦕", word: { en: "dinosaur", es: "dinosaurio",  yue: "恐龍" } },
  P: { pic: "🍕", word: { en: "pizza",    es: "pizza",       yue: "薄餅" } }
};

// Per-tier: which letters are in play + how many picture choices. Higher tiers add near-miss foils.
const LL_TIERS = [
  { pool: ["A", "B", "M"],                          choices: 2 },  // tier 0 — max-distinct
  { pool: ["A", "B", "M", "S", "F"],                choices: 3 },  // tier 1 — one plausible foil
  { pool: ["A", "B", "M", "S", "F", "L", "D", "P"], choices: 3 }   // tier 2 — two foils, incl. a look/sound-alike
];

// Letters that are easy to confuse by shape or sound — used to pick a "tricky" foil at tier 2.
const LL_CONFUSE = { B: "D", D: "B", M: "S", P: "B", F: "S", L: "A", A: "L", S: "M" };

// A friendly drawn "letter light" — a chunky rounded tile that glows, ringed with theatre marquee bulbs.
// The letter glyph sits on the tile; bulbs + glow animate (and rest complete at frame 0 for reduced-motion).
function llLightSVG(letter) {
  const bulbs = [];
  const cx = 60, cy = 60, R = 50;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    bulbs.push(`<circle class="ll-bulb" style="animation-delay:${(i * 0.12).toFixed(2)}s"
      cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="#fff4b8" stroke="#ffb24a" stroke-width="1.6"/>`);
  }
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
    <defs><radialGradient id="llGlow" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#fff7c2"/><stop offset="60%" stop-color="#ffd23e"/><stop offset="100%" stop-color="#ff9e2c"/>
    </radialGradient></defs>
    <circle class="ll-halo" cx="60" cy="60" r="46" fill="#ffd23e" opacity="0.35"/>
    ${bulbs.join("")}
    <rect x="24" y="24" width="72" height="72" rx="20" fill="url(#llGlow)" stroke="#ff8a1e" stroke-width="3"/>
    <rect x="30" y="30" width="60" height="26" rx="13" fill="#fff" opacity="0.35"/>
    <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
      font-family="'Baloo 2','Fredoka',system-ui,sans-serif" font-weight="800"
      font-size="52" fill="#5a3a00">${letter}</text>
  </svg>`;
}

const letternamesLevel = {
  theme: "theme-trace", rounds: 4,

  startRound() {
    const tier = LL_TIERS[state.tier] || LL_TIERS[0];
    this.done = false;
    this.mistakes = 0;
    this.token = (this.token || 0) + 1;          // guards idle timers against stale round fires
    const myToken = this.token;

    // Pick the target letter, then build the choice set (target + distinct foils).
    this.target = rand(tier.pool);
    const choices = [this.target];
    // At tier 2, seed one deliberately confusable foil so the child must attend to the beginning sound.
    if (state.tier >= 2 && LL_CONFUSE[this.target] && tier.pool.includes(LL_CONFUSE[this.target])) {
      choices.push(LL_CONFUSE[this.target]);
    }
    const rest = shuffle(tier.pool.filter(k => !choices.includes(k)));
    while (choices.length < tier.choices && rest.length) choices.push(rest.pop());
    this.choiceOrder = shuffle(choices);

    setInstruction(
      "🔤 " + llL({ en: "Letter Lights", es: "Letras que Brillan", yue: "字母燈" }),
      llL({
        en: "Look at the glowing letter. Tap the picture that starts with it!",
        es: "Mira la letra que brilla. ¡Toca el dibujo que empieza con ella!",
        yue: "睇下發光嘅字母。㩒個同佢一樣開頭嘅圖畫！"
      })
    );

    const tiles = this.choiceOrder.map(k =>
      `<button class="ll-choice" data-k="${k}" aria-label="${llL(LL_LETTERS[k].word)}">
         <span class="ll-pic">${LL_LETTERS[k].pic}</span></button>`
    ).join("");

    $("playArea").innerHTML =
      scene.html("space", { seed: 18 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) + `
      <style>
        .ll-stage{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:clamp(14px,4vmin,34px);padding:2vmin}
        .ll-light{width:clamp(120px,34vmin,220px);height:clamp(120px,34vmin,220px);
          filter:drop-shadow(0 6px 14px rgba(255,158,44,.5))}
        .ll-halo{transform-origin:60px 60px;animation:llHalo 2.4s ease-in-out infinite}
        .ll-bulb{animation:llBulb 1.6s ease-in-out infinite}
        @keyframes llHalo{0%,100%{opacity:.28;transform:scale(.96)}50%{opacity:.5;transform:scale(1.04)}}
        @keyframes llBulb{0%,100%{opacity:.55}50%{opacity:1}}
        .ll-choices{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(12px,4vmin,30px);
          max-width:min(94vw,760px)}
        .ll-choice{border:none;background:#ffffff;border-radius:26px;padding:0;cursor:pointer;
          width:clamp(96px,26vmin,150px);height:clamp(96px,26vmin,150px);min-width:44px;min-height:44px;
          display:flex;align-items:center;justify-content:center;box-shadow:0 5px 0 rgba(0,0,0,.14);
          touch-action:manipulation;transition:transform .14s,box-shadow .14s}
        .ll-choice:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.14)}
        .ll-pic{font-size:clamp(48px,13vmin,84px);line-height:1;pointer-events:none}
        .ll-choice.ll-pop .ll-pic{animation:llPop .5s ease}
        @keyframes llPop{0%{transform:scale(1)}45%{transform:scale(1.22)}100%{transform:scale(1.1)}}
        .ll-choice.ll-dim{opacity:.32;filter:grayscale(.5)}
        @media(prefers-reduced-motion:reduce){
          .ll-halo,.ll-bulb,.ll-choice.ll-pop .ll-pic{animation:none}
          .ll-halo{opacity:.42}.ll-bulb{opacity:1}
        }
      </style>
      <div class="ll-stage" id="llStage">
        <div class="ll-light" id="llLight">${llLightSVG(this.target)}</div>
        <div class="ll-choices" id="llChoices">${tiles}</div>
      </div>`;

    $("llChoices").querySelectorAll(".ll-choice").forEach(b => b.onclick = ev => this.pick(b, ev));

    // Teach the letter after the instruction settles, then arm the idle-assist ladder.
    core.wait(() => { if (this.token === myToken && !this.done) this.teach(); }, 900);
    this.armIdle(myToken);
  },

  // Voice: letter name + keyword whole-word (never an isolated phoneme).
  teach() {
    const w = llL(LL_LETTERS[this.target].word);
    speak(llL({
      en: `This is ${this.target}. ${this.target} — like ${w.toUpperCase()}! Can you find the ${w}?`,
      es: `Esta es la ${this.target}. ${this.target} — ¡como ${w.toUpperCase()}! ¿Puedes encontrar el ${w}?`,
      yue: `呢個係 ${this.target}。${this.target} — ${w}！搵下 ${w} 喺邊度？`
    }));
  },

  // Idle-assist ladder: a passive child is gently guided, escalating to a guided reveal that completes the
  // round — no fail state, and it "rescues" a player who never taps.
  armIdle(myToken) {
    const live = () => this.token === myToken && !this.done && state.level === "letternames" && !state.busy;
    core.wait(() => { if (live()) this.teach(); }, 6000);                 // re-say the letter
    core.wait(() => { if (live()) this.highlight(); }, 11000);           // glow the right picture
    core.wait(() => { if (live()) this.guidedReveal(myToken); }, 16500); // dim foils + auto-complete
  },

  highlight() {
    const el = $("llChoices") && $("llChoices").querySelector(`.ll-choice[data-k="${this.target}"]`);
    if (el) { el.classList.add("hint-highlight"); wiggle(el); }
    const w = llL(LL_LETTERS[this.target].word);
    speak(llL({
      en: `Here it is — the ${w}!`, es: `¡Aquí está — el ${w}!`, yue: `喺呢度呀 — ${w}！`
    }));
  },

  guidedReveal(myToken) {
    if (this.token !== myToken || this.done || state.busy) return;
    const wrap = $("llChoices"); if (!wrap) return;
    const el = wrap.querySelector(`.ll-choice[data-k="${this.target}"]`);
    wrap.querySelectorAll(".ll-choice").forEach(b => { if (b !== el) b.classList.add("ll-dim"); });
    if (el) { el.classList.add("hint-highlight"); this.win(el, true); }
  },

  pick(el, ev) {
    if (this.done || state.busy) return;
    const k = el.dataset.k;
    if (k === this.target) {
      this.win(el, false, ev);
    } else {
      this.mistakes++;
      sfx.bad();                                   // feeds the auto-difficulty perf model
      wiggle(el);
      el.classList.add("ll-dim");
      const w = llL(LL_LETTERS[this.target].word);
      if (this.mistakes >= 2) this.highlight();    // guided assist by the ~2nd–3rd miss
      else speak(llL({
        en: `Try again — find the ${w}!`, es: `Inténtalo otra vez — ¡busca el ${w}!`, yue: `再試下 — 搵 ${w}！`
      }));
      if (this.mistakes >= 3) {
        const right = $("llChoices").querySelector(`.ll-choice[data-k="${this.target}"]`);
        if (right) wiggle(right);
      }
    }
  },

  win(el, wasAssisted, ev) {
    if (this.done) return;
    this.done = true;
    state.busy = true;
    const w = llL(LL_LETTERS[this.target].word);
    el.classList.remove("ll-dim");
    el.classList.add("ll-pop");
    // Relight the letter tile to reconnect symbol ↔ name ↔ sound in the celebration.
    const light = $("llLight");
    if (light) { light.classList.remove("hint-highlight"); void light.offsetWidth; light.classList.add("hint-highlight"); }
    sfx.tap();
    tone(660, 0, .18, "sine", .14);
    const r = el.getBoundingClientRect();
    miniStar(r.left + r.width / 2, r.top + r.height / 2);
    floaters(["⭐", "✨", "🔤"], r.left + r.width / 2, r.top + r.height / 2, 5);
    const cue = wasAssisted
      ? llL({ en: `${w.toUpperCase()} starts with ${this.target}!`,
              es: `¡${w.toUpperCase()} empieza con ${this.target}!`,
              yue: `${w} 係 ${this.target} 開頭！` })
      : llL({ en: `Yes! ${w.toUpperCase()} starts with ${this.target}!`,
              es: `¡Sí! ¡${w.toUpperCase()} empieza con ${this.target}!`,
              yue: `啱喇！${w} 係 ${this.target} 開頭！` }) + " " + praise();
    speak(cue);
    roundComplete();
  }
};

registerGame({
  id: "letternames", world: "brain", icon: "🔤", name: "Letter Lights",
  es: "Letras que Brillan", yue: "字母燈", lvl: 1, cue: "bell", v: 41, level: letternamesLevel
});
