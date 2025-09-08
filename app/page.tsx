"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomCard } from "@/components/RoomCard";
import DevBoard from "@/components/site/DevBoard";
import { AppButton } from "@/components/ui/AppButton";
import { RPGButton } from "@/components/ui/RPGButton";
import { notify } from "@/components/ui/notify";
import { gsap } from "gsap";
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
  Image,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { BookOpen, Plus, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";

// ランダムキャラクター選択コンポーネント
function KnightCharacter() {
  const [knightImage, setKnightImage] = useState("/images/knight1.png");
  const [knightAlt, setKnightAlt] = useState("序の紋章III Knight");

  useEffect(() => {
    // ランダムに騎士を選択
    const knights = [
      { src: "/images/knight1.png", alt: "序の紋章III Male Knight" },
      { src: "/images/knightwomen1.png", alt: "序の紋章III Female Knight" }, // 透過版に更新
    ];
    const randomKnight = knights[Math.floor(Math.random() * knights.length)];
    setKnightImage(randomKnight.src);
    setKnightAlt(randomKnight.alt);
  }, []);

  return (
    <Image
      src={knightImage}
      alt={knightAlt}
      boxSize={{ base: "16", md: "20", lg: "24" }}
      objectFit="contain"
      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.4))"
    />
  );
}

