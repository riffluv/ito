"use client";

import { useEffect } from "react";
import {
  announceServiceWorkerUpdate,
  clearWaitingServiceWorker,
  consumePendingReloadFlag,
  getWaitingServiceWorker,
} from "@/lib/serviceWorker/updateChannel";

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

let controllerChangeBound = false;

const bindControllerChangeListener = () => {
  if (controllerChangeBound) return;
  controllerChangeBound = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (consumePendingReloadFlag()) {
      window.location.reload();
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

    // タブが非表示の間に待機SWがあれば自動適用（Soft規定の最適化）
    if (typeof document !== "undefined") {
      const visHandler = () => {
        try {
          if (document.visibilityState === "hidden") {
            const waiting = getWaitingServiceWorker();
            if (waiting) {
              // best-effort: 自動適用（失敗しても黙殺）
              try { waiting.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
            }
          }
        } catch {}
      };
      document.addEventListener("visibilitychange", visHandler);
    }
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
    // ページ再マウント時に古い待機Registrationが残っていれば反映する
    const existing = getWaitingServiceWorker();
    if (existing) {
      announceServiceWorkerUpdate(existing);
    }
  }, []);

  return null;
}
