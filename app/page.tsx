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

// ナイトキャラ
function KnightCharacter() {
  const knightImage = "/images/knight1.webp";
  const knightAlt = "序の紋章III Male Knight";

  return (
    <Image
      src={knightImage}
      alt={knightAlt}
      boxSize={{ base: "16", md: "20", lg: "24" }}
      objectFit="contain"
      filter="drop-shadow(0 6px 16px rgba(0,0,0,0.6))"
      css={{
        // Dragon Quest-style: pixel art friendly size
        imageRendering: "pixelated", // Keep crisp pixel art
        "@container (max-width: 600px)": {
          width: "3.5rem", // 56px for mobile
          height: "3.5rem",
        },
        "@container (min-width: 600px) and (max-width: 900px)": {
          width: "4.5rem", // 72px for tablet
          height: "4.5rem",
        },
        "@container (min-width: 900px)": {
          width: "6rem", // 96px for desktop
          height: "6rem",
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

// 開発者メモボックスの共通スタイル定数
const DEVELOPER_NOTE_STYLES = {
  box: {
    p: 4,
    bg: "rgba(12,14,20,0.6)",
    borderRadius: 0,
  },
  heading: {
    fontSize: "sm" as const,
    fontFamily: "monospace",
    fontWeight: 700,
    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
  },
  text: {
    fontSize: "xs" as const,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "monospace",
    lineHeight: "1.7",
  },
} as const;

export default function MainMenu() {
  const router = useRouter();
  const { user, displayName, setDisplayName } = useAuth();
  const transition = useTransition();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "edit">("create");
  const pendingJoinRef = useRef<LobbyRoom | null>(null);
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

  // onSnapshotは重いから定期取得に変更
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

  // タイトルアニメーション
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
          duration: 0.9,
          ease: "back.out(1.15)",
          delay: 0.25,
        }
      );
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

  const roomMap = useMemo(() => {
    const map = new Map<string, LobbyRoom>();
    rooms.forEach((room) => {
      map.set(room.id, room);
    });
    return map;
  }, [rooms]);

  // 人数カウント（RTDB優先、ない時はFirestore使う）
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

  // ソート順: 人数多い → 新規作成 → 最終アクティブ
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
        pendingJoinRef.current = room;
        setTempName("");
        setNameDialogMode("create");
        nameDialog.onOpen();
        return;
      }

      pendingJoinRef.current = null;

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
      setNameDialogMode,
      setTempName,
      transition,
    ]
  );

  useEffect(() => {
    if (!displayName || !displayName.trim()) return;
    const pendingRoom = pendingJoinRef.current;
    if (pendingRoom) {
      pendingJoinRef.current = null;
      void goToRoom(pendingRoom);
    }
  }, [displayName, goToRoom]);

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      const room = roomMap.get(roomId) ?? null;
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
    [goToRoom, roomMap]
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
    pendingJoinRef.current = null;
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
          background: "linear-gradient(to bottom, rgba(8,9,15,0.95) 0%, rgba(8,9,15,0.9) 100%)",
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
                    fontSize={{ base: "3xl", md: "5xl", lg: "6xl" }}
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
                        fontSize: "2rem", // 32px base
                      },
                      "@container (min-width: 600px) and (max-width: 900px)": {
                        fontSize: "3.5rem", // 56px base
                      },
                      "@container (min-width: 900px)": {
                        fontSize: "4.5rem", // 72px base
                      },
                    }}
                  >
                    序の紋章III
                  </Heading>
                </HStack>
                <Text
                  fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                  color="rgba(255,255,255,0.85)"
                  fontWeight={500}
                  lineHeight={1.4}
                  letterSpacing="0.02em"
                  maxW="3xl"
                  mx="auto"
                  textShadow="0 2px 4px rgba(0,0,0,0.6)"
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
                    color="rgba(255,255,255,0.95)"
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
                  <HStack align="baseline" gap={3}>
                    <Heading
                      size="xl"
                      fontWeight={700}
                      color="white"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                      letterSpacing="0.5px"
                    >
                      アクティブな部屋
                    </Heading>
                    <Text
                      fontSize="sm"
                      fontWeight={600}
                      color="rgba(255,255,255,0.6)"
                      fontFamily="monospace"
                    >
                      {searchFilteredRooms.length}件
                    </Text>
                  </HStack>
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
                      id={room.id}
                      name={stripMinimalTag(room.name) || ""}
                      status={room.status}
                      count={lobbyCounts[room.id] ?? 0}
                      creatorName={room.creatorName || room.hostName || "匿名"}
                      hostName={room.hostName || null}
                      requiresPassword={room.requiresPassword}
                      onJoin={handleJoinRoom}
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
                    ? `「${displaySearchKeyword}」に一致する部屋はありません`
                    : "アクティブな部屋がまだありません"}
                </Heading>
                <Text color="fgMuted" mb={6} maxW="400px" mx="auto">
                  {activeSearch
                    ? "別のキーワードで検索するか、新しい部屋を作成してみましょう"
                    : "新しい部屋を作成して、友だちを招待してみましょう"}
                </Text>
                {activeSearch ? (
                  <AppButton
                    onClick={() => {
                      setSearchInput("");
                      setPageIndex(0);
                    }}
                    visual="solid"
                    palette="gray"
                  >
                    <Plus size={18} style={{ marginRight: "8px" }} />
                    検索をクリア
                  </AppButton>
                ) : (
                  <AppButton
                    onClick={openCreateFlow}
                    visual="solid"
                    palette="brand"
                  >
                    <Plus size={18} style={{ marginRight: "8px" }} />
                    新しい部屋を作成
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
                      開発者より
                    </Text>
                  </HStack>

                  <VStack gap={4} align="stretch">
                    <Box {...DEVELOPER_NOTE_STYLES.box} border="2px solid rgba(255,255,255,0.2)">
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(255,255,255,0.95)">
                            🎮
                          </Text>
                          <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(255,255,255,0.95)">
                            このゲームについて
                          </Text>
                        </HStack>
                        <Text {...DEVELOPER_NOTE_STYLES.text} textShadow="1px 1px 0px #000">
                          &ldquo;連想ワードだけで数字の大小をそろえる&rdquo;という発想が面白く、
                          それをオンラインマルチプレイ向けに遊びやすく再構成しました。
                          同時ドラッグの共同編集、ホストの操作でカードが次々めくれる演出、
                          リアルタイム同期による一体感を目指しました。
                        </Text>
                      </VStack>
                    </Box>

                    <Box
                      {...DEVELOPER_NOTE_STYLES.box}
                      border="2px solid rgba(34,197,94,0.3)"
                      css={{
                        borderLeft: "3px solid transparent",
                        borderImage: "linear-gradient(to bottom, rgba(34,197,94,0.95), rgba(34,197,94,0.5)) 1"
                      }}
                    >
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(34,197,94,0.95)">
                            ⚠️
                          </Text>
                          <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(34,197,94,0.95)">
                            注意事項
                          </Text>
                        </HStack>
                        <Text {...DEVELOPER_NOTE_STYLES.text}>
                          本作は公式とは無関係のオリジナル作品です。
                          「ブラウザでここまでできるの!?」を目指しています。
                        </Text>
                      </VStack>
                    </Box>

                    <Box
                      {...DEVELOPER_NOTE_STYLES.box}
                      border="2px solid rgba(147,51,234,0.3)"
                      css={{
                        borderLeft: "3px solid transparent",
                        borderImage: "linear-gradient(to bottom, rgba(147,51,234,0.95), rgba(147,51,234,0.5)) 1"
                      }}
                    >
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Box w="1em" display="flex" justifyContent="center">
                            <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(147,51,234,0.95)">
                              ◆
                            </Text>
                          </Box>
                          <Text {...DEVELOPER_NOTE_STYLES.heading} color="rgba(147,51,234,0.95)">
                            今後の予定
                          </Text>
                        </HStack>
                        <VStack gap={1.5} align="start" pl={2}>
                          <Text {...DEVELOPER_NOTE_STYLES.text}>
                            ・ちゃんと寝る
                          </Text>
                          <Text {...DEVELOPER_NOTE_STYLES.text}>
                            ・コーヒーを辞める（最重要）
                          </Text>
                        </VStack>
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
        onCancel={() => {
          pendingJoinRef.current = null;
          nameDialog.onClose();
        }}
        onSubmit={async (val) => {
          if (!val?.trim()) return;
          const trimmed = val.trim();
          setDisplayName(trimmed);
          nameDialog.onClose();

          if (pendingJoinRef.current) {
            return;
          }

          // 名前設定後のアクション判定
          if (nameDialogMode === "create") {
            // 通常のルーム作成フロー
            createDialog.onOpen();
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
