import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExposureContextPanel } from "../components/ExposureContextPanel";
import type { HdxExposureResult } from "../services/hdx";

const result: HdxExposureResult = {
  healthFacilityCount: 1,
  schoolCount: 1,
  center: { latitude: 41.88, longitude: -87.63, basis: "incident" },
  radiusMiles: 0.7,
  truncated: false,
  facilities: [
    {
      id: "hdx-nodes-1",
      source: "HOT",
      sourceEventId: "hot-osm-nodes-1",
      context: "exposure",
      category: "Exposure",
      type: "Health facility",
      severity: "Minor",
      headline: "Community Clinic",
      description: "Mapped clinic",
      geometry: { type: "Point", latitude: 41.88, longitude: -87.63 },
      startedAt: "2026-07-29T12:00:00Z",
      expiresAt: null,
      updatedAt: "2026-07-29T12:00:00Z",
      url: "https://www.openstreetmap.org/node/1",
      confidence: "Source reported",
      metrics: [{ label: "Distance", value: 0.2, unit: "mi" }],
      raw: {},
    },
    {
      id: "hdx-nodes-2",
      source: "HOT",
      sourceEventId: "hot-osm-nodes-2",
      context: "exposure",
      category: "Exposure",
      type: "School",
      severity: "Minor",
      headline: "Community School",
      description: "Mapped school",
      geometry: { type: "Point", latitude: 41.881, longitude: -87.631 },
      startedAt: "2026-07-29T12:00:00Z",
      expiresAt: null,
      updatedAt: "2026-07-29T12:00:00Z",
      url: "https://www.openstreetmap.org/node/2",
      confidence: "Source reported",
      metrics: [{ label: "Distance", value: 0.3, unit: "mi" }],
      raw: {},
    },
  ],
};

describe("exposure context presentation", () => {
  it("shows facility counts, attribution, map control, and risk boundary", () => {
    const html = renderToStaticMarkup(
      <ExposureContextPanel
        result={result}
        isLoading={false}
        isFetching={false}
        error={null}
        showOnMap={false}
        onShowOnMapChange={() => undefined}
      />
    );

    expect(html).toContain('data-testid="exposure-context"');
    expect(html).toContain("1 health facility and 1 school");
    expect(html).toContain("Community Clinic");
    expect(html).toContain("Show these facilities on the map");
    expect(html).toContain("does not change risk severity or notifications");
    expect(html).toContain("may be incomplete");
    expect(html).toContain("OpenStreetMap contributors");
  });

  it("pluralizes health facilities correctly", () => {
    const html = renderToStaticMarkup(
      <ExposureContextPanel
        result={{ ...result, healthFacilityCount: 2 }}
        isLoading={false}
        isFetching={false}
        error={null}
        showOnMap={false}
        onShowOnMapChange={() => undefined}
      />
    );

    expect(html).toContain("2 health facilities and 1 school");
  });
});
