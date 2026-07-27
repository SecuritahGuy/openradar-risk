import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  SourceHealthItem,
  SourceHealthStatus,
} from "../../hooks/useRiskFeeds";
import { fetchApiStatus } from "../../services/apiStatus";

interface DataCoveragePanelProps {
  items: SourceHealthItem[];
}

function statusLabel(status: SourceHealthStatus): string {
  switch (status) {
    case "disabled":
      return "Waiting";
    case "loading":
      return "Checking";
    case "live":
      return "Live";
    case "empty":
      return "No signal";
    case "degraded":
      return "Cached";
    case "error":
      return "Error";
    case "unavailable":
      return "Unavailable";
  }
}

function statusColor(status: SourceHealthStatus): string {
  switch (status) {
    case "live":
      return "#2e7d32";
    case "loading":
      return "#1565c0";
    case "empty":
      return "#546e7a";
    case "degraded":
      return "#ef6c00";
    case "error":
      return "#c62828";
    case "unavailable":
      return "#8d6e63";
    case "disabled":
      return "#9e9e9e";
  }
}

function statusRank(status: SourceHealthStatus): number {
  switch (status) {
    case "error":
      return 0;
    case "degraded":
      return 1;
    case "unavailable":
      return 2;
    case "loading":
      return 3;
    case "disabled":
      return 4;
    case "live":
      return 5;
    case "empty":
      return 6;
  }
}

