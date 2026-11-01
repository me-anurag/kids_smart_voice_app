// ---------- Quiz: guess the sport / monument from a photo ----------
// Answer by voice (English or Hindi) or by tapping. Scores are saved for each kid on this phone.

(function () {
  const ROUND = 10; // questions per round
  const LEVELS = [
    { stars: 0, name: "Bronze", badge: "🥉" },
    { stars: 10, name: "Silver", badge: "🥈" },
    { stars: 25, name: "Gold", badge: "🥇" },
    { stars: 50, name: "Champion", badge: "🏆" },
  ];
  const PRAISE = ["Shabash", "Wow, super", "Amazing", "Yay, you got it", "Brilliant", "Kamaal kar diya"];

  const $ = (id) => document.getElementById(id);
  const view = $("quizView");
  const qMenu = $("qMenu");
  const qGame = $("qGame");
  const qResult = $("qResult");
  const qPhoto = $("qPhoto");
  const qCard = $("qCard");
  const qAsk = $("qAsk");
  const qOptions = $("qOptions");
  const qFeedback = $("qFeedback");
  const qScore = $("qScore");
  const qStreak = $("qStreak");
  const qDots = $("qDots");
  const qNext = $("qNext");

  let cat = null; // "sports" or "monuments"
  let questions = [];
  let index = 0;
  let score = 0;
  let streak = 0;
  let rightCount = 0;
  let tries = 0;
  let answered = false;
  let active = false;
  let nextTimer = null;

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

  // ---------- little sounds ----------

  let synth = null;

  function notes(list, type = "triangle", gap = 0.09, volume = 0.15) {
    try {
      synth = synth || new (window.AudioContext || window.webkitAudioContext)();
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

  // ---------- speaking (English) ----------

  function talk(text) {
    speak(text);
    return new Promise((done) => {
      let started = Date.now();
      let check = setInterval(() => {
        let busy = "speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending);
        if ((!busy && Date.now() - started > 500) || Date.now() - started > 15000 || !active) {
          clearInterval(check);
          done();
        }
      }, 200);
    });
  }

  // ---------- menu ----------

  function showMenu() {
    cat = null;
    clearTimeout(nextTimer);
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
    bubble.innerText = "Pick a quiz! ⚽ or 🏛️";
    talk("Hi " + who().name + "! Pick a quiz. Sports, or monuments?");
  }

  for (let card of document.querySelectorAll(".qCat")) {
    card.querySelector(".qCatImg").style.backgroundImage = "url(quiz/img/" + card.dataset.cat + "/" + QUIZ[card.dataset.cat].cover + ".jpg)";
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
    ask();
  }

  function current() {
    return questions[index];
  }

  function ask() {
    clearTimeout(nextTimer);
    let item = current();
    tries = 0;
    answered = false;
    qNext.hidden = true;
    qFeedback.className = "";
    qFeedback.innerText = "";
    [...qDots.children].forEach((d, i) => (d.className = i < index ? d.className : i == index ? "now" : ""));

    // the photo starts blurry and slowly becomes clear
    qCard.className = "";
    qPhoto.classList.remove("reveal");
    qPhoto.src = "quiz/img/" + cat + "/" + item.key + ".jpg";
    void qPhoto.offsetWidth;
    qPhoto.classList.add("reveal");
    qCard.classList.add("enter");

    qAsk.innerText = QUIZ[cat].question;
    let others = shuffle(QUIZ[cat].items.filter((x) => x.key != item.key)).slice(0, 2);
    qOptions.innerHTML = "";
    for (let option of shuffle([item, ...others])) {
      let b = document.createElement("button");
      b.className = "qOption";
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
    bubble.innerText = QUIZ[cat].question + " 🤔";
    talk(QUIZ[cat].question);
  }

  async function answer(option, button) {
    if (answered || !active) return;
    let item = current();
    button = button || qOptions.querySelector('[data-key="' + option.key + '"]');
    tries++;

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
      qCard.className = "right";
      qDots.children[index].className = tries == 1 ? "right" : "half";
      flyPoints("+" + (points + bonus));
      confetti();
      sounds.right();
      if (streak >= 3) {
        qStreak.hidden = false;
        qStreak.innerText = "🔥 " + streak;
        bump(qStreak);
        if (bonus) setTimeout(sounds.streak, 400);
      }
      let praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      qFeedback.className = "good";
      qFeedback.innerText = "✅ " + item.name + "! " + item.fact;
      bubble.innerText = praise + "! 🎉";
      await talk(praise + " " + who().name + "! It's " + item.name + "! " + item.fact);
      if (active && answered && current() == item) showNext();
      return;
    }

    // wrong answer
    streak = 0;
    qStreak.hidden = true;
    if (button) {
      button.classList.add("wrong");
      button.disabled = true;
    }
    qCard.className = "wrong";
    sounds.wrong();
    if (tries == 1) {
      qFeedback.className = "hint";
      qFeedback.innerText = "💡 " + item.hint;
      await talk("Oops! Here's a hint. " + item.hint);
    } else {
      answered = true;
      qDots.children[index].className = "miss";
      let rightButton = qOptions.querySelector('[data-key="' + item.key + '"]');
      if (rightButton) rightButton.classList.add("right");
      qFeedback.className = "good";
      qFeedback.innerText = "👉 It's " + item.name + "! " + item.fact;
      await talk("It's " + item.name + "! Let's remember it. " + item.fact);
      if (active && current() == item) showNext();
    }
  }

  function showNext() {
    qNext.hidden = false;
    qNext.innerText = index + 1 < questions.length ? "Next ▶" : "See my score 🏆";
    nextTimer = setTimeout(next, 2500);
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
    if (record) line += " New record!";
    if (after.name != before.name) {
      line += " And you are now " + after.name + "!";
      setTimeout(() => confetti(120), 1200);
    }
    bubble.innerText = "🏆 " + line;
    await talk("Great job " + who().name + "! " + line);
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
      if (/sport|खेल|khel|स्पोर्ट/.test(all)) return start("sports");
      if (/monument|स्मारक|smarak|मॉन्यूमेंट|building/.test(all)) return start("monuments");
      return talk("Say sports, or monuments!");
    }
    if (!qResult.hidden) {
      if (/again|फिर|phir|dobara|दोबारा|play/.test(texts.join(" ").toLowerCase())) return start(cat);
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
    hello: "Pick a quiz! ⚽ or 🏛️",
    enter() {
      active = true;
      showMenu();
    },
    leave() {
      active = false;
      cat = null;
      clearTimeout(nextTimer);
    },
  };

  window.quizHeard = heard;
})();
