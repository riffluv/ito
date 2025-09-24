"use client";

// 重要コンポーネント: Eager loading（初期表示性能優先）
// import { Hud } from "@/components/Hud"; // ヘッダー削除: MiniHandDockに統合済み

// 旧CluePanelは未使用（刷新した中央UIに統合済み）
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import NameDialog from "@/components/NameDialog";
import SettingsModal from "@/components/SettingsModal";
import { AppButton } from "@/components/ui/AppButton";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import GameLayout from "@/components/ui/GameLayout";
import MiniHandDock from "@/components/ui/MiniHandDock";
import MinimalChat from "@/components/ui/MinimalChat";
import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import { notify } from "@/components/ui/notify";
import { logError } from "@/lib/utils/log";
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { SimplePhaseDisplay } from "@/components/ui/SimplePhaseDisplay";
import { useTransition } from "@/components/ui/TransitionProvider";
import UniversalMonitor from "@/components/UniversalMonitor";
import { useAuth } from "@/context/AuthContext";
import { getDisplayMode, stripMinimalTag } from "@/lib/game/displayMode";
import { UI_TOKENS } from "@/theme/layout";
import { sendSystemMessage } from "@/lib/firebase/chat";
import { validateClue } from "@/lib/validation/forms";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  resetPlayerState,
  setPlayerName,
  updateClue1,
  updateLastSeen,
} from "@/lib/firebase/players";
import { forceDetachAll, presenceSupported } from "@/lib/firebase/presence";
import {
  leaveRoom as leaveRoomAction,
  resetRoomToWaiting,
} from "@/lib/firebase/rooms";
import {
  continueAfterFail as continueAfterFailAction,
  startGame as startGameAction,
} from "@/lib/game/room";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { assignNumberIfNeeded } from "@/lib/services/roomService";
import { toMillis } from "@/lib/time";
import { Box, HStack, Input, Spinner, Text } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ClueInputMini: 手札エリア用のコンパクトな連想ワード入力コンポーネント
interface ClueInputMiniProps {
  roomId: string;
  playerId: string;
  currentValue: string;
}