export function DataCoveragePanel({ items }: DataCoveragePanelProps) {
  const [showAll, setShowAll] = useState(false);
  const apiStatus = useQuery({
    queryKey: ["openrisk-api-status"],
    queryFn: fetchApiStatus,
    enabled: import.meta.env.PROD,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const liveCount = items.filter((item) => item.status === "live").length;
  const loadingCount = items.filter((item) => item.status === "loading").length;
  const unavailableCount = items.filter(
    (item) => item.status === "unavailable"
  ).length;
  const degradedCount = items.filter((item) => item.status === "degraded").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const issueCount = items.filter(
    (item) => item.status === "error" || item.status === "unavailable" || item.status === "degraded"
  ).length;
  const sortedItems = [...items].sort((a, b) => {
    const statusDelta = statusRank(a.status) - statusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    return a.label.localeCompare(b.label);
  });
  const priorityItems = sortedItems.filter(
    (item) =>
      item.status === "error" ||
      item.status === "degraded" ||
      item.status === "unavailable" ||
      item.status === "loading"
  );
  const visibleItems =
    showAll || priorityItems.length === 0 ? sortedItems : priorityItems;
  const hiddenCount = sortedItems.length - visibleItems.length;
  const operations = apiStatus.data?.watchRegistry.operations;
  const operationsColor = operations?.health === "critical"
    ? "#c62828"
    : operations?.health === "degraded"
      ? "#ef6c00"
      : "#2e7d32";

  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <div>
          <div style={styles.label}>Data coverage</div>
          <div style={styles.detail}>
            {liveCount} live source{liveCount !== 1 ? "s" : ""}
            {issueCount > 0 ? ` · ${issueCount} degraded or unavailable` : ""}
          </div>
        </div>
        <div style={styles.summaryPills} aria-label="Source health summary">
          {errorCount > 0 && (
            <span style={{ ...styles.summaryPill, color: "#c62828" }}>
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {degradedCount > 0 && (
            <span style={{ ...styles.summaryPill, color: "#ef6c00" }}>
              {degradedCount} cached
            </span>
          )}
          {unavailableCount > 0 && (
            <span style={{ ...styles.summaryPill, color: "#8d6e63" }}>
              {unavailableCount} unavailable
            </span>
          )}
          {loadingCount > 0 && (
            <span style={{ ...styles.summaryPill, color: "#1565c0" }}>
              {loadingCount} checking
            </span>
          )}
        </div>
      </div>
      <div style={styles.list}>
        {import.meta.env.PROD && (
          <>
            <div style={styles.row}>
              <div style={styles.topLine}>
                <span style={styles.name}>OpenRisk API</span>
                <span
                  style={{
                    ...styles.badge,
                    color: apiStatus.isError ? "#c62828" : apiStatus.data ? "#2e7d32" : "#1565c0",
                    background: apiStatus.isError ? "#c6282814" : apiStatus.data ? "#2e7d3214" : "#1565c014",
                    borderColor: apiStatus.isError ? "#c6282855" : apiStatus.data ? "#2e7d3255" : "#1565c055",
                  }}
                >
                  {apiStatus.isError ? "Unavailable" : apiStatus.data ? "Operational" : "Checking"}
                </span>
              </div>
              <div style={styles.rowDetail}>
                {apiStatus.data
                  ? `${apiStatus.data.sources.length} protected proxy routes · ${apiStatus.data.version}`
                  : apiStatus.isError
                    ? "The source proxy status endpoint could not be reached."
                    : "Checking the source proxy."}
              </div>
            </div>
            {operations && (
              <div style={styles.row} data-testid="operations-health">
                <div style={styles.topLine}>
                  <span style={styles.name}>Cloud watch operations</span>
                  <span style={{
                    ...styles.badge,
                    color: operationsColor,
                    background: `${operationsColor}14`,
                    borderColor: `${operationsColor}55`,
                  }}>
                    {operations.health === "critical" ? "Critical" : operations.health === "degraded" ? "Degraded" : "Healthy"}
                  </span>
                </div>
                <div style={styles.rowDetail}>
                  {operations.activeWatches} active · {operations.dueWatches} due · {operations.recentRuns.total} audits in 24h
                  {operations.push.activeSubscriptions > 0
                    ? ` · ${operations.push.activeSubscriptions} notification device${operations.push.activeSubscriptions === 1 ? "" : "s"}`
                    : ""}
                </div>
                {operations.alerts.length > 0 && (
                  <ul style={styles.alertList}>
                    {operations.alerts.map((alert) => <li key={alert}>{alert}</li>)}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
        {visibleItems.map((item) => {
          const color = statusColor(item.status);
          return (
            <div key={item.id} style={styles.row}>
              <div style={styles.topLine}>
                <span style={styles.name}>{item.label}</span>
                <span
                  style={{
                    ...styles.badge,
                    color,
                    background: `${color}14`,
                    borderColor: `${color}55`,
                  }}
                >
                  {statusLabel(item.status)}
                </span>
              </div>
              <div style={styles.rowDetail}>
                {item.count != null && (
                  <span style={styles.count}>{item.count}</span>
                )}
                {item.detail}
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            style={styles.showAllButton}
            onClick={() => setShowAll(true)}
            aria-expanded={showAll}
          >
            Show {hiddenCount} healthy or quiet source
            {hiddenCount !== 1 ? "s" : ""}
          </button>
        )}
        {showAll && priorityItems.length > 0 && (
          <button
            type="button"
            style={styles.showAllButton}
            onClick={() => setShowAll(false)}
            aria-expanded={showAll}
          >
            Show attention sources only
          </button>
        )}
      </div>
    </div>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  summaryPills: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 5,
    justifyContent: "flex-end",
    maxWidth: 150,
  },
  summaryPill: {
    background: "#f7f9fb",
    border: "1px solid #e0e7ef",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    whiteSpace: "nowrap",
  },
  list: {
    marginTop: 8,
    border: "1px solid #eceff1",
    borderRadius: 8,
    overflow: "hidden",
  },
  row: {
    padding: "8px 9px",
    borderBottom: "1px solid #eceff1",
    background: "#fff",
  },
  alertList: {
    margin: "6px 0 0 18px",
    padding: 0,
    color: "#6d4c41",
    fontSize: 11,
    lineHeight: 1.45,
  },
  topLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 12,
    color: "#263238",
    fontWeight: 700,
    minWidth: 0,
  },
  badge: {
    flex: "0 0 auto",
    fontSize: 10,
    fontWeight: 800,
    border: "1px solid",
    borderRadius: 999,
    padding: "2px 6px",
  },
  rowDetail: {
    fontSize: 11,
    color: "#546e7a",
    marginTop: 3,
    lineHeight: 1.35,
  },
  count: {
    display: "inline-block",
    minWidth: 16,
    marginRight: 5,
    color: "#263238",
    fontWeight: 800,
  },
  showAllButton: {
    width: "100%",
    border: "none",
    borderTop: "1px solid #eceff1",
    background: "#f7f9fb",
    color: "#1565c0",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "9px",
    textAlign: "center" as const,
  },
};
