// ---------- Elements ----------

const $ = (id) => document.getElementById(id);

const body = document.body;
const homeBtn = $("homeBtn");
const home = $("home");
const welcome = $("welcome");
const welcomeText = $("welcomeText");
const welcomeBuddy = $("welcomeBuddy");
const kidGrid = $("kidGrid");
const homeTitle = $("homeTitle");
const modeTitle = $("modeTitle");
const bulbWrap = $("bulbWrap");
const lightBuddy = $("lightBuddy");
const lightView = $("lightView");
const pictureView = $("pictureView");
const animalView = $("animalView");
const animalGrid = $("animalGrid");
const card = $("card");
const cardEmpty = $("cardEmpty");
const cardLoading = $("cardLoading");
const polaroid = $("polaroid");
const slidesBox = $("slides");
const track = $("track");
const dots = $("dots");
const burst = $("burst");
const photoTitle = $("photoTitle");
const bubble = $("bubble");
const buddy = $("buddy");
const sound = $("sound");
const volume = $("volume");
const hints = $("hints");
const talk = $("talk");
const talkLabel = $("talkLabel");
const music = $("music");

$("version").innerText = "Bolo Bolo v" + APP_VERSION + " (" + BUILD + ")";

// ---------- Saved settings (stay the same until changed) ----------

function load(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

// ---------- Voices ----------

let hindiVoice = null;
let englishVoice = null;

// some Android phones write voice languages as "en_IN" instead of "en-IN"
function voiceLang(v) {
  return (v.lang || "").replace("_", "-").toLowerCase();
}

function findVoice() {
  let voices = speechSynthesis.getVoices();
  hindiVoice =
    voices.find((v) => voiceLang(v).startsWith("hi") && v.localService) ||
    voices.find((v) => voiceLang(v).startsWith("hi")) ||
    null;
  englishVoice =
    voices.find((v) => voiceLang(v) == "en-in" && v.localService) ||
    voices.find((v) => voiceLang(v) == "en-in") ||
    voices.find((v) => voiceLang(v).startsWith("en") && v.localService) ||
    null;
}

if ("speechSynthesis" in window) {
  findVoice();
  speechSynthesis.onvoiceschanged = findVoice;
}

// Speaks the words and returns a promise that resolves when Bolo has really finished.
// Uses the speech events, not guessing: on Android speech can take a second to start.
// onSentence(i) is called as each sentence starts (used to highlight quiz answers as they are read).
let speechToken = 0;

function speak(words, onSentence) {
  let hindiNumbers = "०१२३४५६७८९";
  for (let i = 0; i < 10; i++) {
    words = words.replaceAll(hindiNumbers[i], i);
  }
  bubble.innerText = words;
  bubble.scrollTop = 0;

  if (!("speechSynthesis" in window)) {
    wiggleBuddy();
    return Promise.resolve();
  }

  // don't read emoji out loud
  let spoken = words.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").trim();
  let token = ++speechToken;
  // on Android, cancel() finishes a moment later and can also swallow the next sentence:
  // only cancel when something is playing, and then wait a bit longer before speaking
  let wasBusy = speechSynthesis.speaking || speechSynthesis.pending;
  if (wasBusy) speechSynthesis.cancel();
  if (!spoken) return Promise.resolve();

  // one sentence at a time: some phones cut long speech off in the middle
  let parts = spoken.split(/(?<=[।!?.])\s+/).map((p) => p.trim()).filter(Boolean);
  let hindi = hindiMode();
  let said = 0;
  let index = 0;

  return new Promise((done) => {
    let finished = false;
    let started = false;
    let finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(startGuard);
      clearTimeout(endGuard);
      if (token == speechToken) {
        setTalking(false);
        whenIdle();
      }
      done();
    };
    // if the phone has no voice at all, nothing ever starts: don't wait forever
    let startGuard = setTimeout(() => started || finish(), 5000);
    let endGuard = setTimeout(finish, 7000 + spoken.length * 150);

    let say = (part, retry) => {
      let voice = new SpeechSynthesisUtterance(part);
      voice.lang = hindi ? "hi-IN" : "en-IN";
      let chosen = hindi ? hindiVoice : englishVoice;
      if (chosen) voice.voice = chosen;
      voice.rate = 0.9;
      voice.pitch = mode == "ajooba" ? 1.25 : 1.15; // Gappu: a little higher than Bolo, still clear
      let began = false;
      let i = index;
      voice.onstart = () => {
        began = started = true;
        promptSpoken = true;
        setTalking(true);
        if (onSentence) onSentence(i);
        bubble.scrollTop = (said / spoken.length) * (bubble.scrollHeight - bubble.clientHeight);
        said += part.length + 1;
      };
      voice.onend = () => {
        index++;
        next();
      };
      voice.onerror = (e) => {
        if (token != speechToken) return finish(); // we stopped it on purpose
        let cut = e.error == "interrupted" || e.error == "canceled";
        // swallowed before it began (Android cancel() race): try this sentence once more
        if (cut && !began && !retry) return setTimeout(() => token == speechToken && say(part, true), 250);
        index++;
        cut ? finish() : next();
      };
      currentVoice = voice;
      speechSynthesis.speak(voice);
    };

    let next = () => {
      if (token != speechToken || !parts.length) return finish();
      say(parts.shift(), false);
    };
    setTimeout(next, wasBusy ? 250 : 30);
    wiggleBuddy();
  });
}

let currentVoice = null;

function setTalking(on) {
  document.querySelectorAll(".talker").forEach((el) => el.classList.toggle("talking", on));
  buddy.classList.toggle("talking", on);
  welcomeBuddy.classList.toggle("talking", on);
  lightBuddy.classList.toggle("talking", on);
}

function wiggleBuddy() {
  setTalking(true);
  setTimeout(() => {
    if (!("speechSynthesis" in window) || !speechSynthesis.speaking) setTalking(false);
  }, 1200);
}

