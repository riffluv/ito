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
  markUpdateCheckEnd,
  markUpdateCheckError,
  markUpdateCheckStart,
  resyncWaitingServiceWorker,
  suppressAutoApply,
} from "@/lib/serviceWorker/updateChannel";
import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";

const SW_PATH = "/sw.js";
const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  "dev";
const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_PWA;

if (typeof window !== "undefined") {
  try {
    console.log("[APP_VERSION] runtime:", APP_VERSION);
  } catch {
    // noop
  }
}

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

const bindServiceWorkerMessages = () => {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.addEventListener) {
    return () => {
      /* noop */
    };
  }
  const handler = (event: MessageEvent<any>) => {
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    if (data.type === "SAFE_UPDATE_SYNC") {
      void resyncWaitingServiceWorker("sw-message");
    }
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
    const pendingReload = consumePendingReloadFlag();
    const context = consumePendingApplyContext();
    if (pendingReload) {
      const isAuto = context?.reason ? context.reason !== "manual" : false;
      logSafeUpdateTelemetry("applied", {
        reason: context?.reason,
        safeMode: context?.safeMode,
        detail: isAuto ? "auto" : "manual",
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
      if (isAuto && controllerChangeAutoCount > LOOP_GUARD_THRESHOLD) {
        suppressAutoApply();
        setMetric("sw", "loopGuard.tripped", 1);
      }
      window.location.reload();
    } else {
      controllerChangeAutoCount = 0;
    }
  });
};

const handleWaitingRegistration = (registration: ServiceWorkerRegistration) => {
  const { waiting } = registration;
  if (!waiting) {
    return;
  }
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
};

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!shouldRegister()) {
    return null;
  }

  setMetric("sw", "loopGuard.tripped", 0);
  setMetric("sw", "applied.count", 0);
  const versionedPath = `${SW_PATH}?v=${APP_VERSION}`;
  clearAutoApplySuppression();

  try {
    const registration = await navigator.serviceWorker.register(versionedPath, {
      scope: "/",
    });

    bindControllerChangeListener();

    if (registration.waiting && navigator.serviceWorker.controller) {
      handleWaitingRegistration(registration);
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state !== "installed") {
          return;
        }
        if (navigator.serviceWorker.controller) {
          handleWaitingRegistration(registration);
        } else {
          registration.active?.postMessage?.({ type: "CLIENTS_CLAIM" });
        }
      });
    });
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

    const cleanupVisibilityAutoApply = bindVisibilityHiddenAutoApply();
    const unbindMessageListener = bindServiceWorkerMessages();

    void resyncWaitingServiceWorker("mount");

    const existing = getWaitingServiceWorker();
    if (existing) {
      announceServiceWorkerUpdate(existing);
    }

    const setup = async () => {
      const registration = await registerServiceWorker();
      if (!registration || cancelled) {
        return;
      }
      stopPeriodicChecks = schedulePeriodicUpdateChecks(registration);
      stopVisibilityChecks = bindVisibilityDrivenUpdateChecks(registration);
      void performRegistrationUpdate(registration, "initial");
    };

    void setup();

    return () => {
      cancelled = true;
      cleanupVisibilityAutoApply();
      unbindMessageListener();
      stopPeriodicChecks?.();
      stopVisibilityChecks?.();
    };
  }, []);

  return null;
}
