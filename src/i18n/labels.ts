/**
 * UI label dictionary (Req 1.2, 1.6, 1.8, 19.1).
 *
 * Shape is {@link LangDict}: `labelKey -> (LangCode -> string)`. Japanese (`ja`)
 * is authored for every key and acts as the universal fallback via the pure
 * `resolveLabel` in the domain layer — any language whose value is missing
 * resolves to the Japanese text rather than showing nothing (Req 1.6, 19.3).
 *
 * A handful of languages (en, and a few others) are seeded for the most visible
 * screens to prove the multi-language wiring end to end. The 伊予弁 (`iyo`)
 * dialect is hand-authored for major UI labels as required by Req 1.8 / A11;
 * keys without an `iyo` entry intentionally fall back to standard Japanese.
 */

import type { LangDict } from "../domain/types";

export const UI_LABELS: LangDict = {
  // ---- Welcome / language selection screen --------------------------------
  "welcome.kicker": {
    ja: "ようこそ",
    en: "Welcome",
    "zh-Hans": "欢迎",
    "zh-Hant": "歡迎",
    ko: "환영합니다",
    th: "ยินดีต้อนรับ",
    fr: "Bienvenue",
    de: "Willkommen",
    es: "Bienvenido",
    pt: "Bem-vindo",
    vi: "Chào mừng",
    id: "Selamat datang",
    ar: "مرحبا",
    ru: "Добро пожаловать",
    hi: "स्वागत है",
    iyo: "ようこそ",
  },
  "welcome.place": {
    ja: "愛媛へ",
    en: "to Ehime",
    "zh-Hans": "来到爱媛",
    "zh-Hant": "來到愛媛",
    ko: "에히메로",
    th: "สู่เอฮิเมะ",
    fr: "à Ehime",
    de: "in Ehime",
    es: "a Ehime",
    pt: "a Ehime",
    vi: "đến Ehime",
    id: "ke Ehime",
    ar: "في إيهيمي",
    ru: "в Эхиме",
    hi: "एहिमे में",
    iyo: "愛媛へ",
  },
  "welcome.lead": {
    ja: "海と山とみかんの愛媛を、ゆっくり巡りましょう。",
    en: "Take your time exploring Ehime — its sea, mountains and mikan.",
    "zh-Hans": "慢慢游览爱媛的海、山与蜜柑。",
    "zh-Hant": "慢慢遊覽愛媛的海、山與蜜柑。",
    ko: "바다와 산과 밀감의 에히메를 천천히 둘러보세요.",
    th: "ค่อย ๆ สำรวจเอฮิเมะ ทั้งทะเล ภูเขา และส้มมิคัง",
    fr: "Prenez le temps de découvrir Ehime — sa mer, ses montagnes et ses mikan.",
    de: "Erkunde Ehime in Ruhe — Meer, Berge und Mikan.",
    es: "Explora Ehime con calma: su mar, sus montañas y sus mikan.",
    pt: "Explore Ehime com calma — seu mar, montanhas e mikan.",
    vi: "Hãy thong thả khám phá Ehime — biển, núi và quýt mikan.",
    id: "Nikmati waktu Anda menjelajahi Ehime — laut, gunung, dan mikan-nya.",
    ar: "استمتع باستكشاف إيهيمي على مهل — بحرها وجبالها وبرتقال الميكان.",
    ru: "Не спеша исследуйте Эхиме — море, горы и мандарины микан.",
    hi: "एहिमे के समुद्र, पहाड़ों और मिकान को इत्मीनान से देखें।",
    iyo: "海と山とみかんの愛媛を、のんびり巡ろうや。",
  },
  "lang.heading": {
    ja: "言語を選択してください",
    en: "Please select your language",
    "zh-Hans": "请选择语言",
    "zh-Hant": "請選擇語言",
    ko: "언어를 선택해 주세요",
    th: "โปรดเลือกภาษาของคุณ",
    fr: "Veuillez choisir votre langue",
    de: "Bitte wähle deine Sprache",
    es: "Seleccione su idioma",
    pt: "Selecione seu idioma",
    vi: "Vui lòng chọn ngôn ngữ",
    id: "Silakan pilih bahasa Anda",
    ar: "الرجاء اختيار لغتك",
    ru: "Пожалуйста, выберите язык",
    hi: "कृपया अपनी भाषा चुनें",
    iyo: "言葉を選んでつかあさい",
  },
  "lang.headingSub": {
    // Bilingual sub-heading shown beneath the localized heading on the mockup.
    ja: "Please select your language",
    en: "言語を選択してください",
  },
  "lang.recommended": {
    ja: "おすすめ",
    en: "Recommended",
    "zh-Hans": "推荐",
    "zh-Hant": "推薦",
    ko: "추천",
    th: "แนะนำ",
    fr: "Recommandé",
    de: "Empfohlen",
    es: "Recomendado",
    pt: "Recomendado",
    vi: "Đề xuất",
    id: "Direkomendasikan",
    ar: "موصى به",
    ru: "Рекомендуется",
    hi: "अनुशंसित",
    iyo: "おすすめ",
  },
  "lang.other": {
    ja: "その他の言語",
    en: "Other languages",
    "zh-Hans": "其他语言",
    "zh-Hant": "其他語言",
    ko: "기타 언어",
    th: "ภาษาอื่น ๆ",
    fr: "Autres langues",
    de: "Weitere Sprachen",
    es: "Otros idiomas",
    pt: "Outros idiomas",
    vi: "Ngôn ngữ khác",
    id: "Bahasa lain",
    ar: "لغات أخرى",
    ru: "Другие языки",
    hi: "अन्य भाषाएँ",
    iyo: "そのほかの言葉",
  },
  "lang.otherComingSoon": {
    ja: "他の言語は順次追加していきます。",
    en: "More languages are coming soon.",
    "zh-Hans": "更多语言即将陆续推出。",
    "zh-Hant": "更多語言即將陸續推出。",
    ko: "더 많은 언어가 순차적으로 추가됩니다.",
    th: "จะเพิ่มภาษาอื่น ๆ เร็ว ๆ นี้",
    fr: "D'autres langues arrivent bientôt.",
    de: "Weitere Sprachen folgen in Kürze.",
    es: "Pronto habrá más idiomas.",
    pt: "Mais idiomas em breve.",
    vi: "Sẽ sớm có thêm nhiều ngôn ngữ.",
    id: "Lebih banyak bahasa akan segera hadir.",
    ar: "المزيد من اللغات قريبًا.",
    ru: "Скоро появятся другие языки.",
    hi: "और भाषाएँ जल्द ही आ रही हैं।",
    iyo: "ほかの言葉もぼちぼち増やしていくけんね。",
  },
  "lang.note": {
    ja: "あとから設定画面でいつでも言語を変更できます",
    en: "You can change the language anytime from settings later.",
    "zh-Hans": "之后可随时在设置中更改语言。",
    "zh-Hant": "之後可隨時在設定中更改語言。",
    ko: "나중에 설정에서 언제든지 언어를 변경할 수 있습니다.",
    th: "คุณสามารถเปลี่ยนภาษาได้ทุกเมื่อในการตั้งค่าภายหลัง",
    fr: "Vous pourrez changer de langue à tout moment dans les réglages.",
    de: "Du kannst die Sprache später jederzeit in den Einstellungen ändern.",
    es: "Podrás cambiar el idioma en cualquier momento desde los ajustes.",
    pt: "Você pode alterar o idioma a qualquer momento nas configurações.",
    vi: "Bạn có thể đổi ngôn ngữ bất cứ lúc nào trong cài đặt sau này.",
    id: "Anda dapat mengubah bahasa kapan saja dari pengaturan nanti.",
    ar: "يمكنك تغيير اللغة في أي وقت من الإعدادات لاحقًا.",
    ru: "Вы сможете изменить язык в любое время в настройках.",
    hi: "आप बाद में सेटिंग्स से कभी भी भाषा बदल सकते हैं।",
    iyo: "あとから設定でいつでも変えれるけんね",
  },
  "lang.next": {
    ja: "次へ進む",
    en: "Continue",
    "zh-Hans": "继续",
    "zh-Hant": "繼續",
    ko: "계속",
    th: "ต่อไป",
    fr: "Continuer",
    de: "Weiter",
    es: "Continuar",
    pt: "Continuar",
    vi: "Tiếp tục",
    id: "Lanjutkan",
    ar: "متابعة",
    ru: "Продолжить",
    hi: "जारी रखें",
    iyo: "次へ進むけん",
  },

  // ---- Settings (language change entry point, Req 1.4) --------------------
  "settings.language": {
    ja: "表示言語",
    en: "Display language",
    iyo: "表示する言葉",
  },

  // ---- Common, app-wide labels (seed iyo for major UI, Req 1.8) -----------
  "common.next": {
    ja: "次へ",
    en: "Next",
    iyo: "次へいくけん",
  },
  "common.back": {
    ja: "戻る",
    en: "Back",
    iyo: "戻るけん",
  },
  "common.save": {
    ja: "保存する",
    en: "Save",
    iyo: "残しとくけん",
  },
  "common.cancel": {
    ja: "キャンセル",
    en: "Cancel",
    iyo: "やめとくわ",
  },
  "common.done": {
    ja: "完了",
    en: "Done",
    iyo: "ええよ",
  },
  "common.comingSoon": {
    ja: "この画面は近日準備中です。",
    en: "This screen is coming soon.",
    "zh-Hans": "此页面即将上线。",
    ko: "이 화면은 곧 준비됩니다.",
    fr: "Cet écran arrive bientôt.",
    ar: "هذه الشاشة قادمة قريبًا.",
    iyo: "この画面はもうちょっと待っとってな。",
  },

  // ---- Mode selection (Req 2.1) -------------------------------------------
  "mode.select.kicker": {
    ja: "モードを選ぶ",
    en: "Choose a mode",
    "zh-Hans": "选择模式",
    "zh-Hant": "選擇模式",
    ko: "모드 선택",
    th: "เลือกโหมด",
    fr: "Choisir un mode",
    de: "Modus wählen",
    es: "Elige un modo",
    pt: "Escolha um modo",
    vi: "Chọn chế độ",
    id: "Pilih mode",
    ar: "اختر وضعًا",
    ru: "Выберите режим",
    hi: "मोड चुनें",
    iyo: "モードを選ぶけん",
  },
  "mode.select.title": {
    ja: "どちらで旅しますか？",
    en: "How would you like to travel?",
    "zh-Hans": "您想如何出行？",
    "zh-Hant": "您想如何出行？",
    ko: "어떻게 여행하시겠어요?",
    th: "คุณอยากเดินทางแบบไหน?",
    fr: "Comment souhaitez-vous voyager ?",
    de: "Wie möchtest du reisen?",
    es: "¿Cómo te gustaría viajar?",
    pt: "Como você gostaria de viajar?",
    vi: "Bạn muốn du lịch theo cách nào?",
    id: "Bagaimana Anda ingin bepergian?",
    ar: "كيف تود أن تسافر؟",
    ru: "Как вы хотите путешествовать?",
    hi: "आप कैसे यात्रा करना चाहेंगे?",
    iyo: "どっちで旅しよわい？",
  },
  "mode.select.lead": {
    ja: "あとからヘッダーや設定でいつでも切り替えられます。",
    en: "You can switch anytime from the header or settings.",
    "zh-Hans": "之后可随时在顶部或设置中切换。",
    "zh-Hant": "之後可隨時在頂部或設定中切換。",
    ko: "나중에 헤더나 설정에서 언제든지 전환할 수 있습니다.",
    th: "คุณสามารถสลับได้ทุกเมื่อจากส่วนหัวหรือการตั้งค่า",
    fr: "Vous pouvez changer à tout moment depuis l'en-tête ou les réglages.",
    de: "Du kannst jederzeit über die Kopfzeile oder die Einstellungen wechseln.",
    es: "Puedes cambiar en cualquier momento desde la cabecera o los ajustes.",
    pt: "Você pode alternar a qualquer momento pelo cabeçalho ou nas configurações.",
    vi: "Bạn có thể chuyển đổi bất cứ lúc nào từ tiêu đề hoặc cài đặt.",
    id: "Anda dapat beralih kapan saja dari header atau pengaturan.",
    ar: "يمكنك التبديل في أي وقت من الرأس أو الإعدادات.",
    ru: "Вы можете переключиться в любой момент из шапки или настроек.",
    hi: "आप हेडर या सेटिंग्स से कभी भी बदल सकते हैं।",
    iyo: "あとからヘッダーや設定でいつでも変えれるけんね。",
  },

  // ---- Mode names & descriptions (Req 2.2, 2.3, 2.4) ----------------------
  "mode.tourism.name": {
    ja: "通常観光モード",
    en: "Sightseeing mode",
    "zh-Hans": "观光模式",
    "zh-Hant": "觀光模式",
    ko: "관광 모드",
    th: "โหมดท่องเที่ยว",
    fr: "Mode tourisme",
    de: "Sightseeing-Modus",
    es: "Modo turismo",
    pt: "Modo turismo",
    vi: "Chế độ tham quan",
    id: "Mode wisata",
    ar: "وضع السياحة",
    ru: "Режим осмотра",
    hi: "पर्यटन मोड",
    iyo: "ふつう観光モード",
  },
  "mode.tourism.desc": {
    ja: "AIチャット相談とスワイプで、行きたい場所を見つけてしおりに。",
    en: "Find places with AI chat and swiping, then build your itinerary.",
    "zh-Hans": "通过 AI 聊天和滑动找到想去的地方，加入行程。",
    "zh-Hant": "透過 AI 聊天和滑動找到想去的地方，加入行程。",
    ko: "AI 채팅과 스와이프로 가고 싶은 곳을 찾아 일정에 담으세요.",
    th: "ค้นหาสถานที่ด้วยแชท AI และการปัด แล้วสร้างแผนการเดินทางของคุณ",
    fr: "Trouvez des lieux via le chat IA et le swipe, puis créez votre itinéraire.",
    de: "Finde Orte per KI-Chat und Wischen und erstelle deine Reiseroute.",
    es: "Encuentra lugares con el chat de IA y deslizando, y crea tu itinerario.",
    pt: "Encontre lugares com o chat de IA e deslizando, e monte seu roteiro.",
    vi: "Tìm địa điểm bằng trò chuyện AI và vuốt, rồi lập hành trình của bạn.",
    id: "Temukan tempat dengan obrolan AI dan geser, lalu susun rencana perjalanan Anda.",
    ar: "اعثر على الأماكن عبر محادثة الذكاء الاصطناعي والتمرير، ثم أنشئ خط رحلتك.",
    ru: "Находите места через ИИ-чат и свайпы, затем составьте маршрут.",
    hi: "AI चैट और स्वाइप से जगहें खोजें, फिर अपनी यात्रा योजना बनाएं।",
    iyo: "AIと話したりスワイプしたりして、行きたいとこ見つけよ。",
  },
  "mode.pilgrimage.name": {
    ja: "お遍路モード",
    en: "Pilgrimage mode",
    "zh-Hans": "遍路模式",
    "zh-Hant": "遍路模式",
    ko: "오헨로 모드",
    th: "โหมดจาริกแสวงบุญ",
    fr: "Mode pèlerinage",
    de: "Pilger-Modus",
    es: "Modo peregrinación",
    pt: "Modo peregrinação",
    vi: "Chế độ hành hương",
    id: "Mode ziarah",
    ar: "وضع الحج",
    ru: "Режим паломничества",
    hi: "तीर्थयात्रा मोड",
    iyo: "お遍路モード",
  },
  "mode.pilgrimage.desc": {
    ja: "札所マップ・巡礼進捗・行った/行ってないマッチで、巡るほど達成感を。",
    en: "Temple map, progress and a been-there/not-yet match — feel it grow as you go.",
    "zh-Hans": "札所地图、巡礼进度和去过/未去配对，越走越有成就感。",
    "zh-Hant": "札所地圖、巡禮進度和去過/未去配對，越走越有成就感。",
    ko: "사찰 지도, 순례 진행, 다녀옴/미방문 매치로 돌수록 커지는 성취감을.",
    th: "แผนที่วัด ความคืบหน้า และการจับคู่ไปแล้ว/ยังไม่ไป ยิ่งไปยิ่งภูมิใจ",
    fr: "Carte des temples, progression et match visité/pas encore — savourez chaque étape.",
    de: "Tempelkarte, Fortschritt und Besucht/Noch-nicht-Abgleich — spür, wie es wächst.",
    es: "Mapa de templos, progreso y coincidencia visitado/pendiente: siéntelo crecer.",
    pt: "Mapa de templos, progresso e correspondência visitado/ainda não — sinta crescer.",
    vi: "Bản đồ chùa, tiến độ và ghép đã đến/chưa đến — cảm nhận thành quả tăng dần.",
    id: "Peta kuil, kemajuan, dan pencocokan sudah/belum — rasakan pencapaian bertambah.",
    ar: "خريطة المعابد والتقدّم ومطابقة زُرت/لم أزر — استشعر إنجازك يكبر مع كل خطوة.",
    ru: "Карта храмов, прогресс и сопоставление «был/ещё нет» — ощущайте рост достижений.",
    hi: "मंदिर मानचित्र, प्रगति और गया/नहीं-गया मैच — जैसे-जैसे बढ़ें, उपलब्धि महसूस करें।",
    iyo: "札所マップや達成率、行った/行ってないマッチで、巡るほど嬉しゅうなるけん。",
  },
  "mode.start": {
    ja: "このモードで始める",
    en: "Start in this mode",
    "zh-Hans": "以此模式开始",
    "zh-Hant": "以此模式開始",
    ko: "이 모드로 시작",
    th: "เริ่มด้วยโหมดนี้",
    fr: "Commencer dans ce mode",
    de: "In diesem Modus starten",
    es: "Empezar en este modo",
    pt: "Começar neste modo",
    vi: "Bắt đầu ở chế độ này",
    id: "Mulai dengan mode ini",
    ar: "ابدأ بهذا الوضع",
    ru: "Начать в этом режиме",
    hi: "इस मोड में शुरू करें",
    iyo: "このモードで始めるけん",
  },
  "mode.tag.tourism": {
    ja: "観光",
    en: "Sightseeing",
    "zh-Hans": "观光",
    "zh-Hant": "觀光",
    ko: "관광",
    th: "ท่องเที่ยว",
    fr: "Tourisme",
    de: "Sightseeing",
    es: "Turismo",
    pt: "Turismo",
    vi: "Tham quan",
    id: "Wisata",
    ar: "سياحة",
    ru: "Осмотр",
    hi: "पर्यटन",
    iyo: "観光",
  },
  "mode.tag.pilgrimage": {
    ja: "お遍路",
    en: "Pilgrimage",
    "zh-Hans": "遍路",
    "zh-Hant": "遍路",
    ko: "오헨로",
    th: "จาริกแสวงบุญ",
    fr: "Pèlerinage",
    de: "Pilgern",
    es: "Peregrinación",
    pt: "Peregrinação",
    vi: "Hành hương",
    id: "Ziarah",
    ar: "الحج",
    ru: "Паломничество",
    hi: "तीर्थयात्रा",
    iyo: "お遍路",
  },

  // ---- Header (current mode + toggle + settings, Req 2.4) -----------------
  "mode.current": {
    ja: "現在のモード",
    en: "Current mode",
    iyo: "今のモード",
  },
  "mode.switchTo": {
    ja: "切り替える",
    en: "Switch",
    iyo: "切り替えるけん",
  },
  "header.modeSwitch": {
    ja: "モードを切り替える",
    en: "Switch mode",
    iyo: "モードを切り替えるけん",
  },
  "header.settings": {
    ja: "設定",
    en: "Settings",
    iyo: "設定",
  },

  // ---- Settings screen (mode toggle + language change, Req 1.4, 2.4) ------
  "settings.title": {
    ja: "設定",
    en: "Settings",
    "zh-Hans": "设置",
    ko: "설정",
    fr: "Réglages",
    ar: "الإعدادات",
    iyo: "設定",
  },
  "settings.mode": {
    ja: "モード",
    en: "Mode",
    iyo: "モード",
  },
  "settings.modeHint": {
    ja: "通常観光モードとお遍路モードを切り替えます。",
    en: "Switch between sightseeing and pilgrimage modes.",
    iyo: "ふつう観光とお遍路を切り替えるけん。",
  },
  "settings.languageHint": {
    ja: "表示する言語を選びます。",
    en: "Choose the display language.",
    iyo: "表示する言葉を選ぶけん。",
  },

  // ---- Tourism mode bottom-nav tabs (Req 2.2, 18.4) -----------------------
  "nav.tourism.chat": {
    ja: "チャット",
    en: "Chat",
    "zh-Hans": "聊天",
    ko: "채팅",
    fr: "Chat",
    ar: "دردشة",
    iyo: "チャット",
  },
  "nav.tourism.swipe": {
    ja: "スワイプ",
    en: "Swipe",
    "zh-Hans": "滑动",
    ko: "스와이프",
    fr: "Swipe",
    ar: "تمرير",
    iyo: "スワイプ",
  },
  "nav.tourism.favorites": {
    ja: "お気に入り",
    en: "Favorites",
    "zh-Hans": "收藏",
    ko: "즐겨찾기",
    fr: "Favoris",
    ar: "المفضلة",
    iyo: "お気に入り",
  },
  "nav.tourism.shiori": {
    ja: "しおり",
    en: "Itinerary",
    "zh-Hans": "行程",
    ko: "일정",
    fr: "Itinéraire",
    ar: "خط الرحلة",
    iyo: "しおり",
  },

  // ---- Pilgrimage mode bottom-nav tabs (Req 2.3, 18.5) --------------------
  "nav.pilgrimage.home": {
    ja: "ホーム",
    en: "Home",
    "zh-Hans": "主页",
    ko: "홈",
    fr: "Accueil",
    ar: "الرئيسية",
    iyo: "ホーム",
  },
  "nav.pilgrimage.map": {
    ja: "マップ",
    en: "Map",
    "zh-Hans": "地图",
    ko: "지도",
    fr: "Carte",
    ar: "خريطة",
    iyo: "マップ",
  },
  "nav.pilgrimage.nokyocho": {
    ja: "お遍路マッチ",
    en: "Match",
    "zh-Hans": "遍路配对",
    ko: "오헨로 매치",
    fr: "Match",
    ar: "مطابقة",
    iyo: "お遍路マッチ",
  },
  "nav.pilgrimage.mypage": {
    ja: "マイページ",
    en: "My page",
    "zh-Hans": "我的",
    ko: "마이페이지",
    fr: "Mon espace",
    ar: "صفحتي",
    iyo: "マイページ",
  },

  // ---- Per-tab placeholder panels (real screens land in tasks 8/10/11) ----
  "panel.tourism.chat.title": {
    ja: "AIチャット相談",
    en: "AI travel chat",
    iyo: "AIに相談",
  },
  "panel.tourism.swipe.title": {
    ja: "スワイプで発見",
    en: "Discover by swiping",
    iyo: "スワイプで見つける",
  },
  "panel.tourism.favorites.title": {
    ja: "お気に入り",
    en: "Favorites",
    iyo: "お気に入り",
  },
  "panel.tourism.shiori.title": {
    ja: "しおり（旅程）",
    en: "Itinerary",
    iyo: "しおり",
  },
  "panel.pilgrimage.home.title": {
    ja: "巡礼進捗・今日のプラン",
    en: "Progress & today's plan",
    iyo: "巡礼の進み具合",
  },
  "panel.pilgrimage.map.title": {
    ja: "札所マップ",
    en: "Temple map",
    iyo: "札所マップ",
  },
  "panel.pilgrimage.nokyocho.title": {
    ja: "お遍路マッチ",
    en: "Ohenro match",
    iyo: "お遍路マッチ",
  },
  "panel.pilgrimage.mypage.title": {
    ja: "マイページ",
    en: "My page",
    iyo: "マイページ",
  },

  // ---- Auth / お遍路 login (Req 15.1–15.5) --------------------------------
  "auth.brand.mode": {
    ja: "お遍路モード",
    en: "Pilgrimage mode",
    "zh-Hans": "遍路模式",
    "zh-Hant": "遍路模式",
    ko: "오헨로 모드",
    fr: "Mode pèlerinage",
    ar: "وضع الحج",
    iyo: "お遍路モード",
  },
  "auth.brand.tagline": {
    ja: "四国八十八ヶ所巡礼の世界へ",
    en: "Into the world of the 88-temple Shikoku pilgrimage",
    "zh-Hans": "走进四国八十八处巡礼的世界",
    ko: "시코쿠 88개 사찰 순례의 세계로",
    fr: "Dans l'univers du pèlerinage des 88 temples de Shikoku",
    ar: "إلى عالم حج المعابد الثمانية والثمانين في شيكوكو",
    iyo: "四国八十八ヶ所巡りの世界へようこそ",
  },
  "auth.intro": {
    ja: "記録と進捗を続けて残すために、ログインしてください。",
    en: "Sign in to keep your records and progress between visits.",
    iyo: "記録や進み具合を残すために、ログインしてつかあさい。",
  },
  "auth.idLabel": {
    ja: "メールアドレス / ID",
    en: "Email / ID",
    "zh-Hans": "邮箱 / ID",
    ko: "이메일 / ID",
    fr: "E-mail / ID",
    ar: "البريد الإلكتروني / المعرّف",
    iyo: "メールアドレス / ID",
  },
  "auth.idPlaceholder": {
    ja: "you@example.com",
    en: "you@example.com",
    iyo: "you@example.com",
  },
  "auth.passwordLabel": {
    ja: "パスワード",
    en: "Password",
    "zh-Hans": "密码",
    ko: "비밀번호",
    fr: "Mot de passe",
    ar: "كلمة المرور",
    iyo: "パスワード",
  },
  "auth.passwordPlaceholder": {
    ja: "パスワードを入力",
    en: "Enter your password",
    iyo: "パスワードを入れてな",
  },
  "auth.showPassword": {
    ja: "表示",
    en: "Show",
    "zh-Hans": "显示",
    ko: "표시",
    fr: "Afficher",
    ar: "إظهار",
    iyo: "見せる",
  },
  "auth.hidePassword": {
    ja: "隠す",
    en: "Hide",
    "zh-Hans": "隐藏",
    ko: "숨기기",
    fr: "Masquer",
    ar: "إخفاء",
    iyo: "隠す",
  },
  "auth.remember": {
    ja: "ログイン状態を保持する",
    en: "Keep me signed in",
    "zh-Hans": "保持登录状态",
    ko: "로그인 상태 유지",
    fr: "Rester connecté",
    ar: "إبقائي مسجّلاً",
    iyo: "ログインしたままにしとく",
  },
  "auth.login": {
    ja: "ログイン",
    en: "Log in",
    "zh-Hans": "登录",
    "zh-Hant": "登入",
    ko: "로그인",
    fr: "Se connecter",
    ar: "تسجيل الدخول",
    iyo: "ログインするけん",
  },
  "auth.loggingIn": {
    ja: "ログイン中…",
    en: "Signing in…",
    iyo: "ログインしよるけん…",
  },
  "auth.error": {
    ja: "メールアドレスまたはパスワードが正しくありません。",
    en: "Your email or password is incorrect.",
    "zh-Hans": "邮箱或密码不正确。",
    ko: "이메일 또는 비밀번호가 올바르지 않습니다.",
    fr: "Votre e-mail ou mot de passe est incorrect.",
    ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    iyo: "メールアドレスかパスワードが違うみたいやわ。",
  },
  "auth.forgot": {
    ja: "パスワードをお忘れですか？",
    en: "Forgot your password?",
    "zh-Hans": "忘记密码了吗？",
    ko: "비밀번호를 잊으셨나요?",
    fr: "Mot de passe oublié ?",
    ar: "هل نسيت كلمة المرور؟",
    iyo: "パスワード忘れたん？",
  },
  "auth.newAccount": {
    ja: "新規アカウント作成",
    en: "Create a new account",
    "zh-Hans": "创建新账户",
    ko: "새 계정 만들기",
    fr: "Créer un compte",
    ar: "إنشاء حساب جديد",
    iyo: "新しいアカウントを作るけん",
  },
  "auth.tagline": {
    ja: "巡礼の旅、あなたと共に",
    en: "The pilgrimage walks with you",
    "zh-Hans": "巡礼之旅，与你同行",
    ko: "순례의 여정, 당신과 함께",
    fr: "Le pèlerinage chemine avec vous",
    ar: "رحلة الحج، معك دائمًا",
    iyo: "巡礼の旅、あなたと一緒に",
  },
  "auth.backToTourism": {
    ja: "観光モードに戻る",
    en: "Back to sightseeing mode",
    iyo: "観光モードに戻るけん",
  },

  // ---- Auth in settings (logout entry point, Req 15.4) --------------------
  "auth.account": {
    ja: "アカウント",
    en: "Account",
    "zh-Hans": "账户",
    ko: "계정",
    fr: "Compte",
    ar: "الحساب",
    iyo: "アカウント",
  },
  "auth.signedInAs": {
    ja: "ログイン中",
    en: "Signed in",
    "zh-Hans": "已登录",
    ko: "로그인됨",
    fr: "Connecté",
    ar: "تم تسجيل الدخول",
    iyo: "ログインしとるよ",
  },
  "auth.signedOut": {
    ja: "ログインしていません",
    en: "Not signed in",
    "zh-Hans": "未登录",
    ko: "로그인하지 않음",
    fr: "Non connecté",
    ar: "غير مسجّل الدخول",
    iyo: "まだログインしとらんよ",
  },
  "auth.logout": {
    ja: "ログアウト",
    en: "Log out",
    "zh-Hans": "退出登录",
    ko: "로그아웃",
    fr: "Se déconnecter",
    ar: "تسجيل الخروج",
    iyo: "ログアウトするけん",
  },
  "auth.logoutHint": {
    ja: "セッションを破棄して、別のアカウントでログインできます。",
    en: "Discard the session and sign in with another account.",
    iyo: "セッションを消して、別のアカウントでログインできるけん。",
  },
  "auth.loginHint": {
    ja: "お遍路モードでログインすると記録と進捗を保持できます。",
    en: "Sign in from pilgrimage mode to keep your records and progress.",
    iyo: "お遍路モードでログインしたら記録が残せるけんね。",
  },

  // ---- AI チャット相談 (Req 3.1, 3.2, 3.4, 3.5) ----------------------------
  "chat.title": {
    ja: "AIに相談",
    en: "Chat with AI",
    "zh-Hans": "向 AI 咨询",
    "zh-Hant": "向 AI 諮詢",
    ko: "AI에게 상담",
    fr: "Discuter avec l'IA",
    ar: "استشر الذكاء الاصطناعي",
    iyo: "AIに相談するけん",
  },
  "chat.lead": {
    ja: "行きたい雰囲気やしたいことを、気軽に話しかけてみてください。",
    en: "Tell me the kind of trip you're after — no need to be formal.",
    "zh-Hans": "随意告诉我你想要的旅行氛围或想做的事吧。",
    "zh-Hant": "隨意告訴我你想要的旅行氛圍或想做的事吧。",
    ko: "원하는 여행 분위기나 하고 싶은 일을 편하게 말씀해 주세요.",
    th: "บอกฉันได้เลยว่าอยากได้ทริปแบบไหนหรืออยากทำอะไร ไม่ต้องเกรงใจ",
    fr: "Dites-moi l'ambiance de voyage que vous cherchez — sans façon.",
    de: "Erzähl mir einfach, welche Art Reise du dir wünschst.",
    es: "Cuéntame el tipo de viaje que buscas, sin formalidades.",
    pt: "Conte-me o tipo de viagem que procura — sem formalidades.",
    vi: "Cứ thoải mái cho tôi biết bạn muốn chuyến đi kiểu gì nhé.",
    id: "Ceritakan saja suasana perjalanan yang Anda inginkan.",
    ar: "أخبرني ببساطة عن نوع الرحلة التي تريدها.",
    ru: "Просто расскажите, какое путешествие вам по душе.",
    hi: "बेझिझक बताइए कि आप कैसी यात्रा चाहते हैं।",
    iyo: "行きたい雰囲気やしたいこと、気楽に話しかけてや。",
  },
  "chat.greeting": {
    ja: "こんにちは！愛媛の旅、一緒に考えましょ。海沿いでのんびり？それとも食べ歩き？どんな気分ですか？",
    en: "Hi there! Let's plan your Ehime trip together. Seaside and slow, or hopping between bites? What's the mood?",
    "zh-Hans": "你好！一起来规划爱媛之旅吧。想在海边慢慢逛，还是边走边吃？你现在是什么心情呢？",
    "zh-Hant": "你好！一起來規劃愛媛之旅吧。想在海邊慢慢逛，還是邊走邊吃？你現在是什麼心情呢？",
    ko: "안녕하세요! 에히메 여행을 함께 계획해 봐요. 해변에서 느긋하게? 아니면 맛집 투어? 어떤 기분이세요?",
    th: "สวัสดีค่ะ! มาวางแผนเที่ยวเอฮิเมะด้วยกันเถอะ อยากชิลริมทะเล หรือเดินชิมของอร่อยดี? อารมณ์ไหนดีล่ะ?",
    fr: "Bonjour ! Planifions ensemble votre voyage à Ehime. Détente en bord de mer ou balade gourmande ? Quelle est l'envie ?",
    de: "Hallo! Planen wir gemeinsam deine Ehime-Reise. Entspannt am Meer oder von Snack zu Snack? Worauf hast du Lust?",
    es: "¡Hola! Planeemos juntos tu viaje a Ehime. ¿Costa y calma o de bocado en bocado? ¿Qué te apetece?",
    pt: "Olá! Vamos planejar juntos sua viagem a Ehime. Beira-mar tranquila ou de petisco em petisco? Qual é o clima?",
    vi: "Xin chào! Cùng lên kế hoạch chuyến đi Ehime nhé. Thư giãn bên biển hay dạo quanh nếm đồ ăn? Bạn đang muốn gì nào?",
    id: "Halo! Yuk rencanakan perjalanan Ehime bersama. Santai di tepi laut atau berkeliling kuliner? Sedang ingin yang seperti apa?",
    ar: "مرحبًا! لنخطط لرحلتك إلى إيهيمي معًا. استرخاء على الشاطئ أم تجوّل بين المأكولات؟ ما مزاجك؟",
    ru: "Привет! Давайте вместе спланируем поездку в Эхиме. Тихо у моря или гастрономическая прогулка? Какое настроение?",
    hi: "नमस्ते! आइए मिलकर एहिमे की यात्रा की योजना बनाएं। समुद्र किनारे आराम या खाने-पीने की सैर? आपका मूड कैसा है?",
    iyo: "こんにちは！愛媛の旅、一緒に考えよや。海でのんびりもええし、食べ歩きもええよ。どんな気分ぞ？",
  },
  "chat.placeholder": {
    ja: "メッセージを入力…",
    en: "Type a message…",
    "zh-Hans": "输入消息…",
    ko: "메시지 입력…",
    fr: "Écrire un message…",
    ar: "اكتب رسالة…",
    iyo: "メッセージを入れてや…",
  },
  "chat.send": {
    ja: "送信",
    en: "Send",
    "zh-Hans": "发送",
    ko: "보내기",
    fr: "Envoyer",
    ar: "إرسال",
    iyo: "送るけん",
  },
  "chat.sending": {
    ja: "送信中…",
    en: "Sending…",
    "zh-Hans": "发送中…",
    "zh-Hant": "傳送中…",
    ko: "보내는 중…",
    th: "กำลังส่ง…",
    fr: "Envoi…",
    de: "Senden…",
    es: "Enviando…",
    pt: "Enviando…",
    vi: "Đang gửi…",
    id: "Mengirim…",
    ar: "جارٍ الإرسال…",
    ru: "Отправка…",
    hi: "भेजा जा रहा है…",
    iyo: "送りよるけん…",
  },
  "chat.thinking": {
    ja: "うんうん、考えてます…",
    en: "Hmm, thinking it over…",
    "zh-Hans": "嗯，让我想想…",
    "zh-Hant": "嗯，讓我想想…",
    ko: "음, 생각 중이에요…",
    th: "อืม กำลังคิดอยู่…",
    fr: "Hmm, je réfléchis…",
    de: "Hmm, ich überlege…",
    es: "Mmm, lo estoy pensando…",
    pt: "Hmm, estou pensando…",
    vi: "Ừm, để tôi nghĩ đã…",
    id: "Hmm, sedang berpikir…",
    ar: "همم، أفكّر في الأمر…",
    ru: "Хм, обдумываю…",
    hi: "हम्म, सोच रहा हूँ…",
    iyo: "うんうん、考えよるけん…",
  },
  "chat.candidatesReady": {
    // {count} is replaced at render time with the number of candidates.
    ja: "ぴったりなスポットを{count}件選んでみました。スワイプで気になるものを選んでみてくださいね。",
    en: "I picked {count} spots for you. Swipe through to mark the ones you like.",
    "zh-Hans": "我为你挑选了 {count} 个合适的景点。滑动挑选你感兴趣的吧。",
    "zh-Hant": "我為你挑選了 {count} 個合適的景點。滑動挑選你感興趣的吧。",
    ko: "딱 맞는 스팟 {count}곳을 골랐어요. 스와이프하며 마음에 드는 곳을 골라 보세요.",
    th: "ฉันเลือกสถานที่ที่เหมาะมา {count} แห่ง ปัดเพื่อเลือกที่คุณสนใจได้เลย",
    fr: "J'ai sélectionné {count} lieux pour vous. Balayez pour marquer ceux qui vous plaisent.",
    de: "Ich habe {count} Orte für dich ausgewählt. Wische durch und markiere, was dir gefällt.",
    es: "Elegí {count} lugares para ti. Desliza para marcar los que te gusten.",
    pt: "Escolhi {count} lugares para você. Deslize para marcar os que gostar.",
    vi: "Tôi đã chọn {count} địa điểm cho bạn. Vuốt để đánh dấu nơi bạn thích.",
    id: "Saya memilih {count} tempat untuk Anda. Geser untuk menandai yang Anda suka.",
    ar: "اخترت لك {count} أماكن. مرّر لتحديد ما يعجبك.",
    ru: "Я подобрал для вас {count} мест. Свайпайте и отмечайте понравившиеся.",
    hi: "मैंने आपके लिए {count} जगहें चुनी हैं। स्वाइप करके पसंदीदा चुनें।",
    iyo: "ええスポットを{count}件選んでみたけん。スワイプで気になるの選んでや。",
  },
  "chat.toSwipe": {
    ja: "スワイプで見る",
    en: "View as swipes",
    "zh-Hans": "滑动查看",
    ko: "스와이프로 보기",
    fr: "Voir en swipe",
    ar: "عرض كبطاقات",
    iyo: "スワイプで見るけん",
  },
  "chat.error": {
    ja: "うまく応答を受け取れませんでした。もう一度お試しください。",
    en: "I couldn't get a reply just now. Please try again.",
    "zh-Hans": "暂时无法获取回复，请重试。",
    ko: "응답을 받지 못했어요. 다시 시도해 주세요.",
    fr: "Je n'ai pas pu obtenir de réponse. Veuillez réessayer.",
    ar: "تعذّر الحصول على رد. حاول مرة أخرى.",
    iyo: "うまく返事がもらえんかったわ。もういっぺん試してや。",
  },
  "chat.retry": {
    ja: "再試行",
    en: "Retry",
    "zh-Hans": "重试",
    ko: "다시 시도",
    fr: "Réessayer",
    ar: "إعادة المحاولة",
    iyo: "もういっぺん",
  },

  // ---- 札所マップ / Temple map (Req 8.1–8.5) ------------------------------
  "map.title": {
    ja: "札所マップ",
    en: "Temple map",
    "zh-Hans": "札所地图",
    ko: "사찰 지도",
    fr: "Carte des temples",
    ar: "خريطة المعابد",
    iyo: "札所マップ",
  },
  "map.lead": {
    ja: "愛媛の札所（第40〜65番）を地図で確認できます。ピンを選ぶと詳細が見られます。",
    en: "Explore Ehime's temples (No. 40–65) on the map. Tap a pin for details.",
    iyo: "愛媛の札所（40〜65番）を地図で見れるけん。ピンを押したら詳しゅう出るよ。",
  },
  "map.loading": {
    ja: "札所を読み込んでいます…",
    en: "Loading temples…",
    iyo: "札所を読み込みよるけん…",
  },
  "map.empty": {
    ja: "条件に合う札所がありません。フィルタを調整してください。",
    en: "No temples match the filters. Try adjusting them.",
    iyo: "条件に合う札所がないわ。フィルタを変えてみてや。",
  },
  "map.countShown": {
    // {count} replaced at render time.
    ja: "{count}件の札所を表示中",
    en: "Showing {count} temples",
    iyo: "{count}件の札所を出しよるよ",
  },
  "map.currentLocation": {
    ja: "現在地",
    en: "Current location",
    "zh-Hans": "当前位置",
    ko: "현재 위치",
    fr: "Position actuelle",
    ar: "الموقع الحالي",
    iyo: "今おる場所",
  },
  "map.youAreHere": {
    ja: "ここにいます（モック現在地）",
    en: "You are here (mock location)",
    iyo: "ここにおるよ（モックの現在地）",
  },

  // ---- フィルタ (Req 8.3) --------------------------------------------------
  "map.filter.title": {
    ja: "フィルタ",
    en: "Filters",
    iyo: "フィルタ",
  },
  "map.filter.transport": {
    ja: "移動手段",
    en: "Transport",
    iyo: "移動手段",
  },
  "map.filter.car": {
    ja: "車",
    en: "Car",
    iyo: "車",
  },
  "map.filter.walk": {
    ja: "徒歩",
    en: "Walk",
    iyo: "歩き",
  },
  "map.filter.time": {
    ja: "所要時間",
    en: "Travel time",
    iyo: "かかる時間",
  },
  "map.filter.timeAny": {
    ja: "指定なし",
    en: "Any",
    iyo: "指定なし",
  },
  "map.filter.withinMinutes": {
    // {min} replaced at render time.
    ja: "{min}分以内",
    en: "Within {min} min",
    iyo: "{min}分以内",
  },
  "map.filter.unvisited": {
    ja: "未訪問のみ",
    en: "Unvisited only",
    iyo: "まだ行っとらんとこだけ",
  },

  // ---- 詳細 (Req 8.2) -----------------------------------------------------
  "map.detail.number": {
    ja: "札所番号",
    en: "Temple no.",
    iyo: "札所番号",
  },
  "map.detail.distance": {
    ja: "現在地からの距離",
    en: "Distance from you",
    iyo: "今おる場所からの距離",
  },
  "map.detail.walkTime": {
    ja: "徒歩",
    en: "On foot",
    iyo: "歩き",
  },
  "map.detail.carTime": {
    ja: "車",
    en: "By car",
    iyo: "車",
  },
  "map.detail.minutesUnit": {
    // {min} replaced at render time.
    ja: "約{min}分",
    en: "about {min} min",
    iyo: "だいたい{min}分",
  },
  "map.detail.parking": {
    ja: "駐車場",
    en: "Parking",
    iyo: "駐車場",
  },
  "map.detail.restrooms": {
    ja: "トイレ/休憩所",
    en: "Restrooms / rest area",
    iyo: "トイレ・休憩所",
  },
  "map.detail.available": {
    ja: "あり",
    en: "Available",
    iyo: "あるよ",
  },
  "map.detail.unavailable": {
    ja: "なし",
    en: "None",
    iyo: "ないわ",
  },
  "map.detail.nearby": {
    ja: "周辺のスポット・飲食店",
    en: "Nearby spots & food",
    iyo: "近くのスポット・お店",
  },
  "map.detail.noNearby": {
    ja: "周辺情報は準備中です。",
    en: "Nearby info is coming soon.",
    iyo: "近くの情報はもうちょっと待ってな。",
  },
  "map.detail.translate": {
    ja: "選択言語に翻訳",
    en: "Translate to your language",
    "zh-Hans": "翻译为所选语言",
    "zh-Hant": "翻譯為所選語言",
    ko: "선택한 언어로 번역",
    fr: "Traduire dans votre langue",
    ar: "ترجم إلى لغتك",
    iyo: "選んだ言葉に翻訳するけん",
  },
  "map.detail.translating": {
    ja: "翻訳中…",
    en: "Translating…",
    "zh-Hans": "翻译中…",
    "zh-Hant": "翻譯中…",
    ko: "번역 중…",
    fr: "Traduction…",
    ar: "جارٍ الترجمة…",
    iyo: "翻訳しよるけん…",
  },
  "map.detail.translated": {
    ja: "翻訳しました",
    en: "Translated",
    "zh-Hans": "已翻译",
    "zh-Hant": "已翻譯",
    ko: "번역됨",
    fr: "Traduit",
    ar: "تمت الترجمة",
    iyo: "翻訳したけん",
  },
  "map.detail.translateUnavailable": {
    ja: "翻訳が用意できないため原文を表示しています",
    en: "Translation unavailable — showing the original text",
    "zh-Hans": "暂无翻译，显示原文",
    "zh-Hant": "暫無翻譯，顯示原文",
    ko: "번역을 사용할 수 없어 원문을 표시합니다",
    fr: "Traduction indisponible — texte original affiché",
    ar: "الترجمة غير متاحة — يتم عرض النص الأصلي",
    iyo: "翻訳ができんけん原文を出しとるわ",
  },
  "map.detail.showOriginal": {
    ja: "原文を表示",
    en: "Show original",
    "zh-Hans": "显示原文",
    "zh-Hant": "顯示原文",
    ko: "원문 보기",
    fr: "Afficher l'original",
    ar: "عرض النص الأصلي",
    iyo: "原文を見せるけん",
  },
  "map.detail.showTranslation": {
    ja: "翻訳を表示",
    en: "Show translation",
    "zh-Hans": "显示翻译",
    "zh-Hant": "顯示翻譯",
    ko: "번역 보기",
    fr: "Afficher la traduction",
    ar: "عرض الترجمة",
    iyo: "翻訳を見せるけん",
  },
  "map.detail.close": {
    ja: "閉じる",
    en: "Close",
    iyo: "閉じるけん",
  },
  "map.detail.selectHint": {
    ja: "地図のピンを選ぶと札所の詳細が表示されます。",
    en: "Select a pin on the map to see temple details.",
    iyo: "地図のピンを押したら札所の詳細が出るけん。",
  },

  // ---- おすすめの巡礼ルート / Recommended routes (Req 8 mockup carousel) ----
  "map.routes.title": {
    ja: "おすすめの巡礼ルート",
    en: "Recommended routes",
    "zh-Hans": "推荐巡礼路线",
    ko: "추천 순례 루트",
    fr: "Itinéraires conseillés",
    ar: "مسارات الحج المقترحة",
    iyo: "おすすめの巡礼ルート",
  },
  "map.routes.lead": {
    ja: "ルートを選ぶと、その札所が地図上で強調されます。",
    en: "Pick a route to highlight its temples on the map.",
    iyo: "ルートを選んだら、その札所が地図で目立つけん。",
  },
  "map.routes.templesCount": {
    // {count} replaced at render time.
    ja: "{count}札所",
    en: "{count} temples",
    iyo: "{count}札所",
  },
  "map.routes.distance": {
    // {km} replaced at render time.
    ja: "約{km}km",
    en: "approx {km} km",
    iyo: "だいたい{km}km",
  },
  "map.routes.carDuration": {
    // {min} replaced at render time.
    ja: "車で約{min}分",
    en: "approx {min} min by car",
    iyo: "車でだいたい{min}分",
  },
  "map.routes.clear": {
    ja: "強調を解除",
    en: "Clear highlight",
    iyo: "強調をやめる",
  },
  "map.route.south": {
    ja: "南予・宇和の海辺ルート",
    en: "Nanyo & Uwa coastal route",
    iyo: "南予・宇和の海辺ルート",
  },
  "map.route.kuma": {
    ja: "久万高原・山岳ルート",
    en: "Kuma-kogen mountain route",
    iyo: "久万高原・山ルート",
  },
  "map.route.matsuyama": {
    ja: "松山市内めぐりルート",
    en: "Matsuyama city route",
    iyo: "松山市内めぐりルート",
  },
  "map.route.toyo": {
    ja: "東予・今治しまなみルート",
    en: "Toyo & Imabari Shimanami route",
    iyo: "東予・今治しまなみルート",
  },
};

