"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";
import {
  applyServiceWorkerUpdate,
  resyncWaitingServiceWorker,
} from "@/lib/serviceWorker/updateChannel";

type SafeUpdateRecoveryProps = {
  reason?: string;
  style?: CSSProperties;
  className?: string;
  variant?: "panel" | "inline";
};

const BASE_STYLE: CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  borderRadius: "4px",
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(10,14,24,0.85)",
  color: "rgba(255,255,255,0.92)",
  fontFamily: "'Courier New', monospace",
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
};

const INLINE_STYLE: CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  border: "1px solid rgba(255,255,255,0.3)",
};

export function useSafeUpdateStatus() {
  const status = useServiceWorkerUpdate();
  const { phase, autoApplySuppressed, hasError, isApplying, isUpdateReady } = status;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const shouldShow =
    isApplying ||
    phase === "applying" ||
    hasError ||
    phase === "failed" ||
    autoApplySuppressed ||
    phase === "suppressed" ||
    phase === "auto_pending" ||
    phase === "waiting_user" ||
    phase === "update_detected" ||
    isUpdateReady;
  return {
    ...status,
    shouldShow,
    hydrated,
  };
}

export function SafeUpdateRecovery({
  reason = "error:route",
  style,
  className,
  variant = "panel",
}: SafeUpdateRecoveryProps) {
  const {
    phase,
    autoApplySuppressed,
    hasError,
    lastError,
    isApplying,
    isUpdateReady,
    shouldShow,
  } = useSafeUpdateStatus();

  const description = useMemo(() => {
    if (isApplying || phase === "applying") {
      return "更新を適用中です。完了すると最新ページへ自動で切り替わります。";
    }
    if (hasError || phase === "failed") {
      switch (lastError) {
        case "timeout":
          return "更新がタイムアウトしました。下のボタンで再試行してください。";
        case "redundant":
          return "別の更新と衝突しました。少し待ってから再試行してください。";
        case "no_waiting":
          return "更新対象が見当たりません。ハードリロードをお試しください。";
        case "suppressed":
          return "安全のため自動更新を停止しました。手動で適用してください。";
        default:
          return "自動更新に失敗しました。手動で更新またはリロードしてください。";
      }
    }
    if (phase === "suppressed" || autoApplySuppressed) {
      return "更新の安全待機中です。「今すぐ更新」で手動適用できます。";
    }
    if (phase === "auto_pending") {
      return "安全なタイミングを待って更新を適用します。";
    }
    if (phase === "waiting_user" || phase === "update_detected") {
      return "最新バージョンが待機しています。今すぐ適用できます。";
    }
    return "最新バージョン待機中です。";
  }, [autoApplySuppressed, hasError, isApplying, lastError, phase]);

  const applyTriggeredRef = useRef(false);

  const handleApply = useCallback(() => {
    const applied = applyServiceWorkerUpdate({
      reason,
      safeMode: true,
    });
    if (!applied) {
      void resyncWaitingServiceWorker(`${reason}:retry`);
    }
  }, [reason]);

  useEffect(() => {
    if (shouldShow && isUpdateReady && !isApplying && !applyTriggeredRef.current) {
      applyTriggeredRef.current = true;
      handleApply();
    }
  }, [handleApply, isApplying, isUpdateReady, shouldShow]);

  const handleHardReload = useCallback(() => {
    try {
      window.location.reload();
    } catch (error) {
      console.warn("Hard reload failed", error);
    }
  }, []);

  if (!shouldShow) {
    return null;
  }

  const containerStyle =
    variant === "inline"
      ? { ...BASE_STYLE, ...INLINE_STYLE, ...style }
      : { ...BASE_STYLE, ...style };

  return (
    <div className={className} style={containerStyle}>
      <div style={{ marginBottom: "12px", fontSize: "0.95rem", lineHeight: 1.6 }}>
        <strong style={{ display: "block", marginBottom: "4px" }}>
          最新バージョンを検出しました
        </strong>
        <span>{description}</span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={isApplying}
          style={{
            flex: "1 1 160px",
            minWidth: "140px",
            padding: "10px 14px",
            borderRadius: "4px",
            border: "0",
            background: "rgba(76, 132, 255, 0.85)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.05em",
            opacity: isApplying ? 0.7 : 1,
          }}
        >
          {isApplying ? "適用中..." : "今すぐ更新"}
        </button>
        <button
          type="button"
          onClick={handleHardReload}
          style={{
            flex: "1 1 140px",
            minWidth: "120px",
            padding: "10px 14px",
            borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.6)",
            background: "transparent",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          ハードリロード
        </button>
      </div>
    </div>
  );
}
