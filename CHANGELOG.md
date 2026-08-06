# Changelog

## Unreleased

### Key-free facility exposure context

- Added on-demand HOT/OpenStreetMap hospital, clinic, and education-facility context within a provider-bounded 0.7-mile area around an opened incident or searched point inside an alert polygon.
- Added exact distance filtering, stable facility identities, transparent OpenStreetMap attribution, incompleteness warnings, and optional contextual facility markers.
- Kept exposure records out of severity, current risk, incident correlation, saved-location summaries, background watches, and notifications.

### Production signal truthfulness

- Aligned the dashboard's Current signals summary with the active Feed Explorer freshness rules so older seismic and NASA EONET records remain available as history without being described as current.
- Routed browser JMA typhoon data through a five-minute cached Worker proxy while retaining direct official-source access for isolated background watch evaluations.
- Replaced the ambiguous source-health term "unwired" with "unavailable" and added regressions for current-summary filtering and the bounded JMA proxy route.

### Water-observation reliability contracts

- Added exact circular-radius filtering for USGS stream stations so bounding-box corner results cannot appear outside the selected area.
- Limited USGS and NOAA CO-OPS observations to valid readings no more than six hours old, preventing delayed or malformed sensor values from appearing current.
- Isolated NOAA station request failures so one unavailable gauge no longer suppresses valid nearby coastal observations.
- Added deterministic adapter regressions for locality, freshness, invalid measurements, and partial upstream failure.

### Smithsonian volcano baseline context

- Promoted nearby Smithsonian Global Volcanism Program Holocene records into a dedicated historical map and detail path.
- Corrected the WFS 2.0 EPSG:4326 bounding-box axis order so nearby queries return the intended volcanoes.
- Kept GVP records out of current risk posture, incident correlation, the feed explorer, and background notifications, regardless of the listed last-eruption year.
- Added a bounds-validated, day-cached Worker proxy for the WFS endpoint plus stable record IDs, nearest-first radius filtering, source-health reporting, detailed geology and eruption metadata, map attribution, and unit/browser regressions.

### Website monitoring descriptions

- Updated the dashboard watch panel to present cloud watches as optional background monitoring instead of a pre-launch preview.
- Corrected the listed background feed coverage and controlled browser-notification rollout language.
- Updated the homepage, methodology, about, privacy, and data-source pages to reflect isolated cloud checks, aggregate NHC handling, opt-in storage, and best-effort notification delivery.

### NYSDOT roadwork clarity

- Enriched WZDx roadwork signals with cross streets, effective lane impact, mileposts, reduced speeds, work/lane/restriction metadata, source verification, and direct state-feed attribution in the event detail dialog.
- Collapsed linked recurring WZDx occurrences into one project signal with a recurrence count and series end date, eliminating repeated NYSDOT rows for each scheduled work day.
- Replaced generic transportation circles with a crisp, accessible construction-pin SVG marker and strengthened legacy event-dialog contrast uncovered by browser accessibility testing.
- Added normalization and browser regressions covering NYSDOT recurrence grouping, description-derived lane impacts, construction-marker rendering, detailed fields, and axe accessibility checks.

### Detailed five-day forecast

- Replaced the narrow inline forecast expansion with a user-triggered responsive dialog: centered on larger screens and presented as a scrollable bottom sheet on phones.
- Added selectable daily summaries, NWS narrative guidance, richer daily metrics, and three-hour intervals backed by up to five days of hourly forecast data.
- Extracted the event-detail dialog behavior into a shared accessible modal shell with focus trapping, Escape handling, scroll locking, and focus restoration.
- Added unit coverage for NWS and Open-Meteo normalization plus browser regressions for dialog accessibility, centering, scrolling, day selection, mobile overflow, and focus restoration.

### Cloudflare watch-audit subrequest isolation

- Replaced 15 per-slot NHC forecast-point requests with NOAA's aggregate tropical forecast layer, reducing each NHC refresh from 16 upstream requests to 2 including the outlook feed.
- Changed scheduled watch audits from a 24-location fan-out inside one Worker invocation to one queue message and one fresh Worker invocation per watched location.
- Added retry-safe D1 audit-job tracking, run-result accounting, removed-watch handling, and terminal failure recording while retaining the existing 24-watch scheduling capacity.
- Limited queue consumer batches to one message so watch audits and push deliveries cannot share a single invocation's external subrequest allowance.
- Added regressions for the NHC request budget and one-message-per-watch queue dispatch.

### Local public-health risk scoping

- Tightened WHO Disease Outbreak News matching to use the outbreak geography in the report title, preventing an incidental patient-nationality mention from importing a foreign outbreak into a US location.
- Kept country-level WHO reports as monitoring context while allowing them to affect local risk only when the report names the searched state, county, or city.
- Applied the same current-impact boundary to dashboard posture, attention cards, situation briefs, saved-place summaries, and offline snapshots so remote severe events cannot inflate local criticality.
- Added regressions for the WHO Ebola DRC/US-worker wording and for country-only versus state-local WHO impact scoring.

### Resilient tsunami monitoring

- Added an independent official NOAA fallback path using the NTWC and PTWC Atom feeds when the primary tsunami JSON endpoint fails or omits an active warning-center message.
- Kept warning, advisory, watch, and threat messages only, enforced a 24-hour freshness window, and report fallback operation as degraded coverage instead of a hard source failure.
- Rejected automatic Global Tsunami Monitor promotion after current provider documentation confirmed that REST API access requires a separate agreement.

