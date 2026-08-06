import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignalSummaryPanel } from "../components/update/SignalSummaryPanel";
import type { RiskEvent } from "../types/riskEvent";

function event(overrides: Partial<RiskEvent>): RiskEvent {
  return {
    id: "event-1",
    source: "USGS",
    sourceEventId: "source-1",
    type: "Earthquake",
    category: "Seismic",
    severity: "Minor",
    headline: "Older event",
    description: "Test event",
    geometryType: "Point",
    latitude: 41.8,
    longitude: -87.6,
    polygon: null,
    startedAt: "2020-01-01T00:00:00Z",
    expiresAt: null,
    updatedAt: "2020-01-01T00:00:00Z",
    url: null,
    confidence: "Source reported",
    raw: {},
    ...overrides,
  };
}

function renderSummary(events: {
  earthquakes?: RiskEvent[];
  eonetEvents?: RiskEvent[];
}): string {
  return renderToStaticMarkup(
    <SignalSummaryPanel
      weatherAlerts={[]}
      earthquakes={events.earthquakes ?? []}
      wildfires={[]}
      spcOutlooks={[]}
      spcReports={[]}
      nhcStorms={[]}
      gdacsEvents={[]}
      eonetEvents={events.eonetEvents ?? []}
      emscEvents={[]}
      geonetEvents={[]}
      geonetVolcanoEvents={[]}
      dwdEvents={[]}
      supplementalSignals={[]}
      baselineSignals={[]}
      isFetching={false}
    />
  );
}

describe("current signal summary freshness", () => {
  it("does not describe old seismic or EONET records as current", () => {
    const html = renderSummary({
      earthquakes: [event({})],
      eonetEvents: [event({
        id: "old-eonet",
        source: "EONET",
        sourceEventId: "EONET_1",
        type: "Wildfire",
        category: "Wildfire",
      })],
    });

    expect(html).toContain("No current earthquakes nearby");
    expect(html).toContain("No current NASA EONET events nearby");
    expect(html).not.toContain("1 current earthquake nearby");
    expect(html).not.toContain("1 current NASA EONET event nearby");
  });
});
