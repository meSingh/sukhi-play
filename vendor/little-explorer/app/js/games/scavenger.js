"use strict";
// Classification / observation / vocabulary · find a REAL object matching a named attribute · age 2-5
// Success = child (with a grown-up) leaves the screen, finds a real object that fits, and comes back. Off-screen by design.

const scL = obj => obj[curLang()] || obj.en;
const scBuddy = () => (BUDDIES.find(x => x.id === BUDDY) || BUDDIES[0]).e;

// each prompt: what to find, plus a swatch color OR an emoji icon to show
const SC_PROMPTS = {
  0: [ // colors
    { icon:"swatch", c:"#e8534e", p:{en:"something red",    es:"algo rojo",     yue:"紅色嘅嘢"} },
    { icon:"swatch", c:"#4f9fe0", p:{en:"something blue",   es:"algo azul",     yue:"藍色嘅嘢"} },
    { icon:"swatch", c:"#f2c53d", p:{en:"something yellow", es:"algo amarillo", yue:"黃色嘅嘢"} },
    { icon:"swatch", c:"#6ac36a", p:{en:"something green",  es:"algo verde",    yue:"綠色嘅嘢"} }
  ],
  1: [ // qualities
    { icon:"🧸", p:{en:"something soft",  es:"algo suave",    yue:"軟軟嘅嘢"} },
    { icon:"⚪", p:{en:"something round", es:"algo redondo",  yue:"圓圓嘅嘢"} },
    { icon:"🤏", p:{en:"something small", es:"algo pequeño",  yue:"細細嘅嘢"} },
    { icon:"❄️", p:{en:"something cold",  es:"algo frío",     yue:"凍凍嘅嘢"} },
    { icon:"🔔", p:{en:"something that makes a sound", es:"algo que hace ruido", yue:"會出聲嘅嘢"} }
  ],
  2: [ // kinds / categories
    { icon:"🧸", p:{en:"a toy",   es:"un juguete", yue:"一件玩具"} },
    { icon:"📖", p:{en:"a book",  es:"un libro",   yue:"一本書"} },
    { icon:"🥄", p:{en:"something you eat with", es:"algo para comer", yue:"食嘢用嘅嘢"} },
    { icon:"🧦", p:{en:"something you wear",     es:"algo que te pones", yue:"著喺身嘅嘢"} },
    { icon:"🌱", p:{en:"something that grows",   es:"algo que crece",    yue:"會生長嘅嘢"} }
  ]
};

