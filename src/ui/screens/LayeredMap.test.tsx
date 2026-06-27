import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildLayerFeatures, MockMapLocationAdapter, MockStorageAdapter } from "../../adapters/mock";
import { EHIME_TEMPLES } from "../../adapters/mock";
import { filterByLayers } from "../../domain/layers";
import type { LayerKind } from "../../domain/types";
import { I18nProvider } from "../../i18n";
import { LayeredMap } from "./LayeredMap";

function renderLayeredMap(): void {
  render(
    <I18nProvider storage={new MockStorageAdapter()} rehydrate={false}>
      <LayeredMap map={new MockMapLocationAdapter()} />
    </I18nProvider>,
  );
}

/** Collect the layer of every currently-rendered pin. */
function renderedLayers(): LayerKind[] {
  return screen
    .queryAllByTestId("layer-pin")
    .map((el) => el.getAttribute("data-layer") as LayerKind);
}

describe("buildLayerFeatures", () => {
  it("produces one お遍路 feature per temple", () => {
    const features = buildLayerFeatures(EHIME_TEMPLES);
    const ohenro = features.filter((f) => f.layer === "ohenro");
    expect(ohenro).toHaveLength(EHIME_TEMPLES.length);
  });

  it("derives restroom features from temples flagged with restrooms", () => {
    const features = buildLayerFeatures(EHIME_TEMPLES);
    const templeRestrooms = features.filter(
      (f) => f.layer === "restroom" && f.id.startsWith("restroom-ehime-"),
    );
    const expected = EHIME_TEMPLES.filter((t) => t.restrooms).length;
    expect(templeRestrooms).toHaveLength(expected);
  });

  it("includes mock features for every layer kind", () => {
    const features = buildLayerFeatures(EHIME_TEMPLES);
    const kinds = new Set(features.map((f) => f.layer));
    for (const k of ["ohenro", "restroom", "rest_area", "cycling", "gourmet", "disaster"]) {
      expect(kinds.has(k as LayerKind)).toBe(true);
    }
  });

  it("does not mutate the input temples", () => {
    const snapshot = JSON.stringify(EHIME_TEMPLES);
    buildLayerFeatures(EHIME_TEMPLES);
    expect(JSON.stringify(EHIME_TEMPLES)).toBe(snapshot);
  });
});

describe("LayeredMap", () => {
  it("shows the basic MVP layers overlaid by default (Req 14.1, 14.6)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));

    const layers = new Set(renderedLayers());
    expect(layers.has("ohenro")).toBe(true);
    expect(layers.has("restroom")).toBe(true);
    expect(layers.has("rest_area")).toBe(true);
    // Post-MVP layers are off by default.
    expect(layers.has("cycling")).toBe(false);
  });

  it("renders exactly the active layers' features — filterByLayers parity (Property 25)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));

    const expected = filterByLayers(buildLayerFeatures(EHIME_TEMPLES), [
      "ohenro",
      "restroom",
      "rest_area",
    ]);
    expect(screen.getAllByTestId("layer-pin")).toHaveLength(expected.length);
  });

  it("removes a layer's features when its toggle is deselected (Req 14.2)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));
    expect(renderedLayers()).toContain("restroom");

    const restroomToggle = screen.getByTestId("layer-toggle-restroom");
    await userEvent.click(within(restroomToggle).getByRole("checkbox"));

    await waitFor(() => expect(renderedLayers()).not.toContain("restroom"));
    // Other layers remain.
    expect(renderedLayers()).toContain("ohenro");
  });

  it("overlays an additional layer when selected (Req 14.3)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));
    expect(renderedLayers()).not.toContain("cycling");

    const cyclingToggle = screen.getByTestId("layer-toggle-cycling");
    await userEvent.click(within(cyclingToggle).getByRole("checkbox"));

    await waitFor(() => expect(renderedLayers()).toContain("cycling"));
    // Existing layers are still shown alongside it.
    expect(renderedLayers()).toContain("ohenro");
  });

  it("draws hazard zones when the disaster layer is active (Req 14.5)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));
    expect(screen.queryAllByTestId("hazard-zone")).toHaveLength(0);

    const disasterToggle = screen.getByTestId("layer-toggle-disaster");
    await userEvent.click(within(disasterToggle).getByRole("checkbox"));

    await waitFor(() =>
      expect(screen.getAllByTestId("hazard-zone").length).toBeGreaterThan(0),
    );
  });

  it("presents cross-attribute touring candidates for a purpose preset (Req 14.4)", async () => {
    renderLayeredMap();
    await waitFor(() => expect(screen.getAllByTestId("layer-pin").length).toBeGreaterThan(0));

    // Activate the cycling & gourmet purpose, which combines several layers.
    await userEvent.click(
      screen.getByRole("button", { name: "サイクリング＆グルメ" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("touring-candidates")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("touring-candidate").length).toBeGreaterThan(0);
  });
});
