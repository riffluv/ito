"use client";

import React, { useMemo, useCallback } from "react";
import { applyServiceWorkerUpdate, resyncWaitingServiceWorker } from "@/lib/serviceWorker/updateChannel";
import { useSafeUpdateStatus } from "@/components/ui/SafeUpdateRecovery";

// 小さめのトーストを右上に常時置く。ミニドックのバッジと重ならないよう固定位置で表示。
const containerStyle: React.CSSProperties = {
  position: "fixed",
  top: "18px",
  right: "18px",
  zIndex: 9999,
  width: "240px",
  maxWidth: "90vw",
  background: "rgba(15, 18, 28, 0.9)",
  border: "1px solid rgba(58,176,255,0.6)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
  borderRadius: "8px",
  padding: "14px 16px",
  color: "#eef2ff",
  fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
  backdropFilter: "blur(4px)",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "none",
  fontWeight: 700,
  letterSpacing: "0.02em",
  cursor: "pointer",
};

export default function SafeUpdateToast() {
  const status = useSafeUpdateStatus();
  const {
    phase,
    autoApplySuppressed,
    hasError,
    lastError,
    isApplying,
    isUpdateReady,
    shouldShow,
  } = status;

  const title = useMemo(() => {
    if (isApplying || phase === "applying") return "更新を適用中…";
    if (hasError || phase === "failed") return "更新に失敗しました";
    if (phase === "suppressed" || autoApplySuppressed) return "自動更新を保留中";
    return "新しいバージョンがあります";
  }, [autoApplySuppressed, hasError, isApplying, phase]);

  const desc = useMemo(() => {
    if (isApplying || phase === "applying") return "まもなくページがリロードされます。";
    if (hasError || phase === "failed") {
      switch (lastError) {
        case "timeout":
          return "タイムアウトしました。再試行してください。";
        case "redundant":
          return "他の更新と競合しました。再試行できます。";
        case "no_waiting":
          return "更新対象が見当たりません。再同期します。";
        default:
          return "自動更新に失敗しました。手動再試行できます。";
      }
    }
    if (phase === "suppressed" || autoApplySuppressed) {
      return "安全のため自動適用を停止しました。手動で更新してください。";
    }
    return "最新ビルドを適用できます。";
  }, [autoApplySuppressed, hasError, isApplying, lastError, phase]);

  const buttonLabel = useMemo(() => {
    if (isApplying || phase === "applying") return "適用中…";
    if (hasError || phase === "failed") return "再試行";
    return "今すぐ更新";
  }, [hasError, isApplying, phase]);

  const handleClick = useCallback(() => {
    if (isApplying || phase === "applying") return;
    const applied = applyServiceWorkerUpdate({ reason: "toast", safeMode: true });
    if (!applied) {
      void resyncWaitingServiceWorker("toast:retry");
    }
  }, [isApplying, phase]);

  if (!shouldShow || !isUpdateReady) return null;

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", letterSpacing: "0.03em" }}>
        {title}
      </div>
      <div style={{ fontSize: "12px", opacity: 0.8, lineHeight: 1.5, marginBottom: "10px" }}>{desc}</div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isApplying || phase === "applying"}
        style={{
          ...buttonStyle,
          background: isApplying ? "rgba(58,176,255,0.35)" : "rgba(58,176,255,0.85)",
          color: "#0b1020",
          boxShadow: "0 6px 14px rgba(58,176,255,0.25)",
          opacity: isApplying ? 0.7 : 1,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
