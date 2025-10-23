"use client";

// 驥崎ｦ√さ繝ｳ繝昴・繝阪Φ繝・ Eager loading・亥・譛溯｡ｨ遉ｺ諤ｧ閭ｽ蜆ｪ蜈茨ｼ・
// import { Hud } from "@/components/Hud"; // 繝倥ャ繝繝ｼ蜑企勁: MiniHandDock縺ｫ邨ｱ蜷域ｸ医∩

// 譌ｧCluePanel縺ｯ譛ｪ菴ｿ逕ｨ・亥姐譁ｰ縺励◆荳ｭ螟ｮUI縺ｫ邨ｱ蜷域ｸ医∩・・
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import NameDialog from "@/components/NameDialog";
import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import { DebugMetricsHUD } from "@/components/ui/DebugMetricsHUD";
import { PixiGuideButtonsAuto } from "@/components/ui/pixi/PixiGuideButtons";
import SafeUpdateBanner from "@/components/ui/SafeUpdateBanner";
import dynamic from "next/dynamic";
// 笞｡ PERFORMANCE: React.lazy 縺ｧ驕・ｻｶ繝ｭ繝ｼ繝・
import { lazy, Suspense } from "react";
const SettingsModal = lazy(() => import("@/components/SettingsModal"));
import { AppButton } from "@/components/ui/AppButton";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import GameLayout from "@/components/ui/GameLayout";
import MiniHandDock from "@/components/ui/MiniHandDock";
import { notify } from "@/components/ui/notify";
import { SimplePhaseDisplay } from "@/components/ui/SimplePhaseDisplay";
import { useTransition } from "@/components/ui/TransitionProvider";
import UniversalMonitor from "@/components/UniversalMonitor";
import { useAuth } from "@/context/AuthContext";
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
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { useHostClaim } from "@/lib/hooks/useHostClaim";
import { useHostPruning } from "@/lib/hooks/useHostPruning";
import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { selectHostCandidate } from "@/lib/host/HostManager";
import { showtime } from "@/lib/showtime";
import { verifyPassword } from "@/lib/security/password";
import {
  assignNumberIfNeeded,
  getRoomServiceErrorCode,
  joinRoomFully,
} from "@/lib/services/roomService";
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { initMetricsExport } from "@/lib/utils/metricsExport";
import {
  applyServiceWorkerUpdate,
  getWaitingServiceWorker,
  subscribeToServiceWorkerUpdates,
} from "@/lib/serviceWorker/updateChannel";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Spinner, Text, Dialog, VStack, HStack } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { APP_VERSION } from "@/lib/constants/appVersion";

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

const MinimalChat = dynamic(() => import("@/components/ui/MinimalChat"), {
  ssr: false,
  loading: () => null,
});

const MvpLedger = dynamic(
  () => import("@/components/ui/MvpLedger").then((mod) => ({ default: mod.MvpLedger })),
  {
    ssr: false,
    loading: () => null,
  }
);

const RoomPasswordPrompt = dynamic(
  () =>
    import("@/components/RoomPasswordPrompt").then((mod) => ({
      default: mod.RoomPasswordPrompt,
    })),
  { ssr: false, loading: () => null }
);

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

