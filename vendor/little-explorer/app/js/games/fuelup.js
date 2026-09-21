"use strict";
// Number sense · comparison (more/less, compare sets) · age 3-4
// Success = child can tap the group (rocket tank) that has more — or fewer — fuel stars,
//           reading quantity from countable cells and a matching numeral.

/* body + fin colors for the fuelling rockets */
const FU_PAL = [
  ["#e63946", "#c8313e"], ["#4fa3ff", "#2f7ad6"], ["#ff9f45", "#e4772c"],
  ["#8b6cff", "#6b4fd6"], ["#3bc6a6", "#2aa088"], ["#ff6fae", "#e04a8f"]
];

const fuRocket = (body, fin) => `<svg viewBox="0 0 80 116" width="100%" height="100%">
  <path d="M28 44 Q40 4 52 44 Z" fill="${fin}"/>
  <rect x="28" y="40" width="24" height="62" rx="11" fill="${body}"/>
  <rect x="28" y="69" width="24" height="9" fill="#ffd23e"/>
  <circle cx="40" cy="57" r="8" fill="#7fd0ff" stroke="#b9c8da" stroke-width="2"/>
  <path d="M28 89 L14 114 L28 103 Z" fill="${fin}"/>
  <path d="M52 89 L66 114 L52 103 Z" fill="${fin}"/>
  <rect x="32" y="100" width="16" height="8" rx="3" fill="#9aa3b0"/>
</svg>`;

// this game holds its strings inline (like Night & Day) rather than in the core DICT
const fuL = obj => obj[curLang()] || obj.en;

const FU_TXT = {
  more2: {
    show: { en: "⛽ Which rocket has MORE fuel?", es: "⛽ ¿Cuál cohete tiene MÁS combustible?", yue: "⛽ 邊個火箭有多啲燃料？" },
    say:  { en: "Tap the rocket with more fuel stars so it can blast off!", es: "¡Toca el cohete con más estrellas de combustible para despegar!", yue: "㩒有多啲燃料星嘅火箭，佢就可以發射喇！" },
    wrong:{ en: "Hmm! Count again and pick the fuller tank!", es: "¡Cuenta otra vez y elige el tanque más lleno!", yue: "再數多次，揀滿啲嗰個！" },
    yes:  { en: t => `${t} stars! That's more! Blast off!`, es: t => `¡${t} estrellas! ¡Es más! ¡Despegue!`, yue: t => `${t}粒星！多啲！發射！` }
  },
  less2: {
    show: { en: "⛽ Which rocket has LESS fuel?", es: "⛽ ¿Cuál cohete tiene MENOS combustible?", yue: "⛽ 邊個火箭有少啲燃料？" },
    say:  { en: "This little rocket needs a short trip. Tap the tank with less fuel!", es: "Este cohete hace un viaje corto. ¡Toca el tanque con menos combustible!", yue: "呢架火箭去近近哋。㩒少啲燃料嗰個！" },
    wrong:{ en: "Not that one — look for the tank with less!", es: "¡Ese no! ¡Busca el tanque con menos!", yue: "唔係嗰個！揀少啲嗰個！" },
    yes:  { en: t => `Only ${t} stars! That's less! Off it goes!`, es: t => `¡Solo ${t} estrellas! ¡Es menos! ¡Allá va!`, yue: t => `淨係${t}粒星！少啲！飛啦！` }
  },
  most3: {
    show: { en: "⛽ Which rocket has the MOST fuel?", es: "⛽ ¿Cuál tiene MÁS combustible?", yue: "⛽ 邊個火箭燃料最多？" },
    say:  { en: "The big journey needs the most fuel. Tap the fullest tank!", es: "El viaje grande necesita más combustible. ¡Toca el tanque más lleno!", yue: "遠程要最多燃料。㩒最滿嗰個！" },
    wrong:{ en: "Keep looking — which tank is the fullest?", es: "¡Sigue buscando! ¿Cuál está más lleno?", yue: "再搵下！邊個最滿？" },
    yes:  { en: t => `${t} stars — the most! Blast off!`, es: t => `¡${t} estrellas, el más! ¡Despegue!`, yue: t => `${t}粒星，最多！發射！` }
  },
  least3: {
    show: { en: "⛽ Which rocket has the LEAST fuel?", es: "⛽ ¿Cuál tiene MENOS combustible?", yue: "⛽ 邊個火箭燃料最少？" },
    say:  { en: "The tiny hop needs the least fuel. Tap the emptiest tank!", es: "El saltito necesita menos combustible. ¡Toca el tanque más vacío!", yue: "跳一跳只要最少燃料。㩒最空嗰個！" },
    wrong:{ en: "Not quite — which has the fewest stars?", es: "¡Casi! ¿Cuál tiene menos estrellas?", yue: "差少少！邊個星最少？" },
    yes:  { en: t => `Just ${t} stars — the least! Off it goes!`, es: t => `¡Solo ${t} estrellas, el menos! ¡Allá va!`, yue: t => `淨係${t}粒星，最少！飛啦！` }
  }
};

