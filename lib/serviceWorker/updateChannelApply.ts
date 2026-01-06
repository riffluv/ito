import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  buildTelemetryOptions,
  createInitialContext,
  type SafeUpdateContext,
  type StartApplyFn,
} from "./safeUpdateMachine";

// Some environments appear to keep the waiting SW stuck in `installed` when heavy worker clients are alive.
// Fall back to a hard reload (which closes those clients) if SKIP_WAITING doesn't progress quickly.
const APPLY_FALLBACK_RELOAD_MS = 5_000;
const APPLY_FALLBACK_RELOAD_SESSION_KEY = "ito-safe-update-fallback-reload-count";
const APPLY_FALLBACK_RELOAD_LIMIT = 2;

export function createStartApply(params: {
  now: () => number;
  broadcast: { postMessage: (message: unknown) => void } | null;
  getSnapshot: () => { phase: string };
}): StartApplyFn {
  const { now, broadcast, getSnapshot } = params;

  return function startApply(
    context: SafeUpdateContext,
    applyParams: { reason: string; safeMode: boolean; automatic: boolean; broadcast: boolean }
  ): Partial<SafeUpdateContext> {
    const registration = context.waitingRegistration;
    const waiting = registration?.waiting ?? null;
    if (!registration || !waiting) {
      return {
        lastError: "no_waiting",
        pendingReload: false,
        applyReason: applyParams.reason,
      };
    }

    const controllerBefore =
      typeof navigator !== "undefined"
        ? navigator.serviceWorker?.controller?.scriptURL ?? null
        : null;
    const waitingUrl = waiting.scriptURL;

    // Service Worker 更新の適用直前に、重い Worker（OffscreenCanvas など）を止めておく。
    // これが生きているとブラウザが skipWaiting/activate を進められず apply がタイムアウトするケースがある。
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new Event("ito-safe-update-apply"));
      } catch {
        /* noop */
      }
    }
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      traceError("safeUpdate.apply.postMessage", error, {
        reason: applyParams.reason,
        safeMode: applyParams.safeMode,
      });
    }

    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      window.setTimeout(() => {
        try {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return;
          }
          if (getSnapshot().phase !== "applying") {
            return;
          }
          const controllerUrl = navigator.serviceWorker?.controller?.scriptURL ?? null;
          if (controllerBefore && controllerUrl && controllerUrl !== controllerBefore) {
            return;
          }
          const count = Number(sessionStorage.getItem(APPLY_FALLBACK_RELOAD_SESSION_KEY) ?? "0");
          if (!Number.isFinite(count) || count >= APPLY_FALLBACK_RELOAD_LIMIT) {
            return;
          }
          void navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              const waitingNow = reg?.waiting?.scriptURL ?? null;
              if (!waitingNow || waitingNow !== waitingUrl) {
                return;
              }
              traceAction("safeUpdate.apply.fallbackReload", {
                reason: applyParams.reason,
                safeMode: applyParams.safeMode,
                waitingUrl,
                controllerBefore,
                count: count + 1,
                delayMs: APPLY_FALLBACK_RELOAD_MS,
              });
              sessionStorage.setItem(
                APPLY_FALLBACK_RELOAD_SESSION_KEY,
                String(count + 1)
              );
              window.location.reload();
            })
            .catch(() => undefined);
        } catch (error) {
          traceError("safeUpdate.apply.fallbackReloadFailed", error, {
            reason: applyParams.reason,
            safeMode: applyParams.safeMode,
            waitingUrl,
          });
        }
      }, APPLY_FALLBACK_RELOAD_MS);
    }

    logSafeUpdateTelemetry(
      "triggered",
      buildTelemetryOptions(context, { reason: applyParams.reason, safeMode: applyParams.safeMode })
    );
    traceAction("safeUpdate.apply.start", {
      reason: applyParams.reason,
      safeMode: applyParams.safeMode,
      automatic: applyParams.automatic,
    });
    if (applyParams.broadcast) {
      broadcast?.postMessage({ type: "update-applying", reason: applyParams.reason });
    }
    return {
      pendingReload: true,
      applyReason: applyParams.reason,
      pendingApply: {
        reason: applyParams.reason,
        safeMode: applyParams.safeMode,
        startedAt: now(),
        attemptId: context.attemptSeq + 1,
        automatic: applyParams.automatic,
      },
      attemptSeq: context.attemptSeq + 1,
      lastError: null,
    };
  };
}

export function buildApplyNoWaitingContext(
  context: SafeUpdateContext,
  reason: string
): Partial<SafeUpdateContext> {
  if (context.waitingRegistration?.waiting) return {};
  return {
    lastError: "no_waiting",
    pendingReload: false,
    applyReason: reason,
  };
}

export function buildSafeTelemetryContext(context?: SafeUpdateContext | null): SafeUpdateContext {
  return context ?? createInitialContext();
}