function hush() {
  speechToken++; // also stops a sentence that is about to start
  setTalking(false);
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function safeReply() {
  speak(tr("चलो, कुछ और देखते हैं! किसी जानवर या चीज़ का नाम बोलो। 🐼", "Let's try something else! Say an animal or a thing. 🐼"));
}

function buzz() {
  if (navigator.vibrate) navigator.vibrate(30);
}

// ---------- Listening ----------

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let mic = null;
let listening = false;

if (Recognition) {
  mic = new Recognition();
  mic.lang = "en-IN";
  mic.interimResults = false;
  mic.maxAlternatives = 3;

  mic.onresult = function (event) {
    let guesses = [...event.results[0]].map((r) => r.transcript.toLowerCase().trim());
    think(guesses[0], guesses.slice(1));
  };

  mic.onerror = function (event) {
    if (event.error == "not-allowed" || event.error == "service-not-allowed") {
      speak(tr("माइक चालू करने की इजाज़त दो, फिर बोलो! 🎤", "Please allow the microphone, then talk! 🎤"));
    } else if (event.error == "no-speech") {
      speak(tr("कुछ सुनाई नहीं दिया, फिर से बोलो! 👂", "I didn't hear anything. Say it again! 👂"));
    } else if (event.error == "network") {
      speak(tr("बोलने के लिए इंटरनेट चालू करो। 📶", "Turn on the internet to talk. 📶"));
    }
  };

  mic.onend = function () {
    listening = false;
    talk.classList.remove("listening");
    setTalkLabel();
    whenIdle();
  };
}

function listen() {
  buzz();
  if (!mic) {
    speak(tr("इस फ़ोन में आवाज़ सुनने की सुविधा नहीं है। नीचे वाले बटन दबाओ! 👇", "This phone can't listen. Tap the buttons instead! 👇"));
    return;
  }
  if (listening) {
    mic.stop();
    return;
  }
  hush(); // so the app doesn't hear itself
  try {
    mic.start();
    listening = true;
    talk.classList.add("listening");
    setTalkLabel();
  } catch (e) {}
}

talk.onclick = listen;

// ---------- Home + modes ----------

let mode = "home";

const lightHints = [
  ["💡 On", "on"], ["🌑 Off", "off"], ["🔴 Red", "red"], ["🔵 Blue", "blue"],
  ["🟢 Green", "green"], ["🟡 Yellow", "yellow"], ["🩷 Pink", "pink"], ["🟣 Purple", "purple"],
  ["🟠 Orange", "orange"], ["⚪ White", "white"], ["🎉 Party", "party"], ["👋 Hello", "hello"], ["⏰ Time", "time"],
];

const pictureHints = [
  ["🐘 हाथी", "elephant"], ["🐯 बाघ", "tiger"], ["🦚 मोर", "peacock"], ["🦖 डायनासोर", "dinosaur"],
  ["🚀 रॉकेट", "rocket"], ["🌙 चाँद", "moon"], ["🌋 ज्वालामुखी", "volcano"],
  ["🕌 ताजमहल", "Taj Mahal"], ["🌈 इंद्रधनुष", "rainbow"], ["🦒 जिराफ़", "giraffe"],
];

const MODES = {
  light: { view: lightView, title: "Lights", hints: lightHints, hello: "Say: on, off, red, blue, party... 💡" },
  picture: { view: pictureView, title: "Pictures", hints: pictureHints, hello: "किसी भी चीज़ का नाम बोलो! 🖼️" },
  animals: { view: animalView, title: "Animal Sounds", hints: [], hello: "Tap an animal, or say its name! 🐾" },
};

// Pictures talks in Hindi, everything else in English
function hindiMode() {
  return mode == "picture" || mode == "welcome" || mode == "talk" || mode == "ajooba";
}

function tr(hindi, english) {
  return hindiMode() ? hindi : english;
}

function setTalkLabel() {
  if (mode == "welcome") talkLabel.innerText = listening ? "सुन रहा हूँ..." : "दबाओ और बोलो!";
  else talkLabel.innerText = listening ? tr("सुन रहा हूँ...", "Listening...") : tr("दबाओ और बोलो!", "Tap and talk!");
}

function showHints(list) {
  hints.innerHTML = "";
  hints.hidden = !list.length;
  for (let [label, word] of list) {
    let chip = document.createElement("button");
    chip.className = "chip";
    chip.innerText = label;
    chip.onclick = function () {
      buzz();
      think(word.toLowerCase());
    };
    hints.appendChild(chip);
  }
  hints.scrollLeft = 0;
}

function pick(name) {
  stopParty();
  stopSlides();
  stopAnimal();
  hush();
  if (listening && mic) mic.abort();

  if (MODES[mode] && MODES[mode].leave) MODES[mode].leave();
  mode = name;
  body.className = "mode-" + name;
  home.hidden = name != "home";
  welcome.hidden = name != "welcome";
  for (let [key, m] of Object.entries(MODES)) m.view.hidden = key != name;
  if (name == "welcome") {
    setTalkLabel();
    askName();
    return;
  }
  if (name == "home") {
    homeTitle.innerText = player ? "Hi " + player.name + "! 👋" : "Bolo Bolo";
    return;
  }

  let m = MODES[name];
  modeTitle.innerText = m.title;
  showHints(m.hints);
  bubble.innerText = m.hello;
  setTalkLabel();
  if (m.enter) m.enter();
}

function openMode(name) {
  buzz();
  history.pushState({ mode: name }, "");
  pick(name);
}

function goHome() {
  buzz();
  if (history.state && history.state.mode) history.back(); // popstate below shows home
  else pick("home");
}

homeBtn.onclick = goHome;
window.addEventListener("popstate", (e) => pick((e.state && e.state.mode) || "home")); // phone back button returns home

for (let tile of document.querySelectorAll(".homeTile")) {
  tile.onclick = () => openMode(tile.dataset.mode);
}

// ---------- Light mode ----------

const colors = {
  red: { words: ["red", "laal", "lal", "लाल"], color: "#ff3b3b", name: "लाल" },
  blue: { words: ["blue", "neela", "nila", "neeli", "नीला", "नीली"], color: "#2f80ff", name: "नीली" },
  green: { words: ["green", "hara", "haraa", "hari", "हरा", "हरी"], color: "#2ecc71", name: "हरी" },
  yellow: { words: ["yellow", "peela", "pila", "peeli", "पीला", "पीली"], color: "#ffd23f", name: "पीली" },
  pink: { words: ["pink", "gulabi", "गुलाबी"], color: "#ff6ec7", name: "गुलाबी" },
  purple: { words: ["purple", "violet", "baingani", "jamuni", "बैंगनी", "जामुनी"], color: "#a55eea", name: "बैंगनी" },
  orange: { words: ["orange", "narangi", "नारंगी"], color: "#ff9f1a", name: "नारंगी" },
  white: { words: ["white", "safed", "सफेद", "सफ़ेद"], color: "#ffffff", name: "सफ़ेद" },
};

const ON_COLOR = "#ffe066";
const OFF_COLOR = "#555555";

function setLight(color, saveIt = true) {
  let on = color != OFF_COLOR;
  let wasOn = lightView.classList.contains("on");
  lightView.style.setProperty("--glow", color);
  lightView.classList.toggle("on", on);
  bulbWrap.classList.toggle("on", on);
  // the mascot wakes up with a little jump when the light comes on
  if (on && !wasOn) {
    lightBuddy.classList.remove("wake");
    void lightBuddy.offsetWidth;
    lightBuddy.classList.add("wake");
  }
  bulbWrap.classList.remove("pop");
  void bulbWrap.offsetWidth; // restart animation
  bulbWrap.classList.add("pop");
  if (saveIt) save("sv-light", color);
}

let disco;

function stopParty() {
  clearInterval(disco);
  disco = null;
  bulbWrap.classList.remove("party");
  lightView.classList.remove("party");
  music.pause();
  sound.hidden = true;
}

function startParty() {
  let list = Object.values(colors).map((c) => c.color);
  bulbWrap.classList.add("party");
  lightView.classList.add("party");
  disco = setInterval(function () {
    let pick = list[Math.floor(Math.random() * list.length)];
    setLight(pick, false);
  }, 300);
  music.play().catch(() => {});
  sound.hidden = false;
}

volume.oninput = () => (music.volume = volume.value);

function says(words, list) {
  return list.some((w) => words.includes(w));
}

function lightCommand(heard) {
  let words = heard.split(/[^\p{L}\p{M}\p{N}]+/u);

  if (says(words, ["party", "disco", "पार्टी", "डिस्को"])) {
    startParty();
    speak("Party time! 🎉");
    return;
  }
  for (let [key, c] of Object.entries(colors)) {
    if (says(words, c.words)) {
      setLight(c.color);
      speak("The light is " + key + "! 🌟");
      return;
    }
  }
  if (says(words, ["off", "band", "bujhao", "bujha", "बंद", "बुझाओ"])) {
    setLight(OFF_COLOR);
    speak("Light off! 🌙");
  } else if (says(words, ["on", "chalu", "jalao", "jala", "चालू", "जलाओ"])) {
    setLight(ON_COLOR);
    speak("Light on! 💡");
  } else if (says(words, ["hello", "hi", "hey", "namaste", "नमस्ते", "हेलो"])) {
    speak("Hello! I am Bolo Bolo. 👋");
  } else if (says(words, ["time", "samay", "टाइम", "समय"])) {
    let now = new Date();
    let hour = now.getHours() % 12 || 12;
    speak("It is " + hour + ":" + String(now.getMinutes()).padStart(2, "0") + " now. ⏰");
  } else {
    speak("I didn't get that. Say it again! 🤔");
  }
}

// ---------- Pictures mode (Wikipedia) ----------

let searchId = 0;

function wiki(lang, params) {
  let url = "https://" + lang + ".wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1";
  for (let key in params) url += "&" + key + "=" + encodeURIComponent(params[key]);
  return fetch(url)
    .then((r) => r.json())
    .catch((e) => {
      if (navigator.onLine) throw new Error("busy"); // Wikipedia says "too many requests"
      throw e;
    });
}

const englishInfo = {
  prop: "pageimages|langlinks|pageprops|extracts|description", piprop: "thumbnail|name", pithumbsize: 960,
  lllang: "hi", lllimit: "max", ppprop: "disambiguation", exintro: 1, explaintext: 1, exsentences: 2, exlimit: "max",
};
const hindiInfo = {
  prop: "pageimages|langlinks|pageprops|extracts|description", piprop: "thumbnail|name", pithumbsize: 960,
  lllang: "en", lllimit: "max", ppprop: "disambiguation", exintro: 1, explaintext: 1, exlimit: "max",
};

function goodPages(data) {
  let pages = (data && data.query && data.query.pages) || [];
  return pages.filter((p) => !p.missing && !p.invalid && !(p.pageprops && "disambiguation" in p.pageprops));
}

async function findHindi(params) {
  return goodPages(await wiki("hi", { ...params, ...hindiInfo }))[0] || null;
}

// ---------- Finding what the kid meant ----------

// Hinglish -> Hindi letters: "hathi" -> ["हठी", "हाथी", ...] (Google Input Tools)
async function toDevanagari(word) {
  try {
    let url = "https://inputtools.google.com/request?itc=hi-t-i0-und&num=4&cp=0&cs=1&ie=utf-8&oe=utf-8&text=" + encodeURIComponent(word);
    let data = await fetch(url).then((r) => r.json());
    return data[0] == "SUCCESS" ? data[1][0][1] : [];
  } catch (e) {
    return [];
  }
}

// what a page is about, from its Wikipedia short description.
// Cities and towns are neutral: their names often sound like Hindi words (Nadi, a town in Fiji = नदी, river).
const KID_THING = /\b(species|animals?|cats?|dogs?|horses?|cows?|domesticated|carnivor|herbivor|mammals?|birds?|fish|reptiles?|amphibians?|insects?|spiders?|plants?|trees?|flowers?|fruits?|vegetables?|food|dish|drinks?|beverage|sweets?|dessert|vehicles?|aircraft|cars?|ships?|boats?|trains?|machines?|tools?|devices?|instruments?|objects?|containers?|furniture|toys?|games?|sports?|planets?|stars?|moon|natural satellite|galaxy|weather|river|mountain|lake|ocean|sea|desert|forest|monument|building|temple|fort|colou?r|shape|festival|dinosaurs?|genus|family of|clothing|garment|utensil|household|kitchen)/i;
const NOT_KID_THING = /\b(company|restaurant|chain|franchise|retailer|supermarket|store|airline|bank|town|suburb|neighbourhood|corporation|manufacturer|brand|businesses?|film|movie|album|songs?|single|band|singer|musician|rapper|actor|actress|politician|footballer|cricketer|player|athlete|novel|book|magazine|newspaper|journal|television|tv|series|episode|video game|software|website|organi[sz]ation|political party|surname|given name|family name|village|municipality|tehsil|census|topics referred|library|record label|journalist|businessman|writer|poet|author|director|producer|character)\b/i;

function meaningScore(description) {
  if (!description) return 0;
  if (/\(\d{4}|\bborn\b|\bdied\b/i.test(description)) return -4; // a person
  if (NOT_KID_THING.test(description)) return -4;
  if (KID_THING.test(description)) return 3;
  return 0;
}

// Collect possible meanings from English Wikipedia and (for Hinglish) Hindi Wikipedia,
// then pick the one a kid most likely means: an animal/thing/place, not a film or a person.
async function findTopic(name) {
  let latin = !/[ऀ-ॿ]/.test(name);
  let topics = new Map(); // key: English title (or "hi:" + Hindi title)

  function add(key, en, hi, points) {
    let t = topics.get(key) || { en: null, hi: null, score: 0 };
    t.en = t.en || en;
    t.hi = t.hi || hi;
    t.score += points;
    topics.set(key, t);
  }

  let [exact, search, hindiWords] = await Promise.all([
    latin ? wiki("en", { titles: name, ...englishInfo }).then(goodPages) : [],
    latin ? wiki("en", { generator: "search", gsrsearch: name, gsrlimit: 5, ...englishInfo }).then(goodPages) : [],
    latin ? toDevanagari(name) : [name],
  ]);

  for (let p of exact) add(p.title, p, null, 3);
  for (let p of search) add(p.title, p, null, 2 - (p.index - 1) * 0.4);

  // Hindi pages: exact titles for the Hindi spellings, plus a search when the kid's words are in Hindi letters
  let hindiPages = [];
  if (hindiWords.length) {
    let spellings = hindiWords.slice(0, 3);
    let found = await wiki("hi", { titles: spellings.join("|"), ...hindiInfo }).then(goodPages).catch(() => []);
    for (let p of found) {
      let rank = spellings.indexOf(p.title);
      hindiPages.push({ page: p, points: 3 - Math.max(rank, 0) * 0.3 });
    }
    if (!latin) {
      let hits = await wiki("hi", { generator: "search", gsrsearch: name, gsrlimit: 3, ...hindiInfo }).then(goodPages).catch(() => []);
      for (let p of hits) hindiPages.push({ page: p, points: 2 - (p.index - 1) * 0.5 });
    } else if (!found.length) {
      // no Hindi page with that exact name ("चांद" is called "चन्द्रमा") - search for it instead
      let hits = await wiki("hi", { generator: "search", gsrsearch: spellings[0], gsrlimit: 2, ...hindiInfo }).then(goodPages).catch(() => []);
      for (let p of hits) hindiPages.push({ page: p, points: 1.5 - (p.index - 1) * 0.5 });
    }
  }

  // Hindi pages point to their English page; fetch those so all meanings can be compared
  let englishTitles = hindiPages.map((h) => h.page.langlinks && h.page.langlinks[0].title).filter(Boolean);
  let englishOfHindi = englishTitles.length
    ? await wiki("en", { titles: englishTitles.join("|"), ...englishInfo }).then(goodPages).catch(() => [])
    : [];
  for (let h of hindiPages) {
    let enTitle = h.page.langlinks && h.page.langlinks[0].title;
    let en = englishOfHindi.find((p) => p.title == enTitle) || null;
    add(en ? en.title : "hi:" + h.page.title, en, h.page, h.points);
  }

  let best = null;
  let second = -Infinity;
  for (let t of topics.values()) {
    let description = (t.en && t.en.description) || (t.hi && t.hi.description);
    t.meaning = meaningScore(description);
    t.score += t.meaning;
    if (t.en && t.en.langlinks) t.score += 1.5; // everyday things usually have a Hindi page too
    if (isBlocked(t.en && t.en.title) || isBlocked(t.hi && t.hi.title) || isBlocked(description)) continue;
    if (!best || t.score > best.score) {
      if (best) second = Math.max(second, best.score);
      best = t;
    } else {
      second = Math.max(second, t.score);
    }
  }
  if (best) best.margin = best.score - second;
  return best;
}

// Is the search sure what the kid meant? Clearly a kid thing (animal, food, place...),
// a good score and well ahead of other meanings, and said in English.
function clearTopic(topic, said) {
  return !!topic && !/[ऀ-ॿ]/.test(said) && topic.meaning > 0 && topic.score >= 6 && topic.margin >= 2;
}

// When it is not sure ("nadi" = a town in Fiji or a river? "burger" = Burger King?),
// ask the AI what a child most likely wants to see. Only used then, answers remembered.
const GUIDE_LIMIT = 150; // AI questions per phone per day
const guideCache = new Map();

async function aiGuide(said, others) {
  let key = cleanText(said);
  if (guideCache.has(key)) return guideCache.get(key);
  let day = new Date().toISOString().slice(0, 10);
  let used = { day, n: 0 };
  try {
    used = JSON.parse(localStorage.getItem("guide-used")) || used;
  } catch (e) {}
  if (used.day != day) used = { day, n: 0 };
  if (used.n >= GUIDE_LIMIT) return null;
  try {
    let res = await fetch("/.netlify/functions/talk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "guide", said, others }),
    });
    used.n++;
    try {
      localStorage.setItem("guide-used", JSON.stringify(used));
    } catch (e) {}
    if (!res.ok) return null;
    let answer = await res.json();
    guideCache.set(key, answer);
    return answer;
  } catch (e) {
    return null;
  }
}

function shortHindi(extract) {
  let clean = (extract || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  let lines = clean.split("।").filter((l) => l.trim());
  let text = lines.slice(0, 2).join("।");
  if (text.length > 350) text = text.slice(0, 350).replace(/\s\S*$/, "") + "...";
  return text ? text + "।" : "";
}

function shortEnglish(extract) {
  let clean = (extract || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (clean.length > 300) clean = clean.slice(0, 300).replace(/\s\S*$/, "") + ".";
  return clean;
}

// English -> Hindi with the free MyMemory service (only used when there is no Hindi article)
async function toHindi(english) {
  if (!english) return null;
  try {
    let url = "https://api.mymemory.translated.net/get?langpair=en|hi&q=" + encodeURIComponent(english);
    let data = await fetch(url).then((r) => r.json());
    let hindi = data.responseData && data.responseData.translatedText;
    // daily limit reached, or not really Hindi
    if (data.responseStatus != 200 || !hindi || /MYMEMORY/i.test(hindi) || !/[ऀ-ॿ]/.test(hindi)) return null;
    return hindi;
  } catch (e) {
    return null;
  }
}

// short names translate badly on their own ("water bottle" -> "hot water bottle"),
// so translate "This is a water bottle." and cut the name out of "यह पानी की बोतल है।"
async function toHindiName(english) {
  let sentence = await toHindi("This is " + english + ".");
  let match = sentence && sentence.match(/^यह\s+(?:एक\s+)?(.+?)\s+हैं?\s*[।.]?\s*$/);
  return match ? match[1] : toHindi(english);
}

// ---------- Choosing good pictures ----------

const TINY = 350; // smaller than this looks blurry on a phone
const MAX_PICTURES = 5;
// file names that are usually maps, logos, diagrams... not real photos
const NOT_PHOTO = /(map|locator|range|distribution|logo|flag|icon|symbol|emblem|coat.of.arms|seal|diagram|chart|graph|plot|signature|stamp|banknote|coin|commons|wiki|question|ambox|portal|stub|clado|phylo|template|\.svg)/i;

function fileName(title) {
  return (title || "").replace(/^[^:]*:/, "").replace(/_/g, " ");
}

function leadPicture(page) {
  if (!page || !page.thumbnail) return null;
  let t = page.thumbnail;
  return { name: fileName(page.pageimage), url: t.source, w: t.width, h: t.height };
}

// more photos from the same Wikipedia article
async function articlePictures(lang, title) {
  try {
    let data = await wiki(lang, {
      generator: "images", titles: title, gimlimit: 50,
      prop: "imageinfo", iiprop: "url|size|mime", iiurlwidth: 960,
    });
    let pages = (data.query && data.query.pages) || [];
    return pages
      .map((p) => {
        let info = p.imageinfo && p.imageinfo[0];
        return info && { name: fileName(p.title), url: info.thumburl || info.url, w: info.width, h: info.height, mime: info.mime };
      })
      .filter((p) => p && p.mime == "image/jpeg" && p.w >= 400 && p.h >= 300 &&
        p.w / p.h < 2.2 && p.h / p.w < 1.8 && !NOT_PHOTO.test(p.name) && !isBlocked(p.name))
      .sort((a, b) => b.w * b.h - a.w * a.h);
  } catch (e) {
    return [];
  }
}

function choosePictures(lead, more) {
  if (lead && isBlocked(lead.name)) lead = null;
  let list = [];
  if (lead && Math.max(lead.w, lead.h) >= TINY && !NOT_PHOTO.test(lead.name)) list.push(lead);
  for (let p of more) {
    if (list.length >= MAX_PICTURES) break;
    if (lead && p.name.toLowerCase() == lead.name.toLowerCase()) continue;
    list.push(p);
  }
  if (!list.length && lead) list.push(lead); // small or map-like, but better than nothing
  return list;
}

// tiny copy of the picture for the blurred background
function smallUrl(url) {
  return url.replace(/\/\d+px-/, "/120px-");
}

// ---------- Picture card: frame, swipe, zoom ----------

let slideIndex = 0;
let slideTimer = null;

function showLoading() {
  stopSlides();
  cardEmpty.hidden = true;
  polaroid.hidden = true;
  dots.hidden = true;
  card.classList.remove("hasPhoto");
  cardLoading.hidden = false;
}

function showEmpty() {
  stopSlides();
  cardLoading.hidden = true;
  polaroid.hidden = true;
  dots.hidden = true;
  card.classList.remove("hasPhoto");
  cardEmpty.hidden = false;
}

function slides() {
  return [...track.children];
}

function goTo(i) {
  let all = slides();
  if (!all.length) return;
  slideIndex = (i + all.length) % all.length;
  track.style.transform = "translateX(" + -slideIndex * 100 + "%)";
  all.forEach((s, n) => s.classList.toggle("active", n == slideIndex));
  [...dots.children].forEach((d, n) => d.classList.toggle("on", n == slideIndex));
}

function renderDots() {
  dots.innerHTML = "";
  for (let i = 0; i < slides().length; i++) dots.appendChild(document.createElement("i"));
  dots.hidden = slides().length < 2;
  goTo(Math.min(slideIndex, slides().length - 1));
}

function stopSlides() {
  clearInterval(slideTimer);
  slideTimer = null;
}

function startSlides() {
  stopSlides();
  slideTimer = setInterval(() => goTo(slideIndex + 1), 5000);
}

function makeSlide(picture) {
  let slide = document.createElement("div");
  slide.className = "slide";
  let bg = new Image();
  bg.className = "bg";
  bg.alt = "";
  bg.src = smallUrl(picture.url);
  let pic = new Image();
  pic.className = "pic";
  pic.alt = "";
  pic.src = picture.url;
  slide.append(bg, pic);
  return { slide, pic };
}

// resolves when the picture has loaded (or failed / took too long)
function loaded(img) {
  return new Promise((done) => {
    if (img.complete && img.naturalWidth) return done(true);
    img.addEventListener("load", () => done(true));
    img.addEventListener("error", () => done(false));
    setTimeout(() => done(img.naturalWidth > 0), 8000);
  });
}

async function showResult(title, pictures, id) {
  track.innerHTML = "";
  slideIndex = 0;
  track.style.transform = "";
  if (!pictures.length) pictures = [{ url: "icons/mascot-scene.png" }];

  let first = null;
  for (let p of pictures) {
    let { slide, pic } = makeSlide(p);
    track.appendChild(slide);
    if (!first) first = pic;
    // a broken picture just disappears from the swipe list
    pic.addEventListener("error", () => {
      slide.remove();
      if (!slides().length) track.appendChild(makeSlide({ url: "icons/mascot-scene.png" }).slide);
      renderDots();
    });
  }

  await loaded(first);
  if (id != searchId) return;

  photoTitle.innerText = title;
  cardLoading.hidden = true;
  cardEmpty.hidden = true;
  card.classList.add("hasPhoto");
  polaroid.hidden = false;
  renderDots();
  polaroid.classList.remove("show");
  void polaroid.offsetWidth;
  polaroid.classList.add("show");
  sparkleBurst();
  tada();
  if (slides().length > 1) startSlides();
}

// swipe left/right, or tap for the next picture
let swipeX = null;

slidesBox.addEventListener("pointerdown", (e) => (swipeX = e.clientX));
slidesBox.addEventListener("pointerup", (e) => {
  if (swipeX == null) return;
  let dx = e.clientX - swipeX;
  swipeX = null;
  if (slides().length < 2) return;
  buzz();
  stopSlides(); // the kid is choosing now
  goTo(slideIndex + (dx > 40 ? -1 : 1));
});

// ---------- Ta-da! ----------

function sparkleBurst() {
  burst.innerHTML = "";
  let colors = ["#ffd60a", "#ff5fd2", "#2ec5ff", "#7bed3f", "#ff9f1a", "#ffffff"];
  for (let i = 0; i < 16; i++) {
    let s = document.createElement("i");
    let angle = (i / 16) * Math.PI * 2;
    let dist = 110 + Math.random() * 70;
    s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    s.style.setProperty("--c", colors[i % colors.length]);
    burst.appendChild(s);
  }
}

let audio = null;

function tada() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      let osc = audio.createOscillator();
      let gain = audio.createGain();
      let start = t + i * 0.09;
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (i == 3 ? 0.6 : 0.25));
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  } catch (e) {}
}

