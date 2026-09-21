"use strict";
/* LEVEL: Food counting (pasta)
   Domain · Number sense · Concept · Age band 3–4 · Success = Child counts 1–5 items and places them on a plate. */
const FOODS = [
  { item: "🧆", base: "spaghetti", noun: "meatball" },
  { item: "🍪", base: "plate",     noun: "cookie" },
  { item: "🫐", base: "pancake",   noun: "blueberry" },
  { item: "🍒", base: "cake",      noun: "cherry" },
  { item: "🍓", base: "plate",     noun: "strawberry" },
  { item: "🍇", base: "plate",     noun: "grape" },
  { item: "🥕", base: "plate",     noun: "carrot" },
  { item: "🍩", base: "plate",     noun: "donut" },
  { item: "🥚", base: "pancake",   noun: "egg" }
];
function plateSVG(base) {
  if (base === "spaghetti") {
    let noodles = "";
    for (let i = 0; i < 7; i++) {
      const y = 78 + i * 6, w = 95 - Math.abs(i - 3) * 14;
      noodles += `<path d="M${150 - w} ${y} q ${w * .5} ${i % 2 ? 14 : -14} ${w} 0 q ${w * .5} ${i % 2 ? -14 : 14} ${w} 0" stroke="#f0b428" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    }
    return `<svg class="plate" viewBox="0 0 300 165"><ellipse cx="150" cy="105" rx="142" ry="52" fill="#fdfdfd"/><ellipse cx="150" cy="100" rx="118" ry="40" fill="#f3f3f3"/><ellipse cx="150" cy="98" rx="100" ry="33" fill="#f9e08e"/>${noodles}</svg>`;
  }
  if (base === "cake")
    return `<svg class="plate" viewBox="0 0 300 165"><ellipse cx="150" cy="150" rx="120" ry="14" fill="#0002"/><rect x="60" y="70" width="180" height="74" rx="10" fill="#7a4a2b"/><rect x="60" y="60" width="180" height="26" rx="10" fill="#fff"/><path d="M60 78 q22 18 36 0 q22 18 36 0 q22 18 36 0 q22 18 36 0 q22 18 36 0" fill="#fff"/></svg>`;
  if (base === "pancake")
    return `<svg class="plate" viewBox="0 0 300 165"><ellipse cx="150" cy="120" rx="135" ry="44" fill="#fdfdfd"/><ellipse cx="150" cy="108" rx="104" ry="34" fill="#e0a857"/><ellipse cx="150" cy="100" rx="104" ry="30" fill="#f0c178"/><path d="M70 96 q80 26 160 0 v10 q-80 26 -160 0 z" fill="#b5712e" opacity=".7"/></svg>`;
  return `<svg class="plate" viewBox="0 0 300 165"><ellipse cx="150" cy="100" rx="135" ry="48" fill="#fdfdfd"/><ellipse cx="150" cy="95" rx="110" ry="37" fill="#eef2f5"/></svg>`;
}
const pastaLevel = {
  theme: "theme-pasta", rounds: 5,
  startRound() {
    this.mistakes = 0;
    if (state.round === 0) this.food = rand(FOODS);
    const counts = [[1, 2, 2, 3, 3], [2, 3, 4, 4, 5], [3, 4, 5, 6, 7]][state.tier];
    const need = counts[state.round];
    this.need = need; this.on = 0;
    const { item, base, noun } = this.food;
    const x = words(noun, need);
    setInstruction(t("put_base", { count: need, x, base: theWord(base) }), t("put_base", { count: need, x, base: theWord(base) }));
    $("playArea").innerHTML =
      scene.html("meadow", { seed: 20 + state.round * 4, tint: "#c96a5a" }) +
      `<div class="pasta-wrap">
        <div class="yum-badge" id="yumCount">0</div>
        <div class="food-row" id="foodRow"></div>
        <div id="plateHolder">${plateSVG(base)}</div></div>`;
    for (let i = 0; i < need; i++) {
      const m = document.createElement("button");
      m.className = "fooditem"; m.textContent = item;
      makeDraggable(m, (el, ev, info) => this.release(el, ev, info));
      $("foodRow").appendChild(m);
    }
  },
  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    const plate = $("plateHolder");
    if (inside(centerOf(el), plate)) this.land(el);
    else if (!info.moved) {
      const r = plate.getBoundingClientRect();
      el.style.position = "fixed"; el.style.zIndex = 60;
      el.style.left = (r.left + r.width * randBetween(.3, .62)) + "px";
      el.style.top = (r.top + r.height * randBetween(.25, .5)) + "px";
      this.land(el);
    } else {
      this.mistakes++;
      sfx.bad(); info.reset();
      if (this.mistakes === 2) {
        $("plateHolder").classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        wiggle($("plateHolder"));
      }
    }
  },
  land(el) {
    // snap the food into a tidy arc on the plate so the quantity reads clearly
    const plate = $("plateHolder").getBoundingClientRect();
    const i = this.on, n = this.need, frac = n === 1 ? 0.5 : i / (n - 1);
    const px = plate.left + plate.width * (0.2 + 0.6 * frac);
    const py = plate.top + plate.height * 0.46 - Math.sin(frac * Math.PI) * plate.height * 0.12;
    const r = el.getBoundingClientRect();
    el.classList.remove("on-plate"); void el.offsetWidth;
    el.style.position = "fixed"; el.style.zIndex = 12;
    el.style.left = (px - r.width / 2) + "px"; el.style.top = (py - r.height / 2) + "px";
    el.classList.add("on-plate");
    sfx.tap(); tone(440 + i * 60, 0, .14, "sine", .14); floaters(["✨"], px, py, 3);
    this.on++;
    const badge = $("yumCount"); if (badge) { badge.textContent = this.on; badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    if (this.on < this.need) speak(numWord(this.on) + "!");
    else { speak(t("fed_count", { num: numWord(this.on), count: this.need, x: words(this.food.noun, this.need) }) + " " + praise()); roundComplete(); }
  }
};

registerGame({
  id: "pasta", world: "num", icon: "🍝", name: "Yum Count", es: "A Contar", yue: "數食物", lvl: 0, cue: "wood",
  level: pastaLevel
});
