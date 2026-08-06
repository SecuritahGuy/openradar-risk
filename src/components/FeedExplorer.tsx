import { useMemo, useState } from "react";
import type { ResolvedLocation } from "../types/location";
import type { RiskEvent } from "../types/riskEvent";
import {
  activeConcernEvents,
  concernContextLabel,
  distanceMiles,
  EVENT_SEVERITIES,
  EVENT_SOURCES,
  eventSourceLabel,
  expiresLabel,
  formatDistance,
  severityColor,
  severityRank,
  sourceColor,
  sourceLabel,
} from "../lib/riskInsights";
import { assessImpact, impactColor } from "../lib/impactInsights";
import type { RadiusOption } from "../types/location";

interface FeedExplorerProps {
  events: RiskEvent[];
  allEvents: RiskEvent[];
  totalEvents: number;
  totalAllEvents: number;
  location: ResolvedLocation | null;
  radius: RadiusOption;
  isFetching: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onEventClick?: (event: RiskEvent) => void;
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

type SortKey =
  | "priority"
  | "source"
  | "type"
  | "category"
  | "severity"
  | "impact"
  | "headline"
  | "distance"
  | "expires"
  | "updated";
type SortDirection = "asc" | "desc";
type SortState = {
  key: SortKey;
  direction: SortDirection;
};
type FeedMode = "active" | "historical" | "all";

interface CountChip {
  label: string;
  count: number;
  color: string;
}

function expiryMinutes(event: RiskEvent): number {
  if (!event.expiresAt) return Number.POSITIVE_INFINITY;
  const value = new Date(event.expiresAt).getTime();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((value - Date.now()) / 60_000));
}

