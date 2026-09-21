"use strict";
/* ================= LEVEL: Animal band ================= */
const BAND_KEYS = ["frog", "cat", "dog", "duck", "sheep", "bird", "cow", "lion"];
const musicLevel = {
  theme: "theme-music", rounds: 5,
  startRound() {
    core.cleanup();
    const nKeys = [3, 4, 5][state.tier];
    const len = [2, 3, 4][state.tier];
    this.keys = shuffle(BAND_KEYS).slice(0, nKeys);
    this.seq = Array.from({ length: len }, () => Math.floor(Math.random() * nKeys));
    this.toPlay = this.seq.slice();
    this.listening = false;
    setInstruction("🥁 " + t("listen_show"), t("listen_say"));
    $("playArea").innerHTML =
      scene.html("forest", { seed: 28 + state.round * 4, tint: "#9a5fc0" }) +
      `<div class="music-stage"><div class="music-keys" id="musicKeys"></div></div>`;
    this.keys.forEach((k, i) => {
      const b = document.createElement("button");
      b.className = "mkey"; b.textContent = ANIMALS[k].e; b.dataset.i = i;
      b.onclick = e => this.press(b, i, e);
      $("musicKeys").appendChild(b);
    });
    this.seq.forEach((ki, idx) => core.wait(() => this.demo(ki), 1100 + idx * 1150));
    core.wait(() => {
      this.listening = true;
      this.keys.forEach((_, i) => { if (this.seq.includes(i)) this.keyEl(i).classList.add("glow"); });
      setInstruction("🥁 " + t("yourturn_show"), t("yourturn_say"));
    }, 1100 + this.seq.length * 1150 + 400);
  },
  keyEl(i) { return document.querySelector(`.mkey[data-i="${i}"]`); },
  demo(i) {
    const el = this.keyEl(i);
    if (!el || !el.isConnected) return;
    speakAnimal(this.keys[i]);
    el.classList.add("lit"); setTimeout(() => el.classList.remove("lit"), 500);
  },
  press(el, i, e) {
    if (state.busy) return;
    speakAnimal(this.keys[i]);
    el.classList.add("lit"); core.wait(() => el.classList.remove("lit"), 300);
    const note = document.createElement("div");
    note.className = "music-note"; note.textContent = rand(["🎵", "🎶", "🎼"]);
    const r = el.getBoundingClientRect();
    note.style.left = (r.left + r.width / 2 - 14) + "px"; note.style.top = (r.top - 10) + "px"; note.style.position = "fixed";
    document.body.appendChild(note); core.wait(() => note.remove(), 1600);
    if (!this.listening) return;
    const idx = this.toPlay.indexOf(i);
    if (idx !== -1) {
      this.toPlay.splice(idx, 1);
      if (!this.toPlay.includes(i)) el.classList.remove("glow");
      miniStar(e.clientX, e.clientY);
      if (this.toPlay.length === 0) { speak(t("beautiful_music") + " " + praise()); roundComplete(); }
    }
  }
};

registerGame({
  id: "music", world: "animal", icon: "🥁", name: "Animal Band", es: "Banda Animal",
  yue: "動物樂隊", lvl: 1, cue: "drum", level: musicLevel
});