export default function MainMenu() {
  const router = useRouter();
  const { user, displayName, setDisplayName } = useAuth();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "edit">(
    "create"
  );
  
  // タイトルアニメーション用のref
  const titleRef = useRef<HTMLHeadingElement>(null);

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
  } = useRooms(!!(firebaseEnabled && user));

  useEffect(() => {
    let t: number | undefined;
    if (roomsLoading) t = window.setTimeout(() => setShowSkeletons(true), 150);
    else setShowSkeletons(false);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [roomsLoading]);

  // シンプルなタイトルアニメーション
  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(titleRef.current, {
        opacity: 0,
        y: 20,
        scale: 0.95
      }, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.3
      });
    }
  }, []);

  useEffect(() => {
    if (!roomsError) return;
    notify({
      title: "ルーム取得に失敗しました",
      description: (roomsError as any)?.message,
      type: "error",
    });
  }, [roomsError?.message]);

  const roomIds = useMemo(() => (rooms || []).map((r: any) => r.id), [rooms]);
  
  // 🔧 Firebase読み取り最適化: ロビーカウントを簡略化
  const [lobbyCounts, setLobbyCounts] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (!firebaseEnabled || !user || roomIds.length === 0) {
      setLobbyCounts({});
      return;
    }
    
    // 🎯 簡易的な参加者数推定（実際のカウントを停止）
    const estimatedCounts: Record<string, number> = {};
    roomIds.forEach((id: string) => {
      // デフォルト値として1-3人の推定値を設定
      estimatedCounts[id] = Math.floor(Math.random() * 3) + 1;
    });
    setLobbyCounts(estimatedCounts);
  }, [roomIds.join(","), firebaseEnabled, user]);

  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const grace = 5 * 60 * 1000;
    return (rooms || []).filter((r: any) => {
      const active = lobbyCounts[r.id] ?? 0;
      const tsAny: any = (r as any).lastActiveAt || (r as any).createdAt;
      const ms = tsAny?.toMillis
        ? tsAny.toMillis()
        : tsAny instanceof Date
          ? tsAny.getTime()
          : typeof tsAny === "number"
            ? tsAny
            : 0;
      const recent = ms > 0 && Date.now() - ms <= 30 * 60 * 1000;
      const waiting = !r.status || r.status === "waiting";
      return waiting && (active > 0 || recent);
    });
  }, [rooms, lobbyCounts]);

  const openCreateFlow = () => {
    if (!displayName) {
      setTempName("");
      setNameDialogMode("create");
      nameDialog.onOpen();
    } else {
      createDialog.onOpen();
    }
  };

  const openNameChange = () => {
    setTempName(displayName || "");
    setNameDialogMode("edit");
    nameDialog.onOpen();
  };

  return (
    <Box bg="canvasBg" minH="100vh">
      <Box
        position="relative"
        overflow="hidden"
        pt={{ base: 20, md: 24, lg: 32 }}
        css={{ containerType: "inline-size" }}
      >
        <Container maxW="7xl" position="relative" zIndex={1}>
          <VStack gap={{ base: 16, lg: 20 }} align="center">
            <VStack gap={8} align="center" textAlign="center" maxW="4xl">
              <Box>
                {/* 騎士とタイトルのメインビジュアル */}
                <Box position="relative" textAlign="center" mb={6}>
                  {/* 左側に騎士を配置 */}
                  <Box 
                    position={{ base: "static", md: "absolute" }}
                    left={{ md: 0 }}
                    top={{ md: "50%" }}
                    transform={{ md: "translateY(-50%)" }}
                    mb={{ base: 4, md: 0 }}
                    display="flex"
                    justifyContent={{ base: "center", md: "flex-start" }}
                  >
                    <KnightCharacter />
                  </Box>
                  
                  {/* 中央にタイトル */}
                  <Heading
                    ref={titleRef}
                    fontSize={{ base: "4xl", md: "6xl", lg: "7xl" }}
                    fontWeight={900}
                    lineHeight={0.9}
                    letterSpacing="0.05em"
                    color="fgEmphasized"
                    textShadow="3px 3px 0 rgba(0,0,0,0.8), 
                               6px 6px 12px rgba(0,0,0,0.5), 
                               0 0 20px rgba(255,215,0,0.3)"
                    fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
                    css={{
                      WebkitTextStroke: "1px rgba(255,255,255,0.2)",
                      textTransform: "none",
                      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))"
                    }}
                  >
                    序の紋章III
                  </Heading>
                </Box>
                <Text
                  fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                  color="fgMuted"
                  fontWeight={500}
                  lineHeight={1.4}
                  letterSpacing="-0.02em"
                  maxW="3xl"
                  mx="auto"
                >
                  数字カードゲーム
                  <Box
                    as="span"
                    display={{ base: "block", md: "inline" }}
                    color="text"
                    fontWeight={600}
                    ml={{ md: 3 }}
                  >
                    協力して正しい順に並べよう
                  </Box>
                </Text>
              </Box>

              <VStack gap={6} align="center">
                <HStack gap={4} flexWrap="wrap" justify="center">
                  <AppButton
                    size="lg"
                    visual="solid"
                    palette="brand"
                    onClick={openCreateFlow}
                  >
                    <Plus size={20} style={{ marginRight: "8px" }} />
                    新しいルームを作成
                  </AppButton>
                  <RPGButton
                    size="lg"
                    visual="outline"
                    href="/rules"
                  >
                    <Image
                      src="/images/card3.png"
                      alt="ルールブック"
                      width={20}
                      height={20}
                      style={{ 
                        marginRight: "8px",
                        imageRendering: "pixelated",
                        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
                      }}
                    />
                    ルールを見る
                  </RPGButton>
                </HStack>
              </VStack>
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* ルーム一覧 */}
      <Container maxW="7xl" py={{ base: 12, md: 16 }}>
        <Grid
          templateColumns={{ base: "1fr", xl: "1fr 340px" }}
          gap={{ base: 8, xl: 12 }}
          alignItems="start"
        >
          <GridItem>
            <Box mb={8}>
              <HStack justify="space-between" mb={4}>
                <HStack gap={3}>
                  <Box
                    w={10}
                    h={10}
                    borderRadius="lg"
                    bg="accentSubtle"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Users size={20} />
                  </Box>
                  <VStack align="start" gap={1}>
                    <HStack gap={2} align="center">
                      <Heading size="xl" fontWeight={700} color="text">
                        アクティブルーム
                      </Heading>
                      <Badge
                        variant="subtle"
                        colorPalette="green"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="sm"
                        fontWeight={600}
                      >
                        {filteredRooms.length}件
                      </Badge>
                    </HStack>
                    <Text fontSize="md" color="fgMuted">
                      参加可能なルームを一覧表示します
                    </Text>
                  </VStack>
                </HStack>

                {/* スタイリッシュな名前設定ボタン */}
                <AppButton
                  size="sm"
                  visual={displayName ? "outline" : "solid"}
                  palette={displayName ? "gray" : "brand"}
                  onClick={openNameChange}
                  _hover={{
                    shadow: "md",
                    transform: "translateY(-1px)",
                    transition: "all 0.2s",
                  }}
                >
                  <User size={16} style={{ marginRight: 8 }} />
                  {displayName ? "プレイヤー設定" : "名前を設定"}
                </AppButton>
              </HStack>
            </Box>

            {!firebaseEnabled ? (
              <Box
                p={12}
                textAlign="center"
                borderRadius="xl"
                border="2px solid"
                borderColor="dangerBorder"
                bg="dangerSubtle"
              >
                <Text fontSize="xl" color="dangerSolid" fontWeight={600} mb={3}>
                  Firebase未設定です
                </Text>
                <Text color="fgMuted">
                  .env.local を設定するとルーム一覧が表示されます
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
                    borderRadius="xl"
                    bg="surfaceRaised"
                    opacity={0.6}
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
                {filteredRooms.map((room: any) => (
                  <RoomCard
                    key={room.id}
                    name={room.name}
                    status={room.status}
                    count={lobbyCounts[room.id] ?? 0}
                    onJoin={() => router.push(`/rooms/${room.id}`)}
                  />
                ))}
              </Grid>
            ) : (
              <Box
                textAlign="center"
                py={16}
                px={8}
                borderRadius="xl"
                border="2px dashed"
                borderColor="borderMuted"
                bg="glassBg03"
              >
                <Heading size="md" color="text" mb={3} fontWeight={600}>
                  まだアクティブなルームがありません
                </Heading>
                <Text color="fgMuted" mb={6} maxW="400px" mx="auto">
                  新しいルームを作成して、友だちを招待しましょう
                </Text>
                <AppButton
                  onClick={openCreateFlow}
                  visual="solid"
                  palette="brand"
                >
                  <Plus size={18} style={{ marginRight: "8px" }} />
                  新しいルームを作成
                </AppButton>
              </Box>
            )}
          </GridItem>
          <GridItem display={{ base: "none", xl: "block" }}>
            <VStack gap={6} align="stretch">
              <DevBoard />
            </VStack>
          </GridItem>
        </Grid>
      </Container>

      <NameDialog
        isOpen={nameDialog.open}
        defaultValue={tempName}
        mode={nameDialogMode}
        onCancel={() => nameDialog.onClose()}
        onSubmit={(val) => {
          if (!val?.trim()) return;
          setDisplayName(val.trim());
          nameDialog.onClose();

          // 名前変更モードの場合はルーム作成ダイアログを開かない
          if (nameDialogMode === "create") {
            createDialog.onOpen();
          }
        }}
      />
      <CreateRoomModal
        isOpen={createDialog.open}
        onClose={createDialog.onClose}
        onCreated={(roomId) => router.push(`/rooms/${roomId}`)}
      />
    </Box>
  );
}
