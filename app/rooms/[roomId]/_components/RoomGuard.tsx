"use client";

// V3: 遅延表示は不要になったため削除

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import { RoomLayout } from "./RoomLayout";
import {
  RoomStateProvider,
  useRoomStateContext,
} from "./RoomStateProvider";

import { AppButton } from "@/components/ui/AppButton";
import { useTransition } from "@/components/ui/TransitionProvider";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { useAssetPreloader } from "@/hooks/useAssetPreloader";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { applyServiceWorkerUpdate, resyncWaitingServiceWorker } from "@/lib/serviceWorker/updateChannel";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Spinner, Text, HStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSoundManager } from "@/lib/audio/SoundProvider";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { setMetric } from "@/lib/utils/metrics";
import { initMetricsExport } from "@/lib/utils/metricsExport";

const ROOM_CORE_ASSETS = [
  "/images/flag.webp",
  "/images/flag2.webp",
  "/images/flag3.webp",
  "/images/card1.webp",
  "/images/card2.webp",
  "/images/card3.webp",
  "/images/hanepen1.webp",
  "/images/hanepen2.webp",
  "/images/backgrounds/hd2d/bg1.png",
] as const;

const PREFETCH_COMPONENT_LOADERS: Array<() => Promise<unknown>> = [
  () => import("@/components/SettingsModal"),
  () => import("@/components/ui/MinimalChat"),
  () => import("@/components/RoomPasswordPrompt").then((mod) => mod.RoomPasswordPrompt),
  () => import("@/components/ui/Tooltip"),
];

type AuthContextValue = ReturnType<typeof useAuth>;

type RoomGuardProps = {
  roomId: string;
};

type RoomGuardContentProps = {
  roomId: string;
  router: ReturnType<typeof useRouter>;
  transition: ReturnType<typeof useTransition> | null;
  auth: AuthContextValue;
  uid: string | null;
  authLoading: boolean;
  setPasswordVerified: Dispatch<SetStateAction<boolean>>;
};

type ConnectionInfo = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & { connection?: ConnectionInfo | null };

