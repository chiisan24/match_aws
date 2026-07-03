/**
 * build-slides.mjs — generate the 3 "missing" contest slides as a .pptx that
 * matches the existing deck's look (teal side bands, rounded title box, warm
 * yellow accents):
 *
 *   A. システム全体像            (必須項目① システム全体像)
 *   B. Kiroの活用｜仕様駆動開発   (必須項目③ Kiroの効果的な活用)
 *   C. 使用データと出典          (必須項目③ 県指定データの活用＋出典明記)
 *
 * Run: node scripts/build-slides.mjs  → match-additional-slides.pptx (repo root)
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import PptxGenJS from "pptxgenjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// ---- Palette (approx. of the existing deck) -------------------------------
const TEAL = "5F8A8A";
const TEAL_DK = "3D6B6B";
const INK = "2A2A28";
const YELLOW = "FCE38A";
const YELLOW_SOFT = "FBF3C4";
const ORANGE = "E8963A";
const LIGHT = "EAF3F2";
const LINE = "C9D6D4";
const WHITE = "FFFFFF";

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
const W = 13.333;

/** Common slide chrome: teal side bands + rounded title pill at top. */
function frame(slide, title) {
  slide.background = { color: WHITE };
  // Left / right teal bands.
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: TEAL } });
  slide.addShape(pptx.ShapeType.rect, { x: W - 0.22, y: 0, w: 0.22, h: 7.5, fill: { color: TEAL } });
  // Rounded title box (centered), mimicking the deck.
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 3.67, y: 0.28, w: 6.0, h: 1.0, rectRadius: 0.12,
    fill: { color: WHITE }, line: { color: INK, width: 1.75 },
  });
  slide.addText(title, {
    x: 3.67, y: 0.28, w: 6.0, h: 1.0, align: "center", valign: "middle",
    fontSize: 26, bold: true, color: INK, fontFace: "Meiryo",
  });
}

/** Footer note strip. */
function note(slide, text) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 6.55, w: W - 1.4, h: 0.62, rectRadius: 0.08,
    fill: { color: YELLOW_SOFT }, line: { color: YELLOW, width: 1 },
  });
  slide.addText(text, {
    x: 0.9, y: 6.55, w: W - 1.8, h: 0.62, align: "center", valign: "middle",
    fontSize: 12.5, italic: true, color: TEAL_DK, fontFace: "Meiryo",
  });
}

const T = (opts = {}) => ({ fontFace: "Meiryo", color: INK, ...opts });

// ===========================================================================
// Slide A — システム全体像
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "システム全体像");
  s.addText("スワイプ・会話・地図の3操作を、共通ゲートウェイがAWSの各サービスへつなぎます。", {
    x: 0.7, y: 1.5, w: W - 1.4, h: 0.5, align: "center",
    ...T({ fontSize: 14, color: TEAL_DK, bold: true }),
  });

  const rowY = 2.35;
  const boxH = 1.7;
  // Box 1: user actions
  s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: rowY, w: 3.3, h: boxH, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: TEAL, width: 1.5 } });
  s.addText([
    { text: "ユーザー操作\n", options: { bold: true, fontSize: 16, color: TEAL_DK } },
    { text: "スワイプ / 会話 / 地図", options: { fontSize: 13 } },
  ], { x: 0.7, y: rowY, w: 3.3, h: boxH, align: "center", valign: "middle", ...T() });

  // Arrow 1
  s.addShape(pptx.ShapeType.rightArrow, { x: 4.05, y: rowY + 0.6, w: 0.6, h: 0.5, fill: { color: ORANGE } });

  // Box 2: gateway
  s.addShape(pptx.ShapeType.roundRect, { x: 4.7, y: rowY, w: 3.3, h: boxH, rectRadius: 0.1, fill: { color: YELLOW_SOFT }, line: { color: ORANGE, width: 1.5 } });
  s.addText([
    { text: "共通ゲートウェイ\n", options: { bold: true, fontSize: 16, color: INK } },
    { text: "機能の窓口・ポート抽象", options: { fontSize: 13, color: INK } },
  ], { x: 4.7, y: rowY, w: 3.3, h: boxH, align: "center", valign: "middle", ...T() });

  // Arrow 2
  s.addShape(pptx.ShapeType.rightArrow, { x: 8.05, y: rowY + 0.6, w: 0.6, h: 0.5, fill: { color: ORANGE } });

  // Box 3: AWS services (container + 4 pills)
  s.addShape(pptx.ShapeType.roundRect, { x: 8.7, y: rowY - 0.35, w: 3.93, h: boxH + 0.7, rectRadius: 0.1, fill: { color: WHITE }, line: { color: TEAL, width: 1.5 } });
  s.addText("AWS サービス", { x: 8.7, y: rowY - 0.28, w: 3.93, h: 0.4, align: "center", ...T({ bold: true, fontSize: 14, color: TEAL_DK }) });
  const pills = [
    "Amazon Bedrock（AI・画像）",
    "AWS Lambda（処理）",
    "Amazon DynamoDB（保存）",
    "Amazon Location Service（地図）",
  ];
  pills.forEach((p, i) => {
    const py = rowY + 0.2 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, { x: 8.95, y: py, w: 3.43, h: 0.42, rectRadius: 0.2, fill: { color: LIGHT }, line: { color: LINE, width: 0.75 } });
    s.addText(p, { x: 8.95, y: py, w: 3.43, h: 0.42, align: "center", valign: "middle", ...T({ fontSize: 11.5 }) });
  });

  note(s, "AWS依存はモックに抽象化 — クラウド未接続でも全機能をデモ可能。");
}

