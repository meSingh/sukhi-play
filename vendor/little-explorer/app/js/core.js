"use strict";
let NAME = localStorage.getItem("fionaName") || "Explorer";

const $ = id => document.getElementById(id);
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.slice().sort(() => Math.random() - .5);
const randBetween = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Deterministic 0..1 from an integer seed. Scenery scatter uses it so a world looks
// hand-placed but lands in the same spot on every repaint (and on every device).
const seeded = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

/* ================= Game registry =================
   A game declares itself once, in its own file, right under the code it describes:

     registerGame({ id: "snow", world: "num", icon: "❄️",
                    name: "Count", es: "Contar", yue: "數一數",
                    lvl: 0, level: snowLevel });

   hub.js derives LEVELS, GAMES and each world's game list from whatever has
   registered by the time it runs (every js/games/* file loads before it).

   Registration order IS the order she walks a world's trail, so a new game whose
   <script> is appended to index.html lands at the END of its world's path — which
   is exactly where a weekly drop belongs, per the "newest is furthest along" rule
   in worldtrail.js. That makes script order load-bearing, so a test pins the exact
   per-world order: reshuffling the tags fails loudly instead of quietly moving a
   game she navigates to by place.

   `level` is omitted by the three specials (paint, story, dress-up) — they own a
   whole screen instead of running rounds, and startGameNow() dispatches them. */
const GAME_REGISTRY = [];
function registerGame(def) {
  for (const f of ["id", "world", "icon", "name", "cue"])
    if (!def[f]) throw new Error(`registerGame(${def.id || "?"}): "${f}" is required`);
  // A cue has to come from the shared palette, so no game can invent a harsh sound of
  // its own and every world still belongs to the same family.
  if (!CUES[def.cue])
    throw new Error(`registerGame(${def.id}): unknown cue "${def.cue}" — pick one of ${Object.keys(CUES).join(", ")}`);
  if (GAME_REGISTRY.some(g => g.id === def.id))
    throw new Error(`registerGame: duplicate id "${def.id}"`);
  if (def.level && typeof def.level.startRound !== "function")
    throw new Error(`registerGame(${def.id}): level has no startRound()`);
  GAME_REGISTRY.push(def);
  return def;
}
// honor the OS "reduce motion" setting — real-time games slow their scroll and skip ambient particles
const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const IRREGULAR = { snowman: "snowmen", reindeer: "reindeer" };
function plural(noun, n) {
  if (n === 1) return noun;
  if (IRREGULAR[noun]) return IRREGULAR[noun];
  if (/[^aeiou]y$/.test(noun)) return noun.slice(0, -1) + "ies";
  return noun + "s";
}

/* ================= Lifecycle & Persistence Registry ================= */
const core = {
  timers: new Set(),
  intervals: new Set(),
  pendingSaves: new Map(),
  saveTimer: null,
  
  // Register and return a timeout
  wait(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
    return id;
  },
  
  // Register and return an interval
  repeat(fn, ms) {
    const id = setInterval(fn, ms);
    this.intervals.add(id);
    return id;
  },
  
  // Clear all registered timers/intervals
  cleanup() {
    this.timers.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    this.timers.clear();
    this.intervals.clear();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    state.busy = false; // Safety reset for stuck busy states
  },
  
  // Throttled persistence to avoid localStorage jank.
  // Every write goes through writeNow(), because setItem THROWS on a full quota and in
  // Safari private browsing. Un-caught inside the timer that throw skipped the two lines
  // that reset saveTimer, and `if (this.saveTimer) return` then short-circuited every
  // later save — one storage hiccup silently ended persistence for the whole session.
  writeNow() {
    try {
      this.pendingSaves.forEach((v, k) => localStorage.setItem(k, v));
      this.pendingSaves.clear();
    } catch (_) {
      // Storage is unavailable or full. Keep the pending values so a later flush can
      // retry, and never let it break the game she is in the middle of playing.
    } finally {
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    }
  },
  save(key, val) {
    try { this.pendingSaves.set(key, JSON.stringify(val)); } catch (_) { return; }
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.writeNow(), 2000); // 2s debounce: for "quiet" moments
  },

  // Force immediate save (page hidden, backgrounded, or unloading)
  flush() {
    if (!this.pendingSaves.size) return;
    this.writeNow();
  }
};
// A toddler ends a session by pressing home, not by closing a tab, and iOS Safari often
// never fires beforeunload. pagehide and visibilitychange are the ones that actually
// arrive, so without them the last up-to-2s of progress was routinely lost on the phone
// this app is mainly played on.
addEventListener("pagehide", () => core.flush());
document.addEventListener("visibilitychange", () => { if (document.hidden) core.flush(); });
addEventListener("beforeunload", () => core.flush());

/* ================= Persistent state ================= */
const completions = JSON.parse(localStorage.getItem("fionaStars") || "{}");
const stickers = JSON.parse(localStorage.getItem("fionaStickers") || "[]");
let settings = Object.assign({ lang: "en", diff: "auto", voice: 1, music: "bouncy" },
  JSON.parse(localStorage.getItem("fionaSettings") || "{}"));
const perf = JSON.parse(localStorage.getItem("fionaPerf") || "{}");
const saveCompletions = () => core.save("fionaStars", completions);
const saveStickers = () => core.save("fionaStickers", stickers);
const saveSettings = () => core.save("fionaSettings", settings);
const savePerf = () => core.save("fionaPerf", perf);