function ClueInputMini({ roomId, playerId, currentValue }: ClueInputMiniProps) {
  const [text, setText] = useState<string>(currentValue);

  // props が変わったら内部状態も更新（空文字列の場合も確実にリセット）
  useEffect(() => {
    setText(currentValue || "");
  }, [currentValue]);

  const handleSubmit = async () => {
    let sanitized: string;
    try {
      sanitized = validateClue(text);
    } catch (err: any) {
      notify({
        title: "連想ワードを確認してください",
        description: err?.errors?.[0]?.message,
        type: "warning",
      });
      return;
    }
    try {
      await updateClue1(roomId, playerId, sanitized);
      notify({ title: "連想ワードを更新しました", type: "success" });
    } catch (err: any) {
      logError("room", "clue-update", err);
      notify({
        title: "更新に失敗しました",
        description: err?.message,
        type: "error",
      });
    }
  };

  return (
    <HStack gap={1} flex="1" minW={0}>
      <Input
        placeholder="連想ワード"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={50}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        size="sm"
        w={{ base: "120px", md: "160px", lg: "200px" }}
        bg="surfaceRaised"
        color="fgDefault"
        border="1px solid"
        borderColor="borderSubtle"
        _placeholder={{ color: "fgMuted" }}
        _focus={{
          borderColor: "accent",
          boxShadow: "0 0 0 1px var(--chakra-colors-accent)",
        }}
        _hover={{ borderColor: "borderDefault" }}
        flex="1"
        maxW="200px"
      />
      <AppButton
        size="sm"
        colorPalette="orange"
        onClick={handleSubmit}
        flexShrink={0}
      >
        更新
      </AppButton>
    </HStack>
  );
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;
  const { user, displayName, setDisplayName, loading: authLoading } = useAuth();
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid || null;

  // roomIdが取得できない場合は早期リターン
  if (!roomId) {
    return <div>ルームIDが見つかりません</div>;
  }

  const {
    room,
    players,
    onlineUids,
    onlinePlayers,
    loading,
    isHost,
    detachNow,
    leavingRef,
  } = useRoomState(roomId, uid, displayName);

  // 設定モーダルの状態管理
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const meId = uid || "";
  const me = players.find((p) => p.id === meId);

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
    if (!room || players.length === 0) return null;
    const sorted = [...players].sort((a, b) => {
      const ao = typeof a.orderIndex === "number" ? a.orderIndex : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.orderIndex === "number" ? b.orderIndex : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });
    return sorted[0]?.id ?? null;
  }, [room?.id, players]);

  // 配布演出: 数字が来た瞬間に軽くポップ（DiamondNumberCard用）
  const [pop, setPop] = useState(false);
  const [redirectGuard, setRedirectGuard] = useState(true);
  const hostClaimAttemptRef = useRef(0);
  const hostClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneRef = useRef<{ key: string; ts: number; inflight: boolean } | null>(null);
  const offlineSinceRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setRedirectGuard(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof me?.number === "number") {
      setPop(true);
      const id = setTimeout(() => setPop(false), 180);
      return () => clearTimeout(id);
    }
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
  const rejoinSessionKey = useMemo(() => (uid ? `pendingRejoin:${roomId}` : null), [uid, roomId]);
  useEffect(() => {
    if (!room || !uid) return;
    // プレイヤー状態が変わる間に焦って抜けない(ハードリダイレクト防止)
    // F5リロード時にAuthContextとuseRoomStateの両方が安定するまで待つ
    if (loading || authLoading) return;
    if (redirectGuard) return;
    let pendingRejoin = false;
    if (rejoinSessionKey && typeof window !== "undefined") {
      try {
        pendingRejoin = window.sessionStorage.getItem(rejoinSessionKey) === uid;
      } catch {}
    }
    if (pendingRejoin) return;
    // ゲーム中(waiting以外)では外部へ退室させる
    if (!canAccess && room.status !== "waiting") {
      (async () => {
        try {
          if (!leavingRef.current) leavingRef.current = true;

          // 🔥 NEW: 強制退室でもホスト復帰情報を記録
          if (isHost && uid && displayName) {
            console.log(`[Debug] Leaving as host: ${uid}`);
          }

          try {
            notify({
              title: "参加できません",
              description:
                "ゲーム進行中です。ホストがリセットすると参加可能になります。",
              type: "info",
            });
          } catch {}
          try {
            await detachNow();
            await forceDetachAll(roomId, uid);
          } catch {}
          try {
            await leaveRoomAction(roomId, uid, displayName);
          } catch {}
        } finally {
          router.replace("/");
        }
      })();
    }
  }, [room?.status, uid, canAccess, loading, authLoading, rejoinSessionKey, redirectGuard]);

  useEffect(() => {
    if (!room || !uid || !user) {
      if (hostClaimTimerRef.current) {
        try { clearTimeout(hostClaimTimerRef.current); } catch {}
        hostClaimTimerRef.current = null;
      }
      return;
    }
    if (leavingRef.current) return;
    const hostId = typeof room.hostId === "string" ? room.hostId.trim() : "";
    if (hostId) {
      hostClaimAttemptRef.current = 0;
      if (hostClaimTimerRef.current) {
        try { clearTimeout(hostClaimTimerRef.current); } catch {}
        hostClaimTimerRef.current = null;
      }
      return;
    }
    const shouldAttemptClaim = (hostClaimCandidateId === uid);

    if (!shouldAttemptClaim) return;

    let cancelled = false;

    const attemptClaim = async () => {
      try {
        // 🔥 NEW: クレーム前のログ出力（デバッグ用）
        console.log(`[HostClaim] Attempting claim: ${uid}`, {
          roomId,
          hostClaimCandidateId,
          currentHostId: room?.hostId || 'none'
        });


        const token = await user.getIdToken();
        if (!token || cancelled) return;

        await fetch(`/api/rooms/${roomId}/claim-host`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
          keepalive: true,
        });
        hostClaimAttemptRef.current = 0;

        console.log(`[HostClaim] Host claimed successfully: ${uid}`);
      } catch (error) {
        logError("room-page", "claim-host", error);
        if (!cancelled) {
          const attempt = hostClaimAttemptRef.current + 1;
          if (attempt <= 3) {
            hostClaimAttemptRef.current = attempt;
            const delay = 800 * Math.pow(2, attempt - 1);
            try {
              if (hostClaimTimerRef.current) clearTimeout(hostClaimTimerRef.current);
            } catch {}
            hostClaimTimerRef.current = setTimeout(() => {
              hostClaimTimerRef.current = null;
              if (!cancelled) attemptClaim();
            }, delay);
          }
        }
      }
    };

    attemptClaim();

    return () => {
      cancelled = true;
      if (hostClaimTimerRef.current) {
        try { clearTimeout(hostClaimTimerRef.current); } catch {}
        hostClaimTimerRef.current = null;
      }
    };
  }, [room?.hostId, players, uid, user, roomId, leavingRef]); // 🔥 FIXED: hostClaimCandidateIdを依存配列から除去（無限ループ防止）
  // 保存: 自分がその部屋のメンバーである場合、最後に居た部屋として localStorage に記録
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (uid && isMember) {
        window.localStorage.setItem("lastRoom", roomId);
      }
    } catch {}
  }, [uid, isMember, roomId]);

  // 数字配布後（またはplayingで未割当の場合）、自分の番号を割当（決定的）
  useEffect(() => {
    if (!room || !uid) return;
    if (!room.deal || !room.deal.seed) return;
    // clue/playing の両方に対して安全に割当（既存roomを渡して再読取を回避）
    assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
  }, [room?.deal?.seed, room?.status, uid]);

  // 入室システムメッセージ（1ユーザー1回）
  useEffect(() => {
    if (!uid || !displayName) return;
    if (!room) return;
    // localStorageフラグで多重送信防止
    try {
      const key = `room:${roomId}:joined:${uid}`;
      if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, "1");
        sendSystemMessage(roomId, `${displayName} さんが入室しました`).catch(
          () => void 0
        );
      }
    } catch {}
  }, [uid, displayName, roomId, room?.id]);

  // 準備完了（ready）はラウンド参加者（deal.players）を対象に判定
  const allCluesReady = useMemo(() => {
    const ids = Array.isArray((room as any)?.deal?.players)
      ? (room as any).deal.players as string[]
      : players.map((p) => p.id);
    const idSet = new Set(ids);
    const targets = players.filter((p) => idSet.has(p.id));
    return targets.length > 0 && targets.every((p) => p.ready === true);
  }, [players, Array.isArray((room as any)?.deal?.players) ? (room as any).deal.players.join(',') : '_']);

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
  }, [room?.round, uid]);

  // プレゼンス: ハートビートでlastSeen更新（presence未対応環境のみ）
  useEffect(() => {
    if (!uid) return;
    if (presenceSupported()) return;
    const tick = () => updateLastSeen(roomId, uid).catch(() => void 0);
    const id = setInterval(tick, 30000);
    tick();
    return () => clearInterval(id);
  }, [uid, roomId]);

  // ホスト向けトースト: 連想ワード完了通知（モードごとにメッセージ差し替え・一度だけ）
  useEffect(() => {
    if (!isHost || !room) return;
    if (!allCluesReady) return;
    if (room.status !== "clue") return;
    const mode = room.options?.resolveMode || "sequential";
    const id = `clues-ready-${mode}-${roomId}-${room.round || 0}`;
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
    } catch {}
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
    if (myPlayer.number !== null || myPlayer.clue1 || myPlayer.ready || myPlayer.orderIndex !== 0) {
      resetPlayerState(roomId, uid).catch(() => void 0);
    }
  }, [room?.status, uid]);

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

    const candidates = players.filter((p) => p.id !== uid && !onlineSet.has(p.id));
    if (candidates.length === 0) return;

    const readyIds: string[] = [];
    for (const p of candidates) {
      const last = toMillis((p as any).lastSeen);
      const existing = offlineSinceRef.current.get(p.id);
      if (!existing) {
        offlineSinceRef.current.set(p.id, now);
        continue;
      }
      const offlineDuration = now - existing;
      if (offlineDuration < OFFLINE_GRACE_MS) continue;
      const staleByLastSeen = last > 0 ? now - last >= LAST_SEEN_THRESHOLD_MS : false;
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
        console.info("[prune] request", {
          roomId,
          targets: readyIds,
          offlineSince: readyIds.map((id) => offlineSinceRef.current.get(id) ?? null),
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
        console.info("[prune] completed", { roomId, targets: readyIds });
        readyIds.forEach((id) => offlineSinceRef.current.delete(id));
      }
    })();
  }, [
    isHost,
    uid,
    user,
    Array.isArray(onlineUids) ? onlineUids.join(",") : "_",
    players,
    roomId,
  ]);

  const startGame = useCallback(async () => {
    try {
      if (!room || !isHost) {
        notify({ title: "ホストのみ開始できます", type: "warning" });
        return;
      }
      if (onlinePlayers.length < 2) {
        notify({ title: "プレイヤーは2人以上必要です", type: "info" });
        return;
      }
      // 先に開始アクションを実行し、成功後にroundを進める（失敗時の不整合防止）
      await startGameAction(roomId);
      await updateDoc(doc(db!, "rooms", roomId), {
        round: (room.round || 0) + 1,
      });
      notify({ title: "ゲーム開始", type: "success" });
    } catch (e: any) {
      logError("room-page", "start-game", e);
      notify({
        title: "ゲーム開始に失敗しました",
        description: e?.message || "権限またはFirestoreルールをご確認ください",
        type: "error",
      });
    }
  }, [room, isHost, onlinePlayers.length, roomId]);

  // finalizeはRevealPanel側で処理

  const resetToWaiting = useCallback(async () => {
    if (!isHost) return;
    await resetRoomToWaiting(roomId);
  }, [isHost, roomId]);

  const continueAfterFail = useCallback(async () => {
    await updateDoc(doc(db!, "rooms", roomId), {
      round: (room?.round || 0) + 1,
    });
    await continueAfterFailAction(roomId);
  }, [room?.round, roomId]);

  // proposal state removed: clue フェーズではドロップ時に即時コミットして判定します

  // 表示名が変わったら、入室中の自分のプレイヤーDocにも反映
  useEffect(() => {
    if (!uid) return;
    if (displayName) {
      setPlayerName(
        roomId,
        uid,
        displayName
      ).catch(() => void 0);
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
      } catch {}
      try {
        if (typeof window !== "undefined") {
          const lr = window.localStorage.getItem("lastRoom");
          if (lr === roomId) window.localStorage.removeItem("lastRoom");
        }
      } catch {}
    };

    const performLeave = async (token: string | null) => {
      // 🔥 NEW: ホストが退室する場合、復帰情報を記録
      const wasHost = isHost || (room?.hostId === uid);
      if (wasHost && uid && displayName) {
        console.log(`[Debug] User ${uid} (${displayName}) is leaving as host`);
      } else {
        console.log(`[HostReturning] Not marking (not host): wasHost=${wasHost}, isHost=${isHost}, uid=${uid}, displayName=${displayName}`);
      }

      try {
        await Promise.resolve(detachNow()).catch(() => {});
      } catch {}
      try {
        await Promise.resolve(forceDetachAll(roomId, uid)).catch(() => {});
      } catch {}
      let viaApi = false;
      if (token) {
        try {
          const res = await fetch(`/api/rooms/${roomId}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, token, displayName: displayName ?? null }),
            keepalive: true,
          });
          viaApi = res.ok;
        } catch {}
      }
      if (!viaApi) {
        try {
          await leaveRoomAction(roomId, uid, displayName);
        } catch {}
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
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 0.8,
            showLoading: true,
            loadingSteps: [
              { id: "error", message: "エラーが発生しました...", duration: 800 },
              { id: "return", message: "ロビーに戻ります...", duration: 800 },
              { id: "complete", message: "完了 しました!", duration: 400 },
            ],
          }
        );
      } else {
        router.push("/");
      }
    }
  }, [uid, detachNow, roomId, displayName, router, transition, user, rejoinSessionKey]);

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
  const unsortedBaseIds = Array.isArray((room as any)?.deal?.players)
    ? Array.from(
        new Set<string>([
          ...(((room as any).deal.players as string[]) || []),
          ...players.map((p) => p.id),
        ])
      )
    : players.map((p) => p.id);

  // 入室順でソート（一貫した並び順を保持）
  const baseIds = sortPlayersByJoinOrder(unsortedBaseIds, players);

  // ホストを最優先（左端）に配置するためのソート
  const hostId = room?.hostId;
  const eligibleIds = hostId
    ? [hostId, ...baseIds.filter(id => id !== hostId)]
    : baseIds;

  // 並び替えフェーズの判定（CentralCardBoardと同じロジック）
  const canStartSorting = useMemo(() => {
    const resolveMode = room?.options?.resolveMode;
    const roomStatus = room?.status;

    if (resolveMode !== "sort-submit" || roomStatus !== "clue") {
      return false;
    }

    // waitingPlayersの計算（CentralCardBoardと同じ）
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const placedIds = new Set(room?.order?.proposal || []);
    const waitingPlayers = (eligibleIds || [])
      .map((id) => playerMap.get(id)!)
      .filter((p) => p && !placedIds.has(p.id));

    return waitingPlayers.length === 0;
  }, [
    room?.options?.resolveMode,
    room?.status,
    players,
    eligibleIds,
    room?.order?.proposal,
  ]);

  // 残りの対象数（結果画面の続行ボタンの表示制御に使用）
  const remainingCount = useMemo(() => {
    const played = new Set<string>((room as any)?.order?.list || []);
    return eligibleIds.filter((id) => !played.has(id)).length;
  }, [
    eligibleIds.join(","),
    Array.isArray((room as any)?.order?.list)
      ? ((room as any).order.list as string[]).join(",")
      : "",
  ]);

  // presence のアタッチ/デタッチは usePresence が管理
  // Host primary action object (reused for HUD or left column)
  const hostPrimaryAction = isHost
    ? room?.status === "finished"
      ? { label: "もう一度", onClick: resetToWaiting }
      : null
    : null;
  const showHostInHud = false; // Always show host controls in hand area instead of HUD

  const orderProposal = room?.order?.proposal;
  const orderListFinal = room?.order?.list;
  const submittedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(orderProposal)) {
      for (const pid of orderProposal) {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      }
    }
    if (Array.isArray(orderListFinal)) {
      for (const pid of orderListFinal) {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      }
    }
    return Array.from(ids);
  }, [orderProposal, orderListFinal]);

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
        <AppButton onClick={() => router.push("/")} colorScheme="blue">
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
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
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
          orderNumbers={(room.order as any)?.numbers || {}}
          slotCount={(() => {
            if (room.status === "reveal" || room.status === "finished") {
              return (room.order?.list || []).length;
            }
            const dealLen = Array.isArray(room?.deal?.players)
              ? (room.deal!.players as string[]).length
              : 0;
            const propLen = Array.isArray(room?.order?.proposal)
              ? (room.order!.proposal as (string | null)[]).length
              : 0;
            return Math.max(dealLen, propLen, eligibleIds.length);
          })()}
        />
      </Box>
    </Box>
  );

  const handAreaNode = me ? (
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
      allowContinueAfterFail={!!room.options?.allowContinueAfterFail}
      // ヘッダー機能統合
      roomName={displayRoomName}
      currentTopic={room.topic || null}
      onlineUids={onlineUids}
      roundIds={players.map((p) => p.id)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLeaveRoom={leaveRoom}
      pop={pop}
    />
  ) : (
    <Box h="1px" />
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
      <MinimalChat roomId={roomId} />

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



