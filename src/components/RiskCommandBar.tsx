import { useState } from "react";
import type { CurrentWeather } from "../services/weather";
import type { RadiusOption, ResolvedLocation } from "../types/location";
import type { RiskEvent } from "../types/riskEvent";
import {
  activeConcernEvents,
  attentionEvents,
  buildRiskSummary,
  distanceMiles,
  eventSourceLabel,
  explainRiskScore,
  expiresLabel,
  formatDistance,
  severityColor,
  sourceColor,
  sourceLabel,
} from "../lib/riskInsights";
import {
  buildImpactSummary,
  currentImpactConcernEvents,
} from "../lib/impactInsights";
import {
  buildSignalCorrelations,
  type SignalAgreement,
} from "../lib/signalCorrelation";

interface RiskCommandBarProps {
  location: ResolvedLocation | null;
  radius: RadiusOption;
  events: RiskEvent[];
  currentWeather: CurrentWeather | null;
  currentImpactOnly: boolean;
  onToggleCurrentImpact: (enabled: boolean) => void;
  onEventClick: (event: RiskEvent) => void;
}

function levelColor(level: ReturnType<typeof buildRiskSummary>["level"]): string {
  switch (level) {
    case "Critical":
      return "#b71c1c";
    case "High":
      return "#d84315";
    case "Elevated":
      return "#f57c00";
    case "Guarded":
      return "#2e7d32";
    case "Clear":
      return "#1565c0";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function agreementColor(agreement: SignalAgreement): string {
  switch (agreement) {
    case "corroborated":
      return "#2e7d32";
    case "single-source":
      return "#ef6c00";
  }
}

function AttentionCard({
  event,
  location,
  onClick,
}: {
  event: RiskEvent;
  location: ResolvedLocation | null;
  onClick: () => void;
}) {
  return (
    <button style={styles.attentionCard} onClick={onClick}>
      <div style={styles.attentionTop}>
        <span
          style={{
            ...styles.sourcePill,
            background: sourceColor(event.source),
          }}
        >
          {eventSourceLabel(event)}
        </span>
        <span
          style={{
            ...styles.severityText,
            color: severityColor(event.severity),
          }}
        >
          {event.severity}
        </span>
      </div>
      <div style={styles.attentionTitle}>{event.headline}</div>
      <div style={styles.attentionMeta}>
        {formatDistance(distanceMiles(location, event))} · {timeAgo(event.updatedAt)}
        {" · "}
        {expiresLabel(event)}
      </div>
    </button>
  );
}

function AgreementEventRow({
  event,
  location,
  onClick,
}: {
  event: RiskEvent;
  location: ResolvedLocation | null;
  onClick: () => void;
}) {
  return (
    <button type="button" style={styles.agreementEventRow} onClick={onClick}>
      <span
        style={{
          ...styles.sourcePill,
          background: sourceColor(event.source),
        }}
      >
        {eventSourceLabel(event)}
      </span>
      <span style={styles.agreementEventText}>{event.headline}</span>
      <span
        style={{
          ...styles.agreementEventSeverity,
          color: severityColor(event.severity),
        }}
      >
        {event.severity}
      </span>
      <span style={styles.agreementEventMeta}>
        {formatDistance(distanceMiles(location, event))} · {timeAgo(event.updatedAt)}
      </span>
    </button>
  );
}

export function RiskCommandBar({
  location,
  radius,
  events,
  currentWeather,
  currentImpactOnly,
  onToggleCurrentImpact,
  onEventClick,
}: RiskCommandBarProps) {
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(
    null
  );

  if (!location) {
    return (
      <div className="risk-command-empty" style={styles.empty}>
        <div>
          <strong>Search a ZIP code or city</strong>
          <span style={styles.emptyDetail}> to build a live risk snapshot.</span>
        </div>
      </div>
    );
  }

  const concernEvents = activeConcernEvents(events);
  const localConcernEvents = currentImpactConcernEvents(events, location, radius);
  const summary = buildRiskSummary(localConcernEvents);
  const scoreExplanation = explainRiskScore(localConcernEvents);
  const impactSummary = buildImpactSummary(concernEvents, location, radius);
  const historySummary = buildImpactSummary(events, location, radius);
  const topEvents = attentionEvents(localConcernEvents, location, 2);
  const correlations = buildSignalCorrelations(localConcernEvents).slice(0, 3);
  const selectedAgreement =
    correlations.find((signal) => signal.id === selectedAgreementId) ?? null;
  const color = levelColor(summary.level);

  return (
    <div className="risk-command-bar" style={styles.container}>
      <div className="risk-score-block" style={styles.scoreBlock}>
        <div style={styles.scoreHeaderRow}>
          <div style={styles.scoreLabel}>Risk posture</div>
          <button
            type="button"
            aria-expanded={showScoreDetails}
            aria-controls="risk-score-explanation"
            style={styles.explainButton}
            onClick={() => setShowScoreDetails((value) => !value)}
          >
            {showScoreDetails ? "Hide" : "Explain"}
          </button>
        </div>
        <div style={{ ...styles.scoreValue, color }}>{summary.level}</div>
        <div style={styles.scoreDetail}>{summary.topDriver}</div>
        {showScoreDetails ? (
          <div id="risk-score-explanation" style={styles.scoreExplanation}>
            <div style={styles.scoreRule}>
              {scoreExplanation.score} points. {scoreExplanation.rule}
            </div>
            <div style={styles.contributionList}>
              {scoreExplanation.contributions.map((item) => (
                <div key={item.id} style={styles.contributionRow}>
                  <span>{item.label}</span>
                  <strong>
                    {item.count} / {item.points} pts
                  </strong>
                </div>
              ))}
            </div>
            {scoreExplanation.sourceCounts.length > 0 ? (
              <div style={styles.sourceSummary}>
                Sources:{" "}
                {scoreExplanation.sourceCounts
                  .map((item) => `${sourceLabel(item.source)} ${item.count}`)
                  .join(" · ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="risk-metric-grid" style={styles.metricGrid}>
        <button
          type="button"
          style={{
            ...styles.metric,
            ...(currentImpactOnly ? styles.metricActive : {}),
          }}
          onClick={() => onToggleCurrentImpact(!currentImpactOnly)}
          title="Show only events affecting or near this location"
        >
          <span style={styles.metricValue}>{impactSummary.currentImpactCount}</span>
          <span style={styles.metricLabel}>
            {currentImpactOnly ? "Showing impact" : "Current impact"}
          </span>
        </button>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{impactSummary.affectsCount}</span>
          <span style={styles.metricLabel}>Affects area</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>
            {summary.criticalCount + summary.severeCount}
          </span>
          <span style={styles.metricLabel}>High priority</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{historySummary.historicalCount}</span>
          <span style={styles.metricLabel}>History</span>
        </div>
      </div>

      <div className="risk-weather-block" style={styles.weatherBlock}>
        <div style={styles.scoreLabel}>Conditions</div>
        {currentWeather ? (
          <>
            <div style={styles.weatherTemp}>
              {Math.round(currentWeather.temperature)}&deg;F
            </div>
            <div style={styles.scoreDetail}>
              {currentWeather.humidity}% humidity ·{" "}
              {Math.round(currentWeather.windSpeed)} mph wind
            </div>
          </>
        ) : (
          <div style={styles.scoreDetail}>Waiting for NWS conditions</div>
        )}
      </div>

      <div className="risk-attention-list" style={styles.attentionList}>
        <div style={styles.attentionHeader}>Needs attention</div>
        {topEvents.length > 0 ? (
          topEvents.map((event) => (
            <AttentionCard
              key={event.id}
              event={event}
              location={location}
              onClick={() => onEventClick(event)}
            />
          ))
        ) : (
          <div style={styles.noAttention}>No active signals in scope.</div>
        )}
      </div>

      <div className="risk-source-agreement" style={styles.agreementStrip}>
        <div style={styles.agreementHeader}>
          <span style={styles.scoreLabel}>Source agreement</span>
          <span style={styles.agreementHint}>
            Confirms the same incident across independent providers
          </span>
        </div>
        <div className="source-agreement-list" style={styles.agreementList}>
          {correlations.length > 0 ? (
            correlations.map((signal) => {
              const signalColor = agreementColor(signal.agreement);
              const active = selectedAgreement?.id === signal.id;
              return (
                <button
                  key={signal.id}
                  type="button"
                  style={{
                    ...styles.agreementItem,
                    ...(active ? styles.agreementItemActive : {}),
                  }}
                  aria-expanded={active}
                  aria-controls="source-agreement-detail"
                  onClick={() =>
                    setSelectedAgreementId((current) =>
                      current === signal.id ? null : signal.id
                    )
                  }
                >
                  <span
                    style={{
                      ...styles.agreementBadge,
                      color: signalColor,
                      background: `${signalColor}14`,
                    }}
                  >
                    {signal.agreementLabel}
                  </span>
                  <span style={styles.agreementTitle}>{signal.label}</span>
                  <span style={styles.agreementMeta}>
                    {signal.providerLabels.join(" + ")} · {signal.eventCount} provider record
                    {signal.eventCount !== 1 ? "s" : ""}
                    {signal.latestUpdatedAt
                      ? ` · updated ${timeAgo(signal.latestUpdatedAt)}`
                      : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={styles.agreementEmpty}>
              No active signals to correlate yet.
            </div>
          )}
        </div>
        {selectedAgreement && (
          <div
            id="source-agreement-detail"
            className="source-agreement-detail"
            style={styles.agreementDetail}
          >
            <div style={styles.agreementDetailHeader}>
              <div>
                <div style={styles.agreementDetailTitle}>
                  {selectedAgreement.label}
                </div>
                <div style={styles.agreementDetailSummary}>
                  {selectedAgreement.summary}
                </div>
              </div>
              <button
                type="button"
                style={styles.agreementCloseButton}
                onClick={() => setSelectedAgreementId(null)}
                aria-label="Close source agreement detail"
              >
                Close
              </button>
            </div>
            <div className="source-agreement-event-list" style={styles.agreementEventList}>
              {selectedAgreement.events.map((event) => (
                <AgreementEventRow
                  key={event.id}
                  event={event}
                  location={location}
                  onClick={() => onEventClick(event)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "grid",
    gridTemplateColumns: "170px minmax(240px, 300px) 150px minmax(220px, 1fr)",
    gap: 12,
    alignItems: "stretch",
    padding: "10px 12px",
    background: "#f7f9fb",
    borderBottom: "1px solid #dfe6ee",
    minHeight: 106,
  },
  empty: {
    padding: "10px 12px",
    background: "#f7f9fb",
    borderBottom: "1px solid #dfe6ee",
    color: "#424242",
    fontSize: 13,
  },
  emptyDetail: {
    color: "#616161",
    fontWeight: 400,
  },
  scoreBlock: {
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    padding: "10px 12px",
    minWidth: 0,
  },
  scoreHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  scoreLabel: {
    fontSize: 10,
    color: "#616161",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.1,
    marginTop: 4,
  },
  scoreDetail: {
    fontSize: 12,
    color: "#616161",
    marginTop: 4,
    lineHeight: 1.35,
  },
  explainButton: {
    border: "1px solid #cfd8dc",
    background: "#fff",
    borderRadius: 6,
    color: "#1565c0",
    cursor: "pointer",
    font: "inherit",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
  },
  scoreExplanation: {
    borderTop: "1px solid #eef2f5",
    marginTop: 8,
    paddingTop: 8,
    maxHeight: 168,
    overflowY: "auto",
  },
  scoreRule: {
    color: "#424242",
    fontSize: 11,
    lineHeight: 1.35,
  },
  contributionList: {
    display: "grid",
    gap: 4,
    marginTop: 8,
  },
  contributionRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "#616161",
    fontSize: 11,
    lineHeight: 1.25,
  },
  sourceSummary: {
    color: "#616161",
    fontSize: 10,
    lineHeight: 1.35,
    marginTop: 8,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },
  metric: {
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    padding: "10px 8px",
    textAlign: "left",
    cursor: "pointer",
    font: "inherit",
  },
  metricActive: {
    border: "1px solid #1565c0",
    boxShadow: "inset 0 0 0 1px #1565c0",
    cursor: "pointer",
  },
  metricValue: {
    display: "block",
    fontSize: 22,
    fontWeight: 800,
    color: "#212121",
    lineHeight: 1.1,
  },
  metricLabel: {
    display: "block",
    fontSize: 11,
    color: "#616161",
    marginTop: 4,
  },
  weatherBlock: {
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    padding: "10px 12px",
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.1,
    marginTop: 4,
    color: "#212121",
  },
  attentionList: {
    display: "grid",
    gridTemplateColumns: "auto repeat(2, minmax(110px, 1fr))",
    gap: 8,
    alignItems: "stretch",
    minWidth: 0,
  },
  agreementStrip: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "170px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    padding: "9px 10px",
  },
  agreementHeader: {
    display: "grid",
    gap: 3,
  },
  agreementHint: {
    color: "#616161",
    fontSize: 11,
    lineHeight: 1.25,
  },
  agreementList: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    minWidth: 0,
  },
  agreementItem: {
    border: "1px solid #edf1f5",
    borderRadius: 7,
    background: "#fff",
    cursor: "pointer",
    font: "inherit",
    padding: "7px 8px",
    minWidth: 0,
    textAlign: "left",
  },
  agreementItemActive: {
    border: "1px solid #1565c0",
    boxShadow: "inset 0 0 0 1px #1565c0",
  },
  agreementBadge: {
    display: "inline-block",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1,
    marginBottom: 5,
    padding: "3px 5px",
    textTransform: "uppercase",
  },
  agreementTitle: {
    display: "block",
    color: "#212121",
    fontSize: 12,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  agreementMeta: {
    display: "block",
    color: "#616161",
    fontSize: 10,
    lineHeight: 1.3,
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  agreementEmpty: {
    gridColumn: "1 / -1",
    color: "#616161",
    fontSize: 12,
  },
  agreementDetail: {
    gridColumn: "1 / -1",
    borderTop: "1px solid #edf1f5",
    marginTop: 2,
    paddingTop: 9,
  },
  agreementDetailHeader: {
    alignItems: "flex-start",
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
  },
  agreementDetailTitle: {
    color: "#263238",
    fontSize: 13,
    fontWeight: 800,
  },
  agreementDetailSummary: {
    color: "#546e7a",
    fontSize: 11,
    lineHeight: 1.35,
    marginTop: 2,
  },
  agreementCloseButton: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#546e7a",
    cursor: "pointer",
    font: "inherit",
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 7px",
  },
  agreementEventList: {
    display: "grid",
    gap: 6,
    marginTop: 8,
  },
  agreementEventRow: {
    alignItems: "center",
    background: "#f8fbfd",
    border: "1px solid #e3e9ef",
    borderRadius: 7,
    color: "#263238",
    cursor: "pointer",
    display: "grid",
    font: "inherit",
    gap: 7,
    gridTemplateColumns: "64px minmax(0, 1fr) 76px 96px",
    padding: "7px 8px",
    textAlign: "left",
  },
  agreementEventText: {
    fontSize: 12,
    fontWeight: 700,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  agreementEventSeverity: {
    fontSize: 10,
    fontWeight: 800,
    textAlign: "right",
  },
  agreementEventMeta: {
    color: "#616161",
    fontSize: 10,
    overflow: "hidden",
    textAlign: "right",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  attentionHeader: {
    alignSelf: "center",
    fontSize: 10,
    color: "#616161",
    fontWeight: 700,
    textTransform: "uppercase",
    padding: "0 4px",
  },
  attentionCard: {
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    background: "#fff",
    padding: "8px 10px",
    textAlign: "left",
    cursor: "pointer",
    minWidth: 0,
  },
  attentionTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 5,
  },
  sourcePill: {
    fontSize: 9,
    fontWeight: 800,
    color: "#fff",
    padding: "2px 5px",
    borderRadius: 3,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 800,
  },
  attentionTitle: {
    fontSize: 12,
    lineHeight: 1.25,
    fontWeight: 700,
    color: "#212121",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  attentionMeta: {
    fontSize: 10,
    color: "#616161",
    marginTop: 5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  noAttention: {
    gridColumn: "span 2",
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 8,
    padding: "14px",
    fontSize: 12,
    color: "#616161",
  },
};
