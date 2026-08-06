# OpenRiskRadar — New Data Source Roadmap

This document tracks candidate open data sources researched for OpenRiskRadar Web, beyond what is already enabled (see `ROADMAP.md` for currently active sources). Candidates are grouped by integration cost and value. Status reflects research/integration state only.

Project constraints (from `ROADMAP.md` / `README.md`): browser-first, anonymous, no-backend preferred, no API keys preferred (free key allowed when CORS-friendly), preserve source attribution, fit `RiskEvent` or `SupplementalRiskSignal` models.

---

## Works vs. Will Not Work (validation summary)

Statuses below reflect live HTTP + CORS + payload testing performed from the project environment.

### ✅ Will work (no key/token required — browser-direct)
- **WHO Disease Outbreak News** — active; 200, CORS `*`, newest-first OData JSON with recency and outbreak-title country matching; local posture requires a state, county, or city mention.
- **NASA GIBS** — active Web Mercator WMTS/WMS overlays for true color, thermal anomalies, aerosol/smoke, and snow cover, with persisted opacity/date controls and product legends.
- **NOAA NTWC/PTWC Atom feeds** — active as the production fallback for the primary NOAA tsunami JSON endpoint; official feeds are proxied, filtered to actionable categories, and limited to 24 hours.
- **DWD Germany** (WFS GeoJSON warning polygons) — active in production; browser-direct with CORS.
- **GeoNet New Zealand** — 200, CORS `*`, GeoJSON (requires `MMI` param).
- **HDX / HOT OSM** — CKAN API 200, CORS `*`, real JSON.

### ✅ Will work (free key/token required)
- **OpenAQ** — 401 without `X-API-Key` (free key; CORS enabled).
- **WAQI** — 200 with demo token, CORS `*` (free token).
- **UNESCO-IOC Sea Level** — 401 without V2 key (free key).
- **CWA Taiwan** — 401 on bad key (free auth code).
- **ReliefWeb** — 403 without pre-approved `appname` (free request).

### ⚠️ Partial / needs re-test or deeper integration
- **INMET WIS2 (Brazil)** — live, CORS `*`, but exposes SYNOP obs only (no CAP alert collection).
- **WMO SWIC / WIS2 GDC** — live, CORS `*`, but discovery-only catalog (no data links).
- **EFFIS / GWIS** — unreachable from test env (HTTP 000); standard public WMS, re-test from deploy region.
- **SPEI / ACLED** — portal URLs 404'd in test; verify exact endpoints.
- **GloFAS / CAMS / IMD / KNMI / AEMET / Météo-France / JMA** — reachable portals; need key, proxy, or third-party wrapper.
- **BoM Australia** — technically reachable, but blocked from promotion by explicit API/anonymous-feed reuse restrictions pending a registered-user data agreement.
- **Global Tsunami Monitor** — technically reachable, but CRISISINFO documents REST API access as requiring a separate agreement; keep the research adapter inactive pending written permission.

### ❌ Will not work (rejected)
- **Blitzortung / LightningMaps** — all WebSocket hosts `ECONNREFUSED`; archive `401`; CC-BY-SA non-commercial licence conflicts with the commercial iOS track. Drop lightning for now.

### ⏸️ Backlog (deferred by request)
- **NASA FIRMS** — key-gated (free MAP_KEY); endpoint confirmed live (400 on bad key). Held on backlog.

---

## Tier 1 — Drop-in, no key / CORS-friendly, high value

