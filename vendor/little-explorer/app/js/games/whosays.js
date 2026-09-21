"use strict";
/* LEVEL: Who Says That?
   Domain · Scientific thinking · Concept · Age band 2–3 · Success = Child identifies animal by its sound. */
const whosaysLevel = {
  theme: "theme-whosays", rounds: 5,
  startRound() {
    this.mistakes = 0;
    const nChoices = [2, 3, 4][state.tier];
    const picks = shuffle(Object.keys(ANIMALS)).slice(0, nChoices);
    this.target = rand(picks);
    setInstruction("🔊 " + t("who_show"), t("who_say"));
    $("playArea").innerHTML =
      scene.html("meadow", { seed: 25 + state.round * 4 }) +
      `<div class="ws-wrap">
        <button id="wsListen">🔊</button>
        <div class="ws-choices" id="wsChoices"></div></div>`;
    $("wsListen").onclick = () => speakAnimal(this.target);
    picks.forEach(key => {
      const b = document.createElement("button");
      b.className = "ws-animal"; b.textContent = ANIMALS[key].e;
      b.onclick = e => this.tap(key, b, e);
      $("wsChoices").appendChild(b);
    });
    setTimeout(() => speakAnimal(this.target), 700);
  },
  tap(key, btn, e) {
    if (state.busy) return;
    if (key === this.target) {
      btn.classList.add("popped"); miniStar(e.clientX, e.clientY);
      speak(t("yes_it", { animal: theWord(this.target), sound: animalSound(this.target) }) + " " + praise());
      roundComplete();
    } else {
      this.mistakes++;
      sfx.bad(); wiggle(btn);
      if (this.mistakes === 2) {
        const correct = [...document.querySelectorAll(".ws-animal")].find(el => el.textContent === ANIMALS[this.target].e);
        if (correct) correct.classList.add("hint-highlight");
      } else if (this.mistakes >= 3) {
        const correct = [...document.querySelectorAll(".ws-animal")].find(el => el.textContent === ANIMALS[this.target].e);
        if (correct) wiggle(correct);
      }
      speakAnimal(this.target);
    }
  }
};

registerGame({
  id: "whosays", world: "animal", icon: "🔊", name: "Who Says?", es: "¿Quién Dice?",
  yue: "邊個叫？", lvl: 0, cue: "chirp", level: whosaysLevel
});
