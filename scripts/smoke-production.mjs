const baseUrl = (process.argv[2] ?? "https://openriskradar.com").replace(/\/$/, "");

const checks = [
  { path: "/", type: "text/html", status: 200 },
  { path: "/manifest.webmanifest", type: "application/manifest+json", status: 200 },
  { path: "/service-worker.js", type: "javascript", status: 200 },
  { path: "/api/status", type: "application/json", status: 200 },
  { path: "/api/noaa/tsunami", type: "application/json", status: 200 },
  { path: "/api/fema/risk-index?where=STCOFIPS%3D%2717031%27&outFields=*&resultRecordCount=1&f=json", type: "application/json", status: 200 },
  // Deliberately invalid inputs make these route checks fast and independent of upstream availability.
  { path: "/api/noaa/nwps?path=invalid", type: "application/json", status: 400 },
  { path: "/api/noaa/storm-events", type: "application/json", status: 400 },
  { path: "/api/jma/typhoons?file=invalid", type: "application/json", status: 400 },
];

let failed = false;
for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: { Accept: check.type },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const body = await response.text();
    const isHtmlFallback = /^\s*<!doctype html/i.test(body) && check.path.startsWith("/api/");
    const passed = response.status === check.status && contentType.includes(check.type) && !isHtmlFallback;
    console.log(`${passed ? "PASS" : "FAIL"} ${response.status} ${check.path} (${contentType || "no content-type"})`);
    if (!passed) failed = true;
  } catch (error) {
    console.log(`FAIL ${check.path} (${error instanceof Error ? error.message : "request failed"})`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