// ---------- Search ----------

async function findTopicFor(guesses) {
  let best = null;
  let tried = new Set();
  for (let guess of guesses) {
    if (!guess || tried.has(guess) || isBlocked(guess) || tried.size >= 3) continue;
    tried.add(guess);
    let topic = await findTopic(guess);
    if (topic && (!best || topic.score > best.score)) best = topic;
    if (best && best.score >= 4) break; // clearly found it
  }
  return best;
}

async function showPicture(name, otherGuesses = []) {
  let id = ++searchId;
  if (isBlocked(name)) {
    showEmpty();
    safeReply();
    return;
  }
  if (!navigator.onLine) {
    showEmpty();
    speak("तस्वीरें देखने के लिए इंटरनेट चालू करो। 📶");
    return;
  }

  showLoading();
  bubble.innerText = "🔍 " + name + " ढूँढ रहे हैं...";

  try {
    let topic = await findTopicFor([name, ...otherGuesses]);
    if (id != searchId) return;
    if (!clearTopic(topic, name)) {
      let guide = await aiGuide(name, otherGuesses);
      if (id != searchId) return;
      if (guide && guide.safe === false) {
        showEmpty();
        safeReply();
        return;
      }
      if (guide && guide.title && !isBlocked(guide.title)) {
        let page = goodPages(await wiki("en", { titles: guide.title, ...englishInfo }))[0];
        if (id != searchId) return;
        if (page && !isBlocked(page.title) && !isBlocked(page.description)) topic = { en: page, hi: null };
      }
    }
    let english = topic && topic.en;
    let hindi = topic && topic.hi;

    // fetch extra photos while the Hindi text loads
    let more = english ? articlePictures("en", english.title) : null;

    if (!hindi && english && english.langlinks) {
      hindi = await findHindi({ titles: english.langlinks[0].title });
    }
    if (id != searchId) return;

    if (!english && !hindi) {
      showEmpty();
      speak("माफ़ करना, मुझे " + name + " नहीं मिला। कुछ और बोलो! 🙈");
      return;
    }

    let title, text;
    if (hindi) {
      title = hindi.title;
      text = shortHindi(hindi.extract);
    } else {
      // English article only (like "water bottle"): translate its own first lines
      let englishText = shortEnglish(english.extract);
      if (isBlocked(english.title) || isBlocked(englishText)) {
        showEmpty();
        safeReply();
        return;
      }
      [title, text] = await Promise.all([toHindiName(english.title), toHindi(englishText)]);
      if (id != searchId) return;
      title = title || english.title;
      text = text || "यह है " + title + "! 👀";
    }

    if (isBlocked(english && english.title) || isBlocked(title) || isBlocked(text)) {
      showEmpty();
      safeReply();
      return;
    }

    if (!more) more = articlePictures("hi", hindi.title);
    let lead = leadPicture(english) || leadPicture(hindi);
    let pictures = choosePictures(lead, await more);
    if (id != searchId) return;

    await showResult(title, pictures, id);
    if (id != searchId) return;
    speak(text || title + " के बारे में हिंदी में जानकारी नहीं मिली। 📖");
  } catch (e) {
    if (id != searchId) return;
    showEmpty();
    if (e.message == "busy") speak("थोड़ा रुको, फिर से बोलो! ⏳");
    else speak("इंटरनेट में कुछ गड़बड़ है, फिर से कोशिश करो। 📶");
  }
}

