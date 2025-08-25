"use client";
import dynamic from "next/dynamic";
// dynamic imports (chunk split + 初期JS削減)
const ChatPanel = dynamic(
  () => import("@/components/ChatPanel").then((m) => m.ChatPanel),
  { ssr: false, loading: () => null }
);
const CluePanel = dynamic(
  () => import("@/components/CluePanel").then((m) => m.CluePanel),
  { ssr: false, loading: () => null }
);
const Hud = dynamic(() => import("@/components/Hud").then((m) => m.Hud), {
  ssr: false,
});
const Participants = dynamic(
  () => import("@/components/Participants").then((m) => m.Participants),
  { ssr: false }
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
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
        bg="panelSubBg"
        flex="1"
        maxW="200px"
      />
      <Button
        size="sm"
        colorPalette="orange"
        onClick={handleSubmit}
        flexShrink={0}
      >
        更新
      </Button>
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
    if (!isMember && room.status !== "waiting") {
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

  const startGame = async () => {
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
  };

  // finalizeはRevealPanel側で処理

  const resetToWaiting = async () => {
    if (!isHost) return;
    await resetRoomToWaiting(roomId);
  };

  const continueAfterFail = async () => {
    await updateDoc(doc(db!, "rooms", roomId), {
      round: (room?.round || 0) + 1,
    });
    await continueAfterFailAction(roomId);
  };

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

  const leaveRoom = async () => {
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
    } catch {}
  };

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

  const showHostInHud = useBreakpointValue({ base: true, md: false });

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
          />
        }
        sidebar={
          <Box h="100%" display="flex" flexDir="column">
            {/* 👥 参加者セクション - 上部・拡張可能 */}
            <Box flex="1 1 0" minH={0}>
              <ScrollableArea label="参加者一覧">
                <Panel
                  title={`参加者人数: ${onlinePlayers.length}/${players.length}`}
                  density="compact"
                >
                  <Participants players={onlinePlayers} />
                </Panel>
              </ScrollableArea>
            </Box>

            {/* 🎮 ゲーム制御セクション - 下部・固定（レイアウトシフト防止） */}
            {isHost && (
              <Box flex="0 0 auto" p={4} bg="panelBg">
                <Panel title="🎮 ゲーム制御" variant="accent" elevated={true}>
                  {/* 拡張された固定高さコンテナでお題制御も含める */}
                  <Box
                    minH="200px"
                    display="flex"
                    flexDir="column"
                    justifyContent="center"
                  >
                    <Stack gap={3}>
                      {/* お題制御セクション（ゲーム中のみ表示） */}
                      {room.status === "clue" && (
                        <Box
                          p={2}
                          bg="panelSubBg"
                          rounded="md"
                          borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
                          borderColor="gray.600"
                        >
                          <Text fontSize="xs" color="gray.300" mb={2}>
                            📋 お題管理
                          </Text>
                          <Stack gap={2}>
                            {/* カテゴリ選択ボタン（お題未選択時） */}
                            {!room.topic && (
                              <>
                                <Text fontSize="xs" color="gray.400">
                                  カテゴリ選択:
                                </Text>
                                <Flex wrap="wrap" gap={1}>
                                  {topicTypeLabels.map((label) => (
                                    <Button
                                      key={label}
                                      size="xs"
                                      variant="outline"
                                      onClick={() =>
                                        topicControls.selectCategory(
                                          roomId,
                                          label
                                        )
                                      }
                                      flex="1"
                                      minW="60px"
                                    >
                                      {label.replace("版", "")}
                                    </Button>
                                  ))}
                                </Flex>
                              </>
                            )}

                            {/* お題制御ボタン（お題選択後） */}
                            {room.topic && (
                              <HStack>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    topicControls.shuffleTopic(
                                      roomId,
                                      (room as any).topicBox
                                    )
                                  }
                                  flex="1"
                                >
                                  🔄 シャッフル
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    topicControls.dealNumbers(roomId)
                                  }
                                  flex="1"
                                >
                                  🎲 数字配布
                                </Button>
                              </HStack>
                            )}
                          </Stack>
                        </Box>
                      )}

                      {/* メインアクションボタン（開始・もう一度） */}
                      {!showHostInHud && hostPrimaryAction && (
                        <AppButton
                          w="100%"
                          colorPalette="orange"
                          onClick={hostPrimaryAction.onClick}
                          disabled={(hostPrimaryAction as any).disabled}
                          title={(hostPrimaryAction as any).title}
                          size="lg"
                        >
                          {(hostPrimaryAction as any).label}
                        </AppButton>
                      )}

                      {/* リセットボタン - 常に表示で一貫性維持 */}
                      <AppButton
                        variant="outline"
                        w="100%"
                        onClick={resetToWaiting}
                        size="md"
                      >
                        🔄 リセット
                      </AppButton>
                    </Stack>
                  </Box>
                </Panel>
              </Box>
            )}
          </Box>
        }
        main={
          <Box h="100%" display="flex" flexDir="column">
            {/* モニター: 固定高さ - パディング統一 */}
            <Box flex="0 0 auto" p={0} /* パディング除去：内部で制御 */>
              <UniversalMonitor room={room} players={players} />
            </Box>

            {/* カードボード: 残り高さを使用 */}
            <Box flex="1 1 0" minH={0} overflowY="auto" overflowX="hidden">
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
          <Box h="100%" display="flex" flexDir="column">
            {/* チャット: 残り高さを使用 */}
            <Box flex="1 1 0" minH={0}>
              <ChatPanelImproved roomId={roomId} />
            </Box>

            {/* 退出ボタン: 固定位置 */}
            <Box flex="0 0 auto" p={3} bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE}>
              <AppButton
                size="sm"
                variant="ghost"
                w="100%"
                onClick={async () => {
                  await leaveRoom();
                  router.push("/");
                }}
              >
                退出してロビーへ
              </AppButton>
            </Box>
          </Box>
        }
        handArea={
          <Box
            w="100%"
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {room.status === "clue" && me ? (
              <Flex
                w="100%"
                h="100%"
                align="center"
                justify="center"
                gap={{ base: 2, md: 4 }}
                direction={{ base: "column", lg: "row" }}
                minH={0}
              >
                {/* 中央: カードと入力エリア */}
                <Flex
                  align="center"
                  gap={{ base: 2, md: 4 }}
                  flexShrink={0}
                  minW={0}
                  direction={{ base: "row", md: "row" }}
                >
                  <SelfNumberCard value={me.number} draggableId={me.id} />

                  {/* コンパクトなClue入力エリア */}
                  <Flex align="center" gap={2} minW={0} flex="1">
                    <Text
                      fontSize="sm"
                      color="fgMuted"
                      flexShrink={0}
                      display={{ base: "none", md: "block" }}
                    >
                      連想:
                    </Text>
                    <ClueInputMini
                      roomId={roomId}
                      playerId={me.id}
                      currentValue={me?.clue1 || ""}
                    />
                  </Flex>

                  {/* 🎮 ホスト操作: 一括判定ボタン */}
                  {isHost && room.options?.resolveMode === "sort-submit" && (
                    <Box
                      px={3}
                      py={2}
                      bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE}
                      rounded="md"
                      boxShadow={UNIFIED_LAYOUT.ELEVATION.PANEL.SUBTLE}
                    >
                      <Button
                        colorPalette="teal"
                        size="sm"
                        w="100%"
                        onClick={async () => {
                          const proposal: string[] =
                            (room as any)?.order?.proposal || [];
                          if (proposal.length === 0) {
                            notify({
                              title: "まだカードが場にありません",
                              type: "info",
                            });
                            return;
                          }
                          const assigned = players
                            .filter(
                              (p) => typeof (p as any).number === "number"
                            )
                            .map((p) => p.id);
                          if (assigned.length !== proposal.length) {
                            notify({
                              title: "まだ全員のカードが場に出ていません",
                              type: "warning",
                            });
                            return;
                          }
                          try {
                            await submitSortedOrder(roomId, proposal);
                            notify({
                              title: "一括判定を実行",
                              type: "success",
                            });
                          } catch (err: any) {
                            notify({
                              title: "一括判定失敗",
                              description: err?.message,
                              type: "error",
                            });
                          }
                        }}
                      >
                        🎯 せーので判定！
                      </Button>
                    </Box>
                  )}
                </Flex>
              </Flex>
            ) : room.status === "playing" ? (
              <Text fontSize="sm" color="fgMuted" textAlign="center">
                下部の場パネルで「出す」を実行してください。
              </Text>
            ) : room.status === "waiting" ? (
              <Text fontSize="sm" color="fgMuted" textAlign="center">
                ゲーム開始をお待ちください...
              </Text>
            ) : (
              <Text fontSize="sm" color="fgMuted" textAlign="center">
                ゲーム準備中...
              </Text>
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
