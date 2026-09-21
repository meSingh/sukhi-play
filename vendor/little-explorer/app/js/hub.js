"use strict";
const APP_VERSION = "53";
/* ================= Worlds, games and levels =================
   None of this is written out by hand any more. Every game declares itself in its
   own file with registerGame() (see core.js), and every js/games/* script loads
   before this one, so by the time hub.js runs the registry holds all of them.

   A world declares only its identity and colour here. Which games it holds — and
   the order she walks them — comes from registration order, so shipping a game
   means appending one <script> tag and one registerGame() call, and it arrives at
   the far end of its world's trail with no list here to keep in step. */
const WORLDS = [
  { id: "num",    icon: "🔢", name: "Numbers",         es: "Números",           yue: "數字",       cls: "c-num" },
  { id: "shape",  icon: "🎨", name: "Colors & Shapes", es: "Colores y Figuras", yue: "顏色同形狀", cls: "c-shape" },
  { id: "brain",  icon: "🧩", name: "Brain Games",     es: "Juegos de Mente",   yue: "動腦遊戲",   cls: "c-brain" },
  { id: "animal", icon: "🐾", name: "Animals",         es: "Animales",          yue: "動物",       cls: "c-animal" },
  { id: "pets",   icon: "🐶", name: "Pets",            es: "Mascotas",          yue: "寵物",       cls: "c-pets" },
  { id: "create", icon: "✏️", name: "Create",          es: "Crear",             yue: "創作",       cls: "c-create" }
];

// id → the level object that runs its rounds. The three specials have no entry.
const LEVELS = {};
// id → what the map and trail draw: { icon, name, es, yue, lvl, v? }.
// lvl: difficulty rating (0 = easy/ages 2-3, 1 = medium/3-4, 2 = hard/4-5) — used to
// hide games above the chosen level. v: the APP_VERSION it shipped in (New! flag).
const GAMES = {};
const CATEGORIES = WORLDS.map(w => ({ ...w, games: [] }));
(() => {
  const world = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  for (const { id, world: w, level, ...meta } of GAME_REGISTRY) {
    if (!world[w]) throw new Error(`registerGame(${id}): unknown world "${w}"`);
    GAMES[id] = meta;
    if (level) LEVELS[id] = level;
    world[w].games.push(id);
  }
})();

// chosen difficulty → max game level shown (auto/hard show everything)
const diffLevel = () => settings.diff === "easy" ? 0 : settings.diff === "med" ? 1 : 2;
const gameVisible = gid => (GAMES[gid].lvl || 0) <= diffLevel();
const visibleGames = cat => cat.games.filter(gameVisible);

/* ================= World map layout =================
   Every world has a FIXED home on the map so she can find it by place, not by reading.
   Coordinates are percentages of the map, tuned per orientation:
     p = portrait (the phone, our primary surface), l = landscape / tablet.
   Both sets are ordered so the dashed trail joining them never crosses itself.
   `land` paints the island under the disc; `deco` scatters scenery around it.
   A world with no entry here still renders — it falls back to defaultSlot(). */
const HUB_LAYOUT = {
  num:    { p: [26, 18], l: [20, 30], land: "#cfe8ff", deco: [["🏔️", -.72, -.42], ["❄️", .68, .5]] },
  shape:  { p: [72, 28], l: [50, 26], land: "#ffd7a0", deco: [["🌴", .7, -.44], ["🐚", -.68, .5]] },
  brain:  { p: [27, 44], l: [80, 32], land: "#b6e5a2", deco: [["🌲", -.72, -.42], ["🍄", .68, .5]] },
  animal: { p: [73, 55], l: [78, 70], land: "#f2dd93", deco: [["🌾", .7, -.44], ["🪨", -.68, .5]] },
  pets:   { p: [30, 70], l: [50, 70], land: "#ffc6b0", deco: [["🏡", -.72, -.42], ["🦴", .68, .5]] },
  create: { p: [72, 79], l: [22, 70], land: "#e6cdf7", deco: [["🌸", .7, -.44], ["🌈", -.68, .5]] }
};
// Island radii, in map-%. Sized per orientation to stay clear of each other while still
// holding the whole disc + label + stars: the coord grids are spaced differently in each.
const ISLAND = { p: { rx: 17, ry: 10.5 }, l: { rx: 13, ry: 15 } };
// Wide screens get a 3-across snake; tall ones a 2-across zigzag.
const hubLayoutMode = () => (innerWidth / innerHeight > 1.15 ? "l" : "p");
// Fallback placement for a world that predates / postdates HUB_LAYOUT, so adding a
// category to CATEGORIES can never leave a disc stacked at 0,0.
function defaultSlot(i, n, mode) {
  const perRow = mode === "l" ? 3 : 2;
  const rows = Math.max(1, Math.ceil(n / perRow));
  const row = Math.floor(i / perRow);
  let col = i % perRow;
  if (row % 2) col = perRow - 1 - col;                       // snake back along odd rows
  const x = (100 / (perRow + 1)) * (col + 1);
  const y = rows === 1 ? 50 : 20 + row * (58 / (rows - 1));
  return [x, y];
}
const hubSlot = (cat, i, n, mode) => (HUB_LAYOUT[cat.id] || {})[mode] || defaultSlot(i, n, mode);

