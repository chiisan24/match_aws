/**
 * build-deck.mjs — a full reference deck for the AI contest presentation of
 * the 愛媛県観光AIマッチングアプリ「Match」. Mirrors the existing PDF structure
 * and satisfies the contest's required items (概要 / ユーザー体験 / データ・Kiro
 * 活用 / 効果見込み). Reflects the CURRENT app (重ねるマップ, お遍路マッチ).
 *
 * Run: node scripts/build-deck.mjs → match-full-deck.pptx (repo root)
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import PptxGenJS from "pptxgenjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const TEAL = "5F8A8A";
const TEAL_DK = "3D6B6B";
const INK = "2A2A28";
const YELLOW = "FCE38A";
const YELLOW_SOFT = "FBF3C4";
const ORANGE = "E8963A";
const LIGHT = "EAF3F2";
const LINE = "C9D6D4";
const WHITE = "FFFFFF";
const FONT = "Meiryo";

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
const W = 13.333;
const H = 7.5;
let page = 0;

const T = (o = {}) => ({ fontFace: FONT, color: INK, ...o });

function bands(s) {
  s.background = { color: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: TEAL } });
  s.addShape(pptx.ShapeType.rect, { x: W - 0.22, y: 0, w: 0.22, h: H, fill: { color: TEAL } });
}

function frame(s, title, lead) {
  bands(s);
  s.addShape(pptx.ShapeType.roundRect, {
    x: 3.67, y: 0.28, w: 6.0, h: 0.95, rectRadius: 0.12,
    fill: { color: WHITE }, line: { color: INK, width: 1.75 },
  });
  s.addText(title, { x: 3.67, y: 0.28, w: 6.0, h: 0.95, align: "center", valign: "middle", ...T({ fontSize: 25, bold: true }) });
  if (lead) {
    s.addText(lead, { x: 0.8, y: 1.4, w: W - 1.6, h: 0.55, align: "center", ...T({ fontSize: 14, bold: true, color: TEAL_DK }) });
  }
  page += 1;
  s.addText(String(page), { x: W - 0.7, y: H - 0.5, w: 0.4, h: 0.3, align: "right", ...T({ fontSize: 11, color: TEAL_DK }) });
}

function note(s, text) {
  s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 6.55, w: W - 1.4, h: 0.62, rectRadius: 0.08, fill: { color: YELLOW_SOFT }, line: { color: YELLOW, width: 1 } });
  s.addText(text, { x: 0.9, y: 6.55, w: W - 1.8, h: 0.62, align: "center", valign: "middle", ...T({ fontSize: 12.5, italic: true, color: TEAL_DK }) });
}

// ===========================================================================
// 1. 表紙
// ===========================================================================
{
  const s = pptx.addSlide();
  s.background = { color: "EAF3F2" };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.4, fill: { color: "D9EAE8" } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 1.2, w: W, h: 1.2, fill: { color: YELLOW_SOFT } });
  // Inner white card
  s.addShape(pptx.ShapeType.rect, { x: 1.0, y: 0.9, w: W - 2.0, h: H - 1.9, fill: { color: WHITE }, line: { color: INK, width: 1.5 } });
  s.addShape(pptx.ShapeType.rect, { x: 1.3, y: 0.55, w: 1.6, h: 1.0, fill: { color: TEAL } });
  s.addText("2026年\n発表版", { x: 1.3, y: 0.55, w: 1.6, h: 1.0, align: "center", valign: "middle", ...T({ fontSize: 12, bold: true, color: WHITE }) });

  s.addText("AIで出会う、愛媛の旅。スワイプして、あなただけの旅をデザイン 🍊", {
    x: 1.5, y: 1.6, w: W - 3.0, h: 0.7, align: "center", ...T({ fontSize: 17, bold: true, color: TEAL_DK }),
  });
  s.addText("愛媛県観光AI\nマッチングアプリ「Match」", {
    x: 1.5, y: 2.5, w: W - 3.0, h: 2.0, align: "center", valign: "middle", ...T({ fontSize: 40, bold: true }),
  });
  s.addText([
    { text: "選んだテーマ　重ねるマップ\n", options: { fontSize: 16, bold: true, color: INK } },
    { text: "発表者：Match｜人間環境大学", options: { fontSize: 15, color: INK } },
  ], { x: 1.5, y: 4.7, w: W - 3.0, h: 1.2, align: "center", ...T() });
}

// ===========================================================================
// 2. 課題
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "ターゲットユーザーと課題");
  const items = [
    "SNSに頼ると情報が分散して二度手間になる",
    "愛媛県内で遊べる場所を簡単に探したい",
    "多い観光地の中から選ぶのが大変",
    "「愛媛の魅力」を一か所にまとめて発信したい",
  ];
  items.forEach((it, i) => {
    const y = 2.0 + i * 1.0;
    const inset = i * 0.6;
    s.addShape(pptx.ShapeType.rect, { x: 1.2 + inset, y, w: W - 2.4 - inset * 2, h: 0.75, fill: { color: WHITE }, line: { color: INK, width: 1.25 } });
    s.addText(it, { x: 1.2 + inset, y, w: W - 2.4 - inset * 2, h: 0.75, align: "center", valign: "middle", ...T({ fontSize: 17, bold: true }) });
  });
  note(s, "「探す側の分かりにくさ」と「伝える側の届きにくさ」を同時に解く。");
}

// ===========================================================================
// 3. Matchとは？
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "「Match」とは？");
  s.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 1.7, w: W - 1.8, h: 4.4, rectRadius: 0.12, fill: { color: LIGHT }, line: { color: TEAL, width: 1.25 } });
  s.addText([
    { text: "「Match」とは、AIとマッチングアプリ風UIを組み合わせた、\n", options: { breakLine: true } },
    { text: "愛媛県の観光地発見＆お遍路サポートアプリ。\n\n", options: { breakLine: true } },
    { text: "スワイプで観光スポットをお気に入り登録し、会話型AIが旅のプランを自動作成。\n\n", options: { breakLine: true } },
    { text: "重ねるマップやお遍路マッチで、旅をもっと楽しく、スマートに。", options: {} },
  ], { x: 1.4, y: 2.1, w: W - 2.8, h: 3.6, valign: "middle", ...T({ fontSize: 20, lineSpacingMultiple: 1.2 }) });
  note(s, "難しい検索は不要。“めくって選ぶ”だけで旅がはじまる。");
}

// ===========================================================================
// 4. 主要機能（できること）
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "「Match」でできること", "AIとマッチングアプリ風UIで、愛媛の旅をもっと楽しく・スマートに！");
  const feats = [
    "スワイプでお気に入り登録",
    "会話型AIで旅プラン自動作成",
    "重ねるマップ（情報レイヤー）",
    "札所マップ（愛媛26札所）",
    "お遍路マッチ（行った/行ってない）",
    "多言語対応（伊予弁ふくむ）",
  ];
  feats.forEach((f, i) => {
    const col = i % 2;
    const rowi = Math.floor(i / 2);
    const x = col === 0 ? 1.1 : 6.9;
    const y = 2.3 + rowi * 1.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.3, h: 0.9, rectRadius: 0.12, fill: { color: WHITE }, line: { color: INK, width: 1.25 } });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.22, y: y + 0.22, w: 0.46, h: 0.46, fill: { color: INK } });
    s.addText("✓", { x: x + 0.22, y: y + 0.22, w: 0.46, h: 0.46, align: "center", valign: "middle", ...T({ fontSize: 15, bold: true, color: WHITE }) });
    s.addText(f, { x: x + 0.85, y, w: 4.3, h: 0.9, valign: "middle", ...T({ fontSize: 16, bold: true }) });
  });
  note(s, "スワイプ感覚で観光地を発見し、AIが旅のプランを自動でつくる。");
}

// ===========================================================================
// 5. 使い方 3STEP
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "使い方はとってもカンタン！", "スワイプするだけで、あなただけの愛媛旅行プランが完成！");
  const steps = [
    { n: "1", t: "スワイプで好みを登録 🍊", d: "気になるスポットや食べ物をスワイプ。みかん狩り・お遍路・絶景など好みをAIが学習。" },
    { n: "2", t: "AIが旅プランを自動作成 ✨", d: "Amazon BedrockのAIが、あなたの好みに合う観光ルートやお遍路プランを提案。" },
    { n: "3", t: "愛媛の旅を思いきり楽しむ 🌊", d: "お遍路マップや進捗管理で旅をサポート。多言語対応で外国の友達とも一緒に。" },
  ];
  steps.forEach((st, i) => {
    const x = 0.9 + i * 4.05;
    s.addShape(pptx.ShapeType.ellipse, { x: x + 1.4, y: 2.1, w: 1.1, h: 1.1, fill: { color: YELLOW } });
    s.addText(st.n, { x: x + 1.4, y: 2.1, w: 1.1, h: 1.1, align: "center", valign: "middle", ...T({ fontSize: 30, bold: true, color: TEAL_DK }) });
    s.addText("STEP", { x: x + 1.4, y: 1.75, w: 1.1, h: 0.3, align: "center", ...T({ fontSize: 12, bold: true, color: TEAL_DK }) });
    s.addText(st.t, { x, y: 3.4, w: 3.9, h: 0.7, align: "center", ...T({ fontSize: 16, bold: true }) });
    s.addText(st.d, { x: x + 0.2, y: 4.1, w: 3.5, h: 1.8, align: "center", ...T({ fontSize: 12.5, color: INK }) });
  });
  note(s, "直感的な操作で、AIが最適な観光スポットやお遍路ルートを自動でマッチング。");
}

// ===========================================================================
// 6. ユーザー体験フロー（4 STEP）
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "ユーザー体験フロー");
  const steps = [
    { t: "アプリ起動", sub: ["会員登録・ログイン", "言語設定", "興味タグ選択"] },
    { t: "スワイプで観光地選択", sub: ["観光地をスワイプ", "お気に入り登録"] },
    { t: "AIプラン作成", sub: ["AIと会話", "旅程自動作成", "ルート最適化"] },
    { t: "お遍路スタート", sub: ["札所マップ", "行った/行ってない", "進捗管理"] },
  ];
  const n = steps.length;
  const gap = 0.18;
  const chW = (W - 1.4 - gap * (n - 1)) / n;
  const chY = 2.2;
  const chH = 1.4;
  steps.forEach((st, i) => {
    const x = 0.7 + i * (chW + gap);
    const last = i === n - 1;
    s.addText("STEP " + (i + 1), { x, y: chY - 0.4, w: chW, h: 0.35, align: "center", ...T({ fontSize: 12, bold: true, color: TEAL_DK }) });
    s.addShape(pptx.ShapeType.chevron, { x, y: chY, w: chW, h: chH, fill: { color: last ? ORANGE : "BFC9C7" }, line: { color: WHITE, width: 1 } });
    s.addText(st.t, { x: x + 0.2, y: chY, w: chW - 0.2, h: chH, align: "center", valign: "middle", ...T({ fontSize: 15, bold: true, color: WHITE }) });
    s.addText(st.sub.map((v) => "・" + v).join("\n"), { x: x + 0.15, y: chY + chH + 0.15, w: chW - 0.15, h: 1.8, ...T({ fontSize: 12, color: INK, lineSpacingMultiple: 1.15 }) });
  });
  note(s, "登録 → スワイプ → AIプラン → お遍路。迷わず一気通貫。");
}

// ===========================================================================
// 7. システム全体像
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "システム全体像", "スワイプ・会話・地図の3操作を、共通ゲートウェイがAWSの各サービスへつなぐ。");
  const rowY = 2.35, boxH = 1.7;
  s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: rowY, w: 3.3, h: boxH, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: TEAL, width: 1.5 } });
  s.addText([{ text: "ユーザー操作\n", options: { bold: true, fontSize: 16, color: TEAL_DK } }, { text: "スワイプ / 会話 / 地図", options: { fontSize: 13 } }], { x: 0.7, y: rowY, w: 3.3, h: boxH, align: "center", valign: "middle", ...T() });
  s.addShape(pptx.ShapeType.rightArrow, { x: 4.05, y: rowY + 0.6, w: 0.6, h: 0.5, fill: { color: ORANGE } });
  s.addShape(pptx.ShapeType.roundRect, { x: 4.7, y: rowY, w: 3.3, h: boxH, rectRadius: 0.1, fill: { color: YELLOW_SOFT }, line: { color: ORANGE, width: 1.5 } });
  s.addText([{ text: "共通ゲートウェイ\n", options: { bold: true, fontSize: 16 } }, { text: "機能の窓口・ポート抽象", options: { fontSize: 13 } }], { x: 4.7, y: rowY, w: 3.3, h: boxH, align: "center", valign: "middle", ...T() });
  s.addShape(pptx.ShapeType.rightArrow, { x: 8.05, y: rowY + 0.6, w: 0.6, h: 0.5, fill: { color: ORANGE } });
  s.addShape(pptx.ShapeType.roundRect, { x: 8.7, y: rowY - 0.35, w: 3.93, h: boxH + 0.7, rectRadius: 0.1, fill: { color: WHITE }, line: { color: TEAL, width: 1.5 } });
  s.addText("AWS サービス", { x: 8.7, y: rowY - 0.28, w: 3.93, h: 0.4, align: "center", ...T({ bold: true, fontSize: 14, color: TEAL_DK }) });
  ["Amazon Bedrock（AI・画像）", "AWS Lambda（処理）", "Amazon DynamoDB（保存）", "Amazon Location Service（地図）"].forEach((p, i) => {
    const py = rowY + 0.2 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, { x: 8.95, y: py, w: 3.43, h: 0.42, rectRadius: 0.2, fill: { color: LIGHT }, line: { color: LINE, width: 0.75 } });
    s.addText(p, { x: 8.95, y: py, w: 3.43, h: 0.42, align: "center", valign: "middle", ...T({ fontSize: 11.5 }) });
  });
  note(s, "AWS依存はモックに抽象化 — クラウド未接続でも全機能をデモ可能。");
}

// ===========================================================================
// 8. 技術スタック
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "使用している技術スタック", "信頼性・拡張性・AI機能を兼ね備えたモダンなアーキテクチャで実現。");
  const svc = ["Amazon\nBedrock", "AWS\nLambda", "Amazon\nDynamoDB", "Amazon\nLocation Service"];
  svc.forEach((v, i) => {
    const x = 0.9 + i * 3.05;
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.35, y: 2.7, w: 2.3, h: 2.3, fill: { color: YELLOW }, line: { color: INK, width: 1.25 } });
    s.addText("✓", { x: x + 0.35, y: 2.9, w: 2.3, h: 0.5, align: "center", ...T({ fontSize: 16, bold: true }) });
    s.addText(v, { x: x + 0.35, y: 3.3, w: 2.3, h: 1.5, align: "center", valign: "middle", ...T({ fontSize: 15, bold: true }) });
  });
  note(s, "AWSのクラウドサービスを活用した最新のAI観光マッチングアプリ。");
}

// ===========================================================================
// 9. 使用データと出典
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "使用データと出典", "愛媛県のオープンデータ等を各レイヤーに反映。出典を明記します。");
  const head = { fill: TEAL, color: WHITE, bold: true, fontSize: 14, align: "center", valign: "middle", fontFace: FONT };
  const c = (t, o = {}) => ({ text: t, options: { fontFace: FONT, color: INK, fontSize: 12.5, valign: "middle", ...o } });
  const rows = [
    [c("データ", head), c("用途", head), c("出典（資料巻末に記載）", head)],
    [c("愛媛県 観光スポット情報"), c("スワイプ / 重ねるマップ"), c("愛媛県オープンデータ（URL）")],
    [c("四国八十八ヶ所 札所（第40〜65番）"), c("お遍路マップ / 進捗管理"), c("霊場会 公開情報（URL）")],
    [c("位置情報・地図タイル"), c("地図表示"), c("OpenStreetMap")],
    [c("スポット / 札所の写真"), c("カード画像"), c("Wikimedia Commons ほか")],
  ];
  s.addTable(rows, { x: 0.7, y: 2.15, w: W - 1.4, colW: [3.8, 3.6, 4.53], rowH: [0.55, 0.75, 0.75, 0.6, 0.75], border: { type: "solid", color: LINE, pt: 1 }, valign: "middle", autoPage: false });
  note(s, "現在のデモは開発用モックデータで動作。本番では県指定データへ差し替えます。");
}

// ===========================================================================
// 10. Kiroの活用
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "Kiroの活用", "開発環境「Kiro」で、要件→設計→タスクへ分解し、実装と検証を高速に。");
  const steps = [
    { t: "requirements.md", d: "要件定義" },
    { t: "design.md", d: "設計・プロパティ定義" },
    { t: "tasks.md", d: "実装タスク" },
    { t: "実装＋自動検証", d: "PBT / 型チェック" },
  ];
  const n = steps.length, gap = 0.18;
  const chW = (W - 1.4 - gap * (n - 1)) / n;
  const chY = 2.7, chH = 1.6;
  steps.forEach((st, i) => {
    const x = 0.7 + i * (chW + gap);
    const last = i === n - 1;
    s.addText("STEP " + (i + 1), { x, y: chY - 0.4, w: chW, h: 0.35, align: "center", ...T({ fontSize: 12, bold: true, color: TEAL_DK }) });
    s.addShape(pptx.ShapeType.chevron, { x, y: chY, w: chW, h: chH, fill: { color: last ? ORANGE : TEAL }, line: { color: WHITE, width: 1 } });
    s.addText([{ text: st.t + "\n", options: { bold: true, fontSize: 15, color: WHITE } }, { text: st.d, options: { fontSize: 12, color: "F3F7F6" } }], { x: x + 0.2, y: chY, w: chW - 0.2, h: chH, align: "center", valign: "middle", ...T() });
  });
  const badges = ["AWSはモックに抽象化", "サブエージェントで実装", "要件と実装のズレを自動検知"];
  const bW = 3.9, bGap = 0.2, totalBW = bW * 3 + bGap * 2, startX = (W - totalBW) / 2;
  badges.forEach((b, i) => {
    const x = startX + i * (bW + bGap);
    s.addShape(pptx.ShapeType.roundRect, { x, y: 5.0, w: bW, h: 0.7, rectRadius: 0.35, fill: { color: YELLOW_SOFT }, line: { color: YELLOW, width: 1 } });
    s.addText("✓ " + b, { x, y: 5.0, w: bW, h: 0.7, align: "center", valign: "middle", ...T({ fontSize: 12.5, bold: true }) });
  });
  note(s, ".kiro/specs/ehime-tourism-app に requirements / design / tasks が実在します。");
}

// ===========================================================================
// 11. 効果（課題対応と成功の目印）
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "課題対応と成功の目印");
  const rows = [
    { n: "1", t: "情報分断の解消と観光周遊促進", d: "分散していた観光情報を一元化し二度手間を解消。「道後温泉だけじゃない愛媛」で県内周遊を促進。" },
    { n: "2", t: "四国遍路の活性化と多様な訪問者", d: "愛媛26札所の情報・進捗管理・お遍路マッチを提供。多言語と使いやすいUIで若年層・外国人にも。" },
    { n: "3", t: "旅行者 約2割の利用目標", d: "愛媛を訪れる旅行者の約2割の利用を成功目標に。愛媛の自然・文化・みかんの魅力を広く発信。" },
  ];
  rows.forEach((r, i) => {
    const y = 1.65 + i * 1.55;
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y, w: W - 1.4, h: 1.4, fill: { color: i % 2 ? WHITE : "F4F7F6" }, line: { color: LINE, width: 0.75 } });
    s.addText(r.n, { x: 0.9, y, w: 1.0, h: 1.4, align: "center", valign: "middle", ...T({ fontSize: 40, bold: true, color: TEAL }) });
    s.addText(r.t, { x: 2.0, y: y + 0.15, w: 3.4, h: 1.1, valign: "middle", ...T({ fontSize: 15, bold: true, color: ORANGE }) });
    s.addText(r.d, { x: 5.5, y: y + 0.1, w: 7.0, h: 1.2, valign: "middle", ...T({ fontSize: 13 }) });
  });
}

// ===========================================================================
// 12. クロージング
// ===========================================================================
{
  const s = pptx.addSlide();
  bands(s);
  s.addShape(pptx.ShapeType.roundRect, { x: 3.67, y: 0.5, w: 6.0, h: 0.95, rectRadius: 0.12, fill: { color: WHITE }, line: { color: INK, width: 1.75 } });
  s.addText("愛媛の魅力を、次の世代へ", { x: 3.67, y: 0.5, w: 6.0, h: 0.95, align: "center", valign: "middle", ...T({ fontSize: 24, bold: true }) });
  s.addText("「Match」は、SNS世代が愛媛をもっと好きになるアプリ", { x: 1.0, y: 1.9, w: W - 2.0, h: 0.7, align: "center", ...T({ fontSize: 20, bold: true, color: TEAL_DK }) });
  s.addText([
    "観光地との出会いを、スワイプひとつで。",
    "AIが、あなただけの旅プランを作ります。",
    "お遍路も、もっと身近に、もっと楽しく。",
    "愛媛の島々、みかんの香り、瀬戸内の青い海。",
    "「Match」で、新しい旅の形を一緒に作りましょう。",
  ].join("\n\n"), { x: 1.5, y: 2.9, w: W - 3.0, h: 3.6, align: "center", valign: "middle", ...T({ fontSize: 18, lineSpacingMultiple: 1.1 }) });
  page += 1;
  s.addText(String(page), { x: W - 0.7, y: H - 0.5, w: 0.4, h: 0.3, align: "right", ...T({ fontSize: 11, color: TEAL_DK }) });
}

const out = join(root, "match-full-deck.pptx");
await pptx.writeFile({ fileName: out });
console.log("Wrote:", out, "slides:", page + 1);
