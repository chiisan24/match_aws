/**
 * PhotoCredit — the line that names whoever took a photo we are only borrowing.
 *
 * This is a licensing obligation, not a nicety. Wikimedia files are licensed per
 * file, and the CC BY / BY-SA licences most of them carry require the author to
 * be named wherever the image is shown. The app displays name-searched Wikipedia
 * photos on the 巡礼 and ルート提案 cards, so each of those needs this beside it;
 * an image we cannot credit is not displayed at all (see
 * {@link useWikipediaImage}).
 *
 * Kept deliberately primitive — `artist` / `license` / `href` rather than a
 * source-specific object — so the same component can carry a Google Places
 * credit, which is the other place the app shows someone else's photo.
 */

export interface PhotoCreditProps {
  /**
   * Who took it. Omit or pass an empty string for licences that name nobody
   * (public domain), in which case only the licence is shown.
   */
  artist?: string;
  /** Short licence name, shown verbatim (e.g. `CC BY-SA 4.0`). */
  license?: string;
  /** Page carrying the full licence text. The licence name links to it. */
  href?: string;
  /**
   * Pin the credit over the bottom of a `position: relative` photo wrapper
   * instead of letting it flow underneath. For cards where the photo fills the
   * frame and there is no room below it.
   */
  overlay?: boolean;
}

/**
 * Renders `Photo: {artist} / {license}`, dropping either part that is absent.
 *
 * Returns nothing at all when there is neither an author nor a licence to state:
 * an empty "Photo:" label would imply a credit that is not there.
 */
export function PhotoCredit({
  artist,
  license,
  href,
  overlay = false,
}: PhotoCreditProps): JSX.Element | null {
  const who = artist?.trim() ?? "";
  const licence = license?.trim() ?? "";
  if (who.length === 0 && licence.length === 0) return null;

  const className = overlay ? "photo-credit photo-credit--overlay" : "photo-credit";
  const licenceText = href
    ? <a href={href} target="_blank" rel="noreferrer">{licence}</a>
    : licence;

  return (
    <small className={className}>
      Photo:{who ? ` ${who}` : ""}
      {who && licence ? " / " : licence ? " " : ""}
      {licence ? licenceText : null}
    </small>
  );
}