// ---- 巡礼進捗ダッシュボード / Progress dashboard (Req 9.1–9.6) -------------
UI_LABELS["progress.title"] = {
  ja: "巡礼の進み具合",
  en: "Your pilgrimage progress",
  "zh-Hans": "巡礼进度",
  ko: "순례 진행 상황",
  fr: "Votre progression",
  ar: "تقدّم الحج",
  iyo: "巡礼の進み具合",
};
UI_LABELS["progress.lead"] = {
  ja: "巡った札所がそのまま達成感に。今日もゆっくり進みましょう。",
  en: "Every temple you visit adds up. Take it slow today, too.",
  iyo: "巡った札所がそのまま嬉しさに。今日ものんびり行こや。",
};
UI_LABELS["progress.achieved"] = {
  ja: "達成",
  en: "done",
  "zh-Hans": "达成",
  ko: "달성",
  fr: "atteint",
  ar: "مُنجز",
  iyo: "達成",
};
UI_LABELS["progress.shikoku"] = {
  ja: "四国全体",
  en: "All Shikoku",
  "zh-Hans": "四国全境",
  ko: "시코쿠 전체",
  fr: "Tout Shikoku",
  ar: "كل شيكوكو",
  iyo: "四国ぜんぶ",
};
UI_LABELS["progress.ofCount"] = {
  // {total} replaced at render time.
  ja: " {total}か所中",
  en: " of {total}",
  iyo: " {total}か所中",
};
UI_LABELS["progress.visitedFraction"] = {
  // {visited} / {total} replaced at render time.
  ja: "{visited} / {total} 札所",
  en: "{visited} / {total} temples",
  iyo: "{visited} / {total} 札所",
};
UI_LABELS["progress.areaRingLabel"] = {
  // {area} replaced at render time.
  ja: "{area}の達成率",
  en: "{area} achievement rate",
  iyo: "{area}の達成率",
};
UI_LABELS["progress.shikokuRingLabel"] = {
  ja: "四国全体の達成率",
  en: "All-Shikoku achievement rate",
  iyo: "四国ぜんぶの達成率",
};

