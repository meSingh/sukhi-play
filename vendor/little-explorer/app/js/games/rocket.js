"use strict";
/* ================= Space helpers ================= */
function addStars(container, n = 26) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "twinkle";
    const sz = randBetween(2, 6);
    s.style.width = sz + "px"; s.style.height = sz + "px";
    s.style.left = Math.random() * 99 + "%"; s.style.top = Math.random() * 99 + "%";
    s.style.animationDelay = -Math.random() * 2.4 + "s";
    container.appendChild(s);
  }
}

/* ================= LEVEL: Rocket Countdown (reverse counting) ================= */
const ROCKET_ART = `<svg class="rk-svg" viewBox="0 0 80 116" xmlns="http://www.w3.org/2000/svg">
  <path d="M28 44 Q40 4 52 44 Z" fill="#e63946"/>
  <rect x="28" y="40" width="24" height="62" rx="11" fill="#eef2f7"/>
  <rect x="28" y="69" width="24" height="9" fill="#ffd23e"/>
  <circle cx="40" cy="57" r="8" fill="#7fd0ff" stroke="#b9c8da" stroke-width="2"/>
  <path d="M28 89 L14 114 L28 103 Z" fill="#c8313e"/>
  <path d="M52 89 L66 114 L52 103 Z" fill="#c8313e"/>
  <rect x="32" y="100" width="16" height="8" rx="3" fill="#9aa3b0"/>
</svg>`;
const rocketLevel = {
  theme: "theme-space", rounds: 5,
  startRound() {
    const starts = [[3, 3, 3, 4, 5], [5, 5, 6, 7, 8], [5, 8, 10, 10, 10]][state.tier];
    this.start = starts[state.round];
    this.next = this.start;
    this.mistakes = 0;                 // per round: it was only reset on a CORRECT tap,
                                       // so on a first-ever round `undefined++` gave NaN
                                       // and the hint ladder never fired for a child who
                                       // was struggling from the very start.
    setInstruction("🚀 " + t("countdown_show", { next: this.next }), t("countdown_say", { next: this.next }));
    $("playArea").innerHTML =
      // no canopy: .space-bg already twinkles overhead. No frame: the number pad is down there.
      scene.html("space", { seed: 35 + state.round * 4, layers: ["far", "drift", "mid", "motes"] }) +
      `<div class="space-bg" id="spaceBg"></div>
      <div class="rocket-pad"><div class="rocket" id="rocketEl">${ROCKET_ART}<div class="rk-flame" id="rkFlame"></div></div></div>
      <div class="num-pad" id="numPad"></div>`;
    addStars($("spaceBg"));
    shuffle([...Array(this.start).keys()].map(i => i + 1)).forEach(n => {
      const b = document.createElement("button");
      b.className = "numkey" + (n === this.next ? " glow" : "");
      b.textContent = n; b.dataset.n = n;
      b.onclick = e => this.tap(b, n, e);
      $("numPad").appendChild(b);
    });
  },
  tap(b, n, e) {
    if (state.busy) return;
    if (n === this.next) {
      this.mistakes = 0;
      b.classList.add("popped");
      tone(700 - (this.start - this.next) * 60, 0, .18, "square", .18);  // descending beeps
      miniStar(e.clientX, e.clientY);
      const rk = $("rocketEl"), fl = $("rkFlame");
      rk.style.transform = `translateY(${-(this.start - this.next + 1) * 9}%)`;
      if (fl) { fl.classList.remove("puff"); void fl.offsetWidth; fl.classList.add("puff"); }   // flame puff each count
      this.next--;
      if (this.next > 0) {
        speak(numWord(this.next) + "!");
        $("instruction").textContent = t("tap_next", { next: this.next });
        const nb = $("numPad").querySelector(`.numkey[data-n="${this.next}"]`);
        if (nb) nb.classList.add("glow");
      } else {
        state.busy = true;
        rk.classList.add("launch");
        tone(110, 0, .7, "sawtooth", .2); tone(80, .1, .6, "sawtooth", .15);
        $("instruction").textContent = t("blastoff_screen");
        speak(t("blastoff") + " " + praise());
        confetti(22);
        roundComplete();
      }
    } else {
      this.mistakes++;
      sfx.bad(); wiggle(b);
      if (this.mistakes === 2) {
        const nb = $("numPad").querySelector(`.numkey[data-n="${this.next}"]`);
        if (nb) nb.classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        const nb = $("numPad").querySelector(`.numkey[data-n="${this.next}"]`);
        if (nb) wiggle(nb);
      }
      speak(t("find_num", { next: this.next }));
    }
  }
};

registerGame({
  id: "rocket", world: "num", icon: "🚀", name: "Countdown", es: "Cuenta Atrás", yue: "倒數",
  lvl: 2, cue: "rocket", level: rocketLevel
});
