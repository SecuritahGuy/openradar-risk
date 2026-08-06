import type { ResolvedLocation } from "../types/location";
import type { EventSource, RiskEvent, Severity } from "../types/riskEvent";

export const EVENT_SOURCES: EventSource[] = [
  "NWS",
  "NOAA",
  "NOAA_TSUNAMI",
  "NWPS",
  "USGS",
  "USGS_SHAKEMAP",
  "USGS_WATER",
  "UK_EA",
  "VOLCANO",
  "DROUGHT",
  "EMSC",
  "GEONET",
  "FEMA",
  "NIFC",
  "SPC",
  "NHC",
  "JMA",
  "GDACS",
  "EONET",
  "AIRNOW",
  "COOPS",
  "SPACE_WEATHER",
  "METEOALARM",
  "DWD",
  "WHO",
  "REGIONAL",
  "USDOT",
];
export const EVENT_SEVERITIES: Severity[] = [
  "Extreme",
  "Severe",
  "Moderate",
  "Minor",
];

export type SourceFilters = Record<EventSource, boolean>;
export type SeverityFilters = Record<Severity, boolean>;

export interface RiskSummary {
  level: "Clear" | "Guarded" | "Elevated" | "High" | "Critical";
  score: number;
  topDriver: string;
  criticalCount: number;
  severeCount: number;
  moderateCount: number;
  activeCount: number;
  expiringCount: number;
}

export interface RiskScoreContribution {
  id: "extreme" | "severe" | "moderate" | "expiring" | "active";
  label: string;
  count: number;
  points: number;
  detail: string;
}

export interface RiskSourceCount {
  source: EventSource;
  count: number;
}

export interface RiskScoreExplanation {
  score: number;
  level: RiskSummary["level"];
  topDriver: string;
  rule: string;
  contributions: RiskScoreContribution[];
  sourceCounts: RiskSourceCount[];
}

const STALE_CONCERN_MS = 7 * 24 * 60 * 60 * 1000;
const SEISMIC_CONCERN_MS: Record<Severity, number> = {
  Minor: 24 * 60 * 60 * 1000,
  Moderate: 3 * 24 * 60 * 60 * 1000,
  Severe: 7 * 24 * 60 * 60 * 1000,
  Extreme: 7 * 24 * 60 * 60 * 1000,
};

const SOURCE_CONCERN_MS: Partial<Record<EventSource, number>> = {
  NOAA_TSUNAMI: 24 * 60 * 60 * 1000,
  GTM: 24 * 60 * 60 * 1000,
  NHC: 3 * 24 * 60 * 60 * 1000,
  JMA: 3 * 24 * 60 * 60 * 1000,
  SPC: 2 * 24 * 60 * 60 * 1000,
  GDACS: 7 * 24 * 60 * 60 * 1000,
  EONET: 7 * 24 * 60 * 60 * 1000,
  WHO: 7 * 24 * 60 * 60 * 1000,
};

export function defaultSourceFilters(): SourceFilters {
  return {
    NWS: true,
    NOAA: true,
    NOAA_TSUNAMI: true,
    NWPS: true,
    USGS: true,
    USGS_SHAKEMAP: true,
    USGS_WATER: true,
    UK_EA: true,
    VOLCANO: true,
    DROUGHT: true,
    EMSC: true,
    FEMA: true,
    NIFC: true,
    SPC: true,
    NHC: true,
    JMA: true,
    GDACS: true,
    EONET: true,
    AIRNOW: true,
    COOPS: true,
    SPACE_WEATHER: true,
    METEOALARM: true,
    WHO: true,
    GTM: true,
    DWD: true,
    GEONET: true,
    REGIONAL: true,
    USDOT: true,
  };
}

export function defaultSeverityFilters(): SeverityFilters {
  return {
    Extreme: true,
    Severe: true,
    Moderate: true,
    Minor: true,
  };
}

export function sourceColor(source: EventSource): string {
  switch (source) {
    case "NWS":
      return "#f57c00";
    case "NOAA":
      return "#0065a8";
    case "NOAA_TSUNAMI":
      return "#005b96";
    case "NWPS":
      return "#01579b";
    case "USGS":
      return "#2e7d32";
    case "USGS_SHAKEMAP":
      return "#558b2f";
    case "USGS_WATER":
      return "#0288d1";
    case "UK_EA":
      return "#00796b";
    case "VOLCANO":
      return "#8d6e63";
    case "DROUGHT":
      return "#795548";
    case "EMSC":
      return "#43a047";
    case "FEMA":
      return "#7b1fa2";
    case "NIFC":
      return "#d84315";
    case "SPC":
      return "#00897b";
    case "NHC":
      return "#c62828";
    case "JMA":
      return "#d32f2f";
    case "GDACS":
      return "#1565c0";
    case "EONET":
      return "#6a1b9a";
    case "AIRNOW":
      return "#455a64";
    case "COOPS":
      return "#0277bd";
    case "SPACE_WEATHER":
      return "#5e35b1";
    case "METEOALARM":
      return "#c62828";
    case "WHO":
      return "#00897b";
    case "GTM":
      return "#006064";
    case "DWD":
      return "#1565c0";
    case "GEONET":
      return "#2e7d32";
    case "REGIONAL":
      return "#ad1457";
    case "USDOT":
      return "#37474f";
  }
}

