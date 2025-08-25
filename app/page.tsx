"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import {
  Box,
  Container,
  Flex,
  Heading,
  HStack,
  ScrollArea,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
// firestore imports removed (unused in lobby page)
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
// presenceベースで人数を取得するため timeユーティリティは未使用
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomCard } from "@/components/RoomCard";
import Hero from "@/components/site/Hero";
// import LobbyLeftRail from "@/components/site/LobbyLeftRail";
import EmptyState from "@/components/site/EmptyState";
import LobbyRightRail from "@/components/site/LobbyRightRail";
import LobbySkeletons from "@/components/site/LobbySkeletons";
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
  const [showSkeletons, setShowSkeletons] = useState(false);
  // 検索機能は一時的に無効化（将来のために残置）
  // const [search, setSearch] = useState("");
  const waitingOnly = true;
  useEffect(() => {
    setMounted(true);
  }, []);
  // フィルターの永続化は現在停止

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
  } = useRooms(!!(firebaseEnabled && user));

  // Prevent a very short flash of skeletons on slow clients/roundtrips by
  // delaying showing the skeletons. If loading completes quickly the
  // skeletons never appear.
  useEffect(() => {
    let t: number | undefined;
    if (roomsLoading) {
      t = window.setTimeout(() => setShowSkeletons(true), 150);
    } else {
      setShowSkeletons(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [roomsLoading]);

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
    const base = rooms.filter((r) => {
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
    // filter by waitingOnly
    const byStatus = waitingOnly
      ? base.filter((r) => !r.status || r.status === "waiting")
      : base;
    return byStatus;
  }, [rooms, lobbyCounts, waitingOnly]);

  const openCreateFlow = () => {
    if (!displayName) {
      setAfterNameCreate(true);
      setPendingJoin(null);
      nameDialog.onOpen();
    } else {
      createDialog.onOpen();
    }
  };

  const openJoinFlow = (roomId: string) => {
    if (!displayName) {
      setAfterNameCreate(false);
      setPendingJoin(roomId);
      nameDialog.onOpen();
    } else {
      router.push(`/rooms/${roomId}`);
    }
  };

  return (
    <>
      <Hero onPlay={openCreateFlow} onRules={() => router.push("/")} />
      <Container maxW="6xl" py={8}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="2xl" letterSpacing="tight">
            Online-ITO
          </Heading>
          <HStack>
            <HStack gap={2} mr={2} color="gray.300">
              <Text fontSize="sm" suppressHydrationWarning>
                名前: {mounted ? displayName || "未設定" : "未設定"}
              </Text>
              <AppButton
                size="sm"
                variant="subtle"
                onClick={() => {
                  setTempName(displayName || "");
                  setAfterNameCreate(false);
                  setPendingJoin(null);
                  nameDialog.onOpen();
                }}
                minW="6.5rem"
              >
                変更
              </AppButton>
            </HStack>
            {/* メインCTAはHeroに集約するため、ここでの作成ボタンは削除 */}
          </HStack>
        </Flex>

        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={{ base: 6, lg: 8 }}
          align="flex-start"
        >
          <Box flex="1" minW={0}>
            <ScrollArea.Root style={{ height: "clamp(400px, 60vh, 600px)" }}>
              <ScrollArea.Viewport>
                <ScrollArea.Content>
                  {!firebaseEnabled ? (
                    <Box
                      p={8}
                      textAlign="center"
                      borderWidth="1px"
                      rounded="lg"
                      bg="blackAlpha.300"
                    >
                      <Text>
                        Firebase設定が見つかりません。`.env.local`
                        を設定してください。
                      </Text>
                    </Box>
                  ) : roomsLoading && showSkeletons ? (
                    <LobbySkeletons />
                  ) : (
                    <Flex
                      direction={{ base: "column", md: "row" }}
                      gap={6}
                      wrap="wrap"
                    >
                      {filteredRooms.map((r) => (
                        <RoomCard
                          key={r.id}
                          name={r.name}
                          status={r.status}
                          count={lobbyCounts[r.id] ?? 0}
                          onJoin={() => {
                            if (r.status && r.status !== "waiting") {
                              notify({
                                title: "この部屋は既に開始されています",
                                description:
                                  "ホストがゲームを開始したため、現在は入室できません。ホストがリセットすると再度入室可能になります。",
                                type: "info",
                              });
                              return;
                            }
                            openJoinFlow(r.id);
                          }}
                        />
                      ))}
                      {filteredRooms.length === 0 && (
                        <EmptyState
                          onCreate={() => {
                            if (!displayName) {
                              setAfterNameCreate(true);
                              setPendingJoin(null);
                              nameDialog.onOpen();
                            } else {
                              createDialog.onOpen();
                            }
                          }}
                        />
                      )}
                    </Flex>
                  )}
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar>
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
              <ScrollArea.Corner />
            </ScrollArea.Root>
          </Box>

          <Box
            w={{ base: "100%", lg: "320px" }}
            flexShrink={0}
            display={{ base: "none", lg: "block" }}
          >
            <LobbyRightRail />
          </Box>
        </Flex>

        <NameDialog
          isOpen={nameDialog.open}
          defaultValue={tempName}
          onCancel={() => nameDialog.onClose()}
          onSubmit={(val) => {
            if (!val) {
              notify({ title: "名前を入力してください", type: "warning" });
              return;
            }
            setDisplayName(val);
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
        />

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
