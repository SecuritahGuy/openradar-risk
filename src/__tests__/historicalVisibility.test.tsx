import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedExplorer } from "../components/FeedExplorer";
import { MapLayerControls } from "../components/update/MapLayerControls";
import { activeConcernEvents } from "../lib/riskInsights";
import type { RiskEvent } from "../types/riskEvent";

function event(overrides: Partial<RiskEvent>): RiskEvent {
  return {
    id: "event",
    source: "NIFC",
    sourceEventId: "source-event",
    type: "Wildfire",
    category: "Wildfire",
    severity: "Moderate",
    headline: "Current incident",
    description: "Test event",
    geometryType: "Point",
    latitude: 25.76,
    longitude: -80.19,
    polygon: null,
    startedAt: "2026-08-05T12:00:00Z",
    expiresAt: null,
    updatedAt: "2026-08-06T12:00:00Z",
    url: null,
    confidence: "Source reported",
    raw: {},
    ...overrides,
  };
}

describe("historical visibility defaults", () => {
  it("keeps older incidents out of the default Active feed", () => {
    const current = event({ id: "current" });
    const older = event({
      id: "older",
      source: "EONET",
      sourceEventId: "old-eonet",
      headline: "Older wildfire record",
      startedAt: "2026-07-01T12:00:00Z",
      updatedAt: "2026-07-01T12:00:00Z",
    });
    const allEvents = [current, older];
    const activeEvents = activeConcernEvents(
      allEvents,
      new Date("2026-08-06T13:00:00Z").getTime()
    );
    const html = renderToStaticMarkup(
      <FeedExplorer
        events={activeEvents}
        allEvents={allEvents}
        totalEvents={activeEvents.length}
        totalAllEvents={allEvents.length}
        location={null}
        radius={50}
        isFetching={false}
      />
    );

    expect(html).toContain("Current incident");
    expect(html).not.toContain("Older wildfire record");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Expired and older context; not active");
  });

  it("presents historical map markers as an explicit opt-in", () => {
    const html = renderToStaticMarkup(
      <MapLayerControls
        radius={50}
        onRadiusChange={() => undefined}
        weatherOverlay={null}
        showWeatherOverlay={false}
        showHistoricalMapContext={false}
        historicalMapContextAvailable={true}
        weatherLayerMode="temp"
        onToggleWeatherOverlay={() => undefined}
        onToggleHistoricalMapContext={() => undefined}
        onWeatherLayerModeChange={() => undefined}
        weatherOverlayLoading={false}
        weatherOverlayError={null}
      />
    );
    const historyControl = html.slice(html.indexOf("Historical and older incident context") - 120);

    expect(historyControl).not.toContain('checked=""');
    expect(html).toContain("Off by default");
    expect(html).toContain("never affect current risk posture");
  });
});