export function sourceLabel(source: EventSource): string {
  const labels: Record<EventSource, string> = {
    NWS: "National Weather Service",
    NOAA: "NOAA Storm History",
    NOAA_TSUNAMI: "NOAA Tsunami Warnings",
    NWPS: "NOAA River Forecasts",
    USGS: "USGS Earthquakes",
    USGS_SHAKEMAP: "USGS ShakeMap",
    USGS_WATER: "USGS Water",
    UK_EA: "UK Environment Agency",
    VOLCANO: "USGS Volcanoes",
    DROUGHT: "Drought Monitor",
    EMSC: "EMSC Earthquakes",
    FEMA: "FEMA Disasters",
    NIFC: "National Wildfire Data",
    SPC: "Storm Prediction Center",
    NHC: "National Hurricane Center",
    JMA: "Japan Meteorological Agency",
    GDACS: "Global Disaster Alerts",
    EONET: "NASA Earth Events",
    AIRNOW: "Air Quality",
    COOPS: "NOAA Coastal Conditions",
    SPACE_WEATHER: "NOAA Space Weather",
    METEOALARM: "Meteoalarm European Warnings",
    WHO: "WHO Disease Outbreak News",
    GTM: "Global Tsunami Monitor",
    DWD: "Deutscher Wetterdienst",
    GEONET: "GeoNet New Zealand",
    REGIONAL: "State and Local Agencies",
    USDOT: "State Transportation Data",
  };
  return labels[source];
}

export function eventSourceLabel(event: Pick<RiskEvent, "source" | "provider">): string {
  return event.provider?.label ?? sourceLabel(event.source);
}

export function severityColor(severity: Severity): string {
  switch (severity) {
    case "Extreme":
      return "#b71c1c";
    case "Severe":
      return "#d84315";
    case "Moderate":
      return "#f57c00";
    case "Minor":
      return "#757575";
  }
}

export function severityRank(severity: Severity): number {
  switch (severity) {
    case "Extreme":
      return 4;
    case "Severe":
      return 3;
    case "Moderate":
      return 2;
    case "Minor":
      return 1;
  }
}