// ---------- Animal sounds ----------
// Sounds are in sounds/<id>.mp3 (from Wikimedia Commons, see credits.html)

const animals = [
  { id: "lion", emoji: "🦁", name: "Lion", says: "Roar!", words: ["lion", "sher", "sheru", "शेर"] },
  { id: "tiger", emoji: "🐯", name: "Tiger", says: "Grrr!", words: ["tiger", "bagh", "baagh", "बाघ"] },
  { id: "elephant", emoji: "🐘", name: "Elephant", says: "Paa-oo!", words: ["elephant", "hathi", "haathi", "हाथी"] },
  { id: "dog", emoji: "🐶", name: "Dog", says: "Woof woof!", words: ["dog", "puppy", "kutta", "kutte", "कुत्ता"] },
  { id: "cat", emoji: "🐱", name: "Cat", says: "Meow!", words: ["cat", "kitten", "kitty", "billi", "बिल्ली"] },
  { id: "cow", emoji: "🐮", name: "Cow", says: "Moo!", words: ["cow", "gaay", "gay", "gai", "gaai", "गाय"] },
  { id: "horse", emoji: "🐴", name: "Horse", says: "Neigh!", words: ["horse", "ghoda", "ghora", "घोड़ा", "घोडा"] },
  { id: "goat", emoji: "🐐", name: "Goat", says: "Maa maa!", words: ["goat", "bakri", "bakra", "बकरी", "बकरा"] },
  { id: "sheep", emoji: "🐑", name: "Sheep", says: "Baa baa!", words: ["sheep", "lamb", "bhed", "भेड़", "भेड"] },
  { id: "rooster", emoji: "🐓", name: "Rooster", says: "Kukdoo koo!", words: ["rooster", "hen", "chicken", "murga", "murgi", "मुर्गा", "मुर्गी"] },
  { id: "duck", emoji: "🦆", name: "Duck", says: "Quack quack!", words: ["duck", "batakh", "batak", "बतख"] },
  { id: "frog", emoji: "🐸", name: "Frog", says: "Ribbit!", words: ["frog", "medhak", "mendhak", "मेंढक"] },
  { id: "owl", emoji: "🦉", name: "Owl", says: "Hoo hoo!", words: ["owl", "ullu", "उल्लू"] },
  { id: "monkey", emoji: "🐒", name: "Monkey", says: "Ooh ooh aah aah!", words: ["monkey", "bandar", "बंदर"] },
  { id: "pig", emoji: "🐷", name: "Pig", says: "Oink oink!", words: ["pig", "piggy", "suar", "सूअर"] },
  { id: "peacock", emoji: "🦚", name: "Peacock", says: "Mee-aow!", words: ["peacock", "mor", "मोर"] },
  { id: "wolf", emoji: "🐺", name: "Wolf", says: "Ow-ooo!", words: ["wolf", "bhediya", "भेड़िया", "भेडिया"] },
  { id: "crow", emoji: "🐦", name: "Crow", says: "Caw caw!", words: ["crow", "kauwa", "kaua", "kawa", "कौआ", "कौवा"], dark: true },
  { id: "cuckoo", emoji: "🐦", name: "Cuckoo", says: "Koo-hoo!", words: ["cuckoo", "koyal", "koel", "कोयल"] },
  { id: "bee", emoji: "🐝", name: "Bee", says: "Bzzzz!", words: ["bee", "honeybee", "madhumakhi", "मधुमक्खी"] },
  { id: "parrot", emoji: "🦜", name: "Parrot", says: "Squawk!", words: ["parrot", "tota", "tauta", "तोता"] },
];

