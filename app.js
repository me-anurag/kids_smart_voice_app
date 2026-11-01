// ---------- Elements ----------

const $ = (id) => document.getElementById(id);

const body = document.body;
const menuBtn = $("menuBtn");
const modeChip = $("modeChip");
const drawer = $("drawer");
const overlay = $("overlay");
const bulbWrap = $("bulbWrap");
const lightView = $("lightView");
const pictureView = $("pictureView");
const card = $("card");
const cardEmpty = $("cardEmpty");
const cardLoading = $("cardLoading");
const photo = $("photo");
const photoTitle = $("photoTitle");
const bubble = $("bubble");
const sound = $("sound");
const volume = $("volume");
const hints = $("hints");
const talk = $("talk");
const talkLabel = $("talkLabel");
const music = $("music");

$("version").innerText = "SmartVoice v" + APP_VERSION + " (" + BUILD + ")";

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

// ---------- Hindi voice ----------

let hindiVoice = null;

function findVoice() {
  let voices = speechSynthesis.getVoices();
  hindiVoice =
    voices.find((v) => v.lang.startsWith("hi") && v.localService) ||
    voices.find((v) => v.lang.startsWith("hi")) ||
    null;
}

if ("speechSynthesis" in window) {
  findVoice();
  speechSynthesis.onvoiceschanged = findVoice;
}

function speak(words) {
  let hindiNumbers = "०१२३४५६७८९";
  for (let i = 0; i < 10; i++) {
    words = words.replaceAll(hindiNumbers[i], i);
  }
  bubble.innerText = words;
  bubble.scrollTop = 0;

  if (!("speechSynthesis" in window)) return;

  // don't read emoji out loud
  let spoken = words.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "");
  let voice = new SpeechSynthesisUtterance(spoken);
  voice.lang = "hi-IN";
  if (hindiVoice) voice.voice = hindiVoice;
  voice.rate = 0.9;
  voice.pitch = 1.15;
  voice.onboundary = function (event) {
    let done = event.charIndex / spoken.length;
    bubble.scrollTop = done * (bubble.scrollHeight - bubble.clientHeight);
  };
  voice.onend = whenIdle;
  speechSynthesis.cancel();
  speechSynthesis.speak(voice);
}

function hush() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function safeReply() {
  speak("चलो, कुछ और देखते हैं! किसी जानवर या चीज़ का नाम बोलो। 🐼");
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
  mic.maxAlternatives = 1;

  mic.onresult = function (event) {
    let heard = event.results[0][0].transcript;
    think(heard.toLowerCase().trim());
  };

  mic.onerror = function (event) {
    if (event.error == "not-allowed" || event.error == "service-not-allowed") {
      speak("माइक चालू करने की इजाज़त दो, फिर बोलो! 🎤");
    } else if (event.error == "no-speech") {
      speak("कुछ सुनाई नहीं दिया, फिर से बोलो! 👂");
    } else if (event.error == "network") {
      speak("बोलने के लिए इंटरनेट चालू करो। 📶");
    }
  };

  mic.onend = function () {
    listening = false;
    talk.classList.remove("listening");
    talkLabel.innerText = "दबाओ और बोलो!";
    whenIdle();
  };
}

function listen() {
  buzz();
  if (!mic) {
    speak("इस फ़ोन में आवाज़ सुनने की सुविधा नहीं है। नीचे वाले बटन दबाओ! 👇");
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
    talkLabel.innerText = "सुन रहा हूँ...";
  } catch (e) {}
}

talk.onclick = listen;

// ---------- Modes + menu ----------

let mode = load("sv-mode", "light");

const lightHints = [
  ["💡 on", "on"], ["🌑 off", "off"], ["🔴 लाल", "red"], ["🔵 नीला", "blue"],
  ["🟢 हरा", "green"], ["🟡 पीला", "yellow"], ["🩷 गुलाबी", "pink"], ["🟣 बैंगनी", "purple"],
  ["🟠 नारंगी", "orange"], ["🎉 party", "party"], ["👋 hello", "hello"], ["⏰ time", "time"],
];

