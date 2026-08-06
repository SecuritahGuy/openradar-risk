import type { ResolvedLocation, RadiusOption, Criticality, LocationType, Location, WatchPreferences } from "../types/location";
import type { RiskEvent } from "../types/riskEvent";
import type { SupplementalRiskSignal } from "../types/supplementalRisk";
import type { CurrentWeather } from "../services/weather";
import type { FemaRiskIndexCounty } from "../services/femaRiskIndex";
import type { NwsWeatherOverlay } from "../services/nwsWeatherOverlay";
import type { SourceHealthItem } from "../hooks/useRiskFeeds";
import type { WeatherLayerMode } from "../types/weatherLayer";
import { BaselineRiskPanel } from "./update/BaselineRiskPanel";
import { CurrentConditionsPanel } from "./update/CurrentConditionsPanel";
import { DataCoveragePanel } from "./update/DataCoveragePanel";
import { FeedErrorPanel, LastCheckedPanel } from "./update/FeedStatusPanels";
import { HistoricalContextPanel } from "./update/HistoricalContextPanel";
import { ImpactSummaryPanel } from "./update/ImpactSummaryPanel";
import { ActionGuidancePanel } from "./update/ActionGuidancePanel";
import { LocationActionPanel } from "./update/LocationActionPanel";
import { LocationDetailsPanel } from "./update/LocationDetailsPanel";
import { LocationWatchPanel } from "./update/LocationWatchPanel";
import { MapLayerControls } from "./update/MapLayerControls";
import { SignalSummaryPanel } from "./update/SignalSummaryPanel";
import { SituationBriefPanel } from "./update/SituationBriefPanel";
import { UpdatePanelHeader, UpdatePanelPlaceholder } from "./update/UpdatePanelHeader";
import { VisitChangesPanel } from "./update/VisitChangesPanel";

interface UpdatePanelProps {
  location: ResolvedLocation | null;
  radius: RadiusOption;
  onRadiusChange: (r: RadiusOption) => void;
  weatherAlerts: RiskEvent[];
  earthquakes: RiskEvent[];
  femaDeclarations: RiskEvent[];
  stormEvents: RiskEvent[];
  wildfires: RiskEvent[];
  spcOutlooks: RiskEvent[];
  spcReports: RiskEvent[];
  nhcStorms: RiskEvent[];
  gdacsEvents: RiskEvent[];
  eonetEvents: RiskEvent[];
  emscEvents: RiskEvent[];
  geonetEvents: RiskEvent[];
  geonetVolcanoEvents: RiskEvent[];
  dwdEvents: RiskEvent[];
  incidents: RiskEvent[];
  currentWeather: CurrentWeather | null;
  femaRiskIndex: FemaRiskIndexCounty | null;
  supplementalSignals: SupplementalRiskSignal[];
  baselineSignals: SupplementalRiskSignal[];
  sourceHealth: SourceHealthItem[];
  weatherOverlay: NwsWeatherOverlay | null;
  showWeatherOverlay: boolean;
  showHistoricalMapContext: boolean;
  historicalMapContextAvailable: boolean;
  weatherLayerMode: WeatherLayerMode;
  onToggleWeatherOverlay: (show: boolean) => void;
  onToggleHistoricalMapContext: (show: boolean) => void;
  onWeatherLayerModeChange: (mode: WeatherLayerMode) => void;
  weatherOverlayLoading: boolean;
  weatherOverlayError: string | null;
  isFetching: boolean;
  lastUpdated: Date | null;
  error: string | null;
  onRefresh: () => void;
  activeSavedLocation: Location | null;
  onSaveLocation: () => void;
  onShareView: () => Promise<"shared" | "copied" | "unavailable">;
  onUpdateLabel: (label: string) => void;
  onUpdateCriticality: (c: Criticality) => void;
  onUpdateType: (t: LocationType) => void;
  onUpdateWatch: (watch: WatchPreferences) => void;
  cloudWatchBusy: boolean;
  cloudWatchError: string | null;
  onEnableCloudWatch: () => void;
  onRefreshCloudWatch: () => void;
  onDisableCloudWatch: () => void;
  onEnablePush: () => void;
  onTestPush: () => void;
  onDisablePush: () => void;
  onDeleteLocation: () => void;
  isSaving: boolean;
  onEventClick: (event: RiskEvent) => void;
}

