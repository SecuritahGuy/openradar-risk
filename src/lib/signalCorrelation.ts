import type { EventSource, RiskEvent, Severity } from "../types/riskEvent";
import { incidentMetadata } from "./incidents";
import { activeConcernEvents, severityRank, sourceLabel } from "./riskInsights";

export type SignalAgreement = "corroborated" | "single-source";

export interface CorrelatedSignal {
  id: string;
  label: string;
  agreement: SignalAgreement;
  agreementLabel: string;
  severity: Severity;
  sources: EventSource[];
  providerLabels: string[];
  providerCount: number;
  eventCount: number;
  latestUpdatedAt: string | null;
  summary: string;
  events: RiskEvent[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function providerLabels(event: RiskEvent): string[] {
  const metadata = incidentMetadata(event);
  if (!metadata) return [event.provider?.label ?? sourceLabel(event.source)];
  return unique(metadata.contributors.map((contributor) =>
    contributor.provider?.label ?? sourceLabel(contributor.source)
  ));
}

function signalSummary(
  headline: string,
  agreement: SignalAgreement,
  providers: string[]
): string {
  if (agreement === "corroborated") {
    return `${headline} is independently reported by ${providers.join(", ")}.`;
  }
  return `${headline} is currently reported by ${providers[0]}.`;
}

function correlatedSignal(event: RiskEvent): CorrelatedSignal {
  const metadata = incidentMetadata(event);
  const providers = providerLabels(event);
  const agreement: SignalAgreement = metadata?.agreement === "corroborated"
    ? "corroborated"
    : "single-source";
  const sources = metadata?.sources ?? [event.source];

  return {
    id: event.id,
    label: event.headline,
    agreement,
    agreementLabel: agreement === "corroborated" ? "Corroborated" : "Single source",
    severity: event.severity,
    sources,
    providerLabels: providers,
    providerCount: metadata?.providerCount ?? 1,
    eventCount: metadata?.eventCount ?? 1,
    latestUpdatedAt: event.updatedAt || null,
    summary: signalSummary(event.headline, agreement, providers),
    events: [event],
  };
}

export function buildSignalCorrelations(
  events: RiskEvent[],
  nowMs = Date.now()
): CorrelatedSignal[] {
  return activeConcernEvents(events, nowMs)
    .map(correlatedSignal)
    .sort((a, b) => {
      const agreementRank = { corroborated: 2, "single-source": 1 };
      const agreementDelta = agreementRank[b.agreement] - agreementRank[a.agreement];
      if (agreementDelta !== 0) return agreementDelta;

      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;

      const updatedDelta = new Date(b.latestUpdatedAt ?? 0).getTime() -
        new Date(a.latestUpdatedAt ?? 0).getTime();
      if (updatedDelta !== 0) return updatedDelta;

      return a.id.localeCompare(b.id);
    });
}

export function summarizeSourceAgreement(
  events: RiskEvent[],
  nowMs = Date.now()
): string {
  const signals = buildSignalCorrelations(events, nowMs);
  if (signals.length === 0) {
    return "No active hazard incidents are reporting in this radius.";
  }

  const corroborated = signals.filter((signal) => signal.agreement === "corroborated");
  if (corroborated.length > 0) {
    const top = corroborated[0];
    return `${corroborated.length} incident${corroborated.length !== 1 ? "s are" : " is"} independently corroborated. ${top.summary}`;
  }

  return `${signals.length} active incident${signals.length !== 1 ? "s are" : " is"} in scope; none ${signals.length === 1 ? "is" : "are"} independently corroborated. ${signals[0].summary}`;
}
