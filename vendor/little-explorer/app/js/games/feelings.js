"use strict";
// Social-emotional learning · name a feeling → hear it validated → gentle self-regulation · age 2-5
// Success = child names how they feel and, for big feelings, practices a calming breath. No wrong answer, ever.

const feL = obj => obj[curLang()] || obj.en;
const feBuddy = () => (BUDDIES.find(x => x.id === BUDDY) || BUDDIES[0]).e;

// Drawn faces (hero art) — round, clear, distinct per feeling.
const FE_FACE = {
  happy: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#ffd23e"/><circle cx="37" cy="44" r="5.5" fill="#4a3a12"/><circle cx="63" cy="44" r="5.5" fill="#4a3a12"/><path d="M32 60 Q50 78 68 60" fill="none" stroke="#4a3a12" stroke-width="6" stroke-linecap="round"/></svg>`,
  sad: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#7fb0e0"/><circle cx="37" cy="46" r="5.5" fill="#20344a"/><circle cx="63" cy="46" r="5.5" fill="#20344a"/><path d="M33 70 Q50 56 67 70" fill="none" stroke="#20344a" stroke-width="6" stroke-linecap="round"/><path d="M37 54 q-3 10 0 15 q3 -5 0 -15Z" fill="#cdeafe"/></svg>`,
  mad: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#ef6f5c"/><circle cx="37" cy="48" r="5.5" fill="#4a1810"/><circle cx="63" cy="48" r="5.5" fill="#4a1810"/><path d="M28 36 L46 44" stroke="#4a1810" stroke-width="6" stroke-linecap="round"/><path d="M72 36 L54 44" stroke="#4a1810" stroke-width="6" stroke-linecap="round"/><path d="M34 68 Q50 60 66 68" fill="none" stroke="#4a1810" stroke-width="6" stroke-linecap="round"/></svg>`,
  scared: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#b39ddb"/><ellipse cx="37" cy="45" rx="7" ry="9" fill="#fff"/><ellipse cx="63" cy="45" rx="7" ry="9" fill="#fff"/><circle cx="37" cy="47" r="4" fill="#2c2140"/><circle cx="63" cy="47" r="4" fill="#2c2140"/><ellipse cx="50" cy="68" rx="8" ry="10" fill="#3a2b52"/></svg>`,
  calm: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#8fd3a6"/><path d="M30 46 Q37 40 44 46" fill="none" stroke="#1f4a33" stroke-width="5" stroke-linecap="round"/><path d="M56 46 Q63 40 70 46" fill="none" stroke="#1f4a33" stroke-width="5" stroke-linecap="round"/><path d="M38 64 Q50 72 62 64" fill="none" stroke="#1f4a33" stroke-width="5.5" stroke-linecap="round"/></svg>`,
  excited: `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#ffb04a"/><circle cx="37" cy="43" r="5.5" fill="#4a300f"/><circle cx="63" cy="43" r="5.5" fill="#4a300f"/><path d="M34 58 Q50 84 66 58 Z" fill="#4a300f"/><path d="M50 62 Q50 74 50 74 Q56 70 60 70 Q54 66 50 62Z" fill="#ff5a7a"/><text x="16" y="30" font-size="16">✨</text><text x="74" y="30" font-size="16">✨</text></svg>`
};

const FE_EMO = {
  happy:   { name:{en:"happy",es:"feliz",yue:"開心"},   big:false,
             yes:{en:"You feel happy! I love your smile!", es:"¡Te sientes feliz! ¡Me encanta tu sonrisa!", yue:"你好開心！我好鍾意你個笑容！"} },
  sad:     { name:{en:"sad",es:"triste",yue:"傷心"},     big:true,
             yes:{en:"You feel sad. It's okay to feel sad. I'm right here with you.", es:"Te sientes triste. Está bien sentirse triste. Estoy aquí contigo.", yue:"你覺得傷心。傷心係冇問題嘅。我喺度陪住你。"} },
  mad:     { name:{en:"mad",es:"enojado",yue:"嬲"},       big:true,
             yes:{en:"You feel mad. Big feelings are okay. Let's breathe together.", es:"Estás enojado. Los sentimientos grandes están bien. Respiremos juntos.", yue:"你好嬲。有大嘅情緒係冇問題嘅。我哋一齊深呼吸。"} },
  scared:  { name:{en:"scared",es:"asustado",yue:"驚"},   big:true,
             yes:{en:"You feel scared. I've got you. Let's take a slow breath.", es:"Te sientes asustado. Aquí estoy. Tomemos un respiro lento.", yue:"你覺得驚。我保護你。我哋慢慢深呼吸。"} },
  calm:    { name:{en:"calm",es:"tranquilo",yue:"平靜"},   big:false,
             yes:{en:"You feel calm and cozy. That feels nice.", es:"Te sientes tranquilo y a gusto. Qué rico.", yue:"你覺得好平靜好舒服。好正。"} },
  excited: { name:{en:"excited",es:"emocionado",yue:"興奮"}, big:false,
             yes:{en:"You feel excited! Wheee!", es:"¡Estás emocionado! ¡Yupi!", yue:"你好興奮！耶！"} }
};

