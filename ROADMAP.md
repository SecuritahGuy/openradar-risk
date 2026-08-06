# OpenRiskRadar Roadmap

OpenRiskRadar is intentionally split into two product tracks: an open-source anonymous web application, and a separate native Apple-first iOS product track. The web application remains browser-first and independent from the native app.

## Track A — OpenRiskRadar Web

### Web product direction

OpenRiskRadar Web is the current public product. It is designed to remain:

- Free.
- Open source.
- Anonymous.
- Browser-first.
- No-account.
- No dependency on native apps.

The web application is a complete product in its own right and is not a prototype for the native app.

### Active web sources

These sources are part of the current web codebase. "Main dashboard" indicates that the source is fetched through the active feed path and can appear in the map/feed UI.

| Source | Coverage | Signals | Status |
|--------|----------|---------|--------|
| NWS alerts | United States | Active weather alerts | Main dashboard |
| NWS observations | United States | Current conditions, detailed five-day forecast, and five days of hourly periods | Current conditions panel and responsive forecast dialog |
| NWS overlay | United States | Forecast grid cell, hazards, heat risk, forecast/fire weather zones, stations | Optional map overlay |
| Meteoalarm | Europe | National weather alerts normalized from Meteoalarm | Main dashboard where supported |
| USGS earthquakes | Global | Earthquakes by proximity | Main dashboard |
| EMSC | Global, Europe-focused | Earthquakes by proximity and felt-event context | Main dashboard through a cached Worker proxy |
| GeoNet | New Zealand | Authoritative local earthquake catalog and elevated volcanic alert levels | Main dashboard, activated automatically for resolved New Zealand locations |
| DWD | Germany | Official severe-weather warning polygons | Main dashboard, activated automatically for resolved German locations and filtered by radius |
| WHO Disease Outbreak News | Global, country matched | Recent authoritative outbreak reports | Main dashboard and saved-location summaries when a report names the resolved country |
| FEMA declarations | United States | Disaster declarations by state/county | Main dashboard, no geometry |
| NOAA Storm Events | United States | Historical severe-weather records | Historical context |
| NIFC wildfires | United States | Wildfires and prescribed burns | Main dashboard |
| Selected state agencies | CA, FL, OR, NY, WI | Local wildfire incidents, evacuation zones, HAB reports, and beach advisories | Main dashboard, activated automatically by resolved state |
| USDOT WZDx / state DOTs | Participating U.S. states | Active and near-term road work, lane impacts, closures, cross streets, and recurrence-aware schedules | Main dashboard and construction-marker map layer, activated automatically by resolved state and radius |
| SPC outlooks | United States | Day 1-3 convective outlook polygons | Main dashboard |
| SPC storm reports | United States | Preliminary observed tornado, hail, and damaging-wind reports | Main dashboard |
| NHC storms | Atlantic and Eastern/Central Pacific | Active tropical cyclones | Main dashboard when active/in range |
| JMA tropical cyclones | Western North Pacific | Active official cyclone analyses and tracks | Main dashboard and background watches through a cached Worker proxy |
| GDACS | Global | Earthquakes, cyclones, floods, volcanoes, wildfires, droughts | Main dashboard |
| NASA EONET | Global | Earth observation natural events | Main dashboard |
| NASA GIBS | Global | Dated true-color, thermal-anomaly, aerosol/smoke, and snow-cover imagery | Optional map overlay with product-specific native zoom limits |
| Open-Meteo | Global | Weather fallback, air quality, marine conditions | Current conditions fallback and environmental signals panel |
| Nominatim | Global | Geocoding/reverse geocoding | Location resolution fallback |
| USGS Water Services | United States | River conditions — discharge, gauge height, water temperature | Environmental signals panel |
| NOAA CO-OPS | U.S. coasts + Great Lakes | Coastal water levels, flood thresholds | Environmental signals panel |
| NOAA NWPS | United States | River forecasts and elevated gauge status | Main dashboard and environmental signals |
| NOAA Tsunami | United States, territories, and PTWC international threat messages | Active tsunami alerts | Main dashboard; malformed upstream JSON tokens are repaired defensively, with official NTWC/PTWC Atom feeds as an independent fallback |
| NOAA SWPC | Global | Kp index, DST, X-ray flares, solar flux | Environmental signals panel |
| US Drought Monitor | United States | D0-D4 drought severity polygons | Environmental signals panel |
| USGS ShakeMap | Global | Shaking-intensity context for significant earthquakes | Environmental signals panel |
| USGS Volcanoes | United States | Volcano alert levels (WATCH/ADVISORY/NORMAL) | Main dashboard and environmental signals |
| UK Environment Agency | England | Active flood warnings | Main dashboard |
| Smithsonian GVP | Global | Holocene volcano locations, geology, and eruption history | Nearby map and baseline context; excluded from current risk and notifications |
| HOT / OpenStreetMap exposure | Global where mapped | Nearby hospitals, clinics, and schools | Key-free, incident-triggered detail and optional map context within a bounded 0.7-mile area; excluded from risk and notifications |

