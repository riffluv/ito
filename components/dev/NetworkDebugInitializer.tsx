"use client";
/* eslint-disable no-console */

import { useEffect } from "react";

const ENABLED = process.env.NEXT_PUBLIC_NETWORK_DEBUG === "1";
const DEFAULT_PATTERNS = [
  "firestore.googleapis.com",
  "documents:commit",
  "/api/rooms/",
];

const parsePatterns = () => {
  const raw = process.env.NEXT_PUBLIC_NETWORK_DEBUG_PATTERNS;
  const envPatterns = raw
    ? raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  return envPatterns.length > 0 ? envPatterns : DEFAULT_PATTERNS;
};

const shouldTrace = (url: string, patterns: string[]) => {
  if (!url) return false;
  return patterns.some((pattern) => url.includes(pattern));
};

const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export default function NetworkDebugInitializer() {
  useEffect(() => {
    if (!ENABLED) return undefined;
    if (typeof window === "undefined") return undefined;

    const scope = window as typeof window & {
      __ITO_NETWORK_DEBUG__?: boolean;
    };
    if (scope.__ITO_NETWORK_DEBUG__) return undefined;

    const patterns = parsePatterns();
    const originalFetch = window.fetch.bind(window);
    scope.__ITO_NETWORK_DEBUG__ = true;

    window.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input instanceof Request
          ? input.url
          : "";
      const method =
        init?.method ??
        (input instanceof Request ? input.method : undefined) ??
        "GET";
      const trace = shouldTrace(url, patterns);
      const startAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const requestId = `net-${Math.random().toString(36).slice(2, 8)}`;
      const requestBody =
        typeof init?.body === "string" ? init.body : undefined;

      if (trace) {
        console.groupCollapsed(
          `[net][request][${requestId}] ${method} ${url.slice(0, 160)}`
        );
        if (requestBody) {
          console.log("payload", safeJsonParse(requestBody));
        }
        console.groupEnd();
      }

      try {
        const response = await originalFetch(input as RequestInfo, init);
        const elapsed =
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startAt;
        if (trace || response.status >= 400) {
          const clone = response.clone();
          let responseBody: unknown = null;
          const contentType = clone.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            try {
              responseBody = await clone.json();
            } catch {
              try {
                responseBody = await clone.text();
              } catch {
                responseBody = "[unavailable]";
              }
            }
          }
          console.group(
            `[net][response][${response.status}][${requestId}] ${method} ${url.slice(
              0,
              160
            )}`
          );
          console.log("elapsedMs", Number(elapsed.toFixed(2)));
          if (requestBody) {
            console.log("request", safeJsonParse(requestBody));
          }
          if (responseBody !== null) {
            console.log("response", responseBody);
          }
          console.groupEnd();
        }
        return response;
      } catch (error) {
        console.group(
          `[net][error][${requestId}] ${method} ${url.slice(0, 160)}`
        );
        if (requestBody) {
          console.log("request", safeJsonParse(requestBody));
        }
        console.error(error);
        console.groupEnd();
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
      delete scope.__ITO_NETWORK_DEBUG__;
    };
  }, []);

  return null;
}
