"use strict";
/* Dress-Up Studio (creative)
   Domain · Sorting / classification / data · Concept · Age band 2–5 · Success = Child selects and categorizes clothing items. */
// fly an emoji from a closet slot onto its layer position on the doll, then snap
/* ---- Drawn character: every part is real SVG art designed to align & compose ---- */
function dStarPath(cx, cy, r) {
  let p = "";
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i / 10 * Math.PI * 2 - Math.PI / 2; p += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1); }
  return p + "Z";
}
function dHeartPath(cx, cy, s) {
  return `M${cx} ${cy + 0.55 * s} C ${cx - 1.1 * s} ${cy - 0.35 * s}, ${cx - 0.5 * s} ${cy - 1.05 * s}, ${cx} ${cy - 0.35 * s} C ${cx + 0.5 * s} ${cy - 1.05 * s}, ${cx + 1.1 * s} ${cy - 0.35 * s}, ${cx} ${cy + 0.55 * s} Z`;
}
function dEye(cx, kind) {
  if (kind === "happy") return `<path d="M${cx - 9} 101 Q${cx} 90 ${cx + 9} 101" stroke="#3a2e2e" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (kind === "sleepy") return `<path d="M${cx - 9} 97 Q${cx} 106 ${cx + 9} 97" stroke="#3a2e2e" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (kind === "big") return `<circle cx="${cx}" cy="98" r="11" fill="#fff" stroke="#3a2e2e" stroke-width="2"/><circle cx="${cx}" cy="99" r="6.5" fill="#3a2e2e"/><circle cx="${cx + 2}" cy="96" r="2.1" fill="#fff"/>`;
  if (kind === "star") return `<path d="${dStarPath(cx, 98, 11)}" fill="#ffd23e" stroke="#e0a400" stroke-width="1.5"/>`;
  if (kind === "heart") return `<path d="${dHeartPath(cx, 99, 11)}" fill="#ff5d7a"/>`;
  return `<circle cx="${cx}" cy="98" r="8" fill="#3a2e2e"/><circle cx="${cx + 2.5}" cy="95" r="2.6" fill="#fff"/>`;   // round
}
const dMouth = {
  smile: `<path d="M84 119 Q100 137 116 119" stroke="#9c3b2a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  small: `<path d="M90 122 Q100 130 110 122" stroke="#9c3b2a" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  big: `<path d="M84 117 Q100 121 116 117 Q113 140 100 140 Q87 140 84 117 Z" fill="#9c3b2a"/><rect x="86" y="118" width="28" height="8" rx="3" fill="#fffef5"/><line x1="100" y1="118" x2="100" y2="126" stroke="#e8d8c8" stroke-width="2"/><path d="M91 133 Q100 143 109 133 Z" fill="#ff7d8a"/>`,
  o: `<ellipse cx="100" cy="125" rx="7" ry="9" fill="#9c3b2a"/>`,
  tongue: `<path d="M84 119 Q100 133 116 119" stroke="#9c3b2a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M96 125 Q100 138 104 125 Z" fill="#ff7d8a"/>`
};
const dCheeks = `<circle cx="64" cy="116" r="9" fill="#ff9bb0" opacity=".7"/><circle cx="136" cy="116" r="9" fill="#ff9bb0" opacity=".7"/>`;
function dFaceSVG(style) {
  const F = { happy: ["round", "smile", 1], big: ["round", "big", 1], wink: ["wink", "smile", 0], sleepy: ["sleepy", "small", 0],
    surprised: ["big", "o", 0], silly: ["happy", "tongue", 0], love: ["heart", "smile", 1], starry: ["star", "smile", 1] }[style] || ["round", "smile", 1];
  const eyes = F[0] === "wink" ? dEye(80, "happy") + dEye(120, "round") : dEye(80, F[0]) + dEye(120, F[0]);
  return (F[2] ? dCheeks : "") + eyes + dMouth[F[1]];
}
function dHairSVG(style) {
  return {
    none: "",
    tuft: `<path d="M66 52 Q72 26 100 26 Q128 26 134 52 Q122 40 100 40 Q78 40 66 52 Z" fill="#7a4a24"/><path d="M95 28 Q104 16 113 30 Q104 27 95 28 Z" fill="#7a4a24"/>`,
    bob: `<path d="M40 100 Q36 38 100 34 Q164 38 160 100 Q158 72 138 60 Q120 52 100 52 Q80 52 62 60 Q42 72 40 100 Z" fill="#2b2b33"/>`,
    curls: `<g fill="#5a3318"><circle cx="74" cy="44" r="14"/><circle cx="100" cy="36" r="16"/><circle cx="126" cy="44" r="14"/><circle cx="58" cy="58" r="11"/><circle cx="142" cy="58" r="11"/></g>`,
    spiky: `<g fill="#d94f3a"><path d="M60 56 L70 22 L84 52 Z"/><path d="M84 52 L100 16 L116 52 Z"/><path d="M116 52 L130 22 L140 56 Z"/></g>`,
    pig: `<circle cx="42" cy="98" r="20" fill="#e8c45a"/><circle cx="158" cy="98" r="20" fill="#e8c45a"/><path d="M60 50 Q100 28 140 50 Q120 40 100 40 Q80 40 60 50 Z" fill="#e8c45a"/>`,
    mohawk: `<path d="M80 52 L88 22 L96 50 Z" fill="#4dabf7"/><path d="M92 50 L100 12 L108 50 Z" fill="#ff5d8f"/><path d="M104 50 L112 22 L120 52 Z" fill="#69db7c"/>`,
    long: `<path d="M44 60 Q36 142 54 216 Q48 150 62 96 Q52 70 44 60 Z" fill="#8a5a2b"/><path d="M156 60 Q164 142 146 216 Q152 150 138 96 Q148 70 156 60 Z" fill="#8a5a2b"/><path d="M46 58 Q100 30 154 58 Q150 44 100 40 Q50 44 46 58 Z" fill="#8a5a2b"/>`,
    ponytail: `<path d="M150 58 Q188 86 176 152 Q168 116 150 104 Q150 80 150 58 Z" fill="#6b3a1a"/><path d="M60 50 Q100 28 140 50 Q120 40 100 40 Q80 40 60 50 Z" fill="#6b3a1a"/><circle cx="150" cy="60" r="6" fill="#ff5d8f"/>`,
    braids: `<g fill="#5a3318"><circle cx="50" cy="104" r="11"/><circle cx="49" cy="124" r="10"/><circle cx="50" cy="142" r="9"/><circle cx="150" cy="104" r="11"/><circle cx="151" cy="124" r="10"/><circle cx="150" cy="142" r="9"/></g><path d="M60 50 Q100 30 140 50 Q120 40 100 40 Q80 40 60 50 Z" fill="#5a3318"/><circle cx="50" cy="92" r="5" fill="#ff5d8f"/><circle cx="150" cy="92" r="5" fill="#ff5d8f"/>`,
    buns: `<g fill="#8a5a2b"><circle cx="64" cy="36" r="15"/><circle cx="136" cy="36" r="15"/><path d="M60 56 Q100 34 140 56 Q120 44 100 44 Q80 44 60 56 Z"/></g><circle cx="64" cy="36" r="6" fill="#ff7eb0"/><circle cx="136" cy="36" r="6" fill="#ff7eb0"/>`
  }[style] || "";
}
function dHatSVG(style) {
  return {
    none: "",
    party: `<path d="M100 6 L80 50 L120 50 Z" fill="#ff5d8f"/><circle cx="100" cy="7" r="6" fill="#ffd23e"/><circle cx="94" cy="33" r="3" fill="#fff"/><circle cx="106" cy="42" r="3" fill="#fff"/>`,
    crown: `<path d="M68 50 L72 24 L86 40 L100 18 L114 40 L128 24 L132 50 Z" fill="#ffd23e" stroke="#e0a400" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="34" r="3.5" fill="#ff5d8f"/>`,
    bow: `<path d="M100 42 L76 28 Q72 42 76 56 Z" fill="#ff5d8f"/><path d="M100 42 L124 28 Q128 42 124 56 Z" fill="#ff5d8f"/><circle cx="100" cy="42" r="8" fill="#e63b6f"/>`,
    beanie: `<path d="M46 62 Q100 14 154 62 Z" fill="#4dabf7"/><rect x="44" y="55" width="112" height="13" rx="6.5" fill="#2f8fe0"/><circle cx="100" cy="14" r="7" fill="#dff0ff"/>`,
    cap: `<path d="M50 60 Q100 18 150 60 Z" fill="#69db7c"/><path d="M98 60 Q152 58 158 72 Q120 72 98 66 Z" fill="#46b85e"/><circle cx="100" cy="22" r="4" fill="#2f8f44"/>`,
    flower: `<g transform="translate(140,46)"><g fill="#ff7eb0"><circle cx="0" cy="-9" r="7"/><circle cx="9" cy="0" r="7"/><circle cx="0" cy="9" r="7"/><circle cx="-9" cy="0" r="7"/></g><circle r="6" fill="#ffd23e"/></g>`,
    tiara: `<path d="M62 52 Q100 22 138 52" fill="none" stroke="#ffd23e" stroke-width="5" stroke-linejoin="round"/><path d="M100 26 L107 43 L93 43 Z" fill="#ff5d8f" stroke="#e0a400" stroke-width="1.5"/><circle cx="76" cy="46" r="3.5" fill="#7ad3ff"/><circle cx="124" cy="46" r="3.5" fill="#7ad3ff"/>`,
    princess: `<path d="M100 0 L82 48 L118 48 Z" fill="#ff7eb0" stroke="#e63b6f" stroke-width="2"/><path d="M100 2 Q122 14 126 54 Q112 50 100 50 Z" fill="#ffd1e6" opacity=".85"/><circle cx="100" cy="2" r="5" fill="#ffd23e"/>`,
    flowercrown: `<path d="M58 54 Q100 36 142 54" stroke="#69c46a" stroke-width="4" fill="none"/><g transform="translate(66,48)"><g fill="#ff9ed1"><circle cx="0" cy="-6" r="5"/><circle cx="6" cy="0" r="5"/><circle cx="0" cy="6" r="5"/><circle cx="-6" cy="0" r="5"/></g><circle r="3.5" fill="#ffd23e"/></g><g transform="translate(100,42)"><g fill="#c77dff"><circle cx="0" cy="-6" r="5"/><circle cx="6" cy="0" r="5"/><circle cx="0" cy="6" r="5"/><circle cx="-6" cy="0" r="5"/></g><circle r="3.5" fill="#ffd23e"/></g><g transform="translate(134,48)"><g fill="#ff9ed1"><circle cx="0" cy="-6" r="5"/><circle cx="6" cy="0" r="5"/><circle cx="0" cy="6" r="5"/><circle cx="-6" cy="0" r="5"/></g><circle r="3.5" fill="#ffd23e"/></g>`
  }[style] || "";
}
function dGlassesSVG(style) {
  if (style === "round") return `<g fill="none" stroke="#333" stroke-width="3.5"><circle cx="80" cy="98" r="14"/><circle cx="120" cy="98" r="14"/><path d="M94 98 H106"/><path d="M66 95 L48 91"/><path d="M134 95 L152 91"/></g>`;
  if (style === "sun") return `<g><rect x="64" y="88" width="30" height="20" rx="9" fill="#222"/><rect x="106" y="88" width="30" height="20" rx="9" fill="#222"/><path d="M94 95 H106" stroke="#222" stroke-width="4"/><path d="M64 91 L48 87" stroke="#222" stroke-width="3.5"/><path d="M136 91 L152 87" stroke="#222" stroke-width="3.5"/><path d="M70 92 L78 92" stroke="#fff" stroke-width="2" opacity=".5"/></g>`;
  if (style === "star") return `<path d="${dStarPath(80, 98, 14)}" fill="#ffd23e" stroke="#e0a400" stroke-width="2"/><path d="${dStarPath(120, 98, 14)}" fill="#ffd23e" stroke="#e0a400" stroke-width="2"/>`;
  if (style === "heart") return `<path d="${dHeartPath(80, 99, 15)}" fill="none" stroke="#ff3b6f" stroke-width="3.5"/><path d="${dHeartPath(120, 99, 15)}" fill="none" stroke="#ff3b6f" stroke-width="3.5"/><path d="M95 98 H105" stroke="#ff3b6f" stroke-width="3"/>`;
  return "";
}
function dFriendSVG(emoji) {
  return emoji === "none" ? "" : `<text x="166" y="216" font-size="38" text-anchor="middle" dominant-baseline="middle">${emoji}</text>`;
}
const DRESS = {
  skin:    { tab: "🎨", word: "New color!", es: "¡Nuevo color!", type: "color",  opts: ["#ffdcb1", "#f1c084", "#e0a062", "#c6824a", "#9b5e2e", "#7ad3a0", "#b9c6ff", "#f3a6c9"] },
  face:    { tab: "😊", word: "Funny face!", es: "¡Cara graciosa!", type: "face",   opts: ["happy", "big", "wink", "sleepy", "surprised", "silly", "love", "starry"] },
  hair:    { tab: "💇", word: "New hair!",  es: "¡Nuevo pelo!", type: "hair",   opts: ["none", "tuft", "bob", "curls", "spiky", "pig", "mohawk", "long", "ponytail", "braids", "buns"] },
  hat:     { tab: "🎩", word: "Nice hat!",  es: "¡Bonito gorro!", type: "hat",    opts: ["none", "party", "crown", "bow", "beanie", "cap", "flower", "tiara", "princess", "flowercrown"] },
  glasses: { tab: "👓", word: "Cool glasses!", es: "¡Lentes geniales!", type: "glasses", opts: ["none", "round", "sun", "star", "heart"] },
  outfit:  { tab: "👕", word: "New shirt!", es: "¡Nueva camisa!", type: "color",  opts: ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#9775fa", "#f783ac", "#ffffff", "#ff8fc7", "#ffc0e0", "#c77dff", "#e63b8a"] },
  friend:  { tab: "🧸", word: "A friend!",  es: "¡Un amigo!", type: "friend", opts: ["none", "🧸", "🎈", "🌸", "🍦", "⭐", "🎁", "🐶", "🍭", "🎸", "🦄", "👸", "🧚", "🌈", "🦋", "💖", "🌺", "🐱"] }
};
const dressOrder = ["skin", "face", "hair", "hat", "glasses", "outfit", "friend"];
function dDollSVG(idx, popCat) {
  const P = c => (popCat === c ? " pop" : "");
  const skin = DRESS.skin.opts[idx.skin], outfit = DRESS.outfit.opts[idx.outfit];
  return `<svg class="dollsvg" viewBox="0 0 200 298" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="290" rx="48" ry="7" fill="rgba(0,0,0,.14)"/>
    <g class="L-outfit${P("outfit")}"><path d="M56 292 Q52 182 100 176 Q148 182 144 292 Z" fill="${outfit}" stroke="rgba(0,0,0,.14)" stroke-width="2"/><path d="M84 178 Q100 191 116 178" fill="none" stroke="rgba(0,0,0,.13)" stroke-width="3"/></g>
    <g class="L-skin${P("skin")}"><rect x="91" y="150" width="18" height="26" rx="9" fill="${skin}"/><circle cx="46" cy="98" r="12" fill="${skin}"/><circle cx="154" cy="98" r="12" fill="${skin}"/><ellipse cx="100" cy="96" rx="58" ry="60" fill="${skin}"/></g>
    <g class="L-hair${P("hair")}">${dHairSVG(DRESS.hair.opts[idx.hair])}</g>
    <g class="L-face${P("face")}">${dFaceSVG(DRESS.face.opts[idx.face])}</g>
    <g class="L-glasses${P("glasses")}">${dGlassesSVG(DRESS.glasses.opts[idx.glasses])}</g>
    <g class="L-hat${P("hat")}">${dHatSVG(DRESS.hat.opts[idx.hat])}</g>
    <g class="L-friend${P("friend")}">${dFriendSVG(DRESS.friend.opts[idx.friend])}</g>
  </svg>`;
}
function dSlotSVG(cat, opt, skin) {
  const part = cat === "face" ? dFaceSVG(opt) : cat === "hair" ? dHairSVG(opt) : cat === "hat" ? dHatSVG(opt) : cat === "glasses" ? dGlassesSVG(opt) : "";
  return `<svg viewBox="22 0 156 168" xmlns="http://www.w3.org/2000/svg"><circle cx="46" cy="98" r="12" fill="${skin}"/><circle cx="154" cy="98" r="12" fill="${skin}"/><ellipse cx="100" cy="96" rx="58" ry="60" fill="${skin}"/>${part}</svg>`;
}
function dFullBodySVG(idx) {
  const skin = DRESS.skin.opts[idx.skin], outfit = DRESS.outfit.opts[idx.outfit];
  return `<svg viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="392" rx="40" ry="6" fill="rgba(0,0,0,.1)"/>
    <path d="M60 280 L70 380 L90 380 L80 280 Z" fill="${skin}"/>
    <path d="M140 280 L130 380 L110 380 L120 280 Z" fill="${skin}"/>
    <ellipse cx="75" cy="328" rx="10" ry="7" fill="rgba(0,0,0,.07)"/>
    <ellipse cx="125" cy="328" rx="10" ry="7" fill="rgba(0,0,0,.07)"/>
    <path d="M75 380 L95 380 A5 5 0 0 1 95 390 L75 390 Z" fill="${skin}"/>
    <path d="M125 380 L105 380 A5 5 0 0 0 105 390 L125 390 Z" fill="${skin}"/>
    <circle cx="78" cy="384" r="3" fill="rgba(0,0,0,.12)"/><circle cx="83" cy="382" r="3" fill="rgba(0,0,0,.12)"/><circle cx="88" cy="382" r="2.5" fill="rgba(0,0,0,.12)"/><circle cx="93" cy="383" r="2.5" fill="rgba(0,0,0,.12)"/>
    <circle cx="122" cy="384" r="3" fill="rgba(0,0,0,.12)"/><circle cx="117" cy="382" r="3" fill="rgba(0,0,0,.12)"/><circle cx="112" cy="382" r="2.5" fill="rgba(0,0,0,.12)"/><circle cx="107" cy="383" r="2.5" fill="rgba(0,0,0,.12)"/>
    <path d="M56 195 Q30 238 20 270" stroke="${skin}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M144 195 Q170 238 180 270" stroke="${skin}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <circle cx="18" cy="278" r="16" fill="${skin}"/>
    <circle cx="182" cy="278" r="16" fill="${skin}"/>
    <g class="L-outfit"><path d="M56 292 Q52 182 100 176 Q148 182 144 292 Z" fill="${outfit}" stroke="rgba(0,0,0,.14)" stroke-width="2"/><path d="M84 178 Q100 191 116 178" fill="none" stroke="rgba(0,0,0,.13)" stroke-width="3"/></g>
    <g class="L-skin"><rect x="91" y="150" width="18" height="26" rx="9" fill="${skin}"/><circle cx="46" cy="98" r="12" fill="${skin}"/><circle cx="154" cy="98" r="12" fill="${skin}"/><ellipse cx="100" cy="96" rx="58" ry="60" fill="${skin}"/></g>
    <g class="L-hair">${dHairSVG(DRESS.hair.opts[idx.hair])}</g>
    <g class="L-face">${dFaceSVG(DRESS.face.opts[idx.face])}</g>
    <g class="L-glasses">${dGlassesSVG(DRESS.glasses.opts[idx.glasses])}</g>
    <g class="L-hat">${dHatSVG(DRESS.hat.opts[idx.hat])}</g>
  </svg>`;
}
const dressup = {
  idx: { skin: 0, face: 0, hair: 1, hat: 0, glasses: 0, outfit: 3, friend: 0 },
  cur: "skin",
  /* The 🌈 button used to cycle six flat fills. They are places now: the doll stands
     somewhere, and swapping the background is a thing worth pressing rather than a
     colour change. Each entry is a sky to sit behind one of the kit's biomes. */
  bgs: [
    { biome: "meadow",  sky: "linear-gradient(#bfe9ff,#d8f7c8)" },
    { biome: "reef",    sky: "linear-gradient(#8fd8ef,#3f9fbd)" },
    { biome: "snow",    sky: "linear-gradient(#dff1ff,#bcd9ef)" },
    { biome: "space",   sky: "linear-gradient(#2a2350,#4b3f8f)" },
    { biome: "forest",  sky: "linear-gradient(#cdeeff,#a9d99a)" },
    { biome: "cozy",    sky: "linear-gradient(#ffe9d2,#f6d3b0)" },
  ],
  bg: 0,
  show() {
    cleanupLevel();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    hideAllScreens();
    $("dressup").classList.remove("hidden");
    document.body.className = "theme-dressup";
    this.buildTabs();
    this.renderDoll();
    this.openTab(this.cur);
    speak(t("dressup_intro"));
  },
  renderDoll(popCat) {
    this.paintBg();
    $("dollWrap").innerHTML = dDollSVG(this.idx, popCat);
  },
  paintBg() {
    const place = this.bgs[this.bg], stage = $("dressStage");
    stage.style.background = place.sky;
    const old = stage.querySelector(".sc-scene");
    if (old) old.remove();
    // no frame: the closet tray is right below, and a foreground prop would crowd the doll
    stage.insertAdjacentHTML("afterbegin", scene.html(place.biome, {
      seed: 7 + this.bg * 5, layers: ["canopy", "far", "drift", "mid", "ground", "motes"],
    }));
  },
  buildTabs() {
    const tabs = $("closetTabs"); tabs.innerHTML = "";
    dressOrder.forEach(cat => {
      const b = document.createElement("button");
      b.className = "ctab" + (cat === this.cur ? " sel" : "");
      b.textContent = DRESS[cat].tab;
      b.onclick = () => { sfx.tap(); this.openTab(cat); };
      tabs.appendChild(b);
    });
  },
  openTab(cat) {
    this.cur = cat;
    document.querySelectorAll("#closetTabs .ctab").forEach((b, i) => b.classList.toggle("sel", dressOrder[i] === cat));
    const def = DRESS[cat], tray = $("closetTray"); tray.innerHTML = "";
    def.opts.forEach((opt, i) => {
      const s = document.createElement("button");
      s.className = "cslot" + (i === this.idx[cat] ? " sel" : "");
      if (def.type === "color") { s.style.background = opt; if (opt === "#ffffff") s.style.boxShadow = "inset 0 0 0 2px #cfd4df, 0 4px 0 rgba(0,0,0,.16)"; }
      else if (def.type === "friend") { if (opt === "none") { s.classList.add("none-slot"); s.textContent = t("off_slot"); } else s.textContent = opt; }
      else if (opt === "none") { s.classList.add("none-slot"); s.textContent = t("off_slot"); }       // hair/hat/glasses removable
      else s.innerHTML = dSlotSVG(cat, opt, DRESS.skin.opts[this.idx.skin]);
      s.onclick = () => this.pick(cat, i);
      tray.appendChild(s);
    });
  },
  pick(cat, i) {
    this.idx[cat] = i;
    document.querySelectorAll("#closetTray .cslot").forEach((x, j) => x.classList.toggle("sel", j === i));
    sfx.tap();
    this.renderDoll(cat);
    const w = $("dollWrap"); w.classList.remove("snap"); void w.offsetWidth; w.classList.add("snap");   // happy wiggle
    const c = centerOf(w); floaters(["✨", "💫"], c.x, c.y, 4);
    speak(curLang() === "es" ? DRESS[cat].es : DRESS[cat].word);
  },
  cycleBg() { this.bg = (this.bg + 1) % this.bgs.length; sfx.tick(); this.paintBg(); },
  shuffle() {
    dressOrder.forEach(cat => this.idx[cat] = Math.floor(Math.random() * DRESS[cat].opts.length));
    this.bg = Math.floor(Math.random() * this.bgs.length);
    sfx.good(); this.renderDoll(); this.openTab(this.cur);
    const w = $("dollWrap"); w.classList.remove("snap"); void w.offsetWidth; w.classList.add("snap");
    floaters(["✨", "🌟", "💫"], innerWidth / 2, innerHeight / 2.5, 9);
  },
  done() { speak(t("cool_look") + " " + praise()); celebrateWith("dressup", { noLevelUp: true }); }
};

registerGame({
  id: "dressup", world: "create", icon: "👗", name: "Dress Up", es: "Vestir", yue: "換衫",
  lvl: 0, cue: "chime"
});
