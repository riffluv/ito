"use client";

import { useEffect } from "react";
import {
  announceServiceWorkerUpdate,
  applyServiceWorkerUpdate,
  clearWaitingServiceWorker,
  consumePendingApplyContext,
  consumePendingReloadFlag,
  getWaitingServiceWorker,
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

const shouldRegister = () => {
  if (ENABLE_FLAG === "0") {
    return false;
  }
  return typeof window !== "undefined" && "serviceWorker" in navigator;
};

const LOOP_GUARD_THRESHOLD = 3;
let controllerChangeBound = false;
let controllerChangeAutoCount = 0;

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
    if (waiting.state === "activated" || waiting.state === "redundant") {
      clearWaitingServiceWorker();
      waiting.removeEventListener("statechange", stateChangeHandler);
    }
  };
  waiting.addEventListener("statechange", stateChangeHandler);
};

const registerServiceWorker = async () => {
  if (!shouldRegister()) {
    return;
  }

  setMetric("sw", "loopGuard.tripped", 0);
  setMetric("sw", "applied.count", 0);
  const versionedPath = `${SW_PATH}?v=${APP_VERSION}`;

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
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("Service Worker の登録に失敗しました", error);
    }
  }
};

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
    const cleanupVisibility = bindVisibilityHiddenAutoApply();
    // ページをマウントした際に既存の待機登録があれば再通知
    const existing = getWaitingServiceWorker();
    if (existing) {
      announceServiceWorkerUpdate(existing);
    }
    return () => {
      cleanupVisibility();
    };
  }, []);

  return null;
}