/* ── Progress stars ──
   Milestones on how many DIFFERENT games she has tried in a world. Deliberately an
   absolute count and never a fraction: shipping a new game into a world must never
   take a star away from her (the old rounded-average did exactly that). */
const WORLD_STAR_STEPS = [1, 2, 3];
const worldStars = games =>
  WORLD_STAR_STEPS.filter(step => games.filter(gid => (completions[gid] || 0) > 0).length >= step).length;

/* ── "New!" beacon ──
   A game stays new for the release it shipped in plus the next one, and only until she
   has played it. Tag a new game with `v: <APP_VERSION>` in GAMES and it expires by
   itself on a later version bump — nothing to remember to switch off. */
const NEW_FOR_VERSIONS = 2;
const isNewGame = gid => (GAMES[gid].v || 0) > +APP_VERSION - NEW_FOR_VERSIONS && !(completions[gid] > 0);
const newWorld = () => CATEGORIES.find(cat => visibleGames(cat).some(isNewGame));

/* ── Narrator speech bubble ── */
let _narratorTimer = null;
function narratorSay(line) {
  const el = $("buddySpeech"); if (!el) return;
  if (_narratorTimer) { clearTimeout(_narratorTimer); _narratorTimer = null; }
  el.textContent = line;
  el.classList.remove("hidden", "narrator-out");
  void el.offsetWidth;
  speak(line);
  _narratorTimer = setTimeout(() => {
    el.classList.add("narrator-out");
    setTimeout(() => el.classList.add("hidden"), 380);
  }, 4200);
}
function hubGreeting() {
  const last = localStorage.getItem("fionaLastGame");
  localStorage.removeItem("fionaLastGame");
  // An unplayed new game is worth pointing at every time she passes through — the
  // line stops by itself the moment she plays it.
  const fresh = newWorld();
  if (fresh) return t("narrator_new_world", { w: locName(fresh) });
  if (last) return t("narrator_postgame");
  return rand([t("narrator_back"), t("narrator_ready")]);
}

function startGameNow(id) {
  if (id === "paint") paint.show();
  else if (id === "story") showStory();
  else if (id === "dressup") dressup.show();
  else startLevel(id);
}
// The "New!" pennant that plants itself above a disc. Empty string when nothing is new.
const newFlag = show => (show ? `<span class="node-new">${t("new_badge")}</span>` : "");

/* ── Sea life ──
   Drifts across the map and boings when tapped. Purely decorative and never a
   target that matters — the hub twin of the world trail's wandering props, so the
   map is as alive to poke at as the inside of a world. Rendered behind the world
   discs (z-index), so a whale can pass an island without ever stealing her tap. */
const MAP_PROPS = ["🐟", "⛵", "🐳", "🐦"];
const ISLAND_SCATTER = 8;      // seeded scenery slots per island, on top of its anchors
function paintMapProps(pos, rx, ry) {
  const wrap = $("mapProps");
  const mw = $("map").clientWidth || innerWidth;
  const drift = 96 / mw * 100;              // the distance @keyframes mapWander travels
  // Sea life belongs in the sea. A spot only counts if the prop clears every island
  // at BOTH ends of its drift — a fish parked on a snow mountain reads as a bug, not
  // as scenery. The 1.18 pads the island out past its white surf ring.
  const atSea = (x, y) => pos.every(([ix, iy]) =>
    Math.hypot((x - ix) / (rx * 1.18), (y - iy) / (ry * 1.18)) >= 1 &&
    Math.hypot((x + drift - ix) / (rx * 1.18), (y - iy) / (ry * 1.18)) >= 1);
  const spots = [];
  for (let y = 10; y <= 90; y += 5)
    for (let x = 4; x <= 86; x += 5) if (atSea(x, y)) spots.push([x, y]);
  if (!spots.length) { wrap.innerHTML = ""; return; }   // no open water: skip them entirely
  wrap.innerHTML = MAP_PROPS.map((e, i) => {
    const [x, y] = spots[Math.floor(i * spots.length / MAP_PROPS.length)];
    return `<button class="map-prop" style="left:${x}%; top:${y}%;
             animation-duration:${11 + i * 4}s; animation-delay:-${i * 3.5}s"
             aria-hidden="true" tabindex="-1">${e}</button>`;
  }).join("");
  wrap.querySelectorAll(".map-prop").forEach(el => {
    el.onclick = ev => {
      ev.stopPropagation();
      el.classList.remove("boing"); void el.offsetWidth; el.classList.add("boing");
      tone(520 + Math.random() * 320, 0, .16, "triangle", .1);
      floaters(["✨"], ev.clientX, ev.clientY, 3);
    };
  });
}