const animalAudio = new Audio();
const soundCache = {};
let animalId = 0;
let playingCard = null;

function buildAnimalGrid() {
  for (let a of animals) {
    let card = document.createElement("button");
    card.className = "animal" + (a.dark ? " dark" : "");
    card.dataset.id = a.id;
    card.innerHTML = '<span class="aEmoji"></span><span class="aName"></span>';
    card.querySelector(".aEmoji").innerText = a.emoji;
    card.querySelector(".aName").innerText = a.name;
    card.onclick = () => (playingCard == card ? stopAnimal() : playAnimal(a));
    animalGrid.appendChild(card);
  }
}

// load the sound as a whole file so the offline cache can keep it
function soundUrl(a) {
  if (!soundCache[a.id]) {
    soundCache[a.id] = fetch("sounds/" + a.id + ".mp3")
      .then((r) => {
        if (!r.ok) throw new Error("no sound");
        return r.blob();
      })
      .then((blob) => URL.createObjectURL(blob))
      .catch((e) => {
        delete soundCache[a.id];
        throw e;
      });
  }
  return soundCache[a.id];
}

function stopAnimal() {
  animalId++;
  animalAudio.onended = null;
  animalAudio.pause();
  if (playingCard) playingCard.classList.remove("playing");
  playingCard = null;
}

