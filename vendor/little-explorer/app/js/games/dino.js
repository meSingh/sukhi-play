"use strict";

/**
 * STEM Objective: Mathematics · Subitizing · Age band 2–4 ·
 * Success = Child identifies a briefly-shown egg count without counting one-by-one.
 *
 * Flow: eggs shown for 2.5 s in a stable spatial arrangement → nest covers them →
 * child picks the correct number from 2–3 cards → nest lifts and eggs hatch.
 * Wrong guess → eggs peek out for 1.5 s so the child can recount.
 */

/* ================= LEVEL: Dino Eggs (Flash Count) ================= */

const BABY_DINOS = ["🦕", "🦖", "🐊", "🐲"];

/* Fixed spatial arrangements (% of nest box, centered on each egg).
   Stable groupings aid subitizing — never random scatter. */
const EGG_GRIDS = {
  1: [[50,50]],
  2: [[30,50],[70,50]],
  3: [[22,68],[50,20],[78,68]],
  4: [[27,28],[73,28],[27,72],[73,72]],
  5: [[22,30],[50,18],[78,30],[32,72],[68,72]],
  6: [[24,25],[50,18],[76,25],[24,73],[50,78],[76,73]],
  7: [[50,18],[23,30],[77,30],[16,62],[84,62],[36,80],[64,80]]
};

const dinoLevel = {
  theme: "theme-dino", rounds: 5,

  startRound() {
    this.mistakes = 0;
    this.phase = "flash";
    const counts = [[1,2,2,3,3],[2,3,4,4,5],[3,4,5,6,7]][state.tier];
    this.count = counts[state.round];

    setInstruction("🥚 " + t("flash_look"), t("flash_look_say"));
    this.renderFlash();
    core.wait(() => { if ($("flashCover")) this.hideEggs(); }, 2500);
  },

  renderFlash() {
    const grid = EGG_GRIDS[this.count] || EGG_GRIDS[7];
    const eggs = grid.map(([x, y]) =>
      `<div class="flash-egg" style="left:${x}%;top:${y}%;">🥚</div>`
    ).join("");
    $("playArea").innerHTML =
      scene.html("forest", { seed: 29 + state.round * 4 }) +
      `<div class="flash-wrap">
      <div class="flash-nest" id="flashNest">
        <div class="flash-eggs" id="flashEggs">${eggs}</div>
        <div class="flash-cover" id="flashCover"></div>
      </div>
    </div>`;
  },

  hideEggs() {
    $("flashCover").classList.add("visible");
    this.phase = "pick";
    setInstruction("🥚 " + t("flash_ask"), t("flash_ask_say"));
    core.wait(() => { if ($("playArea").querySelector(".flash-wrap")) this.showCards(); }, 420);
  },

  showCards() {
    const choices = this.buildChoices();
    const wrap = $("playArea").querySelector(".flash-wrap");
    if (!wrap) return;
    const div = document.createElement("div");
    div.className = "flash-cards";
    choices.forEach(n => {
      const btn = document.createElement("button");
      btn.className = "flash-card"; btn.textContent = n;
      btn.onclick = () => this.tap(n);
      div.appendChild(btn);
    });
    wrap.appendChild(div);
  },

  buildChoices() {
    const n = this.count;
    const size = state.tier === 0 ? 2 : 3;
    const pool = [n];
    for (const c of [n - 1, n + 1, n - 2, n + 2]) {
      if (pool.length >= size) break;
      if (c >= 1 && c !== n) pool.push(c);
    }
    return shuffle(pool);
  },

  tap(n) {
    if (this.phase !== "pick" || state.busy) return;
    if (n === this.count) this.success();
    else this.wrong();
  },

  success() {
    this.phase = "done";
    sfx.good();
    const cover = $("flashCover");
    if (cover) cover.classList.remove("visible");
    core.wait(() => {
      document.querySelectorAll(".flash-egg").forEach(e => {
        e.textContent = rand(BABY_DINOS);
        e.classList.add("hatched");
      });
      floaters(["🥚", "✨", "⭐"], innerWidth / 2, innerHeight / 2.4, 8);
      speak(t("flash_win", { count: this.count }) + " " + praise());
      roundComplete();
    }, 480);
  },

  wrong() {
    this.mistakes++;
    sfx.bad();
    this.phase = "peek";
    const cover = $("flashCover");
    if (cover) cover.classList.remove("visible");
    speak(t("flash_peek"));
    if (this.mistakes >= 2) {
      core.wait(() => {
        document.querySelectorAll(".flash-card").forEach(c => {
          if (parseInt(c.textContent) === this.count) wiggle(c);
        });
      }, 900);
    }
    core.wait(() => {
      if (cover) cover.classList.add("visible");
      this.phase = "pick";
    }, 1500);
  }
};

registerGame({
  id: "dino", world: "animal", icon: "🦕", name: "Flash Count", es: "Cuenta Rápida", yue: "快數",
  lvl: 0, cue: "roar", level: dinoLevel
});
