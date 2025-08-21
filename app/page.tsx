"use client";
import { notify } from "@/components/ui/notify";
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
} from "@chakra-ui/react";
// firestore imports removed (unused in lobby page)
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
// presenceベースで人数を取得するため timeユーティリティは未使用
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { RoomCard } from "@/components/RoomCard";
import Hero from "@/components/site/Hero";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import { useRooms } from "@/lib/hooks/useRooms";

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading, displayName, setDisplayName } = useAuth();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [afterNameCreate, setAfterNameCreate] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
  } = useRooms(!!(firebaseEnabled && user));

  // ...existing code... (debug logging removed)
  useEffect(() => {
    if (!roomsError) return;
    console.error("rooms snapshot error", roomsError);
    notify({
      title: "Firestoreの読み取りに失敗しました",
      description:
        (roomsError as any)?.message || "権限またはルールを確認してください",
      type: "error",
    });
  }, [roomsError?.message]);

  // オンライン人数を一括購読（presence優先、fallback: Firestore lastSeen）
  const roomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const lobbyCounts = useLobbyCounts(roomIds, !!(firebaseEnabled && user));

  // 初回ロードでの強制名入力は行わない（作成/参加時に促す）

  // const canProceed = useMemo(
  //   () => !!(user && displayName),
  //   [user, displayName]
  // );

  // 直近アクティブの部屋も残す（5分）
  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const grace = 5 * 60 * 1000;
    return rooms.filter((r) => {
      // ソフトクローズ済みは表示しない
      if ((r as any).closedAt) return false;
      const active = lobbyCounts[r.id] ?? 0;
      const la = r.lastActiveAt as any;
      const ms = la?.toMillis
        ? la.toMillis()
        : la instanceof Date
        ? la.getTime()
        : typeof la === "number"
        ? la
        : 0;
      const recent = ms > 0 && now - ms <= grace;
      return active > 0 || recent;
    });
  }, [rooms, lobbyCounts]);

  return (
    <>
      <Hero />
      <Container
        maxW="container.lg"
        h="100dvh"
        py={4}
        display="flex"
        flexDir="column"
        overflow="hidden"
      >
        <Flex justify="space-between" align="center" mb={3} shrink={0}>
          <Heading size="lg">Online-ITO</Heading>
          <HStack>
            <HStack gap={2} mr={2} color="gray.300">
              <Text fontSize="sm" suppressHydrationWarning>
                名前: {mounted ? displayName || "未設定" : "未設定"}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTempName(displayName || "");
                  setAfterNameCreate(false);
                  setPendingJoin(null);
                  nameDialog.onOpen();
                }}
              >
                変更
              </Button>
            </HStack>
            <Button
              colorPalette="brand"
              variant="solid"
              disabled={loading}
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

        <Box flex="1" overflowY="auto" minH={0}>
          {!firebaseEnabled ? (
            <Box
              p={8}
              textAlign="center"
              borderWidth="1px"
              rounded="lg"
              bg="blackAlpha.300"
            >
              <Text>
                Firebase設定が見つかりません。`.env.local` を設定してください。
              </Text>
            </Box>
          ) : roomsLoading ? (
            <Spinner />
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              {filteredRooms.map((r) => (
                <RoomCard
                  key={r.id}
                  name={r.name}
                  status={r.status}
                  count={lobbyCounts[r.id] ?? 0}
                  onJoin={() => {
                    // 待機中のみ入室可
                    if (r.status && r.status !== "waiting") {
                      notify({
                        title: "この部屋は既に開始されています",
                        description:
                          "ホストがゲームを開始したため、現在は入室できません。ホストがリセットすると再度入室可能になります。",
                        type: "info",
                      });
                      return;
                    }
                    if (!displayName) {
                      setAfterNameCreate(false);
                      setPendingJoin(r.id);
                      nameDialog.onOpen();
                    } else {
                      router.push(`/rooms/${r.id}`);
                    }
                  }}
                />
              ))}
              {filteredRooms.length === 0 && (
                <Box
                  p={8}
                  textAlign="center"
                  borderWidth="1px"
                  borderRadius="lg"
                  bg="blackAlpha.300"
                >
                  <Text>
                    公開ルームがありません。最初の部屋を作りましょう！
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          )}
        </Box>

        {/* 名前入力モーダル（作成/参加時に表示） */}
        {nameDialog.open && (
          <Box
            position="fixed"
            inset={0}
            bg="blackAlpha.700"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Box
              bg="gray.800"
              p={6}
              rounded="lg"
              minW={{ base: "90%", md: "lg" }}
            >
              <Heading size="md" mb={3}>
                プレイヤー名を入力
              </Heading>
              <Stack direction={{ base: "column", md: "row" }}>
                <Input
                  placeholder="例）たろう"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                />
                <Button
                  colorPalette="blue"
                  onClick={() => {
                    if (!tempName.trim()) {
                      notify({
                        title: "名前を入力してください",
                        type: "warning",
                      });
                      return;
                    }
                    setDisplayName(tempName.trim());
                    nameDialog.onClose();
                    if (pendingJoin) {
                      const to = `/rooms/${pendingJoin}`;
                      setPendingJoin(null);
                      setAfterNameCreate(false);
                      router.push(to);
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
          isOpen={createDialog.open}
          onClose={createDialog.onClose}
          onCreated={async (roomId) => {
            // ルーム作成直後に遷移
            router.push(`/rooms/${roomId}`);
          }}
        />
      </Container>
    </>
  );
}