/* What a placed world node actually occupies, measured from the live DOM rather than
   re-derived from the CSS clamps. Offsets are px from the node's anchor point, which
   is its centre — the disc sits above it, the label and stars below.

   offsetWidth/offsetTop, NOT getBoundingClientRect: a node is measured the instant it
   is appended, while its worldPop keyframe still holds it at scale(.3), and the rect
   would report a third-size disc. Offsets are untransformed layout (see CLAUDE.md). */
function nodeZone(wrap) {
  const nodes = [...wrap.children];
  if (!nodes.length) return { discR: 0, discDy: 0, labelW: 0, labelTop: 0 };
  // One zone covering every world, not just the first: "Colors & Shapes" is far wider
  // than "Pets", and a label that wraps to two lines starts higher.
  let discR = 0, discDy = 0, labelW = 0, labelTop = Infinity;
  nodes.forEach(node => {
    const cy = node.offsetHeight / 2;
    const d = node.querySelector(".node-disc"), l = node.querySelector(".node-label");
    discR = Math.max(discR, d.offsetWidth / 2);
    discDy = d.offsetTop + d.offsetHeight / 2 - cy;   // uniform: .node-stars reserves min-height
    labelW = Math.max(labelW, l.offsetWidth);
    labelTop = Math.min(labelTop, l.offsetTop - cy);
  });
  return { discR, discDy, labelW: Math.max(labelW, discR * 2), labelTop };
}

