/**
 * Mock ChatPort adapter.
 *
 * Produces friendly, non-robotic chat replies (Req 3.5 / 18.3) and a mock
 * same-day pilgrimage plan whose timeline stops are in ascending time order
 * (Req 12.2 / Property 22). At destination-discovery moments it hands back
 * swipe candidates (Req 3.2). Pure stub — no network (Req 3.6 / 16.2).
 */

import type {
  ChatPort,
  ChatReply,
  ChatSession,
  LangCode,
  PilgrimagePlan,
  PlanInput,
  PlanStop,
  Spot,
} from "../../ports";
import { EHIME_SPOTS } from "./spots";

/**
 * Warm, varied opener lines per language so replies never feel templated and,
 * crucially, match the language the user selected (Req 1.x / 19.x). Languages
 * without an entry fall back to English, then Japanese.
 */
const FRIENDLY_OPENERS: Partial<Record<LangCode, string[]>> = {
  ja: ["いいですね、", "なるほど〜。", "わかります！", "うんうん、", "そうこなくっちゃ。"],
  iyo: ["ええですねぇ、", "なるほどなぁ。", "わかるわぁ！", "うんうん、", "そうこんかいや。"],
  en: ["Nice! ", "Got it — ", "Ooh, I like that. ", "Sounds lovely. ", "Great choice! "],
  "zh-Hans": ["不错！", "明白了，", "哦，我喜欢。", "听起来很棒。", "好主意！"],
  "zh-Hant": ["不錯！", "明白了，", "喔，我喜歡。", "聽起來很棒。", "好主意！"],
  ko: ["좋아요! ", "알겠어요, ", "오, 마음에 들어요. ", "멋지네요. ", "좋은 선택이에요! "],
  th: ["ดีเลย! ", "เข้าใจแล้วค่ะ ", "โอ้ ชอบจัง ", "ฟังดูดีมาก ", "ตัวเลือกเยี่ยม! "],
  fr: ["Super ! ", "D'accord, ", "Oh, j'aime bien. ", "Ça a l'air charmant. ", "Excellent choix ! "],
  de: ["Schön! ", "Verstanden, ", "Oh, das gefällt mir. ", "Klingt wunderbar. ", "Gute Wahl! "],
  es: ["¡Genial! ", "Entendido, ", "Oh, me gusta. ", "Suena encantador. ", "¡Buena elección! "],
  pt: ["Ótimo! ", "Entendi, ", "Ah, adorei. ", "Parece encantador. ", "Boa escolha! "],
  vi: ["Tuyệt! ", "Hiểu rồi, ", "Ồ, tôi thích đấy. ", "Nghe hay quá. ", "Lựa chọn tuyệt vời! "],
  id: ["Bagus! ", "Baik, ", "Oh, saya suka. ", "Kedengarannya indah. ", "Pilihan yang bagus! "],
  ar: ["رائع! ", "فهمت، ", "أوه، يعجبني ذلك. ", "يبدو جميلاً. ", "اختيار موفّق! "],
  ru: ["Отлично! ", "Понятно, ", "О, мне нравится. ", "Звучит чудесно. ", "Прекрасный выбор! "],
  hi: ["बढ़िया! ", "समझ गया, ", "ओह, मुझे पसंद आया। ", "बहुत अच्छा लगता है। ", "अच्छा चुनाव! "],
};

/** "I picked some spots for you, swipe the ones you like" per language. */
const DISCOVERY_REPLY: Partial<Record<LangCode, string>> = {
  ja: "愛媛でおすすめのスポットをいくつか選んでみました。気になるものを右にスワイプしてみてくださいね。",
  iyo: "愛媛でおすすめのスポットをいくつか選んでみたけん。気になるとこを右にスワイプしてみてや。",
  en: "I picked a few spots I think you'll love in Ehime. Swipe right on the ones that catch your eye.",
  "zh-Hans": "我为你挑选了几个爱媛的推荐景点。喜欢的就向右滑动吧。",
  "zh-Hant": "我為你挑選了幾個愛媛的推薦景點。喜歡的就向右滑動吧。",
  ko: "에히메에서 마음에 드실 만한 스팟을 몇 곳 골라봤어요. 마음에 드는 곳은 오른쪽으로 스와이프해 주세요.",
  th: "ฉันเลือกสถานที่น่าสนใจในเอฮิเมะมาให้สองสามแห่ง ปัดขวาที่ที่คุณชอบได้เลยนะ",
  fr: "J'ai sélectionné quelques lieux qui devraient vous plaire à Ehime. Balayez vers la droite ceux qui vous attirent.",
  de: "Ich habe ein paar Orte in Ehime ausgewählt, die dir gefallen könnten. Wische die interessanten nach rechts.",
  es: "Elegí algunos lugares que creo que te encantarán en Ehime. Desliza a la derecha los que te llamen la atención.",
  pt: "Escolhi alguns lugares que acho que você vai adorar em Ehime. Deslize para a direita os que chamarem sua atenção.",
  vi: "Tôi đã chọn vài địa điểm bạn có thể thích ở Ehime. Hãy vuốt sang phải những nơi bạn thấy hấp dẫn.",
  id: "Saya memilih beberapa tempat menarik di Ehime untuk Anda. Geser ke kanan yang Anda suka.",
  ar: "اخترت لك بعض الأماكن الرائعة في إيهيمي. مرّر لليمين على ما يعجبك.",
  ru: "Я подобрал несколько мест в Эхиме, которые вам понравятся. Свайпните вправо те, что приглянулись.",
  hi: "मैंने एहिमे में आपके लिए कुछ बेहतरीन जगहें चुनी हैं। जो पसंद आएं उन्हें दाईं ओर स्वाइप करें।",
};

