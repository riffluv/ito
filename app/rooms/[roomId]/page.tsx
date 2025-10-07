"use client";

// 重要コンポーネント: Eager loading（初期表示性能優先）
// import { Hud } from "@/components/Hud"; // ヘッダー削除: MiniHandDockに統合済み

// 旧CluePanelは未使用（刷新した中央UIに統合済み）
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import NameDialog from "@/components/NameDialog";
import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import dynamic from "next/dynamic";
// ⚡ PERFORMANCE: React.lazy で遅延ロード
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
  updateLastSeen,
} from "@/lib/firebase/players";
import { useAssetPreloader } from "@/hooks/useAssetPreloader";
import { forceDetachAll, presenceSupported } from "@/lib/firebase/presence";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { getDisplayMode, stripMinimalTag } from "@/lib/game/displayMode";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { useHostClaim } from "@/lib/hooks/useHostClaim";
import { useHostPruning } from "@/lib/hooks/useHostPruning";
import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { selectHostCandidate } from "@/lib/host/HostManager";
import { verifyPassword } from "@/lib/security/password";
import {
  assignNumberIfNeeded,
  getRoomServiceErrorCode,
  joinRoomFully,
} from "@/lib/services/roomService";
import { toMillis } from "@/lib/time";
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type RoomPageContentProps = {
  roomId: string;
};

