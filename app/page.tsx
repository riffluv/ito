"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { CreateRoomModal } from "@/components/CreateRoomModal";

export default function LobbyPage() {
  const toast = useToast();
  const { user, loading, displayName, setDisplayName } = useAuth();
  const [rooms, setRooms] = useState<(RoomDoc & { id: string })[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const nameDialog = useDisclosure({ defaultIsOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [afterNameCreate, setAfterNameCreate] = useState<boolean>(false);

  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: (RoomDoc & { id: string })[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as RoomDoc) }));
        setRooms(list);
      },
      (err) => {
        console.error("rooms snapshot error", err);
        toast({
          title: "Firestoreの読み取りに失敗しました",
          description: err?.message || "権限またはルールを確認してください",
          status: "error",
        });
      }
    );
    return () => unsub();
  }, [firebaseEnabled, user]);

  // 各ルームの参加人数（playersサブコレクション）を監視（lastSeenでアクティブ推定）
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    const unsubs = rooms.map((r) =>
      onSnapshot(collection(db, "rooms", r.id, "players"), (snap) => {
        const now = Date.now();
        const threshold = now - 60_000; // 60秒以内をアクティブと見なす
        let active = 0;
        snap.forEach((d) => {
          const data: any = d.data();
          const ls = data?.lastSeen;
          // Timestamp型かDate型か数値型に対応
          const ms = ls?.toMillis ? ls.toMillis() : (ls instanceof Date ? ls.getTime() : (typeof ls === 'number' ? ls : 0));
          if (ms >= threshold) active += 1;
        });
        setPlayerCounts((prev) => ({ ...prev, [r.id]: active }));
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseEnabled, user, rooms.map((r) => r.id).join(",")]);

  // 初回ロードでの強制名入力は行わない（作成/参加時に促す）

  const canProceed = useMemo(() => !!(user && displayName), [user, displayName]);

  // 直近アクティブの部屋も残す（5分）
  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const grace = 5 * 60 * 1000;
    return rooms.filter((r) => {
      const active = playerCounts[r.id] ?? 0;
      const la = (r.lastActiveAt as any);
      const ms = la?.toMillis ? la.toMillis() : (la instanceof Date ? la.getTime() : (typeof la === 'number' ? la : 0));
      const recent = ms > 0 && (now - ms) <= grace;
      return active > 0 || recent;
    });
  }, [rooms, playerCounts]);

  return (
    <Container maxW="container.lg" py={10}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Online-ITO</Heading>
        <HStack>
          <HStack spacing={2} mr={2} color="gray.300">
            <Text fontSize="sm">名前: {displayName || "未設定"}</Text>
            <Button size="sm" variant="outline" onClick={() => {
              setTempName(displayName || "");
              setAfterNameCreate(false);
              setPendingJoin(null);
              nameDialog.onOpen();
            }}>変更</Button>
          </HStack>
          <Button
            colorScheme="brand"
            isDisabled={loading}
            onClick={() => {
              if (!displayName) {
                setAfterNameCreate(true);
                setPendingJoin(null);
                nameDialog.onOpen();
              } else {
                createDialog.onOpen();
              }
            }}
          >
            部屋を作る
          </Button>
        </HStack>
      </Flex>

      {!firebaseEnabled ? (
        <Box p={8} textAlign="center" borderWidth="1px" rounded="lg" bg="blackAlpha.300">
          <Text>Firebase設定が見つかりません。`.env.local` を設定してください。</Text>
        </Box>
      ) : loading ? (
        <Spinner />
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {filteredRooms.map((r) => (
            <Box key={r.id} p={4} borderWidth="1px" borderRadius="lg" bg="blackAlpha.400">
              <Stack>
                <Heading size="md">{r.name}</Heading>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.300">状態: {r.status}</Text>
                  <Text fontSize="sm" color="gray.300">人数: {playerCounts[r.id] ?? 0}人</Text>
                </HStack>
                <Button
                  colorScheme="blue"
                  onClick={() => {
                    if (!displayName) {
                      setAfterNameCreate(false);
                      setPendingJoin(r.id);
                      nameDialog.onOpen();
                    } else {
                      window.location.href = `/rooms/${r.id}`;
                    }
                  }}
                >
                  参加
                </Button>
              </Stack>
            </Box>
          ))}
          {filteredRooms.length === 0 && (
            <Box p={8} textAlign="center" borderWidth="1px" borderRadius="lg" bg="blackAlpha.300">
              <Text>公開ルームがありません。最初の部屋を作りましょう！</Text>
            </Box>
          )}
        </SimpleGrid>
      )}

      {/* 名前入力モーダル（作成/参加時に表示） */}
      {nameDialog.isOpen && (
        <Box position="fixed" inset={0} bg="blackAlpha.700" display="flex" alignItems="center" justifyContent="center">
          <Box bg="gray.800" p={6} rounded="lg" minW={{ base: "90%", md: "lg" }}>
            <Heading size="md" mb={3}>プレイヤー名を入力</Heading>
            <Stack direction={{ base: "column", md: "row" }}>
              <Input placeholder="例）たろう" value={tempName} onChange={(e) => setTempName(e.target.value)} />
              <Button
                colorScheme="blue"
                onClick={() => {
                  if (!tempName.trim()) {
                    toast({ title: "名前を入力してください", status: "warning" });
                    return;
                  }
                  setDisplayName(tempName.trim());
                  nameDialog.onClose();
                  if (pendingJoin) {
                    const to = `/rooms/${pendingJoin}`;
                    setPendingJoin(null);
                    setAfterNameCreate(false);
                    window.location.href = to;
                  } else if (afterNameCreate) {
                    setAfterNameCreate(false);
                    createDialog.onOpen();
                  }
                }}
              >
                決定
              </Button>
            </Stack>
          </Box>
        </Box>
      )}

      <CreateRoomModal
        isOpen={createDialog.isOpen}
        onClose={createDialog.onClose}
        onCreated={async (roomId) => {
          // ルーム作成直後に遷移
          window.location.href = `/rooms/${roomId}`;
        }}
      />
    </Container>
  );
}