const feelingsLevel = {
  theme: "theme-feelings", rounds: 4,

  startRound() {
    this.done = false;
    const set = [["happy","sad","calm"], ["happy","sad","mad","scared"], ["happy","sad","mad","scared","calm","excited"]][state.tier];

    setInstruction(
      "💛 " + feL({en:"How do you feel?", es:"¿Cómo te sientes?", yue:"你依家覺得點呀？"}),
      feL({en:"How are you feeling right now? Tap the face that feels like you. Every feeling is okay.",
           es:"¿Cómo te sientes ahora? Toca la cara que se parece a ti. Todos los sentimientos están bien.",
           yue:"你依家覺得點呀？㩒個似你嘅表情。咩感覺都冇問題。"})
    );

    const faces = set.map(id =>
      `<button class="fe-face" data-emo="${id}"><span class="fe-svg">${FE_FACE[id]}</span><span class="fe-lbl">${feL(FE_EMO[id].name)}</span></button>`
    ).join("");

    $("playArea").innerHTML =
      // no mid/ground/frame: the face row is centred and low, and this is the one screen
      // where nothing should compete for her eye
      scene.html("cozy", { seed: 26 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) + `
      <style>
        .fe-stage{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,3vmin,26px);padding:2vmin}
        .fe-buddy{font-size:clamp(40px,11vmin,88px);line-height:1;animation:feBob 2.6s ease-in-out infinite}
        @keyframes feBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8%)}}
        .fe-faces{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(10px,3vmin,26px);max-width:min(92vw,720px)}
        .fe-face{border:none;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;touch-action:manipulation;transition:transform .15s}
        .fe-face:active{transform:scale(.94)}
        .fe-svg{width:clamp(74px,20vmin,128px);height:clamp(74px,20vmin,128px);display:block;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18))}
        .fe-lbl{font-size:clamp(14px,3.6vmin,22px);font-weight:750;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.35);text-transform:capitalize}
        .fe-face.fe-chosen .fe-svg{animation:fePop .5s ease}
        @keyframes fePop{0%{transform:scale(1)}45%{transform:scale(1.18)}100%{transform:scale(1.1)}}
        .fe-breath{position:absolute;inset:0;z-index:8;display:none;flex-direction:column;align-items:center;justify-content:center;gap:clamp(12px,4vmin,32px);background:rgba(20,40,60,.35);backdrop-filter:blur(2px)}
        .fe-breath.show{display:flex}
        .fe-ball{width:clamp(70px,20vmin,150px);height:clamp(70px,20vmin,150px);border-radius:50%;background:radial-gradient(circle at 38% 34%,#fff,#8fd3ff 70%,#5fb0e6);box-shadow:0 0 40px rgba(140,211,255,.7)}
        .fe-ball.go{animation:feBreath 8s ease-in-out forwards}
        @keyframes feBreath{0%{transform:scale(.6)}45%{transform:scale(1.25)}55%{transform:scale(1.25)}100%{transform:scale(.6)}}
        .fe-btext{font-size:clamp(18px,4.6vmin,30px);font-weight:750;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.4);text-align:center}
        @media(prefers-reduced-motion:reduce){.fe-buddy,.fe-face.fe-chosen .fe-svg{animation:none}.fe-ball.go{animation:feBreathCalm 8s ease-in-out forwards}}
        @keyframes feBreathCalm{0%,100%{transform:scale(.85)}50%{transform:scale(1.1)}}
      </style>
      <div class="fe-stage" id="feStage">
        <div class="fe-buddy">${feBuddy()}</div>
        <div class="fe-faces">${faces}</div>
      </div>
      <div class="fe-breath" id="feBreath"><div class="fe-ball" id="feBall"></div><div class="fe-btext" id="feBtext"></div></div>`;

    $("feStage").querySelectorAll(".fe-face").forEach(b => b.onclick = ev => this.pick(b, ev));
  },

  pick(el, ev) {
    if (this.done || state.busy) return;
    this.done = true;
    const id = el.dataset.emo, emo = FE_EMO[id];
    el.classList.add("fe-chosen");
    $("feStage").querySelectorAll(".fe-face").forEach(b => { if (b !== el) b.onclick = null; });
    sfx.tap();
    const r = el.getBoundingClientRect();
    miniStar(r.left + r.width / 2, r.top + r.height / 2);
    tone(id === "sad" || id === "mad" || id === "scared" ? 400 : 620, 0, .2, "sine", .14);
    speak(feL(emo.yes));

    if (emo.big && state.tier >= 1) {
      core.wait(() => this.breathe(), 1400);   // big feeling → guide a calming breath
    } else {
      floaters(["💛","✨","🌟"], r.left + r.width / 2, r.top + r.height / 2, 4);
      state.busy = true;
      roundComplete();
    }
  },

  breathe() {
    const ov = $("feBreath"), ball = $("feBall"), txt = $("feBtext");
    if (!ov) { state.busy = true; roundComplete(); return; }
    ov.classList.add("show");
    txt.textContent = feL({en:"Breathe in… and out…", es:"Inhala… y exhala…", yue:"吸氣…呼氣…"});
    speak(feL({en:"Breathe in… and slowly out. You're doing great.", es:"Inhala… y despacio, exhala. Lo estás haciendo muy bien.", yue:"慢慢吸氣…慢慢呼氣。你做得好好。"}));
    void ball.offsetWidth; ball.classList.add("go");
    core.wait(() => {
      speak(feL({en:"All better. You did it!", es:"Mucho mejor. ¡Lo lograste!", yue:"舒服啲喇。你做到喇！"}) + " " + praise());
      state.busy = true;
      roundComplete();
    }, 8200);
  }
};

registerGame({
  id: "feelings", world: "brain", icon: "💛", name: "Feelings", es: "Sentimientos", yue: "心情",
  lvl: 0, cue: "purr", level: feelingsLevel
});
