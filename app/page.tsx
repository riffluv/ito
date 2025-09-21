"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomCard } from "@/components/RoomCard";
import { AppButton } from "@/components/ui/AppButton";
import { RPGButton } from "@/components/ui/RPGButton";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { useTransition } from "@/components/ui/TransitionProvider";
import { handleFirebaseQuotaError } from "@/lib/utils/errorHandling";
import { firebaseEnabled } from "@/lib/firebase/client";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import { useOptimizedRooms } from "@/lib/hooks/useOptimizedRooms";
import {
  Badge,
  Box,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { gsap } from "gsap";
import { BookOpen, Plus, RefreshCw, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { stripMinimalTag } from "@/lib/game/displayMode";

// 固定男性ナイトコンポーネント
function KnightCharacter() {
  const knightImage = "/images/knight1.webp";
  const knightAlt = "序の紋章III Male Knight";

  return (
    <Image
      src={knightImage}
      alt={knightAlt}
      boxSize={{ base: "16", md: "20", lg: "24" }}
      objectFit="contain"
      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.4))"
      css={{
        // DPI scaling knight size optimization
        "@container (max-width: 600px)": {
          width: "3rem", // 48px for mobile
          height: "3rem",
        },
        "@container (min-width: 600px) and (max-width: 900px)": {
          width: "4rem", // 64px for tablet
          height: "4rem",
        },
        "@container (min-width: 900px)": {
          width: "5rem", // 80px for desktop
          height: "5rem",
        }
      }}
    />
  );
}

