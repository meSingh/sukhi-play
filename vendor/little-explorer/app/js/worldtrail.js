"use strict";
/* ================= World trail (the inside of a world) =================
   NB: `worldTrail`, not `trail` — core.js already owns a global `trail`
   (the pointer sparkle effect). Keep the names apart.
   A world is a winding path she scrolls along, Super Mario 3 style: her buddy
   stands on the game it last played, walks the path to whichever game she taps,
   and the camera follows it. Games sit in a stable order — the newest is always
   furthest along the path, so a weekly game arrives as new ground to walk to.

   Nothing here is ever locked. The path is wayfinding and story, not gating:
   every node is tappable from the first visit, per the no-fail-state Core Bar. */

// Per-world scenery. `props` wander along the path and giggle when tapped;
// `fixed` are scattered scenery that just sit there looking like somewhere.
const TRAIL_SCENE = {
  num:    { props: ["⛄", "🐧", "🎈"], fixed: ["🏔️", "❄️", "🌲", "⛄"] },
  shape:  { props: ["🦀", "🐚", "🦋"], fixed: ["🌴", "🌺", "🐚", "⛱️"] },
  brain:  { props: ["🦋", "🐿️", "🐝"], fixed: ["🌲", "🍄", "🌳", "🪵"] },
  animal: { props: ["🦒", "🐘", "🦓"], fixed: ["🌾", "🪨", "🌴", "🌾"] },
  pets:   { props: ["🐕", "🐈", "🦴"], fixed: ["🏡", "🌷", "🌳", "🦴"] },
  create: { props: ["🎈", "🦄", "🌟"], fixed: ["🌸", "🌈", "🎨", "✨"] }
};
const TRAIL_FALLBACK = { props: ["🎈", "🦋", "🌟"], fixed: ["🌳", "🌸", "🪨", "🌲"] };

