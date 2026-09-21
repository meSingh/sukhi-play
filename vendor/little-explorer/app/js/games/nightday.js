"use strict";
// Scientific thinking · day/night cycle · sorting by time context · age 2–4
// Success = child can sort sun, moon, bed, pancakes etc. into Day and Night baskets

const ND_ITEMS = {
  day: [
    { e: "☀️", name: "sun",        es: "sol",        yue: "太陽"   },
    { e: "🌈", name: "rainbow",    es: "arcoíris",   yue: "彩虹"   },
    { e: "🥞", name: "pancakes",   es: "panqueques", yue: "班戟"   },
    { e: "🚌", name: "school bus", es: "autobús",    yue: "校車"   },
    { e: "🌻", name: "sunflower",  es: "girasol",    yue: "向日葵" },
    { e: "⛅",  name: "clouds",    es: "nubes",      yue: "雲"     },
    { e: "🦋", name: "butterfly",  es: "mariposa",   yue: "蝴蝶"   },
    { e: "🐦", name: "bird",       es: "pájaro",     yue: "雀仔"   },
  ],
  night: [
    { e: "🌙", name: "moon",       es: "luna",           yue: "月光"       },
    { e: "⭐", name: "stars",      es: "estrellas",      yue: "星星"       },
    { e: "🛏️", name: "bed",        es: "cama",           yue: "床"         },
    { e: "🧸", name: "teddy bear", es: "osito",          yue: "玩具熊"     },
    { e: "🦉", name: "owl",        es: "búho",           yue: "貓頭鷹"     },
    { e: "💤", name: "sleep time", es: "hora de dormir", yue: "瞓覺時間"   },
    { e: "🌟", name: "night star", es: "estrella",       yue: "星"         },
    { e: "🔭", name: "telescope",  es: "telescopio",     yue: "望遠鏡"     },
  ]
};

// localization helpers (this game holds its strings inline rather than in DICT)
const ndL = (en, es, yue) => curLang() === "yue" ? yue : curLang() === "es" ? es : en;
const ndName = it => curLang() === "yue" ? it.yue : curLang() === "es" ? it.es : it.name;

function ndDaySVG() {
  return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="ndDayG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ab3e8"/>
        <stop offset="100%" stop-color="#c8eafc"/>
      </linearGradient>
    </defs>
    <rect width="200" height="100" fill="url(#ndDayG)"/>
    <circle cx="165" cy="22" r="18" fill="#f9d030"/>
    <g stroke="#f9d030" stroke-width="2.8" stroke-linecap="round" opacity=".7">
      <line x1="165" y1="0"  x2="165" y2="6"/>
      <line x1="165" y1="38" x2="165" y2="44"/>
      <line x1="143" y1="22" x2="137" y2="22"/>
      <line x1="187" y1="22" x2="193" y2="22"/>
      <line x1="150" y1="7"  x2="146" y2="3"/>
      <line x1="180" y1="37" x2="184" y2="41"/>
      <line x1="180" y1="7"  x2="184" y2="3"/>
      <line x1="150" y1="37" x2="146" y2="41"/>
    </g>
    <ellipse cx="38"  cy="32" rx="22" ry="13" fill="white" opacity=".85"/>
    <ellipse cx="60"  cy="27" rx="20" ry="12" fill="white" opacity=".85"/>
    <ellipse cx="22"  cy="36" rx="14" ry="8"  fill="white" opacity=".85"/>
    <ellipse cx="105" cy="52" rx="18" ry="10" fill="white" opacity=".75"/>
    <ellipse cx="124" cy="47" rx="15" ry="9"  fill="white" opacity=".75"/>
    <ellipse cx="89"  cy="55" rx="12" ry="7"  fill="white" opacity=".75"/>
    <ellipse cx="100" cy="97" rx="100" ry="18" fill="#7ed45a" opacity=".45"/>
  </svg>`;
}

function ndNightSVG() {
  return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="ndNightG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#080f2a"/>
        <stop offset="100%" stop-color="#1e3170"/>
      </linearGradient>
    </defs>
    <rect width="200" height="100" fill="url(#ndNightG)"/>
    <circle cx="38" cy="26" r="18" fill="#f5e88a"/>
    <circle cx="49" cy="19" r="14" fill="#1e3170"/>
    <g fill="#fff" opacity=".9">
      <circle cx="78"  cy="12" r="2.2"/> <circle cx="100" cy="7"  r="1.8"/>
      <circle cx="122" cy="15" r="2.5"/> <circle cx="143" cy="8"  r="1.8"/>
      <circle cx="162" cy="19" r="2.2"/> <circle cx="178" cy="10" r="1.5"/>
      <circle cx="192" cy="27" r="2"/>   <circle cx="95"  cy="34" r="1.5"/>
      <circle cx="116" cy="28" r="1.8"/> <circle cx="152" cy="38" r="1.8"/>
      <circle cx="172" cy="46" r="1.5"/> <circle cx="68"  cy="50" r="1.5"/>
      <circle cx="188" cy="56" r="2"/>
    </g>
    <g fill="#060c20" opacity=".6">
      <rect x="15"  y="72" width="42" height="28"/>
      <polygon points="4,72 64,72 44,50 28,50"/>
      <rect x="27" y="78" width="14" height="13" fill="#f5e88a" opacity=".28"/>
    </g>
    <g fill="#060c20" opacity=".5">
      <rect x="142" y="78" width="34" height="22"/>
      <polygon points="136,78 184,78 168,60 150,60"/>
      <rect x="153" y="83" width="10" height="10" fill="#f5e88a" opacity=".22"/>
    </g>
  </svg>`;
}

