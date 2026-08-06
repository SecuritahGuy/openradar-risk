import { useState } from "react";
import type { RiskEvent } from "../types/riskEvent";
import type { RadiusOption, ResolvedLocation } from "../types/location";
import { assessImpact } from "../lib/impactInsights";
import { concernContextLabel, eventSourceLabel } from "../lib/riskInsights";
import { incidentMetadata } from "../lib/incidents";
import { ModalDialog } from "./ModalDialog";
import { ExposureContextPanel } from "./ExposureContextPanel";
import type { HdxExposureResult } from "../services/hdx";

interface EventDetailPanelProps {
  event: RiskEvent;
  location: ResolvedLocation | null;
  radius: RadiusOption;
  exposure: HdxExposureResult | null;
  exposureAvailable: boolean;
  exposureLoading: boolean;
  exposureFetching: boolean;
  exposureError: string | null;
  showExposureOnMap: boolean;
  onShowExposureOnMapChange: (show: boolean) => void;
  onClose: () => void;
}

function sourceColor(source: string): string {
  switch (source) {
    case "NWS":
      return "#1565c0";
    case "NOAA":
      return "#0065a8";
    case "NWPS":
      return "#01579b";
    case "USGS":
      return "#2e7d32";
    case "USGS_WATER":
      return "#0288d1";
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
    case "USDOT":
      return "#963800";
    default:
      return "#616161";
  }
}

function severityStyle(severity: string): React.CSSProperties {
  const color =
    severity === "Extreme"
      ? "#a31515"
      : severity === "Severe"
        ? "#963800"
        : severity === "Moderate"
          ? "#6b5500"
          : "#424242";
  return {
    fontSize: 11,
    fontWeight: 700,
    color,
    background: `${color}18`,
    padding: "2px 8px",
    borderRadius: 3,
    textTransform: "uppercase" as const,
  };
}