// 対象県セレクタ (Req 9.6)
UI_LABELS["progress.areaLabel"] = {
  ja: "対象の都道府県",
  en: "Prefecture in focus",
  iyo: "対象の県",
};
UI_LABELS["progress.pref.ehime"] = {
  ja: "愛媛県",
  en: "Ehime",
  "zh-Hans": "爱媛县",
  ko: "에히메현",
  fr: "Ehime",
  ar: "إيهيمي",
  iyo: "愛媛県",
};
UI_LABELS["progress.pref.kagawa"] = {
  ja: "香川県",
  en: "Kagawa",
  "zh-Hans": "香川县",
  ko: "가가와현",
  fr: "Kagawa",
  ar: "كاغاوا",
  iyo: "香川県",
};
UI_LABELS["progress.pref.tokushima"] = {
  ja: "徳島県",
  en: "Tokushima",
  "zh-Hans": "德岛县",
  ko: "도쿠시마현",
  fr: "Tokushima",
  ar: "توكوشيما",
  iyo: "徳島県",
};
UI_LABELS["progress.pref.kochi"] = {
  ja: "高知県",
  en: "Kochi",
  "zh-Hans": "高知县",
  ko: "고치현",
  fr: "Kochi",
  ar: "كوتشي",
  iyo: "高知県",
};

// 今日 / 今月 / 残り (Req 9.5)
UI_LABELS["progress.stat.today"] = {
  ja: "今日巡った札所",
  en: "Visited today",
  "zh-Hans": "今日巡礼",
  ko: "오늘 방문",
  fr: "Aujourd'hui",
  ar: "زيارات اليوم",
  iyo: "今日巡った札所",
};
UI_LABELS["progress.stat.month"] = {
  ja: "今月巡った札所",
  en: "Visited this month",
  "zh-Hans": "本月巡礼",
  ko: "이번 달 방문",
  fr: "Ce mois-ci",
  ar: "زيارات هذا الشهر",
  iyo: "今月巡った札所",
};
UI_LABELS["progress.stat.remaining"] = {
  ja: "残りの札所",
  en: "Remaining",
  "zh-Hans": "剩余札所",
  ko: "남은 사찰",
  fr: "Restants",
  ar: "المتبقّي",
  iyo: "残りの札所",
};
UI_LABELS["progress.stat.unit"] = {
  ja: "か所",
  en: "",
  iyo: "か所",
};

