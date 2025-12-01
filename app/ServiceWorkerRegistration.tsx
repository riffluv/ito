"use client";

import { useEffect } from "react";
import {
  announceServiceWorkerUpdate,
  applyServiceWorkerUpdate,
  clearAutoApplySuppression,
  clearWaitingServiceWorker,
  consumePendingApplyContext,
  consumePendingReloadFlag,
  getWaitingServiceWorker,
  handleServiceWorkerFetchError,
  markUpdateCheckEnd,
  markUpdateCheckError,
  markUpdateCheckStart,
  resyncWaitingServiceWorker,
  subscribeToSafeUpdateSnapshot,
  suppressAutoApply,
} from "@/lib/serviceWorker/updateChannel";
import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";

const SW_PATH = "/sw.js";

// SW version is a single source of truth: NEXT_PUBLIC_SW_VERSION injected at build time.
// Fallback to the runtime buildId only for local/dev builds where the env is absent.
const resolveSwVersion = (): string => {
  const runtimeBuildId =
    typeof window !== "undefined"
      ? (window as typeof window & { __NEXT_DATA__?: { buildId?: string }; __nextBuildId?: string })
          .__NEXT_DATA__?.buildId ??
        (window as typeof window & { __nextBuildId?: string }).__nextBuildId ??
        null
      : null;

  return process.env.NEXT_PUBLIC_SW_VERSION ?? runtimeBuildId ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
};

const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_PWA;

const shouldRegister = () => {
  if (ENABLE_FLAG === "0") {
    return false;
  }
  return typeof window !== "undefined" && "serviceWorker" in navigator;
};

const LOOP_GUARD_THRESHOLD = 3;
let controllerChangeBound = false;
let controllerChangeAutoCount = 0;
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const RELOAD_FALLBACK_DELAY_MS = 4000;
let reloadFallbackTimer: number | null = null;

type SafeUpdateFetchErrorPayload = Parameters<typeof handleServiceWorkerFetchError>[0];

type SafeUpdateMessageData =
  | {
      type: "SAFE_UPDATE_FETCH_ERROR";
      detail: SafeUpdateFetchErrorPayload;
    }
  | {
      type: "SAFE_UPDATE_SYNC";
      event: string;
      version: string;
      timestamp: number;
    };

type ServiceWorkerMessageEventData = SafeUpdateMessageData | SafeUpdateFetchErrorPayload;

const clearReloadFallbackTimer = () => {
  if (reloadFallbackTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(reloadFallbackTimer);
    reloadFallbackTimer = null;
  }
};

const handlePendingReload = (origin: "controllerchange" | "fallback") => {
  const pendingReload = consumePendingReloadFlag();
  const context = consumePendingApplyContext();
  if (!pendingReload) {
    controllerChangeAutoCount = 0;
    return false;
  }
  const isAuto = context?.reason ? context.reason !== "manual" : false;
  const detailBase = isAuto ? "auto" : "manual";
  const telemetryDetail =
    origin === "controllerchange" ? detailBase : `${detailBase}:fallback`;
  logSafeUpdateTelemetry("applied", {
    reason: context?.reason,
    safeMode: context?.safeMode,
    detail: telemetryDetail,
  });
  if (isAuto) {
    controllerChangeAutoCount += 1;
  } else {
    controllerChangeAutoCount = 0;
  }
  bumpMetric("sw", "applied.count");
  if (context?.safeMode) {
    bumpMetric("safeUpdate", "applied");
  }
  if (origin === "fallback") {
    traceAction("safeUpdate.reload.fallback", {
      reason: context?.reason ?? "unknown",
      safeMode: context?.safeMode ?? null,
      delayMs: RELOAD_FALLBACK_DELAY_MS,
    });
  }
  if (isAuto && controllerChangeAutoCount > LOOP_GUARD_THRESHOLD) {
    suppressAutoApply();
    setMetric("sw", "loopGuard.tripped", 1);
  }
  window.location.reload();
  return true;
};

const scheduleReloadFallback = () => {
  if (typeof window === "undefined") return;
  if (reloadFallbackTimer !== null) {
    return;
  }
  reloadFallbackTimer = window.setTimeout(() => {
    reloadFallbackTimer = null;
    handlePendingReload("fallback");
  }, RELOAD_FALLBACK_DELAY_MS);
};