### Web priorities

- Continue adding authoritative public risk sources.
- Improve canonical incident correlation and provider-aware deduplication.
- Improve global coverage, reliability, and source attribution.
- Improve maps, visualizations, and risk summaries.
- Improve environmental signal integration.
- Improve local-only saved locations and anonymous workflows.
- Improve accessibility, mobile responsiveness, and public documentation.
- Improve tests for deterministic normalization and filtering logic.

### Opt-in background monitoring

The web application supports explicitly enabled Cloudflare background watches and a controlled Web Push rollout. Each due location is evaluated in a separate queued Worker invocation to preserve provider-request budgets. The dashboard remains fully useful without cloud monitoring, and this web implementation is not the permanent backend architecture for the native iOS product.

### Next web work

| Area | Why It Matters | Notes |
|------|----------------|-------|
| Expand provider-aware incident correlation | The canonical incident layer now groups transitively and deterministically, distinguishes providers behind shared source families, prefers authoritative sources, and preserves contributors | Source agreement and situation briefs now use canonical incident metadata instead of broad category clusters; continue adding category-specific rules only where provider semantics support them |
| Enforce feed freshness and locality contracts | Cached data is now reported as degraded rather than failed, hard-error summaries exclude usable cached responses, and time-sensitive open events use source-specific freshness windows | Current-signal summaries now share the active feed's freshness rules; USGS Water and NOAA CO-OPS reject readings over six hours old or invalid and enforce exact nearby relevance |
| Add focused tests around adapters | Normalization and severity mapping are high-value deterministic logic | GeoNet, DWD, JMA, USGS Water, and NOAA CO-OPS now have focused activation/locality, normalization, freshness, proxy, and failure-isolation coverage; continue with remaining authoritative adapters |
| Add the next validated authoritative source | New integrations should fill a defined product gap without weakening attribution or reliability | Prefer candidates from the researched backlog with no key and clear licensing |
| Keep roadmap status aligned with shipped code | Multiple source integrations have moved quickly | Treat this file as canonical and update source status in the same PR as integration work |

### Investigated / Confirmed — Next Integration Candidates

#### Tier 1 — Highest Priority (No API Key, Broad Coverage, Clear Gap)