function RoomPageContent({ roomId }: RoomPageContentProps) {
  const { user, displayName, setDisplayName, loading: authLoading } = useAuth();
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
  useAssetPreloader(ROOM_CORE_ASSETS);
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
      await ensureModules();
      if (disposed) return;
      if (soundManager) {
        void soundManager.warmup().catch(() => undefined);
      }
      if (gsapModule) {
        gsapModule.gsap.ticker.wake();
        gsapModule.gsap.ticker.tick();
      }
      if (pixiModule) {
        pixiModule.Ticker.shared.autoStart = true;
        pixiModule.Ticker.shared.start();
        pixiModule.Ticker.shared.update();
      }
      pumpFrames(3);
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

    const triggerPrefetch = () => {
      idleHandle = null;
      timeoutHandle = null;
      void runPrefetch();
    };

    if (typeof win.requestIdleCallback === "function") {
      idleHandle = win.requestIdleCallback(triggerPrefetch, { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(triggerPrefetch, 600);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        win.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);
  useEffect(() => {
    return subscribeToServiceWorkerUpdates((registration) => {
      setHasWaitingUpdate(!!registration);
    });
  }, []);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogLoading, setPasswordDialogLoading] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(
    null
  );
  const {
    room,
    players,
    onlineUids,
    presenceReady,
    onlinePlayers,
    loading,
    isHost,
    isMember,
    detachNow,
    leavingRef,
    joinStatus,
  } = useRoomState(
    roomId,
    uid,
    passwordVerified ? (displayName ?? null) : null
  );

  // 險ｭ螳壹Δ繝ｼ繝繝ｫ縺ｮ迥ｶ諷狗ｮ｡逅・
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 險倬鹸邁ｿ繝｢繝ｼ繝繝ｫ縺ｮ迥ｶ諷狗ｮ｡逅・
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [dealRecoveryDismissed, setDealRecoveryDismissed] = useState(false);
  const [dealRecoveryOpen, setDealRecoveryOpen] = useState(false);
  const dealRecoveryTimerRef = useRef<number | null>(null);
  const isGameFinished = room?.status === "finished";
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
  const meId = uid || "";
  const me = players.find((p) => p.id === meId);
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
  const versionMismatchHandledRef = useRef(false);
  const safeUpdateEnteredRef = useRef(false);
  const safeUpdateStatusRef = useRef<string | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastInteractionTsRef = useRef<number>(
    typeof window === "undefined" ? 0 : Date.now()
  );
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
  const tryApplyServiceWorker = useCallback(
    (reason: SafeUpdateTrigger) => {
      if (!safeUpdateFeatureEnabled) return false;
      const registration = getWaitingServiceWorker();
      const waitingWorker = registration?.waiting;
      if (!registration || !waitingWorker) {
        return false;
      }
      const applied = applyServiceWorkerUpdate({
        reason,
        safeMode: safeUpdateActive,
      });
      if (!applied) {
        try {
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        } catch {
          /* no-op */
        }
      }
      return applied;
    },
    [safeUpdateFeatureEnabled, safeUpdateActive]
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

  // 笞｡ PERFORMANCE: room蜈ｨ菴薙〒縺ｯ縺ｪ縺丞ｿ・ｦ√↑繝励Ο繝代ユ繧｣縺縺醍屮隕・
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

  // 驟榊ｸ・ｼ泌・: 謨ｰ蟄励′譚･縺溽椪髢薙↓霆ｽ縺上・繝・・・・iamondNumberCard逕ｨ・・
  const [pop, setPop] = useState(false);
  const [redirectGuard, setRedirectGuard] = useState(true);
  const [forcedExitReason, setForcedExitReason] = useState<
    "game-in-progress" | "version-mismatch" | null
  >(null);
  // hostClaimAttemptRef, hostClaimTimerRef 縺ｯ useHostClaim 蜀・↓遘ｻ蜍・
  // pruneRef, offlineSinceRef 縺ｯ useHostPruning 蜀・↓遘ｻ蜍・
  const forcedExitScheduledRef = useRef(false); // 莉悶・蝣ｴ謇縺ｧ繧ゆｽｿ繧上ｌ縺ｦ縺・ｋ縺溘ａ谿九☆
  const forcedExitRecoveryPendingRef = useRef(false);
  const rejoinSessionKey = useMemo(
    () => (uid ? `pendingRejoin:${roomId}` : null),
    [uid, roomId]
  );
  const setPendingRejoinFlag = useCallback(() => {
    if (!uid || !rejoinSessionKey) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(rejoinSessionKey, uid);
    } catch (error) {
      logDebug("room-page", "session-storage-write-failed", error);
    }
  }, [rejoinSessionKey, uid]);

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
    setPendingRejoinFlag();
    setForcedExitReason("version-mismatch");
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
    setPendingRejoinFlag,
    setForcedExitReason,
    forcedExitReason,
    leavingRef,
  ]);

  const executeForcedExit = useCallback(async () => {
    if (!uid) return;

    forcedExitRecoveryPendingRef.current = false;
    setPendingRejoinFlag();

    if (!leavingRef.current) {
      leavingRef.current = true;
    }

    const performExit = async () => {
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
              { id: "exit", message: "ロビーへ戻ります...", duration: 1200 },
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
    setPendingRejoinFlag,
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
  // 蜷榊燕譛ｪ險ｭ螳壽凾縺ｯ繝繧､繧｢繝ｭ繧ｰ繧定｡ｨ遉ｺ縲Ｂuto-join縺ｯuseRoomState蛛ｴ縺ｧ謚第ｭ｢貂医∩
  const needName = !displayName || !String(displayName).trim();
  // 笞｡ PERFORMANCE: useCallback縺ｧ繝｡繝｢蛹悶＠縺ｦ荳崎ｦ√↑髢｢謨ｰ蜀咲函謌舌ｒ髦ｲ豁｢
  const handleSubmitName = useCallback(async (name: string) => {
    setDisplayName(name);
  }, [setDisplayName]);

  // 繝ｩ繧ｦ繝ｳ繝牙ｯｾ雎｡縺ｯ荳企Κ縺ｧ險育ｮ玲ｸ医∩・・ligibleIds・・

  // 蜈･螳､繧ｬ繝ｼ繝・ 閾ｪ蛻・′繝｡繝ｳ繝舌・縺ｧ縺ｪ縺・ｴ蜷医∝ｾ・ｩ滉ｸｭ莉･螟悶・驛ｨ螻九↓縺ｯ蜈･繧後↑縺・
  // 縺溘□縺励√・繧ｹ繝医・蟶ｸ縺ｫ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ
  const canAccess = (isMember || isHost) && !versionMismatchBlocksAccess;
  const isSpectatorMode =
    !canAccess ||
    versionMismatchBlocksAccess ||
    !!forcedExitReason;

  // 観戦理由の判定（文言出し分け用）
  const spectatorReason: "version-mismatch" | "mid-game" | "waiting" | null = (() => {
    if (versionMismatchBlocksAccess || forcedExitReason === "version-mismatch") {
      return "version-mismatch";
    }
    if (!canAccess) {
      if (room?.status === "waiting") {
        return "waiting";
      }
      return "mid-game";
    }
    if (forcedExitReason) {
      return "mid-game";
    }
    return null;
  })();
  // 笞｡ PERFORMANCE: 37陦後・蠑ｷ蛻ｶ騾蜃ｺ蜃ｦ逅・ｒ繧ｫ繧ｹ繧ｿ繝繝輔ャ繧ｯ蛹・
  useForcedExit({
    uid,
    roomStatus: room?.status,
    canAccess,
    loading,
    authLoading,
    rejoinSessionKey,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    detachNow,
    setPendingRejoinFlag,
    setForcedExitReason,
    roomId,
    displayName,
  });

  const handleForcedExitLeaveNow = useCallback(() => {
    void executeForcedExit();
  }, [executeForcedExit]);

  const handleRetryJoin = useCallback(async () => {
    if (!uid) return;
    if (versionMismatchBlocksAccess) {
      try {
        notify({
          title: "最新バージョンに更新してください",
          description: "ページを更新してから再参加してください",
          type: "warning",
        });
      } catch (notifyError) {
        logDebug("room-page", "notify-version-mismatch-retry", notifyError);
      }
      return;
    }

    setPendingRejoinFlag();

    try {
      await joinRoomFully({
        roomId,
        uid,
        displayName: displayName ?? null,
        notifyChat: false,
      });

      forcedExitScheduledRef.current = false;
      forcedExitRecoveryPendingRef.current = false;
      setForcedExitReason(null);

      try {
        notify({
          title: "\u5e2d\u3092\u53d6\u308a\u76f4\u3057\u307e\u3057\u305f",
          description: "\u307f\u3093\u306a\u306e\u30ab\u30fc\u30c9\u304c\u914d\u308a\u76f4\u3055\u308c\u308b\u307e\u3067\u5f85\u3061\u307e\u3057\u3087\u3046",
          type: "success",
        });
      } catch (notifyError) {
        logDebug("room-page", "notify-force-exit-retry-success", notifyError);
      }
    } catch (error) {
      forcedExitRecoveryPendingRef.current = true;
      const code = getRoomServiceErrorCode(error);
      const isInProgress = code === "ROOM_IN_PROGRESS";

      if (!isInProgress) {
        logError("room-page", "forced-exit-retry-join", error);
      }

      const fallbackDescription =
        code && error instanceof Error && error.message
          ? error.message
          : "\u5c11\u3057\u6642\u9593\u3092\u304a\u3044\u3066\u304b\u3089\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044";

      try {
        notify({
          title: isInProgress
            ? "\u307e\u3060\u30b2\u30fc\u30e0\u304c\u9032\u884c\u4e2d\u3067\u3059"
            : "再参加に失敗しました",
          description: isInProgress
            ? "\u30db\u30b9\u30c8\u304c\u30ea\u30bb\u30c3\u30c8\u3057\u305f\u3089\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044"
            : fallbackDescription,
          type: isInProgress ? "info" : "error",
        });
      } catch (notifyError) {
        logDebug("room-page", "notify-force-exit-retry-failed", notifyError);
      }
    }
  }, [uid, roomId, displayName, setPendingRejoinFlag, versionMismatchBlocksAccess]);

  useEffect(() => {
    if (!forcedExitReason) return;
    if (!canAccess && room?.status !== "waiting") return;

    forcedExitScheduledRef.current = false;
    setForcedExitReason(null);

    if (room?.status === "waiting" && forcedExitRecoveryPendingRef.current) {
      forcedExitRecoveryPendingRef.current = false;
      setPendingRejoinFlag();
      if (uid) {
        void joinRoomFully({
          roomId,
          uid,
          displayName: displayName ?? null,
          notifyChat: false,
        }).catch((error) => {
          logDebug("room-page", "forced-exit-auto-rejoin", error);
        });
      }
    } else {
      forcedExitRecoveryPendingRef.current = false;
    }
  }, [
    forcedExitReason,
    canAccess,
    room?.status,
    setPendingRejoinFlag,
    uid,
    roomId,
    displayName,
  ]);

  // 笞｡ PERFORMANCE: 88陦後・蟾ｨ螟ｧuseEffect繧偵き繧ｹ繧ｿ繝繝輔ャ繧ｯ蛹・
  // 蜑阪・繝帙せ繝医′縺ｾ縺繝｡繝ｳ繝舌・縺九←縺・°繧定ｨ育ｮ・
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

  useHostClaim({
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

  // 謨ｰ蟄鈴・蟶・ｾ鯉ｼ医∪縺溘・playing縺ｧ譛ｪ蜑ｲ蠖薙・蝣ｴ蜷茨ｼ峨∬・蛻・・逡ｪ蜿ｷ繧貞牡蠖難ｼ域ｱｺ螳夂噪・・
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

  // 貅門ｙ螳御ｺ・ｼ・eady・峨・繝ｩ繧ｦ繝ｳ繝牙盾蜉閠・ｼ・eal.players・峨ｒ蟇ｾ雎｡縺ｫ蛻､螳・
  const allCluesReady = useMemo(() => {
    const dealPlayers = room?.deal?.players;
    const ids = Array.isArray(dealPlayers)
      ? dealPlayers
      : players.map((p) => p.id);
    const idSet = new Set(ids);
    const targets = players.filter((p) => idSet.has(p.id));
    return targets.length > 0 && targets.every((p) => p.ready === true);
  }, [players, room?.deal?.players]);

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
      const isFreshReveal =
        revealedMs === null || revealedMs !== lastRevealTsRef.current;
      const shouldPlay =
        (status === "reveal" && isFreshReveal) ||
        (status === "finished" && prev === "reveal");
      if (shouldPlay) {
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

  // canStartSorting 縺ｯ eligibleIds 螳夂ｾｩ蠕後↓遘ｻ蜍・

  // playing 繝輔ぉ繝ｼ繧ｺ蟒・ｭ｢縺ｫ縺､縺・canStartPlaying 繝ｭ繧ｸ繝・け縺ｯ蜑企勁

  // 繝ｩ繧ｦ繝ｳ繝峨′騾ｲ繧薙□繧芽・蛻・・ready繧偵Μ繧ｻ繝・ヨ
  const [seenRound, setSeenRound] = useState<number>(0);
  // 笞｡ PERFORMANCE: room蜈ｨ菴薙〒縺ｯ縺ｪ縺俊oom.round縺縺醍屮隕悶＠縺ｦ辟｡鬧・↑蜀榊ｮ溯｡後ｒ髦ｲ豁｢
  useEffect(() => {
    if (!uid) return;
    const r = room?.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db!, "rooms", roomId, "players", uid);
      updateDoc(meRef, { ready: false }).catch(() => void 0);
    }
  }, [room?.round, uid, roomId, seenRound]);

  // 繝帙せ繝亥髄縺代ヨ繝ｼ繧ｹ繝・ 騾｣諠ｳ繝ｯ繝ｼ繝牙ｮ御ｺ・夂衍・医Δ繝ｼ繝峨＃縺ｨ縺ｫ繝｡繝・そ繝ｼ繧ｸ蟾ｮ縺玲崛縺医・荳蠎ｦ縺縺托ｼ・
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
    // sequential: すぐ出し始められる
    // sort-submit: 並べてホストが『せーので判定』ボタンを押し通れを促す
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

  // 笞｡ PERFORMANCE: room蜈ｨ菴薙〒縺ｯ縺ｪ縺俊oom.status縺縺醍屮隕・
  // waiting縺ｫ謌ｻ縺｣縺溘ｉ閾ｪ蛻・・繝輔ぅ繝ｼ繝ｫ繝峨ｒ蛻晄悄蛹・
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

  // 笞｡ PERFORMANCE: 80陦後・繝帙せ繝医・繝ｫ繝ｼ繝九Φ繧ｰ蜃ｦ逅・ｒ繧ｫ繧ｹ繧ｿ繝繝輔ャ繧ｯ蛹・
  useHostPruning({
    isHost,
    uid,
    user,
    roomId,
    players,
    onlineUids,
    presenceReady,
  });

  // 陦ｨ遉ｺ蜷阪′螟峨ｏ縺｣縺溘ｉ縲∝・螳､荳ｭ縺ｮ閾ｪ蛻・・繝励Ξ繧､繝､繝ｼDoc縺ｫ繧ょ渚譏
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
      try {
        if (rejoinSessionKey && typeof window !== "undefined") {
          window.sessionStorage.removeItem(rejoinSessionKey);
        }
      } catch (error) {
        logDebug("room-page", "clear-session-storage-failed", error);
      }
    };

    const performLeave = async (token: string | null) => {
      // 噫 OPTIMIZED: 荳ｦ蛻怜・逅・〒繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・繧帝ｫ倬溷喧
      try {
        // 1. 繝ｪ繧ｹ繝翫・隗｣髯､繧剃ｸｦ蛻怜ｮ溯｡鯉ｼ・romise.all縺ｧ鬮倬溷喧・・
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

      // 2. API蜻ｼ縺ｳ蜃ｺ縺暦ｼ医ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ莉倥″・・
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

      // 3. 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・PI螟ｱ謨玲凾・・
      if (!viaApi) {
        try {
          await leaveRoomAction(roomId, uid, displayName);
        } catch (error) {
          logError("room-page", "leave-room-action", error);
        }
      }

      // 4. 繧ｻ繝・す繝ｧ繝ｳ繝輔Λ繧ｰ繧ｯ繝ｪ繧｢
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
              { id: "leave", message: "ロビーへ戻ります...", duration: 600 }, // 1200ms → 600ms に短縮
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
    rejoinSessionKey,
    roomId,
    detachNow,
    displayName,
    transition,
    router,
  ]);

  // 騾蜃ｺ譎ょ・逅・ｒ繝輔ャ繧ｯ縺ｧ荳蜈・喧
  useLeaveCleanup({
    enabled: true,
    roomId,
    uid,
    displayName,
    detachNow,
    leavingRef,
    user,
  });

  // isMember 縺ｯ荳翫〒邂怜・貂医∩

  // 繝ｩ繧ｦ繝ｳ繝牙ｯｾ雎｡・郁｡ｨ遉ｺ縺ｮ螳牙ｮ壽ｧ驥崎ｦ厄ｼ・
  // presence縺ｮ荳譎ら噪縺ｪ謠ｺ繧後〒繧ｹ繝ｭ繝・ヨ/蠕・ｩ溘き繝ｼ繝画焚縺梧ｸ帙ｉ縺ｪ縺・ｈ縺・・
  // 蝓ｺ譛ｬ縺ｯ繝ｩ繧ｦ繝ｳ繝峨Γ繝ｳ繝舌・・・eal.players 竏ｪ players・峨ｒ蜈･螳､鬆・〒繧ｽ繝ｼ繝医＠縺ｦ謗｡逕ｨ縺吶ｋ縲・
  const unsortedBaseIds = useMemo(() => {
    const dealPlayers = room?.deal?.players;
    if (Array.isArray(dealPlayers)) {
      const combined = new Set<string>([
        ...dealPlayers,
        ...players.map((p) => p.id),
      ]);
      return Array.from(combined);
    }
    return players.map((p) => p.id);
  }, [room?.deal?.players, players]);

  // 蜈･螳､鬆・〒繧ｽ繝ｼ繝茨ｼ井ｸ雋ｫ縺励◆荳ｦ縺ｳ鬆・ｒ菫晄戟・・
  const baseIds = useMemo(
    () => sortPlayersByJoinOrder(unsortedBaseIds, players),
    [unsortedBaseIds, players]
  );

  // 繝帙せ繝医ｒ譛蜆ｪ蜈茨ｼ亥ｷｦ遶ｯ・峨↓驟咲ｽｮ縺吶ｋ縺溘ａ縺ｮ繧ｽ繝ｼ繝・
  const hostId = room?.hostId ?? null;
  const eligibleIds = useMemo(() => {
    if (!hostId) {
      return baseIds;
    }
    return [hostId, ...baseIds.filter((id) => id !== hostId)];
  }, [hostId, baseIds]);

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

  // 笞｡ PERFORMANCE: slotCount險育ｮ励ｒuseMemo蛹・
  const slotCount = useMemo(() => {
    if (!room || !room.status) return 0;
    if (room.status === "reveal" || room.status === "finished") {
      return (room.order?.list || []).length;
    }
    const dealPlayers = Array.isArray(room?.deal?.players)
      ? (room.deal?.players ?? [])
      : [];
    const proposalList = Array.isArray(room?.order?.proposal)
      ? (room.order?.proposal ?? [])
      : [];
    const dealLen = dealPlayers.length;
    const propLen = proposalList.length;
    return Math.max(dealLen, propLen, eligibleIds.length);
  }, [
    room?.status,
    room?.order?.list,
    room?.deal?.players,
    room?.order?.proposal,
    eligibleIds.length,
  ]);

  // 荳ｦ縺ｳ譖ｿ縺医ヵ繧ｧ繝ｼ繧ｺ縺ｮ蛻､螳夲ｼ・entralCardBoard縺ｨ蜷後§繝ｭ繧ｸ繝・け・・
  const canStartSorting = useMemo(() => {
    const resolveMode = room?.options?.resolveMode;
    const roomStatus = room?.status;

    if (resolveMode !== "sort-submit" || roomStatus !== "clue") {
      return false;
    }

    const playerMap = new Map(players.map((p) => [p.id, p]));
    const placedIds = new Set(room?.order?.proposal ?? []);
    let waitingCount = 0;

    for (const id of eligibleIds) {
      const candidate = playerMap.get(id);
      if (candidate && !placedIds.has(candidate.id)) {
        waitingCount += 1;
      }
    }

    return waitingCount === 0;
  }, [
    room?.options?.resolveMode,
    room?.status,
    players,
    eligibleIds,
    room?.order?.proposal,
  ]);

  const orderList = room?.order?.list;
  const submittedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const proposal = room?.order?.proposal;

    if (Array.isArray(proposal)) {
      proposal.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) {
          ids.add(pid);
        }
      });
    }

    if (Array.isArray(orderList)) {
      orderList.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) {
          ids.add(pid);
        }
      });
    }

    return Array.from(ids);
  }, [room?.order?.proposal, orderList]);

  const meHasPlacedCard = submittedPlayerIds.includes(meId);

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

  // 陦ｨ遉ｺ逕ｨ驛ｨ螻句錐・・閾ｪ蛻・・謇区惆]繧帝勁蜴ｻ・・
  const displayRoomName = stripMinimalTag(room?.name) || "";
  const waitingToRejoin = room?.status === "waiting";

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
              { id: "return", message: "ロビーへ戻ります...", duration: 1000 },
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
  // 騾比ｸｭ蜿ょ刈OK縺ｮ縺溘ａ縲√ヶ繝ｭ繝・け逕ｻ髱｢縺ｯ陦ｨ遉ｺ縺励↑縺・

  // 譁ｰ縺励＞GameLayout繧剃ｽｿ逕ｨ縺励◆莠域ｸｬ蜿ｯ閭ｽ縺ｪ讒矩
  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined; // 繝倥ャ繝繝ｼ蜑企勁: MiniHandDock縺ｫ讖溯・邨ｱ蜷域ｸ医∩

  // 蟾ｦ繝ｬ繝ｼ繝ｫ・壹↑縺九∪・医が繝ｳ繝ｩ繧､繝ｳ陦ｨ遉ｺ・・
  const sidebarNode = (
    <DragonQuestParty
      players={players}
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
          // DPI150縺ｧ縺ｯ繧｢繝翫え繝ｳ繧ｹ蟶ｯ縺ｮ鬮倥＆繧偵＆繧峨↓謚代∴繧具ｼ磯㍾縺ｪ繧雁屓驕ｿ・狗乢髱｢遒ｺ菫晢ｼ・
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={players} />
      </Box>
      {/* 繝峨ャ繝郁｡後′隕ｪ縺ｧ繧ｯ繝ｪ繝・・縺輔ｌ縺ｪ縺・ｈ縺・↓: visible + minH=0 */}
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
          players={players}
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
        />
      </Box>
    </Box>
  );

  const spectatorNotice = isSpectatorMode ? (
    <Box
      position="relative"
      border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
      borderRadius={0}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      bg={UI_TOKENS.GRADIENTS.dqPanel}
      color={UI_TOKENS.COLORS.textBase}
      px={{ base: 5, md: 6 }}
      py={{ base: 5, md: 5 }}
      display="flex"
      flexDirection="column"
      gap={3}
      maxW={{ base: "100%", md: "520px" }}
      mx="auto"
      _before={{
        content: '""',
        position: "absolute",
        inset: "8px",
        border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
        pointerEvents: "none",
      }}
    >
      <Box display="flex" flexDir="column" gap={3} alignItems="center">
        <Text
          fontSize={{ base: "sm", md: "md" }}
          fontWeight={800}
          letterSpacing="0.2em"
          textTransform="uppercase"
          fontFamily="monospace"
        >
          ▼ 観戦中 ▼
        </Text>
        <Box textAlign="center">
          {spectatorReason === "version-mismatch" ? (
            <>
              <Text
                fontSize={{ base: "md", md: "lg" }}
                fontWeight={700}
                textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              >
                アップデートがあります。アップデートしてください！
              </Text>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
                lineHeight={1.7}
                mt={1}
              >
                下の「今すぐ更新」ボタンを押してページを更新してください。
              </Text>
            </>
          ) : spectatorReason === "waiting" ? (
            <>
              <Text
                fontSize={{ base: "md", md: "lg" }}
                fontWeight={700}
                textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              >
                ホストが再開準備中だよ
              </Text>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
                lineHeight={1.7}
                mt={1}
              >
                少し待つか「席に戻れるか試す」を押して席へ戻ろう！
              </Text>
            </>
          ) : (
            <>
              <Text
                fontSize={{ base: "md", md: "lg" }}
                fontWeight={700}
                textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              >
                いまゲームの最中だよ
              </Text>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
                lineHeight={1.7}
                mt={1}
              >
                このラウンドが終わったら参加できるよ。まずは観戦しよう！
              </Text>
            </>
          )}
        </Box>
      </Box>
      <Box
        display="flex"
        flexDir={{ base: "column", md: "row" }}
        gap={3}
        justifyContent="center"
      >
        {spectatorReason === "version-mismatch" ? (
          <>
            <AppButton
              palette="brand"
              size="md"
              onClick={() => {
                try {
                  window.location.reload();
                } catch {
                  // ignore
                }
              }}
            >
              今すぐ更新
            </AppButton>
            <AppButton
              palette="gray"
              visual="outline"
              size="md"
              onClick={handleRetryJoin}
              disabled={!waitingToRejoin || versionMismatchBlocksAccess}
            >
              席に戻れるか試す
            </AppButton>
            <AppButton palette="gray" size="md" onClick={handleForcedExitLeaveNow}>
              ロビーへ戻る
            </AppButton>
          </>
        ) : (
          <>
            <AppButton
              palette="gray"
              visual="outline"
              size="md"
              onClick={handleRetryJoin}
              disabled={!waitingToRejoin || versionMismatchBlocksAccess}
            >
              席に戻れるか試す
            </AppButton>
            <AppButton palette="brand" size="md" onClick={handleForcedExitLeaveNow}>
              ロビーへ戻る
            </AppButton>
          </>
        )}
      </Box>
    </Box>
  ) : null;

  const handAreaNode = (
    <Box display="flex" flexDirection="column" gap={spectatorNotice ? 4 : 0}>
      {spectatorNotice}
      {me ? (
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
          roundIds={players.map((p) => p.id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLeaveRoom={leaveRoom}
          pop={pop}
        />
      ) : spectatorNotice ? null : (
        <Box h="1px" />
      )}
    </Box>
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
  const safeUpdateBannerNode =
    safeUpdateActive && safeUpdateFeatureEnabled ? (
      <SafeUpdateBanner offsetTop={joinStatusMessage ? 60 : 12} />
    ) : null;

  return (
    <>
      {joinStatusBanner}
      {safeUpdateBannerNode}
      {/* 蜿ｳ荳翫ヨ繝ｼ繧ｹ繝磯夂衍縺ｮ雉ｼ隱ｭ・医メ繝｣繝・ヨ縺ｨ迢ｬ遶具ｼ・*/}
      <RoomNotifyBridge roomId={roomId} />
      <GameLayout
        variant="immersive"
        header={headerNode}
        sidebar={sidebarNode}
        main={mainNode}
        handArea={handAreaNode}
      />

      <Dialog.Root
        open={dealRecoveryOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleDealRecoveryDismiss();
          }
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={9999}
        >
          <Dialog.Content
            css={{
              background: UI_TOKENS.COLORS.panelBg,
              border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              borderRadius: 0,
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
              maxWidth: "480px",
              width: "90vw",
            }}
          >
            <Box
              p={5}
              css={{
                borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
              }}
            >
              <Dialog.Title>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color="white"
                  fontFamily="monospace"
                >
                  あれれ？カードが配れていないよ！
                </Text>
              </Dialog.Title>
            </Box>
            <Dialog.Body p={6}>
              <VStack align="stretch" gap={4}>
                <Text
                  color={UI_TOKENS.COLORS.whiteAlpha90}
                  fontSize="md"
                  fontFamily="monospace"
                  lineHeight={1.7}
                >
                  前のホストが急にいなくなっちゃったから、数字の配布が途中で止まってしまったんだ。
                  右下の「リセット」を押して最初に戻してから、もう一度「ゲーム開始」してね！
                </Text>
                <Text
                  color={UI_TOKENS.COLORS.whiteAlpha80}
                >
                  リセットすれば、ちゃんとカードが配り直されるから安心してね！
                </Text>
                <HStack justify="flex-end" pt={2}>
                  <AppButton palette="brand" size="md" onClick={handleDealRecoveryDismiss}>
                    わかった！
                  </AppButton>
                </HStack>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* 蜷榊燕蜈･蜉帙Δ繝ｼ繝繝ｫ縲ゅく繝｣繝ｳ繧ｻ繝ｫ縺ｯ荳榊庄・磯哩縺倥※繧ょ・蠎ｦ髢九￥・・*/}
      <NameDialog
        isOpen={needName}
        defaultValue=""
        onCancel={() => {
          /* keep open until set */
        }}
        onSubmit={handleSubmitName}
        submitting={false}
        mode="create"
      />

      {/* 繧ｷ繝ｳ繝励Ν騾ｲ陦檎憾豕∬｡ｨ遉ｺ・井ｸｭ螟ｮ荳奇ｼ・*/}
      <SimplePhaseDisplay
        roomStatus={room?.status || "waiting"}
        canStartSorting={canStartSorting}
        topicText={room?.topic || null}
      />

      {/* 繝√Ε繝・ヨ縺ｯ繝医げ繝ｫ蠑擾ｼ・AB縺ｧ髢矩哩・・*/}
      <MinimalChat
        roomId={roomId}
        players={players}
        hostId={room?.hostId ?? null}
        onOpenLedger={() => setIsLedgerOpen(true)}
        isGameFinished={room?.status === "finished"}
      />

      <RoomPasswordPrompt
        isOpen={passwordDialogOpen}
        roomName={room ? stripMinimalTag(room.name) : undefined}
        isLoading={passwordDialogLoading}
        error={passwordDialogError}
        onSubmit={handleRoomPasswordSubmit}
        onCancel={handleRoomPasswordCancel}
      />

      {/* 繝帙せ繝域桃菴懊・繝輔ャ繧ｿ繝ｼ縺ｮ蜷御ｸ陦後↓邨ｱ蜷域ｸ医∩・医Δ繝・け貅匁侠・・*/}

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          roomId={roomId}
          currentOptions={room.options || {}}
          isHost={isHost}
          roomStatus={room.status}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MvpLedger
          isOpen={isLedgerOpen}
          onClose={() => setIsLedgerOpen(false)}
          players={players}
          orderList={room.order?.list || []}
          topic={room.topic || null}
          failed={!!room.order?.failed}
          roomId={roomId}
          myId={meId}
          mvpVotes={room.mvpVotes ?? null}
        />
      </Suspense>

      <DebugMetricsHUD />

      {/* 🎮 Pure PixiJS版ガイドボタン */}
      <PixiGuideButtonsAuto
        currentPhase={room?.status}
        me={me}
        disabled={isSpectatorMode}
        hasPlacedCard={meHasPlacedCard}
      />
    </>
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
