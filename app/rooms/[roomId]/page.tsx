"use client";

// 重要コンポーネント: Eager loading（初期表示性能優先）
// import { Hud } from "@/components/Hud"; // ヘッダー削除: MiniHandDockに統合済み

// 旧CluePanelは未使用（刷新した中央UIに統合済み）
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import NameDialog from "@/components/NameDialog";
import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import { RoomPasswordPrompt } from "@/components/RoomPasswordPrompt";
import SettingsModal from "@/components/SettingsModal";
import { AppButton } from "@/components/ui/AppButton";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import GameLayout from "@/components/ui/GameLayout";
import MiniHandDock from "@/components/ui/MiniHandDock";
import MinimalChat from "@/components/ui/MinimalChat";
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
import { forceDetachAll, presenceSupported } from "@/lib/firebase/presence";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { getDisplayMode, stripMinimalTag } from "@/lib/game/displayMode";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
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

type RoomPageContentProps = {
  roomId: string;
};

function RoomPageContent({ roomId }: RoomPageContentProps) {
  const { user, displayName, setDisplayName, loading: authLoading } = useAuth();
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid || null;
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

  useEffect(() => {
    if (!room) {
      setPasswordDialogOpen(false);
      setPasswordVerified(false);
      return;
    }
    if (!room.requiresPassword) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    const cached = getCachedRoomPasswordHash(roomId);
    if (cached && room.passwordHash && cached === room.passwordHash) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    setPasswordVerified(false);
    setPasswordDialogOpen(true);
    setPasswordDialogError(null);
  }, [roomId, room, room?.requiresPassword, room?.passwordHash]);

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
  const hostClaimAttemptRef = useRef(0);
  const hostClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneRef = useRef<{
    key: string;
    ts: number;
    inflight: boolean;
  } | null>(null);
  const offlineSinceRef = useRef<Map<string, number>>(new Map());
  const forcedExitScheduledRef = useRef(false);
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

    try {
      router.replace("/");
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
  const handleSubmitName = async (name: string) => {
    setDisplayName(name);
  };

  // ラウンド対象は上部で計算済み（eligibleIds）

  // 入室ガード: 自分がメンバーでない場合、待機中以外の部屋には入れない
  // ただし、ホストは常にアクセス可能
  const isMember = !!(uid && players.some((p) => p.id === uid));
  const canAccess = isMember || isHost;
  const isSpectatorMode =
    (!canAccess && room?.status !== "waiting") ||
    forcedExitReason === "game-in-progress";
  useEffect(() => {
    if (!room || !uid) return;
    if (leavingRef.current) return;
    if (lastKnownHostId === uid) return;
    // プレイヤー状態が変わる間に焦って抜けない(ハードリダイレクト防止)
    // F5リロード時にAuthContextとuseRoomStateの両方が安定するまで待つ
    if (loading || authLoading) return;
    if (redirectGuard) return;

    let pendingRejoin = false;
    if (rejoinSessionKey && typeof window !== "undefined") {
      try {
        pendingRejoin = window.sessionStorage.getItem(rejoinSessionKey) === uid;
      } catch (error) {
        logDebug("room-page", "session-storage-read-failed", error);
      }
    }
    if (pendingRejoin) return;

    if (!canAccess && room.status !== "waiting") {
      if (!forcedExitScheduledRef.current) {
        forcedExitScheduledRef.current = true;
        forcedExitRecoveryPendingRef.current = true;
        setPendingRejoinFlag();
        try {
          notify({
            title: "ゲーム進行中です",
            description:
              "今回はプレイヤーとして残ることができません。ホストがリセットすると再参加できます。",
            type: "info",
          });
        } catch (error) {
          logDebug("room-page", "notify-force-exit-init-failed", error);
        }
        setForcedExitReason("game-in-progress");
      }
    }
  }, [
    room?.status,
    uid,
    canAccess,
    loading,
    authLoading,
    rejoinSessionKey,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    setPendingRejoinFlag,
  ]);

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

  useEffect(() => {
    const clearTimer = () => {
      if (hostClaimTimerRef.current) {
        clearTimeout(hostClaimTimerRef.current);
        hostClaimTimerRef.current = null;
      }
    };

    if (!room || !uid || !user) {
      clearTimer();
      return clearTimer;
    }

    if (leavingRef.current) {
      clearTimer();
      return clearTimer;
    }

    const hostId = typeof room.hostId === "string" ? room.hostId.trim() : "";
    if (hostId) {
      hostClaimAttemptRef.current = 0;
      clearTimer();
      return clearTimer;
    }

    const previousHostId = lastKnownHostId;
    const previousHostStillMember =
      previousHostId && players.some((p) => p.id === previousHostId);

    const shouldAttemptClaim =
      hostClaimCandidateId === uid &&
      (!previousHostId || previousHostId === uid || !previousHostStillMember);

    if (!shouldAttemptClaim) {
      clearTimer();
      return clearTimer;
    }

    let cancelled = false;

    const attemptClaim = async () => {
      try {
        const token = await user.getIdToken();
        if (!token || cancelled) {
          return;
        }

        await fetch(`/api/rooms/${roomId}/claim-host`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
          keepalive: true,
        });
        hostClaimAttemptRef.current = 0;
      } catch (error) {
        logError("room-page", "claim-host", error);
        if (!cancelled) {
          const attempt = hostClaimAttemptRef.current + 1;
          if (attempt <= 3) {
            hostClaimAttemptRef.current = attempt;
            const delay = 800 * Math.pow(2, attempt - 1);
            clearTimer();
            hostClaimTimerRef.current = setTimeout(() => {
              hostClaimTimerRef.current = null;
              if (!cancelled) {
                void attemptClaim();
              }
            }, delay);
          }
        }
      }
    };

    attemptClaim();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [
    room,
    players,
    uid,
    user,
    roomId,
    leavingRef,
    lastKnownHostId,
    hostClaimCandidateId,
  ]);
  // 保存: 自分がその部屋のメンバーである場合、最後に居た部屋として localStorage に記録
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (uid && isMember) {
        window.localStorage.setItem("lastRoom", roomId);
      }
    } catch (error) {
      logDebug("room-page", "persist-last-room-failed", error);
    }
  }, [uid, isMember, roomId]);

  // 数字配布後（またはplayingで未割当の場合）、自分の番号を割当（決定的）
  useEffect(() => {
    if (!room || !uid) return;
    if (!room.deal || !room.deal.seed) return;
    // clue/playing の両方に対して安全に割当（既存roomを渡して再読取を回避）
    assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
  }, [room?.deal?.seed, room?.status, uid, room, roomId]);

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
  useEffect(() => {
    if (!room || !uid) return;
    const r = room.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db!, "rooms", roomId, "players", uid);
      updateDoc(meRef, { ready: false }).catch(() => void 0);
    }
  }, [room?.round, room, uid, roomId, seenRound]);

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

  // waitingに戻ったら自分のフィールドを初期化
  useEffect(() => {
    if (!room || room.status !== "waiting" || !uid) return;
    const myPlayer = players.find((p) => p.id === uid);
    if (!myPlayer) return;
    if (
      myPlayer.number !== null ||
      myPlayer.clue1 ||
      myPlayer.ready ||
      myPlayer.orderIndex !== 0
    ) {
      resetPlayerState(roomId, uid).catch(() => void 0);
    }
  }, [room?.status, room, uid, players, roomId]);

  useEffect(() => {
    if (!isHost) return;
    if (!uid || !user) return;
    if (!Array.isArray(onlineUids)) return;
    if (onlineUids.length === 0) return;
    if (!players.length) return;
    const OFFLINE_GRACE_MS = 8_000;
    const LAST_SEEN_THRESHOLD_MS = 30_000;
    const now = Date.now();
    const onlineSet = new Set(onlineUids);

    for (const id of Array.from(offlineSinceRef.current.keys())) {
      if (id === uid) {
        offlineSinceRef.current.delete(id);
        continue;
      }
      if (onlineSet.has(id)) {
        offlineSinceRef.current.delete(id);
        continue;
      }
      if (!players.some((p) => p.id === id)) {
        offlineSinceRef.current.delete(id);
      }
    }

    const candidates = players.filter(
      (p) => p.id !== uid && !onlineSet.has(p.id)
    );
    if (candidates.length === 0) return;

    const readyIds: string[] = [];
    for (const p of candidates) {
      const last = toMillis(p.lastSeen);
      const existing = offlineSinceRef.current.get(p.id);
      if (!existing) {
        offlineSinceRef.current.set(p.id, now);
        continue;
      }
      const offlineDuration = now - existing;
      if (offlineDuration < OFFLINE_GRACE_MS) continue;
      const staleByLastSeen =
        last > 0 ? now - last >= LAST_SEEN_THRESHOLD_MS : false;
      if (!staleByLastSeen && offlineDuration < LAST_SEEN_THRESHOLD_MS) {
        continue;
      }
      readyIds.push(p.id);
    }

    if (readyIds.length === 0) return;
    readyIds.sort();
    const key = readyIds.join(",");
    const entry = pruneRef.current;
    if (entry && entry.inflight) return;
    if (entry && entry.key === key && now - entry.ts < 30_000) return;
    pruneRef.current = { key, ts: now, inflight: true };
    (async () => {
      try {
        const token = await user.getIdToken().catch(() => null);
        if (!token) return;
        logInfo("room-page", "prune-request", {
          roomId,
          targets: readyIds,
          offlineSince: readyIds.map(
            (id) => offlineSinceRef.current.get(id) ?? null
          ),
        });
        await fetch(`/api/rooms/${roomId}/prune`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, callerUid: uid, targets: readyIds }),
        });
      } catch (error) {
        logError("room-page", "prune-offline", error);
      } finally {
        pruneRef.current = { key, ts: Date.now(), inflight: false };
        logInfo("room-page", "prune-complete", { roomId, targets: readyIds });
        readyIds.forEach((id) => offlineSinceRef.current.delete(id));
      }
    })();
  }, [isHost, uid, user, onlineUidSignature, onlineUids, players, roomId]);

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
      try {
        if (typeof window !== "undefined") {
          const lr = window.localStorage.getItem("lastRoom");
          if (lr === roomId) window.localStorage.removeItem("lastRoom");
        }
      } catch (error) {
        logDebug("room-page", "clear-last-room-failed", error);
      }
    };

    const performLeave = async (token: string | null) => {
      // 🔥 NEW: ホストが退室する場合、復帰情報を記録
      try {
        await detachNow();
      } catch (error) {
        logError("room-page", "leave-detach-now", error);
      }
      try {
        await forceDetachAll(roomId, uid);
      } catch (error) {
        logError("room-page", "leave-force-detach", error);
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
              { id: "leave", message: "ロビーへ戻ります...", duration: 1200 },
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

  if (loading) {
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
    return (
      <Box
        h="100dvh"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={4}
        gap={4}
      >
        <Text fontSize="xl" fontWeight="bold" color="white">
          🏠 部屋が見つかりません
        </Text>
        <Text color="gray.400" textAlign="center">
          この部屋は削除されたか、存在しない可能性があります
        </Text>
        <AppButton onClick={() => router.push("/")} palette="brand">
          メインメニューに戻る
        </AppButton>
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
          slotCount={(() => {
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
          })()}
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        roomId={roomId}
        currentOptions={room.options || {}}
        isHost={isHost}
        roomStatus={room.status}
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
