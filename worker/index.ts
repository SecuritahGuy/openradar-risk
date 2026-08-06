import { onRequestGet as femaRiskIndex } from "../functions/api/fema/risk-index";
import { onRequestGet as nwps } from "../functions/api/noaa/nwps";
import { onRequestGet as stormEvents } from "../functions/api/noaa/storm-events";
import { onRequestGet as tsunami } from "../functions/api/noaa/tsunami";
import { onRequestGet as tsunamiFeed } from "../functions/api/noaa/tsunami-feed";
import { onRequestGet as meteoalarm } from "../functions/api/meteoalarm/alerts";
import { onRequestGet as calFire } from "../functions/api/regional/cal-fire";
import { onRequestGet as traffic } from "../functions/api/traffic";
import { onRequestGet as emsc } from "../functions/api/emsc";
import { onRequestGet as smithsonianGvp } from "../functions/api/smithsonian/gvp";
import { onRequestGet as jmaTyphoons } from "../functions/api/jma/typhoons";
import { jsonError } from "../functions/_shared/proxy";
import type { D1Database } from "./d1";
import { deliverPushMessage, markPushDeliveryExhausted, type PushDeliveryEnv } from "./pushDelivery";
import {
  markQueuedWatchAuditExhausted,
  processQueuedWatchAudit,
  scheduleWatchAudit,
} from "./watchEvaluator";
import { readWatchAuditOperations } from "./watchOperations";
import { handleWatchRequest } from "./watchRegistry";
import { handleWatchPushRequest, type PushQueueBinding } from "./watchPush";
import { normalizeCanaryPercent } from "./watchAutomation";
import { LOCATION_WATCH_AUDIT_SOURCES } from "../src/services/locationEventFeeds";
import {
  isWatchAuditQueueMessage,
  type WorkerQueueMessage,
} from "./queueMessages";

interface Env extends PushDeliveryEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1Database;
  PUSH_QUEUE?: PushQueueBinding;
  AUTOMATED_PUSH_ENABLED?: string;
  AUTOMATED_PUSH_CANARY_PERCENT?: string;
}