/** "Tell me more — what kind of trip do you want?" template per language. */
const FOLLOWUP_REPLY: Partial<Record<LangCode, (topic: string) => string>> = {
  ja: (t) => `「${t}」、もっと聞かせてください。どんな雰囲気の旅にしたいですか？`,
  iyo: (t) => `「${t}」、もっと聞かせてや。どんな雰囲気の旅にしたいん？`,
  en: (t) => `"${t}" — tell me more! What kind of mood are you after for this trip?`,
  "zh-Hans": (t) => `“${t}”，多和我说说吧。你想要什么样氛围的旅行呢？`,
  "zh-Hant": (t) => `「${t}」，多和我說說吧。你想要什麼樣氛圍的旅行呢？`,
  ko: (t) => `"${t}", 더 들려주세요! 어떤 분위기의 여행을 원하세요?`,
  th: (t) => `"${t}" เล่าให้ฟังอีกหน่อยสิ อยากได้ทริปแบบบรรยากาศไหนดีล่ะ?`,
  fr: (t) => `« ${t} » — dites-m'en plus ! Quelle ambiance recherchez-vous pour ce voyage ?`,
  de: (t) => `„${t}“ — erzähl mir mehr! Welche Stimmung wünschst du dir für diese Reise?`,
  es: (t) => `«${t}» — ¡cuéntame más! ¿Qué ambiente buscas para este viaje?`,
  pt: (t) => `"${t}" — conte-me mais! Que clima você procura para esta viagem?`,
  vi: (t) => `"${t}" — kể thêm cho tôi nghe nào! Bạn muốn chuyến đi này có không khí thế nào?`,
  id: (t) => `"${t}" — ceritakan lebih banyak! Suasana perjalanan seperti apa yang Anda inginkan?`,
  ar: (t) => `«${t}» — أخبرني المزيد! ما الأجواء التي تبحث عنها في هذه الرحلة؟`,
  ru: (t) => `«${t}» — расскажите подробнее! Какого настроения вы хотите от этой поездки?`,
  hi: (t) => `"${t}" — और बताइए! आप इस यात्रा के लिए कैसा माहौल चाहते हैं?`,
};

/** Resolve a per-language value with English then Japanese fallback. */
function forLang<T>(map: Partial<Record<LangCode, T>>, lang: LangCode): T {
  return (map[lang] ?? map.en ?? map.ja) as T;
}

/**
 * Keywords that signal the conversation has reached a "where should I go"
 * moment, at which point we hand swipe candidates to Swipe_Discovery (Req 3.2).
 */
