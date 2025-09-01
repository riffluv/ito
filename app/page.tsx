"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import {
  Box,
  Flex,
  Heading,
  HStack,
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
import { UNIFIED_LAYOUT } from "@/theme/layout";

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
    <Box bg="canvasBg">
      {" "}
      {/* フルブリード背景: 新リッチブラック */}
      <Hero onPlay={openCreateFlow} onRules={() => router.push("/rules")} />
      <Box px={{ base: 4, md: 8, xl: 12 }} py={8} maxW="100%">
        {/* ヘッダー/フィルター領域: panel風 */}
        <Box
          bg="surfaceRaised"
          borderWidth="1px"
          borderColor="borderDefault"
          rounded="xl"
          px={{ base: 5, md: 7 }}
          py={{ base: 5, md: 7 }}
          mb={8}
          boxShadow="0 2px 6px rgba(0,0,0,0.4)"
        >
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "flex-start", md: "center" }}
            gap={6}
          >
            <Box>
              <Heading
                size="md"
                fontWeight={600}
                letterSpacing="tight"
                color="fgDefault"
                mb={1}
              >
                ルーム一覧
              </Heading>
              <Text fontSize="sm" color="fgMuted">
                参加するルームを選んでください
              </Text>
            </Box>
            <Box
              bg="surfaceSubtle"
              borderWidth="1px"
              borderColor="borderDefault"
              rounded="md"
              px={4}
              py={3}
              minW={{ base: "100%", md: "260px" }}
            >
              <HStack justify="space-between" align="center" gap={4}>
                <Box>
                  <Text fontSize="xs" color="fgSubtle" mb={1}>
                    プレイヤー名
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight={600}
                    color="fgDefault"
                    suppressHydrationWarning
                  >
                    {mounted ? displayName || "未設定" : "未設定"}
                  </Text>
                </Box>
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTempName(displayName || "");
                    setAfterNameCreate(false);
                    setPendingJoin(null);
                    nameDialog.onOpen();
                  }}
                  minW="3.5rem"
                  fontSize="xs"
                >
                  変更
                </AppButton>
              </HStack>
            </Box>
          </Flex>
        </Box>

        {/* 
          メインページ全体スクロール設計:
          - 将来的な要素追加（掲示板、お知らせ、統計など）に対応
          - ブラウザネイティブスクロールで自然な操作感を提供
          - レイアウトの制約なく縦方向に要素を自由配置可能
        */}
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={{ base: 6, lg: 8 }}
          align="flex-start"
          minH="50vh" // 最小高さを確保してコンテンツが少なくても見栄えを保つ
        >
          <Box flex="1" minW={0}>
            {!firebaseEnabled ? (
              <Box
                p={8}
                textAlign="center"
                borderWidth={UNIFIED_LAYOUT.BORDER.WIDTH.THIN}
                borderColor="borderDefault"
                rounded="lg"
                bg="panelSubBg"
              >
                <Text>
                  Firebase設定が見つかりません。`.env.local`
                  を設定してください。
                </Text>
              </Box>
            ) : roomsLoading && showSkeletons ? (
              <LobbySkeletons />
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{
                  base: "repeat(auto-fill, minmax(260px,1fr))",
                  md: "repeat(auto-fill, minmax(300px,1fr))",
                  xl: "repeat(auto-fill, minmax(320px,1fr))",
                }}
                gap={5}
                w="100%"
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
                  <Box gridColumn="1 / -1">
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
                  </Box>
                )}
              </Box>
            )}

            {/* 将来実装予定の機能セクション */}
            {/* 
            掲示板セクション（将来実装）:
            <Box mt={8}>
              <Heading size="lg" mb={4}>お知らせ</Heading>
              <NoticeBoard />
            </Box>
            
            統計セクション（将来実装）:
            <Box mt={8}>
              <Heading size="lg" mb={4}>統計情報</Heading>
              <StatsPanel />
            </Box>
            */}
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
      </Box>
    </Box>
  );
}
