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

const truncateText = (text: string, limit = 4000) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
};

async function readRequestBody(request: Request) {
  try {
    if (!request.body) return null;
    const text = await request.text();
    return truncateText(text);
  } catch {
    return null;
  }
}

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

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(input as RequestInfo, init);
      const clonedForBody = request.clone();
      const requestBodyPromise = readRequestBody(clonedForBody);
      const url = request.url ?? "";
      const method = request.method ?? init?.method ?? "GET";
      const trace = shouldTrace(url, patterns);
      const startAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const requestId = `net-${Math.random().toString(36).slice(2, 8)}`;
      const requestBody = await requestBodyPromise;

      if (trace && requestBody) {
        console.groupCollapsed(
          `[net][request][${requestId}] ${method} ${url.slice(0, 160)}`
        );
        console.log("payload", safeJsonParse(requestBody));
        console.groupEnd();
      }

      try {
        const response = await originalFetch(request);
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
          } else if (trace || response.status >= 400) {
            try {
              const text = await clone.text();
              responseBody =
                text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
            } catch {
              responseBody = "[unavailable]";
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