/* ================= Localization ================= */
const DICT = {
  en: {
    num: ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"],
    praise: ["Great job, {n}!", "Wonderful!", "Amazing!", "Hooray!", "You did it, {n}!", "Super!", "Fantastic!", "Woohoo!"],
    blastoff: "Blast off!",
    well_done: "You did it, {n}!",
    hi_let_play: "Hi {n}! Let's play!",
    hi_star_sparks: "Hi {n}! Find Star Sparks to fix the rocket. Tap a world!",
    narrator_back: "Welcome back, {n}! 🌈",
    narrator_ready: "Where to today, {n}? 🗺️",
    narrator_postgame: "Amazing! What's next, {n}? ⭐",
    narrator_new_world: "Look, {n}! Something new in {w}! ✨",
    new_badge: "New!",
    narrator_cat_num: "Let's count! 🔢",
    narrator_cat_shape: "Colors and shapes! 🎨",
    narrator_cat_brain: "Brain power time! 🧩",
    narrator_cat_animal: "Animal friends! 🐾",
    narrator_cat_pets: "Pets need us! 🐶",
    narrator_cat_space: "3, 2, 1... Blast off! 🚀",
    narrator_cat_fantasy: "Into make-believe! 🐉",
    narrator_cat_create: "Let's create! ✨",
    quest_fixed: "The rocket is all fixed! Get ready to blast off!",
    quest_fixed_praise: "Hooray {n}! You found the last Star Spark! The rocket is all fixed! Let's blast off!",
    quest_collect: "Hooray! You earned a Star Spark, {n}! {left} more to fix the rocket!",
    quest_status: "We're collecting Star Sparks to fix the rocket! {left} more to go. Tap a world to play!",
    quest_ready: "The rocket is fixed! Tap it to blast off!",
    settings_lang: "Language",
    settings_voice: "Talking voice",
    settings_music: "Music",
    settings_diff: "Difficulty",
    settings_buddy: "🧸 Buddy",
    settings_name: "✏️ Name",
    settings_progress: "📊 Progress",
    settings_reset: "Reset stars",
    settings_restart: "🔄 Start over",
    settings_restart_confirm: "This will erase all of {n}'s stars, stickers, and progress. Are you sure?",
    settings_reset_confirm: "Reset all of {n}'s stars and stickers?",
    settings_hold_hint: "Grown-ups: hold the button to open settings.",
    party_node: "Party!",
    party_intro: "It's a {world} party! Let's play three games!",
    party_done: "What a {world} party! You played them all!",
    narrator_party: "There's a party at the end of the path!",
    parent_gate: "Grown-up check: what is {a} + {b}?",
    settings_done: "Done",
    back: "Back",
    next: "Next",
    home: "Home",
    clear: "Clear",
    done: "Done",
    big: "Big!",
    small: "Small!",
    try_again: "Try again!",
    look_at_pattern: "Look at the pattern!",
    yes_it: "Yes! {animal} says {sound}!",
    found_it: "Yes! You found {item}!",
    all_sorted: "All sorted!",
    found_all: "You found them all!",
    match: "A match! Two {item}!",
    beautiful_music: "Beautiful music!",
    traced_it: "You traced it!",
    yummy: "Yummy!",
    fed_all: "{count} {item}! Yum yum!",
    hatched_all: "{count} baby {item}!",
    icecream_finish: "A yummy {count}-scoop ice cream!",
    pet_clean: "All clean!",
    pet_yum: "Yum yum!",
    pet_whee: "Wheee!",
    pet_happy: "{animal} is so happy!",
    pet_sad: "{animal} looks sad 😢 Let's help them feel better!",
    pet_feels_clean: "Yay! {animal} feels so fresh and clean! 🫧",
    pet_feels_fed: "Yum! {animal} is not hungry anymore! 😋",
    pet_feels_played: "Wheee! {animal} feels so happy playing! 🎾",
    pet_feels_cuddled: "Aww! {animal} feels loved! 💞",
    pet_kind: "{animal} is so happy now! 💖 You were so kind!",
    settings_title: "⚙️ Grown-up Settings",
    lang_en: "English", lang_es: "Español", lang_yue: "廣東話",
    diff_auto: "Auto ⬆️", diff_easy: "Easy", diff_med: "Medium", diff_hard: "Hard",
    diff_title: "Grown-ups: pick a level!", diff_say: "Pick a level for your little one.",
    diff_easy_age: "Ages 2-3", diff_med_age: "Ages 3-4", diff_hard_age: "Ages 4-5",
    voice_on: "On", voice_off: "Off",
    music_bouncy: "Bouncy", music_calm: "Calm", music_march: "March", music_off: "Off",
    rocket_ready: "🚀 Rocket ready!",
    rocket_zoomed: "Amazing job {n}! The rocket zoomed to the stars! Let's find more Star Sparks!",
    tap_count: "Tap {count} {x}!",
    you_counted: "{num}! You counted {count}!",
    tap_fish: "Tap the {x} fish!",
    goodtry_fish: "Good try! Look for the {x} fish!",
    drag_pizza_show: "Drag {x} onto the pizza!",
    drag_pizza_say: "Find {x}, and drag it onto the pizza!",
    shape_fits: "Yummy! {x} fits!",
    thats_look: "That's {x}! Look for {y}!",
    put_pizza: "Put {count} {x} on the pizza!",
    placed_pizza: "{num}! {count} {x}!",
    drag_topping: "Drag the {color} topping onto the pizza!",
    color_excl: "{color}!",
    thats_find_one: "That's {color}! Find the {color2} one!",
    pop_balloon_show: "Pop balloon number {target}!",
    pop_balloon_say: "Pop the balloon with the number {target}!",
    thats_that_num: "{num}! That's {target}!",
    thats_find_num: "That's number {num}. Find number {target}!",
    put_base: "Put {count} {x} on {base}!",
    fed_count: "{num}! {count} {x}! Yummy!",
    new_shapes: "New shapes! Let's trace!",
    matching_show: "Find the matching pairs!",
    matching_say: "Find the matching {x}! Tap a card to flip it!",
    listen_show: "Listen to the animals!",
    listen_say: "Listen to the animal band!",
    yourturn_show: "Now you play! Press the glowing animals!",
    yourturn_say: "Your turn! Press the glowing animals!",
    who_show: "Who makes this sound?",
    who_say: "Listen! Who makes this sound?",
    countdown_show: "Count down! Tap {next}!",
    countdown_say: "Let's count down to blast off! Tap number {next}!",
    blastoff_screen: "🚀 BLAST OFF! 🌟",
    find_num: "Find number {next}!",
    sortsize_show: "Sort by size!",
    sortsize_say: "Drag the big ones to the big planet, and the small ones to the small planet!",
    that_big: "That one is big! Put it on the big planet!",
    that_small: "That one is small! Put it on the small planet!",
    sortcolor_show: "Sort by color!",
    sortkind_show: "Sort them out!",
    sorted_one: "{x}!",
    that_basket: "That one is {x}. Find the {x} basket!",
    goes_with: "That goes with {x}!",
    next_show: "What comes next?",
    next_say: "Look at the pattern! What comes next?",
    try_pattern: "Try again! Look at the pattern!",
    feed_dragon_show: "Feed the dragon {count} {x}!",
    eggs_show: "Tap {count} {x} to hatch the dinos!",
    eggs_say: "Tap {count} {x} to hatch the baby dinosaurs!",
    flash_look: "Watch the eggs!", flash_look_say: "Watch carefully! Count the eggs!",
    flash_ask: "How many eggs?", flash_ask_say: "How many eggs did you see?",
    flash_win: "{count} eggs! You remembered!", flash_peek: "Take another look!",
    scoop_show: "Add a {x} scoop!",
    scoop_say: "Add a {x} scoop on top!",
    thats_find_scoop: "That's {color}! Find the {color2} scoop!",
    scoop_count: "{color}! {num} {x}!",
    cherry_show: "Tap the cherry on top!",
    cherry_say: "Now tap the cherry to finish your ice cream!",
    yummy_cherry: "Yummy! Now pop a cherry on top!",
    tap_pet: "Tap {x}!",
    yes_pet: "Yes! {x}!",
    lookfor_pet: "Look for {x}!",
    takecare_show: "Take care of {x}!",
    takecare_say: "Take care of {x}! Give it a bath, some food, and a toy!",
    takecare_sad: "{animal} looks sad 😢 Can you help them feel better?",
    give_pet_show: "Give {animal} {count} {x}!",
    same_pet_show: "Give {right} the same treats as {left}!",
    same_pet_say: "Give {right} the same number of treats as {left}!",
    same_pet_win: "They both have {count}! They match!",
    count_x: "{count} {x}!",
    paint_intro: "Let's paint! Pick a color and draw with your finger, {n}!",
    paint_color_q: "Can you paint with {color}?",
    paint_stamp_q: "Can you put a {x} on your picture?",
    paint_outline_q: "Let's paint {x}!",
    paint_finish: "Beautiful painting!",
    paint_stamp_win: "Great! A {x}!",
    dash_title: "📊 Grown-up Progress",
    dash_stars: "Stars", dash_played: "Games played", dash_stickers: "Stickers",
    dash_tried: "Activities tried", dash_trips: "Rocket trips", dash_sparks: "Star Sparks",
    dressup_intro: "Let's dress up! Pick a part at the bottom to put it on, {n}!",
    cool_look: "What a cool look!",
    story_find: "Can you find the {x}? Tap it!",
    story_tap: "👆 Tap the picture!",
    story_end: "The end! Goodnight, {n}!",
    name_title: "Hi there! What's your name?", name_ph: "Type a name…",
    name_start: "Let's play! 🎉", name_skip: "Skip for now",
    char_title: "Pick your buddy!", char_done: "Let's go! 🎉",
    hub_title: "🌈 {n}'s World 🌈", book_title: "📒 {n}'s Sticker Book 📒",
    sticker_empty_hint: "Play games to earn stickers to decorate with!",
    sticker_empty_say: "Play games to earn stickers!",
    sticker_hint: "Tap a sticker, then tap the picture to place it! 🎨",
    sticker_intro: "Here is your sticker book, {n}! Tap a sticker, then tap the picture to place it!",
    sticker_belongs: "Perfect! {x} belongs in the {scene}!",
    off_slot: "Off",
    theme_animals: "animals", theme_food: "food", theme_frozen: "frozen things", theme_ocean: "sea things",
    kind_animal: "the animals", kind_food: "the yummy food", kind_vehicle: "the things that go",
    celeb_done_sub: "⚡ You found the LAST Star Spark! The rocket is ready! 🚀",
    celeb_more_sub: "⚡ Star Spark collected! {left} more to fix the rocket 🚀",
    quest_onemore: "The rocket is all fixed! Play one more game to blast off!",
    trip_complete: "Trip #{trips} complete — you're a Star Explorer! {badge}",
    trace_number: "Trace the number {x}!", trace_letter: "Trace the letter {x}!", trace_shape: "Trace {x}!",
    follow_dots: "Follow the dots!",
    tap_next: "🚀 Tap {next}!", lbl_big: "BIG", lbl_small: "small",
    sortcolor_say: "Put each thing in the basket that matches its color!",
    sortkind_say: "Put each thing where it belongs!",
    tap_part: "Tap {part}!",
    yes_part: "Yes! {part}!",
    hideseek_show: "Put it {rel} the {spot}!",
    hideseek_say: "Put {buddy} {rel} the {spot}!",
    hideseek_retry: "Good try! Put it {rel} the {spot}!",
    hideseek_win: "{rel} the {spot}!",
    hideseek_next: "Now put it {rel} the {spot}!",
    hideseek_again: "Great! Now try a different spot!",
    cups_watch: "Watch the ball! Where does it go?",
    cups_find: "Where is the ball? Tap the cup!",
    cups_nope: "Not there! Peek under another cup!",
    cups_retry: "Keep looking! Find the ball!",
    cups_win: "You found it! 🎉",
    rel_in: "in", rel_on: "on", rel_under: "under",
    measure_show_taller: "Which one is TALLER?",
    measure_say_taller: "Which one is taller? Tap it!",
    measure_show_shorter: "Which one is SHORTER?",
    measure_say_shorter: "Which one is shorter? Tap it!",
    measure_yes_taller: "Yes! Taller!",
    measure_yes_shorter: "Yes! Shorter!",
    measure_no_taller: "That one is shorter! Find the taller one!",
    measure_no_shorter: "That one is taller! Find the shorter one!",
  },
  es: {
    num: ["", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"],
    praise: ["¡Buen trabajo, {n}!", "¡Maravilloso!", "¡Increíble!", "¡Hurra!", "¡Lo hiciste, {n}!", "¡Súper!", "¡Fantástico!", "¡Bravo!"],
    blastoff: "¡Despegue!",
    well_done: "¡Lo hiciste, {n}!",
    hi_let_play: "¡Hola {n}! ¡Vamos a jugar!",
    hi_star_sparks: "¡Hola {n}! Busca Chispas para arreglar el cohete. ¡Toca un mundo!",
    narrator_back: "¡Bienvenido de nuevo, {n}! 🌈",
    narrator_ready: "¿A dónde hoy, {n}? 🗺️",
    narrator_postgame: "¡Genial! ¿Qué sigue, {n}? ⭐",
    narrator_new_world: "¡Mira, {n}! ¡Algo nuevo en {w}! ✨",
    new_badge: "¡Nuevo!",
    narrator_cat_num: "¡A contar! 🔢",
    narrator_cat_shape: "¡Colores y figuras! 🎨",
    narrator_cat_brain: "¡A pensar! 🧩",
    narrator_cat_animal: "¡Amigos animales! 🐾",
    narrator_cat_pets: "¡Las mascotas nos necesitan! 🐶",
    narrator_cat_space: "¡3, 2, 1... Despegue! 🚀",
    narrator_cat_fantasy: "¡Al mundo de fantasía! 🐉",
    narrator_cat_create: "¡Vamos a crear! ✨",
    quest_fixed: "¡El cohete está arreglado! ¡Prepárate para el despegue!",
    quest_fixed_praise: "¡Hurra {n}! ¡Encontraste la última Chispa de Estrella! ¡El cohete está listo!",
    quest_collect: "¡Hurra! ¡Ganaste una Chispa de Estrella, {n}! ¡Faltan {left} para arreglarlo!",
    quest_status: "¡Estamos juntando Chispas de Estrella! Faltan {left}. ¡Toca un mundo!",
    quest_ready: "¡El cohete está listo! ¡Tócalo para despegar!",
    settings_lang: "Idioma",
    settings_voice: "Voz",
    settings_music: "Música",
    settings_diff: "Dificultad",
    settings_buddy: "🧸 Amigo",
    settings_name: "✏️ Nombre",
    settings_progress: "📊 Progreso",
    settings_reset: "Reiniciar",
    settings_restart: "🔄 Empezar de nuevo",
    settings_restart_confirm: "Esto borrará todas las estrellas, pegatinas y progreso de {n}. ¿Estás seguro?",
    settings_reset_confirm: "¿Borrar todas las estrellas y pegatinas de {n}?",
    settings_hold_hint: "Adultos: mantén pulsado el botón para abrir los ajustes.",
    party_node: "¡Fiesta!",
    party_intro: "¡Es una fiesta de {world}! ¡Vamos a jugar tres juegos!",
    party_done: "¡Qué fiesta de {world}! ¡Los jugaste todos!",
    narrator_party: "¡Hay una fiesta al final del camino!",
    parent_gate: "Comprobación para adultos: ¿cuánto es {a} + {b}?",
    settings_done: "Listo",
    back: "Atrás",
    next: "Siguiente",
    home: "Inicio",
    clear: "Borrar",
    done: "Listo",
    big: "¡Grande!",
    small: "¡Pequeño!",
    try_again: "¡Inténtalo de nuevo!",
    look_at_pattern: "¡Mira el patrón!",
    yes_it: "¡Sí! ¡{animal} dice {sound}!",
    found_it: "¡Sí! ¡Encontraste {item}!",
    all_sorted: "¡Todo ordenado!",
    found_all: "¡Los encontraste todos!",
    match: "¡Pareja! ¡Dos {item}!",
    beautiful_music: "¡Música hermosa!",
    traced_it: "¡Lo trazaste!",
    yummy: "¡Qué rico!",
    fed_all: "¡{count} {item}! ¡Ñam ñam!",
    hatched_all: "¡{count} bebés {item}!",
    icecream_finish: "¡Un rico helado de {count} bolas!",
    pet_clean: "¡Muy limpio!",
    pet_yum: "¡Ñam ñam!",
    pet_whee: "¡Siiii!",
    pet_happy: "¡{animal} está muy feliz!",
    pet_sad: "{animal} se ve triste 😢 ¡Vamos a ayudarle a sentirse mejor!",
    pet_feels_clean: "¡Qué bien! ¡{animal} está muy limpio y fresco! 🫧",
    pet_feels_fed: "¡Ñam! ¡{animal} ya no tiene hambre! 😋",
    pet_feels_played: "¡Siiii! ¡{animal} está muy contento jugando! 🎾",
    pet_feels_cuddled: "¡Ahhh! ¡{animal} se siente querido! 💞",
    pet_kind: "¡{animal} está muy feliz ahora! 💖 ¡Fuiste muy amable!",
    settings_title: "⚙️ Ajustes para adultos",
    lang_en: "English", lang_es: "Español", lang_yue: "廣東話",
    diff_auto: "Auto ⬆️", diff_easy: "Fácil", diff_med: "Medio", diff_hard: "Difícil",
    diff_title: "Adultos: ¡elijan un nivel!", diff_say: "Elijan un nivel para su pequeño.",
    diff_easy_age: "2-3 años", diff_med_age: "3-4 años", diff_hard_age: "4-5 años",
    voice_on: "Sí", voice_off: "No",
    music_bouncy: "Alegre", music_calm: "Tranquila", music_march: "Marcha", music_off: "No",
    rocket_ready: "🚀 ¡Cohete listo!",
    rocket_zoomed: "¡Increíble {n}! ¡El cohete voló hasta las estrellas! ¡Busquemos más Chispas de Estrella!",
    tap_count: "¡Toca {count} {x}!",
    you_counted: "¡{num}! ¡Contaste {count}!",
    tap_fish: "¡Toca el pez {x}!",
    goodtry_fish: "¡Buen intento! ¡Busca el pez {x}!",
    drag_pizza_show: "¡Arrastra {x} a la pizza!",
    drag_pizza_say: "¡Encuentra {x} y arrástralo a la pizza!",
    shape_fits: "¡Qué rico! ¡{x} encaja!",
    thats_look: "¡Ese es {x}! ¡Busca {y}!",
    put_pizza: "¡Pon {count} {x} en la pizza!",
    placed_pizza: "¡{num}! ¡{count} {x}!",
    drag_topping: "¡Arrastra el ingrediente {color} a la pizza!",
    color_excl: "¡{color}!",
    thats_find_one: "¡Eso es {color}! ¡Busca el {color2}!",
    pop_balloon_show: "¡Explota el globo número {target}!",
    pop_balloon_say: "¡Explota el globo con el número {target}!",
    thats_that_num: "¡{num}! ¡Es el {target}!",
    thats_find_num: "Ese es el número {num}. ¡Busca el número {target}!",
    put_base: "¡Pon {count} {x} en {base}!",
    fed_count: "¡{num}! ¡{count} {x}! ¡Qué rico!",
    new_shapes: "¡Nuevas figuras! ¡A trazar!",
    matching_show: "¡Encuentra las parejas!",
    matching_say: "¡Encuentra {x} iguales! ¡Toca una carta para voltearla!",
    listen_show: "¡Escucha a los animales!",
    listen_say: "¡Escucha a la banda de animales!",
    yourturn_show: "¡Ahora tú! ¡Presiona los animales que brillan!",
    yourturn_say: "¡Tu turno! ¡Presiona los animales que brillan!",
    who_show: "¿Quién hace este sonido?",
    who_say: "¡Escucha! ¿Quién hace este sonido?",
    countdown_show: "¡Cuenta regresiva! ¡Toca {next}!",
    countdown_say: "¡Contemos para el despegue! ¡Toca el número {next}!",
    blastoff_screen: "🚀 ¡DESPEGUE! 🌟",
    find_num: "¡Busca el número {next}!",
    sortsize_show: "¡Ordena por tamaño!",
    sortsize_say: "¡Arrastra los grandes al planeta grande y los pequeños al planeta pequeño!",
    that_big: "¡Ese es grande! ¡Ponlo en el planeta grande!",
    that_small: "¡Ese es pequeño! ¡Ponlo en el planeta pequeño!",
    sortcolor_show: "¡Ordena por color!",
    sortkind_show: "¡A ordenar!",
    sorted_one: "¡{x}!",
    that_basket: "Eso es {x}. ¡Busca la canasta {y}!",
    goes_with: "¡Eso va con {x}!",
    next_show: "¿Qué sigue?",
    next_say: "¡Mira el patrón! ¿Qué sigue?",
    try_pattern: "¡Inténtalo otra vez! ¡Mira el patrón!",
    feed_dragon_show: "¡Dale {count} {x} al dragón!",
    eggs_show: "¡Toca {count} {x} para abrir los dinos!",
    eggs_say: "¡Toca {count} {x} para abrir los bebés dinosaurios!",
    flash_look: "¡Mira los huevos!", flash_look_say: "¡Mira bien! ¡Cuenta los huevos!",
    flash_ask: "¿Cuántos huevos?", flash_ask_say: "¿Cuántos huevos viste?",
    flash_win: "¡{count} huevos! ¡Lo recordaste!", flash_peek: "¡Mira otra vez!",
    scoop_show: "¡Agrega una bola {x}!",
    scoop_say: "¡Agrega una bola {x} encima!",
    thats_find_scoop: "¡Eso es {color}! ¡Busca la bola {color2}!",
    scoop_count: "¡{color}! ¡{num} {x}!",
    cherry_show: "¡Toca la cereza de arriba!",
    cherry_say: "¡Ahora toca la cereza para terminar tu helado!",
    yummy_cherry: "¡Qué rico! ¡Ahora pon una cereza arriba!",
    tap_pet: "¡Toca {x}!",
    yes_pet: "¡Sí! ¡{x}!",
    lookfor_pet: "¡Busca {x}!",
    takecare_show: "¡Cuida {x}!",
    takecare_say: "¡Cuida {x}! ¡Dale un baño, comida y un juguete!",
    takecare_sad: "{animal} se ve triste 😢 ¿Puedes ayudarle a sentirse mejor?",
    give_pet_show: "¡Dale {count} {x} para {animal}!",
    same_pet_show: "¡Dales los mismos premios!", same_pet_say: "¡Dales a los dos el mismo número de premios!",
    same_pet_win: "¡Los dos tienen {count}! ¡Son iguales!",
    count_x: "¡{count} {x}!",
    paint_intro: "¡A pintar! Elige un color y dibuja con tu dedo, {n}!",
    paint_color_q: "¿Puedes pintar con {color}?",
    paint_stamp_q: "¿Puedes poner un {x} en tu dibujo?",
    paint_outline_q: "¡Vamos a pintar {x}!",
    paint_finish: "¡Qué bonito dibujo!",
    paint_stamp_win: "¡Genial! ¡Un {x}!",
    dash_title: "📊 Progreso para adultos",
    dash_stars: "Estrellas", dash_played: "Juegos jugados", dash_stickers: "Calcomanías",
    dash_tried: "Actividades probadas", dash_trips: "Viajes en cohete", dash_sparks: "Chispas de Estrella",
    dressup_intro: "¡A vestirse! Elige una parte abajo para ponerla, {n}!",
    cool_look: "¡Qué estilo tan genial!",
    story_find: "¿Puedes encontrar {x}? ¡Tócalo!",
    story_tap: "👆 ¡Toca el dibujo!",
    story_end: "¡Fin! ¡Buenas noches, {n}!",
    name_title: "¡Hola! ¿Cómo te llamas?", name_ph: "Escribe un nombre…",
    name_start: "¡A jugar! 🎉", name_skip: "Ahora no",
    char_title: "¡Elige tu amigo!", char_done: "¡Vamos! 🎉",
    hub_title: "🌈 El Mundo de {n} 🌈", book_title: "📒 Álbum de {n} 📒",
    sticker_empty_hint: "¡Juega para ganar calcomanías para decorar!",
    sticker_empty_say: "¡Juega para ganar calcomanías!",
    sticker_hint: "¡Toca una calcomanía y luego toca el dibujo para colocarla! 🎨",
    sticker_intro: "¡Aquí está tu álbum de calcomanías, {n}! ¡Toca una calcomanía y luego el dibujo para colocarla!",
    sticker_belongs: "¡Perfecto! ¡{x} va en {scene}!",
    off_slot: "Quitar",
    theme_animals: "los animales", theme_food: "las comidas", theme_frozen: "las cosas heladas", theme_ocean: "las cosas del mar",
    kind_animal: "los animales", kind_food: "la comida rica", kind_vehicle: "las cosas que ruedan",
    celeb_done_sub: "⚡ ¡Encontraste la ÚLTIMA Chispa de Estrella! ¡El cohete está listo! 🚀",
    celeb_more_sub: "⚡ ¡Chispa de Estrella! Faltan {left} para arreglar el cohete 🚀",
    quest_onemore: "¡El cohete está arreglado! ¡Juega un juego más para despegar!",
    trip_complete: "¡Viaje #{trips} completo — eres Explorador de Estrellas! {badge}",
    trace_number: "¡Traza el número {x}!", trace_letter: "¡Traza la letra {x}!", trace_shape: "¡Traza {x}!",
    follow_dots: "¡Sigue los puntos!",
    tap_next: "🚀 ¡Toca {next}!", lbl_big: "GRANDE", lbl_small: "pequeño",
    sortcolor_say: "¡Pon cada cosa en la canasta de su color!",
    sortkind_say: "¡Pon cada cosa donde va!",
    tap_part: "¡Toca {part}!",
    yes_part: "¡Sí! ¡{part}!",
    hideseek_show: "¡Ponlo {rel} {spot}!",
    hideseek_say: "¡Pon {buddy} {rel} {spot}!",
    hideseek_retry: "¡Buen intento! ¡Ponlo {rel} {spot}!",
    hideseek_win: "¡{rel} {spot}!",
    hideseek_next: "¡Ahora ponlo {rel} {spot}!",
    hideseek_again: "¡Muy bien! ¡Ahora prueba un lugar diferente!",
    cups_watch: "¡Mira la pelota! ¿A dónde va?",
    cups_find: "¿Dónde está la pelota? ¡Toca el vaso!",
    cups_nope: "¡Ahí no! ¡Mira debajo de otro vaso!",
    cups_retry: "¡Sigue buscando! ¡Encuentra la pelota!",
    cups_win: "¡La encontraste! 🎉",
    rel_in: "dentro de", rel_on: "encima de", rel_under: "debajo de",
    measure_show_taller: "¿Cuál es más ALTO?",
    measure_say_taller: "¿Cuál es más alto? ¡Tócalo!",
    measure_show_shorter: "¿Cuál es más BAJO?",
    measure_say_shorter: "¿Cuál es más bajo? ¡Tócalo!",
    measure_yes_taller: "¡Sí! ¡Más alto!",
    measure_yes_shorter: "¡Sí! ¡Más bajo!",
    measure_no_taller: "¡Ese es más bajo! ¡Busca el más alto!",
    measure_no_shorter: "¡Ese es más alto! ¡Busca el más bajo!"
  },
  yue: {
    num: ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
    praise: ["做得好好呀，{n}！", "太正喇！", "好犀利呀！", "好嘢！", "你做到喇，{n}！", "超級叻！", "好棒呀！", "耶！"],
    blastoff: "發射喇！",
    well_done: "你做到喇，{n}！",
    hi_let_play: "你好呀，{n}！我哋一齊玩啦！",
    hi_star_sparks: "你好呀，{n}！搵星星火花整好火箭。撳個世界啦！",
    narrator_back: "歡迎返嚟，{n}！🌈",
    narrator_ready: "今日想去邊度玩呀，{n}？🗺️",
    narrator_postgame: "好犀利！下一個玩咩呀，{n}？⭐",
    narrator_new_world: "睇下呀，{n}！{w}有新嘢玩喇！✨",
    new_badge: "新遊戲!",
    narrator_cat_num: "我哋嚟數數啦！🔢",
    narrator_cat_shape: "顏色同形狀！🎨",
    narrator_cat_brain: "動下腦筋啦！🧩",
    narrator_cat_animal: "動物朋友！🐾",
    narrator_cat_pets: "小寵物要我哋幫手喇！🐶",
    narrator_cat_space: "三、二、一……發射！🚀",
    narrator_cat_fantasy: "入去幻想世界！🐉",
    narrator_cat_create: "我哋嚟創作啦！✨",
    quest_fixed: "火箭整好喇！準備發射啦！",
    quest_fixed_praise: "好嘢，{n}！你搵到最後一粒星星火花！火箭整好喇！我哋發射啦！",
    quest_collect: "好嘢！你儲到一粒星星火花，{n}！仲差{left}粒就整好火箭！",
    quest_status: "我哋一齊儲星星火花整好火箭！仲差{left}粒。撳一個世界玩啦！",
    quest_ready: "火箭整好喇！撳佢發射啦！",
    settings_lang: "語言",
    settings_voice: "說話聲音",
    settings_music: "音樂",
    settings_diff: "難度",
    settings_buddy: "🧸 夥伴",
    settings_name: "✏️ 名",
    settings_progress: "📊 進度",
    settings_reset: "重設星星",
    settings_restart: "🔄 重新開始",
    settings_restart_confirm: "呢個會清除{n}所有嘅星星、貼紙同進度。你肯定嗎？",
    settings_reset_confirm: "清除{n}所有嘅星星同貼紙？",
    settings_hold_hint: "大人：撳住個掣先可以開設定。",
    party_node: "派對！",
    party_intro: "係{world}派對呀！我哋玩三個遊戲啦！",
    party_done: "好正嘅{world}派對！你全部都玩晒喇！",
    narrator_party: "條路盡頭有個派對呀！",
    parent_gate: "大人核對：{a} + {b} 等於幾多？",
    settings_done: "完成",
    back: "返去", next: "下一個", home: "首頁", clear: "清除", done: "完成",
    big: "大！", small: "細！",
    try_again: "再試多次啦！",
    look_at_pattern: "睇下個規律！",
    yes_it: "啱喇！{animal}會{sound}叫！",
    found_it: "啱喇！你搵到{item}喇！",
    all_sorted: "全部分好喇！",
    found_all: "你全部搵晒喇！",
    match: "啱一對！兩{item}！",
    beautiful_music: "好好聽嘅音樂！",
    traced_it: "你描好喇！",
    yummy: "好味呀！",
    fed_all: "{count}{item}！好好食！",
    hatched_all: "{count}隻恐龍BB！",
    icecream_finish: "好味嘅{count}球雪糕！",
    pet_clean: "全部乾淨晒！",
    pet_yum: "好好食！",
    pet_whee: "好開心呀！",
    pet_happy: "{animal}好開心呀！",
    pet_sad: "{animal}好似好唔開心😢 我哋幫下佢啦！",
    pet_feels_clean: "好嘢！{animal}覺得好乾淨好舒服！🫧",
    pet_feels_fed: "好味！{animal}唔肚餓喇！😋",
    pet_feels_played: "好開心！{animal}玩得好高興！🎾",
    pet_feels_cuddled: "啊！{animal}覺得好被愛！💞",
    pet_kind: "{animal}宜家好開心！💖 你好錫佢呀！",
    settings_title: "⚙️ 大人設定",
    lang_en: "English", lang_es: "Español", lang_yue: "廣東話",
    diff_auto: "自動 ⬆️", diff_easy: "簡單", diff_med: "中等", diff_hard: "困難",
    diff_title: "大人：揀個難度！", diff_say: "幫小朋友揀個難度啦。",
    diff_easy_age: "2-3歲", diff_med_age: "3-4歲", diff_hard_age: "4-5歲",
    voice_on: "開", voice_off: "關",
    music_bouncy: "活潑", music_calm: "寧靜", music_march: "進行曲", music_off: "關",
    rocket_ready: "🚀 火箭準備好喇！",
    rocket_zoomed: "好犀利呀，{n}！火箭飛上咗天空！我哋再搵多啲星星火花啦！",
    tap_count: "撳{count}{x}！",
    you_counted: "{num}！你數到{count}喇！",
    tap_fish: "撳{x}嗰條魚！",
    goodtry_fish: "再試下！搵{x}嗰條魚！",
    drag_pizza_show: "將{x}拖去個薄餅度！",
    drag_pizza_say: "搵{x}，拖去個薄餅度！",
    shape_fits: "好味！{x}啱啱好！",
    thats_look: "嗰個係{x}！搵{y}！",
    put_pizza: "放{count}{x}喺個薄餅度！",
    placed_pizza: "{num}！{count}{x}！",
    drag_topping: "將{color}嘅配料拖去個薄餅度！",
    color_excl: "{color}！",
    thats_find_one: "嗰個係{color}！搵{color2}嗰個！",
    pop_balloon_show: "撳爆{target}號氣球！",
    pop_balloon_say: "撳爆寫住{target}嘅氣球！",
    thats_that_num: "{num}！嗰個係{target}！",
    thats_find_num: "嗰個係{num}號。搵{target}號！",
    put_base: "放{count}{x}喺{base}！",
    fed_count: "{num}！{count}{x}！好味呀！",
    new_shapes: "新形狀！我哋嚟描下啦！",
    matching_show: "搵出相同嘅一對！",
    matching_say: "搵相同嘅{x}！撳張卡反開佢！",
    listen_show: "聽下啲動物！",
    listen_say: "聽下動物樂隊啦！",
    yourturn_show: "到你玩喇！撳啲發光嘅動物！",
    yourturn_say: "到你喇！撳啲發光嘅動物！",
    who_show: "邊個發出呢個聲呀？",
    who_say: "聽下！邊個發出呢個聲呀？",
    countdown_show: "倒數啦！撳{next}！",
    countdown_say: "我哋倒數準備發射！撳{next}號！",
    blastoff_screen: "🚀 發射喇！🌟",
    find_num: "搵{next}號！",
    sortsize_show: "按大細分類！",
    sortsize_say: "將大嘅拖去大星球，細嘅拖去細星球！",
    that_big: "嗰個係大嘅！放去大星球！",
    that_small: "嗰個係細嘅！放去細星球！",
    sortcolor_show: "按顏色分類！",
    sortkind_show: "分類啦！",
    sorted_one: "{x}！",
    that_basket: "嗰個係{x}。搵{x}個籃！",
    goes_with: "嗰個同{x}一齊！",
    next_show: "下一個係咩呀？",
    next_say: "睇下個規律！下一個係咩呀？",
    try_pattern: "再試多次！睇下個規律！",
    feed_dragon_show: "餵{count}{x}俾條龍食！",
    eggs_show: "撳{count}{x}，孵化啲恐龍！",
    eggs_say: "撳{count}{x}，孵出恐龍BB！",
    flash_look: "睇住啲蛋！", flash_look_say: "睇清楚！數下啲蛋！",
    flash_ask: "有幾多隻蛋呀？", flash_ask_say: "你見到幾多隻蛋呀？",
    flash_win: "{count}隻蛋！你記得喇！", flash_peek: "再睇多次！",
    scoop_show: "加一球{x}雪糕！",
    scoop_say: "喺上面加一球{x}雪糕！",
    thats_find_scoop: "嗰個係{color}！搵{color2}嗰球！",
    scoop_count: "{color}！{num}{x}！",
    cherry_show: "撳上面粒車厘子！",
    cherry_say: "撳粒車厘子，整好個雪糕！",
    yummy_cherry: "好味！喺上面加粒車厘子啦！",
    tap_pet: "撳{x}！",
    yes_pet: "啱喇！{x}！",
    lookfor_pet: "搵下{x}！",
    takecare_show: "照顧下{x}！",
    takecare_say: "照顧下{x}！同佢沖涼、餵佢食嘢、俾玩具佢玩！",
    takecare_sad: "{animal}好似好唔開心😢 你可唔可以令佢開心啲呀？",
    give_pet_show: "俾{count}{x}{animal}食！",
    same_pet_show: "俾{right}同{left}一樣多嘅零食！",
    same_pet_say: "俾{right}同{left}一樣咁多嘅零食！",
    same_pet_win: "兩邊都係{count}！一樣咁多！",
    count_x: "{count}{x}！",
    paint_intro: "我哋嚟畫畫啦！揀個顏色，用手指畫，{n}！",
    paint_color_q: "你可唔可以用{color}畫呀？",
    paint_stamp_q: "你可唔可以喺幅畫度加個{x}呀？",
    paint_outline_q: "我哋嚟畫{x}啦！",
    paint_finish: "好靚嘅畫！",
    paint_stamp_win: "好嘢！一個{x}！",
    dash_title: "📊 大人進度",
    dash_stars: "星星", dash_played: "玩過嘅遊戲", dash_stickers: "貼紙",
    dash_tried: "試過嘅活動", dash_trips: "火箭旅程", dash_sparks: "星星火花",
    dressup_intro: "我哋嚟換衫啦！喺下面揀件嘢著上身，{n}！",
    cool_look: "好有型呀！",
    story_find: "搵唔搵到{x}呀？撳佢啦！",
    story_tap: "👆 撳幅圖！",
    story_end: "故事完喇！{n}，晚安！",
    name_title: "你好呀！你叫咩名呀？", name_ph: "輸入個名…",
    name_start: "開始玩啦！🎉", name_skip: "暫時跳過",
    char_title: "揀你嘅夥伴！", char_done: "出發啦！🎉",
    hub_title: "🌈 {n}嘅世界 🌈", book_title: "📒 {n}嘅貼紙簿 📒",
    sticker_empty_hint: "玩遊戲賺貼紙嚟裝飾啦！",
    sticker_empty_say: "玩遊戲賺貼紙啦！",
    sticker_hint: "撳一張貼紙，再撳幅圖貼上去！🎨",
    sticker_intro: "呢本係你嘅貼紙簿，{n}！撳一張貼紙，再撳幅圖貼上去！",
    sticker_belongs: "啱晒！{x}應該喺{scene}度！",
    off_slot: "關",
    theme_animals: "動物", theme_food: "食物", theme_frozen: "冰雪嘢", theme_ocean: "海洋嘢",
    kind_animal: "動物", kind_food: "好味嘅食物", kind_vehicle: "識郁嘅嘢",
    celeb_done_sub: "⚡ 你搵到最後一粒星星火花！火箭準備好喇！🚀",
    celeb_more_sub: "⚡ 儲到星星火花！仲差{left}粒就整好火箭 🚀",
    quest_onemore: "火箭整好喇！再玩多一個遊戲就可以發射！",
    trip_complete: "第{trips}次旅程完成——你係星星探險家！{badge}",
    trace_number: "描下{x}字！", trace_letter: "描下{x}字母！", trace_shape: "描下{x}！",
    follow_dots: "跟住啲點畫！",
    tap_next: "🚀 撳{next}！", lbl_big: "大", lbl_small: "細",
    sortcolor_say: "將每樣嘢放入同顏色嘅籃度！",
    sortkind_say: "將每樣嘢放返去啱嘅地方！",
    tap_part: "撳{part}！",
    yes_part: "啱喇！{part}！",
    hideseek_show: "放佢喺{spot}{rel}！",
    hideseek_say: "將{buddy}放喺{spot}{rel}！",
    hideseek_retry: "好嘅嘗試！放佢喺{spot}{rel}！",
    hideseek_win: "喺{spot}{rel}！",
    hideseek_next: "宜家放佢喺{spot}{rel}！",
    hideseek_again: "好嘢！宜家試下另一個位置啦！",
    cups_watch: "睇住個波呀！個波去咗邊？",
    cups_find: "個波喺邊呀？撳個杯啦！",
    cups_nope: "唔喺度！睇下另一個杯！",
    cups_retry: "繼續搵！搵個波出嚟！",
    cups_win: "你搵到喇！🎉",
    rel_in: "入面", rel_on: "上面", rel_under: "下面",
    measure_show_taller: "邊個高啲？",
    measure_say_taller: "邊個高啲呀？撳佢啦！",
    measure_show_shorter: "邊個矮啲？",
    measure_say_shorter: "邊個矮啲呀？撳佢啦！",
    measure_yes_taller: "啱喇！高啲！",
    measure_yes_shorter: "啱喇！矮啲！",
    measure_no_taller: "嗰個矮啲！搵高啲嗰個！",
    measure_no_shorter: "嗰個高啲！搵矮啲嗰個！"
  }
};

function t(key, params = {}) {
  const lang = curLang();
  let str = (DICT[lang] && DICT[lang][key]) || DICT["en"][key] || key;
  if (Array.isArray(str)) str = rand(str);
  params.n = NAME;
  for (const k in params) str = str.split(`{${k}}`).join(params[k]);
  return str;
}
const praise = () => t("praise");

/* ===== Content vocabulary (gendered nouns) for grammar-correct Spanish =====
   key = the English token already used in game data. es = Spanish noun, g = gender
   (m/f) for article + adjective agreement, espl = irregular/multiword Spanish plural. */
const VOC = {
  // shapes
  circle:{es:"círculo",g:"m"}, square:{es:"cuadrado",g:"m"}, triangle:{es:"triángulo",g:"m"},
  star:{es:"estrella",g:"f"}, heart:{es:"corazón",g:"m"}, oval:{es:"óvalo",g:"m"}, diamond:{es:"diamante",g:"m"},
  // animals (Who Says / band / pets)
  dog:{es:"perro",g:"m"}, cat:{es:"gato",g:"m"}, cow:{es:"vaca",g:"f"}, frog:{es:"rana",g:"f"},
  duck:{es:"pato",g:"m"}, sheep:{es:"oveja",g:"f"}, bird:{es:"pájaro",g:"m"}, lion:{es:"león",g:"m"},
  pig:{es:"cerdo",g:"m"}, horse:{es:"caballo",g:"m"},
  puppy:{es:"perrito",g:"m"}, kitten:{es:"gatito",g:"m"}, kitty:{es:"gatito",g:"m"}, bunny:{es:"conejito",g:"m"},
  hamster:{es:"hámster",g:"m"}, birdie:{es:"pajarito",g:"m"}, fishy:{es:"pececito",g:"m"}, pony:{es:"poni",g:"m"},
  butterfly:{es:"mariposa",g:"f"}, penguin:{es:"pingüino",g:"m"},
  // snow critters
  snowflake:{es:"copo de nieve",g:"m",espl:"copos de nieve"}, snowman:{es:"muñeco de nieve",g:"m",espl:"muñecos de nieve"},
  mitten:{es:"mitón",g:"m"}, reindeer:{es:"reno",g:"m"}, present:{es:"regalo",g:"m"},
  // pasta / food nouns
  meatball:{es:"albóndiga",g:"f"}, cookie:{es:"galleta",g:"f"}, blueberry:{es:"arándano",g:"m"},
  cherry:{es:"cereza",g:"f"}, strawberry:{es:"fresa",g:"f"}, grape:{es:"uva",g:"f"}, carrot:{es:"zanahoria",g:"f"},
  donut:{es:"dona",g:"f"}, egg:{es:"huevo",g:"m"}, banana:{es:"guineo",g:"m"}, cupcake:{es:"pastelito",g:"m"},
  pizza:{es:"pizza",g:"f"}, "ice cream":{es:"helado",g:"m"},
  // food bases
  spaghetti:{es:"espagueti",g:"m"}, plate:{es:"plato",g:"m"}, pancake:{es:"panqueque",g:"m"}, cake:{es:"pastel",g:"m"},
  // pizza toppings
  mushroom:{es:"champiñón",g:"m"}, olive:{es:"aceituna",g:"f"}, pepper:{es:"pimiento",g:"m"},
  // ocean / frozen memory items
  fish:{es:"pez",g:"m"}, dolphin:{es:"delfín",g:"m"}, shell:{es:"concha",g:"f"}, wave:{es:"ola",g:"f"},
  starfish:{es:"estrella de mar",g:"f",espl:"estrellas de mar"}, crab:{es:"cangrejo",g:"m"},
  octopus:{es:"pulpo",g:"m"}, turtle:{es:"tortuga",g:"f"},
  crown:{es:"corona",g:"f"}, castle:{es:"castillo",g:"m"}, sparkle:{es:"destello",g:"m"}, skate:{es:"patín",g:"m"},
  // body parts
  head:{es:"cabeza",g:"f"}, hand:{es:"mano",g:"f"}, foot:{es:"pie",g:"m"},
  eye:{es:"ojo",g:"m"}, nose:{es:"nariz",g:"f"}, mouth:{es:"boca",g:"f"},
  ear:{es:"oreja",g:"f"}, tummy:{es:"panza",g:"f"}, knee:{es:"rodilla",g:"f"},
  elbow:{es:"codo",g:"m"}, shoulder:{es:"hombro",g:"m"}, hair:{es:"pelo",g:"m"},
  arm:{es:"brazo",g:"m"}, leg:{es:"pierna",g:"f"}, finger:{es:"dedo",g:"m"},
  toe:{es:"dedo del pie",g:"m"}, teeth:{es:"dientes",g:"m"}, neck:{es:"cuello",g:"m"},
  tongue:{es:"lengua",g:"f"}, chin:{es:"barbilla",g:"f"}, cheek:{es:"mejilla",g:"f"},
  // misc
  treat:{es:"premio",g:"m"}, scoop:{es:"bola",g:"f"}, flower:{es:"flor",g:"f"}, dino:{es:"dino",g:"m"},
  // buddies (used in hide & seek "put {buddy} …")
  snowman:{es:"muñeco de nieve",g:"m"}, princess:{es:"princesa",g:"f"}, unicorn:{es:"unicornio",g:"m"},
  robot:{es:"robot",g:"m"}, bear:{es:"oso",g:"m"}, dragon:{es:"dragón",g:"m"},
  // hiding spots (hide & seek). These sat in DICT.en as objects, where word() and
  // genderOf() never look, so Spanish said "el basket" instead of "la canasta".
  basket:{es:"canasta",g:"f"}, box:{es:"caja",g:"f"}, table:{es:"mesa",g:"f"}
,
  // sticker nouns (sticker book "this belongs here" moment)
  balloon:{es:"globo",g:"m"}, bike:{es:"bicicleta",g:"f"}, fox:{es:"zorro",g:"m"},
  rainbow:{es:"arcoíris",g:"m"}, flamingo:{es:"flamenco",g:"m"}, rocket:{es:"cohete",g:"m"},
  planet:{es:"planeta",g:"m"}, moon:{es:"luna",g:"f"}, bow:{es:"lazo",g:"m"},
  parrot:{es:"loro",g:"m"}
};
const COLOR_ES = { red:"rojo", blue:"azul", yellow:"amarillo", green:"verde", orange:"naranja",
  purple:"morado", pink:"rosa", brown:"marrón", gray:"gris", black:"negro", white:"blanco" };
const COLOR_YUE = { red:"紅色", blue:"藍色", yellow:"黃色", green:"綠色", orange:"橙色",
  purple:"紫色", pink:"粉紅色", brown:"啡色", gray:"灰色", black:"黑色", white:"白色" };
const ANIMAL_YUE = { dog:"汪汪", cat:"喵喵", cow:"哞哞", frog:"呱呱", duck:"嘎嘎",
  sheep:"咩咩", bird:"啾啾", lion:"吼吼", pig:"哼哼", horse:"嘶嘶" };
/* Cantonese vocabulary: yue = noun, cl = measure word (classifier). Parallel to VOC so the
   classifier-aware helpers below can compose grammatical Cantonese (e.g. 三 + 粒 + 星星). */
const VOC_YUE = {
  circle:{cl:"個",yue:"圓形"}, square:{cl:"個",yue:"正方形"}, triangle:{cl:"個",yue:"三角形"},
  star:{cl:"粒",yue:"星星"}, heart:{cl:"個",yue:"心心"}, oval:{cl:"個",yue:"橢圓形"}, diamond:{cl:"個",yue:"菱形"},
  dog:{cl:"隻",yue:"狗"}, cat:{cl:"隻",yue:"貓"}, cow:{cl:"隻",yue:"牛"}, frog:{cl:"隻",yue:"青蛙"},
  duck:{cl:"隻",yue:"鴨仔"}, sheep:{cl:"隻",yue:"綿羊"}, bird:{cl:"隻",yue:"雀仔"}, lion:{cl:"隻",yue:"獅子"},
  pig:{cl:"隻",yue:"豬"}, horse:{cl:"隻",yue:"馬"},
  puppy:{cl:"隻",yue:"小狗"}, kitten:{cl:"隻",yue:"小貓"}, kitty:{cl:"隻",yue:"小貓"}, bunny:{cl:"隻",yue:"兔仔"},
  hamster:{cl:"隻",yue:"倉鼠"}, birdie:{cl:"隻",yue:"雀仔"}, fishy:{cl:"條",yue:"魚仔"}, pony:{cl:"隻",yue:"小馬"},
  butterfly:{cl:"隻",yue:"蝴蝶"}, penguin:{cl:"隻",yue:"企鵝"},
  snowflake:{cl:"片",yue:"雪花"}, snowman:{cl:"個",yue:"雪人"}, mitten:{cl:"隻",yue:"手套"},
  reindeer:{cl:"隻",yue:"馴鹿"}, present:{cl:"份",yue:"禮物"},
  meatball:{cl:"粒",yue:"丸"}, cookie:{cl:"嚿",yue:"曲奇"}, blueberry:{cl:"粒",yue:"藍莓"},
  cherry:{cl:"粒",yue:"車厘子"}, strawberry:{cl:"粒",yue:"士多啤梨"}, grape:{cl:"粒",yue:"提子"}, carrot:{cl:"條",yue:"紅蘿蔔"},
  donut:{cl:"個",yue:"冬甩"}, egg:{cl:"隻",yue:"蛋"}, banana:{cl:"條",yue:"香蕉"}, cupcake:{cl:"個",yue:"紙杯蛋糕"},
  pizza:{cl:"個",yue:"薄餅"}, "ice cream":{cl:"個",yue:"雪糕"},
  spaghetti:{cl:"碟",yue:"意粉"}, plate:{cl:"隻",yue:"碟"}, pancake:{cl:"塊",yue:"班戟"}, cake:{cl:"個",yue:"蛋糕"},
  mushroom:{cl:"粒",yue:"蘑菇"}, olive:{cl:"粒",yue:"橄欖"}, pepper:{cl:"隻",yue:"燈籠椒"},
  fish:{cl:"條",yue:"魚"}, dolphin:{cl:"隻",yue:"海豚"}, shell:{cl:"個",yue:"貝殼"}, wave:{cl:"個",yue:"浪"},
  starfish:{cl:"隻",yue:"海星"}, crab:{cl:"隻",yue:"蟹"}, octopus:{cl:"隻",yue:"八爪魚"}, turtle:{cl:"隻",yue:"龜"},
  crown:{cl:"個",yue:"皇冠"}, castle:{cl:"座",yue:"城堡"}, sparkle:{cl:"點",yue:"閃光"}, skate:{cl:"隻",yue:"溜冰鞋"},
  head:{cl:"個",yue:"頭"}, hand:{cl:"隻",yue:"手"}, foot:{cl:"隻",yue:"腳"}, eye:{cl:"隻",yue:"眼"},
  nose:{cl:"個",yue:"鼻"}, mouth:{cl:"個",yue:"嘴"}, ear:{cl:"隻",yue:"耳仔"}, tummy:{cl:"個",yue:"肚"},
  knee:{cl:"個",yue:"膝頭"}, elbow:{cl:"個",yue:"手踭"}, shoulder:{cl:"個",yue:"膊頭"}, hair:{cl:"把",yue:"頭髮"},
  arm:{cl:"隻",yue:"手臂"}, leg:{cl:"隻",yue:"腳"}, finger:{cl:"隻",yue:"手指"}, toe:{cl:"隻",yue:"腳趾"},
  teeth:{cl:"隻",yue:"牙"}, neck:{cl:"個",yue:"頸"}, tongue:{cl:"條",yue:"脷"}, chin:{cl:"個",yue:"下巴"}, cheek:{cl:"個",yue:"面珠"},
  treat:{cl:"件",yue:"零食"}, scoop:{cl:"球",yue:"雪糕"}, flower:{cl:"朵",yue:"花"}, dino:{cl:"隻",yue:"恐龍"},
  princess:{cl:"位",yue:"公主"}, unicorn:{cl:"隻",yue:"獨角獸"}, robot:{cl:"個",yue:"機械人"}, bear:{cl:"隻",yue:"小熊"}, dragon:{cl:"條",yue:"龍"},
  basket:{cl:"個",yue:"籃"}, box:{cl:"個",yue:"箱"}, table:{cl:"張",yue:"枱"},
  balloon:{cl:"個",yue:"氣球"}, bike:{cl:"架",yue:"單車"}, fox:{cl:"隻",yue:"狐狸"},
  rainbow:{cl:"道",yue:"彩虹"}, flamingo:{cl:"隻",yue:"火烈鳥"}, rocket:{cl:"架",yue:"火箭"},
  planet:{cl:"個",yue:"星球"}, moon:{cl:"個",yue:"月亮"}, bow:{cl:"個",yue:"蝴蝶結"},
  parrot:{cl:"隻",yue:"鸚鵡"}
};
// Cantonese TTS depends on a device-installed zh-HK voice we can't bundle. Detect it; if it's
// absent we fall back to English (text + voice) and prompt the parent to install one.
let cantoVoiceReady = false;
function isCantoVoice(v) {
  const l = (v.lang || "").toLowerCase().replace("_", "-");
  return l === "zh-hk" || l.includes("yue") || l.startsWith("zh-hant-hk") || /cantonese|廣東|粵|sin-?ji/i.test(v.name);
}
function detectCantoVoice() {
  if (!("speechSynthesis" in window)) { cantoVoiceReady = false; return; }
  cantoVoiceReady = speechSynthesis.getVoices().some(isCantoVoice);
}
// effective language: 'yue' only fully engages once a Cantonese voice exists, else 'en'
const curLang = () => (settings.lang === "yue" && !cantoVoiceReady) ? "en" : (settings.lang || "en");
const htmlLang = () => curLang() === "es" ? "es" : curLang() === "yue" ? "zh-HK" : "en";
function relocalize() {                       // re-apply labels when the voice becomes available
  detectCantoVoice();
  if (typeof document !== "undefined") {
    document.documentElement.lang = htmlLang();
    applyI18n();
    if (typeof buildHub === "function" && $("hub") && !$("hub").classList.contains("hidden")) buildHub();
  }
}
if ("speechSynthesis" in window) {
  detectCantoVoice();
  speechSynthesis.addEventListener("voiceschanged", () => { const was = cantoVoiceReady; relocalize(); if (was !== cantoVoiceReady) relocalize(); });
}
function esPlural(w) {
  if (/[aeiouáéíóú]$/i.test(w)) return w + "s";
  if (/z$/i.test(w)) return w.slice(0, -1) + "ces";
  return w.replace(/ón$/, "on").replace(/ín$/, "in").replace(/én$/, "en") + "es";
}
const numWord = n => ((DICT[curLang()] && DICT[curLang()].num) || DICT.en.num)[n] || "";
// Cantonese: classifier (measure word) + noun; no plural inflection, no article.
const yueCls = key => { const v = VOC_YUE[key]; return v ? (v.cl + v.yue) : key; };
function word(key) {                                                                              // bare singular
  if (curLang() === "yue") { const v = VOC_YUE[key]; return v ? v.yue : key; }
  const v = VOC[key]; return (curLang() === "es" && v) ? v.es : key;
}
function words(key, n) {                                                                          // count-agreeing plural
  if (curLang() === "yue") return yueCls(key);            // 粒星星 — the number lives in the template
  const v = VOC[key];
  if (curLang() === "es") return !v ? key : (n === 1 ? v.es : (v.espl || esPlural(v.es)));
  return (v && v.enpl && n !== 1) ? v.enpl : plural(key, n);
}
const genderOf = key => (VOC[key] ? VOC[key].g : "m");
function theWord(key) {                                                                           // "the X"
  if (curLang() === "yue") return yueCls(key);            // 隻小狗 / 個鼻 / 張枱
  return curLang() === "es" ? (genderOf(key) === "f" ? "la " : "el ") + word(key) : "the " + key;
}
const locName = o => !o ? "" : (curLang() === "es" && o.es) ? o.es : (curLang() === "yue" && o.yue) ? o.yue : o.name; // localized data-object name
function applyI18n(root = document) {                                                             // translate static [data-i18n] markup
  root.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  root.querySelectorAll("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
}
function colorName(key) {                                                                          // standalone color
  if (curLang() === "yue") return COLOR_YUE[key] || key;
  return curLang() === "es" ? (COLOR_ES[key] || key) : key;
}
function colorAdj(key, g) {                                                                       // color agreeing with a noun's gender
  if (curLang() === "yue") return COLOR_YUE[key] || key;
  if (curLang() !== "es") return key;
  let c = COLOR_ES[key] || key;
  if (g === "f" && c.endsWith("o")) c = c.slice(0, -1) + "a";
  return c;
}

/* ===== Centralized quest ===== */
const QUEST_GOAL = 6;
let sparks = +(localStorage.getItem("fionaSparks") || 0);
let trips  = +(localStorage.getItem("fionaTrips")  || 0);
let questShown = sparks, questGreeted = false;
const saveQuest = () => { core.save("fionaSparks", sparks); core.save("fionaTrips", trips); };

/* difficulty tier 0..2 for a level */
function ensurePerf(level) {
  if (!perf[level]) perf[level] = { roundsPlayed: 0, roundsNoMistake: 0, roundsWithManyMistakes: 0, emaScore: 0.6 };
  return perf[level];
}
function roundScore(mistakes) {
  if (mistakes <= 0) return 1.0;
  if (mistakes === 1) return 0.75;
  if (mistakes === 2) return 0.5;
  return 0.2;
}
function recordRoundPerf(level, mistakes) {
  const p = ensurePerf(level);
  p.roundsPlayed++;
  if (mistakes === 0) p.roundsNoMistake++;
  if (mistakes >= 3) p.roundsWithManyMistakes++;
  const score = roundScore(mistakes);
  p.emaScore = clamp(p.emaScore * 0.7 + score * 0.3, 0, 1);
  savePerf();
}
function autoTierFor(level) {
  const p = ensurePerf(level);
  // Early sessions: stay conservative and use completion progress gently.
  if (p.roundsPlayed < 4) return clamp(Math.floor((completions[level] || 0) / 2), 0, 1);
  if (p.emaScore >= 0.8) return 2;
  if (p.emaScore >= 0.55) return 1;
  return 0;
}
function tierFor(level) {
  if (settings.diff === "easy") return 0;
  if (settings.diff === "med") return 1;
  if (settings.diff === "hard") return 2;
  return autoTierFor(level);
}

const state = { level: null, round: 0, busy: false, tier: 0 };
let roundMistakes = 0;

/* ================= Mascot ================= */
function mascotSVG() {
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg">
    <path d="M27 116 L8 98" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
    <path d="M14 104 L8 110" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/>
    <g class="armR">
      <path d="M93 116 L112 96" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
      <path d="M104 104 L113 107" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <circle cx="60" cy="128" r="36" fill="#fff" stroke="#dbe9f2" stroke-width="2"/>
    <circle cx="60" cy="120" r="3.2" fill="#26323a"/>
    <circle cx="60" cy="136" r="3.2" fill="#26323a"/>
    <circle cx="60" cy="62" r="26" fill="#fff" stroke="#dbe9f2" stroke-width="2"/>
    <path d="M36 84 Q60 97 84 84 L84 93 Q60 106 36 93 Z" fill="#e63946"/>
    <rect x="66" y="92" width="12" height="22" rx="5" fill="#e63946"/>
    <path d="M38 46 Q60 22 82 46 L82 52 Q60 42 38 52 Z" fill="#2f6fde"/>
    <circle cx="60" cy="28" r="7" fill="#fff" stroke="#dbe9f2" stroke-width="1.5"/>
    <g class="eyes">
      <circle cx="51" cy="57" r="3.4" fill="#26323a"/>
      <circle cx="69" cy="57" r="3.4" fill="#26323a"/>
    </g>
    <circle cx="45" cy="66" r="4" fill="#f8b3c0" opacity=".8"/>
    <circle cx="75" cy="66" r="4" fill="#f8b3c0" opacity=".8"/>
    <polygon points="60,61 60,68 82,65" fill="#f07f13"/>
    <path d="M50 74 Q60 81 70 74" stroke="#26323a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}
function setMascots(cls, on) { document.querySelectorAll(".mascot").forEach(m => m.classList.toggle(cls, on)); }

/* ================= Buddy (choosable guide character) ================= */
// Names carry es/yue so locName() can speak them — a Spanish voice saying "Snowman"
// is the same kind of wrong as the engine spelling out "grown-ups".
const BUDDIES = [
  { id: "snowman", e: "⛄", name: "Snowman", es: "Muñeco de Nieve", yue: "雪人" },
  { id: "dino", e: "🦕", name: "Dino", es: "Dino", yue: "恐龍" },
  { id: "puppy", e: "🐶", name: "Puppy", es: "Perrito", yue: "小狗" },
  { id: "kitty", e: "🐱", name: "Kitty", es: "Gatito", yue: "小貓" },
  { id: "princess", e: "👑", name: "Princess", es: "Princesa", yue: "公主" },
  { id: "unicorn", e: "🦄", name: "Unicorn", es: "Unicornio", yue: "獨角獸" },
  { id: "robot", e: "🤖", name: "Robot", es: "Robot", yue: "機械人" },
  { id: "bear", e: "🧸", name: "Bear", es: "Osito", yue: "小熊" },
  { id: "dragon", e: "🐉", name: "Dragon", es: "Dragón", yue: "龍" }
];
let BUDDY = localStorage.getItem("fionaBuddy") || "snowman";
let charTimer = null;
function buddyMarkup() {
  if (BUDDY === "snowman") return mascotSVG();
  const b = BUDDIES.find(x => x.id === BUDDY) || BUDDIES[0];
  return `<span class="buddy">${b.e}</span>`;
}
function refreshBuddies() {
  ["hubMascot", "gameMascot", "celebMascot", "nameMascot"].forEach(id => { const el = $(id); if (el) el.innerHTML = buddyMarkup(); });
}

/* ================= Speech & sound ================= */
let lastSpeakEnd = 0;
function speak(text, opts = {}) {
  if (!settings.voice || !("speechSynthesis" in window)) { lastSpeakEnd = performance.now(); return; }
  if (!opts.queue) speechSynthesis.cancel();
  // Strip emoji before speaking — TTS reads them as "rainbow", "star", etc.
  const spoken = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s{2,}/g, " ").trim();
  lastSpeakEnd = performance.now() + Math.min(7000, 500 + spoken.length * 72);
  const u = new SpeechSynthesisUtterance(spoken + " ");  // trailing space: stops Chrome clipping the last word
  const lang = curLang();   // 'yue' only when a Cantonese voice exists, else falls back to 'en'
  u.lang = lang === "es" ? "es-MX" : lang === "yue" ? "zh-HK" : "en-US";
  u.rate = opts.rate || 0.95;
  u.pitch = opts.pitch || 1.25;

  // Find a matching voice if possible (browser support varies)
  const voices = speechSynthesis.getVoices();
  const v = lang === "yue"
    ? voices.find(isCantoVoice)
    : voices.find(v => v.lang.startsWith(lang === "es" ? "es" : "en") && (v.name.includes("Google") || v.localService));
  if (v) u.voice = v;

  setMascots("talking", true);
  
  const stopTalk = () => {
    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
      setMascots("talking", false);
    }
  };
  u.onend = stopTalk; u.onerror = stopTalk;
  core.wait(() => setMascots("talking", false), Math.min(11000, 700 + text.length * 95));
  speechSynthesis.speak(u);
  // keep-alive: Chrome silently stops synthesis after ~15s unless nudged
  core.repeat(() => {
    if (speechSynthesis.speaking) speechSynthesis.resume();
  }, 4000);
}
// wait roughly as long as the praise takes to speak (capped) before running cb — so it's never cut off
function waitSpeech(cb, opts = {}) {
  const min = opts.min != null ? opts.min : 900, cap = opts.cap != null ? opts.cap : 4500;
  const wait = clamp(lastSpeakEnd - performance.now(), min, cap);
  core.wait(cb, wait);
}

let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function tone(freq, start, dur, type = "sine", vol = 0.22) {
  const ctx = audio(), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur);
}
// "Plump" voice — one filtered oscillator with a glide + soft attack/decay so taps
// sound round & organic instead of beepy. Pitch and lowpass cutoff both swoop.
function voice(o) {
  const ctx = audio(), t0 = ctx.currentTime + (o.start || 0), dur = o.dur;
  const osc = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
  f.type = "lowpass";
  f.frequency.setValueAtTime(o.cut || 2600, t0);
  if (o.cut1) f.frequency.exponentialRampToValueAtTime(o.cut1, t0 + dur);
  const v = o.vol == null ? 0.2 : o.vol, atk = o.atk || 0.012;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + atk);            // soft attack (no click)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);       // smooth decay
  osc.connect(f).connect(g).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.03);
}
const sfx = {
  // soft organic bubble "pop" — body + a quieter sub-octave for roundness
  tap()  { voice({ type:"sine", f0:430, f1:760, dur:.13, cut:1700, cut1:3200, vol:.22, atk:.006 });
           voice({ type:"triangle", f0:215, f1:380, dur:.13, cut:1300, vol:.09, atk:.006 }); },
  tick() { voice({ type:"sine", f0:900, f1:1160, dur:.07, cut:3000, vol:.09 }); },
  // rich ascending magical chime: stacked sine+triangle, then a high sparkle
  good() { [523.25, 659.25, 784, 1046.5].forEach((fr, i) => {
             voice({ type:"sine", f0:fr, dur:.34, start:i*.085, cut:4200, vol:.16, atk:.01 });
             voice({ type:"triangle", f0:fr, dur:.30, start:i*.085, cut:2600, vol:.07 }); });
           voice({ type:"sine", f0:1568, f1:2093, dur:.5, start:.34, cut:6000, vol:.10 }); },
  // soft wooden-block "tock" for invalid taps — gentle, never harsh
  bad()  { voice({ type:"triangle", f0:300, f1:150, dur:.16, cut:1100, cut1:480, vol:.16, atk:.004 });
           voice({ type:"sine", f0:150, f1:90, dur:.16, cut:700, vol:.09, atk:.004 }); },
  win()  { [523.25, 659.25, 784, 1046.5, 1318.5].forEach((fr, i) => {
             voice({ type:"sine", f0:fr, dur:.42, start:i*.11, cut:5000, vol:.16, atk:.01 });
             voice({ type:"triangle", f0:fr, dur:.38, start:i*.11, cut:2800, vol:.07 }); });
           voice({ type:"sine", f0:2093, dur:.6, start:.58, cut:7000, vol:.10 }); }
};
const baseBad = sfx.bad;
sfx.bad = function (...args) {
  roundMistakes++;
  return baseBad.apply(this, args);
};