const pictureHints = [
  ["🐘 हाथी", "elephant"], ["🐯 बाघ", "tiger"], ["🦚 मोर", "peacock"], ["🦖 डायनासोर", "dinosaur"],
  ["🚀 रॉकेट", "rocket"], ["🌙 चाँद", "moon"], ["🌋 ज्वालामुखी", "volcano"],
  ["🕌 ताजमहल", "Taj Mahal"], ["🌈 इंद्रधनुष", "rainbow"], ["🦒 जिराफ़", "giraffe"],
];

function showHints(list) {
  hints.innerHTML = "";
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
  mode = name;
  save("sv-mode", name);
  stopParty();
  hush();

  body.className = "mode-" + name;
  for (let tile of document.querySelectorAll(".tile")) {
    tile.classList.toggle("selected", tile.dataset.mode == name);
  }

  if (name == "light") {
    lightView.hidden = false;
    pictureView.hidden = true;
    modeChip.innerText = "💡 बत्ती";
    showHints(lightHints);
    bubble.innerText = "बोलो: on, off, लाल, नीला, party... 💡";
  } else {
    lightView.hidden = true;
    pictureView.hidden = false;
    modeChip.innerText = "🖼️ तस्वीरें";
    showHints(pictureHints);
    bubble.innerText = "किसी भी चीज़ का नाम बोलो! 🖼️";
  }
}

function openMenu() {
  buzz();
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  history.pushState({ menu: true }, "");
}

function closeMenu(fromBack) {
  if (!drawer.classList.contains("open")) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  if (!fromBack && history.state && history.state.menu) history.back();
}

menuBtn.onclick = openMenu;
overlay.onclick = () => closeMenu(false);
window.addEventListener("popstate", () => closeMenu(true)); // phone back button closes menu
document.addEventListener("keydown", (e) => {
  if (e.key == "Escape") closeMenu(false);
});

for (let tile of document.querySelectorAll(".tile")) {
  tile.onclick = function () {
    buzz();
    pick(tile.dataset.mode);
    closeMenu(false);
  };
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
  bulbWrap.style.setProperty("--glow", color);
  bulbWrap.classList.toggle("on", color != OFF_COLOR);
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
  music.pause();
  sound.hidden = true;
}

function startParty() {
  let list = Object.values(colors).map((c) => c.color);
  bulbWrap.classList.add("party");
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
    speak("पार्टी टाइम! 🎉");
    return;
  }
  for (let c of Object.values(colors)) {
    if (says(words, c.words)) {
      setLight(c.color);
      speak("बत्ती " + c.name + " हो गई! 🌟");
      return;
    }
  }
  if (says(words, ["off", "band", "bujhao", "bujha", "बंद", "बुझाओ"])) {
    setLight(OFF_COLOR);
    speak("बत्ती बंद हो गई! 🌙");
  } else if (says(words, ["on", "chalu", "jalao", "jala", "चालू", "जलाओ"])) {
    setLight(ON_COLOR);
    speak("बत्ती जल गई! 💡");
  } else if (says(words, ["hello", "hi", "hey", "namaste", "नमस्ते", "हेलो"])) {
    speak("नमस्ते! मैं स्मार्टवॉइस हूँ। 👋");
  } else if (says(words, ["time", "samay", "टाइम", "समय"])) {
    let now = new Date();
    let hour = now.getHours() % 12 || 12;
    speak("अभी " + hour + " बजकर " + now.getMinutes() + " मिनट हुए हैं। ⏰");
  } else {
    speak("मुझे समझ नहीं आया, फिर से बोलो! 🤔");
  }
}

// ---------- Pictures mode (Wikipedia) ----------

let searchId = 0;

function wiki(lang, params) {
  let url = "https://" + lang + ".wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1";
  for (let key in params) url += "&" + key + "=" + encodeURIComponent(params[key]);
  return fetch(url).then((r) => r.json());
}

const englishInfo = { prop: "pageimages|langlinks|pageprops", piprop: "thumbnail", pithumbsize: 800, lllang: "hi", ppprop: "disambiguation" };
const hindiInfo = { prop: "pageimages|extracts|pageprops", piprop: "thumbnail", pithumbsize: 800, exintro: 1, explaintext: 1, ppprop: "disambiguation" };

