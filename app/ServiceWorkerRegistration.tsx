"use client";

import { useEffect } from "react";

const SW_PATH = "/sw.js";
const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_PWA;

const shouldRegister = () => {
  if (ENABLE_FLAG === "0") {
    return false;
  }
  return typeof window !== "undefined" && "serviceWorker" in navigator;
};

const registerServiceWorker = async () => {
  if (!shouldRegister()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          // eslint-disable-next-line no-console
          console.info("新しいバージョンのコンテンツを取得しました。次回リロードで反映されます。");
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
  }, []);

  return null;
}
