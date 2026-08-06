import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { SearchBar } from "./components/SearchBar";
import { UpdatePanel } from "./components/UpdatePanel";
import { FeedExplorer } from "./components/FeedExplorer";
import { SavedLocationList } from "./components/SavedLocationList";
import { SavedLocationOverview } from "./components/SavedLocationOverview";
import { EventDetailPanel } from "./components/EventDetailPanel";
import { RiskCommandBar } from "./components/RiskCommandBar";
import { OfflineBanner } from "./components/OfflineBanner";
import { useResolvedLocation } from "./hooks/useResolvedLocation";
import { useNwsWeatherOverlay } from "./hooks/useNwsWeatherOverlay";
import { useHdxExposure } from "./hooks/useHdxExposure";
import { useRiskFeeds } from "./hooks/useRiskFeeds";
import { useSavedLocations } from "./hooks/useSavedLocations";
import { useSavedLocationRiskSummaries } from "./hooks/useSavedLocationRiskSummaries";
import {
  activeConcernEvents,
  defaultSeverityFilters,
  defaultSourceFilters,
  filterEvents,
} from "./lib/riskInsights";
import { isCurrentImpact } from "./lib/impactInsights";
import type { RadiusOption, Criticality, LocationType } from "./types/location";
import { canonicalIncidentEvents } from "./lib/incidents";
import type { EventSource, RiskEvent, Severity } from "./types/riskEvent";
import type { WeatherLayerMode } from "./types/weatherLayer";
import {
  fetchCloudWatchStatus,
  registerCloudWatch,
  removeCloudWatch,
  syncCloudWatch,
} from "./services/cloudWatch";
import {
  disablePushNotifications,
  enablePushNotifications,
  refreshPushNotification,
  sendTestPush,
} from "./services/pushNotifications";
import { watchPreferencesFor } from "./lib/watchPreferences";
import "leaflet/dist/leaflet.css";

const MapView = lazy(() =>
  import("./components/MapView").then((module) => ({ default: module.MapView }))
);

const RADIUS_OPTIONS: RadiusOption[] = [10, 25, 50, 100];
const WEATHER_LAYER_MODES: WeatherLayerMode[] = [
  "temp",
  "precip",
  "thunder",
  "heat",
  "wind",
  "stations",
];
const EXAMPLE_SEARCHES = [
  "Chicago, IL",
  "Miami, FL",
  "San Francisco, CA",
  "Nashville, TN",
  "New Orleans, LA",
];
const PREFERENCES_KEY = "openrisk:view-preferences:v1";

interface ViewPreferences {
  radius?: RadiusOption;
  showWeatherOverlay?: boolean;
  weatherLayerMode?: WeatherLayerMode;
  feedExplorerCollapsed?: boolean;
  currentImpactOnly?: boolean;
  sourceFilters?: Partial<Record<EventSource, boolean>>;
  severityFilters?: Partial<Record<Severity, boolean>>;
}

function readPreferences(): ViewPreferences {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as ViewPreferences;
  } catch {
    return {};
  }
}

function readInitialQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function readInitialRadius(): RadiusOption {
  if (typeof window === "undefined") return 50;
  const value = Number(new URLSearchParams(window.location.search).get("radius"));
  return RADIUS_OPTIONS.includes(value as RadiusOption)
    ? (value as RadiusOption)
    : readPreferences().radius ?? 50;
}

function readInitialWeatherOverlay(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("weather");
  if (value != null) return value === "1";
  return readPreferences().showWeatherOverlay ?? false;
}

function readInitialWeatherLayerMode(): WeatherLayerMode {
  if (typeof window === "undefined") return "temp";
  const value = new URLSearchParams(window.location.search).get("layer");
  return WEATHER_LAYER_MODES.includes(value as WeatherLayerMode)
    ? (value as WeatherLayerMode)
    : readPreferences().weatherLayerMode ?? "temp";
}

function readInitialSourceFilters() {
  return { ...defaultSourceFilters(), ...readPreferences().sourceFilters };
}

function readInitialSeverityFilters() {
  return { ...defaultSeverityFilters(), ...readPreferences().severityFilters };
}

function coordsMatch(
  a: { latitude: number; longitude: number } | null,
  b: { latitude: number; longitude: number } | null
): boolean {
  if (!a || !b) return false;
  return (
    Math.abs(a.latitude - b.latitude) < 0.001 &&
    Math.abs(a.longitude - b.longitude) < 0.001
  );
}

