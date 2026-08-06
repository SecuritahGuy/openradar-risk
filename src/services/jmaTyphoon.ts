import { newEventId } from "../lib/ids";
import type { RiskEvent, Severity } from "../types/riskEvent";

const BASE = "https://www.jma.go.jp/bosai/typhoon/data";
const MONITOR_RADIUS_FLOOR_MILES = 300;

export function buildJmaDataUrl(
  file: "targetTc.json" | "pastTracks.json",
  browser = typeof window !== "undefined"
): string {
  return browser ? `/api/jma/typhoons?file=${file}` : `${BASE}/${file}`;
}

export interface JmaTargetCyclone {
  tropicalCyclone: string;
  typhoonNumber: string;
  category: string;
  basetime?: string;
}

export interface JmaPastTrack {
  tropicalCyclone: string;
  [track: string]: unknown;
}

function milesBetween(latA: number, lngA: number, latB: number, lngB: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function parseJmaTime(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
  }
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+09:00`).toISOString();
}

function severity(category: string): Severity {
  const normalized = category.toUpperCase();
  if (normalized.includes("STY") || normalized.includes("VIOLENT")) return "Extreme";
  if (normalized.includes("TY") || normalized.includes("VERY STRONG")) return "Severe";
  if (normalized.includes("TC")) return "Moderate";
  return "Minor";
}

function trackPoints(track: JmaPastTrack): number[][] {
  return Object.entries(track)
    .filter(([key, value]) => key.startsWith("track") && value && typeof value === "object")
    .flatMap(([, value]) => Object.values(value as Record<string, unknown>))
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((point): point is number[] =>
      Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite)
    );
}

export function normalizeJmaCyclone(
  target: JmaTargetCyclone,
  track: JmaPastTrack,
  nowIso = new Date().toISOString()
): RiskEvent | null {
  const points = trackPoints(track);
  const point = points[points.length - 1];
  if (!point) return null;
  const [latitude, longitude] = point;
  const number = target.typhoonNumber.slice(-2).replace(/^0+/, "") || target.typhoonNumber;
  const updatedAt = parseJmaTime(target.basetime, nowIso);
  const grade = target.category.toUpperCase() === "LOW" ? "Tropical Depression" : "Tropical Cyclone";
  return {
    id: newEventId(),
    source: "JMA",
    sourceEventId: target.tropicalCyclone,
    type: grade,
    category: "Tropical",
    severity: severity(target.category),
    headline: `JMA ${grade} T${number}`,
    description: `Official Japan Meteorological Agency analysis for western North Pacific system ${target.typhoonNumber}. Follow JMA and local meteorological authority warnings for decisions.`,
    geometryType: "Point",
    latitude,
    longitude,
    polygon: null,
    startedAt: updatedAt,
    expiresAt: null,
    updatedAt,
    url: "https://www.jma.go.jp/bosai/map.html?contents=typhoon&elem=root&typhoon=all",
    confidence: "Source reported",
    provider: {
      id: "jma-typhoon",
      label: "Japan Meteorological Agency",
      authority: "federal",
      attributionUrl: "https://www.jma.go.jp/bosai/typhoon/",
    },
    raw: { target, track },
  };
}

export async function fetchJmaCyclones(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<RiskEvent[]> {
  const targetResponse = await fetch(buildJmaDataUrl("targetTc.json"));
  if (!targetResponse.ok) throw new Error(`JMA target list returned ${targetResponse.status}`);
  const targets = await targetResponse.json() as JmaTargetCyclone[];
  if (!Array.isArray(targets) || targets.length === 0) return [];
  const trackResponse = await fetch(buildJmaDataUrl("pastTracks.json"));
  if (!trackResponse.ok) throw new Error(`JMA track list returned ${trackResponse.status}`);
  const tracks = await trackResponse.json() as JmaPastTrack[];
  const monitoringRadius = Math.max(radiusMiles, MONITOR_RADIUS_FLOOR_MILES);
  return targets.flatMap((target) => {
    const track = tracks.find((candidate) => candidate.tropicalCyclone === target.tropicalCyclone);
    if (!track) return [];
    const event = normalizeJmaCyclone(target, track);
    if (!event || event.latitude == null || event.longitude == null) return [];
    return milesBetween(latitude, longitude, event.latitude, event.longitude) <= monitoringRadius
      ? [event]
      : [];
  });
}
