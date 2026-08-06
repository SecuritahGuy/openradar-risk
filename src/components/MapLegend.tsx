import { useState } from "react";
import type { WeatherLayerMode } from "../types/weatherLayer";

interface LegendItem {
  label: string;
  color: string;
  shape: "circle" | "square" | "diamond" | "ring";
}

const ITEMS: LegendItem[] = [
  { label: "Weather alert", color: "#f57c00", shape: "square" },
  { label: "Earthquake", color: "#2e7d32", shape: "circle" },
  { label: "River gauge", color: "#0288d1", shape: "circle" },
  { label: "Volcano", color: "#8d6e63", shape: "circle" },
  { label: "Drought", color: "#795548", shape: "circle" },
  { label: "FEMA record", color: "#7b1fa2", shape: "square" },
  { label: "Wildfire", color: "#d84315", shape: "circle" },
  { label: "State/local hazard", color: "#ad1457", shape: "circle" },
  { label: "Road work / closure", color: "#37474f", shape: "circle" },
  { label: "SPC outlook / report", color: "#00897b", shape: "square" },
  { label: "Tropical cyclone", color: "#c62828", shape: "circle" },
  { label: "Global disaster", color: "#1565c0", shape: "circle" },
  { label: "Earth observation", color: "#6a1b9a", shape: "circle" },
  { label: "Air quality", color: "#455a64", shape: "circle" },
  { label: "Coastal water", color: "#0277bd", shape: "circle" },
  { label: "Space weather", color: "#5e35b1", shape: "circle" },
  { label: "Radius ring", color: "#1565c0", shape: "diamond" },
];

const WEATHER_ZONE_ITEMS: LegendItem[] = [
  { label: "Forecast zone", color: "#6a1b9a", shape: "diamond" },
  { label: "Fire weather zone", color: "#d84315", shape: "diamond" },
];

const VOLCANO_BASELINE_ITEM: LegendItem = {
  label: "Historical volcano",
  color: "#ef6c00",
  shape: "ring",
};

const EXPOSURE_FACILITY_ITEM: LegendItem = {
  label: "Mapped facility context",
  color: "#37474f",
  shape: "ring",
};

function weatherModeItems(mode: WeatherLayerMode): LegendItem[] {
  if (mode === "precip") {
    return [
      { label: "Precip >=80%", color: "#0d47a1", shape: "square" },
      { label: "Precip 40-79%", color: "#0288d1", shape: "square" },
      { label: "Precip <40%", color: "#4fc3f7", shape: "square" },
    ];
  }
  if (mode === "thunder") {
    return [
      { label: "Thunder >=80%", color: "#6a1b9a", shape: "square" },
      { label: "Thunder 40-79%", color: "#ab47bc", shape: "square" },
      { label: "Thunder <40%", color: "#ce93d8", shape: "square" },
    ];
  }
  if (mode === "heat") {
    return [
      { label: "Heat risk 4+", color: "#7f0000", shape: "square" },
      { label: "Heat risk 2-3", color: "#ef6c00", shape: "square" },
      { label: "Heat risk 0-1", color: "#2e7d32", shape: "square" },
    ];
  }
  if (mode === "wind") {
    return [
      { label: "Wind >=25 mph", color: "#c62828", shape: "square" },
      { label: "Wind 8-24 mph", color: "#0277bd", shape: "square" },
      { label: "Wind <8 mph", color: "#2e7d32", shape: "square" },
      { label: "Station wind", color: "#0277bd", shape: "circle" },
    ];
  }
  if (mode === "stations") {
    return [
      { label: "NWS station", color: "#2e7d32", shape: "circle" },
      { label: "Cool station", color: "#1565c0", shape: "circle" },
      { label: "Hot station", color: "#d84315", shape: "circle" },
    ];
  }
  return [
    { label: "Temp >=90F", color: "#d84315", shape: "square" },
    { label: "Temp 50-89F", color: "#2e7d32", shape: "square" },
    { label: "Temp <50F", color: "#1565c0", shape: "square" },
    { label: "Station temp", color: "#2e7d32", shape: "circle" },
  ];
}

function Shape({ item }: { item: LegendItem }) {
  const style: React.CSSProperties = {
    width: 12,
    height: 12,
    border: `2px solid ${item.color}`,
    flexShrink: 0,
  };
  if (item.shape === "circle") {
    return (
      <div
        style={{
          ...style,
          borderRadius: "50%",
          background: `${item.color}55`,
        }}
      />
    );
  }
  if (item.shape === "ring") {
    return (
      <div
        style={{
          ...style,
          borderRadius: "50%",
          borderStyle: "dashed",
          background: `${item.color}12`,
        }}
      />
    );
  }
  if (item.shape === "diamond") {
    return (
      <div
        style={{
          ...style,
          transform: "rotate(45deg)",
          margin: 4,
          borderStyle: "dashed",
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...style,
        background: `${item.color}22`,
        borderRadius: 2,
      }}
    />
  );
}

export function MapLegend({
  showWeatherOverlay,
  weatherLayerMode,
  showVolcanoBaseline,
  showExposureFacilities,
}: {
  showWeatherOverlay: boolean;
  weatherLayerMode: WeatherLayerMode;
  showVolcanoBaseline: boolean;
  showExposureFacilities: boolean;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
  const baselineItems = showVolcanoBaseline
    ? [...ITEMS, VOLCANO_BASELINE_ITEM]
    : ITEMS;
  const baseItems = showExposureFacilities
    ? [...baselineItems, EXPOSURE_FACILITY_ITEM]
    : baselineItems;
  const items = showWeatherOverlay
    ? [...baseItems, ...weatherModeItems(weatherLayerMode), ...WEATHER_ZONE_ITEMS]
    : baseItems;

  if (collapsed) {
    return (
      <button
        type="button"
        className="map-legend map-legend-toggle"
        style={{ ...styles.legend, ...styles.collapsedButton }}
        onClick={() => setCollapsed(false)}
        aria-expanded="false"
        aria-controls="map-legend-list"
        title="Show map legend"
      >
        Legend
        <span style={styles.count}>{items.length}</span>
      </button>
    );
  }

  return (
    <div
      className="map-legend"
      style={styles.legend}
      data-expanded="true"
      id="map-legend-list"
    >
      <div style={styles.header}>
        <div style={styles.title}>Legend</div>
        <button
          type="button"
          style={styles.hideButton}
          onClick={() => setCollapsed(true)}
          aria-expanded="true"
          aria-controls="map-legend-list"
          title="Hide map legend"
        >
          Hide
        </button>
      </div>
      <div style={styles.itemList}>
        {items.map((item) => (
          <div key={item.label} style={styles.row}>
            <Shape item={item} />
            <span style={styles.label}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  legend: {
    position: "absolute",
    bottom: 24,
    right: 12,
    zIndex: 1000,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(189, 189, 189, 0.72)",
    borderRadius: 8,
    padding: "8px 12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, sans-serif",
    fontSize: 11,
    lineHeight: 1.6,
  },
  collapsedButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#424242",
    cursor: "pointer",
    fontWeight: 800,
    lineHeight: 1,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e8f0fe",
    color: "#1565c0",
    fontSize: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontWeight: 700,
    color: "#616161",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hideButton: {
    border: "1px solid #d8e0e7",
    borderRadius: 5,
    background: "#fff",
    color: "#455a64",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    padding: "4px 6px",
  },
  itemList: {
    display: "grid",
    gap: 2,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  label: {
    color: "#424242",
    whiteSpace: "nowrap",
  },
};
