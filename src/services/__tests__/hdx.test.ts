import { afterEach, describe, expect, it, vi } from "vitest";
import { supplementalSignalContributesToCurrentRisk } from "../../lib/supplementalContext";
import type { ResolvedLocation } from "../../types/location";
import type { RiskEvent } from "../../types/riskEvent";
import {
  buildHotExposureRequest,
  fetchHdxExposure,
  resolveExposureCenter,
  type ExposureCenter,
} from "../hdx";

const center: ExposureCenter = {
  latitude: 41.88,
  longitude: -87.63,
  basis: "incident",
};

function event(overrides: Partial<RiskEvent> = {}): RiskEvent {
  return {
    id: "event-1",
    source: "USGS",
    sourceEventId: "source-1",
    type: "Earthquake",
    category: "Seismic",
    severity: "Moderate",
    headline: "Test incident",
    description: "Test incident",
    geometryType: "Point",
    latitude: 41.88,
    longitude: -87.63,
    polygon: null,
    startedAt: "2026-07-29T12:00:00Z",
    expiresAt: null,
    updatedAt: "2026-07-29T12:00:00Z",
    url: null,
    confidence: "Source reported",
    raw: {},
    ...overrides,
  };
}

const location: ResolvedLocation = {
  city: "Chicago",
  state: "IL",
  postalCode: "60601",
  country: "USA",
  latitude: 41.881,
  longitude: -87.629,
  county: "Cook County",
  stateFips: "17",
  countyFips: "031",
};

afterEach(() => vi.restoreAllMocks());

describe("HOT / HDX exposure context", () => {
  it("uses the incident point for point events and searched location for polygons", () => {
    expect(resolveExposureCenter(event(), location)).toEqual(center);
    expect(resolveExposureCenter(event({
      geometryType: "Polygon",
      polygon: [[-87.7, 41.8], [-87.6, 41.8], [-87.6, 41.9]],
    }), location)).toEqual({
      latitude: location.latitude,
      longitude: location.longitude,
      basis: "searched-location",
    });
    expect(resolveExposureCenter(event({
      source: "NWS",
      category: "Weather",
      geometryType: "None",
      latitude: null,
      longitude: null,
      raw: { openRiskScope: { nwsPointMatch: true } },
    }), location)).toEqual({
      latitude: location.latitude,
      longitude: location.longitude,
      basis: "searched-location",
    });
    expect(resolveExposureCenter(event({
      geometryType: "None",
      latitude: null,
      longitude: null,
    }), location)).toBeNull();
  });

  it("builds a bounded anonymous facility query", () => {
    const request = buildHotExposureRequest(center);
    const geometry = request.geometry as { coordinates: number[][][] };
    const ring = geometry.coordinates[0];
    const filters = request.filters as {
      tags: { allGeometry: { joinOr: Record<string, string[]> } };
    };

    expect(request).toMatchObject({
      geometryType: ["point", "polygon"],
      centroid: true,
      useStWithin: true,
    });
    expect(ring).toHaveLength(5);
    expect(filters.tags.allGeometry.joinOr.amenity).toContain("hospital");
    expect(filters.tags.allGeometry.joinOr.amenity).toContain("school");
  });

  it("normalizes, sorts, and exactly filters mapped facilities without making them risk signals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-87.631, 41.881] },
          properties: {
            osm_id: 2,
            osm_type: "nodes",
            name: "Community School",
            amenity: "school",
            healthcare: null,
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-87.6302, 41.8802] },
          properties: {
            osm_id: 1,
            osm_type: "nodes",
            name: "Community Clinic",
            amenity: "clinic",
            healthcare: "clinic",
            operator: "City Health",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-87.65, 41.88] },
          properties: {
            osm_id: 3,
            osm_type: "nodes",
            name: "Outside Radius School",
            amenity: "school",
          },
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await fetchHdxExposure(center);
    const request = fetchMock.mock.calls[0];
    const init = request[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(request[0]).toBe("https://api-prod.raw-data.hotosm.org/v1/snapshot/plain/");
    expect(init.method).toBe("POST");
    expect(body).not.toHaveProperty("accessToken");
    expect(result.healthFacilityCount).toBe(1);
    expect(result.schoolCount).toBe(1);
    expect(result.facilities.map((facility) => facility.headline)).toEqual([
      "Community Clinic",
      "Community School",
    ]);
    expect(result.facilities[0]).toMatchObject({
      id: "hdx-nodes-1",
      context: "exposure",
      source: "HOT",
      type: "Health facility",
      geometry: { type: "Point", latitude: 41.8802, longitude: -87.6302 },
    });
    expect(result.facilities[0].url).toBe("https://www.openstreetmap.org/node/1");
    expect(supplementalSignalContributesToCurrentRisk(result.facilities[0])).toBe(false);
  });
});