function accessibleImpactColor(level: ReturnType<typeof assessImpact>["level"]): string {
  switch (level) {
    case "affects":
      return "#a31515";
    case "nearby":
      return "#963800";
    case "historical":
      return "#6a1b9a";
    case "monitor":
      return "#455a64";
  }
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="event-detail-row" style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

function NwsFields({ raw }: { raw: Record<string, unknown> }) {
  const p = ((raw.properties as Record<string, string | null> | undefined) ??
    raw) as Record<string, string | null>;
  return (
    <>
      <DetailRow label="Urgency" value={p.urgency ?? "—"} />
      <DetailRow label="Certainty" value={p.certainty ?? "—"} />
      <DetailRow label="Area" value={p.areaDesc ?? "—"} />
      <DetailRow label="Category" value={p.category ?? "—"} />
    </>
  );
}

function UsgsFields({ raw }: { raw: Record<string, unknown> }) {
  const p = ((raw.properties as
    | Record<string, string | number | null>
    | undefined) ?? raw) as Record<string, string | number | null>;
  const geometry = raw.geometry as
    | { coordinates?: [number, number, number] }
    | undefined;
  return (
    <>
      <DetailRow label="Magnitude" value={p.mag != null ? String(p.mag) : "—"} />
      <DetailRow label="Mag Type" value={String(p.magType ?? "—")} />
      <DetailRow label="Place" value={String(p.place ?? "—")} />
      <DetailRow label="Type" value={String(p.type ?? "—")} />
      {geometry?.coordinates?.[2] != null && (
        <DetailRow label="Depth" value={`${geometry.coordinates[2]} km`} />
      )}
    </>
  );
}

function UsgsWaterFields({ raw }: { raw: Record<string, unknown> }) {
  const metrics = raw.metrics as
    | Array<{ label?: string; value?: string | number; unit?: string }>
    | undefined;
  const siteId = typeof raw.siteId === "string" ? raw.siteId : null;
  const siteName = typeof raw.siteName === "string" ? raw.siteName : null;

  return (
    <>
      {siteName && <DetailRow label="Gauge" value={siteName} />}
      {siteId && <DetailRow label="Site ID" value={siteId} />}
      {metrics?.map((metric) => {
        if (!metric.label || metric.value == null) return null;
        const value = `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
        return (
          <DetailRow
            key={`${metric.label}-${value}`}
            label={metric.label}
            value={value}
          />
        );
      })}
    </>
  );
}

function NifcFields({ raw }: { raw: Record<string, unknown> }) {
  const p = raw as Record<string, string | number | null>;
  const acres = p.CalculatedAcres;
  const contained = p.PercentContained;
  return (
    <>
      {acres != null && <DetailRow label="Acres" value={`${Number(acres).toLocaleString()} acres`} />}
      {contained != null && <DetailRow label="Containment" value={`${contained}%`} />}
      <DetailRow label="County" value={String(p.POOCounty ?? "—")} />
      <DetailRow label="State" value={String(p.POOState ?? "—")} />
      <DetailRow label="Cause" value={String(p.FireCauseGeneral ?? p.FireCause ?? "—")} />
      {p.TotalIncidentPersonnel != null && (
        <DetailRow label="Personnel" value={`${p.TotalIncidentPersonnel}`} />
      )}
      {p.ResidencesDestroyed != null && Number(p.ResidencesDestroyed) > 0 && (
        <DetailRow label="Residences Lost" value={`${p.ResidencesDestroyed}`} />
      )}
      {p.Fatalities != null && Number(p.Fatalities) > 0 && (
        <DetailRow label="Fatalities" value={`${p.Fatalities}`} />
      )}
      {p.Injuries != null && Number(p.Injuries) > 0 && (
        <DetailRow label="Injuries" value={`${p.Injuries}`} />
      )}
    </>
  );
}

function FemaFields({ raw }: { raw: Record<string, unknown> }) {
  const p = raw as Record<string, string | null>;
  const declType = p.declarationType;
  const declLabel =
    declType === "DR"
      ? "Major Disaster"
      : declType === "EM"
        ? "Emergency"
        : declType === "FM"
          ? "Fire Management"
          : declType ?? "—";
  return (
    <>
      <DetailRow label="Declaration" value={declLabel} />
      <DetailRow label="Program" value={p.programType ?? "—"} />
      <DetailRow label="Incident Type" value={p.incidentType ?? "—"} />
      <DetailRow label="County" value={p.county ?? "—"} />
      <DetailRow label="State" value={p.state ?? "—"} />
      <DetailRow label="Incident Start" value={p.incidentBeginDate ? formatTime(p.incidentBeginDate) : "—"} />
      <DetailRow label="Incident End" value={p.incidentEndDate ? formatTime(p.incidentEndDate) : "—"} />
      <DetailRow label="Close Out" value={p.disasterCloseOutDate ? formatTime(p.disasterCloseOutDate) : "—"} />
    </>
  );
}

function NoaaStormFields({ raw }: { raw: Record<string, unknown> }) {
  const p = raw as Record<string, string | number | null>;
  const damage = typeof p.totalDamage === "number" ? p.totalDamage : 0;
  const deaths = typeof p.totalDeaths === "number" ? p.totalDeaths : 0;
  const injuries = typeof p.totalInjuries === "number" ? p.totalInjuries : 0;
  return (
    <>
      <DetailRow label="Event ID" value={String(p.EVENT_ID ?? "—")} />
      <DetailRow label="Episode ID" value={String(p.EPISODE_ID ?? "—")} />
      <DetailRow label="County/Zone" value={String(p.CZ_NAME_STR ?? "—")} />
      <DetailRow label="Location" value={String(p.BEGIN_LOCATION ?? p.CZ_NAME_STR ?? "—")} />
      <DetailRow label="Weather Office" value={String(p.WFO ?? "—")} />
      <DetailRow label="Source" value={String(p.SOURCE ?? "—")} />
      {p.MAGNITUDE != null && String(p.MAGNITUDE).trim() && (
        <DetailRow
          label="Magnitude"
          value={`${p.MAGNITUDE}${p.MAGNITUDE_TYPE ? ` ${p.MAGNITUDE_TYPE}` : ""}`}
        />
      )}
      {p.TOR_F_SCALE && <DetailRow label="Tornado Scale" value={String(p.TOR_F_SCALE)} />}
      {damage > 0 && <DetailRow label="Reported Damage" value={`$${Math.round(damage).toLocaleString()}`} />}
      {deaths > 0 && <DetailRow label="Fatalities" value={String(deaths)} />}
      {injuries > 0 && <DetailRow label="Injuries" value={String(injuries)} />}
    </>
  );
}

function SpcFields({ raw }: { raw: Record<string, unknown> }) {
  return (
    <>
      <DetailRow label="Outlook Day" value={raw.day != null ? `Day ${raw.day}` : "—"} />
      <DetailRow label="Risk Label" value={String(raw.label ?? "—")} />
      <DetailRow label="Risk Detail" value={String(raw.label2 ?? "—")} />
      <DetailRow label="Valid" value={raw.valid ? String(raw.valid) : "—"} />
      <DetailRow label="Expires" value={raw.expire ? String(raw.expire) : "—"} />
    </>
  );
}

function NhcFields({ raw }: { raw: Record<string, unknown> }) {
  const publicAdvisory = raw.publicAdvisory as { advNum?: string } | null;
  return (
    <>
      <DetailRow label="Classification" value={String(raw.classification ?? "—")} />
      <DetailRow label="Advisory" value={publicAdvisory?.advNum ?? "—"} />
      <DetailRow label="Wind" value={raw.intensity ? `${raw.intensity} kt` : "—"} />
      <DetailRow label="Pressure" value={raw.pressure ? `${raw.pressure} mb` : "—"} />
      <DetailRow label="Movement" value={
        raw.movementDir != null && raw.movementSpeed != null
          ? `${raw.movementDir} deg at ${raw.movementSpeed} kt`
          : "—"
      } />
    </>
  );
}

function GdacsFields({ raw }: { raw: Record<string, unknown> }) {
  const p = ((raw.properties as Record<string, string | null> | undefined) ??
    raw) as Record<string, string | null>;
  return (
    <>
      <DetailRow label="Alert Level" value={p.alertlevel ?? "—"} />
      <DetailRow label="Alert Score" value={p.alertscore ?? "—"} />
      <DetailRow label="Country" value={p.country ?? p.countrylist ?? "—"} />
      <DetailRow label="Event ID" value={p.eventid ?? "—"} />
      <DetailRow label="Episode" value={p.episodeid ?? "—"} />
      <DetailRow label="Severity" value={p.severity ?? "—"} />
    </>
  );
}

function EonetFields({ raw }: { raw: Record<string, unknown> }) {
  const p = ((raw.properties as Record<string, unknown> | undefined) ??
    raw) as Record<string, unknown>;
  const categories = p.categories as Array<{ title?: string }> | undefined;
  const sources = p.sources as Array<{ id?: string }> | undefined;
  const magnitudeValue = p.magnitudeValue;
  const magnitudeUnit = p.magnitudeUnit;
  return (
    <>
      <DetailRow
        label="Categories"
        value={categories?.map((c) => c.title).filter(Boolean).join(", ") ?? "—"}
      />
      <DetailRow
        label="Magnitude"
        value={
          magnitudeValue != null
            ? `${magnitudeValue}${magnitudeUnit ? ` ${magnitudeUnit}` : ""}`
            : "—"
        }
      />
      <DetailRow
        label="Sources"
        value={sources?.map((s) => s.id).filter(Boolean).join(", ") ?? "—"}
      />
      <DetailRow label="Closed" value={p.closed ? formatTime(String(p.closed)) : "—"} />
    </>
  );
}

function SupplementalFields({ raw }: { raw: Record<string, unknown> }) {
  const metrics = raw.metrics as
    | Array<{ label?: string; value?: string | number; unit?: string }>
    | undefined;

  if (!metrics?.length) return null;

  return (
    <>
      {metrics.map((metric) => {
        if (!metric.label || metric.value == null) return null;
        const value = `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
        return (
          <DetailRow
            key={`${metric.label}-${value}`}
            label={metric.label}
            value={value}
          />
        );
      })}
    </>
  );
}

function humanizeTransportationValue(value: unknown): string {
  return String(value ?? "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeTransportationObjects(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const summaries = value.flatMap((item) => {
    if (typeof item === "string") return [humanizeTransportationValue(item)];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const preferred = record.type ?? record.status ?? record.lane_type ?? record.restriction_type;
    return preferred == null ? [] : [humanizeTransportationValue(preferred)];
  });
  return summaries.length ? Array.from(new Set(summaries)).join(", ") : "—";
}