export function UpdatePanel({
  location,
  radius,
  onRadiusChange,
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
  incidents,
  currentWeather,
  femaRiskIndex,
  supplementalSignals,
  baselineSignals,
  sourceHealth,
  weatherOverlay,
  showWeatherOverlay,
  showHistoricalMapContext,
  historicalMapContextAvailable,
  weatherLayerMode,
  onToggleWeatherOverlay,
  onToggleHistoricalMapContext,
  onWeatherLayerModeChange,
  weatherOverlayLoading,
  weatherOverlayError,
  isFetching,
  lastUpdated,
  error,
  onRefresh,
  activeSavedLocation,
  onSaveLocation,
  onShareView,
  onUpdateLabel,
  onUpdateCriticality,
  onUpdateType,
  onUpdateWatch,
  cloudWatchBusy,
  cloudWatchError,
  onEnableCloudWatch,
  onRefreshCloudWatch,
  onDisableCloudWatch,
  onEnablePush,
  onTestPush,
  onDisablePush,
  onDeleteLocation,
  isSaving,
  onEventClick,
}: UpdatePanelProps) {
  const allEvents = incidents;
  const isSaved = !!activeSavedLocation;

  return (
    <aside className="update-panel" style={styles.container}>
      <UpdatePanelHeader
        isFetching={isFetching}
        hasLocation={!!location}
        onRefresh={onRefresh}
      />

      {location ? (
        <>
          <LocationDetailsPanel
            location={location}
            radius={radius}
            activeSavedLocation={activeSavedLocation}
            onRadiusChange={onRadiusChange}
            onUpdateLabel={onUpdateLabel}
            onUpdateCriticality={onUpdateCriticality}
            onUpdateType={onUpdateType}
          />

          {activeSavedLocation && (
            <LocationWatchPanel
              location={activeSavedLocation}
              onUpdate={onUpdateWatch}
              cloudWatchBusy={cloudWatchBusy}
              cloudWatchError={cloudWatchError}
              onEnableCloudWatch={onEnableCloudWatch}
              onRefreshCloudWatch={onRefreshCloudWatch}
              onDisableCloudWatch={onDisableCloudWatch}
              onEnablePush={onEnablePush}
              onTestPush={onTestPush}
              onDisablePush={onDisablePush}
            />
          )}

          <CurrentConditionsPanel
            currentWeather={currentWeather}
            location={location}
          />

          <SituationBriefPanel
            location={location}
            radius={radius}
            events={allEvents}
            currentWeather={currentWeather}
            sourceHealth={sourceHealth}
            onEventClick={onEventClick}
          />

          <ActionGuidancePanel
            events={allEvents}
            location={location}
            radius={radius}
            onEventClick={onEventClick}
          />

          <MapLayerControls
            radius={radius}
            onRadiusChange={onRadiusChange}
            weatherOverlay={weatherOverlay}
            showWeatherOverlay={showWeatherOverlay}
            showHistoricalMapContext={showHistoricalMapContext}
            historicalMapContextAvailable={historicalMapContextAvailable}
            weatherLayerMode={weatherLayerMode}
            onToggleWeatherOverlay={onToggleWeatherOverlay}
            onToggleHistoricalMapContext={onToggleHistoricalMapContext}
            onWeatherLayerModeChange={onWeatherLayerModeChange}
            weatherOverlayLoading={weatherOverlayLoading}
            weatherOverlayError={weatherOverlayError}
          />

          <LastCheckedPanel lastUpdated={lastUpdated} />

          <VisitChangesPanel
            location={location}
            events={allEvents}
            isFetching={isFetching}
          />

          <BaselineRiskPanel riskIndex={femaRiskIndex} />

          <HistoricalContextPanel
            femaDeclarations={femaDeclarations}
            stormEvents={stormEvents}
            onEventClick={onEventClick}
          />

          <SignalSummaryPanel
            weatherAlerts={weatherAlerts}
            earthquakes={earthquakes}
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
            supplementalSignals={supplementalSignals}
            baselineSignals={baselineSignals}
            isFetching={isFetching}
          />

          <ImpactSummaryPanel events={allEvents} location={location} radius={radius} />

          <FeedErrorPanel error={error} />

          <DataCoveragePanel items={sourceHealth} />

          <LocationActionPanel
            isSaved={isSaved}
            isSaving={isSaving}
            onSaveLocation={onSaveLocation}
            onShareView={onShareView}
            onDeleteLocation={onDeleteLocation}
          />
        </>
      ) : (
        <UpdatePanelPlaceholder />
      )}
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    background: "#fff",
    borderLeft: "1px solid #e0e0e0",
    padding: 16,
    overflowY: "auto",
    fontFamily: "system-ui, sans-serif",
  },
};
