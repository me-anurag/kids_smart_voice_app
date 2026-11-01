// Hidden safety filter. Blocks sexual / reproductive-part terms and abusive
// words in English, Hindi (Devanagari) and Hinglish (Roman Hindi).
// The kid never sees this list - they just get a friendly "try something else".

const BLOCK_WORDS = [
  // --- English: sexual / reproductive ---
  "sex", "sexy", "sexual", "sexually", "sexuality", "porn", "porno", "pornography", "xxx",
  "nude", "nudes", "nudity", "naked", "condom", "condoms", "intercourse", "orgasm",
  "erection", "erotic", "horny", "masturbate", "masturbation", "vagina", "vaginal",
  "vulva", "penis", "penises", "testis", "testes", "testicle", "testicles", "scrotum",
  "clitoris", "uterus", "womb", "ovary", "ovaries", "sperm", "semen", "ejaculation",
  "genital", "genitals", "genitalia", "boob", "boobs", "tits", "titties", "nipple",
  "nipples", "breast", "breasts", "buttocks", "anus", "anal", "rape", "raped", "rapist",
  "prostitute", "prostitution", "brothel", "hooker", "stripper", "pussy", "dick", "cock",
  "dildo", "vibrator", "foreplay", "blowjob", "handjob", "hentai", "onlyfans",

  // --- English: abusive ---
  "fuck", "fucks", "fucked", "fucker", "fucking", "shit", "shits", "bullshit", "bitch",
  "bitches", "bastard", "asshole", "ass", "arse", "arsehole", "dickhead", "cunt", "slut",
  "whore", "motherfucker", "piss", "prick", "wanker", "twat", "retard", "nigger", "nigga",
  "faggot", "fag", "douche", "douchebag", "jackass", "dumbass",

  // --- Hinglish (how en-IN speech recognition writes Hindi words) ---
  "chut", "choot", "chuut", "chutiya", "chutiye", "chutia", "chootiya", "lund",
  "lauda", "loda", "lodu", "lawda", "lavda", "lavde", "laude", "lode", "gaand",
  "gand", "gandu", "gaandu", "chuchi", "chuchiyan", "randi", "randwa", "raand", "chod",
  "chodu", "chodna", "chudai", "bhosda", "bhosdi", "bhosdike", "bhosadi",
  "bhosadike", "bhosdiwala", "madarchod", "maderchod", "madarchot", "behenchod",
  "bahenchod", "bhenchod", "bhenchodd", "benchod", "mc", "bc", "bsdk", "harami", "haraami",
  "haramkhor", "haramzada", "haramzadi", "haraamzaada", "kamina", "kamine", "kameena",
  "kutiya", "bhadwa", "bhadva", "bhadwe", "dalla", "chinal", "jhant", "jhaant",
  "jhantu", "tatte", "tharki", "saala", "saale", "saali",

  // --- Devanagari: sexual / reproductive ---
  "सेक्स", "सेक्सी", "संभोग", "सम्भोग", "योनि", "लिंग", "शिश्न", "अंडकोष", "अण्डकोष",
  "गर्भाशय", "अंडाशय", "स्तन", "वीर्य", "शुक्राणु", "अश्लील", "नंगा", "नंगी", "नग्न",
  "बलात्कार", "वेश्या", "वेश्यावृत्ति", "कंडोम", "पोर्न", "हस्तमैथुन", "जननांग", "चूचि",
  "चूची", "निप्पल", "ब्रेस्ट",

  // --- Devanagari: abusive ---
  "चूत", "चुत", "चूतिया", "चुतिया", "चूतिये", "चुतिये", "लंड", "लण्ड", "लौडा", "लोडा",
  "लौड़ा", "लवडा", "लोडू", "गांड", "गाण्ड", "गांडू", "गान्डू", "भोसडा", "भोसडी", "भोसडीके",
  "भोसडिके", "मादरचोद", "बहनचोद", "बहेनचोद", "भेनचोद", "भैनचोद", "चोद", "चोदू", "चुदाई",
  "रंडी", "रण्डी", "रांड", "हरामी", "हरामखोर", "हरामजादा", "हरामजादी", "कमीना", "कमीने",
  "कमीनी", "कुतिया", "भडवा", "भडवे", "दल्ला", "छिनाल", "झांट", "झाट", "टट्टे", "ठरकी",
  "साला", "साले", "फक", "शिट", "बास्टर्ड",
];

// Multi-word phrases (checked against the whole sentence).
const BLOCK_PHRASES = [
  "ullu ka pattha", "ullu ke patthe", "kutte ki aulad", "suar ki aulad", "kutte kamine",
  "teri maa", "teri behen", "son of a bitch",
  "private part", "private parts", "making love", "sex education",
  "उल्लू का पट्ठा", "उल्लू के पट्ठे", "कुत्ते की औलाद", "सूअर की औलाद", "तेरी मां", "तेरी माँ",
  "तेरी बहन",
];

// Word pieces that are bad anywhere inside a word (fuuucking, motherfuckers...).
const BLOCK_PIECES = [
  "fuck", "motherf", "madarch", "behench", "bahench", "bhench", "bhosd", "chutiy",
  "porn", "masturb", "boob", "dildo", "pussy", "whore", "slut", "asshole",
  "मादरचो", "बहनचो", "भेनचो", "भोसड", "चुतिय", "चूतिय", "पोर्न",
];

function cleanText(text) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/़/g, "")          // nukta: ड़ -> ड
    .replace(/ँ/g, "ं")    // chandrabindu -> anusvara: माँ -> मां
    .replace(/([a-z])\1{2,}/g, "$1$1"); // fuuuuck -> fuuck
}

const blockWordSet = new Set(BLOCK_WORDS.map(cleanText));
const blockPhraseList = BLOCK_PHRASES.map(cleanText);
const blockPieceList = BLOCK_PIECES.map(cleanText);

function isBlocked(text) {
  if (!text) return false;
  let clean = cleanText(text);
  let words = clean.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  let sentence = " " + words.join(" ") + " ";

  for (let word of words) {
    if (blockWordSet.has(word)) return true;
    // also try with doubled letters squashed: "fuuck" -> "fuck"
    if (blockWordSet.has(word.replace(/([a-z])\1/g, "$1"))) return true;
    for (let piece of blockPieceList) {
      if (word.includes(piece)) return true;
    }
  }
  for (let phrase of blockPhraseList) {
    if (sentence.includes(" " + phrase + " ")) return true;
  }
  return false;
}
