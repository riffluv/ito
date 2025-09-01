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
      {/* フルブリード背景: 新リッチブラック */}
      <Hero onPlay={openCreateFlow} onRules={() => router.push("/rules")} />
      
      {/* 🎯 PREMIUM LOBBY CONTAINER */}
      <Box 
        maxW="1200px" 
        mx="auto" 
        px={{ base: 6, md: 8 }} 
        py={{ base: 12, md: 16 }}
      >
        {/* 📊 Stats & User Info - Modern Card Design */}
        <Box
          bg="rgba(25,27,33,0.6)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255,255,255,0.1)"
          borderRadius="20px"
          p={{ base: 6, md: 8 }}
          mb={12}
          boxShadow="0 8px 32px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
          position="relative"
          _before={{
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)',
            pointerEvents: 'none'
          }}
        >
          <Flex
            direction={{ base: "column", lg: "row" }}
            justify="space-between"
            align={{ base: "flex-start", lg: "center" }}
            gap={{ base: 6, lg: 8 }}
          >
            <Box flex={1}>
              <HStack gap={4} mb={3}>
                <Box 
                  w={12} h={12}
                  bg="linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                  borderRadius="16px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 4px 16px rgba(99,102,241,0.3)"
                >
                  <Box w="60%" h="60%" bg="white" borderRadius="8px" />
                </Box>
                <Box>
                  <Heading
                    size="lg"
                    fontWeight={700}
                    letterSpacing="-0.02em"
                    color="white"
                    mb={1}
                  >
                    アクティブルーム
                  </Heading>
                  <Text fontSize="md" color="rgba(255,255,255,0.7)">
                    参加するルームを選んでください
                  </Text>
                </Box>
              </HStack>
            </Box>
            
            <Box
              bg="rgba(255,255,255,0.05)"
              backdropFilter="blur(12px)"
              border="1px solid rgba(255,255,255,0.1)"
              borderRadius="16px"
              p={5}
              minW={{ base: "100%", lg: "320px" }}
              boxShadow="0 4px 16px rgba(0,0,0,0.1)"
            >
              <HStack justify="space-between" align="center" gap={4}>
                <Box flex={1}>
                  <Text fontSize="xs" color="rgba(255,255,255,0.6)" mb={2} fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    プレイヤー名
                  </Text>
                  <Text
                    fontSize="md"
                    fontWeight={600}
                    color="white"
                    suppressHydrationWarning
                  >
                    {mounted ? displayName || "未設定" : "未設定"}
                  </Text>
                </Box>
                <AppButton
                  size="sm"
                  visual="ghost"
                  onClick={() => {
                    setTempName(displayName || "");
                    setAfterNameCreate(false);
                    setPendingJoin(null);
                    nameDialog.onOpen();
                  }}
                  css={{
                    minWidth: '60px',
                    height: '36px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.9)',
                    _hover: {
                      background: 'rgba(255,255,255,0.1)',
                      borderColor: 'rgba(255,255,255,0.3)'
                    }
                  }}
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
        {/* 🎮 MAIN CONTENT AREA */}
        <Flex
          direction={{ base: "column", xl: "row" }}
          gap={8}
          align="flex-start"
        >
          <Box flex="1" minW={0}>
            {!firebaseEnabled ? (
              <Box
                p={12}
                textAlign="center"
                bg="rgba(239,68,68,0.1)"
                border="1px solid rgba(239,68,68,0.2)"
                borderRadius="20px"
                boxShadow="0 4px 16px rgba(239,68,68,0.1)"
              >
                <Text fontSize="lg" color="rgb(248,113,113)" fontWeight={600}>
                  Firebase設定が見つかりません
                </Text>
                <Text mt={2} color="rgba(255,255,255,0.7)">
                  `.env.local` ファイルを設定してください
                </Text>
              </Box>
            ) : roomsLoading && showSkeletons ? (
              <LobbySkeletons />
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{
                  base: "1fr",
                  sm: "repeat(auto-fill, minmax(300px,1fr))",
                  md: "repeat(auto-fill, minmax(340px,1fr))",
                  lg: "repeat(auto-fill, minmax(320px,1fr))",
                  xl: "repeat(auto-fill, minmax(300px,1fr))",
                }}
                gap={6}
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
            w={{ base: "100%", xl: "320px" }}
            flexShrink={0}
            display={{ base: "none", xl: "block" }}
          >
            <LobbyRightRail />
          </Box>
        </Flex>
      </Box>
      
      {/* Name & Create modals outside of container for proper overlay */}
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
  );
}