// selectable background music styles — each tune is [freq, beats]
const MUSIC = {
  bouncy: {
    beat: 300, wave: "triangle", bass: true, boing: true, tunes: [
      [[523, 1], [523, 1], [784, 1], [659, 1], [523, 1], [587, 1], [659, 2], [0, 1], [440, 1], [392, 1], [330, 1], [392, 2], [0, 1]],
      [[392, 1], [440, 1], [523, 1], [440, 1], [392, 1], [330, 1], [392, 2], [523, 1], [494, 1], [440, 1], [392, 2], [0, 1]],
      [[659, 1], [587, 1], [523, 1], [587, 1], [659, 1], [659, 2], [587, 1], [587, 1], [587, 2], [659, 1], [784, 1], [784, 2], [0, 1]]
    ]
  },
  calm: {
    beat: 540, wave: "sine", bass: false, boing: false, tunes: [
      [[392, 2], [440, 2], [523, 2], [440, 2], [349, 2], [392, 4], [0, 2]],
      [[523, 2], [494, 2], [440, 2], [392, 4], [440, 2], [392, 4], [0, 2]],
      [[330, 2], [392, 2], [440, 2], [392, 2], [330, 4], [294, 4], [0, 2]]
    ]
  },
  march: {
    beat: 250, wave: "square", bass: true, boing: false, tunes: [
      [[392, 1], [392, 1], [523, 1], [392, 1], [330, 1], [392, 1], [262, 2], [0, 1]],
      [[440, 1], [440, 1], [440, 1], [349, 1], [523, 1], [523, 2], [0, 1]],
      [[523, 1], [392, 1], [523, 1], [659, 1], [523, 1], [392, 1], [523, 2], [0, 1]]
    ]
  }
};
/* ================= Signature cues =================
   The sound a game makes when she gets it right. Every game used the same universal
   `good()` chime, so thirty-eight different activities were acoustically identical —
   nothing told her ear which world she was in.

   A shared palette rather than per-game invention: a game picks one by name in
   `registerGame({ cue: "splash" })`, and roundComplete() plays it. Keeping it to a
   vocabulary means they stay in the same family and none of them can be harsh, which
   an ad-hoc sound per game would not guarantee. */
