"use strict";
/* ================= Scene kit =================
   Shared, drawn-SVG scenery every game composes its screen from.

   Why this exists: measured across all 35 levels, the average play area carried a
   foreground object on 15% of its surface, and 20 games sat under 15% — objects
   floating in a gradient. Filling them one at a time is a job that never finishes,
   so this is the layer library that makes each one a few lines.

   It is also the fix for the art reading as three languages at once. Everything
   here is drawn SVG built from a small shape vocabulary: no emoji, no flat
   untextured primitives. Emoji stay for whole objects a game is *about*.

   Use:
     $("playArea").innerHTML = scene.html("reef") + `...the game...`;

   Layers, back to front — sky wash, far silhouettes, mid props, ground, drifting
   motes, then a foreground frame at the very edges. The frame is the one doing the
   most work: something nearest the eye is what makes a flat screen read as a place.

   Everything is seeded, so a scene lands identically on every repaint and across
   devices, and everything is decorative — `pointer-events:none` throughout, so no
   layer can ever steal a tap from the game. */

const SCENE_SHAPE = {
  // A rounded hill. Continuous shapes live in stretch-to-fit bands, where the
  // distortion is invisible; discrete props never do.
  hill: (x, w, h, fill, o = 1) =>
    `<path d="M${x} 100 Q${x + w * .25} ${100 - h * 1.15} ${x + w * .5} ${100 - h}
              Q${x + w * .75} ${100 - h * .85} ${x + w} 100 Z" fill="${fill}" opacity="${o}"/>`,

  pine: (x, base, h, fill, dark) => {
    const w = h * .58;
    return `<g opacity=".95">
      <rect x="${x - w * .07}" y="${base - h * .22}" width="${w * .14}" height="${h * .24}" rx="${w * .06}" fill="${dark}"/>
      <path d="M${x} ${base - h} L${x + w * .5} ${base - h * .52} L${x - w * .5} ${base - h * .52} Z" fill="${fill}"/>
      <path d="M${x} ${base - h * .76} L${x + w * .62} ${base - h * .2} L${x - w * .62} ${base - h * .2} Z" fill="${dark}"/>
    </g>`;
  },

  rock: (x, y, r, fill, light) =>
    `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .74}" fill="${fill}"/>
        <ellipse cx="${x - r * .26}" cy="${y - r * .26}" rx="${r * .44}" ry="${r * .3}" fill="${light}" opacity=".55"/></g>`,

  // A wavy stalk — kelp underwater, wheat on land. Two strokes so it has a spine.
  stalk: (x, base, h, fill, sway = 10) =>
    `<path d="M${x} ${base} C${x + sway} ${base - h * .35} ${x - sway} ${base - h * .68} ${x} ${base - h}"
           fill="none" stroke="${fill}" stroke-width="${h * .12}" stroke-linecap="round" opacity=".9"/>`,

  coral: (x, base, h, fill, light) =>
    `<g stroke-linecap="round" fill="none" opacity=".95">
       <g stroke="${fill}" stroke-width="${h * .19}">
         <path d="M${x} ${base} C${x - h * .05} ${base - h * .3} ${x + h * .04} ${base - h * .4} ${x} ${base - h * .58}"/>
         <path d="M${x} ${base - h * .3} C${x - h * .2} ${base - h * .48} ${x - h * .28} ${base - h * .6} ${x - h * .3} ${base - h * .8}"/>
         <path d="M${x} ${base - h * .4} C${x + h * .2} ${base - h * .56} ${x + h * .3} ${base - h * .68} ${x + h * .32} ${base - h * .88}"/>
         <path d="M${x - h * .16} ${base - h * .42} C${x - h * .3} ${base - h * .5} ${x - h * .42} ${base - h * .56} ${x - h * .5} ${base - h * .66}"/>
         <path d="M${x + h * .14} ${base - h * .52} C${x + h * .3} ${base - h * .6} ${x + h * .42} ${base - h * .64} ${x + h * .52} ${base - h * .72}"/>
       </g>
       <g stroke="${light}" stroke-width="${h * .07}" opacity=".5">
         <path d="M${x} ${base - h * .05} V${base - h * .5}"/>
       </g>
     </g>`,

  flower: (x, y, r, petal, heart) => {
    let p = "";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p += `<ellipse cx="${(x + Math.cos(a) * r * .78).toFixed(1)}" cy="${(y + Math.sin(a) * r * .78).toFixed(1)}"
            rx="${r * .52}" ry="${r * .52}" fill="${petal}"/>`;
    }
    return `<g>${p}<circle cx="${x}" cy="${y}" r="${r * .46}" fill="${heart}"/></g>`;
  },

  // Grass/seagrass tuft — the workhorse of the foreground frame.
  tuft: (x, base, h, fill) => {
    let p = "";
    for (let i = -2; i <= 2; i++) {
      const lean = i * h * .22, hh = h * (1 - Math.abs(i) * .16);
      p += `<path d="M${x} ${base} Q${x + lean * .5} ${base - hh * .6} ${x + lean} ${base - hh}"
             fill="none" stroke="${fill}" stroke-width="${h * .105}" stroke-linecap="round"/>`;
    }
    return `<g opacity=".95">${p}</g>`;
  },

  // Indoor props. The cozy biome was flowers and boulders, which is a meadow.
  pot: (x, base, h, fill, leaf) =>
    `<g>
       <path d="M${x - h * .3} ${base - h * .34} L${x + h * .3} ${base - h * .34}
                L${x + h * .22} ${base} L${x - h * .22} ${base} Z" fill="${fill}"/>
       <rect x="${x - h * .34}" y="${base - h * .42}" width="${h * .68}" height="${h * .12}" rx="${h * .05}" fill="${fill}"/>
       <ellipse cx="${x - h * .16}" cy="${base - h * .62}" rx="${h * .17}" ry="${h * .26}" fill="${leaf}"/>
       <ellipse cx="${x + h * .17}" cy="${base - h * .58}" rx="${h * .15}" ry="${h * .23}" fill="${leaf}" opacity=".8"/>
       <ellipse cx="${x}" cy="${base - h * .76}" rx="${h * .14}" ry="${h * .24}" fill="${leaf}"/>
     </g>`,

  block: (x, base, h, fill, light) =>
    `<g>
       <rect x="${x - h * .3}" y="${base - h * .58}" width="${h * .6}" height="${h * .58}" rx="${h * .09}" fill="${fill}"/>
       <rect x="${x - h * .18}" y="${base - h * .5}" width="${h * .2}" height="${h * .2}" rx="${h * .05}" fill="${light}" opacity=".8"/>
       <circle cx="${x + h * .34}" cy="${base - h * .18}" r="${h * .18}" fill="${light}"/>
     </g>`,

  crystal: (x, base, h, fill, light) =>
    `<g>
       <path d="M${x} ${base - h} L${x + h * .26} ${base - h * .34} L${x + h * .14} ${base} L${x - h * .16} ${base} L${x - h * .28} ${base - h * .36} Z" fill="${fill}"/>
       <path d="M${x} ${base - h} L${x - h * .28} ${base - h * .36} L${x - h * .16} ${base} Z" fill="${light}" opacity=".55"/>
     </g>`,

  star: (x, y, r, fill) =>
    `<path d="M${x} ${y - r} L${x + r * .3} ${y - r * .3} L${x + r} ${y} L${x + r * .3} ${y + r * .3}
              L${x} ${y + r} L${x - r * .3} ${y + r * .3} L${x - r} ${y} L${x - r * .3} ${y - r * .3} Z"
           fill="${fill}"/>`,

  // Flat and wide with a level underside. Three tall lobes read as a snowy hill
  // floating in the sky, which is what the first build looked like.
  // A planet with a terminator and a couple of maria — the space biome had nothing
  // with mass in it, so it read as a dark screen with sparkles.
  planet: (x, y, r, fill, dark, ring) =>
    `<g>
       ${ring ? `<ellipse cx="${x}" cy="${y}" rx="${r * 1.75}" ry="${r * .42}" fill="none"
                   stroke="${ring}" stroke-width="${r * .13}" opacity=".7"/>` : ""}
       <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>
       <path d="M${x} ${y - r} A${r} ${r} 0 0 1 ${x} ${y + r} A${r * .55} ${r} 0 0 0 ${x} ${y - r} Z"
             fill="${dark}" opacity=".45"/>
       <circle cx="${x - r * .34}" cy="${y - r * .22}" r="${r * .17}" fill="${dark}" opacity=".35"/>
       <circle cx="${x + r * .18}" cy="${y + r * .34}" r="${r * .11}" fill="${dark}" opacity=".3"/>
       ${ring ? `<path d="M${x - r * 1.75} ${y} A${r * 1.75} ${r * .42} 0 0 0 ${x + r * 1.75} ${y}"
                   fill="none" stroke="${ring}" stroke-width="${r * .13}" opacity=".9"/>` : ""}
     </g>`,

  cloud: (x, y, r, fill, o = .9) =>
    `<g opacity="${o}">
       <ellipse cx="${x}" cy="${y}" rx="${r * .74}" ry="${r * .40}" fill="${fill}"/>
       <ellipse cx="${x - r * .78}" cy="${y + r * .12}" rx="${r * .62}" ry="${r * .30}" fill="${fill}"/>
       <ellipse cx="${x + r * .82}" cy="${y + r * .13}" rx="${r * .56}" ry="${r * .27}" fill="${fill}"/>
       <ellipse cx="${x - r * .30}" cy="${y - r * .22}" rx="${r * .42}" ry="${r * .30}" fill="${fill}"/>
       <rect x="${x - r * 1.36}" y="${y + r * .06}" width="${r * 2.7}" height="${r * .36}" rx="${r * .18}" fill="${fill}"/>
     </g>`,
};

