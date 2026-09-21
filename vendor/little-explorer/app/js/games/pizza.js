"use strict";
/* LEVEL: Pizza Kitchen (3 round types)
   Domain · Geometry / shapes · Concept · Age band 2–3 · Success = Child matches shapes, colors, and counts toppings. */
const SHAPES = {
  circle:   `<circle cx="50" cy="50" r="40"/>`,
  square:   `<rect x="12" y="12" width="76" height="76" rx="10"/>`,
  triangle: `<path d="M50 8 L92 88 L8 88 Z"/>`,
  star:     `<path d="M50 5 L61 38 L96 38 L68 59 L79 92 L50 71 L21 92 L32 59 L4 38 L39 38 Z"/>`,
  heart:    `<path d="M50 88 C20 64 5 45 5 28 C5 12 18 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C82 4 95 12 95 28 C95 45 80 64 50 88 Z"/>`
};
const TOPPING_COLORS = { circle: "#c0392b", square: "#f1c40f", triangle: "#27ae60", star: "#e67e22", heart: "#e84393" };
const PIZZA_TOPPINGS = { mushroom: "🍄", olive: "🫒", pepper: "🌶️", meatball: "🧆" };
function pizzaBase(extra = "") {
  return `<svg class="pizza" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <circle cx="150" cy="150" r="145" fill="#d9913b"/><circle cx="150" cy="150" r="122" fill="#f6c453"/>
    <circle cx="70" cy="100" r="11" fill="#c0392b"/><circle cx="225" cy="85" r="11" fill="#c0392b"/>
    <circle cx="235" cy="200" r="11" fill="#c0392b"/><circle cx="80" cy="215" r="11" fill="#c0392b"/>
    ${extra}</svg>`;
}
const pizzaLevel = {
  theme: "theme-pizza", rounds: 5,
  startRound() {
    this.mistakes = 0;
    const types = state.tier === 0 ? ["shape", "count", "color"]
                : ["shape", "count", "color", "count", "color"];
    this.type = rand(types);
    this.placed = 0;
    if (this.type === "shape") this.startShape();
    else if (this.type === "count") this.startCount();
    else this.startColor();
  },
  shell(holderInner) {
    $("playArea").innerHTML =
      scene.html("meadow", { seed: 41 + state.round * 4 }) +
      `<div class="pizza-wrap">
        <div id="pizzaHolder">${holderInner}</div>
        <div class="choice-row" id="pizChoices"></div>
      </div>`;
  },
  startShape() {
    const picks = shuffle(Object.keys(SHAPES)).slice(0, [3, 3, 4][state.tier]);
    this.target = rand(picks);
    setInstruction("🍕 " + t("drag_pizza_show", { x: theWord(this.target) }), t("drag_pizza_say", { x: theWord(this.target) }));
    const outline = `<g transform="translate(75,75) scale(1.5)" fill="none" stroke="#8a5a1d" stroke-width="5" stroke-dasharray="12 8">${SHAPES[this.target]}</g>`;
    this.shell(pizzaBase(outline));
    picks.forEach(shape => {
      const b = document.createElement("button");
      b.className = "choice"; b.dataset.shape = shape;
      b.innerHTML = `<svg viewBox="0 0 100 100"><g fill="${TOPPING_COLORS[shape]}">${SHAPES[shape]}</g></svg>`;
      makeDraggable(b, (el, ev, info) => {
        if (state.busy) { info.reset(); return; }
        if (inside(centerOf(el), $("pizzaHolder")) || !info.moved) {
          if (shape === this.target) {
            el.classList.add("popped"); miniStar(ev.clientX || innerWidth/2, ev.clientY || innerHeight/2);
            tone(660, 0, .18, "triangle", .16); floaters(["✨", "🌟"], ev.clientX || innerWidth/2, ev.clientY || innerHeight/2, 4);
            $("pizzaHolder").innerHTML = pizzaBase(`<g transform="translate(75,75) scale(1.5)" fill="${TOPPING_COLORS[this.target]}" class="landed">${SHAPES[this.target]}</g>`);
            speak(t("shape_fits", { x: theWord(shape) }) + " " + praise()); roundComplete();
          } else {
            this.mistakes++;
            info.reset(); sfx.bad(); wiggle(el);
            if (this.mistakes === 2) {
              $("pizzaHolder").querySelector("g").classList.add("hint-highlight");
            } else if (this.mistakes >= 3) {
              wiggle($("pizzaHolder").querySelector("g"));
            }
            speak(t("thats_look", { x: theWord(shape), y: theWord(this.target) }));
          }
        } else info.reset();
      });
      $("pizChoices").appendChild(b);
    });
  },
  startCount() {
    const need = [2, 3, 4][state.tier] + Math.floor(Math.random() * 2);
    this.need = need;
    const [tname, temoji] = rand(Object.entries(PIZZA_TOPPINGS));
    this.tname = tname;
    const tplural = words(tname, need);
    setInstruction("🍕 " + t("put_pizza", { count: need, x: tplural }), t("put_pizza", { count: need, x: tplural }));
    this.shell(pizzaBase());
    document.querySelector(".pizza-wrap").insertAdjacentHTML("afterbegin", `<div class="count-badge" id="pizCount">0</div>`);
    for (let i = 0; i < need; i++) {
      const b = document.createElement("button");
      b.className = "choice tok"; b.textContent = temoji;
      makeDraggable(b, (el, ev, info) => {
        if (state.busy) { info.reset(); return; }
        const holder = $("pizzaHolder");
        if (inside(centerOf(el), holder) || !info.moved) {
          el.classList.add("popped");
          const r = holder.getBoundingClientRect();
          const i = this.placed, cx = r.width / 2, cy = r.height / 2, rad = Math.min(r.width, r.height) * 0.3;
          const ang = (-90 + i * (360 / need)) * Math.PI / 180;            // tidy ring so the count reads clearly
          const dot = document.createElement("div");
          dot.className = "laid-topping"; dot.textContent = temoji;
          dot.style.left = (cx + Math.cos(ang) * rad) + "px";
          dot.style.top = (cy + Math.sin(ang) * rad) + "px";
          holder.appendChild(dot);
          sfx.tap(); tone(440 + i * 60, 0, .14, "sine", .14);
          floaters(["✨"], ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2, 3);
          this.placed++;
          const badge = $("pizCount"); if (badge) { badge.textContent = this.placed; badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
          if (this.placed < need) speak(numWord(this.placed) + "!");
          else { speak(t("placed_pizza", { num: numWord(this.placed), count: need, x: tplural }) + " " + praise()); roundComplete(); }
        } else {
          this.mistakes++;
          info.reset();
          if (this.mistakes === 2) {
            $("pizzaHolder").classList.add("hint-highlight");
          } else if (this.mistakes >= 3) {
            wiggle($("pizzaHolder"));
          }
        }
      });
      $("pizChoices").appendChild(b);
    }
  },
  startColor() {
    const palette = COLOR_TIERS[Math.min(1, state.tier)];
    const picks = shuffle(palette).slice(0, [3, 3, 4][state.tier]);
    this.target = rand(picks);
    setInstruction("🍕 " + t("drag_topping", { color: colorAdj(this.target, "m") }), t("drag_topping", { color: colorAdj(this.target, "m") }));
    this.shell(pizzaBase());
    picks.forEach(color => {
      const b = document.createElement("button");
      b.className = "choice"; b.dataset.color = color;
      b.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="${COLORS[color]}" ${color==="white"?'stroke="#9bb" stroke-width="2"':""}/></svg>`;
      makeDraggable(b, (el, ev, info) => {
        if (state.busy) { info.reset(); return; }
        if (inside(centerOf(el), $("pizzaHolder")) || !info.moved) {
          if (color === this.target) {
            el.classList.add("popped"); miniStar(ev.clientX || innerWidth/2, ev.clientY || innerHeight/2);
            tone(660, 0, .18, "triangle", .16); floaters(["✨", "🌟"], ev.clientX || innerWidth/2, ev.clientY || innerHeight/2, 4);
            const holder = $("pizzaHolder"), r = holder.getBoundingClientRect();
            const dot = document.createElement("div");
            dot.innerHTML = `<svg width="60" height="60"><circle cx="30" cy="30" r="26" fill="${COLORS[color]}"/></svg>`;
            dot.className = "laid-topping"; dot.style.left = "50%"; dot.style.top = "50%";
            holder.appendChild(dot);
            speak(t("color_excl", { color: colorName(color) }) + " " + praise()); roundComplete();
          } else {
            this.mistakes++;
            info.reset(); sfx.bad(); wiggle(el);
            if (this.mistakes === 2) {
              $("pizzaHolder").classList.add("hint-highlight");
            } else if (this.mistakes >= 3) {
              wiggle($("pizzaHolder"));
            }
            speak(t("thats_find_one", { color: colorName(color), color2: colorAdj(this.target, "m") }));
          }
        } else info.reset();
      });
      $("pizChoices").appendChild(b);
    });
  }
};

registerGame({
  id: "pizza", world: "shape", icon: "🍕", name: "Pizza", es: "Pizza", yue: "薄餅", lvl: 1, cue: "wood",
  level: pizzaLevel
});