export function distanceMiles(
  location: ResolvedLocation | null,
  event: RiskEvent
): number | null {
  if (
    !location ||
    event.latitude == null ||
    event.longitude == null
  ) {
    return null;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(event.latitude - location.latitude);
  const dLon = toRad(event.longitude - location.longitude);
  const lat1 = toRad(location.latitude);
  const lat2 = toRad(event.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(miles: number | null): string {
  if (miles == null) return "Area";
  if (miles < 1) return "<1 mi";
  return `${Math.round(miles)} mi`;
}

export function expiresLabel(event: RiskEvent): string {
  if (event.source === "FEMA" && !event.expiresAt) return "Historical";
  if (!event.expiresAt) return "Open";

  const expires = new Date(event.expiresAt);
  if (Number.isNaN(expires.getTime())) return "Open";

  const diffMs = expires.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function isExpiringSoon(event: RiskEvent): boolean {
  if (!event.expiresAt) return false;
  const expires = new Date(event.expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const diffMs = expires - Date.now();
  return diffMs > 0 && diffMs <= 12 * 60 * 60 * 1000;
}

export function isHistoricalContextEvent(event: RiskEvent): boolean {
  return event.source === "FEMA" || event.source === "NOAA";
}

export function isStaleConcernEvent(
  event: RiskEvent,
  nowMs = Date.now()
): boolean {
  if (isHistoricalContextEvent(event)) return true;

  if (event.expiresAt) {
    const expires = new Date(event.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires <= nowMs) return true;
    return false;
  }

  if (event.category === "Seismic") {
    const started = new Date(event.startedAt).getTime();
    return !Number.isNaN(started) && nowMs - started >= SEISMIC_CONCERN_MS[event.severity];
  }

  const sourceWindow = SOURCE_CONCERN_MS[event.source];
  if (sourceWindow != null) {
    const started = new Date(event.startedAt).getTime();
    return !Number.isFinite(started) || nowMs - started >= sourceWindow;
  }

  const updated = new Date(event.updatedAt).getTime();
  return !Number.isNaN(updated) && nowMs - updated >= STALE_CONCERN_MS;
}

export function activeConcernEvents(
  events: RiskEvent[],
  nowMs = Date.now()
): RiskEvent[] {
  return events.filter((event) => !isStaleConcernEvent(event, nowMs));
}

export function concernContextLabel(event: RiskEvent): string | null {
  if (isHistoricalContextEvent(event)) return "Historical";
  if (!isStaleConcernEvent(event)) return null;
  if (event.expiresAt) return "Expired";
  return "Older";
}

export function filterEvents(
  events: RiskEvent[],
  sourceFilters: SourceFilters,
  severityFilters: SeverityFilters
): RiskEvent[] {
  return events.filter(
    (event) => sourceFilters[event.source] && severityFilters[event.severity]
  );
}

export function attentionEvents(
  events: RiskEvent[],
  location: ResolvedLocation | null,
  limit = 5
): RiskEvent[] {
  return [...events]
    .sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;

      const expiringDelta = Number(isExpiringSoon(b)) - Number(isExpiringSoon(a));
      if (expiringDelta !== 0) return expiringDelta;

      const aDistance = distanceMiles(location, a) ?? Number.POSITIVE_INFINITY;
      const bDistance = distanceMiles(location, b) ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit);
}

export function buildRiskSummary(events: RiskEvent[]): RiskSummary {
  const criticalCount = events.filter((e) => e.severity === "Extreme").length;
  const severeCount = events.filter((e) => e.severity === "Severe").length;
  const moderateCount = events.filter((e) => e.severity === "Moderate").length;
  const expiringCount = events.filter(isExpiringSoon).length;
  const sourceCounts = EVENT_SOURCES.map((source) => ({
    source,
    count: events.filter((event) => event.source === source).length,
  })).sort((a, b) => b.count - a.count);

  const score =
    criticalCount * 40 +
    severeCount * 18 +
    moderateCount * 7 +
    expiringCount * 8 +
    events.length;

  const level =
    criticalCount > 0 || score >= 90
      ? "Critical"
      : severeCount > 2 || score >= 55
        ? "High"
        : severeCount > 0 || moderateCount > 2 || score >= 25
          ? "Elevated"
          : events.length > 0
            ? "Guarded"
            : "Clear";

  const topSource = sourceCounts.find((item) => item.count > 0);
  const topDriver =
    criticalCount > 0
      ? `${criticalCount} extreme signal${criticalCount !== 1 ? "s" : ""}`
      : severeCount > 0
        ? `${severeCount} severe signal${severeCount !== 1 ? "s" : ""}`
        : topSource
          ? `${topSource.count} ${sourceLabel(topSource.source)} signal${topSource.count !== 1 ? "s" : ""}`
          : "No active signals";

  return {
    level,
    score,
    topDriver,
    criticalCount,
    severeCount,
    moderateCount,
    activeCount: events.length,
    expiringCount,
  };
}

function levelRule(level: RiskSummary["level"]): string {
  switch (level) {
    case "Critical":
      return "Critical when any extreme signal exists or the score reaches 90+.";
    case "High":
      return "High when there are 3+ severe signals or the score reaches 55+.";
    case "Elevated":
      return "Elevated when severe signals, 3+ moderate signals, or a 25+ score are present.";
    case "Guarded":
      return "Guarded when active signals are present below elevated thresholds.";
    case "Clear":
      return "Clear when no active signals are in scope.";
  }
}

export function explainRiskScore(events: RiskEvent[]): RiskScoreExplanation {
  const summary = buildRiskSummary(events);
  const sourceCounts = EVENT_SOURCES.map((source) => ({
    source,
    count: events.filter((event) => event.source === source).length,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const rawContributions: RiskScoreContribution[] = [
    {
      id: "extreme",
      label: "Extreme signals",
      count: summary.criticalCount,
      points: summary.criticalCount * 40,
      detail: "+40 each",
    },
    {
      id: "severe",
      label: "Severe signals",
      count: summary.severeCount,
      points: summary.severeCount * 18,
      detail: "+18 each",
    },
    {
      id: "moderate",
      label: "Moderate signals",
      count: summary.moderateCount,
      points: summary.moderateCount * 7,
      detail: "+7 each",
    },
    {
      id: "expiring",
      label: "Expiring soon",
      count: summary.expiringCount,
      points: summary.expiringCount * 8,
      detail: "+8 each",
    },
    {
      id: "active",
      label: "Active signals",
      count: summary.activeCount,
      points: summary.activeCount,
      detail: "+1 each",
    },
  ];
  const contributions = rawContributions.filter(
    (item) => item.count > 0 || item.id === "active"
  );

  return {
    score: summary.score,
    level: summary.level,
    topDriver: summary.topDriver,
    rule: levelRule(summary.level),
    contributions,
    sourceCounts,
  };
}