let hubMode = null;   // layout mode the map is currently drawn for
function buildHub() {
  const mode = hubMode = hubLayoutMode();
  const worlds = CATEGORIES.filter(cat => visibleGames(cat).length);
  const pos = worlds.map((cat, i) => hubSlot(cat, i, worlds.length, mode));

  // islands under the discs, each ringed by a paler surf line
  const { rx, ry } = ISLAND[mode];
  $("mapRegions").innerHTML = worlds.map((cat, i) => {
    const [x, y] = pos[i], land = (HUB_LAYOUT[cat.id] || {}).land || "#cfe8ff";
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" fill-opacity=".4"/>
            <ellipse cx="${x}" cy="${y}" rx="${rx - 2.4}" ry="${ry - 1.5}" fill="${land}" fill-opacity=".95"/>`;
  }).join("");

  // The causeway joining every world, in map order. Drawn the same way the world
  // trail draws its road — cream over a soft dark edge, with stepping stones — so
  // the route between worlds and the route inside one are visibly the same road.
  const pts = pos.map(([x, y]) => `${x},${y}`).join(" ");
  $("mapPath").setAttribute("points", pts);
  $("mapEdge").setAttribute("points", pts);
  let dots = "";
  for (let i = 0; i < pos.length - 1; i++)
    for (let s = 1; s <= 3; s++) {
      const k = s / 4;
      const x = pos[i][0] + (pos[i + 1][0] - pos[i][0]) * k;
      const y = pos[i][1] + (pos[i + 1][1] - pos[i][1]) * k;
      dots += `<i style="left:${x.toFixed(2)}%; top:${y.toFixed(2)}%"></i>`;
    }
  $("mapDots").innerHTML = dots;

  const wrap = $("mapNodes"); wrap.className = "worlds"; wrap.innerHTML = "";
  worlds.forEach((cat, i) => {
    const games = visibleGames(cat);
    const [x, y] = pos[i];
    const b = document.createElement("button");
    b.className = "node";
    b.style.left = x + "%"; b.style.top = y + "%";
    b.innerHTML = `${newFlag(games.some(isNewGame))}
                   <div class="node-disc ${cat.cls}"><span>${cat.icon}</span></div>
                   <div class="node-label">${locName(cat)}</div>
                   <div class="node-stars">${"⭐".repeat(worldStars(games))}</div>`;
    b.onclick = () => { sfx.tap(); openCategory(cat.id); };
    wrap.appendChild(b);
  });
  // Scenery around each island: the hand-tuned HUB_LAYOUT anchors, plus a seeded
  // scatter drawn from the SAME plants the world is planted with inside
  // (TRAIL_SCENE.fixed), so an island reads as a small view of the place it opens
  // into instead of two lonely emoji. Seeded, so it lands identically every repaint.
  //
  // Placed AFTER the nodes, because the exclusion zone has to be measured rather than
  // assumed: a .node is a flex column, so its disc floats ABOVE the node's anchor
  // point with the label and stars hanging below it. Clearance computed from the
  // anchor put trees on the disc on every landscape viewport.
  const deco = (e, x, y, sc) =>
    `<span style="left:${x.toFixed(2)}%; top:${y.toFixed(2)}%;` +
    ` transform:translate(-50%,-50%) scale(${sc.toFixed(2)})">${e}</span>`;
  const mw = $("map").clientWidth || innerWidth, mh = $("map").clientHeight || innerHeight;
  const zone = nodeZone(wrap);
  const decoPx = clamp(15, Math.min(innerWidth, innerHeight) * .034, 30);
  // Island radii are map-percentages but the disc is sized in pixels, so candidates
  // are tested in pixels, offset from the node anchor the same way the disc is.
  const free = (dx, dy) => {
    const px = dx / 100 * mw, py = dy / 100 * mh;
    if (Math.hypot(px, py - zone.discDy) < zone.discR + decoPx * .8) return false;
    return !(Math.abs(px) < zone.labelW / 2 + decoPx * .6 && py > zone.labelTop - decoPx * .6);
  };
  $("mapDeco").innerHTML = worlds.map((cat, i) => {
    const [x, y] = pos[i];
    const anchors = (HUB_LAYOUT[cat.id] || {}).deco || [];
    let html = anchors.filter(([, fx, fy]) => free(fx * rx, fy * ry))
                      .map(([e, fx, fy]) => deco(e, x + fx * rx, y + fy * ry, 1)).join("");
    const pool = ((typeof TRAIL_SCENE !== "undefined" && TRAIL_SCENE[cat.id]) || {}).fixed
              || anchors.map(d => d[0]);
    // Rejection sampling: try a few seeded spots per slot and keep the first that
    // clears the disc and the label. A slot that never finds room just stays empty —
    // on a small phone the disc fills its island, and that is the correct answer.
    for (let k = 0; k < ISLAND_SCATTER && pool.length; k++)
      for (let t = 0; t < 6; t++) {
        const n = (i * ISLAND_SCATTER + k) * 6 + t;
        const a = seeded(n + 3) * Math.PI * 2, r = .5 + seeded(n + 29) * .48;
        const dx = Math.cos(a) * rx * r, dy = Math.sin(a) * ry * r;
        if (!free(dx, dy)) continue;
        html += deco(pool[Math.floor(seeded(n + 61) * pool.length)], x + dx, y + dy,
                     .7 + seeded(n + 97) * .5);
        break;
      }
    return html;
  }).join("");
  paintMapProps(pos, rx, ry);
  renderQuest();
}
// Percentage coords follow a resize on their own; only a portrait/landscape flip
// needs a redraw, so the discs never re-pop while a desktop window is being dragged.
addEventListener("resize", () => {
  if ($("hub").classList.contains("hidden") || hubLayoutMode() === hubMode) return;
  buildHub();
});
function openCategory(id) {
  audio();
  const cat = CATEGORIES.find(c => c.id === id);
  hideAllScreens();
  $("games").classList.remove("hidden");
  animScreen("games", "fwd");
  document.body.className = "";
  $("gamesTitle").textContent = `${cat.icon} ${locName(cat)}`;
  worldTrail.open(cat);
}

/* ================= Sticker book ================= */
const SCENES = [
  { id: "park",   name: "Park 🌳",   es: "Parque 🌳",   yue: "公園 🌳",   cls: "sc-park",   deco: "🌳 🛝 🌷 🌳 ⛲" },
  { id: "space",  name: "Space 🚀",  es: "Espacio 🚀",  yue: "太空 🚀",   cls: "sc-space",  deco: "🌑 🪐 ⭐ 🌙 ⭐" },
  { id: "ocean",  name: "Ocean 🌊",  es: "Océano 🌊",  yue: "海洋 🌊",   cls: "sc-ocean",  deco: "🐚 🪸 🌊 🐚 🌊" },
  { id: "castle", name: "Castle 🏰", es: "Castillo 🏰", yue: "城堡 🏰",   cls: "sc-castle", deco: "🌸 🏰 🌳 🌸" },
  { id: "bed",    name: "Cozy 🌙",   es: "Acogedor 🌙", yue: "舒適窩 🌙", cls: "sc-bed",    deco: "🛏️ 🧸 🪟 🌙" }
];
let decor = JSON.parse(localStorage.getItem("fionaDecor") || "{}");
let curScene = localStorage.getItem("fionaScene") || "park";
let palSel = null;
const saveDecor = () => localStorage.setItem("fionaDecor", JSON.stringify(decor));

function showStickerBook() {
  cleanupLevel();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  document.body.className = "";
  hideAllScreens();
  $("stickerbook").classList.remove("hidden");
  // scene buttons
  const sb = $("sceneBtns"); sb.innerHTML = "";
  SCENES.forEach(sc => {
    const b = document.createElement("button");
    b.className = "scene-btn" + (sc.id === curScene ? " sel" : "");
    b.textContent = locName(sc);
    b.onclick = () => { curScene = sc.id; localStorage.setItem("fionaScene", curScene); palSel = null; showStickerBook(); };
    sb.appendChild(b);
  });
  renderScene();
  // palette of earned sticker types
  const earned = [...new Set(stickers.map(s => s.e))];
  const pal = $("stickerPalette"); pal.innerHTML = "";
  if (!earned.length) {
    $("stickerHint").textContent = t("sticker_empty_hint");
    speak(t("sticker_empty_say"));
    return;
  }
  $("stickerHint").textContent = t("sticker_hint");
  speak(t("sticker_intro"));
  earned.forEach(e => {
    const b = document.createElement("button");
    b.className = "pal-item" + (e === palSel ? " sel" : "");
    b.textContent = e;
    b.onclick = () => { palSel = (palSel === e ? null : e); sfx.tick(); document.querySelectorAll(".pal-item").forEach(x => x.classList.toggle("sel", x.textContent === palSel)); };
    pal.appendChild(b);
  });
}
function renderScene() {
  const sc = SCENES.find(s => s.id === curScene) || SCENES[0];
  const scene = $("stickerScene");
  scene.className = sc.cls;
  scene.innerHTML = `<div class="scene-deco">${sc.deco}</div>`;
  scene.onpointerdown = e => {
    if (!palSel || e.target !== scene && e.target.className !== "scene-deco") return;
    const r = scene.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    (decor[curScene] = decor[curScene] || []).push({ e: palSel, x, y });
    saveDecor(); sfx.tap();
    const d = STICKER_DATA[palSel];
    if (d && d.h === curScene) {
      confetti();
      speak(t("sticker_belongs", { x: theWord(d.n), scene: locName(SCENES.find(s => s.id === curScene)) }));
    }
    addPlaced({ e: palSel, x, y }, decor[curScene].length - 1);
  };
  (decor[curScene] || []).forEach((d, i) => addPlaced(d, i));
}
function addPlaced(d, idx) {
  const scene = $("stickerScene");
  const el = document.createElement("div");
  el.className = "sticker"; el.textContent = d.e;
  el.style.left = d.x + "%"; el.style.top = d.y + "%";
  el.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    el.classList.remove("settle"); el.classList.add("lifted");   // pick it up: enlarge, tilt, cast shadow
    sfx.tick();
    let moved = false; const sx = e.clientX, sy = e.clientY;
    const pct = ev => { const r = scene.getBoundingClientRect(); return { x: clamp((ev.clientX - r.left) / r.width * 100, 1, 99), y: clamp((ev.clientY - r.top) / r.height * 100, 1, 99) }; };
    const move = ev => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
      const q = pct(ev); el.style.left = q.x + "%"; el.style.top = q.y + "%";
      d.x = q.x; d.y = q.y;
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
      el.classList.remove("lifted"); el.classList.add("settle");   // drop it: physical settlement bounce
      el.addEventListener("animationend", () => el.classList.remove("settle"), { once: true });
      sfx.tap(); saveDecor();
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  });
  scene.appendChild(el);
}