function TransportationFields({ raw }: { raw: Record<string, unknown> }) {
  const roads = Array.isArray(raw.roadNames)
    ? raw.roadNames.filter((road): road is string => typeof road === "string")
    : [];
  const crossStreets = [raw.beginningCrossStreet, raw.endingCrossStreet]
    .filter((street): street is string => typeof street === "string" && !!street)
    .join(" to ");
  const beginningMilepost = typeof raw.beginningMilepost === "number" ? raw.beginningMilepost : null;
  const endingMilepost = typeof raw.endingMilepost === "number" ? raw.endingMilepost : null;
  const mileposts = beginningMilepost != null
    ? endingMilepost != null && endingMilepost !== beginningMilepost
      ? `${beginningMilepost} to ${endingMilepost}`
      : String(beginningMilepost)
    : "—";
  const occurrenceCount = typeof raw.occurrenceCount === "number" ? raw.occurrenceCount : 1;
  const verificationValues = [
    raw.startPositionVerified,
    raw.endPositionVerified,
    raw.startDateVerified,
    raw.endDateVerified,
  ].filter((value): value is boolean => typeof value === "boolean");
  const verification = verificationValues.length
    ? verificationValues.every(Boolean)
      ? "Verified by source"
      : verificationValues.some(Boolean)
        ? "Partially verified by source"
        : "Not verified by source"
    : "—";

  return (
    <>
      <DetailRow label="Road" value={roads.join(" / ") || "—"} />
      <DetailRow label="Direction" value={humanizeTransportationValue(raw.direction) || "—"} />
      <DetailRow label="Cross streets" value={crossStreets || "—"} />
      <DetailRow
        label="Traffic impact"
        value={humanizeTransportationValue(raw.effectiveVehicleImpact ?? raw.vehicleImpact) || "—"}
      />
      <DetailRow label="Mileposts" value={mileposts} />
      {typeof raw.reducedSpeedLimitKph === "number" && (
        <DetailRow
          label="Reduced speed"
          value={`${Math.round(raw.reducedSpeedLimitKph * 0.621371)} mph (${raw.reducedSpeedLimitKph} km/h)`}
        />
      )}
      <DetailRow label="Work type" value={summarizeTransportationObjects(raw.typesOfWork)} />
      <DetailRow label="Affected lanes" value={summarizeTransportationObjects(raw.lanes)} />
      <DetailRow label="Restrictions" value={summarizeTransportationObjects(raw.restrictions)} />
      {occurrenceCount > 1 && (
        <DetailRow
          label="Recurring schedule"
          value={`${occurrenceCount} linked occurrences through ${formatTime(String(raw.seriesEndAt ?? ""))}`}
        />
      )}
      <DetailRow label="Source verification" value={verification} />
    </>
  );
}