### Production operations health

- Expanded `/api/status` with 24-hour audit reliability, stale-run detection, backlog thresholds, active push subscriptions, and queued, failed, invalid, or stuck delivery counts.
- Added operational, degraded, and critical health classification plus structured scheduled-run alerts suitable for Cloudflare log alerting.

### Controlled automatic notifications

- Activated automatic Web Push through a deterministic 10% watch canary rather than a global cutover.
- Added per-device idempotency, a three-batch-per-hour watch limit, quiet-hour enforcement, delivery suppression reasons, and exhausted-retry failure recording before dead-letter handoff.

### Browser regression and accessibility coverage

- Added Playwright and axe checks to CI for ZIP `60030`, phone overflow and touch targets, short desktop map scrolling, monitored-place collapse persistence, and NASA imagery preferences.
- Fixed unnamed searched-location map markers, invalid ARIA grouping, undersized mobile controls, and marginal secondary-text contrast uncovered by the automated audit.

### NASA imagery controls

- Persisted the selected GIBS layer, recent date, and opacity; stale saved dates now fall back to the newest selectable imagery date.
- Added product-specific legends and partial-tile failure reporting so available imagery remains visible when individual tiles fail.

### Source promotion safeguards

- Revalidated Australian Bureau of Meteorology warning feeds and blocked production promotion: live API metadata prohibits use, copying, or sharing, anonymous feed automation is blocked, and publishing requires a registered-user data agreement.

### Watch audit operations

- Increased scheduled watch-audit capacity, added bounded per-watch concurrency, and isolated individual watch failures so one malformed registration cannot abort the remaining batch.
- Added short audit leases, increased the cron cadence, and aligned registry admission capacity with the worst-case hourly processing budget so due watches keep moving through the queue.
- Persisted audit-run metrics for operational visibility, including selected, processed, degraded, and failed watch counts plus run duration.
- Expanded `/api/status` with current watch backlog and last-run details, and corrected its evaluated-source list to match the shared feed registry.

### Shared feed contracts

- Replaced repeated dashboard query configuration for location event feeds with a single registry-backed React Query hook.
- Derived the public watch-audit source list directly from the shared feed registry, removing a stale parallel constant from the Worker.
- Added registry invariants for unique IDs, cache and retry policies, hazard coverage, supported surfaces, and location-aware activation.

### Incident correlation v2

- Replaced transitive union clustering with deterministic complete-link grouping so a chain of nearby reports cannot merge incidents whose endpoints fall outside the category contract.
- Added a per-contributor correlation explanation to canonical incident metadata and the incident detail panel, including spatial and temporal proximity to the authoritative primary record.

### Dashboard accessibility and responsive behavior

- Added a named main landmark and top-level dashboard heading for screen-reader navigation.
- Added a polite live status announcement for location resolution, source refresh progress, and the resulting signal count.
- Increased mobile touch targets across dashboard controls, saved-location actions, navigation, and Leaflet zoom controls while preserving the existing overflow-free phone layout.
- Added accessible names to event, cluster, supplemental-signal, searched-location, and map-search markers; the decorative radius ring is no longer keyboard-focusable.

### NASA satellite imagery

- Promoted NASA EOSDIS GIBS into the map with optional true-color, VIIRS thermal-anomaly, aerosol/smoke, and snow-cover layers plus a seven-day imagery selector.
- Corrected the experiment scaffold to use GIBS Web Mercator matrices in WMTS row/column order, product-specific native zoom ceilings, and WMS raster rendering for thermal-anomaly vector tiles.
- Added visible imagery date and attribution, loading and tile-error states, CSP coverage, source documentation, and deterministic tile-contract tests.

### Feed orchestration

- Added a shared, location-aware event-feed registry for the dashboard, saved-location summaries, and background watch audits.
- Centralized source eligibility, hazard coverage, query identity, retry policy, and freshness intervals for core live event feeds.
- Made saved-location summaries use the same automatic country and state-aware feed selection as the main dashboard.

### Monitoring reliability

- Expanded background watch audits from NWS, USGS, and NIFC to also use NHC, GDACS, and NASA EONET when their hazard coverage applies.
- Persisted resolved location context with cloud watches so monitoring can choose feeds from the saved country automatically.
- Changed watch evaluation to continue on partial upstream failures, recording a degraded warning while still evaluating successful feeds; an audit now fails only when every applicable source fails.

### Experiment promotion safety

- Added a promotion inventory and per-source live probe for the state and country experiment packs.
- Added static production-readiness checks for validation status, public access, HTTPS, attribution, terms, refresh intervals, and proxy requirements.
- Added payload freshness detection that blocks stale "active" datasets and requires manual review when a feed exposes no usable timestamps.

### Dashboard regression coverage

- Ensured the main dashboard column scrolls when summaries consume the viewport and guaranteed a usable minimum map height on desktop-sized screens.
- Persisted the monitored-place overview's collapsed state across reloads and added stable test hooks for browser regression checks.
- Reverified ZIP `60030` navigation resolves to Grayslake, Illinois, including the URL-driven search path.

### Asia-Pacific tropical coverage

- Added official Japan Meteorological Agency active tropical-cyclone analyses for the western North Pacific.
- Correlates JMA's active-system index with its track data, applies the same 300-mile tropical monitoring floor used for NHC systems, and activates automatically for dashboard, saved-location, and background-watch views.
- Added JMA attribution, source-health reporting, map/filter support, freshness handling, and adapter contract tests.
