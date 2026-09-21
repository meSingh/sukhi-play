"use strict";
// Scientific thinking · observation — match an object to the SENSE you'd use to explore it · age 2-4
// Success = child taps the sense (see/hear/smell/taste/touch) that matches the shown object. No fail state.

const seL = obj => obj[curLang()] || obj.en;

const SENSES = {
  see:   { emo: "👁️", name: { en: "See",   es: "Ver",    yue: "睇" },   part: { en: "eyes",  es: "los ojos",  yue: "眼仔" } },
  hear:  { emo: "👂", name: { en: "Hear",  es: "Oír",    yue: "聽" },   part: { en: "ears",  es: "los oídos", yue: "耳仔" } },
  smell: { emo: "👃", name: { en: "Smell", es: "Oler",   yue: "聞" },   part: { en: "nose",  es: "la nariz",  yue: "個鼻" } },
  taste: { emo: "👅", name: { en: "Taste", es: "Probar", yue: "試味" }, part: { en: "mouth", es: "la boca",   yue: "個口" } },
  touch: { emo: "✋", name: { en: "Touch", es: "Tocar",  yue: "摸" },   part: { en: "hands", es: "las manos", yue: "手仔" } }
};

// senses[0] = the object's primary sense (used to gate which tier it appears in + the single-sense confirm line).
// A second entry = also correct (ambiguous, celebrated as "both") when that sense is active in the tier.
const SE_OBJECTS = [
  { emo: "🔔", name: { en: "the bell",       es: "la campana",   yue: "個鐘" },     senses: ["hear"] },
  { emo: "🥁", name: { en: "the drum",       es: "el tambor",    yue: "個鼓" },     senses: ["hear"] },
  { emo: "🌈", name: { en: "the rainbow",    es: "el arcoíris",  yue: "道彩虹" },   senses: ["see"] },
  { emo: "⭐", name: { en: "the star",       es: "la estrella",  yue: "粒星" },     senses: ["see"] },
  { emo: "🌸", name: { en: "the flower",     es: "la flor",      yue: "朵花" },     senses: ["smell", "see"] },
  { emo: "🍪", name: { en: "the cookie",     es: "la galleta",   yue: "塊餅" },     senses: ["smell", "taste"] },
  { emo: "🍋", name: { en: "the lemon",      es: "el limón",     yue: "個檸檬" },   senses: ["taste"] },
  { emo: "🍦", name: { en: "the ice cream",  es: "el helado",    yue: "個雪糕" },   senses: ["taste"] },
  { emo: "🧸", name: { en: "the teddy bear", es: "el osito",     yue: "熊仔" },     senses: ["touch"] },
  { emo: "🧊", name: { en: "the ice cube",   es: "el hielo",     yue: "粒冰" },     senses: ["touch"] },
  { emo: "🐰", name: { en: "the bunny",      es: "el conejito",  yue: "兔仔" },     senses: ["touch", "see"] },
  { emo: "🍓", name: { en: "the strawberry", es: "la fresa",     yue: "士多啤梨" }, senses: ["taste", "see"] }
];

const SE_TIERS = [["see", "hear"], ["see", "hear", "smell", "touch"], ["see", "hear", "smell", "taste", "touch"]];

