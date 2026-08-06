import { bboxAround, distanceMiles } from "../lib/geo";
import { readJsonResponse } from "../lib/http";
import type { ResolvedLocation } from "../types/location";
import type { RiskEvent } from "../types/riskEvent";
import type { SupplementalRiskSignal } from "../types/supplementalRisk";

const HOT_RAW_DATA_API = "https://api-prod.raw-data.hotosm.org/v1/snapshot/plain/";

export const HDX_EXPOSURE_RADIUS_MILES = 0.7;
const MAX_FACILITIES = 100;

const HEALTH_AMENITIES = new Set(["clinic", "doctors", "hospital"]);
const EDUCATION_AMENITIES = new Set([
  "college",
  "kindergarten",
  "school",
  "university",
]);

export type ExposureFacilityKind = "Health facility" | "School";

export interface ExposureCenter {
  latitude: number;
  longitude: number;
  basis: "incident" | "searched-location";
}

export interface HdxExposureResult {
  facilities: SupplementalRiskSignal[];
  healthFacilityCount: number;
  schoolCount: number;
  center: ExposureCenter;
  radiusMiles: number;
  truncated: boolean;
}

interface HotFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

interface HotFeatureCollection {
  type?: string;
  features?: HotFeature[];
}

function finiteCoordinate(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function facilityKind(properties: Record<string, unknown>): ExposureFacilityKind | null {
  const amenity = String(properties.amenity ?? "").toLowerCase();
  const healthcare = String(properties.healthcare ?? "").toLowerCase();
  if (healthcare || HEALTH_AMENITIES.has(amenity)) return "Health facility";
  if (EDUCATION_AMENITIES.has(amenity)) return "School";
  return null;
}

function osmUrl(properties: Record<string, unknown>): string {
  const osmId = String(properties.osm_id ?? "");
  const rawType = String(properties.osm_type ?? "");
  const type = rawType === "nodes" ? "node" : rawType.startsWith("ways") ? "way" : "relation";
  return osmId ? `https://www.openstreetmap.org/${type}/${osmId}` : "https://www.openstreetmap.org/copyright";
}

function normalizedName(properties: Record<string, unknown>, kind: ExposureFacilityKind): string {
  const name = String(properties.name ?? "").trim();
  return name || `Unnamed ${kind.toLowerCase()}`;
}

export function resolveExposureCenter(
  event: RiskEvent | null,
  location: ResolvedLocation | null
): ExposureCenter | null {
  if (!event) return null;
  if (
    event.geometryType === "Point" &&
    event.latitude != null &&
    event.longitude != null
  ) {
    return {
      latitude: event.latitude,
      longitude: event.longitude,
      basis: "incident",
    };
  }
  const scope = event.raw.openRiskScope as { nwsPointMatch?: boolean } | undefined;
  if (
    location &&
    (event.geometryType === "Polygon" ||
      (event.source === "NWS" && scope?.nwsPointMatch === true))
  ) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      basis: "searched-location",
    };
  }
  if (event.latitude != null && event.longitude != null) {
    return {
      latitude: event.latitude,
      longitude: event.longitude,
      basis: "incident",
    };
  }
  return null;
}

export function buildHotExposureRequest(
  center: ExposureCenter,
  radiusMiles = HDX_EXPOSURE_RADIUS_MILES
): Record<string, unknown> {
  const boundedRadius = Math.min(Math.max(radiusMiles, 0.1), HDX_EXPOSURE_RADIUS_MILES);
  const bounds = bboxAround(center.latitude, center.longitude, boundedRadius);
  return {
    geometry: {
      type: "Polygon",
      coordinates: [[
        [bounds.west, bounds.south],
        [bounds.east, bounds.south],
        [bounds.east, bounds.north],
        [bounds.west, bounds.north],
        [bounds.west, bounds.south],
      ]],
    },
    geometryType: ["point", "polygon"],
    centroid: true,
    useStWithin: true,
    filters: {
      attributes: {
        allGeometry: [
          "name",
          "amenity",
          "healthcare",
          "building",
          "operator",
          "addr:full",
          "addr:city",
        ],
      },
      tags: {
        allGeometry: {
          joinOr: {
            amenity: [
              "hospital",
              "clinic",
              "doctors",
              "school",
              "kindergarten",
              "college",
              "university",
            ],
            healthcare: ["hospital", "clinic", "doctor"],
          },
        },
      },
    },
  };
}

