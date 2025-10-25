"use client";

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import NameDialog from "@/components/NameDialog";
import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import { DebugMetricsHUD } from "@/components/ui/DebugMetricsHUD";
import { PixiGuideButtonsAuto } from "@/components/ui/pixi/PixiGuideButtons";
import SafeUpdateBanner from "@/components/ui/SafeUpdateBanner";
import dynamic from "next/dynamic";

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
import {
  areAllCluesReady,
  getClueTargetIds,
  getPresenceEligibleIds,
} from "@/lib/game/selectors";
import { requestSeat, SeatRequestSource } from "@/lib/game/service";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
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
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { initMetricsExport } from "@/lib/utils/metricsExport";
import { traceAction, traceError } from "@/lib/utils/trace";
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
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
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


  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const {
    isUpdateReady: spectatorUpdateReady,
    isApplying: spectatorUpdateApplying,
    applyUpdate: applySpectatorUpdate,
  } = useServiceWorkerUpdate();
  const meId = uid || "";
  const me = players.find((p) => p.id === meId);
  const playersSignature = useMemo(
    () => players.map((p) => p.id).join(","),
    [players]
  );
  const dealPlayers = useMemo(() => {
    const list = room?.deal?.players;
    if (!Array.isArray(list)) {
      return [] as string[];
    }
    return list.filter((id): id is string => typeof id === "string");
  }, [room?.deal]);
  const dealPlayersSignature = useMemo(
    () => (dealPlayers.length > 0 ? dealPlayers.join(",") : ""),
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
    joinStatus: typeof joinStatus;
    playersSignature: string;
    waitingToRejoin: boolean;
  } | null>(null);
  const spectatorAutoRetryStateRef = useRef<{
    lastAttemptTs: number;
    statusKey: string | null;
  }>({ lastAttemptTs: 0, statusKey: null });
  const recallV2Enabled = process.env.NEXT_PUBLIC_RECALL_V2 === "1";
  const [seatRequestState, setSeatRequestState] = useState<{
    status: "idle" | "pending" | "accepted" | "rejected";
    source: SeatRequestSource | null;
    requestedAt: number | null;
    error?: string | null;
  }>({ status: "idle", source: null, requestedAt: null, error: null });
  const [seatRequestTimedOut, setSeatRequestTimedOut] = useState(false);
  const seatRequestSignalsRef = useRef({
    accepted: false,
    rejected: false,
    timeout: false,
  });
  const recallJoinHandledRef = useRef(false);
  const assignNumberRetrySignatureRef = useRef<string | null>(null);


  const forcedExitScheduledRef = useRef(false);
  const forcedExitRecoveryPendingRef = useRef(false);
  const rejoinSessionKey = useMemo(
    () => (uid ? `pendingRejoin:${roomId}` : null),
    [uid, roomId]
  );
  const setPendingRejoinFlag = useCallback(
    (source: SeatRequestSource = "manual") => {
      if (!uid) return;
      if (recallV2Enabled) {
        setSeatRequestState({
          status: "pending",
          source,
          requestedAt: Date.now(),
          error: null,
        });
        setSeatRequestTimedOut(false);
        leavingRef.current = true;
        void requestSeat(roomId, uid, displayName ?? null, source).catch(
          (error) => {
            traceError("spectator.requestSeat.client", error, {
              roomId,
              uid,
              source,
            });
            setSeatRequestState({
              status: "idle",
              source: null,
              requestedAt: null,
              error: error instanceof Error ? error.message : String(error),
            });
            leavingRef.current = false;
          }
        );
        return;
      }
      if (!rejoinSessionKey) return;
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage.setItem(rejoinSessionKey, uid);
      } catch (error) {
        logDebug("room-page", "session-storage-write-failed", error);
      }
    },
    [
      uid,
      recallV2Enabled,
      roomId,
      displayName,
      rejoinSessionKey,
      leavingRef,
    ]
  );

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
    setPendingRejoinFlag("auto");
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
    setPendingRejoinFlag("auto");

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

  const needName = !displayName || !String(displayName).trim();

  const handleSubmitName = useCallback(async (name: string) => {
    setDisplayName(name);
  }, [setDisplayName]);





  const joinInProgress = joinStatus === "joining" || joinStatus === "retrying";
  const spectatorEligibilityReady = forcedExitReason
    ? true
    : !joinInProgress && presenceReady && !loading;
  const canAccess = (isMember || isHost) && !versionMismatchBlocksAccess;
  const shouldShowSpectator =
    !canAccess || versionMismatchBlocksAccess || !!forcedExitReason;
  const isSpectatorMode = spectatorEligibilityReady && shouldShowSpectator;

  // 観戦理由の判定（文言出し分け用）
  const rawSpectatorReason: "version-mismatch" | "mid-game" | "waiting" | null = (() => {
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
  const spectatorReason = isSpectatorMode ? rawSpectatorReason : null;
  const waitingToRejoin = room?.status === "waiting";
  const seatRequestPending = recallV2Enabled && seatRequestState.status === "pending";
  const seatRequestAccepted = recallV2Enabled && seatRequestState.status === "accepted";
  const seatRequestRejected = recallV2Enabled && seatRequestState.status === "rejected";
  const seatRequestError = recallV2Enabled ? seatRequestState.error : null;
  const seatRequestButtonDisabled = recallV2Enabled
    ? seatRequestPending || !waitingToRejoin || versionMismatchBlocksAccess
    : !waitingToRejoin || versionMismatchBlocksAccess;

  useEffect(() => {
    const nextState = {
      roomStatus: room?.status ?? null,
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
    setPendingRejoinFlag: () => setPendingRejoinFlag("auto"),
    setForcedExitReason,
    roomId,
    displayName,
  });

  const handleForcedExitLeaveNow = useCallback(() => {
    void executeForcedExit();
  }, [executeForcedExit]);

  const performSeatRecovery = useCallback(
    async ({
      silent,
      source,
    }: {
      silent: boolean;
      source: SeatRequestSource;
    }) => {
      if (!uid) return false;

      if (recallV2Enabled) {
        if (versionMismatchBlocksAccess) {
          if (!silent) {
            try {
              notify({
                title: "最新バージョンへ更新してください",
                description: "ページを更新してから再度お試しください",
                type: "warning",
              });
            } catch (notifyError) {
              logDebug("room-page", "notify-version-mismatch-retry", notifyError);
            }
          } else {
            logDebug("room-page", "auto-seat-recovery-blocked-version-mismatch", {
              roomId,
              uid,
            });
          }
          return false;
        }
        setPendingRejoinFlag(source);
        if (!silent) {
          try {
            notify({
              title: "席への復帰を申請しました",
              description: "ホストの準備ができ次第、自動で席に戻ります",
              type: "info",
            });
          } catch (notifyError) {
            logDebug("room-page", "notify-seat-request", notifyError);
          }
        } else {
          logDebug("room-page", "auto-seat-request-issued", {
            roomId,
            uid,
            source,
          });
        }
        return true;
      }
      if (leavingRef.current) {
        if (room?.status === "waiting") {
          leavingRef.current = false;
        } else {
          if (!silent) {
            logDebug("room-page", "seat-recovery-blocked-leaving", {
              roomId,
              uid,
            });
          }
          return false;
        }
      }
      if (versionMismatchBlocksAccess) {
        if (!silent) {
          try {
            notify({
              title: "最新バージョンに更新してください",
              description: "ページを更新してから再参加してください",
              type: "warning",
            });
          } catch (notifyError) {
            logDebug("room-page", "notify-version-mismatch-retry", notifyError);
          }
        } else {
          logDebug("room-page", "auto-seat-recovery-blocked-version-mismatch", {
            roomId,
            uid,
          });
        }
        return false;
      }

      setPendingRejoinFlag(source);

      try {
        const normalizedDisplayName =
          typeof displayName === "string" && displayName.trim().length > 0
            ? displayName.trim()
            : null;
        await joinRoomFully({
          roomId,
          uid,
          displayName: normalizedDisplayName,
          notifyChat: false,
        });

        forcedExitScheduledRef.current = false;
        forcedExitRecoveryPendingRef.current = false;
        setForcedExitReason(null);

        if (silent) {
          logDebug("room-page", "auto-seat-recovery-success", { roomId, uid });
        } else {
          try {
            notify({
              title: "\u5e2d\u3092\u53d6\u308a\u76f4\u3057\u307e\u3057\u305f",
              description: "\u307f\u3093\u306a\u306e\u30ab\u30fc\u30c9\u304c\u914d\u308a\u76f4\u3055\u308c\u308b\u307e\u3067\u5f85\u3061\u307e\u3057\u3087\u3046",
              type: "success",
            });
          } catch (notifyError) {
            logDebug("room-page", "notify-force-exit-retry-success", notifyError);
          }
        }
        return true;
      } catch (error) {
        forcedExitRecoveryPendingRef.current = true;
        const code = getRoomServiceErrorCode(error);
        const isInProgress = code === "ROOM_IN_PROGRESS";

        if (!isInProgress) {
          logError(
            "room-page",
            silent ? "auto-seat-recovery-error" : "forced-exit-retry-join",
            error
          );
        } else if (silent) {
          logDebug("room-page", "auto-seat-recovery-in-progress", {
            roomId,
            uid,
          });
        }

        if (!silent) {
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
        return false;
      }
    },
    [
      uid,
      recallV2Enabled,
      versionMismatchBlocksAccess,
      setPendingRejoinFlag,
      displayName,
      roomId,
      setForcedExitReason,
      room?.status,
      leavingRef,
    ]
  );

  const handleRetryJoin = useCallback(async () => {
    await performSeatRecovery({ silent: false, source: "manual" });
  }, [performSeatRecovery]);

  const attemptAutoSeatRecovery = useCallback(async () => {
    await performSeatRecovery({ silent: true, source: "auto" });
  }, [performSeatRecovery]);

  useEffect(() => {
    if (!recallV2Enabled) return;
    if (!firebaseEnabled) return;
    if (!uid) return;
    if (!db) return;
    const requestRef = doc(db, "rooms", roomId, "rejoinRequests", uid);
    const unsubscribe = onSnapshot(
      requestRef,
      (snap) => {
        if (!snap.exists()) {
          setSeatRequestState({
            status: "idle",
            source: null,
            requestedAt: null,
            error: null,
          });
          setSeatRequestTimedOut(false);
          seatRequestSignalsRef.current.accepted = false;
          seatRequestSignalsRef.current.rejected = false;
          seatRequestSignalsRef.current.timeout = false;
          return;
        }
        const data = snap.data() as Record<string, any>;
        const statusRaw = typeof data?.status === "string" ? (data.status as string) : "pending";
        const status: "pending" | "accepted" | "rejected" =
          statusRaw === "accepted" || statusRaw === "rejected" ? statusRaw : "pending";
        const sourceRaw = typeof data?.source === "string" ? (data.source as string) : "manual";
        const source: SeatRequestSource = sourceRaw === "auto" ? "auto" : "manual";
        const created =
          typeof data?.createdAt?.toMillis === "function"
            ? Number(data.createdAt.toMillis())
            : Date.now();
        const failure =
          typeof data?.failureReason === "string" ? (data.failureReason as string) : null;
        setSeatRequestState({
          status,
          source,
          requestedAt: created,
          error: failure,
        });
      },
      (error) => {
        traceError("spectator.rejoinRequest.subscribe", error, { roomId, uid });
      }
    );
    return () => {
      unsubscribe();
    };
  }, [recallV2Enabled, firebaseEnabled, uid, roomId, db]);

  useEffect(() => {
    if (!recallV2Enabled) return;
    if (seatRequestState.status !== "pending" || !seatRequestState.requestedAt) {
      setSeatRequestTimedOut(false);
      seatRequestSignalsRef.current.timeout = false;
      return;
    }
    const timeoutMs = 15000;
    const now = Date.now();
    const remaining = Math.max(timeoutMs - (now - seatRequestState.requestedAt), 0);
    if (remaining === 0) {
      if (!seatRequestSignalsRef.current.timeout) {
        seatRequestSignalsRef.current.timeout = true;
        traceAction("spectator.recallTimeout", { roomId, uid });
        bumpMetric("recall", "timeout");
        setSeatRequestTimedOut(true);
      }
      return;
    }
    const timer = window.setTimeout(() => {
      if (!seatRequestSignalsRef.current.timeout) {
        seatRequestSignalsRef.current.timeout = true;
        traceAction("spectator.recallTimeout", { roomId, uid });
        bumpMetric("recall", "timeout");
      }
      setSeatRequestTimedOut(true);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [recallV2Enabled, seatRequestState.status, seatRequestState.requestedAt, roomId, uid]);

  useEffect(() => {
    if (!recallV2Enabled) return;
    if (seatRequestState.status === "accepted") {
      if (!seatRequestSignalsRef.current.accepted) {
        seatRequestSignalsRef.current.accepted = true;
        seatRequestSignalsRef.current.rejected = false;
        seatRequestSignalsRef.current.timeout = false;
        leavingRef.current = false;
        forcedExitScheduledRef.current = false;
        forcedExitRecoveryPendingRef.current = false;
        setForcedExitReason(null);
        traceAction("spectator.recallAccepted", { roomId, uid });
        bumpMetric("recall", "accepted");
      }
      setSeatRequestTimedOut(false);
    } else if (seatRequestState.status === "rejected") {
      if (!seatRequestSignalsRef.current.rejected) {
        seatRequestSignalsRef.current.rejected = true;
        seatRequestSignalsRef.current.accepted = false;
        seatRequestSignalsRef.current.timeout = false;
        leavingRef.current = false;
        forcedExitRecoveryPendingRef.current = false;
        traceAction("spectator.recallRejected", { roomId, uid });
        bumpMetric("recall", "rejected");
      }
      setSeatRequestTimedOut(false);
    } else {
      seatRequestSignalsRef.current.accepted = false;
      seatRequestSignalsRef.current.rejected = false;
    }
  }, [
    recallV2Enabled,
    seatRequestState.status,
    roomId,
    uid,
    leavingRef,
    forcedExitScheduledRef,
    forcedExitRecoveryPendingRef,
    setForcedExitReason,
  ]);
  useEffect(() => {
    if (!recallV2Enabled) {
      recallJoinHandledRef.current = false;
      return;
    }
    const canHandle =
      seatRequestAccepted ||
      (recallV2Enabled && isMember && !isSpectatorMode && !!room);
    if (!canHandle) {
      recallJoinHandledRef.current = false;
      return;
    }
    if (!uid || !room) return;
    if (recallJoinHandledRef.current) return;
    recallJoinHandledRef.current = true;

    const normalizedDisplayName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : null;

    (async () => {
      try {
        await joinRoomFully({
          roomId,
          uid,
          displayName: normalizedDisplayName,
          notifyChat: false,
        });
        await assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
      } catch (error) {
        recallJoinHandledRef.current = false;
        assignNumberRetrySignatureRef.current = null;
        traceError("spectator.recallJoinFailed", error, { roomId, uid });
      }
    })();
  }, [
    recallV2Enabled,
    seatRequestAccepted,
    isMember,
    isSpectatorMode,
    uid,
    room,
    roomId,
    displayName,
  ]);
  useEffect(() => {
    if (!uid || !roomId || !room) {
      return;
    }
    if (isSpectatorMode || !me) {
      assignNumberRetrySignatureRef.current = null;
      return;
    }
    if (typeof me.number === "number") {
      assignNumberRetrySignatureRef.current = null;
      return;
    }
    if (room.status !== "clue") {
      assignNumberRetrySignatureRef.current = null;
      return;
    }
    if (dealPlayers.length === 0 || !dealPlayers.includes(uid)) {
      return;
    }
    const attemptSignature = `${room.round ?? 0}:${dealPlayersSignature}`;
    if (assignNumberRetrySignatureRef.current === attemptSignature) {
      return;
    }
    assignNumberRetrySignatureRef.current = attemptSignature;
    traceAction("spectator.recallAssignNumberRetry", { roomId, uid });
    void assignNumberIfNeeded(roomId, uid, room).catch((error) => {
      assignNumberRetrySignatureRef.current = null;
      traceError("spectator.recallAssignNumberRetry", error, { roomId, uid });
    });
  }, [
    uid,
    roomId,
    room,
    room?.status,
    room?.round,
    me,
    me?.number,
    isSpectatorMode,
    dealPlayersSignature,
    dealPlayers,
  ]);
  useEffect(() => {
    if (!waitingToRejoin || !isSpectatorMode) {
      spectatorAutoRetryStateRef.current = { lastAttemptTs: 0, statusKey: null };
      return;
    }
    if (leavingRef.current) {
      return;
    }
    if (spectatorReason !== "waiting") {
      return;
    }
    if (versionMismatchBlocksAccess) {
      return;
    }
    if (recallV2Enabled && (seatRequestPending || seatRequestAccepted)) {
      return;
    }
    if (!uid) {
      return;
    }
    if (joinStatus === "joining" || joinStatus === "retrying") {
      return;
    }

    const statusKey = `${room?.id ?? ""}:${room?.status ?? ""}`;
    const { lastAttemptTs, statusKey: previousKey } =
      spectatorAutoRetryStateRef.current;
    const now = Date.now();
    const minInterval = previousKey === statusKey ? 1500 : 400;
    if (now - lastAttemptTs < minInterval) {
      return;
    }

    spectatorAutoRetryStateRef.current = {
      lastAttemptTs: now,
      statusKey,
    };

    logDebug("room-page", "auto-seat-recovery-attempt", {
      roomId,
      uid,
      joinStatus,
      statusKey,
      spectatorReason,
      waitingToRejoin,
      players: playersSignature
        ? playersSignature.split(",").filter((id) => id)
        : [],
    });
    void attemptAutoSeatRecovery();
  }, [
    waitingToRejoin,
    isSpectatorMode,
    spectatorReason,
    versionMismatchBlocksAccess,
    recallV2Enabled,
    seatRequestPending,
    seatRequestAccepted,
    uid,
    joinStatus,
    room?.id,
    room?.status,
    playersSignature,
    attemptAutoSeatRecovery,
    roomId,
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
      setPendingRejoinFlag("auto");
      if (uid) {
        const normalizedDisplayName =
          typeof displayName === "string" && displayName.trim().length > 0
            ? displayName.trim()
            : null;
        void joinRoomFully({
          roomId,
          uid,
          displayName: normalizedDisplayName,
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
      try {
        if (rejoinSessionKey && typeof window !== "undefined") {
          window.sessionStorage.removeItem(rejoinSessionKey);
        }
      } catch (error) {
        logDebug("room-page", "clear-session-storage-failed", error);
      }
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
        ...players.map((p) => p.id),
      ]);
      return Array.from(combined);
    }
    return players.map((p) => p.id);
  }, [room?.deal?.players, players]);


  const baseIds = useMemo(
    () => sortPlayersByJoinOrder(unsortedBaseIds, players),
    [unsortedBaseIds, players]
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


  const displayRoomName = stripMinimalTag(room?.name) || "";

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
        {recallV2Enabled ? (
          <Box textAlign="center" mt={seatRequestError ? 4 : 3}>
            {seatRequestPending ? (
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
              >
                ホストが席の準備を進めています。そのままお待ちください。
              </Text>
            ) : seatRequestTimedOut ? (
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
              >
                ホストの準備中かもしれません。少し待ってから再度お試しください。
              </Text>
            ) : seatRequestRejected ? (
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
              >
                申請が受理されませんでした。時間を置くかホストに確認してみてください。
              </Text>
            ) : seatRequestAccepted ? (
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={UI_TOKENS.COLORS.whiteAlpha80}
              >
                席が確保されました。まもなくプレイに戻ります。
              </Text>
            ) : null}
            {seatRequestError ? (
              <Text fontSize="sm" color="tomato" mt={2}>
                {seatRequestError}
              </Text>
            ) : null}
          </Box>
        ) : null}
      </Box>
    );
  }



  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined;


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

          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={players} />
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

  const spectatorUpdateButton = spectatorUpdateReady ? (
    <AppButton
      palette="brand"
      size="md"
      onClick={applySpectatorUpdate}
      disabled={spectatorUpdateApplying}
    >
      {spectatorUpdateApplying ? "適用中..." : "最新アップデートを適用"}
    </AppButton>
  ) : null;

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
            {spectatorUpdateButton}
            <AppButton
              palette={spectatorUpdateButton ? "gray" : "brand"}
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
              disabled={seatRequestButtonDisabled}
            >
              {seatRequestPending ? (
                <HStack gap={2} align="center">
                  <Spinner size="sm" />
                  <Text as="span">申請中...</Text>
                </HStack>
              ) : (
                "席に戻れるか試す"
              )}
            </AppButton>
            <AppButton palette="gray" size="md" onClick={handleForcedExitLeaveNow}>
              ロビーへ戻る
            </AppButton>
          </>
        ) : (
          <>
            {spectatorUpdateButton}
            <AppButton
              palette="gray"
              visual="outline"
              size="md"
              onClick={handleRetryJoin}
              disabled={seatRequestButtonDisabled}
            >
              {seatRequestPending ? (
                <HStack gap={2} align="center">
                  <Spinner size="sm" />
                  <Text as="span">申請中...</Text>
                </HStack>
              ) : (
                "席に戻れるか試す"
              )}
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
          roundIds={clueTargetIds}
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

      <SimplePhaseDisplay
        roomStatus={room?.status || "waiting"}
        canStartSorting={canStartSorting}
        topicText={room?.topic || null}
      />

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
