"use client";
import { ChatPanel } from "@/components/ChatPanel";
import { CluePanel } from "@/components/CluePanel";
import { Hud } from "@/components/Hud";
import { PlayBoard } from "@/components/PlayBoard";
import PhaseHeader from "@/components/site/PhaseHeader";
// import { PlayerList } from "@/components/PlayerList";
import { Participants } from "@/components/Participants";
import { ResultPanel } from "@/components/ResultPanel";
import { RoomOptionsEditor } from "@/components/RoomOptions";
import PhaseTips from "@/components/site/PhaseTips";
import { SortBoard } from "@/components/SortBoard";
import { TopicDisplay } from "@/components/TopicDisplay";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { Panel } from "@/components/ui/Panel";
import Tooltip from "@/components/ui/Tooltip";
import { useAuth } from "@/context/AuthContext";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  resetPlayerState,
  setPlayerNameAvatar,
  updateLastSeen,
} from "@/lib/firebase/players";
import { forceDetachAll, presenceSupported } from "@/lib/firebase/presence";
import {
  leaveRoom as leaveRoomAction,
  resetRoomToWaiting,
  setRoomOptions,
} from "@/lib/firebase/rooms";
import {
  continueAfterFail as continueAfterFailAction,
  setOrderProposal,
  startGame as startGameAction,
  startPlaying as startPlayingAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import { useRoomState } from "@/lib/hooks/useRoomState";
import { assignNumberIfNeeded } from "@/lib/services/roomService";
import type { RoomDoc } from "@/lib/types";
import { randomAvatar } from "@/lib/utils";
import {
  Box,
  Container,
  Grid,
  HStack,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

  const canStartPlaying = Boolean(
    isHost &&
      room?.status === "clue" &&
      enoughPlayers &&
      allNumbersDealt &&
      allCluesReady
  );

  const startDisabledTitle = !canStartPlaying
    ? !enoughPlayers
      ? "プレイヤーは2人以上必要です"
      : !allNumbersDealt
      ? "お題選択後に数字を配ってから開始できます"
      : !allCluesReady
      ? "全員が更新（準備完了）すると開始できます"
      : undefined
    : undefined;

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

  const updateOptions = async (partial: RoomDoc["options"]) => {
    if (!isHost || !room) return;
    await setRoomOptions(roomId, partial);
  };

  // 並べ替え一括判定モード: 提案順序のローカル状態
  const [proposal, setProposal] = useState<string[]>(() => {
    const base = (room as any)?.order?.proposal as string[] | undefined;
    const dealList = (room as any)?.deal?.players as string[] | undefined;
    return base && base.length > 0
      ? base
      : dealList || players.map((p) => p.id);
  });
  // 部屋・プレイヤーの変化で提案初期化
  useEffect(() => {
    const base = (room as any)?.order?.proposal as string[] | undefined;
    const dealList = (room as any)?.deal?.players as string[] | undefined;
    setProposal(
      base && base.length > 0 ? base : dealList || players.map((p) => p.id)
    );
  }, [
    room?.id,
    (room as any)?.deal?.players?.length,
    players.map((p) => p.id).join(","),
  ]);

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
  if (!firebaseEnabled || loading || !room) {
    return (
      <Container
        maxW="container.xl"
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {!firebaseEnabled ? (
          <Text>
            Firebase設定が見つかりません。`.env.local` を設定してください。
          </Text>
        ) : (
          <Spinner />
        )}
      </Container>
    );
  }
  // 途中参加OKのため、ブロック画面は表示しない

  return (
    <Container
      maxW="container.xl"
      h="100dvh"
      py={0}
      display="flex"
      flexDir="column"
      overflow="hidden"
    >
      {/* 背景レイヤー */}
      <div className="stage-bg" aria-hidden>
        <div className="particles parallax-1" />
      </div>

      {/* HUD */}
      <Hud
        roomName={room.name}
        phase={room.status}
        activeCount={onlinePlayers.length}
        totalCount={players.length}
        remainMs={null}
        totalMs={null}
        hostPrimary={
          isHost
            ? room.status === "waiting"
              ? { label: "開始", onClick: startGame }
              : room.status === "clue"
              ? {
                  label: "並べ替え開始",
                  onClick: () => startPlayingAction(roomId),
                  disabled: !canStartPlaying,
                  title: startDisabledTitle,
                }
              : room.status === "finished"
              ? { label: "もう一度", onClick: resetToWaiting }
              : null
            : null
        }
      />
      <PhaseHeader phase={room.status as any} />

      <Box flex="1" overflow="hidden" minH={0} px={{ base: 3, md: 4 }} py={3}>
        <Grid
          templateColumns={{
            base: "1fr",
            md: "340px 1fr 360px",
            lg: "360px 1fr 400px",
          }}
          gap={4}
          h="100%"
        >
          <Stack
            gridColumn={{ base: "auto", md: "span 1" }}
            overflowY="auto"
            maxH="100%"
          >
            <Panel
              title={`参加者人数: ${onlinePlayers.length}/${players.length}`}
            >
              <Participants players={onlinePlayers} />
            </Panel>

            <Panel title="オプション">
              <RoomOptionsEditor
                value={room.options}
                onChange={(v) => updateOptions(v)}
                disabled={!isHost || room.status !== "waiting"}
              />
              {isHost && (
                <Stack mt={3}>
                  <AppButton variant="outline" onClick={resetToWaiting}>
                    リセット
                  </AppButton>
                </Stack>
              )}
            </Panel>

            {isHost && room.status === "waiting" && (
              <AppButton colorPalette="orange" onClick={startGame}>
                ゲーム開始
              </AppButton>
            )}

            {room.status === "finished" && (
              <Stack>
                {isHost && (
                  <AppButton onClick={resetToWaiting}>もう一度</AppButton>
                )}
              </Stack>
            )}
          </Stack>

          <Box
            gridColumn={{ base: "auto", md: "span 1" }}
            overflowY="auto"
            maxH="100%"
          >
            {room.status === "waiting" && (
              <Panel>
                <Text>ホストがゲーム開始するまでお待ちください</Text>
                <PhaseTips phase="waiting" />
              </Panel>
            )}

            {room.status === "clue" && me && (
              <Stack gap={4}>
                <TopicDisplay roomId={roomId} room={room} isHost={isHost} />
                <CluePanel roomId={roomId} me={me} />
                {/* ヒントパネルを削除（UIが圧迫されるため） */}
                {Array.isArray((room as any)?.deal?.players) && (
                  <>
                    {room.options.resolveMode === "sort-submit" ? (
                      <SortBoard
                        players={players}
                        proposal={proposal}
                        onChange={(list) => {
                          setProposal(list);
                          // ベストエフォートで共有
                          setOrderProposal(roomId, list).catch(() => void 0);
                        }}
                        onConfirm={async () => {
                          try {
                            await submitSortedOrder(roomId, proposal);
                            notify({
                              title: "並び順で判定しました",
                              type: "success",
                            });
                          } catch (e: any) {
                            notify({
                              title: "確定に失敗しました",
                              description: e?.message || String(e),
                              type: "error",
                            });
                          }
                        }}
                        disabled={!isHost || !canStartPlaying}
                      />
                    ) : (
                      isHost && (
                        <Stack>
                          <AppButton
                            colorPalette="orange"
                            onClick={() => startPlayingAction(roomId)}
                            disabled={!canStartPlaying}
                            title={startDisabledTitle}
                            aria-disabled={!canStartPlaying}
                          >
                            順番出しを開始
                          </AppButton>
                          {!canStartPlaying && (
                            <Text fontSize="sm" color="gray.300">
                              未準備のプレイヤー:{" "}
                              {players
                                .filter((p) => !p.ready)
                                .map((p) => p.name)
                                .join(", ") || "なし"}
                            </Text>
                          )}
                        </Stack>
                      )
                    )}
                  </>
                )}
              </Stack>
            )}

            {room.status === "finished" && (
              <Stack gap={4}>
                <Panel title="結果">
                  <Text
                    fontWeight="bold"
                    color={room.result?.success ? "green.300" : "red.300"}
                  >
                    {room.result?.success ? "クリア！" : "失敗です！！"}
                  </Text>
                  <Text fontSize="sm" color="gray.400" mt={2}>
                    {room.result?.success ? "" : "どんまい！また遊んでね！！"}
                  </Text>

                  {room.result?.success === false &&
                    isHost &&
                    remainingCount > 0 && (
                      <HStack mt={3}>
                        <Tooltip
                          content="失敗しても残りのプレイヤーは最後まで出せます。並べ替えで再挑戦します."
                          showArrow
                        >
                          <AppButton
                            onClick={continueAfterFail}
                            colorPalette="orange"
                          >
                            続けて並べ替える
                          </AppButton>
                        </Tooltip>
                      </HStack>
                    )}
                </Panel>
                <ResultPanel
                  players={players}
                  orderList={room.order?.list || []}
                />
              </Stack>
            )}

            {room.status === "playing" && (
              <>
                <Panel title="コツ">
                  <PhaseTips phase="playing" />
                </Panel>
                <PlayBoard
                  roomId={roomId}
                  players={players}
                  meId={meId}
                  orderList={room.order?.list || []}
                  isHost={isHost}
                  failed={!!room.order?.failed}
                  failedAt={room.order?.failedAt ?? null}
                  eligibleIds={eligibleIds}
                />
              </>
            )}
          </Box>

          <Box
            gridColumn={{ base: "auto", md: "span 1" }}
            overflowY="auto"
            maxH="100%"
          >
            <ChatPanel roomId={roomId} height="clamp(240px, 40dvh, 420px)" />
            <HStack mt={3}>
              <AppButton
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await leaveRoom();
                  router.push("/");
                }}
              >
                退出してロビーへ
              </AppButton>
            </HStack>
          </Box>
        </Grid>
      </Box>
    </Container>
  );
}