const CUES = {
  // water & air
  splash: () => { voice({ type: "sine", f0: 900, f1: 300, dur: .20, cut: 2400, cut1: 700, vol: .16, atk: .004 });
                  voice({ type: "triangle", f0: 420, f1: 160, dur: .26, cut: 1200, vol: .09 }); },
  bubble: () => { [520, 700, 940].forEach((f, i) => voice({ type: "sine", f0: f, f1: f * 1.5, dur: .11, start: i * .07, cut: 2600, vol: .12 })); },
  whoosh: () => { voice({ type: "triangle", f0: 260, f1: 1500, dur: .30, cut: 900, cut1: 4200, vol: .12, atk: .05 }); },
  // bright & sparkling
  chime:  () => { [784, 1046.5, 1318.5].forEach((f, i) => voice({ type: "sine", f0: f, dur: .34, start: i * .07, cut: 5200, vol: .14, atk: .01 })); },
  sparkle:() => { [1318.5, 1760, 2093].forEach((f, i) => voice({ type: "sine", f0: f, f1: f * 1.18, dur: .22, start: i * .05, cut: 6500, vol: .10 })); },
  bell:   () => { voice({ type: "sine", f0: 1046.5, dur: .55, cut: 5000, vol: .15, atk: .008 });
                  voice({ type: "sine", f0: 1568, dur: .40, start: .04, cut: 6000, vol: .07 }); },
  // warm & wooden
  pop:    () => { voice({ type: "sine", f0: 380, f1: 880, dur: .12, cut: 2200, cut1: 3600, vol: .18, atk: .004 });
                  voice({ type: "triangle", f0: 190, f1: 440, dur: .14, cut: 1400, vol: .08 }); },
  wood:   () => { voice({ type: "triangle", f0: 640, f1: 520, dur: .16, cut: 1800, vol: .16, atk: .003 });
                  voice({ type: "sine", f0: 320, f1: 260, dur: .18, cut: 900, vol: .08 }); },
  drum:   () => { voice({ type: "sine", f0: 200, f1: 90, dur: .22, cut: 700, vol: .18, atk: .003 });
                  voice({ type: "triangle", f0: 400, f1: 180, dur: .12, cut: 1600, vol: .07 }); },
  // creatures
  chirp:  () => { voice({ type: "sine", f0: 1500, f1: 2200, dur: .10, cut: 4600, vol: .14 });
                  voice({ type: "sine", f0: 1900, f1: 2500, dur: .09, start: .12, cut: 4600, vol: .11 }); },
  purr:   () => { voice({ type: "triangle", f0: 210, f1: 260, dur: .34, cut: 900, vol: .14, atk: .04 });
                  voice({ type: "sine", f0: 420, f1: 520, dur: .28, start: .06, cut: 1600, vol: .07 }); },
  roar:   () => { voice({ type: "sawtooth", f0: 150, f1: 240, dur: .34, cut: 620, cut1: 1100, vol: .13, atk: .03 }); },
  // machines & journeys
  engine: () => { voice({ type: "sawtooth", f0: 120, f1: 300, dur: .40, cut: 700, cut1: 1600, vol: .12, atk: .04 }); },
  rocket: () => { voice({ type: "sawtooth", f0: 90, f1: 420, dur: .55, cut: 600, cut1: 2400, vol: .13, atk: .06 });
                  voice({ type: "sine", f0: 1200, f1: 2400, dur: .35, start: .2, cut: 6000, vol: .07 }); },
};