function goodPage(data) {
  let page = data.query && data.query.pages && data.query.pages[0];
  if (!page || page.missing || page.invalid) return null;
  if (page.pageprops && "disambiguation" in page.pageprops) return null;
  return page;
}

async function findEnglish(name) {
  let page = goodPage(await wiki("en", { titles: name, ...englishInfo }));
  if (!page) page = goodPage(await wiki("en", { generator: "search", gsrsearch: name, gsrlimit: 1, ...englishInfo }));
  return page;
}

async function findHindi(params) {
  return goodPage(await wiki("hi", { ...params, ...hindiInfo }));
}

function shortHindi(extract) {
  let clean = (extract || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  let lines = clean.split("।").filter((l) => l.trim());
  let text = lines.slice(0, 2).join("।");
  if (text.length > 350) text = text.slice(0, 350).replace(/\s\S*$/, "") + "...";
  return text ? text + "।" : "";
}

function showLoading() {
  cardEmpty.hidden = true;
  photo.hidden = true;
  photoTitle.hidden = true;
  cardLoading.hidden = false;
}

function showEmpty() {
  cardLoading.hidden = true;
  photo.hidden = true;
  photoTitle.hidden = true;
  cardEmpty.hidden = false;
}

function showResult(title, imageUrl) {
  cardLoading.hidden = true;
  cardEmpty.hidden = true;
  photoTitle.innerText = title;
  photoTitle.hidden = false;
  if (imageUrl) {
    photo.src = imageUrl;
    photo.hidden = false;
  } else {
    photo.hidden = true;
  }
  card.classList.remove("bounce");
  void card.offsetWidth;
  card.classList.add("bounce");
}

async function showPicture(name) {
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
    let english = await findEnglish(name);
    if (id != searchId) return;

    let hindi = null;
    if (english && english.langlinks) {
      hindi = await findHindi({ titles: english.langlinks[0].title });
    }
    if (!hindi) {
      // maybe the kid said a Hindi word ("hathi") - search Hindi Wikipedia directly
      hindi = await findHindi({ generator: "search", gsrsearch: name, gsrlimit: 1 });
    }
    if (id != searchId) return;

    if (!english && !hindi) {
      showEmpty();
      speak("माफ़ करना, मुझे " + name + " नहीं मिला। कुछ और बोलो! 🙈");
      return;
    }

    let title = hindi ? hindi.title : english.title;
    let text = hindi ? shortHindi(hindi.extract) : "";
    let image = (english && english.thumbnail) || (hindi && hindi.thumbnail);

    if (isBlocked(english && english.title) || isBlocked(title) || isBlocked(text)) {
      showEmpty();
      safeReply();
      return;
    }

    showResult(title, image && image.source);
    speak(text || title + " के बारे में हिंदी में जानकारी नहीं मिली। 📖");
  } catch (e) {
    if (id != searchId) return;
    showEmpty();
    speak("इंटरनेट में कुछ गड़बड़ है, फिर से कोशिश करो। 📶");
  }
}

photo.onerror = () => (photo.hidden = true);

// ---------- Brain ----------

function think(heard) {
  if (!heard) return;
  stopParty();

  if (isBlocked(heard)) {
    if (mode == "picture") showEmpty();
    safeReply();
    return;
  }
  if (mode == "picture") showPicture(heard);
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
  return listening || talking || disco || !cardLoading.hidden;
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
    ? "नीचे ⬆️ Share दबाओ, फिर \"Add to Home Screen\" दबाओ।"
    : "ऊपर ⋮ मेन्यू दबाओ, फिर \"Install app\" या \"Add to Home screen\" दबाओ।";
  installHelp.hidden = false;
  installBtn.hidden = true;
};

$("installLater").onclick = () => (installBox.hidden = true);

window.addEventListener("appinstalled", () => {
  installBox.hidden = true;
  speak("ऐप फ़ोन में आ गया! अब होम स्क्रीन से खोलो। 🎉");
});

// Chrome usually offers one-tap install within a second; if not, show the popup anyway
setTimeout(showInstallBox, 2500);

// ---------- Start ----------

pick(mode);
setLight(load("sv-light", OFF_COLOR), false);
