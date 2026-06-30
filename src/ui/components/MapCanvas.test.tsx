/**
 * MapCanvas smoke tests (Req 20.1, 20.4).
 *
 * Verifies the two rendering modes without a real WebGL context:
 *  - disabled → mock surface (percentage-positioned pins, no GL layer);
 *  - enabled  → MapLibre GL layer mounts and pin positions come from the map's
 *    geo projection (pixel-positioned).
 *
 * MapLibre is mocked so the test runs under jsdom (no WebGL needed).
 */

import { render, screen, waitFor } from "@testing-library/react";
import type { CSSProperties } from "react";

import { MapCanvas } from "./MapCanvas";

// ---- Mock MapLibre GL (no real WebGL under jsdom) -------------------------
const h = vi.hoisted(() => {
  const project = vi.fn(() => ({ x: 12, y: 34 }));
  const on = vi.fn((evt: string, cb: () => void) => {
    // Fire "load" synchronously so fitBounds + projection run immediately.
    if (evt === "load") cb();
  });
  const fitBounds = vi.fn();
  const jumpTo = vi.fn();
  const remove = vi.fn();
  const resize = vi.fn();
  const mapCtor = vi.fn();
  class FakeMap {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    on = on;
    project = project;
    fitBounds = fitBounds;
    jumpTo = jumpTo;
    remove = remove;
    resize = resize;
    loaded = () => true;
  }
  class FakeLngLatBounds {
    extend = vi.fn();
  }
  return { project, on, fitBounds, remove, mapCtor, FakeMap, FakeLngLatBounds };
});

vi.mock("maplibre-gl", () => ({
  default: { Map: h.FakeMap, LngLatBounds: h.FakeLngLatBounds },
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

interface Item {
  id: string;
  location: { lat: number; lng: number };
}

const ITEMS: Item[] = [
  { id: "a", location: { lat: 33.85, lng: 132.78 } },
  { id: "b", location: { lat: 34.0, lng: 133.0 } },
];

function renderItem(item: Item, style: CSSProperties) {
  return (
    <span data-testid={`pin-${item.id}`} style={style}>
      {item.id}
    </span>
  );
}

describe("MapCanvas", () => {
  beforeEach(() => {
    h.mapCtor.mockClear();
    h.project.mockClear();
  });

  it("renders the mock surface with percentage-positioned pins when disabled", () => {
    render(
      <MapCanvas
        enabled={false}
        className="temple-map__surface"
        testId="temple-map-surface"
        ariaLabel="map"
        items={ITEMS}
        renderItem={renderItem}
      />,
    );

    const surface = screen.getByTestId("temple-map-surface");
    expect(surface).toBeInTheDocument();
    // No real-map GL layer in mock mode.
    expect(surface.querySelector(".map-canvas__gl")).toBeNull();
    // Pins are positioned with percentages.
    const pin = screen.getByTestId("pin-a");
    expect(pin.style.left).toContain("%");
    expect(h.mapCtor).not.toHaveBeenCalled();
  });

  it("mounts the MapLibre layer and projects pins to pixels when enabled", async () => {
    render(
      <MapCanvas
        enabled
        className="temple-map__surface"
        testId="temple-map-surface"
        ariaLabel="map"
        items={ITEMS}
        renderItem={renderItem}
      />,
    );

    const surface = screen.getByTestId("temple-map-surface");
    // The GL container is mounted in real-map mode.
    expect(surface.querySelector(".map-canvas__gl")).not.toBeNull();

    // After the lazy import resolves, the map is created and pins are projected.
    await waitFor(() => expect(h.mapCtor).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.project).toHaveBeenCalled());

    const pin = screen.getByTestId("pin-a");
    expect(pin.style.left).toBe("12px");
    expect(pin.style.top).toBe("34px");
  });
});
