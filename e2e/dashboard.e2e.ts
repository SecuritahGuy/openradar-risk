import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function forecastPeriods() {
  return Array.from({ length: 10 }, (_, index) => {
    const day = String(22 + Math.floor(index / 2)).padStart(2, "0");
    const daytime = index % 2 === 0;
    return {
      name: daytime ? "Day" : "Night",
      isDaytime: daytime,
      temperature: daytime ? 82 + index : 64 + index,
      relativeHumidity: { value: 58, unitCode: "wmoUnit:percent" },
      windSpeed: "8 to 16 mph",
      windDirection: "SW",
      probabilityOfPrecipitation: { value: 35, unitCode: "wmoUnit:percent" },
      shortForecast: daytime ? "Partly Sunny" : "Partly Cloudy",
      detailedForecast: daytime
        ? `Detailed forecast guidance for day ${Math.floor(index / 2) + 1}.`
        : "Partly cloudy overnight.",
      startTime: `2026-07-${day}T${daytime ? "06" : "18"}:00:00-05:00`,
    };
  });
}

function hourlyForecastPeriods() {
  return Array.from({ length: 120 }, (_, index) => ({
    name: "Hourly",
    isDaytime: index % 24 >= 6 && index % 24 < 18,
    temperature: 70 + (index % 12),
    relativeHumidity: { value: 55, unitCode: "wmoUnit:percent" },
    windSpeed: "10 mph",
    windDirection: "W",
    probabilityOfPrecipitation: { value: index % 4 === 0 ? 45 : 20, unitCode: "wmoUnit:percent" },
    shortForecast: index % 4 === 0 ? "Chance Showers" : "Partly Cloudy",
    detailedForecast: "",
    startTime: new Date(Date.UTC(2026, 6, 22, 5 + index)).toISOString(),
  }));
}

function gvpFixture() {
  return {
    type: "FeatureCollection",
    numberReturned: 1,
    numberMatched: 1,
    features: [{
      type: "Feature",
      id: "GVP-VOTW.321050",
      geometry: { type: "Point", coordinates: [-122.18, 46.2] },
      properties: {
        Volcano_Number: "321050",
        Volcano_Name: "Mount St. Helens",
        Primary_Volcano_Type: "Stratovolcano",
        Volcanic_Landform: "Stratovolcano",
        Last_Eruption_Year: "2008",
        Country: "United States",
        Region: "Canada and Western USA",
        Subregion: "Cascade Range",
        Latitude: "46.2",
        Longitude: "-122.18",
        Elevation: "2549",
        Tectonic_Setting: "Subduction zone / Continental crust",
        Geologic_Epoch: "Holocene",
        Evidence_Category: "Eruption Dated",
        Major_Rock_Type: "Andesite / Basaltic Andesite",
      },
    }],
  };
}

