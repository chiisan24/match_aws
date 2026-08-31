/**
 * Tests for {@link isConfidentArticleTitle} — the rule that decides whether a
 * Wikipedia photo is trustworthy enough to put on a card.
 *
 * This guard exists because of a specific, user-visible failure: a café called
 * 喫茶ニジ was shown a group photo of strangers. `generator=search` is a full-text
 * search, so a name with no article of its own still returns five articles that
 * merely mention the words, and the old code took the top-ranked one whenever no
 * title matched. Nothing downstream can detect that such a photo is wrong, so the
 * only safe rule is to refuse it.
 *
 * The cases below are split into the two claims that matter:
 *
 *  - real spots keep their photos (a stricter rule that broke 松山城 would be a
 *    regression, not a fix);
 *  - coincidental matches are refused, so the card falls back to a placeholder
 *    carrying the real name.
 */

import { describe, expect, it } from "vitest";

import { isConfidentArticleTitle, plainTextFromHtml } from "./useWikipediaImage";

describe("isConfidentArticleTitle — 採用する", () => {
  it.each([
    // 完全一致。もっとも普通のケース。
    ["松山城", "松山城"],
    ["道後温泉本館", "道後温泉本館"],
    ["内子座", "内子座"],
    // 曖昧さ回避の括弧付き。半角・全角の両方が実際に使われている。
    ["松山城 (伊予国)", "松山城"],
    ["龍光寺 (宇和島市)", "龍光寺"],
    ["城山（松山市）", "城山"],
    // 括弧の前に空白が無い表記。
    ["石手寺(松山市)", "石手寺"],
    // API 側の余分な空白は無視する。
    ["  今治城  ", "今治城"],
  ])("%s は %s の記事として採用する", (title, query) => {
    expect(isConfidentArticleTitle(title, query)).toBe(true);
  });
});

describe("isConfidentArticleTitle — 拒否する", () => {
  // 実際に起きた取り違え。「ニジ」を含む無関係な記事が検索1位に来ていた。
  it("喫茶ニジ に「ニジ」を含む別記事を当てない", () => {
    expect(isConfidentArticleTitle("ニジガクの登場人物", "喫茶ニジ")).toBe(false);
    expect(isConfidentArticleTitle("虹ヶ咲学園スクールアイドル同好会", "喫茶ニジ")).toBe(false);
  });

  it.each([
    // 検索語が記事名の途中に埋まっているだけ。以前の includes 判定はこれを通した。
    ["愛媛県の喫茶店一覧", "喫茶ニジ"],
    ["ことりのいる風景", "ことり"],
    // 記事名のほうが具体的で、検索語が別物の一部になっている。
    ["松山城跡から見た松山市街", "松山城"],
    // 括弧が曖昧さ回避ではなく名前の続きになっている。
    ["丸水 松山店の歴史", "丸水"],
    // 前方一致でも括弧以外の続きは信用しない。
    ["白楽天飯店", "白楽天"],
    // 空の検索語で何かを掴まない。
    ["何かの記事", ""],
    ["何かの記事", "   "],
  ])("%s は %s の記事として採用しない", (title, query) => {
    expect(isConfidentArticleTitle(title, query)).toBe(false);
  });

  // 括弧の中身が入れ子だと曖昧さ回避の形とは言えないので採用しない。
  it("入れ子の括弧は曖昧さ回避と見なさない", () => {
    expect(isConfidentArticleTitle("松山城 ((伊予国))", "松山城")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// クレジット文字列
// ---------------------------------------------------------------------------

/**
 * Wikimedia の `extmetadata.Artist` は素の名前ではなく著者が書いた HTML です。
 * 撮影者名はライセンス上必須の表示なので、そのまま埋め込めば第三者の HTML を
 * 注入することになり、エスケープして出せばタグが利用者の目に入ります。表示前に
 * テキストへ潰すのがこの関数の役目で、実際に Commons が返す形を並べています。
 */
describe("plainTextFromHtml", () => {
  it("リンク付きの撮影者名を名前だけにする", () => {
    expect(
      plainTextFromHtml('<a href="//commons.wikimedia.org/wiki/User:Foo" title="User:Foo">Foo</a>'),
    ).toBe("Foo");
  });

  it("入れ子のマークアップを平坦化して空白を詰める", () => {
    expect(
      plainTextFromHtml(
        '<span class="fn value">\n  <a href="/wiki/User:Bar">Bar</a>\n  （撮影）\n</span>',
      ),
    ).toBe("Bar （撮影）");
  });

  it("実体参照を復号する", () => {
    expect(plainTextFromHtml("Alice &amp; Bob")).toBe("Alice & Bob");
    expect(plainTextFromHtml("&quot;Nobu&quot;")).toBe('"Nobu"');
    expect(plainTextFromHtml("O&#39;Brien")).toBe("O'Brien");
    expect(plainTextFromHtml("a&nbsp;b")).toBe("a b");
  });

  // &amp; を最後に復号しないと、エスケープされた実体が二重に復号されてしまう。
  it("二重復号しない", () => {
    expect(plainTextFromHtml("&amp;lt;tag&amp;gt;")).toBe("&lt;tag&gt;");
  });

  it("タグだけの入力は空文字になる", () => {
    expect(plainTextFromHtml("<span></span>")).toBe("");
    expect(plainTextFromHtml("")).toBe("");
  });
});
