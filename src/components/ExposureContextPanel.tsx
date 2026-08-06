import type { HdxExposureResult } from "../services/hdx";

interface ExposureContextPanelProps {
  result: HdxExposureResult | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  showOnMap: boolean;
  onShowOnMapChange: (show: boolean) => void;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function facilityDistance(result: HdxExposureResult, index: number): string | null {
  const metric = result.facilities[index]?.metrics.find((item) => item.label === "Distance");
  return metric ? `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}` : null;
}

export function ExposureContextPanel({
  result,
  isLoading,
  isFetching,
  error,
  showOnMap,
  onShowOnMapChange,
}: ExposureContextPanelProps) {
  const facilityCount = result?.facilities.length ?? 0;
  const basis = result?.center.basis === "searched-location"
    ? "the searched location within this alert"
    : "the incident point";

  return (
    <section style={styles.section} data-testid="exposure-context">
      <div style={styles.headingRow}>
        <div>
          <div style={styles.title}>Exposure context</div>
          <div style={styles.kicker}>Key-free HOT / OpenStreetMap facility data</div>
        </div>
        {isFetching && !isLoading && <span style={styles.refreshing}>Refreshing</span>}
      </div>

      <div aria-live="polite">
        {isLoading && <div style={styles.status}>Checking mapped facilities nearby…</div>}
        {!isLoading && error && (
          <div style={styles.error} role="status">
            Facility context is unavailable: {error}
          </div>
        )}
        {!isLoading && !error && result && facilityCount === 0 && (
          <div style={styles.status}>
            No mapped hospitals, clinics, or schools were returned within {result.radiusMiles} mi of {basis}.
          </div>
        )}
        {!isLoading && !error && result && facilityCount > 0 && (
          <>
            <div style={styles.summary}>
              <strong>
                {countLabel(result.healthFacilityCount, "health facility", "health facilities")} and{" "}
                {countLabel(result.schoolCount, "school")}
              </strong>{" "}
              mapped within {result.radiusMiles} mi of {basis}.
            </div>
            <div style={styles.facilityList}>
              {result.facilities.slice(0, 6).map((facility, index) => (
                <a
                  key={facility.id}
                  href={facility.url ?? "https://www.openstreetmap.org/copyright"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.facility}
                >
                  <span style={styles.facilityName}>{facility.headline}</span>
                  <span style={styles.facilityMeta}>
                    {facility.type}
                    {facilityDistance(result, index) ? ` · ${facilityDistance(result, index)}` : ""}
                  </span>
                </a>
              ))}
            </div>
            {facilityCount > 6 && (
              <div style={styles.more}>+{facilityCount - 6} more mapped facilities</div>
            )}
            <label style={styles.mapToggle}>
              <input
                type="checkbox"
                checked={showOnMap}
                onChange={(event) => onShowOnMapChange(event.target.checked)}
              />
              Show these facilities on the map while this detail is open
            </label>
          </>
        )}
      </div>

      <p style={styles.disclosure}>
        Context only—this does not change risk severity or notifications. OpenStreetMap is community mapped and may be incomplete; an empty result does not mean no facilities exist.
        {result?.truncated ? " Results are limited to the nearest 100 facilities." : ""}
      </p>
      <div style={styles.sourceLinks}>
        <a href="https://www.hotosm.org/" target="_blank" rel="noopener noreferrer">Humanitarian OpenStreetMap Team</a>
        <span aria-hidden="true">·</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    borderTop: "1px solid #e0e7ea",
    marginBottom: 16,
    paddingTop: 12,
  },
  headingRow: {
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    color: "#455a64",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  kicker: { color: "#607d8b", fontSize: 11, marginTop: 2 },
  refreshing: { color: "#546e7a", fontSize: 10, fontWeight: 700 },
  status: {
    background: "#f5f8f9",
    borderRadius: 6,
    color: "#455a64",
    fontSize: 12,
    padding: "9px 10px",
  },
  error: {
    background: "#fff8e1",
    border: "1px solid #ffe082",
    borderRadius: 6,
    color: "#6b5500",
    fontSize: 12,
    padding: "9px 10px",
  },
  summary: { color: "#263238", fontSize: 13, lineHeight: 1.45 },
  facilityList: { display: "grid", gap: 5, marginTop: 9 },
  facility: {
    alignItems: "center",
    background: "#f7f9fa",
    border: "1px solid #e3e8ea",
    borderRadius: 6,
    color: "inherit",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "7px 8px",
    textDecoration: "none",
  },
  facilityName: {
    color: "#263238",
    fontSize: 12,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  facilityMeta: { color: "#546e7a", flexShrink: 0, fontSize: 10 },
  more: { color: "#546e7a", fontSize: 11, marginTop: 6 },
  mapToggle: {
    alignItems: "center",
    color: "#37474f",
    cursor: "pointer",
    display: "flex",
    fontSize: 12,
    fontWeight: 700,
    gap: 7,
    marginTop: 10,
  },
  disclosure: { color: "#546e7a", fontSize: 11, lineHeight: 1.45, marginTop: 10 },
  sourceLinks: { display: "flex", flexWrap: "wrap", gap: 5, fontSize: 11, marginTop: 5 },
};
