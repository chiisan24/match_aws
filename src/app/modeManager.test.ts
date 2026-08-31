import { describe, it, expect } from "vitest";

import {
  activeTab,
  createInitialModeState,
  isAppMode,
  otherMode,
  setTab,
  switchMode,
  toggleMode,
  TOURISM_TABS,
} from "./modeManager";

describe("modeManager", () => {
  it("starts in 通常観光モード on each mode's first tab by default", () => {
    const s = createInitialModeState();
    expect(s.current).toBe("tourism");
    expect(s.tabByMode.tourism).toBe("map");
    expect(s.tabByMode.pilgrimage).toBe("home");
    expect(activeTab(s)).toBe("map");
  });

  /**
   * The bottom nav's exact contents, pinned in one place.
   *
   * Two separate claims live here. The order fixes what 発見 sits between
   * (swipe-discovery-game AC 1.1) and, because `createInitialModeState` derives
   * the landing tab from `TOURISM_TABS[0]`, it also fixes that the app still
   * opens on the map rather than the game (AC 1.2).
   *
   * The negative assertions are the regression guard: `chat` and the old
   * four-direction `swipe` screen were deleted deliberately, and adding a tab is
   * exactly the kind of change that would quietly bring them back (AC 12.4).
   */
  it("exposes exactly マップ / 発見 / お気に入り / しおり as the 通常観光モード tabs", () => {
    expect(TOURISM_TABS).toEqual(["map", "discover", "favorites", "shiori"]);
    expect(TOURISM_TABS).not.toContain("chat");
    expect(TOURISM_TABS).not.toContain("swipe");
  });

  it("honours an explicit starting mode", () => {
    expect(createInitialModeState("pilgrimage").current).toBe("pilgrimage");
  });

  it("otherMode flips between the two modes", () => {
    expect(otherMode("tourism")).toBe("pilgrimage");
    expect(otherMode("pilgrimage")).toBe("tourism");
  });

  it("switchMode changes the current mode", () => {
    const s = switchMode(createInitialModeState(), "pilgrimage");
    expect(s.current).toBe("pilgrimage");
  });

  it("switchMode returns the same reference when already on that mode", () => {
    const s = createInitialModeState();
    expect(switchMode(s, "tourism")).toBe(s);
  });

  it("setTab records the active tab for a mode without changing current", () => {
    let s = createInitialModeState();
    s = setTab(s, "tourism", "favorites");
    expect(s.current).toBe("tourism");
    expect(s.tabByMode.tourism).toBe("favorites");
    expect(activeTab(s)).toBe("favorites");
  });

  it("preserves per-mode tabs across a switch round-trip (Req 2.5)", () => {
    // Set distinct tabs in each mode, then toggle away and back.
    let s = createInitialModeState();
    s = setTab(s, "tourism", "shiori");
    s = setTab(s, "pilgrimage", "nokyocho");

    const there = toggleMode(s); // -> pilgrimage
    expect(there.current).toBe("pilgrimage");
    expect(activeTab(there)).toBe("nokyocho");

    const back = toggleMode(there); // -> tourism
    expect(back.current).toBe("tourism");
    expect(back.tabByMode).toEqual(s.tabByMode);
    expect(activeTab(back)).toBe("shiori");
  });

  it("isAppMode guards persisted values", () => {
    expect(isAppMode("tourism")).toBe(true);
    expect(isAppMode("pilgrimage")).toBe(true);
    expect(isAppMode("nope")).toBe(false);
    expect(isAppMode(null)).toBe(false);
  });
});
