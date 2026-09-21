"use strict";
// Measurement · comparison · tall/short (height) · age 3-4
// Success = child can point to whichever of two objects is taller or shorter

const MZ_KINDS = {
  tree: {
    ratio: 80 / 200,
    svg: () => `<svg viewBox="0 0 80 200" width="100%" height="100%">
      <rect x="33" y="150" width="14" height="50" rx="3" fill="#8b5a2b"/>
      <circle cx="40" cy="118" r="36" fill="#4caf50"/>
      <circle cx="40" cy="82"  r="30" fill="#66bb6a"/>
      <circle cx="40" cy="52"  r="22" fill="#81c784"/>
    </svg>`
  },
  tower: {
    ratio: 80 / 200,
    svg: () => `<svg viewBox="0 0 80 200" width="100%" height="100%">
      <g stroke="#fff" stroke-width="2">
        <rect x="10" y="155" width="60" height="45" fill="#ff8a65"/>
        <rect x="10" y="110" width="60" height="45" fill="#4fc3f7"/>
        <rect x="10" y="65"  width="60" height="45" fill="#ffd54f"/>
        <rect x="10" y="20"  width="60" height="45" fill="#81c784"/>
      </g>
    </svg>`
  },
  candle: {
    ratio: 60 / 200,
    svg: () => `<svg viewBox="0 0 60 200" width="100%" height="100%">
      <line x1="30" y1="60" x2="30" y2="46" stroke="#5a4632" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="30" cy="32" rx="9" ry="16" fill="#ffb74d"/>
      <ellipse cx="30" cy="37" rx="5" ry="9" fill="#fff59d"/>
      <rect x="20" y="60" width="20" height="140" rx="4" fill="#f8b4c0" stroke="#e89aab" stroke-width="2"/>
    </svg>`
  }
};

const measureLevel = {
  theme: "theme-measure", rounds: 5,

  startRound() {
    this.mistakes = 0;
    const kind = rand(Object.keys(MZ_KINDS));
    const shape = MZ_KINDS[kind];
    const ratio = [2.3, 1.8, 1.45][state.tier];
    const shortH = randBetween(13, 17);
    const tallH = shortH * ratio;
    const askTaller = state.tier === 0 ? true : Math.random() < 0.5;
    this.answerTaller = askTaller;

    const tallOnLeft = Math.random() < 0.5;
    const heights = tallOnLeft ? [tallH, shortH] : [shortH, tallH];
    const isTall = tallOnLeft ? [true, false] : [false, true];

    setInstruction(
      "📏 " + (askTaller ? t("measure_show_taller") : t("measure_show_shorter")),
      askTaller ? t("measure_say_taller") : t("measure_say_shorter")
    );

    $("playArea").innerHTML =
      scene.html("meadow", { seed: 37 + state.round * 4 }) +
      `
      <style>
        .mz-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
        .mz-row{display:flex;align-items:flex-end;justify-content:center;gap:clamp(20px,8vmin,80px)}
        .mz-obj{border:none;background:none;padding:0;cursor:pointer;display:block;touch-action:manipulation;transition:transform .15s}
        .mz-obj:active{transform:scale(.96)}
        .mz-obj.mz-picked{animation:mzPop .4s ease}
        @keyframes mzPop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1.08)}}
        .mz-ground{width:min(85vmin,600px);height:clamp(6px,1.6vmin,12px);border-radius:6px;background:linear-gradient(#a9865a,#7a5f3e);margin-top:clamp(4px,1.2vmin,10px)}
      </style>
      <div class="mz-stage">
        <div class="mz-row">
          <button class="mz-obj" id="mzA" style="height:${heights[0]}vmin;width:${(heights[0] * shape.ratio).toFixed(2)}vmin">${shape.svg()}</button>
          <button class="mz-obj" id="mzB" style="height:${heights[1]}vmin;width:${(heights[1] * shape.ratio).toFixed(2)}vmin">${shape.svg()}</button>
        </div>
        <div class="mz-ground"></div>
      </div>`;

    $("mzA").onclick = ev => this.tap($("mzA"), $("mzB"), isTall[0], ev);
    $("mzB").onclick = ev => this.tap($("mzB"), $("mzA"), isTall[1], ev);
  },

  tap(el, otherEl, isTall, ev) {
    if (state.busy) return;
    const correct = isTall === this.answerTaller;

    if (correct) {
      el.onclick = otherEl.onclick = null;
      el.classList.add("mz-picked");
      sfx.tap(); miniStar(ev.clientX, ev.clientY);
      floaters(["✨"], ev.clientX, ev.clientY, 3);
      speak((this.answerTaller ? t("measure_yes_taller") : t("measure_yes_shorter")) + " " + praise());
      roundComplete();
    } else {
      this.mistakes++;
      sfx.bad(); wiggle(el);
      speak(this.answerTaller ? t("measure_no_taller") : t("measure_no_shorter"));

      if (this.mistakes === 2) {
        otherEl.classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        el.onclick = otherEl.onclick = null;
        core.wait(() => {
          otherEl.classList.remove("hint-highlight");
          otherEl.classList.add("mz-picked");
          sfx.tap();
          speak(praise());
          roundComplete();
        }, 900);
      }
    }
  }
};

registerGame({
  id: "measure", world: "brain", icon: "📏", name: "Tall or Short", es: "Alto o Bajo",
  yue: "高定矮", lvl: 1, cue: "chime", level: measureLevel
});
