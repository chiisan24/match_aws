/**
 * Tests for the {@link DiscoveryScreen} — the 発見 tab.
 *
 * The pure parts are already fixed exhaustively elsewhere: the deck order, the
 * achievement rate and the badges in `src/domain/discovery.test.ts`, the photo
 * cache in `src/domain/photoCache.test.ts`. What is left, and what this file
 * covers, is whether the screen calls them at the right moments and honours the
 * two rules that cost real money or real trust:
 *
 *  - 「興味あり」 writes to お気に入り and nothing else; 「興味なし」 writes nowhere
 *    (AC 9.1, 9.4, 9.5, 12.10);
 *  - a spot is looked up **once**, and every failure mode falls back to a bundled
 *    image while leaving the card usable (AC 7.3, 8.2-8.5, 12.11, 12.13).
 *
 * Everything is driven through the rendered UI — buttons, keyboard, `pointerup`
 * — because the wiring is only correct if it is reachable that way (AC 12.14).
 * The store is read back through a probe mounted under the same providers,
 * following the shape used by `TourismRouteBuilder.test.tsx`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DiscoveryProvider } from "../../app/DiscoveryContext";
import { SpotProvider } from "../../app/SpotContext";
// The photo resolver reads `awsEnv.apiEndpoint` at call time. Mocking the module
// once for the whole file — rather than re-importing the screen per test — keeps
// a single module graph, so the providers rendered here and the screen under test
// share the same React contexts. `vi.hoisted` is needed because `vi.mock`
// factories run before the rest of the module body.
const envMock = vi.hoisted(() => ({
  apiEndpoint: undefined as string | undefined,
  googleMapsBrowserApiKey: undefined as string | undefined,
  googleMapsMapId: undefined as string | undefined,
  region: undefined as string | undefined,
  identityPoolId: undefined as string | undefined,
  locationMapName: undefined as string | undefined,
  locationPlaceIndex: undefined as string | undefined,
  mapEnabled: false,
  mapStyleUrl: undefined as string | undefined,
  spotAdminToken: undefined as string | undefined,
  forceMock: false,
  hasAwsConfig: false,
}));
vi.mock("../../config/env", () => ({
  awsEnv: envMock,
  readAwsEnv: () => envMock,
}));
import {
  TourismProvider,
  useTourism,
  type TourismContextValue,
} from "../../app/TourismContext";
import { resolveLabel } from "../../domain/i18n";
import type {
  LangCode,
  NewSpotInput,
  OfflineEntry,
  Spot,
  StorageKey,
} from "../../domain/types";
import { I18nProvider, UI_LABELS } from "../../i18n";
import type { SpotPort, StoragePort } from "../../ports";
import { DiscoveryScreen } from "./DiscoveryScreen";

const LANG: LangCode = "ja";

/**
 * `I18nProvider` requires a `StoragePort`, but with `rehydrate={false}` it never
 * reads and never changes the language, so it never writes either. Persistence
 * has its own tests; this keeps it out of a file about the screen.
 */
const NOOP_STORAGE: StoragePort = {
  load: async <T,>(_key: StorageKey): Promise<T | null> => null,
  save: async <T,>(_key: StorageKey, _value: T): Promise<void> => undefined,
  enqueueOffline: async (_entry: OfflineEntry): Promise<void> => undefined,
  flushOffline: async (): Promise<OfflineEntry[]> => [],
};