// The cue a game declared, or the universal chime if it somehow has none.
function playCue(levelId) {
  const def = GAME_REGISTRY.find(g => g.id === levelId);
  const cue = def && CUES[def.cue];
  (cue || sfx.good)();
}

/* ================= Ambience =================
   A quiet, continuous bed under each world. Audio was the app's coldest axis: five
   one-shot cues and three tunes across thirty-eight games, and nothing at all in
   between them — which is a large part of why the screens felt as empty as they
   looked.

   It keys off the same seven biomes the scene kit uses (`scene.forLevel`), so a game
   gets its sound for free the moment it has a theme, with no per-game work.

   Two layers: a filtered noise bed that sways slowly (water, wind, room tone), and
   sparse one-shot details on a random interval (a bubble, a distant bird). Both sit
   far under the speaking voice — per BAR-CONFIG the calm path matters more than the
   atmosphere, so this must never compete with an instruction. */
const AMBIENCE = {
  reef:    { noise: "brown", cut: 480,  vol: .050, sway: [.05, 170],
             detail: { gap: [2.5, 6], play: () => voice({ type: "sine", f0: 380, f1: 900, dur: .22, cut: 1400, vol: .05, atk: .01 }) } },
  snow:    { noise: "pink",  cut: 900,  vol: .034, sway: [.03, 420],
             detail: { gap: [5, 11],  play: () => voice({ type: "sine", f0: 1500, f1: 1900, dur: .5, cut: 3400, vol: .022, atk: .12 }) } },
  meadow:  { noise: "pink",  cut: 1100, vol: .030, sway: [.04, 380],
             // two quick rising notes: a bird, not a melody
             detail: { gap: [3, 8], play: () => { voice({ type: "sine", f0: 1750, f1: 2300, dur: .10, cut: 4200, vol: .05 });
                                                  voice({ type: "sine", f0: 2100, f1: 2600, dur: .09, start: .13, cut: 4200, vol: .042 }); } } },
  forest:  { noise: "pink",  cut: 820,  vol: .036, sway: [.05, 300],
             detail: { gap: [3.5, 9], play: () => { voice({ type: "triangle", f0: 1250, f1: 1500, dur: .12, cut: 3000, vol: .045 });
                                                    voice({ type: "triangle", f0: 1500, f1: 1180, dur: .14, start: .15, cut: 3000, vol: .038 }); } } },
  savanna: { noise: "brown", cut: 620,  vol: .040, sway: [.035, 500],
             detail: { gap: [5, 12], play: () => voice({ type: "sine", f0: 240, f1: 180, dur: .55, cut: 900, vol: .035, atk: .1 }) } },
  space:   { noise: "brown", cut: 260,  vol: .034, sway: [.02, 700],
             detail: { gap: [4, 10], play: () => voice({ type: "sine", f0: 900, f1: 1700, dur: .7, cut: 5000, vol: .026, atk: .25 }) } },
  cozy:    { noise: "brown", cut: 380,  vol: .028, sway: [.025, 600],
             detail: { gap: [6, 13], play: () => voice({ type: "sine", f0: 520, f1: 470, dur: .45, cut: 1200, vol: .022, atk: .15 }) } },
};