// 次の札所ナビ
UI_LABELS["progress.next.title"] = {
  ja: "次の札所ナビ",
  en: "Next temple",
  "zh-Hans": "下一座札所",
  ko: "다음 사찰",
  fr: "Temple suivant",
  ar: "المعبد التالي",
  iyo: "次の札所ナビ",
};
UI_LABELS["progress.next.highlights"] = {
  ja: "見どころ",
  en: "Highlights",
  "zh-Hans": "看点",
  ko: "볼거리",
  fr: "À voir",
  ar: "أبرز المعالم",
  iyo: "見どころ",
};
UI_LABELS["progress.next.route"] = {
  ja: "マップでルートを見る",
  en: "See the route on the map",
  "zh-Hans": "在地图上查看路线",
  ko: "지도에서 경로 보기",
  fr: "Voir l'itinéraire sur la carte",
  ar: "عرض المسار على الخريطة",
  iyo: "マップでルートを見るけん",
};
UI_LABELS["progress.next.minutesUnit"] = {
  // {min} replaced at render time.
  ja: "約{min}分",
  en: "about {min} min",
  "zh-Hans": "约{min}分钟",
  "zh-Hant": "約{min}分鐘",
  ko: "약 {min}분",
  th: "ประมาณ {min} นาที",
  fr: "environ {min} min",
  de: "ca. {min} Min",
  es: "unos {min} min",
  pt: "cerca de {min} min",
  vi: "khoảng {min} phút",
  id: "sekitar {min} mnt",
  ar: "حوالي {min} دقيقة",
  ru: "около {min} мин",
  hi: "लगभग {min} मिनट",
  iyo: "だいたい{min}分",
};
UI_LABELS["progress.next.durationHm"] = {
  // {h} hours and {m} minutes, replaced at render time.
  ja: "約{h}時間{m}分",
  en: "about {h} h {m} min",
  "zh-Hans": "约{h}小时{m}分钟",
  "zh-Hant": "約{h}小時{m}分鐘",
  ko: "약 {h}시간 {m}분",
  th: "ประมาณ {h} ชม. {m} นาที",
  fr: "environ {h} h {m} min",
  de: "ca. {h} Std. {m} Min",
  es: "unas {h} h {m} min",
  pt: "cerca de {h} h {m} min",
  vi: "khoảng {h} giờ {m} phút",
  id: "sekitar {h} jam {m} mnt",
  ar: "حوالي {h} ساعة و{m} دقيقة",
  ru: "около {h} ч {m} мин",
  hi: "लगभग {h} घंटे {m} मिनट",
  iyo: "だいたい{h}時間{m}分",
};
UI_LABELS["progress.next.durationH"] = {
  // {h} hours (exact hour), replaced at render time.
  ja: "約{h}時間",
  en: "about {h} h",
  "zh-Hans": "约{h}小时",
  "zh-Hant": "約{h}小時",
  ko: "약 {h}시간",
  th: "ประมาณ {h} ชม.",
  fr: "environ {h} h",
  de: "ca. {h} Std.",
  es: "unas {h} h",
  pt: "cerca de {h} h",
  vi: "khoảng {h} giờ",
  id: "sekitar {h} jam",
  ar: "حوالي {h} ساعة",
  ru: "около {h} ч",
  hi: "लगभग {h} घंटे",
  iyo: "だいたい{h}時間",
};
UI_LABELS["progress.next.allDone"] = {
  ja: "この県の札所はすべて巡りました。お疲れさまでした！",
  en: "You've visited every temple in this prefecture. Well done!",
  iyo: "この県の札所はぜんぶ巡ったね。お疲れさま！",
};
UI_LABELS["progress.next.shikokuLeft"] = {
  // {count} replaced at render time.
  ja: "四国全体ではあと{count}か所。次の県へ進みましょう。",
  en: "Across Shikoku, {count} temples remain. On to the next prefecture!",
  iyo: "四国ぜんぶではあと{count}か所。次の県へ行こや。",
};
UI_LABELS["progress.next.empty"] = {
  ja: "この県の札所データは準備中です。愛媛県を選ぶと巡礼を始められます。",
  en: "Temple data for this prefecture is coming soon. Pick Ehime to begin.",
  iyo: "この県の札所データはもうちょっと待ってな。愛媛県を選んだら始めれるよ。",
};

// 次の札所ナビ: AI 算出中の表示 & AI 目安の注意書き
UI_LABELS["progress.next.estimating"] = {
  ja: "AIが算出中…",
  en: "Estimating with AI…",
  "zh-Hans": "AI 正在推算…",
  "zh-Hant": "AI 正在推算…",
  ko: "AI가 계산 중…",
  th: "AI กำลังประมาณ…",
  fr: "Estimation par l'IA…",
  de: "KI schätzt…",
  es: "Estimando con IA…",
  pt: "Estimando com IA…",
  vi: "AI đang ước tính…",
  id: "AI sedang memperkirakan…",
  ar: "يقوم الذكاء الاصطناعي بالتقدير…",
  ru: "ИИ выполняет расчёт…",
  hi: "AI अनुमान लगा रहा है…",
  iyo: "AIが算出しよるけん…",
};
UI_LABELS["progress.next.aiNote"] = {
  ja: "※ 距離・所要時間・見どころはAIによる目安です。実際の交通・道路状況により異なる場合があります。",
  en: "* Distance, times and highlights are AI estimates for reference only, and may differ from actual conditions.",
  "zh-Hans": "※ 距离、所需时间和看点均为 AI 估算，仅供参考，可能与实际交通和道路情况不同。",
  "zh-Hant": "※ 距離、所需時間與看點皆為 AI 估算，僅供參考，可能與實際交通與道路狀況不同。",
  ko: "※ 거리·소요 시간·볼거리는 AI 추정치로 참고용이며 실제 교통·도로 상황과 다를 수 있습니다.",
  th: "※ ระยะทาง เวลา และจุดเด่นเป็นการประมาณโดย AI เพื่อการอ้างอิงเท่านั้น อาจต่างจากสภาพจริง",
  fr: "* Distance, durées et points d'intérêt sont des estimations de l'IA, à titre indicatif ; ils peuvent différer de la réalité.",
  de: "* Entfernung, Zeiten und Highlights sind KI-Schätzungen als Richtwert und können von der Realität abweichen.",
  es: "* La distancia, los tiempos y los lugares destacados son estimaciones de la IA, solo de referencia, y pueden diferir de la realidad.",
  pt: "* Distância, tempos e destaques são estimativas da IA, apenas para referência, e podem diferir das condições reais.",
  vi: "* Khoảng cách, thời gian và điểm nổi bật là ước tính của AI, chỉ để tham khảo và có thể khác thực tế.",
  id: "* Jarak, waktu, dan sorotan adalah perkiraan AI hanya untuk referensi dan dapat berbeda dari kondisi sebenarnya.",
  ar: "* المسافة والأوقات وأبرز المعالم تقديرات من الذكاء الاصطناعي للاسترشاد فقط، وقد تختلف عن الواقع.",
  ru: "* Расстояние, время и достопримечательности — это оценки ИИ для справки; они могут отличаться от реальных условий.",
  hi: "* दूरी, समय और मुख्य आकर्षण AI द्वारा अनुमानित हैं, केवल संदर्भ हेतु, और वास्तविक स्थिति से भिन्न हो सकते हैं।",
  iyo: "※ 距離・時間・見どころはAIのだいたいの目安やけん。実際とは違うこともあるけんね。",
};

// 今日のおすすめAIプラン teaser (task 11.1 / post-MVP)
UI_LABELS["progress.plan.title"] = {
  ja: "今日のおすすめAIプラン",
  en: "Today's AI plan",
  "zh-Hans": "今日 AI 推荐计划",
  ko: "오늘의 AI 플랜",
  fr: "Plan IA du jour",
  ar: "خطة اليوم بالذكاء الاصطناعي",
  iyo: "今日のおすすめAIプラン",
};
UI_LABELS["progress.plan.lead"] = {
  ja: "出発地や時間に合わせて、AIが当日の巡礼プランを考えます。",
  en: "AI will craft a same-day pilgrimage plan from your start point and time.",
  iyo: "出発地や時間に合わせて、AIが今日のプランを考えてくれるけん。",
};
UI_LABELS["progress.plan.soon"] = {
  ja: "近日公開予定です。お楽しみに。",
  en: "Coming soon — stay tuned.",
  "zh-Hans": "敬请期待。",
  ko: "곧 공개됩니다.",
  fr: "Bientôt disponible.",
  ar: "قريبًا.",
  iyo: "もうちょっとで使えるけん、楽しみにしとってな。",
};

// ---- 行った/行ってない初期設定 / Visit tracker scroll (Req 11.1–11.4) -------
UI_LABELS["visit.title"] = {
  ja: "行った？行ってない？",
  en: "Been there? Not yet?",
  "zh-Hans": "去过了吗？还没去？",
  ko: "가봤나요? 아직인가요?",
  fr: "Déjà visité ? Pas encore ?",
  ar: "هل زرته؟ ليس بعد؟",
  iyo: "行った？まだ行っとらん？",
};
UI_LABELS["visit.lead"] = {
  ja: "札所をめくりながら、もう巡ったところを「○行った」に。スワイプ感覚で進捗の初期設定ができます。",
  en: "Flip through the temples and tap ○ for the ones you've already visited — set your starting progress in a swipe.",
  iyo: "札所をめくって、もう巡ったとこは「○行った」にしてや。スワイプ感覚で初期設定できるけん。",
};
UI_LABELS["visit.loading"] = {
  ja: "札所を読み込んでいます…",
  en: "Loading temples…",
  iyo: "札所を読み込みよるけん…",
};
UI_LABELS["visit.empty"] = {
  ja: "この県の札所データは準備中です。",
  en: "Temple data for this prefecture is coming soon.",
  iyo: "この県の札所データはもうちょっと待ってな。",
};
UI_LABELS["visit.tally"] = {
  // {visited} / {total} replaced at render time.
  ja: "{visited} / {total} 札所を「行った」に設定中",
  en: "{visited} / {total} temples marked visited",
  iyo: "{visited} / {total} 札所を「行った」にしとるよ",
};
UI_LABELS["visit.visited"] = {
  ja: "行った",
  en: "Visited",
  "zh-Hans": "去过了",
  ko: "가봤어요",
  fr: "Visité",
  ar: "تمت الزيارة",
  iyo: "行った",
};
UI_LABELS["visit.notVisited"] = {
  ja: "行ってない",
  en: "Not yet",
  "zh-Hans": "还没去",
  ko: "아직이요",
  fr: "Pas encore",
  ar: "ليس بعد",
  iyo: "行っとらん",
};
UI_LABELS["visit.photoSoon"] = {
  ja: "写真は準備中です",
  en: "Photo coming soon",
  iyo: "写真はもうちょっと待ってな",
};
UI_LABELS["visit.photoSearching"] = {
  ja: "名前で画像を検索中…",
  en: "Searching for a photo by name…",
  iyo: "名前で画像を探しよるけん…",
};
UI_LABELS["visit.done"] = {
  ja: "完了",
  en: "Done",
  iyo: "ええよ",
};
UI_LABELS["visit.finish"] = {
  ja: "この内容で設定を終える",
  en: "Finish setup",
  iyo: "この内容で設定を終えるけん",
};
UI_LABELS["visit.progress"] = {
  // {current} / {total} replaced at render time.
  ja: "{current} / {total} 枚目",
  en: "Card {current} / {total}",
  iyo: "{current} / {total} 枚目",
};
UI_LABELS["visit.cardRole"] = {
  ja: "札所カード（左右にスワイプ）",
  en: "Temple card (swipe left or right)",
  iyo: "札所カード（左右にスワイプ）",
};
UI_LABELS["visit.hint"] = {
  ja: "カードを右に「行った」／左に「行ってない」。ボタンや矢印キーでもOK。",
  en: "Swipe right for 行った, left for 行ってない — buttons and arrow keys work too.",
  iyo: "右に「行った」、左に「行ってない」。ボタンや矢印キーでもええよ。",
};
UI_LABELS["visit.restart"] = {
  ja: "もう一度見直す",
  en: "Review again",
  iyo: "もう一回見直す",
};
UI_LABELS["visit.done.title"] = {
  ja: "ぜんぶ確認しました",
  en: "All done",
  iyo: "ぜんぶ見たよ",
};
UI_LABELS["visit.done.lead"] = {
  // {visited} / {total} replaced at render time.
  ja: "{total} 札所のうち {visited} 札所を「行った」に設定しました。",
  en: "Marked {visited} of {total} temples as visited.",
  iyo: "{total} 札所のうち {visited} 札所を「行った」にしたよ。",
};

// ---- デジタル納経帳 / Digital nokyocho (Req 10.1–10.5) ---------------------
UI_LABELS["nokyocho.title"] = {
  ja: "デジタル納経帳",
  en: "Digital nokyocho",
  "zh-Hans": "数字纳经帐",
  ko: "디지털 납경장",
  fr: "Nokyocho numérique",
  ar: "دفتر النوكيو الرقمي",
  iyo: "デジタル納経帳",
};
UI_LABELS["nokyocho.lead"] = {
  ja: "巡った札所の記録を、写真やひとことと一緒に残しましょう。",
  en: "Keep a record of each temple you visit — with photos and a few words.",
  iyo: "巡った札所の記録を、写真やひとことと一緒に残そや。",
};
UI_LABELS["nokyocho.openSetup"] = {
  ja: "初期設定",
  en: "Set up",
  iyo: "初期設定",
};

UI_LABELS["nokyocho.form.title"] = {
  ja: "訪問を記録する",
  en: "Record a visit",
  iyo: "訪問を記録するけん",
};
UI_LABELS["nokyocho.form.temple"] = {
  ja: "札所",
  en: "Temple",
  iyo: "札所",
};
UI_LABELS["nokyocho.form.noTemples"] = {
  ja: "札所データを準備中です",
  en: "Temple data coming soon",
  iyo: "札所データを準備しよるけん",
};
UI_LABELS["nokyocho.form.date"] = {
  ja: "訪問日",
  en: "Visit date",
  iyo: "訪問した日",
};
UI_LABELS["nokyocho.form.photos"] = {
  ja: "写真",
  en: "Photos",
  iyo: "写真",
};
UI_LABELS["nokyocho.form.photosHint"] = {
  ja: "写真は端末内に保存されます（アップロードはされません）。",
  en: "Photos are stored on your device only (not uploaded).",
  iyo: "写真は端末ん中に残るだけやけん（アップロードはせんよ）。",
};
UI_LABELS["nokyocho.form.photoAlt"] = {
  // {n} replaced at render time.
  ja: "添付写真 {n}",
  en: "Attached photo {n}",
  iyo: "添付写真 {n}",
};
UI_LABELS["nokyocho.form.removePhoto"] = {
  ja: "写真を削除",
  en: "Remove photo",
  iyo: "写真を消す",
};
UI_LABELS["nokyocho.form.memo"] = {
  ja: "メモ",
  en: "Memo",
  iyo: "メモ",
};
UI_LABELS["nokyocho.form.memoPlaceholder"] = {
  ja: "御朱印のことや気づいたこと…",
  en: "Notes about the goshuin or anything you noticed…",
  iyo: "御朱印のことや気づいたこと…",
};
UI_LABELS["nokyocho.form.route"] = {
  ja: "当日のルート",
  en: "Today's route",
  iyo: "当日のルート",
};
UI_LABELS["nokyocho.form.routePlaceholder"] = {
  ja: "例：松山駅 → 石手寺 → 道後温泉",
  en: "e.g. Matsuyama Sta. → Ishiteji → Dogo Onsen",
  iyo: "例：松山駅 → 石手寺 → 道後温泉",
};
UI_LABELS["nokyocho.form.impression"] = {
  ja: "感想",
  en: "Impression",
  iyo: "感想",
};
UI_LABELS["nokyocho.form.impressionPlaceholder"] = {
  ja: "今日の巡礼で感じたこと…",
  en: "How today's pilgrimage felt…",
  iyo: "今日の巡礼で感じたこと…",
};
UI_LABELS["nokyocho.form.save"] = {
  ja: "納経帳に記録する",
  en: "Save to nokyocho",
  iyo: "納経帳に記録するけん",
};
UI_LABELS["nokyocho.form.saved"] = {
  ja: "納経帳に記録しました。",
  en: "Saved to your nokyocho.",
  iyo: "納経帳に記録したよ。",
};

UI_LABELS["nokyocho.list.title"] = {
  ja: "記録した札所",
  en: "Recorded temples",
  iyo: "記録した札所",
};
UI_LABELS["nokyocho.list.count"] = {
  // {count} replaced at render time.
  ja: "{count}件",
  en: "{count}",
  iyo: "{count}件",
};
UI_LABELS["nokyocho.empty.label"] = {
  ja: "まだ記録がありません",
  en: "No records yet",
  iyo: "まだ記録がないわ",
};
UI_LABELS["nokyocho.empty.sub"] = {
  ja: "最初の一札所を記録してみましょう",
  en: "Record your first temple",
  iyo: "最初の一札所を記録してみよや",
};
UI_LABELS["nokyocho.empty.note"] = {
  ja: "上のフォームから、巡った札所を記録できます。",
  en: "Use the form above to record a temple you've visited.",
  iyo: "上のフォームから、巡った札所を記録できるけん。",
};
UI_LABELS["nokyocho.detail.noPhotos"] = {
  ja: "写真は登録されていません",
  en: "No photos attached",
  iyo: "写真は登録しとらんよ",
};
UI_LABELS["nokyocho.detail.recordedOnly"] = {
  ja: "訪問日のみ記録",
  en: "Visit date only",
  iyo: "訪問日だけ記録",
};