async function blockExternalRequests(
  page: Page,
  options: {
    tsunamiFallback?: boolean;
    weatherForecast?: boolean;
    newYorkTransportation?: boolean;
    gvpBaseline?: boolean;
  } = {}
) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      options.gvpBaseline &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.pathname === "/api/smithsonian/gvp"
    ) {
      await route.fulfill({
        contentType: "application/geo+json",
        body: JSON.stringify(gvpFixture()),
      });
    } else if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else if (url.hostname === "nominatim.openstreetmap.org" && url.pathname === "/search") {
      const location = options.newYorkTransportation
        ? {
            lat: "41.7848",
            lon: "-73.9332",
            display_name: "12538, Hyde Park, Dutchess County, New York, United States",
            address: {
              postcode: "12538",
              town: "Hyde Park",
              county: "Dutchess County",
              state: "New York",
              country: "United States",
              country_code: "us",
            },
          }
        : options.gvpBaseline
          ? {
              lat: "46.0528",
              lon: "-122.2995",
              display_name: "Cougar, Cowlitz County, Washington, United States",
              address: {
                village: "Cougar",
                county: "Cowlitz County",
                state: "Washington",
                country: "United States",
                country_code: "us",
              },
            }
          : {
            lat: "42.3443070",
            lon: "-88.0335501",
            display_name: "60030, Grayslake, Lake County, Illinois, United States",
            address: {
              postcode: "60030",
              town: "Grayslake",
              county: "Lake County",
              state: "Illinois",
              country: "United States",
              country_code: "us",
            },
            };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([location]),
      });
    } else if (options.newYorkTransportation && url.hostname === "data.transportation.gov") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([{
          state: "NEW YORK",
          issuingorganization: "New York DOT",
          feedname: "NYSDOT 511 WZDx",
          url: { url: "https://511ny.org/api/wzdx" },
          active: true,
          needapikey: false,
        }]),
      });
    } else if (options.newYorkTransportation && url.hostname === "511ny.org" && url.pathname === "/api/wzdx") {
      const description = "Bridge maintenance on US 9 northbound between Pine Street and Market Street - various lanes closed";
      const relativeTime = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const occurrence = (id: string, start: string, end: string, related: Array<{ type: string; id: string }>) => ({
        id,
        type: "Feature",
        geometry: { type: "MultiPoint", coordinates: [[-73.75, 41.79]] },
        properties: {
          core_details: {
            event_type: "work-zone",
            data_source_id: "TRANSCOM",
            road_names: ["US 9"],
            direction: "unknown",
            description,
            update_date: relativeTime(-1),
            related_road_events: related,
          },
          road_event_id: id,
          beginning_cross_street: "Pine Street",
          ending_cross_street: "Market Street",
          start_date: start,
          end_date: end,
          vehicle_impact: "unknown",
          is_start_position_verified: false,
          is_end_position_verified: false,
          restrictions: [],
          types_of_work: [{ type: "maintenance" }],
          lanes: [{ status: "closed" }],
        },
      });
      await route.fulfill({
        contentType: "application/geo+json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [
            occurrence("work-1", relativeTime(-1), relativeTime(6), [
              { type: "next-occurrence", id: "work-2" },
            ]),
            occurrence("work-2", relativeTime(24), relativeTime(30), [
              { type: "first-occurrence", id: "work-1" },
            ]),
          ],
        }),
      });
    } else if (options.gvpBaseline && url.hostname === "webservices.volcano.si.edu") {
      await route.fulfill({
        contentType: "application/geo+json",
        body: JSON.stringify(gvpFixture()),
      });
    } else if (options.weatherForecast && url.hostname === "api.weather.gov" && url.pathname.startsWith("/points/")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ properties: {
          forecast: "https://api.weather.gov/gridpoints/LOT/70,76/forecast",
          forecastHourly: "https://api.weather.gov/gridpoints/LOT/70,76/forecast/hourly",
          observationStations: "https://api.weather.gov/gridpoints/LOT/70,76/stations",
        } }),
      });
    } else if (options.weatherForecast && url.hostname === "api.weather.gov" && url.pathname.endsWith("/stations")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ features: [] }) });
    } else if (options.weatherForecast && url.hostname === "api.weather.gov" && url.pathname.endsWith("/forecast/hourly")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ properties: { periods: hourlyForecastPeriods() } }),
      });
    } else if (options.weatherForecast && url.hostname === "api.weather.gov" && url.pathname.endsWith("/forecast")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ properties: { periods: forecastPeriods() } }),
      });
    } else if (options.tsunamiFallback && url.hostname === "tsunami.gov") {
      await route.fulfill({ status: 502, body: "Bad gateway" });
    } else if (options.tsunamiFallback && url.hostname === "www.tsunami.gov" && url.pathname.endsWith("Atom.xml")) {
      await route.fulfill({
        contentType: "application/atom+xml",
        body: url.pathname.includes("PAAQ") ? `<feed xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#"><entry>
          <title>Browser fallback event</title><updated>${new Date().toISOString()}</updated>
          <geo:lat>42.35</geo:lat><geo:long>-88.05</geo:long>
          <summary><strong>Category:</strong> Warning<br/>Move inland.</summary>
          <id>urn:uuid:browser-fallback</id>
        </entry></feed>` : "<feed></feed>",
      });
    } else {
      await route.abort("blockedbyclient");
    }
  });
}

async function openZip(page: Page) {
  await blockExternalRequests(page);
  await page.goto("/app?q=60030");
  await expect(page.getByText("Grayslake, IL", { exact: false }).first()).toBeVisible();
}

test("ZIP search is accessible and overflow-free on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openZip(page);

  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Live risk radar dashboard" })).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Search by ZIP code or city" })).toHaveValue("60030");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const targets = page.locator("button:visible, input:not([type=checkbox]):not([type=radio]):visible, select:visible");
  const undersized = await targets.evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName, width: rect.width, height: rect.height };
    })
    .filter((target) => target.width < 44 || target.height < 44));
  expect(undersized).toEqual([]);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
});

