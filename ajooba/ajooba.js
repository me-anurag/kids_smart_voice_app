// ---------- Ajooba: Gappu the explorer elephant tells surprising facts, in Hindi ----------
// Mixed topics, a picture for every fact, reactions (वाह / हाहा), saved favourites per kid.

(function () {
  const DAILY_GOAL = 5;
  const $ = (id) => document.getElementById(id);
  const view = $("ajoobaView");
  const ajCard = $("ajCard");
  const ajPhoto = $("ajPhoto");
  const ajPhotoBg = $("ajPhotoBg");
  const ajEmoji = $("ajEmoji");
  const ajTopic = $("ajTopic");
  const ajFact = $("ajFact");
  const ajGappu = $("ajGappu");
  const ajNext = $("ajNext");
  const ajToday = $("ajToday");
  const ajSavedCount = $("ajSavedCount");
  const ajSaved = $("ajSaved");
  const ajSavedList = $("ajSavedList");
  const ajReact = $("ajReact");

  const TEASERS = [
    "पता है?",
    "अरे सुनो, सुनो!",
    "एक मज़ेदार बात बताऊँ?",
    "यह सुनकर तुम चौंक जाओगे!",
    "मेरी खोज में मुझे एक अजूबा मिला!",
    "कान खोलकर सुनो!",
  ];
  const AFTER = ["है ना कमाल?", "हाहा, मज़ेदार है ना?", "क्या तुम्हें पता था?", "वाह! और एक सुनोगे?", "अजीब है ना?"];
  const WOW = ["वाह! है ना कमाल?", "हाँ! मैं भी सुनकर हैरान हो गया था!", "सच में अजूबा है ना!"];
  const HAHA = ["हीहीही! बहुत मज़ेदार है ना?", "हाहाहा! मुझे भी हँसी आ गई!", "हीही! है ना मज़ेदार?"];

  let active = false;
  let fact = null;
  let factId = 0;
  let firstTime = true;
  let counted = false;

  // ---------- each kid's own Ajooba progress ----------

  function who() {
    return (typeof player != "undefined" && player) ? player : { name: "Guest", hindi: "दोस्त" };
  }

  function progress() {
    let today = new Date().toISOString().slice(0, 10);
    let p;
    try {
      p = Object.assign({ seen: [], saved: [], day: today, today: 0, total: 0 }, JSON.parse(localStorage.getItem("ajooba-" + who().name)));
    } catch (e) {
      p = { seen: [], saved: [], day: today, today: 0, total: 0 };
    }
    if (p.day != today) {
      p.day = today;
      p.today = 0;
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
    ajToday.innerText = "🌟 आज: " + p.today + (p.today < DAILY_GOAL ? " / " + DAILY_GOAL : "");
    ajSavedCount.innerText = p.saved.length;
    let saved = fact && p.saved.includes(fact.id);
    let saveBtn = ajReact.querySelector('[data-r="save"]');
    saveBtn.classList.toggle("done", !!saved);
    saveBtn.innerText = saved ? "⭐ सेव हो गया" : "⭐ सेव";
  }

  // ---------- choosing the next fact: unseen first, a different topic from the last one ----------

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function nextFact() {
    let p = progress();
    let unseen = AJOOBA.filter((f) => !p.seen.includes(f.id));
    if (!unseen.length) {
      p.seen = []; // every fact seen: start again
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
      let job = wiki("en", { titles: title, prop: "pageimages", piprop: "thumbnail", pithumbsize: 640 })
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

  // ---------- Gappu's face and little effects ----------

  function gappu(mood) {
    ajGappu.classList.remove("wow", "giggle", "excited");
    void ajGappu.offsetWidth;
    if (mood) ajGappu.classList.add(mood);
  }

  function sparkles(list = ["✨", "🤩", "⭐", "💫"]) {
    for (let i = 0; i < 12; i++) {
      let s = document.createElement("span");
      s.className = "ajSpark";
      s.innerText = list[i % list.length];
      s.style.left = 10 + Math.random() * 80 + "%";
      s.style.animationDelay = Math.random() * 0.4 + "s";
      ajCard.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  function talk(text) {
    return active ? speak(text) : Promise.resolve();
  }

  // ---------- telling a fact ----------

  async function tell(next, fromSaved = false) {
    let id = ++factId;
    hush();
    fact = next;
    counted = false;
    let topic = AJOOBA_TOPICS[fact.t];

    // the card: shimmer while the picture loads
    ajCard.className = "loading";
    ajPhoto.removeAttribute("src");
    ajPhotoBg.removeAttribute("src");
    ajEmoji.innerText = fact.e;
    ajTopic.innerText = topic.emoji + " " + topic.name;
    ajFact.innerText = "🔍 ...";
    ajReact.classList.remove("ready");
    showCounters();
    gappu("excited");

    let picture = pictureOf(fact.pic);
    let intro = firstTime
      ? "नमस्ते " + who().hindi + "! मैं गप्पू हूँ, अजूबे खोजने वाला हाथी! चलो, तुम्हें एक अजूबा सुनाता हूँ।"
      : randomOf(TEASERS);
    firstTime = false;
    ajFact.innerText = intro;
    await talk(intro);
    let url = await picture;
    if (id != factId || !active) return;

    // the picture pops in (or the big emoji if there is no picture)
    ajCard.className = url ? "photo pop" : "emoji pop";
    if (url) ajPhoto.src = ajPhotoBg.src = url;
    sparkles();
    ajFact.innerText = fact.f;

    // count it as learned, once per fact
    if (!fromSaved) {
      let p = progress();
      if (!p.seen.includes(fact.id)) p.seen.push(fact.id);
      p.today++;
      p.total++;
      saveProgress(p);
      counted = true;
      showCounters();
      bump(ajToday);
    }

    await talk(fact.f);
    if (id != factId || !active) return;
    ajReact.classList.add("ready");

    // daily goal reached
    let p = progress();
    if (counted && p.today == DAILY_GOAL) {
      tada();
      sparkles(["🌟", "🎉", "⭐", "🏆"]);
      gappu("wow");
      await talk("शाबाश " + who().hindi + "! आज तुमने " + DAILY_GOAL + " अजूबे सीख लिए! तुम तो पक्के खोजी हो!");
      if (id != factId || !active) return;
    }
    await talk(randomOf(AFTER));
    // get the next picture ready while the kid reacts
    pictureOf(nextFact().pic);
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  ajNext.onclick = () => {
    buzz();
    tell(nextFact());
  };

  // ---------- reactions ----------

  for (let b of ajReact.querySelectorAll("button")) {
    b.onclick = async () => {
      buzz();
      if (!fact) return;
      factId++; // stop the rest of what Gappu was saying
      hush();
      let r = b.dataset.r;
      if (r == "wow") {
        gappu("wow");
        sparkles(["😲", "🤯", "✨", "⭐"]);
        await talk(randomOf(WOW));
      } else if (r == "haha") {
        gappu("giggle");
        sparkles(["😂", "🤣", "😄", "✨"]);
        await talk(randomOf(HAHA));
      } else if (r == "save") {
        let p = progress();
        if (p.saved.includes(fact.id)) {
          p.saved = p.saved.filter((x) => x != fact.id);
          saveProgress(p);
          showCounters();
          return;
        }
        p.saved.push(fact.id);
        saveProgress(p);
        showCounters();
        bump($("ajSavedBtn"));
        gappu("wow");
        sparkles(["⭐", "🌟", "✨", "💛"]);
        await talk("यह अजूबा तुम्हारी लिस्ट में सेव हो गया!");
      }
    };
  }

  // ---------- my saved facts ----------

  $("ajSavedBtn").onclick = () => {
    buzz();
    let p = progress();
    let saved = AJOOBA.filter((f) => p.saved.includes(f.id));
    ajSavedList.innerHTML = "";
    if (!saved.length) {
      ajSavedList.innerHTML = '<p class="ajEmpty">अभी कोई अजूबा सेव नहीं है। किसी अजूबे पर ⭐ दबाओ!</p>';
    }
    for (let f of saved) {
      let item = document.createElement("button");
      item.className = "ajSavedItem";
      item.innerHTML = '<span class="ajSavedEmoji"></span><span></span>';
      item.firstChild.innerText = f.e;
      item.lastChild.innerText = f.f;
      item.onclick = () => {
        buzz();
        ajSaved.hidden = true;
        tell(f, true);
      };
      ajSavedList.appendChild(item);
    }
    ajSaved.hidden = false;
  };

  $("ajSavedClose").onclick = () => {
    buzz();
    ajSaved.hidden = true;
  };

  // say "और" / "next" to hear another one
  function heard(text) {
    if (/और|aur|next|agla|अगला|another|more|फिर/i.test(text)) return tell(nextFact());
    if (/वाह|wow|waah/i.test(text)) return ajReact.querySelector('[data-r="wow"]').click();
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
      tell(nextFact());
    },
    leave() {
      active = false;
      factId++;
    },
  };

  window.ajoobaHeard = heard;
})();
