"use strict";
/* LEVEL: Big & Small (size sorting)
   Domain · Measurement / comparison · Concept · Age band 2–4 · Success = Child identifies and sorts objects by size (big/small). */
const SORT_EMOJIS = ["⭐", "🪐", "☄️", "🌟", "👽", "🛸", "🌙"];
const sortLevel = {
  theme: "theme-space", rounds: 5,
  startRound() {
    this.mistakes = 0;
    const n = [2, 3, 4][state.tier];
    this.em = rand(SORT_EMOJIS);
    setInstruction("🪐 " + t("sortsize_show"), t("sortsize_say"));
    $("playArea").innerHTML =
      scene.html("space", { seed: 27 + state.round * 4, layers: ["far", "drift", "mid", "motes"] }) +
      `<div class="space-bg" id="spaceBg"></div>
      <div class="sort-bins">
        <div class="bin big" id="binBig">🪐<div class="binlbl">${t("lbl_big")}</div></div>
        <div class="bin small" id="binSmall">🌑<div class="binlbl">${t("lbl_small")}</div></div>
      </div>
      <div class="sort-tray" id="sortTray"></div>`;
    addStars($("spaceBg"));
    const sizes = [];
    for (let i = 0; i < n; i++) sizes.push(Math.random() < .5 ? "big" : "small");
    if (!sizes.includes("big")) sizes[0] = "big";
    if (!sizes.includes("small")) sizes[sizes.length - 1] = "small";
    this.remaining = n;
    shuffle(sizes).forEach(sz => {
      const it = document.createElement("button");
      it.className = "sortitem " + sz; it.textContent = this.em; it.dataset.size = sz;
      makeDraggable(it, (el, ev, info) => this.release(el, ev, info));
      $("sortTray").appendChild(it);
    });
  },
  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    const c = centerOf(el), sz = el.dataset.size;
    const overBig = inside(c, $("binBig")), overSmall = inside(c, $("binSmall"));
    if (overBig || overSmall) {
      if ((overBig && sz === "big") || (overSmall && sz === "small")) {
        el.classList.add("on-plate");
        el.style.position = "static"; el.style.left = el.style.top = el.style.zIndex = "";
        (sz === "big" ? $("binBig") : $("binSmall")).appendChild(el);
        sfx.tap(); miniStar(ev.clientX, ev.clientY);
        this.remaining--;
        speak(sz === "big" ? t("big") : t("small"));
        if (this.remaining === 0) { speak(praise()); roundComplete(); }
      } else {
        this.mistakes++;
        info.reset(); sfx.bad(); wiggle(el);
        if (this.mistakes === 2) {
          (sz === "big" ? $("binBig") : $("binSmall")).classList.add("hint-highlight");
        } else if (this.mistakes >= 3) {
          wiggle(sz === "big" ? $("binBig") : $("binSmall"));
        }
        speak(sz === "big" ? t("that_big") : t("that_small"));
      }
    } else info.reset();
  }
};

/* ================= LEVEL: Sort It (classification) =================
   STEM: Sorting/Classification · classify by a single attribute (color or kind) · ages 2-4 ·
   Success = child groups objects into the correct bin by color or category. */
const SORT_KINDS = {
  animal:  { label: "🐾", name: "animals",        items: ["🐶", "🐱", "🐰", "🦊", "🐻", "🐸", "🦁"] },
  food:    { label: "🍎", name: "yummy food",     items: ["🍕", "🍎", "🍓", "🍌", "🥕", "🍪", "🧀"] },
  vehicle: { label: "🚗", name: "things that go",  items: ["🚗", "✈️", "🚂", "🚲", "🚜", "🚀", "⛵"] }
};
const SORT_COLORS = {
  red:    { color: "#e63946", name: "red",    items: ["🍎", "🍓", "🌹", "🍒", "🚒", "❤️"] },
  blue:   { color: "#2f6fde", name: "blue",   items: ["🫐", "🐳", "🌊", "💙", "🧢", "🐬"] },
  yellow: { color: "#f4c726", name: "yellow", items: ["🍋", "🌻", "⭐", "🍌", "🐥", "🌟"] },
  green:  { color: "#3fa84f", name: "green",  items: ["🥦", "🐸", "🌳", "🍀", "🥝", "🦎"] }
};
const sortkindLevel = {
  theme: "theme-sort", rounds: 4,
  startRound() {
    this.mode = rand(["color", "kind"]);
    this.mistakes = 0;
    this.wrong = 0; // existing counter, keeping for safety
    const nBins = [2, 2, 3][state.tier], perBin = 2;
    const sets = this.mode === "color" ? SORT_COLORS : SORT_KINDS;
    this.sets = sets;
    const keys = shuffle(Object.keys(sets)).slice(0, nBins);
    setInstruction(this.mode === "color" ? "🧺 " + t("sortcolor_show") : "🧺 " + t("sortkind_show"),
      this.mode === "color" ? t("sortcolor_say") : t("sortkind_say"));
    const binsHtml = keys.map(k => {
      const s = sets[k];
      const badge = this.mode === "color" ? `<div class="sk-badge" style="background:${s.color}"></div>` : `<div class="sk-badge">${s.label}</div>`;
      const label = this.mode === "color" ? colorName(k) : t("kind_" + k);
      return `<div class="sk-bin" data-bin="${k}">${badge}<div class="sk-basket sk-drop"></div><div class="sk-binlbl">${label}</div></div>`;
    }).join("");
    $("playArea").innerHTML =
      // no mid/ground/frame: the bins fill the top and the tray the bottom of this one
      scene.html("reef", { seed: 45 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) +
      `<div class="sk-stage"><div class="sk-bins">${binsHtml}</div><div class="sk-tray" id="skTray"></div></div>`;
    let items = [];
    keys.forEach(k => shuffle(sets[k].items).slice(0, perBin).forEach(e => items.push({ e, bin: k })));
    items = shuffle(items);
    this.remaining = items.length;
    items.forEach(it => {
      const b = document.createElement("button");
      b.className = "sk-item"; b.textContent = it.e; b.dataset.bin = it.bin;
      makeDraggable(b, (el, ev, info) => this.release(el, ev, info));
      $("skTray").appendChild(b);
    });
  },
  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    const c = centerOf(el);
    const over = [...document.querySelectorAll(".sk-bin")].find(b => inside(c, b));
    if (!over) { info.reset(); return; }
    const want = el.dataset.bin, got = over.dataset.bin;
    if (want === got) {
      el.classList.add("on-plate"); el.style.position = "static"; el.style.left = el.style.top = el.style.zIndex = "";
      over.querySelector(".sk-drop").appendChild(el);
      sfx.tap(); tone(540, 0, .14, "sine", .15); miniStar(ev.clientX, ev.clientY);
      const cc = centerOf(over); floaters(["✨"], cc.x, cc.y, 3);
      this.remaining--;
      speak(t("sorted_one", { x: this.mode === "color" ? colorName(got) : t("kind_" + got) }));
      if (this.remaining === 0) { speak(t("all_sorted") + " " + praise()); roundComplete(); }
    } else {
      info.reset(); sfx.bad(); this.wrong++;
      if (this.wrong >= 2) {                                 // hint ladder: highlight the right basket after the 2nd miss
        const tb = document.querySelector(`.sk-bin[data-bin="${want}"]`);
        if (tb) { tb.classList.remove("hint"); void tb.offsetWidth; tb.classList.add("hint"); }
      }
      speak(this.mode === "color"
        ? t("that_basket", { x: colorName(want), y: colorAdj(want, "f") })
        : t("goes_with", { x: t("kind_" + want) }));
    }
  }
};

