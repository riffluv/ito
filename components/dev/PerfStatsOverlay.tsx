"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "__ito_perf_overlay";
const AVERAGE_WINDOW = 120;
const UPDATE_INTERVAL_MS = 250;
const ACTIVATION_ENV =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_SHOW_PERF_OVERLAY === "true";

type PerfStats = {
  fps: number;
  frameMs: number;
  worstFrameMs: number;
};

const defaultStats: PerfStats = { fps: 0, frameMs: 0, worstFrameMs: 0 };

function usePerfStats(enabled: boolean): PerfStats {
  const [stats, setStats] = useState<PerfStats>(defaultStats);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof performance === "undefined") {
      return () => undefined;
    }

    let rafId = 0;
    let lastTime = performance.now();
    const fpsSamples: number[] = [];
    const frameSamples: number[] = [];

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      const fps = delta > 0 ? 1000 / delta : 0;
      fpsSamples.push(fps);
      frameSamples.push(delta);
      if (fpsSamples.length > AVERAGE_WINDOW) fpsSamples.shift();
      if (frameSamples.length > AVERAGE_WINDOW) frameSamples.shift();
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    const timerId = window.setInterval(() => {
      if (fpsSamples.length === 0) return;
      const avgFps = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length;
      const avgFrame = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
      const worstFrame = Math.max(...frameSamples);
      setStats({
        fps: Number(avgFps.toFixed(1)),
        frameMs: Number(avgFrame.toFixed(2)),
        worstFrameMs: Number(worstFrame.toFixed(2)),
      });
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(timerId);
    };
  }, [enabled]);

  return stats;
}

export default function PerfStatsOverlay() {
  const [visible, setVisible] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!ACTIVATION_ENV || typeof window === "undefined") {
      return () => undefined;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setVisible(stored === "1");
    hasHydrated.current = true;
    return () => undefined;
  }, []);

  useEffect(() => {
    if (!ACTIVATION_ENV || typeof window === "undefined" || !hasHydrated.current) {
      return () => undefined;
    }
    window.localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
    return () => undefined;
  }, [visible]);

  useEffect(() => {
    if (!ACTIVATION_ENV || typeof window === "undefined") {
      return () => undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setVisible((current) => !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const stats = usePerfStats(ACTIVATION_ENV && visible);

  if (!ACTIVATION_ENV || !visible) {
    return null;
  }

  const indicatorColor = stats.fps >= 55 ? "#22c55e" : stats.fps >= 45 ? "#facc15" : "#ef4444";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        padding: "12px 16px",
        borderRadius: "8px",
        background: "rgba(10, 12, 20, 0.85)",
        color: "#f8fafc",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: 1.4,
        letterSpacing: "0.2px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        zIndex: 9999,
        minWidth: "180px",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: indicatorColor,
            boxShadow: `0 0 6px ${indicatorColor}`,
          }}
        />
        <strong style={{ fontSize: "12px" }}>PERF MONITOR</strong>
      </div>
      <div>FPS: {stats.fps.toFixed(1)}</div>
      <div>Frame: {stats.frameMs.toFixed(2)} ms</div>
      <div>Worst: {stats.worstFrameMs.toFixed(2)} ms</div>
      <div style={{ marginTop: "6px", opacity: 0.7 }}>Ctrl+Shift+P で表示切替</div>
    </div>
  );
}
