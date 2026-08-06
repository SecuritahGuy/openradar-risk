import { useMemo, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  Marker,
  Polygon,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { RiskEvent } from "../types/riskEvent";
import type { RadiusOption, ResolvedLocation } from "../types/location";
import {
  clusterPointEvents,
  isEventCluster,
  topClusterSeverity,
  type EventCluster,
} from "../lib/eventClustering";
import {
  concernContextLabel,
  isStaleConcernEvent,
  severityColor,
  severityRank,
  sourceColor,
} from "../lib/riskInsights";
import { assessImpact } from "../lib/impactInsights";
import { ClusterPopup, EventPopup } from "./map/EventPopup";

interface EventMapLayersProps {
  events: RiskEvent[];
  location: ResolvedLocation | null;
  radius: RadiusOption;
  currentImpactOnly: boolean;
  onEventClick?: (event: RiskEvent) => void;
}

function eventRadius(event: RiskEvent): number {
  if (event.source === "USGS") {
    const mag = parseFloat(event.headline.match(/[\d.]+/)?.[0] ?? "1");
    return Math.max(6, mag * 6);
  }
  if (event.source === "NIFC") {
    const raw = event.raw as Record<string, unknown>;
    const acres = (raw.CalculatedAcres as number) ?? 0;
    return Math.max(8, Math.min(30, Math.sqrt(acres) * 0.4));
  }
  if (event.source === "NHC" || event.source === "JMA") {
    const raw = event.raw as Record<string, unknown>;
    const intensity = Number(raw.intensity ?? 0);
    return Math.max(9, Math.min(28, 8 + intensity / 8));
  }
  return 10;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clusterIcon(cluster: EventCluster, historical: boolean): L.DivIcon {
  const severity = topClusterSeverity(cluster.events);
  const color = historical ? "#78909c" : severityColor(severity);
  const size = Math.max(34, Math.min(58, 28 + cluster.events.length * 2));

  return L.divIcon({
    className: "event-cluster-marker",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      border:2px ${historical ? "dashed" : "solid"} ${color};
      background:${historical ? "#eceff1" : color};
      opacity:${historical ? "0.72" : "1"};
      color:${historical ? "#455a64" : "#fff"};
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,0.24);
      font:800 12px system-ui,sans-serif;
    ">${cluster.events.length}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function constructionEventIcon(dimmed = false): L.DivIcon {
  return L.divIcon({
    className: "construction-event-marker",
    html: `<span style="
      width:34px;
      height:34px;
      border-radius:50% 50% 50% 8px;
      border:2px solid #fff;
      background:#a63d00;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,0.28);
      opacity:${dimmed ? "0.55" : "1"};
      transform:rotate(-45deg);
    "><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" style="transform:rotate(45deg)">
      <path fill="#fff" d="M9.2 3h5.6l1 4H8.2l1-4Zm-1.7 6h9l1.1 4.2H6.4L7.5 9Zm-1.7 6.2h12.4L19 19H5l.8-3.8ZM3 20h18v2H3z"/>
    </svg></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 34],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -30],
  });
}

function accessiblePath(label: string) {
  return {
    add: (event: L.LeafletEvent) => {
      const element = (event.target as L.Path).getElement();
      element?.setAttribute("aria-label", label);
    },
  };
}

export function EventMapLayers({
  events,
  location,
  radius,
  currentImpactOnly,
  onEventClick,
}: EventMapLayersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  const polygonEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.geometryType === "Polygon" && event.polygon && event.polygon.length >= 3
      ),
    [events]
  );
  const pointLayers = useMemo(
    () => {
      const pointEvents = events.filter(
        (event) =>
          event.geometryType === "Point" &&
          event.latitude != null &&
          event.longitude != null
      );
      const current = pointEvents.filter((event) => !isStaleConcernEvent(event));
      const historical = pointEvents.filter((event) => isStaleConcernEvent(event));
      return [
        ...clusterPointEvents(current, zoom).map((item) => ({ item, historical: false })),
        ...clusterPointEvents(historical, zoom).map((item) => ({ item, historical: true })),
      ];
    },
    [events, zoom]
  );

  return (
    <>
      {polygonEvents.map((event) => {
        const impact = assessImpact(event, location, radius);
        const historical = isStaleConcernEvent(event);
        const dimmed = historical || (
          !currentImpactOnly &&
          (impact.level === "monitor" || impact.level === "historical")
        );
        const color = sourceColor(event.source);
        const coords = event.polygon!.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );

        return (
          <Polygon
            key={event.id}
            positions={coords}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: dimmed ? 0.035 : impact.level === "affects" ? 0.18 : 0.1,
              opacity: dimmed ? 0.45 : 1,
              weight: impact.level === "affects" ? 3 : 2,
              dashArray: historical ? "5 4" : undefined,
            }}
            eventHandlers={accessiblePath(`${concernContextLabel(event) ? `${concernContextLabel(event)}, ` : ""}${event.headline}, ${event.severity} ${event.category}`)}
          >
            <Popup>
              <EventPopup
                event={event}
                impact={impact}
                timeLabel={`Updated ${formatTime(event.updatedAt)}`}
                onEventClick={onEventClick}
              />
            </Popup>
          </Polygon>
        );
      })}

      {pointLayers.map(({ item, historical }) => {
        if (isEventCluster(item)) {
          const topEvents = [...item.events]
            .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
            .slice(0, 6);

          return (
            <Marker
              key={`cluster-${historical ? "history" : "active"}-${item.id}`}
              position={[item.latitude, item.longitude]}
              icon={clusterIcon(item, historical)}
              alt={`${item.events.length} ${historical ? "historical " : ""}risk signals at this map location`}
            >
              <Popup>
                <ClusterPopup events={topEvents} onEventClick={onEventClick} />
              </Popup>
            </Marker>
          );
        }

        const event = item;
        const impact = assessImpact(event, location, radius);
        const dimmed = historical || (
          !currentImpactOnly &&
          (impact.level === "monitor" || impact.level === "historical")
        );
        const color = sourceColor(event.source);

        if (event.category === "Transportation") {
          return (
            <Marker
              key={event.id}
              position={[event.latitude!, event.longitude!]}
              icon={constructionEventIcon(dimmed)}
              alt={`${historical ? "Historical, " : ""}${event.headline}, ${event.severity} transportation event`}
            >
              <Tooltip direction="top" offset={[0, -28]}>
                {event.headline}
              </Tooltip>
              <Popup>
                <EventPopup
                  event={event}
                  impact={impact}
                  timeLabel={formatTime(event.startedAt)}
                  onEventClick={onEventClick}
                />
              </Popup>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={event.id}
            center={[event.latitude!, event.longitude!]}
            radius={eventRadius(event)}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: dimmed ? 0.2 : 0.58,
              opacity: dimmed ? 0.5 : 1,
              weight: impact.level === "nearby" ? 3 : 2,
              dashArray: historical ? "4 3" : undefined,
            }}
            eventHandlers={accessiblePath(`${historical ? "Historical or older, " : ""}${event.headline}, ${event.severity} ${event.category}`)}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {event.headline}
            </Tooltip>
            <Popup>
              <EventPopup
                event={event}
                impact={impact}
                timeLabel={formatTime(event.startedAt)}
                onEventClick={onEventClick}
              />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