| Source | Coverage | Signals | Access | License / Attribution | Why on the list | Status |
|--------|----------|---------|--------|------------------------|-----------------|--------|
| NASA FIRMS (Active Fire) | Global | MODIS (1km) + VIIRS (375m) fire hotspots, FRP, brightness, confidence | REST CSV, free MAP_KEY (`firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SRC}/{BBOX}/{DAYS}`); CORS not guaranteed → may need proxy | NASA EOSDIS; "NASA FIRMS" | NIFC is US-only; fills global fire gap with higher-res VIIRS | **Backlog** (key-gated; endpoint live, returns 400 on bad key) |
| Blitzortung / LightningMaps | Global (densest EU/NA/Oceania) | Near-real-time cloud-to-ground + intracloud lightning (lat/lon, time, polarity) | WebSocket `wss://ws1-7.blitzortung.org:3000/`; no REST, no key; CORS N/A for WS | CC-BY-SA 4.0; non-commercial only | Lightning entirely uncovered; only free global real-time feed | **Rejected** (all WS hosts ECONNREFUSED; archive 401; non-commercial licence conflicts with iOS commercial track) |
| WHO Disease Outbreak News | Global | Confirmed public-health events (outbreaks/epidemics) with region/country | REST JSON `who.int/api/news/diseaseoutbreaknews`; no key; CORS `*` | WHO open content | Disease/epidemic hazard completely absent; authoritative | ✅ Active with newest-first queries, a 45-day window, outbreak-title country matching, local posture gated by state/county/city mention, capped results, saved-location coverage, and fixture contracts |
| NASA GIBS | Global | 1000+ satellite imagery layers (thermal anomalies, aerosol/smoke, SST, snow) as tiles | Web Mercator WMTS/WMS at `gibs.earthdata.nasa.gov`; no key; CORS-enabled | NASA open data; acknowledge GIBS | Adds rich global raster overlays complementing vector feeds | ✅ Active with persisted recent-date/opacity controls, legends, partial-tile status, published matrix limits, and raster WMS rendering for thermal-anomaly vectors |
| OpenAQ | Global (10k+ stations, 130+ countries) | PM2.5/PM10/O3/NO2/SO2/CO/BC by location | REST `api.openaq.org/v3/...` (JSON), free `X-API-Key`; CORS enabled | Mixed per-station (incl. public domain); attribute `licenses` | More granular/global than Open-Meteo air quality | **Validated (key-gated)** (401 without key; documented free key) |
| WAQI (World Air Quality Index) | Global (10k+ stations, 100+ countries) | AQI + per-pollutant, 3–8 day forecast, stations-in-bounds | REST `api.waqi.info/feed/{city}/?token=...`; free token; CORS `*` | Free "acceptable use"; attribution | Easy global AQI overlay, broader than OpenAQ | **Validated (token-gated)** (200 with demo token, CORS `*`) |
| UNESCO-IOC Sea Level Station Monitoring | Global (~hundreds of gauges + DART) | Real-time sea-level height, station status, QC flags | REST `api.ioc-sealevelmonitoring.org/v2/...`; free V2 key; CORS generally OK | Free; cite DOI 10.14284/482 | NOAA tsunami is US-centric; direct water-level signal | **Validated (key-gated)** (401 without key; endpoint live) |
| Global Tsunami Monitor (crisisinfo.eu) | Global | Aggregated tsunami alerts as GeoJSON | Public map endpoint observed; documented REST API access is agreement-based | Separate provider agreement required | Supplementary modeled tsunami context; not an official warning center | **Blocked on access terms** (do not activate without a written API/reuse agreement) |

---

## Tier 2 — Global multipliers (may need key / proxy)