/* ================= Settings ================= */
function openSettings() {
  $("charscreen").classList.add("hidden"); $("namescreen").classList.add("hidden");
  $("settings").classList.remove("hidden");
  applyI18n($("settings"));
  document.querySelectorAll("#segLang button").forEach(b => b.classList.toggle("sel", b.dataset.l === (settings.lang || "en")));
  document.querySelectorAll("#segDiff button").forEach(b => b.classList.toggle("sel", b.dataset.d === settings.diff));
  document.querySelectorAll("#segVoice button").forEach(b => b.classList.toggle("sel", String(settings.voice) === b.dataset.v));
  document.querySelectorAll("#segMusic button").forEach(b => b.classList.toggle("sel", b.dataset.m === settings.music));
  const vEl = $("settingsVersion"); if (vEl) vEl.textContent = "v" + APP_VERSION;
}
function showCharScreen(returnTo) {
  hideAllScreens();
  applyI18n($("charscreen"));
  $("charscreen").classList.remove("hidden");
  $("charDone").dataset.return = returnTo || "hub";
  const grid = $("charGrid"); grid.innerHTML = "";
  BUDDIES.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "char-btn" + (b.id === BUDDY ? " sel" : "");
    btn.innerHTML = `<span class="ch-e">${b.e}</span><span class="ch-n">${locName(b)}</span>`;
    btn.onclick = () => {
      BUDDY = b.id; localStorage.setItem("fionaBuddy", BUDDY); localStorage.setItem("fionaBuddySet", "1");
      refreshBuddies(); sfx.tap(); speak(locName(b) + "!");
      grid.querySelectorAll(".char-btn").forEach(x => x.classList.remove("sel")); btn.classList.add("sel");
      clearTimeout(charTimer);                       // tapping a buddy auto-advances (no need to find the button)
      charTimer = setTimeout(() => { $("charDone").dataset.return === "settings" ? openSettings() : showHub(); }, 800);
    };
    grid.appendChild(btn);
  });
}
function showDiffScreen() {
  hideAllScreens();
  $("diffMascot").innerHTML = buddyMarkup();
  applyI18n($("diffscreen"));
  $("diffscreen").classList.remove("hidden");
  speak(t("diff_say"));
}
// first-run chain: name → difficulty → buddy → hub (each step only if not already set)
function proceedAfterName() {
  if (!localStorage.getItem("fionaDiffSet")) showDiffScreen();
  else if (!localStorage.getItem("fionaBuddySet")) showCharScreen("hub");
  else showHub();
}