function normalizeFacility(
  feature: HotFeature,
  center: ExposureCenter,
  fetchedAt: string,
  radiusMiles: number
): SupplementalRiskSignal | null {
  if (feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }
  const longitude = finiteCoordinate(feature.geometry.coordinates[0]);
  const latitude = finiteCoordinate(feature.geometry.coordinates[1]);
  if (latitude == null || longitude == null) return null;

  const properties = feature.properties ?? {};
  const kind = facilityKind(properties);
  if (!kind) return null;
  const distance = distanceMiles(center, { latitude, longitude });
  if (distance > radiusMiles) return null;

  const osmId = String(properties.osm_id ?? `${latitude}-${longitude}`);
  const osmType = String(properties.osm_type ?? "feature");
  const name = normalizedName(properties, kind);
  const operator = String(properties.operator ?? "").trim();
  const city = String(properties.addr_city ?? properties["addr:city"] ?? "").trim();

  return {
    id: `hdx-${osmType}-${osmId}`,
    source: "HOT",
    sourceEventId: `hot-osm-${osmType}-${osmId}`,
    context: "exposure",
    category: "Exposure",
    type: kind,
    severity: "Minor",
    headline: name,
    description: `${kind} mapped by OpenStreetMap contributors${city ? ` in ${city}` : ""}.`,
    geometry: { type: "Point", latitude, longitude },
    startedAt: fetchedAt,
    expiresAt: null,
    updatedAt: fetchedAt,
    url: osmUrl(properties),
    confidence: "Source reported",
    metrics: [
      { label: "Facility type", value: kind },
      { label: "Distance", value: Math.max(0.1, Math.round(distance * 10) / 10), unit: "mi" },
      ...(operator ? [{ label: "Operator", value: operator }] : []),
    ],
    raw: properties,
  };
}

export async function fetchHdxExposure(
  center: ExposureCenter,
  radiusMiles = HDX_EXPOSURE_RADIUS_MILES
): Promise<HdxExposureResult> {
  const boundedRadius = Math.min(Math.max(radiusMiles, 0.1), HDX_EXPOSURE_RADIUS_MILES);
  const response = await fetch(HOT_RAW_DATA_API, {
    method: "POST",
    headers: {
      Accept: "application/geo+json, application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildHotExposureRequest(center, boundedRadius)),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await readJsonResponse<HotFeatureCollection>(response, "HOT exposure data");
  const fetchedAt = new Date().toISOString();
  const normalized = (data.features ?? [])
    .map((feature) => normalizeFacility(feature, center, fetchedAt, boundedRadius))
    .filter((facility): facility is SupplementalRiskSignal => facility != null)
    .sort((a, b) => {
      const aDistance = Number(a.metrics.find((metric) => metric.label === "Distance")?.value ?? 0);
      const bDistance = Number(b.metrics.find((metric) => metric.label === "Distance")?.value ?? 0);
      return aDistance - bDistance || a.headline.localeCompare(b.headline);
    });
  const facilities = normalized.slice(0, MAX_FACILITIES);

  return {
    facilities,
    healthFacilityCount: facilities.filter((facility) => facility.type === "Health facility").length,
    schoolCount: facilities.filter((facility) => facility.type === "School").length,
    center,
    radiusMiles: boundedRadius,
    truncated: normalized.length > MAX_FACILITIES,
  };
}