// ---- 今日のお遍路プラン / Pilgrimage planner (Req 12.1–12.5) ----------------
// AI plan generation is a 後続フェーズ / Post-MVP feature; copy keeps that
// nature clear while the screen is fully functional on the mock ChatPort.
UI_LABELS["planner.title"] = {
  ja: "今日のお遍路プラン",
  en: "Today's pilgrimage plan",
  "zh-Hans": "今日遍路计划",
  ko: "오늘의 순례 플랜",
  fr: "Plan de pèlerinage du jour",
  ar: "خطة الحج لليوم",
  iyo: "今日のお遍路プラン",
};
UI_LABELS["planner.lead"] = {
  ja: "出発地や使える時間を教えてください。AIが当日の巡礼プランをタイムラインで考えます。",
  en: "Tell me your start point and time. AI drafts a same-day pilgrimage timeline.",
  iyo: "出発地や使える時間を教えてや。AIが今日のプランをタイムラインで考えるけん。",
};
UI_LABELS["planner.phaseNote"] = {
  ja: "後続フェーズの機能です。現在はAIモックで動作します。",
  en: "A later-phase feature — currently running on the AI mock.",
  iyo: "後続フェーズの機能やけん、今はAIモックで動いとるよ。",
};
UI_LABELS["planner.form.start"] = {
  ja: "出発地点",
  en: "Start point",
  "zh-Hans": "出发地点",
  ko: "출발 지점",
  fr: "Point de départ",
  ar: "نقطة الانطلاق",
  iyo: "出発地点",
};
UI_LABELS["planner.form.startPlaceholder"] = {
  ja: "例：松山駅",
  en: "e.g. Matsuyama Sta.",
  iyo: "例：松山駅",
};
UI_LABELS["planner.form.time"] = {
  ja: "利用できる時間",
  en: "Available time",
  "zh-Hans": "可用时间",
  ko: "이용 가능 시간",
  fr: "Temps disponible",
  ar: "الوقت المتاح",
  iyo: "使える時間",
};
UI_LABELS["planner.form.hoursUnit"] = {
  // {h} replaced at render time.
  ja: "約{h}時間",
  en: "about {h} h",
  iyo: "だいたい{h}時間",
};
UI_LABELS["planner.form.transport"] = {
  ja: "移動手段",
  en: "Transport",
  "zh-Hans": "交通方式",
  ko: "이동 수단",
  fr: "Transport",
  ar: "وسيلة التنقل",
  iyo: "移動手段",
};
UI_LABELS["planner.transport.walk"] = {
  ja: "徒歩",
  en: "Walk",
  "zh-Hans": "步行",
  ko: "도보",
  fr: "À pied",
  ar: "سيرًا",
  iyo: "歩き",
};
UI_LABELS["planner.transport.car"] = {
  ja: "車",
  en: "Car",
  "zh-Hans": "汽车",
  ko: "자동차",
  fr: "Voiture",
  ar: "سيارة",
  iyo: "車",
};
UI_LABELS["planner.transport.bike"] = {
  ja: "自転車",
  en: "Bike",
  "zh-Hans": "自行车",
  ko: "자전거",
  fr: "Vélo",
  ar: "دراجة",
  iyo: "自転車",
};
UI_LABELS["planner.form.temples"] = {
  ja: "希望する札所",
  en: "Preferred temples",
  "zh-Hans": "希望的札所",
  ko: "원하는 사찰",
  fr: "Temples souhaités",
  ar: "المعابد المفضّلة",
  iyo: "行きたい札所",
};
UI_LABELS["planner.form.templesHint"] = {
  ja: "選ばなければ、おまかせで近くの札所を選びます。",
  en: "Leave empty and we'll pick nearby temples for you.",
  iyo: "選ばんかったら、おまかせで近くの札所を選ぶけん。",
};
UI_LABELS["planner.form.noTemples"] = {
  ja: "札所データを準備中です。",
  en: "Temple data is coming soon.",
  iyo: "札所データを準備しよるけん。",
};
UI_LABELS["planner.form.fitness"] = {
  ja: "体力レベル",
  en: "Fitness level",
  "zh-Hans": "体力水平",
  ko: "체력 수준",
  fr: "Niveau de forme",
  ar: "مستوى اللياقة",
  iyo: "体力レベル",
};
UI_LABELS["planner.fitness.low"] = {
  ja: "ゆっくり",
  en: "Easy",
  "zh-Hans": "轻松",
  ko: "여유롭게",
  fr: "Tranquille",
  ar: "هادئ",
  iyo: "ゆっくり",
};
UI_LABELS["planner.fitness.mid"] = {
  ja: "ふつう",
  en: "Moderate",
  "zh-Hans": "普通",
  ko: "보통",
  fr: "Modéré",
  ar: "متوسط",
  iyo: "ふつう",
};
UI_LABELS["planner.fitness.high"] = {
  ja: "しっかり",
  en: "Active",
  "zh-Hans": "充实",
  ko: "활발하게",
  fr: "Actif",
  ar: "نشِط",
  iyo: "しっかり",
};
UI_LABELS["planner.form.sightseeing"] = {
  ja: "観光も含める",
  en: "Include sightseeing",
  "zh-Hans": "包含观光",
  ko: "관광 포함",
  fr: "Inclure le tourisme",
  ar: "تضمين السياحة",
  iyo: "観光も入れる",
};
UI_LABELS["planner.form.sightseeingHint"] = {
  ja: "札所のまわりの観光スポットや食事もプランに混ぜます。",
  en: "Mix nearby spots and meals into the plan alongside the temples.",
  iyo: "札所のまわりの観光や食事もプランに混ぜるけん。",
};
UI_LABELS["planner.generate"] = {
  ja: "プランを作る",
  en: "Make a plan",
  "zh-Hans": "生成计划",
  ko: "플랜 만들기",
  fr: "Créer le plan",
  ar: "إنشاء الخطة",
  iyo: "プランを作るけん",
};
UI_LABELS["planner.generating"] = {
  ja: "プランを考えています…",
  en: "Drafting your plan…",
  iyo: "プランを考えよるけん…",
};
UI_LABELS["planner.regenerate"] = {
  ja: "条件を変えて作り直す",
  en: "Adjust and remake",
  iyo: "条件を変えて作り直すけん",
};
UI_LABELS["planner.error"] = {
  ja: "プランをうまく作れませんでした。もう一度お試しください。",
  en: "I couldn't build the plan just now. Please try again.",
  "zh-Hans": "暂时无法生成计划，请重试。",
  ko: "플랜을 만들지 못했어요. 다시 시도해 주세요.",
  fr: "Je n'ai pas pu créer le plan. Veuillez réessayer.",
  ar: "تعذّر إنشاء الخطة. حاول مرة أخرى.",
  iyo: "プランをうまく作れんかったわ。もういっぺん試してや。",
};
UI_LABELS["planner.retry"] = {
  ja: "もう一度ためす",
  en: "Retry",
  "zh-Hans": "重试",
  ko: "다시 시도",
  fr: "Réessayer",
  ar: "إعادة المحاولة",
  iyo: "もういっぺん",
};
UI_LABELS["planner.result.title"] = {
  ja: "今日のプラン",
  en: "Today's plan",
  "zh-Hans": "今日计划",
  ko: "오늘의 플랜",
  fr: "Le plan du jour",
  ar: "خطة اليوم",
  iyo: "今日のプラン",
};
UI_LABELS["planner.result.empty"] = {
  ja: "条件に合うプランが見つかりませんでした。時間や条件を変えてみてください。",
  en: "No plan fit those conditions. Try changing the time or options.",
  iyo: "条件に合うプランが見つからんかったわ。時間や条件を変えてみてや。",
};
UI_LABELS["planner.kind.temple"] = {
  ja: "札所",
  en: "Temple",
  "zh-Hans": "札所",
  ko: "사찰",
  fr: "Temple",
  ar: "معبد",
  iyo: "札所",
};
UI_LABELS["planner.kind.spot"] = {
  ja: "観光",
  en: "Spot",
  "zh-Hans": "观光",
  ko: "관광",
  fr: "Site",
  ar: "موقع",
  iyo: "観光",
};
UI_LABELS["planner.kind.meal"] = {
  ja: "食事",
  en: "Meal",
  "zh-Hans": "用餐",
  ko: "식사",
  fr: "Repas",
  ar: "وجبة",
  iyo: "食事",
};

// ---- 札所到着時の自動表示 / Arrival notifier + sheet (Req 13.1–13.6) --------
// ジオフェンス自動表示は 後続フェーズ / Post-MVP。手動到着記録とオフライン同期は
// MVP 対象。コピーはその性質を明確にしつつ、モックで完全に動作する。
UI_LABELS["arrival.title"] = {
  ja: "札所到着の自動表示",
  en: "Temple arrival",
  "zh-Hans": "札所到达提示",
  ko: "사찰 도착 알림",
  fr: "Arrivée au temple",
  ar: "الوصول إلى المعبد",
  iyo: "札所到着の自動表示",
};
UI_LABELS["arrival.lead"] = {
  ja: "札所に近づくと到着情報が自動で表示されます。今は到着をシミュレートして試せます。",
  en: "Arrival info pops up as you near a temple. For now, simulate an arrival to try it.",
  iyo: "札所に近づいたら到着情報が出るけん。今は到着をシミュレートして試せるよ。",
};
UI_LABELS["arrival.loading"] = {
  ja: "札所を読み込んでいます…",
  en: "Loading temples…",
  iyo: "札所を読み込みよるけん…",
};
UI_LABELS["arrival.empty"] = {
  ja: "この県の札所データは準備中です。",
  en: "Temple data for this prefecture is coming soon.",
  iyo: "この県の札所データはもうちょっと待ってな。",
};
UI_LABELS["arrival.noLocation"] = {
  ja: "現在地を取得できませんでした。下のボタンから手動で到着を記録できます。",
  en: "Couldn't get your location. Record an arrival manually with the buttons below.",
  iyo: "今おる場所が分からんかったわ。下のボタンで手動で到着を記録できるけん。",
};

// 到着シミュレート (manual arrival affordance / Req 13.4)
UI_LABELS["arrival.simulateTitle"] = {
  ja: "到着をシミュレート",
  en: "Simulate an arrival",
  "zh-Hans": "模拟到达",
  ko: "도착 시뮬레이션",
  fr: "Simuler une arrivée",
  ar: "محاكاة الوصول",
  iyo: "到着をシミュレート",
};
UI_LABELS["arrival.simulateHint"] = {
  ja: "札所を選ぶと、その場に到着したものとして到着シートを開きます。",
  en: "Pick a temple to open its arrival sheet as if you'd arrived there.",
  iyo: "札所を選んだら、そこに着いたことにして到着シートが開くけん。",
};

// 接続状態インジケータ (Req 13.5/13.6)
UI_LABELS["arrival.online"] = {
  ja: "オンライン（到着ログは即時同期）",
  en: "Online — arrivals sync instantly",
  iyo: "オンライン（到着ログはすぐ同期するよ）",
};
UI_LABELS["arrival.offline"] = {
  ja: "オフライン（到着ログは端末に一時保存）",
  en: "Offline — arrivals saved on your device",
  iyo: "オフライン（到着ログは端末に一旦ためとくよ）",
};
UI_LABELS["arrival.goOffline"] = {
  ja: "オフラインにする",
  en: "Go offline",
  iyo: "オフラインにする",
};
UI_LABELS["arrival.goOnline"] = {
  ja: "オンラインに戻す",
  en: "Go online",
  iyo: "オンラインに戻す",
};
UI_LABELS["arrival.pending"] = {
  // {count} replaced at render time.
  ja: "未同期の到着ログ：{count}件（オンライン復帰時に同期します）",
  en: "{count} arrival log(s) waiting to sync when you're back online",
  iyo: "まだ同期しとらん到着ログが{count}件あるよ（オンラインに戻ったら同期するけん）",
};
UI_LABELS["arrival.synced"] = {
  // {count} replaced at render time.
  ja: "到着ログ{count}件を同期しました。",
  en: "Synced {count} arrival log(s).",
  iyo: "到着ログを{count}件同期したよ。",
};

// 到着シート (Req 13.1, 13.2)
UI_LABELS["arrival.notice"] = {
  ja: "札所に到着しました",
  en: "You've arrived",
  "zh-Hans": "您已到达札所",
  ko: "사찰에 도착했습니다",
  fr: "Vous êtes arrivé",
  ar: "لقد وصلت",
  iyo: "札所に着いたよ",
};
UI_LABELS["arrival.about"] = {
  ja: "説明",
  en: "About",
  "zh-Hans": "介绍",
  ko: "설명",
  fr: "À propos",
  ar: "نبذة",
  iyo: "説明",
};
UI_LABELS["arrival.history"] = {
  ja: "歴史",
  en: "History",
  "zh-Hans": "历史",
  ko: "역사",
  fr: "Histoire",
  ar: "التاريخ",
  iyo: "歴史",
};
UI_LABELS["arrival.highlights"] = {
  ja: "見どころ",
  en: "Highlights",
  "zh-Hans": "看点",
  ko: "볼거리",
  fr: "À voir",
  ar: "أبرز المعالم",
  iyo: "見どころ",
};
UI_LABELS["arrival.photoSpots"] = {
  ja: "写真スポット",
  en: "Photo spots",
  "zh-Hans": "拍照点",
  ko: "포토 스폿",
  fr: "Spots photo",
  ar: "مواقع التصوير",
  iyo: "写真スポット",
};
UI_LABELS["arrival.record"] = {
  ja: "納経帳に記録",
  en: "Save to nokyocho",
  "zh-Hans": "记入纳经帐",
  ko: "납경장에 기록",
  fr: "Noter au nokyocho",
  ar: "حفظ في الدفتر",
  iyo: "納経帳に記録するけん",
};
UI_LABELS["arrival.recorded"] = {
  ja: "記録済み",
  en: "Recorded",
  iyo: "記録したよ",
};
UI_LABELS["arrival.addShiori"] = {
  ja: "しおりに追加",
  en: "Add to itinerary",
  "zh-Hans": "加入行程",
  ko: "일정에 추가",
  fr: "Ajouter à l'itinéraire",
  ar: "إضافة إلى المسار",
  iyo: "しおりに追加するけん",
};
UI_LABELS["arrival.inShiori"] = {
  ja: "しおりに追加済み",
  en: "In your itinerary",
  iyo: "しおりに入れたよ",
};
UI_LABELS["arrival.close"] = {
  ja: "閉じる",
  en: "Close",
  iyo: "閉じるけん",
};

// ---- 札所/重ねるマップ ビュー切替 (Req 14) --------------------------------
UI_LABELS["map.viewToggle.label"] = {
  ja: "マップの表示を切り替え",
  en: "Switch map view",
  iyo: "マップの表示を切り替えるけん",
};
UI_LABELS["map.viewToggle.satsu"] = {
  ja: "札所マップ",
  en: "Temple map",
  "zh-Hans": "札所地图",
  ko: "사찰 지도",
  fr: "Carte des temples",
  ar: "خريطة المعابد",
  iyo: "札所マップ",
};
UI_LABELS["map.viewToggle.layered"] = {
  ja: "重ねるマップ",
  en: "Layered map",
  "zh-Hans": "叠加地图",
  ko: "레이어 지도",
  fr: "Carte en couches",
  ar: "الخريطة الطبقية",
  iyo: "重ねるマップ",
};

// ---- 重ねるマップ（情報レイヤー）/ Layered map (Req 14.1–14.6) -------------
UI_LABELS["lmap.title"] = {
  ja: "重ねるマップ",
  en: "Layered map",
  "zh-Hans": "叠加地图",
  ko: "레이어 지도",
  fr: "Carte en couches",
  ar: "الخريطة الطبقية",
  iyo: "重ねるマップ",
};
UI_LABELS["lmap.lead"] = {
  ja: "お遍路・トイレ・休憩所などの情報を1つの地図に重ねて、サイト横断せずに周遊できます。",
  en: "Overlay temples, restrooms, rest areas and more on one map — tour without hopping between sites.",
  iyo: "お遍路やトイレ、休憩所を1つの地図に重ねて、あちこち見んでも周遊できるけん。",
};
UI_LABELS["lmap.loading"] = {
  ja: "地図情報を読み込んでいます…",
  en: "Loading map layers…",
  iyo: "地図の情報を読み込みよるけん…",
};
UI_LABELS["lmap.empty"] = {
  ja: "表示するレイヤーが選ばれていません。上のトグルでレイヤーを選んでください。",
  en: "No layers selected. Turn on a layer with the toggles above.",
  iyo: "表示するレイヤーが選ばれとらんよ。上のトグルで選んでや。",
};
UI_LABELS["lmap.countShown"] = {
  // {count} replaced at render time.
  ja: "{count}件の情報を重ねて表示中",
  en: "Overlaying {count} features",
  iyo: "{count}件の情報を重ねて出しよるよ",
};
UI_LABELS["lmap.phaseNote"] = {
  ja: "MVPの基本レイヤーはお遍路／トイレ／休憩所です。サイクリング／グルメ／防災は後続フェーズの先行プレビュー（モックデータ）です。",
  en: "The MVP basic layers are temples, restrooms and rest areas. Cycling, gourmet and disaster are an early preview of a later phase (mock data).",
  iyo: "MVPの基本レイヤーはお遍路・トイレ・休憩所やけん。サイクリングやグルメ、防災は後続フェーズの先行プレビュー（モック）やよ。",
};
UI_LABELS["lmap.phaseLabel"] = {
  ja: "後続フェーズ",
  en: "Later phase",
  "zh-Hans": "后续阶段",
  ko: "후속 단계",
  fr: "Phase ultérieure",
  ar: "مرحلة لاحقة",
  iyo: "後続フェーズ",
};