async function playAnimal(a) {
  buzz();
  stopAnimal();
  hush();
  let id = animalId;
  let card = animalGrid.querySelector('[data-id="' + a.id + '"]');
  card.classList.add("playing");
  card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  playingCard = card;
  bubble.innerText = a.emoji + " " + a.name + " says " + a.says;

  let url;
  try {
    url = await soundUrl(a);
  } catch (e) {
    if (id == animalId) {
      stopAnimal();
      speak("Oops! I can't play that sound right now. 📶");
    }
    return;
  }
  if (id != animalId) return;

  let plays = 0;
  animalAudio.src = url;
  animalAudio.currentTime = 0;
  animalAudio.onended = function () {
    if (id != animalId) return;
    plays++;
    // very short sounds (pig, elephant) play twice so kids don't miss them
    if (animalAudio.duration < 1.6 && plays < 2) {
      animalAudio.currentTime = 0;
      animalAudio.play().catch(() => {});
      return;
    }
    stopAnimal();
    speak("The " + a.name.toLowerCase() + " says " + a.says);
  };
  animalAudio.play().catch(() => {
    if (id == animalId) stopAnimal();
  });
}

function animalCommand(heard) {
  let sentence = " " + heard.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).join(" ") + " ";
  let found = animals.find((a) => a.words.some((w) => sentence.includes(" " + w + " ")));
  if (found) playAnimal(found);
  else speak("I don't know that animal's sound yet. Try lion, dog or cat! 🐾");
}

