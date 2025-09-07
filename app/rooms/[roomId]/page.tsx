"use client";

// 重要コンポーネント: Eager loading（初期表示性能優先）
// import { Hud } from "@/components/Hud"; // ヘッダー削除: MiniHandDockに統合済み

// 旧CluePanelは未使用（刷新した中央UIに統合済み）
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import SettingsModal from "@/components/SettingsModal";
import { AppButton } from "@/components/ui/AppButton";
import GameLayout from "@/components/ui/GameLayout";
import MiniHandDock from "@/components/ui/MiniHandDock";
import MinimalChat from "@/components/ui/MinimalChat";
import { notify } from "@/components/ui/notify";
import { SimplePhaseDisplay } from "@/components/ui/SimplePhaseDisplay";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import UniversalMonitor from "@/components/UniversalMonitor";
import { useAuth } from "@/context/AuthContext";
import { sendSystemMessage } from "@/lib/firebase/chat";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  resetPlayerState,
  setPlayerNameAvatar,
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
import { randomAvatar } from "@/lib/utils";
import { Box, HStack, Input, Spinner, Text } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

// ClueInputMini: 手札エリア用のコンパクトな連想ワード入力コンポーネント
interface ClueInputMiniProps {
  roomId: string;
  playerId: string;
  currentValue: string;
}

function ClueInputMini({ roomId, playerId, currentValue }: ClueInputMiniProps) {
  const [text, setText] = useState<string>(currentValue);

  // props が変わったら内部状態も更新
  useEffect(() => {
    setText(currentValue);
  }, [currentValue]);

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value) {
      notify({ title: "連想ワードを入力してください", type: "warning" });
      return;
    }
    try {
      await updateClue1(roomId, playerId, value);
      notify({ title: "連想ワードを更新しました", type: "success" });
    } catch (err: any) {
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
  const roomId = params.roomId;
  const { user, displayName } = useAuth();
  const router = useRouter();
  const uid = user?.uid || null;
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

  // ラウンド対象は上部で計算済み（eligibleIds）

  // 入室ガード: 自分がメンバーでないかつ待機中でない場合はロビーへ戻す
  // ただし、ホストは常にアクセス可能
  const isMember = !!(uid && players.some((p) => p.id === uid));
  const canAccess = isMember || isHost;
  useEffect(() => {
    if (!room || !uid) return;
    if (!canAccess && room.status !== "waiting" && room.status !== "clue") {
      try {
        notify({
          title: "入室できません",
          description:
            "ゲーム進行中です。ホストがリセットすると入室可能になります。",
          type: "info",
        });
      } catch {}
      router.replace("/");
    }
  }, [room?.status, uid, canAccess]);

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
    // clue/playing の両方に対して安全に割当
    assignNumberIfNeeded(roomId, uid).catch(() => void 0);
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

  // 準備完了（ready）はオンライン参加者のみを対象に判定
  const allCluesReady =
    onlinePlayers.length > 0 && onlinePlayers.every((p) => p.ready === true);

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
    room,
  ]);

  // waitingに戻ったら自分のフィールドを初期化
  useEffect(() => {
    if (!room || room.status !== "waiting" || !uid) return;
    const me = players.find((p) => p.id === uid);
    if (!me) return;
    if (me.number !== null || me.clue1 || me.ready || me.orderIndex !== 0) {
      resetPlayerState(roomId, uid).catch(() => void 0);
    }
  }, [room?.status, uid]);

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
      await updateDoc(doc(db!, "rooms", roomId), {
        round: (room.round || 0) + 1,
      });
      await startGameAction(roomId);
      notify({ title: "ゲーム開始", type: "success" });
    } catch (e: any) {
      console.error(e);
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
      setPlayerNameAvatar(
        roomId,
        uid,
        displayName,
        randomAvatar(displayName)
      ).catch(() => void 0);
    }
  }, [displayName, uid, roomId]);

  const leaveRoom = useCallback(async () => {
    if (!uid) return;
    try {
      leavingRef.current = true;
      // presence detach（即時反映）
      try {
        await detachNow();
        await forceDetachAll(roomId, uid);
      } catch {}
      await leaveRoomAction(roomId, uid, displayName);
      try {
        if (typeof window !== "undefined") {
          const lr = window.localStorage.getItem("lastRoom");
          if (lr === roomId) window.localStorage.removeItem("lastRoom");
        }
      } catch {}
      // メインメニューに戻る
      router.push("/");
    } catch (error) {
      console.error("退出エラー:", error);
      // エラーが発生してもメインメニューに戻る
      router.push("/");
    }
  }, [uid, detachNow, roomId, displayName, router]);

  // 退出時処理をフックで一元化
  useLeaveCleanup({
    enabled: true,
    roomId,
    uid,
    displayName,
    detachNow,
    leavingRef,
  });

  // isMember は上で算出済み

  // ラウンド対象（オンラインの参加者のみ）
  const onlineSet = new Set(
    Array.isArray(onlineUids) ? onlineUids : onlinePlayers.map((p) => p.id)
  );
  const baseIds = Array.isArray((room as any)?.deal?.players)
    ? Array.from(
        new Set<string>([
          ...(((room as any).deal.players as string[]) || []),
          ...players.map((p) => p.id),
        ])
      )
    : players.map((p) => p.id);
  const eligibleIds = baseIds.filter((id) => onlineSet.has(id));

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

  if (!firebaseEnabled || loading || !room) {
    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        {!firebaseEnabled ? (
          <Text>
            Firebase設定が見つかりません。`.env.local` を設定してください。
          </Text>
        ) : (
          <Spinner />
        )}
      </Box>
    );
  }
  // 途中参加OKのため、ブロック画面は表示しない

  // 新しいGameLayoutを使用した予測可能な構造
  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined; // ヘッダー削除: MiniHandDockに機能統合済み

  const sidebarNode = undefined; // モック仕様: 左の参加者リストは廃止（待機エリアで代替）

  const mainNode = (
    <Box h="100%" display="grid" gridTemplateRows="auto 1fr" gap={3} minH={0}>
      <Box p={0}>
        <UniversalMonitor room={room} players={players} />
      </Box>
      {/* ドット行が親でクリップされないように: visible + minH=0 */}
      <Box overflow="visible" minH={0}>
        {/** tsserver stale cache workaround: cast to any to accept updated failedAt typing */}
        <CentralCardBoard
          roomId={roomId}
          players={players}
          orderList={room.order?.list || []}
          meId={meId}
          eligibleIds={eligibleIds}
          roomStatus={room.status}
          cluesReady={allCluesReady}
          failed={!!room.order?.failed}
          failedAt={room.order?.failedAt ?? undefined}
          proposal={room.order?.proposal || []}
          resolveMode={room.options?.resolveMode}
          isHost={isHost}
          orderNumbers={room.order?.numbers || {}}
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
      roomName={room.name}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLeaveRoom={leaveRoom}
    />
  ) : (
    <Box h="1px" />
  );

  return (
    <>
      <GameLayout
        variant="immersive"
        header={headerNode}
        sidebar={sidebarNode}
        main={mainNode}
        handArea={handAreaNode}
      />

      {/* ミニマルUI（固定配置） */}
      <MinimalChat roomId={roomId} />

      {/* シンプル進行状況表示（左上固定） - 進行状況のみ表示 */}
      <SimplePhaseDisplay
        roomStatus={room?.status || "waiting"}
        canStartSorting={canStartSorting}
      />

      {/* ドラクエ風パーティーメンバー表示 */}
      <DragonQuestParty
        players={players}
        roomStatus={room?.status || "waiting"}
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
