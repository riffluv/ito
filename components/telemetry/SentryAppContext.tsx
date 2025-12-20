"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { APP_VERSION } from "@/lib/constants/appVersion";

type SentryGlobal = {
  setTag?: (key: string, value: string) => void;
  setContext?: (key: string, context: Record<string, unknown>) => void;
};

function getSentryGlobal(): SentryGlobal | null {
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  return globalScope.Sentry ?? null;
}

function resolveRouteTag(pathname: string | null): string {
  if (!pathname) return "unknown";
  if (pathname.startsWith("/rooms/")) return "/rooms/[roomId]";
  if (pathname.startsWith("/admin/")) return "/admin/*";
  return pathname;
}

export default function SentryAppContext() {
  const pathname = usePathname();
  const routeTag = useMemo(() => resolveRouteTag(pathname), [pathname]);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry) return;
    try {
      sentry.setTag?.("appVersion", APP_VERSION);
      const appEnv =
        process.env.NEXT_PUBLIC_APP_ENV ||
        process.env.SENTRY_ENVIRONMENT ||
        process.env.NODE_ENV ||
        "unknown";
      sentry.setTag?.("appEnv", appEnv);
    } catch {}
  }, []);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry) return;
    try {
      sentry.setTag?.("route", routeTag);
    } catch {}
  }, [routeTag]);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry || typeof navigator === "undefined") return;
    try {
      sentry.setContext?.("device", {
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        platform: navigator.platform ?? null,
      });
    } catch {}
  }, []);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry || typeof navigator === "undefined") return;
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }).connection;
    if (!connection) return;
    try {
      sentry.setContext?.("connection", {
        effectiveType: connection.effectiveType ?? null,
        downlink: connection.downlink ?? null,
        rtt: connection.rtt ?? null,
        saveData: connection.saveData ?? null,
      });
    } catch {}
  }, []);

  return null;
}
