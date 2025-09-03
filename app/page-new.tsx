"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomCard } from "@/components/RoomCard";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import { useRooms } from "@/lib/hooks/useRooms";
import {
  Badge,
  Box,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import {
  BookOpen,
  Globe,
  Heart,
  Plus,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function MainMenu() {
  const router = useRouter();
  const { user, loading, displayName, setDisplayName } = useAuth();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [afterNameCreate, setAfterNameCreate] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
  } = useRooms(!!(firebaseEnabled && user));

  // Prevent a very short flash of skeletons on slow clients/roundtrips
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

  // Online players count
  const roomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const lobbyCounts = useLobbyCounts(roomIds, !!(firebaseEnabled && user));

  // Filter active rooms
  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const grace = 5 * 60 * 1000;
    const base = rooms.filter((r) => {
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
    return base.filter((r) => !r.status || r.status === "waiting");
  }, [rooms, lobbyCounts]);

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

  const stats = [
    { label: "アクティブルーム", value: filteredRooms.length, icon: Users },
    {
      label: "オンラインプレイヤー",
      value: Object.values(lobbyCounts).reduce((a, b) => a + b, 0),
      icon: Globe,
    },
    { label: "今日のゲーム", value: "24+", icon: TrendingUp },
  ];

  return (
    <Box bg="canvasBg" minH="100vh">
      {/* === HERO SECTION === */}
      <Box
        position="relative"
        overflow="hidden"
        pt={{ base: 20, md: 24, lg: 32 }}
      >
        {/* Sophisticated gradient background */}
        <Box
          position="absolute"
          inset={0}
          bgGradient="radial-gradient(ellipse 150% 100% at 50% 0%, rgba(107,115,255,0.15) 0%, rgba(153,69,255,0.08) 25%, transparent 60%)"
        />
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear-gradient(135deg, rgba(107,115,255,0.05) 0%, transparent 50%, rgba(247,147,30,0.03) 100%)"
        />

        <Container maxW="7xl" position="relative" zIndex={1}>
          <VStack gap={{ base: 16, lg: 20 }} align="center">
            {/* Main title section */}
            <VStack gap={8} align="center" textAlign="center" maxW="4xl">
              <Box>
                <Heading
                  fontSize={{ base: "4xl", md: "6xl", lg: "7xl", xl: "8xl" }}
                  fontWeight={800}
                  lineHeight={0.9}
                  letterSpacing="-0.04em"
                  bgGradient="linear-gradient(135deg, #FFFFFF 0%, rgba(107,115,255,0.9) 50%, rgba(153,69,255,0.8) 100%)"
                  bgClip="text"
                  mb={6}
                  css={{
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
                    textShadow: "0 0 40px rgba(107,115,255,0.3)",
                  }}
                >
                  ITO
                </Heading>
                <Text
                  fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                  color="fgMuted"
                  fontWeight={500}
                  lineHeight={1.4}
                  letterSpacing="-0.02em"
                  maxW="3xl"
                  mx="auto"
                >
                  協力型カードゲーム
                  <Box
                    as="span"
                    display={{ base: "block", md: "inline" }}
                    color="white"
                    fontWeight={600}
                    ml={{ md: 3 }}
                  >
                    数字を使わずに順番を見つけよう
                  </Box>
                </Text>
              </Box>

              {/* Key Features */}
              <HStack
                gap={{ base: 4, md: 8 }}
                flexWrap="wrap"
                justify="center"
                opacity={0.9}
              >
                {[
                  { icon: Users, text: "2-8人" },
                  { icon: Zap, text: "5-15分" },
                  { icon: Shield, text: "協力プレイ" },
                ].map((feature, i) => (
                  <HStack key={i} gap={2} fontSize="sm" color="fgMuted">
                    <feature.icon size={16} />
                    <Text fontWeight={500}>{feature.text}</Text>
                  </HStack>
                ))}
              </HStack>
            </VStack>

            {/* Main CTA Section */}
            <VStack gap={6} align="center">
              <HStack gap={4} flexWrap="wrap" justify="center">
                <AppButton
                  size="lg"
                  visual="solid"
                  palette="brand"
                  onClick={openCreateFlow}
                  leftIcon={<Plus size={20} />}
                  css={{
                    minW: "200px",
                    height: "56px",
                    borderRadius: "16px",
                    fontSize: "lg",
                    fontWeight: 600,
                    background:
                      "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
                    boxShadow:
                      "0 4px 20px rgba(107,115,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    _hover: {
                      transform: "translateY(-2px)",
                      boxShadow:
                        "0 8px 32px rgba(107,115,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                      background:
                        "linear-gradient(135deg, #8B92FF 0%, #B565FF 100%)",
                    },
                    _active: {
                      transform: "translateY(0px)",
                    },
                  }}
                >
                  新しいルームを作成
                </AppButton>

                <AppButton
                  size="lg"
                  visual="outline"
                  onClick={() => router.push("/rules")}
                  leftIcon={<BookOpen size={20} />}
                  css={{
                    minW: "160px",
                    height: "56px",
                    borderRadius: "16px",
                    fontSize: "lg",
                    fontWeight: 500,
                    border: "2px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(10px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    _hover: {
                      transform: "translateY(-2px)",
                      border: "2px solid rgba(107,115,255,0.5)",
                      background: "rgba(107,115,255,0.1)",
                      boxShadow: "0 4px 20px rgba(107,115,255,0.2)",
                    },
                  }}
                >
                  ルール説明
                </AppButton>
              </HStack>

              {/* Quick stats */}
              <HStack gap={8} opacity={0.8} fontSize="sm" color="fgMuted">
                {stats.map((stat, i) => (
                  <HStack key={i} gap={2}>
                    <stat.icon size={14} />
                    <Text fontWeight={500}>
                      <Text as="span" color="white" fontWeight={700}>
                        {stat.value}
                      </Text>{" "}
                      {stat.label}
                    </Text>
                  </HStack>
                ))}
              </HStack>
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* === MAIN CONTENT AREA === */}
      <Container maxW="7xl" py={{ base: 16, md: 20, lg: 24 }}>
        <Grid
          templateColumns={{ base: "1fr", xl: "1fr 320px" }}
          gap={{ base: 8, xl: 12 }}
          alignItems="start"
        >
          {/* Left Column - Rooms */}
          <GridItem>
            {/* Section Header */}
            <Box mb={8}>
              <Flex align="center" justify="space-between" mb={4}>
                <HStack gap={3}>
                  <Box
                    w={10}
                    h={10}
                    borderRadius="12px"
                    bg="linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    boxShadow="0 4px 12px rgba(107,115,255,0.3)"
                  >
                    <Users size={20} color="white" />
                  </Box>
                  <VStack align="start" gap={1}>
                    <Heading size="xl" fontWeight={700} color="white">
                      アクティブルーム
                    </Heading>
                    <Text fontSize="md" color="fgMuted">
                      参加可能なルームから選択してプレイ開始
                    </Text>
                  </VStack>
                </HStack>

                <Badge
                  variant="subtle"
                  colorPalette="green"
                  px={3}
                  py={1}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight={600}
                >
                  {filteredRooms.length}個のルーム
                </Badge>
              </Flex>
            </Box>

            {/* Rooms Grid */}
            {!firebaseEnabled ? (
              <Box
                p={12}
                textAlign="center"
                borderRadius="20px"
                border="2px solid rgba(239,68,68,0.2)"
                bg="rgba(239,68,68,0.05)"
              >
                <Text
                  fontSize="xl"
                  color="rgb(248,113,113)"
                  fontWeight={600}
                  mb={3}
                >
                  Firebase設定が見つかりません
                </Text>
                <Text color="fgMuted">
                  `.env.local` ファイルを設定してください
                </Text>
              </Box>
            ) : roomsLoading && showSkeletons ? (
              <Grid
                templateColumns={{
                  base: "1fr",
                  md: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                }}
                gap={6}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Box
                    key={i}
                    h="200px"
                    borderRadius="16px"
                    bg="surfaceRaised"
                    opacity={0.6}
                    css={{
                      animation: "pulse 2s infinite",
                      "@keyframes pulse": {
                        "0%, 100%": { opacity: 0.4 },
                        "50%": { opacity: 0.6 },
                      },
                    }}
                  />
                ))}
              </Grid>
            ) : filteredRooms.length > 0 ? (
              <Grid
                templateColumns={{
                  base: "1fr",
                  md: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                }}
                gap={6}
              >
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    name={room.name}
                    status={room.status}
                    count={lobbyCounts[room.id] ?? 0}
                    onJoin={() => {
                      if (room.status && room.status !== "waiting") {
                        notify({
                          title: "この部屋は既に開始されています",
                          description:
                            "ホストがゲームを開始したため、現在は入室できません。ホストがリセットすると再度入室可能になります。",
                          type: "info",
                        });
                        return;
                      }
                      openJoinFlow(room.id);
                    }}
                  />
                ))}
              </Grid>
            ) : (
              <Box
                textAlign="center"
                py={16}
                px={8}
                borderRadius="20px"
                border="2px dashed rgba(255,255,255,0.1)"
                bg="rgba(255,255,255,0.02)"
              >
                <Box
                  w={16}
                  h={16}
                  mx="auto"
                  mb={6}
                  borderRadius="16px"
                  bg="linear-gradient(135deg, rgba(107,115,255,0.2) 0%, rgba(153,69,255,0.1) 100%)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Sparkles size={24} color="rgba(107,115,255,0.8)" />
                </Box>
                <Heading size="md" color="white" mb={3} fontWeight={600}>
                  まだアクティブなルームがありません
                </Heading>
                <Text color="fgMuted" mb={6} maxW="400px" mx="auto">
                  最初のルームを作成して、友達を招待しませんか？
                </Text>
                <AppButton
                  onClick={openCreateFlow}
                  visual="solid"
                  palette="brand"
                  leftIcon={<Plus size={18} />}
                  css={{
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
                    boxShadow: "0 4px 12px rgba(107,115,255,0.3)",
                  }}
                >
                  新しいルーム作成
                </AppButton>
              </Box>
            )}
          </GridItem>

          {/* Right Column - Player Info & Quick Actions */}
          <GridItem display={{ base: "none", xl: "block" }}>
            <VStack gap={6} align="stretch">
              {/* Player Profile Card */}
              <Box
                p={6}
                borderRadius="20px"
                border="1px solid rgba(255,255,255,0.1)"
                bg="rgba(255,255,255,0.03)"
                backdropFilter="blur(20px)"
                position="relative"
                _before={{
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  borderRadius: "20px",
                  background:
                    "linear-gradient(135deg, rgba(107,115,255,0.1) 0%, rgba(153,69,255,0.05) 100%)",
                  pointerEvents: "none",
                }}
              >
                <VStack gap={4} align="stretch" position="relative">
                  <HStack gap={3}>
                    <Box
                      w={12}
                      h={12}
                      borderRadius="12px"
                      bg="linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      boxShadow="0 4px 12px rgba(107,115,255,0.3)"
                    >
                      <UserCircle2 size={24} color="white" />
                    </Box>
                    <VStack align="start" gap={0}>
                      <Text
                        fontSize="xs"
                        color="fgMuted"
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing="wide"
                      >
                        プレイヤー名
                      </Text>
                      <Text
                        fontSize="lg"
                        fontWeight={700}
                        color="white"
                        suppressHydrationWarning
                      >
                        {mounted ? displayName || "未設定" : "未設定"}
                      </Text>
                    </VStack>
                  </HStack>

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
                      width: "100%",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                      transition: "all 0.2s ease",
                      _hover: {
                        background: "rgba(107,115,255,0.1)",
                        borderColor: "rgba(107,115,255,0.3)",
                      },
                    }}
                  >
                    <Settings size={16} />
                    名前を変更
                  </AppButton>
                </VStack>
              </Box>

              {/* Quick Actions */}
              <Box
                p={6}
                borderRadius="20px"
                border="1px solid rgba(255,255,255,0.1)"
                bg="rgba(255,255,255,0.03)"
                backdropFilter="blur(20px)"
              >
                <VStack gap={4} align="stretch">
                  <Text
                    fontSize="sm"
                    fontWeight={700}
                    color="white"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    クイックアクション
                  </Text>

                  <VStack gap={2} align="stretch">
                    <AppButton
                      size="sm"
                      visual="ghost"
                      leftIcon={<BookOpen size={16} />}
                      onClick={() => router.push("/rules")}
                      css={{
                        justifyContent: "flex-start",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        _hover: {
                          background: "rgba(247,147,30,0.1)",
                          color: "#F7931E",
                        },
                      }}
                    >
                      ルール説明を読む
                    </AppButton>

                    <AppButton
                      size="sm"
                      visual="ghost"
                      leftIcon={<Heart size={16} />}
                      css={{
                        justifyContent: "flex-start",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        _hover: {
                          background: "rgba(239,68,68,0.1)",
                          color: "#EF4444",
                        },
                      }}
                    >
                      フィードバック
                    </AppButton>
                  </VStack>
                </VStack>
              </Box>

              {/* Game Stats */}
              <Box
                p={6}
                borderRadius="20px"
                border="1px solid rgba(255,255,255,0.1)"
                bg="rgba(255,255,255,0.03)"
                backdropFilter="blur(20px)"
              >
                <VStack gap={4} align="stretch">
                  <Text
                    fontSize="sm"
                    fontWeight={700}
                    color="white"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    統計情報
                  </Text>

                  <VStack gap={3} align="stretch">
                    {[
                      {
                        label: "アクティブルーム",
                        value: filteredRooms.length,
                        color: "#6B73FF",
                      },
                      {
                        label: "オンラインプレイヤー",
                        value: Object.values(lobbyCounts).reduce(
                          (a, b) => a + b,
                          0
                        ),
                        color: "#9945FF",
                      },
                      { label: "今日のゲーム", value: "24+", color: "#F7931E" },
                    ].map((stat, i) => (
                      <HStack key={i} justify="space-between">
                        <Text fontSize="sm" color="fgMuted">
                          {stat.label}
                        </Text>
                        <Text fontSize="lg" fontWeight={700} color={stat.color}>
                          {stat.value}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              </Box>
            </VStack>
          </GridItem>
        </Grid>
      </Container>

      {/* Modals */}
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
          router.push(`/rooms/${roomId}`);
        }}
      />
    </Box>
  );
}
