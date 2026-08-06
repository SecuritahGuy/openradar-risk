import { describe, expect, it } from "vitest";
import { canonicalIncidentEvents } from "../incidents";
import {
  buildSignalCorrelations,
  summarizeSourceAgreement,
} from "../signalCorrelation";
import type { RiskEvent } from "../../types/riskEvent";

const NOW = new Date("2026-07-13T12:00:00Z").getTime();

function event(overrides: Partial<RiskEvent>): RiskEvent {
  return {
    id: "evt-1",
    source: "NWS",
    sourceEventId: "source-1",
    type: "Weather Alert",
    category: "Weather",
    severity: "Minor",
    headline: "Test event",
    description: "Test description",
    geometryType: "Point",
    latitude: 41.8781,
    longitude: -87.6298,
    polygon: null,
    startedAt: "2026-07-13T10:00:00Z",
    expiresAt: "2026-07-13T16:00:00Z",
    updatedAt: "2026-07-13T11:00:00Z",
    url: null,
    confidence: "Source reported",
    raw: {},
    ...overrides,
  };
}

describe("signalCorrelation", () => {
  it("uses canonical incident metadata for independent corroboration", () => {
    const incidents = canonicalIncidentEvents([
      event({ id: "nws", source: "NWS", sourceEventId: "nws-1", severity: "Severe" }),
      event({
        id: "spc",
        source: "SPC",
        sourceEventId: "spc-1",
        type: "Tornado Report",
        severity: "Moderate",
        latitude: 41.88,
        longitude: -87.63,
        startedAt: "2026-07-13T10:15:00Z",
      }),
    ]);
    const correlations = buildSignalCorrelations(incidents, NOW);

    expect(correlations).toHaveLength(1);
    expect(correlations[0]).toMatchObject({
      agreement: "corroborated",
      agreementLabel: "Corroborated",
      severity: "Severe",
      sources: ["NWS", "SPC"],
      providerLabels: ["National Weather Service", "Storm Prediction Center"],
      providerCount: 2,
      eventCount: 2,
    });
    expect(correlations[0]?.summary).toContain("independently reported");
  });

  it("does not call unrelated water readings corroborated", () => {
    const incidents = canonicalIncidentEvents([
      event({
        id: "marine",
        source: "COOPS",
        sourceEventId: "marine-1",
        category: "Coastal Water",
        type: "Marine Conditions",
        headline: "Marine conditions: 0.1m waves",
      }),
      event({
        id: "river",
        source: "USGS_WATER",
        sourceEventId: "river-1",
        category: "River Gauge",
        type: "Flood Risk",
        headline: "River discharge normal",
      }),
      event({
        id: "forecast",
        source: "NWPS",
        sourceEventId: "forecast-1",
        category: "River Gauge",
        type: "River Forecast",
        headline: "Action stage forecast",
        latitude: 42.08,
        longitude: -87.83,
      }),
    ]);
    const correlations = buildSignalCorrelations(incidents, NOW);

    expect(correlations).toHaveLength(3);
    expect(correlations.every((signal) => signal.agreement === "single-source")).toBe(true);
    expect(summarizeSourceAgreement(incidents, NOW)).toContain(
      "none are independently corroborated"
    );
  });

  it("recognizes a canonical USGS and EMSC earthquake incident", () => {
    const incidents = canonicalIncidentEvents([
      event({
        id: "usgs",
        source: "USGS",
        sourceEventId: "us-1",
        category: "Seismic",
        type: "Earthquake",
        headline: "M4.8 earthquake",
      }),
      event({
        id: "emsc",
        source: "EMSC",
        sourceEventId: "eu-1",
        category: "Seismic",
        type: "Earthquake",
        headline: "M4.7 earthquake",
        latitude: 41.9,
        longitude: -87.65,
        startedAt: "2026-07-13T10:05:00Z",
      }),
    ]);

    expect(summarizeSourceAgreement(incidents, NOW)).toContain(
      "1 incident is independently corroborated"
    );
  });

  it("identifies an uncorroborated concern without conflating its category", () => {
    const incidents = canonicalIncidentEvents([
      event({
        id: "fire",
        source: "NIFC",
        sourceEventId: "fire-1",
        category: "Wildfire",
        type: "Wildfire",
        headline: "Pine Ridge Fire",
      }),
    ]);

    expect(buildSignalCorrelations(incidents, NOW)[0]).toMatchObject({
      label: "Pine Ridge Fire",
      agreement: "single-source",
      providerLabels: ["National Wildfire Data"],
      eventCount: 1,
    });
    expect(summarizeSourceAgreement(incidents, NOW)).toContain(
      "none is independently corroborated"
    );
  });

  it("does not treat FEMA history as an active agreement concern", () => {
    const femaHistory = event({
      id: "covid-disaster",
      source: "FEMA",
      sourceEventId: "DR-4489-IL",
      type: "COVID-19",
      category: "Disaster",
      severity: "Severe",
      headline: "COVID-19 Pandemic",
      startedAt: "2020-01-20T00:00:00Z",
      updatedAt: "2020-03-26T00:00:00Z",
      expiresAt: "2023-05-11T00:00:00Z",
    });

    expect(buildSignalCorrelations([femaHistory], NOW)).toEqual([]);
    expect(summarizeSourceAgreement([femaHistory], NOW)).toBe(
      "No active hazard incidents are reporting in this radius."
    );
  });
});