// レイヤーグループ見出し
UI_LABELS["lmap.group.basic"] = {
  ja: "基本レイヤー（MVP）",
  en: "Basic layers (MVP)",
  iyo: "基本レイヤー（MVP）",
};
UI_LABELS["lmap.group.postMvp"] = {
  ja: "追加レイヤー",
  en: "Additional layers",
  iyo: "追加レイヤー",
};

// レイヤー名
UI_LABELS["lmap.layer.ohenro"] = {
  ja: "お遍路",
  en: "Temples",
  "zh-Hans": "遍路",
  ko: "오헨로",
  fr: "Temples",
  ar: "المعابد",
  iyo: "お遍路",
};
UI_LABELS["lmap.layer.restroom"] = {
  ja: "トイレ",
  en: "Restrooms",
  "zh-Hans": "洗手间",
  ko: "화장실",
  fr: "Toilettes",
  ar: "دورات المياه",
  iyo: "トイレ",
};
UI_LABELS["lmap.layer.rest_area"] = {
  ja: "休憩所",
  en: "Rest areas",
  "zh-Hans": "休息所",
  ko: "휴게소",
  fr: "Aires de repos",
  ar: "أماكن الاستراحة",
  iyo: "休憩所",
};
UI_LABELS["lmap.layer.cycling"] = {
  ja: "サイクリング",
  en: "Cycling",
  "zh-Hans": "骑行",
  ko: "사이클링",
  fr: "Vélo",
  ar: "ركوب الدراجات",
  iyo: "サイクリング",
};
UI_LABELS["lmap.layer.gourmet"] = {
  ja: "グルメ",
  en: "Gourmet",
  "zh-Hans": "美食",
  ko: "맛집",
  fr: "Gastronomie",
  ar: "المأكولات",
  iyo: "グルメ",
};
UI_LABELS["lmap.layer.disaster"] = {
  ja: "防災・ハザード",
  en: "Disaster / hazard",
  "zh-Hans": "防灾・灾害",
  ko: "방재・재해",
  fr: "Risques / dangers",
  ar: "الكوارث / المخاطر",
  iyo: "防災・ハザード",
};

// 目的条件プリセット（クロス属性周遊候補 / Req 14.4）
UI_LABELS["lmap.purpose.label"] = {
  ja: "目的から重ねる",
  en: "Layer by purpose",
  iyo: "目的から重ねる",
};
UI_LABELS["lmap.purpose.basics"] = {
  ja: "お遍路の基本",
  en: "Pilgrimage basics",
  iyo: "お遍路の基本",
};
UI_LABELS["lmap.purpose.cyclingGourmet"] = {
  ja: "サイクリング＆グルメ",
  en: "Cycling & gourmet",
  iyo: "サイクリング＆グルメ",
};
UI_LABELS["lmap.purpose.safe"] = {
  ja: "安心の巡礼",
  en: "Safe pilgrimage",
  iyo: "安心の巡礼",
};

// クロス属性周遊候補
UI_LABELS["lmap.candidates.title"] = {
  ja: "クロス属性の周遊候補",
  en: "Cross-layer touring ideas",
  iyo: "ジャンルをまたいだ周遊候補",
};
UI_LABELS["lmap.candidates.lead"] = {
  ja: "選択中のレイヤーから、近くで組み合わせられるスポットをまとめました。",
  en: "Nearby spots from your active layers, grouped so you can combine them.",
  iyo: "選んどるレイヤーから、近くで組み合わせられるスポットをまとめたよ。",
};

// ---- スワイプ発見 / Swipe discovery (Req 4.1–4.7) -------------------------
UI_LABELS["swipe.title"] = {
  ja: "スワイプで発見",
  en: "Discover by swiping",
  "zh-Hans": "滑动发现",
  "zh-Hant": "滑動發現",
  ko: "스와이프로 발견",
  fr: "Découvrir en swipant",
  ar: "اكتشف بالتمرير",
  iyo: "スワイプで見つける",
};
UI_LABELS["swipe.lead"] = {
  ja: "気になるスポットは右へ、ピンとこなければ左へ。上でしおり、下で後で見るに。",
  en: "Swipe right if it catches your eye, left if not. Up saves to your itinerary, down for later.",
  iyo: "ええなと思うたら右、ピンとこんかったら左へ。上でしおり、下で後で見るに入るけん。",
};
UI_LABELS["swipe.progress"] = {
  // {current} / {total} replaced at render time.
  ja: "{current} / {total} 枚目",
  en: "Card {current} of {total}",
  iyo: "{current} / {total} 枚目",
};
UI_LABELS["swipe.cardRole"] = {
  ja: "スワイプカード",
  en: "swipe card",
  iyo: "スワイプカード",
};
UI_LABELS["swipe.controls"] = {
  ja: "スワイプ操作",
  en: "Swipe actions",
  iyo: "スワイプ操作",
};
UI_LABELS["swipe.hint"] = {
  ja: "カードはドラッグでも、ボタンでも、矢印キーでも操作できます。",
  en: "Drag the card, tap a button, or use the arrow keys.",
  iyo: "カードはドラッグでも、ボタンでも、矢印キーでも動かせるけん。",
};

// 4方向アクション (Req 4.2–4.5)
UI_LABELS["swipe.action.favorite"] = {
  ja: "行きたい",
  en: "Want to go",
  "zh-Hans": "想去",
  "zh-Hant": "想去",
  ko: "가고 싶어요",
  fr: "Envie d'y aller",
  ar: "أريد الذهاب",
  iyo: "行きたい",
};
UI_LABELS["swipe.action.skip"] = {
  ja: "興味なし",
  en: "Not for me",
  "zh-Hans": "不感兴趣",
  "zh-Hant": "沒興趣",
  ko: "관심 없어요",
  fr: "Pas pour moi",
  ar: "لا يهمني",
  iyo: "興味なし",
};
UI_LABELS["swipe.action.shiori"] = {
  ja: "しおりに追加",
  en: "Add to itinerary",
  "zh-Hans": "加入行程",
  "zh-Hant": "加入行程",
  ko: "일정에 추가",
  fr: "Ajouter à l'itinéraire",
  ar: "أضف إلى الرحلة",
  iyo: "しおりに入れる",
};
UI_LABELS["swipe.action.later"] = {
  ja: "後で見る",
  en: "See later",
  "zh-Hans": "稍后再看",
  "zh-Hant": "稍後再看",
  ko: "나중에 보기",
  fr: "Voir plus tard",
  ar: "شاهد لاحقًا",
  iyo: "後で見る",
};

// アクセシブルなボタンの aria-label (方向つき)
UI_LABELS["swipe.aria.right"] = {
  ja: "右にスワイプ：行きたいに追加",
  en: "Swipe right: add to want-to-go",
  iyo: "右にスワイプ：行きたいに入れる",
};
UI_LABELS["swipe.aria.left"] = {
  ja: "左にスワイプ：興味なしで次へ",
  en: "Swipe left: skip to next",
  iyo: "左にスワイプ：興味なしで次へ",
};
UI_LABELS["swipe.aria.up"] = {
  ja: "上にスワイプ：しおりに追加",
  en: "Swipe up: add to itinerary",
  iyo: "上にスワイプ：しおりに入れる",
};
UI_LABELS["swipe.aria.down"] = {
  ja: "下にスワイプ：後で見るに追加",
  en: "Swipe down: save for later",
  iyo: "下にスワイプ：後で見るに入れる",
};

// カード上の情報 (Req 4.1)
UI_LABELS["swipe.rank"] = {
  // {rank} replaced at render time.
  ja: "人気 {rank}位",
  en: "Popularity #{rank}",
  "zh-Hans": "人气第 {rank} 名",
  ko: "인기 {rank}위",
  fr: "Popularité n°{rank}",
  ar: "الأكثر رواجًا #{rank}",
  iyo: "人気 {rank}位",
};
UI_LABELS["swipe.reviewCount"] = {
  // {count} replaced at render time.
  ja: "口コミ {count}件",
  en: "{count} reviews",
  "zh-Hans": "{count} 条点评",
  ko: "리뷰 {count}건",
  fr: "{count} avis",
  ar: "{count} مراجعة",
  iyo: "口コミ {count}件",
};
UI_LABELS["swipe.noReviews"] = {
  ja: "口コミは準備中です。",
  en: "Reviews coming soon.",
  iyo: "口コミはもうちょっと待ってな。",
};

// スポットのカテゴリ
UI_LABELS["swipe.category.sightseeing"] = {
  ja: "観光",
  en: "Sightseeing",
  "zh-Hans": "观光",
  ko: "관광",
  fr: "Tourisme",
  ar: "معالم",
  iyo: "観光",
};
UI_LABELS["swipe.category.food"] = {
  ja: "グルメ",
  en: "Food",
  "zh-Hans": "美食",
  ko: "맛집",
  fr: "Gastronomie",
  ar: "طعام",
  iyo: "グルメ",
};
UI_LABELS["swipe.category.souvenir"] = {
  ja: "おみやげ",
  en: "Souvenirs",
  "zh-Hans": "伴手礼",
  ko: "기념품",
  fr: "Souvenirs",
  ar: "هدايا",
  iyo: "おみやげ",
};
UI_LABELS["swipe.category.onsen"] = {
  ja: "温泉",
  en: "Hot spring",
  "zh-Hans": "温泉",
  ko: "온천",
  fr: "Onsen",
  ar: "ينابيع ساخنة",
  iyo: "温泉",
};

// あなたへのおすすめ (Req 4.6)
UI_LABELS["swipe.recommend.title"] = {
  ja: "あなたへのおすすめ",
  en: "Recommended for you",
  "zh-Hans": "为你推荐",
  "zh-Hant": "為你推薦",
  ko: "당신을 위한 추천",
  fr: "Recommandé pour vous",
  ar: "موصى به لك",
  iyo: "あなたへのおすすめ",
};
UI_LABELS["swipe.recommend.empty"] = {
  ja: "ひととおり見終わりました。新しいスポットが届くまでお待ちください。",
  en: "You've seen them all for now. New spots will appear soon.",
  iyo: "ひととおり見終わったね。新しいスポットが届くまで待っとってな。",
};

// 完了 / リスタート
UI_LABELS["swipe.done.title"] = {
  ja: "ぜんぶ見終わりました",
  en: "That's everyone",
  "zh-Hans": "全部看完啦",
  ko: "모두 살펴봤어요",
  fr: "Vous avez tout vu",
  ar: "انتهيت من الجميع",
  iyo: "ぜんぶ見終わったよ",
};
UI_LABELS["swipe.done.lead"] = {
  ja: "下のおすすめもチェックしてみてくださいね。",
  en: "Check out your recommendations below.",
  iyo: "下のおすすめも見てみてや。",
};
UI_LABELS["swipe.restart"] = {
  ja: "もう一度見る",
  en: "Review again",
  iyo: "もういっぺん見る",
};
UI_LABELS["swipe.backToChat"] = {
  ja: "チャットに戻る",
  en: "Back to chat",
  iyo: "チャットに戻るけん",
};

// ---- お気に入り / Favorites (Req 5.1–5.4) ---------------------------------
UI_LABELS["fav.title"] = {
  ja: "お気に入り",
  en: "Favorites",
  "zh-Hans": "收藏",
  "zh-Hant": "收藏",
  ko: "즐겨찾기",
  fr: "Favoris",
  ar: "المفضلة",
  iyo: "お気に入り",
};
UI_LABELS["fav.lead"] = {
  ja: "行きたいスポットや、しおり・プランをここでまとめて見返せます。",
  en: "Look back over the spots, itineraries and plans you've saved.",
  iyo: "行きたいスポットやしおり・プランを、ここでまとめて見返せるけん。",
};
UI_LABELS["fav.tablistLabel"] = {
  ja: "お気に入りの分類",
  en: "Favorites categories",
  iyo: "お気に入りの分類",
};

// タブ名 (Req 5.2)
UI_LABELS["fav.tab.all"] = {
  ja: "すべて",
  en: "All",
  "zh-Hans": "全部",
  "zh-Hant": "全部",
  ko: "전체",
  fr: "Tout",
  ar: "الكل",
  iyo: "ぜんぶ",
};
UI_LABELS["fav.tab.spot"] = {
  ja: "スポット",
  en: "Spots",
  "zh-Hans": "景点",
  "zh-Hant": "景點",
  ko: "스폿",
  fr: "Lieux",
  ar: "أماكن",
  iyo: "スポット",
};
UI_LABELS["fav.tab.shiori"] = {
  ja: "しおり",
  en: "Itinerary",
  "zh-Hans": "行程",
  "zh-Hant": "行程",
  ko: "일정",
  fr: "Itinéraire",
  ar: "خط الرحلة",
  iyo: "しおり",
};
UI_LABELS["fav.tab.plan"] = {
  ja: "プラン",
  en: "Plans",
  "zh-Hans": "计划",
  "zh-Hant": "計畫",
  ko: "플랜",
  fr: "Plans",
  ar: "خطط",
  iyo: "プラン",
};

// 空の状態
UI_LABELS["fav.empty.title"] = {
  ja: "まだお気に入りがありません",
  en: "No favorites yet",
  iyo: "まだお気に入りがないわ",
};
UI_LABELS["fav.empty.lead"] = {
  ja: "スワイプで気になるスポットを右にすると、ここに集まります。",
  en: "Swipe spots right and they'll gather here.",
  iyo: "スワイプで気になるスポットを右にしたら、ここに集まるけん。",
};
UI_LABELS["fav.tabEmpty"] = {
  ja: "このタブにはまだ何もありません。",
  en: "Nothing in this tab yet.",
  iyo: "このタブにはまだ何もないよ。",
};

// 行アクション
UI_LABELS["fav.open"] = {
  // {name} replaced at render time.
  ja: "{name}の詳細を見る",
  en: "View details for {name}",
  iyo: "{name}の詳細を見るけん",
};
UI_LABELS["fav.remove"] = {
  // {name} replaced at render time.
  ja: "{name}をお気に入りから削除",
  en: "Remove {name} from favorites",
  iyo: "{name}をお気に入りから外す",
};

// 詳細 + 関連 (Req 5.4)
UI_LABELS["fav.back"] = {
  ja: "お気に入りに戻る",
  en: "Back to favorites",
  iyo: "お気に入りに戻るけん",
};
UI_LABELS["fav.related.title"] = {
  ja: "関連スポット",
  en: "Related spots",
  "zh-Hans": "相关景点",
  "zh-Hant": "相關景點",
  ko: "관련 스폿",
  fr: "Lieux similaires",
  ar: "أماكن ذات صلة",
  iyo: "関連スポット",
};
UI_LABELS["fav.related.empty"] = {
  ja: "関連スポットは準備中です。",
  en: "Related spots are coming soon.",
  iyo: "関連スポットはもうちょっと待ってな。",
};

// ---- しおり（旅程）編集 / Shiori editor (Req 6.1–6.4) ----------------------
UI_LABELS["shiori.title"] = {
  ja: "しおり（旅程）",
  en: "Your itinerary",
  "zh-Hans": "行程",
  "zh-Hant": "行程",
  ko: "여행 일정",
  fr: "Votre itinéraire",
  ar: "خط رحلتك",
  iyo: "しおり（旅程）",
};
UI_LABELS["shiori.lead"] = {
  ja: "スワイプで上にした行きたい場所が並びます。順番を入れ替えて、当日の行程を整えましょう。",
  en: "Spots you swiped up gather here. Reorder them to shape your day.",
  iyo: "スワイプで上にした行きたいとこが並ぶけん。順番を入れ替えて行程を整えよや。",
};
UI_LABELS["shiori.empty.title"] = {
  ja: "しおりはまだ空っぽです",
  en: "Your itinerary is empty",
  iyo: "しおりはまだ空っぽやよ",
};
UI_LABELS["shiori.empty.lead"] = {
  ja: "スワイプ画面で気になる場所を上にスワイプすると、ここに追加されます。",
  en: "Swipe a spot up on the swipe screen to add it here.",
  iyo: "スワイプ画面で気になるとこを上にスワイプしたら、ここに入るけん。",
};
UI_LABELS["shiori.moveControls"] = {
  // {name} replaced at render time.
  ja: "{name}の順番を変える",
  en: "Reorder {name}",
  iyo: "{name}の順番を変えるけん",
};
UI_LABELS["shiori.moveUp"] = {
  // {name} replaced at render time.
  ja: "{name}を上に移動",
  en: "Move {name} up",
  iyo: "{name}を上に動かす",
};
UI_LABELS["shiori.moveDown"] = {
  // {name} replaced at render time.
  ja: "{name}を下に移動",
  en: "Move {name} down",
  iyo: "{name}を下に動かす",
};
UI_LABELS["shiori.remove"] = {
  // {name} replaced at render time.
  ja: "{name}をしおりから削除",
  en: "Remove {name} from the itinerary",
  iyo: "{name}をしおりから消す",
};
UI_LABELS["shiori.plan.title"] = {
  ja: "わたしの愛媛しおり",
  en: "My Ehime itinerary",
  iyo: "わたしの愛媛しおり",
};