// ---------- Who is playing? ----------
// The app asks the name when it opens. Names are spoken from their Hindi spelling so they sound right.

const kids = [
  { name: "Anshu", hindi: "अंशु", emoji: "🦁", c: "#ff9f1a", d: "#c26a00",
    sounds: ["anshu", "anshoo", "ansu", "anshuu", "अंशु", "अंशू", "अंसु", "अन्शु", "अनशु"] },
  { name: "Divyansh", hindi: "दिव्यांश", emoji: "🚀", c: "#22b8ff", d: "#0577b8",
    sounds: ["divyansh", "divyaansh", "divyanshu", "divyans", "divansh", "दिव्यांश", "दिव्यंश", "दिवयांश", "दिव्यांशु", "दिवांश"] },
  { name: "Nishtha", hindi: "निष्ठा", emoji: "🦋", c: "#ff4fa3", d: "#c21a73",
    sounds: ["nishtha", "nishta", "nistha", "nista", "nishthaa", "निष्ठा", "निस्था", "निश्था", "निष्टा", "निस्ठा"] },
  { name: "Ishita", hindi: "इशिता", emoji: "🌸", c: "#9b5cff", d: "#6427c7",
    sounds: ["ishita", "eshita", "ishitha", "isita", "इशिता", "ईशिता", "इसिता", "इशीता"] },
  { name: "Aarohi", hindi: "आरोही", emoji: "🌈", c: "#3ed16f", d: "#16903f",
    sounds: ["aarohi", "arohi", "aarohee", "arohee", "आरोही", "आरोहि", "अरोही", "आरोई"] },
  { name: "Anvi", hindi: "अन्वी", emoji: "🐰", c: "#ffcf1a", d: "#c99500",
    sounds: ["anvi", "anvee", "anavi", "anwi", "अन्वी", "अनवी", "अन्वि", "अनवि", "अनुवी"] },
];

let player = null; // the kid who is playing now
let promptSpoken = false;

function buildKidGrid() {
  for (let kid of kids) {
    let b = document.createElement("button");
    b.className = "kid";
    b.style.setProperty("--c", kid.c);
    b.style.setProperty("--d", kid.d);
    b.innerHTML = '<span class="kidEmoji"></span><span class="kidName"></span>';
    b.querySelector(".kidEmoji").innerText = kid.emoji;
    b.querySelector(".kidName").innerText = kid.name;
    b.onclick = () => {
      buzz();
      welcomeKid(kid);
    };
    kidGrid.appendChild(b);
  }
}

// small spelling differences are fine: "nishta" is still Nishtha
function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      let keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] == b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