export function EventDetailPanel({
  event,
  location,
  radius,
  exposure,
  exposureAvailable,
  exposureLoading,
  exposureFetching,
  exposureError,
  showExposureOnMap,
  onShowExposureOnMapChange,
  onClose,
}: EventDetailPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const coords =
    event.latitude != null && event.longitude != null
      ? `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`
      : "—";
  const impact = assessImpact(event, location, radius);
  const incident = incidentMetadata(event);
  const impactBadgeColor = accessibleImpactColor(impact.level);
  const contextLabel = concernContextLabel(event);

  async function handleCopyEvent() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
      return;
    }

    const lines = [
      `OpenRisk Radar Event Detail`,
      `${eventSourceLabel(event)} · ${event.type} · ${event.severity} · ${impact.label}`,
      event.headline,
      event.description ? `Description: ${event.description}` : null,
      `Impact: ${impact.detail}`,
      `Started: ${formatTime(event.startedAt)}`,
      `Updated: ${formatTime(event.updatedAt)}`,
      event.expiresAt ? `Expires: ${formatTime(event.expiresAt)}` : null,
      coords !== "—" ? `Coordinates: ${coords}` : null,
      `Confidence: ${event.confidence}`,
      event.url ? `Source: ${event.url}` : null,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 2200);
  }

  return (
    <ModalDialog
      titleId="event-detail-title"
      onClose={onClose}
      backdropClassName="event-detail-backdrop"
      panelClassName="event-detail-panel"
      backdropStyle={styles.backdrop}
      panelStyle={styles.panel}
    >
        <div className="event-detail-header" style={styles.header}>
          <div className="event-detail-header-left" style={styles.headerLeft}>
            <span
              style={{
                ...styles.sourceBadge,
                background: sourceColor(event.source),
              }}
            >
              {eventSourceLabel(event)}
            </span>
            <span style={styles.headerType}>{event.type}</span>
            <span style={severityStyle(event.severity)}>{event.severity}</span>
            <span
              style={{
                ...styles.impactBadge,
                color: impactBadgeColor,
                background: `${impactBadgeColor}16`,
              }}
            >
              {impact.label}
            </span>
            {contextLabel && (
              <span style={styles.contextBadge}>{contextLabel}</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Close event details"
            data-modal-initial-focus
          >
            &times;
          </button>
        </div>

        <div id="event-detail-title" style={styles.headline}>{event.headline}</div>

        {event.description && (
          <div style={styles.description}>{event.description}</div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Impact, Timing & Location</div>
          <DetailRow label="Impact" value={impact.detail} />
          {contextLabel && <DetailRow label="Context" value={contextLabel} />}
          <DetailRow label="Started" value={formatTime(event.startedAt)} />
          <DetailRow label="Updated" value={formatTime(event.updatedAt)} />
          {event.expiresAt && (
            <DetailRow label="Expires" value={formatTime(event.expiresAt)} />
          )}
          <DetailRow label="Coordinates" value={coords} />
          <DetailRow label="Confidence" value={event.confidence} />
        </div>

        {incident && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Incident confidence</div>
            <DetailRow
              label="Agreement"
              value={incident.agreement === "corroborated"
                ? `Corroborated by ${incident.providerCount} providers`
                : "Single official source"}
            />
            <DetailRow label="Incident ID" value={incident.id} />
            <div style={styles.contributorList}>
              {incident.contributors.map((contributor) => (
                <div
                  key={`${contributor.provider?.id ?? contributor.source}:${contributor.sourceEventId}`}
                  style={styles.contributor}
                >
                  <span style={{ ...styles.contributorSource, color: sourceColor(contributor.source) }}>
                    {eventSourceLabel(contributor)}
                  </span>
                  <span style={styles.contributorHeadline}>{contributor.headline}</span>
                  <span style={styles.contributorTime}>{contributor.correlationReason}</span>
                  <span style={styles.contributorTime}>{formatTime(contributor.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {event.source === "NWS" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Weather Alert Details</div>
            <NwsFields raw={event.raw} />
          </div>
        )}
        {event.source === "USGS" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Earthquake Details</div>
            <UsgsFields raw={event.raw} />
          </div>
        )}
        {(event.source === "USGS_WATER" || event.source === "NWPS") && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              {event.source === "NWPS" ? "River Forecast Details" : "River Gauge Details"}
            </div>
            <UsgsWaterFields raw={event.raw} />
          </div>
        )}
        {event.source === "NIFC" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Wildfire Details</div>
            <NifcFields raw={event.raw} />
          </div>
        )}
        {event.source === "FEMA" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Disaster Declaration Details</div>
            <FemaFields raw={event.raw} />
          </div>
        )}
        {event.source === "NOAA" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Storm Event Details</div>
            <NoaaStormFields raw={event.raw} />
          </div>
        )}
        {event.source === "SPC" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Convective Outlook Details</div>
            <SpcFields raw={event.raw} />
          </div>
        )}
        {event.source === "NHC" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Tropical Cyclone Details</div>
            <NhcFields raw={event.raw} />
          </div>
        )}
        {event.source === "GDACS" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Global Disaster Details</div>
            <GdacsFields raw={event.raw} />
          </div>
        )}
        {event.source === "EONET" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Earth Observation Details</div>
            <EonetFields raw={event.raw} />
          </div>
        )}
        {event.source === "USDOT" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Roadwork Details</div>
            <TransportationFields raw={event.raw} />
          </div>
        )}
        {(event.source === "AIRNOW" || event.source === "COOPS" || event.source === "VOLCANO" || event.source === "DROUGHT") && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              {event.source === "VOLCANO"
                ? "Volcano Details"
                : event.source === "DROUGHT"
                  ? "Drought Details"
                  : "Environmental Details"}
            </div>
            <SupplementalFields raw={event.raw} />
          </div>
        )}

        {exposureAvailable && (
          <ExposureContextPanel
            result={exposure}
            isLoading={exposureLoading}
            isFetching={exposureFetching}
            error={exposureError}
            showOnMap={showExposureOnMap}
            onShowOnMapChange={onShowExposureOnMapChange}
          />
        )}

        <div style={styles.actionRow}>
          <button
            type="button"
            style={styles.copyBtn}
            onClick={handleCopyEvent}
            title="Copy event details"
          >
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Copy failed"
                : "Copy event"}
          </button>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.extLink}
            >
              View source &rarr;
            </a>
          )}
        </div>
    </ModalDialog>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
  },
  panel: {
    background: "#fff",
    borderRadius: 12,
    width: "90%",
    maxWidth: 560,
    maxHeight: "85vh",
    overflowY: "auto",
    padding: 24,
    boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
    position: "relative",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 3,
    textTransform: "uppercase" as const,
  },
  headerType: {
    fontSize: 13,
    color: "#616161",
    fontWeight: 500,
  },
  impactBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 3,
  },
  contextBadge: {
    fontSize: 11,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 3,
    color: "#546e7a",
    background: "#eceff1",
    textTransform: "uppercase" as const,
  },
  closeBtn: {
    border: "none",
    background: "none",
    fontSize: 24,
    color: "#616161",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  headline: {
    fontSize: 18,
    fontWeight: 700,
    color: "#212121",
    marginBottom: 12,
    lineHeight: 1.3,
  },
  description: {
    fontSize: 14,
    color: "#424242",
    lineHeight: 1.5,
    marginBottom: 16,
    whiteSpace: "pre-wrap" as const,
  },
  section: {
    marginBottom: 16,
    paddingTop: 12,
    borderTop: "1px solid #eee",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: "#616161",
    marginBottom: 8,
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: 13,
    borderBottom: "1px solid #f5f5f5",
  },
  detailLabel: {
    color: "#616161",
    fontWeight: 500,
    minWidth: 120,
  },
  detailValue: {
    color: "#212121",
    fontWeight: 500,
    textAlign: "right" as const,
    flex: 1,
  },
  contributorList: {
    display: "grid",
    gap: 6,
    marginTop: 8,
  },
  contributor: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 0.8fr) minmax(160px, 1.8fr) auto",
    gap: 8,
    alignItems: "center",
    background: "#f7f9fb",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 11,
  },
  contributorSource: {
    fontWeight: 800,
  },
  contributorHeadline: {
    color: "#37474f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contributorTime: {
    color: "#455a64",
    whiteSpace: "nowrap",
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    borderTop: "1px solid #eee",
    paddingTop: 12,
    textAlign: "center" as const,
  },
  copyBtn: {
    border: "1px solid #bbdefb",
    borderRadius: 6,
    background: "#fff",
    color: "#1565c0",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "7px 10px",
  },
  extLink: {
    fontSize: 13,
    color: "#1565c0",
    fontWeight: 600,
    textDecoration: "none",
  },
};
