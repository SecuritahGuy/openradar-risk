import { useEffect, useRef, useState } from "react";
import L, { type Marker as LeafletMarker, type WMSParams } from "leaflet";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ResolvedLocation, RadiusOption } from "../types/location";
import type { EventSource, RiskEvent, Severity } from "../types/riskEvent";
import type { SupplementalRiskSignal } from "../types/supplementalRisk";
import type { NwsWeatherOverlay } from "../services/nwsWeatherOverlay";
import { resolveCoordinates } from "../services/locationResolver";
import {
  EVENT_SEVERITIES,
  EVENT_SOURCES,
  type SeverityFilters,
  type SourceFilters,
  severityColor,
  sourceColor,
  sourceLabel,
} from "../lib/riskInsights";
import { EventMapLayers } from "./EventMapLayers";
import { SupplementalRiskMapLayers } from "./SupplementalRiskMapLayers";
import { MapLegend } from "./MapLegend";
import { NwsWeatherMapLayers } from "./NwsWeatherMapLayers";
import {
  WEATHER_LAYER_OPTIONS,
  type WeatherLayerMode,
} from "../types/weatherLayer";
import {
  GIBS_LAYERS,
  GIBS_LAYER_OPTIONS,
  GIBS_WMS_URL,
  gibsDateOptions,
  gibsTileTemplate,
  readGibsPreferences,
  writeGibsPreferences,
  type GibsLayerId,
} from "../services/gibs";

interface PendingMapPoint {
  latitude: number;
  longitude: number;
  status: "loading" | "ready" | "error";
  location: ResolvedLocation | null;
  error: string | null;
}

interface MapViewProps {
  location: ResolvedLocation | null;
  radius: RadiusOption;
  events: RiskEvent[];
  baselineSignals: SupplementalRiskSignal[];
  exposureSignals: SupplementalRiskSignal[];
  weatherOverlay: NwsWeatherOverlay | null;
  showWeatherOverlay: boolean;
  weatherLayerMode: WeatherLayerMode;
  weatherOverlayLoading: boolean;
  weatherOverlayError: string | null;
  sourceFilters: SourceFilters;
  severityFilters: SeverityFilters;
  currentImpactOnly: boolean;
  onToggleSource: (source: EventSource) => void;
  onToggleSeverity: (severity: Severity) => void;
  onResetSourceFilters: () => void;
  onResetSeverityFilters: () => void;
  onToggleWeatherOverlay: (show: boolean) => void;
  onWeatherLayerModeChange: (mode: WeatherLayerMode) => void;
  onRadiusChange: (radius: RadiusOption) => void;
  onSearchMapArea: (lat: number, lng: number) => void;
  mapSearchLoading: boolean;
  onEventClick?: (event: RiskEvent) => void;
}

function pinMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "openrisk-location-marker",
    html: `<div style="
      position:relative;
      width:28px;
      height:34px;
    ">
      <div style="
        position:absolute;
        left:4px;
        top:0;
        width:20px;
        height:20px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.28);
      "></div>
      <div style="
        position:absolute;
        left:10px;
        top:6px;
        width:8px;
        height:8px;
        border-radius:50%;
        background:#fff;
      "></div>
    </div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

const searchedLocationIcon = pinMarkerIcon("#1565c0");

function pendingPointIcon(status: PendingMapPoint["status"]): L.DivIcon {
  if (status === "error") return pinMarkerIcon("#c62828");
  if (status === "loading") return pinMarkerIcon("#f57c00");
  return pinMarkerIcon("#2e7d32");
}

function MapController({ location }: { location: ResolvedLocation }) {
  const map = useMap();

  useEffect(() => {
    map.setView([location.latitude, location.longitude], 9, {
      animate: true,
    });
  }, [location, map]);

  return null;
}

function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function MapMoveWatcher({
  location,
  onMoved,
}: {
  location: ResolvedLocation | null;
  onMoved: (center: { lat: number; lng: number } | null) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      if (!location) {
        onMoved({ lat: center.lat, lng: center.lng });
        return;
      }

      const active = { lat: location.latitude, lng: location.longitude };
      onMoved(
        milesBetween(active, { lat: center.lat, lng: center.lng }) > 2
          ? { lat: center.lat, lng: center.lng }
          : null
      );
    },
  });

  useEffect(() => {
    onMoved(null);
  }, [location, onMoved]);

  return null;
}

function ClickSearchMarker({
  point,
  onClickPoint,
  onSearch,
  onCancel,
}: {
  point: PendingMapPoint | null;
  onClickPoint: (lat: number, lng: number) => void;
  onSearch: (lat: number, lng: number) => void;
  onCancel: () => void;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);

  useMapEvents({
    click: (event) => {
      const original = event.originalEvent.target as HTMLElement | null;
      if (original?.closest(".leaflet-marker-icon, .leaflet-popup")) return;
      onClickPoint(event.latlng.lat, event.latlng.lng);
    },
  });

  useEffect(() => {
    markerRef.current?.openPopup();
  }, [point]);

  if (!point) return null;

  const title =
    point.location
      ? `${point.location.city}, ${point.location.state}`
      : point.status === "loading"
        ? "Resolving location..."
        : "Location lookup failed";

  return (
    <Marker
      ref={markerRef}
      position={[point.latitude, point.longitude]}
      icon={pendingPointIcon(point.status)}
      zIndexOffset={1200}
      alt={title}
      title={title}
    >
      <Popup closeButton={false}>
        <div style={styles.clickPopup}>
          <strong>{title}</strong>
          {point.location?.county && (
            <div style={styles.clickPopupMeta}>{point.location.county}</div>
          )}
          <div style={styles.clickPopupMeta}>
            {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
          </div>
          {point.error && (
            <div style={styles.clickPopupError}>{point.error}</div>
          )}
          <div style={styles.clickPopupActions}>
            <button
              style={styles.clickPopupPrimary}
              disabled={point.status === "loading"}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSearch(point.latitude, point.longitude);
              }}
            >
              Search Here
            </button>
            <button
              style={styles.clickPopupSecondary}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function IpGeoController() {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !navigator.geolocation) {
      done.current = true;
      return;
    }
    done.current = true;

    const timeout = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 5, {
            animate: true,
          });
        },
        () => {},
        { timeout: 4000, enableHighAccuracy: false }
      );
    }, 200);

    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

function MapControlPanel({
  collapsed,
  radius,
  sourceFilters,
  severityFilters,
  showWeatherOverlay,
  weatherLayerMode,
  onCollapsedChange,
  onToggleSource,
  onToggleSeverity,
  onResetSourceFilters,
  onResetSeverityFilters,
  onToggleWeatherOverlay,
  onWeatherLayerModeChange,
  onRadiusChange,
  gibsLayer,
  gibsDate,
  gibsLoading,
  gibsError,
  gibsOpacity,
  gibsTileErrors,
  onGibsLayerChange,
  onGibsDateChange,
  onGibsOpacityChange,
}: {
  collapsed: boolean;
  radius: RadiusOption;
  sourceFilters: SourceFilters;
  severityFilters: SeverityFilters;
  showWeatherOverlay: boolean;
  weatherLayerMode: WeatherLayerMode;
  onCollapsedChange: (collapsed: boolean) => void;
  onToggleSource: (source: EventSource) => void;
  onToggleSeverity: (severity: Severity) => void;
  onResetSourceFilters: () => void;
  onResetSeverityFilters: () => void;
  onToggleWeatherOverlay: (show: boolean) => void;
  onWeatherLayerModeChange: (mode: WeatherLayerMode) => void;
  onRadiusChange: (radius: RadiusOption) => void;
  gibsLayer: GibsLayerId | null;
  gibsDate: string;
  gibsLoading: boolean;
  gibsError: string | null;
  gibsOpacity: number;
  gibsTileErrors: number;
  onGibsLayerChange: (layer: GibsLayerId | null) => void;
  onGibsDateChange: (date: string) => void;
  onGibsOpacityChange: (opacity: number) => void;
}) {
  const activeSourceCount = EVENT_SOURCES.filter(
    (source) => sourceFilters[source]
  ).length;
  const activeSeverityCount = EVENT_SEVERITIES.filter(
    (severity) => severityFilters[severity]
  ).length;

  if (collapsed) {
    return (
      <button
        type="button"
        className="map-control-tab"
        style={styles.controlTab}
        onClick={() => onCollapsedChange(false)}
        aria-expanded="false"
        aria-controls="map-filter-panel"
        title="Show map filters"
      >
        Filters
        <span style={styles.controlTabMeta}>
          {activeSourceCount} sources · {activeSeverityCount} severities
        </span>
      </button>
    );
  }

  return (
    <div
      id="map-filter-panel"
      className="map-control-panel"
      style={styles.controlPanel}
    >
      <div style={styles.controlHeader}>
        <span style={styles.controlTitle}>Map filters</span>
        <button
          type="button"
          style={styles.controlHideButton}
          onClick={() => onCollapsedChange(true)}
          aria-expanded="true"
          aria-controls="map-filter-panel"
          title="Hide map filters"
        >
          Hide
        </button>
      </div>
      <div style={styles.controlGroup}>
        <div style={styles.controlGroupHeader}>
          <div style={styles.controlLabel}>Sources</div>
          <button
            type="button"
            style={styles.resetButton}
            onClick={onResetSourceFilters}
            disabled={activeSourceCount === EVENT_SOURCES.length}
            title="Show all event sources"
          >
            All
          </button>
        </div>
        <div style={styles.chipRow}>
          {EVENT_SOURCES.map((source) => {
            const active = sourceFilters[source];
            return (
              <button
                key={source}
                onClick={() => onToggleSource(source)}
                style={{
                  ...styles.chip,
                  ...(active
                    ? {
                        color: "#fff",
                        background: sourceColor(source),
                        border: `1px solid ${sourceColor(source)}`,
                      }
                    : {}),
                }}
              >
                {sourceLabel(source)}
              </button>
            );
          })}
        </div>
      </div>
      <div style={styles.controlGroup}>
        <div style={styles.controlGroupHeader}>
          <div style={styles.controlLabel}>Severity</div>
          <button
            type="button"
            style={styles.resetButton}
            onClick={onResetSeverityFilters}
            disabled={activeSeverityCount === EVENT_SEVERITIES.length}
            title="Show all severities"
          >
            All
          </button>
        </div>
        <div style={styles.chipRow}>
          {EVENT_SEVERITIES.map((severity) => {
            const active = severityFilters[severity];
            return (
              <button
                key={severity}
                onClick={() => onToggleSeverity(severity)}
                style={{
                  ...styles.chip,
                  ...(active
                    ? {
                        color: severityColor(severity),
                        background: `${severityColor(severity)}18`,
                        border: `1px solid ${severityColor(severity)}66`,
                      }
                    : {}),
                }}
              >
                {severity}
              </button>
            );
          })}
        </div>
      </div>
      <div style={styles.controlGroup}>
        <div style={styles.controlLabel}>Radius</div>
        <div style={styles.chipRow}>
          {([10, 25, 50, 100] as RadiusOption[]).map((option) => (
            <button
              key={option}
              onClick={() => onRadiusChange(option)}
              style={{
                ...styles.chip,
                ...(option === radius ? styles.radiusActive : {}),
              }}
            >
              {option} mi
            </button>
          ))}
        </div>
      </div>
      <div style={styles.weatherModeGroup}>
        <label style={styles.weatherToggle}>
          <input
            type="checkbox"
            checked={showWeatherOverlay}
            onChange={(event) => onToggleWeatherOverlay(event.target.checked)}
            style={styles.checkbox}
          />
          NWS layer
        </label>
        <div style={styles.weatherModeRow}>
          {WEATHER_LAYER_OPTIONS.map((option) => {
            const active = option.mode === weatherLayerMode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => {
                  onWeatherLayerModeChange(option.mode);
                  if (!showWeatherOverlay) onToggleWeatherOverlay(true);
                }}
                style={{
                  ...styles.weatherModeChip,
                  ...(active ? styles.weatherModeActive : {}),
                }}
                title={`Show NWS ${option.label.toLowerCase()} layer`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={styles.controlGroup}>
        <label style={styles.weatherToggle}>
          <input
            type="checkbox"
            checked={gibsLayer !== null}
            onChange={(event) => onGibsLayerChange(
              event.target.checked ? "MODIS_Terra_CorrectedReflectance_TrueColor" : null
            )}
            style={styles.checkbox}
          />
          NASA satellite imagery
        </label>
        {gibsLayer && (
          <div style={styles.satelliteFields}>
            <select
              aria-label="NASA GIBS layer"
              value={gibsLayer}
              onChange={(event) => onGibsLayerChange(event.target.value as GibsLayerId)}
              style={styles.satelliteSelect}
            >
              {GIBS_LAYER_OPTIONS.map((layer) => (
                <option key={layer.id} value={layer.id}>{layer.title}</option>
              ))}
            </select>
            <select
              aria-label="NASA GIBS imagery date"
              value={gibsDate}
              onChange={(event) => onGibsDateChange(event.target.value)}
              style={styles.satelliteSelect}
            >
              {gibsDateOptions().map((date) => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
            <label style={styles.satelliteOpacityLabel}>
              <span>Opacity</span>
              <input
                type="range"
                min="25"
                max="100"
                step="1"
                value={Math.round(gibsOpacity * 100)}
                onChange={(event) => onGibsOpacityChange(Number(event.target.value) / 100)}
                aria-label="NASA GIBS opacity"
              />
              <output>{Math.round(gibsOpacity * 100)}%</output>
            </label>
            <div style={gibsError ? styles.satelliteError : styles.satelliteDetail}>
              {gibsError
                ? gibsError
                : gibsLoading
                  ? "Loading NASA imagery..."
                  : GIBS_LAYERS[gibsLayer].description}
            </div>
            <div style={styles.satelliteLegend} role="group" aria-label={`${GIBS_LAYERS[gibsLayer].legendTitle} legend`}>
              <strong>{GIBS_LAYERS[gibsLayer].legendTitle}</strong>
              <div style={styles.satelliteLegendStops}>
                {GIBS_LAYERS[gibsLayer].legendStops.map((stop) => (
                  <span key={stop.label} style={styles.satelliteLegendStop}>
                    <span style={{ ...styles.satelliteLegendSwatch, background: stop.color }} />
                    {stop.label}
                  </span>
                ))}
              </div>
              {gibsTileErrors > 0 && <span>{gibsTileErrors} tile{gibsTileErrors === 1 ? "" : "s"} unavailable</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function weatherModeLabel(mode: WeatherLayerMode): string {
  return (
    WEATHER_LAYER_OPTIONS.find((option) => option.mode === mode)?.label ?? "Weather"
  );
}

function weatherOverlaySummary(
  overlay: NwsWeatherOverlay | null,
  mode: WeatherLayerMode
): string {
  if (!overlay) return "Waiting for NWS grid data";
  const grid = overlay.gridCell;
  if (mode === "precip") {
    return `Precip ${grid.precipitationChance ?? "n/a"}% · ${grid.shortForecast}`;
  }
  if (mode === "thunder") {
    return `Thunder ${grid.thunderChance ?? "n/a"}% · ${grid.shortForecast}`;
  }
  if (mode === "heat") {
    return `Heat risk ${grid.heatRisk ?? "n/a"} · ${grid.temperature}F`;
  }
  if (mode === "wind") {
    return `Wind ${grid.windSpeed} ${grid.windDirection} · ${overlay.stations.length} stations`;
  }
  if (mode === "stations") {
    return `${overlay.stations.length} nearby station observation${overlay.stations.length !== 1 ? "s" : ""}`;
  }
  return `${grid.shortForecast} · ${grid.temperature}F · ${overlay.stations.length} stations`;
}

function WeatherOverlayStatus({
  visible,
  overlay,
  mode,
  loading,
  error,
  onClose,
  onModeChange,
}: {
  visible: boolean;
  overlay: NwsWeatherOverlay | null;
  mode: WeatherLayerMode;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onModeChange: (mode: WeatherLayerMode) => void;
}) {
  if (!visible) return null;

  return (
    <div className="weather-overlay-status" style={styles.weatherStatus}>
      <div style={styles.weatherStatusTop}>
        <span style={styles.weatherStatusLabel}>NWS {weatherModeLabel(mode)}</span>
        <button
          type="button"
          style={styles.weatherStatusClose}
          onClick={onClose}
          aria-label="Hide NWS weather overlay"
          title="Hide NWS weather overlay"
        >
          &times;
        </button>
      </div>
      <div style={error ? styles.weatherStatusError : styles.weatherStatusDetail}>
        {error
          ? error
          : loading
            ? "Loading NWS weather overlay..."
            : weatherOverlaySummary(overlay, mode)}
      </div>
      {overlay && !error && (
        <div style={styles.weatherStatusMeta}>
          Grid {overlay.gridCell.gridId} {overlay.gridCell.gridX},{overlay.gridCell.gridY}
        </div>
      )}
      <div style={styles.weatherStatusModes} aria-label="NWS overlay mode">
        {WEATHER_LAYER_OPTIONS.map((option) => {
          const active = option.mode === mode;
          return (
            <button
              key={option.mode}
              type="button"
              style={{
                ...styles.weatherStatusMode,
                ...(active ? styles.weatherStatusModeActive : {}),
              }}
              onClick={() => onModeChange(option.mode)}
              aria-pressed={active}
              title={`Show NWS ${option.label.toLowerCase()} layer`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MapView({
  location,
  radius,
  events,
  baselineSignals,
  exposureSignals,
  weatherOverlay,
  showWeatherOverlay,
  weatherLayerMode,
  weatherOverlayLoading,
  weatherOverlayError,
  sourceFilters,
  severityFilters,
  currentImpactOnly,
  onToggleSource,
  onToggleSeverity,
  onResetSourceFilters,
  onResetSeverityFilters,
  onToggleWeatherOverlay,
  onWeatherLayerModeChange,
  onRadiusChange,
  onSearchMapArea,
  mapSearchLoading,
  onEventClick,
}: MapViewProps) {
  const [movedCenter, setMovedCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pendingPoint, setPendingPoint] = useState<PendingMapPoint | null>(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [initialGibsPreferences] = useState(() => readGibsPreferences(
    typeof window === "undefined" ? null : window.localStorage
  ));
  const [gibsLayer, setGibsLayer] = useState<GibsLayerId | null>(initialGibsPreferences.layer);
  const [gibsDate, setGibsDate] = useState(initialGibsPreferences.date);
  const [gibsOpacity, setGibsOpacity] = useState(initialGibsPreferences.opacity);
  const [gibsLoading, setGibsLoading] = useState(false);
  const [gibsError, setGibsError] = useState<string | null>(null);
  const [gibsTileErrors, setGibsTileErrors] = useState(0);

  useEffect(() => {
    if (!location) setControlsCollapsed(true);
  }, [location]);

  useEffect(() => {
    writeGibsPreferences(
      typeof window === "undefined" ? null : window.localStorage,
      { layer: gibsLayer, date: gibsDate, opacity: gibsOpacity }
    );
  }, [gibsDate, gibsLayer, gibsOpacity]);

  function handleClickPoint(lat: number, lng: number) {
    const nextPoint: PendingMapPoint = {
      latitude: lat,
      longitude: lng,
      status: "loading",
      location: null,
      error: null,
    };
    setPendingPoint(nextPoint);

    resolveCoordinates(lat, lng)
      .then((resolved) => {
        setPendingPoint((current) => {
          if (
            !current ||
            Math.abs(current.latitude - lat) > 0.0001 ||
            Math.abs(current.longitude - lng) > 0.0001
          ) {
            return current;
          }

          return {
            ...current,
            status: resolved ? "ready" : "error",
            location: resolved,
            error: resolved ? null : "Could not identify this point.",
          };
        });
      })
      .catch((error) => {
        setPendingPoint((current) => {
          if (
            !current ||
            Math.abs(current.latitude - lat) > 0.0001 ||
            Math.abs(current.longitude - lng) > 0.0001
          ) {
            return current;
          }

          return {
            ...current,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Location lookup failed.",
          };
        });
      });
  }

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : [39.8283, -98.5795];
  const gibsMetadata = gibsLayer ? GIBS_LAYERS[gibsLayer] : null;
  const gibsEvents = {
    loading: () => {
      setGibsLoading(true);
      setGibsError(null);
      setGibsTileErrors(0);
    },
    load: () => setGibsLoading(false),
    tileerror: () => {
      setGibsLoading(false);
      setGibsTileErrors((count) => count + 1);
      setGibsError("Some NASA imagery tiles could not load; available tiles remain visible.");
    },
  };

  return (
    <div className="map-view" style={{ flex: 1, position: "relative" }}>
      <MapContainer
        center={center}
        zoom={4}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {gibsLayer && gibsMetadata?.rendering === "wmts" && (
          <TileLayer
            key={`${gibsLayer}-${gibsDate}`}
            url={gibsTileTemplate(gibsLayer, gibsDate)}
            attribution="NASA EOSDIS GIBS"
            opacity={gibsOpacity}
            maxNativeZoom={gibsMetadata.maxNativeZoom}
            maxZoom={18}
            eventHandlers={gibsEvents}
          />
        )}
        {gibsLayer && gibsMetadata?.rendering === "wms" && (
          <WMSTileLayer
            key={`${gibsLayer}-${gibsDate}`}
            url={GIBS_WMS_URL}
            layers={gibsMetadata.serviceLayer}
            format="image/png"
            transparent
            opacity={gibsOpacity}
            maxNativeZoom={gibsMetadata.maxNativeZoom}
            maxZoom={18}
            params={{
              layers: gibsMetadata.serviceLayer,
              time: gibsDate,
            } as WMSParams & { time: string }}
            attribution="NASA EOSDIS GIBS"
            eventHandlers={gibsEvents}
          />
        )}
        <IpGeoController />
        <MapMoveWatcher location={location} onMoved={setMovedCenter} />
        {location && (
          <>
            <MapController location={location} />
            <Circle
              center={[location.latitude, location.longitude]}
              radius={radius * 1609.34}
              pathOptions={{
                color: "#1565c0",
                fillColor: "#1565c0",
                fillOpacity: 0.08,
                weight: 2,
                dashArray: "6 4",
              }}
              interactive={false}
            />
            <Marker
              position={[location.latitude, location.longitude]}
              icon={searchedLocationIcon}
              alt={`Searched location: ${location.city}, ${location.state}`}
              title={`Searched location: ${location.city}, ${location.state}`}
            >
              <Popup>
                {location.city}, {location.state}
                <br />
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Popup>
            </Marker>
          </>
        )}
        <EventMapLayers
          events={events}
          location={location}
          radius={radius}
          currentImpactOnly={currentImpactOnly}
          onEventClick={onEventClick}
        />
        <SupplementalRiskMapLayers signals={baselineSignals} />
        <SupplementalRiskMapLayers signals={exposureSignals} />
        <ClickSearchMarker
          point={pendingPoint}
          onClickPoint={handleClickPoint}
          onSearch={(lat, lng) => {
            onSearchMapArea(lat, lng);
            setPendingPoint(null);
            setMovedCenter(null);
          }}
          onCancel={() => setPendingPoint(null)}
        />
        <NwsWeatherMapLayers
          overlay={weatherOverlay}
          visible={showWeatherOverlay}
          mode={weatherLayerMode}
        />
        <MapLegend
          showWeatherOverlay={showWeatherOverlay}
          weatherLayerMode={weatherLayerMode}
          showVolcanoBaseline={baselineSignals.length > 0}
          showExposureFacilities={exposureSignals.length > 0}
        />
      </MapContainer>
      <MapControlPanel
        collapsed={controlsCollapsed}
        radius={radius}
        sourceFilters={sourceFilters}
        severityFilters={severityFilters}
        showWeatherOverlay={showWeatherOverlay}
        weatherLayerMode={weatherLayerMode}
        onCollapsedChange={setControlsCollapsed}
        onToggleSource={onToggleSource}
        onToggleSeverity={onToggleSeverity}
        onResetSourceFilters={onResetSourceFilters}
        onResetSeverityFilters={onResetSeverityFilters}
        onToggleWeatherOverlay={onToggleWeatherOverlay}
        onWeatherLayerModeChange={onWeatherLayerModeChange}
        onRadiusChange={onRadiusChange}
        gibsLayer={gibsLayer}
        gibsDate={gibsDate}
        gibsLoading={gibsLoading}
        gibsError={gibsError}
        gibsOpacity={gibsOpacity}
        gibsTileErrors={gibsTileErrors}
        onGibsLayerChange={(layer) => {
          setGibsLayer(layer);
          setGibsLoading(layer !== null);
          setGibsError(null);
          setGibsTileErrors(0);
        }}
        onGibsDateChange={(date) => {
          setGibsDate(date);
          setGibsLoading(true);
          setGibsError(null);
          setGibsTileErrors(0);
        }}
        onGibsOpacityChange={setGibsOpacity}
      />
      {movedCenter && (
        <button
          style={styles.searchAreaButton}
          onClick={() => {
            onSearchMapArea(movedCenter.lat, movedCenter.lng);
            setMovedCenter(null);
          }}
          disabled={mapSearchLoading}
        >
          {mapSearchLoading ? "Searching area..." : "Search this area"}
        </button>
      )}
      <WeatherOverlayStatus
        visible={showWeatherOverlay}
        overlay={weatherOverlay}
        mode={weatherLayerMode}
        loading={weatherOverlayLoading}
        error={weatherOverlayError}
        onClose={() => onToggleWeatherOverlay(false)}
        onModeChange={onWeatherLayerModeChange}
      />
      {gibsLayer && gibsMetadata && (
        <div className="gibs-overlay-status" style={styles.gibsStatus} role="status">
          <div>
            <strong>NASA GIBS · {gibsMetadata.title}</strong>
            <span style={styles.gibsStatusMeta}> {gibsDate} · {Math.round(gibsOpacity * 100)}%</span>
            {gibsTileErrors > 0 && <span style={styles.gibsStatusWarning}> · partial imagery</span>}
          </div>
          <button
            type="button"
            aria-label="Hide NASA satellite imagery"
            title="Hide NASA satellite imagery"
            onClick={() => setGibsLayer(null)}
            style={styles.weatherStatusClose}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controlPanel: {
    position: "absolute",
    top: 12,
    left: 54,
    right: 12,
    zIndex: 1000,
    display: "grid",
    gridTemplateColumns: "1.1fr 1.35fr auto minmax(270px, 1fr)",
    gap: 10,
    alignItems: "end",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
    fontFamily: "system-ui, sans-serif",
  },
  controlHeader: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 6,
    borderBottom: "1px solid #e8eef5",
  },
  controlTitle: {
    fontSize: 10,
    color: "#616161",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  controlHideButton: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 8px",
    cursor: "pointer",
  },
  controlTab: {
    position: "absolute",
    top: 12,
    left: 54,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #1565c0",
    borderRadius: 7,
    background: "#1565c0",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.16)",
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  controlTabMeta: {
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
  },
  controlGroup: {
    minWidth: 0,
  },
  controlLabel: {
    fontSize: 10,
    color: "#616161",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  controlGroupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  resetButton: {
    border: "1px solid #d8e0e7",
    borderRadius: 5,
    background: "#fff",
    color: "#1565c0",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    padding: "3px 6px",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  chip: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 7px",
    cursor: "pointer",
    lineHeight: 1,
  },
  radiusActive: {
    color: "#fff",
    background: "#1565c0",
    border: "1px solid #1565c0",
  },
  weatherToggle: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12,
    fontWeight: 700,
    color: "#424242",
    whiteSpace: "nowrap",
    paddingBottom: 2,
    cursor: "pointer",
  },
  weatherModeGroup: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  weatherModeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  weatherModeChip: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 7px",
    cursor: "pointer",
    lineHeight: 1,
  },
  weatherModeActive: {
    color: "#fff",
    background: "#00897b",
    border: "1px solid #00897b",
  },
  checkbox: {
    width: 15,
    height: 15,
    accentColor: "#1565c0",
  },
  satelliteFields: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, 1fr) minmax(120px, auto)",
    gap: 5,
    marginTop: 5,
  },
  satelliteSelect: {
    minWidth: 0,
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#263238",
    fontSize: 11,
    padding: "5px 6px",
  },
  satelliteDetail: {
    gridColumn: "1 / -1",
    color: "#546e7a",
    fontSize: 10,
    lineHeight: 1.3,
  },
  satelliteOpacityLabel: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "auto minmax(100px, 1fr) auto",
    alignItems: "center",
    gap: 7,
    color: "#455a64",
    fontSize: 10,
    fontWeight: 800,
  },
  satelliteLegend: {
    gridColumn: "1 / -1",
    display: "grid",
    gap: 4,
    color: "#455a64",
    fontSize: 9,
    lineHeight: 1.25,
  },
  satelliteLegendStops: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },
  satelliteLegendStop: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
  },
  satelliteLegendSwatch: {
    width: 10,
    height: 10,
    border: "1px solid #78909c",
    borderRadius: 2,
  },
  satelliteError: {
    gridColumn: "1 / -1",
    color: "#c62828",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  searchAreaButton: {
    position: "absolute",
    top: 82,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    border: "1px solid #1565c0",
    borderRadius: 7,
    background: "#1565c0",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    padding: "8px 14px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
    cursor: "pointer",
  },
  weatherStatus: {
    position: "absolute",
    left: 12,
    bottom: 14,
    zIndex: 1000,
    width: 290,
    border: "1px solid #d7e3ec",
    borderRadius: 8,
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.16)",
    padding: "9px 10px",
    fontFamily: "system-ui, sans-serif",
  },
  weatherStatusTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weatherStatusLabel: {
    color: "#1565c0",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  weatherStatusClose: {
    border: "none",
    background: "transparent",
    color: "#546e7a",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1,
    padding: 0,
  },
  weatherStatusDetail: {
    color: "#263238",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.35,
    marginTop: 4,
  },
  weatherStatusError: {
    color: "#c62828",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.35,
    marginTop: 4,
  },
  weatherStatusMeta: {
    color: "#546e7a",
    fontSize: 11,
    marginTop: 4,
  },
  weatherStatusModes: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  weatherStatusMode: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
    padding: "5px 7px",
  },
  weatherStatusModeActive: {
    border: "1px solid #00897b",
    background: "#00897b",
    color: "#fff",
  },
  gibsStatus: {
    position: "absolute",
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    maxWidth: "calc(100% - 120px)",
    border: "1px solid #b0bec5",
    borderRadius: 7,
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 2px 9px rgba(15,23,42,0.15)",
    color: "#263238",
    fontSize: 11,
    padding: "7px 9px",
  },
  gibsStatusMeta: {
    color: "#546e7a",
    whiteSpace: "nowrap",
  },
  gibsStatusWarning: {
    color: "#bf360c",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  clickPopup: {
    minWidth: 180,
    fontFamily: "system-ui, sans-serif",
    color: "#212121",
  },
  clickPopupMeta: {
    fontSize: 12,
    color: "#616161",
    marginTop: 3,
  },
  clickPopupError: {
    fontSize: 12,
    color: "#c62828",
    marginTop: 6,
  },
  clickPopupActions: {
    display: "flex",
    gap: 6,
    marginTop: 10,
  },
  clickPopupPrimary: {
    border: "1px solid #1565c0",
    borderRadius: 5,
    background: "#1565c0",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    padding: "5px 8px",
    cursor: "pointer",
  },
  clickPopupSecondary: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 8px",
    cursor: "pointer",
  },
};
