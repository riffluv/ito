"use client";

// V3: 遅延表示は不要になったため削除

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import SafeUpdateBanner from "@/components/ui/SafeUpdateBanner";
import dynamic from "next/dynamic";

import { AppButton } from "@/components/ui/AppButton";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import MiniHandDock from "@/components/ui/MiniHandDock";
import { SpectatorHUD } from "@/components/rooms/SpectatorHUD";
import { RoomView } from "@/components/rooms/RoomView";
import { notify } from "@/components/ui/notify";
import { useTransition } from "@/components/ui/TransitionProvider";
import UniversalMonitor from "@/components/UniversalMonitor";
import { useAuth } from "@/context/AuthContext";
import type {
  SeatRequestViewState,
  SpectatorMachineState,
} from "@/lib/spectator/v2/useSpectatorController";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  resetPlayerState,
  setPlayerName,
} from "@/lib/firebase/players";
import {
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import { useAssetPreloader } from "@/hooks/useAssetPreloader";
import { forceDetachAll } from "@/lib/firebase/presence";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { getDisplayMode, stripMinimalTag } from "@/lib/game/displayMode";
import { areAllCluesReady, getClueTargetIds, getPresenceEligibleIds, computeSlotCount } from "@/lib/game/selectors";
import { pruneProposalByEligible } from "@/lib/game/service";
import { clearRevealPending } from "@/lib/game/service";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { deriveSpectatorFlags } from "@/lib/room/spectatorRoles";
import type {
  RoomMachineClientEvent,
  SpectatorReason as MachineSpectatorReason,
  SpectatorRequestSource,
} from "@/lib/state/roomMachine";
import { useHostClaim } from "@/lib/hooks/useHostClaim";
import { useHostPruning } from "@/lib/hooks/useHostPruning";
import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";
import { selectHostCandidate } from "@/lib/host/HostManager";
import { showtime } from "@/lib/showtime";
import { verifyPassword } from "@/lib/security/password";
import {
  assignNumberIfNeeded,
  getRoomServiceErrorCode,
  joinRoomFully,
} from "@/lib/services/roomService";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";

import { initMetricsExport } from "@/lib/utils/metricsExport";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useSpectatorSession } from "@/lib/spectator/v2/useSpectatorSession";
import { useSpectatorHostQueue } from "@/lib/spectator/v2/useSpectatorHostQueue";
import { useSpectatorController } from "@/lib/spectator/v2/useSpectatorController";
import type { SpectatorHostRequest } from "@/lib/spectator/v2/useSpectatorHostQueue";
import {
  applyServiceWorkerUpdate,
  getWaitingServiceWorker,
  resyncWaitingServiceWorker,
  subscribeToServiceWorkerUpdates,
  holdForceApplyTimer,
  releaseForceApplyTimer,
} from "@/lib/serviceWorker/updateChannel";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import { UI_TOKENS, UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Spinner, Text, Dialog, VStack, HStack } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { PRUNE_PROPOSAL_DEBOUNCE_MS } from '@/lib/constants/uiTimings';

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

const SPECTATOR_HOST_ERROR_MESSAGES: Record<string, string> = {
  "auth-required": "認証情報が無効です。再度ログインしてください。",
  unauthorized: "認証情報が無効です。再度ログインしてください。",
  forbidden: "承認操作を行えるのはホストのみです。",
  "rejoin-not-pending": "この申請はすでに処理されています。",
  "viewer-mismatch": "観戦者情報の確認に失敗しました。再読み込みしてください。",
  "room-mismatch": "申請対象のルームが一致しません。",
  "session-not-found": "申請セッションが見つかりませんでした。",
};

const formatSpectatorHostError = (code: string): string => {
  if (!code) {
    return "処理に失敗しました。時間をおいて再度お試しください。";
  }
  const normalized = code.toLowerCase();
  return (
    SPECTATOR_HOST_ERROR_MESSAGES[normalized] ??
    "処理に失敗しました。時間をおいて再度お試しください。"
  );
};

const PREFETCH_COMPONENT_LOADERS: Array<() => Promise<unknown>> = [
  () => import("@/components/SettingsModal"),
  () => import("@/components/ui/MinimalChat"),
  () => import("@/components/RoomPasswordPrompt").then((mod) => mod.RoomPasswordPrompt),
  () => import("@/components/ui/Tooltip"),
];

type SafeUpdateTrigger =
  | "status:waiting"
  | "status:reveal-finished"
  | "status:finished-waiting"
  | "idle";

type RoomPageContentProps = {
  roomId: string;
};

type AuthContextValue = ReturnType<typeof useAuth>;
type RoomStateSnapshot = ReturnType<typeof useRoomState>;

type RoomPageContentInnerProps = RoomStateSnapshot & {
  roomId: string;
  router: ReturnType<typeof useRouter>;
  transition: ReturnType<typeof useTransition> | null;
  auth: AuthContextValue;
  uid: string | null;
  safeUpdateFeatureEnabled: boolean;
  idleApplyMs: number;
  passwordVerified: boolean;
  setPasswordVerified: Dispatch<SetStateAction<boolean>>;
  passwordDialogOpen: boolean;
  setPasswordDialogOpen: Dispatch<SetStateAction<boolean>>;
  passwordDialogLoading: boolean;
  setPasswordDialogLoading: Dispatch<SetStateAction<boolean>>;
  passwordDialogError: string | null;
  setPasswordDialogError: Dispatch<SetStateAction<string | null>>;
};