/* ================= Navigation ================= */
const ALL_SCREENS = ["hub", "games", "game", "stickerbook", "story", "paint", "dressup", "dashboard", "namescreen", "charscreen", "diffscreen", "settings", "celebrate"];
function hideAllScreens() {
  if (typeof worldTrail !== "undefined") worldTrail.stop();
  ALL_SCREENS.forEach(id => { const e = $(id); if (e) e.classList.add("hidden"); });
  playWipe();
}
function playWipe() { const w = $("wipe"); if (!w) return; w.classList.remove("run"); void w.offsetWidth; w.classList.add("run"); }
// contextual screen entrance: "fwd" (drill in) or "back" (go home); falls back to default screenIn
function animScreen(id, cls) { const el = $(id); if (!el) return; el.classList.remove("fwd", "back"); void el.offsetWidth; el.classList.add(cls); }
function showHub() {
  cleanupLevel();
  worldParty.stop();                      // leaving mid-party ends it; nothing is held against her
  ambience.start("reef");                 // the hub is an open sea — it gets a bed too
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  setMascots("talking", false);
  document.body.className = "";
  hideAllScreens();
  $("hub").classList.remove("hidden");
  animScreen("hub", "back");
  applyName();
  buildHub();
  if (!questGreeted && settings.voice) { questGreeted = true; core.wait(questIntro, 800); }
  else core.wait(() => narratorSay(hubGreeting()), 700);
}
function startLevel(name) {
  audio(); cleanupLevel();
  state.level = name; state.round = 0; state.busy = false; state.tier = tierFor(name);
  roundMistakes = 0;
  document.body.className = LEVELS[name].theme;
  // the world's sound bed, from the same biome its scenery uses
  ambience.start(scene.forLevel(name));
  hideAllScreens();
  $("game").classList.remove("hidden");
  animScreen("game", "fwd");
  drawProgress();
  LEVELS[name].startRound();
}
function showDashboard() {
  cleanupLevel();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  document.body.className = "";
  hideAllScreens();
  applyI18n($("dashboard"));
  $("dashboard").classList.remove("hidden");
  const plays = id => completions[id] || 0;
  const totalPlays = Object.values(completions).reduce((a, b) => a + b, 0);
  const totalStars = Object.keys(completions).reduce((a, k) => a + Math.min(3, completions[k]), 0);
  const gamesTried = Object.keys(completions).filter(k => completions[k] > 0).length;
  $("dashStats").innerHTML =
    `<div class="stat"><div class="sv">⭐ ${totalStars}</div><div class="sl">${t("dash_stars")}</div></div>
     <div class="stat"><div class="sv">🎮 ${totalPlays}</div><div class="sl">${t("dash_played")}</div></div>
     <div class="stat"><div class="sv">📒 ${stickers.length}</div><div class="sl">${t("dash_stickers")}</div></div>
     <div class="stat"><div class="sv">🗂️ ${gamesTried}/${Object.keys(GAMES).length}</div><div class="sl">${t("dash_tried")}</div></div>
     <div class="stat"><div class="sv">🚀 ${trips}</div><div class="sl">${t("dash_trips")}</div></div>
     <div class="stat"><div class="sv">⚡ ${sparks}/${QUEST_GOAL}</div><div class="sl">${t("dash_sparks")}</div></div>`;
  const list = $("dashList"); list.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const rows = cat.games.map(gid => {
      const g = GAMES[gid], p = plays(gid);
      return `<div class="dash-row"><span class="dg">${g.icon} ${locName(g)}</span>
              <span class="dp">${p ? "⭐".repeat(Math.min(3, p)) + (p > 3 ? ` ×${p}` : "") : "—"}</span></div>`;
    }).join("");
    list.innerHTML += `<div class="dash-cat"><h3>${cat.icon} ${locName(cat)}</h3>${rows}</div>`;
  });
}

