import type { RiskEvent } from "../../types/riskEvent";
import type { SupplementalRiskSignal } from "../../types/supplementalRisk";
import { activeConcernEvents, severityColor } from "../../lib/riskInsights";

interface SignalSummaryPanelProps {
  weatherAlerts: RiskEvent[];
  earthquakes: RiskEvent[];
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
  supplementalSignals: SupplementalRiskSignal[];
  baselineSignals: SupplementalRiskSignal[];
  isFetching: boolean;
}

interface SignalLineProps {
  active: boolean;
  color: string;
  children: React.ReactNode;
}

function SignalLine({ active, color, children }: SignalLineProps) {
  return (
    <div style={styles.signal}>
      <span
        style={{
          ...styles.signalDot,
          color: active ? color : "#9e9e9e",
        }}
      >
        &#9679;
      </span>{" "}
      {children}
    </div>
  );
}

function SupplementalSignalLine({ signal }: { signal: SupplementalRiskSignal }) {
  const metricSummary = signal.metrics
    .slice(0, 3)
    .map((metric) => `${metric.label} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`)
    .join(" · ");

  return (
    <div style={styles.supplementalLine}>
      <span
        style={{
          ...styles.signalDot,
          color: severityColor(signal.severity),
        }}
      >
        &#9679;
      </span>{" "}
      <span style={styles.supplementalHeadline}>{signal.headline}</span>
      {metricSummary && (
        <div style={styles.supplementalMetrics}>{metricSummary}</div>
      )}
    </div>
  );
}

function BaselineSignalLine({ signal }: { signal: SupplementalRiskSignal }) {
  return (
    <article style={styles.baselineCard}>
      <div style={styles.baselineHeader}>
        <span style={styles.baselineHeadline}>{signal.headline}</span>
        <span style={styles.baselineBadge}>Historical</span>
      </div>
      <div style={styles.baselineDescription}>{signal.description}</div>
      <dl style={styles.baselineMetrics}>
        {signal.metrics.map((metric) => (
          <div key={metric.label} style={styles.baselineMetric}>
            <dt style={styles.baselineMetricLabel}>{metric.label}</dt>
            <dd style={styles.baselineMetricValue}>{metric.value}{metric.unit ? ` ${metric.unit}` : ""}</dd>
          </div>
        ))}
      </dl>
      {signal.url && (
        <a href={signal.url} target="_blank" rel="noreferrer" style={styles.baselineLink}>
          Smithsonian GVP record &rarr;
        </a>
      )}
    </article>
  );
}