| Source | Coverage | Signals | Access | License / Attribution | Why on the list | Status |
|--------|----------|---------|--------|------------------------|-----------------|--------|
| WMO SWIC / WIS2 Global Discovery Cache | 130+ WMO Members | Official CAP warnings + tropical cyclone advisories aggregated | OGC API `wis2-gdc.weather.gc.ca/collections/...` (JSON); no key; CORS `*` | WMO core data free/unrestricted | Single backbone for global national-warning coverage beyond US/EU | **Validated but discovery-only** (CORS `*`; only `wis2-discovery-metadata` collection; feature `properties` have NO data `links` — catalog, not a live feed) |
| Copernicus GloFAS / EMS GFM | Global | River discharge forecasts (~30d), observed Sentinel-1 flooded-area extent | WMS map viewer (free account); CDS API server-side | Copernicus open; attribution | NWS/NWPS/UK EA are regional; fills global flood gap | **Pending** (viewer reachable; API server-side) |
| EFFIS / GWIS (fire danger) | Europe / Global | Fire Weather Index + components, active fires, burnt area | WMS `maps.effis.emergency.copernicus.eu` (TIME param) | EFFIS free; attribution | NIFC US-only; EU+global fire danger | **Unreachable from test env** (HTTP 000); standard public WMS — re-test from deploy region |
| Copernicus CAMS | Global | Modeled O3/NO2/CO/dust/aerosol, PM2.5/10 (EU), wildfire smoke/plume | ADS web + CDS API (free account + token, server-side) | Copernicus free/open | Complements OpenAQ ground stations with models | **Pending** (ADS reachable; server-side API) |
| SPEI Global Drought Monitor | Global (1° grid) | Standardized Precipitation-Evapotranspiration Index, 1–48 mo | NetCDF download `spei.csic.es`; no key; no point API | ODbL / CC-BY 3.0 | US Drought Monitor is US-only; standardized global drought | **Pending** (download page 404'd in test; verify URL) |
| ReliefWeb (UN OCHA) | Global | Curated disaster events/reports/appeals, affected population | REST `api.reliefweb.int/v2/...?appname=PREAPPROVED`; no key, pre-approved appname | UN OCHA; attribution | Humanitarian context layer vs. GDACS | **Validated (appname-gated)** (403 without approved appname; request appname) |
| ACLED | Global | Political violence, battles, explosions, violence vs civilians, protests | REST `api.acleddata.com/` + HDX CSV; free account+key | CC-BY 4.0 (HDX) | Civil/humanitarian "conflict hazard" layer absent | **Pending** (HDX dataset 404'd in test; verify slug) |
| HDX / HOT OSM exports | Global (where mapped) | Health facilities, schools, airports, population, POIs (GeoJSON) | Key-free HOT Raw Data API bounded plain-GeoJSON queries; HDX country exports remain available for research | OSM ODbL / dataset-specific HDX terms | Critical-infrastructure / building exposure gap | ✅ **Active for health and education exposure context** within 0.7 miles of an opened incident; excluded from risk and notifications |

---

## Tier 3 — National fills (proxy / CORS often required)

| Source | Coverage | Signals | Access | License / Attribution | Why on the list | Status |
|--------|----------|---------|--------|------------------------|-----------------|--------|
| DWD (Germany) | Germany | Severe weather warnings (CAP/WFS), nowcast, pollen, radar | `maps.dwd.de/geoserver/dwd/ows` WFS GeoJSON; no key; CORS-enabled | DWD open data; attribution | Finer than Meteoalarm aggregate | ✅ Official municipality warning polygons active; automatically enabled for Germany and filtered by radius |
| GeoNet (New Zealand) | New Zealand | Earthquakes and volcanic alert levels | `api.geonet.org.nz/quake?MMI=0` and `/volcano/val` GeoJSON (CORS `*`); no key | Free, CC-BY (cite DOIs) | Very active tectonics/volcanoes; browser-friendly | ✅ Earthquake and elevated volcanic-alert feeds active; no equivalent public landslide or tsunami endpoint is documented |
| CWA (Taiwan) | Taiwan | Earthquakes, tsunami, typhoons, weather warnings | `opendata.cwa.gov.tw/api/v1/...` REST; free auth code | Open Gov Data License v1.0 | High quake/typhoon exposure, no current coverage | **Validated (key-gated)** (401 on bad key; endpoint live) |
| JMA via P2Pquake / Wolfx | Japan | Earthquakes/EEW, tsunami, volcanic, typhoon | Official XML lacks CORS; use `api.p2pquake.net` or `api.wolfx.jp/jma_*.json` (free) | JMO "own risk"; secondary-use free | One of most seismic nations; no US/EU equivalent | **Pending** (third-party wrappers; verify CORS) |
| INMET WIS2 (Brazil) | Brazil | CAP weather warnings, SYNOP obs (GeoJSON) | OGC API `wis2bra.inmet.gov.br/oapi/collections/...`; no key; CORS `*` | WMO core data policy | Modern clean standard; fills South America | **Validated (obs only)** (CORS `*`, collections live; exposes SYNOP obs + `messages`, but NO CAP alert collection found) |
| IMD / INCOIS (India) | India | District warnings, cyclone, tsunami JSON | `api.imd.gov.in/api/v1/...` (free key, possible IP whitelist) | IMD terms; attribution | Major population exposure (monsoon/cyclone) | **Pending** (free key; verify) |
| BoM (Australia) | Australia | Severe weather/cyclone/flood warnings, flood gauge network | Current app JSON is CORS-readable; anonymous RSS/XML is automation-blocked | © Commonwealth of Australia; registered-user publishing/data agreement required | Australia floods/cyclones/bushfire weather | **Blocked on license** (live JSON metadata says it must not be used, copied, or shared; do not promote without written permission) |
| KNMI (Netherlands) | Netherlands | Dutch warnings (current/48h/week-ahead), obs | `api.dataplatform.knmi.nl/...` file-based REST; free key (anon available) | CC-BY-4.0 | Finer Dutch coverage than Meteoalarm | **Pending** (free key; verify CORS) |
| AEMET (Spain) | Spain | CAP warnings, maritime, fire indices, radar | `opendata.aemet.es/opendata/api/...` (free key, two-call); no CORS | AEMET open data; HVD | Rich Spanish CAP + maritime + fire | **Pending** (free key; no CORS → proxy) |
| Météo-France | France + DOM-TOM | Vigilance color warnings, models, avalanche, fire meteo | `public-api.meteofrance.fr/...` (free JWT); CORS likely blocked → proxy | Licence Ouverte Etalab | Fills France mainland + overseas | **Pending** (free JWT; proxy likely) |

---

## Context-only (historical, not live)

| Source | Coverage | Signals | Access | Why on the list |
|--------|----------|---------|--------|-----------------|
| World Bank CCKP / EM-DAT | Global | Historical disaster normals, climatology, sea-level, TC stats | AWS Open Data `registry.opendata.aws/wbg-cckp/` (NetCDF) | Risk baseline / long-term exposure context |
| WGMS | Global (reference glaciers) | Glacier mass balance, GLOFs, ice avalanches | FeatureServer / CSV (CC-BY 4.0) | Glacier hazard gap (annual cadence) |
| NOAA RadNet / OpenRadiation | US / partial global | Gamma dose rate, radioactivity | EPA `radnet.epa.gov` (US); OpenRadiation REST (free test key) | Nuclear/radiation gap |

---

## Integration patterns & gotchas

- **Browser-direct, no key, CORS-friendly today:** GIBS (WMTS), WMO SWIC/GDC (OGC API), WHO DON, OpenAQ, GeoNet, DWD WFS.
- **Official proxied fallback:** NOAA NTWC/PTWC Atom feeds, used only after the primary NOAA tsunami JSON path is empty or unavailable.
- **Need free key but CORS-friendly:** NASA FIRMS (MAP_KEY), WAQI (token), UNESCO-IOC V2 (key), OpenAQ (key).
- **Need a tiny proxy / CORS shim (breaks strict no-backend):** WMO SWIC node follows, CAMS/CEMS (server GRIB/NetCDF), AEMET/KNMI/IMD/CWA, P2Pquake/Wolfx, ACLED, ReliefWeb (appname).
- **CAP XML parsing** required for: SWIC, INMET, AEMET, JMA — normalize into `RiskEvent`. DWD is active through its GeoJSON WFS layer.
- **Recurring gotchas:** rate limits (FIRMS ~5000/10min), licence restrictions (Blitzortung non-commercial; BoM ambiguous), brittle scraping (PHIVOLCS/SMN not recommended), heavy GRIB/NetCDF (CAMS/CEMS need server decode).

## Next steps

1. Select from validated, license-compatible candidates based on the active gaps in `ROADMAP.md`; do not revive rejected Blitzortung work without a new access and licensing review.
2. Prefer no-key authoritative sources such as WHO Disease Outbreak News, GeoNet, DWD, or official NOAA warning-center feeds when they fill a defined product gap.
3. Implement adapters following the `ROADMAP.md` integration pattern (`src/services/<source>.ts`, types, `useRiskFeeds.ts`, risk insights, panels, and CSP headers).
4. Add fixture-based normalization tests and update `ROADMAP.md` in the same change that promotes a source into the active dashboard.