/* ================= Boot ================= */
refreshBuddies();
buildHub();
document.addEventListener("contextmenu", e => e.preventDefault());   // no right-click / long-press menus for little hands
$("homeBtn").onclick = showHub;
$("gamesHome").onclick = showHub;
$("celebHome").onclick = showHub;
$("celebBook").onclick = showStickerBook;
$("celebLaunch").onclick = rocketLaunch;
$("questBar").onclick = () => { sfx.tap(); questSpeak(); };
$("bookBtn").onclick = () => { audio(); showStickerBook(); };
$("bookHome").onclick = showHub;
$("musicBtn").onclick = toggleMusic;
$("speakBtn").onclick = () => speak($("instruction").dataset.spoken || $("instruction").textContent);
/* ── Parent gate ──
   Core Bar: "settings + destructive actions are gated (long-press + a simple parent
   check), never one child tap." The ⚙️ sits on the hub next to the games, so a tap
   used to open it and two more taps could wipe every star she owns.

   Layer 1 — the ⚙️ must be HELD. A tap does nothing but say so, which is also how a
   grown-up discovers the gesture. Layer 2 — the destructive pair asks an arithmetic
   question a pre-reader cannot answer. */
const SETTINGS_HOLD_MS = 800;
let holdTimer = null;
function beginSettingsHold(ev) {
  ev.preventDefault();
  const btn = $("settingsBtn");
  btn.classList.add("holding");
  holdTimer = setTimeout(() => { holdTimer = null; btn.classList.remove("holding"); sfx.tap(); openSettings(); },
                         SETTINGS_HOLD_MS);
}
function cancelSettingsHold() {
  const btn = $("settingsBtn");
  btn.classList.remove("holding");
  if (holdTimer === null) return;                 // already opened; nothing to cancel
  clearTimeout(holdTimer); holdTimer = null;
  narratorSay(t("settings_hold_hint"));           // a tap teaches the gesture instead of failing silently
}
$("settingsBtn").addEventListener("pointerdown", beginSettingsHold);
$("settingsBtn").addEventListener("pointerup", cancelSettingsHold);
$("settingsBtn").addEventListener("pointerleave", cancelSettingsHold);
$("settingsBtn").addEventListener("pointercancel", cancelSettingsHold);

// A simple arithmetic check. Deliberately not a puzzle — it only has to be beyond a
// 2-5 year old, and instant for the adult holding the phone.
function parentGate() {
  const a = 3 + Math.floor(Math.random() * 7), b = 4 + Math.floor(Math.random() * 6);
  const answer = prompt(t("parent_gate", { a, b }));
  if (answer === null) return false;
  return parseInt(String(answer).trim(), 10) === a + b;
}

$("setDone").onclick = () => { $("settings").classList.add("hidden"); buildHub(); };   // rebuild hub so a difficulty change re-filters games
$("setReset").onclick = () => {
  if (!parentGate()) return;
  if (confirm(t("settings_reset_confirm"))) {
    for (const k in completions) delete completions[k];
    stickers.length = 0; sparks = 0; trips = 0; questShown = 0;
    localStorage.removeItem("fionaTrail");        // send the buddy back to each trailhead too
    saveCompletions(); saveStickers(); saveQuest(); buildHub();
  }
};
$("setRestart").onclick = () => {
  if (!parentGate()) return;
  if (confirm(t("settings_restart_confirm"))) { localStorage.clear(); location.reload(); }
};
$("setName").onclick = () => { $("settings").classList.add("hidden"); showNameScreen(NAME); };
function promptInstallCanto() {
  const ua = navigator.userAgent || "";
  const how = /iPhone|iPad|iPod|Macintosh/.test(ua)
      ? "Settings → Accessibility → Spoken Content → Voices → Chinese → Cantonese (Hong Kong)"
    : /Android/.test(ua)
      ? "Settings → System → Languages → Text-to-speech output → Google Text-to-Speech → install Chinese (Hong Kong) / 粵語 voice data"
      : "your device's Text-to-Speech settings → add a Chinese (Hong Kong) / Cantonese voice";
  alert("廣東話 — Cantonese voice not found on this device.\n\nTo hear Cantonese, install a Cantonese voice:\n" + how + "\n\nUntil then the games stay in English. Reopen the app after installing.");
}
document.querySelectorAll("#segLang button").forEach(b => b.onclick = () => {
  settings.lang = b.dataset.l; saveSettings();
  if (b.dataset.l === "yue") { detectCantoVoice(); if (!cantoVoiceReady) promptInstallCanto(); }
  document.documentElement.lang = htmlLang();
  sfx.tap(); openSettings();
});
document.querySelectorAll("#segDiff button").forEach(b => b.onclick = () => { settings.diff = b.dataset.d; saveSettings(); openSettings(); });
document.querySelectorAll("#segVoice button").forEach(b => b.onclick = () => { settings.voice = +b.dataset.v; saveSettings(); openSettings(); });
document.querySelectorAll("#segMusic button").forEach(b => b.onclick = () => {
  settings.music = b.dataset.m; saveSettings();
  if (settings.music === "off") { stopMusic(); applyMusicSetting(); }
  else { stopMusic(); startMusic(); ambience.start(state.level ? scene.forLevel(state.level) : "reef"); }
  openSettings();
});
$("setBuddy").onclick = () => { $("settings").classList.add("hidden"); showCharScreen("settings"); };
$("charDone").onclick = () => { clearTimeout(charTimer); $("charDone").dataset.return === "settings" ? openSettings() : showHub(); };
$("storyHome").onclick = showHub;
$("storyPrev").onclick = () => storyNav(-1);
$("storyNext").onclick = () => storyNav(1);
$("storyRead").onclick = () => speak(storyText(STORY[storyPage]));
$("paintHome").onclick = showHub;
$("paintStamp").onclick = () => {
  if (paint.mode !== "stamp") paint.mode = "stamp";
  else paint.stampIdx = (paint.stampIdx + 1) % paint.stamps.length;
  $("paintStamp").textContent = paint.stamps[paint.stampIdx];
  $("paintStamp").classList.add("on"); $("paintErase").classList.remove("on");
};
$("paintErase").onclick = () => { paint.mode = "erase"; $("paintErase").classList.add("on"); $("paintStamp").classList.remove("on"); };
$("paintClear").onclick = () => paint.redraw();
$("paintDone").onclick = () => { celebrateWith("paint", { noLevelUp: true }); };

