// ---------- Talk: chat, quiz, story and riddles with Bolo (Hindi) ----------
// Listening: Groq Whisper, Bolo's replies: Groq chat, both through netlify/functions/talk.
// Bolo's voice is the phone's Hindi voice.

(function () {
  const FUNCTION = "/.netlify/functions/talk";
  const DAILY_LIMIT = 100; // messages per phone per day, protects the free Groq quota

  const $ = (id) => document.getElementById(id);
  const view = $("talkView");
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

  const GAME_WORDS = {
    chat: ["बात", "बातें", "baat", "baatein", "chat"],
    quiz: ["क्विज़", "क्विज", "quiz", "सवाल"],
    story: ["कहानी", "kahani", "story"],
    riddle: ["पहेली", "paheli", "riddle"],
  };

  let game = null;
  let history = [];
  let lastSay = "";
  let thinking = false;
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

  // ---------- Bolo's face ----------

  function setMood(mood) {
    tMascot.className = "tMascot " + (mood || "happy");
  }

  function sayIt(text) {
    lastSay = text;
    tSay.innerText = text;
    tSay.classList.remove("pop");
    void tSay.offsetWidth;
    tSay.classList.add("pop");
    return speakAndWait(text);
  }

  // speak, and resolve when Bolo has finished talking
  function speakAndWait(text) {
    speak(text);
    tMascot.classList.add("talking");
    return new Promise((done) => {
      let started = Date.now();
      let check = setInterval(() => {
        let talking = "speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending);
        if ((!talking && Date.now() - started > 600) || Date.now() - started > 30000 || !active) {
          clearInterval(check);
          tMascot.classList.remove("talking");
          done();
        }
      }, 200);
    });
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
    if (!active || thinking) return;
    text = (text || "").trim();
    if (!text) return;
    stopRecording(false);
    showOptions([]);

    if (isBlocked(text)) {
      setMood("calm");
      await sayIt("चलो, कुछ और मज़ेदार बात करते हैं! 🌈");
      listenAfter(true);
      return;
    }
    if (!underLimit()) {
      setMood("calm");
      await sayIt("आज हमने बहुत सारी बातें कर लीं! कल फिर बात करेंगे। 😊");
      return;
    }

    if (text != "[START]") tHeard.innerText = "🗣️ " + text;
    history.push({ role: "kid", text });
    thinking = true;
    setMood("thinking");
    tSay.innerText = "🤔 ...";
    let id = ++turnId;

    let reply = null;
    try {
      let res = await fetch(FUNCTION, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "chat", kid: kid(), game, memory: store("memory", []), history }),
      });
      if (res.ok) reply = await res.json();
    } catch (e) {}
    thinking = false;
    if (id != turnId || !active) return;

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
    if (id == turnId) listenAfter(reply.listen);
  }

  // after Bolo asks something, the mic opens by itself
  function listenAfter(wanted) {
    if (wanted && active && !thinking) startRecording(true);
  }

  // ---------- menu: what shall we do? ----------

  function showMenu() {
    game = null;
    history = [];
    tMenu.hidden = false;
    tPlay.hidden = true;
    tPicture.hidden = true;
    tHeard.innerText = "";
    showOptions([]);
    setMood("excited");
    sayIt("नमस्ते " + kid().hindi + "! आज क्या करें? बातें, क्विज़, कहानी या पहेली? 🎈").then(() => listenAfter(true));
  }

  function startGame(name) {
    buzz();
    game = name;
    history = [];
    tMenu.hidden = true;
    tPlay.hidden = false;
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

  $("tRepeat").onclick = () => {
    buzz();
    stopRecording(false);
    if (lastSay) sayIt(lastSay);
  };

  $("tStop").onclick = () => {
    buzz();
    stopRecording(false);
    hush();
    turnId++;
    thinking = false;
    showMenu();
  };

  // ---------- listening: record the kid, send to Whisper ----------

  let stream = null;
  let recorder = null;
  let chunks = [];
  let audioCtx = null;
  let analyser = null;
  let meterTimer = null;
  let recording = false;

  function micLabel(text) {
    tMicLabel.innerText = text;
  }

  async function openMic() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return stream;
  }

  function closeMic() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = null;
    analyser = null;
  }

  // phones only allow audio processing after a tap: prepare it when Talk is opened
  function wakeAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume().catch(() => {});
  }

  async function startRecording(auto) {
    if (recording || thinking || !active) return;
    hush();
    try {
      await openMic();
    } catch (e) {
      micLabel("माइक चालू करने की इजाज़त दो 🎤");
      return;
    }
    if (!active) return;

    let type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
      (t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)
    );
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch (e) {
      micLabel("इस फ़ोन में रिकॉर्डिंग नहीं हो पा रही 😕");
      return;
    }
    chunks = [];
    let heardVoice = false;
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      tMic.classList.remove("listening");
      micLabel("दबाओ और बोलो!");
      clearInterval(meterTimer);
      if (recorder.sendIt && heardVoice) send(new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }));
    };
    recorder.start();
    recording = true;
    tMic.classList.add("listening");
    micLabel(auto ? "बोलो, मैं सुन रहा हूँ... 👂" : "सुन रहा हूँ... 👂");
    if (!auto) buzz();

    // stop by itself: after the kid speaks and then goes quiet, or if nobody speaks
    wakeAudio();
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
    }
    let samples = new Float32Array(analyser.fftSize);
    let started = Date.now();
    let lastVoice = 0;
    meterTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let level = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
      let now = Date.now();
      tMic.style.setProperty("--level", Math.min(1, level * 12).toFixed(2));
      if (level > 0.03) {
        heardVoice = true;
        lastVoice = now;
      }
      if (heardVoice && now - lastVoice > 1300) stopRecording(true);
      else if (!heardVoice && now - started > 7000) stopRecording(false);
      else if (now - started > 15000) stopRecording(heardVoice);
    }, 100);
  }

  function stopRecording(sendIt) {
    if (!recording) return;
    recording = false;
    clearInterval(meterTimer);
    recorder.sendIt = sendIt;
    try {
      recorder.stop();
    } catch (e) {}
  }

  // Whisper sometimes "hears" these in silence
  const NOT_SPEECH = /^(धन्यवाद|शुक्रिया|thank you|thanks for watching|सब्सक्राइब|subscribe)[.!।]?$/i;

  async function send(blob) {
    if (blob.size < 2000) return;
    thinking = true;
    setMood("thinking");
    micLabel("समझ रहा हूँ... 🤔");
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
        body: JSON.stringify({ action: "hear", audio, mime: blob.type }),
      });
      if (res.ok) text = (await res.json()).text || "";
    } catch (e) {}
    thinking = false;
    micLabel("दबाओ और बोलो!");
    if (!active) return;
    text = text.trim();
    if (!text || NOT_SPEECH.test(text)) {
      setMood("calm");
      await sayIt("मुझे ठीक से सुनाई नहीं दिया, फिर से बोलो! 👂");
      listenAfter(true);
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

  tMic.onclick = () => {
    wakeAudio();
    if (recording) stopRecording(true);
    else startRecording(false);
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
      showMenu();
    },
    leave() {
      active = false;
      turnId++;
      thinking = false;
      stopRecording(false);
      closeMic();
    },
  };

  window.talkIsBusy = () => active && (recording || thinking);
})();