/* Each biome is a palette plus a recipe for what grows in each band. Bands are
   drawn into a 400x100 viewBox and stretched; props are placed by percentage so
   they never distort. */
const BIOMES = {
  snow: {
    drift:{ kind:"bird", fill:"rgba(255,255,255,.45)" },
    canopy:{ kind:"cloud", fill:"#dfeeff" },
    far:   { fill: "#bcd8f0", alt: "#a9cbe8" },
    ground:{ top: "rgba(255,255,255,0)", bottom: "#eaf4ff", line: "#dceaf8" },
    props: ["pine", "rock"],
    palette: { pine: "#5b9e77", pineDark: "#3f7d5c", rock: "#c8d6e4", rockLight: "#e8f0f8" },
    frame: { kind: "drift", fill: "#cfe3f7" },
    motes: { kind: "snow", fill: "rgba(255,255,255,.9)" },
  },
  reef: {
    drift:{ kind:"fish", fill:"rgba(20,70,95,.20)" },
    canopy:{ kind:"caustic", fill:"#dff6ff" },
    far:   { fill: "#3f9fbd", alt: "#358aa6" },
    ground:{ top: "rgba(226,201,140,0)", bottom: "#e2c98c", line: "#d8bd7a" },
    props: ["coral", "stalk", "rock"],
    palette: { coral: "#f2795c", coralLight: "#ffc4ae", stalk: "#3fae7d", rock: "#9fb6c4", rockLight: "#c8dae6" },
    frame: { kind: "stalk", fill: "#2f9d6e" },
    motes: { kind: "bubble", fill: "rgba(255,255,255,.55)" },
  },
  meadow: {
    drift:{ kind:"bird", fill:"rgba(60,90,60,.30)" },
    canopy:{ kind:"cloud", fill:"#ffffff" },
    far:   { fill: "#9ed48a", alt: "#8ac77a" },
    ground:{ top: "rgba(140,200,110,0)", bottom: "#8fc96f", line: "#7cb85e" },
    props: ["pine", "flower", "tuft"],
    palette: { pine: "#57a06f", pineDark: "#3d8055", flower: "#ff8fc0", flowerHeart: "#ffd23e", tuft: "#6cb35a" },
    frame: { kind: "tuft", fill: "#6cb35a" },
    motes: { kind: "pollen", fill: "rgba(255,240,170,.85)" },
  },
  savanna: {
    drift:{ kind:"bird", fill:"rgba(110,90,50,.30)" },
    canopy:{ kind:"cloud", fill:"#fff6e0" },
    far:   { fill: "#e6cf95", alt: "#d9bf80" },
    ground:{ top: "rgba(226,201,140,0)", bottom: "#e0c383", line: "#cfae6c" },
    props: ["rock", "stalk", "tuft"],
    palette: { stalk: "#c9a44f", rock: "#b9a189", rockLight: "#d8c6b2", tuft: "#c4a054" },
    frame: { kind: "tuft", fill: "#c4a054" },
    motes: { kind: "pollen", fill: "rgba(255,236,180,.7)" },
  },
  forest: {
    drift:{ kind:"leaf", fill:"rgba(60,110,70,.30)" },
    canopy:{ kind:"leaves", fill:"#3f8f5f" },
    far:   { fill: "#7fb976", alt: "#6aa663" },
    ground:{ top: "rgba(122,166,96,0)", bottom: "#7aa660", line: "#68914f" },
    props: ["pine", "rock", "flower", "tuft"],
    palette: { pine: "#3f8f5f", pineDark: "#2c6e46", rock: "#a9a293", rockLight: "#c9c3b5",
               flower: "#ff9ec7", flowerHeart: "#fff0a8", tuft: "#4f9350" },
    frame: { kind: "tuft", fill: "#4f9350" },
    motes: { kind: "pollen", fill: "rgba(215,245,180,.8)" },
  },
  space: {
    drift:{ kind:"rock", fill:"rgba(150,140,205,.30)" },
    canopy:{ kind:"stars", fill:"#ffe98a" },
    far:   { fill: "#2b2560", alt: "#241f52" },
    ground:{ top: "rgba(60,50,110,0)", bottom: "#3a3170", line: "#4a3f88" },
    props: ["rock", "star", "crystal"],
    palette: { rock: "#5a4f96", rockLight: "#8578c7", star: "#ffe98a", crystal: "#9b86e0", crystalLight: "#cdbcff" },
    frame: { kind: "rockline", fill: "#3a3170" },
    motes: { kind: "sparkle", fill: "rgba(255,240,170,.9)" },
  },
  cozy: {
    drift:{ kind:"leaf", fill:"rgba(180,150,120,.18)" },
    canopy:{ kind:"cloud", fill:"#fff2e4" },
    far:   { fill: "#e8d3bd", alt: "#dcc4ab" },
    ground:{ top: "rgba(214,178,146,0)", bottom: "#e0bb96", line: "#b98a63" },
    props: ["pot", "block", "rock"],
    palette: { rock: "#cbb39c", rockLight: "#e6d5c3", pot: "#d98b63", leaf: "#6aab6f",
               block: "#f0b840", blockLight: "#ffd98a" },
    frame: { kind: "cushion", fill: "#caa285" },
    motes: { kind: "dust", fill: "rgba(255,240,215,.7)" },
  },
};

