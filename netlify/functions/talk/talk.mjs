// Netlify Function: the only place that knows the Groq API keys.
// The app sends what the kid said; this asks Groq and sends back Bolo's reply.
//
// Netlify environment variables (Site configuration -> Environment variables):
//   GROQ_API_KEY_1, GROQ_API_KEY_2   your two free Groq keys (key 2 is the fallback)
//   GROQ_API_KEY_3   for Pictures only: helps when a word is unclear (keys 1 and 2 are its backup)
//   GROQ_MODELS      optional, comma-separated chat models to try in order
//   GROQ_STT_MODELS  optional, comma-separated speech-to-text models to try in order

import { systemPrompt, replySchema } from "./prompt.mjs";

const API = "https://api.groq.com/openai/v1";
const KEYS = [process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].filter(Boolean);
const GUIDE_KEYS = [process.env.GROQ_API_KEY_3, ...KEYS].filter(Boolean);
// Llama 3.3 first: it is trained for Hindi and writes much better Hindi than gpt-oss
const MODELS = (process.env.GROQ_MODELS || "llama-3.3-70b-versatile,openai/gpt-oss-120b")
  .split(",").map((m) => m.trim()).filter(Boolean);
// the full Whisper is more accurate for children's Hindi; turbo is the backup
const STT_MODELS = (process.env.GROQ_STT_MODELS || "whisper-large-v3,whisper-large-v3-turbo")
  .split(",").map((m) => m.trim()).filter(Boolean);
const URDU_SCRIPT = /[؀-ۿ]/;
const MOODS = replySchema.properties.mood.enum;
const GAMES = ["chat", "rhyme", "story", "riddle"];

export default async (req) => {
  if (req.method != "POST") return json({ error: "post-only" }, 405);
  if (!sameSite(req)) return json({ error: "forbidden" }, 403);
  if (!GUIDE_KEYS.length) return json({ error: "no-keys" }, 503);

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: "bad-request" }, 400);
  }
  if (body.action == "hear") return KEYS.length ? hear(body) : json({ error: "no-keys" }, 503);
  if (body.action == "chat") return KEYS.length ? chat(body) : json({ error: "no-keys" }, 503);
  if (body.action == "guide") return guide(body);
  return json({ error: "bad-request" }, 400);
};

// only this website may use the function (stops others from spending your quota)
function sameSite(req) {
  let origin = req.headers.get("origin");
  if (!origin) return true;
  let allowed = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL].filter(Boolean);
  if (!allowed.length) return true;
  return allowed.some((u) => new URL(u).origin == origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

// key 1 first; on limits or errors try key 2
async function withKeys(send, keys = KEYS) {
  let last = null;
  for (let key of keys) {
    let res = await send(key).catch(() => null);
    if (res && res.ok) return { res };
    last = res;
    if (res && (res.status == 400 || res.status == 404)) break; // the request itself is wrong: another key won't help
  }
  return { res: last };
}

// ---------- speech to text (Groq Whisper) ----------

async function hear({ audio, mime, kid }) {
  if (typeof audio != "string" || audio.length > 3_000_000) return json({ error: "bad-audio" }, 400);
  let type = typeof mime == "string" && mime.startsWith("audio/") ? mime.split(";")[0] : "audio/webm";
  let ext = type.includes("mp4") || type.includes("aac") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
  let bytes = Buffer.from(audio, "base64");
  let name = String((kid && kid.hindi) || "").slice(0, 30);
  // a hint for Whisper: Hindi in Devanagari, a child talking, the child's name and common words
  let hint = `${name ? name + " नाम का " : ""}एक छोटा बच्चा हिंदी में बात कर रहा है।`;

  let answered = false;
  for (let model of STT_MODELS) {
    let { res } = await withKeys((key) => {
      let form = new FormData();
      form.append("file", new Blob([bytes], { type }), "speech." + ext);
      form.append("model", model);
      form.append("language", "hi");
      form.append("prompt", hint);
      form.append("response_format", "json");
      form.append("temperature", "0");
      return fetch(API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: form });
    });
    if (!res || !res.ok) continue;
    answered = true;
    let text = String((await res.json()).text || "").trim().slice(0, 500);
    // Whisper sometimes writes Hindi in Urdu letters, or repeats the hint when it hears nothing
    if (URDU_SCRIPT.test(text) || text.includes("छोटा बच्चा हिंदी में")) continue;
    return json({ text });
  }
  return answered ? json({ text: "" }) : json({ error: "busy" }, 503);
}

// ---------- Pictures: what does the child want to see? ----------
// Only called when the normal search is unsure ("nadi" = a town in Fiji or a river?).