function defaultDirection(key: SortKey): SortDirection {
  if (
    key === "severity" ||
    key === "impact" ||
    key === "updated" ||
    key === "priority"
  ) {
    return "desc";
  }
  return "asc";
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function applyDirection(value: number, direction: SortDirection): number {
  return direction === "asc" ? value : -value;
}

function topSourceChips(events: RiskEvent[], limit = 4): CountChip[] {
  return EVENT_SOURCES.map((source) => ({
    label: sourceLabel(source),
    count: events.filter((event) => event.source === source).length,
    color: sourceColor(source),
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function severityChips(events: RiskEvent[]): CountChip[] {
  return EVENT_SEVERITIES.map((severity) => ({
    label: severity,
    count: events.filter((event) => event.severity === severity).length,
    color: severityColor(severity),
  })).filter((item) => item.count > 0);
}

function latestUpdateLabel(events: RiskEvent[]): string {
  const latest = events.reduce((current, event) => {
    const value = new Date(event.updatedAt).getTime();
    return Number.isNaN(value) ? current : Math.max(current, value);
  }, 0);

  return latest > 0 ? timeAgo(new Date(latest).toISOString()) : "unknown";
}

export function FeedExplorer({
  events,
  allEvents,
  totalEvents,
  totalAllEvents,
  location,
  radius,
  isFetching,
  collapsed = false,
  onCollapsedChange,
  onEventClick,
}: FeedExplorerProps) {
  const [sortState, setSortState] = useState<SortState>({
    key: "updated",
    direction: "desc",
  });
  const [mode, setMode] = useState<FeedMode>("active");
  const historicalEvents = useMemo(
    () => allEvents.filter((event) => !activeConcernEvents([event]).length),
    [allEvents]
  );
  const visibleEvents =
    mode === "active" ? events : mode === "historical" ? historicalEvents : allEvents;
  const visibleTotal =
    mode === "active"
      ? totalEvents
      : mode === "historical"
        ? totalAllEvents - totalEvents
        : totalAllEvents;

  function updateSort(key: SortKey) {
    setSortState((current) => {
      if (current.key === key && key !== "priority") {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: defaultDirection(key),
      };
    });
  }

  const sortedEvents = useMemo(() => {
    const { key, direction } = sortState;

    return [...visibleEvents].sort((a, b) => {
      if (key === "source") {
        return applyDirection(compareText(a.source, b.source), direction);
      }
      if (key === "type") {
        return applyDirection(compareText(a.type, b.type), direction);
      }
      if (key === "category") {
        return applyDirection(compareText(a.category, b.category), direction);
      }
      if (key === "severity") {
        return applyDirection(
          severityRank(a.severity) - severityRank(b.severity),
          direction
        );
      }
      if (key === "impact") {
        return applyDirection(
          assessImpact(a, location, radius).sortRank -
            assessImpact(b, location, radius).sortRank,
          direction
        );
      }
      if (key === "headline") {
        return applyDirection(compareText(a.headline, b.headline), direction);
      }
      if (key === "updated") {
        return applyDirection(
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
          direction
        );
      }
      if (key === "distance") {
        const aDistance = distanceMiles(location, a) ?? Number.POSITIVE_INFINITY;
        const bDistance = distanceMiles(location, b) ?? Number.POSITIVE_INFINITY;
        return applyDirection(aDistance - bDistance, direction);
      }
      if (key === "expires") {
        return applyDirection(expiryMinutes(a) - expiryMinutes(b), direction);
      }

      const impactDelta =
        assessImpact(b, location, radius).sortRank -
        assessImpact(a, location, radius).sortRank;
      if (impactDelta !== 0) return impactDelta;

      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;
      const aDistance = distanceMiles(location, a) ?? Number.POSITIVE_INFINITY;
      const bDistance = distanceMiles(location, b) ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [visibleEvents, location, radius, sortState]);

  const hasNoEvents = visibleEvents.length === 0 && !isFetching;
  const emptyMessage = !location
    ? "Search a location to load live feed events."
    : mode === "active"
      ? totalEvents > 0
        ? "No active concerns match the active filters."
        : "No active concerns found for this location."
      : mode === "historical"
        ? "No historical or stale context rows match the active filters."
        : "No feed rows match the active filters.";
  const collapsedEmptyMessage = !location
    ? "Search a location"
    : mode === "active"
      ? "No active concerns"
      : mode === "historical"
        ? "No context rows"
        : "No feed rows";
  const title = `Feed Explorer (${visibleEvents.length}${
    visibleTotal !== visibleEvents.length ? ` of ${visibleTotal}` : ""
  })`;
  const topSources = topSourceChips(visibleEvents);
  const severities = severityChips(visibleEvents);
  const latestUpdate = latestUpdateLabel(visibleEvents);

  return (
    <div
      className={collapsed ? "feed-explorer is-collapsed" : "feed-explorer"}
      style={collapsed ? styles.collapsedContainer : styles.container}
    >
      <div className="feed-explorer-header" style={styles.header}>
        <span style={styles.headerTitle}>{title}</span>
        {collapsed && (
          <span style={styles.collapsedHint}>
            {hasNoEvents
              ? collapsedEmptyMessage
              : `${sortedEvents.length} visible rows hidden`}
          </span>
        )}
        <div style={styles.modeTabs} aria-label="Feed explorer mode">
          {[
            { value: "active", label: "Active", title: "Current, unexpired, source-fresh incidents" },
            { value: "historical", label: "History", title: "Expired and older context; not active" },
            { value: "all", label: "All", title: "Current and historical records together" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              style={{
                ...styles.modeButton,
                ...(mode === item.value ? styles.modeButtonActive : {}),
              }}
              aria-pressed={mode === item.value}
              title={item.title}
              onClick={() => setMode(item.value as FeedMode)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select
          value={sortState.key}
          onChange={(event) => updateSort(event.target.value as SortKey)}
          style={styles.sortSelect}
          title="Sort events"
        >
          <option value="priority">Priority</option>
          <option value="source">Source</option>
          <option value="type">Type</option>
          <option value="category">Category</option>
          <option value="severity">Severity</option>
          <option value="impact">Impact</option>
          <option value="headline">Headline</option>
          <option value="updated">Updated</option>
          <option value="distance">Distance</option>
          <option value="expires">Expires</option>
        </select>
        {isFetching && <span style={styles.spinner}>&#8987;</span>}
        {onCollapsedChange && (
          <button
            type="button"
            style={styles.collapseButton}
            onClick={() => onCollapsedChange(!collapsed)}
            aria-expanded={!collapsed}
            title={collapsed ? "Show feed table" : "Hide feed table"}
          >
            {collapsed ? "Show table" : "Map space"}
          </button>
        )}
      </div>
      {collapsed ? null : hasNoEvents ? (
        <div style={styles.empty}>{emptyMessage}</div>
      ) : (
        <>
          <FeedSummaryBar
            eventCount={visibleEvents.length}
            totalEvents={visibleTotal}
            latestUpdate={latestUpdate}
            topSources={topSources}
            severities={severities}
          />
          <div className="feed-table" style={styles.tableScroller}>
            <div style={styles.table}>
            <div
              className="feed-table-row feed-table-header"
              style={styles.tableHeader}
            >
              <ColumnHeader
                label="Source"
                sortKey="source"
                sortState={sortState}
                style={styles.colSource}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Type"
                sortKey="type"
                sortState={sortState}
                style={styles.colType}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Category"
                sortKey="category"
                sortState={sortState}
                style={styles.colCategory}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Severity"
                sortKey="severity"
                sortState={sortState}
                style={styles.colSeverity}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Impact"
                sortKey="impact"
                sortState={sortState}
                style={styles.colImpact}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Headline"
                sortKey="headline"
                sortState={sortState}
                style={styles.colHeadline}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Distance"
                sortKey="distance"
                sortState={sortState}
                style={styles.colDistance}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Expires"
                sortKey="expires"
                sortState={sortState}
                style={styles.colExpires}
                onSort={updateSort}
              />
              <ColumnHeader
                label="Updated"
                sortKey="updated"
                sortState={sortState}
                style={styles.colTime}
                onSort={updateSort}
              />
            </div>
            {sortedEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                className="feed-table-row"
                style={styles.row}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  onEventClick?.(evt);
                }}
                onClick={() => onEventClick?.(evt)}
                title="Click for details"
              >
                <span style={styles.colSource}>
                  <span
                    style={{
                      ...styles.badge,
                      background: sourceColor(evt.source),
                    }}
                  >
                    {eventSourceLabel(evt)}
                  </span>
                </span>
                <span style={styles.colType}>{evt.type}</span>
                <span style={styles.colCategory}>{evt.category}</span>
                <span style={styles.colSeverity}>
                  <SeverityBadge severity={evt.severity} />
                </span>
                <span style={styles.colImpact}>
                  <ImpactBadge
                    event={evt}
                    location={location}
                    radius={radius}
                  />
                  {mode !== "active" && (
                    <ContextBadge event={evt} />
                  )}
                </span>
                <span style={styles.colHeadline}>{evt.headline}</span>
                <span style={styles.colDistance}>
                  {formatDistance(distanceMiles(location, evt))}
                </span>
                <span style={styles.colExpires}>{expiresLabel(evt)}</span>
                <span style={styles.colTime}>{timeAgo(evt.updatedAt)}</span>
              </button>
            ))}
            </div>
          </div>
          <div className="feed-card-list" style={styles.cardList}>
            {sortedEvents.map((evt) => (
              <button
                key={`card-${evt.id}`}
                type="button"
                className="feed-card"
                style={styles.card}
                onClick={() => onEventClick?.(evt)}
                title="Click for details"
              >
                <span style={styles.cardTop}>
                  <span
                    style={{
                      ...styles.badge,
                      background: sourceColor(evt.source),
                    }}
                  >
                    {eventSourceLabel(evt)}
                  </span>
                  <SeverityBadge severity={evt.severity} />
                  <ImpactBadge event={evt} location={location} radius={radius} />
                  {mode !== "active" && <ContextBadge event={evt} />}
                </span>
                <span style={styles.cardTitle}>{evt.headline}</span>
                <span style={styles.cardMeta}>
                  {evt.type} / {evt.category}
                </span>
                <span style={styles.cardFooter}>
                  <span>{formatDistance(distanceMiles(location, evt))}</span>
                  <span>{expiresLabel(evt)}</span>
                  <span>{timeAgo(evt.updatedAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FeedSummaryBar({
  eventCount,
  totalEvents,
  latestUpdate,
  topSources,
  severities,
}: {
  eventCount: number;
  totalEvents: number;
  latestUpdate: string;
  topSources: CountChip[];
  severities: CountChip[];
}) {
  return (
    <div className="feed-summary-bar" style={styles.summaryBar}>
      <div style={styles.summaryMetric}>
        <span style={styles.summaryValue}>{eventCount}</span>
        <span style={styles.summaryLabel}>
          visible{totalEvents !== eventCount ? ` of ${totalEvents}` : ""}
        </span>
      </div>
      <div style={styles.summaryMetric}>
        <span style={styles.summaryValue}>{latestUpdate}</span>
        <span style={styles.summaryLabel}>latest update</span>
      </div>
      <div style={styles.summaryChipGroup} role="group" aria-label="Visible source counts">
        {topSources.map((item) => (
          <CountBadge key={item.label} item={item} />
        ))}
      </div>
      <div style={styles.summaryChipGroup} role="group" aria-label="Visible severity counts">
        {severities.map((item) => (
          <CountBadge key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function CountBadge({ item }: { item: CountChip }) {
  return (
    <span
      style={{
        ...styles.summaryChip,
        color: item.color,
        borderColor: `${item.color}55`,
        background: `${item.color}12`,
      }}
    >
      {item.label} {item.count}
    </span>
  );
}

function ColumnHeader({
  label,
  sortKey,
  sortState,
  style,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortState: SortState;
  style: React.CSSProperties;
  onSort: (key: SortKey) => void;
}) {
  const active = sortState.key === sortKey;
  return (
    <span style={style}>
      <button
        type="button"
        style={{
          ...styles.columnSortButton,
          ...(active ? styles.columnSortButtonActive : {}),
        }}
        onClick={() => onSort(sortKey)}
        aria-sort={
          active
            ? sortState.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span style={styles.sortIndicator}>
          {active ? sortState.direction.toUpperCase() : ""}
        </span>
      </button>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severityColor(severity as RiskEvent["severity"]);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}18`,
        padding: "1px 6px",
        borderRadius: 3,
      }}
    >
      {severity}
    </span>
  );
}

function ImpactBadge({
  event,
  location,
  radius,
}: {
  event: RiskEvent;
  location: ResolvedLocation | null;
  radius: RadiusOption;
}) {
  const impact = assessImpact(event, location, radius);
  const color = impactColor(impact.level);
  return (
    <span
      title={impact.detail}
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}16`,
        padding: "2px 6px",
        borderRadius: 3,
        whiteSpace: "nowrap",
      }}
    >
      {impact.label}
    </span>
  );
}

function ContextBadge({ event }: { event: RiskEvent }) {
  const label = concernContextLabel(event);
  if (!label) return null;

  return <span style={styles.contextBadge}>{label}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #e0e0e0",
    background: "#fafafa",
    maxHeight: 260,
    overflowY: "auto",
    fontFamily: "system-ui, sans-serif",
  },
  collapsedContainer: {
    borderTop: "1px solid #d7e0ea",
    background: "#fff",
    flex: "0 0 auto",
    overflow: "hidden",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 -1px 8px rgba(21,101,192,0.08)",
  },
  header: {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#424242",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    position: "sticky",
    top: 0,
  },
  headerTitle: { flex: 1 },
  collapsedHint: {
    color: "#616161",
    fontSize: 12,
    fontWeight: 500,
    marginRight: 4,
    whiteSpace: "nowrap",
  },
  sortSelect: {
    border: "1px solid #cfd8dc",
    borderRadius: 5,
    background: "#fff",
    color: "#424242",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 6px",
  },
  modeTabs: {
    border: "1px solid #cfd8dc",
    borderRadius: 6,
    display: "inline-flex",
    overflow: "hidden",
  },
  modeButton: {
    background: "#fff",
    border: "none",
    borderRight: "1px solid #dfe6ee",
    color: "#546e7a",
    cursor: "pointer",
    font: "inherit",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 7px",
  },
  modeButtonActive: {
    background: "#1565c0",
    color: "#fff",
  },
  collapseButton: {
    border: "1px solid #1565c0",
    borderRadius: 5,
    background: "#1565c0",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  spinner: { fontSize: 16 },
  summaryBar: {
    alignItems: "center",
    background: "#f7fafc",
    borderBottom: "1px solid #e3e9ef",
    color: "#455a64",
    display: "grid",
    gap: 8,
    gridTemplateColumns: "auto auto minmax(160px, 1fr) minmax(150px, auto)",
    padding: "8px 12px",
  },
  summaryMetric: {
    alignItems: "baseline",
    display: "flex",
    gap: 5,
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  summaryValue: {
    color: "#263238",
    fontSize: 13,
    fontWeight: 800,
  },
  summaryLabel: {
    color: "#546e7a",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  summaryChipGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 5,
    minWidth: 0,
  },
  summaryChip: {
    border: "1px solid",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    padding: "4px 7px",
    whiteSpace: "nowrap",
  },
  tableScroller: {
    overflowX: "auto",
  },
  table: {
    fontSize: 12,
    minWidth: 1110,
  },
  tableHeader: {
    display: "flex",
    padding: "6px 12px",
    fontWeight: 600,
    color: "#616161",
    borderBottom: "1px solid #e0e0e0",
  },
  columnSortButton: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    padding: 0,
    font: "inherit",
    textAlign: "left" as const,
  },
  columnSortButtonActive: {
    color: "#1565c0",
  },
  sortIndicator: {
    color: "#1565c0",
    fontSize: 10,
    fontWeight: 800,
    minWidth: 22,
    textTransform: "uppercase" as const,
  },
  row: {
    display: "flex",
    width: "100%",
    padding: "6px 12px",
    border: "none",
    boxShadow: "inset 0 -1px 0 #f0f0f0",
    background: "transparent",
    alignItems: "center",
    cursor: "pointer",
    transition: "background 0.1s",
    font: "inherit",
    textAlign: "left" as const,
  },
  cardList: {
    display: "none",
    gap: 8,
    padding: 10,
  },
  card: {
    border: "1px solid #dfe7ef",
    borderRadius: 8,
    background: "#fff",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
    color: "#374151",
    cursor: "pointer",
    display: "grid",
    gap: 6,
    padding: 10,
    textAlign: "left" as const,
    width: "100%",
    font: "inherit",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 6,
    minWidth: 0,
  },
  cardTitle: {
    color: "#263238",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
    overflowWrap: "anywhere" as const,
  },
  cardMeta: {
    color: "#546e7a",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  cardFooter: {
    color: "#64748b",
    display: "flex",
    flexWrap: "wrap" as const,
    fontSize: 11,
    fontWeight: 600,
    gap: 8,
  },
  colSource: {
    flex: "0 0 126px",
    minWidth: 0,
    paddingRight: 10,
  },
  colType: {
    flex: "0 0 150px",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  colCategory: {
    flex: "0 0 116px",
    minWidth: 0,
    color: "#616161",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  colSeverity: { flex: "0 0 82px", minWidth: 0 },
  colImpact: { flex: "0 0 112px", minWidth: 0 },
  colHeadline: {
    flex: 1,
    minWidth: 220,
    color: "#424242",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 12,
  },
  colDistance: { flex: "0 0 72px", minWidth: 0, color: "#616161" },
  colExpires: { flex: "0 0 72px", minWidth: 0, color: "#616161" },
  colTime: {
    flex: "0 0 78px",
    minWidth: 0,
    textAlign: "right" as const,
    color: "#9e9e9e",
  },
  badge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    maxWidth: "100%",
    overflow: "hidden",
    padding: "2px 6px",
    borderRadius: 3,
    textOverflow: "ellipsis",
    textTransform: "uppercase" as const,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  contextBadge: {
    background: "#eceff1",
    borderRadius: 3,
    color: "#546e7a",
    display: "inline-block",
    fontSize: 9,
    fontWeight: 800,
    lineHeight: 1,
    marginLeft: 4,
    padding: "3px 5px",
    textTransform: "uppercase" as const,
    verticalAlign: "middle",
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "#9e9e9e",
    fontSize: 13,
    borderTop: "1px solid #e0e0e0",
  },
};