// Which biome a body theme belongs to, so a game usually needs no argument at all.
const THEME_BIOME = {
  "theme-snow": "snow", "theme-ocean": "reef", "theme-sky": "meadow",
  "theme-bike": "meadow", "theme-pasta": "meadow", "theme-pizza": "meadow",
  "theme-space": "space", "theme-story": "meadow", "theme-music": "forest",
  "theme-whosays": "meadow", "theme-zoo": "savanna", "theme-farm": "savanna",
  "theme-dino": "forest", "theme-memory": "forest", "theme-trace": "space",
  "theme-icecream": "meadow", "theme-pets": "cozy", "theme-dressup": "cozy",
  "theme-feelings": "cozy", "theme-scavenger": "meadow", "theme-senses": "cozy",
  "theme-nightday": "space", "theme-measure": "meadow", "theme-sort": "reef",
  "theme-cups": "cozy", "theme-dragon": "forest",
};

/* Tinting.
   A biome's own palette is right when it matches the game's backdrop, and obviously
   pasted-on when it doesn't — forest greens over Dragon Feed's purple sky looked like
   scenery from another app. `tint` keeps each colour's relative lightness but adopts a
   single hue, so the scene reads as depth in the game's own palette instead of
   competing with it. */
function hexToRgb(h) {
  const v = h.replace("#", "");
  const n = v.length === 3 ? v.split("").map(c => c + c).join("") : v;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function tintColor(col, base) {
  if (typeof col !== "string") return col;
  // rgb()/rgba() too, keeping the alpha: drifters and motes are written that way, and
  // leaving them out of the tint left green pollen floating over Memory's orange sky
  let r, g, b, a = null;
  if (col[0] === "#") { [r, g, b] = hexToRgb(col); }
  else {
    const m = col.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (!m) return col;
    r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] === undefined ? null : +m[4];
  }
  const [br, bg, bb] = hexToRgb(base);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;         // keep the original lightness
  const mix = (c) => Math.round(l > .5 ? c + (255 - c) * (l - .5) * 2 : c * (l * 2));
  return a === null ? `rgb(${mix(br)},${mix(bg)},${mix(bb)})`
                    : `rgba(${mix(br)},${mix(bg)},${mix(bb)},${a})`;
}
function tintBiome(b, base) {
  const walk = (o) => Array.isArray(o) ? o.slice()
    : (o && typeof o === "object")
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]))
      : (typeof o === "string" ? tintColor(o, base) : o);
  return walk(b);
}

