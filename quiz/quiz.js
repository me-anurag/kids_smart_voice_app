// ---------- Quiz: guess the sport / monument from a photo, or the animal from its sound ----------
// Bolo reads the question and the answers aloud (each answer lights up as he reads it),
// the kid answers by voice (English or Hindi) or by tapping. Scores are saved for each kid on this phone.

(function () {
  const ROUND = 10; // questions per round
  const LEVELS = [
    { stars: 0, name: "Bronze", badge: "🥉" },
    { stars: 10, name: "Silver", badge: "🥈" },
    { stars: 25, name: "Gold", badge: "🥇" },
    { stars: 50, name: "Champion", badge: "🏆" },
  ];
  const PRAISE = ["Shabash", "Wow, super", "Amazing", "Yay, you got it", "Brilliant", "Kamaal kar diya", "Well done"];
  const OOPS = ["Oops! Try again.", "Almost! Try once more.", "Not this one! Try again."];

  const $ = (id) => document.getElementById(id);
  const view = $("quizView");
  const qMenu = $("qMenu");
  const qGame = $("qGame");
  const qResult = $("qResult");
  const qPhoto = $("qPhoto");
  const qCard = $("qCard");
  const qSoundEmoji = $("qSoundEmoji");
  const qBuddy = $("qBuddy");
  const qAsk = $("qAsk");
  const qOptions = $("qOptions");
  const qFeedback = $("qFeedback");
  const qScore = $("qScore");
  const qStreak = $("qStreak");
  const qDots = $("qDots");
  const qNext = $("qNext");

  let cat = null; // "sports", "monuments" or "animals"
  let questions = [];
  let index = 0;
  let score = 0;
  let streak = 0;
  let rightCount = 0;
  let tries = 0;
  let answered = false;
  let active = false;
  let nextTimer = null;
  let askId = 0;

  // ---------- saved progress for each kid ----------

  function who() {
    return (typeof player != "undefined" && player) ? player : { name: "Guest", hindi: "दोस्त" };
  }

  function progress() {
    try {
      return Object.assign({ stars: 0, best: {}, played: 0 }, JSON.parse(localStorage.getItem("quiz-" + who().name)));
    } catch (e) {
      return { stars: 0, best: {}, played: 0 };
    }
  }

  function saveProgress(p) {
    try {
      localStorage.setItem("quiz-" + who().name, JSON.stringify(p));
    } catch (e) {}
  }

  function levelOf(stars) {
    let level = LEVELS[0];
    for (let l of LEVELS) if (stars >= l.stars) level = l;
    return level;
  }

  function nextLevel(stars) {
    return LEVELS.find((l) => l.stars > stars) || null;
  }

  function levelBar(stars) {
    let now = levelOf(stars);
    let next = nextLevel(stars);
    let pct = next ? ((stars - now.stars) / (next.stars - now.stars)) * 100 : 100;
    return { now, next, pct };
  }

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- little sounds ----------

  let synth = null;

  function notes(list, type = "triangle", gap = 0.09, volume = 0.15) {
    try {
      synth = synth || new (window.AudioContext || window.webkitAudioContext)();
      synth.resume().catch(() => {});
      let t = synth.currentTime;
      list.forEach((freq, i) => {
        let osc = synth.createOscillator();
        let gain = synth.createGain();
        let start = t + i * gap;
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (i == list.length - 1 ? 0.5 : 0.22));
        osc.connect(gain).connect(synth.destination);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    } catch (e) {}
  }

  const sounds = {
    right: () => notes([523, 659, 784, 1047]),
    wrong: () => notes([330, 262], "sine", 0.16, 0.18),
    streak: () => notes([784, 988, 1175, 1568], "square", 0.07, 0.06),
    win: () => notes([523, 659, 784, 1047, 784, 1047, 1319], "triangle", 0.12),
  };

  // ---------- confetti and flying points ----------

  function confetti(amount = 60) {
    let layer = $("qConfetti");
    let colors = ["#ffd60a", "#ff5fd2", "#2ec5ff", "#7bed3f", "#ff9f1a", "#9b5cff", "#ffffff"];
    for (let i = 0; i < amount; i++) {
      let c = document.createElement("i");
      c.style.left = Math.random() * 100 + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.4 + "s";
      c.style.animationDuration = 1.4 + Math.random() * 1.2 + "s";
      c.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
      c.style.setProperty("--drift", (Math.random() * 120 - 60).toFixed(0) + "px");
      if (i % 3 == 0) c.style.borderRadius = "50%";
      layer.appendChild(c);
      setTimeout(() => c.remove(), 3000);
    }
  }

  function flyPoints(text) {
    let p = document.createElement("div");
    p.className = "qFly";
    p.innerText = text;
    qCard.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  // Bolo's face on the quiz screen: "cheer" jumps for joy, "oops" tilts sadly
  function buddyMood(mood) {
    qBuddy.classList.remove("cheer", "oops");
    void qBuddy.offsetWidth;
    if (mood) qBuddy.classList.add(mood);
  }

  // ---------- speaking (English) ----------

  function talk(text, onSentence) {
    return active ? speak(text, onSentence) : Promise.resolve();
  }

  // ---------- pictures: load before showing, retry, never leave a blank card ----------

  const loaded = new Map(); // url -> Promise<boolean>

  function loadImage(url) {
    if (!loaded.has(url)) {
      let attempt = (n) =>
        new Promise((done) => {
          let img = new Image();
          img.onload = () => done(true);
          img.onerror = () => done(false);
          img.src = n ? url + "?retry=" + n : url;
        }).then((ok) => ok || (n < 1 ? new Promise((r) => setTimeout(r, 700)).then(() => attempt(n + 1)) : false));
      loaded.set(url, attempt(0).then((ok) => {
        if (!ok) loaded.delete(url); // try again next time
        return ok;
      }));
    }
    return loaded.get(url);
  }

  function imageUrl(item) {
    return "quiz/img/" + cat + "/" + item.key + ".jpg";
  }

  // ---------- animal sounds ----------

  const quizAudio = new Audio();
  let soundPlays = 0;

  function playSound(item) {
    soundPlays = 0;
    quizAudio.onended = () => {
      // very short sounds (pig, elephant) play twice so kids don't miss them
      if (quizAudio.duration < 1.6 && ++soundPlays < 2) {
        quizAudio.currentTime = 0;
        quizAudio.play().catch(() => {});
      } else {
        qCard.classList.remove("playing");
      }
    };
    return new Promise((done) => {
      quizAudio.src = item.sound;
      quizAudio.currentTime = 0;
      qCard.classList.add("playing");
      let finish = () => {
        quizAudio.removeEventListener("ended", finish);
        done();
      };
      quizAudio.addEventListener("ended", finish);
      setTimeout(finish, 8000);
      quizAudio.play().catch(finish);
    }).then(() => new Promise((r) => setTimeout(r, quizAudio.duration < 1.6 ? 1500 : 300)));
  }

  function stopSound() {
    quizAudio.onended = null;
    quizAudio.pause();
    qCard.classList.remove("playing");
  }

  // ---------- menu ----------

  function showMenu() {
    cat = null;
    askId++;
    clearTimeout(nextTimer);
    stopSound();
    qMenu.hidden = false;
    qGame.hidden = true;
    qResult.hidden = true;
    let p = progress();
    let { now, next, pct } = levelBar(p.stars);
    $("qLevelBadge").innerText = now.badge;
    $("qLevelName").innerText = who().name + " · " + now.name;
    $("qLevelStars").innerText = "⭐ " + p.stars + (next ? " / " + next.stars : "");
    $("qLevelFill").style.width = pct + "%";
    for (let card of document.querySelectorAll(".qCat")) {
      let best = p.best[card.dataset.cat];
      card.querySelector(".qBest").innerText = best ? "Best: " + best + " 🏅" : "New! ✨";
    }
    bubble.innerText = "Pick a quiz!";
    talk("Hi " + who().name + "! Pick a quiz. Sports, monuments, or animal sounds?");
  }

  for (let card of document.querySelectorAll(".qCat")) {
    let quiz = QUIZ[card.dataset.cat];
    if (quiz.cover) card.querySelector(".qCatImg").style.backgroundImage = "url(quiz/img/" + card.dataset.cat + "/" + quiz.cover + ".jpg)";
    card.onclick = () => {
      buzz();
      start(card.dataset.cat);
    };
  }

  // ---------- a round ----------

  function shuffle(list) {
    let a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start(category) {
    cat = category;
    questions = shuffle(QUIZ[cat].items).slice(0, ROUND);
    index = 0;
    score = 0;
    streak = 0;
    rightCount = 0;
    qMenu.hidden = true;
    qResult.hidden = true;
    qGame.hidden = false;
    qScore.innerText = "🪙 0";
    qStreak.hidden = true;
    qDots.innerHTML = questions.map(() => "<i></i>").join("");
    // get this round's pictures ready in the background, so they appear instantly
    if (QUIZ[cat].type != "sound") questions.forEach((item) => loadImage(imageUrl(item)));
    ask();
  }

  function current() {
    return questions[index];
  }

  async function ask() {
    clearTimeout(nextTimer);
    stopSound();
    let id = ++askId;
    let item = current();
    let quiz = QUIZ[cat];
    tries = 0;
    answered = false;
    qNext.hidden = true;
    qFeedback.className = "";
    qFeedback.innerText = "";
    buddyMood(null);
    [...qDots.children].forEach((d, i) => (d.className = i < index ? d.className : i == index ? "now" : ""));

    // the answer buttons
    let others = shuffle(quiz.items.filter((x) => x.key != item.key)).slice(0, 2);
    let options = shuffle([item, ...others]);
    qOptions.innerHTML = "";
    for (let option of options) {
      let b = document.createElement("button");
      b.className = "qOption" + (option.dark ? " dark" : "");
      b.dataset.key = option.key;
      b.innerHTML = '<span class="qOptEmoji"></span><span></span>';
      b.firstChild.innerText = option.emoji;
      b.lastChild.innerText = option.name;
      b.onclick = () => {
        buzz();
        answer(option, b);
      };
      qOptions.appendChild(b);
    }
    qAsk.innerText = quiz.question;

    // the card: a photo (only shown once it has really loaded), or a speaker for sounds
    qCard.className = "enter";
    qPhoto.classList.remove("reveal");
    if (quiz.type == "sound") {
      qCard.classList.add("sound");
      qSoundEmoji.innerText = "🔊";
      qSoundEmoji.classList.remove("dark");
    } else {
      qCard.classList.add("loading");
      qPhoto.removeAttribute("src");
      let ok = await loadImage(imageUrl(item));
      if (id != askId) return;
      qCard.classList.remove("loading");
      if (ok) {
        qPhoto.src = imageUrl(item);
        void qPhoto.offsetWidth;
        qPhoto.classList.add("reveal");
      } else {
        // the picture could not load: show the big emoji instead, the question still works
        qCard.classList.add("sound", "noPhoto");
        qSoundEmoji.innerText = item.emoji;
      }
    }

    // Bolo reads the question and every answer; each answer lights up while he reads it
    let first = index == 0 ? "Let's play, " + who().name + "! " : "";
    let names = options.map((o) => o.name);
    let reading = first + quiz.question + " " + names.slice(0, -1).join("? ") + "? Or " + names[names.length - 1] + "?";
    let lead = first ? 2 : 1; // sentences before the first answer
    let light = (i) => [...qOptions.children].forEach((b, n) => b.classList.toggle("reading", n == i - lead));
    if (quiz.type == "sound") {
      await talk(first + "Listen carefully!");
      if (id != askId) return;
      await playSound(item);
      if (id != askId) return;
      reading = quiz.question + " " + names.slice(0, -1).join("? ") + "? Or " + names[names.length - 1] + "?";
      lead = 1;
    }
    await talk(reading, light);
    light(-1);
  }

  // tap the card: hear the sound again (sound quiz), or bounce the photo
  qCard.onclick = () => {
    if (!active || cat == null) return;
    if (QUIZ[cat].type == "sound" && !answered) {
      hush();
      playSound(current());
    }
  };

  $("qRepeat").onclick = () => {
    buzz();
    if (cat == null || answered) return;
    hush();
    let item = current();
    let names = [...qOptions.querySelectorAll(".qOption:not(.wrong)")].map((b) => b.lastChild.innerText);
    let light = (i) => [...qOptions.children].forEach((b) => b.classList.toggle("reading", b.lastChild.innerText == names[i - 1]));
    let read = () => talk(QUIZ[cat].question + " " + names.slice(0, -1).join("? ") + (names.length > 1 ? "? Or " : "") + names[names.length - 1] + "?", light).then(() => light(-1));
    if (QUIZ[cat].type == "sound") playSound(item).then(read);
    else read();
  };

  async function answer(option, button) {
    if (answered || !active) return;
    let item = current();
    button = button || qOptions.querySelector('[data-key="' + option.key + '"]');
    if (button && button.classList.contains("wrong")) return;
    tries++;
    let id = ++askId; // stops the reading of the answers
    hush();
    stopSound();
    [...qOptions.children].forEach((b) => b.classList.remove("reading"));

    if (option.key == item.key) {
      answered = true;
      rightCount++;
      streak++;
      let points = tries == 1 ? 10 : 5;
      let bonus = streak > 0 && streak % 3 == 0 ? 5 : 0;
      score += points + bonus;
      qScore.innerText = "🪙 " + score;
      bump(qScore);
      if (button) button.classList.add("right");
      qCard.classList.remove("wrong", "enter");
      qCard.classList.add("right");
      if (QUIZ[cat].type == "sound") {
        qSoundEmoji.innerText = item.emoji; // the animal appears
        qSoundEmoji.classList.toggle("dark", !!item.dark);
      }
      qDots.children[index].className = tries == 1 ? "right" : "half";
      flyPoints("+" + (points + bonus));
      confetti();
      sounds.right();
      buddyMood("cheer");
      if (streak >= 3) {
        qStreak.hidden = false;
        qStreak.innerText = "🔥 " + streak;
        bump(qStreak);
        if (bonus) setTimeout(sounds.streak, 400);
      }
      let praise = randomOf(PRAISE);
      qFeedback.className = "good";
      qFeedback.innerText = "✅ " + item.name + "! " + item.fact;
      let streakLine = bonus ? " " + streak + " in a row! You are on fire!" : "";
      await talk(praise + ", " + who().name + "! It's " + item.name + "!" + streakLine + " " + item.fact);
      if (active && id == askId) showNext();
      return;
    }

    // wrong answer
    streak = 0;
    qStreak.hidden = true;
    if (button) {
      button.classList.add("wrong");
      button.disabled = true;
    }
    qCard.classList.remove("right", "wrong", "enter");
    void qCard.offsetWidth;
    qCard.classList.add("wrong");
    sounds.wrong();
    buddyMood("oops");
    if (tries == 1) {
      qFeedback.className = "hint";
      qFeedback.innerText = "💡 " + item.hint;
      await talk(randomOf(OOPS) + " Here's a hint. " + item.hint);
    } else {
      answered = true;
      qDots.children[index].className = "miss";
      let rightButton = qOptions.querySelector('[data-key="' + item.key + '"]');
      if (rightButton) rightButton.classList.add("right");
      if (QUIZ[cat].type == "sound") {
        qSoundEmoji.innerText = item.emoji;
        qSoundEmoji.classList.toggle("dark", !!item.dark);
      }
      qFeedback.className = "good";
      qFeedback.innerText = "👉 It's " + item.name + "! " + item.fact;
      await talk("It's " + item.name + "! Let's remember it. " + item.fact);
      if (active && id == askId) showNext();
    }
  }

  function showNext() {
    qNext.hidden = false;
    qNext.innerText = index + 1 < questions.length ? "Next ▶" : "See my score 🏆";
    nextTimer = setTimeout(next, 3000);
  }

  function next() {
    clearTimeout(nextTimer);
    if (!active || cat == null) return;
    index++;
    if (index < questions.length) ask();
    else finish();
  }

  qNext.onclick = () => {
    buzz();
    hush();
    next();
  };

  // ---------- end of round ----------

  async function finish() {
    askId++;
    stopSound();
    let p = progress();
    let stars = rightCount >= 9 ? 3 : rightCount >= 6 ? 2 : 1;
    let before = levelOf(p.stars);
    let record = score > (p.best[cat] || 0);
    p.stars += stars;
    p.played++;
    if (record) p.best[cat] = score;
    saveProgress(p);
    let after = levelOf(p.stars);

    qGame.hidden = true;
    qResult.hidden = false;
    $("qResultTitle").innerText = rightCount >= 6 ? "Great job, " + who().name + "!" : "Well played, " + who().name + "!";
    $("qResultRight").innerText = rightCount + " / " + questions.length + " right";
    $("qRecord").hidden = !record;
    // stars pop in one by one
    let starsEl = $("qResultStars");
    starsEl.innerHTML = "";
    [1, 2, 3].forEach((n) =>
      setTimeout(() => {
        let star = document.createElement("i");
        star.innerText = "⭐";
        if (n <= stars) star.className = "on";
        starsEl.appendChild(star);
      }, n * 350)
    );

    // count the score up
    let shown = 0;
    let counter = setInterval(() => {
      shown = Math.min(score, shown + Math.ceil(score / 20) || 1);
      $("qResultScore").innerText = "🪙 " + shown;
      if (shown >= score) clearInterval(counter);
    }, 50);

    let { now, next, pct } = levelBar(p.stars);
    $("qResultLevel").innerText = now.badge + " " + now.name + (next ? " · " + (next.stars - p.stars) + " ⭐ to " + next.name : " · Top level!");
    $("qResultFill").style.width = pct + "%";

    sounds.win();
    confetti(record ? 140 : 90);
    let line = rightCount + " right! You won " + stars + (stars == 1 ? " star" : " stars") + "!";
    if (record) line += " That's a new record!";
    if (after.name != before.name) {
      line += " And you are now " + after.name + "!";
      setTimeout(() => confetti(120), 1200);
    }
    bubble.innerText = "🏆 " + line;
    await talk("Great job " + who().name + "! " + line + " Do you want to play again?");
  }

  $("qAgain").onclick = () => {
    buzz();
    start(cat);
  };
  $("qMenuBtn").onclick = () => {
    buzz();
    showMenu();
  };

  // ---------- answers by voice ----------

  function words(text) {
    return " " + cleanText(text).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).join(" ") + " ";
  }

  // which item did the kid say? longest match wins ("table tennis" beats "tennis")
  function heardItem(texts, items) {
    let best = null;
    for (let text of texts) {
      let sentence = words(text);
      let tokens = sentence.trim().split(" ");
      for (let item of items) {
        for (let s of item.say) {
          let say = words(s).trim();
          let hit = sentence.includes(" " + say + " ");
          if (!hit && !say.includes(" ") && say.length >= 5) {
            hit = tokens.some((t) => editDistance(t, say) <= (say.length >= 8 ? 2 : 1));
          }
          if (hit && (!best || say.length > best.len)) best = { item, len: say.length };
        }
      }
    }
    return best && best.item;
  }

  function heard(text, otherGuesses = []) {
    let texts = [text, ...otherGuesses];
    if (!cat) {
      // in the menu
      let all = texts.join(" ").toLowerCase();
      if (/animal|sound|जानवर|janwar|आवाज़|आवाज|awaaz|awaz/.test(all)) return start("animals");
      if (/sport|खेल|khel|स्पोर्ट/.test(all)) return start("sports");
      if (/monument|स्मारक|smarak|मॉन्यूमेंट|building/.test(all)) return start("monuments");
      return talk("Say sports, monuments, or animal sounds!");
    }
    if (!qResult.hidden) {
      if (/again|yes|फिर|phir|dobara|दोबारा|play|हाँ|haan/.test(texts.join(" ").toLowerCase())) return start(cat);
      return;
    }
    if (answered) return next();
    let item = heardItem(texts, QUIZ[cat].items);
    if (item) return answer(item);
    talk("I didn't catch that. Say it again, or tap the answer!");
  }

  // ---------- joining the app's modes ----------

  MODES.quiz = {
    view,
    title: "Quiz",
    hints: [],
    hello: "Pick a quiz!",
    enter() {
      active = true;
      showMenu();
    },
    leave() {
      active = false;
      cat = null;
      askId++;
      clearTimeout(nextTimer);
      stopSound();
    },
  };

  window.quizHeard = heard;
})();
