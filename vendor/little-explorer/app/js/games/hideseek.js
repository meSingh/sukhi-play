"use strict";

/**
 * STEM Objective: Spatial Reasoning · Positional Language (in / on / under) · Age band 2–3 ·
 * Success = Child places a buddy in / on / under a named object and hears the preposition named.
 *
 * One object per round (rotates for incidental vocabulary). The object shows 2–3 soft, visible
 * drop "ghosts" at the real in/on/under positions, so the preposition — not object-finding — is the
 * thing being chosen. Dropping snaps to the NEAREST ghost (no precision trap, never a silent reset).
 */

/* ================= LEVEL: Hide & Seek ================= */

/* Drawn SVG hiding spots (viewBox 0 0 100 100). `zones` are ghost-target centers as % of the box.
   `rels` lists the prepositions that make physical sense for that object. */
const HIDE_SPOTS = {
  box: {
    rels: ["in", "on", "under"],
    zones: { on: { x: 50, y: 30 }, in: { x: 50, y: 64 }, under: { x: 50, y: 95 } },
    svg: (c = "#f0a23c") => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="48" width="64" height="42" rx="3" fill="${c}"/>
      <path d="M18 48 L8 33 L72 33 L82 48 Z" fill="${c}" opacity="0.85"/>
      <path d="M82 48 L92 33 L92 76 L82 90 Z" fill="${c}" opacity="0.6"/>
      <path d="M18 48 L82 48" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
    </svg>`
  },
  basket: {
    rels: ["in", "on", "under"],
    zones: { on: { x: 50, y: 24 }, in: { x: 50, y: 62 }, under: { x: 50, y: 95 } },
    svg: (c = "#d9913b") => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 42 Q50 32 86 42 L78 88 Q50 93 22 88 Z" fill="${c}"/>
      <path d="M14 42 Q50 52 86 42" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="3"/>
      <path d="M24 24 Q50 12 76 24" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
    </svg>`
  },
  table: {
    rels: ["on", "under"],
    zones: { on: { x: 50, y: 28 }, under: { x: 50, y: 68 } },
    svg: (c = "#8a5a2b") => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="34" width="84" height="9" rx="4" fill="${c}"/>
      <rect x="16" y="43" width="7" height="44" rx="2" fill="${c}" opacity="0.9"/>
      <rect x="77" y="43" width="7" height="44" rx="2" fill="${c}" opacity="0.9"/>
    </svg>`
  }
};

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const hideseekLevel = {
  theme: "theme-pets",
  rounds: 5,

  startRound() {
    this.step = 0;
    this.mistakes = 0;
    const tier = state.tier;
    // tier 0 → in/on only; tier 1+ → in/on/under
    const allowed = tier === 0 ? ["in", "on"] : ["in", "on", "under"];

    // Only use spots that offer at least two valid prepositions, so there's a real choice to make.
    const spotPool = Object.keys(HIDE_SPOTS).filter(
      s => HIDE_SPOTS[s].rels.filter(r => allowed.includes(r)).length >= 2
    );
    this.spot = rand(spotPool);
    const validRels = HIDE_SPOTS[this.spot].rels.filter(r => allowed.includes(r));

    this.relation = rand(validRels);
    // tier 2: a second, contrasting placement in the same round (child constructs a contrast).
    this.second = null;
    if (tier === 2) {
      const others = validRels.filter(r => r !== this.relation);
      if (others.length) this.second = rand(others);
    }

    this.render(validRels);
    this.setPrompt(this.relation, false);
  },

  render(validRels) {
    const bObj = BUDDIES.find(x => x.id === BUDDY) || BUDDIES[0];
    const spot = HIDE_SPOTS[this.spot];
    const zonesHtml = validRels.map(r => {
      const z = spot.zones[r];
      return `<div class="hs-zone" data-rel="${r}" style="left:${z.x}%; top:${z.y}%;"></div>`;
    }).join("");

    $("playArea").innerHTML =
      scene.html("cozy", { seed: 37 + state.round * 4 }) +
      `<div class="hideseek-wrap" id="hideseekWrap">
      <div class="hideseek-stage"><div class="hide-spot">${spot.svg()}${zonesHtml}</div></div>
      <div class="hideseek-buddy" id="buddyActor">${bObj.e}</div>
    </div>`;

    makeDraggable($("buddyActor"), (el, ev, info) => this.release(el, ev, info));
  },

  setPrompt(rel, isNext) {
    const relW = t("rel_" + rel);
    const spotW = theWord(this.spot);
    setInstruction(
      "🐾 " + t(isNext ? "hideseek_next" : "hideseek_show", { rel: relW, spot: spotW }),
      isNext
        ? t("hideseek_next", { rel: relW, spot: spotW })
        : t("hideseek_say", { buddy: cap(theWord(BUDDY)), rel: relW, spot: spotW })
    );
  },

  release(el, ev, info) {
    if (state.busy) { info.reset(); return; }
    if (!info.moved) { info.reset(); return; }   // a tap, not a drag — never penalize

    // Snap to the NEAREST ghost (forgiving — no corner-precision trap, always gives feedback).
    const c = centerOf(el);
    let best = null, bestD = Infinity;
    document.querySelectorAll(".hs-zone").forEach(z => {
      const zc = centerOf(z);
      const d = Math.hypot(c.x - zc.x, c.y - zc.y);
      if (d < bestD) { bestD = d; best = z; }
    });
    if (!best) { info.reset(); return; }

    if (best.dataset.rel === this.relation) this.placeSuccess(el, best, ev);
    else this.wrong(el, info);
  },

  placeSuccess(el, zone, ev) {
    el.classList.add("on-plate");
    zone.appendChild(el);
    el.style.position = "absolute";
    el.style.left = "50%"; el.style.top = "50%";
    el.style.transform = "translate(-50%, -50%)";
    el.style.zIndex = 11;
    sfx.good();
    miniStar(ev.clientX, ev.clientY);

    // tier 2: a contrasting second placement before the round completes.
    if (state.tier === 2 && this.step === 0 && this.second) {
      this.step = 1;
      speak(t("hideseek_again"));
      core.wait(() => this.beginSecond(this.second), 1200);
      return;
    }
    speak(t("hideseek_win") + " " + praise());
    roundComplete();
  },

  beginSecond(rel) {
    this.relation = rel;
    this.mistakes = 0;
    // re-home the buddy out of the zone so it can be dragged again
    const buddy = $("buddyActor");
    buddy.classList.remove("on-plate");
    buddy.style.position = ""; buddy.style.left = ""; buddy.style.top = "";
    buddy.style.transform = ""; buddy.style.zIndex = "";
    $("hideseekWrap").appendChild(buddy);
    document.querySelectorAll(".hs-zone").forEach(z => z.classList.remove("correct-hint"));
    this.setPrompt(rel, true);
  },

  wrong(el, info) {
    this.mistakes++;
    sfx.bad();              // counted by the wrapped sfx.bad → feeds the difficulty model
    info.reset();
    wiggle(el);
    const correct = [...document.querySelectorAll(".hs-zone")].find(z => z.dataset.rel === this.relation);
    if (this.mistakes >= 2 && correct) correct.classList.add("correct-hint");   // visual cue
    if (this.mistakes >= 3 && correct) wiggle(correct);                          // guided assist
    speak(t("hideseek_retry", { rel: t("rel_" + this.relation), spot: theWord(this.spot) }));
  }
};

registerGame({
  id: "hideseek", world: "pets", icon: "🐾", name: "Hide & Seek", es: "Escondite", yue: "捉迷藏",
  lvl: 0, cue: "pop", level: hideseekLevel
});