const scene = {
  // 400x100 bands; props positioned in percentages so nothing is squashed.
  band(inner, cls, extra = "") {
    return `<div class="sc-band ${cls}" ${extra}>
              <svg viewBox="0 0 400 100" preserveAspectRatio="none">${inner}</svg>
            </div>`;
  },

  far(b, seed) {
    const S = SCENE_SHAPE;
    let h = "";
    for (let i = 0; i < 5; i++) {
      const r1 = seeded(seed + i * 7 + 1), r2 = seeded(seed + i * 13 + 5);
      h += S.hill(i * 92 - 40 + r1 * 30, 150 + r2 * 90, 42 + r1 * 34,
                  i % 2 ? b.far.alt : b.far.fill, .55 + r2 * .25);
    }
    return this.band(h, "sc-far");
  },

  // Discrete props: their own small SVGs, placed by percent, so a wide tablet does
  // not stretch a tree into a smear.
  mid(b, seed) {
    const S = SCENE_SHAPE, p = b.palette;
    let out = "";
    for (let i = 0; i < 9; i++) {
      const r1 = seeded(seed + i * 11 + 3), r2 = seeded(seed + i * 17 + 9), r3 = seeded(seed + i * 23 + 2);
      if (r3 < .18) continue;                                   // leave gaps
      // walk the prop list rather than sampling it, so a short tile still shows
      // every shape the biome owns instead of five copies of the same coral
      const kind = b.props[(i + Math.floor(r2 * b.props.length)) % b.props.length];
      const x = 3 + i * 11.5 + r1 * 5, sz = 9 + r1 * 7;
      let art = "";
      if (kind === "pine")   art = S.pine(30, 58, 46 + r1 * 12, p.pine, p.pineDark);
      if (kind === "rock")   art = S.rock(30, 44, 17 + r2 * 7, p.rock, p.rockLight);
      if (kind === "coral")  art = S.coral(30, 58, 40 + r1 * 14, p.coral, p.coralLight);
      if (kind === "stalk")  art = S.stalk(30, 58, 44 + r2 * 12, p.stalk, 8 + r1 * 8);
      if (kind === "flower") art = S.flower(30, 40, 12 + r1 * 5, p.flower, p.flowerHeart);
      if (kind === "star")   art = S.star(30, 34, 12 + r1 * 6, p.star);
      if (kind === "crystal") art = S.crystal(30, 58, 40 + r1 * 16, p.crystal, p.crystalLight);
      if (kind === "pot")    art = S.pot(30, 58, 40 + r1 * 12, p.pot, p.leaf);
      if (kind === "block")  art = S.block(30, 58, 38 + r1 * 12, p.block, p.blockLight);
      if (kind === "tuft")   art = S.tuft(30, 58, 30 + r1 * 12, p.tuft);
      if (!art) continue;
      // stagger depth: props nearer the front sit lower and draw a little larger, so the
      // band reads as ground receding rather than a row of stamps on one line
      const depth = seeded(seed + i * 31 + 7);
      const drop = (depth * 34).toFixed(0), scale = (0.82 + depth * 0.42).toFixed(2);
      out += `<span class="sc-prop" style="left:${x.toFixed(1)}%; width:${(sz * scale).toFixed(1)}%;
                 bottom:${(-drop / 6).toFixed(1)}%; opacity:${(0.72 + depth * 0.28).toFixed(2)};
                 z-index:${Math.round(depth * 5)}">
                <svg viewBox="0 0 60 60">${art}</svg></span>`;
    }
    return `<div class="sc-mid">${out}</div>`;
  },

  // The top band. The first build of this kit filled the floor and left two-thirds of
  // the screen bare, which looked barely different from having no scenery at all.
  canopy(b, seed) {
    const S = SCENE_SHAPE, c = b.canopy;
    if (!c) return "";
    let out = "";
    for (let i = 0; i < 5; i++) {
      const r1 = seeded(seed + i * 19 + 8), r2 = seeded(seed + i * 27 + 12);
      if (c.kind === "cloud") out += S.cloud(30 + i * 85 + r1 * 40, 26 + r2 * 22, 22 + r1 * 14, c.fill, .5 + r2 * .3);
      if (c.kind === "caustic")
        // light shafts: narrow, leaning, and faded to nothing at the bottom. Squared-off
        // full-opacity slabs read as UI panels, which is what the first build looked like.
        out += `<path d="M${i * 96 - 10} 0 L${i * 96 + 16 + r1 * 14} 0 L${i * 96 + 40 + r2 * 26} 100 L${i * 96 + 6} 100 Z"
                 fill="url(#scShaft)" opacity="${(.30 + r1 * .22).toFixed(2)}"/>`;
      if (c.kind === "stars") {
        // a spread of small stars, and one body with actual mass among them
        out += S.star(20 + i * 82 + r1 * 50, 14 + r2 * 50, 3 + r1 * 6, c.fill);
        out += `<circle cx="${(52 + i * 78 + r2 * 40).toFixed(0)}" cy="${(30 + r1 * 44).toFixed(0)}"
                  r="${(1 + r2 * 2).toFixed(1)}" fill="${c.fill}" opacity="${(.4 + r1 * .5).toFixed(2)}"/>`;
        if (i === 1) out += S.planet(84, 44, 26, "#7d63c9", "#4a3690", "#c9b6ff");
        if (i === 3) out += S.planet(300, 30, 15, "#e0885f", "#a25436", null);
      }
      if (c.kind === "leaves")
        out += `<ellipse cx="${16 + i * 84 + r1 * 40}" cy="${-6 + r2 * 26}" rx="${34 + r1 * 22}" ry="${26 + r2 * 14}"
                 fill="${c.fill}" opacity="${(.5 + r1 * .3).toFixed(2)}"/>`;
    }
    const defs = c.kind === "caustic"
      ? `<defs><linearGradient id="scShaft" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${c.fill}" stop-opacity=".85"/>
           <stop offset="1" stop-color="${c.fill}" stop-opacity="0"/>
         </linearGradient></defs>` : "";
    return this.band(defs + out, "sc-canopy");
  },

  /* Mid-water/mid-air drifters — the layer that fills the big empty middle of a tall
     phone screen, which neither the canopy nor the floor can reach.

     Deliberately NEUTRAL and unsaturated: in colour-naming games the tappable objects
     carry the answer, so a background shape must never wear a nameable colour or it
     competes with the question. Silhouettes only. */
  drift(b, seed) {
    const d = b.drift;
    if (!d) return "";
    let out = "";
    for (let i = 0; i < 6; i++) {
      const r1 = seeded(seed + i * 43 + 13), r2 = seeded(seed + i * 47 + 19), r3 = seeded(seed + i * 53 + 23);
      const y = 18 + r2 * 52, sz = 4 + r1 * 5, dur = (16 + r3 * 16).toFixed(1);
      let art = "";
      if (d.kind === "fish")
        art = `<path d="M2 8 Q10 1 20 8 Q10 15 2 8 Z M20 8 L26 3 L26 13 Z" fill="${d.fill}"/>`;
      if (d.kind === "bird")
        art = `<path d="M2 9 Q8 2 14 9 Q20 2 26 9" fill="none" stroke="${d.fill}" stroke-width="2" stroke-linecap="round"/>`;
      if (d.kind === "leaf")
        art = `<ellipse cx="14" cy="8" rx="9" ry="5" fill="${d.fill}" transform="rotate(${(r1 * 60 - 30).toFixed(0)} 14 8)"/>`;
      if (d.kind === "rock")
        art = `<path d="M4 11 L8 3 L17 2 L24 8 L21 13 L9 14 Z" fill="${d.fill}"/>`;
      if (!art) continue;
      out += `<span class="sc-drift" style="top:${y.toFixed(1)}%; width:${sz.toFixed(1)}%;
                 animation-duration:${dur}s; animation-delay:-${(r2 * 20).toFixed(1)}s">
                <svg viewBox="0 0 28 16">${art}</svg></span>`;
    }
    return `<div class="sc-drifts">${out}</div>`;
  },

  ground(b) {
    return `<div class="sc-ground" style="background:linear-gradient(${b.ground.top}, ${b.ground.bottom} 62%)">
              <div class="sc-groundline" style="background:${b.ground.line}"></div>
            </div>`;
  },

  // The foreground frame: the nearest-eye layer, and the reason a flat screen
  // starts reading as a place. Deliberately large, dark and cropped by the edges.
  frame(b, seed) {
    const S = SCENE_SHAPE, f = b.frame;
    const draw = (x, base, h) =>
      // snow has no grass: rounded drifts with a shaded underside read as banked snow,
      // and unlike pale tufts they are actually visible against a white floor
      f.kind === "drift"    ? `<g><ellipse cx="${x}" cy="${base}" rx="${h * .72}" ry="${h * .5}" fill="${f.fill}"/>
                                  <ellipse cx="${x - h * .18}" cy="${base - h * .12}" rx="${h * .42}" ry="${h * .28}"
                                    fill="#ffffff" opacity=".75"/></g>`
    : f.kind === "stalk"    ? S.stalk(x, base, h, f.fill, 12)
      // indoors there is no grass: soft rounded forms read as a cushion or a rug edge
    : f.kind === "cushion"  ? `<rect x="${x - h * .42}" y="${base - h * .6}" width="${h * .84}"
                                 height="${h * .8}" rx="${h * .28}" fill="${f.fill}"/>`
      // in space the frame is the rim of whatever she is standing on
    : f.kind === "rockline" ? `<path d="M${x - h * .6} ${base} Q${x} ${base - h * .62} ${x + h * .6} ${base} Z"
                                 fill="${f.fill}"/>`
                            : S.tuft(x, base, h, f.fill);
    let left = "", right = "";
    for (let i = 0; i < 3; i++) {
      const r = seeded(seed + i * 29 + 4);
      left  += draw(10 + i * 20 + r * 8, 100, 56 + r * 30);
      right += draw(10 + i * 20 + r * 8, 100, 54 + r * 32);
    }
    return `<div class="sc-frame sc-frame-l"><svg viewBox="0 0 70 100" preserveAspectRatio="xMinYMax meet">${left}</svg></div>
            <div class="sc-frame sc-frame-r"><svg viewBox="0 0 70 100" preserveAspectRatio="xMaxYMax meet">${right}</svg></div>`;
  },

  motes(b, seed) {
    const m = b.motes;
    let out = "";
    for (let i = 0; i < 14; i++) {
      const r1 = seeded(seed + i * 31 + 6), r2 = seeded(seed + i * 37 + 11), r3 = seeded(seed + i * 41 + 17);
      const size = m.kind === "bubble" ? 5 + r1 * 12 : 3 + r1 * 6;
      out += `<i class="sc-mote sc-${m.kind}" style="left:${(r2 * 98).toFixed(1)}%; top:${(r3 * 96).toFixed(1)}%;
                 width:${size.toFixed(1)}px; height:${size.toFixed(1)}px; background:${m.fill};
                 animation-duration:${(7 + r1 * 9).toFixed(1)}s; animation-delay:-${(r3 * 12).toFixed(1)}s"></i>`;
    }
    return `<div class="sc-motes">${out}</div>`;
  },

  /* The whole kit, or any subset of it.
     opts.layers — defaults to everything; pass a subset to keep a busy game readable.
     opts.seed   — vary the scene between rounds without changing biome. */
  html(biome, opts = {}) {
    let b = BIOMES[biome] || BIOMES[THEME_BIOME[biome] || "meadow"] || BIOMES.meadow;
    if (opts.tint) b = tintBiome(b, opts.tint);        // adopt the game's hue, keep the forms
    const seed = opts.seed || 1;
    const want = opts.layers || ["canopy", "far", "drift", "mid", "ground", "motes", "frame"];
    const has = k => want.includes(k);
    return `<div class="sc-scene" aria-hidden="true">
      ${has("canopy") ? this.canopy(b, seed) : ""}
      ${has("far")    ? this.far(b, seed) : ""}
      ${has("drift")  ? this.drift(b, seed) : ""}
      ${has("mid")    ? this.mid(b, seed) : ""}
      ${has("ground") ? this.ground(b) : ""}
      ${has("motes")  ? this.motes(b, seed) : ""}
      ${has("frame")  ? this.frame(b, seed) : ""}
    </div>`;
  },

  /* A seamlessly tileable band, for games that SCROLL their world past the camera.
     The static layers above are laid out against a fixed canvas and would slide wrong
     against a parallax; this returns one tile that can be repeated inside a marquee.

     Two rules make the repeat invisible: every prop sits inside a margin so nothing is
     clipped at a tile edge, and the caller repeats an EVEN number of times, so the
     standard `translateX(-50%)` loop lands on an identical tile.

     `band` picks the depth — "far" is small, pale and sparse; "near" is large and
     opaque, the layer nearest the camera.

     SIZE THE BAND IN vmin, NOT IN % OF THE STAGE. The tile keeps a 6:1 ratio, so its
     height sets how big every prop is; a band given `height:22%` of a 851px-tall phone
     draws coral 180px tall and two-thirds of a tile fills the screen. `clamp(..vmin..)`
     keeps a prop the same apparent size on a phone and a laptop, which is what a
     background layer wants. */
  strip(biome, opts = {}) {
    let b = BIOMES[biome] || BIOMES[THEME_BIOME[biome] || "meadow"] || BIOMES.meadow;
    const near = opts.band === "near";
    // Distance desaturates: the far band takes the biome's own horizon colour unless the
    // caller asked for something else, so it recedes instead of sitting there in full paint.
    const tint = opts.tint || (near ? null : b.far.fill);
    if (tint) b = tintBiome(b, tint);
    const S = SCENE_SHAPE, p = b.palette;
    const canopy = opts.band === "canopy";
    const seed = (opts.seed || 1) + (near ? 500 : 0) + (canopy ? 900 : 0);
    const W = 600, H = 100, count = near ? 5 : 7;
    let out = "";

    // A canopy hangs from the top edge instead of growing from the bottom one. Flipping a
    // ground band with scaleY(-1) does not stand in for it: an upside-down pine reads as a
    // dark arrow pointing at the child, which is exactly how the first attempt looked.
    if (canopy) {
      const c = b.canopy || { fill: "rgba(255,255,255,.5)" };
      for (let i = 0; i < 6; i++) {
        const r1 = seeded(seed + i * 17 + 5), r2 = seeded(seed + i * 29 + 9);
        const x = 60 + i * ((W - 120) / 6) + r1 * 30;
        out += `<ellipse cx="${x.toFixed(0)}" cy="${(-14 + r2 * 26).toFixed(0)}"
                 rx="${(46 + r1 * 30).toFixed(0)}" ry="${(38 + r2 * 22).toFixed(0)}"
                 fill="${c.fill}" opacity="${(.55 + r1 * .35).toFixed(2)}"/>`;
      }
      return `<svg class="sc-strip" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet"
                   style="opacity:.9">${out}</svg>`;
    }
    for (let i = 0; i < count; i++) {
      const r1 = seeded(seed + i * 13 + 3), r2 = seeded(seed + i * 19 + 7), r3 = seeded(seed + i * 23 + 11);
      if (r3 < 0.14) continue;                                   // gaps, so it is not a fence
      // walk the prop list rather than sampling it, so a short tile still shows
      // every shape the biome owns instead of five copies of the same coral
      const kind = b.props[(i + Math.floor(r2 * b.props.length)) % b.props.length];
      // margin keeps a prop clear of both tile edges, which is what makes the seam vanish
      const x = 60 + i * ((W - 120) / count) + r1 * 24;
      const h = (near ? 62 : 40) + r1 * (near ? 26 : 16);
      let art = "";
      if (kind === "pine")    art = S.pine(x, H, h, p.pine, p.pineDark);
      if (kind === "rock")    art = S.rock(x, H - h * .28, h * .42, p.rock, p.rockLight);
      if (kind === "coral")   art = S.coral(x, H, h, p.coral, p.coralLight);
      if (kind === "stalk")   art = S.stalk(x, H, h, p.stalk, 8 + r1 * 10);
      // a bloom is a disc, not a silhouette: at the far band's .22 it disappears up close,
      // so the near band draws it half again as big
      if (kind === "flower")  art = S.flower(x, H - h * .5, h * (near ? .34 : .22), p.flower, p.flowerHeart);
      if (kind === "star")    art = S.star(x, H - h * .6, h * (near ? .34 : .22), p.star);
      if (kind === "tuft")    art = S.tuft(x, H, h * .7, p.tuft);
      if (kind === "crystal") art = S.crystal(x, H, h, p.crystal, p.crystalLight);
      if (kind === "pot")     art = S.pot(x, H, h, p.pot, p.leaf);
      if (kind === "block")   art = S.block(x, H, h, p.block, p.blockLight);
      out += art;
    }
    return `<svg class="sc-strip" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet"
                 style="opacity:${near ? .8 : .6}">${out}</svg>`;
  },

  // Biome for the level about to start, from its theme — so most games say nothing.
  forLevel(id) {
    const lv = (typeof LEVELS !== "undefined" && LEVELS[id]) || null;
    return (lv && THEME_BIOME[lv.theme]) || "meadow";
  },
};