// ===========================================================================
// Slide B — Kiroの活用｜仕様駆動開発
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "Kiroの活用");
  s.addText("開発環境「Kiro」で、要件→設計→タスクへ分解し、実装と検証を高速に回しました。", {
    x: 0.7, y: 1.5, w: W - 1.4, h: 0.5, align: "center",
    ...T({ fontSize: 14, color: TEAL_DK, bold: true }),
  });

  const steps = [
    { t: "requirements.md", s: "要件定義" },
    { t: "design.md", s: "設計・プロパティ定義" },
    { t: "tasks.md", s: "実装タスク" },
    { t: "実装＋自動検証", s: "PBT / 型チェック" },
  ];
  const n = steps.length;
  const gap = 0.18;
  const chW = (W - 1.4 - gap * (n - 1)) / n; // total usable width 0.7..W-0.7
  const chY = 2.7;
  const chH = 1.7;
  steps.forEach((st, i) => {
    const x = 0.7 + i * (chW + gap);
    const isLast = i === n - 1;
    s.addShape(pptx.ShapeType.chevron, {
      x, y: chY, w: chW, h: chH, rectRadius: 0,
      fill: { color: isLast ? ORANGE : TEAL }, line: { color: WHITE, width: 1 },
    });
    s.addText([
      { text: st.t + "\n", options: { bold: true, fontSize: 15, color: WHITE } },
      { text: st.s, options: { fontSize: 12, color: "F3F7F6" } },
    ], { x: x + 0.2, y: chY, w: chW - 0.2, h: chH, align: "center", valign: "middle", ...T() });
    s.addText("STEP " + (i + 1), { x, y: chY - 0.4, w: chW, h: 0.35, align: "center", ...T({ bold: true, fontSize: 12, color: TEAL_DK }) });
  });

  // Badges
  const badges = ["AWSはモックに抽象化", "サブエージェントでタスク実装", "要件と実装のズレを自動検知"];
  const bW = 3.9;
  const bGap = 0.2;
  const totalBW = bW * 3 + bGap * 2;
  const startX = (W - totalBW) / 2;
  badges.forEach((b, i) => {
    const x = startX + i * (bW + bGap);
    s.addShape(pptx.ShapeType.roundRect, { x, y: 5.0, w: bW, h: 0.7, rectRadius: 0.35, fill: { color: YELLOW_SOFT }, line: { color: YELLOW, width: 1 } });
    s.addText("✓ " + b, { x, y: 5.0, w: bW, h: 0.7, align: "center", valign: "middle", ...T({ fontSize: 12.5, bold: true, color: INK }) });
  });

  note(s, "リポジトリの .kiro/specs/ehime-tourism-app に requirements / design / tasks が実在します。");
}

// ===========================================================================
// Slide C — 使用データと出典
// ===========================================================================
{
  const s = pptx.addSlide();
  frame(s, "使用データと出典");
  s.addText("愛媛県のオープンデータ等を各レイヤーに反映。出典を明記します。", {
    x: 0.7, y: 1.5, w: W - 1.4, h: 0.5, align: "center",
    ...T({ fontSize: 14, color: TEAL_DK, bold: true }),
  });

  const headOpts = { fill: TEAL, color: WHITE, bold: true, fontSize: 14, align: "center", valign: "middle", fontFace: "Meiryo" };
  const cell = (text, opts = {}) => ({ text, options: { fontFace: "Meiryo", color: INK, fontSize: 12.5, valign: "middle", ...opts } });
  const rows = [
    [cell("データ", headOpts), cell("用途", headOpts), cell("出典（資料巻末に記載）", headOpts)],
    [cell("愛媛県 観光スポット情報"), cell("スワイプ / 重ねるマップ"), cell("愛媛県オープンデータ（URL）")],
    [cell("四国八十八ヶ所 札所（第40〜65番）"), cell("お遍路マップ / 進捗管理"), cell("札所・霊場会 公開情報（URL）")],
    [cell("位置情報・地図タイル"), cell("地図表示"), cell("OpenStreetMap")],
    [cell("スポット / 札所の写真"), cell("カード画像"), cell("Wikimedia Commons ほか（各ファイル出典）")],
  ];
  s.addTable(rows, {
    x: 0.7, y: 2.15, w: W - 1.4, colW: [3.8, 3.6, 4.53],
    rowH: [0.55, 0.75, 0.75, 0.6, 0.75],
    border: { type: "solid", color: LINE, pt: 1 },
    fill: { color: WHITE }, align: "left", valign: "middle",
    autoPage: false,
  });

  note(s, "現在のデモは開発用のモックデータで動作。本番では県指定データへ差し替えます。");
}

const out = join(root, "match-additional-slides.pptx");
await pptx.writeFile({ fileName: out });
console.log("Wrote:", out);