const fuelupLevel = {
  theme: "theme-space", rounds: 5,

  // Build the round's fuel amounts, the correct target, and which prompt to use.
  makeRound(tier) {
    if (tier <= 0) {
      const small = 1 + Math.floor(Math.random() * 3);           // 1..3
      const big   = Math.min(small + 3 + Math.floor(Math.random() * 2), 7); // gap 3-4
      const counts = Math.random() < 0.5 ? [small, big] : [big, small];
      return { counts, correctIndex: counts.indexOf(big), key: "more2", target: big };
    }
    if (tier === 1) {
      const a = 2 + Math.floor(Math.random() * 4);               // 2..5
      let b = Math.min(a + 1 + Math.floor(Math.random() * 2), 7);// gap 1-2
      if (b === a) b = a + 1;
      const hi = Math.max(a, b), lo = Math.min(a, b);
      const counts = Math.random() < 0.5 ? [a, b] : [b, a];
      return Math.random() < 0.7
        ? { counts, correctIndex: counts.indexOf(hi), key: "more2", target: hi }
        : { counts, correctIndex: counts.indexOf(lo), key: "less2", target: lo };
    }
    // tier 2: three rockets, all-distinct so the extreme is unique
    let c;
    do { c = [0, 1, 2].map(() => 2 + Math.floor(Math.random() * 7)); } // 2..8
    while (new Set(c).size < 3);
    const hi = Math.max(...c), lo = Math.min(...c);
    return Math.random() < 0.5
      ? { counts: c, correctIndex: c.indexOf(hi), key: "most3",  target: hi }
      : { counts: c, correctIndex: c.indexOf(lo), key: "least3", target: lo };
  },

  startRound() {
    this.wrong = 0;
    this.done = false;
    const { counts, correctIndex, key, target } = this.makeRound(state.tier);
    this.correctIndex = correctIndex;
    this.key = key;
    this.target = target;

    setInstruction(fuL(FU_TXT[key].show), fuL(FU_TXT[key].say));

    $("playArea").innerHTML =
      scene.html("space", { seed: 20 + state.round * 4 }) +
      `
      <style>
        .fu-stage{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;overflow:hidden}
        .fu-row{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,5vmin,52px);padding:3vmin 2vmin 0}
        .fu-station{position:relative;border:none;background:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:clamp(3px,1vmin,9px);padding:clamp(5px,1.4vmin,11px);border-radius:clamp(12px,3vmin,20px);touch-action:manipulation;transition:transform .15s}
        .fu-station:active{transform:scale(.97)}
        .fu-rocket{position:relative;width:clamp(50px,13vmin,104px);height:clamp(72px,19vmin,150px);transition:transform 1.1s cubic-bezier(.5,0,.9,.4)}
        .fu-rocket.fu-blast{transform:translateY(-155vh) rotate(4deg)}
        .fu-flame{position:absolute;left:50%;bottom:-4%;width:42%;height:30%;transform:translateX(-50%) scaleY(0);transform-origin:top center;background:radial-gradient(ellipse at 50% 0,#fff2a8,#ff8a1e 55%,rgba(255,138,30,0) 74%);border-radius:0 0 55% 55%;opacity:0}
        .fu-flame.on{opacity:1;animation:fuFlame .16s infinite alternate}
        @keyframes fuFlame{from{transform:translateX(-50%) scaleY(1)}to{transform:translateX(-52%) scaleY(1.4)}}
        .fu-gauge{width:clamp(30px,7.4vmin,58px);height:clamp(92px,25vmin,184px);border:3px solid rgba(255,255,255,.7);border-radius:clamp(8px,2vmin,14px);background:linear-gradient(rgba(18,24,60,.55),rgba(42,54,120,.55));display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-start;gap:2%;padding:6% 0;box-shadow:inset 0 0 12px rgba(120,160,255,.45)}
        .fu-cell{font-size:clamp(12px,3.3vmin,23px);line-height:1;animation:fuBob 1.8s ease-in-out infinite}
        .fu-num{font-weight:800;color:#fff;font-size:clamp(15px,4.2vmin,28px);text-shadow:0 2px 4px rgba(0,0,0,.5)}
        .fu-pad{width:118%;height:clamp(6px,1.5vmin,11px);border-radius:6px;background:linear-gradient(#c3ccd8,#8a95a5)}
        .fu-station.fu-hint{animation:fuHint 1s ease-in-out infinite}
        @keyframes fuHint{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        .fu-alien{position:absolute;bottom:1.5%;left:50%;transform:translateX(-50%);font-size:clamp(28px,7.5vmin,56px);animation:fuBob 2.2s ease-in-out infinite;pointer-events:none;z-index:6}
        .fu-alien.cheer{animation:fuCheer .55s ease}
        @keyframes fuCheer{0%{transform:translateX(-50%) scale(1)}40%{transform:translateX(-50%) scale(1.4) rotate(-9deg)}100%{transform:translateX(-50%) scale(1)}}
        @keyframes fuBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14%)}}
      </style>
      <div class="space-bg" id="fuBg"></div>
      <div class="fu-stage">
        <div class="fu-row" id="fuRow"></div>
        <div class="fu-alien" id="fuAlien">👽</div>
      </div>`;
    addStars($("fuBg"));

    const row = $("fuRow");
    const pal = shuffle(FU_PAL);
    this.stations = [];
    counts.forEach((n, i) => {
      const [body, fin] = pal[i % pal.length];
      let cells = "";
      for (let k = 0; k < n; k++) cells += `<span class="fu-cell" style="animation-delay:${(-k * 0.15).toFixed(2)}s">⭐</span>`;
      const st = document.createElement("button");
      st.className = "fu-station";
      st.dataset.i = i;
      st.innerHTML = `
        <div class="fu-rocket">${fuRocket(body, fin)}<div class="fu-flame"></div></div>
        <div class="fu-gauge">${cells}</div>
        <div class="fu-num">${n}</div>
        <div class="fu-pad"></div>`;
      st.onclick = ev => this.pick(i, ev);
      row.appendChild(st);
      this.stations.push(st);
    });
  },

  pick(i, ev) {
    if (this.done || state.busy) return;

    if (i === this.correctIndex) { this.launch(i, ev); return; }

    // wrong choice — never a fail state, just a gentle retry that escalates into an assist
    this.wrong++;
    sfx.bad();
    wiggle(this.stations[i]);
    speak(fuL(FU_TXT[this.key].wrong));

    const good = this.stations[this.correctIndex];
    if (this.wrong >= 3) {
      this.done = true;
      const r = good.getBoundingClientRect();
      core.wait(() => this.launch(this.correctIndex, { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.4 }), 750);
    } else if (this.wrong === 2) {
      good.classList.add("fu-hint");
    }
  },

  launch(i, ev) {
    this.done = true;
    state.busy = true;
    const st = this.stations[i];
    st.classList.remove("fu-hint");
    this.stations.forEach(s => (s.style.pointerEvents = "none"));

    sfx.tap();
    miniStar(ev.clientX, ev.clientY);
    st.querySelector(".fu-flame").classList.add("on");
    tone(280, 0, .25, "sawtooth", .1);

    core.wait(() => {
      st.querySelector(".fu-rocket").classList.add("fu-blast");
      tone(560, 0, .55, "triangle", .16);
      const r = st.getBoundingClientRect();
      floaters(["⭐", "✨", "🔥"], r.left + r.width / 2, r.top + r.height * 0.3, 8);
      const al = $("fuAlien");
      if (al) { al.classList.remove("cheer"); void al.offsetWidth; al.classList.add("cheer"); }
    }, 350);

    speak(fuL(FU_TXT[this.key].yes)(this.target) + " " + praise());
    roundComplete();
  }
};

registerGame({
  id: "fuelup", world: "num", icon: "⛽", name: "Fuel Up", es: "A Cargar", yue: "加油", lvl: 1, cue: "engine",
  level: fuelupLevel
});
