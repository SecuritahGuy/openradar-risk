import type React from "react";
import L from "leaflet";
import { CircleMarker, Polygon, Popup, Tooltip } from "react-leaflet";
import type { SupplementalRiskSignal, SupplementalSource } from "../types/supplementalRisk";

interface SupplementalRiskMapLayersProps {
  signals: SupplementalRiskSignal[];
  onSignalClick?: (signal: SupplementalRiskSignal) => void;
}

function sourceColor(source: SupplementalSource): string {
  switch (source) {
    case "SPC":
      return "#1565c0";
    case "NOAA_TSUNAMI":
      return "#005b96";
    case "NWPS":
      return "#01579b";
    case "USGS_WATER":
      return "#0277bd";
    case "USGS_SHAKEMAP":
      return "#558b2f";
    case "UK_EA":
      return "#00796b";
    case "COOPS":
      return "#00838f";
    case "NHC":
      return "#ad1457";
    case "AIRNOW":
      return "#6a1b9a";
    case "SPACE_WEATHER":
      return "#5e35b1";
    case "DROUGHT":
      return "#8d6e63";
    case "VOLCANO":
      return "#bf360c";
    case "GVP":
      return "#ef6c00";
    case "HOT":
      return "#37474f";
    default:
      return "#546e7a";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pointRadius(signal: SupplementalRiskSignal): number {
  if (signal.source === "AIRNOW") {
    const aqi = Number(signal.metrics.find((metric) => metric.label === "AQI")?.value ?? 0);
    return Math.max(8, Math.min(22, 8 + aqi / 25));
  }
  if (signal.source === "NHC") return 14;
  if (signal.context === "baseline") return 7;
  return 8;
}

function accessiblePath(label: string) {
  return {
    add: (event: L.LeafletEvent) => {
      const element = (event.target as L.Path).getElement();
      element?.setAttribute("aria-label", label);
    },
  };
}

function popupContent(
  signal: SupplementalRiskSignal,
  onSignalClick?: (signal: SupplementalRiskSignal) => void
): React.ReactNode {
  const baseline = signal.context === "baseline";
  const exposure = signal.context === "exposure";
  return (
    <>
      <strong>{signal.headline}</strong>
      <br />
      {baseline && (
        <>
          <span style={baselineBadgeStyle}>Historical baseline · not an active alert</span>
          <br />
        </>
      )}
      {exposure && (
        <>
          <span style={exposureBadgeStyle}>Exposure context · not a risk signal</span>
          <br />
        </>
      )}
      {signal.description}
      <br />
      <em style={{ fontSize: 11 }}>
        {baseline
          ? "Smithsonian Global Volcanism Program reference record"
          : exposure
            ? "HOT / OpenStreetMap mapped facility"
            : `${signal.source} · ${signal.severity} · Updated ${formatTime(signal.updatedAt)}`}
      </em>
      {signal.metrics.length > 0 && (
        <>
          <br />
          <span style={{ fontSize: 11 }}>
            {signal.metrics
              .slice(0, baseline ? 6 : 3)
              .map((metric) =>
                `${metric.label}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`
              )
              .join(" · ")}
          </span>
        </>
      )}
      {signal.url && (
        <>
          <br />
          <a href={signal.url} target="_blank" rel="noreferrer" style={officialLinkStyle}>
            Official source &rarr;
          </a>
        </>
      )}
      {onSignalClick && (
        <>
          <br />
          <span style={detailLinkStyle} onClick={() => onSignalClick(signal)}>
            Details &rarr;
          </span>
        </>
      )}
    </>
  );
}

export function SupplementalRiskMapLayers({
  signals,
  onSignalClick,
}: SupplementalRiskMapLayersProps) {
  return (
    <>
      {signals.map((signal) => {
        const color = sourceColor(signal.source);
        const baseline = signal.context === "baseline";
        const exposure = signal.context === "exposure";
        if (signal.geometry.type === "Point") {
          return (
            <CircleMarker
              key={signal.id}
              center={[signal.geometry.latitude, signal.geometry.longitude]}
              radius={pointRadius(signal)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: baseline || exposure ? 0.12 : 0.65,
                weight: 2,
                dashArray: baseline || exposure ? "4 3" : undefined,
              }}
              eventHandlers={accessiblePath(
                baseline
                  ? `${signal.headline}, historical volcano baseline, not an active alert`
                  : exposure
                    ? `${signal.headline}, mapped facility exposure context, not a risk signal`
                  : `${signal.headline}, ${signal.severity} ${signal.category}`
              )}
            >
              <Popup>{popupContent(signal, onSignalClick)}</Popup>
              <Tooltip direction="top" offset={[0, -8]}>
                {signal.headline}
              </Tooltip>
            </CircleMarker>
          );
        }

        if (signal.geometry.type === "Polygon") {
          const positions = signal.geometry.polygon.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          return (
            <Polygon
              key={signal.id}
              positions={positions}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.1,
                weight: 2,
              }}
              eventHandlers={accessiblePath(`${signal.headline}, ${signal.severity} ${signal.category}`)}
            >
              <Popup>{popupContent(signal, onSignalClick)}</Popup>
            </Polygon>
          );
        }

        if (signal.geometry.type === "MultiPolygon") {
          return signal.geometry.polygons.map((polygon, index) => {
            const positions = polygon.map(
              ([lng, lat]) => [lat, lng] as [number, number]
            );
            return (
              <Polygon
                key={`${signal.id}-${index}`}
                positions={positions}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.08,
                  weight: 2,
                }}
                eventHandlers={accessiblePath(`${signal.headline}, ${signal.severity} ${signal.category}`)}
              >
                <Popup>{popupContent(signal, onSignalClick)}</Popup>
              </Polygon>
            );
          });
        }

        return null;
      })}
    </>
  );
}

const detailLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  fontSize: 11,
  color: "#1565c0",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
};

const baselineBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  margin: "5px 0",
  padding: "2px 5px",
  borderRadius: 4,
  background: "#fff3e0",
  color: "#a84300",
  fontSize: 10,
  fontWeight: 800,
};

const exposureBadgeStyle: React.CSSProperties = {
  ...baselineBadgeStyle,
  background: "#eceff1",
  color: "#37474f",
};

const officialLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  color: "#1565c0",
  fontSize: 11,
  fontWeight: 700,
};