function RoomPageContent({ roomId }: RoomPageContentProps) {
  const auth = useAuth();
  const { user, displayName, setDisplayName, loading: authLoading } = auth;
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid || null;
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();
  const bgmPlayingRef = useRef(false);
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
      return;
    }
    const connection: any = (navigator as any).connection ?? null;
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
    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", evaluate);
      return () => {
        connection.removeEventListener("change", evaluate);
      };
    }
    return;
  }, []);
  useEffect(() => {
    setMetric("assets", "corePreloadEligible", allowCoreAssetPreload ? 1 : 0);
  }, [allowCoreAssetPreload]);
  useEffect(() => {
    if (typeof document === "undefined") return;
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

  const shouldPlayBgm =
    !!soundManager &&
    !soundSettings.muted &&
    (soundSettings.categoryVolume?.ambient ?? 0) > 0.001;

  useEffect(() => {
    if (!soundManager) return;
    if (shouldPlayBgm) {
      bgmPlayingRef.current = true;
      void soundManager.play("bgm1").catch(() => {
        bgmPlayingRef.current = false;
      });
    } else if (bgmPlayingRef.current) {
      soundManager.stop("bgm1");
      bgmPlayingRef.current = false;
    }
    return () => {
      if (bgmPlayingRef.current) {
        soundManager.stop("bgm1");
        bgmPlayingRef.current = false;
      }
    };
  }, [soundManager, shouldPlayBgm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
      return;
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
  }, []);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogLoading, setPasswordDialogLoading] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(
    null
  );
  const roomState = useRoomState(
    roomId,
    uid,
    passwordVerified ? (displayName ?? null) : null
  );
  const {
    room: roomData,
    players,
    onlineUids,
    presenceReady,
    onlinePlayers,
    loading,
    isHost,
    isMember,
    detachNow,
    reattachPresence,
    leavingRef,
    joinStatus,
    sendRoomEvent,
    spectatorStatus: fsmSpectatorStatus,
    spectatorReason: fsmSpectatorReason,
    spectatorRequestStatus: fsmSpectatorRequestStatus,
    spectatorRequestSource: fsmSpectatorRequestSource,
    spectatorRequestCreatedAt: fsmSpectatorRequestCreatedAt,
    spectatorRequestFailure: fsmSpectatorRequestFailure,
    spectatorError: fsmSpectatorError,
    spectatorNode: fsmSpectatorNode,
  } = roomState;
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
    <RoomPageContentInner
      roomId={roomId}
      router={router}
      transition={transition}
      auth={auth}
      uid={uid}
      safeUpdateFeatureEnabled={safeUpdateFeatureEnabled}
      idleApplyMs={idleApplyMs}
      passwordVerified={passwordVerified}
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

function RoomPageContentInner(props: RoomPageContentInnerProps) {
  const {
    roomId,
    router,
    transition,
    auth,
    uid,
    safeUpdateFeatureEnabled,
    idleApplyMs,
    passwordVerified,
    setPasswordVerified,
    passwordDialogOpen,
    setPasswordDialogOpen,
    passwordDialogLoading,
    setPasswordDialogLoading,
    passwordDialogError,
    setPasswordDialogError,
    room: roomData,
    players,
    onlineUids,
    presenceReady,
    onlinePlayers,
    loading,
    isHost,
    isMember,
    detachNow,
    reattachPresence,
    leavingRef,
    joinStatus,
    sendRoomEvent,
    spectatorStatus: fsmSpectatorStatus,
    spectatorReason: fsmSpectatorReason,
    spectatorRequestStatus: fsmSpectatorRequestStatus,
    spectatorRequestSource: fsmSpectatorRequestSource,
    spectatorRequestCreatedAt: fsmSpectatorRequestCreatedAt,
    spectatorRequestFailure: fsmSpectatorRequestFailure,
    spectatorError: fsmSpectatorError,
    spectatorNode: fsmSpectatorNode,
  } = props;
  if (!roomData) {
    throw new Error("RoomPageContentInner requires room data");
  }
  const room = roomData;
  const { user, displayName, setDisplayName, loading: authLoading } = auth;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const emitSpectatorEvent = useCallback(
    (event: RoomMachineClientEvent) => {
      sendRoomEvent(event);
    },
    [sendRoomEvent]
  );

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const overlayStatusRef = useRef<string | null>(null);
  const showTransitionMessage = useCallback(
    (message: string, durationMs = 3000) => {
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      setTransitionMessage(message);
      if (typeof window === "undefined" || durationMs <= 0) {
        return;
      }
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        setTransitionMessage((current) => (current === message ? null : current));
      }, durationMs);
    },
    []
  );
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);
  const [dealRecoveryDismissed, setDealRecoveryDismissed] = useState(false);
  const [dealRecoveryOpen, setDealRecoveryOpen] = useState(false);
  const dealRecoveryTimerRef = useRef<number | null>(null);
  const isGameFinished = room?.status === "finished";

  const roomStatus = room?.status ?? null;
  const recallOpen = room?.ui?.recallOpen === true;
  const spectatorRecallEnabled = recallOpen && roomStatus === "waiting";
  const {
    requests: spectatorHostRequests,
    loading: spectatorHostLoading,
    error: spectatorHostError,
  } = useSpectatorHostQueue(isHost ? roomId : null);
  const spectatorSession = useSpectatorSession({
    roomId,
    viewerUid: uid,
  });
  const { approveRejoin: approveSpectatorRejoin, rejectRejoin: rejectSpectatorRejoin } = spectatorSession.actions;


  // reveal到達時のフラグクリーンアップ（冪等・ホストのみ実行）
  useEffect(() => {
    if (!isHost) return;
    const pending = (room as any)?.ui?.revealPending === true;
    const status = room?.status;
    if (!pending) return;
    if (status === 'reveal' || status === 'finished') {
      void clearRevealPending(roomId);
    }
  }, [isHost, (room as any)?.ui?.revealPending, room?.status, roomId]);
  const [lastKnownHostId, setLastKnownHostId] = useState<string | null>(null);
  const playerJoinOrderRef = useRef<Map<string, number>>(new Map());
  const joinCounterRef = useRef(0);
  const previousRoundRef = useRef<number | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const initialStatusHydratedRef = useRef(false);
  const lastRevealTsRef = useRef<number | null>(null);
  const [joinVersion, setJoinVersion] = useState(0);
  const [hasWaitingUpdate, setHasWaitingUpdate] = useState(() =>
    typeof window === "undefined" ? false : getWaitingServiceWorker() !== null
  );
  useEffect(() => {
    return subscribeToServiceWorkerUpdates((registration) => {
      setHasWaitingUpdate(!!registration);
    });
  }, []);
  const [versionMismatchGuarded, setVersionMismatchGuarded] = useState(false);
  const {
    isUpdateReady: spectatorUpdateReady,
    isApplying: spectatorUpdateApplying,
    hasError: spectatorUpdateFailed,
    retryUpdate: retrySpectatorUpdate,
    applyUpdate: applySpectatorUpdate,
  } = useServiceWorkerUpdate();
  const meId = uid || "";
  const meFromPlayers = players.find((p) => p.id === meId);
  const [optimisticMe, setOptimisticMe] = useState<(PlayerDoc & { id: string }) | null>(null);
  const me = meFromPlayers ?? optimisticMe ?? null;
  const playersWithOptimistic = useMemo(() => {
    if (!optimisticMe) return players;
    if (players.some((p) => p.id === optimisticMe.id)) {
      return players;
    }
    return [...players, optimisticMe];
  }, [players, optimisticMe]);
  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of playersWithOptimistic) {
      map.set(player.id, player.name ?? "");
    }
    return map;
  }, [playersWithOptimistic]);
  const resolveSpectatorDisplayName = useCallback(
    (viewerUid: string | null) => {
      if (!viewerUid) return "観戦者";
      const name = playerNameById.get(viewerUid)?.trim();
      if (name && name.length > 0) {
        return name;
      }
      return `観戦者(${viewerUid.slice(0, 6)})`;
    },
    [playerNameById]
  );
  const playersSignature = useMemo(
    () => playersWithOptimistic.map((p) => p.id).join(","),
    [playersWithOptimistic]
  );
  const normalizedDisplayName = useMemo(() => {
    if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return "匿名";
  }, [displayName]);
  const dealPlayers = useMemo((): string[] | null => {
    const list = room?.deal?.players;
    if (!Array.isArray(list)) {
      return null;
    }
    const filtered = list.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    return filtered.length > 0 ? filtered : null;
  }, [room?.deal]);
  const dealPlayersSignature = useMemo(
    () =>
      Array.isArray(dealPlayers) && dealPlayers.length > 0
        ? dealPlayers.join(",")
        : "",
    [dealPlayers]
  );
  const requiredSwVersion = useMemo(() => {
    const raw = room?.requiredSwVersion;
    if (typeof raw !== "string") return "";
    return raw.trim();
  }, [room?.requiredSwVersion]);
  const versionMismatch = useMemo(() => {
    if (!requiredSwVersion) return false;
    return requiredSwVersion !== APP_VERSION;
  }, [requiredSwVersion]);
  const safeUpdateActive = safeUpdateFeatureEnabled && versionMismatch;
  const versionMismatchBlocksAccess = versionMismatch && !safeUpdateFeatureEnabled;
  useEffect(() => {
    if (requiredSwVersion) {
      setMetric("app", "requiredSwVersion", requiredSwVersion);
      setMetric("app", "versionMismatch", requiredSwVersion === APP_VERSION ? 0 : 1);
    } else {
      setMetric("app", "requiredSwVersion", "");
      setMetric("app", "versionMismatch", 0);
    }
  }, [requiredSwVersion]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!safeUpdateFeatureEnabled || (!versionMismatch && !hasWaitingUpdate)) {
      setVersionMismatchGuarded(false);
      if (versionGuardTimerRef.current !== null) {
        window.clearTimeout(versionGuardTimerRef.current);
        versionGuardTimerRef.current = null;
      }
      return;
    }
    setVersionMismatchGuarded(true);
    if (versionGuardTimerRef.current !== null) {
      window.clearTimeout(versionGuardTimerRef.current);
      versionGuardTimerRef.current = null;
    }
    return () => {
      if (versionGuardTimerRef.current !== null) {
        window.clearTimeout(versionGuardTimerRef.current);
        versionGuardTimerRef.current = null;
      }
    };
  }, [safeUpdateFeatureEnabled, versionMismatch, hasWaitingUpdate]);
  const versionMismatchHandledRef = useRef(false);
  const safeUpdateEnteredRef = useRef(false);
  const safeUpdateStatusRef = useRef<string | null>(null);
  const safeUpdateAutoApplyRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const lastInteractionTsRef = useRef<number>(
    typeof window === "undefined" ? 0 : Date.now()
  );
  const versionGuardTimerRef = useRef<number | null>(null);
  const currentRoomStatus = room?.status ?? null;
  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateEnteredRef.current = false;
      return;
    }
    if (safeUpdateActive) {
      if (!safeUpdateEnteredRef.current) {
        safeUpdateEnteredRef.current = true;
        bumpMetric("safeUpdate", "deferred");
      }
    } else {
      safeUpdateEnteredRef.current = false;
    }
  }, [safeUpdateActive, safeUpdateFeatureEnabled]);
  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateAutoApplyRef.current = false;
      return;
    }
    if (spectatorUpdateApplying) {
      return;
    }
    if (spectatorUpdateFailed) {
      safeUpdateAutoApplyRef.current = false;
    }
    if (!versionMismatch && !hasWaitingUpdate) {
      safeUpdateAutoApplyRef.current = false;
      return;
    }
    if (safeUpdateAutoApplyRef.current && !spectatorUpdateFailed) {
      return;
    }
    if (!hasWaitingUpdate) {
      void resyncWaitingServiceWorker(
        spectatorUpdateFailed ? "room:auto-retry-failed-resync" : "room:auto-init"
      );
      return;
    }
    const reason = spectatorUpdateFailed
      ? "room:auto-retry-failed"
      : versionMismatch
      ? "room:auto-mismatch"
      : "room:auto-waiting";
    safeUpdateAutoApplyRef.current = true;
    const applied = applyServiceWorkerUpdate({
      reason,
      safeMode: true,
    });
    if (!applied) {
      safeUpdateAutoApplyRef.current = false;
      void resyncWaitingServiceWorker("room:auto-retry");
    }
  }, [
    safeUpdateFeatureEnabled,
    versionMismatch,
    hasWaitingUpdate,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
  ]);
  const tryApplyServiceWorker = useCallback(
    (reason: SafeUpdateTrigger) => {
      if (!safeUpdateFeatureEnabled) return false;
      if (currentRoomStatus && currentRoomStatus !== "waiting") {
        return false;
      }
      const registration = getWaitingServiceWorker();
      const waitingWorker = registration?.waiting;
      if (!registration || !waitingWorker) {
        return false;
      }
      const applied = applyServiceWorkerUpdate({
        reason,
        safeMode: safeUpdateActive,
      });
      return applied;
    },
    [safeUpdateFeatureEnabled, safeUpdateActive, currentRoomStatus]
  );
  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateStatusRef.current = currentRoomStatus;
      return;
    }
    if (currentRoomStatus === null) {
      safeUpdateStatusRef.current = null;
      return;
    }
    const previousStatus = safeUpdateStatusRef.current;
    if (hasWaitingUpdate) {
      if (currentRoomStatus === "waiting" && previousStatus !== "waiting") {
        tryApplyServiceWorker("status:waiting");
      } else if (previousStatus === "reveal" && currentRoomStatus === "finished") {
        tryApplyServiceWorker("status:reveal-finished");
      } else if (previousStatus === "finished" && currentRoomStatus === "waiting") {
        tryApplyServiceWorker("status:finished-waiting");
      }
    }
    safeUpdateStatusRef.current = currentRoomStatus;
  }, [
    currentRoomStatus,
    hasWaitingUpdate,
    safeUpdateFeatureEnabled,
    tryApplyServiceWorker,
  ]);
  useEffect(() => {
    const holdReason = "room:safe-update";
    if (!safeUpdateFeatureEnabled) {
      releaseForceApplyTimer(holdReason);
      return () => {
        releaseForceApplyTimer(holdReason);
      };
    }
    if (safeUpdateActive && currentRoomStatus && currentRoomStatus !== "waiting") {
      holdForceApplyTimer(holdReason);
      return () => {
        releaseForceApplyTimer(holdReason);
      };
    }
    releaseForceApplyTimer(holdReason);
    return () => {
      releaseForceApplyTimer(holdReason);
    };
  }, [safeUpdateFeatureEnabled, safeUpdateActive, currentRoomStatus]);
  useEffect(() => {
    if (!safeUpdateFeatureEnabled) return;
    if (!hasWaitingUpdate) return;
    if (currentRoomStatus === "waiting") {
      tryApplyServiceWorker("status:waiting");
    }
  }, [
    safeUpdateFeatureEnabled,
    hasWaitingUpdate,
    currentRoomStatus,
    tryApplyServiceWorker,
  ]);
  const resetIdleTimer = useCallback(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) {
      if (typeof window !== "undefined" && idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (typeof window === "undefined") return;
    if (!hasWaitingUpdate) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    lastInteractionTsRef.current = Date.now();
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      if (!safeUpdateFeatureEnabled) return;
      tryApplyServiceWorker("idle");
    }, idleApplyMs);
  }, [
    safeUpdateFeatureEnabled,
    idleApplyMs,
    hasWaitingUpdate,
    tryApplyServiceWorker,
  ]);
  useEffect(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) {
      if (typeof window !== "undefined" && idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const handleInteraction = () => {
      lastInteractionTsRef.current = Date.now();
      resetIdleTimer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resetIdleTimer();
      }
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    for (const eventName of events) {
      window.addEventListener(eventName, handleInteraction, true);
    }
    document.addEventListener("visibilitychange", handleVisibility, true);
    resetIdleTimer();
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleInteraction, true);
      }
      document.removeEventListener("visibilitychange", handleVisibility, true);
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [safeUpdateFeatureEnabled, idleApplyMs, resetIdleTimer]);
  useEffect(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) return;
    resetIdleTimer();
  }, [safeUpdateFeatureEnabled, idleApplyMs, hasWaitingUpdate, resetIdleTimer]);
  const presenceLastSeenRef = useRef<Map<string, number>>(new Map());
  const HOST_UNAVAILABLE_GRACE_MS = Math.max(PRESENCE_STALE_MS, 60_000);
  const onlineUidSignature = useMemo(
    () => (Array.isArray(onlineUids) ? onlineUids.join(",") : "_"),
    [onlineUids]
  );
  useEffect(() => {
    if (!presenceReady) return;
    if (!Array.isArray(onlineUids)) return;
    const nowTs = Date.now();
    for (const uid of onlineUids) {
      presenceLastSeenRef.current.set(uid, nowTs);
    }
  }, [presenceReady, onlineUidSignature]);


  useEffect(() => {
    const requiresPassword = room?.requiresPassword;
    const passwordHash = room?.passwordHash;

    if (!room) {
      setPasswordDialogOpen(false);
      setPasswordVerified(false);
      return;
    }
    if (!requiresPassword) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    const cached = getCachedRoomPasswordHash(roomId);
    if (cached && passwordHash && cached === passwordHash) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    setPasswordVerified(false);
    setPasswordDialogOpen(true);
    setPasswordDialogError(null);
  }, [roomId, room?.requiresPassword, room?.passwordHash]);

  const handleRoomPasswordSubmit = useCallback(
    async (input: string) => {
      if (!room) return;
      setPasswordDialogLoading(true);
      setPasswordDialogError(null);
      try {
        const ok = await verifyPassword(
          input.trim(),
          room.passwordSalt ?? null,
          room.passwordHash ?? null
        );
        if (!ok) {
          setPasswordDialogError("\u30d1\u30b9\u30ef\u30fc\u30c9\u304c\u9055\u3044\u307e\u3059");
          return;
        }
        storeRoomPasswordHash(roomId, room.passwordHash ?? "");
        setPasswordVerified(true);
        setPasswordDialogOpen(false);
      } catch (error) {
        logError("room-page", "verify-room-password-failed", error);
        setPasswordDialogError("\u30d1\u30b9\u30ef\u30fc\u30c9\u306e\u691c\u8a3c\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
      } finally {
        setPasswordDialogLoading(false);
      }
    },
    [room, roomId]
  );

  const handleRoomPasswordCancel = useCallback(() => {
    notify({ title: "ロビーに戻りました", type: "info" });
    router.push("/");
  }, [router]);

  const fallbackNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (room?.hostId && room?.hostName) {
      map[room.hostId] = room.hostName;
    }
    const trimmedDisplayName =
      typeof displayName === "string" ? displayName.trim() : "";
    if (uid && trimmedDisplayName) {
      map[uid] = trimmedDisplayName;
    }
    return map;
  }, [room?.hostId, room?.hostName, uid, displayName]);

  const stableHostId =
    typeof room?.hostId === "string" ? room.hostId.trim() : "";

  const hostLikelyUnavailable = useMemo(() => {
    if (!stableHostId) {
      return true;
    }
    if (!presenceReady) {
      return false;
    }
    if (uid && stableHostId === uid) {
      return false;
    }
    if (Array.isArray(onlineUids) && onlineUids.includes(stableHostId)) {
      return false;
    }
    const lastSeenTs = presenceLastSeenRef.current.get(stableHostId);
    if (!lastSeenTs) {
      return false;
    }
    const elapsed = Date.now() - lastSeenTs;
    if (elapsed < HOST_UNAVAILABLE_GRACE_MS) {
      return false;
    }
    return true;
  }, [stableHostId, uid, onlineUidSignature, presenceReady]);

  const isSoloMember = useMemo(
    () => isMember && players.length === 1 && players[0]?.id === (uid ?? ""),
    [isMember, players, uid]
  );

  const hostClaimCandidateId = useMemo(() => {
    const roomKey = room?.id ?? null;
    if (!roomKey || players.length === 0) {
      return null;
    }

    void joinVersion;

    if (lastKnownHostId && players.some((p) => p.id === lastKnownHostId)) {
      return lastKnownHostId;
    }

    const onlineSet = new Set(Array.isArray(onlineUids) ? onlineUids : []);
    const now = Date.now();
    const inputs = players.map((player) => {
      const joinedAt =
        playerJoinOrderRef.current.get(player.id) ?? Number.MAX_SAFE_INTEGER;
      const lastPresence = presenceLastSeenRef.current.get(player.id) ?? null;
      const isOnline =
        !presenceReady ||
        onlineSet.has(player.id) ||
        (lastPresence !== null && now - lastPresence < HOST_UNAVAILABLE_GRACE_MS);
      const lastSeenAt = lastPresence ?? null;
      return {
        id: player.id,
        joinedAt,
        orderIndex:
          typeof player.orderIndex === "number" ? player.orderIndex : null,
        lastSeenAt,
        isOnline,
        name: player.name ?? null,
      };
    });

    return selectHostCandidate(inputs) ?? null;
  }, [room?.id, players, onlineUidSignature, lastKnownHostId, joinVersion, presenceReady]);


  const [pop, setPop] = useState(false);
  const [redirectGuard, setRedirectGuard] = useState(true);
  const [forcedExitReason, setForcedExitReason] = useState<
    "game-in-progress" | "version-mismatch" | null
  >(null);

  const spectatorStateLogRef = useRef<{
    roomStatus: string | null;
    isMember: boolean;
    canAccess: boolean;
    forcedExitReason: typeof forcedExitReason;
    spectatorReason: typeof spectatorReason;
    spectatorNode: typeof fsmSpectatorNode;
    joinStatus: typeof joinStatus;
    playersSignature: string;
    waitingToRejoin: boolean;
  } | null>(null);
  const [seatRequestTimedOut, setSeatRequestTimedOut] = useState(false);
  const prevSeatRequestStatusRef = useRef<SeatRequestViewState["status"]>(fsmSpectatorRequestStatus);
  const seatRequestTimeoutTriggeredRef = useRef(false);
  const spectatorTimeoutPrevRef = useRef(false);
  const isSpectatorMode = !isMember && !isHost && fsmSpectatorNode !== "idle";
  const spectatorEnterReason = useMemo<Exclude<MachineSpectatorReason, null>>(() => {
    if (versionMismatchBlocksAccess || forcedExitReason === "version-mismatch") {
      return "version-mismatch";
    }
    if (roomStatus === "waiting") {
      return recallOpen ? "waiting-open" : "waiting-closed";
    }
    return "mid-game";
  }, [versionMismatchBlocksAccess, forcedExitReason, roomStatus, recallOpen]);

  const spectatorMachineState = useMemo<SpectatorMachineState>(
    () => ({
      status: fsmSpectatorStatus,
      node: fsmSpectatorNode,
      reason: fsmSpectatorReason,
      requestSource: fsmSpectatorRequestSource,
      requestStatus: fsmSpectatorRequestStatus,
      requestCreatedAt: fsmSpectatorRequestCreatedAt,
      requestFailure: fsmSpectatorRequestFailure,
      error: fsmSpectatorError,
    }),
    [
      fsmSpectatorStatus,
      fsmSpectatorNode,
      fsmSpectatorReason,
      fsmSpectatorRequestSource,
      fsmSpectatorRequestStatus,
      fsmSpectatorRequestCreatedAt,
      fsmSpectatorRequestFailure,
      fsmSpectatorError,
    ]
  );

  const spectatorController = useSpectatorController({
    roomId,
    uid,
    isSpectatorMode,
    spectatorMachineState,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    setSeatRequestTimedOut,
    leavingRef,
    spectatorSession,
  });
  const {
    state: {
      reason: spectatorReason,
      seatRequest: seatRequestState,
      seatRequestPending,
      seatRequestAccepted,
      seatRequestRejected,
      seatAcceptanceActive,
      seatRequestButtonDisabled,
      seatRequestSource,
    },
    actions: {
      clearRejoinIntent,
      suppressAutoJoinIntent,
      clearPendingSeatRequest,
      handleSeatRecovery,
      cancelSeatRequestSafely,
    },
    utils: {
      hasRejoinIntent,
      consumePendingSeatRequest,
      hasPendingSeatRequest,
    },
  } = spectatorController;
  useEffect(() => {
    if (seatRequestState.status !== "pending") return;
    if (spectatorRecallEnabled) return;
    if (hasPendingSeatRequest()) return;
    if (!uid) return;
    clearPendingSeatRequest();
    emitSpectatorEvent({ type: "SPECTATOR_RESET" });
    setSeatRequestTimedOut(false);
    clearRejoinIntent();
    void cancelSeatRequestSafely();
  }, [
    seatRequestState.status,
    spectatorRecallEnabled,
    hasPendingSeatRequest,
    clearPendingSeatRequest,
    uid,
    roomId,
    clearRejoinIntent,
    cancelSeatRequestSafely,
    emitSpectatorEvent,
  ]);
  useEffect(() => {
    if (seatRequestState.status === "pending") return;
    clearRejoinIntent();
  }, [seatRequestState.status, clearRejoinIntent]);
  const recallJoinHandledRef = useRef(false);
  const assignNumberRetrySignatureRef = useRef<string | null>(null);
  const reattachScheduledRef = useRef(false);
  useEffect(() => {
    if (!seatRequestAccepted) {
      reattachScheduledRef.current = false;
      return;
    }
    if (typeof reattachPresence !== "function") return;
    if (reattachScheduledRef.current) return;
    reattachScheduledRef.current = true;
    Promise.resolve(reattachPresence()).catch((error) => {
      logDebug("room-page", "reattach-presence-failed", error);
      reattachScheduledRef.current = false;
    });
  }, [seatRequestAccepted, reattachPresence]);

  const forcedExitScheduledRef = useRef(false);
  const forcedExitRecoveryPendingRef = useRef(false);
  useEffect(() => {
    if (!uid) return;
    if (!hasPendingSeatRequest()) return;
    if (!spectatorRecallEnabled) return;
    const queued = consumePendingSeatRequest();
    if (!queued) return;
    void handleSeatRecovery({
      silent: true,
      source: queued,
      spectatorRecallEnabled,
      roomStatus,
      recallOpen,
      notify,
    });
  }, [
    uid,
    spectatorRecallEnabled,
    hasPendingSeatRequest,
    consumePendingSeatRequest,
    handleSeatRecovery,
    roomStatus,
    recallOpen,
    notify,
  ]);

  useEffect(() => {
    if (!versionMismatchBlocksAccess) {
      versionMismatchHandledRef.current = false;
      if (forcedExitReason === "version-mismatch") {
        setForcedExitReason(null);
        if (leavingRef.current) {
          leavingRef.current = false;
        }
      }
      return;
    }
    if (!uid) return;
    if (versionMismatchHandledRef.current) return;
    versionMismatchHandledRef.current = true;
    bumpMetric("forcedExit", "versionMismatch");
    bumpMetric("forcedExit", "versionMismatch");
    leavingRef.current = true;

    void (async () => {
      try {
        await detachNow();
      } catch (error) {
        logError("room-page", "version-mismatch-detach-now", error);
      }

      try {
        await forceDetachAll(roomId, uid);
      } catch (error) {
        logError("room-page", "version-mismatch-force-detach-all", error);
      }

      try {
        await leaveRoomAction(roomId, uid, displayName);
      } catch (error) {
        logError("room-page", "version-mismatch-leave-room-action", error);
      }
    })();
  }, [
    versionMismatchBlocksAccess,
    uid,
    detachNow,
    roomId,
    displayName,
    setForcedExitReason,
    forcedExitReason,
    leavingRef,
  ]);

  const executeForcedExit = useCallback(async () => {
    if (!uid) return;

    forcedExitRecoveryPendingRef.current = false;

    if (!leavingRef.current) {
      leavingRef.current = true;
    }

    const performExit = async () => {
      const forceExitReason: MachineSpectatorReason =
        roomStatus === "waiting"
          ? recallOpen
            ? "waiting-open"
            : "waiting-closed"
          : "mid-game";

      emitSpectatorEvent({ type: "SPECTATOR_FORCE_EXIT", reason: forceExitReason });

      try {
        await detachNow();
      } catch (error) {
        logError("room-page", "forced-exit-detach-now", error);
      }

      try {
        await forceDetachAll(roomId, uid);
      } catch (error) {
        logError("room-page", "forced-exit-force-detach-all", error);
      }

      try {
        await leaveRoomAction(roomId, uid, displayName);
      } catch (error) {
        logError("room-page", "forced-exit-leave-room-action", error);
      }
    };

    try {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "exit", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          },
          performExit
        );
      } else {
        await performExit();
        router.replace("/");
      }
    } catch (error) {
      logError("room-page", "forced-exit-router-replace", error);
    } finally {
      forcedExitScheduledRef.current = false;
      setForcedExitReason(null);
    }
  }, [
    uid,
    leavingRef,
    detachNow,
    roomId,
    displayName,
    router,
    transition,
    emitSpectatorEvent,
    recallOpen,
    roomStatus,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setRedirectGuard(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let updated = false;
    for (const player of players) {
      if (!playerJoinOrderRef.current.has(player.id)) {
        playerJoinOrderRef.current.set(player.id, joinCounterRef.current++);
        updated = true;
      }
    }
    if (updated) {
      setJoinVersion((value) => value + 1);
    }
  }, [players]);

  useEffect(() => {
    if (lastKnownHostId || !room?.creatorId) return;
    const trimmedCreator = room.creatorId.trim();
    if (trimmedCreator) {
      setLastKnownHostId(trimmedCreator);
    }
  }, [room?.creatorId, lastKnownHostId]);

  useEffect(() => {
    if (stableHostId) {
      setLastKnownHostId(stableHostId);
    }
  }, [stableHostId]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof me?.number === "number") {
      setPop(true);
      timeoutId = setTimeout(() => setPop(false), 180);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [me?.number]);

  const needName = !displayName || !String(displayName).trim();

  const handleSubmitName = useCallback(async (name: string) => {
    setDisplayName(name);
  }, [setDisplayName]);





  const joinInProgress = joinStatus === "joining";
  const joinEstablished = joinStatus === "joined";
  const hasOptimisticSeat =
    !!optimisticMe &&
    (joinEstablished || seatAcceptanceActive) &&
    !(forcedExitReason || versionMismatchBlocksAccess);

  const serverAssignedSeatIds = useMemo(() => {
    const assigned = new Set<string>();
    const pushList = (list: unknown) => {
      if (!Array.isArray(list)) return;
      for (const value of list) {
        if (typeof value === "string" && value.trim().length > 0) {
          assigned.add(value);
        }
      }
    };
    pushList(room?.deal?.players ?? null);
    pushList(room?.order?.list ?? null);
    pushList(room?.order?.proposal ?? null);
    return assigned;
  }, [room?.deal?.players, room?.order?.list, room?.order?.proposal]);

  const hasServerAssignedSeat = !!(uid && serverAssignedSeatIds.has(uid));
  const allowSpectatorWhileLoading =
    loading &&
    !isHost &&
    !hasServerAssignedSeat &&
    room?.status !== "waiting";

  const loadingForSpectator = loading && !allowSpectatorWhileLoading;

  const { isJoiningOrRetrying, spectatorCandidate } = deriveSpectatorFlags({
    hasUid: uid !== null,
    isHost,
    isMember,
    hasOptimisticSeat,
    seatAcceptanceActive,
    seatRequestPending,
    joinStatus,
    loading: loadingForSpectator,
  });

  useEffect(() => {
    if (!spectatorCandidate) {
      if (fsmSpectatorNode !== "idle") {
        // 観戦リクエスト中や強制退席直後は状態を維持する
        if (seatRequestPending || seatAcceptanceActive || forcedExitReason) {
          return;
        }
        emitSpectatorEvent({ type: "SPECTATOR_LEAVE" });
        emitSpectatorEvent({ type: "SPECTATOR_RESET" });
      }
      return;
    }
    if (fsmSpectatorNode !== "idle") {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      emitSpectatorEvent({ type: "SPECTATOR_ENTER", reason: spectatorEnterReason });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    emitSpectatorEvent,
    fsmSpectatorStatus,
    spectatorCandidate,
    spectatorEnterReason,
    seatRequestPending,
    seatAcceptanceActive,
    forcedExitReason,
  ]);

  useEffect(() => {
    if (!uid) return;
    if (!isSpectatorMode) return;
    if (!isMember && !isHost && !hasOptimisticSeat) return;
    if (seatRequestPending || seatAcceptanceActive) return;
    emitSpectatorEvent({ type: "SPECTATOR_LEAVE" });
    emitSpectatorEvent({ type: "SPECTATOR_RESET" });
  }, [
    uid,
    isSpectatorMode,
    isMember,
    isHost,
    hasOptimisticSeat,
    seatRequestPending,
    seatAcceptanceActive,
    emitSpectatorEvent,
  ]);
  const canAccess = (isMember || isHost || hasOptimisticSeat) && !versionMismatchBlocksAccess;
  useEffect(() => {
    traceAction("spectator.mode", {
      roomId,
      uid,
      isSpectatorMode,
      isMember,
      roomStatus: room?.status ?? null,
      spectatorNode: fsmSpectatorNode,
    });

    // Spectator V3: 観戦遷移時のトレースと状態初期化
    if (isSpectatorMode && uid) {
      traceAction("spectator.enter", {
        roomId,
        uid,
        reason: versionMismatchBlocksAccess
          ? "version-mismatch"
          : room?.status === "waiting"
          ? "waiting"
          : "mid-game",
      });

      // 観戦遷移時の状態初期化を厳密化
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      // 他の残留状態もクリア
      if (seatRequestState.status !== "idle") {
        emitSpectatorEvent({ type: "SPECTATOR_RESET" });
      }
    }
  }, [
    roomId,
    uid,
    isSpectatorMode,
    isMember,
    room?.status,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    seatRequestState.status,
  ]);
  useEffect(() => {
    if (!uid) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    if (isSpectatorMode) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    if (meFromPlayers) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    const shouldHoldOptimisticSeat =
      joinEstablished || seatRequestPending || seatAcceptanceActive;
    if (!shouldHoldOptimisticSeat) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    const baseName = normalizedDisplayName;
    setOptimisticMe((prev) => {
      if (
        prev &&
        prev.id === uid &&
        prev.name === baseName &&
        prev.uid === uid
      ) {
        return prev;
      }
      return {
        id: uid,
        name: baseName,
        avatar: prev?.avatar || "",
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid,
      };
    });
  }, [
    uid,
    optimisticMe,
    isSpectatorMode,
    meFromPlayers,
    joinEstablished,
    seatRequestPending,
    seatAcceptanceActive,
    normalizedDisplayName,
  ]);

  // 観戦理由の判定（文言出し分け用）
  const waitingToRejoin = roomStatus === "waiting";

  useEffect(() => {
    if (!isSpectatorMode) {
      spectatorTimeoutPrevRef.current = false;
      return;
    }
    if (seatRequestTimedOut && !spectatorTimeoutPrevRef.current) {
      traceAction("spectator.request.timeout", {
        roomId,
        uid,
        source: seatRequestState.source ?? null,
      });
      emitSpectatorEvent({ type: "SPECTATOR_TIMEOUT" });
    }
    spectatorTimeoutPrevRef.current = seatRequestTimedOut;
  }, [
    emitSpectatorEvent,
    isSpectatorMode,
    seatRequestTimedOut,
    roomId,
    uid,
    seatRequestState.source,
  ]);

  const spectatorEnteredRef = useRef(false);
  useEffect(() => {
    if (!isSpectatorMode) {
      spectatorEnteredRef.current = false;
      return;
    }
    if (spectatorEnteredRef.current) {
      return;
    }
    spectatorEnteredRef.current = true;
    if (seatRequestState.status !== "idle") {
      emitSpectatorEvent({ type: "SPECTATOR_RESET" });
    }
    clearPendingSeatRequest();
    setSeatRequestTimedOut(false);
    leavingRef.current = false;
    if (seatRequestState.status !== "idle") {
      void cancelSeatRequestSafely();
    }
  }, [
    isSpectatorMode,
    setSeatRequestTimedOut,
    leavingRef,
    seatRequestState.status,
    emitSpectatorEvent,
    cancelSeatRequestSafely,
  ]);

  useEffect(() => {
    if (!seatRequestAccepted) return;
    if (!uid) return;
    if (me) return;
    const baseName = normalizedDisplayName;
    setOptimisticMe((prev) => {
      if (prev && prev.id === uid) {
        return prev;
      }
      return {
        id: uid,
        name: baseName,
        avatar: prev?.avatar || "",
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid,
      } as PlayerDoc & { id: string };
    });
  }, [seatRequestAccepted, uid, me, normalizedDisplayName]);

  useEffect(() => {
    const nextState = {
      roomStatus: room?.status ?? null,
      spectatorNode: fsmSpectatorNode,
      isMember,
      canAccess,
      forcedExitReason,
      spectatorReason,
      joinStatus,
      playersSignature,
      waitingToRejoin,
    };
    const prev = spectatorStateLogRef.current;
    if (
      !prev ||
      prev.roomStatus !== nextState.roomStatus ||
      prev.isMember !== nextState.isMember ||
      prev.canAccess !== nextState.canAccess ||
      prev.forcedExitReason !== nextState.forcedExitReason ||
      prev.spectatorReason !== nextState.spectatorReason ||
      prev.spectatorNode !== nextState.spectatorNode ||
      prev.joinStatus !== nextState.joinStatus ||
      prev.playersSignature !== nextState.playersSignature ||
      prev.waitingToRejoin !== nextState.waitingToRejoin
    ) {
      spectatorStateLogRef.current = nextState;
      logDebug("room-page", "spectator-state", {
        roomId,
        uid,
        ...nextState,
      });
    }
  }, [
    room?.status,
    isMember,
    canAccess,
    forcedExitReason,
    spectatorReason,
    joinStatus,
    playersSignature,
    waitingToRejoin,
    roomId,
    uid,
  ]);

  const skipForcedExit = !uid || !isMember;

  useForcedExit({
    uid,
    roomStatus: room?.status,
    canAccess,
    spectatorNode: fsmSpectatorNode,
    loading,
    authLoading,
    hasRejoinIntent,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    detachNow,
    setForcedExitReason,
    roomId,
    displayName,
    sendRoomEvent: emitSpectatorEvent,
    recallOpen,
    skip: skipForcedExit,
  });

  const handleForcedExitLeaveNow = useCallback(() => {
    void executeForcedExit();
  }, [executeForcedExit]);

  const performSeatRecovery = useCallback(
    ({
      silent,
      source,
    }: {
      silent: boolean;
      source: Exclude<SpectatorRequestSource, null>;
    }) => {
      return handleSeatRecovery({
        silent,
        source,
        spectatorRecallEnabled,
        roomStatus,
        recallOpen,
        notify,
      });
    },
    [
      handleSeatRecovery,
      spectatorRecallEnabled,
      roomStatus,
      recallOpen,
      notify,
    ]
  );
  const handleRetryJoin = useCallback(async () => {
    await performSeatRecovery({ silent: false, source: "manual" });
  }, [performSeatRecovery]);


  useEffect(() => {
    if (seatRequestState.status !== "pending" || !seatRequestState.requestedAt) {
      setSeatRequestTimedOut(false);
      seatRequestTimeoutTriggeredRef.current = false;
      return;
    }
    const timeoutMs = 15000;
    const now = Date.now();
    const remaining = Math.max(timeoutMs - (now - seatRequestState.requestedAt), 0);
    if (remaining <= 0) {
      if (!seatRequestTimeoutTriggeredRef.current) {
        seatRequestTimeoutTriggeredRef.current = true;
        setSeatRequestTimedOut(true);
      }
      return;
    }
    seatRequestTimeoutTriggeredRef.current = false;
    const timer = window.setTimeout(() => {
      seatRequestTimeoutTriggeredRef.current = true;
      setSeatRequestTimedOut(true);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [seatRequestState.status, seatRequestState.requestedAt]);

  useEffect(() => {
    const currentStatus = seatRequestState.status;
    const previousStatus = prevSeatRequestStatusRef.current;
    if (currentStatus !== previousStatus) {
      if (currentStatus === "accepted") {
        traceAction("spectator.request.accepted", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
        });
        leavingRef.current = false;
        forcedExitScheduledRef.current = false;
        forcedExitRecoveryPendingRef.current = false;
        setForcedExitReason(null);
        setSeatRequestTimedOut(false);
      } else if (currentStatus === "rejected") {
        traceAction("spectator.request.rejected", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
          failure: seatRequestState.error ?? null,
        });
        leavingRef.current = false;
        forcedExitRecoveryPendingRef.current = false;
        setSeatRequestTimedOut(false);
      } else if (currentStatus === "pending") {
        traceAction("spectator.request.pending", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
        });
      } else if (
        previousStatus === "pending" &&
        currentStatus === "idle" &&
        isSpectatorMode &&
        room?.status === "waiting"
      ) {
        try {
          notify({
            title: "リクエストをリセットしました",
            description: "ホストの操作に合わせて再度「席に戻る」を押してください。",
            type: "info",
          });
        } catch (error) {
          logDebug("room-page", "notify-seat-request-reset-failed", error);
        }
      } else {
        setSeatRequestTimedOut(false);
      }
      prevSeatRequestStatusRef.current = currentStatus;
    }
    if (currentStatus !== "pending") {
      seatRequestTimeoutTriggeredRef.current = false;
    }
  }, [
    seatRequestState.status,
    seatRequestState.source,
    seatRequestState.error,
    leavingRef,
    forcedExitScheduledRef,
    forcedExitRecoveryPendingRef,
    setForcedExitReason,
    roomId,
    uid,
  ]);

  useEffect(() => {
    if (!forcedExitReason) return;
    if (!canAccess && room?.status !== "waiting") return;

    forcedExitScheduledRef.current = false;
    if (room?.status === "waiting") {
      leavingRef.current = false;
    }
    setForcedExitReason(null);

    if (room?.status === "waiting" && forcedExitRecoveryPendingRef.current) {
      forcedExitRecoveryPendingRef.current = false;
    } else {
      forcedExitRecoveryPendingRef.current = false;
    }
  }, [
    forcedExitReason,
    canAccess,
    room?.status,
    uid,
    displayName,
  ]);



  const previousHostStillMember = useMemo(() => {
    if (!lastKnownHostId) return false;
    if (uid && lastKnownHostId === uid) return false;
    const hostPlayerExists = players.some((p) => p.id === lastKnownHostId);
    if (!hostPlayerExists) return false;
    if (!presenceReady) return true;
    if (Array.isArray(onlineUids) && onlineUids.includes(lastKnownHostId)) {
      return true;
    }
    return false;
  }, [lastKnownHostId, players, onlineUids, uid, presenceReady]);

  const hostClaimStatus = useHostClaim({
    roomId,
    uid,
    user,
    hostId: stableHostId || null,
    hostLikelyUnavailable,
    isSoloMember,
    candidateId: hostClaimCandidateId,
    lastKnownHostId,
    previousHostStillMember,
    isMember,
    leavingRef,
  });


  useEffect(() => {
    if (!room || !uid || !me) return;
    if (room.status !== "clue") return;
    if (!room.deal || !room.deal.seed) return;
    if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

    assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
  }, [
    room?.status,
    room?.deal?.seed,
    room?.deal?.players,
    uid,
    roomId,
    me?.id,
  ]);
  useEffect(() => {
    if (!room) {
      previousRoundRef.current = null;
      return;
    }
    const currentRound =
      typeof room.round === "number" && room.round > 0 ? room.round : null;
    if (
      currentRound &&
      previousRoundRef.current !== currentRound
    ) {
      void showtime.play("round:start", {
        round: currentRound,
        status: room.status,
      });
    }
    previousRoundRef.current = currentRound;
  }, [room?.round, room?.status]);

  useEffect(() => {
    if (!room) {
      previousStatusRef.current = null;
      initialStatusHydratedRef.current = false;
      lastRevealTsRef.current = null;
      return;
    }
    const status = room.status ?? null;
    const prev = previousStatusRef.current;
    const revealedAt = room.result?.revealedAt;
    const revealedMs = (() => {
      if (!revealedAt) return null;
      if (
        typeof revealedAt === "object" &&
        typeof (revealedAt as any).toMillis === "function"
      ) {
        try {
          return (revealedAt as any).toMillis();
        } catch {
          return null;
        }
      }
      if (revealedAt instanceof Date) {
        return revealedAt.getTime();
      }
      return null;
    })();
    if (!initialStatusHydratedRef.current) {
      previousStatusRef.current = status;
      initialStatusHydratedRef.current = true;
      lastRevealTsRef.current = revealedMs;
      return;
    }
    if (status && prev !== status) {
      const enteringReveal = status === "reveal" && prev !== "reveal";
      const finishingReveal =
        status === "finished" &&
        prev === "reveal" &&
        (revealedMs === null || revealedMs !== lastRevealTsRef.current);
      if (enteringReveal || finishingReveal) {
        void showtime.play("round:reveal", {
          success: room.result?.success ?? null,
        });
      }
    }
    previousStatusRef.current = status;
    if (revealedMs !== null && revealedMs !== lastRevealTsRef.current) {
      lastRevealTsRef.current = revealedMs;
    }
  }, [room?.status, room?.result?.success]);

  useEffect(() => {
    const status = room?.status ?? null;
    if (!isMember) {
      overlayStatusRef.current = status;
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (transitionMessage !== null) {
        setTransitionMessage(null);
      }
      return;
    }
    const prev = overlayStatusRef.current;
    if (status && prev !== status) {
      if (prev === "waiting" && status === "clue") {
        showTransitionMessage("配られた数字にぴったりなワードを考えよう！", 3000);
      } else if (status === "waiting" && prev && prev !== "waiting") {
        if (prev === "finished") {
          showTransitionMessage("次のゲームに移行中…", 3000);
        } else {
          showTransitionMessage("リセット中…", 3000);
        }
      }
    }
    overlayStatusRef.current = status;
  }, [room?.status, isMember, showTransitionMessage, transitionMessage]);






  const [seenRound, setSeenRound] = useState<number>(0);

  useEffect(() => {
    if (!uid) return;
    const r = room?.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db!, "rooms", roomId, "players", uid);
      updateDoc(meRef, { ready: false }).catch(() => void 0);
    }
  }, [room?.round, uid, roomId, seenRound]);


  const myPlayer = useMemo(() => players.find((p) => p.id === uid), [players, uid]);
  const shouldResetPlayer = useMemo(() => {
    if (!myPlayer) return false;
    return (
      myPlayer.number !== null ||
      !!myPlayer.clue1 ||
      myPlayer.ready ||
      myPlayer.orderIndex !== 0
    );
  }, [myPlayer]);

  useEffect(() => {
    if (!uid || room?.status !== "waiting") return;
    if (shouldResetPlayer) {
      resetPlayerState(roomId, uid).catch(() => void 0);
    }
  }, [room?.status, uid, roomId, shouldResetPlayer]);


  useHostPruning({
    isHost,
    uid,
    user,
    roomId,
    players,
    onlineUids,
    presenceReady,
  });


  useEffect(() => {
    if (!uid) return;
    if (displayName) {
      setPlayerName(roomId, uid, displayName).catch(() => void 0);
    }
  }, [displayName, uid, roomId]);

  const leaveRoom = useCallback(async () => {
    if (!uid) return;
    leavingRef.current = true;

    const getToken = async () => {
      try {
        if (!user) return null;
        return await user.getIdToken();
      } catch {
        return null;
      }
    };

    const clearSessionFlags = () => {
      // V3: sessionStorage は不要になったため空実装
    };

    const performLeave = async (token: string | null) => {

      try {

        await Promise.all([
          Promise.resolve(detachNow()).catch((error: unknown) => {
            logError("room-page", "leave-detach-now", error);
          }),
          Promise.resolve(forceDetachAll(roomId, uid)).catch((error: unknown) => {
            logError("room-page", "leave-force-detach", error);
          })
        ]);
      } catch (error) {
        logError("room-page", "leave-parallel-cleanup", error);
      }


      let viaApi = false;
      if (token) {
        try {
          const res = await fetch(`/api/rooms/${roomId}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              token,
              displayName: displayName ?? null,
            }),
            keepalive: true,
          });
          viaApi = res.ok;
          if (!res.ok) {
            logError("room-page", "leave-api-non-ok", { status: res.status });
          }
        } catch (error) {
          logError("room-page", "leave-api-call", error);
        }
      }


      if (!viaApi) {
        try {
          await leaveRoomAction(roomId, uid, displayName);
        } catch (error) {
          logError("room-page", "leave-room-action", error);
        }
      }


      clearSessionFlags();
    };

    const token = await getToken();

    try {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "leave", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          },
          async () => {
            await performLeave(token);
          }
        );
      } else {
        await performLeave(token);
        router.push("/");
      }
    } catch (error) {
      logError("room-page", "leave-room", error);
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 0.8,
          showLoading: true,
          loadingSteps: [
            { id: "error", message: "エラーが発生しました...", duration: 800 },
            { id: "return", message: "ロビーに戻ります...", duration: 800 },
            { id: "complete", message: "完了しました!", duration: 400 },
          ],
        });
      } else {
        router.push("/");
      }
    }
  }, [
    uid,
    leavingRef,
    user,
    
    roomId,
    detachNow,
    displayName,
    transition,
    router,
  ]);


  useLeaveCleanup({
    enabled: true,
    roomId,
    uid,
    displayName,
    detachNow,
    leavingRef,
    user,
  });






  const unsortedBaseIds = useMemo(() => {
    const dealPlayers = room?.deal?.players;
    if (Array.isArray(dealPlayers)) {
      const combined = new Set<string>([
        ...dealPlayers,
        ...playersWithOptimistic.map((p) => p.id),
      ]);
      return Array.from(combined);
    }
    return playersWithOptimistic.map((p) => p.id);
  }, [room?.deal?.players, playersWithOptimistic]);


  const baseIds = useMemo(
    () => sortPlayersByJoinOrder(unsortedBaseIds, playersWithOptimistic),
    [unsortedBaseIds, playersWithOptimistic]
  );


  const presenceEligibleIds = useMemo(
    () =>
      getPresenceEligibleIds({
        baseIds,
        onlineUids,
        presenceReady,
      }),
    [baseIds, presenceReady, onlineUidSignature]
  );

  const hostId = room?.hostId ?? null;
  const eligibleIds = useMemo(() => {
    const pool = presenceEligibleIds;
    if (!hostId) {
      return pool;
    }
    if (!pool.includes(hostId)) {
      return pool;
    }
    return [hostId, ...pool.filter((id) => id !== hostId)];
  }, [hostId, presenceEligibleIds]);

  const clueTargetIds = useMemo(
    () =>
      getClueTargetIds({
        dealPlayers: room?.deal?.players ?? null,
        eligibleIds,
      }),
    [room?.deal?.players, eligibleIds]
  );

  const allCluesReady = useMemo(
    () =>
      areAllCluesReady({
        players,
        targetIds: clueTargetIds,
      }),
    [players, clueTargetIds]
  );

  // 在室外IDが proposal に混入している場合の自動クリーンアップ（clue中のみ、軽いデバウンス）
  const pruneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneSigRef = useRef<string>("");
  useEffect(() => {
    if (!room || room.status !== "clue") {
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
      pruneSigRef.current = "";
      return;
    }
    const proposal: (string | null)[] = Array.isArray(room?.order?.proposal)
      ? (room.order!.proposal as (string | null)[])
      : [];
    const extra = proposal.filter(
      (pid): pid is string => typeof pid === "string" && !eligibleIds.includes(pid)
    );
    const sig = `${roomId}|${room?.round || 0}|${proposal.join(',')}|${eligibleIds.join(',')}`;
    if (extra.length === 0 || pruneSigRef.current === sig) return;
    pruneSigRef.current = sig;
    if (pruneTimerRef.current) {
      clearTimeout(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
    pruneTimerRef.current = setTimeout(() => { pruneProposalByEligible(roomId, eligibleIds).catch(() => {}); }, PRUNE_PROPOSAL_DEBOUNCE_MS);
    return () => {
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
    };
  }, [room?.status, room?.order?.proposal, room?.round, eligibleIds.join(","), roomId]);

  useEffect(() => {
    if (!isHost || !allCluesReady) {
      return;
    }

    const status = room?.status;
    if (status !== "clue") {
      return;
    }

    const mode = room?.options?.resolveMode || "sequential";
    const id = `clues-ready-${mode}-${roomId}-${room?.round || 0}`;
    try {
      notify({
        id,
        type: "success",
        title: "全員の連想ワードが揃いました",
        description:
          "カードを全員場に置き、相談して並べ替えてから『せーので判定』を押してください",
        duration: 6000,
      });
    } catch (error) {
      logDebug("room-page", "notify-clues-ready-failed", error);
    }
  }, [
    allCluesReady,
    isHost,
    room?.options?.resolveMode,
    room?.round,
    room?.status,
    roomId,
  ]);

  const needsDealRecovery = useMemo(() => {
    if (!room || room.status !== "clue") return false;
    const deal = room.deal;
    if (!deal) return true;
    const dealPlayers = Array.isArray(deal.players)
      ? (deal.players as string[]).filter(
          (pid): pid is string => typeof pid === "string" && pid.length > 0
        )
      : [];
    return dealPlayers.length === 0;
  }, [room?.status, room?.deal?.players]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isHost || room?.status !== "clue") {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      if (dealRecoveryDismissed) {
        setDealRecoveryDismissed(false);
      }
      return;
    }

    if (!needsDealRecovery) {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      if (dealRecoveryDismissed) {
        setDealRecoveryDismissed(false);
      }
      return;
    }

    if (dealRecoveryDismissed) {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      return;
    }

    if (dealRecoveryTimerRef.current !== null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDealRecoveryOpen(true);
      dealRecoveryTimerRef.current = null;
    }, 4500);

    dealRecoveryTimerRef.current = timerId;

    return () => {
      window.window.clearTimeout(timerId);
      if (dealRecoveryTimerRef.current === timerId) {
        dealRecoveryTimerRef.current = null;
      }
    };
  }, [
    isHost,
    room?.status,
    needsDealRecovery,
    dealRecoveryDismissed,
    dealRecoveryOpen,
  ]);

  const handleDealRecoveryDismiss = useCallback(() => {
    setDealRecoveryOpen(false);
    setDealRecoveryDismissed(true);
  }, []);

  // slotCount: 進行中は「オンライン在室数」を優先。presence未確定時は提出数/配札数にフォールバック。
  const slotCount = useMemo(() => computeSlotCount({
    status: room?.status || "waiting",
    orderList: room?.order?.list || [],
    dealPlayers: Array.isArray(room?.deal?.players) ? room.deal!.players : [],
    proposal: Array.isArray(room?.order?.proposal) ? room.order!.proposal : [],
    presenceReady,
    onlineUids,
    playersCount: playersWithOptimistic.length,
    playerIds: playersWithOptimistic.map((p) => p.id),
  }), [
    room?.status,
    room?.order?.list,
    room?.deal?.players,
    room?.order?.proposal,
    presenceReady,
    onlineUidSignature,
    playersWithOptimistic.length,
    playersSignature,
  ]);
  const orderList = room?.order?.list;

  const submittedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const proposal = room?.order?.proposal;
    if (Array.isArray(proposal)) {
      proposal.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    if (Array.isArray(orderList)) {
      orderList.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    return Array.from(ids);
  }, [room?.order?.proposal, orderList]);

  const canStartSorting = useMemo(() => {
    const resolveMode = room?.options?.resolveMode;
    const roomStatus = room?.status;
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return false;
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const placedIds = new Set(room?.order?.proposal ?? []);
    let waitingCount = 0;
    for (const id of eligibleIds) {
      const candidate = playerMap.get(id);
      if (candidate && !placedIds.has(candidate.id)) waitingCount += 1;
    }
    return waitingCount === 0;
  }, [room?.order?.proposal, orderList]);

  const meHasPlacedCard = submittedPlayerIds.includes(meId);
  const playerCount = playersWithOptimistic.length;
  const meIsReady = me?.ready === true;
  let baseOverlayMessage: string | null = null;
  if (room && isMember) {
    const status = room.status ?? null;
    if (status === "waiting") {
      baseOverlayMessage = `メンバー待機中（参加人数：${playerCount}人）`;
    } else if (status === "clue") {
      if (meHasPlacedCard) {
        baseOverlayMessage = "みんなで話し合って順番を決めよう！";
      } else if (meIsReady) {
        baseOverlayMessage = "上の空きスロットにカードをドラッグだ！";
      }
    }
  }
  const displayRoomName = stripMinimalTag(room?.name) || "";

  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined;


  const sidebarNode = (
    <DragonQuestParty
      players={playersWithOptimistic}
      roomStatus={room?.status || "waiting"}
      onlineCount={onlinePlayers.length}
      onlineUids={onlineUids}
      hostId={room?.hostId}
      roomId={roomId}
      isHostUser={isHost}
      eligibleIds={baseIds}
      roundIds={baseIds}
      submittedPlayerIds={submittedPlayerIds}
      fallbackNames={fallbackNames}
      displayRoomName={displayRoomName}
      suspendTransientUpdates={joinStatus === "joining" || joinStatus === "retrying" || loading}
    />
  );

  const mainNode = (
    <Box
      h="100%"
      display="grid"
      gridTemplateRows="auto 1fr"
      gap={3}
      minH={0}
      css={{
        "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
          {
            gap: "0.5rem",
            paddingTop: "0.25rem",
          },
      }}
    >
      <Box
        p={0}
        pt={{ base: "56px", md: "64px" }}
        css={{

          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={playersWithOptimistic} />
      </Box>
      <Box
        overflow="visible"
        minH={0}
        css={{
          "@media (max-height: 700px) and (min-resolution: 1.5dppx), screen and (max-height: 700px) and (-webkit-device-pixel-ratio: 1.5)":
            {
              overflowY: "auto",
            },
        }}
      >
        <CentralCardBoard
          roomId={roomId}
          players={playersWithOptimistic}
          orderList={room.order?.list || []}
          meId={meId}
          eligibleIds={eligibleIds}
          roomStatus={room.status}
          cluesReady={allCluesReady}
          failed={!!room.order?.failed}
          proposal={room.order?.proposal || []}
          resolveMode={room.options?.resolveMode}
          displayMode={getDisplayMode(room)}
          isHost={isHost}
          orderNumbers={room.order?.numbers ?? {}}
          orderSnapshots={room.order?.snapshots ?? null}
          slotCount={slotCount}
          topic={room.topic ?? null}
          revealedAt={room.result?.revealedAt ?? null}
          uiRevealPending={(room as any)?.ui?.revealPending === true}
          dealPlayers={dealPlayers}
        />
      </Box>
    </Box>
  );

  const spectatorUpdateButton = spectatorUpdateReady ? (
    <AppButton
      palette="brand"
      size="md"
      onClick={spectatorUpdateFailed ? retrySpectatorUpdate : applySpectatorUpdate}
      disabled={spectatorUpdateApplying}
    >
      {spectatorUpdateApplying
        ? "適用中..."
        : spectatorUpdateFailed
          ? "再試行"
          : "最新アップデートを適用"}
    </AppButton>
  ) : null;

  const handleSpectatorApprove = useCallback(
    async (request: SpectatorHostRequest) => {
      try {
        await approveSpectatorRejoin(request.sessionId);
        traceAction("spectatorV2.host.approve", {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
          source: request.source,
        });
        notify({
          type: "success",
          title: "復帰を承認しました",
          description: `${resolveSpectatorDisplayName(request.viewerUid)} が席へ戻ります。`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        traceError("spectatorV2.host.approve", error, {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
        });
        notify({
          type: "error",
          title: "復帰の承認に失敗しました",
          description: formatSpectatorHostError(message),
        });
        throw error;
      }
    },
    [approveSpectatorRejoin, notify, resolveSpectatorDisplayName, roomId]
  );

  const handleSpectatorReject = useCallback(
    async (request: SpectatorHostRequest, reason: string | null) => {
      try {
        await rejectSpectatorRejoin(request.sessionId, reason ?? null);
        traceAction("spectatorV2.host.reject", {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
          source: request.source,
          hasReason: Boolean(reason && reason.trim().length > 0),
        });
        notify({
          type: "info",
          title: "復帰申請を見送りました",
          description:
            reason && reason.trim().length > 0
              ? `${resolveSpectatorDisplayName(request.viewerUid)} に理由を伝えました。`
              : `${resolveSpectatorDisplayName(request.viewerUid)} へ見送りを通知しました。`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        traceError("spectatorV2.host.reject", error, {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
        });
        notify({
          type: "error",
          title: "復帰申請の見送りに失敗しました",
          description: formatSpectatorHostError(message),
        });
        throw error;
      }
    },
    [rejectSpectatorRejoin, notify, resolveSpectatorDisplayName, roomId]
  );

  const showHand =
    !!me &&
    (isMember ||
      seatAcceptanceActive ||
      (uid ? players.some((player) => player.id === uid) : false));

  const showRejoinOverlay =
    (seatRequestPending || seatAcceptanceActive) && !isSpectatorMode && !isMember;
  const prioritizedTransitionMessage = isMember ? transitionMessage : null;
  let phaseMessage: string | null = null;
  if (showRejoinOverlay) {
    phaseMessage = "ルームへ再参加中です...";
  } else if (prioritizedTransitionMessage) {
    phaseMessage = prioritizedTransitionMessage;
  } else if (baseOverlayMessage) {
    phaseMessage = baseOverlayMessage;
  } else if (forcedExitReason === "game-in-progress") {
    phaseMessage = "通信が一時的に不安定です。復帰待機中...";
  }

  const handNode = showHand ? (
    <MiniHandDock
      roomId={roomId}
      me={me}
      resolveMode={room.options?.resolveMode}
      proposal={room.order?.proposal || []}
      eligibleIds={eligibleIds}
      cluesReady={allCluesReady}
      isHost={isHost}
      roomStatus={room.status}
      defaultTopicType={room.options?.defaultTopicType || "\u901a\u5e38\u7248"}
      topicBox={room.topicBox ?? null}
      allowContinueAfterFail={!!room.options?.allowContinueAfterFail}
      roomName={displayRoomName}
      currentTopic={room.topic || null}
      onlineUids={onlineUids}
      playerCount={players.length}
      roundIds={clueTargetIds}
      presenceReady={presenceReady}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLeaveRoom={leaveRoom}
      pop={pop}
      hostClaimStatus={hostClaimStatus}
      phaseMessage={phaseMessage}
    />
  ) : undefined;

  const handAreaNode = (
    <SpectatorHUD
      controller={spectatorController}
      seatRequestTimedOut={seatRequestTimedOut}
      spectatorUpdateButton={spectatorUpdateButton}
      onRetryJoin={handleRetryJoin}
      onForceExit={handleForcedExitLeaveNow}
      isSpectatorMode={isSpectatorMode}
      isMember={isMember}
      showHand={showHand}
      handNode={handNode}
      host={{
        enabled: isHost,
        roomId,
        requests: spectatorHostRequests,
        loading: spectatorHostLoading,
        error: spectatorHostError,
        spectatorRecallEnabled,
        players: playersWithOptimistic,
        onApprove: handleSpectatorApprove,
        onReject: handleSpectatorReject,
        autoApprove: true,
      }}
    />
  );

  const joinStatusMessage =
    joinStatus === "retrying"
      ? "再接続を試行しています..."
      : joinStatus === "joining"
      ? "ルームへ再参加中です..."
      : null;

  const joinStatusBanner = joinStatusMessage ? (
    <Box
      position="fixed"
      top="12px"
      right="16px"
      zIndex={1200}
      padding="10px 14px"
      background="rgba(8, 12, 20, 0.82)"
      border="1px solid rgba(255,255,255,0.18)"
      color="rgba(255,255,255,0.9)"
      fontFamily="'Courier New', monospace"
      fontSize="13px"
      borderRadius="4px"
      boxShadow="0 4px 12px rgba(0,0,0,0.35)"
    >
      {joinStatusMessage}
    </Box>
  ) : null;
  // 更新告知の見える化: バージョン不一致だけでなく、SWが待機中でも表示
  const shouldShowUpdateBanner =
    safeUpdateFeatureEnabled && (hasWaitingUpdate || safeUpdateActive);
  const safeUpdateBannerNode = shouldShowUpdateBanner ? (
    <SafeUpdateBanner offsetTop={joinStatusMessage ? 60 : 12} />
  ) : null;
  const shouldBlockUpdateOverlay = false;
  const versionMismatchOverlay = null;

  
  if (!room) {
    return null;
  }

  return (
    <RoomView
      roomId={roomId}
      room={room}
      nodes={{
        header: headerNode,
        sidebar: sidebarNode,
        main: mainNode,
        handArea: handAreaNode,
      }}
      overlays={{
        joinStatusBanner,
        safeUpdateBannerNode,
        versionMismatchOverlay,
      }}
      dealRecoveryOpen={dealRecoveryOpen}
      onDealRecoveryDismiss={handleDealRecoveryDismiss}
      needName={needName}
      onSubmitName={handleSubmitName}
      simplePhase={{
        status: room.status || "waiting",
        canStartSorting,
        topic: room.topic || null,
      }}
      chat={{
        players: playersWithOptimistic,
        hostId: room.hostId ?? null,
        isFinished: room.status === "finished",
        onOpenLedger: () => setIsLedgerOpen(true),
      }}
      passwordDialog={{
        isOpen: passwordDialogOpen,
        roomName: stripMinimalTag(room.name),
        isLoading: passwordDialogLoading,
        error: passwordDialogError,
        onSubmit: handleRoomPasswordSubmit,
        onCancel: handleRoomPasswordCancel,
      }}
      settings={{
        isOpen: isSettingsOpen,
        onClose: () => setIsSettingsOpen(false),
        options: room.options ?? ({} as RoomDoc["options"]),
        isHost,
        roomStatus: room.status || "waiting",
      }}
      ledger={{
        isOpen: isLedgerOpen,
        onClose: () => setIsLedgerOpen(false),
        players: playersWithOptimistic,
        orderList: room.order?.list || [],
        topic: room.topic || null,
        failed: !!room.order?.failed,
        roomId,
        myId: meId,
        mvpVotes: room.mvpVotes ?? null,
      }}
      me={me}
      isSpectatorMode={isSpectatorMode}
      meHasPlacedCard={meHasPlacedCard}
    />
  );
}



export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;
  if (!roomId) {
    return <div>ルームIDが見つかりません</div>;
  }
  return <RoomPageContent roomId={roomId} />;
}
