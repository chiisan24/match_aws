/**
 * Google マップへ送り出す外部リンクの組み立て。
 *
 * 営業時間・レビュー・電話番号は Places の Enterprise ティアに属するため、
 * アプリ側では取得しない。代わりにここで作るリンクへ利用者を送り、Google マップ
 * アプリ（スマホなら OS が自動で開く）側で確認してもらう。つまりこのモジュールは
 * 「取得しなくなった情報への導線」そのもので、リンクが作れないと詳細情報への道が
 * 完全に途切れる。
 *
 * 3 つの作り方を優先順に持つ。いずれも **追加の API 呼び出しを必要としない**
 * ことが要点で、リンクを作るためだけに Places を叩くことは一切しない。
 *
 *  1. `googleMapsUri` — Places のレスポンスに含まれる正規 URL。最も正確。
 *     Pro ティアなので `places.photos` を要求している限り追加費用はかからない。
 *  2. Place ID — 一度でも Places で解決済みなら手元にある。ブラウザの
 *     `localStorage`（写真キャッシュ）に保存してあるので、以後は無料で正確な
 *     リンクを作れる。
 *  3. 名前検索 — Place ID すら無い同梱カタログ専用スポット向けの最後の手段。
 *     一致は保証されないので、他の 2 つが使えないときだけ使う。
 */

/** 「この場所そのもの」を開く形式の基底 URL。 */
const PLACE_BASE_URL = "https://www.google.com/maps/place/";

/** 検索結果を開く形式の基底 URL（Google Maps URLs の `api=1` 形式）。 */
const SEARCH_BASE_URL = "https://www.google.com/maps/search/";

/**
 * `href` に入れて安全な URL かどうか。
 *
 * 素性のはっきりした値しか来ない想定だが、`googleMapsUri` は JSON レスポンス
 * 経由、Place ID は `localStorage` 経由でここに届く。どちらも書き換えられうる
 * 経路なので、`javascript:` のような擬似スキームがリンク先になる余地は塞いでおく。
 */
function isSafeHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Place ID から「その場所を開く」URL を作る。
 *
 * 追加の API 呼び出しは不要。Place ID さえ持っていれば、リンクを作るために
 * Places を叩く必要はない。
 *
 * `place_id:` は Google が定めたリテラルなので、エンコードするのは ID 部分だけ。
 * Place ID は実際には英数字と `-` `_` なので通常は素通りするが、保存値が
 * 書き換えられていてもクエリ構造が壊れないようにしておく。
 */
export function googleMapsUrlForPlaceId(placeId: string): string | undefined {
  const id = placeId.trim();
  if (!id) return undefined;
  return `${PLACE_BASE_URL}?q=place_id:${encodeURIComponent(id)}`;
}

/** 名前で検索する URL。一致は保証されないので最後の手段。 */
export function googleMapsUrlForQuery(query: string): string | undefined {
  const q = query.trim();
  if (!q) return undefined;
  return `${SEARCH_BASE_URL}?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * リンクの材料。呼び出し側が持っているものだけ渡す。
 *
 * `placeId` に渡してよいのは **Places 由来だと分かっている ID だけ**。
 * `RecommendedPlace.id` は Google 由来なら Place ID だが、フォールバック経路では
 * 同梱カタログの id（`spot.id`）が入る。後者を渡すと必ず外れるリンクができるので、
 * 出所が Places だと確定している値以外は渡さないこと。
 */
export interface GoogleMapsLinkSource {
  /** Places のレスポンスに入っていた正規 URL。 */
  googleMapsUri?: string | undefined;
  /** Places 由来だと確定している Place ID。 */
  placeId?: string | undefined;
  /** 上 2 つが無いときに検索に使う文字列（通常はスポット名）。 */
  searchQuery?: string | undefined;
}

/**
 * 使える材料のうち最も正確なものでリンクを作る。作れないときは `undefined`。
 *
 * 呼び出し側は戻り値が `undefined` かどうかでリンクを出すか決められる。材料が
 * 何も無いのにリンクを描いて外れた場所へ送るより、出さないほうがよい。
 */
export function googleMapsUrl(source: GoogleMapsLinkSource): string | undefined {
  const { googleMapsUri, placeId, searchQuery } = source;
  if (googleMapsUri && isSafeHttpUrl(googleMapsUri)) return googleMapsUri;
  if (placeId) {
    const fromId = googleMapsUrlForPlaceId(placeId);
    if (fromId) return fromId;
  }
  if (searchQuery) return googleMapsUrlForQuery(searchQuery);
  return undefined;
}