function findKid(guesses) {
  let words = guesses.flatMap((g) => cleanText(g).split(/[^\p{L}\p{M}\p{N}]+/u)).filter(Boolean);
  let sounds = kids.flatMap((kid) => kid.sounds.map((s) => ({ kid, s: cleanText(s) })));
  let exact = sounds.find(({ s }) => words.includes(s));
  if (exact) return exact.kid;
  let best = null;
  for (let w of words) {
    for (let { kid, s } of sounds) {
      if (s.length < 4) continue;
      let d = editDistance(w, s);
      if (d <= (s.length >= 7 ? 2 : 1) && (!best || d < best.d)) best = { kid, d };
    }
  }
  return best && best.kid;
}

function sayWelcome(text) {
  welcomeText.innerText = text;
  return speak(text);
}

function askName() {
  // the app opens only with the full sentence; name buttons are just for phones that can't listen
  kidGrid.hidden = !!mic;
  for (let b of kidGrid.children) b.classList.toggle("last", b.innerText.includes(load("sv-kid", "-")));
  sayWelcome("नमस्ते! अपना नाम ऐसे बताइए: My name is ... 👋");
}

// "my name is", "my name's", and how the mic may write it in Hindi letters
const MY_NAME_IS = ["my name is", "my names", "mine name is", "माय नेम इज", "माय नेम इस", "माई नेम इज", "माई नेम इस", "माय नेम ईज"];

function saidMyNameIs(text) {
  let words = " " + cleanText(text).replace(/[’']/g, "").split(/[^\p{L}\p{M}\p{N}]+/u).join(" ") + " ";
  return MY_NAME_IS.some((phrase) => words.includes(" " + cleanText(phrase) + " "));
}

function nameCommand(heard, otherGuesses) {
  let guesses = [heard, ...otherGuesses];
  let full = guesses.filter(saidMyNameIs);
  let kid = full.length ? findKid(full) : null;
  if (kid) return welcomeKid(kid);

  let nameOnly = findKid(guesses);
  if (nameOnly) {
    // the name alone is not enough: teach the full sentence
    sayWelcome("शाबाश! अब पूरा बोलो: My name is " + nameOnly.hindi + "! 😊");
    welcomeText.innerText = "शाबाश! अब पूरा बोलो: My name is " + nameOnly.name + "! 😊";
  } else if (full.length) {
    sayWelcome("यह नाम मुझे नहीं पता। फिर से बोलो: My name is ... 🙂");
  } else {
    sayWelcome("पूरा बोलो: My name is ... और अपना नाम! 🗣️");
  }
}

function welcomeKid(kid) {
  player = kid;
  if (kid) save("sv-kid", kid.name);
  tada();
  let greeting = sayWelcome(kid ? "Hello " + kid.hindi + ", आपका स्वागत है! 🎉" : "नमस्ते! आपका स्वागत है! 🎉");
  welcomeText.innerText = kid ? "Hello " + kid.name + ", आपका स्वागत है! 🎉" : "नमस्ते! आपका स्वागत है! 🎉";
  // go to the home screen once the greeting has been said
  greeting.then(() => {
    if (mode == "welcome") pick("home");
  });
}

$("changeName").onclick = () => {
  buzz();
  pick("welcome");
};

// phones only allow talking after the first touch: say the question then, if it wasn't heard yet
document.addEventListener("pointerdown", () => {
  if (mode == "welcome" && !promptSpoken && !listening) askName();
}, { once: true });

// ---------- Brain ----------

function think(heard, otherGuesses = []) {
  if (!heard) return;
  stopParty();

  if (isBlocked(heard)) {
    if (mode == "picture") showEmpty();
    safeReply();
    return;
  }
  if (mode == "welcome") nameCommand(heard, otherGuesses);
  else if (mode == "picture") showPicture(heard, otherGuesses);
  else if (mode == "animals") animalCommand(heard);
  else if (mode == "quiz") quizHeard(heard, otherGuesses);
  else if (mode == "ajooba") ajoobaHeard(heard);
  else lightCommand(heard);
}

// ---------- Keep the screen on ----------

let wakeLock = null;

async function keepAwake() {
  if (!("wakeLock" in navigator) || document.visibilityState != "visible") return;
  try {
    if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {}
}

document.addEventListener("visibilitychange", keepAwake);
document.addEventListener("pointerdown", keepAwake);
keepAwake();

// no long-press "save image" menus
document.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- Auto update ----------

let updateReady = false;

function busy() {
  let talking = "speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending);
  return listening || talking || disco || !cardLoading.hidden || !animalAudio.paused || (window.talkIsBusy && talkIsBusy());
}

function whenIdle() {
  if (updateReady && !busy()) location.reload();
}

if ("serviceWorker" in navigator) {
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState == "visible") reg.update().catch(() => {});
    });
  });

  // a new version took over: reload once the kid isn't in the middle of something
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    updateReady = true;
    whenIdle();
  });
}

// ---------- Install popup ----------
// Browsers never install a website by themselves - it needs one tap.
// So as soon as the link opens, show a big install button.

const installBox = $("installBox");
const installBtn = $("installBtn");
const installHelp = $("installHelp");
let installPrompt = null;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function showInstallBox() {
  if (isInstalled()) return;
  installBox.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installBtn.hidden = false;
  installHelp.hidden = true;
  showInstallBox();
});

installBtn.onclick = async function () {
  buzz();
  if (installPrompt) {
    installPrompt.prompt();
    let choice = await installPrompt.userChoice;
    installPrompt = null;
    if (choice.outcome == "accepted") installBox.hidden = true;
    return;
  }
  // no one-tap install on this browser: show how to do it by hand
  let iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  installHelp.innerText = iphone
    ? "Tap ⬆️ Share below, then \"Add to Home Screen\"."
    : "Tap the ⋮ menu at the top, then \"Install app\" or \"Add to Home screen\".";
  installHelp.hidden = false;
  installBtn.hidden = true;
};

$("installLater").onclick = () => (installBox.hidden = true);

window.addEventListener("appinstalled", () => {
  installBox.hidden = true;
  speak("The app is on your phone! Open it from the home screen. 🎉");
});

// Chrome usually offers one-tap install within a second; if not, show the popup anyway
setTimeout(showInstallBox, 2500);

// ---------- Start ----------

buildAnimalGrid();
buildKidGrid();
history.replaceState(null, "");
pick("welcome");
setLight(load("sv-light", OFF_COLOR), false);
