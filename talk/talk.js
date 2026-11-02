// ---------- Talk: chat, quiz, story and riddles with Bolo (Hindi) ----------
// Listening: Groq Whisper, Bolo's replies: Groq chat, both through netlify/functions/talk.
// Bolo's voice is the phone's Hindi voice.
//
// Turns: Bolo speaks (red mic) -> kid presses the mic and speaks (green) -> thinking (red) -> ...
// The mic is only switched on while listening: on Android an open mic makes speech very quiet.

(function () {
  const FUNCTION = "/.netlify/functions/talk";
  const DAILY_LIMIT = 100; // messages per phone per day, protects the free Groq quota

  const $ = (id) => document.getElementById(id);
  const view = $("talkView");
  const tBox = $("talkBox");
  const tMascot = $("tMascot");
  const tSay = $("tSay");
  const tHeard = $("tHeard");
  const tPicture = $("tPicture");
  const tOptions = $("tOptions");
  const tMenu = $("tMenu");
  const tPlay = $("tPlay");
  const tMic = $("tMic");
  const tMicLabel = $("tMicLabel");
  const tStars = $("tStars");
  const tTip = $("tTip");

  const GAME_WORDS = {
    chat: ["बात", "बातें", "baat", "baatein", "chat"],
    quiz: ["क्विज़", "क्विज", "quiz", "सवाल"],
    story: ["कहानी", "kahani", "story"],
    riddle: ["पहेली", "paheli", "riddle"],
  };

  let game = null;
  let history = [];
  let lastSay = "";
  let state = "idle"; // idle | speaking | listening | thinking
  let active = false;
  let turnId = 0;

  // ---------- the kid we are talking to ----------

  function kid() {
    let p = typeof player != "undefined" && player;
    return p ? { name: p.name, hindi: p.hindi, age: p.age || null } : { name: "Friend", hindi: "दोस्त", age: null };
  }

  function store(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem("talk-" + key + "-" + kid().name)) ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function keep(key, value) {
    try {
      localStorage.setItem("talk-" + key + "-" + kid().name, JSON.stringify(value));
    } catch (e) {}
  }

  function showStars() {
    tStars.innerText = "⭐ " + store("stars", 0);
  }

  function underLimit() {
    let day = new Date().toISOString().slice(0, 10);
    let used = store("used", { day, n: 0 });
    if (used.day != day) used = { day, n: 0 };
    if (used.n >= DAILY_LIMIT) return false;
    used.n++;
    keep("used", used);
    return true;
  }

  // ---------- whose turn is it? ----------

  const LABELS = {
    idle: "दबाओ और बोलो! 👇",
    speaking: "सुनो... 🔊",
    listening: "अब तुम बोलो! 👂",
    thinking: "सोच रहा हूँ... 🤔",
  };

  function setState(next) {
    state = next;
    tBox.dataset.state = next;
    tMicLabel.innerText = LABELS[next];
    tMic.classList.toggle("listening", next == "listening");
  }

  function setMood(mood) {
    tMascot.className = "tMascot " + (mood || "happy");
  }

  // Bolo says something; resolves when he has really finished speaking
  async function sayIt(text) {
    lastSay = text;
    tSay.innerText = text;
    tSay.classList.remove("pop");
    void tSay.offsetWidth;
    tSay.classList.add("pop");
    setState("speaking");
    tMascot.classList.add("talking");
    await speak(text);
    tMascot.classList.remove("talking");
    if (state == "speaking") setState("idle");
  }

  // phones without a Hindi voice say nothing (or read Hindi badly): tell the grown-ups how to fix it
  function checkHindiVoice() {
    if (!("speechSynthesis" in window)) return;
    let voices = speechSynthesis.getVoices();
    tTip.hidden = !voices.length || !!hindiVoice;
  }

  // ---------- pictures of what Bolo talks about ----------

  async function showPicture(title) {
    tPicture.hidden = true;
    if (!title || isBlocked(title)) return;
    try {
      let pages = goodPages(await wiki("en", { titles: title, prop: "pageimages|description", piprop: "thumbnail", pithumbsize: 640 }));
      let page = pages[0];
      if (!page || !page.thumbnail || isBlocked(page.description)) return;
      tPicture.querySelector("img").src = page.thumbnail.source;
      tPicture.hidden = false;
      tPicture.classList.remove("pop");
      void tPicture.offsetWidth;
      tPicture.classList.add("pop");
    } catch (e) {}
  }

  // ---------- one turn of the conversation ----------

  function showOptions(options) {
    tOptions.innerHTML = "";
    for (let text of options) {
      let b = document.createElement("button");
      b.className = "tOption";
      b.innerText = text;
      b.onclick = () => {
        buzz();
        turn(text);
      };
      tOptions.appendChild(b);
    }
  }

  async function turn(text) {
    if (!active || state == "thinking") return;
    text = (text || "").trim();
    if (!text) return;
    stopRecording(false);
    hush();
    showOptions([]);
    let id = ++turnId;

    if (isBlocked(text)) {
      setMood("calm");
      await sayIt("चलो, कुछ और मज़ेदार बात करते हैं! 🌈");
      if (id == turnId) listenSoon();
      return;
    }
    if (!underLimit()) {
      setMood("calm");
      await sayIt("आज हमने बहुत सारी बातें कर लीं! कल फिर बात करेंगे। 😊");
      return;
    }

    if (text != "[START]") tHeard.innerText = "🗣️ " + text;
    history.push({ role: "kid", text });
    setState("thinking");
    setMood("thinking");
    tSay.innerHTML = '<span class="tDots"><i></i><i></i><i></i></span>';

    let reply = null;
    try {
      let res = await fetch(FUNCTION, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "chat", kid: kid(), game, memory: store("memory", []), history }),
      });
      if (res.ok) reply = await res.json();
    } catch (e) {}
    if (id != turnId || !active) return;
    setState("idle");

    if (!reply || !reply.say) {
      history.pop();
      setMood("calm");
      await sayIt(navigator.onLine ? "मैं थोड़ा थक गया हूँ, थोड़ी देर बाद बात करते हैं! 😴" : "बात करने के लिए इंटरनेट चालू करो। 📶");
      return;
    }
    if (isBlocked(reply.say)) {
      reply = { say: "चलो, कुछ और मज़ेदार बात करते हैं! 🌈", mood: "calm", picture: "", options: [], star: false, remember: "", listen: true };
    }

    history.push({ role: "bolo", text: reply.say });
    if (reply.remember && !isBlocked(reply.remember)) {
      let memory = store("memory", []).filter((m) => m != reply.remember);
      keep("memory", [...memory, reply.remember].slice(-8));
    }
    if (reply.star) {
      keep("stars", store("stars", 0) + 1);
      showStars();
      tStars.classList.remove("pop");
      void tStars.offsetWidth;
      tStars.classList.add("pop");
      tada();
    }

    setMood(reply.mood);
    showPicture(reply.picture);
    showOptions(reply.options || []);
    await sayIt(reply.say);
    if (id == turnId && reply.listen) listenSoon();
  }

  // the kid presses the button to speak: after Bolo finishes, the button invites them
  let listenTimer = null;

  function listenSoon() {
    if (active && state == "idle") tMicLabel.innerText = "दबाओ और बोलो! 👇";
  }

  // ---------- menu: what shall we do? ----------

  async function showMenu() {
    game = null;
    history = [];
    let id = ++turnId;
    tMenu.hidden = false;
    tPlay.hidden = true;
    tPicture.hidden = true;
    tHeard.innerText = "";
    showOptions([]);
    setMood("excited");
    await sayIt("नमस्ते " + kid().hindi + "! आज क्या करें? बातें, क्विज़, कहानी या पहेली? 🎈");
    if (id == turnId) listenSoon();
  }

  function startGame(name) {
    buzz();
    stopRecording(false);
    hush();
    game = name;
    history = [];
    tMenu.hidden = true;
    tPlay.hidden = false;
    setState("idle");
    turn("[START]");
  }

  for (let b of document.querySelectorAll(".tGame")) b.onclick = () => startGame(b.dataset.game);

  function pickGameFromWords(text) {
    let clean = cleanText(text);
    for (let [name, words] of Object.entries(GAME_WORDS)) {
      if (words.some((w) => clean.includes(cleanText(w)))) return name;
    }
    return null;
  }

  $("tRepeat").onclick = async () => {
    buzz();
    stopRecording(false);
    if (!lastSay || state == "thinking") return;
    let id = ++turnId;
    await sayIt(lastSay);
    if (id == turnId) listenSoon();
  };

  $("tStop").onclick = () => {
    buzz();
    stopRecording(false);
    hush();
    setState("idle");
    showMenu();
  };

  // ---------- listening: record the kid, send to Whisper ----------

  let stream = null;
  let recorder = null;
  let audioCtx = null;
  let meterTimer = null;
  let recording = false;

  // phones only allow audio processing after a tap: prepare it when Talk is opened
  function wakeAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume().catch(() => {});
  }

  function closeMic() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function startRecording(auto) {
    if (recording || !active || state == "thinking") return;
    clearTimeout(listenTimer);
    hush();
    recording = true; // claim the mic now, so a second tap can't start another recording
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      recording = false;
      setState("idle");
      tMicLabel.innerText = "माइक चालू करने की इजाज़त दो 🎤";
      return;
    }
    if (!active || !recording) {
      recording = false;
      return closeMic();
    }

    let type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
      (t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)
    );
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch (e) {
      recording = false;
      closeMic();
      setState("idle");
      tMicLabel.innerText = "इस फ़ोन में रिकॉर्डिंग नहीं हो पा रही 😕";
      return;
    }

    let chunks = [];
    let heardVoice = false;
    let thisRecorder = recorder;
    thisRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    thisRecorder.onstop = () => {
      clearInterval(meterTimer);
      closeMic();
      let blob = new Blob(chunks, { type: thisRecorder.mimeType || type || "audio/webm" });
      if (!thisRecorder.sendIt || !active) {
        if (state == "listening") setState("idle");
      } else if (!heardVoice || blob.size < 1500) {
        setState("idle");
        if (!auto) noVoice();
      } else {
        send(blob);
      }
    };
    thisRecorder.start(250);
    setState("listening");
    setMood("happy");
    if (!auto) buzz();

    // stop by itself: after the kid speaks and then goes quiet, or if nobody speaks.
    // "Speaking" is measured against the room's own noise, so it works in quiet and noisy rooms.
    wakeAudio();
    let analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    let source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    let samples = new Float32Array(analyser.fftSize);
    let started = Date.now();
    let lastVoice = 0;
    let noise = 0.01;
    meterTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let level = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
      let now = Date.now();
      if (now - started < 300) noise = Math.max(noise, level); // first moment: learn the room noise
      tMic.style.setProperty("--level", Math.min(1, level * 12).toFixed(2));
      if (level > Math.max(0.02, noise * 2.5)) {
        heardVoice = true;
        lastVoice = now;
      }
      if (heardVoice && now - lastVoice > 1500) stopRecording(true);
      else if (!heardVoice && now - started > 8000) stopRecording(false);
      else if (now - started > 15000) stopRecording(true);
    }, 100);
    thisRecorder.addEventListener("stop", () => source.disconnect(), { once: true });
  }

  function stopRecording(sendIt) {
    if (!recording) return;
    recording = false;
    clearInterval(meterTimer);
    if (!recorder || recorder.state == "inactive") return closeMic();
    recorder.sendIt = sendIt;
    try {
      recorder.stop();
    } catch (e) {
      closeMic();
    }
  }

  async function noVoice() {
    setMood("calm");
    let id = ++turnId;
    await sayIt("मुझे कुछ सुनाई नहीं दिया। माइक दबाकर ज़ोर से बोलो! 👂");
    if (id == turnId) setState("idle");
  }

  // Whisper sometimes "hears" these in silence or noise
  const NOT_SPEECH = /^(धन्यवाद|शुक्रिया|thank you|thanks for watching|सब्सक्राइब( करें)?|subscribe|हाँ जी|बाय)[.!।]?$/i;

  async function send(blob) {
    setState("thinking");
    setMood("thinking");
    let text = "";
    try {
      let audio = await new Promise((done) => {
        let reader = new FileReader();
        reader.onload = () => done(String(reader.result).split(",")[1] || "");
        reader.readAsDataURL(blob);
      });
      let res = await fetch(FUNCTION, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "hear", audio, mime: blob.type, kid: kid() }),
      });
      if (res.ok) text = (await res.json()).text || "";
    } catch (e) {}
    if (!active) return;
    setState("idle");
    text = text.replace(/\s+/g, " ").trim();
    if (!text || NOT_SPEECH.test(text) || !/[\p{L}]/u.test(text)) {
      setMood("calm");
      let id = ++turnId;
      await sayIt("मुझे ठीक से सुनाई नहीं दिया, फिर से बोलो! 👂");
      if (id == turnId) listenSoon();
      return;
    }
    if (!game) {
      // in the menu: "कहानी" starts a story, anything else starts a chat about it
      let picked = pickGameFromWords(text);
      game = picked || "chat";
      history = [];
      tMenu.hidden = true;
      tPlay.hidden = false;
      return turn(picked ? "[START]" : text);
    }
    turn(text);
  }

  // the big button: listen, stop listening, or interrupt Bolo and listen
  tMic.onclick = () => {
    wakeAudio();
    if (state == "thinking") return;
    if (recording) return stopRecording(true);
    turnId++; // whatever Bolo was about to do next is cancelled: the kid wants to talk
    startRecording(false);
  };

  // ---------- joining the app's modes ----------

  MODES.talk = {
    view,
    title: "Talk",
    hints: [],
    hello: "",
    enter() {
      active = true;
      wakeAudio();
      showStars();
      setState("idle");
      checkHindiVoice();
      setTimeout(checkHindiVoice, 1500); // voices can load late
      showMenu();
    },
    leave() {
      active = false;
      turnId++;
      clearTimeout(listenTimer);
      stopRecording(false);
      closeMic();
      setState("idle");
    },
  };

  window.talkIsBusy = () => active && state != "idle";
})();
