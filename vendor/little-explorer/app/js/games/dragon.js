"use strict";
/* LEVEL: Dragon Feed (counting)
   Domain · Number sense · Concept · Age band 3–4 · Success = Child counts 1–5 treats as they feed the dragon. */
const TREATS = ["🍪", "🍖", "🧁", "🍩", "🍰", "🍗"];
const DRAGON_ART = `<svg class="dragon-svg" viewBox="0 0 200 195" xmlns="http://www.w3.org/2000/svg">
  <path d="M40 122 Q4 96 12 152 Q40 142 56 138 Z" fill="#3f8e46"/>
  <path d="M160 122 Q196 96 188 152 Q160 142 144 138 Z" fill="#3f8e46"/>
  <path d="M150 152 Q184 162 178 185 Q160 176 142 166 Z" fill="#4fa257"/>
  <ellipse cx="100" cy="142" rx="60" ry="44" fill="#5bbf63"/>
  <ellipse cx="100" cy="150" rx="38" ry="29" fill="#cdeeb0"/>
  <path d="M74 34 L66 6 L88 30 Z" fill="#3f8e46"/>
  <path d="M126 34 L134 6 L112 30 Z" fill="#3f8e46"/>
  <circle cx="100" cy="76" r="54" fill="#5bbf63"/>
  <ellipse cx="100" cy="94" rx="34" ry="26" fill="#6fce77"/>
  <circle cx="80" cy="60" r="12" fill="#fff"/><circle cx="84" cy="62" r="6" fill="#23306b"/>
  <circle cx="120" cy="60" r="12" fill="#fff"/><circle cx="116" cy="62" r="6" fill="#23306b"/>
  <ellipse cx="90" cy="88" rx="4" ry="5" fill="#2f6b35"/><ellipse cx="110" cy="88" rx="4" ry="5" fill="#2f6b35"/>
  <circle cx="64" cy="94" r="8" fill="#ff9bb0" opacity=".55"/><circle cx="136" cy="94" r="8" fill="#ff9bb0" opacity=".55"/>
  <path d="M80 104 Q100 126 120 104 Q110 118 100 118 Q90 118 80 104 Z" fill="#7a2e22"/>
  <path d="M87 107 L91 113 L95 107 Z" fill="#fff"/><path d="M105 107 L109 113 L113 107 Z" fill="#fff"/>
</svg>`;
const dragonLevel = {
  theme: "theme-dragon", rounds: 5,
  startRound() {
    this.mistakes = 0;
    if (state.round === 0) this.treat = rand(TREATS);
    const counts = [[1, 2, 2, 3, 3], [2, 3, 4, 4, 5], [3, 4, 5, 6, 7]][state.tier];
    const need = counts[state.round];
    this.need = need; this.fed = 0;
    setInstruction("🐉 " + t("feed_dragon_show", { count: need, x: words("treat", need) }), t("feed_dragon_show", { count: need, x: words("treat", need) }));
    $("playArea").innerHTML =
      scene.html("forest", { seed: 38 + state.round * 4, tint: "#8d5bb0" }) +
      `<div class="dragon-wrap">
        <div class="count-badge" id="dragonCount">0</div>
        <div class="dragon" id="dragonEl">${DRAGON_ART}</div>
        <div class="treat-row" id="treatRow"></div></div>`;
    for (let i = 0; i < need; i++) {
      const t = document.createElement("button");
      t.className = "treat"; t.textContent = this.treat;
      makeDraggable(t, (el, ev, info) => this.release(el, ev, info));
      $("treatRow").appendChild(t);
    }
  },
  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    if (inside(centerOf(el), $("dragonEl")) || !info.moved) this.feed(el, ev);
    else {
      this.mistakes++;
      sfx.bad(); info.reset();
      if (this.mistakes === 2) {
        $("dragonEl").classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        wiggle($("dragonEl"));
      }
    }
  },
  feed(el, ev) {
    el.style.visibility = "hidden"; el.classList.add("on-plate");
    const d = $("dragonEl"); d.classList.remove("chomp"); void d.offsetWidth; d.classList.add("chomp");
    sfx.tap(); tone(200, 0, .15, "square", .14); miniStar(ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2);
    const dc = centerOf(d); floaters(["🔥", "💨"], dc.x, dc.y - d.getBoundingClientRect().height * 0.18, 3);   // fire puff each bite
    this.fed++;
    const badge = $("dragonCount"); if (badge) { badge.textContent = this.fed; badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    if (this.fed < this.need) speak(numWord(this.fed) + "!");
    else {
      floaters(["🔥", "✨", "💛"], innerWidth / 2, innerHeight / 2.5, 9);
      tone(120, 0, .5, "sawtooth", .18);
      speak(t("count_x", { count: this.need, x: words("treat", this.need) }) + " " + t("pet_yum") + " " + praise());
      roundComplete();
    }
  }
};

registerGame({
  id: "dragon", world: "num", icon: "🐉", name: "Dragon Feed", es: "Alimenta al Dragón",
  yue: "餵龍", lvl: 0, cue: "roar", level: dragonLevel
});
