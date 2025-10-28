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
import { RichBlackBackground } from "@/components/ui/RichBlackBackground";
import { SupporterCTA } from "@/components/site/SupporterCTA";
import UpdateAvailableBadge from "@/components/ui/UpdateAvailableBadge";

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
          width: scaleForDpi("3.5rem"), // 56px for mobile
          height: scaleForDpi("3.5rem"),
        },
        "@container (min-width: 600px) and (max-width: 900px)": {
          width: scaleForDpi("4.5rem"), // 72px for tablet
          height: scaleForDpi("4.5rem"),
        },
        "@container (min-width: 900px)": {
          width: scaleForDpi("6rem"), // 96px for desktop
          height: scaleForDpi("6rem"),
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

const scaleForDpi = (value: string) => `calc(${value} * var(--dpi-scale))`;

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
          duration: 0.87,
          ease: "back.out(1.17)",
          delay: 0.23,
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
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "connect", message: "せつぞく中です...", duration: 550 },
              {
                id: "prepare",
                message: "じゅんびしています...",
                duration: 750,
              },
              {
                id: "ready",
                message: "かんりょう...",
                duration: 700,
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
    <Box position="relative" minH="100dvh" color="white">
      <RichBlackBackground />
      <Box
        position="relative"
        zIndex={1}
        overflow="hidden"
        pt={{
          base: scaleForDpi("5.7rem"),
          md: scaleForDpi("7.3rem"),
          lg: scaleForDpi("9.1rem"),
        }}
        pb={{
          base: scaleForDpi("2.3rem"),
          md: scaleForDpi("3.1rem"),
          lg: scaleForDpi("4.3rem"),
        }}
        css={{
          // グラスモーフィズム: 魔法の結晶風vignette（Pixi背景を透かす）
          background: "radial-gradient(ellipse 76% 58% at center 32%, transparent 0%, rgba(8,12,18,0.12) 42%, rgba(6,9,15,0.35) 78%, rgba(4,6,11,0.48) 100%)",
          containerType: "inline-size",
          "@container (max-width: 600px)": {
            paddingTop: scaleForDpi("5.1rem"),
            paddingBottom: scaleForDpi("2.1rem"),
          },
          "@container (min-width: 600px) and (max-width: 900px)": {
            paddingTop: scaleForDpi("6.4rem"),
            paddingBottom: scaleForDpi("2.8rem"),
          },
          "@container (min-width: 900px)": {
            paddingTop: scaleForDpi("8.2rem"),
            paddingBottom: scaleForDpi("3.7rem"),
          },
        }}
      >
        <Container maxW="7xl" position="relative" zIndex={1}>
          <VStack
            gap={{ base: "47px", lg: "61px" }}
            align="center"
          >
            <VStack
              gap="19px"
              align="center"
              textAlign="center"
              maxW="4xl"
            >
              <Box>
                {/* 騎士とタイトルのメインビジュアル */}
                <HStack
                  justify="center"
                  align="flex-end"
                  gap={{ base: "11px", md: "17px" }}
                  mb="13px"
                  flexWrap={{ base: "wrap", md: "nowrap" }}
                >
                  <Box transform="translateY(1.5px) translateX(-2px)">
                    <KnightCharacter />
                  </Box>
                  <Heading
                    ref={titleRef}
                    fontSize={{
                      base: scaleForDpi("2.3rem"),
                      md: scaleForDpi("3.7rem"),
                      lg: scaleForDpi("4.6rem"),
                    }}
                    fontWeight={900}
                    lineHeight="0.87"
                    letterSpacing="0.051em"
                    color="fgEmphasized"
                    textShadow="0 3px 8px rgba(0,0,0,0.62), 0 1px 2px rgba(0,0,0,0.8)"
                    fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
                    css={{
                      WebkitTextStroke: "0.4px rgba(255,255,255,0.15)",
                      textTransform: "none",
                      filter: "drop-shadow(0 4px 9px rgba(0,0,0,0.52))",
                      "@container (max-width: 600px)": {
                        fontSize: scaleForDpi("2.1rem"),
                      },
                      "@container (min-width: 600px) and (max-width: 900px)": {
                        fontSize: scaleForDpi("3.3rem"),
                      },
                      "@container (min-width: 900px)": {
                        fontSize: scaleForDpi("4.3rem"),
                      },
                    }}
                  >
                    序の紋章III
                  </Heading>
                </HStack>
                <Box mt="4px" mb="11px">
                  <Box h="1px" bg="rgba(255,215,0,0.22)" boxShadow="0 0 3px rgba(255,215,0,0.15)" />
                  <Box h="1px" bg="rgba(0,0,0,0.65)" transform="translateY(-1px)" />
                </Box>
                <Text
                  fontSize={{
                    base: scaleForDpi("1.17rem"),
                    md: scaleForDpi("1.43rem"),
                    lg: scaleForDpi("1.71rem"),
                  }}
                  color="rgba(255,255,255,0.87)"
                  fontWeight={500}
                  lineHeight="1.42"
                  letterSpacing="0.021em"
                  maxW="3xl"
                  mx="auto"
                  textShadow="0 2px 5px rgba(0,0,0,0.58)"
                  css={{
                    "@container (max-width: 600px)": {
                      fontSize: scaleForDpi("1.09rem"),
                      lineHeight: "1.52",
                    },
                    "@container (min-width: 600px) and (max-width: 900px)": {
                      fontSize: scaleForDpi("1.31rem"),
                      lineHeight: "1.47",
                    },
                    "@container (min-width: 900px)": {
                      fontSize: scaleForDpi("1.63rem"),
                      lineHeight: "1.43",
                    },
                  }}
                >
                  数字カードゲーム
                  <Box
                    as="span"
                    display={{ base: "block", md: "inline" }}
                    color="rgba(255,255,255,0.93)"
                    fontWeight={600}
                    ml={{ md: scaleForDpi("0.4rem") }}
                    letterSpacing="0.015em"
                  >
                    協力して正しい順に並べよう
                  </Box>
                </Text>
              </Box>

              {/* ドラクエ風コマンドメニュー */}
              <VStack
                gap="17px"
                align="center"
                w="100%"
                mt="38px"
              >
                {/* メインCTA: 新しい部屋を作成 */}
                <AppButton
                  size="lg"
                  visual="solid"
                  palette="brand"
                  onClick={openCreateFlow}
                  css={{
                    position: "relative",
                    minWidth: "260px",
                    maxWidth: "280px",
                    width: "auto",
                    px: scaleForDpi("32px"),
                    py: scaleForDpi("16px"),
                    fontSize: scaleForDpi("1.15rem"),
                    fontWeight: "700",
                    fontFamily: "monospace",
                    letterSpacing: "0.5px",
                    borderRadius: "0",
                    border: "3px solid rgba(255,255,255,0.9)",
                    background: "linear-gradient(to bottom, rgba(255,128,45,0.95), rgba(235,110,30,0.92))",
                    boxShadow: "0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,0.62), 4px 5px 0 rgba(0,0,0,0.48), 2px 3px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.25)",
                    textShadow: "2px 2px 0px rgba(0,0,0,0.85)",
                    transitionProperty: "transform, box-shadow, background, border-color",
                    transitionDuration: "183ms",
                    transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                    willChange: "transform",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      background: "linear-gradient(to bottom, rgba(255,145,65,0.98), rgba(255,128,45,0.95))",
                      borderColor: "rgba(255,255,255,0.95)",
                      boxShadow: "0 0 0 2px rgba(235,110,35,0.85), 6px 8px 0 rgba(0,0,0,0.68), 5px 7px 0 rgba(0,0,0,0.54), 3px 5px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
                    },
                    "&:active": {
                      transform: "translateY(1px)",
                      boxShadow: "0 0 0 2px rgba(200,85,20,0.82), 2px 3px 0 rgba(0,0,0,0.62), 1px 2px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.15)",
                    },
                  }}
                >
                  <Plus size={20} style={{ marginRight: "10px" }} />
                  新しい部屋を作成
                </AppButton>

                {/* サブメニュー: 横並び（ドラクエ風） */}
                <HStack
                  gap="15px"
                  justify="center"
                  flexWrap="wrap"
                >
                  <AppButton
                    size="md"
                    visual="outline"
                    palette="gray"
                    css={{
                      minWidth: "130px",
                      px: scaleForDpi("20px"),
                      py: scaleForDpi("11px"),
                      fontSize: scaleForDpi("0.95rem"),
                      fontWeight: "600",
                      fontFamily: "monospace",
                      letterSpacing: "0.5px",
                      borderRadius: "0",
                      border: "2px solid rgba(255,255,255,0.7)",
                      background: "rgba(28,32,42,0.85)",
                      boxShadow: "2px 3px 0 rgba(0,0,0,0.68), 1px 2px 0 rgba(0,0,0,0.52), inset 1px 1px 0 rgba(255,255,255,0.1)",
                      textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                      transitionProperty: "transform, box-shadow, background, border-color",
                      transitionDuration: "173ms",
                      transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                      willChange: "transform",
                      "&:hover": {
                        background: "rgba(38,42,52,0.95)",
                        borderColor: "rgba(255,255,255,0.85)",
                        transform: "translateY(-1px)",
                        boxShadow: "3px 4px 0 rgba(0,0,0,0.72), 2px 3px 0 rgba(0,0,0,0.58), inset 1px 1px 0 rgba(255,255,255,0.15)",
                      },
                      "&:active": {
                        transform: "translateY(1px)",
                        boxShadow: "1px 2px 0 rgba(0,0,0,0.72), inset 1px 1px 0 rgba(255,255,255,0.08)",
                      },
                    }}
                    onClick={async () => {
                      try {
                        await transition.navigateWithTransition("/rules", {
                          direction: "fade",
                          duration: 0.8,
                          showLoading: true,
                          loadingSteps: [
                            {
                              id: "loading",
                              message: "よみこみ中...",
                              duration: 620,
                            },
                            {
                              id: "ready",
                              message: "かんりょう！",
                              duration: 280,
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
                    <BookOpen size={16} style={{ marginRight: "6px" }} />
                    ルール
                  </AppButton>
                  <AppButton
                    size="md"
                    visual="outline"
                    palette="gray"
                    onClick={openNameChange}
                    css={{
                      minWidth: "130px",
                      px: scaleForDpi("20px"),
                      py: scaleForDpi("11px"),
                      fontSize: scaleForDpi("0.95rem"),
                      fontWeight: "600",
                      fontFamily: "monospace",
                      letterSpacing: "0.5px",
                      borderRadius: "0",
                      border: displayName ? "2px solid rgba(255,255,255,0.7)" : "2px solid rgba(255,215,0,0.8)",
                      background: displayName ? "rgba(28,32,42,0.85)" : "rgba(255,215,0,0.15)",
                      boxShadow: displayName ? "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.1)" : "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.15), 0 0 8px rgba(255,215,0,0.3)",
                      textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                      color: displayName ? "rgba(255,255,255,0.92)" : "rgba(255,235,205,0.98)",
                      transitionProperty: "transform, box-shadow, background, border-color",
                      transitionDuration: "170ms",
                      transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                      willChange: "transform",
                      "&:hover": {
                        background: displayName ? "rgba(38,42,52,0.95)" : "rgba(255,215,0,0.22)",
                        borderColor: displayName ? "rgba(255,255,255,0.85)" : "rgba(255,215,0,0.95)",
                        transform: "translateY(-1px)",
                        boxShadow: displayName ? "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.15)" : "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.2), 0 0 12px rgba(255,215,0,0.4)",
                      },
                      "&:active": {
                        transform: "translateY(1px)",
                        boxShadow: "1px 1px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.08)",
                      },
                    }}
                  >
                    <User size={16} style={{ marginRight: "6px" }} />
                    プレイヤー設定
                  </AppButton>
                </HStack>
              </VStack>
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* ルーム一覧（ロビーエリア） */}
      <Container
        maxW="7xl"
        py={{ base: scaleForDpi("2.7rem"), md: scaleForDpi("3.9rem") }}
        css={{
          "@container (max-width: 600px)": {
            paddingTop: scaleForDpi("2.3rem"),
            paddingBottom: scaleForDpi("3.1rem"),
          },
          "@container (min-width: 600px) and (max-width: 900px)": {
            paddingTop: scaleForDpi("3.3rem"),
            paddingBottom: scaleForDpi("4.1rem"),
          },
          "@container (min-width: 900px)": {
            paddingTop: scaleForDpi("3.7rem"),
            paddingBottom: scaleForDpi("4.8rem"),
          },
        }}
      >
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 340px" }}
          gap={scaleForDpi("1.9rem")}
          alignItems="start"
          css={{
            "@container (max-width: 600px)": {
              gap: scaleForDpi("1.3rem"),
            },
            "@container (min-width: 600px)": {
              gap: scaleForDpi("1.7rem"),
            },
          }}
        >
          <GridItem>
            <Box
              mb={scaleForDpi("1.7rem")}
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
          <GridItem display={{ base: "none", md: "block" }}>
            <VStack gap={6} align="stretch">
              <Box
                bg="rgba(20,16,12,0.85)"
                border="4px solid"
                borderColor="rgba(139,92,46,0.9)"
                borderRadius={0}
                p={5}
                boxShadow="3px 3px 0 rgba(0,0,0,0.9), 5px 5px 0 rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,235,205,0.15)"
                position="relative"
                css={{
                  background: "linear-gradient(135deg, rgba(28,22,16,0.92) 0%, rgba(18,14,10,0.88) 100%)",
                  borderImage: "linear-gradient(to bottom, rgba(180,130,70,0.95), rgba(120,80,40,0.85)) 1",
                }}
              >
                <VStack gap={4} align="stretch">
                  <HStack gap={4} align="center" pb={2} borderBottom="2px solid rgba(139,92,46,0.5)">
                    <Box
                      w={12}
                      h={12}
                      borderRadius={0}
                      bg="rgba(139,92,46,0.3)"
                      border="3px solid rgba(214,177,117,0.7)"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      boxShadow="2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,235,205,0.3)"
                    >
                      <Image
                        src="/images/hanepen1.webp"
                        alt="羽ペン"
                        w="24px"
                        h="24px"
                        filter="brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                      />
                    </Box>
                    <Text
                      fontWeight={700}
                      fontSize="xl"
                      color="rgba(255,235,205,0.98)"
                      fontFamily="monospace"
                      textShadow="2px 2px 0px rgba(0,0,0,0.9), 0 0 8px rgba(255,235,205,0.3)"
                      letterSpacing="1px"
                    >
                      開発者より
                    </Text>
                  </HStack>

                  <VStack gap={4} align="stretch">
                    <Box
                      p={4}
                      bg="rgba(245,235,215,0.12)"
                      border="2px solid rgba(214,177,117,0.4)"
                      borderRadius={0}
                      boxShadow="inset 0 1px 0 rgba(255,245,220,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
                      css={{
                        background: "linear-gradient(to bottom, rgba(245,235,215,0.15), rgba(235,225,205,0.08))",
                      }}
                    >
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Text fontSize="md" fontWeight={700} color="rgba(255,215,0,0.95)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            🎮
                          </Text>
                          <Text fontSize="md" fontWeight={700} color="rgba(255,235,205,0.95)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            このゲームについて
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="rgba(255,255,255,0.92)" fontFamily="monospace" lineHeight="1.7" textShadow="1px 1px 0px rgba(0,0,0,0.8)">
                          "連想ワードだけで数字の大小をそろえる"という発想を、オンライン協力向けに再構成しています。共同編集・カード演出・リアルタイム同期の臨場感を目指して日々改善中です。
                        </Text>
                      </VStack>
                    </Box>

                    <Box
                      p={4}
                      bg="rgba(34,197,94,0.1)"
                      border="2px solid rgba(34,197,94,0.5)"
                      borderLeft="4px solid rgba(34,197,94,0.8)"
                      borderRadius={0}
                      boxShadow="inset 0 1px 0 rgba(34,197,94,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
                    >
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Text fontSize="md" fontWeight={700} color="rgba(34,197,94,0.95)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            ⚠️
                          </Text>
                          <Text fontSize="md" fontWeight={700} color="rgba(100,255,150,0.98)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            注意事項
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="rgba(255,255,255,0.92)" fontFamily="monospace" lineHeight="1.7" textShadow="1px 1px 0px rgba(0,0,0,0.8)">
                          ブラウザだけで遊べる完全オリジナル作品です。同期実験中のため、不具合を見つけたら気軽に知らせてください。
                        </Text>
                      </VStack>
                    </Box>

                    <Box
                      p={4}
                      bg="rgba(147,51,234,0.1)"
                      border="2px solid rgba(147,51,234,0.5)"
                      borderLeft="4px solid rgba(147,51,234,0.8)"
                      borderRadius={0}
                      boxShadow="inset 0 1px 0 rgba(147,51,234,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
                    >
                      <VStack gap={2} align="start">
                        <HStack gap={2} align="center">
                          <Text fontSize="md" fontWeight={700} color="rgba(147,51,234,0.95)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            💎
                          </Text>
                          <Text fontSize="md" fontWeight={700} color="rgba(180,120,255,0.98)" fontFamily="monospace" textShadow="1px 1px 0px #000">
                            今後の予定
                          </Text>
                        </HStack>
                        <VStack gap={1.5} align="start" pl={2}>
                          <Text fontSize="xs" color="rgba(255,255,255,0.92)" fontFamily="monospace" lineHeight="1.7" textShadow="1px 1px 0px rgba(0,0,0,0.8)">
                            ・ちゃんと寝る
                          </Text>
                          <Text fontSize="xs" color="rgba(255,255,255,0.92)" fontFamily="monospace" lineHeight="1.7" textShadow="1px 1px 0px rgba(0,0,0,0.8)">
                            ・コーヒーを控える（最重要）
                          </Text>
                        </VStack>
                      </VStack>
                    </Box>
                  </VStack>
                </VStack>
              </Box>
              <SupporterCTA />

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

                <Box
                  mt={3}
                  pl={1}
                  display="flex"
                  flexDirection="column"
                  gap={2}
                >
                  <Text
                    fontSize="xs"
                    color="rgba(255,255,255,0.7)"
                    fontFamily="monospace"
                  >
                    ▼ バージョンアップ通知（プレビュー）
                  </Text>
                  <UpdateAvailableBadge preview />
                </Box>
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