const scavengerLevel = {
  theme: "theme-scavenger", rounds: 5,

  startRound() {
    if (state.round === 0) this.used = [];
    this.done = false;
    this.render();
  },

  render() {
    const pool = SC_PROMPTS[state.tier].filter(x => !this.used.includes(x.p.en));
    const item = rand(pool.length ? pool : SC_PROMPTS[state.tier]);
    this.item = item;

    const phrase = scL(item.p);
    setInstruction(
      "🔦 " + scL({en:`Go find ${phrase}!`, es:`¡Ve a buscar ${phrase}!`, yue:`去搵${phrase}！`}),
      scL({en:`Go find ${phrase} in your house. Bring it back, then tap the star! Take your time.`,
           es:`Busca ${phrase} en tu casa. ¡Tráelo y toca la estrella! Tómate tu tiempo.`,
           yue:`喺屋企搵${phrase}。攞返嚟，然後㩒粒星！唔使急。`})
    );

    const visual = item.icon === "swatch"
      ? `<div class="sv-swatch" style="background:${item.c}"></div>`
      : `<div class="sv-emoji">${item.icon}</div>`;

    $("playArea").innerHTML =
      // no mid/ground/frame: the prompt card is centred and this screen sends her off to
      // look at the real room, so the background stays quiet
      scene.html("meadow", { seed: 39 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) + `
      <style>
        .sv-stage{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(12px,3vmin,26px);padding:3vmin;text-align:center}
        .sv-card{background:rgba(255,255,255,.82);border-radius:clamp(18px,4vmin,30px);padding:clamp(16px,4vmin,34px);box-shadow:0 8px 26px rgba(0,0,0,.16);display:flex;flex-direction:column;align-items:center;gap:clamp(8px,2vmin,16px);max-width:min(88vw,460px)}
        .sv-swatch{width:clamp(90px,26vmin,180px);height:clamp(90px,26vmin,180px);border-radius:clamp(14px,4vmin,26px);box-shadow:inset 0 -6px 12px rgba(0,0,0,.15),0 4px 10px rgba(0,0,0,.2)}
        .sv-emoji{font-size:clamp(80px,24vmin,168px);line-height:1}
        .sv-word{font-size:clamp(22px,5.4vmin,36px);font-weight:800;color:#2a2a3a;text-transform:capitalize;text-wrap:balance}
        .sv-buddy{font-size:clamp(34px,9vmin,68px);line-height:1;animation:scBob 2.4s ease-in-out infinite}
        @keyframes scBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10%) rotate(3deg)}}
        .sv-found{border:none;cursor:pointer;font-size:clamp(20px,5vmin,30px);font-weight:800;color:#fff;background:linear-gradient(#ffb43e,#f0871a);
                  padding:clamp(13px,3vmin,20px) clamp(26px,7vmin,52px);border-radius:999px;box-shadow:0 5px 0 #c96b10,0 8px 16px rgba(0,0,0,.25);touch-action:manipulation;display:flex;align-items:center;gap:10px}
        .sv-found:active{transform:translateY(3px);box-shadow:0 2px 0 #c96b10,0 5px 10px rgba(0,0,0,.25)}
        .sv-again{border:none;background:none;cursor:pointer;font-size:clamp(14px,3.4vmin,18px);font-weight:650;color:#3a3a55;text-decoration:underline;padding:8px;opacity:.85}
        @media(prefers-reduced-motion:reduce){.sv-buddy{animation:none}}
      </style>
      <div class="sv-stage" id="scStage">
        <div class="sv-buddy">${scBuddy()}</div>
        <div class="sv-card">
          ${visual}
          <div class="sv-word">${phrase}</div>
        </div>
        <button class="sv-found" id="scFound">⭐ ${scL({en:"I found it!", es:"¡Lo encontré!", yue:"搵到喇！"})}</button>
        <button class="sv-again" id="scAgain">${scL({en:"Show me another", es:"Muéstrame otro", yue:"換一個"})}</button>
      </div>`;

    $("scFound").onclick = ev => this.found(ev);
    $("scAgain").onclick = () => { if (!this.done) this.render(); };   // re-roll, no penalty, no advance
  },

  found(ev) {
    if (this.done || state.busy) return;
    this.done = true;
    this.used.push(this.item.p.en);
    $("scFound").onclick = $("scAgain").onclick = null;
    sfx.tap();
    miniStar(ev.clientX, ev.clientY);
    floaters(["⭐","🎉","✨","💛"], ev.clientX, ev.clientY, 6);
    speak(rand([
      scL({en:"You found it! High five!", es:"¡Lo encontraste! ¡Chócala!", yue:"搵到喇！掌！"}),
      scL({en:"Great looking! You're a super explorer!", es:"¡Qué buen ojo! ¡Eres un súper explorador!", yue:"好眼力！你係超級探險家！"}),
      scL({en:"Yes! You found it!", es:"¡Sí! ¡Lo encontraste!", yue:"啱喇！你搵到喇！"})
    ]) + " " + praise());
    state.busy = true;
    roundComplete();
  }
};

registerGame({
  id: "scavenger", world: "brain", icon: "🔦", name: "Go Find It", es: "A Buscar", yue: "去搵嘢",
  lvl: 0, cue: "chirp", level: scavengerLevel
});
