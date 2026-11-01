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

  if (!("speechSynthesis" in window)) {
    wiggleBuddy();
    return;
  }

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
  // the mascot wiggles while it talks
  currentVoice = voice;
  voice.onstart = () => buddy.classList.add("talking");
  voice.onend = voice.onerror = function () {
    if (currentVoice != voice) return; // an older sentence that was cut off
    buddy.classList.remove("talking");
    whenIdle();
  };
  speechSynthesis.cancel();
  speechSynthesis.speak(voice);
  wiggleBuddy();
}

let currentVoice = null;

function wiggleBuddy() {
  buddy.classList.add("talking");
  setTimeout(() => {
    if (!("speechSynthesis" in window) || !speechSynthesis.speaking) buddy.classList.remove("talking");
  }, 1200);
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
  stopSlides();
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
    speak("नमस्ते! मैं बोलो बोलो हूँ। 👋");
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

const englishInfo = { prop: "pageimages|langlinks|pageprops", piprop: "thumbnail|name", pithumbsize: 960, lllang: "hi", ppprop: "disambiguation" };
const hindiInfo = { prop: "pageimages|extracts|pageprops", piprop: "thumbnail|name", pithumbsize: 960, exintro: 1, explaintext: 1, ppprop: "disambiguation" };

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

    // fetch extra photos while the Hindi text loads
    let more = english ? articlePictures("en", english.title) : null;

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
    speak("इंटरनेट में कुछ गड़बड़ है, फिर से कोशिश करो। 📶");
  }
}

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
