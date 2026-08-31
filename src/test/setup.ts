// Vitest global setup.
// Adds jest-dom matchers (toBeInTheDocument, etc.) for component tests added later.
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Pointer events (jsdom only)
// ---------------------------------------------------------------------------
//
// jsdom 25 implements neither `PointerEvent` nor `Element.setPointerCapture`.
// Without them the swipe decks (発見 / ルート提案 / 巡礼) cannot be exercised the way
// they actually ship: `fireEvent.pointerDown` falls back to the bare `Event`
// constructor, which silently drops `clientX`, so a drag reads as a zero-distance
// gesture and every threshold assertion passes for the wrong reason.
//
// `PointerEvent` extends `MouseEvent` — which jsdom does have — so coordinates
// arrive intact. Capture is a no-op: there is no real pointer to retarget, and
// the handlers only call it so a drag survives leaving the element.
//
// The whole block is behind a `window` guard because this file is also loaded for
// the `api/**` tests, which run in the node environment with no DOM at all. The
// class is declared inside the guard so its `extends` clause is never evaluated
// there.
if (typeof window !== "undefined" && typeof window.MouseEvent === "function") {
  if (typeof window.PointerEvent === "undefined") {
    type PointerEventInitLike = MouseEventInit & {
      pointerId?: number;
      pointerType?: string;
      isPrimary?: boolean;
    };

    class PointerEventShim extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      readonly isPrimary: boolean;

      constructor(type: string, init: PointerEventInitLike = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "mouse";
        this.isPrimary = init.isPrimary ?? true;
      }
    }

    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: PointerEventShim,
    });
  }

  if (typeof Element.prototype.setPointerCapture === "undefined") {
    Element.prototype.setPointerCapture = function setPointerCapture(): void {
      /* no capture to take in jsdom */
    };
    Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
      /* no capture to release in jsdom */
    };
    Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
  }
}
