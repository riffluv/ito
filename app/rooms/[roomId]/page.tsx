"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch, where } from "firebase/firestore";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { PlayerList } from "@/components/PlayerList";
import { ChatPanel } from "@/components/ChatPanel";
import { RoomOptionsEditor } from "@/components/RoomOptions";
import { GameBoard } from "@/components/GameBoard";
import { randomAvatar } from "@/lib/utils";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const { user, displayName } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

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
    const unsubPlayers = onSnapshot(query(collection(db, "rooms", roomId, "players"), orderBy("uid", "asc")), (snap) => {
      const list: (PlayerDoc & { id: string })[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as PlayerDoc) }));
      setPlayers(list);
      setLoading(false);
    });
    return () => { unsubRoom(); unsubPlayers(); };
  }, [roomId]);

  // 自動参加（自分のプレイヤードキュメントが無ければ作成）
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    (async () => {
      const pRef = doc(db, "rooms", roomId, "players", user.uid);
      const p = await getDoc(pRef);
      if (!p.exists()) {
        const newPlayer: PlayerDoc = {
          name: displayName || "匿名",
          avatar: randomAvatar(displayName || user.uid.slice(0, 6)),
          number: null,
          clue1: "",
          clue2: "",
          ready: false,
          orderIndex: 0,
          uid: user.uid,
          lastSeen: serverTimestamp(),
        };
        await setDoc(pRef, newPlayer);
        await updateDoc(doc(db, "rooms", roomId), { lastActiveAt: serverTimestamp() });
        await addDoc(collection(db, "rooms", roomId, "chat"), {
          sender: "system",
          text: `${newPlayer.name} が参加しました`,
          createdAt: serverTimestamp(),
        });
      }
      // 重複プレイヤーDocの自動クリーン（古い実装の残り）
      const dupQ = query(collection(db, "rooms", roomId, "players"), where("uid", "==", user.uid));
      const dupSnap = await getDocs(dupQ);
      for (const d of dupSnap.docs) {
        if (d.id !== user.uid) {
          await deleteDoc(doc(db, "rooms", roomId, "players", d.id));
        }
      }
    })();
  }, [user, displayName, roomId]);

  const meId = user?.uid || "";
  const me = players.find((p) => p.id === meId);
  const isHost = !!(room && user && room.hostId === user.uid);
  const isAllReady = players.length > 0 && players.every((p) => p.ready);

  // 各クライアントが自分のnumber/readyを自律的に更新する
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    if (!user) return;
    const meRef = doc(db, "rooms", roomId, "players", user.uid);
    const me = players.find((p) => p.id === user.uid);
    const deal = room.deal;
    if (deal && me && (me.number === null || me.number === undefined)) {
      const ordered = players.slice().sort((a,b)=> (a.uid||a.id).localeCompare(b.uid||b.id));
      const idx = ordered.findIndex((p) => p.id === user.uid);
      if (idx >= 0) {
        const nums = generateDeterministicNumbers(ordered.length, deal.min, deal.max, deal.seed);
        const myNum = nums[idx];
        updateDoc(meRef, { number: myNum, clue1: "", clue2: "", ready: false, orderIndex: 0 }).catch(()=>void 0);
      }
    }
  }, [room?.status, room?.deal?.seed, players.length, user?.uid]);

  // ラウンドが進んだら自分のreadyをリセット
  const [seenRound, setSeenRound] = useState<number>(0);
  useEffect(() => {
    if (!room || !user) return;
    const r = room.round || 0;
    if (r !== seenRound) {
      setSeenRound(r);
      const meRef = doc(db, "rooms", roomId, "players", user.uid);
      updateDoc(meRef, { ready: false }).catch(()=>void 0);
    }
  }, [room?.round, user?.uid]);

  // プレゼンス: ハートビートでlastSeen更新
  useEffect(() => {
    if (!user) return;
    const meRef = doc(db, "rooms", roomId, "players", user.uid);
    const tick = () => updateDoc(meRef, { lastSeen: serverTimestamp() }).catch(()=>void 0);
    const id = setInterval(tick, 15000);
    tick();
    return () => clearInterval(id);
  }, [user?.uid, roomId]);

  // waitingに戻ったら自分のフィールドを初期化
  useEffect(() => {
    if (!room || room.status !== "waiting" || !user) return;
    const me = players.find((p) => p.id === user.uid);
    if (!me) return;
    const meRef = doc(db, "rooms", roomId, "players", user.uid);
    if (me.number !== null || me.clue1 || me.clue2 || me.ready || me.orderIndex !== 0) {
      updateDoc(meRef, { number: null, clue1: "", clue2: "", ready: false, orderIndex: 0 }).catch(()=>void 0);
    }
  }, [room?.status, user?.uid]);

  const startGame = async () => {
    try {
      if (!room || !isHost) {
        toast({ title: "ホストのみ開始できます", status: "warning" });
        return;
      }
      if (players.length < 2) {
        toast({ title: "プレイヤーは2人以上必要です", status: "info" });
        return;
      }
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await updateDoc(doc(db, "rooms", roomId), {
        status: "playing",
        result: null,
        deal: { seed, min: 1, max: 100 },
        round: (room.round || 0) + 1,
      });
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

  const finalize = async (success: boolean) => {
    if (!isHost) return;
    await updateDoc(doc(db, "rooms", roomId), {
      status: "finished",
      result: { success, revealedAt: serverTimestamp() },
    });
  };

  const resetToWaiting = async () => {
    if (!isHost) return;
    await updateDoc(doc(db, "rooms", roomId), {
      status: "waiting",
      result: null,
      deal: null,
      round: 0,
    });
  };

  const continueAfterFail = async () => {
    await updateDoc(doc(db, "rooms", roomId), {
      status: "playing",
      result: null,
      round: (room?.round || 0) + 1,
    });
  };

  const updateOptions = async (partial: RoomDoc["options"]) => {
    if (!isHost || !room) return;
    await updateDoc(doc(db, "rooms", roomId), { options: partial });
  };

  // 表示名が変わったら、入室中の自分のプレイヤーDocにも反映
  useEffect(() => {
    if (!user) return;
    const meRef = doc(db, "rooms", roomId, "players", user.uid);
    if (displayName) {
      updateDoc(meRef, { name: displayName, avatar: randomAvatar(displayName) }).catch(()=>void 0);
    }
  }, [displayName, user?.uid, roomId]);

  const leaveRoom = async () => {
    if (!user) return;
    try {
      const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
      const all = playersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as (PlayerDoc & { id: string })[];
      const others = all.filter(p => p.id !== user.uid);

      // ホスト移譲（最後の1人でも即削除はしない。残存時間のため残す）
      if (room && room.hostId === user.uid && others.length > 0) {
        await updateDoc(doc(db, "rooms", roomId), { hostId: others[0].id });
      }

      // 自分を退室
      await deleteDoc(doc(db, "rooms", roomId, "players", user.uid));

      // ルームの最終アクティブを更新（一定時間ロビーに残す）
      await updateDoc(doc(db, "rooms", roomId), { lastActiveAt: serverTimestamp() });

      // チャットに退出ログ
      await addDoc(collection(db, "rooms", roomId, "chat"), {
        sender: "system",
        text: `${displayName || "匿名"} が退出しました`,
        createdAt: serverTimestamp(),
      });
    } catch (_) {}
  };

  useEffect(() => {
    const handler = () => {
      if (!user) return;
      // ベストエフォート: 現在のメモリ上のプレイヤー情報を使って移譲→退出を試行
      const run = async () => {
        try {
          const others = players.filter(p => p.id !== user.uid);
          if (room && room.hostId === user.uid && others.length > 0) {
            await updateDoc(doc(db, "rooms", roomId), { hostId: others[0].id });
          }
          await deleteDoc(doc(db, "rooms", roomId, "players", user.uid));
          await updateDoc(doc(db, "rooms", roomId), { lastActiveAt: serverTimestamp() });
        } catch {}
      };
      // fire-and-forget（ブラウザは待たない）
      run();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user?.uid, roomId, players.map(p=>p.id).join(","), room?.hostId]);

  if (!firebaseEnabled) {
    return (
      <Container maxW="container.lg" py={10}><Text>Firebase設定が見つかりません。`.env.local` を設定してください。</Text></Container>
    );
  }
  if (loading || !room) {
    return (
      <Container maxW="container.lg" py={10}><Spinner /></Container>
    );
  }

  return (
    <Container maxW="container.xl" py={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">{room.name}</Heading>
        <HStack>
          <Button
            onClick={async () => {
              await leaveRoom();
              router.push("/");
            }}
          >
            退出してロビーへ
          </Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
        <Stack gridColumn={{ base: "auto", md: "span 1" }}>
          <Box p={3} borderWidth="1px" rounded="md" bg="blackAlpha.400">
            <Heading size="sm" mb={2}>参加者</Heading>
            <PlayerList players={players} />
          </Box>

          <Box p={3} borderWidth="1px" rounded="md" bg="blackAlpha.400">
            <Heading size="sm" mb={2}>オプション</Heading>
            <RoomOptionsEditor value={room.options} onChange={(v) => updateOptions(v)} disabled={!isHost || room.status !== "waiting"} />
          </Box>

          {isHost && room.status === "waiting" && (
            <Button colorScheme="blue" onClick={startGame}>ゲーム開始</Button>
          )}

          {room.status === "finished" && (
            <Stack>
              {isHost && <Button onClick={resetToWaiting}>もう一度</Button>}
              <Button onClick={async () => { await leaveRoom(); router.push("/"); }}>退出してロビーへ</Button>
            </Stack>
          )}
        </Stack>

        <Box gridColumn={{ base: "auto", md: "span 2" }}>
          {room.status === "waiting" && (
            <Box p={6} borderWidth="1px" rounded="md" bg="blackAlpha.300" textAlign="center">
              <Text>ホストがゲーム開始するまでお待ちください</Text>
            </Box>
          )}

          {room.status === "playing" && me && !isAllReady && (
            <GameBoard
              roomId={roomId}
              meId={meId}
              options={room.options}
              players={players}
              isAllReady={false}
              onAllReady={() => void 0}
              reveal={false}
              canFinalize={false}
              isHost={isHost}
            />
          )}

          {room.status === "finished" && (
            <Box p={4} borderWidth="1px" rounded="md" bg="blackAlpha.400">
              <Heading size="sm" mb={2}>結果</Heading>
              <Text fontWeight="bold" color={room.result?.success ? "green.300" : "red.300"}>
                {room.result?.success ? "クリア！" : "失敗…"}
              </Text>
              {room.result?.success === false && room.options.allowContinueAfterFail && isHost && (
                <HStack mt={3}>
                  <Button onClick={continueAfterFail} colorScheme="blue">続けて並べ替える</Button>
                </HStack>
              )}
            </Box>
          )}

          {/* 全員確認済みになったら結果を確定するUI（ホスト） */}
          {room.status === "playing" && isAllReady && (
            <Box mt={4}>
              <GameBoard
                roomId={roomId}
                meId={meId}
                options={room.options}
                players={players}
                isAllReady={true}
                reveal={true}
                canFinalize={isHost}
                onFinalize={finalize}
                isHost={isHost}
              />
            </Box>
          )}
        </Box>

        <Box gridColumn={{ base: "auto", md: "span 3" }}>
          <ChatPanel roomId={roomId} />
        </Box>
      </SimpleGrid>
    </Container>
  );
}

function mulberry32(a: number) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateDeterministicNumbers(count: number, min: number, max: number, seed: string): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const rnd = mulberry32(hashString(seed));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
