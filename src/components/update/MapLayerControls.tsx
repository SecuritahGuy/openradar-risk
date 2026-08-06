import type { RadiusOption } from "../../types/location";
import type { NwsWeatherOverlay } from "../../services/nwsWeatherOverlay";
import {
  WEATHER_LAYER_OPTIONS,
  type WeatherLayerMode,
} from "../../types/weatherLayer";

interface MapLayerControlsProps {
  radius: RadiusOption;
  onRadiusChange: (radius: RadiusOption) => void;
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
}

export function MapLayerControls({
  radius,
  onRadiusChange,
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
}: MapLayerControlsProps) {
  return (
    <>
      <div style={styles.section}>
        <div style={styles.label}>Radius</div>
        <div style={styles.radiusRow}>
          {([10, 25, 50, 100] as RadiusOption[]).map((option) => (
            <button
              key={option}
              onClick={() => onRadiusChange(option)}
              style={{
                ...styles.radiusBtn,
                ...(option === radius ? styles.radiusBtnActive : {}),
              }}
            >
              {option} mi
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Map layers</div>
        <label style={styles.toggleRow}>
          <input
            type="checkbox"
            checked={showWeatherOverlay}
            onChange={(event) => onToggleWeatherOverlay(event.target.checked)}
            style={styles.checkbox}
          />
          <span>
            NWS weather grid, zones, and stations
          </span>
        </label>
        <label style={{ ...styles.toggleRow, marginTop: 9 }}>
          <input
            type="checkbox"
            checked={showHistoricalMapContext}
            disabled={!historicalMapContextAvailable}
            onChange={(event) => onToggleHistoricalMapContext(event.target.checked)}
            style={styles.checkbox}
          />
          <span>Historical and older incident context</span>
        </label>
        <div style={styles.detail}>
          {historicalMapContextAvailable
            ? "Off by default. Historical markers never affect current risk posture."
            : "No historical map context is available for this location."}
        </div>
        {showWeatherOverlay && (
          <div style={styles.detail}>
            {weatherOverlayLoading
              ? "Loading NWS map layer..."
              : weatherOverlay
                ? `${weatherOverlay.stations.length} station observation${weatherOverlay.stations.length !== 1 ? "s" : ""} plus forecast and fire weather zones`
                : "Waiting for NWS map layer"}
          </div>
        )}
        {showWeatherOverlay && (
          <div style={styles.modeRow} aria-label="NWS map layer mode">
            {WEATHER_LAYER_OPTIONS.map((option) => {
              const active = option.mode === weatherLayerMode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  style={{
                    ...styles.modeBtn,
                    ...(active ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => onWeatherLayerModeChange(option.mode)}
                  aria-pressed={active}
                  title={`Show NWS ${option.label.toLowerCase()} layer`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
        {showWeatherOverlay && weatherOverlayError && (
          <div style={styles.layerError}>{weatherOverlayError}</div>
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#616161",
    marginBottom: 4,
  },
  detail: { fontSize: 13, color: "#616161", marginTop: 2 },
  radiusRow: { display: "flex", gap: 6, marginTop: 4 },
  radiusBtn: {
    padding: "4px 12px",
    fontSize: 12,
    border: "1px solid #bdbdbd",
    borderRadius: 4,
    background: "#fafafa",
    cursor: "pointer",
    fontWeight: 600,
    color: "#424242",
  },
  radiusBtnActive: {
    background: "#1565c0",
    color: "#fff",
    borderColor: "#1565c0",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#424242",
    cursor: "pointer",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#1565c0",
  },
  modeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  modeBtn: {
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
  modeBtnActive: {
    border: "1px solid #00897b",
    background: "#00897b",
    color: "#fff",
  },
  layerError: {
    fontSize: 12,
    color: "#c62828",
    marginTop: 4,
  },
};