const ambience = {
  src: null, gain: null, lfo: null, timer: null, biome: null, buf: null,

  // One noise buffer, generated once and looped. Brown is heavier and reads as water
  // or a room; pink is airier and reads as wind.
  buffer(ctx, kind) {
    if (this.buf && this.buf.kind === kind) return this.buf.b;
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = kind === "brown" ? (last + 0.02 * w) / 1.02 : (last * 0.86 + w * 0.14);
      d[i] = last * (kind === "brown" ? 3.2 : 1.6);
    }
    this.buf = { kind, b };
    return b;
  },

  start(biome) {
    if (settings.music === "off") return;      // the music control governs all background sound
    const a = AMBIENCE[biome] || AMBIENCE.meadow;
    if (this.biome === biome && this.src) return;             // already running this world
    this.stop();
    this.biome = biome;
    let ctx;
    try { ctx = audio(); } catch (_) { return; }              // no audio yet: stay silent, try again later
    const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.buffer(ctx, a.noise);
    src.loop = true;
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(a.cut, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(a.vol, ctx.currentTime + 1.6);   // fade in, never a click
    // a slow sway on the cutoff: waves, or breath in the wind
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.setValueAtTime(a.sway[0], ctx.currentTime);
    lg.gain.setValueAtTime(a.sway[1], ctx.currentTime);
    lfo.connect(lg).connect(filt.frequency);
    src.connect(filt).connect(g).connect(ctx.destination);
    src.start(); lfo.start();
    this.src = src; this.gain = g; this.lfo = lfo;
    this.schedule(a);
  },

  // sparse one-shots on top of the bed
  schedule(a) {
    if (!a.detail) return;
    const [lo, hi] = a.detail.gap;
    this.timer = core.wait(() => {
      if (this.src && settings.music !== "off") { try { a.detail.play(); } catch (_) {} }
      if (this.src) this.schedule(a);
    }, (lo + Math.random() * (hi - lo)) * 1000);
  },

  stop() {
    if (this.timer) { clearTimeout(this.timer); core.timers.delete(this.timer); this.timer = null; }
    const src = this.src, g = this.gain, lfo = this.lfo;
    this.src = this.gain = this.lfo = null; this.biome = null;
    if (!src) return;
    try {
      const ctx = audio(), t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);   // fade out, then let go
      src.stop(t + 0.4); lfo.stop(t + 0.4);
      setTimeout(() => { try { src.disconnect(); g.disconnect(); lfo.disconnect(); } catch (_) {} }, 600);
    } catch (_) { try { src.stop(); lfo.stop(); } catch (_) {} }
  },
};