/** Resolve a label the same way the screen does, so queries match the UI. */
function label(key: string): string {
  return resolveLabel(UI_LABELS, LANG, key);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function spot(id: string, name: string, category: Spot["category"] = "sightseeing"): Spot {
  return {
    id,
    name,
    category,
    location: { lat: 33.84, lng: 132.76 },
    localizedDescriptions: { ja: `${name}の説明` },
    reviews: [],
    imageUrls: [],
  };
}

const CATALOGUE: Spot[] = [
  spot("s-1", "松山城"),
  spot("s-2", "道後温泉本館", "onsen"),
  spot("s-3", "内子座"),
];

/** A SpotPort serving a fixed catalogue; `addSpot` is never used here. */
function fakeSpotPort(catalogue: Spot[]): SpotPort {
  return {
    listSpots: async () => catalogue,
    addSpot: async (input: NewSpotInput) => spot("added", input.name),
  };
}

/** Reads the tourism store so assertions can see お気に入り / しおり. */
let store: TourismContextValue | null = null;
function StoreProbe(): null {
  store = useTourism();
  return null;
}

/**
 * Mount the screen with real providers.
 *
 * No `StoragePort` is injected: persistence has its own tests, and leaving it
 * out keeps these cases about the screen. `waitFor` covers the catalogue's
 * asynchronous load, so every test starts with a card on screen.
 */
async function mountScreen(catalogue: Spot[] = CATALOGUE): Promise<void> {
  render(
    <I18nProvider storage={NOOP_STORAGE} initialLang={LANG} rehydrate={false}>
      <SpotProvider spots={fakeSpotPort(catalogue)}>
        <TourismProvider>
          <DiscoveryProvider>
            <StoreProbe />
            <DiscoveryScreen />
          </DiscoveryProvider>
        </TourismProvider>
      </SpotProvider>
    </I18nProvider>,
  );
  if (catalogue.length > 0) {
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeInTheDocument());
  }
}

/** The name currently shown on the top card. */
function currentCardName(): string {
  return screen.getByTestId("discover-card").getAttribute("aria-label") ?? "";
}

afterEach(() => {
  cleanup();
  store = null;
  // Back to "no backend configured" — the default the app has in local dev, and
  // the state the last describe below depends on.
  envMock.apiEndpoint = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

describe("DiscoveryScreen decisions", () => {
  it("adds the spot to お気に入り on 興味あり and advances (AC 9.1, 12.10)", async () => {
    const user = userEvent.setup();
    await mountScreen();

    const first = currentCardName();
    await user.click(screen.getByRole("button", { name: label("discover.interested") }));

    await waitFor(() => expect(store?.favorites.map((s) => s.name)).toEqual([first]));
    // しおり must not be touched — only お気に入り (AC 9.5).
    expect(store?.shiori).toEqual([]);
    // The deck moved on (AC 2.10).
    await waitFor(() => expect(currentCardName()).not.toBe(first));
  });

  it("leaves お気に入り untouched on 興味なし (AC 9.4, 12.10)", async () => {
    const user = userEvent.setup();
    await mountScreen();

    const first = currentCardName();
    await user.click(screen.getByRole("button", { name: label("discover.skip") }));

    await waitFor(() => expect(currentCardName()).not.toBe(first));
    expect(store?.favorites).toEqual([]);
    expect(store?.shiori).toEqual([]);
  });

  it("decides with ArrowRight and ArrowLeft on the focused card (AC 2.5, 2.8, 12.14)", async () => {
    const user = userEvent.setup();
    await mountScreen();

    const first = currentCardName();
    screen.getByTestId("discover-card").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(store?.favorites.map((s) => s.name)).toEqual([first]));

    const second = currentCardName();
    screen.getByTestId("discover-card").focus();
    await user.keyboard("{ArrowLeft}");
    // Skipped, so お気に入り still holds only the first card.
    await waitFor(() => expect(currentCardName()).not.toBe(second));
    expect(store?.favorites.map((s) => s.name)).toEqual([first]);
  });

  /**
   * The 80px threshold, from both sides.
   *
   * A short drag has to snap back and decide nothing (AC 2.9) — without that, a
   * scroll gesture that wobbles horizontally would silently favourite places.
   */
  it("commits past 80px and snaps back below it (AC 2.4, 2.7, 2.9)", async () => {
    await mountScreen();
    const card = screen.getByTestId("discover-card");
    const first = currentCardName();

    fireEvent.pointerDown(card, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 40, pointerId: 1 });
    expect(currentCardName()).toBe(first);
    expect(store?.favorites).toEqual([]);

    fireEvent.pointerDown(card, { clientX: 0, pointerId: 2 });
    fireEvent.pointerMove(card, { clientX: 120, pointerId: 2 });
    fireEvent.pointerUp(card, { clientX: 120, pointerId: 2 });
    await waitFor(() => expect(store?.favorites.map((s) => s.name)).toEqual([first]));
  });

  it("never records the same spot twice in お気に入り (AC 9.3)", async () => {
    const user = userEvent.setup();
    // A single-spot catalogue, so 「もう一度見る」 brings the same card back.
    await mountScreen([spot("only", "面河渓")]);

    await user.click(screen.getByRole("button", { name: label("discover.interested") }));
    await waitFor(() => expect(screen.getByTestId("discover-done")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: label("discover.again") }));
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: label("discover.interested") }));

    await waitFor(() => expect(screen.getByTestId("discover-done")).toBeInTheDocument());
    expect(store?.favorites.map((s) => s.id)).toEqual(["only"]);
  });
});