const nightdayLevel = {
  theme: "theme-nightday",
  rounds: 5,

  startRound() {
    this.itemMistakes = {};

    const counts  = [2, 3, 4][state.tier];
    const dayPick  = shuffle(ND_ITEMS.day).slice(0, counts);
    const nightPick = shuffle(ND_ITEMS.night).slice(0, counts);
    const items = shuffle([
      ...dayPick.map((it, i)   => ({ ...it, bucket: "day",   uid: "d" + i })),
      ...nightPick.map((it, i) => ({ ...it, bucket: "night", uid: "n" + i }))
    ]);
    this.remaining = items.length;

    const showTxt = ndL("☀️🌙 Sort day and night!", "☀️🌙 ¡Separa el día y la noche!", "☀️🌙 分開日頭同夜晚！");
    const sayTxt  = ndL(
      "Put daytime things under the sunny sky, and nighttime things under the dark sky!",
      "¡Pon las cosas de día en el cielo azul, y las de noche en el cielo oscuro!",
      "將日頭嘅嘢放喺藍色天空，夜晚嘅嘢放喺黑色天空！");
    setInstruction(showTxt, sayTxt);

    $("playArea").innerHTML =
      // drift + motes only: the two sky bins own the top of this screen and the tray the
      // bottom, so a band anywhere would land on something she has to hit
      scene.html("space", { seed: 33 + state.round * 4, tint: "#3f74b4", layers: ["drift", "motes"] }) + `
      <style>
        .nd-stage{position:absolute;inset:0;z-index:5}
        .nd-bins{position:absolute;top:3%;left:2vmin;right:2vmin;display:flex;gap:2vmin}
        .nd-bin{flex:1;border-radius:clamp(10px,2.5vmin,18px);overflow:hidden;display:flex;flex-direction:column;align-items:center;border:3px solid transparent;transition:border-color .25s,box-shadow .25s}
        .nd-day{border-color:#f9d030;box-shadow:0 4px 18px rgba(249,208,48,.4)}
        .nd-night{border-color:#6b8cff;box-shadow:0 4px 18px rgba(107,140,255,.4)}
        .nd-sky{width:100%;height:clamp(66px,17vmin,128px);display:block;flex-shrink:0}
        .nd-sky svg{display:block;width:100%;height:100%}
        .nd-drop{width:100%;flex:1;min-height:clamp(38px,10vmin,80px);display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:clamp(2px,.8vmin,5px);padding:clamp(3px,.8vmin,6px)}
        .nd-lbl{font-size:clamp(13px,3.2vmin,22px);font-weight:800;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.5);padding:clamp(2px,.8vmin,5px) 0 clamp(4px,1.2vmin,8px);flex-shrink:0}
        .nd-tray{position:absolute;bottom:4%;left:2vmin;right:2vmin;display:flex;flex-wrap:wrap;gap:clamp(6px,2vmin,14px);justify-content:center;align-content:center;background:rgba(255,255,255,.18);border-radius:clamp(8px,2vmin,14px);padding:clamp(8px,2vmin,16px);min-height:clamp(72px,20vmin,140px)}
        .nd-item{border:none;background:rgba(255,255,255,.9);touch-action:none;line-height:1;font-size:clamp(32px,9.5vmin,62px);padding:clamp(4px,1.2vmin,10px);cursor:grab;border-radius:clamp(8px,2vmin,14px);box-shadow:0 3px 10px rgba(0,0,0,.2);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}
        .nd-item.on-plate{font-size:clamp(18px,5.5vmin,34px);padding:clamp(2px,.6vmin,5px);pointer-events:none;background:rgba(255,255,255,.55);animation:ndLand .4s ease}
        .nd-bin.hint-pulse{animation:ndPulse .5s ease-in-out 3}
        @keyframes ndPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes ndLand{0%{transform:scale(1.3)}100%{transform:scale(1)}}
      </style>
      <div class="nd-stage">
        <div class="nd-bins">
          <div class="nd-bin nd-day"   id="ndDay"   data-bin="day">
            <div class="nd-sky">${ndDaySVG()}</div>
            <div class="nd-drop" id="ndDropDay"></div>
            <div class="nd-lbl">${ndL("☀️ Day", "☀️ Día", "☀️ 日頭")}</div>
          </div>
          <div class="nd-bin nd-night" id="ndNight" data-bin="night">
            <div class="nd-sky">${ndNightSVG()}</div>
            <div class="nd-drop" id="ndDropNight"></div>
            <div class="nd-lbl">${ndL("🌙 Night", "🌙 Noche", "🌙 夜晚")}</div>
          </div>
        </div>
        <div class="nd-tray" id="ndTray"></div>
      </div>`;

    items.forEach(it => {
      const b = document.createElement("button");
      b.className  = "nd-item";
      b.textContent = it.e;
      b.dataset.bucket = it.bucket;
      b.dataset.uid    = it.uid;
      b.dataset.name   = ndName(it);
      makeDraggable(b, (el, ev, info) => this.release(el, ev, info));
      $("ndTray").appendChild(b);
    });
  },

  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    const c = centerOf(el);
    const dayBucket   = $("ndDay");
    const nightBucket = $("ndNight");
    const overDay   = inside(c, dayBucket);
    const overNight = inside(c, nightBucket);
    if (!overDay && !overNight) { info.reset(); return; }

    const want = el.dataset.bucket;
    const got  = overDay ? "day" : "night";
    const name = el.dataset.name;

    if (want === got) {
      el.classList.add("on-plate");
      el.style.position = "static";
      el.style.left = el.style.top = el.style.zIndex = "";
      $(got === "day" ? "ndDropDay" : "ndDropNight").appendChild(el);
      sfx.tap();
      miniStar(ev.clientX, ev.clientY);
      tone(got === "day" ? 660 : 440, 0, .18, "sine", .15);
      floaters(["✨"], ev.clientX, ev.clientY, 3);
      speak(got === "day"
        ? ndL(`${name}! Daytime!`,   `¡${name}! ¡De día!`,   `${name}！日頭！`)
        : ndL(`${name}! Nighttime!`, `¡${name}! ¡De noche!`, `${name}！夜晚！`));
      this.remaining--;
      if (this.remaining === 0) { speak(praise()); roundComplete(); }

    } else {
      const uid  = el.dataset.uid;
      this.itemMistakes[uid] = (this.itemMistakes[uid] || 0) + 1;
      const nErr = this.itemMistakes[uid];
      sfx.bad(); wiggle(el); info.reset();

      const correctBucket = want === "day" ? dayBucket : nightBucket;

      if (nErr >= 3) {
        // Guided assist: pulse the correct bucket then auto-place
        el.style.pointerEvents = "none";
        correctBucket.classList.remove("hint-pulse");
        void correctBucket.offsetWidth;
        correctBucket.classList.add("hint-pulse");
        core.wait(() => {
          if (!el.isConnected) return;
          el.classList.add("on-plate");
          el.style.position = "static";
          el.style.left = el.style.top = el.style.zIndex = el.style.pointerEvents = "";
          $(want === "day" ? "ndDropDay" : "ndDropNight").appendChild(el);
          sfx.tap();
          const br = correctBucket.getBoundingClientRect();
          miniStar(br.left + br.width / 2, br.top + br.height * 0.4);
          this.remaining--;
          if (this.remaining === 0) { speak(praise()); roundComplete(); }
        }, 750);
      } else if (nErr === 2) {
        // Visual hint: pulse the correct bucket
        correctBucket.classList.remove("hint-pulse");
        void correctBucket.offsetWidth;
        correctBucket.classList.add("hint-pulse");
      }

      // Verbal hint (all wrong attempts)
      speak(want === "day"
        ? ndL(`${name} is daytime! Find the sunny sky!`,  `¡${name} es de día! ¡Busca el cielo azul!`,     `${name}係日頭！搵藍色天空！`)
        : ndL(`${name} is nighttime! Find the dark sky!`, `¡${name} es de noche! ¡Busca el cielo oscuro!`, `${name}係夜晚！搵黑色天空！`));
    }
  }
};

registerGame({
  id: "nightday", world: "brain", icon: "🌙", name: "Day & Night", es: "Día y Noche",
  yue: "日同夜", lvl: 0, cue: "bell", level: nightdayLevel
});