let musicOn = false, musicTimer = null;
function curStyle() { return MUSIC[settings.music] || MUSIC.bouncy; }
function playStep(tune, i, st) {
  if (!musicOn) return;
  const [f, b] = tune[i % tune.length];
  if (f > 0) {
    tone(f, 0, st.beat * b * 0.00085, st.wave, .06);
    if (st.bass && i % 2 === 0) tone(f / 2, 0, st.beat * b * 0.0006, "sine", .05);
  }
  const atEnd = i % tune.length === tune.length - 1;
  if (atEnd && st.boing && Math.random() < .35) tone(rand([180, 200, 240]), st.beat * b * 0.0004, .18, "sawtooth", .05);
  const nextTune = atEnd && Math.random() < .4 ? rand(st.tunes) : tune;
  musicTimer = core.wait(() => playStep(nextTune, i + 1, st), st.beat * b);
}
function startMusic() { audio(); musicOn = true; $("musicBtn").classList.add("on"); const st = curStyle(); playStep(rand(st.tunes), 0, st); }
function stopMusic() { musicOn = false; if (musicTimer) { clearTimeout(musicTimer); core.timers.delete(musicTimer); } $("musicBtn").classList.remove("on"); }
// "Music: off" in settings means a quiet app, so it silences the ambience bed as well —
// a parent choosing silence should get silence, not silence-plus-wind.
function applyMusicSetting() { if (settings.music === "off") ambience.stop(); }
function toggleMusic() { if (musicOn) stopMusic(); else startMusic(); }