// ---- プラン共有 / Plan sharing (Req 7.1–7.3) -------------------------------
UI_LABELS["share.title"] = {
  ja: "プランを共有する",
  en: "Share your plan",
  "zh-Hans": "分享行程",
  "zh-Hant": "分享行程",
  ko: "플랜 공유",
  fr: "Partager le plan",
  ar: "مشاركة الخطة",
  iyo: "プランを共有するけん",
};
UI_LABELS["share.lead"] = {
  ja: "リンクを作って同行者に送ったり、もらったリンクからプランを開いたりできます。",
  en: "Make a link to send to your companions, or open a plan from a link you received.",
  iyo: "リンクを作って一緒に行く人に送ったり、もらったリンクから開いたりできるけん。",
};
UI_LABELS["share.generate"] = {
  ja: "共有リンクを作る",
  en: "Create a share link",
  iyo: "共有リンクを作るけん",
};
UI_LABELS["share.emptyHint"] = {
  ja: "しおりに場所を追加すると共有できます。",
  en: "Add spots to your itinerary to share it.",
  iyo: "しおりに場所を入れたら共有できるけん。",
};
UI_LABELS["share.linkLabel"] = {
  ja: "共有リンク",
  en: "Share link",
  iyo: "共有リンク",
};
UI_LABELS["share.copy"] = {
  ja: "コピー",
  en: "Copy",
  "zh-Hans": "复制",
  ko: "복사",
  fr: "Copier",
  ar: "نسخ",
  iyo: "コピーする",
};
UI_LABELS["share.copied"] = {
  ja: "コピーしました",
  en: "Copied",
  iyo: "コピーしたよ",
};
UI_LABELS["share.openLabel"] = {
  ja: "もらったリンク・コードからプランを開く",
  en: "Open a plan from a link or code",
  iyo: "もらったリンク・コードからプランを開く",
};
UI_LABELS["share.openPlaceholder"] = {
  ja: "リンクまたは共有コードを貼り付け…",
  en: "Paste a link or share code…",
  iyo: "リンクか共有コードを貼り付けてや…",
};
UI_LABELS["share.open"] = {
  ja: "開く",
  en: "Open",
  "zh-Hans": "打开",
  ko: "열기",
  fr: "Ouvrir",
  ar: "فتح",
  iyo: "開くけん",
};
UI_LABELS["share.notFound"] = {
  ja: "プランが見つかりませんでした。リンクやコードをご確認ください。",
  en: "Plan not found. Please check the link or code.",
  "zh-Hans": "未找到行程，请检查链接或代码。",
  ko: "플랜을 찾을 수 없습니다. 링크나 코드를 확인해 주세요.",
  fr: "Plan introuvable. Vérifiez le lien ou le code.",
  ar: "تعذّر العثور على الخطة. تحقّق من الرابط أو الرمز.",
  iyo: "プランが見つからんかったわ。リンクやコードを確かめてや。",
};
UI_LABELS["share.openedEmpty"] = {
  ja: "このプランには場所が登録されていません。",
  en: "This plan has no spots.",
  iyo: "このプランには場所が入っとらんよ。",
};

// ---- AI 画像自動生成 (著作権フリー画像) ------------------------------------
UI_LABELS["image.generating"] = {
  ja: "写真を生成中…",
  en: "Generating photo…",
  "zh-Hans": "正在生成照片…",
  "zh-Hant": "正在生成照片…",
  ko: "사진 생성 중…",
  fr: "Génération de la photo…",
  ar: "جارٍ إنشاء الصورة…",
  iyo: "写真を作りよるけん…",
};

// ---- 通常観光モード 重ねるマップ / TourismLayeredMap -----------------------
UI_LABELS["nav.tourism.map"] = {
  ja: "マップ",
  en: "Map",
  "zh-Hans": "地图",
  ko: "지도",
  fr: "Carte",
  ar: "خريطة",
  iyo: "マップ",
};
UI_LABELS["panel.tourism.map.title"] = {
  ja: "重ねるマップ",
  en: "Layered map",
  iyo: "重ねるマップ",
};
UI_LABELS["tlmap.title"] = {
  ja: "重ねるマップ",
  en: "Layered map",
  iyo: "重ねるマップ",
};
UI_LABELS["tlmap.lead"] = {
  ja: "観光・グルメ・トイレ・お気に入りなどを1枚の地図に重ねて表示。スワイプで登録した場所もそのままピンになります。",
  en: "Overlay sightseeing, food, restrooms and your swiped favorites on one map.",
  iyo: "観光もグルメもトイレもお気に入りも、1枚の地図に重ねられるけん。",
};
UI_LABELS["tlmap.group.spots"] = { ja: "スポット", en: "Spots", iyo: "スポット" };
UI_LABELS["tlmap.group.facility"] = { ja: "施設", en: "Facilities", iyo: "施設" };
UI_LABELS["tlmap.group.yours"] = { ja: "あなたのリスト", en: "Your lists", iyo: "あんたのリスト" };
UI_LABELS["tlmap.group.yoursTag"] = { ja: "スワイプ連動", en: "from swipes", iyo: "スワイプ連動" };

UI_LABELS["tlmap.layer.sightseeing"] = { ja: "観光スポット", en: "Sightseeing", iyo: "観光スポット" };
UI_LABELS["tlmap.layer.food"] = { ja: "グルメ", en: "Food", iyo: "グルメ" };
UI_LABELS["tlmap.layer.onsen"] = { ja: "温泉", en: "Onsen", iyo: "温泉" };
UI_LABELS["tlmap.layer.souvenir"] = { ja: "おみやげ", en: "Souvenirs", iyo: "おみやげ" };
UI_LABELS["tlmap.layer.restroom"] = { ja: "トイレ", en: "Restrooms", iyo: "トイレ" };
UI_LABELS["tlmap.layer.parking"] = { ja: "駐車場", en: "Parking", iyo: "駐車場" };
UI_LABELS["tlmap.layer.rest_area"] = { ja: "休憩所・道の駅", en: "Rest areas", iyo: "休憩所・道の駅" };
UI_LABELS["tlmap.layer.favorite"] = { ja: "お気に入り", en: "Favorites", iyo: "お気に入り" };
UI_LABELS["tlmap.layer.shiori"] = { ja: "しおり", en: "Itinerary", iyo: "しおり" };
UI_LABELS["tlmap.layer.later"] = { ja: "後で見る", en: "Later", iyo: "後で見る" };

UI_LABELS["tlmap.purpose.label"] = { ja: "目的から重ねる", en: "Overlay by purpose", iyo: "目的から重ねる" };
UI_LABELS["tlmap.purpose.standard"] = { ja: "定番観光", en: "Classic tour", iyo: "定番観光" };
UI_LABELS["tlmap.purpose.gourmet"] = { ja: "食べ歩き", en: "Food trip", iyo: "食べ歩き" };
UI_LABELS["tlmap.purpose.mine"] = { ja: "お気に入りを巡る", en: "My picks", iyo: "お気に入りを巡る" };

UI_LABELS["tlmap.loading"] = { ja: "地図を読み込んでいます…", en: "Loading map…", iyo: "地図を読み込みよるけん…" };
UI_LABELS["tlmap.countShown"] = {
  // {count} replaced at render time.
  ja: "{count}件を重ねて表示中",
  en: "Showing {count} places",
  iyo: "{count}件を重ねて表示しよるよ",
};
UI_LABELS["tlmap.empty"] = {
  ja: "表示するレイヤーを選んでください。",
  en: "Turn on a layer to see places.",
  iyo: "表示するレイヤーを選んでや。",
};
UI_LABELS["tlmap.candidates.title"] = { ja: "近い組み合わせ（周遊候補）", en: "Nearby combos", iyo: "近い組み合わせ" };
UI_LABELS["tlmap.candidates.lead"] = {
  ja: "有効なレイヤーから、近くにまとまっている場所を提案します。",
  en: "Suggested clusters across your active layers.",
  iyo: "有効なレイヤーから、近くにまとまっとる場所を出すけん。",
};

UI_LABELS["tlmap.attribution"] = {
  ja: "地点データ © OpenStreetMap contributors（ODbL）",
  en: "Place data © OpenStreetMap contributors (ODbL)",
  iyo: "地点データ © OpenStreetMap contributors（ODbL）",
};

// ---- 観光スポット詳細パネル (TourismLayeredMap の選択時) ------------------
UI_LABELS["tlmap.googleAttribution"] = { ja: "Google Maps / Google Places の情報を使用", en: "Using Google Maps / Google Places data", iyo: "Google Maps / Google Places の情報を使っとるよ" };
UI_LABELS["tlmap.detail.access"] = { ja: "現在地からのアクセス", en: "Access from here", iyo: "現在地からのアクセス" };
UI_LABELS["tlmap.detail.hours"] = { ja: "営業時間", en: "Opening hours", iyo: "営業時間" };
UI_LABELS["tlmap.detail.website"] = { ja: "ホームページ", en: "Website", iyo: "ホームページ" };
UI_LABELS["tlmap.detail.noInfo"] = { ja: "情報なし", en: "No info", iyo: "情報なし" };
UI_LABELS["tlmap.detail.noLocation"] = { ja: "現在地が取得できません", en: "Location unavailable", iyo: "現在地が取れんかった" };
UI_LABELS["tlmap.detail.route"] = { ja: "経路を見る", en: "See route", iyo: "経路を見る" };
UI_LABELS["tlmap.detail.openSite"] = { ja: "サイトを開く", en: "Open site", iyo: "サイトを開く" };
UI_LABELS["tlmap.detail.close"] = { ja: "閉じる", en: "Close", iyo: "閉じる" };
UI_LABELS["tlmap.detail.carWalk"] = {
  // {car} / {walk} replaced at render time.
  ja: "車 約{car}分 / 徒歩 約{walk}分",
  en: "Car ~{car} min / Walk ~{walk} min",
  iyo: "車 約{car}分 / 歩き 約{walk}分",
};

// ---- スポット追加フォーム (TourismLayeredMap) ---------------------------
UI_LABELS["tlmap.add.toggle"] = { ja: "＋スポットを追加", en: "+ Add a spot", iyo: "＋スポットを追加" };
UI_LABELS["tlmap.add.title"] = { ja: "スポットを追加", en: "Add a spot", iyo: "スポットを追加" };
UI_LABELS["tlmap.add.lead"] = {
  ja: "地図に載っていない場所をその場で追加できます（この端末のセッション内で反映）。",
  en: "Add a place that isn't on the map yet (kept for this session on this device).",
  iyo: "地図にない場所をその場で足せるよ（このセッション内で反映）。",
};
UI_LABELS["tlmap.add.name"] = { ja: "名称", en: "Name", iyo: "名称" };
UI_LABELS["tlmap.add.namePlaceholder"] = { ja: "例）道後温泉本館", en: "e.g. Dogo Onsen Honkan", iyo: "例）道後温泉本館" };
UI_LABELS["tlmap.add.category"] = { ja: "カテゴリ", en: "Category", iyo: "カテゴリ" };
UI_LABELS["tlmap.add.lat"] = { ja: "緯度", en: "Latitude", iyo: "緯度" };
UI_LABELS["tlmap.add.lng"] = { ja: "経度", en: "Longitude", iyo: "経度" };
UI_LABELS["tlmap.add.useCurrent"] = { ja: "現在地を使う", en: "Use my location", iyo: "現在地を使う" };
UI_LABELS["tlmap.add.website"] = { ja: "公式サイト（任意）", en: "Website (optional)", iyo: "公式サイト（任意）" };
UI_LABELS["tlmap.add.hours"] = { ja: "営業時間（任意）", en: "Opening hours (optional)", iyo: "営業時間（任意）" };
UI_LABELS["tlmap.add.desc"] = { ja: "紹介文（任意）", en: "Description (optional)", iyo: "紹介文（任意）" };
UI_LABELS["tlmap.add.submit"] = { ja: "追加する", en: "Add", iyo: "追加する" };
UI_LABELS["tlmap.add.cancel"] = { ja: "キャンセル", en: "Cancel", iyo: "キャンセル" };
UI_LABELS["tlmap.add.errorName"] = { ja: "名称を入力してください。", en: "Please enter a name.", iyo: "名称を入れてや。" };
UI_LABELS["tlmap.add.errorLatLng"] = {
  ja: "緯度・経度を正しく入力してください（現在地を使うと自動入力）。",
  en: "Enter a valid latitude/longitude (or use your location).",
  iyo: "緯度・経度をちゃんと入れてや（現在地を使うと自動で入るよ）。",
};
UI_LABELS["tlmap.add.done"] = {
  ja: "「{name}」を追加しました。",
  en: "Added \"{name}\".",
  iyo: "「{name}」を足したよ。",
};
UI_LABELS["tlmap.add.noCurrent"] = { ja: "現在地が取得できません。", en: "Location unavailable.", iyo: "現在地が取れんかった。" };


// ---- AI-first trip recommendations -----------------------------------------
Object.assign(UI_LABELS, {
  "planFirst.title": { ja: "今日の旅、どのテーマにしますか？", en: "Which theme fits today's trip?", iyo: "今日はどのテーマで旅する？" },
  "planFirst.lead": { ja: "まずは大まかなテーマをひとつ選んでください。スポットとルートは次の画面で一緒に作ります。", en: "Choose a broad theme first. You'll pick the stops and build the route next.", iyo: "まず大まかなテーマを選んでや。場所とルートは次で一緒に作るけん。" },
  "planFirst.promise": { ja: "テーマを選んだ後、観光・食事・カフェの順にあなた向けのルートを作ります", en: "After choosing a theme, build your route through sights, food, and optional cafés", iyo: "テーマのあと、観光・ごはん・カフェの順でルートを作るけん" },
  "planFirst.today": { ja: "今日のおすすめ", en: "Today's picks", iyo: "今日のおすすめ" },
  "planFirst.count": { ja: "{count}つの旅", en: "{count} trips", iyo: "{count}つの旅" },
  "planFirst.aiPick": { ja: "AIおすすめ", en: "AI pick", iyo: "AIおすすめ" },
  "planFirst.open": { ja: "プランを開く", en: "Open plan", iyo: "プランを見る" },
  "planFirst.viewDetail": { ja: "テーマを見る", en: "View this theme", iyo: "テーマを見る" },
  "planFirst.footer": { ja: "テーマを決めた後に、行きたいスポットを一つずつ選べます。", en: "After choosing a theme, decide on each place one by one.", iyo: "テーマを決めたら、行きたい場所を一つずつ選べるけん。" },
  "planFirst.back": { ja: "5つのテーマに戻る", en: "Back to the five themes", iyo: "5つのテーマに戻る" },
  "planFirst.reasonTitle": { ja: "AIがこの旅をすすめる理由", en: "Why AI recommends this trip", iyo: "AIがこの旅をすすめる理由" },
  "planFirst.routeTitle": { ja: "旅の流れ", en: "Trip outline", iyo: "旅の流れ" },
  "planFirst.adjustTitle": { ja: "少しだけ、好みに近づける", en: "Make it a little more yours", iyo: "ちょっとだけ、好みに近づける" },
  "planFirst.adjustLead": { ja: "必要なものだけ選んでください。細かな入力は不要です。", en: "Choose only what matters. No detailed form needed.", iyo: "いるもんだけ選んでや。細かい入力はいらんけん。" },
  "planFirst.adjust.shorter": { ja: "もっと短く", en: "Make it shorter", iyo: "もっと短く" },
  "planFirst.adjust.lessWalking": { ja: "歩く距離を減らす", en: "Less walking", iyo: "歩くんを減らす" },
  "planFirst.adjust.moreFood": { ja: "グルメを増やす", en: "More local food", iyo: "うまいもんを増やす" },
  "planFirst.adjust.moreHidden": { ja: "穴場を増やす", en: "More hidden gems", iyo: "穴場を増やす" },
  "planFirst.adjustStatus": { ja: "{count}件の希望を反映して始めます", en: "We'll start with {count} adjustments", iyo: "{count}件の希望を入れて始めるけん" },
  "planFirst.start": { ja: "このテーマでスポットを選ぶ", en: "Choose stops for this theme", iyo: "このテーマで場所を選ぶ" },
  "planFirst.startNote": { ja: "観光スポットから始め、食事やカフェを順番に追加できます。", en: "Start with sights, then add food and optional cafés.", iyo: "観光から始めて、ごはんやカフェも順番に足せるけん。" },
  "planFirst.metaLabel": { ja: "所要時間、移動手段、体力", en: "Duration, transport and activity level", iyo: "時間、移動手段、体力" },
  "planFirst.meta.threeHours": { ja: "約3時間", en: "About 3 hours" },
  "planFirst.meta.fourHours": { ja: "約4時間", en: "About 4 hours" },
  "planFirst.meta.fiveHours": { ja: "約5時間", en: "About 5 hours" },
  "planFirst.meta.halfDay": { ja: "半日", en: "Half day" },
  "planFirst.meta.walk": { ja: "徒歩", en: "Walking" },
  "planFirst.meta.tramWalk": { ja: "路面電車＋徒歩", en: "Tram + walk" },
  "planFirst.meta.trainWalk": { ja: "電車＋徒歩", en: "Train + walk" },
  "planFirst.meta.carWalk": { ja: "車＋徒歩", en: "Car + walk" },
  "planFirst.meta.carBike": { ja: "車または自転車", en: "Car or bike" },
  "planFirst.meta.veryEasy": { ja: "とてもゆったり", en: "Very easy" },
  "planFirst.meta.easy": { ja: "ゆったり", en: "Easy" },
  "planFirst.meta.moderate": { ja: "ふつう", en: "Moderate" },
  "planFirst.meta.active": { ja: "アクティブ", en: "Active" },

  "planFirst.plan.classic.title": { ja: "はじめての松山、王道をいいとこ取り", en: "The best of Matsuyama for first-timers", iyo: "はじめての松山、王道をええとこ取り" },
  "planFirst.plan.classic.summary": { ja: "松山城から道後温泉へ。迷わず楽しめる、愛媛の定番旅。", en: "Matsuyama Castle to Dogo Onsen — an effortless tour of the classics." },
  "planFirst.plan.classic.reason": { ja: "見どころが近くにまとまり、路面電車で移動しやすいので、初めてでも無理なく楽しめます。", en: "The highlights are close together and easy to reach by tram, making this a relaxed first visit." },
  "planFirst.plan.slow.title": { ja: "道後でほどける、温泉とカフェの旅", en: "Unwind in Dogo with onsen and cafés", iyo: "道後でほどける、温泉とカフェの旅" },
  "planFirst.plan.slow.summary": { ja: "予定を詰めすぎず、湯の町をゆっくり歩く癒やしの3時間。", en: "A gentle three hours strolling the onsen town without rushing." },
  "planFirst.plan.slow.reason": { ja: "移動距離が短く、休憩できる場所も多いため、到着日や雨の日にも選びやすい旅です。", en: "Short distances and plenty of breaks make this ideal for arrival days or rainy weather." },
  "planFirst.plan.hidden.title": { ja: "古い町並みで見つける、知らない愛媛", en: "Discover another Ehime in historic Uchiko", iyo: "古い町並みで見つける、知らん愛媛" },
  "planFirst.plan.hidden.summary": { ja: "内子の町並みと手仕事を巡る、静かな発見の旅。", en: "A quiet discovery of Uchiko's townscape and local craft." },
  "planFirst.plan.hidden.reason": { ja: "有名観光地とは違う地域の日常や文化に触れたい人に合う、歩いて楽しめるコースです。", en: "A walkable route for travelers who want local life and culture beyond famous sights." },
  "planFirst.plan.ohenro.title": { ja: "札所とごはんを巡る、はじめてのプチお遍路", en: "A first mini-pilgrimage with local food", iyo: "札所とうまいもんを巡る、はじめてのプチお遍路" },
  "planFirst.plan.ohenro.summary": { ja: "三つの札所と地域の味を、半日で無理なく体験。", en: "Experience three temples and local flavors at an easy half-day pace." },
  "planFirst.plan.ohenro.reason": { ja: "札所だけでなく道中の食も組み合わせ、巡礼が初めてでも地域ごと楽しめる流れにしています。", en: "Temples and food are combined so first-time pilgrims can enjoy the surrounding community too." },
  "planFirst.plan.surprise.title": { ja: "行き先は少しだけ秘密、しまなみ冒険旅", en: "A little mystery on a Shimanami adventure", iyo: "行き先はちょっと秘密、しまなみ冒険旅" },
  "planFirst.plan.surprise.summary": { ja: "橋と海の景色を追いかける、偶然を楽しむアクティブ旅。", en: "An active trip following bridges, sea views and a little serendipity." },
  "planFirst.plan.surprise.reason": { ja: "細かな計画より、その場の景色や発見を楽しみたい人向けに、余白を残した旅です。", en: "This flexible route leaves room for travelers who prefer discoveries over a packed schedule." },

  "planFirst.stop.matsuyamaCastle": { ja: "松山城と城下の眺め", en: "Matsuyama Castle and city views" },
  "planFirst.stop.dogoOnsen": { ja: "道後温泉街を散策", en: "Stroll through Dogo Onsen" },
  "planFirst.stop.localDinner": { ja: "愛媛の郷土料理で締めくくり", en: "Finish with Ehime cuisine" },
  "planFirst.stop.dogoTown": { ja: "道後の路地をのんびり散歩", en: "Slow walk through Dogo's lanes" },
  "planFirst.stop.onsen": { ja: "温泉でひと休み", en: "Pause for an onsen bath" },
  "planFirst.stop.cafe": { ja: "みかんスイーツのカフェ", en: "A café with mikan sweets" },
  "planFirst.stop.uchiko": { ja: "内子の八日市護国地区", en: "Uchiko's historic Yokaichi-Gokoku district" },
  "planFirst.stop.washi": { ja: "地域の手仕事に触れる", en: "Meet local craftsmanship" },
  "planFirst.stop.localCafe": { ja: "古民家カフェで休憩", en: "Rest at a traditional-house café" },
  "planFirst.stop.ishiteji": { ja: "第51番札所 石手寺", en: "Temple 51, Ishiteji" },
  "planFirst.stop.jodoji": { ja: "第49番札所 浄土寺", en: "Temple 49, Jodoji" },
  "planFirst.stop.localLunch": { ja: "札所の近くで地元の昼ごはん", en: "A local lunch near the temples" },
  "planFirst.stop.kurushima": { ja: "来島海峡を見渡す", en: "Look out over the Kurushima Strait" },
  "planFirst.stop.seaside": { ja: "海沿いで小さな寄り道", en: "A small seaside detour" },
  "planFirst.stop.sunset": { ja: "瀬戸内の夕景で締めくくり", en: "Finish with a Setouchi sunset" },
} satisfies LangDict);