function FirstRunPanel({
  loading,
  geoLoading,
  geoError,
  onExampleSearch,
  onUseCurrentLocation,
}: {
  loading: boolean;
  geoLoading: boolean;
  geoError: string | null;
  onExampleSearch: (query: string) => void;
  onUseCurrentLocation: () => void;
}) {
  return (
    <div className="first-run-panel" style={styles.firstRunPanel}>
      <div style={styles.firstRunContent}>
        <div style={styles.firstRunTitle}>Start with a location</div>
        <div style={styles.firstRunText}>
          Search a city or ZIP code to load live alerts, environmental signals,
          river gauges, forecasts, and nearby hazards.
        </div>
        <div style={styles.exampleRow}>
          {EXAMPLE_SEARCHES.map((example) => (
            <button
              key={example}
              type="button"
              style={styles.exampleButton}
              disabled={loading || geoLoading}
              onClick={() => onExampleSearch(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.firstRunAction}>
        <button
          type="button"
          style={styles.locationButton}
          disabled={loading || geoLoading}
          onClick={onUseCurrentLocation}
        >
          {geoLoading ? "Locating..." : "Use my location"}
        </button>
        {geoError && <div style={styles.geoError}>{geoError}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [initialQuery] = useState(readInitialQuery);
  const initialSearchStarted = useRef(false);
  const {
    query,
    setQuery,
    result,
    error: locError,
    loading,
    search,
    searchFor,
    searchCoordinates,
  } =
    useResolvedLocation(initialQuery);
  const [radius, setRadius] = useState<RadiusOption>(readInitialRadius);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(
    readInitialWeatherOverlay
  );
  const [cloudWatchBusyId, setCloudWatchBusyId] = useState<string | null>(null);
  const [cloudWatchError, setCloudWatchError] = useState<string | null>(null);
  const [weatherLayerMode, setWeatherLayerMode] =
    useState<WeatherLayerMode>(readInitialWeatherLayerMode);
  const [feedExplorerCollapsed, setFeedExplorerCollapsed] = useState(
    () => readPreferences().feedExplorerCollapsed ?? false
  );
  const [currentImpactOnly, setCurrentImpactOnly] = useState(
    () => readPreferences().currentImpactOnly ?? false
  );
  const [sourceFilters, setSourceFilters] = useState(readInitialSourceFilters);
  const [severityFilters, setSeverityFilters] = useState(readInitialSeverityFilters);
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);
  const [showExposureOnMap, setShowExposureOnMap] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const {
    weatherAlerts,
    earthquakes,
    femaDeclarations,
    stormEvents,
    wildfires,
    spcOutlooks,
    spcReports,
    nhcStorms,
    gdacsEvents,
    eonetEvents,
    emscEvents,
    geonetEvents,
    geonetVolcanoEvents,
    dwdEvents,
    currentWeather,
    femaRiskIndex,
    supplementalSignals,
    baselineSignals,
    sourceHealth,
    allEvents,
    error: feedError,
    refetch,
    lastUpdated,
    isFetching,
  } = useRiskFeeds(result, radius);

  const exposure = useHdxExposure(selectedEvent, result);

  const {
    overlay: weatherOverlay,
    isLoading: weatherOverlayLoading,
    error: weatherOverlayError,
  } = useNwsWeatherOverlay(result, showWeatherOverlay);

  const {
    savedLocations,
    saveLocation,
    deleteLocation,
    updateLocation,
    isSaving,
  } = useSavedLocations();
  const savedLocationSummaries =
    useSavedLocationRiskSummaries(savedLocations);

  const activeSavedLocation =
    savedLocations.find((l) => coordsMatch(l, result)) ?? null;

  const handleRadiusChange = useCallback(
    (nextRadius: RadiusOption) => {
      setRadius(nextRadius);
      if (activeSavedLocation) {
        void updateLocation(activeSavedLocation.id, { radiusMiles: nextRadius });
        if (activeSavedLocation.cloudWatch) {
          void syncCloudWatch(
            { ...activeSavedLocation, radiusMiles: nextRadius },
            watchPreferencesFor(activeSavedLocation),
            activeSavedLocation.cloudWatch
          ).then((cloudWatch) => {
            void updateLocation(activeSavedLocation.id, { cloudWatch });
          }).catch((error: unknown) => {
            void updateLocation(activeSavedLocation.id, {
              cloudWatch: {
                ...activeSavedLocation.cloudWatch!,
                status: "error",
                lastError: error instanceof Error ? error.message : "Cloud watch sync failed",
              },
            });
          });
        }
      }
    },
    [activeSavedLocation, updateLocation]
  );

  const handleEnableCloudWatch = useCallback(async () => {
    if (!activeSavedLocation) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      const cloudWatch = await registerCloudWatch(
        activeSavedLocation,
        watchPreferencesFor(activeSavedLocation)
      );
      await updateLocation(activeSavedLocation.id, { cloudWatch });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "Cloud audit could not be enabled");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleRefreshCloudWatch = useCallback(async () => {
    if (!activeSavedLocation?.cloudWatch) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      let cloudWatch = await fetchCloudWatchStatus(activeSavedLocation.cloudWatch);
      if (cloudWatch.pushNotification) {
        const pushNotification = await refreshPushNotification(cloudWatch, cloudWatch.pushNotification);
        cloudWatch = { ...cloudWatch, pushNotification };
      }
      await updateLocation(activeSavedLocation.id, { cloudWatch });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "Cloud audit status is unavailable");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleDisableCloudWatch = useCallback(async () => {
    if (!activeSavedLocation?.cloudWatch) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      if (activeSavedLocation.cloudWatch.pushNotification) {
        await disablePushNotifications(
          activeSavedLocation.cloudWatch,
          activeSavedLocation.cloudWatch.pushNotification
        );
      }
      await removeCloudWatch(activeSavedLocation.cloudWatch);
      await updateLocation(activeSavedLocation.id, { cloudWatch: undefined });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "Cloud audit could not be removed");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleEnablePush = useCallback(async () => {
    if (!activeSavedLocation?.cloudWatch) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      const pushNotification = await enablePushNotifications(activeSavedLocation.cloudWatch);
      await updateLocation(activeSavedLocation.id, {
        cloudWatch: { ...activeSavedLocation.cloudWatch, pushNotification },
      });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "Notifications could not be enabled");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleTestPush = useCallback(async () => {
    const cloudWatch = activeSavedLocation?.cloudWatch;
    if (!activeSavedLocation || !cloudWatch?.pushNotification) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      let pushNotification = await sendTestPush(cloudWatch, cloudWatch.pushNotification);
      await updateLocation(activeSavedLocation.id, { cloudWatch: { ...cloudWatch, pushNotification } });
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      pushNotification = await refreshPushNotification(cloudWatch, pushNotification);
      await updateLocation(activeSavedLocation.id, { cloudWatch: { ...cloudWatch, pushNotification } });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "The test notification could not be sent");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleDisablePush = useCallback(async () => {
    const cloudWatch = activeSavedLocation?.cloudWatch;
    if (!activeSavedLocation || !cloudWatch?.pushNotification) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      await disablePushNotifications(cloudWatch, cloudWatch.pushNotification);
      await updateLocation(activeSavedLocation.id, {
        cloudWatch: { ...cloudWatch, pushNotification: undefined },
      });
    } catch (error) {
      setCloudWatchError(error instanceof Error ? error.message : "Notifications could not be disabled");
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  const handleDeleteSavedLocation = useCallback(async (id: string) => {
    const location = savedLocations.find((item) => item.id === id);
    if (!location) return;
    setCloudWatchError(null);
    if (location.cloudWatch) {
      setCloudWatchBusyId(id);
      try {
        if (location.cloudWatch.pushNotification) {
          await disablePushNotifications(location.cloudWatch, location.cloudWatch.pushNotification);
        }
        await removeCloudWatch(location.cloudWatch);
      } catch (error) {
        setCloudWatchError(
          error instanceof Error
            ? `Cloud copy was not removed: ${error.message}`
            : "Cloud copy was not removed"
        );
        setCloudWatchBusyId(null);
        return;
      }
    }
    await deleteLocation(id);
    setCloudWatchBusyId(null);
  }, [deleteLocation, savedLocations]);

  const handleUpdateWatch = useCallback(async (watch: ReturnType<typeof watchPreferencesFor>) => {
    if (!activeSavedLocation) return;
    await updateLocation(activeSavedLocation.id, { watch });
    if (!activeSavedLocation.cloudWatch) return;
    setCloudWatchBusyId(activeSavedLocation.id);
    setCloudWatchError(null);
    try {
      const cloudWatch = await syncCloudWatch(
        { ...activeSavedLocation, watch },
        watch,
        activeSavedLocation.cloudWatch
      );
      await updateLocation(activeSavedLocation.id, { cloudWatch });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud watch sync failed";
      setCloudWatchError(message);
      await updateLocation(activeSavedLocation.id, {
        cloudWatch: { ...activeSavedLocation.cloudWatch, status: "error", lastError: message },
      });
    } finally {
      setCloudWatchBusyId(null);
    }
  }, [activeSavedLocation, updateLocation]);

  useEffect(() => {
    setCloudWatchError(null);
  }, [activeSavedLocation?.id]);

  useEffect(() => {
    const cloudWatch = activeSavedLocation?.cloudWatch;
    if (!cloudWatch || cloudWatchBusyId === activeSavedLocation.id) return;
    const syncedAt = new Date(cloudWatch.lastSyncedAt).getTime();
    if (Number.isFinite(syncedAt) && Date.now() - syncedAt < 5 * 60 * 1000) return;
    void handleRefreshCloudWatch();
  }, [activeSavedLocation, cloudWatchBusyId, handleRefreshCloudWatch]);

  const incidentEvents = useMemo(
    () => canonicalIncidentEvents(allEvents),
    [allEvents]
  );

  const filteredEvents = useMemo(() => {
    const visible = filterEvents(incidentEvents, sourceFilters, severityFilters);
    if (!currentImpactOnly) return visible;
    return visible.filter((event) => isCurrentImpact(event, result, radius));
  }, [incidentEvents, sourceFilters, severityFilters, currentImpactOnly, result, radius]);
  const allConcernEvents = useMemo(
    () => activeConcernEvents(incidentEvents),
    [incidentEvents]
  );
  const filteredConcernEvents = useMemo(
    () => activeConcernEvents(filteredEvents),
    [filteredEvents]
  );

  useEffect(() => {
    if (initialSearchStarted.current || !initialQuery.trim()) return;
    initialSearchStarted.current = true;
    searchFor(initialQuery);
  }, [initialQuery, searchFor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!result && !initialQuery.trim()) return;

    const params = new URLSearchParams(window.location.search);
    if (result) {
      params.set("q", result.postalCode ?? `${result.city}, ${result.state}`);
    }
    params.set("radius", String(radius));
    if (showWeatherOverlay) {
      params.set("weather", "1");
    } else {
      params.delete("weather");
    }
    if (weatherLayerMode !== "temp") {
      params.set("layer", weatherLayerMode);
    } else {
      params.delete("layer");
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [initialQuery, radius, result, showWeatherOverlay, weatherLayerMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferences: ViewPreferences = {
      radius,
      showWeatherOverlay,
      weatherLayerMode,
      feedExplorerCollapsed,
      currentImpactOnly,
      sourceFilters,
      severityFilters,
    };
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [
    currentImpactOnly,
    feedExplorerCollapsed,
    radius,
    severityFilters,
    showWeatherOverlay,
    sourceFilters,
    weatherLayerMode,
  ]);

  const handleToggleSource = useCallback((source: EventSource) => {
    setSourceFilters((current) => ({
      ...current,
      [source]: !current[source],
    }));
  }, []);

  const handleToggleSeverity = useCallback((severity: Severity) => {
    setSeverityFilters((current) => ({
      ...current,
      [severity]: !current[severity],
    }));
  }, []);

  const handleResetSourceFilters = useCallback(() => {
    setSourceFilters(defaultSourceFilters());
  }, []);

  const handleResetSeverityFilters = useCallback(() => {
    setSeverityFilters(defaultSeverityFilters());
  }, []);

  const handleSelectEvent = useCallback((event: RiskEvent) => {
    setShowExposureOnMap(false);
    setSelectedEvent(event);
  }, []);

  const handleSaveLocation = useCallback(() => {
    if (!result) return;
    saveLocation({
      label: `${result.city}, ${result.state}`,
      input: query,
      inputType: /^\d{5}$/.test(query) ? "zip" : "city_state",
      city: result.city,
      state: result.state,
      postalCode: result.postalCode,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      county: result.county,
      stateFips: result.stateFips,
      countyFips: result.countyFips,
    });
  }, [result, query, saveLocation]);

  const handleShareView = useCallback(async () => {
    if (typeof window === "undefined") return "unavailable";
    const label = result
      ? `${result.city}, ${result.state}`
      : "OpenRisk Radar view";
    const shareData = {
      title: `OpenRisk Radar: ${label}`,
      text: `Risk snapshot for ${label}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return "shared";
      } catch {
        // Fall back to clipboard when native sharing is cancelled or blocked.
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        return "copied";
      } catch {
        return "unavailable";
      }
    }

    return "unavailable";
  }, [result]);

  const handleSelectSaved = useCallback(
    (loc: (typeof savedLocations)[number]) => {
      const input = loc.postalCode
        ? loc.postalCode
        : `${loc.city}, ${loc.state}`;
      searchFor(input);
    },
    [searchFor]
  );

  const handleExampleSearch = useCallback(
    (example: string) => {
      setGeoError(null);
      searchFor(example);
    },
    [searchFor]
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Location access is not available in this browser.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        searchCoordinates(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setGeoLoading(false);
        setGeoError(
          error.message || "Could not get your current location."
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
    );
  }, [searchCoordinates]);

  return (
    <div className="app-shell" style={styles.root}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? "Resolving the requested location and loading risk sources."
          : result
            ? `${[result.city, result.state, result.country].filter(Boolean).join(", ")} loaded. ${incidentEvents.length} risk signal${incidentEvents.length === 1 ? "" : "s"} available${isFetching ? "; source updates are still in progress" : ""}.`
            : ""}
      </div>
      <div className="app-main" style={styles.leftCol}>
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={search}
          loading={loading}
          error={locError}
        />
        <OfflineBanner
          location={result}
          events={incidentEvents}
          isFetching={isFetching}
          radius={radius}
        />
        {!result && (
          <FirstRunPanel
            loading={loading}
            geoLoading={geoLoading}
            geoError={geoError}
            onExampleSearch={handleExampleSearch}
            onUseCurrentLocation={handleUseCurrentLocation}
          />
        )}
        <SavedLocationList
          savedLocations={savedLocations}
          activeLocationId={activeSavedLocation?.id ?? null}
          onSelect={handleSelectSaved}
          onDelete={(id) => void handleDeleteSavedLocation(id)}
          onUpdateLabel={(id, label) => updateLocation(id, { label })}
        />
        <SavedLocationOverview
          savedLocations={savedLocations}
          activeLocation={activeSavedLocation}
          summaries={savedLocationSummaries}
          events={incidentEvents}
          radius={radius}
          currentWeather={currentWeather}
          sourceHealth={sourceHealth}
          isFetching={isFetching}
          onSelect={handleSelectSaved}
          onShareActiveView={handleShareView}
        />
        <RiskCommandBar
          location={result}
          radius={radius}
          events={incidentEvents}
          currentWeather={currentWeather}
          currentImpactOnly={currentImpactOnly}
          onToggleCurrentImpact={setCurrentImpactOnly}
          onEventClick={handleSelectEvent}
        />
        <Suspense fallback={<div className="map-loading" aria-live="polite">Loading map…</div>}>
          <MapView
            location={result}
            radius={radius}
            events={filteredEvents}
            baselineSignals={baselineSignals}
            exposureSignals={showExposureOnMap ? exposure.data?.facilities ?? [] : []}
            weatherOverlay={weatherOverlay}
            showWeatherOverlay={showWeatherOverlay}
            weatherLayerMode={weatherLayerMode}
            weatherOverlayLoading={weatherOverlayLoading}
            weatherOverlayError={weatherOverlayError}
            sourceFilters={sourceFilters}
            severityFilters={severityFilters}
            currentImpactOnly={currentImpactOnly}
            onToggleSource={handleToggleSource}
            onToggleSeverity={handleToggleSeverity}
            onResetSourceFilters={handleResetSourceFilters}
            onResetSeverityFilters={handleResetSeverityFilters}
            onToggleWeatherOverlay={setShowWeatherOverlay}
            onWeatherLayerModeChange={setWeatherLayerMode}
            onRadiusChange={handleRadiusChange}
            onSearchMapArea={searchCoordinates}
            mapSearchLoading={loading}
            onEventClick={handleSelectEvent}
          />
        </Suspense>
        <FeedExplorer
          events={filteredConcernEvents}
          allEvents={filteredEvents}
          totalEvents={allConcernEvents.length}
          totalAllEvents={incidentEvents.length}
          location={result}
          radius={radius}
          isFetching={isFetching}
          collapsed={feedExplorerCollapsed}
          onCollapsedChange={setFeedExplorerCollapsed}
          onEventClick={handleSelectEvent}
        />
      </div>
      <UpdatePanel
        location={result}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        weatherAlerts={weatherAlerts}
        earthquakes={earthquakes}
        femaDeclarations={femaDeclarations}
        stormEvents={stormEvents}
        wildfires={wildfires}
        spcOutlooks={spcOutlooks}
        spcReports={spcReports}
        nhcStorms={nhcStorms}
        gdacsEvents={gdacsEvents}
        eonetEvents={eonetEvents}
        emscEvents={emscEvents}
        geonetEvents={geonetEvents}
        geonetVolcanoEvents={geonetVolcanoEvents}
        dwdEvents={dwdEvents}
        incidents={incidentEvents}
        currentWeather={currentWeather}
        femaRiskIndex={femaRiskIndex}
        supplementalSignals={supplementalSignals}
        baselineSignals={baselineSignals}
        sourceHealth={sourceHealth}
        weatherOverlay={weatherOverlay}
        showWeatherOverlay={showWeatherOverlay}
        weatherLayerMode={weatherLayerMode}
        onToggleWeatherOverlay={setShowWeatherOverlay}
        onWeatherLayerModeChange={setWeatherLayerMode}
        weatherOverlayLoading={weatherOverlayLoading}
        weatherOverlayError={weatherOverlayError}
        isFetching={isFetching}
        lastUpdated={lastUpdated}
        error={feedError}
        onRefresh={refetch}
        activeSavedLocation={activeSavedLocation}
        onSaveLocation={handleSaveLocation}
        onShareView={handleShareView}
        onUpdateLabel={(label) => {
          if (activeSavedLocation) {
            updateLocation(activeSavedLocation.id, { label });
          }
        }}
        onUpdateCriticality={(c) => {
          if (activeSavedLocation) {
            updateLocation(activeSavedLocation.id, {
              criticality: c as Criticality,
            });
          }
        }}
        onUpdateType={(t) => {
          if (activeSavedLocation) {
            updateLocation(activeSavedLocation.id, {
              locationType: t as LocationType,
            });
          }
        }}
        onUpdateWatch={(watch) => void handleUpdateWatch(watch)}
        cloudWatchBusy={cloudWatchBusyId === activeSavedLocation?.id}
        cloudWatchError={cloudWatchError}
        onEnableCloudWatch={() => void handleEnableCloudWatch()}
        onRefreshCloudWatch={() => void handleRefreshCloudWatch()}
        onDisableCloudWatch={() => void handleDisableCloudWatch()}
        onEnablePush={() => void handleEnablePush()}
        onTestPush={() => void handleTestPush()}
        onDisablePush={() => void handleDisablePush()}
        onDeleteLocation={() => {
          if (activeSavedLocation) {
            void handleDeleteSavedLocation(activeSavedLocation.id);
          }
        }}
        isSaving={isSaving}
        onEventClick={handleSelectEvent}
      />
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          location={result}
          radius={radius}
          exposure={exposure.data}
          exposureAvailable={exposure.available}
          exposureLoading={exposure.isLoading}
          exposureFetching={exposure.isFetching}
          exposureError={exposure.error}
          showExposureOnMap={showExposureOnMap}
          onShowExposureOnMapChange={setShowExposureOnMap}
          onClose={() => {
            setShowExposureOnMap(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  leftCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  firstRunPanel: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 16px",
    background: "#f7f9fb",
    borderBottom: "1px solid #dfe6ee",
  },
  firstRunContent: {
    minWidth: 0,
  },
  firstRunTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#212121",
    marginBottom: 4,
  },
  firstRunText: {
    fontSize: 13,
    color: "#616161",
    lineHeight: 1.4,
    maxWidth: 760,
  },
  exampleRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  exampleButton: {
    border: "1px solid #cfd8dc",
    borderRadius: 6,
    background: "#fff",
    color: "#1565c0",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 9px",
    cursor: "pointer",
  },
  firstRunAction: {
    flex: "0 0 auto",
    width: "min(180px, 100%)",
  },
  locationButton: {
    width: "100%",
    border: "1px solid #1565c0",
    borderRadius: 6,
    background: "#1565c0",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    padding: "8px 10px",
    cursor: "pointer",
  },
  geoError: {
    marginTop: 6,
    color: "#c62828",
    fontSize: 12,
    lineHeight: 1.3,
  },
};
