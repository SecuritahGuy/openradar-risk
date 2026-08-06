import { useQuery } from "@tanstack/react-query";
import {
  fetchHdxExposure,
  resolveExposureCenter,
  type HdxExposureResult,
} from "../services/hdx";
import type { ResolvedLocation } from "../types/location";
import type { RiskEvent } from "../types/riskEvent";

export interface UseHdxExposureResult {
  available: boolean;
  data: HdxExposureResult | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}

export function useHdxExposure(
  event: RiskEvent | null,
  location: ResolvedLocation | null
): UseHdxExposureResult {
  const center = resolveExposureCenter(event, location);
  const query = useQuery({
    queryKey: [
      "hdx-exposure",
      event?.id,
      center?.latitude,
      center?.longitude,
    ],
    queryFn: () => fetchHdxExposure(center!),
    enabled: center != null,
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    retry: 1,
  });

  return {
    available: center != null,
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