test("short desktop view keeps the map reachable through scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await openZip(page);
  const main = page.locator(".app-main");
  const map = page.locator(".map-view");
  await expect(map).toBeVisible();
  expect(await map.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(360);
  expect(await main.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("monitored-place collapse state survives reload", async ({ page }) => {
  await openZip(page);
  await page.getByRole("button", { name: /Save Location/ }).click();
  const overview = page.getByTestId("saved-location-overview");
  await expect(overview).toBeVisible();
  const toggle = page.getByTestId("saved-location-overview-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByTestId("saved-location-overview-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("NASA imagery layer and opacity preferences survive reload", async ({ page }) => {
  await openZip(page);
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByRole("checkbox", { name: "NASA satellite imagery" }).check();
  await page.getByLabel("NASA GIBS layer").selectOption("Snow_Cover");
  await page.getByLabel("NASA GIBS opacity").fill("55");
  await expect(page.getByText("Snow-cover fraction")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("checkbox", { name: "NASA satellite imagery" })).toBeChecked();
  await expect(page.getByLabel("NASA GIBS layer")).toHaveValue("Snow_Cover");
  await expect(page.getByLabel("NASA GIBS opacity")).toHaveValue("55");
});

test("a NOAA JSON outage activates the official tsunami fallback without a hard source error", async ({ page }) => {
  await blockExternalRequests(page, { tsunamiFallback: true });
  await page.goto("/app?q=60030");
  await expect(page.getByText("Grayslake, IL", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Official NTWC\/PTWC feed fallback active with 1 signal/)).toBeVisible();
  await expect(page.getByText(/NOAA Tsunami API returned 502/)).toHaveCount(0);
});

test("forecast dialog is centered, scrollable, accessible, and restores focus", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !message.text().includes("net::ERR_BLOCKED_BY_CLIENT")
    ) {
      consoleProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));
  await page.setViewportSize({ width: 1280, height: 620 });
  await blockExternalRequests(page, { weatherForecast: true });
  await page.goto("/app?q=60030");
  await expect(page.getByText("Grayslake, IL", { exact: false }).first()).toBeVisible();

  const opener = page.getByRole("button", { name: "View 5-day forecast" });
  await expect(opener).toBeVisible();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "5-day forecast" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#forecast-dialog-title")).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(700);
  expect(Math.abs((bounds!.x + bounds!.width / 2) - 640)).toBeLessThan(3);
  expect(await page.locator(".forecast-dialog-body").evaluate(
    (element) => element.scrollHeight > element.clientHeight
  )).toBe(true);

  await page.getByRole("button", { name: /Thu, Jul 23/ }).click();
  await expect(page.getByRole("heading", { name: "Thursday, July 23" })).toBeVisible();
  await expect(page.getByText("Detailed forecast guidance for day 2.")).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include(".forecast-dialog-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious"
  )).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  expect(consoleProblems).toEqual([]);
});

test("forecast dialog becomes a bottom sheet without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await blockExternalRequests(page, { weatherForecast: true });
  await page.goto("/app?q=60030");
  await page.getByRole("button", { name: "View 5-day forecast" }).click();

  const dialog = page.getByRole("dialog", { name: "5-day forecast" });
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.width - 375)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height - 667)).toBeLessThan(2);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator(".forecast-dialog-body").evaluate(
    (element) => element.scrollHeight > element.clientHeight
  )).toBe(true);

  await page.getByRole("button", { name: "Close 5-day forecast" }).click();
  await expect(dialog).toHaveCount(0);
});

test("NYSDOT recurrences use one construction marker with richer details", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockExternalRequests(page, { newYorkTransportation: true });
  await page.goto("/app?q=12538");
  await expect(page.getByText("Hyde Park, NY", { exact: false }).first()).toBeVisible();

  const marker = page.locator(".construction-event-marker");
  await expect(marker).toHaveCount(1);
  await expect(marker.locator("svg")).toHaveCount(1);
  await marker.click({ force: true });
  await page.getByRole("button", { name: /Details/ }).click();

  const dialog = page.getByRole("dialog", { name: /Bridge maintenance on US 9 northbound/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Roadwork Details")).toBeVisible();
  await expect(dialog.getByText("Pine Street to Market Street")).toBeVisible();
  await expect(dialog.getByText("Some Lanes Closed", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 linked occurrences through")).toBeVisible();
  await expect(dialog.getByText("Maintenance", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Closed", { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include(".event-detail-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious"
  )).toEqual([]);
});

test("Smithsonian volcano records stay in historical baseline context", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockExternalRequests(page, { gvpBaseline: true });
  await page.goto("/app?q=Cougar%2C%20WA");
  await expect(page.getByText("Cougar, WA", { exact: false }).first()).toBeVisible();

  const baseline = page.getByTestId("volcano-baseline-context");
  await expect(baseline).toBeVisible();
  await expect(baseline).toContainText("Mount St. Helens");
  await expect(baseline).toContainText("Historical");
  await expect(baseline).toContainText("do not affect risk posture or background notifications");
  await expect(baseline).toContainText("Subduction zone / Continental crust");
  await expect(page.locator(".feed-explorer")).not.toContainText("Mount St. Helens");

  const marker = page.locator(
    '.leaflet-interactive[aria-label*="historical volcano baseline"]'
  );
  await expect(marker).toHaveCount(0);

  const historicalMapContext = page.getByRole("checkbox", {
    name: "Historical and older incident context",
  });
  await expect(historicalMapContext).not.toBeChecked();
  await historicalMapContext.check();
  await expect(historicalMapContext).toBeChecked();
  await expect(marker).toHaveCount(1);
  await marker.click({ force: true });
  await expect(page.getByText("Historical baseline · not an active alert")).toBeVisible();
  await expect(page.getByRole("link", { name: /Official source/ })).toHaveAttribute(
    "href",
    "https://volcano.si.edu/volcano.cfm?vn=321050"
  );
});
