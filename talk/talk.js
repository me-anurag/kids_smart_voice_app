// ---------- Talk: chat, rhymes, story and riddles with Bolo (Hindi) ----------
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
  const tMic = $("tMic");
  const tMicLabel = $("tMicLabel");
  const tStars = $("tStars");
  const tTip = $("tTip");

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

  // ---------- starting: Talk opens straight into a chat, Story straight into a story ----------
  // (rhymes "rhyme" and riddles "riddle" also work on the server; they are kept for later)

  function startGame(name) {
    stopRecording(false);
    hush();
    game = name;
    history = [];
    tPicture.hidden = true;
    tHeard.innerText = "";
    showOptions([]);
    setState("idle");
    setMood("excited");
    turn("[START]");
  }

  $("tRepeat").onclick = async () => {
    buzz();
    stopRecording(false);
    if (!lastSay || state == "thinking") return;
    let id = ++turnId;
    await sayIt(lastSay);
    if (id == turnId) listenSoon();
  };

  // stop: Bolo stops talking (and listening)
  $("tStop").onclick = () => {
    buzz();
    turnId++;
    stopRecording(false);
    hush();
    tMascot.classList.remove("talking");
    setState("idle");
  };

  // ---------- listening ----------
  // 1st choice: the phone's Google speech recognition in Hindi (best for Indian kids' Hindi,
  //    shows the words live while the kid speaks).
  // Backup (no Google recognition on this phone, or it fails): record and send to Groq Whisper.

  const Google = window.SpeechRecognition || window.webkitSpeechRecognition;
  let useWhisper = !Google;
  let recording = false;

  function startRecording() {
    if (recording || !active || state == "thinking") return;
    clearTimeout(listenTimer);
    hush();
    if (useWhisper) whisperStart();
    else googleStart();
  }

  function stopRecording(sendIt) {
    if (!recording) return;
    if (useWhisper) whisperStop(sendIt);
    else googleStop(sendIt);
  }

  // ---------- Google (in the phone) ----------

  let rec = null;
  let finalText = "";
  let keepResult = true;

  function googleStart() {
    rec = new Google();
    rec.lang = "hi-IN";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    finalText = "";
    keepResult = true;
    let failed = false;
    let problem = "";
    let thisRec = rec;

    thisRec.onresult = (e) => {
      let done = "";
      let live = "";
      for (let r of e.results) {
        if (r.isFinal) done += r[0].transcript + " ";
        else live += r[0].transcript + " ";
      }
      finalText = done.trim();
      tHeard.innerText = "🗣️ " + (finalText + " " + live).trim(); // the kid sees their words appear
    };
    thisRec.onerror = (e) => {
      if (e.error == "aborted" || e.error == "no-speech") return;
      failed = true;
      if (e.error == "not-allowed") {
        problem = "माइक चालू करने की इजाज़त दो 🎤";
      } else if (["network", "service-not-allowed", "language-not-supported", "audio-capture"].includes(e.error)) {
        useWhisper = true; // Google can't help on this phone: use Whisper from now on
      }
    };
    thisRec.onend = () => {
      if (rec != thisRec) return;
      recording = false;
      rec = null;
      if (!active) return;
      if (failed && useWhisper) {
        setState("idle");
        return whisperStart(); // try again straight away with the backup
      }
      if (!keepResult) return state == "listening" && setState("idle");
      if (finalText) return heardText(finalText);
      setState("idle");
      if (problem) tMicLabel.innerText = problem;
      else if (!failed) noVoice();
    };

    try {
      thisRec.start();
    } catch (e) {
      useWhisper = true;
      return whisperStart();
    }
    recording = true;
    tHeard.innerText = "🗣️ ...";
    setState("listening");
    setMood("happy");
    buzz();
  }

  function googleStop(sendIt) {
    keepResult = sendIt;
    try {
      sendIt ? rec.stop() : rec.abort();
    } catch (e) {}
  }

  // ---------- Whisper (backup) ----------

  let stream = null;
  let recorder = null;
  let audioCtx = null;
  let meterTimer = null;

  // phones only allow audio processing after a tap: prepare it when Talk is opened
  function wakeAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume().catch(() => {});
  }

  function closeMic() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function whisperStart() {
    if (recording || !active) return;
    recording = true; // claim the mic now, so a second tap can't start another recording
    try {
      // raw sound: the phone's call filters are made for adults on calls and blur kids' voices
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
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
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 64000 });
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
    let started = Date.now();
    thisRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    thisRecorder.onstop = () => {
      clearInterval(meterTimer);
      closeMic();
      let blob = new Blob(chunks, { type: thisRecorder.mimeType || type || "audio/webm" });
      if (!thisRecorder.sendIt || !active) {
        if (state == "listening") setState("idle");
      } else if ((!heardVoice && Date.now() - started < 2500) || blob.size < 1500) {
        setState("idle");
        noVoice();
      } else {
        whisperSend(blob);
      }
    };
    thisRecorder.start(250);
    tHeard.innerText = "";
    setState("listening");
    setMood("happy");
    buzz();

    // stops by itself after the kid has spoken and then stays quiet for 2 seconds
    // (kids pause in the middle of sentences), or after 15 seconds
    wakeAudio();
    let analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    let source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    let samples = new Float32Array(analyser.fftSize);
    let lastVoice = Date.now();
    meterTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let level = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
      let now = Date.now();
      tMic.style.setProperty("--level", Math.min(1, level * 12).toFixed(2));
      if (level > 0.015) {
        heardVoice = true;
        lastVoice = now;
      }
      if (heardVoice && now - lastVoice > 2000 && now - started > 1200) whisperStop(true);
      else if (!heardVoice && now - started > 8000) whisperStop(true);
      else if (now - started > 15000) whisperStop(true);
    }, 100);
    thisRecorder.addEventListener("stop", () => source.disconnect(), { once: true });
  }

  function whisperStop(sendIt) {
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

  // Whisper sometimes "hears" these in silence or noise
  const NOT_SPEECH = /^(धन्यवाद|शुक्रिया|thank you|thanks for watching|सब्सक्राइब( करें)?|subscribe|बाय)[.!।]?$/i;

  async function whisperSend(blob) {
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
    if (NOT_SPEECH.test(text)) text = "";
    heardText(text);
  }

  // ---------- what the kid said ----------

  async function noVoice() {
    setMood("calm");
    let id = ++turnId;
    await sayIt("मुझे कुछ सुनाई नहीं दिया। बटन दबाकर ज़ोर से बोलो! 👂");
    if (id == turnId) listenSoon();
  }

  async function heardText(text) {
    text = (text || "").trim();
    setState("idle");
    if (!text || !/[\p{L}]/u.test(text)) {
      setMood("calm");
      let id = ++turnId;
      await sayIt("मुझे ठीक से सुनाई नहीं दिया, फिर से बोलो! 👂");
      if (id == turnId) listenSoon();
      return;
    }
    turn(text);
  }

  // the big button: speak, finish speaking, or interrupt Bolo and speak
  tMic.onclick = () => {
    wakeAudio();
    if (state == "thinking") return;
    if (recording) return stopRecording(true);
    turnId++; // whatever Bolo was about to do next is cancelled: the kid wants to talk
    startRecording();
  };

  // ---------- joining the app's modes ----------

  // Talk and Story share this screen; each opens straight into its own game
  function talkMode(title, gameName) {
    return {
      view,
      title,
      classes: "mode-talk",
      hints: [],
      hello: "",
      enter() {
        active = true;
        wakeAudio();
        showStars();
        setState("idle");
        checkHindiVoice();
        setTimeout(checkHindiVoice, 1500); // voices can load late
        startGame(gameName);
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
  }

  MODES.talk = talkMode("Talk", "chat");
  MODES.story = talkMode("Story", "story");

  window.talkIsBusy = () => active && state != "idle";
})();
