"use client";
import { useEffect, useRef } from "react";
import { logError } from "@/lib/utils/log";
import { SafeUpdateRecovery, useSafeUpdateStatus } from "@/components/ui/SafeUpdateRecovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("app", "global-error", error);
  }, [error]);

  const {
    shouldShow: safeUpdateVisible,
    hasError: safeUpdateHasError,
    hydrated: safeUpdateHydrated,
  } = useSafeUpdateStatus();
  const safeUpdateHandledRef = useRef(false);
  const resetTriggeredRef = useRef(false);
  const safeUpdateInProgress =
    safeUpdateHydrated && safeUpdateVisible && !safeUpdateHasError;
  const awaitingReset = safeUpdateHandledRef.current && !safeUpdateVisible;
  const showCriticalErrorPanel =
    safeUpdateHydrated &&
    !safeUpdateInProgress &&
    !awaitingReset &&
    !resetTriggeredRef.current &&
    (safeUpdateHasError || !safeUpdateVisible);

  useEffect(() => {
    if (safeUpdateInProgress) {
      safeUpdateHandledRef.current = true;
      resetTriggeredRef.current = false;
      return;
    }
    if (
      safeUpdateHandledRef.current &&
      !safeUpdateVisible &&
      !resetTriggeredRef.current
    ) {
      resetTriggeredRef.current = true;
      reset();
    }
  }, [safeUpdateInProgress, safeUpdateVisible, reset]);

  const handleBackToLobby = () => {
    window.location.href = "/";
  };

  return (
    <html lang="ja">
      <body
        style={{
          background: "rgba(8,9,15,0.95)",
          color: "#fff",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            padding: "32px",
            borderRadius: "0",
            border: "3px solid rgba(255,255,255,0.9)",
            background: "rgba(8,9,15,0.9)",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)",
          }}
        >
          {!safeUpdateHydrated && (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  textShadow: "1px 1px 0px #000",
                  letterSpacing: "0.5px",
                }}
              >
                最新情報を取得中です
              </h1>
              <p
                style={{
                  marginTop: "16px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.9)",
                  textShadow: "1px 1px 0px rgba(0,0,0,0.6)",
                }}
              >
                少しだけお待ちください…
              </p>
            </>
          )}
          {safeUpdateInProgress && (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  textShadow: "1px 1px 0px #000",
                  letterSpacing: "0.5px",
                }}
              >
                最新バージョンを適用しています
              </h1>
              <p
                style={{
                  marginTop: "16px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.9)",
                  textShadow: "1px 1px 0px rgba(0,0,0,0.6)",
                }}
              >
                アップデートの準備中です。完了すると自動的に画面が切り替わります。
                <br />
                しばらく経っても切り替わらない場合は、下のボタンから手動で適用できます。
              </p>
            </>
          )}
          {awaitingReset && (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  textShadow: "1px 1px 0px #000",
                  letterSpacing: "0.5px",
                }}
              >
                更新が完了しました
              </h1>
              <p
                style={{
                  marginTop: "16px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.9)",
                  textShadow: "1px 1px 0px rgba(0,0,0,0.6)",
                }}
              >
                最新バージョンへ切り替えています…
              </p>
            </>
          )}
          {showCriticalErrorPanel && (
            <>
              <h1 style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 700,
                textShadow: "1px 1px 0px #000",
                letterSpacing: "0.5px"
              }}>
                じゅうだいな エラーが はっせいしました
              </h1>
              <p style={{
                marginTop: "16px",
                lineHeight: 1.8,
                color: "rgba(255,255,255,0.9)",
                textShadow: "1px 1px 0px rgba(0,0,0,0.6)"
              }}>
                システムに ふぐあいが はっせいしています。<br />
                さいどくこみを しても もんだいが つづくばあいは、<br />
                メインメニューに もどってください。
              </p>
              {error.digest && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "0"
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.7)",
                    textShadow: "1px 1px 0px rgba(0,0,0,0.6)"
                  }}>
                    エラーばんごう: {error.digest}
                  </p>
                </div>
              )}
              <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexDirection: "column" }}>
                <button
                  onClick={() => reset()}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "0",
                    border: "3px solid rgba(255,255,255,0.9)",
                    background: "rgba(60,80,180,0.7)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: "1rem",
                    textShadow: "1px 1px 0px #000",
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.6)",
                  }}
                >
                  もういちど やりなおす
                </button>
                <button
                  onClick={handleBackToLobby}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "0",
                    border: "3px solid rgba(255,255,255,0.9)",
                    background: "rgba(40,40,40,0.7)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: "1rem",
                    textShadow: "1px 1px 0px #000",
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.6)",
                  }}
                >
                  メインメニューに もどる
                </button>
              </div>
            </>
          )}
          <SafeUpdateRecovery
            reason="error:global"
            variant="inline"
            style={{ marginTop: "20px" }}
          />
        </div>
      </body>
    </html>
  );
}
