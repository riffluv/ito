"use client";
import { useEffect } from "react";
import Link from "next/link";
import { logError } from "@/lib/utils/log";

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

  return (
    <html lang="ja">
      <body
        style={{
          background: "#05070d",
          color: "#fff",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--chakra-fonts-heading, system-ui)",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            padding: "32px",
            borderRadius: "18px",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "linear-gradient(135deg, rgba(11,16,31,0.92), rgba(4,6,12,0.92))",
            boxShadow: "0 24px 60px rgba(3,6,12,0.55)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            サービスで問題が発生しました
          </h1>
          <p style={{ marginTop: "12px", lineHeight: 1.6, color: "rgba(255,255,255,0.78)" }}>
            ページを再読み込みしても問題が続く場合は、ロビーに戻ってください。
          </p>
          {error.digest && (
            <p style={{ marginTop: "8px", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
              エラーID: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
            <button
              onClick={() => reset()}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(36,123,255,0.18)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ページを再読み込み
            </button>
            <Link
              href="/"
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              ロビーに戻る
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