// ---------------------------------------------------------------------------
// Progress & completion
// ---------------------------------------------------------------------------

describe("DiscoveryScreen progress", () => {
  it("shows the gauge and updates it as decisions are made (AC 4.1, 4.13)", async () => {
    const user = userEvent.setup();
    await mountScreen();

    const gauge = screen.getByRole("progressbar", { name: label("discover.gaugeLabel") });
    expect(gauge).toHaveAttribute("aria-valuenow", "0");

    await user.click(screen.getByRole("button", { name: label("discover.skip") }));
    // 1 of 3 → 33 (floored).
    await waitFor(() => expect(gauge).toHaveAttribute("aria-valuenow", "33"));
  });

  it("announces completion and replays without clearing the record (AC 5.1, 5.3, 5.4)", async () => {
    const user = userEvent.setup();
    await mountScreen();

    for (let index = 0; index < CATALOGUE.length; index += 1) {
      await user.click(screen.getByRole("button", { name: label("discover.skip") }));
    }

    await waitFor(() => expect(screen.getByTestId("discover-done")).toBeInTheDocument());
    expect(screen.getByText(label("discover.complete"))).toBeInTheDocument();
    const gauge = screen.getByRole("progressbar", { name: label("discover.gaugeLabel") });
    expect(gauge).toHaveAttribute("aria-valuenow", "100");

    await user.click(screen.getByRole("button", { name: label("discover.again") }));
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeInTheDocument());
    // The record survives the replay, so the rate stays at 100 (AC 5.2, 5.4).
    expect(
      screen.getByRole("progressbar", { name: label("discover.gaugeLabel") }),
    ).toHaveAttribute("aria-valuenow", "100");
  });

  it("marks a badge earned once its whole group is decided (AC 4.7)", async () => {
    const user = userEvent.setup();
    // One 温泉 spot, so a single decision completes that category.
    await mountScreen([spot("o-1", "道後温泉本館", "onsen")]);

    const badge = screen.getByTestId("discover-badge-category:onsen");
    expect(badge.textContent).toContain("0 / 1");

    await user.click(screen.getByRole("button", { name: label("discover.interested") }));
    await waitFor(() =>
      expect(screen.getByTestId("discover-badge-category:onsen").textContent)
        .toContain(label("discover.badgeEarned")),
    );
  });

  it("explains itself when the catalogue is empty (AC 3.7)", async () => {
    await mountScreen([]);
    await waitFor(() =>
      expect(screen.getByTestId("discover-empty")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("discover-card")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * The photo path only runs when `apiEndpoint` is set, so these tests set it on
 * the file-wide `awsEnv` mock and stub `fetch` so nothing leaves the process.
 */
describe("DiscoveryScreen photos", () => {
  /** Mount with `awsEnv.apiEndpoint` set and a scripted `fetch`. */
  async function mountWithEndpoint(
    fetchImpl: (url: string) => Promise<Response>,
    catalogue: Spot[] = CATALOGUE,
  ): Promise<{ calls: string[] }> {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: unknown) => {
      calls.push(String(url));
      return fetchImpl(String(url));
    });
    // Flip the shared mock instead of re-importing the module: the screen and the
    // providers must stay in one module graph or the React contexts diverge.
    // `afterEach` puts it back to `undefined`.
    envMock.apiEndpoint = "/api/";
    render(
      <I18nProvider storage={NOOP_STORAGE} initialLang={LANG} rehydrate={false}>
        <SpotProvider spots={fakeSpotPort(catalogue)}>
          <TourismProvider>
            <DiscoveryProvider>
              <StoreProbe />
              <DiscoveryScreen />
            </DiscoveryProvider>
          </TourismProvider>
        </SpotProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeInTheDocument());
    return { calls };
  }

  /** A JSON response with the given status. */
  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("requests only the current card and the next one (AC 6.2)", async () => {
    const { calls } = await mountWithEndpoint(async () =>
      jsonResponse(200, { place: { photoUrl: "/api/places/photo?name=x" } }),
    );
    // Three spots in the catalogue, but only two are ever asked for.
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls.every((url) => url === "/api/places/lookup")).toBe(true);
  });

  it("shows the Places photo and its attribution inside the card (AC 6.3, 6.5)", async () => {
    await mountWithEndpoint(async () =>
      jsonResponse(200, {
        place: {
          photoUrl: "/api/places/photo?name=abc",
          photoAttributions: [{ displayName: "Taro", uri: "https://example.test" }],
        },
      }),
    );
    const card = screen.getByTestId("discover-card");
    await waitFor(() =>
      expect(card.querySelector("img")?.getAttribute("src")).toBe(
        "/api/places/photo?name=abc",
      ),
    );
    // Credit rendered in the same card, linked when a uri is present (AC 6.6, 6.7).
    const credit = card.querySelector("a");
    expect(credit).toHaveTextContent("Taro");
    expect(credit).toHaveAttribute("href", "https://example.test");
  });

  it.each([404, 502, 503])(
    "falls back to a bundled image on HTTP %i and keeps the card usable (AC 8.2-8.4, 12.13)",
    async (status) => {
      await mountWithEndpoint(async () => jsonResponse(status, { error: "nope" }));
      const card = screen.getByTestId("discover-card");
      // The bundled fallback, never a Places proxy path.
      await waitFor(() =>
        expect(card.querySelector("img")?.getAttribute("src")).toContain(
          "/images/ehime/",
        ),
      );
      // Name, category and description still render, and the buttons still work.
      expect(card).toHaveTextContent("松山城");
      expect(
        screen.getByRole("button", { name: label("discover.interested") }),
      ).toBeEnabled();
    },
  );

  it("falls back when the request throws (AC 8.5)", async () => {
    await mountWithEndpoint(async () => {
      throw new Error("offline");
    });
    const card = screen.getByTestId("discover-card");
    await waitFor(() =>
      expect(card.querySelector("img")?.getAttribute("src")).toContain("/images/ehime/"),
    );
  });

  it("asks once per spot even after revisiting the card (AC 7.3, 12.11)", async () => {
    const user = userEvent.setup();
    const { calls } = await mountWithEndpoint(
      async () => jsonResponse(200, { place: { photoUrl: "/api/places/photo?name=one" } }),
      [spot("only", "面河渓")],
    );
    await waitFor(() => expect(calls.length).toBe(1));

    // Decide, replay, and land on the same card again.
    await user.click(screen.getByRole("button", { name: label("discover.interested") }));
    await waitFor(() => expect(screen.getByTestId("discover-done")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: label("discover.again") }));
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeInTheDocument());

    // The cache answered — no second billed lookup.
    expect(calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// No endpoint configured
// ---------------------------------------------------------------------------

describe("DiscoveryScreen without an API endpoint", () => {
  it("never calls the lookup and shows bundled images (AC 8.6, 8.7)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: unknown) => {
      calls.push(String(url));
      return Promise.reject(new Error("should not be called"));
    });
    // `awsEnv.apiEndpoint` is undefined under vitest, which is the default the
    // real app also has in local development.
    await mountScreen();

    const card = screen.getByTestId("discover-card");
    expect(card.querySelector("img")?.getAttribute("src")).toContain("/images/ehime/");
    expect(calls).toEqual([]);
  });
});