function RoomGuardContent(props: RoomGuardContentProps) {
  const {
    roomId,
    auth,
    router,
    transition,
    uid,
    authLoading,
    setPasswordVerified,
  } = props;
  const soundManager = useSoundManager();
  const safeUpdateFeatureEnabled =
    process.env.NEXT_PUBLIC_FEATURE_SAFE_UPDATE === "1";
  const idleApplyConfiguredMs = safeUpdateFeatureEnabled
    ? Number.parseInt(process.env.NEXT_PUBLIC_FEATURE_IDLE_APPLY_MS ?? "", 10)
    : Number.NaN;
  const idleApplyMs =
    Number.isFinite(idleApplyConfiguredMs) && idleApplyConfiguredMs > 0
      ? idleApplyConfiguredMs
      : 0;
  const [allowCoreAssetPreload, setAllowCoreAssetPreload] = useState(false);
  useAssetPreloader(ROOM_CORE_ASSETS, { enabled: allowCoreAssetPreload });
  useEffect(() => {
    initMetricsExport();
  }, []);
  useEffect(() => {
    setMetric("safeUpdate", "deferred", 0);
    setMetric("safeUpdate", "applied", 0);
  }, []);
  useEffect(() => {
    setMetric("app", "appVersion", APP_VERSION);
  }, []);
  useEffect(() => {
    if (typeof navigator === "undefined") {
      setAllowCoreAssetPreload(true);
      return () => {};
    }
    const connection = (navigator as NavigatorWithConnection).connection ?? null;
    const slowTypes = new Set(["slow-2g", "2g", "3g"]);

    const evaluate = () => {
      if (!connection) {
        setAllowCoreAssetPreload(true);
        return;
      }
      if (connection.saveData === true) {
        setAllowCoreAssetPreload(false);
        return;
      }
      const effectiveType = typeof connection.effectiveType === "string"
        ? connection.effectiveType.toLowerCase()
        : "";
      if (slowTypes.has(effectiveType)) {
        setAllowCoreAssetPreload(false);
        return;
      }
      if (typeof connection.downlink === "number" && connection.downlink < 1.5) {
        setAllowCoreAssetPreload(false);
        return;
      }
      setAllowCoreAssetPreload(true);
    };

    evaluate();
    let unsubscribe: (() => void) | null = null;
    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", evaluate);
      unsubscribe = () => {
        connection.removeEventListener?.("change", evaluate);
      };
    }
    return () => {
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    setMetric("assets", "corePreloadEligible", allowCoreAssetPreload ? 1 : 0);
  }, [allowCoreAssetPreload]);
  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    let disposed = false;
    const rafIds: number[] = [];
    let gsapModule: typeof import("gsap") | null = null;
    let pixiModule: typeof import("pixi.js") | null = null;
    let moduleLoadPromise: Promise<void> | null = null;
    let warmupIdleHandle: number | null = null;
    let warmupTimeoutHandle: number | null = null;
    let modulePrefetchCancel: (() => void) | null = null;

    const ensureModules = () => {
      if (moduleLoadPromise) {
        return moduleLoadPromise;
      }
      moduleLoadPromise = (async () => {
        if (!gsapModule) {
          try {
            gsapModule = await import("gsap");
          } catch {
            gsapModule = null;
          }
        }
        if (!pixiModule) {
          try {
            pixiModule = await import("pixi.js");
          } catch {
            pixiModule = null;
          }
        }
      })().catch(() => {
        moduleLoadPromise = null;
      });
      return moduleLoadPromise ?? Promise.resolve();
    };

    const scheduleModulePrefetch = () => {
      if (typeof window === "undefined") return;
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
      if (typeof win.requestIdleCallback === "function") {
        const id = win.requestIdleCallback(
          () => {
            modulePrefetchCancel = null;
            void ensureModules();
          },
          { timeout: 1200 }
        );
        modulePrefetchCancel = () => win.cancelIdleCallback?.(id);
      } else {
        const timeoutId = window.setTimeout(() => {
          modulePrefetchCancel = null;
          void ensureModules();
        }, 400);
        modulePrefetchCancel = () => window.clearTimeout(timeoutId);
      }
    };
    scheduleModulePrefetch();

    const pumpFrames = (remaining: number) => {
      if (disposed || remaining <= 0) return;
      const id = requestAnimationFrame(() => {
        if (gsapModule) {
          gsapModule.gsap.ticker.tick();
        }
        if (pixiModule) {
          pixiModule.Ticker.shared.update();
        }
        pumpFrames(remaining - 1);
      });
      rafIds.push(id);
    };

    const runWarmup = async () => {
      if (document.visibilityState !== "visible") return;
      const warmupStartedAt =
        typeof performance !== "undefined" ? performance.now() : null;
      await ensureModules();
      if (disposed) return;
      let tickerRestore: (() => void) | null = null;
      if (soundManager) {
        void soundManager.warmup().catch(() => undefined);
      }
      if (gsapModule) {
        gsapModule.gsap.ticker.wake();
        gsapModule.gsap.ticker.tick();
      }
      try {
        if (pixiModule) {
          const ticker = pixiModule.Ticker.shared;
          const prevAutoStart = ticker.autoStart;
          const wasStarted = ticker.started ?? false;
          if (!wasStarted) {
            ticker.autoStart = true;
            ticker.start();
          }
          ticker.update();
          tickerRestore = () => {
            ticker.autoStart = prevAutoStart;
            if (!wasStarted && ticker.started) {
              ticker.stop();
            }
          };
        }
        pumpFrames(3);
      } finally {
        tickerRestore?.();
        if (warmupStartedAt !== null) {
          setMetric(
            "warmup",
            "roomWarmupMs",
            Math.round(performance.now() - warmupStartedAt)
          );
        }
      }
    };

    const cancelScheduledWarmup = () => {
      const win = window as Window &
        typeof globalThis & {
          cancelIdleCallback?: (handle: number) => void;
        };
      if (warmupIdleHandle !== null) {
        win.cancelIdleCallback?.(warmupIdleHandle);
        warmupIdleHandle = null;
      }
      if (warmupTimeoutHandle !== null) {
        window.clearTimeout(warmupTimeoutHandle);
        warmupTimeoutHandle = null;
      }
    };

    const scheduleWarmup = () => {
      cancelScheduledWarmup();
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
        };
      if (typeof win.requestIdleCallback === "function") {
        warmupIdleHandle = win.requestIdleCallback(
          () => {
            warmupIdleHandle = null;
            void runWarmup();
          },
          { timeout: 1200 }
        );
      } else {
        warmupTimeoutHandle = window.setTimeout(() => {
          warmupTimeoutHandle = null;
          void runWarmup();
        }, 300);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      cancelScheduledWarmup();
      void runWarmup();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, {
      passive: true,
    });

    if (document.visibilityState === "visible") {
      scheduleWarmup();
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      rafIds.forEach((id) => cancelAnimationFrame(id));
      cancelScheduledWarmup();
      modulePrefetchCancel?.();
    };
  }, [soundManager]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;
    const win = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    const runPrefetch = async () => {
      for (const loader of PREFETCH_COMPONENT_LOADERS) {
        if (cancelled) break;
        try {
          await loader();
        } catch {
          // ignore individual loader failure
        }
      }
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let interactionBlocked = false;
    let interactionReleaseTimeout: number | null = null;

    const schedulePrefetch = (delay = 0) => {
      if (cancelled) return;
      if (idleHandle !== null) {
        win.cancelIdleCallback?.(idleHandle);
        idleHandle = null;
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (delay > 0) {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          if (cancelled) return;
          triggerPrefetch();
        }, delay);
        return;
      }
      if (typeof win.requestIdleCallback === "function") {
        idleHandle = win.requestIdleCallback(triggerPrefetch, { timeout: 2000 });
      } else {
        timeoutHandle = window.setTimeout(triggerPrefetch, 800);
      }
    };

    const triggerPrefetch = () => {
      idleHandle = null;
      timeoutHandle = null;
      if (interactionBlocked) {
        schedulePrefetch(1200);
        return;
      }
      void runPrefetch();
    };

    const handleInteraction = () => {
      interactionBlocked = true;
      if (interactionReleaseTimeout !== null) {
        window.clearTimeout(interactionReleaseTimeout);
      }
      interactionReleaseTimeout = window.setTimeout(() => {
        interactionBlocked = false;
        schedulePrefetch(0);
      }, 1600);
    };

    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("touchstart", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });

    schedulePrefetch(0);

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        win.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      if (interactionReleaseTimeout !== null) {
        window.clearTimeout(interactionReleaseTimeout);
      }
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);
  useEffect(() => {
    void resyncWaitingServiceWorker("room:mount");
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleVisibilityResync = () => {
      if (document.visibilityState === "visible") {
        void resyncWaitingServiceWorker("room:visible");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityResync, true);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityResync, true);
    };
    return undefined;
  }, []);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogLoading, setPasswordDialogLoading] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(
    null
  );
  const roomState = useRoomStateContext();
  const { room: roomData, loading, roomAccessError, roomAccessErrorDetail } = roomState;
  const room = roomData;



  if (!firebaseEnabled) {
    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <Text>
          Firebase が無効になっています。.env.local を設定してから再度お試しください。
        </Text>
      </Box>
    );
  }

  if (loading || authLoading) {
    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <Spinner />
      </Box>
    );
  }

  if (roomAccessError === "permission-denied") {
    const handleRetry = async () => {
      try {
        await ensureAuthSession("room-access-denied-retry");
      } catch {
        // ignore
      }
      router.refresh();
    };

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "520px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="0.1em"
              textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              mb={3}
            >
              ▼ ACCESS DENIED ▼
            </Text>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="700" lineHeight={1.6}>
              認証情報が無効か、部屋へのアクセス権がありません
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              いったん再ログインしてから部屋に入り直すか、ホストに参加権限を確認してください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="gray" variant="outline" size="md" onClick={handleRetry}>
              再読み込み
            </AppButton>
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "client-update-required") {
    const mismatch = roomAccessErrorDetail?.kind === "version-mismatch" ? roomAccessErrorDetail : null;
    const roomVersion = mismatch?.roomVersion ?? "不明";
    const clientVersion = mismatch?.clientVersion ?? APP_VERSION;

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    const handleHardReload = () => {
      try {
        window.location.reload();
      } catch {}
    };

    const handleApplyUpdate = () => {
      const applied = applyServiceWorkerUpdate({
        reason: "room:client-update-required",
        safeMode: true,
      });
      if (!applied) {
        void resyncWaitingServiceWorker("room:client-update-required");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              アップデートが必要です
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              この部屋はバージョン {roomVersion} で進行中です。現在のバージョン ({clientVersion}) のままでは参加できません。
              更新を適用してから再度お試しください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="brand" size="md" onClick={handleApplyUpdate}>
              今すぐ更新
            </AppButton>
            <AppButton palette="gray" variant="outline" size="md" onClick={handleHardReload}>
              ハードリロード
            </AppButton>
            <AppButton palette="gray" variant="outline" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "room-version-mismatch") {
    const mismatch = roomAccessErrorDetail?.kind === "version-mismatch" ? roomAccessErrorDetail : null;
    const roomVersion = mismatch?.roomVersion ?? "不明";
    const clientVersion = mismatch?.clientVersion ?? APP_VERSION;

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              この部屋は別バージョンです
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              この部屋はバージョン {roomVersion} で進行中です。現在のバージョン ({clientVersion}) からは参加・操作できません。
              更新してもこの部屋には入れないため、新しい部屋を作成するか招待を取り直してください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "room-version-check-failed") {
    const detail = roomAccessErrorDetail?.kind === "version-check-failed" ? roomAccessErrorDetail.detail : null;

    const handleRetry = () => {
      router.refresh();
    };

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              バージョン確認に失敗しました
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              {detail ? `詳細: ${detail}` : null}
              {detail ? <br /> : null}
              ページを再読み込みしてから、もう一度入室をお試しください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="gray" variant="outline" size="md" onClick={handleRetry}>
              再読み込み
            </AppButton>
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (!room) {
    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "return", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          }
        );
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "520px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="0.1em"
              textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              mb={3}
            >
              ▼ 404 - Not Found ▼
            </Text>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              fontWeight="700"
              lineHeight={1.6}
              textShadow="1px 1px 0 rgba(0,0,0,0.8)"
            >
              おっと、部屋が見つかりません
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              部屋が削除されたか、URLが間違っているようです
            </Text>
          </Box>
          <Box display="flex" justifyContent="center">
            <AppButton
              onClick={handleBackToLobby}
              palette="brand"
              size="md"
              minW="180px"
            >
              ロビーへ戻る
            </AppButton>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <RoomLayout
      roomId={roomId}
      router={router}
      transition={transition}
      auth={auth}
      uid={uid}
      safeUpdateFeatureEnabled={safeUpdateFeatureEnabled}
      idleApplyMs={idleApplyMs}
      setPasswordVerified={setPasswordVerified}
      passwordDialogOpen={passwordDialogOpen}
      setPasswordDialogOpen={setPasswordDialogOpen}
      passwordDialogLoading={passwordDialogLoading}
      setPasswordDialogLoading={setPasswordDialogLoading}
      passwordDialogError={passwordDialogError}
      setPasswordDialogError={setPasswordDialogError}
      {...roomState}
    />
  );

}

export function RoomGuard({ roomId }: RoomGuardProps) {
  const auth = useAuth();
  const { user, displayName, loading: authLoading } = auth;
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid ?? null;
  const [passwordVerified, setPasswordVerified] = useState(false);

  return (
    <RoomStateProvider
      roomId={roomId}
      uid={uid}
      displayName={displayName ?? null}
      passwordVerified={passwordVerified}
    >
      <RoomGuardContent
        roomId={roomId}
        router={router}
        transition={transition}
        auth={auth}
        uid={uid}
        authLoading={authLoading}
        setPasswordVerified={setPasswordVerified}
      />
    </RoomStateProvider>
  );
}