const performRegistrationUpdate = async (
  registration: ServiceWorkerRegistration,
  reason: string
) => {
  markUpdateCheckStart();
  try {
    await registration.update();
    markUpdateCheckEnd();
  } catch {
    markUpdateCheckError(`update_failed:${reason}`);
  } finally {
    void resyncWaitingServiceWorker(`update-check:${reason}`);
  }
};

const schedulePeriodicUpdateChecks = (registration: ServiceWorkerRegistration) => {
  if (typeof window === "undefined") {
    return () => {
      /* noop */
    };
  }
  const intervalId = window.setInterval(() => {
    void performRegistrationUpdate(registration, "interval");
  }, UPDATE_CHECK_INTERVAL_MS);
  return () => {
    window.clearInterval(intervalId);
  };
};

const bindVisibilityDrivenUpdateChecks = (
  registration: ServiceWorkerRegistration
) => {
  if (typeof document === "undefined") {
    return () => {
      /* noop */
    };
  }
  const handler = () => {
    if (document.visibilityState === "visible") {
      void performRegistrationUpdate(registration, "visibility");
    }
  };
  document.addEventListener("visibilitychange", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
  };
};

const bindOnlineUpdateChecks = (registration: ServiceWorkerRegistration) => {
  if (typeof window === "undefined") {
    return () => {
      /* noop */
    };
  }
  const handler = () => {
    void performRegistrationUpdate(registration, "online");
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
};

const bindServiceWorkerMessages = () => {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.addEventListener) {
    return () => {
      /* noop */
    };
  }
  const handler = (event: MessageEvent<ServiceWorkerMessageEventData>) => {
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    if ("type" in data) {
      if (data.type === "SAFE_UPDATE_FETCH_ERROR") {
        handleServiceWorkerFetchError(data.detail);
        return;
      }
      if (data.type === "SAFE_UPDATE_SYNC") {
        void resyncWaitingServiceWorker("sw-message");
      }
      return;
    }
    handleServiceWorkerFetchError(data);
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
};

const bindVisibilityHiddenAutoApply = () => {
  if (typeof document === "undefined") {
    return () => {
      /* noop */
    };
  }
  const visHandler = () => {
    try {
      if (document.visibilityState === "hidden") {
        const waiting = getWaitingServiceWorker();
        if (waiting) {
          applyServiceWorkerUpdate({
            reason: "visibility:hidden",
          });
        }
      }
    } catch {
      /* noop */
    }
  };
  document.addEventListener("visibilitychange", visHandler);
  return () => {
    document.removeEventListener("visibilitychange", visHandler);
  };
};

const bindControllerChangeListener = () => {
  if (controllerChangeBound) return;
  controllerChangeBound = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    clearReloadFallbackTimer();
    handlePendingReload("controllerchange");
    void resyncWaitingServiceWorker("controllerchange");
  });
};

type WaitingCleanup = () => void;