const worldTrail = {
  cat: null, gids: [], pts: [], head: null, geom: null,
  at: -1,            // node index the buddy is standing on (-1 = the trailhead)
  raf: null, walking: false,

  /* ── open a world ── */
  open(cat) {
    this.stop();
    this.cat = cat;
    this.gids = visibleGames(cat);
    this.at = this.savedAt();
    this.measure();
    this.paint();
    // Land where she left off. If a new game is waiting here, the camera then
    // travels the path to it — she watches the way there instead of hunting.
    this.center(this.along(this.ptAt(this.at)), false);
    const fresh = this.gids.findIndex(isNewGame);
    if (fresh >= 0 && fresh !== this.at) {
      core.wait(() => this.center(this.along(this.pts[fresh]), true), 620);
    }
  },

  /* ── where the buddy stands in this world ── */
  savedAt() {
    let store = {};
    try { store = JSON.parse(localStorage.getItem("fionaTrail") || "{}"); } catch (_) {}
    const i = this.gids.indexOf(store[this.cat.id]);
    return i;                                   // -1 when unplayed or filtered out
  },
  saveAt(i) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem("fionaTrail") || "{}"); } catch (_) {}
    store[this.cat.id] = this.gids[i];
    core.save("fionaTrail", store);
  },

  /* ── geometry ──
     The path runs along the screen's LONG axis: down a portrait phone, across a
     landscape one. Portrait was measured at 18% of a 12-game world visible at once
     (5.7 screens of horizontal scrolling) while using 33% of the available height —
     the wrong axis on a 2.17:1 screen, and the wrong gesture for a phone.

     Everything downstream works in {x, y}; only this function and `center()` know
     which way the road runs. */
  measure() {
    const view = $("trailView");
    const vw = view.clientWidth || innerWidth, vh = view.clientHeight || innerHeight;
    const n = this.gids.length;
    const vertical = vh > vw * 1.15;                  // same threshold the hub uses
    this.vertical = vertical;

    // `run` is along the road, `cross` is side to side — whichever way round that is.
    const runLen  = vertical ? vh : vw;
    const crossLen = vertical ? vw : vh;
    const gap = Math.max(120, Math.min(215, runLen * (vertical ? 0.26 : 0.42)));
    const amp = Math.min(105, crossLen * (vertical ? 0.22 : 0.15));
    // Running downhill, the trailhead has to clear the world title and the home button
    // at the top of the screen — at 0.20 the buddy and the signpost sat under them.
    const pad = vertical ? Math.max(150 + gap * 0.62, runLen * 0.20)
                         : Math.max(96, runLen * 0.34);
    const mid = crossLen * 0.5;
    const disc = Math.max(72, Math.min(124, vh * 0.18, vw * 0.18));

    // A sine that doesn't repeat every two nodes, so the path wanders instead of zigzagging.
    const at = (i) => {
      const along = pad + i * gap, across = mid + amp * Math.sin(i * 0.9 + 0.4);
      return vertical ? { x: across, y: along } : { x: along, y: across };
    };
    this.pts = this.gids.map((_, i) => at(i));
    this.head = at(-0.62);
    const endAlong = (n ? pad + (n - 1) * gap : pad) + gap * 0.92;
    const tailAcross = n ? (vertical ? this.pts[n - 1].x : this.pts[n - 1].y) : mid;
    // The party sits at the end of the road, one index past the last game, so the buddy
    // walks to it exactly as it walks to anything else.
    this.partyPt = vertical ? { x: tailAcross, y: endAlong } : { x: endAlong, y: tailAcross };

    const canvasRun = Math.ceil(Math.max(runLen, endAlong + runLen * 0.34));
    this.geom = { vw, vh, gap, amp, disc, vertical,
                  midY: vertical ? vh * 0.5 : mid,          // kept: scenery reads it
                  mid, endX: endAlong,
                  lag: Math.min(0.42, (disc * 0.5 + 34) / gap),
                  w: vertical ? vw : canvasRun,
                  h: vertical ? canvasRun : vh };
    const c = $("trailCanvas");
    c.style.width = this.geom.w + "px";
    c.style.height = this.geom.h + "px";
  },

  // The coordinate that scrolls, for whichever way the road runs.
  along(pt) { return this.vertical ? pt.y : pt.x; },

  // Position at a fractional node index; -1 is the trailhead. Segments are
  // straight, so lerping the index walks exactly along the drawn path.
  ptAt(f) {
    const p = i => (i < 0 ? this.head
                  : i >= this.pts.length ? (this.partyPt || this.pts[this.pts.length - 1] || this.head)
                  : this.pts[i]);
    const lo = Math.floor(f), hi = Math.ceil(f), k = f - lo;
    const a = p(lo), b = p(hi);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  },

  /* ── draw the world ── */
  paint() {
    const { w, h, endX } = this.geom;
    const scene = TRAIL_SCENE[this.cat.id] || TRAIL_FALLBACK;
    const land = (typeof HUB_LAYOUT !== "undefined" && (HUB_LAYOUT[this.cat.id] || {}).land) || "#cfe8ff";
    $("trailCanvas").style.background =
      `linear-gradient(180deg, rgba(0,0,0,.07), rgba(0,0,0,0) 20%,
                               rgba(0,0,0,0) 80%, rgba(0,0,0,.07)), ${land}`;

    // the path itself: a dashed ribbon with stepping stones between the nodes.
    // It runs head -> games -> past the party, whichever way the road is laid out.
    const tail = this.partyPt || this.head;
    const all = [this.head, ...this.pts, tail];
    const pts = all.map(p => `${p.x},${p.y}`).join(" ");
    $("trailPath").setAttribute("points", pts);
    $("trailEdge").setAttribute("points", pts);
    let dots = "";
    for (let i = 0; i < all.length - 1; i++)
      for (let s = 1; s <= 3; s++) {
        const k = s / 4, x = all[i].x + (all[i + 1].x - all[i].x) * k, y = all[i].y + (all[i + 1].y - all[i].y) * k;
        dots += `<circle cx="${x}" cy="${y}" r="5" fill="#c8a878" fill-opacity=".55"/>`;
      }
    $("trailDots").innerHTML = dots;
    const bg = $("trailBg");
    bg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    bg.setAttribute("width", w); bg.setAttribute("height", h);

    this.paintScenery(scene);
    this.paintNodes();
    this.paintBuddy();
  },

  // Scenery is decoration only — tapping it wiggles and chirps and changes nothing.
  paintScenery(scene) {
    const g = this.geom, { w, h, amp } = g;
    const vert = g.vertical;
    const deco = $("trailDeco");
    // Scenery is laid out the same way whichever axis the road runs: scattered ALONG it,
    // held clear of the path band on both sides.
    const runLen  = vert ? h : w;                       // length of the road
    const crossLen = vert ? w : h;                      // width of the world
    const mid = g.mid;
    const place = (along, across) => vert ? { x: across, y: along } : { x: along, y: across };

    let html = `<span class="tr-mark" style="left:${vert ? this.head.x - g.disc * 0.62 : this.head.x - 6}px;
                  top:${vert ? this.head.y - 6 : this.head.y - g.disc * 0.66}px">🪧</span>`;

    // Fixed scenery, scattered with a seeded jitter so a world looks like somewhere
    // rather than a grid — and kept out of the path band so nothing sits under a node.
    const band = amp + g.disc * 0.62 + 30;
    const slots = Math.ceil(runLen / 82);
    for (let i = 0; i < slots; i++) {
      const r1 = seeded(i + 1), r2 = seeded(i + 41), r3 = seeded(i + 97), r4 = seeded(i + 163);
      if (r3 < 0.18) continue;                                  // leave clearings
      const e = scene.fixed[Math.floor(r4 * scene.fixed.length)];
      const near = r2 < 0.5;                                    // which side of the road
      const along = i * 82 + r1 * 60;
      const spread = r2 * 2 % 1;
      const across = near ? Math.max(30, mid - band - spread * (mid - band - 34))
                          : Math.min(crossLen - 34, mid + band + spread * (crossLen - 34 - mid - band));
      const pt = place(along, across);
      const scale = (0.72 + r1 * 0.6).toFixed(2);
      html += `<span class="tr-fixed" style="left:${pt.x}px; top:${pt.y}px; transform:translate(-50%,-50%) scale(${scale})">${e}</span>`;
    }
    // a few wanderers that drift back and forth across the world
    scene.props.forEach((e, i) => {
      const along = 140 + i * (runLen / (scene.props.length + 0.6));
      const across = mid + (i % 2 ? amp + 46 : -amp - 46);
      const pt = place(along, across);
      html += `<button class="tr-prop" style="left:${pt.x}px; top:${pt.y}px; animation-duration:${9 + i * 3}s; animation-delay:-${i * 2.5}s"
                       aria-hidden="true" tabindex="-1">${e}</button>`;
    });
    deco.innerHTML = html;
    deco.querySelectorAll(".tr-prop").forEach(el => {
      el.onclick = ev => {
        ev.stopPropagation();
        el.classList.remove("boing"); void el.offsetWidth; el.classList.add("boing");
        tone(520 + Math.random() * 320, 0, .16, "triangle", .1);
        floaters(["✨"], ev.clientX, ev.clientY, 3);
      };
    });
  },

  paintNodes() {
    const wrap = $("gameNodes");
    wrap.innerHTML = "";
    this.gids.forEach((gid, i) => {
      const g = GAMES[gid], p = this.pts[i];
      const b = document.createElement("button");
      b.className = "node tr-node";
      b.style.left = p.x + "px"; b.style.top = p.y + "px";
      b.dataset.gid = gid;
      b.innerHTML = `${newFlag(isNewGame(gid))}
                     <div class="node-disc b-${gid}"><span>${g.icon}</span></div>
                     <div class="node-label">${locName(g)}</div>
                     <div class="node-stars">${"⭐".repeat(Math.min(3, completions[gid] || 0))}</div>`;
      b.onclick = () => this.travelTo(i);
      wrap.appendChild(b);
    });

    // The world party: a bigger, different node closing the path. Never locked — early
    // on it is a sampler of this world, and it becomes real review as she plays more.
    const p = this.partyPt;
    const party = document.createElement("button");
    party.className = "node tr-node tr-party";
    party.style.left = p.x + "px"; party.style.top = p.y + "px";
    party.dataset.party = this.cat.id;
    party.innerHTML = `<div class="node-disc party-disc"><span>🎉</span></div>
                       <div class="node-label">${t("party_node")}</div>`;
    party.onclick = () => this.travelTo(this.gids.length);
    wrap.appendChild(party);
  },

  paintBuddy() {
    const el = $("trailBuddy");
    el.innerHTML = buddyMarkup();
    this.placeBuddy(this.at);
  },
  placeBuddy(f) {
    const p = this.ptAt(Math.max(-1, f - this.geom.lag));
    const hop = this.walking ? Math.abs(Math.sin(f * Math.PI)) * 13 : 0;
    const el = $("trailBuddy");
    el.style.left = p.x + "px";
    el.style.top = (p.y + 9 - hop) + "px";     // feet planted on the road surface
  },

  /* ── camera ── */
  center(v, smooth) {
    const view = $("trailView"), g = this.geom;
    const span = g.vertical ? g.h - g.vh : g.w - g.vw;
    const half = (g.vertical ? g.vh : g.vw) / 2;
    const pos = Math.max(0, Math.min(span, v - half));
    if (smooth && !reducedMotion()) view.scrollTo(g.vertical ? { top: pos, behavior: "smooth" }
                                                             : { left: pos, behavior: "smooth" });
    else if (g.vertical) view.scrollTop = pos;
    else view.scrollLeft = pos;
  },

  /* ── the walk: buddy travels the path, camera follows, then the game starts ── */
  travelTo(i) {
    if (this.walking) return;
    const isParty = i >= this.gids.length;
    const gid = this.gids[i];
    sfx.tap();
    narratorSay(isParty ? t("narrator_party") : t("narrator_cat_" + this.cat.id));
    const from = this.at, steps = Math.abs(i - from);
    const arrive = () => {
      this.at = i; this.walking = false; this.placeBuddy(i);
      if (!isParty) this.saveAt(i);      // the party is not a game, so it isn't "where she left off"
      core.wait(() => (isParty ? worldParty.start(this.cat) : startGameNow(gid)), 140);
    };
    if (steps === 0 || reducedMotion()) { this.center(this.along(this.ptAt(i)), true); core.wait(arrive, 260); return; }

    // The walk fits inside the beat the narrator line already took, so travelling
    // the path costs her no extra waiting before the game starts.
    const dur = Math.min(900, 300 + steps * 190);
    const t0 = performance.now();
    let lastStep = from;
    this.walking = true;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const f = from + (i - from) * k;
      this.placeBuddy(f);
      this.center(this.along(this.ptAt(f)), false);
      const crossed = Math.round(f);
      if (crossed !== lastStep) { lastStep = crossed; tone(400 + crossed * 18, 0, .07, "sine", .05); }
      if (k < 1) this.raf = requestAnimationFrame(step);
      else { this.raf = null; arrive(); }
    };
    this.raf = requestAnimationFrame(step);
  },

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null; this.walking = false;
  },

  // Percentage-free pixel geometry has to be rebuilt when the viewport changes.
  relayout() {
    if (!this.cat || $("games").classList.contains("hidden")) return;
    this.stop();
    this.measure();
    this.paint();
    this.center(this.along(this.ptAt(this.at)), false);
  }
};

addEventListener("resize", () => worldTrail.relayout());
