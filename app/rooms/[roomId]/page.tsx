"use client";
import { ChatPanel } from "@/components/ChatPanel";
import { CluePanel } from "@/components/CluePanel";
import { PlayBoard } from "@/components/PlayBoard";
import { PlayerList } from "@/components/PlayerList";
import { ResultPanel } from "@/components/ResultPanel";
import { RoomOptionsEditor } from "@/components/RoomOptions";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  resetPlayerState,
  setPlayerNameAvatar,
  updateLastSeen,
} from "@/lib/firebase/players";
import { presenceSupported } from "@/lib/firebase/presence";
import {
  leaveRoom as leaveRoomAction,
  resetRoomToWaiting,
  setRoomOptions,
  updateLastActive,
} from "@/lib/firebase/rooms";
import { generateDeterministicNumbers } from "@/lib/game/random";
import {
  continueAfterFail as continueAfterFailAction,
  startGame as startGameAction,
  startPlaying as startPlayingAction,
} from "@/lib/game/room";
import { usePresence } from "@/lib/hooks/usePresence";
import { ACTIVE_WINDOW_MS, isActive, toMillis } from "@/lib/time";
// お題候補の提示はTopicDisplayで実施
import { Hud } from "@/components/Hud";
import { SortBoard } from "@/components/SortBoard";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { randomAvatar } from "@/lib/utils";
import {
  Box,
  Button,
  Container,
  Grid,
  HStack,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const { user, displayName } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const leavingRef = useRef(false);

  // 再入室時に退出フラグをリセット（必ずコンポーネント内で実行）
  useEffect(() => {
    leavingRef.current = false;
  }, [roomId, user?.uid]);

  // アクティブ人数（lastSeenが直近60秒以内）
  const activeCount = useMemo(() => {
    const now = Date.now();
    let active = 0;
    players.forEach((p) => {
      if (isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)) active += 1;
    });
    return active;
  }, [
    players.map((p) => p.id).join(","),
    players.map((p: any) => toMillis(p?.lastSeen)).join(","),
  ]);

  // 参加メンバーかの判定（早めに計算）
  const isMember = useMemo(
    () => !!(user && players.some((p) => p.id === user.uid)),
    [user?.uid, players.map((p) => p.id).join(",")]
  );

  // presence（オンライン）
  const { onlineUids, detachNow } = usePresence(
    roomId,
    user?.uid || null,
    isMember
  );

  // サブスクライブ
  useEffect(() => {
    if (!firebaseEnabled) return;
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom({ id: snap.id, ...(snap.data() as RoomDoc) });
    });
    const unsubPlayers = onSnapshot(
      query(collection(db, "rooms", roomId, "players"), orderBy("uid", "asc")),
      (snap) => {
        const list: (PlayerDoc & { id: string })[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as PlayerDoc) })
        );
        setPlayers(list);
        setLoading(false);
      }
    );
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId]);

  // RTDB presence は usePresence に集約済み

  // 自動参加（自分のプレイヤードキュメントが無ければ作成）
  useEffect(() => {
    if (!firebaseEnabled || !user || !room) return;
    if (leavingRef.current) return; // 退出処理中は参加を作らない
    (async () => {
      const pRef = doc(db, "rooms", roomId, "players", user.uid);
      const p = await getDoc(pRef);
      // 途中参加は不可: waiting 以外では新規作成しない
      if (!p.exists()) {
        // 例外: アクティブな参加者がいない場合は再開用に参加を許可（presence/lastSeen併用）
        const hasActiveMembers =
          (Array.isArray(onlineUids) && onlineUids.length > 0) ||
          activeCount > 0;
        if (room.status !== "waiting" && hasActiveMembers) return;
        const newPlayer: PlayerDoc = {
          name: displayName || "匿名",
          avatar: randomAvatar(displayName || user.uid.slice(0, 6)),
          number: null,
          clue1: "",
          ready: false,
          orderIndex: 0,
          uid: user.uid,
          lastSeen: serverTimestamp(),
        };
        await setDoc(pRef, newPlayer);
        // presence の開始は usePresence 側に委譲
        await updateLastActive(roomId);
        await sendMessage(roomId, "system", `${newPlayer.name} が参加しました`);
        // アクティブ参加者ゼロからの参加なら部屋を待機に戻す
        if (!hasActiveMembers && room.status !== "waiting") {
          try {
            await updateDoc(doc(db, "rooms", roomId), {
              status: "waiting",
              result: null,
              deal: null,
              order: null,
              round: 0,
              topic: null,
              topicOptions: null,
              topicBox: null,
            });
          } catch {}
        }
      }
      // 重複プレイヤーDocの自動クリーン（古い実装の残り）
      const dupQ = query(
        collection(db, "rooms", roomId, "players"),
        where("uid", "==", user.uid)
      );
      const dupSnap = await getDocs(dupQ);
      for (const d of dupSnap.docs) {
        if (d.id !== user.uid) {
          await deleteDoc(doc(db, "rooms", roomId, "players", d.id));
        }
      }
    })();
  }, [
    user?.uid,
    displayName,
    roomId,
    room?.status,
    Array.isArray(onlineUids) ? onlineUids.join(",") : "",
    activeCount,
  ]);

  const meId = user?.uid || "";
  const me = players.find((p) => p.id === meId);
  const isHost = !!(room && user && room.hostId === user.uid);
  const isAllReady = players.length > 0 && players.every((p) => p.ready);

  // deal.players と seed に基づき、各自が自分の番号を設定（重複なし）
  useEffect(() => {
    if (!room || room.status !== "clue") return;
    if (!user) return;
    const deal: any = room.deal;
    if (!deal || !Array.isArray(deal.players) || !deal.seed) return;
    const meRef = doc(db, "rooms", roomId, "players", user.uid);
    const idx = (deal.players as string[]).indexOf(user.uid);
    if (idx < 0) return; // 今回の配布対象外（途中参加など）
    const my = players.find((p) => p.id === user.uid);
    if (!my) return;
    const nums = generateDeterministicNumbers(
      deal.players.length,
      deal.min || 1,
      deal.max || 100,
      deal.seed
    );
    const myNum = nums[idx];
    if (my.number !== myNum) {
      updateDoc(meRef, {
        number: myNum,
        clue1: my.clue1 || "",
        ready: false,
        orderIndex: 0,
      }).catch(() => void 0);
    }
  }, [
    room?.deal?.seed,
    room?.deal && (room?.deal as any)?.players?.join(","),
    room?.status,
    user?.uid,
    players.map((p) => p.id + ":" + (p.number ?? "")).join(","),
  ]);

  const presenceOn = presenceSupported();
  const onlinePlayers = useMemo(() => {
    if (presenceOn) {
      if (!Array.isArray(onlineUids)) return players; // presence未到着
      const set = new Set(onlineUids);
      return players.filter((p) => set.has(p.id)); // [] -> 空
    }
    const now = Date.now();
    return players.filter((p) =>
      isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
    );
  }, [presenceOn, players, onlineUids]);

  const allNumbersDealt =
    !!room?.topic &&
    !!room?.deal &&
    Array.isArray((room.deal as any).players) &&
    onlinePlayers.every((p) => typeof p.number === "number");

  // 準備完了（ready）はオンライン参加者のみを対象に判定
  const allCluesReady =
    onlinePlayers.length > 0 && onlinePlayers.every((p) => p.ready === true);
  const enoughPlayers = onlinePlayers.length >= 2;

  const canStartPlaying =
    isHost &&
    room.status === "clue" &&
    enoughPlayers &&
    allNumbersDealt &&
    allCluesReady;

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
    if (!room || !user) return;
    const r = room.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db, "rooms", roomId, "players", user.uid);
      updateDoc(meRef, { ready: false }).catch(() => void 0);
    }
  }, [room?.round, user?.uid]);

  // プレゼンス: ハートビートでlastSeen更新（presence未対応環境のみ）
  useEffect(() => {
    if (!user) return;
    if (presenceSupported()) return;
    const tick = () => updateLastSeen(roomId, user.uid).catch(() => void 0);
    const id = setInterval(tick, 15000);
    tick();
    return () => clearInterval(id);
  }, [user?.uid, roomId]);

  // waitingに戻ったら自分のフィールドを初期化
  useEffect(() => {
    if (!room || room.status !== "waiting" || !user) return;
    const me = players.find((p) => p.id === user.uid);
    if (!me) return;
    if (me.number !== null || me.clue1 || me.ready || me.orderIndex !== 0) {
      resetPlayerState(roomId, user.uid).catch(() => void 0);
    }
  }, [room?.status, user?.uid]);

  const startGame = async () => {
    try {
      if (!room || !isHost) {
        toast({ title: "ホストのみ開始できます", status: "warning" });
        return;
      }
      if (onlinePlayers.length < 2) {
        toast({ title: "プレイヤーは2人以上必要です", status: "info" });
        return;
      }
      await updateDoc(doc(db, "rooms", roomId), {
        round: (room.round || 0) + 1,
      });
      await startGameAction(roomId);
      toast({ title: "ゲーム開始", status: "success" });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "ゲーム開始に失敗しました",
        description: e?.message || "権限またはFirestoreルールをご確認ください",
        status: "error",
      });
    }
  };

  // finalizeはRevealPanel側で処理

  const resetToWaiting = async () => {
    if (!isHost) return;
    await resetRoomToWaiting(roomId);
  };

  const continueAfterFail = async () => {
    await updateDoc(doc(db, "rooms", roomId), {
      round: (room?.round || 0) + 1,
    });
    await continueAfterFailAction(roomId);
  };

  const updateOptions = async (partial: RoomDoc["options"]) => {
    if (!isHost || !room) return;
    await setRoomOptions(roomId, partial);
  };

  // 表示名が変わったら、入室中の自分のプレイヤーDocにも反映
  useEffect(() => {
    if (!user) return;
    if (displayName) {
      setPlayerNameAvatar(
        roomId,
        user.uid,
        displayName,
        randomAvatar(displayName)
      ).catch(() => void 0);
    }
  }, [displayName, user?.uid, roomId]);

  const leaveRoom = async () => {
    if (!user) return;
    try {
      leavingRef.current = true;
      // presence detach（即時反映）
      try {
        await detachNow();
      } catch {}
      await leaveRoomAction(roomId, user.uid, displayName);
    } catch {}
  };

  // 終了はサーバー側トランザクションが判定

  useEffect(() => {
    const handler = () => {
      if (!user) return;
      leavingRef.current = true;
      const run = async () => {
        try {
          try {
            await detachNow();
          } catch {}
          const others = players.filter((p) => p.id !== user.uid);
          if (room && room.hostId === user.uid && others.length > 0) {
            await updateDoc(doc(db, "rooms", roomId), { hostId: others[0].id });
          }
          // 自分の重複Docも含めて削除
          const dupQ = query(
            collection(db, "rooms", roomId, "players"),
            where("uid", "==", user.uid)
          );
          const dupSnap = await getDocs(dupQ);
          await Promise.all(
            dupSnap.docs.map((d) =>
              deleteDoc(doc(db, "rooms", roomId, "players", d.id))
            )
          );
          await updateDoc(doc(db, "rooms", roomId), {
            lastActiveAt: serverTimestamp(),
          });
        } catch {}
      };
      run();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user?.uid, roomId, players.map((p) => p.id).join(","), room?.hostId]);

  // ルームページのアンマウント時にもベストエフォートで退室処理
  useEffect(() => {
    return () => {
      const uid = user?.uid;
      if (!uid) return;
      leavingRef.current = true;
      const cleanup = async () => {
        try {
          try {
            await detachNow();
          } catch {}
          const dupQ = query(
            collection(db, "rooms", roomId, "players"),
            where("uid", "==", uid)
          );
          const dupSnap = await getDocs(dupQ);
          await Promise.all(
            dupSnap.docs.map((d) =>
              deleteDoc(doc(db, "rooms", roomId, "players", d.id))
            )
          );
          await updateDoc(doc(db, "rooms", roomId), {
            lastActiveAt: serverTimestamp(),
          });
        } catch {}
      };
      cleanup();
    };
  }, [user?.uid, roomId]);

  // isMember は上で算出済み

  // ラウンド対象（オンラインの参加者のみ）
  const onlineSet = new Set(
    Array.isArray(onlineUids) ? onlineUids : onlinePlayers.map((p) => p.id)
  );
  const baseIds = Array.isArray((room as any)?.deal?.players)
    ? ((room as any).deal.players as string[])
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
  if (
    room.status !== "waiting" &&
    !isMember &&
    ((Array.isArray(onlineUids) && onlineUids.length > 0) || activeCount > 0)
  ) {
    return (
      <Container
        maxW="container.md"
        h="100dvh"
        py={3}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Panel title="入室できません">
          <Stack>
            <Text>この部屋は現在ゲーム進行中のため、途中参加できません。</Text>
            <HStack>
              <Button onClick={() => router.push("/")}>ロビーへ戻る</Button>
            </HStack>
          </Stack>
        </Panel>
      </Container>
    );
  }

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

      <Box flex="1" overflow="hidden" minH={0} px={{ base: 3, md: 4 }} py={3}>
        <Grid
          templateColumns={{ base: "1fr", md: "280px 1fr 360px" }}
          gap={4}
          h="100%"
        >
          <Stack
            gridColumn={{ base: "auto", md: "span 1" }}
            overflowY="auto"
            maxH="100%"
          >
            <Panel title="参加者">
              <PlayerList
                players={onlinePlayers}
                online={onlineUids}
                myId={meId}
              />
            </Panel>

            <Panel title="オプション">
              <RoomOptionsEditor
                value={room.options}
                onChange={(v) => updateOptions(v)}
                disabled={!isHost || room.status !== "waiting"}
              />
              {isHost && (
                <Stack mt={3}>
                  <Button variant="outline" onClick={resetToWaiting}>
                    リセット
                  </Button>
                </Stack>
              )}
            </Panel>

            {isHost && room.status === "waiting" && (
              <Button colorScheme="orange" onClick={startGame}>
                ゲーム開始
              </Button>
            )}

            {room.status === "finished" && (
              <Stack>
                {isHost && <Button onClick={resetToWaiting}>もう一度</Button>}
                <Button
                  onClick={async () => {
                    await leaveRoom();
                    router.push("/");
                  }}
                >
                  退出してロビーへ
                </Button>
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
              </Panel>
            )}

            {room.status === "clue" && me && (
              <Stack spacing={4}>
                <TopicDisplay roomId={roomId} room={room} isHost={isHost} />
                <CluePanel roomId={roomId} me={me} />
                {/* 並べ替えの事前提案（ドラッグ操作に慣れる） */}
                {Array.isArray((room as any)?.deal?.players) && (
                  <SortBoard
                    players={players}
                    proposal={(room as any)?.deal?.players as string[]}
                    onChange={() => {
                      /* Firestoreへの保存は次段 */
                    }}
                    onConfirm={() => {}}
                    disabled
                  />
                )}
                {isHost && (
                  <Stack>
                    <Button
                      colorScheme="orange"
                      onClick={() => startPlayingAction(roomId)}
                      isDisabled={!canStartPlaying}
                      title={startDisabledTitle}
                    >
                      順番出しを開始
                    </Button>
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
                )}
              </Stack>
            )}

            {room.status === "finished" && (
              <Stack spacing={4}>
                <Panel title="結果">
                  <Text
                    fontWeight="bold"
                    color={room.result?.success ? "green.300" : "red.300"}
                  >
                    {room.result?.success ? "クリア！" : "失敗…"}
                  </Text>
                  {room.result?.success === false &&
                    room.options.allowContinueAfterFail &&
                    isHost &&
                    remainingCount > 0 && (
                      <HStack mt={3}>
                        <Button
                          onClick={continueAfterFail}
                          colorScheme="orange"
                        >
                          続けて並べ替える
                        </Button>
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
            )}
          </Box>

          <Box
            gridColumn={{ base: "auto", md: "span 1" }}
            overflowY="auto"
            maxH="100%"
          >
            <ChatPanel roomId={roomId} height="clamp(240px, 40dvh, 420px)" />
            <HStack mt={3}>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await leaveRoom();
                  router.push("/");
                }}
              >
                退出してロビーへ
              </Button>
            </HStack>
          </Box>
        </Grid>
      </Box>
    </Container>
  );
}
