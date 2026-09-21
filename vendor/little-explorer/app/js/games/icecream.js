"use strict";
/* ================= LEVEL: Ice Cream Shop (colors + building) ================= */
const icecreamLevel = {
  theme: "theme-icecream", rounds: 5,
  coneBase: 8.5, step: 6,                                   // vmin offsets for stacking
  startRound() {
    const k = [2, 3, 3][state.tier] + (state.round > 2 ? 1 : 0);
    this.need = k; this.on = 0; this.capped = false;
    this.mistakes = 0;                 // as rocket.js: previously only reset on success,
                                       // leaving the first round's ladder unable to fire.
    $("playArea").innerHTML =
      scene.html("meadow", { seed: 28 + state.round * 4, tint: "#e79ab8" }) +
      `<div class="ice-stage">
        <div class="ice-stack" id="iceStack"><div class="ice-cone"></div></div>
        <button class="ice-cherry hidden" id="iceCherry">🍒 Cherry!</button>
        <div class="tub-row" id="tubRow"></div></div>`;
    $("iceCherry").onclick = e => this.cherry(e);
    this.nextColor();
  },
  nextColor() {
    const palette = COLOR_TIERS[Math.min(1, state.tier)];
    const picks = shuffle(palette).slice(0, [3, 3, 4][state.tier]);
    this.target = rand(picks);
    setInstruction("🍨 " + t("scoop_show", { x: colorAdj(this.target, "f") }), t("scoop_say", { x: colorAdj(this.target, "f") }));
    const wrap = $("tubRow"); wrap.innerHTML = "";
    picks.forEach(c => {
      const b = document.createElement("button");
      b.className = "tub"; b.dataset.color = c;
      b.style.setProperty("--c", COLORS[c]);
      b.innerHTML = `<span class="tub-scoop"></span><span class="tub-cup"></span>`;
      b.onclick = e => this.tap(c, e);
      wrap.appendChild(b);
    });
  },
  tap(c, e) {
    if (state.busy || this.capped) return;
    if (c !== this.target) {
      this.mistakes++;
      sfx.bad();
      const b = [...document.querySelectorAll(".tub")].find(x => x.dataset.color === c);
      if (b) wiggle(b);
      if (this.mistakes === 2) {
        const correct = [...document.querySelectorAll(".tub")].find(x => x.dataset.color === this.target);
        if (correct) correct.classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        const correct = [...document.querySelectorAll(".tub")].find(x => x.dataset.color === this.target);
        if (correct) wiggle(correct);
      }
      speak(t("thats_find_scoop", { color: colorName(c), color2: colorAdj(this.target, "f") }));
      return;
    }
    this.mistakes = 0;
    // spawn a fresh scoop that drops + squashes onto the stack at a dynamic offset
    const s = document.createElement("div");
    s.className = "scoop";
    s.style.background = `radial-gradient(circle at 38% 30%, rgba(255,255,255,.55), transparent 46%), ${COLORS[c]}`;
    s.style.bottom = (this.coneBase + this.on * this.step) + "vmin";
    $("iceStack").appendChild(s);
    sfx.tap(); tone(540 - this.on * 28, 0, .16, "sine", .16); miniStar(e.clientX, e.clientY);
    this.on++;
    if (this.on < this.need) { speak(t("scoop_count", { color: colorName(this.target), num: numWord(this.on), x: words("scoop", this.on) })); this.nextColor(); }
    else { this.capped = true; this.showCherry(); }
  },
  showCherry() {
    setInstruction("🍒 " + t("cherry_show"), t("cherry_say"));
    $("tubRow").style.visibility = "hidden";
    const cb = $("iceCherry"); cb.classList.remove("hidden", "pulse"); void cb.offsetWidth; cb.classList.add("pulse");
    speak(t("yummy_cherry"));
  },
  cherry(e) {
    if (state.busy) return;
    const ch = document.createElement("div");
    ch.className = "cherry-top"; ch.textContent = "🍒";
    ch.style.bottom = (this.coneBase + this.need * this.step - 1.5) + "vmin";
    $("iceStack").appendChild(ch);
    $("iceCherry").classList.add("hidden");
    sfx.good(); miniStar(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
    floaters(["🍒", "✨", "😋"], innerWidth / 2, innerHeight / 2.4, 7);
    speak(t("icecream_finish", { count: this.need }) + " " + praise());
    roundComplete();
  }
};

registerGame({
  id: "icecream", world: "shape", icon: "🍦", name: "Ice Cream", es: "Helado", yue: "雪糕",
  lvl: 0, cue: "bell", level: icecreamLevel
});
