/**
 * Pre-researched static content for the Shikoku 88-temple pilgrimage temples in
 * Ehime (札所 40–65). This is the curated "AI で調査したデータ" persisted as a
 * static file (Req: 到着シートの説明・歴史・見どころ・写真スポットをモックから
 * 実データへ差し替え) so the arrival sheet, map detail and 次の札所ナビ all show
 * real information instead of placeholder text.
 *
 * Keyed by temple number. Any temple without an entry falls back to the mock
 * placeholder text in `adapters/mock/temples.ts`, so the dataset can grow to
 * cover the remaining 四国 88 札所 without code changes.
 *
 * Content is a concise, paraphrased summary of well-established facts about each
 * temple (name/mountain title, honzon 本尊, notable features). It is factual
 * reference material, not verbatim copied text.
 */

export interface TempleDetail {
  /** 説明 — Japanese description shown as the primary text. */
  descriptionJa: string;
  /** 説明 — English description (used for the `en` locale / translation seed). */
  descriptionEn: string;
  /** 歴史 — short history / 縁起 in Japanese. */
  history: string;
  /** 見どころ — notable sights (short labels). */
  highlights: string[];
  /** 写真スポット — recommended photo spots (short labels). */
  photoSpots: string[];
}

export const TEMPLE_DETAILS: Record<number, TempleDetail> = {
  40: {
    descriptionJa:
      "平城山薬師院観自在寺は第40番札所で、本尊は薬師如来。第1番霊山寺から最も遠い位置にあることから「四国霊場の裏関所」とも呼ばれます。弘法大師の開創と伝わり、南予・愛南町の巡礼の要所です。",
    descriptionEn:
      "Temple 40, Kanjizaiji, enshrines Yakushi Nyorai. As the temple farthest from Temple 1, it is known as the 'back checkpoint' of the Shikoku pilgrimage, and is said to have been founded by Kobo Daishi.",
    history:
      "大同年間に弘法大師が平城天皇の勅願により開創したと伝わります。本尊の薬師如来と脇仏は大師が一本の霊木から刻んだとされ、南予地方の信仰を集めてきました。",
    highlights: ["本堂（本尊・薬師如来）", "大師堂", "山門（四国最南端の霊場入口）", "境内の歴史ある石仏群"],
    photoSpots: ["山門前", "本堂前の参道", "宝篋印塔"],
  },
  41: {
    descriptionJa:
      "稲荷山護国院龍光寺は第41番札所で、本尊は十一面観世音菩薩。神仏習合の名残から稲荷社を併せ祀り、地元では「三間のお稲荷さん」として親しまれています。",
    descriptionEn:
      "Temple 41, Ryukoji, enshrines the Eleven-Headed Kannon. A vestige of Shinto-Buddhist syncretism, it stands with an Inari shrine and is fondly known locally as the 'Inari of Mima'.",
    history:
      "弘法大師が稲荷大明神の化身に出会い、その像を刻んで祀ったのが起こりと伝わります。明治の神仏分離までは稲荷神社と一体で、今も鳥居越しに参道が続きます。",
    highlights: ["本堂", "大師堂", "稲荷社と鳥居", "参道の石段"],
    photoSpots: ["鳥居越しの参道", "本堂前"],
  },
  42: {
    descriptionJa:
      "一畑山（一如山）毘盧舎那院仏木寺は第42番札所で、本尊は大日如来。牛馬やペットなど動物の守り仏として信仰され、珍しい茅葺きの鐘楼が残ります。",
    descriptionEn:
      "Temple 42, Butsumokuji, enshrines Dainichi Nyorai. Revered as a guardian of livestock and pets, it is notable for its rare thatched-roof bell tower.",
    history:
      "弘法大師が牛に導かれて霊木を見つけ、大日如来を刻んで堂を建てたと伝わります。古くから家畜安全の祈願所として、農家や動物を飼う人々の信仰を集めてきました。",
    highlights: ["本堂（本尊・大日如来）", "茅葺きの鐘楼", "大師堂", "家畜・ペット供養"],
    photoSpots: ["茅葺き鐘楼", "山門前"],
  },
  43: {
    descriptionJa:
      "源光山円手院明石寺は第43番札所で、本尊は千手観世音菩薩。地元では「あげいしさん」と呼ばれ、宇和盆地を見下ろす緑深い境内が印象的です。",
    descriptionEn:
      "Temple 43, Meisekiji, enshrines the Thousand-Armed Kannon. Known locally as 'Ageishi-san', it sits in a lush precinct overlooking the Uwa basin.",
    history:
      "古代の修験の地に起こり、のちに弘法大師が中興したと伝わります。歴代領主の帰依を受け、山あいの静かな霊場として巡礼者を迎えてきました。",
    highlights: ["本堂", "大師堂", "苔むした参道", "夫婦杉"],
    photoSpots: ["参道の石段", "本堂前"],
  },
  44: {
    descriptionJa:
      "菅生山大覚院大寶寺は第44番札所で、本尊は十一面観世音菩薩。八十八ヶ所のほぼ中間に位置する「中札所」として知られ、久万高原の杉木立に包まれています。",
    descriptionEn:
      "Temple 44, Daihoji, enshrines the Eleven-Headed Kannon. Marking roughly the midpoint of the 88 temples, it stands among the cedar groves of Kuma-kogen.",
    history:
      "百済からの渡来僧が本尊を安置したのが起こりと伝わり、のちに弘法大師が霊場と定めたとされます。標高の高い山中にあり、四国遍路の折り返し点として大切にされてきました。",
    highlights: ["本堂", "大師堂", "巨杉の参道", "中札所の道標"],
    photoSpots: ["杉並木の参道", "山門"],
  },
  45: {
    descriptionJa:
      "海岸山岩屋寺は第45番札所で、本尊は不動明王。切り立った岩壁に堂宇が寄り添う修行の霊場で、国の名勝にも指定される景観を誇ります。",
    descriptionEn:
      "Temple 45, Iwayaji, enshrines Fudo Myoo. A temple of ascetic training built against sheer cliffs, its dramatic scenery is designated a National Place of Scenic Beauty.",
    history:
      "山全体を本尊とする信仰から始まり、弘法大師が修行したと伝わります。本堂まで急な山道と石段が続き、岩窟や梯子が残る険しい行場として知られます。",
    highlights: ["岩壁に建つ本堂", "大師堂", "せり割行場", "山道の石段"],
    photoSpots: ["岩壁と本堂", "参道からの見上げ"],
  },
  46: {
    descriptionJa:
      "医王山養珠院浄瑠璃寺は第46番札所で、本尊は薬師如来。松山市郊外の里に佇み、健康や手足の平癒を願う「仏足石」などの縁起物で知られます。",
    descriptionEn:
      "Temple 46, Joruriji, enshrines Yakushi Nyorai. Set in the outskirts of Matsuyama, it is known for lucky features such as a 'Buddha's footprint' stone for health and healing.",
    history:
      "行基が薬師如来を刻んで開いたと伝わり、のちに弘法大師が再興したとされます。松山近郊の札所群（46〜53番）の入口として、多くの歩き遍路が最初に訪れます。",
    highlights: ["本堂（本尊・薬師如来）", "大師堂", "仏足石", "説法石"],
    photoSpots: ["本堂前", "境内の大木"],
  },
  47: {
    descriptionJa:
      "熊野山妙見院八坂寺は第47番札所で、本尊は阿弥陀如来。修験道ゆかりの古刹で、極楽・地獄を描いた天井絵や色鮮やかな本堂が見どころです。",
    descriptionEn:
      "Temple 47, Yasakaji, enshrines Amida Nyorai. An old temple linked to Shugendo, it features vivid ceiling paintings of paradise and hell and a colorful main hall.",
    history:
      "修験道の行場として開かれ、熊野権現を勧請したと伝わります。弘法大師が再興し、周辺の霊場とともに松山平野の遍路道を形づくってきました。",
    highlights: ["本堂", "大師堂", "極楽・地獄の天井絵", "閻魔堂"],
    photoSpots: ["本堂の彩色", "山門"],
  },
  48: {
    descriptionJa:
      "清滝山安養院西林寺は第48番札所で、本尊は十一面観世音菩薩。周囲より低い土地に本堂が建ち、「罪深き者は落ちる」との言い伝えが残ります。",
    descriptionEn:
      "Temple 48, Sairinji, enshrines the Eleven-Headed Kannon. Its main hall sits on ground lower than its surroundings, giving rise to a legend about the fate of the sinful.",
    history:
      "行基の開創と伝わり、弘法大師が現在地に移したとされます。近くには大師が湧かせたという「杖の淵」の名水があり、地域の人々に親しまれています。",
    highlights: ["本堂", "大師堂", "低地に建つ伽藍", "杖の淵の名水"],
    photoSpots: ["山門前", "本堂前"],
  },
  49: {
    descriptionJa:
      "西林山三蔵院浄土寺は第49番札所で、本尊は釈迦如来。踊り念仏で知られる空也上人ゆかりの寺で、上人の姿を刻んだ像が伝わります。",
    descriptionEn:
      "Temple 49, Jodoji, enshrines Shaka Nyorai. Associated with the wandering monk Kuya, it preserves a statue depicting him.",
    history:
      "行基の開創と伝わり、平安時代に空也上人が滞在して布教したとされます。上人自作と伝わる空也上人立像は国の重要文化財に指定されています。",
    highlights: ["本堂", "大師堂", "空也上人立像", "古い伽藍"],
    photoSpots: ["本堂前", "山門"],
  },
  50: {
    descriptionJa:
      "東山瑠璃光院繁多寺は第50番札所で、本尊は薬師如来。松山市街を見下ろす高台にあり、静かな境内から市内の眺望が広がります。",
    descriptionEn:
      "Temple 50, Hantaji, enshrines Yakushi Nyorai. Set on a rise overlooking Matsuyama, its quiet precinct offers views over the city.",
    history:
      "行基の開創と伝わり、弘法大師が霊場と定めたとされます。歴代天皇や武将の帰依を受け、時宗の一遍上人も学んだと伝わる由緒ある寺です。",
    highlights: ["本堂", "大師堂", "高台からの眺望", "歓喜天堂"],
    photoSpots: ["境内からの市街展望", "本堂前"],
  },
  51: {
    descriptionJa:
      "熊野山虚空蔵院石手寺は第51番札所で、本尊は薬師如来。道後温泉に近い名刹で、国宝の仁王門をはじめ数多くの文化財を有し、衛門三郎の伝説でも知られます。",
    descriptionEn:
      "Temple 51, Ishiteji, enshrines Yakushi Nyorai. A celebrated temple near Dogo Onsen, it boasts many cultural treasures including a National Treasure Nio gate, and is famed for the legend of Emon Saburo.",
    history:
      "行基の開創と伝わり、四国遍路の元祖とされる衛門三郎の再来伝説にちなんで「石手寺」と改めたとされます。鎌倉時代の仁王門は国宝に指定され、参道は多くの参拝者で賑わいます。",
    highlights: ["国宝・仁王門", "本堂", "三重塔", "衛門三郎伝説", "洞窟のマントラ洞"],
    photoSpots: ["仁王門", "三重塔", "参道"],
  },
  52: {
    descriptionJa:
      "瀧雲山護持院太山寺は第52番札所で、本尊は十一面観世音菩薩。国宝に指定された壮大な本堂が建ち、深い森に包まれた荘厳な境内が魅力です。",
    descriptionEn:
      "Temple 52, Taisanji, enshrines the Eleven-Headed Kannon. It features a magnificent main hall designated a National Treasure, set in a solemn, forested precinct.",
    history:
      "豪商が一夜で本堂を建てたという「一夜建立」の伝説が残ります。現在の本堂は鎌倉時代の再建で国宝に指定され、四国屈指の建築として知られています。",
    highlights: ["国宝・本堂", "大師堂", "仁王門", "深い社叢林"],
    photoSpots: ["国宝本堂", "参道の石段"],
  },
  53: {
    descriptionJa:
      "須賀山正智院圓明寺は第53番札所で、本尊は阿弥陀如来。松山北部の集落に建ち、隠れキリシタンの遺物とされる石塔が伝わることで知られます。",
    descriptionEn:
      "Temple 53, Enmyoji, enshrines Amida Nyorai. In a village in northern Matsuyama, it is known for a stone marker said to be a relic of hidden Christians.",
    history:
      "行基の開創と伝わり、のちに現在地へ移されました。境内にはキリシタン石塔や、アメリカ人巡礼者が最古と確認した銅版の納札が残ることで知られます。",
    highlights: ["本堂", "大師堂", "キリシタン石塔", "左甚五郎作と伝わる龍"],
    photoSpots: ["山門", "本堂前"],
  },
  54: {
    descriptionJa:
      "近見山宝鐘院延命寺は第54番札所で、本尊は不動明王。今治市郊外に位置し、火災を乗り越えて守られてきた梵鐘「近見二郎」が伝わります。",
    descriptionEn:
      "Temple 54, Enmeiji, enshrines Fudo Myoo. On the outskirts of Imabari, it preserves the temple bell 'Chikami Jiro', which survived past fires.",
    history:
      "行基の開創と伝わり、弘法大師が再興したとされます。度重なる火災に遭いながらも再建され、今治平野の札所群の入口として親しまれています。",
    highlights: ["本堂", "大師堂", "梵鐘「近見二郎」", "山門"],
    photoSpots: ["山門前", "本堂前"],
  },
  55: {
    descriptionJa:
      "別宮山金剛院光明寺（南光坊）は第55番札所で、本尊は大通智勝如来。四国霊場で唯一「坊」の名を持ち、大三島の大山祇神社ゆかりの由緒ある札所です。",
    descriptionEn:
      "Temple 55, Nankobo, enshrines Daitsuchisho Nyorai. The only temple on the pilgrimage whose name ends in 'bo', it is linked to Oyamazumi Shrine on Omishima.",
    history:
      "大三島の大山祇神社の別宮に付属する坊として今治に移されたのが起こりと伝わります。四国霊場で唯一「坊」を名乗り、本尊も他にない大通智勝如来を祀ります。",
    highlights: ["本堂（本尊・大通智勝如来）", "大師堂", "山門の四天王像", "別宮大山祇神社"],
    photoSpots: ["山門", "本堂前"],
  },
  56: {
    descriptionJa:
      "金輪山勅王院泰山寺は第56番札所で、本尊は地蔵菩薩。弘法大師が氾濫する川を鎮めるために堂を建てたと伝わる、治水ゆかりの札所です。",
    descriptionEn:
      "Temple 56, Taisanji, enshrines Jizo Bosatsu. It is said Kobo Daishi built the hall to quell a flooding river, giving it ties to flood control.",
    history:
      "弘法大師が氾濫を繰り返す蒼社川を治め、地蔵菩薩を刻んで堂を建てたのが起こりと伝わります。境内には大師手植えと伝わる「不忘の松」があります。",
    highlights: ["本堂", "大師堂", "不忘の松", "石垣の上の境内"],
    photoSpots: ["石段の参道", "本堂前"],
  },
  57: {
    descriptionJa:
      "府頭山無量寿院栄福寺は第57番札所で、本尊は阿弥陀如来。神仏習合の趣を残す静かな山寺で、病気平癒の信仰が伝わります。",
    descriptionEn:
      "Temple 57, Eifukuji, enshrines Amida Nyorai. A quiet mountain temple retaining a Shinto-Buddhist atmosphere, it is associated with prayers for healing.",
    history:
      "弘法大師が海の安全を祈って阿弥陀如来を刻んで祀ったのが起こりと伝わります。歩けなかった少年が参拝して歩けるようになったという逸話が残り、健脚祈願でも知られます。",
    highlights: ["本堂", "大師堂", "犬塚池", "健脚祈願の絵馬"],
    photoSpots: ["本堂前", "境内からの眺め"],
  },
  58: {
    descriptionJa:
      "作礼山千光院仙遊寺は第58番札所で、本尊は千手観世音菩薩。作礼山の山頂近くに建ち、今治平野やしまなみ海道を望む絶景で知られます。",
    descriptionEn:
      "Temple 58, Senyuji, enshrines the Thousand-Armed Kannon. Near the summit of Mt. Sarei, it is famed for sweeping views of the Imabari plain and the Shimanami Kaido.",
    history:
      "海から現れた龍女が刻んだと伝わる本尊を祀り、養老年間に阿坊仙人が長く籠ったことが寺名の由来とされます。山上からの眺望は遍路の疲れを癒す絶景として有名です。",
    highlights: ["本堂", "大師堂", "山頂からの大パノラマ", "弘法大師の加持水"],
    photoSpots: ["山門からの参道", "山頂展望"],
  },
  59: {
    descriptionJa:
      "金光山最勝院国分寺（伊予国分寺）は第59番札所で、本尊は薬師如来。奈良時代に諸国に建てられた国分寺の一つで、往時をしのぶ礎石が残ります。",
    descriptionEn:
      "Temple 59, Kokubunji (Iyo Kokubunji), enshrines Yakushi Nyorai. One of the provincial temples founded in the Nara period, it retains foundation stones from ancient times.",
    history:
      "聖武天皇の勅願により建立された伊予国分寺を起源とし、たびたびの兵火で焼失しながら再建されてきました。境内には七重塔の礎石が残り、古代寺院の規模を今に伝えます。",
    highlights: ["本堂", "大師堂", "七重塔の礎石", "握手大師像"],
    photoSpots: ["礎石跡", "本堂前"],
  },
  60: {
    descriptionJa:
      "石鈇山福智院横峰寺は第60番札所で、本尊は大日如来。標高約745mの石鎚山中腹に建つ四国屈指の高所札所で、「遍路ころがし」の難所として知られます。",
    descriptionEn:
      "Temple 60, Yokomineji, enshrines Dainichi Nyorai. Perched around 745 m on the slopes of Mt. Ishizuchi, it is one of the pilgrimage's highest and toughest temples.",
    history:
      "役行者が石鎚山で修行した際に開いたと伝わり、のちに弘法大師が霊場と定めたとされます。石鎚山信仰の拠点で、急峻な山道は歩き遍路の難所として有名です。",
    highlights: ["本堂", "大師堂", "石鎚山の遥拝", "初夏の石楠花"],
    photoSpots: ["山門", "石楠花と本堂"],
  },
  61: {
    descriptionJa:
      "栴檀山教王院香園寺は第61番札所で、本尊は大日如来。安産・子育ての「子安大師」で知られ、大聖堂と呼ばれる近代的な大伽藍が特徴です。",
    descriptionEn:
      "Temple 61, Koonji, enshrines Dainichi Nyorai. Known for the 'Koyasu Daishi' of safe childbirth and child-rearing, it features a modern great hall called the Daiseido.",
    history:
      "弘法大師が難産の婦人を救い、子安の信仰が広まったと伝わります。本堂と大師堂を一つに納めた鉄筋の大聖堂は他に例のない大空間で、多くの参拝者を収容します。",
    highlights: ["大聖堂（本堂・大師堂）", "子安大師", "近代的な大伽藍"],
    photoSpots: ["大聖堂外観", "堂内の大空間"],
  },
  62: {
    descriptionJa:
      "天養山観音院宝寿寺は第62番札所で、本尊は十一面観世音菩薩。伊予国一宮ゆかりの札所で、安産の観音として信仰を集めてきました。",
    descriptionEn:
      "Temple 62, Hojuji, enshrines the Eleven-Headed Kannon. Linked to the first shrine of Iyo Province, it has long been revered as a Kannon of safe childbirth.",
    history:
      "聖武天皇の勅願で伊予国一宮の別当寺として建てられたのが起こりと伝わります。街道沿いのこぢんまりとした境内に、安産祈願の観音信仰が受け継がれています。",
    highlights: ["本堂", "大師堂", "安産の観音", "街道沿いの境内"],
    photoSpots: ["本堂前", "山門"],
  },
  63: {
    descriptionJa:
      "密教山胎蔵院吉祥寺は第63番札所で、本尊は毘沙聞天。八十八ヶ所で唯一毘沙聞天を本尊とし、財福・開運の信仰を集めています。",
    descriptionEn:
      "Temple 63, Kichijoji, enshrines Bishamonten. The only temple among the 88 with Bishamonten as its honzon, it draws prayers for fortune and good luck.",
    history:
      "弘法大師が光を放つ霊木で毘沙聞天を刻んで祀ったのが起こりと伝わります。境内には目を閉じて願いながら通り抜ける「成就石」があり、願掛けの参拝者が絶えません。",
    highlights: ["本堂（本尊・毘沙聞天）", "大師堂", "成就石", "くぐり吉祥天女"],
    photoSpots: ["成就石", "本堂前"],
  },
  64: {
    descriptionJa:
      "石鈇山金色院前神寺は第64番札所で、本尊は阿弥陀如来。石鎚山を神体とする石鎚信仰の総本山で、広大で荘厳な境内を誇ります。",
    descriptionEn:
      "Temple 64, Maegamiji, enshrines Amida Nyorai. The head temple of Mt. Ishizuchi worship, it boasts a vast and solemn precinct.",
    history:
      "役行者が石鎚山で修行して蔵王権現を感得し、開いたと伝わります。石鎚修験の中心として歴代の武将や庶民の信仰を集め、山麓に広い伽藍を構えます。",
    highlights: ["本堂", "大師堂", "御滝行場不動", "石鎚山信仰"],
    photoSpots: ["参道", "本堂前"],
  },
  65: {
    descriptionJa:
      "由霊山慈尊院三角寺は第65番札所で、本尊は十一面観世音菩薩。愛媛最後の札所で、桜の名所として知られ、俳人・小林一茶の句碑も残ります。",
    descriptionEn:
      "Temple 65, Sankakuji, enshrines the Eleven-Headed Kannon. The last temple in Ehime, it is famed for cherry blossoms and preserves a haiku monument to Kobayashi Issa.",
    history:
      "行基の開創と伝わり、弘法大師が三角形の護摩壇を築いて修法したことが寺名の由来とされます。春には山門を彩る桜が見事で、一茶が句に詠んだ名所として知られます。",
    highlights: ["本堂", "大師堂", "山門の桜", "小林一茶の句碑", "三角の護摩壇跡"],
    photoSpots: ["桜と山門", "本堂前"],
  },
};
