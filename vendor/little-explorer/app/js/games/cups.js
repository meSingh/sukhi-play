"use strict";

/**
 * STEM Objective: Spatial Reasoning + Working Memory · track a hidden object through a swap;
 * left / middle / right · Age band 3–5 · Success = Child keeps track of a hidden ball as the
 * cups swap positions and taps the cup it is under.
 *
 * Distinct from Hide & Seek (in/on/under at rest): here the learning is visual tracking,
 * working memory and object permanence as positions change.
 *
 * Correctness lives entirely in JS state (`cupAt` slot→cup map + `ballCup`), NEVER in the
 * animated DOM position — so the round is verifiable even when the preview tab freezes CSS.
 * The shuffle decouples the horizontal slide (`.cup-slot` transform transition) from the
 * vertical hop (`.cup-lift` keyframe) so an arcing swap reads clearly without transform clashes.
 */

/* ================= LEVEL: Three Cups ================= */

const CUP_PALETTE = ["#e2584b", "#4a8fd6", "#5bbf73"];   // distinct cup colors aid tracking

const cupSVG = (c) => `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 14 H78 L70 104 Q50 114 30 104 Z" fill="${c}"/>
  <ellipse cx="50" cy="14" rx="28" ry="7" fill="rgba(0,0,0,0.18)"/>
  <ellipse cx="40" cy="46" rx="6" ry="24" fill="rgba(255,255,255,0.22)"/>
  <path d="M30 104 Q50 114 70 104" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="3"/>
</svg>`;

const ballSVG = () => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#ffd23e"/>
  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="3"/>
  <circle cx="38" cy="38" r="12" fill="rgba(255,255,255,0.55)"/>