/* LEVEL: Star Patterns (sequencing)
   Domain · Patterns / algebra · Concept · Age band 2–4 · Success = Child identifies the next item in a pattern. */
const PAT_PALETTES = [["🔴", "🔵"], ["⭐", "🌙"], ["🟣", "🟢"], ["🔴", "🟡", "🔵"], ["❤️", "💛", "💚"], ["🌟", "☄️", "🪐"]];
const patternLevel = {
  theme: "theme-space", rounds: 5,
  startRound() {
    this.mistakes = 0;
    const types = state.tier === 0 ? ["AB"] : state.tier === 1 ? ["AB", "ABC", "AAB"] : ["ABC", "AAB", "ABB"];
    this.type = rand(types);
    const distinct = new Set(this.type).size;
    const pal = rand(PAT_PALETTES.filter(p => p.length >= distinct));
    const unit = this.type.split("").map(ch => pal["ABC".indexOf(ch)]);
    const reps = state.tier + 2;
    const full = [];
    for (let r = 0; r < reps; r++) full.push(...unit);
    this.answer = full[full.length - 1];
    const shown = full.slice(0, full.length - 1);
    setInstruction("🔮 " + t("next_show"), t("next_say"));
    $("playArea").innerHTML =
      scene.html("space", { seed: 27 + state.round * 4, layers: ["far", "drift", "mid", "motes"] }) +
      `<div class="space-bg" id="spaceBg"></div>
      <div class="pattern-row" id="patRow"></div>
      <div class="pattern-choices" id="patChoices"></div>`;
    addStars($("spaceBg"));
    shown.forEach(x => { const d = document.createElement("div"); d.className = "patcell"; d.textContent = x; $("patRow").appendChild(d); });
    const q = document.createElement("div"); q.className = "patcell q"; q.textContent = "❓"; $("patRow").appendChild(q);
    let choices = [...new Set(pal)];
    if (!choices.includes(this.answer)) choices.push(this.answer);
    shuffle(choices).forEach(x => {
      const b = document.createElement("button"); b.className = "patchoice"; b.textContent = x;
      b.onclick = e => this.tap(b, x, e); $("patChoices").appendChild(b);
    });
  },
  tap(b, x, e) {
    if (state.busy) return;
    if (x === this.answer) {
      b.classList.add("popped");
      const q = document.querySelector(".patcell.q"); if (q) { q.textContent = x; q.classList.remove("q"); }
      miniStar(e.clientX, e.clientY); speak(praise()); roundComplete();
    } else {
      this.mistakes++;
      sfx.bad(); wiggle(b);
      if (this.mistakes === 2) {
        const correct = [...document.querySelectorAll(".patchoice")].find(c => c.textContent === this.answer);
        if (correct) correct.classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        const correct = [...document.querySelectorAll(".patchoice")].find(c => c.textContent === this.answer);
        if (correct) wiggle(correct);
      }
      speak(t("try_pattern"));
    }
  }
};

registerGame({
  id: "pattern", world: "brain", icon: "🔮", name: "Patterns", es: "Patrones", yue: "規律",
  lvl: 2, cue: "sparkle", level: patternLevel
});
registerGame({
  id: "sort", world: "brain", icon: "🪐", name: "Big & Small", es: "Grande y Pequeño",
  yue: "大同細", lvl: 0, cue: "pop", level: sortLevel
});
registerGame({
  id: "sortkind", world: "brain", icon: "🧺", name: "Sort It", es: "A Ordenar", yue: "分類",
  lvl: 1, cue: "wood", level: sortkindLevel
});