export function SignalSummaryPanel({
  weatherAlerts,
  earthquakes,
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
  supplementalSignals,
  baselineSignals,
  isFetching,
}: SignalSummaryPanelProps) {
  const now = Date.now();
  const currentWeatherAlerts = activeConcernEvents(weatherAlerts, now);
  const currentEarthquakes = activeConcernEvents(earthquakes, now);
  const currentWildfires = activeConcernEvents(wildfires, now);
  const currentSpcOutlooks = activeConcernEvents(spcOutlooks, now);
  const currentSpcReports = activeConcernEvents(spcReports, now);
  const currentNhcStorms = activeConcernEvents(nhcStorms, now);
  const currentGdacsEvents = activeConcernEvents(gdacsEvents, now);
  const currentEonetEvents = activeConcernEvents(eonetEvents, now);
  const currentEmscEvents = activeConcernEvents(emscEvents, now);
  const currentGeonetEvents = activeConcernEvents(geonetEvents, now);
  const currentGeonetVolcanoEvents = activeConcernEvents(geonetVolcanoEvents, now);
  const currentDwdEvents = activeConcernEvents(dwdEvents, now);
  const airQualitySignals = supplementalSignals.filter((s) => s.category === "Air Quality");
  const marineSignals = supplementalSignals.filter((s) => s.category === "Coastal Water");
  const riverSignals = supplementalSignals.filter((s) => s.category === "River Gauge");
  const volcanoSignals = supplementalSignals.filter((s) => s.category === "Volcano");
  const droughtSignals = supplementalSignals.filter((s) => s.category === "Drought");
  const spaceWeatherSignals = supplementalSignals.filter((s) => s.category === "Space Weather");
  const pollenSignals = supplementalSignals.filter((s) => s.category === "Pollen");
  const uvSignals = supplementalSignals.filter((s) => s.category === "UV Index");
  const seismicSignals = supplementalSignals.filter((s) => s.category === "Seismic");
  const shownSupplementalCount =
    airQualitySignals.length +
    marineSignals.length +
    riverSignals.length +
    volcanoSignals.length +
    droughtSignals.length +
    spaceWeatherSignals.length +
    pollenSignals.length +
    uvSignals.length +
    seismicSignals.length;

  return (
    <>
      <div style={styles.section}>
        <div style={styles.label}>
          Current signals
          {isFetching && <span style={styles.spinner}> &#8987;</span>}
        </div>
        <SignalLine active={currentWeatherAlerts.length > 0} color="#f57c00">
          {currentWeatherAlerts.length > 0
            ? `${currentWeatherAlerts.length} active weather alert${currentWeatherAlerts.length !== 1 ? "s" : ""} nearby`
            : "No active weather alerts"}
        </SignalLine>
        <SignalLine active={currentEarthquakes.length > 0} color="#2e7d32">
          {currentEarthquakes.length > 0
            ? `${currentEarthquakes.length} current earthquake${currentEarthquakes.length !== 1 ? "s" : ""} nearby`
            : "No current earthquakes nearby"}
        </SignalLine>
        <SignalLine active={currentEmscEvents.length > 0} color="#43a047">
          {currentEmscEvents.length > 0
            ? `${currentEmscEvents.length} current EMSC earthquake${currentEmscEvents.length !== 1 ? "s" : ""} nearby`
            : "No current EMSC earthquakes nearby"}
        </SignalLine>
        <SignalLine active={currentGeonetEvents.length > 0} color="#2e7d32">
          {currentGeonetEvents.length > 0
            ? `${currentGeonetEvents.length} current GeoNet earthquake${currentGeonetEvents.length !== 1 ? "s" : ""} nearby`
            : "No current GeoNet earthquakes nearby"}
        </SignalLine>
        <SignalLine active={currentGeonetVolcanoEvents.length > 0} color="#8d6e63">
          {currentGeonetVolcanoEvents.length > 0
            ? `${currentGeonetVolcanoEvents.length} elevated GeoNet volcanic alert${currentGeonetVolcanoEvents.length !== 1 ? "s" : ""} nearby`
            : "No elevated GeoNet volcanic alerts nearby"}
        </SignalLine>
        <SignalLine active={currentDwdEvents.length > 0} color="#1565c0">
          {currentDwdEvents.length > 0
            ? `${currentDwdEvents.length} official DWD warning${currentDwdEvents.length !== 1 ? "s" : ""} nearby`
            : "No DWD warnings nearby"}
        </SignalLine>
        <SignalLine active={currentWildfires.length > 0} color="#d84315">
          {currentWildfires.length > 0
            ? `${currentWildfires.length} current wildfire${currentWildfires.length !== 1 ? "s" : ""} nearby`
            : "No current wildfires nearby"}
        </SignalLine>
        <SignalLine active={currentSpcOutlooks.length > 0} color="#00897b">
          {currentSpcOutlooks.length > 0
            ? `${currentSpcOutlooks.length} SPC outlook polygon${currentSpcOutlooks.length !== 1 ? "s" : ""} nearby`
            : "No SPC outlook polygons nearby"}
        </SignalLine>
        <SignalLine active={currentSpcReports.length > 0} color="#00796b">
          {currentSpcReports.length > 0
            ? `${currentSpcReports.length} preliminary SPC storm report${currentSpcReports.length !== 1 ? "s" : ""} nearby today`
            : "No preliminary SPC storm reports nearby today"}
        </SignalLine>
        <SignalLine active={currentNhcStorms.length > 0} color="#c62828">
          {currentNhcStorms.length > 0
            ? `${currentNhcStorms.length} active tropical cyclone${currentNhcStorms.length !== 1 ? "s" : ""} in range`
            : "No active tropical cyclones in range"}
        </SignalLine>
        <SignalLine active={currentGdacsEvents.length > 0} color="#1565c0">
          {currentGdacsEvents.length > 0
            ? `${currentGdacsEvents.length} current GDACS global event${currentGdacsEvents.length !== 1 ? "s" : ""} nearby`
            : "No current GDACS global events nearby"}
        </SignalLine>
        <SignalLine active={currentEonetEvents.length > 0} color="#6a1b9a">
          {currentEonetEvents.length > 0
            ? `${currentEonetEvents.length} current NASA EONET event${currentEonetEvents.length !== 1 ? "s" : ""} nearby`
            : "No current NASA EONET events nearby"}
        </SignalLine>
        <SignalLine active={volcanoSignals.length > 0} color="#8d6e63">
          {volcanoSignals.length > 0
            ? `${volcanoSignals.length} elevated volcano status signal${volcanoSignals.length !== 1 ? "s" : ""} nearby`
            : "No elevated volcano status nearby"}
        </SignalLine>
        <SignalLine active={droughtSignals.length > 0} color="#795548">
          {droughtSignals.length > 0
            ? `${droughtSignals[0].headline}`
            : "No drought classification at this location"}
        </SignalLine>
        <SignalLine active={spaceWeatherSignals.length > 0} color="#5e35b1">
          {spaceWeatherSignals.length > 0
            ? `${spaceWeatherSignals.length} SWPC space weather signal${spaceWeatherSignals.length !== 1 ? "s" : ""}`
            : "No elevated space weather signal"}
        </SignalLine>
      </div>

      {supplementalSignals.length > 0 && (
        <div style={styles.section}>
          <div style={styles.label}>Environmental signals</div>
          {airQualitySignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {marineSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {riverSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {volcanoSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {droughtSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {pollenSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {uvSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {spaceWeatherSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {seismicSignals.map((signal) => (
            <SupplementalSignalLine key={signal.id} signal={signal} />
          ))}
          {supplementalSignals.length > shownSupplementalCount && (
            <div style={styles.detail}>
              {supplementalSignals.length - shownSupplementalCount} additional supplemental signal
              {supplementalSignals.length - shownSupplementalCount !== 1 ? "s" : ""}
            </div>
          )}
          <div style={styles.detail}>
            Sources: {[
              airQualitySignals.length || marineSignals.length || pollenSignals.length || uvSignals.length ? "Open-Meteo" : null,
              marineSignals.some((s) => s.source === "NOAA_TSUNAMI") ? "NOAA Tsunami" : null,
              riverSignals.some((signal) => signal.source === "USGS_WATER") ? "USGS Water" : null,
              riverSignals.some((signal) => signal.source === "NWPS") ? "NOAA River Forecasts" : null,
              riverSignals.some((s) => s.source === "UK_EA") ? "UK Environment Agency" : null,
              volcanoSignals.length ? "USGS Volcanoes" : null,
              droughtSignals.length ? "Drought Monitor" : null,
              spaceWeatherSignals.length ? "SWPC" : null,
              seismicSignals.length ? "USGS ShakeMap" : null,
            ].filter(Boolean).join(", ")}
          </div>
        </div>
      )}

      {baselineSignals.length > 0 && (
        <div style={styles.section} data-testid="volcano-baseline-context">
          <div style={styles.label}>Nearby baseline context</div>
          <div style={styles.baselineNote}>
            Smithsonian Holocene volcano records are geographic reference data,
            not current activity alerts. They do not affect risk posture or
            background notifications.
          </div>
          {baselineSignals.map((signal) => (
            <BaselineSignalLine key={signal.id} signal={signal} />
          ))}
        </div>
      )}
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
  signal: {
    fontSize: 13,
    color: "#616161",
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  signalDot: { fontSize: 10 },
  supplementalLine: {
    fontSize: 13,
    color: "#424242",
    marginTop: 8,
  },
  supplementalHeadline: {
    fontWeight: 600,
  },
  supplementalMetrics: {
    fontSize: 11,
    color: "#616161",
    marginLeft: 16,
    marginTop: 2,
  },
  baselineCard: {
    background: "#fffaf3",
    border: "1px solid #ffe0b2",
    borderRadius: 7,
    marginTop: 8,
    padding: 9,
  },
  baselineHeader: {
    alignItems: "flex-start",
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
  },
  baselineHeadline: { color: "#3e2723", fontSize: 13, fontWeight: 800 },
  baselineBadge: {
    background: "#fff3e0",
    borderRadius: 999,
    color: "#a84300",
    fontSize: 9,
    fontWeight: 900,
    padding: "3px 6px",
    textTransform: "uppercase",
  },
  baselineDescription: {
    color: "#5d4037",
    fontSize: 11,
    lineHeight: 1.45,
    marginTop: 6,
  },
  baselineMetrics: {
    display: "grid",
    gap: 5,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    margin: "8px 0 0",
  },
  baselineMetric: {
    minWidth: 0,
  },
  baselineMetricLabel: {
    color: "#8d6e63",
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  baselineMetricValue: {
    color: "#4e342e",
    fontSize: 10,
    margin: "2px 0 0",
    overflowWrap: "anywhere",
  },
  baselineNote: {
    color: "#6d4c41",
    fontSize: 11,
    lineHeight: 1.45,
  },
  baselineLink: {
    color: "#1565c0",
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    marginTop: 8,
  },
  spinner: { fontSize: 13 },
};
