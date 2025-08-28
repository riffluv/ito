"use client";
import dynamic from "next/dynamic";

// 重要コンポーネント: Eager loading（初期表示性能優先）
import { ChatPanel } from "@/components/ChatPanel";
import { Hud } from "@/components/Hud";
import { Participants } from "@/components/Participants";

// 非重要コンポーネント: Dynamic import（必要時に読み込み）
const CluePanel = dynamic(
  () => import("@/components/CluePanel").then((m) => m.CluePanel),
  { 
    ssr: false, 
    loading: () => null 
  }
);
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";
import SettingsModal from "@/components/SettingsModal";
import { AppButton } from "@/components/ui/AppButton";
import ChatPanelImproved from "@/components/ui/ChatPanelImproved";
import GameLayout from "@/components/ui/GameLayout";
import { notify } from "@/components/ui/notify";
import { Panel } from "@/components/ui/Panel";
import ScrollableArea from "@/components/ui/ScrollableArea";
import SelfNumberCard from "@/components/ui/SelfNumberCard";
import UniversalMonitor from "@/components/UniversalMonitor";
import HostControlDock from "@/components/ui/HostControlDock";
import { useAuth } from "@/context/AuthContext";
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
  submitSortedOrder,
} from "@/lib/game/room";
import { topicControls, topicTypeLabels } from "@/lib/game/topicControls";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { assignNumberIfNeeded } from "@/lib/services/roomService";
import { randomAvatar } from "@/lib/utils";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Flex, HStack, Input, Spinner, Stack, Text, useBreakpointValue } from "@chakra-ui/react";
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
        bg="white" // 緊急修正: 確実な白背景
        color="gray.900" // 緊急修正: 確実な黒文字
        border="1px solid"
        borderColor="gray.300" // 緊急修正: 明確な境界線
        _placeholder={{ color: "gray.500" }} // プレースホルダー視認性
        _focus={{ 
          borderColor: "blue.500", 
          boxShadow: "0 0 0 1px blue.500" 
        }} // フォーカス状態の明確化
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

  // 入室ガード: 自分がメンバーでないかつ待機中でない場合はロビーへ戻す
  const isMember = !!(uid && players.some((p) => p.id === uid));
  useEffect(() => {
    if (!room || !uid) return;
    if (!isMember && room.status !== "waiting" && room.status !== "clue") {
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
  }, [room?.status, uid, isMember]);

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

  const allNumbersDealt =
    !!room?.topic &&
    !!room?.deal &&
    Array.isArray((room.deal as any).players) &&
    onlinePlayers.every((p) => typeof p.number === "number");

  // 準備完了（ready）はオンライン参加者のみを対象に判定
  const allCluesReady =
    onlinePlayers.length > 0 && onlinePlayers.every((p) => p.ready === true);
  const enoughPlayers = onlinePlayers.length >= 2;

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
        title:
          mode === "sequential"
            ? "全員が連想ワードを決定しました"
            : "全員の連想ワードが揃いました",
        description:
          mode === "sequential"
            ? "昇順だと思う順でカードを場へドラッグしてください"
            : "カードを全員場に置き、相談して並べ替えてから『せーので判定』を押してください",
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
    ? room?.status === "waiting"
      ? { label: "開始", onClick: startGame }
      : room?.status === "finished"
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
  return (
    <>
      <GameLayout
        header={
          <Hud
            roomName={room.name}
            phase={room.status}
            activeCount={onlinePlayers.length}
            totalCount={players.length}
            remainMs={null}
            totalMs={null}
            hostPrimary={showHostInHud ? hostPrimaryAction : null}
            isHost={isHost}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLeaveRoom={leaveRoom} // 退出ボタン機能追加
          />
        }
        sidebar={
          <Box h="100%">
            {/* Sidebar Header - Professional Style */}
            <Box
              padding="1.5rem 1.5rem 1rem"
              borderBottom="1px solid #e2e8f0" // --slate-200
            >
              <Box
                fontSize="1.125rem"
                fontWeight={600}
                color="#0f172a" // --slate-900
                marginBottom={2}
              >
                プレイヤー
              </Box>
              <Box
                fontSize="0.875rem"
                color="#64748b" // --slate-600
              >
                {onlinePlayers.length}/{players.length}人
              </Box>
            </Box>
            
            {/* Player List */}
            <Box overflowY="auto" flex={1}>
              <Participants players={onlinePlayers} />
            </Box>
          </Box>
        }
        main={
          <Box h="100%" display="grid" gridTemplateRows="auto 1fr" gap={3}>
            {/* モニター: 固定高さ - パディング統一 */}
            <Box p={0} /* パディング除去：内部で制御 */>
              <UniversalMonitor room={room} players={players} />
            </Box>

            {/* カードボード: 残り高さを使用 - ゲーム画面規範準拠 */}
            <Box overflow="hidden">
              <CentralCardBoard
                roomId={roomId}
                players={players}
                orderList={room.order?.list || []}
                meId={meId}
                eligibleIds={eligibleIds}
                roomStatus={room.status}
                cluesReady={allCluesReady}
                failed={!!room.order?.failed}
                failedAt={room.order?.failedAt}
                proposal={room.order?.proposal || []}
                resolveMode={room.options?.resolveMode}
              />
            </Box>
          </Box>
        }
        rightPanel={
          <Box h="100%" display="flex" flexDirection="column">
            {/* Chat Header - Professional Style */}
            <Box
              padding="1.5rem 1.5rem 1rem"
              borderBottom="1px solid #e2e8f0" // --slate-200
            >
              <Box
                fontSize="1.125rem"
                fontWeight={600}
                color="#0f172a" // --slate-900
              >
                チャット
              </Box>
            </Box>
            
            {/* Chat Messages */}
            <Box flex={1} overflow="hidden">
              <ChatPanelImproved roomId={roomId} />
            </Box>
          </Box>
        }
        handArea={
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={6}
            css={{
              "@media (max-width: 768px)": {
                flexDirection: "column",
                gap: "1.5rem",
              },
            }}
          >
            {/* Left Side: My Card & Clue Input - Only show during clue phase */}
            {room.status === "clue" && me ? (
              <Box
                display="flex"
                alignItems="center"
                gap={{ base: 4, md: 6 }}
                flex={1}
                css={{
                  "@media (max-width: 768px)": {
                    flexDirection: "column",
                    alignItems: "flex-start",
                  },
                }}
              >
                {/* My Card Section - Responsive Professional Style */}
                <Box
                  display="flex"
                  alignItems="center"
                  gap={{ base: 3, md: 6 }}
                  css={{
                    "@media (max-width: 768px)": {
                      width: "100%",
                      justifyContent: "center",
                    },
                  }}
                >
                  <SelfNumberCard value={me.number} draggableId={me.id} />
                  
                  <Box textAlign="left" display={{ base: "none", md: "block" }}>
                    <Box
                      fontSize="0.875rem"
                      color="#64748b" // --slate-500
                      marginBottom={1}
                    >
                      カードの位置予想
                    </Box>
                    <Box
                      fontWeight={600}
                      color="#0f172a" // --slate-900
                    >
                      中程度～高め
                    </Box>
                  </Box>
                </Box>

                {/* Clue Section - Responsive Professional Style */}
                <Box flex={1} maxWidth={{ base: "100%", md: "400px" }}>
                  <ClueInputMini
                    roomId={roomId}
                    playerId={me.id}
                    currentValue={me?.clue1 || ""}
                  />
                  <Box
                    fontSize="0.75rem"
                    color="#64748b" // --slate-500
                    marginTop={1}
                  >
                    {(me?.clue1 || "").length} / 50文字
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box flex={1} />
            )}

            {/* Right Side: Host Controls - Always show for hosts */}
            {isHost && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent={{ base: "center", md: "flex-end" }}
                css={{
                  "@media (max-width: 768px)": {
                    width: "100%",
                  },
                }}
              >
                <HostControlDock
                  roomId={roomId}
                  room={room}
                  players={players}
                  onlineCount={onlinePlayers.length}
                  hostPrimaryAction={hostPrimaryAction}
                  onReset={resetToWaiting}
                />
              </Box>
            )}
          </Box>
        }
      />

      {/* 設定モーダル */}
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
