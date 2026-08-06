import { describe, expect, it } from "vitest";
import { buildJmaUpstreamUrl } from "../jma/typhoons";

describe("JMA typhoon proxy", () => {
  it("allows only the two official data files used by the adapter", () => {
    expect(buildJmaUpstreamUrl(
      "https://example.test/api/jma/typhoons?file=targetTc.json"
    )?.toString()).toBe(
      "https://www.jma.go.jp/bosai/typhoon/data/targetTc.json"
    );
    expect(buildJmaUpstreamUrl(
      "https://example.test/api/jma/typhoons?file=pastTracks.json"
    )?.toString()).toBe(
      "https://www.jma.go.jp/bosai/typhoon/data/pastTracks.json"
    );
  });

  it("rejects missing, unknown, and path-traversal file names", () => {
    const route = "https://example.test/api/jma/typhoons";
    expect(buildJmaUpstreamUrl(route)).toBeNull();
    expect(buildJmaUpstreamUrl(`${route}?file=forecast.json`)).toBeNull();
    expect(buildJmaUpstreamUrl(`${route}?file=../targetTc.json`)).toBeNull();
  });
});
