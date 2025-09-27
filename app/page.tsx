"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomCard } from "@/components/RoomCard";
import { RoomPasswordPrompt } from "@/components/RoomPasswordPrompt";
import { AppButton } from "@/components/ui/AppButton";
import { Pagination } from "@/components/ui/Pagination";
import { SearchBar } from "@/components/ui/SearchBar";
import { useTransition } from "@/components/ui/TransitionProvider";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { stripMinimalTag } from "@/lib/game/displayMode";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import {
  ROOMS_PER_PAGE,
  useOptimizedRooms,
} from "@/lib/hooks/useOptimizedRooms";
import { verifyPassword } from "@/lib/security/password";
import { toMillis } from "@/lib/time";
import type { RoomDoc } from "@/lib/types";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import {
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
import type { FieldValue, Timestamp } from "firebase/firestore";
import { gsap } from "gsap";
import { BookOpen, Plus, RefreshCw, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
        },
      }}
    />
  );
}

type LobbyRoom = (RoomDoc & { id: string }) & {
  expiresAt?: Timestamp | Date | number | FieldValue | null;
  lastActiveAt?: Timestamp | Date | number | FieldValue | null;
  createdAt?: Timestamp | Date | number | FieldValue | null;
  deal?: RoomDoc["deal"];
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    room: LobbyRoom;
  } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [hideLockedRooms, setHideLockedRooms] = useState(false);
  const [showJoinableOnly, setShowJoinableOnly] = useState(false);

  useEffect(() => {
    const prefetchRules = () => {
      try {
        router.prefetch("/rules");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          logDebug("main-menu", "prefetch-rules-skipped", error);
        }
      }
    };

    const idleWindow = window as WindowWithIdleCallback;
    const idleCallback = idleWindow.requestIdleCallback;
    if (typeof idleCallback === "function") {
      const idleHandle = idleCallback(prefetchRules);
      return () => {
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutId = window.setTimeout(prefetchRules, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(handler);
    };
  }, [searchInput]);
  // タイトルアニメーション用のref
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 2020年代以降のロビーベストプラクティスに合わせ、
  // 常時 onSnapshot を避け、周期的な取得に最適化されたフックを使用
  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
    refresh: refreshRooms,
    pageSize: roomsPerPage,
  } = useOptimizedRooms({
    enabled: !!(firebaseEnabled && user),
    page: pageIndex,
    searchQuery: debouncedSearch,
  });

  useEffect(() => {
    if (!roomsLoading) {
      setShowSkeletons(false);
    }
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
    } catch (error) {
      logDebug("lobby-page", "restore-last-room-failed", error);
    }
  }, []);

  useEffect(() => {
    if (!roomsError) return;
    notify({
      title: "ルーム取得に失敗しました",
      description: roomsError.message,
      type: "error",
    });
  }, [roomsError]);

  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);

  // 正確な人数表示は RTDB presence を第一に、
  // 未対応環境では Firestore の lastSeen をフォールバックで利用
  const { counts: lobbyCounts, refresh: refreshLobbyCounts } = useLobbyCounts(
    roomIds,
    !!(firebaseEnabled && user && roomIds.length > 0),
    { excludeUid: user?.uid }
  );

  const filteredRooms = useMemo(() => {
    const now = Date.now();
    const inProgressDisplayMs = 15 * 60 * 1000; // 15min
    const recentWindowMs =
      Number(process.env.NEXT_PUBLIC_LOBBY_RECENT_MS) || 5 * 60 * 1000;
    const createdWindowMs = 10 * 60 * 1000;

    return rooms.filter((room) => {
      const expiresAtMs = toMillis(room.expiresAt);
      if (expiresAtMs && expiresAtMs <= now) {
        return false;
      }

      const status = room.status as RoomDoc["status"] | "completed";
      if (status === "finished" || status === "completed") {
        return false;
      }

      const activeCount = lobbyCounts[room.id] ?? 0;
      const lastActiveMs = toMillis(room.lastActiveAt);
      const createdMs = toMillis(room.createdAt);
      const newestMs = Math.max(lastActiveMs, createdMs);

      const inProgress = status !== "waiting";
      if (inProgress) {
        if (activeCount > 0) {
          return true;
        }
        return newestMs > 0 && now - newestMs <= inProgressDisplayMs;
      }

      if (activeCount > 0) {
        return true;
      }

      if (newestMs > 0 && now - newestMs <= recentWindowMs) {
        return true;
      }

      if (createdMs > 0 && now - createdMs <= createdWindowMs) {
        return true;
      }

      return false;
    });
  }, [rooms, lobbyCounts]);

  const optionFilteredRooms = useMemo(() => {
    return filteredRooms.filter((room) => {
      if (hideLockedRooms && room.requiresPassword) {
        return false;
      }
      if (showJoinableOnly && room.status !== "waiting") {
        return false;
      }
      return true;
    });
  }, [filteredRooms, hideLockedRooms, showJoinableOnly]);

  const searchFilteredRooms = useMemo(() => {
    if (!debouncedSearch) return optionFilteredRooms;
    const query = debouncedSearch.toLowerCase();
    return optionFilteredRooms.filter((room) => {
      const baseName =
        stripMinimalTag(room.name)?.toString().toLowerCase() ?? "";
      const hostName = room.hostName?.toLowerCase?.() ?? "";
      const creatorName = room.creatorName?.toLowerCase?.() ?? "";
      return (
        baseName.includes(query) ||
        hostName.includes(query) ||
        creatorName.includes(query)
      );
    });
  }, [optionFilteredRooms, debouncedSearch]);

  // 直感的な並び順:
  // 1) オンライン人数が多い順（>0 を優先）
  // 2) createdAt の新しい順（新規作成を優先表示）
  // 3) lastActiveAt の新しい順（最終アクティブ）
  const sortedRooms = useMemo(() => {
    const list = [...searchFilteredRooms];
    list.sort((a, b) => {
      const countA = lobbyCounts[a.id] ?? 0;
      const countB = lobbyCounts[b.id] ?? 0;
      if ((countB > 0 ? 1 : 0) !== (countA > 0 ? 1 : 0)) {
        return (countB > 0 ? 1 : 0) - (countA > 0 ? 1 : 0);
      }
      const createdA = toMillis(a.createdAt);
      const createdB = toMillis(b.createdAt);
      if (createdA !== createdB) {
        return createdB - createdA;
      }
      return toMillis(b.lastActiveAt) - toMillis(a.lastActiveAt);
    });
    return list;
  }, [searchFilteredRooms, lobbyCounts]);

  const pageSize =
    roomsPerPage && roomsPerPage > 0 ? roomsPerPage : ROOMS_PER_PAGE;

  const totalPages = useMemo(() => {
    if (!pageSize || pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(sortedRooms.length / pageSize));
  }, [sortedRooms.length, pageSize]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= totalPages) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const paginatedRooms = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRooms.slice(start, start + pageSize);
  }, [sortedRooms, pageIndex, pageSize]);

  const hasPrevPage = pageIndex > 0;
  const hasNextPage = pageIndex < totalPages - 1;
  const activeSearch = debouncedSearch.length > 0;
  const displaySearchKeyword = activeSearch ? debouncedSearch.slice(0, 40) : "";

  const goToRoom = useCallback(
    async (room: LobbyRoom) => {
      if (!room) return;
      if (!displayName || !String(displayName).trim()) {
        setTempName("");
        setNameDialogMode("create");
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
              {
                id: "room",
                message: "ルームの じょうほうを とくていしています...",
                duration: 2000,
              },
              {
                id: "player",
                message: "プレイヤーを とうろくしています...",
                duration: 1800,
              },
              {
                id: "ready",
                message: "じゅんびが かんりょうしました！",
                duration: 1000,
              },
            ],
          },
          async () => {
            try {
              (window as WindowWithIdleCallback).requestIdleCallback?.(() => {
                try {
                  router.prefetch(`/rooms/${room.id}`);
                } catch (idleError) {
                  logDebug("main-menu", "prefetch-room-skipped", idleError);
                }
              });
            } catch (idleScheduleError) {
              logDebug(
                "main-menu",
                "prefetch-room-idle-missing",
                idleScheduleError
              );
            }
          }
        );
      } catch (error) {
        logError("main-menu", "join-transition-failed", error);
        router.push(`/rooms/${room.id}`);
      }
    },
    [
      displayName,
      nameDialog,
      router,
      setLastRoom,
      setNameDialogMode,
      setTempName,
      transition,
    ]
  );

  const handleJoinRoom = useCallback(
    (room: LobbyRoom | null) => {
      if (!room) return;
      if (room.status !== "waiting") {
        notify({
          title: "ただいま進行中です",
          description: "ゲームが進行中のため新しい参加を受付できません。",
          type: "warning",
        });
        return;
      }
      if (room.requiresPassword) {
        const cached = getCachedRoomPasswordHash(room.id);
        if (cached && room.passwordHash && cached === room.passwordHash) {
          void goToRoom(room);
          return;
        }
        setPasswordPrompt({ room });
        setPasswordError(null);
        return;
      }
      void goToRoom(room);
    },
    [goToRoom]
  );

  const handlePasswordSubmit = useCallback(
    async (input: string) => {
      if (!passwordPrompt?.room) return;
      setPasswordSubmitting(true);
      setPasswordError(null);
      try {
        const ok = await verifyPassword(
          input.trim(),
          passwordPrompt.room.passwordSalt ?? null,
          passwordPrompt.room.passwordHash ?? null
        );
        if (!ok) {
          setPasswordError("パスワードが違います");
          return;
        }
        storeRoomPasswordHash(
          passwordPrompt.room.id,
          passwordPrompt.room.passwordHash ?? ""
        );
        const targetRoom = passwordPrompt.room;
        setPasswordPrompt(null);
        await goToRoom(targetRoom);
      } catch (error) {
        logError("main-menu", "verify-password", error);
        setPasswordError("パスワードの検証に失敗しました");
      } finally {
        setPasswordSubmitting(false);
      }
    },
    [goToRoom, passwordPrompt]
  );

  const handlePasswordCancel = useCallback(() => {
    if (passwordSubmitting) return;
    setPasswordPrompt(null);
    setPasswordError(null);
  }, [passwordSubmitting]);

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
          },
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
                      },
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
                    },
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
                  },
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
                      },
                    },
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
                                {
                                  id: "firebase",
                                  message: "せつぞく中です...",
                                  duration: 1500,
                                },
                                {
                                  id: "room",
                                  message:
                                    "ぜんかいの ルームに もどっています...",
                                  duration: 2000,
                                },
                                {
                                  id: "player",
                                  message:
                                    "プレイヤーじょうほうを かくにんしています...",
                                  duration: 1800,
                                },
                                {
                                  id: "ready",
                                  message: "じゅんびが かんりょうしました！",
                                  duration: 1000,
                                },
                              ],
                            },
                            async () => {
                              try {
                                (
                                  window as WindowWithIdleCallback
                                ).requestIdleCallback?.(() => {
                                  try {
                                    router.prefetch(`/rooms/${lastRoom}`);
                                  } catch (prefetchError) {
                                    logDebug(
                                      "main-menu",
                                      "prefetch-last-room-skipped",
                                      prefetchError
                                    );
                                  }
                                });
                              } catch (idleError) {
                                logDebug(
                                  "main-menu",
                                  "prefetch-last-room-idle-missing",
                                  idleError
                                );
                              }
                            }
                          );
                        } catch (error) {
                          logError("main-menu", "last-room-transition", error);
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
                        await transition.navigateWithTransition("/rules", {
                          direction: "fade",
                          duration: 1.0,
                          showLoading: true,
                          loadingSteps: [
                            {
                              id: "loading",
                              message: "ルールせつめいを よみこんでいます...",
                              duration: 1000,
                            },
                            {
                              id: "prepare",
                              message: "せつめいを じゅんびしています...",
                              duration: 800,
                            },
                            {
                              id: "ready",
                              message: "よみこみ かんりょう！",
                              duration: 600,
                            },
                          ],
                        });
                      } catch (error) {
                        logError("main-menu", "rules-navigation", error);
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
          },
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
            },
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
                        {searchFilteredRooms.length}件
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

            <Box mt={6} mb={6}>
              <SearchBar
                value={searchInput}
                onChange={(value) => {
                  setSearchInput(value);
                  setPageIndex(0);
                }}
                onClear={() => {
                  setSearchInput("");
                  setPageIndex(0);
                }}
                placeholder="部屋を さがす..."
              />
              <HStack
                gap={3}
                mt={4}
                flexWrap="wrap"
                data-testid="lobby-filter-controls"
              >
                <AppButton
                  size="sm"
                  visual={hideLockedRooms ? "solid" : "outline"}
                  palette={hideLockedRooms ? "success" : "gray"}
                  aria-pressed={hideLockedRooms}
                  onClick={() => {
                    setHideLockedRooms((prev) => !prev);
                    setPageIndex(0);
                  }}
                  css={{
                    minWidth: "180px",
                    textAlign: "center",
                    position: "relative",
                    ...(hideLockedRooms && {
                      boxShadow: `
                        inset 0 3px 6px rgba(0,0,0,0.4),
                        inset 0 -1px 0 rgba(255,255,255,0.1),
                        0 1px 2px rgba(0,0,0,0.2)
                      `,
                      transform: "translateY(1px)",
                    }),
                  }}
                >
                  🔒 ロック部屋を除外
                  {hideLockedRooms && (
                    <Box
                      as="span"
                      position="absolute"
                      top="-4px"
                      right="-4px"
                      w="12px"
                      h="12px"
                      bg="success.500"
                      borderRadius="50%"
                      border="2px solid white"
                      boxShadow="0 0 8px rgba(34, 197, 94, 0.6)"
                    />
                  )}
                </AppButton>
                <AppButton
                  size="sm"
                  visual={showJoinableOnly ? "solid" : "outline"}
                  palette={showJoinableOnly ? "success" : "gray"}
                  aria-pressed={showJoinableOnly}
                  onClick={() => {
                    setShowJoinableOnly((prev) => !prev);
                    setPageIndex(0);
                  }}
                  css={{
                    minWidth: "180px",
                    textAlign: "center",
                    position: "relative",
                    ...(showJoinableOnly && {
                      boxShadow: `
                        inset 0 3px 6px rgba(0,0,0,0.4),
                        inset 0 -1px 0 rgba(255,255,255,0.1),
                        0 1px 2px rgba(0,0,0,0.2)
                      `,
                      transform: "translateY(1px)",
                    }),
                  }}
                >
                  🎮 待機中のみ表示
                  {showJoinableOnly && (
                    <Box
                      as="span"
                      position="absolute"
                      top="-4px"
                      right="-4px"
                      w="12px"
                      h="12px"
                      bg="success.500"
                      borderRadius="50%"
                      border="2px solid white"
                      boxShadow="0 0 8px rgba(34, 197, 94, 0.6)"
                    />
                  )}
                </AppButton>
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
            ) : sortedRooms.length > 0 ? (
              <VStack align="stretch" gap={6}>
                <Grid
                  templateColumns={{
                    base: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(2, 1fr)",
                    lg: "repeat(3, 1fr)",
                    xl: "repeat(3, 1fr)",
                  }}
                  gap={{ base: 4, md: 5 }}
                  alignItems="stretch"
                >
                  {paginatedRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      name={stripMinimalTag(room.name) || ""}
                      status={room.status}
                      count={lobbyCounts[room.id] ?? 0}
                      creatorName={room.creatorName || room.hostName || "匿名"}
                      hostName={room.hostName || null}
                      requiresPassword={room.requiresPassword}
                      onJoin={() => handleJoinRoom(room)}
                    />
                  ))}
                </Grid>
                {totalPages > 1 && (
                  <Pagination
                    currentPage={pageIndex}
                    totalPages={totalPages}
                    onPrev={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                    onNext={() =>
                      setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))
                    }
                    disablePrev={!hasPrevPage}
                    disableNext={!hasNextPage}
                  />
                )}
              </VStack>
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
                  {activeSearch
                    ? `「${displaySearchKeyword}」に ぴったりの ルームは ありません`
                    : "まだアクティブなルームがありません"}
                </Heading>
                <Text color="fgMuted" mb={6} maxW="400px" mx="auto">
                  {activeSearch
                    ? "ことばを かえて さがすか、新しいルームを つくって みんなを まねきましょう"
                    : "新しいルームを作成して、友だちを招待しましょう"}
                </Text>
                {activeSearch ? (
                  <AppButton
                    onClick={() => {
                      setSearchInput("");
                      setPageIndex(0);
                    }}
                    visual="outline"
                    palette="gray"
                  >
                    検索をクリア
                  </AppButton>
                ) : (
                  <AppButton
                    onClick={openCreateFlow}
                    visual="solid"
                    palette="brand"
                  >
                    <Plus size={18} style={{ marginRight: "8px" }} />
                    新しいルームを作成
                  </AppButton>
                )}
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
                          ・コーヒーを辞める（最重要）
                        </Text>
                        <Text
                          fontSize="xs"
                          color="whiteAlpha.80"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                        >
                          ・音響システム実装
                        </Text>
                      </VStack>
                    </Box>
                  </VStack>

                  {/* テスト用ローディングアニメーション */}
                  <Box
                    mt={4}
                    pt={4}
                    borderTop="1px solid rgba(255,255,255,0.2)"
                  >
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
                              {
                                id: "firebase",
                                message: "せつぞく中です...",
                                duration: 1500,
                              },
                              {
                                id: "room",
                                message:
                                  "ルームの じょうほうを とくていしています...",
                                duration: 2000,
                              },
                              {
                                id: "player",
                                message: "プレイヤーを とうろくしています...",
                                duration: 1800,
                              },
                              {
                                id: "ready",
                                message: "じゅんび かんりょう！",
                                duration: 1000,
                              },
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
                      {
                        id: "firebase",
                        message: "せつぞく中です...",
                        duration: 1500,
                      },
                      {
                        id: "room",
                        message: "ルームの じょうほうを とくていしています...",
                        duration: 2000,
                      },
                      {
                        id: "player",
                        message: "プレイヤーを とうろくしています...",
                        duration: 1800,
                      },
                      {
                        id: "ready",
                        message: "じゅんびが かんりょうしました！",
                        duration: 1000,
                      },
                    ],
                  },
                  async () => {
                    try {
                      (window as WindowWithIdleCallback).requestIdleCallback?.(
                        () => {
                          try {
                            router.prefetch(`/rooms/${roomToJoin}`);
                          } catch (prefetchError) {
                            logDebug(
                              "main-menu",
                              "prefetch-rejoin-skipped",
                              prefetchError
                            );
                          }
                        }
                      );
                    } catch (idleError) {
                      logDebug(
                        "main-menu",
                        "prefetch-rejoin-idle-missing",
                        idleError
                      );
                    }
                  }
                );
              } catch (error) {
                logError("main-menu", "post-name-join", error);
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
        onCreated={(roomId) => {
          // CreateRoomModal内でtransition.navigateWithTransitionが既に実行済み
          // 二重ナビゲーションを防ぐため、ここでは何もしない
          logInfo("main-menu", "room-created", { roomId });
        }}
      />
      <RoomPasswordPrompt
        isOpen={!!passwordPrompt}
        roomName={
          passwordPrompt?.room
            ? stripMinimalTag(passwordPrompt.room.name)
            : undefined
        }
        isLoading={passwordSubmitting}
        error={passwordError}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />
    </Box>
  );
}