| Source | Coverage | Data | Why It Matters | Status |
|--------|----------|------|----------------|--------|
| USGS Water Services | United States | Real-time streamflow, gauge height, water temperature from thousands of gauges | **Flood/river monitoring** — the single biggest gap. Instantaneous values API exposes flood conditions. | ✅ Done |
| NOAA CO-OPS | U.S. coasts + Great Lakes | Water levels, tides, coastal flood thresholds, storm surge, meteorological obs | **Coastal flood risk** — complements river flooding. Storm surge and high tide flood data. | ✅ Done |
| NOAA SWPC | Global | Solar flares, geomagnetic Kp index, solar wind, aurora, radio blackout | **Space weather** — GPS disruption, power grid risk, radio blackout. Zero integration cost. | ✅ Done |
| US Drought Monitor | United States | D0-D4 drought severity weekly polygons and county-level stats | **Drought** — widely referenced standard for dry conditions, wildfire fuel assessment. | ✅ Done |
| SPC Storm Reports | United States | Preliminary tornado, hail, and wind reports with location and available magnitude | **Confirmed severe weather** — shows *actual* events vs. forecast outlooks already shown. | ✅ Done |
| Blitzortung Lightning | Global (community network) | Real-time cloud-to-ground lightning strikes, seconds latency | **Lightning** — entirely new hazard dimension not covered by any current source. | Rejected: inaccessible endpoints and incompatible non-commercial licensing |

#### Tier 2 — High Value (May Need Free Key or More Integration)

| Source | Coverage | Data | Why It Matters | Key | Status |
|--------|----------|------|----------------|-----|--------|
| NASA FIRMS | Global | VIIRS 375m satellite fire hotspots | Global wildfire visibility beyond US-only NIFC | Free key needed | Pending |
| EPA AirNow / OpenAQ | U.S. / Global | Air quality AQI by ZIP/latlon, multi-pollutant | More granular than Open-Meteo for US; OpenAQ adds 200+ countries | Free key required for each candidate | Pending |
| EMSC | Europe-Mediterranean + global | Earthquake data, felt reports, community-sourced | Complements USGS with European focus and felt intensity reports | No | ✅ Done |
| Smithsonian GVP | Global | Holocene volcano locations, geology, and eruption history | Authoritative geographic baseline alongside active GDACS, GeoNet, and USGS alerts | No | ✅ Active as baseline context |
| ReliefWeb | Global | Curated humanitarian disaster reports, situation reports | Adds humanitarian context to natural hazard data | Pre-approved appname | Blocked: anonymous v2 requests return 403 until an appname is approved |
| JTWC | Indian Ocean + West Pacific | Tropical cyclone warnings beyond NHC basins | Covers basins NHC doesn't (Asia-Pacific) | No | Pending |

#### Tier 3 — Niche But Valuable

| Source / Capability | Coverage | Notes |
|---------------------|----------|-------|
| NOAA NDFD | United States | National Digital Forecast Database — gridded 2.5km forecasts (temp, precip, wind, heat risk, visibility) |
| NOAA Tsunami Warning (PTWC/NTWC) | Pacific/Atlantic/Caribbean | CAP/ATOM feeds for tsunami warnings |
| GWIS / EFFIS | Global / Europe | Fire danger indices, burned area, active fires |
| GloFAS / Copernicus | Global / Europe | Global flood awareness forecasts |
| NOAA NCEI Climate Data | United States | Historical climate normals, severe weather data inventory |
| HIFLD | United States | Critical infrastructure locations (hospitals, schools, power plants, etc.) |
| GlobalBuildingAtlas | Global | Building footprint counts, heights, density — for impact exposure analysis |
| IBTrACS | Global historical tropical cyclones | Historical context, not live risk feed |
| WMO CAP warning aggregation | Global by country | Valuable but source discovery and normalization are complex |

HDX / HOT OpenStreetMap facility exposure is active as a contextual capability rather than a live hazard feed. It uses the key-free HOT Raw Data API only when an incident detail is opened, queries a provider-bounded 0.7-mile area, and never affects severity or notifications.

BoM Australia warning feeds were revalidated in July 2026 and are not eligible for production promotion under the anonymous/API terms observed. Reconsider only after obtaining a registered-user publishing agreement from the Bureau.

### Candidate research backlog

Researched open data sources not yet active are tracked in [docs/new-data-sources-roadmap.md](docs/new-data-sources-roadmap.md). It covers global fire, lightning, drought, flood forecasting, tsunami/sea-level, epidemic, conflict/humanitarian, air quality, and national feeds (Europe, Asia-Pacific, Latin America) with access methods, licences, and why each is included.