interface QueueMessage<T> {
  body: T;
  attempts?: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

interface QueueBatch<T> {
  messages: QueueMessage<T>[];
}

const apiRoutes = new Map<string, (context: { request: Request }) => Promise<Response>>([
  ["/api/fema/risk-index", femaRiskIndex],
  ["/api/noaa/nwps", nwps],
  ["/api/noaa/storm-events", stormEvents],
  ["/api/noaa/tsunami", tsunami],
  ["/api/noaa/tsunami-feed", tsunamiFeed],
  ["/api/meteoalarm/alerts", meteoalarm],
  ["/api/regional/cal-fire", calFire],
  ["/api/traffic", traffic],
  ["/api/emsc", emsc],
  ["/api/smithsonian/gvp", smithsonianGvp],
  ["/api/jma/typhoons", jmaTyphoons],
]);

const sourceStatus = [
  { id: "fema-risk-index", label: "FEMA National Risk Index", route: "/api/fema/risk-index", cacheSeconds: 86_400 },
  { id: "noaa-nwps", label: "NOAA River Forecasts", route: "/api/noaa/nwps", cacheSeconds: 900 },
  { id: "noaa-storm-events", label: "NOAA Storm Events", route: "/api/noaa/storm-events", cacheSeconds: 86_400 },
  { id: "noaa-tsunami", label: "NOAA Tsunami", route: "/api/noaa/tsunami", cacheSeconds: 60 },
  { id: "noaa-tsunami-feed", label: "NOAA Tsunami Atom Fallback", route: "/api/noaa/tsunami-feed", cacheSeconds: 60 },
  { id: "meteoalarm", label: "Meteoalarm European Warnings", route: "/api/meteoalarm/alerts", cacheSeconds: 300 },
  { id: "cal-fire", label: "CAL FIRE Incidents", route: "/api/regional/cal-fire", cacheSeconds: 120 },
  { id: "usdot-wzdx", label: "USDOT Work Zone Data Exchange", route: "/api/traffic", cacheSeconds: 90 },
  { id: "emsc", label: "EMSC Earthquakes", route: "/api/emsc", cacheSeconds: 60 },
  { id: "smithsonian-gvp", label: "Smithsonian Volcano Reference", route: "/api/smithsonian/gvp", cacheSeconds: 86_400 },
  { id: "jma-typhoons", label: "JMA Tropical Cyclones", route: "/api/jma/typhoons", cacheSeconds: 300 },
];

function pushConfigured(env: Env): boolean {
  return !!(env.DB && env.PUSH_QUEUE && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.PUSH_DATA_KEY);
}

function pushMode(env: Env): "test" | "canary" | "active" {
  if (env.AUTOMATED_PUSH_ENABLED !== "true") return "test";
  return normalizeCanaryPercent(env.AUTOMATED_PUSH_CANARY_PERCENT) >= 100 ? "active" : "canary";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    if (url.pathname === "/api/push/config") {
      if (request.method !== "GET") {
        return Response.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported" } }, { status: 405 });
      }
      return Response.json({
        supported: true,
        configured: pushConfigured(env),
        publicKey: env.VAPID_PUBLIC_KEY ?? null,
        automatedDelivery: env.AUTOMATED_PUSH_ENABLED === "true",
        rolloutPercent: normalizeCanaryPercent(env.AUTOMATED_PUSH_CANARY_PERCENT),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/api/status") {
      const watchOperations = await readWatchAuditOperations(env.DB);
      return Response.json({
        service: "OpenRisk Radar API",
        version: "worker-v2",
        status: "operational",
        checkedAt: new Date().toISOString(),
        sources: sourceStatus,
        watchRegistry: {
          configured: !!env.DB,
          mode: "audit",
          evaluatedSources: LOCATION_WATCH_AUDIT_SOURCES,
          operations: watchOperations,
        },
        pushNotifications: {
          configured: pushConfigured(env),
          automatedDelivery: env.AUTOMATED_PUSH_ENABLED === "true",
          rolloutPercent: normalizeCanaryPercent(env.AUTOMATED_PUSH_CANARY_PERCENT),
          mode: pushMode(env),
        },
      }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
    }

    if (url.pathname === "/api/watches" || url.pathname.startsWith("/api/watches/")) {
      if (!env.DB) {
        return jsonError({
          code: "WATCH_REGISTRY_UNAVAILABLE",
          message: "The cloud watch registry is not configured",
          status: 503,
          retryable: true,
        });
      }
      try {
        const pushResponse = await handleWatchPushRequest(request, { ...env, DB: env.DB });
        if (pushResponse) return pushResponse;
        const response = await handleWatchRequest(request, env.DB);
        if (response) return response;
      } catch (error) {
        console.error(JSON.stringify({
          type: "watch_registry_error",
          route: url.pathname,
          message: error instanceof Error ? error.message : "Unknown registry error",
        }));
        return jsonError({
          code: "WATCH_REGISTRY_ERROR",
          message: "The watch registry could not complete the request",
          status: 500,
          retryable: true,
        });
      }
    }

    const handler = apiRoutes.get(url.pathname);
    if (handler) {
      if (request.method !== "GET") {
        const response = jsonError({ code: "METHOD_NOT_ALLOWED", message: "Only GET is supported", status: 405 });
        response.headers.set("Allow", "GET");
        return response;
      }
      const response = await handler({ request });
      const durationMs = Date.now() - startedAt;
      if (response.status >= 500 || Math.random() < 0.1) {
        console.log(JSON.stringify({
          type: "api_request",
          route: url.pathname,
          status: response.status,
          cache: response.headers.get("X-OpenRisk-Cache") ?? "none",
          provider: response.headers.get("X-OpenRisk-Provider") ?? "unknown",
          durationMs,
        }));
      }
      return response;
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonError({ code: "NOT_FOUND", message: "API route not found", status: 404 });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    if (!env.DB || !env.PUSH_QUEUE) {
      console.warn(JSON.stringify({
        type: "watch_audit_skipped",
        reason: !env.DB ? "D1 binding unavailable" : "Queue binding unavailable",
      }));
      return;
    }
    try {
      const result = await scheduleWatchAudit(env.DB, env.PUSH_QUEUE);
      console.log(JSON.stringify({ type: "watch_audit_queued", ...result }));
      const operations = await readWatchAuditOperations(env.DB);
      if (operations.health !== "operational") {
        console.warn(JSON.stringify({
          type: "operations_alert",
          health: operations.health,
          alerts: operations.alerts,
          activeWatches: operations.activeWatches,
          dueWatches: operations.dueWatches,
          push: operations.push,
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        type: "watch_audit_failed",
        message: error instanceof Error ? error.message : "Unknown audit error",
      }));
      throw error;
    }
  },

  async queue(batch: QueueBatch<WorkerQueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      if (isWatchAuditQueueMessage(message.body)) {
        try {
          if (!env.DB) throw new Error("D1 binding unavailable");
          const status = await processQueuedWatchAudit(env.DB, message.body.watchAuditJobId, {
            enabled: env.AUTOMATED_PUSH_ENABLED === "true",
            canaryPercent: normalizeCanaryPercent(env.AUTOMATED_PUSH_CANARY_PERCENT),
            configured: pushConfigured(env),
            queue: env.PUSH_QUEUE,
          });
          console.log(JSON.stringify({
            type: "watch_audit_job_complete",
            jobId: message.body.watchAuditJobId,
            status: status ?? "already_completed",
          }));
          message.ack();
        } catch (error) {
          console.error(JSON.stringify({
            type: "watch_audit_job_retry",
            jobId: message.body.watchAuditJobId,
            message: error instanceof Error ? error.message : "Unknown watch audit error",
          }));
          if ((message.attempts ?? 1) >= 4) {
            await markQueuedWatchAuditExhausted(
              env.DB,
              message.body.watchAuditJobId,
              error
            );
          }
          message.retry({ delaySeconds: 60 });
        }
        continue;
      }

      try {
        await deliverPushMessage(env, message.body.deliveryId);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          type: "push_delivery_retry",
          deliveryId: message.body.deliveryId,
          message: error instanceof Error ? error.message : "Unknown push delivery error",
        }));
        if ((message.attempts ?? 1) >= 4) {
          await markPushDeliveryExhausted(env.DB, message.body.deliveryId, error);
        }
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