export default function MainMenu() {
  const router = useRouter();
  const { user, displayName, setDisplayName } = useAuth();
  const transition = useTransition();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "edit">(
    "create"
  );
  const [lastRoom, setLastRoom] = useState<string | null>(null);

  useEffect(() => {
    const prefetchRules = () => {
      try {
        router.prefetch("/rules");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("prefetch('/rules') はスキップされました", error);
        }
      }
    };

    const idleCallback = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    if (typeof idleCallback === "function") {
      const idleHandle = idleCallback(prefetchRules);
      return () => {
        const cancelIdle = (window as any).cancelIdleCallback as ((handle: number) => void) | undefined;
        if (typeof cancelIdle === "function") {
          cancelIdle(idleHandle);
        }
      };
    }

    const timeoutId = window.setTimeout(prefetchRules, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router]);
  // タイトルアニメーション用のref
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 2020年代以降のロビーベストプラクティスに合わせ、
  // 常時 onSnapshot を避け、周期的な取得に最適化されたフックを使用
  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
    refresh: refreshRooms,
  } = useOptimizedRooms(!!(firebaseEnabled && user));

  useEffect(() => {
    let t: number | undefined;
    if (roomsLoading) {
      // スケルトンローディングを完全に無効化
      // リアルタイムゲームではローディング体験よりも
      // 瞬時のレスポンスを優先する
      // t = window.setTimeout(() => setShowSkeletons(true), 150);
    } else {
      setShowSkeletons(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [roomsLoading]);

  // シンプルなタイトルアニメーション
  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        {
          opacity: 0,
          y: 20,
          scale: 0.95,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "power2.out",
          delay: 0.3,
        }
      );
    }
  }, []);

  // 前回の部屋への導線（任意復帰）
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const lr = window.localStorage.getItem("lastRoom");
      setLastRoom(lr && lr.trim() ? lr : null);
    } catch {}
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

  // 正確な人数表示は RTDB presence を第一に、
  // 未対応環境では Firestore の lastSeen をフォールバックで利用
  const { counts: lobbyCounts, refresh: refreshLobbyCounts } = useLobbyCounts(
    roomIds,
    !!(firebaseEnabled && user && roomIds.length > 0),
    { excludeUid: user?.uid }
  );

  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const thirtyMin = 30 * 60 * 1000;
    return (rooms || []).filter((r: any) => {
      // 1) 期限切れを除外
      const expires = (r as any).expiresAt;
      const expMs =
        typeof expires?.toMillis === "function" ? expires.toMillis() : 0;
      if (expMs && expMs <= now) return false;

      // 2) 完了済みは非表示
      if (r.status === "completed") return false;

      // 2.5) ゲーム進行中は常に表示（ベストプラクティス: 観戦/後から参加の導線を確保）
      // waiting 以外（completed 以外）は進行中として扱う
      // 先に必要な値を計算（この後の分岐で使用）
      const activeCount0 = lobbyCounts[r.id] ?? 0;
      const lastActiveAny0: any = (r as any).lastActiveAt;
      const createdAny0: any = (r as any).createdAt;
      const lastActiveMs0 = lastActiveAny0?.toMillis
        ? lastActiveAny0.toMillis()
        : lastActiveAny0 instanceof Date
          ? lastActiveAny0.getTime()
          : typeof lastActiveAny0 === "number"
            ? lastActiveAny0
            : 0;
      const createdMs0 = createdAny0?.toMillis
        ? createdAny0.toMillis()
        : createdAny0 instanceof Date
          ? createdAny0.getTime()
          : typeof createdAny0 === "number"
            ? createdAny0
            : 0;
      const newerMs0 = Math.max(lastActiveMs0, createdMs0);

      const isInProgress =
        r.status && r.status !== "waiting" && r.status !== "completed";
      if (isInProgress) {
        // 進行中の部屋でも、誰もオンラインでなく、長時間更新が無ければ非表示
        const INPROG_DISPLAY_MS = 15 * 60 * 1000; // 15min
        if (activeCount0 > 0) return true;
        if (newerMs0 > 0 && now - newerMs0 <= INPROG_DISPLAY_MS) return true;
        return false;
      }

      // 3) オンライン人数による表示制御
      const activeCount = lobbyCounts[r.id] ?? 0;

      // lastActiveAt と createdAt の新しい方を使用
      const lastActiveAny: any = (r as any).lastActiveAt;
      const createdAny: any = (r as any).createdAt;

      const lastActiveMs = lastActiveAny?.toMillis
        ? lastActiveAny.toMillis()
        : lastActiveAny instanceof Date
          ? lastActiveAny.getTime()
          : typeof lastActiveAny === "number"
            ? lastActiveAny
            : 0;

      const createdMs = createdAny?.toMillis
        ? createdAny.toMillis()
        : createdAny instanceof Date
          ? createdAny.getTime()
          : typeof createdAny === "number"
            ? createdAny
            : 0;

      // より新しいタイムスタンプを使用
      const newerMs = Math.max(lastActiveMs, createdMs);

      // 表示ウィンドウ（環境変数で上書き可能）
      // デフォルト: 最近活動5分以内は表示。作成直後のルームは10分まで表示。
      const NEWER_DISPLAY_MS =
        Number(process.env.NEXT_PUBLIC_LOBBY_RECENT_MS) || 5 * 60 * 1000; // 5min
      const CREATED_DISPLAY_MS = 10 * 60 * 1000; // 10min

      // 3.1) 待機中: オンライン1人以上なら常に表示。
      // それ以外は「最近活動」または「作成直後」を許容して表示する。
      if (activeCount > 0) return true;
      if (newerMs > 0 && now - newerMs <= NEWER_DISPLAY_MS) return true;
      if (createdMs > 0 && now - createdMs <= CREATED_DISPLAY_MS) return true;
      return false;
    });
  }, [rooms, lobbyCounts]);

  // 直感的な並び順: 
  // 1) オンライン人数が多い順（>0 を優先）
  // 2) createdAt の新しい順（新規作成を優先表示）
  // 3) lastActiveAt の新しい順（最終アクティブ）
  const sortedRooms = useMemo(() => {
    const getMs = (v: any) =>
      v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : 0;
    const list = [...filteredRooms];
    list.sort((a: any, b: any) => {
      const ca = lobbyCounts[a.id] ?? 0;
      const cb = lobbyCounts[b.id] ?? 0;
      if ((cb > 0 ? 1 : 0) !== (ca > 0 ? 1 : 0)) return (cb > 0 ? 1 : 0) - (ca > 0 ? 1 : 0);
      const aCreated = getMs(a.createdAt);
      const bCreated = getMs(b.createdAt);
      if (aCreated !== bCreated) return bCreated - aCreated;
      const aActive = getMs(a.lastActiveAt);
      const bActive = getMs(b.lastActiveAt);
      return bActive - aActive;
    });
    return list;
  }, [filteredRooms, lobbyCounts]);

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
    <Box bg="canvasBg" minH="100dvh">
      <Box
        position="relative"
        overflow="hidden"
        pt={{ base: 20, md: 24, lg: 32 }}
        css={{ 
          containerType: "inline-size",
          // DPI scaling optimization
          "@container (max-width: 600px)": {
            paddingTop: "5rem", // 80px at 100% = 100px at 125%
          },
          "@container (min-width: 600px) and (max-width: 900px)": {
            paddingTop: "6rem", // 96px at 100% = 120px at 125%
          },
          "@container (min-width: 900px)": {
            paddingTop: "8rem", // 128px at 100% = 160px at 125%
          }
        }}
      >
        <Container maxW="7xl" position="relative" zIndex={1}>
          <VStack gap={{ base: 16, lg: 20 }} align="center">
            <VStack gap={8} align="center" textAlign="center" maxW="4xl">
              <Box>
                {/* 騎士とタイトルのメインビジュアル */}
                <HStack
                  justify="center"
                  align="center"
                  gap={{ base: 4, md: 6 }}
                  mb={6}
                  flexWrap={{ base: "wrap", md: "nowrap" }}
                >
                  <KnightCharacter />
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
                      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))",
                      // DPI scaling font optimization
                      "@container (max-width: 600px)": {
                        fontSize: "2.5rem", // 40px base, scales to 50px at 125%
                      },
                      "@container (min-width: 600px) and (max-width: 900px)": {
                        fontSize: "4rem", // 64px base, scales to 80px at 125%
                      },
                      "@container (min-width: 900px)": {
                        fontSize: "5rem", // 80px base, scales to 100px at 125%
                      }
                    }}
                  >
                    序の紋章III
                  </Heading>
                </HStack>
                <Text
                  fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                  color="fgMuted"
                  fontWeight={500}
                  lineHeight={1.4}
                  letterSpacing="-0.02em"
                  maxW="3xl"
                  mx="auto"
                  css={{
                    // DPI scaling subtitle optimization
                    "@container (max-width: 600px)": {
                      fontSize: "1.125rem", // 18px base for mobile readability
                      lineHeight: "1.5",
                    },
                    "@container (min-width: 600px) and (max-width: 900px)": {
                      fontSize: "1.375rem", // 22px base for tablet
                      lineHeight: "1.45",
                    },
                    "@container (min-width: 900px)": {
                      fontSize: "1.75rem", // 28px base for desktop
                      lineHeight: "1.4",
                    }
                  }}
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

              <VStack 
                gap={6} 
                align="center"
                css={{
                  // DPI scaling button group optimization
                  "@container (max-width: 600px)": {
                    gap: "1rem", // 16px gap for mobile
                  },
                  "@container (min-width: 600px)": {
                    gap: "1.5rem", // 24px gap for larger screens
                  }
                }}
              >
                <HStack
                  gap={4}
                  flexWrap="wrap"
                  justify={{ base: "center", md: "flex-end" }}
                  css={{
                    // Ensure minimum touch target size (44px)
                    "& button": {
                      minHeight: "2.75rem", // 44px minimum for touch accessibility
                      minWidth: "2.75rem",
                      "@container (max-width: 600px)": {
                        minHeight: "3rem", // 48px for better mobile UX
                        fontSize: "0.9rem", // Slightly smaller text on mobile
                      }
                    }
                  }}
                >
                  <AppButton
                    size="lg"
                    visual="solid"
                    palette="brand"
                    onClick={openCreateFlow}
                  >
                    <Plus size={20} style={{ marginRight: "8px" }} />
                    新しいルームを作成
                  </AppButton>
                  {lastRoom ? (
                    <AppButton
                      size="lg"
                      visual="outline"
                      palette="gray"
                      onClick={async () => {
                        if (!lastRoom) return;
                        try {
                          await transition.navigateWithTransition(
                            `/rooms/${lastRoom}`,
                            {
                              direction: "fade",
                              duration: 1.2,
                              showLoading: true,
                              loadingSteps: [
                                { id: "firebase", message: "せつぞく中です...", duration: 1500 },
                                { id: "room", message: "ぜんかいの ルームに もどっています...", duration: 2000 },
                                { id: "player", message: "プレイヤーじょうほうを かくにんしています...", duration: 1800 },
                                { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
                              ],
                            },
                            async () => {
                              try {
                                (window as any).requestIdleCallback?.(() => {
                                  try {
                                    router.prefetch(`/rooms/${lastRoom}`);
                                  } catch {}
                                });
                              } catch {}
                            }
                          );
                        } catch (error) {
                          console.error("Last room transition failed:", error);
                          router.push(`/rooms/${lastRoom}`);
                        }
                      }}
                    >
                      戻る: 前回のルーム
                    </AppButton>
                  ) : null}
                  <AppButton
                    size="lg"
                    visual="outline"
                    palette="gray"
                    onClick={async () => {
                      try {
                        await transition.navigateWithTransition(
                          "/rules",
                          {
                            direction: "fade",
                            duration: 1.0,
                            showLoading: true,
                            loadingSteps: [
                              { id: "loading", message: "ルールせつめいを よみこんでいます...", duration: 1000 },
                              { id: "prepare", message: "せつめいを じゅんびしています...", duration: 800 },
                              { id: "ready", message: "よみこみ かんりょう！", duration: 600 },
                            ],
                          }
                        );
                      } catch (error) {
                        console.error("Rules navigation failed:", error);
                        router.push("/rules");
                      }
                    }}
                    onMouseEnter={() => router.prefetch("/rules")}
                  >
                    <BookOpen size={20} style={{ marginRight: "8px" }} />
                    ルールを見る
                  </AppButton>
                </HStack>
              </VStack>
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* ルーム一覧 */}
      <Container 
        maxW="7xl" 
        py={{ base: 12, md: 16 }}
        css={{
          // DPI scaling container optimization
          "@container (max-width: 600px)": {
            paddingTop: "2.5rem", // 40px base for mobile
            paddingBottom: "2.5rem",
          },
          "@container (min-width: 600px) and (max-width: 900px)": {
            paddingTop: "3rem", // 48px base for tablet
            paddingBottom: "3rem",
          },
          "@container (min-width: 900px)": {
            paddingTop: "4rem", // 64px base for desktop
            paddingBottom: "4rem",
          }
        }}
      >
        <Grid
          templateColumns={{ base: "1fr", xl: "1fr 340px" }}
          gap={{ base: 8, xl: 12 }}
          alignItems="start"
          css={{
            // DPI scaling grid optimization
            "@container (max-width: 600px)": {
              gap: "1.5rem", // 24px gap for mobile
            },
            "@container (min-width: 600px)": {
              gap: "2rem", // 32px gap for larger screens
            }
          }}
        >
          <GridItem>
            <Box
              mb={8}
              bg="bgPanel"
              border="borders.retrogame"
              borderColor="whiteAlpha.90"
              borderRadius={0}
              p={5}
              boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
              position="relative"
            >
              <HStack justify="space-between" mb={4}>
                <HStack gap={3}>
                  <Box
                    w={10}
                    h={10}
                    borderRadius={0}
                    bg="bgSubtle"
                    border="borders.retrogameThin"
                    borderColor="whiteAlpha.60"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
                  >
                    <Users size={20} />
                  </Box>
                  <VStack align="start" gap={1}>
                    <HStack gap={2} align="center">
                      <Heading
                        size="xl"
                        fontWeight={700}
                        color="white"
                        fontFamily="monospace"
                        textShadow="1px 1px 0px #000"
                        letterSpacing="0.5px"
                      >
                        アクティブルーム
                      </Heading>
                      <Text
                        fontSize="sm"
                        fontWeight={700}
                        color="green.300"
                        fontFamily="monospace"
                        textShadow="1px 1px 0px rgba(0,0,0,0.8)"
                        letterSpacing="0.5px"
                      >
                        {filteredRooms.length}件
                      </Text>
                    </HStack>
                    <Text
                      fontSize="sm"
                      color="whiteAlpha.80"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                    >
                      進行中のルームも表示します（参加は待機中のみ）
                    </Text>
                  </VStack>
                </HStack>

                <HStack gap={2}>
                  {/* リフレッシュボタン */}
                  <AppButton
                    size="sm"
                    visual="outline"
                    palette="gray"
                    onClick={() => {
                      refreshRooms();
                      refreshLobbyCounts();
                    }}
                    loading={roomsLoading}
                    disabled={!firebaseEnabled}
                  >
                    <RefreshCw size={16} />
                  </AppButton>

                  {/* スタイリッシュな名前設定ボタン */}
                  <AppButton
                    size="sm"
                    visual={displayName ? "outline" : "solid"}
                    palette={displayName ? "gray" : "brand"}
                    onClick={openNameChange}
                  >
                    <User size={16} style={{ marginRight: 8 }} />
                    {displayName ? "プレイヤー設定" : "名前を設定"}
                  </AppButton>
                </HStack>
              </HStack>
            </Box>

            {!firebaseEnabled ? (
              <Box
                p={12}
                textAlign="center"
                borderRadius={0}
                border="borders.retrogame"
                borderColor="dangerBorder"
                bg="dangerSubtle"
                boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
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
                    borderRadius={0}
                    bg="bgSubtle"
                    border="borders.retrogameThin"
                    borderColor="whiteAlpha.40"
                    opacity={0.6}
                    boxShadow="1px 1px 0 rgba(0,0,0,0.4)"
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
                {sortedRooms.map((room: any) => (
                  <RoomCard
                    key={room.id}
                    name={stripMinimalTag(room.name) || ""}
                    status={room.status}
                    count={lobbyCounts[room.id] ?? 0}
                    hostName={room.hostName || "匿名"}
                    onJoin={async () => {
                      // 名前未設定の場合は先にモーダルを表示
                      if (!displayName || !String(displayName).trim()) {
                        setTempName("");
                        setNameDialogMode("create");
                        // 参加予定のルームIDを一時保存
                        setLastRoom(room.id);
                        nameDialog.onOpen();
                        return;
                      }

                      try {
                        await transition.navigateWithTransition(
                          `/rooms/${room.id}`,
                          {
                            direction: "fade",
                            duration: 1.2,
                            showLoading: true,
                            loadingSteps: [
                              { id: "firebase", message: "せつぞく中です...", duration: 1500 },
                              { id: "room", message: "ルームの じょうほうを とくていしています...", duration: 2000 },
                              { id: "player", message: "プレイヤーを とうろくしています...", duration: 1800 },
                              { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
                            ],
                          },
                          async () => {
                            // プリフェッチなどの最終処理
                            try {
                              (window as any).requestIdleCallback?.(() => {
                                try {
                                  router.prefetch(`/rooms/${room.id}`);
                                } catch {}
                              });
                            } catch {}
                          }
                        );
                      } catch (error) {
                        console.error("Room join transition failed:", error);
                        // フォールバック: 通常のナビゲーション
                        router.push(`/rooms/${room.id}`);
                      }
                    }}
                  />
                ))}
              </Grid>
            ) : (
              <Box
                textAlign="center"
                py={16}
                px={8}
                borderRadius={0}
                border="borders.retrogame"
                borderColor="whiteAlpha.60"
                bg="bgSubtle"
                boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
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
              {/* 開発者メモ */}
              <Box
                bg="bgPanel"
                border="borders.retrogame"
                borderColor="whiteAlpha.90"
                borderRadius={0}
                p={5}
                boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
                position="relative"
              >
                <VStack gap={4} align="stretch">
                  <HStack gap={3} align="center">
                    <Box
                      w={10}
                      h={10}
                      borderRadius={0}
                      bg="bgSubtle"
                      border="borders.retrogameThin"
                      borderColor="whiteAlpha.60"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
                    >
                      <img
                        src="/images/hanepen1.webp"
                        alt="羽ペン"
                        style={{
                          width: "20px",
                          height: "20px",
                          filter: "brightness(0) invert(1)",
                          objectFit: "contain",
                        }}
                      />
                    </Box>
                    <Text
                      fontWeight={600}
                      fontSize="lg"
                      color="white"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                      letterSpacing="0.5px"
                    >
                      開発者メモ
                    </Text>
                  </HStack>

                  <VStack gap={3} align="start" pl={2}>
                    <Box>
                      <Text
                        fontSize="sm"
                        color="white"
                        fontFamily="monospace"
                        fontWeight={600}
                        mb={1}
                      >
                        ★ 技術的更新
                      </Text>
                      <VStack gap={1} align="start" pl={4}>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・DPIスケール対応
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・Firebase最適化
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・ロビーリフレッシュ機能
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・パフォーマンス向上
                        </Text>
                      </VStack>
                    </Box>

                    <Box>
                      <Text
                        fontSize="sm"
                        color="white"
                        fontFamily="monospace"
                        fontWeight={600}
                        mb={1}
                      >
                        ▲ 調整中
                      </Text>
                      <VStack gap={1} align="start" pl={4}>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・UI細部ブラッシュアップ
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・アニメーション最適化
                        </Text>
                      </VStack>
                    </Box>

                    <Box>
                      <Text
                        fontSize="sm"
                        color="white"
                        fontFamily="monospace"
                        fontWeight={600}
                        mb={1}
                      >
                        ◆ 今後の予定
                      </Text>
                      <VStack gap={1} align="start" pl={4}>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・新機能検討
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・ユーザビリティ向上
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・コーヒーを辞める
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・制限エラー通知システム
                        </Text>
                      </VStack>
                    </Box>
                  </VStack>

                  {/* テスト用ローディングアニメーション */}
                  <Box mt={4} pt={4} borderTop="1px solid rgba(255,255,255,0.2)">
                    <Text
                      fontSize="sm"
                      color="white"
                      fontFamily="monospace"
                      fontWeight={600}
                      mb={2}
                    >
                      🛠️ 開発テスト
                    </Text>
                    <AppButton
                      size="sm"
                      visual="outline"
                      palette="gray"
                      onClick={async () => {
                        await transition.navigateWithTransition(
                          window.location.pathname,
                          {
                            direction: "fade",
                            duration: 0.8,
                            showLoading: true,
                            loadingSteps: [
                              { id: "firebase", message: "せつぞく中です...", duration: 1500 },
                              { id: "room", message: "ルームの じょうほうを とくていしています...", duration: 2000 },
                              { id: "player", message: "プレイヤーを とうろくしています...", duration: 1800 },
                              { id: "ready", message: "じゅんび かんりょう！", duration: 1000 },
                            ],
                          }
                        );
                      }}
                      css={{
                        width: "100%",
                        fontSize: "xs",
                        fontFamily: "monospace",
                        height: "28px",
                      }}
                    >
                      ローディングテスト
                    </AppButton>
                  </Box>
                </VStack>
              </Box>
            </VStack>
          </GridItem>
        </Grid>
      </Container>

      <NameDialog
        isOpen={nameDialog.open}
        defaultValue={tempName}
        mode={nameDialogMode}
        onCancel={() => nameDialog.onClose()}
        onSubmit={async (val) => {
          if (!val?.trim()) return;
          setDisplayName(val.trim());
          nameDialog.onClose();

          // 名前設定後のアクション判定
          if (nameDialogMode === "create") {
            // lastRoomがある場合（参加待ちルーム）は自動参加
            if (lastRoom) {
              const roomToJoin = lastRoom;
              setLastRoom(null); // 一時保存をクリア

              try {
                await transition.navigateWithTransition(
                  `/rooms/${roomToJoin}`,
                  {
                    direction: "fade",
                    duration: 1.2,
                    showLoading: true,
                    loadingSteps: [
                      { id: "firebase", message: "せつぞく中です...", duration: 1500 },
                      { id: "room", message: "ルームの じょうほうを とくていしています...", duration: 2000 },
                      { id: "player", message: "プレイヤーを とうろくしています...", duration: 1800 },
                      { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
                    ],
                  },
                  async () => {
                    try {
                      (window as any).requestIdleCallback?.(() => {
                        try {
                          router.prefetch(`/rooms/${roomToJoin}`);
                        } catch {}
                      });
                    } catch {}
                  }
                );
              } catch (error) {
                console.error("Room join after name setup failed:", error);
                router.push(`/rooms/${roomToJoin}`);
              }
            } else {
              // 通常のルーム作成フロー
              createDialog.onOpen();
            }
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
