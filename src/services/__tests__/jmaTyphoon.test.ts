import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildJmaDataUrl,
  fetchJmaCyclones,
  normalizeJmaCyclone,
  type JmaPastTrack,
  type JmaTargetCyclone,
} from "../jmaTyphoon";

const target: JmaTargetCyclone = {
  tropicalCyclone: "TC2608",
  typhoonNumber: "2608",
  category: "TY",
  basetime: "20260722120000",
};
const track: JmaPastTrack = {
  tropicalCyclone: "TC2608",
  track1: {
    preTyphoon: [[12.1, 137.5]],
    typhoon: [[18.2, 129.5], [20.0, 128.5]],
  },
};

afterEach(() => vi.restoreAllMocks());

describe("JMA tropical cyclones", () => {
  it("uses the same-origin proxy in browsers and the official URL in Workers", () => {
    expect(buildJmaDataUrl("targetTc.json", true)).toBe(
      "/api/jma/typhoons?file=targetTc.json"
    );
    expect(buildJmaDataUrl("targetTc.json", false)).toBe(
      "https://www.jma.go.jp/bosai/typhoon/data/targetTc.json"
    );
  });

  it("normalizes the latest official [latitude, longitude] track point", () => {
    expect(normalizeJmaCyclone(target, track)).toMatchObject({
      source: "JMA",
      sourceEventId: "TC2608",
      category: "Tropical",
      severity: "Severe",
      headline: "JMA Tropical Cyclone T8",
      latitude: 20,
      longitude: 128.5,
      updatedAt: "2026-07-22T03:00:00.000Z",
      provider: { id: "jma-typhoon" },
    });
  });

  it("returns active systems in range and treats an empty target list as quiet", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([target]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([track]), { status: 200 }));
    expect(await fetchJmaCyclones(20, 128.5, 50)).toHaveLength(1);

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([track]), { status: 200 }));
    expect(await fetchJmaCyclones(20, 128.5, 50)).toEqual([]);
  });
});