const GUIDE_PROMPT = `You help a picture app for young children in India.
A child said a word or a few words to see a picture. It comes from speech recognition, so it may be English,
Hindi in Devanagari, or Hindi written in English letters (like "nadi" = नदी = river, "billi" = cat, "kela" = banana),
and may have small spelling mistakes.
Decide what the child most likely wants to SEE a picture of. Always prefer the simple, everyday meaning a child means:
a river, not a town with that name; a food, not a restaurant chain or brand ("burger" = Hamburger, not Burger King);
an animal or object, not a film, song, company, sports team or person with that name.
Answer with a JSON object only:
{"title": "the exact English Wikipedia article title of that thing, like River, Hamburger, Elephant, Taj Mahal",
 "hindi": "its Hindi name in Devanagari",
 "safe": true or false}
"safe" is false if the words are about sexual things, private body parts, violence, weapons, drugs, alcohol, horror,
or anything else not right for small children. If you cannot tell what it is, use "title": "".`;

async function guide(body) {
  let said = String(body.said || "").trim().slice(0, 100);
  let others = (Array.isArray(body.others) ? body.others : []).filter((x) => typeof x == "string").slice(0, 2).map((x) => x.slice(0, 100));
  if (!said) return json({ error: "bad-request" }, 400);
  let ask = `The child said: "${said}"` + (others.length ? `
The microphone also heard: ${others.map((o) => `"${o}"`).join(", ")}` : "");

  for (let model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
    let { res } = await withKeys(
      (key) =>
        fetch(API + "/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: GUIDE_PROMPT }, { role: "user", content: ask }],
            temperature: 0,
            max_completion_tokens: 120,
            response_format: { type: "json_object" },
          }),
        }),
      GUIDE_KEYS
    );
    if (!res || !res.ok) continue;
    try {
      let data = await res.json();
      let answer = JSON.parse(data.choices[0].message.content);
      let title = String(answer.title || "").trim().slice(0, 80);
      if (title && !/^[\p{L}\p{N} ,.'()&-]+$/u.test(title)) title = "";
      return json({ title, hindi: String(answer.hindi || "").trim().slice(0, 60), safe: answer.safe !== false });
    } catch (e) {}
  }
  return json({ error: "busy" }, 503);
}

// ---------- Bolo's reply (Groq chat) ----------

// keeps the newest items (memory) or, with fromStart, the first ones (answer choices)
function cleanList(list, max, len, fromStart = false) {
  let items = (Array.isArray(list) ? list : []).filter((x) => typeof x == "string" && x.trim()).map((x) => x.trim().slice(0, len));
  return fromStart ? items.slice(0, max) : items.slice(-max);
}

async function chat(body) {
  let kid = body.kid || {};
  kid = {
    name: String(kid.name || "").slice(0, 30),
    hindi: String(kid.hindi || "").slice(0, 30),
    age: Number(kid.age) > 0 && Number(kid.age) < 15 ? Number(kid.age) : null,
  };
  let game = GAMES.includes(body.game) ? body.game : "chat";
  let memory = cleanList(body.memory, 8, 80);
  let history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role == "kid" || m.role == "bolo") && typeof m.text == "string")
    .slice(-20) // the last 10 exchanges
    .map((m) => ({ role: m.role == "kid" ? "user" : "assistant", content: m.text.slice(0, 500) }));
  if (!history.length || history[history.length - 1].role != "user") return json({ error: "bad-request" }, 400);

  let messages = [{ role: "system", content: systemPrompt({ kid, game, memory }) }, ...history];

  for (let model of MODELS) {
    let strict = model.startsWith("openai/gpt-oss");
    let { res } = await withKeys((key) =>
      fetch(API + "/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.6,
          max_completion_tokens: 900,
          ...(strict
            ? { reasoning_effort: "low", response_format: { type: "json_schema", json_schema: { name: "bolo_reply", strict: true, schema: replySchema } } }
            : { response_format: { type: "json_object" } }),
        }),
      })
    );
    if (!res || !res.ok) continue; // try the next model
    try {
      let data = await res.json();
      let reply = tidy(JSON.parse(data.choices[0].message.content));
      if (goodHindi(reply.say)) return json(reply);
    } catch (e) {}
    // bad JSON or not proper Hindi: try the next model
  }
  return json({ error: "busy" }, 503);
}

// Bolo must answer in Hindi written in Devanagari (not Urdu letters, not English sentences)
function goodHindi(text) {
  if (!text || URDU_SCRIPT.test(text)) return false;
  let hindi = (text.match(/[ऀ-ॿ]/g) || []).length;
  let latin = (text.match(/[A-Za-z]/g) || []).length;
  return hindi >= 6 && latin <= hindi * 0.3;
}

// never trust the model's output shape blindly
function tidy(r) {
  return {
    say: String(r.say || "").trim().slice(0, 500) || "चलो, फिर से बात करते हैं!",
    mood: MOODS.includes(r.mood) ? r.mood : "happy",
    picture: String(r.picture || "").trim().slice(0, 60),
    options: cleanList(r.options, 3, 40, true),
    star: r.star === true,
    remember: String(r.remember || "").trim().slice(0, 80),
    listen: r.listen !== false,
    title: String(r.title || "").trim().slice(0, 60),
    part: Math.max(0, Math.min(6, parseInt(r.part, 10) || 0)),
    the_end: r.the_end === true,
  };
}
