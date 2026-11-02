// ---------- Ajooba: "guess first, then the surprise!" with Gappu the explorer elephant (Hindi) ----------
// Each wonder: Gappu asks a question, reads the choices (each lights up), the kid guesses,
// then the surprising answer is revealed with the photo. Saved favourites and counters per kid.

(function () {
  const DAILY_GOAL = 5;
  const $ = (id) => document.getElementById(id);
  const view = $("ajoobaView");
  const ajCard = $("ajCard");
  const ajPhoto = $("ajPhoto");
  const ajPhotoBg = $("ajPhotoBg");
  const ajEmoji = $("ajEmoji");
  const ajTopic = $("ajTopic");
  const ajNumber = $("ajNumber");
  const ajSay = $("ajSay");
  const ajGappu = $("ajGappu");
  const ajOptions = $("ajOptions");
  const ajResult = $("ajResult");
  const ajActions = $("ajActions");
  const ajToday = $("ajToday");
  const ajRight = $("ajRight");
  const ajSavedCount = $("ajSavedCount");
  const ajSaved = $("ajSaved");
  const ajSavedList = $("ajSavedList");
  const ajZoom = $("ajZoom");

  // many short lines, never the same one twice in a row
  const LINES = {
    first: ["नमस्ते {name}! मैं गप्पू हूँ, अजूबे खोजने वाला हाथी। चलो, एक पहेली से शुरू करते हैं!"],
    ask: ["अंदाज़ा लगाओ!", "सोचो, सोचो!", "बताओ तो सही!", "चलो देखते हैं!", "यह वाला मुश्किल है!", "ध्यान से सुनो!", ""],
    right: ["शाबाश! बिल्कुल सही!", "वाह! सही जवाब!", "अरे वाह, तुम तो पक्के खोजी हो!", "एकदम सही!", "हाँ! तुमने सही पकड़ा!", "कमाल कर दिया!"],
    wrong: ["उफ़! अच्छा अंदाज़ा था।", "ओहो, नहीं!", "अरे नहीं! पर कोई बात नहीं।", "हम्म, यह नहीं!", "अरे! यह तो चौंकाने वाला है।"],
    funny: ["हाहाहा!", "हीहीही!", "हाहा, सोचो ज़रा!"],
    wow: ["वाह! है ना कमाल?", "सच में! मैं भी हैरान हो गया था!", "अजूबा है ना!"],
    giggle: ["हीहीही! मुझे भी हँसी आ गई!", "हाहाहा! पागलपन है ना?"],
    saved: ["यह अजूबा तुम्हारी लिस्ट में आ गया!", "सेव हो गया! बाद में फिर सुनना।"],
  };
  const lastLine = {};

  function line(kind) {
    let list = LINES[kind].filter((l) => l != lastLine[kind] || LINES[kind].length == 1);
    let pick = list[Math.floor(Math.random() * list.length)];
    lastLine[kind] = pick;
    return pick.replace("{name}", who().hindi);
  }

  let active = false;
  let fact = null;
  let factId = 0;
  let firstTime = true;
  let answered = false;
  let shownOptions = []; // the choices as shown, with which one is right

  // ---------- each kid's own Ajooba progress ----------

  function who() {
    return (typeof player != "undefined" && player) ? player : { name: "Guest", hindi: "दोस्त" };
  }

  function progress() {
    let today = new Date().toISOString().slice(0, 10);
    let p;
    try {
      p = Object.assign({ seen: [], saved: [], day: today, today: 0, right: 0, total: 0 }, JSON.parse(localStorage.getItem("ajooba-" + who().name)));
    } catch (e) {
      p = { seen: [], saved: [], day: today, today: 0, right: 0, total: 0 };
    }
    if (p.day != today) {
      p.day = today;
      p.today = 0;
      p.right = 0;
    }
    return p;
  }

  function saveProgress(p) {
    try {
      localStorage.setItem("ajooba-" + who().name, JSON.stringify(p));
    } catch (e) {}
  }

  function showCounters() {
    let p = progress();
    ajToday.innerText = "🌟 " + p.today + (p.today < DAILY_GOAL ? "/" + DAILY_GOAL : "");
    ajRight.innerText = "✅ " + p.right;
    ajSavedCount.innerText = p.saved.length;
    let saveBtn = $("ajSave");
    let saved = fact && p.saved.includes(fact.id);
    saveBtn.classList.toggle("done", !!saved);
    saveBtn.innerText = saved ? "⭐ सेव है" : "⭐ सेव";
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  // ---------- choosing the next wonder: unseen first, a different topic from the last one ----------

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function nextFact() {
    let p = progress();
    let unseen = AJOOBA.filter((f) => !p.seen.includes(f.id));
    if (!unseen.length) {
      p.seen = []; // every wonder seen: start again
      saveProgress(p);
      unseen = AJOOBA;
    }
    let otherTopic = unseen.filter((f) => !fact || f.t != fact.t);
    return randomOf(otherTopic.length ? otherTopic : unseen);
  }

  // ---------- pictures (from Wikipedia), loaded before they are shown ----------

  const pictures = new Map(); // title -> Promise<url or null>

  function pictureOf(title) {
    if (!pictures.has(title)) {
      let job = wiki("en", { titles: title, prop: "pageimages", piprop: "thumbnail", pithumbsize: 800 })
        .then((data) => {
          let page = goodPages(data)[0];
          let url = page && page.thumbnail && page.thumbnail.source;
          if (!url) return null;
          return new Promise((done) => {
            let img = new Image();
            img.onload = () => done(url);
            img.onerror = () => done(null);
            img.src = url;
            setTimeout(() => done(null), 9000);
          });
        })
        .catch(() => null)
        .then((url) => {
          if (!url) pictures.delete(title); // try again another time
          return url;
        });
      pictures.set(title, job);
    }
    return pictures.get(title);
  }

  // ---------- Gappu, sounds and sparkles ----------

  const GAPPU_FACE = { wow: "gappu-cheer", giggle: "gappu-giggle", sad: "gappu-oops", thinking: "gappu-thinking" };

  function gappu(mood) {
    face(ajGappu, GAPPU_FACE[mood] || "gappu");
    ajGappu.classList.remove("wow", "giggle", "excited", "sad");
    void ajGappu.offsetWidth;
    if (mood) ajGappu.classList.add(mood);
  }

  let synth = null;

  function notes(list, type = "triangle", gap = 0.09, volume = 0.15, slide = 0) {
    try {
      synth = synth || new (window.AudioContext || window.webkitAudioContext)();
      synth.resume().catch(() => {});
      let t = synth.currentTime;
      list.forEach((freq, i) => {
        let osc = synth.createOscillator();
        let gain = synth.createGain();
        let start = t + i * gap;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, start + 0.25);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (i == list.length - 1 ? 0.45 : 0.2));
        osc.connect(gain).connect(synth.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch (e) {}
  }

  const sounds = {
    reveal: () => notes([392, 523, 659, 784, 1047], "triangle", 0.07),
    right: () => notes([659, 784, 1047, 1319], "triangle", 0.08),
    wrong: () => notes([330, 262], "sine", 0.16, 0.16),
    boing: () => notes([220, 330], "sine", 0.12, 0.18, 2.2),
  };

  function sparkles(list = ["✨", "🤩", "⭐", "💫"]) {
    for (let i = 0; i < 12; i++) {
      let s = document.createElement("span");
      s.className = "ajSpark";
      s.innerText = list[i % list.length];
      s.style.left = 8 + Math.random() * 84 + "%";
      s.style.animationDelay = Math.random() * 0.35 + "s";
      ajCard.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  function talk(text, onSentence) {
    return active ? speak(text, onSentence) : Promise.resolve();
  }

  // ---------- one wonder ----------

  function shuffledOptions(f) {
    let list = f.o.map((text, i) => ({ text, right: i == f.a }));
    if (f.o == TRUE_FALSE || f.o == YES_NO) return list; // keep सच/झूठ and हाँ/नहीं in order
    for (let i = list.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // the words Gappu reads for a choice (without the emoji)
  function spoken(text) {
    return text.replace(/[0-9#*]\u{FE0F}?\u{20E3}/gu, "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, "").trim();
  }

  async function tell(next) {
    let id = ++factId;
    hush();
    fact = next;
    answered = false;
    let topic = AJOOBA_TOPICS[fact.t];
    let p = progress();
    ajNumber.innerText = "अजूबा #" + (p.total + 1);

    // the card shows the photo straight away: it is a clue, not the answer
    ajCard.className = "loading";
    ajPhoto.removeAttribute("src");
    ajPhotoBg.removeAttribute("src");
    ajEmoji.innerText = fact.e;
    ajTopic.innerText = topic.emoji + " " + topic.name;
    ajResult.hidden = true;
    ajActions.hidden = true;
    ajOptions.hidden = false;
    ajSay.classList.remove("fact");
    showCounters();
    gappu("excited");

    // the choices
    shownOptions = shuffledOptions(fact);
    ajOptions.innerHTML = "";
    shownOptions.forEach((opt, i) => {
      let b = document.createElement("button");
      b.className = "ajOption";
      b.innerText = opt.text;
      b.onclick = () => {
        buzz();
        guess(i);
      };
      ajOptions.appendChild(b);
    });
    ajSay.innerText = fact.q;

    pictureOf(fact.pic).then((url) => {
      if (id != factId) return;
      ajCard.className = (url ? "photo" : "emoji") + " pop";
      if (url) ajPhoto.src = ajPhotoBg.src = url;
    });

    // Gappu asks: question, then every choice (each lights up while he reads it)
    let opener = firstTime ? line("first") : line("ask");
    firstTime = false;
    let names = shownOptions.map((o) => spoken(o.text));
    let reading = (opener ? opener + " " : "") + fact.q + " " + names.slice(0, -1).join("? ") + "? या " + names[names.length - 1] + "?";
    let lead = (opener ? opener.split(/(?<=[।!?.])\s+/).length : 0) + fact.q.split(/(?<=[।!?.])\s+/).length;
    let light = (i) => [...ajOptions.children].forEach((b, n) => b.classList.toggle("reading", n == i - lead));
    await talk(reading, light);
    light(-1);
    if (id == factId && !answered) {
      ajOptions.classList.add("waiting");
      gappu("thinking"); // Gappu waits for the kid's guess
    }
  }

  async function guess(i) {
    if (answered || !active || !fact) return;
    answered = true;
    let id = ++factId;
    hush();
    ajOptions.classList.remove("waiting");
    let chosen = shownOptions[i];
    let buttons = [...ajOptions.children];
    buttons.forEach((b, n) => {
      b.classList.remove("reading");
      b.disabled = true;
      if (shownOptions[n].right) b.classList.add("right");
    });
    if (!chosen.right) buttons[i].classList.add("wrong");

    // count it
    let p = progress();
    if (!p.seen.includes(fact.id)) p.seen.push(fact.id);
    p.today++;
    p.total++;
    if (chosen.right) p.right++;
    saveProgress(p);
    showCounters();
    bump(chosen.right ? ajRight : ajToday);

    // the kid sees right / wrong on the buttons for a moment...
    if (chosen.right) sounds.right();
    else sounds.wrong();
    await new Promise((r) => setTimeout(r, 900));
    if (id != factId || !active) return;

    // ...then the surprise: a ribbon on the photo, the fact in Gappu's bubble
    let rightText = spoken(shownOptions.find((o) => o.right).text);
    ajResult.className = chosen.right ? "right" : "wrong";
    ajResult.innerText = (chosen.right ? "✅ सही जवाब: " : "💡 सही जवाब: ") + rightText;
    ajResult.hidden = false;
    ajOptions.hidden = true;
    ajActions.hidden = false;
    ajSay.innerText = fact.f;
    ajSay.classList.add("fact");
    ajCard.classList.remove("pop");
    void ajCard.offsetWidth;
    ajCard.classList.add("reveal");

    if (chosen.right) {
      sparkles(["⭐", "✨", "🎉", "💫"]);
      gappu("wow");
    } else {
      gappu("sad");
    }
    if (fact.fun) setTimeout(() => (sounds.boing(), gappu("giggle")), 700);
    else setTimeout(sounds.reveal, 600);

    let reaction = chosen.right ? line("right") : line("wrong");
    if (fact.fun) reaction += " " + line("funny");
    await talk(reaction + " " + fact.f);
    if (id != factId || !active) return;

    // daily goal reached
    if (p.today == DAILY_GOAL) {
      tada();
      sparkles(["🌟", "🎉", "⭐", "🏆"]);
      gappu("wow");
      await talk("शाबाश " + who().hindi + "! आज तुमने " + DAILY_GOAL + " अजूबे खोज लिए! तुम तो पक्के खोजी हो!");
    }
    if (id == factId) $("ajNext").classList.add("ready");
    // get the next picture ready while the kid reads
    pictureOf(nextFact().pic);
  }

  // ---------- buttons ----------

  $("ajNext").onclick = () => {
    buzz();
    $("ajNext").classList.remove("ready");
    tell(nextFact());
  };

  $("ajAgain").onclick = () => {
    buzz();
    if (!fact) return;
    factId++;
    talk(fact.f);
  };

  $("ajWow").onclick = async () => {
    buzz();
    factId++;
    gappu(fact && fact.fun ? "giggle" : "wow");
    sparkles(fact && fact.fun ? ["😂", "🤣", "😄", "✨"] : ["😲", "🤯", "✨", "⭐"]);
    await talk(line(fact && fact.fun ? "giggle" : "wow"));
  };

  $("ajSave").onclick = async () => {
    buzz();
    if (!fact) return;
    let p = progress();
    if (p.saved.includes(fact.id)) {
      p.saved = p.saved.filter((x) => x != fact.id);
      saveProgress(p);
      return showCounters();
    }
    p.saved.push(fact.id);
    saveProgress(p);
    showCounters();
    bump($("ajSavedBtn"));
    sparkles(["⭐", "🌟", "✨", "💛"]);
    factId++;
    await talk(line("saved"));
  };

  // tap the photo to see it big
  ajCard.onclick = () => {
    if (!ajCard.classList.contains("photo")) return;
    ajZoom.querySelector("img").src = ajPhoto.src;
    ajZoom.hidden = false;
  };
  ajZoom.onclick = () => (ajZoom.hidden = true);

  // ---------- my saved wonders ----------

  $("ajSavedBtn").onclick = () => {
    buzz();
    let p = progress();
    let saved = AJOOBA.filter((f) => p.saved.includes(f.id));
    ajSavedList.innerHTML = "";
    if (!saved.length) {
      ajSavedList.innerHTML = '<p class="ajEmpty">अभी कोई अजूबा सेव नहीं है। जवाब के बाद ⭐ दबाओ!</p>';
    }
    for (let f of saved) {
      let item = document.createElement("button");
      item.className = "ajSavedItem";
      item.innerHTML = '<span class="ajSavedEmoji"></span><span></span>';
      item.firstChild.innerText = f.e;
      item.lastChild.innerText = f.f;
      item.onclick = () => {
        buzz();
        factId++;
        talk(f.f);
      };
      ajSavedList.appendChild(item);
    }
    ajSaved.hidden = false;
  };

  $("ajSavedClose").onclick = () => {
    buzz();
    ajSaved.hidden = true;
  };

  // voice: say "और" / "next" for another wonder
  function heard(text) {
    if (/और|aur|next|agla|अगला|another|more/i.test(text)) return $("ajNext").click();
  }

  // ---------- joining the app's modes ----------

  MODES.ajooba = {
    view,
    title: "Ajooba",
    hints: [],
    hello: "",
    enter() {
      active = true;
      firstTime = true;
      ajSaved.hidden = true;
      ajZoom.hidden = true;
      tell(nextFact());
    },
    leave() {
      active = false;
      factId++;
    },
  };

  window.ajoobaHeard = heard;
})();