const createWaitingObserver = () => {
  const wiredWaitings = new WeakSet<ServiceWorker>();

  return (registration: ServiceWorkerRegistration, _source: string): WaitingCleanup | null => {
    const waiting = registration.waiting;
    if (!waiting || !navigator.serviceWorker?.controller) {
      return null;
    }
    if (wiredWaitings.has(waiting)) {
      return null;
    }
    wiredWaitings.add(waiting);
    announceServiceWorkerUpdate(registration);

    const stateChangeHandler = () => {
      if (waiting.state === "activated") {
        clearWaitingServiceWorker({ result: "activated" });
        waiting.removeEventListener("statechange", stateChangeHandler);
      } else if (waiting.state === "redundant") {
        clearWaitingServiceWorker({ result: "redundant" });
        waiting.removeEventListener("statechange", stateChangeHandler);
      }
    };

    waiting.addEventListener("statechange", stateChangeHandler);
    return () => waiting.removeEventListener("statechange", stateChangeHandler);
  };
};

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!shouldRegister()) {
    return null;
  }

  setMetric("sw", "loopGuard.tripped", 0);
  setMetric("sw", "applied.count", 0);
  const versionedPath = `${SW_PATH}?v=${resolveSwVersion()}`;
  clearAutoApplySuppression();

  try {
    const registration = await navigator.serviceWorker.register(versionedPath, {
      scope: "/",
    });

    bindControllerChangeListener();
    return registration;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("Service Worker の登録に失敗しました", error);
    }
    return null;
  }
};

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    let cancelled = false;
    let stopPeriodicChecks: (() => void) | null = null;
    let stopVisibilityChecks: (() => void) | null = null;
    let stopOnlineChecks: (() => void) | null = null;
    const cleanupFns: Array<() => void> = [];
    const wiredRegistrations = new WeakSet<ServiceWorkerRegistration>();
    const observeWaiting = createWaitingObserver();

    const wireRegistration = (registration: ServiceWorkerRegistration, source: string) => {
      if (!registration || wiredRegistrations.has(registration)) {
        return;
      }
      wiredRegistrations.add(registration);

      const waitingCleanup = observeWaiting(registration, `${source}:waiting`);
      if (waitingCleanup) {
        cleanupFns.push(waitingCleanup);
      }

      const handleUpdateFound = () => {
        const installingWorker = registration.installing;

        const evaluateWaiting = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            const cleanup = observeWaiting(registration, `${source}:updatefound`);
            if (cleanup) {
              cleanupFns.push(cleanup);
            }
          } else if (navigator.serviceWorker.controller) {
            void resyncWaitingServiceWorker(`${source}:updatefound:installed`);
          } else {
            registration.active?.postMessage?.({ type: "CLIENTS_CLAIM" });
          }
        };

        if (!installingWorker) {
          evaluateWaiting();
          void resyncWaitingServiceWorker(`${source}:updatefound:missing-installing`);
          return;
        }

        const onStateChange = () => {
          if (installingWorker.state === "installed") {
            evaluateWaiting();
          }
          if (installingWorker.state === "activated" || installingWorker.state === "redundant") {
            installingWorker.removeEventListener("statechange", onStateChange);
          }
        };

        // Run once in case the worker is already installed when we attach.
        onStateChange();
        installingWorker.addEventListener("statechange", onStateChange);
      };

      registration.addEventListener("updatefound", handleUpdateFound);
      cleanupFns.push(() => registration.removeEventListener("updatefound", handleUpdateFound));
    };

    const cleanupVisibilityAutoApply = bindVisibilityHiddenAutoApply();
    const unbindMessageListener = bindServiceWorkerMessages();
    const unsubscribeSnapshot = subscribeToSafeUpdateSnapshot((snapshot) => {
      if (snapshot.pendingReload && snapshot.phase !== "applying") {
        scheduleReloadFallback();
      } else {
        clearReloadFallbackTimer();
      }
    });

    void resyncWaitingServiceWorker("mount");

    const existing = getWaitingServiceWorker();
    if (existing) {
      announceServiceWorkerUpdate(existing);
    }

    const primeExistingRegistration = async (reason: string) => {
      if (!("serviceWorker" in navigator)) {
        return;
      }
      try {
        const existingRegistration = await navigator.serviceWorker.getRegistration();
        if (!existingRegistration || cancelled) {
          return;
        }
        wireRegistration(existingRegistration, reason);
      } catch {
        /* noop */
      }
    };

    void primeExistingRegistration("mount:getRegistration");

    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (!cancelled) {
            wireRegistration(registration, "ready");
          }
        })
        .catch(() => {
          /* noop */
        });
    }

    const setup = async () => {
      const registration = await registerServiceWorker();
      if (!registration || cancelled) {
        return;
      }
      wireRegistration(registration, "register");
      stopPeriodicChecks = schedulePeriodicUpdateChecks(registration);
      stopVisibilityChecks = bindVisibilityDrivenUpdateChecks(registration);
      stopOnlineChecks = bindOnlineUpdateChecks(registration);
      void performRegistrationUpdate(registration, "initial");
    };

    void setup();

    return () => {
      cancelled = true;
      cleanupVisibilityAutoApply();
      unbindMessageListener();
      unsubscribeSnapshot();
      stopPeriodicChecks?.();
      stopVisibilityChecks?.();
      stopOnlineChecks?.();
      cleanupFns.forEach((fn) => fn());
      clearReloadFallbackTimer();
    };
  }, []);

  return null;
}