// ---- Image-led onboarding and plan reactions -------------------------------
Object.assign(UI_LABELS, {
  "welcome.tagline": {
    ja: "愛媛の「まだ知らない魅力」に出会う旅へ",
    en: "A journey into the Ehime you haven't met yet",
    iyo: "愛媛の、まだ知らん魅力に会いに行こや",
  },
  "welcome.start": {
    ja: "はじめる",
    en: "Start exploring",
    iyo: "はじめよや",
  },
  "welcome.changeLanguage": {
    ja: "言語を変更",
    en: "Change language",
    iyo: "言葉を変える",
  },
  "planFirst.progressLabel": {
    ja: "5つの旅行プランの確認状況",
    en: "Progress through five trip ideas",
    iyo: "5つの旅行プランの確認状況",
  },
  "planFirst.reactionLabel": {
    ja: "この旅行プランへの反応",
    en: "React to this trip idea",
    iyo: "この旅行プラン、どうぞ？",
  },
  "planFirst.skip": { ja: "スキップ", en: "Skip", iyo: "飛ばす" },
  "planFirst.dislike": { ja: "いまいち", en: "Not for me", iyo: "いまいち" },
  "planFirst.like": { ja: "いいね！", en: "Love it!", iyo: "ええね！" },
  "planFirst.backToReview": {
    ja: "プラン確認に戻る",
    en: "Back to plan review",
    iyo: "プラン確認に戻る",
  },
  "planFirst.personalizedTitle": {
    ja: "選んだ旅のテーマ",
    en: "Your chosen trip theme",
    iyo: "選んだ旅のテーマ",
  },
  "planFirst.personalizedLead": {
    ja: "テーマを確認したら、写真付きの候補を仕分けてルートを作ります。",
    en: "Confirm the theme, then sort photo suggestions to build your route.",
    iyo: "テーマを見たら、写真の候補を選んでルートを作るけん。",
  },
  "planFirst.customized": {
    ja: "好みに合わせて調整",
    en: "Tailored for you",
    iyo: "好みに合わせたよ",
  },
  "planFirst.loading": {
    ja: "Bedrock AIが今日のおすすめを考えています…",
    en: "Bedrock AI is preparing today's recommendations…",
    iyo: "Bedrock AIが今日のおすすめを考えよるけん…",
  },
  "planFirst.loadError": {
    ja: "おすすめを生成できませんでした。設定を確認して再試行してください。",
    en: "Recommendations could not be generated. Check the configuration and try again.",
    iyo: "おすすめを作れんかったけん、設定を見てもう一回試してや。",
  },
  "planFirst.retry": { ja: "もう一度生成", en: "Generate again", iyo: "もう一回作る" },
  "planFirst.googleVerified": {
    ja: "Google Mapsの場所情報",
    en: "Place information from Google Maps",
    iyo: "Google Mapsの場所情報",
  },
  "planFirst.openGoogleMaps": {
    ja: "Google Mapsで確認",
    en: "View on Google Maps",
    iyo: "Google Mapsで見る",
  },
  "planFirst.placeUnavailable": {
    ja: "場所情報は現在取得できません。施設名を事前にご確認ください。",
    en: "Place details are currently unavailable. Please verify the venue before visiting.",
    iyo: "場所情報を取れんかったけん、行く前に施設名を確認してや。",
  },
} satisfies LangDict);


// ---- Interactive tourism route builder ------------------------------------
Object.assign(UI_LABELS, {
  "planFirst.themeNextTitle": { ja: "次はスポットを選びます", en: "Next, choose your stops", iyo: "次はスポットを選ぶけん" },
  "planFirst.themeNextLead": { ja: "このテーマに合う観光スポットをAIが提案します。興味あり・なしで仕分けながら、あなただけのルートを作ります。", en: "AI will suggest matching places. Sort them by interest to build your own route.", iyo: "このテーマに合う場所をAIが出すけん、行きたいかどうか選んでルートを作ろや。" },
  "routeBuilder.back": { ja: "テーマ選択に戻る", en: "Back to themes", iyo: "テーマ選びに戻る" },
  "routeBuilder.progress": { ja: "{current} / {total}件", en: "{current} of {total}", iyo: "{current} / {total}件" },
  "routeBuilder.interested": { ja: "興味あり", en: "Interested", iyo: "行ってみたい" },
  "routeBuilder.notInterested": { ja: "興味なし", en: "Not interested", iyo: "今回はええかな" },
  "routeBuilder.swipeHint": { ja: "右へスワイプで興味あり、左で興味なし。ボタンや矢印キーでも選べます。", en: "Swipe right if interested, left if not. Buttons and arrow keys also work.", iyo: "右なら行きたい、左なら今回はなし。ボタンでも選べるけん。" },
  "routeBuilder.kind.sightseeing": { ja: "観光", en: "Sightseeing", iyo: "観光" },
  "routeBuilder.kind.food": { ja: "食事", en: "Food", iyo: "ごはん" },
  "routeBuilder.kind.cafe": { ja: "カフェ", en: "Café", iyo: "カフェ" },
  "routeBuilder.kind.custom": { ja: "リクエスト", en: "Custom", iyo: "リクエスト" },
  "routeBuilder.heading.sightseeing": { ja: "まず、行きたい観光スポットを選びましょう", en: "First, choose places you want to visit", iyo: "まず行きたい場所を選ぼや" },
  "routeBuilder.heading.food": { ja: "ルート周辺の食事スポットです", en: "Food stops near your route", iyo: "ルート近くのごはん処よ" },
  "routeBuilder.heading.cafe": { ja: "ひと休みできる候補です", en: "Places for a café break", iyo: "ひと休みできるところよ" },
  "routeBuilder.heading.custom": { ja: "リクエストに合う候補です", en: "Matches for your request", iyo: "リクエストに合う候補よ" },
  "routeBuilder.lead.sightseeing": { ja: "食事以外の候補を、写真と説明を見ながら仕分けしてください。", en: "Sort non-food places using their photos and short descriptions.", iyo: "ごはん以外の候補を写真を見ながら選んでや。" },
  "routeBuilder.lead.food": { ja: "先ほど選んだルート周辺から提案しています。", en: "These suggestions are near the route you just built.", iyo: "さっきのルート近くから選んどるけん。" },
  "routeBuilder.lead.cafe": { ja: "移動の途中で立ち寄りやすい候補です。", en: "These are convenient stops along the way.", iyo: "移動の途中で寄りやすいところよ。" },
  "routeBuilder.lead.custom": { ja: "気になる候補だけルートへ追加してください。", en: "Add only the matches that interest you.", iyo: "気になるもんだけルートに足してや。" },
  "routeBuilder.loading.sightseeing": { ja: "テーマに合う観光スポットを探しています…", en: "Finding sightseeing spots for your theme…", iyo: "テーマに合う場所を探しよるけん…" },
  "routeBuilder.loading.food": { ja: "ルート周辺の食事スポットを探しています…", en: "Finding food near your route…", iyo: "ルート近くのごはんを探しよるけん…" },
  "routeBuilder.loading.cafe": { ja: "立ち寄りやすいカフェを探しています…", en: "Finding convenient cafés…", iyo: "寄りやすいカフェを探しよるけん…" },
  "routeBuilder.loading.custom": { ja: "リクエストに合う場所を探しています…", en: "Finding places matching your request…", iyo: "希望に合うところを探しよるけん…" },
  "routeBuilder.loadError": { ja: "候補を取得できませんでした。もう一度お試しください。", en: "Candidates could not be loaded. Please try again.", iyo: "候補を取れんかったけん、もう一回試してや。" },
  "routeBuilder.retry": { ja: "もう一度探す", en: "Try again", iyo: "もう一回探す" },
  "routeBuilder.routeTitle": { ja: "現在のルート", en: "Current route", iyo: "今のルート" },
  "routeBuilder.routeLead": { ja: "興味ありを選んだ{count}スポットを道路ルートで表示しています。", en: "Showing a driving route through {count} selected stops.", iyo: "選んだ{count}か所を道路ルートで出しとるよ。" },
  "routeBuilder.mapFallback": { ja: "Google Mapsを読み込めないため、スポット一覧で確認してください。", en: "Google Maps is unavailable; review the stop list instead.", iyo: "地図を読めんけん、下の一覧を見てや。" },
  "routeBuilder.emptyRoute": { ja: "興味ありのスポットがありません。候補をもう一度確認してください。", en: "No interested stops yet. Review the candidates again.", iyo: "行きたい場所がまだないけん、もう一回見てや。" },
  "routeBuilder.reviewAgain": { ja: "候補をもう一度見る", en: "Review again", iyo: "もう一回見る" },
  "routeBuilder.next": { ja: "このルートで次へ", en: "Continue with this route", iyo: "このルートで次へ" },
  "routeBuilder.foodQuestion": { ja: "食事スポットもルートに入れますか？", en: "Add a food stop to the route?", iyo: "ごはん処もルートに入れる？" },
  "routeBuilder.foodQuestionLead": { ja: "選んだ観光ルートの周辺から、立ち寄りやすい飲食店をAIが提案します。", en: "AI can suggest restaurants that fit around your sightseeing route.", iyo: "観光ルートの近くから寄りやすい店をAIが出すけん。" },
  "routeBuilder.findFood": { ja: "食事候補を見る", en: "Show food options", iyo: "ごはん候補を見る" },
  "routeBuilder.cafeQuestion": { ja: "カフェや休憩スポットにも立ち寄りますか？", en: "Would you like a café break?", iyo: "カフェでひと休みする？" },
  "routeBuilder.cafeQuestionLead": { ja: "これは任意です。ルート周辺のカフェやスイーツ店を追加できます。", en: "Optional: add cafés or sweet shops near the route.", iyo: "これは自由よ。ルート近くのカフェを足せるけん。" },
  "routeBuilder.findCafe": { ja: "カフェ候補を見る", en: "Show café options", iyo: "カフェ候補を見る" },
  "routeBuilder.customQuestion": { ja: "ほかに追加したい希望はありますか？", en: "Anything else you want to add?", iyo: "ほかに足したい希望はある？" },
  "routeBuilder.customQuestionLead": { ja: "「海が見える場所」「子どもが遊べる場所」など自由に入力できます。", en: "Try requests such as “ocean views” or “somewhere children can play.”", iyo: "「海が見える」「子どもが遊べる」みたいに自由に入れてや。" },
  "routeBuilder.customPlaceholder": { ja: "例：夕日がきれいな場所", en: "e.g. somewhere with a beautiful sunset", iyo: "例：夕日がきれいな場所" },
  "routeBuilder.findCustom": { ja: "候補を探す", en: "Find places", iyo: "候補を探す" },
  "routeBuilder.skip": { ja: "今回は追加しない", en: "Skip for now", iyo: "今回は足さん" },
  "routeBuilder.finalTag": { ja: "AI最適プラン", en: "AI optimized plan", iyo: "AIおすすめプラン" },
  "routeBuilder.finalTitle": { ja: "選んだ場所から最適プランを作りました", en: "We optimized your selected stops", iyo: "選んだ場所でええプランを作ったよ" },
  "routeBuilder.finalLead": { ja: "AIが移動距離や食事時間を考慮して、訪問順と到着予定時刻を組みました。矢印や削除であとから自由に調整できます。", en: "AI arranged the order and estimated arrival times using your selected stops. You can customize it with the arrows or remove buttons.", iyo: "AIが移動やごはんの時間を考えて順番と時刻を組んだよ。矢印や削除で好きに直せるけん。" },
  "routeBuilder.editTitle": { ja: "立寄先・時刻・順番を調整", en: "Edit stops, times, and order", iyo: "立寄先・時刻・順番を調整" },
  "routeBuilder.planLoading": { ja: "選んだ立寄先からAIが最適プランを作成しています…", en: "AI is optimizing a plan from your selected stops…", iyo: "選んだ立寄先からAIがええプランを作りよるけん…" },
  "routeBuilder.planError": { ja: "AIプランを作成できませんでした。", en: "The AI plan could not be generated.", iyo: "AIプランを作れんかったよ。" },
  "routeBuilder.planFallback": { ja: "現在は概算時刻を表示しています。そのまま編集して旅を始めることもできます。", en: "Estimated fallback times are shown. You can still edit and start this route.", iyo: "今は目安の時刻を出しとるよ。このまま直して始めてもええけん。" },
  "routeBuilder.planRetry": { ja: "AIでもう一度作る", en: "Try AI again", iyo: "AIでもう一回作る" },
  "routeBuilder.reoptimize": { ja: "AIで再最適化", en: "Re-optimize with AI", iyo: "AIでもう一回整える" },
  "routeBuilder.moveUp": { ja: "ひとつ前へ", en: "Move earlier", iyo: "前へ" },
  "routeBuilder.moveDown": { ja: "ひとつ後へ", en: "Move later", iyo: "後へ" },
  "routeBuilder.remove": { ja: "ルートから削除", en: "Remove from route", iyo: "ルートから消す" },
  "routeBuilder.addAlternatives": { ja: "見送った候補を追加", en: "Restore skipped candidates", iyo: "見送った候補を足す" },
  "routeBuilder.addCustom": { ja: "別の希望から候補を探す", en: "Find another kind of place", iyo: "別の希望で探す" },
  "routeBuilder.complete": { ja: "このルートで旅を始める", en: "Start this route", iyo: "このルートで旅を始める" },
  "routeBuilder.myRoute": { ja: "マイルート", en: "My route", iyo: "マイルート" },
} satisfies LangDict);