/* ================= Fireworks + floaters ================= */
let fxRaf = null;
function fireworks() {
  const c = $("fxC"), ctx = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const parts = [];
  const burst = (x, y) => {
    const hue = Math.random() * 360;
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2, v = randBetween(1.5, 7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                   life: randBetween(45, 80), hue: hue + randBetween(-20, 20), r: randBetween(2, 4.5) });
    }
  };
  for (let i = 0; i < 4; i++)
    setTimeout(() => burst(randBetween(.2, .8) * c.width, randBetween(.15, .5) * c.height), i * 420);
  if (fxRaf) cancelAnimationFrame(fxRaf);
  const start = performance.now();
  const frame = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.x += p.vx; p.y += p.vy; p.vy += .07; p.vx *= .985; p.life--;
      ctx.globalAlpha = Math.min(1, p.life / 35);
      ctx.fillStyle = `hsl(${p.hue}, 95%, 62%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (performance.now() - start < 3400) fxRaf = requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, c.width, c.height); fxRaf = null; }
  };
  fxRaf = requestAnimationFrame(frame);
}
function floaters(emojis, x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const f = document.createElement("div");
    f.className = "floater"; f.textContent = rand(emojis);
    f.style.left = (x + randBetween(-60, 60)) + "px";
    f.style.top = (y + randBetween(-20, 20)) + "px";
    f.style.animationDelay = (i * 0.05) + "s";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }
}

/* ===== Pointer sparkle trail — self-fading glitter behind fingers (paint + tracing) ===== */
const trail = {
  parts: [], raf: null, ctx: null, w: 0, h: 0,
  ensure() {
    const c = $("trailC");
    if (this.w !== innerWidth || this.h !== innerHeight) { this.w = c.width = innerWidth; this.h = c.height = innerHeight; this.ctx = c.getContext("2d"); }
    else if (!this.ctx) this.ctx = c.getContext("2d");
  },
  add(x, y, hue, n = 3) {
    this.ensure();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = randBetween(.3, 2.1);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - .55,
        life: 1, decay: randBetween(.018, .04), r: randBetween(2.5, 6),
        hue: hue + randBetween(-18, 18), star: Math.random() < .45, spin: randBetween(-.22, .22), ang: Math.random() * 7 });
    }
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);   // cap for low-end phones
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
  },
  frame() {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += .04; p.vx *= .97; p.life -= p.decay; p.ang += p.spin; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = `hsl(${p.hue}, 95%, 65%)`;
      if (p.star) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.beginPath();
        for (let i = 0; i < 10; i++) { const rr = i % 2 ? p.r * .45 : p.r * 1.25, aa = i / 10 * Math.PI * 2, X = Math.cos(aa) * rr, Y = Math.sin(aa) * rr; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.6 + p.life * .6), 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (this.parts.length) this.raf = requestAnimationFrame(() => this.frame());
    else { ctx.clearRect(0, 0, this.w, this.h); this.raf = null; }
  }
};

/* ================= Shared data ================= */
const fillName = s => s.replace(/\{n\}/g, NAME);
function applyName() {
  document.title = NAME + "'s World";
  const h1 = document.querySelector("#hub h1"); if (h1) h1.textContent = t("hub_title");
  const h2 = document.querySelector("#stickerbook h2"); if (h2) h2.textContent = t("book_title");
}
const COLORS = {
  red: "#e63946", blue: "#2f6fde", yellow: "#f4c726", green: "#3fa84f",
  purple: "#8e4fd0", orange: "#f07f13", pink: "#f06ba8",
  brown: "#8a5a2b", gray: "#8a96a3", black: "#2b2b2b", white: "#f4f6f9"
};
const COLOR_TIERS = [
  ["red", "blue", "yellow", "green", "orange", "purple"],          // tier 0: classics
  ["red", "blue", "yellow", "green", "orange", "purple", "pink", "brown"],
  ["red", "blue", "yellow", "green", "orange", "purple", "pink", "brown", "gray", "black", "white"]
];
/* Which sticker is at home in which sticker-book scene, and the vocabulary key to say.
   `hub.js` has read this table since the sticker book shipped; it was never defined, so
   the "this belongs here!" moment has never once fired. A sticker with no entry simply
   gets no bonus — the reward is a delight beat, not a completion mechanic, so a forced
   fit would be worse than none. Keys are VOC keys, spoken through theWord(). */
const STICKER_DATA = {
  // the park
  "🦋": { n: "butterfly", h: "park" },  "🌺": { n: "flower", h: "park" },
  "🌸": { n: "flower", h: "park" },     "🌷": { n: "flower", h: "park" },
  "🎈": { n: "balloon", h: "park" },    "🚲": { n: "bike", h: "park" },
  "🐰": { n: "bunny", h: "park" },      "🦊": { n: "fox", h: "park" },
  "🌈": { n: "rainbow", h: "park" },    "🦩": { n: "flamingo", h: "park" },
  "🦜": { n: "parrot", h: "park" },
  // the ocean
  "🐬": { n: "dolphin", h: "ocean" },   "🐠": { n: "fish", h: "ocean" },
  "🐙": { n: "octopus", h: "ocean" },   "🐢": { n: "turtle", h: "ocean" },
  "🐧": { n: "penguin", h: "ocean" },
  // space
  "🚀": { n: "rocket", h: "space" },    "🪐": { n: "planet", h: "space" },
  "🌙": { n: "moon", h: "space" },      "⭐": { n: "star", h: "space" },
  "🌟": { n: "star", h: "space" },
  // the castle
  "👑": { n: "crown", h: "castle" },    "🦄": { n: "unicorn", h: "castle" },
  "🐉": { n: "dragon", h: "castle" },   "🏰": { n: "castle", h: "castle" },
  "💎": { n: "diamond", h: "castle" },  "🎀": { n: "bow", h: "castle" },
  // the cozy room
  "🐻": { n: "bear", h: "bed" },        "🐱": { n: "cat", h: "bed" },
  "🐶": { n: "dog", h: "bed" }
};

const STICKER_POOL = ["🦄", "👑", "🦋", "🌈", "⛄", "🐬", "🌺", "🍦", "🎈", "🐠", "🍕", "💎", "🚲", "🌟", "🐧", "🦁", "🌸", "🍩",
  "🐉", "🦕", "🐶", "🐱", "🐰", "🦊", "🐻", "🐢", "🦩", "🐙", "🦜", "🌙", "⭐", "🍭", "🧁", "🎀", "🚀", "🪐", "🏰", "🦖", "🌷", "🍓"];

const ANIMALS = {
  dog:   { e: "🐶", sound: "Woof woof", es: "Guau guau", freq: 300 },
  cat:   { e: "🐱", sound: "Meow",      es: "Miau",      freq: 520 },
  cow:   { e: "🐮", sound: "Moo",       es: "Muu",       freq: 160 },
  frog:  { e: "🐸", sound: "Ribbit",    es: "Croac",     freq: 440 },
  duck:  { e: "🦆", sound: "Quack quack", es: "Cuac cuac", freq: 560 },
  sheep: { e: "🐑", sound: "Baa baa",   es: "Bee bee",   freq: 380 },
  bird:  { e: "🐦", sound: "Tweet tweet", es: "Pío pío", freq: 900 },
  lion:  { e: "🦁", sound: "Roar",      es: "Grr",       freq: 130 },
  pig:   { e: "🐷", sound: "Oink oink", es: "Oinc oinc", freq: 250 },
  horse: { e: "🐴", sound: "Neigh",     es: "Iiii",      freq: 320 }
};
const animalSound = key => curLang() === "es" ? ANIMALS[key].es : curLang() === "yue" ? (ANIMAL_YUE[key] || ANIMALS[key].sound) : ANIMALS[key].sound;
function speakAnimal(key, opts = {}) {
  const a = ANIMALS[key];
  tone(a.freq, 0, .4, "sine", .16);
  speak(animalSound(key), { pitch: clamp(a.freq / 430, 0.6, 1.7), rate: 0.9, queue: opts.queue });
}

/* ================= Shared helpers ================= */
function setInstruction(text, spoken) {
  $("instruction").textContent = text;
  $("instruction").dataset.spoken = spoken || text;
  speak(spoken || text);
}
// One round per game during a world party, so roundComplete() hands straight on to the
// next game instead of playing a whole level.
function totalRounds() { return worldParty.active ? 1 : (LEVELS[state.level].rounds || 5); }
function drawProgress() {
  // During a party the dots track the party, not the one-round game inside it.
  const n  = worldParty.active ? worldParty.queue.length : totalRounds();
  const at = worldParty.active ? worldParty.at : state.round;
  $("progress").innerHTML = Array.from({ length: n },
    (_, i) => `<div class="dot ${i < at ? "done" : ""}"></div>`).join("");
}
function miniStar(x, y) {
  const s = document.createElement("div");
  s.className = "mini-star"; s.textContent = "⭐";
  s.style.left = (x - 20) + "px"; s.style.top = (y - 20) + "px";
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 900);
}
function confetti(n = 36) {
  const emojis = ["🎉", "⭐", "❄️", "🌺", "🍕", "💖", "🌈", "✨"];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "confetto"; c.textContent = rand(emojis);
    c.style.left = Math.random() * 100 + "vw";
    c.style.animationDuration = (2 + Math.random() * 2.5) + "s";
    c.style.animationDelay = Math.random() * .8 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }
}
function wiggle(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }

function makeDraggable(el, onRelease) {
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", e => {
    if (state.busy || el.classList.contains("on-plate")) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const r = el.getBoundingClientRect();
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    const startX = e.clientX, startY = e.clientY;
    const orig = { pos: el.style.position, left: el.style.left, top: el.style.top, z: el.style.zIndex };
    let moved = false;
    const move = ev => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 7) moved = true;
      el.style.position = "fixed"; el.style.zIndex = 60;
      el.style.left = (ev.clientX - offX) + "px";
      el.style.top = (ev.clientY - offY) + "px";
    };
    const up = ev => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      onRelease(el, ev, {
        moved,
        reset() { el.style.position = orig.pos; el.style.left = orig.left; el.style.top = orig.top; el.style.zIndex = orig.z; }
      });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  });
}
const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const inside = (pt, el) => { const r = el.getBoundingClientRect(); return pt.x > r.left && pt.x < r.right && pt.y > r.top && pt.y < r.bottom; };

/* grid scatter (up to 12) so items never overlap */
function scatter(n) {
  const cols = 4, rows = 3;
  return shuffle([...Array(cols * rows).keys()]).slice(0, n).map(cell => {
    const c = cell % cols, r = Math.floor(cell / cols);
    return { left: (5 + c * 23 + Math.random() * 7) + "%", top: (6 + r * 30 + Math.random() * 7) + "%" };
  });
}

/* ================= Round / level flow ================= */
function cleanupLevel() { core.cleanup(); }
function roundComplete() {
  state.busy = true;
  const manyMistakes = roundMistakes >= 3;
  recordRoundPerf(state.level, roundMistakes);
  let nextTier = tierFor(state.level);
  if (settings.diff === "auto" && manyMistakes) nextTier = Math.max(0, nextTier - 1);
  roundMistakes = 0;
  playCue(state.level);
  waitSpeech(() => {                       // let the praise finish talking first
    state.round++;
    state.tier = nextTier;
    drawProgress();
    if (state.round >= totalRounds()) levelComplete();
    else { state.busy = false; LEVELS[state.level].startRound(); }
  });
}
function levelComplete() {
  core.cleanup();
  if (worldParty.active) return worldParty.next();     // a party round hands on, it doesn't celebrate
  celebrateWith(state.level);
}

/* ================= World party =================
   The node at the end of a world's trail. It plays one round each from three games she
   has ALREADY played in that world — interleaved retrieval practice, which is the one
   well-evidenced lever the app was missing: every game drills its concept in isolation,
   and nothing ever asked her to switch between them.

   It is never a gate. It is tappable from the first visit; if she has played fewer than
   three games here the queue is topped up from the rest of the world, so it is a sampler
   early on and becomes real review later. There is no score and no way to fail it. */
const PARTY_ROUNDS = 3;
const worldParty = {
  active: false, cat: null, queue: [], at: 0,
  build(cat) {
    const inWorld = visibleGames(cat).filter(gid => LEVELS[gid]);   // specials own a whole screen
    const played = shuffle(inWorld.filter(gid => (completions[gid] || 0) > 0));
    const rest   = shuffle(inWorld.filter(gid => !(completions[gid] > 0)));
    return [...played, ...rest].slice(0, PARTY_ROUNDS);
  },
  start(cat) {
    const queue = this.build(cat);
    if (!queue.length) return false;
    this.active = true; this.cat = cat; this.queue = queue; this.at = 0;
    speak(t("party_intro", { world: locName(cat) }));
    this.play();
    return true;
  },
  play() { startLevel(this.queue[this.at]); },
  next() {
    this.at++;
    if (this.at < this.queue.length) { core.wait(() => this.play(), 650); return; }
    const last = this.queue[this.queue.length - 1];
    this.stop();
    speak(t("party_done", { world: locName(this.cat || {}) }));
    celebrateWith(last);
  },
  stop() { this.active = false; this.queue = []; this.at = 0; }
};
function celebrateWith(levelId, opts = {}) {
  completions[levelId] = (completions[levelId] || 0) + 1;
  saveCompletions();
  localStorage.setItem("fionaLastGame", levelId);
  const sticker = rand(STICKER_POOL);
  stickers.push({ e: sticker });           // position assigned by the sticker book's grid
  saveStickers();
  sparks = Math.min(QUEST_GOAL, sparks + 1); saveQuest();   // every win powers up the rocket
  const questDone = sparks >= QUEST_GOAL, left = QUEST_GOAL - sparks;
  sfx.win(); confetti(); fireworks();
  $("celebText").textContent = t("well_done");
  $("celebSticker").textContent = sticker;
  $("celebSub").textContent = questDone ? t("celeb_done_sub") : t("celeb_more_sub", { left });
  // when the rocket is full, swap the normal buttons for a big Blast off!
  $("celebLaunch").classList.toggle("hidden", !questDone);
  $("celebBook").classList.toggle("hidden", questDone);
  $("celebHome").classList.toggle("hidden", questDone);
  $("celebrate").classList.remove("hidden");
  speak(questDone ? t("quest_fixed_praise") : t("quest_collect", { left }));
}

/* ================= Rocket Quest ================= */
function renderQuest() {
  const slots = $("questSlots"); if (!slots) return;
  slots.innerHTML = "";
  for (let i = 0; i < QUEST_GOAL; i++) {
    const s = document.createElement("span");
    s.className = "q-slot" + (i < sparks ? " filled" : "");
    s.textContent = i < sparks ? "✨" : "";
    slots.appendChild(s);
  }
  // pop the slot(s) earned since we were last on the hub
  if (sparks > questShown) {
    for (let i = questShown; i < sparks; i++) { const el = slots.children[i]; if (el) el.classList.add("pop"); }
    miniStar(innerWidth / 2, innerHeight - 60);
  }
  questShown = sparks;
}
function questSpeak() {
  const left = QUEST_GOAL - sparks;
  speak(left <= 0 ? t("quest_onemore") : t("quest_status", { left }));
}
function questIntro() {
  speak(t("hi_star_sparks"));
}
function rocketLaunch() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  $("celebrate").classList.add("hidden");
  document.body.className = "theme-space";
  const ov = $("rocketLaunch"); ov.classList.remove("hidden");
  const rocket = $("rlRocket"), count = $("rlCount"), txt = $("rlText");
  rocket.className = "rl-rocket shake"; count.textContent = ""; txt.textContent = t("rocket_ready");
  speak(t("quest_fixed"));
  let n = 3;
  const tick = () => {
    if (n > 0) { count.textContent = n; speak(String(n)); tone(440, 0, .18, "triangle"); n--; setTimeout(tick, 900); }
    else {
      count.textContent = "🚀"; speak(t("blastoff"));
      rocket.className = "rl-rocket blast";
      sfx.win(); fireworks(); confetti(50);
      trips++; sparks = 0; saveQuest();                       // reset the journey for endless replay
      const badge = rand(["🏅", "🌟", "🚀", "👑", "🎖️"]); stickers.push({ e: badge }); saveStickers();
      txt.textContent = t("trip_complete", { trips, badge });
      setTimeout(() => {
        ov.classList.add("hidden");
        showHub();
        setTimeout(() => speak(t("rocket_zoomed")), 700);
      }, 3200);
    }
  };
  setTimeout(tick, 1100);
}