const DISCOVERY_HINTS = [
  "おすすめ",
  "どこ",
  "行きたい",
  "観光",
  "スポット",
  "ごはん",
  "食べ",
  "巡り",
  "recommend",
  "where",
  "spot",
  "visit",
  "eat",
];

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function looksLikeDiscovery(message: string): boolean {
  const lower = message.toLowerCase();
  return DISCOVERY_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

export class MockChatAdapter implements ChatPort {
  async sendMessage(
    session: ChatSession,
    message: string,
  ): Promise<ChatReply> {
    const lang = session.lang;
    const openers = forLang(FRIENDLY_OPENERS, lang);
    const opener = pick(openers, session.messages.length);
    const trimmed = message.trim();

    if (looksLikeDiscovery(trimmed)) {
      // Reflect accumulated likes so suggestions feel personal (Req 3.3),
      // then surface candidates for the swipe deck (Req 3.2).
      const liked = session.preferences?.liked ?? [];
      const candidates = orderCandidates(EHIME_SPOTS, liked);
      return {
        message: `${opener}${forLang(DISCOVERY_REPLY, lang)}`,
        spotCandidates: candidates,
      };
    }

    const topic = trimmed || (lang === "ja" || lang === "iyo" ? "そのお話" : "that");
    return {
      message: `${opener}${forLang(FOLLOWUP_REPLY, lang)(topic)}`,
    };
  }

  async generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan> {
    return { stops: buildPlanStops(input) };
  }
}

/** Localized labels for the mock plan timeline stops (Req 1.x / 19.x). */
const PLAN_LABELS: Partial<
  Record<LangCode, { temple: (id: string) => string; meal: string; spot: string }>
> = {
  ja: { temple: (id) => `札所参拝: ${id}`, meal: "お昼ごはん", spot: "周辺観光スポット" },
  iyo: { temple: (id) => `札所参り: ${id}`, meal: "お昼ごはん", spot: "近くの観光スポット" },
  en: { temple: (id) => `Temple visit: ${id}`, meal: "Lunch", spot: "Nearby sightseeing spot" },
  "zh-Hans": { temple: (id) => `参拜札所：${id}`, meal: "午餐", spot: "周边观光景点" },
  "zh-Hant": { temple: (id) => `參拜札所：${id}`, meal: "午餐", spot: "周邊觀光景點" },
  ko: { temple: (id) => `사찰 참배: ${id}`, meal: "점심 식사", spot: "주변 관광 스팟" },
  th: { temple: (id) => `เยี่ยมชมวัด: ${id}`, meal: "มื้อกลางวัน", spot: "จุดท่องเที่ยวใกล้เคียง" },
  fr: { temple: (id) => `Visite du temple : ${id}`, meal: "Déjeuner", spot: "Site touristique à proximité" },
  de: { temple: (id) => `Tempelbesuch: ${id}`, meal: "Mittagessen", spot: "Sehenswürdigkeit in der Nähe" },
  es: { temple: (id) => `Visita al templo: ${id}`, meal: "Almuerzo", spot: "Punto turístico cercano" },
  pt: { temple: (id) => `Visita ao templo: ${id}`, meal: "Almoço", spot: "Ponto turístico próximo" },
  vi: { temple: (id) => `Viếng chùa: ${id}`, meal: "Bữa trưa", spot: "Điểm tham quan lân cận" },
  id: { temple: (id) => `Kunjungan kuil: ${id}`, meal: "Makan siang", spot: "Tempat wisata terdekat" },
  ar: { temple: (id) => `زيارة المعبد: ${id}`, meal: "الغداء", spot: "موقع سياحي قريب" },
  ru: { temple: (id) => `Посещение храма: ${id}`, meal: "Обед", spot: "Достопримечательность рядом" },
  hi: { temple: (id) => `मंदिर दर्शन: ${id}`, meal: "दोपहर का भोजन", spot: "पास का पर्यटन स्थल" },
};

/** Sorts liked spots to the front while keeping every candidate available. */
function orderCandidates(spots: Spot[], liked: string[]): Spot[] {
  if (liked.length === 0) return [...spots];
  const likedSet = new Set(liked);
  const preferred = spots.filter((s) => likedSet.has(s.id));
  const rest = spots.filter((s) => !likedSet.has(s.id));
  return [...preferred, ...rest];
}

/**
 * Builds a timeline guaranteed to be in ascending time order. Starts at 09:00
 * and advances a per-transport step between stops; inserts a lunch stop and an
 * optional sightseeing stop when there is room in the schedule.
 */
function buildPlanStops(input: PlanInput): PlanStop[] {
  const stepMinutes =
    input.transport === "walk" ? 90 : input.transport === "bike" ? 60 : 40;

  const labels = forLang(PLAN_LABELS, input.lang ?? "ja");

  let cursor = 9 * 60; // minutes from midnight, i.e. 09:00
  const end = 9 * 60 + Math.max(0, input.availableMinutes);
  const stops: PlanStop[] = [];

  const push = (label: string, kind: PlanStop["kind"]) => {
    if (cursor > end) return;
    stops.push({ time: formatTime(cursor), label, kind });
    cursor += stepMinutes;
  };

  const temples =
    input.desiredTemples.length > 0
      ? input.desiredTemples
      : ["ehime-51", "ehime-50"];

  temples.forEach((templeId, index) => {
    push(labels.temple(templeId), "temple");
    // Drop a lunch break roughly midway through the temple visits.
    if (input.includeSightseeing && index === Math.floor(temples.length / 2)) {
      push(labels.meal, "meal");
    }
  });

  if (input.includeSightseeing) {
    push(labels.spot, "spot");
  }

  return stops;
}

/** Formats minutes-from-midnight as a zero-padded "HH:MM" 24h string. */
function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}
