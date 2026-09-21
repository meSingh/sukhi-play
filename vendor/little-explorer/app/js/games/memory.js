"use strict";
/* LEVEL: Memory match
   Domain · Logic / cause–effect · Concept · Age band 3–5 · Success = Child matches pairs of identical items. */
const MEM_THEMES = {
  animals: [["🐶", "puppy"], ["🐱", "kitten"], ["🐮", "cow"], ["🐸", "frog"], ["🦁", "lion"], ["🐧", "penguin"], ["🦋", "butterfly"], ["🐰", "bunny"]],
  food:    [["🍕", "pizza"], ["🍝", "spaghetti"], ["🍦", "ice cream"], ["🍓", "strawberry"], ["🍌", "banana"], ["🧁", "cupcake"], ["🍪", "cookie"], ["🍩", "donut"]],
  frozen:  [["❄️", "snowflake"], ["⛄", "snowman"], ["👑", "crown"], ["🏰", "castle"], ["🦌", "reindeer"], ["✨", "sparkle"], ["🧤", "mitten"], ["⛸️", "skate"]],
  ocean:   [["🐠", "fish"], ["🐬", "dolphin"], ["🐚", "shell"], ["🌊", "wave"], ["⭐", "starfish"], ["🦀", "crab"], ["🐙", "octopus"], ["🐢", "turtle"]]
};
const memoryLevel = {
  theme: "theme-memory", rounds: 3,
  startRound() {
    const pairs = [3, 4, 6][state.tier];
    this.remaining = pairs; this.first = null; this.locked = false; this.misses = 0;
    const themeName = rand(Object.keys(MEM_THEMES));
    setInstruction("🃏 " + t("matching_show"), t("matching_say", { x: t("theme_" + themeName) }));
    const picks = shuffle(MEM_THEMES[themeName]).slice(0, pairs);
    const deck = shuffle([...picks, ...picks]);
    const total = deck.length;
    const cols = total <= 6 ? 3 : 4;
    const rows = Math.ceil(total / cols);
    $("playArea").innerHTML =
      // no mid/frame: the grid is sized to fill the play area, so the floor is hers
      scene.html("forest", { seed: 24 + state.round * 4, tint: "#e08a4b",
                             layers: ["canopy", "far", "drift", "motes"] }) +
      `<div class="mem-grid" id="memGrid"></div>`;
    const grid = $("memGrid");
    // size the cards from the ACTUAL play area so every card always fits on screen
    const pa = $("playArea").getBoundingClientRect();
    const gap = Math.max(8, Math.min(pa.width, pa.height) * 0.025);
    const availW = pa.width - 16, availH = pa.height - 16;
    let cw = (availW - (cols + 1) * gap) / cols;
    let ch = (availH - (rows + 1) * gap) / rows;
    let size = Math.min(cw, ch / 1.22);        // cards are a bit taller than wide
    size = Math.max(44, Math.min(size, 120));
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
    grid.style.gap = gap + "px";
    grid.style.maxWidth = "100%";
    deck.forEach(([emoji, word]) => {
      const card = document.createElement("button");
      card.className = "mem-card";
      card.style.width = size + "px";
      card.style.height = (size * 1.22) + "px";
      card.dataset.emoji = emoji; card.dataset.word = word;
      card.innerHTML = `<div class="mem-inner"><div class="mem-face front">⭐</div><div class="mem-face back">${emoji}</div></div>`;
      card.onclick = () => this.flip(card);
      grid.appendChild(card);
    });
  },
  flip(card) {
    if (state.busy || this.locked) return;
    if (card.classList.contains("flipped") || card.classList.contains("matched")) return;
    sfx.tick(); card.classList.add("flipped");
    document.querySelectorAll(".mem-card.hint-glow").forEach(c => c.classList.remove("hint-glow"));
    if (!this.first) { this.first = card; return; }
    const a = this.first, b = card; this.first = null;
    if (a.dataset.emoji === b.dataset.emoji) {
      this.locked = true;
      core.wait(() => {
        a.classList.add("matched"); b.classList.add("matched");
        a.classList.remove("flipped"); b.classList.remove("flipped");
        sfx.good(); this.locked = false; this.remaining--;
        if (this.remaining > 0) speak(t("match", { item: words(a.dataset.word, 2) }));
        else { speak(t("found_all") + " " + praise()); roundComplete(); }
      }, 550);
    } else {
      this.locked = true; sfx.bad(); speak(t("try_again"));
      this.misses++;
      const unmatched = () => [...document.querySelectorAll(".mem-card:not(.matched):not(.flipped)")];
      if (this.misses >= 3) {
        // briefly reveal one unmatched card as guided assist
        const cards = unmatched();
        if (cards.length >= 2) {
          const hint = cards[0]; hint.classList.add("flipped");
          core.wait(() => hint.classList.remove("flipped"), 1500);
        }
      } else if (this.misses >= 2) {
        // pulse two unmatched cards to draw attention
        const cards = unmatched();
        if (cards.length >= 2) { cards[0].classList.add("hint-glow"); cards[1].classList.add("hint-glow"); }
      }
      core.wait(() => { a.classList.remove("flipped"); b.classList.remove("flipped"); this.locked = false; }, 1000);
    }
  }
};

registerGame({
  id: "memory", world: "brain", icon: "🃏", name: "Memory", es: "Memoria", yue: "記憶", lvl: 1, cue: "chime",
  level: memoryLevel
});