function RoomPageContent({ roomId }: RoomPageContentProps) {
  const { user, displayName, setDisplayName, loading: authLoading } = useAuth();
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid || null;
  useAssetPreloader(ROOM_CORE_ASSETS);

  useEffect(() => {
    const prefetch = async () => {
      await Promise.allSettled(
        PREFETCH_COMPONENT_LOADERS.map((loader) => {
          try {
            return loader();
          } catch (error) {
            return Promise.reject(error);
          }
        })
      );
    };
    prefetch();
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
    onlinePlayers,
    loading,
    isHost,
    detachNow,
    leavingRef,
  } = useRoomState(
    roomId,
    uid,
    passwordVerified ? (displayName ?? null) : null
  );

  // 設定モーダルの状態管理
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 記録簿モーダルの状態管理
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  // ゲーム終了判定
  const isGameFinished = room?.status === "finished";
  const [lastKnownHostId, setLastKnownHostId] = useState<string | null>(null);
  const playerJoinOrderRef = useRef<Map<string, number>>(new Map());
  const joinCounterRef = useRef(0);
  const [joinVersion, setJoinVersion] = useState(0);
  const meId = uid || "";
  const me = players.find((p) => p.id === meId);
  const onlineUidSignature = useMemo(
    () => (Array.isArray(onlineUids) ? onlineUids.join(",") : "_"),
    [onlineUids]
  );

  // ⚡ PERFORMANCE: room全体ではなく必要なプロパティだけ監視
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
          setPasswordDialogError("パスワードが違います");
          return;
        }
        storeRoomPasswordHash(roomId, room.passwordHash ?? "");
        setPasswordVerified(true);
        setPasswordDialogOpen(false);
      } catch (error) {
        logError("room-page", "verify-room-password-failed", error);
        setPasswordDialogError("パスワードの検証に失敗しました");
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
    const inputs = players.map((player) => {
      const joinedAt =
        playerJoinOrderRef.current.get(player.id) ?? Number.MAX_SAFE_INTEGER;
      const lastSeenMs = toMillis(player.lastSeen);
      const lastSeenAt = lastSeenMs > 0 ? lastSeenMs : null;
      return {
        id: player.id,
        joinedAt,
        orderIndex:
          typeof player.orderIndex === "number" ? player.orderIndex : null,
        lastSeenAt,
        isOnline: onlineSet.has(player.id),
        name: player.name ?? null,
      };
    });

    return selectHostCandidate(inputs) ?? null;
  }, [room?.id, players, onlineUids, lastKnownHostId, joinVersion]);

  // 配布演出: 数字が来た瞬間に軽くポップ（DiamondNumberCard用）
  const [pop, setPop] = useState(false);
  const [redirectGuard, setRedirectGuard] = useState(true);
  const [forcedExitReason, setForcedExitReason] = useState<
    "game-in-progress" | null
  >(null);
  // hostClaimAttemptRef, hostClaimTimerRef は useHostClaim 内に移動
  // pruneRef, offlineSinceRef は useHostPruning 内に移動
  const forcedExitScheduledRef = useRef(false); // 他の場所でも使われているため残す
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
    return () => clearTimeout(timer);
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
    const stableHost =
      typeof room?.hostId === "string" ? room.hostId.trim() : "";
    if (stableHost) {
      setLastKnownHostId(stableHost);
    }
  }, [room?.hostId]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof me?.number === "number") {
      setPop(true);
      timeoutId = setTimeout(() => setPop(false), 180);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [me?.number]);
  // 名前未設定時はダイアログを表示。auto-joinはuseRoomState側で抑止済み
  const needName = !displayName || !String(displayName).trim();
  // ⚡ PERFORMANCE: useCallbackでメモ化して不要な関数再生成を防止
  const handleSubmitName = useCallback(async (name: string) => {
    setDisplayName(name);
  }, [setDisplayName]);

  // ラウンド対象は上部で計算済み（eligibleIds）

  // 入室ガード: 自分がメンバーでない場合、待機中以外の部屋には入れない
  // ただし、ホストは常にアクセス可能
  const isMember = !!(uid && players.some((p) => p.id === uid));
  const canAccess = isMember || isHost;
  const isSpectatorMode =
    (!canAccess && room?.status !== "waiting") ||
    forcedExitReason === "game-in-progress";
  // ⚡ PERFORMANCE: 37行の強制退出処理をカスタムフック化
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
    setPendingRejoinFlag,
    setForcedExitReason,
  });

  const handleForcedExitLeaveNow = useCallback(() => {
    void executeForcedExit();
  }, [executeForcedExit]);

  const handleRetryJoin = useCallback(async () => {
    if (!uid) return;

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
          title: "席を取り直しました",
          description: "みんなのカードが配り直されるのを待ちましょう",
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
          : "少し待ってからもう一度お試しください";

      try {
        notify({
          title: isInProgress
            ? "まだゲームが進行中です"
            : "参加リトライに失敗しました",
          description: isInProgress
            ? "ホストがリセットしたらもう一度お試しください"
            : fallbackDescription,
          type: isInProgress ? "info" : "error",
        });
      } catch (notifyError) {
        logDebug("room-page", "notify-force-exit-retry-failed", notifyError);
      }
    }
  }, [uid, roomId, displayName, setPendingRejoinFlag]);

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

  // ⚡ PERFORMANCE: 88行の巨大useEffectをカスタムフック化
  // 前のホストがまだメンバーかどうかを計算
  const previousHostStillMember = useMemo(() => {
    if (!lastKnownHostId) return false;
    if (uid && lastKnownHostId === uid) return false;
    if (Array.isArray(onlinePlayers) && onlinePlayers.some((p) => p.id === lastKnownHostId)) {
      return true;
    }
    if (Array.isArray(onlineUids) && onlineUids.includes(lastKnownHostId)) {
      return true;
    }
    const hostPlayer = players.find((p) => p.id === lastKnownHostId);
    if (!hostPlayer) return false;
    const lastSeenMs = toMillis(hostPlayer.lastSeen);
    if (lastSeenMs <= 0) return false;
    return Date.now() - lastSeenMs < 120000;
  }, [lastKnownHostId, players, onlinePlayers, onlineUids]);

  useHostClaim({
    roomId,
    uid,
    user,
    hostId: room?.hostId || null,
    candidateId: hostClaimCandidateId,
    lastKnownHostId,
    previousHostStillMember,
    isMember,
    leavingRef,
  });

  // 数字配布後（またはplayingで未割当の場合）、自分の番号を割当（決定的）
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

  // 準備完了（ready）はラウンド参加者（deal.players）を対象に判定
  const allCluesReady = useMemo(() => {
    const dealPlayers = room?.deal?.players;
    const ids = Array.isArray(dealPlayers)
      ? dealPlayers
      : players.map((p) => p.id);
    const idSet = new Set(ids);
    const targets = players.filter((p) => idSet.has(p.id));
    return targets.length > 0 && targets.every((p) => p.ready === true);
  }, [players, room?.deal?.players]);

  // canStartSorting は eligibleIds 定義後に移動

  // playing フェーズ廃止につき canStartPlaying ロジックは削除

  // ラウンドが進んだら自分のreadyをリセット
  const [seenRound, setSeenRound] = useState<number>(0);
  // ⚡ PERFORMANCE: room全体ではなくroom.roundだけ監視して無駄な再実行を防止
  useEffect(() => {
    if (!uid) return;
    const r = room?.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db!, "rooms", roomId, "players", uid);
      updateDoc(meRef, { ready: false }).catch(() => void 0);
    }
  }, [room?.round, uid, roomId, seenRound]);

  // プレゼンス: ハートビートでlastSeen更新（presence未対応環境のみ）
  useEffect(() => {
    if (!uid || presenceSupported()) {
      return () => undefined;
    }

    const tick = () => updateLastSeen(roomId, uid).catch(() => void 0);
    const intervalId = setInterval(tick, 30000);
    tick();

    return () => {
      clearInterval(intervalId);
    };
  }, [uid, roomId]);

  // ホスト向けトースト: 連想ワード完了通知（モードごとにメッセージ差し替え・一度だけ）
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
    // sort-submit: 並べてホストが「せーので判定」ボタンを押す流れを促す
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

  // ⚡ PERFORMANCE: room全体ではなくroom.statusだけ監視
  // waitingに戻ったら自分のフィールドを初期化
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

  // ⚡ PERFORMANCE: 80行のホストプルーニング処理をカスタムフック化
  useHostPruning({
    isHost,
    uid,
    user,
    roomId,
    players,
    onlineUids,
  });

  // 表示名が変わったら、入室中の自分のプレイヤーDocにも反映
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
      // 🚀 OPTIMIZED: 並列処理でクリーンアップを高速化
      try {
        // 1. リスナー解除を並列実行（Promise.allで高速化）
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

      // 2. API呼び出し（フォールバック付き）
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

      // 3. フォールバック（API失敗時）
      if (!viaApi) {
        try {
          await leaveRoomAction(roomId, uid, displayName);
        } catch (error) {
          logError("room-page", "leave-room-action", error);
        }
      }

      // 4. セッションフラグクリア
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
            { id: "complete", message: "完了 しました!", duration: 400 },
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

  // 退出時処理をフックで一元化
  useLeaveCleanup({
    enabled: true,
    roomId,
    uid,
    displayName,
    detachNow,
    leavingRef,
    user,
  });

  // isMember は上で算出済み

  // ラウンド対象（表示の安定性重視）
  // presenceの一時的な揺れでスロット/待機カード数が減らないよう、
  // 基本はラウンドメンバー（deal.players ∪ players）を入室順でソートして採用する。
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

  // 入室順でソート（一貫した並び順を保持）
  const baseIds = useMemo(
    () => sortPlayersByJoinOrder(unsortedBaseIds, players),
    [unsortedBaseIds, players]
  );

  // ホストを最優先（左端）に配置するためのソート
  const hostId = room?.hostId ?? null;
  const eligibleIds = useMemo(() => {
    if (!hostId) {
      return baseIds;
    }
    return [hostId, ...baseIds.filter((id) => id !== hostId)];
  }, [hostId, baseIds]);

  // ⚡ PERFORMANCE: slotCount計算をuseMemo化
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

  // 並び替えフェーズの判定（CentralCardBoardと同じロジック）
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
          Firebase設定が見つかりません。`.env.local` を設定してください。
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

  // 表示用部屋名（[自分の手札]を除去）
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
        bg={UI_TOKENS.GRADIENTS.mainBg}
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg={UI_TOKENS.GRADIENTS.dqPanel}
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
              へやが みつからないよ！
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              部屋が さくじょされたか、<br />
              URLが まちがっているようだ。
            </Text>
          </Box>
          <Box display="flex" justifyContent="center">
            <AppButton
              onClick={handleBackToLobby}
              palette="brand"
              size="md"
              minW="180px"
            >
              ロビーへもどる
            </AppButton>
          </Box>
        </Box>
      </Box>
    );
  }
  // 途中参加OKのため、ブロック画面は表示しない

  // 新しいGameLayoutを使用した予測可能な構造
  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined; // ヘッダー削除: MiniHandDockに機能統合済み

  // 左レール：なかま（オンライン表示）
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
          // DPI150ではアナウンス帯の高さをさらに抑える（重なり回避＋盤面確保）
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={players} />
      </Box>
      {/* ドット行が親でクリップされないように: visible + minH=0 */}
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
          slotCount={slotCount}
          topic={room.topic ?? null}
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
          <Text
            fontSize={{ base: "md", md: "lg" }}
            fontWeight={700}
            textShadow="2px 2px 0 rgba(0,0,0,0.8)"
          >
            席は埋まっています
          </Text>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            color={UI_TOKENS.COLORS.whiteAlpha80}
            lineHeight={1.7}
            mt={1}
          >
            ホストがリセットすれば再び席に戻れるよ！それまではゲームの様子を観戦しよう！
          </Text>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDir={{ base: "column", md: "row" }}
        gap={3}
        justifyContent="center"
      >
        <AppButton
          palette="gray"
          visual="outline"
          size="md"
          onClick={handleRetryJoin}
          disabled={!waitingToRejoin}
        >
          席に戻れるか試す
        </AppButton>
        <AppButton palette="brand" size="md" onClick={handleForcedExitLeaveNow}>
          ロビーへ戻る
        </AppButton>
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
          defaultTopicType={room.options?.defaultTopicType || "通常版"}
          topicBox={room.topicBox ?? null}
          allowContinueAfterFail={!!room.options?.allowContinueAfterFail}
          roomName={displayRoomName}
          currentTopic={room.topic || null}
          onlineUids={onlineUids}
          roundIds={players.map((p) => p.id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLedger={() => setIsLedgerOpen(true)}
          onLeaveRoom={leaveRoom}
          pop={pop}
        />
      ) : spectatorNotice ? null : (
        <Box h="1px" />
      )}
    </Box>
  );

  return (
    <>
      {/* 右上トースト通知の購読（チャットと独立） */}
      <RoomNotifyBridge roomId={roomId} />
      <GameLayout
        variant="immersive"
        header={headerNode}
        sidebar={sidebarNode}
        main={mainNode}
        handArea={handAreaNode}
      />

      {/* 名前入力モーダル。キャンセルは不可（閉じても再度開く） */}
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

      {/* シンプル進行状況表示（中央上） */}
      <SimplePhaseDisplay
        roomStatus={room?.status || "waiting"}
        canStartSorting={canStartSorting}
        topicText={room?.topic || null}
      />

      {/* チャットはトグル式（FABで開閉） */}
      <MinimalChat
        roomId={roomId}
        players={players}
        hostId={room?.hostId ?? null}
      />

      <RoomPasswordPrompt
        isOpen={passwordDialogOpen}
        roomName={room ? stripMinimalTag(room.name) : undefined}
        isLoading={passwordDialogLoading}
        error={passwordDialogError}
        onSubmit={handleRoomPasswordSubmit}
        onCancel={handleRoomPasswordCancel}
      />

      {/* ホスト操作はフッターの同一行に統合済み（モック準拠） */}

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
        />
      </Suspense>
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

