"use strict";
/* Story mode — a read-along picture book with one thing to find on each page.
   Lived in hub.js until the game registry landed; it is a game like any other, so
   it is a file under js/games/ that registers itself, and its <script> sits between
   paint and dress-up to hold its place in the Create world's trail. */

const STORY = [
  { theme: "theme-bike",  art: "🚲☀️🌳", text: "One bright morning, {n} hopped on her bike. “I'm going on an adventure!” she said, and rode into the magical park.", es: "Una mañana soleada, {n} se subió a su bici. «¡Voy de aventura!», dijo, y entró al parque mágico.", yue: "一個晴朗嘅早晨，{n}跳上佢嘅單車。佢話：「我要去探險喇！」然後就騎入咗魔法公園。", tapEmoji: ["💨", "🔔", "🌸"], tapSound: () => tone(660, 0, .25, "triangle"), task: "🚲" },
  { theme: "theme-snow",  art: "🏔️⛄❄️", text: "First she climbed a sparkly snow mountain. A friendly snowman waved hello. Together they counted the snowflakes: one, two, three!", es: "Primero subió una montaña de nieve brillante. Un muñeco de nieve la saludó. ¡Juntos contaron los copos de nieve: uno, dos, tres!", yue: "佢首先爬上一座閃閃發光嘅雪山。一個友善嘅雪人揮手打招呼。佢哋一齊數雪花：一、二、三！", tapEmoji: ["❄️", "✨", "⛄"], tapSound: () => tone(880, 0, .2, "sine"), task: "⛄" },
  { theme: "theme-ocean", art: "🌊🐠🐬", text: "Next, {n} sailed across the bright blue ocean. Red, yellow, and green fish swam all around, and a dolphin did a happy flip!", es: "Después, {n} navegó por el océano azul. Peces rojos, amarillos y verdes nadaban alrededor, ¡y un delfín dio un saltito feliz!", yue: "跟住，{n}航行過蔚藍嘅海洋。紅色、黃色同綠色嘅魚游嚟游去，仲有一隻海豚開心咁翻咗個筋斗！", tapEmoji: ["🐠", "💦", "🐬"], tapSound: () => tone(523, 0, .25, "sine"), task: "🐬" },
  { theme: "theme-pizza", art: "🍕🍝🧆", text: "All that adventuring made {n} hungry! She stopped in Yummy Town for a slice of pizza and spaghetti with three little meatballs.", es: "¡Tanta aventura le dio hambre a {n}! Paró en Pueblo Rico por una rebanada de pizza y espagueti con tres albóndigas.", yue: "探險咗咁耐，{n}肚餓喇！佢喺美食鎮停低，食咗一件薄餅同埋有三粒丸嘅意粉。", tapEmoji: ["🍕", "😋", "🍝"], tapSound: () => tone(440, 0, .2, "triangle"), task: "🍕" },
  { theme: "theme-music", art: "🐸🐱🐮", text: "In the meadow, the animal band was playing! The frog went ribbit, the cat went meow, and the cow went moo. {n} danced and danced.", es: "En el prado, ¡la banda de animales tocaba! La rana hacía croac, el gato miau y la vaca muu. {n} bailó y bailó.", yue: "喺草地上面，動物樂隊正在演奏！青蛙呱呱叫，貓喵喵叫，牛哞哞叫。{n}不停咁跳舞。", tapEmoji: ["🎵", "🎶", "💃"], tapSound: () => speakAnimal(rand(["frog", "cat", "cow", "duck"]), { queue: true }), task: "🐱" },
  { theme: "theme-space", art: "🚀🌙⭐", text: "Then {n} put on a shiny space helmet and zoomed to the moon in a rocket! Five, four, three, two, one... blast off! She counted the twinkly stars up high.", es: "Luego {n} se puso un casco espacial brillante y voló a la luna en un cohete. ¡Cinco, cuatro, tres, dos, uno... despegue! Contó las estrellas brillantes en lo alto.", yue: "之後，{n}戴上閃亮嘅太空頭盔，坐火箭飛上月球！五、四、三、二、一……發射！佢數住高空中閃爍嘅星星。", tapEmoji: ["⭐", "🚀", "🪐"], tapSound: () => tone(130, 0, .5, "sawtooth", .15), task: "🚀" },
  { theme: "theme-story", art: "🌈⭐💖", text: "As the sun set, {n} flew home, happy and sleepy. “What a wonderful day!” she yawned. Goodnight, {n}. The End. 💖", es: "Cuando el sol se ocultó, {n} voló a casa, feliz y con sueño. «¡Qué día tan maravilloso!», bostezó. Buenas noches, {n}. Fin. 💖", yue: "太陽落山嗰陣，{n}開開心心、攰攰哋飛返屋企。佢打住呵欠話：「今日真係好開心！」晚安，{n}。故事完。💖", tapEmoji: ["⭐", "🌙", "💖"], tapSound: () => sfx.good(), last: true }
];
const storyText = p => fillName(curLang() === "yue" && p.yue ? p.yue : curLang() === "es" ? p.es : p.text);
let storyPage = 0, storySolved = false;
function showStory() {
  cleanupLevel();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  hideAllScreens();
  $("story").classList.remove("hidden");
  storyPage = 0;
  renderStory();
}
function renderStory() {
  const p = STORY[storyPage];
  storySolved = !p.task;
  document.body.className = p.theme;
  // NOT `scene` — that name belongs to the scene kit, and there is one global scope here
  const el = $("storyScene");
  el.className = "story-scene";

  // split art into interactive emojis
  const artHtml = [...p.art].map(e => `<span class="s-em" onclick="storyTap('${e}', event)">${e}</span>`).join("");

  // each page is a place: the kit reads the page's own body theme
  el.innerHTML = scene.html(p.theme, { seed: 9 + storyPage * 6 }) +
      `<div class="story-art">${artHtml}</div>
      <div class="story-textbox" id="storyText">${storyText(p)}</div>
      <div class="story-tap-hint">${t("story_tap")}</div>`;
  
  $("storyDots").innerHTML = STORY.map((_, i) => `<div class="sdot ${i === storyPage ? "on" : ""}"></div>`).join("");
  $("storyPrev").style.visibility = storyPage === 0 ? "hidden" : "visible";
  updateStoryNav();
  speak(storyText(p));
  if (p.task) core.wait(() => speak(t("story_find", { x: p.task })), 6000);
}
function updateStoryNav() {
  const p = STORY[storyPage];
  const btn = $("storyNext");
  btn.textContent = p.last ? "🎉" : "▶️";
  btn.style.opacity = storySolved ? "1" : "0.3";
  btn.style.pointerEvents = storySolved ? "auto" : "none";
}
function storyTap(e, ev) {
  const p = STORY[storyPage];
  floaters(p.tapEmoji, ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2, 5);
  if (p.tapSound) p.tapSound();
  
  if (p.task && e === p.task && !storySolved) {
    storySolved = true;
    sfx.good();
    confetti();
    speak(t("found_it", { item: e }) + " " + praise());
    updateStoryNav();
  }
}
function storyNav(dir) {
  const p = STORY[storyPage];
  if (dir > 0 && p.last) { confetti(); sfx.win(); speak(t("story_end")); setTimeout(showHub, 1800); return; }
  storyPage = clamp(storyPage + dir, 0, STORY.length - 1);
  renderStory();
}

registerGame({
  id: "story", world: "create", icon: "📖", name: "Story", es: "Cuento", yue: "故事", lvl: 0, cue: "bell"
});