### Integration Pattern

New event sources should follow the existing architecture:

```text
src/services/<source>.ts             Fetch and normalize source data
src/types/riskEvent.ts               Extend EventSource/EventCategory only when needed
src/hooks/useRiskFeeds.ts            Add React Query integration
src/lib/riskInsights.ts              Add filters, colors, ranking behavior
src/components/UpdatePanel.tsx       Add source summary row when useful
src/components/MapLegend.tsx         Add legend entry
src/components/EventDetailPanel.tsx  Add source-specific detail fields
public/_headers                      Add CSP connect-src host
```

Supplemental environmental signals that do not fit the main `RiskEvent` model should use `SupplementalRiskSignal` and receive a deliberate UI path instead of being forced into the event feed.

## Track B — OpenRiskRadar for iOS

### Strategic direction

OpenRiskRadar for iOS is a separate native Apple-first product track. It should be designed as a privacy-focused commercial app that may eventually offer native private sync, sharing, widgets, notifications, and App Store monetization. It should not depend on web user accounts.

### Phase 0 — Product and architecture definition

- Define native iOS product requirements.
- Identify which current web concepts should be ported.
- Define CloudKit record model.
- Define private versus shared data ownership.
- Define family/small-team sharing model.
- Define StoreKit product structure.
- Define notification limitations and guarantees.
- Define native map and feed experience.
- Define offline behavior.
- Define privacy model.
- Define how authoritative source attribution is preserved.

### Phase 1 — Native MVP

- SwiftUI application shell.
- MapKit map and place search.
- Current risk summary and feed experience.
- Core hazard feed integration.
- Canonical incident model and severity classification.
- Local saved locations.
- CloudKit private sync.
- Clean native incident detail views.
- No traditional OpenRiskRadar account.

### Phase 2 — Apple-native differentiation

- Push notifications where architecture supports them.
- Home Screen widgets.
- Lock Screen widgets.
- Live Activities for suitable high-priority incidents.
- App Intents.
- Siri integration.
- Deep linking.
- Share sheets.
- Native accessibility support.

### Phase 3 — CloudKit sharing

- Family sharing.
- Shared locations and watches.
- Shared trips and properties.
- Shared notes.
- Incident acknowledgements.
- CKShare architecture.
- Ownership and participant permission behavior.
- Clear handling when owners revoke or delete shares.

### Phase 4 — Monetization

- StoreKit 2.
- Free tier.
- Pro tier.
- Family tier.
- Small Team tier if justified.
- Subscription entitlements.
- App Store launch preparation.
- Privacy disclosures.
- Purchase restoration.
- Family Sharing evaluation where appropriate.

### Phase 5 — Continuous monitoring decision

The product must decide whether it can satisfy expectations using:

- Foreground refresh.
- Local processing.
- Best-effort iOS background tasks.
- CloudKit synchronization.

Or whether it requires a separate backend for:

- minimal always-on risk ingestion.
- remote notification infrastructure.
- server-side change detection.

CloudKit does not alone guarantee 24/7 continuous monitoring of external risk feeds.

### Phase 6 — Future Android evaluation

- Android is a future native product track only.
- Reuse product concepts, risk models, incident correlation, and UX learnings as appropriate.
- Do not make Android the current implementation priority.

## Architecture principles

- The public website remains anonymous by design.
- Native apps do not require web accounts.
- Each platform may have its own native implementation.
- Domain concepts should remain consistent across platforms.
- CloudKit is the preferred starting point for Apple-native private data, synchronization, and sharing.
- CloudKit is not equivalent to an always-running external-feed monitoring engine.
- Avoid premature backend complexity.
- Preserve privacy and minimize centralized user data.
- Preserve authoritative source attribution.
- The open-source website remains valuable independently of commercial native apps.