</svg>`;

const cupsLevel = {
  theme: "theme-cups",
  rounds: 5,

  // tier → number of swaps + per-swap timing (slower & fewer for younger; see skill 06 ladder)
  tierParams() {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let p = [
      { n: 0, ms: 600, gap: 250 },   // tier 0: no shuffle — permanence + naming (ages 2–3)
      { n: 2, ms: 700, gap: 260 },   // tier 1: two slow, clearly-arced swaps (ages 3–4)
      { n: 4, ms: 480, gap: 160 }    // tier 2: four faster swaps (ages 4–5)
    ][state.tier];
    if (reduced) p = { n: Math.min(p.n, 2), ms: 760, gap: 300 };   // calmer path, still trackable
    return p;
  },

  startRound() {
    state.busy = true;
    this.solved = false;
    this.mistakes = 0;
    this.cupAt = [0, 1, 2];                 // slot index → cup id
    this.ballCup = rand([0, 1, 2]);         // the cup the ball hides under (never changes)
    this.params = this.tierParams();

    setInstruction("🥤 " + t("cups_watch"), t("cups_watch"));
    this.render();
    // Reveal where the ball starts, then settle and shuffle.
    core.wait(() => this.revealStart(), 350);
  },

  render() {
    $("playArea").innerHTML =
      scene.html("cozy", { seed: 31 + state.round * 4, layers: ["canopy", "far", "drift", "motes"] }) +
      `<div class="cups-stage no-slide" id="cupsStage">
      <div class="cups-shadow"></div>
      <div class="cups-ball" id="cupsBall">${ballSVG()}</div>
      ${[0, 1, 2].map(id => `<button class="cup-slot" data-cup="${id}" aria-label="cup ${id + 1}">
          <div class="cup-lift">${cupSVG(CUP_PALETTE[id])}</div>
        </button>`).join("")}
    </div>`;

    const stage = $("cupsStage");
    const r = stage.getBoundingClientRect();
    const W = r.width, H = r.height;
    this.cupW = Math.max(56, Math.min(W * 0.24, H * 0.46, 150));
    const cupH = this.cupW * 1.2;
    this.ballW = this.cupW * 0.5;
    this.slotCenter = [W * 0.2, W * 0.5, W * 0.8];   // left / middle / right
    this.slotX = this.slotCenter.map(c => c - this.cupW / 2);   // left edge for a cup at that slot

    this.cupEls = [0, 1, 2].map(id => stage.querySelector(`.cup-slot[data-cup="${id}"]`));
    this.cupEls.forEach((el, id) => {
      el.style.width = this.cupW + "px";
      el.style.height = cupH + "px";
      el.style.transform = `translateX(${this.slotX[id]}px)`;
      el.onclick = (ev) => this.tap(id, ev);
    });

    const ball = $("cupsBall");
    ball.style.width = this.ballW + "px";
    ball.style.height = this.ballW + "px";
    this.placeBall(this.ballCup);

    // Lock in initial positions without a slide-in, then enable transitions for the shuffle.
    void stage.offsetWidth;
    stage.classList.remove("no-slide");
  },

  // Put the ball element under whatever slot `cupId` currently occupies.
  placeBall(cupId) {
    const slot = this.cupAt.indexOf(cupId);
    const ball = $("cupsBall");
    ball.style.left = (this.slotCenter[slot] - this.ballW / 2) + "px";
  },

  revealStart() {
    if (state.busy === false) return;        // guard against late timer after leaving
    this.placeBall(this.ballCup);
    $("cupsBall").classList.add("show");
    this.cupEls.forEach(el => el.querySelector(".cup-lift").classList.add("lifted"));
    core.wait(() => {
      this.cupEls.forEach(el => el.querySelector(".cup-lift").classList.remove("lifted"));
      $("cupsBall").classList.remove("show");
      core.wait(() => this.runShuffle(), 480);
    }, 1100);
  },

  runShuffle() {
    const { n, ms, gap } = this.params;
    this.cupEls.forEach(el => el.style.setProperty("--swapMs", ms + "ms"));
    let i = 0, lastA = -1, lastB = -1;
    const step = () => {
      if (i >= n) { this.finishShuffle(); return; }
      // pick two distinct slots; avoid repeating the exact same pair back-to-back
      let a, b;
      do { a = rand([0, 1, 2]); b = rand([0, 1, 2].filter(s => s !== a)); }
      while (n > 1 && ((a === lastA && b === lastB) || (a === lastB && b === lastA)));
      lastA = a; lastB = b;
      this.doSwap(a, b, i);
      i++;
      core.wait(step, ms + gap);
    };
    if (n <= 0) this.finishShuffle(); else step();
  },

  doSwap(slotA, slotB, idx) {
    const cupA = this.cupAt[slotA], cupB = this.cupAt[slotB];
    const elA = this.cupEls[cupA], elB = this.cupEls[cupB];
    // horizontal glide (CSS transition on .cup-slot)
    elA.style.transform = `translateX(${this.slotX[slotB]}px)`;
    elB.style.transform = `translateX(${this.slotX[slotA]}px)`;
    // vertical arc (keyframe on the nested .cup-lift) — alternate which cup passes over the top
    const over = (idx % 2 === 0) ? elA : elB;
    const under = (over === elA) ? elB : elA;
    over.style.zIndex = 20; under.style.zIndex = 10;
    const oLift = over.querySelector(".cup-lift"), uLift = under.querySelector(".cup-lift");
    oLift.classList.remove("hop-over"); uLift.classList.remove("hop-under");
    void over.offsetWidth;
    oLift.classList.add("hop-over"); uLift.classList.add("hop-under");
    sfx.tick();
    // update logical state immediately (does not depend on the animation finishing)
    this.cupAt[slotA] = cupB; this.cupAt[slotB] = cupA;
    core.wait(() => {
      oLift.classList.remove("hop-over"); uLift.classList.remove("hop-under");
      over.style.zIndex = ""; under.style.zIndex = "";
    }, this.params.ms);
  },

  finishShuffle() {
    state.busy = false;
    setInstruction("🥤 " + t("cups_find"), t("cups_find"));
  },

  tap(cupId, ev) {
    if (state.busy || this.solved) return;
    if (cupId === this.ballCup) this.win(cupId, ev);
    else this.wrong(cupId);
  },

  liftCup(cupId, showBall) {
    this.cupEls[cupId].querySelector(".cup-lift").classList.add("lifted");
    if (showBall) { this.placeBall(this.ballCup); $("cupsBall").classList.add("show"); }
  },
  dropCup(cupId) {
    this.cupEls[cupId].querySelector(".cup-lift").classList.remove("lifted");
    $("cupsBall").classList.remove("show");
  },
  // attention nudge on a cup — runs on the inner .cup-lift so it never disturbs the slot's translateX
  nudgeCup(cupId) {
    const lift = this.cupEls[cupId].querySelector(".cup-lift");
    lift.classList.remove("nudge"); void lift.offsetWidth; lift.classList.add("nudge");
  },

  win(cupId, ev) {
    this.solved = true;
    state.busy = true;
    this.liftCup(cupId, true);
    $("cupsBall").classList.add("pop");
    sfx.good();
    miniStar(ev.clientX, ev.clientY);
    speak(t("cups_win") + " " + praise());
    core.wait(() => roundComplete(), 700);
  },

  wrong(cupId) {
    this.mistakes++;
    sfx.bad();                                  // wrapped → feeds the difficulty model
    this.liftCup(cupId, false);                 // show it's empty under here — never a dead-end
    speak(t(this.mistakes >= 2 ? "cups_retry" : "cups_nope"));

    if (this.mistakes >= 2) this.nudgeCup(this.ballCup);           // hint 2: draw eyes to the right cup
    if (this.mistakes >= 3) {                                       // hint 3: guided reveal
      this.liftCup(this.ballCup, true);
      return;                                                       // leave it open — child just taps it
    }
    core.wait(() => { if (!this.solved) this.dropCup(cupId); }, 1100);
  }
};

registerGame({
  id: "cups", world: "brain", icon: "🥤", name: "Three Cups", es: "Tres Vasos", yue: "三個杯",
  lvl: 1, cue: "wood", level: cupsLevel
});
