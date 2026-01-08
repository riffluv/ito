import { buildPixiWorkerUrl } from "@/components/main-menu/buildPixiWorkerUrl";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { logDebug } from "@/lib/utils/log";
import { useEffect } from "react";

type UseMainMenuWarmupParams = {
  router: {
    prefetch: (href: string) => void;
  };
};

export function useMainMenuWarmup(params: UseMainMenuWarmupParams) {
  const { router } = params;

  useEffect(() => {
    return scheduleIdleTask(() => {
      try {
        router.prefetch("/rules");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          logDebug("main-menu", "prefetch-rules-skipped", error);
        }
      }
    }, { timeoutMs: 2000, delayMs: 0 });
  }, [router]);

  // Pixi背景用の軽量プリウォーム（描画はしない）
  useEffect(() => {
    const workerUrl = buildPixiWorkerUrl();
    return scheduleIdleTask(() => {
      // 1) Pixi本体を事前読み込み
      import("@/lib/pixi/loadPixi")
        .then((mod) => mod.loadPixi().catch(() => void 0))
        .catch(() => void 0);
      // 2) 背景ワーカーJSをブラウザキャッシュへ
      if (workerUrl) {
        try {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.as = "worker";
          link.href = workerUrl;
          document.head.appendChild(link);
        } catch {
          // ignore
        }
      }
    }, { timeoutMs: 2000, delayMs: 300 });
  }, []);
}

