import { cachedPublicProxy, jsonError, type PagesContext } from "../../_shared/proxy";

const BASE = "https://www.jma.go.jp/bosai/typhoon/data";
const ALLOWED_FILES = new Set(["targetTc.json", "pastTracks.json"]);

export function buildJmaUpstreamUrl(requestUrl: string): URL | null {
  const requested = new URL(requestUrl);
  const file = requested.searchParams.get("file");
  if (!file || !ALLOWED_FILES.has(file)) return null;
  return new URL(`${BASE}/${file}`);
}

export async function onRequestGet({ request }: PagesContext): Promise<Response> {
  const upstream = buildJmaUpstreamUrl(request.url);
  if (!upstream) {
    return jsonError({
      code: "INVALID_QUERY",
      message: "A supported JMA typhoon data file is required",
      provider: "JMA",
      status: 400,
    });
  }

  return cachedPublicProxy(request, upstream, 300, "application/json", "JMA");
}