const sensesLevel = {
  theme: "theme-senses", rounds: 5,

  startRound() {
    this.done = false;
    this.mistakes = 0;
    const set = SE_TIERS[state.tier];
    const pool = SE_OBJECTS.filter(o => set.includes(o.senses[0]));
    this.obj = rand(pool);
    const objName = seL(this.obj.name);

    setInstruction(
      "👐 " + seL({ en: `How do you explore ${objName}?`, es: `¿Cómo exploras ${objName}?`, yue: `你會點感受${objName}呀？` }),
      seL({ en: `Here is ${objName}. Which sense would you use to explore it? Tap it!`,
            es: `Aquí está ${objName}. ¿Qué sentido usarías para explorarlo? ¡Tócalo!`,
            yue: `呢個係${objName}。你會用邊個感官去感受佢呀？㩒佢！` })
    );

    const zones = set.map(s =>
      `<button class="se-zone" data-s="${s}"><span class="se-emo">${SENSES[s].emo}</span><span class="se-lbl">${seL(SENSES[s].name)}</span></button>`
    ).join("");

    $("playArea").innerHTML =
      scene.html("cozy", { seed: 20 + state.round * 4 }) +
      `
      <style>
        .se-stage{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(16px,5vmin,46px);padding:2vmin;box-sizing:border-box}
        .se-obj{font-size:clamp(80px,26vmin,210px);line-height:1;animation:seBob 2.8s ease-in-out infinite;filter:drop-shadow(0 6px 10px rgba(0,0,0,.2))}
        @keyframes seBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6%) rotate(2deg)}}
        .se-zones{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(10px,3vmin,24px);max-width:min(94vw,780px)}
        .se-zone{border:none;background:rgba(255,255,255,.92);border-radius:22px;padding:clamp(8px,2vmin,16px) clamp(10px,2.4vmin,22px);min-width:clamp(64px,17vmin,124px);min-height:44px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;touch-action:manipulation;box-shadow:0 4px 10px rgba(0,0,0,.15);transition:transform .14s}
        .se-zone:active{transform:scale(.92)}
        .se-emo{font-size:clamp(38px,10vmin,70px);line-height:1}
        .se-lbl{font-size:clamp(14px,3.4vmin,20px);font-weight:750;color:#3a2b52;text-transform:capitalize}
        .se-zone.se-hit{animation:seHit .5s ease}
        @keyframes seHit{0%{transform:scale(1)}45%{transform:scale(1.18)}100%{transform:scale(1.08)}}
        .se-zone.se-hint{box-shadow:0 0 0 4px #ffd23e,0 4px 10px rgba(0,0,0,.15);animation:seHintPulse 1s ease-in-out infinite}
        @keyframes seHintPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @media(prefers-reduced-motion:reduce){.se-obj{animation:none}.se-zone.se-hit,.se-zone.se-hint{animation:none}}
      </style>
      <div class="se-stage" id="seStage">
        <div class="se-obj" id="seObj">${this.obj.emo}</div>
        <div class="se-zones">${zones}</div>
      </div>`;

    $("seStage").querySelectorAll(".se-zone").forEach(b => { b.onclick = ev => this.pick(b, ev); });
  },

  pick(el, ev) {
    if (this.done || state.busy) return;
    const s = el.dataset.s;
    const set = SE_TIERS[state.tier];
    const acceptable = this.obj.senses.filter(x => set.includes(x));   // correct senses available this tier
    const objName = seL(this.obj.name);

    if (acceptable.includes(s)) {
      this.done = true;
      $("seStage").querySelectorAll(".se-zone").forEach(b => { if (b !== el) b.onclick = null; });
      el.classList.remove("se-hint");
      el.classList.add("se-hit");
      sfx.tap();
      tone(560, 0, .18, "sine", .14);
      const r = el.getBoundingClientRect();
      miniStar(r.left + r.width / 2, r.top + r.height / 2);
      floaters(["✨", "🌟", "💫"], r.left + r.width / 2, r.top + r.height / 2, 3);

      let line;
      if (acceptable.length >= 2) {   // ambiguous object → celebrate that more than one sense works
        const a = seL(SENSES[acceptable[0]].name), b = seL(SENSES[acceptable[1]].name);
        line = seL({ en: `Yes! You can ${a} and ${b} ${objName}!`,
                     es: `¡Sí! ¡Puedes ${a} y ${b} ${objName}!`,
                     yue: `啱！你可以${a}又可以${b}${objName}！` });
      } else {
        const sn = SENSES[s];
        line = seL({ en: `Yes! You ${seL(sn.name)} ${objName} with your ${seL(sn.part)}!`,
                     es: `¡Sí! ¡Puedes ${seL(sn.name)} ${objName} con ${seL(sn.part)}!`,
                     yue: `啱！你用${seL(sn.part)}${seL(sn.name)}${objName}！` });
      }
      speak(line + " " + praise());
      state.busy = true;
      roundComplete();
    } else {
      this.mistakes++;
      sfx.bad();
      wiggle(el);
      speak(seL({ en: `Hmm, not quite. How do you explore ${objName}?`,
                  es: `Mmm, casi. ¿Cómo exploras ${objName}?`,
                  yue: `唔係喎。你會點感受${objName}呀？` }));
      if (this.mistakes >= 2) {   // guided assist by ~3rd try: light up the correct sense(s)
        acceptable.forEach(cs => {
          const btn = $("seStage") && $("seStage").querySelector(`.se-zone[data-s="${cs}"]`);
          if (btn) { btn.classList.add("se-hint"); if (this.mistakes >= 3) wiggle(btn); }
        });
      }
    }
  }
};

registerGame({
  id: "senses", world: "brain", icon: "👐", name: "Five Senses", es: "Los Sentidos", yue: "五感",
  lvl: 0, cue: "sparkle", v: 42, level: sensesLevel
});