// Keep drawing canvases aligned with their container when the viewport changes (rotation,
// mobile address-bar collapse). Coalesced via rAF so layout has settled before we re-measure.
let _canvasResizeRAF = 0;
function syncDrawingCanvases() {
  const p = $("paint");
  if (p && !p.classList.contains("hidden") && $("paintC")) paint.resize();
  if ($("inkC") && $("guideC")) traceLevel.resize();   // trace canvases only exist while that level is active
}
function onCanvasViewportChange() {
  cancelAnimationFrame(_canvasResizeRAF);
  _canvasResizeRAF = requestAnimationFrame(syncDrawingCanvases);
}
addEventListener("resize", onCanvasViewportChange);
addEventListener("orientationchange", onCanvasViewportChange);
if (window.visualViewport) visualViewport.addEventListener("resize", onCanvasViewportChange);

/* ---- dress-up ---- */
$("dressHome").onclick = showHub;
$("dressBg").onclick = () => dressup.cycleBg();
$("dressShuffle").onclick = () => dressup.shuffle();
$("dressDone").onclick = () => dressup.done();

/* ---- dashboard ---- */
$("dashHome").onclick = showHub;
$("setDash").onclick = () => { $("settings").classList.add("hidden"); showDashboard(); };

/* ---- sticker book clear ---- */
$("sceneClear").onclick = () => { if (decor[curScene] && decor[curScene].length) { decor[curScene] = []; saveDecor(); sfx.tick(); renderScene(); } };

/* ---- name entry ---- */
function showNameScreen(prefill) {
  $("nameMascot").innerHTML = buddyMarkup();
  $("nameInput").value = prefill || "";
  hideAllScreens();
  applyI18n($("namescreen"));
  $("namescreen").classList.remove("hidden");
  setTimeout(() => { try { $("nameInput").focus(); } catch (_) {} }, 250);
}
function commitName() {
  audio();
  const v = $("nameInput").value.trim();
  NAME = v ? v.slice(0, 12) : "Explorer";
  localStorage.setItem("fionaName", NAME);
  localStorage.setItem("fionaNameSet", "1");
  applyName();
  $("namescreen").classList.add("hidden");
  if (settings.music !== "off" && !musicOn) startMusic();   // kick off the happy background tune
  speak(t("hi_let_play"));
  proceedAfterName();   // first run: difficulty → buddy → hub
}
$("nameStart").onclick = commitName;
$("nameSkip").onclick = () => {
  NAME = $("nameInput").value.trim().slice(0, 12) || "Explorer";
  localStorage.setItem("fionaName", NAME); localStorage.setItem("fionaNameSet", "1");
  applyName(); $("namescreen").classList.add("hidden");
  if (settings.music !== "off" && !musicOn) startMusic();
  proceedAfterName();
};
document.querySelectorAll("#diffGrid .diff-btn").forEach(b => b.onclick = () => {
  settings.diff = b.dataset.d; saveSettings();
  localStorage.setItem("fionaDiffSet", "1");
  sfx.good(); $("diffscreen").classList.add("hidden");
  if (!localStorage.getItem("fionaBuddySet")) showCharScreen("hub"); else showHub();
});
$("nameInput").addEventListener("keydown", e => { if (e.key === "Enter") commitName(); });

document.documentElement.lang = htmlLang();
applyName();
if (!localStorage.getItem("fionaNameSet")) showNameScreen("");
else showHub();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}