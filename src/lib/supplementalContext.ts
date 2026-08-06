import type { SupplementalRiskSignal } from "../types/supplementalRisk";

export function supplementalSignalContributesToCurrentRisk(
  signal: SupplementalRiskSignal
): boolean {
  return signal.context !== "baseline" &&
    signal.context !== "exposure" &&
    signal.source !== "USGS_SHAKEMAP";
}
