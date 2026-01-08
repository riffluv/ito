"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomPasswordPrompt } from "@/components/RoomPasswordPrompt";
import { AppButton } from "@/components/ui/AppButton";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { RichBlackBackground } from "@/components/ui/RichBlackBackground";
import { useTransition } from "@/components/ui/TransitionProvider";
import { notify } from "@/components/ui/notify";
import { LobbyRoomListPanel } from "@/components/main-menu/LobbyRoomListPanel";
import { MainMenuSidebar } from "@/components/main-menu/MainMenuSidebar";
import { KnightCharacter } from "@/components/main-menu/KnightCharacter";
import { buildPixiWorkerUrl } from "@/components/main-menu/buildPixiWorkerUrl";
import type { LobbyRoom } from "@/components/main-menu/types";
import {
  filterLobbyRooms,
  filterLobbyRoomsByOptions,
  filterLobbyRoomsBySearch,
  sortLobbyRooms,
} from "@/components/main-menu/roomListDerivations";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { stripMinimalTag } from "@/lib/game/displayMode";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import {
  ROOMS_PER_PAGE,
  useOptimizedRooms,
} from "@/lib/hooks/useOptimizedRooms";
import { verifyPassword } from "@/lib/security/password";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import {
  Box,
  Container,
  Grid,
  Heading,
  HStack,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { BookOpen, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    return scheduleIdleTask(() => {
      try {
        router.prefetch("/rules");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          logDebug("main-menu", "prefetch-rules-skipped", error);
        }
      }
    }, { timeoutMs: 2000, delayMs: 0 });
  }, [router]);

  // Pixi背景用の軽量プリウォーム（描画はしない）
  useEffect(() => {
    const workerUrl = buildPixiWorkerUrl();
    return scheduleIdleTask(() => {
      // 1) Pixi本体を事前読み込み
      import("@/lib/pixi/loadPixi")
        .then((mod) => mod.loadPixi().catch(() => void 0))
        .catch(() => void 0);
      // 2) 背景ワーカーJSをブラウザキャッシュへ
      if (workerUrl) {
        try {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.as = "worker";
          link.href = workerUrl;
          document.head.appendChild(link);
        } catch {
          // ignore
        }
      }
    }, { timeoutMs: 2000, delayMs: 300 });
  }, []);

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
    let mounted = true;

    const target = titleRef.current;
    if (target) {
      const run = async () => {
        try {
          const mod = await import("gsap");
          if (!mounted) return;
          mod.gsap.fromTo(
            target,
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
        } catch {
          // ignore animation failure in production; keeps main menu usable
        }
      };

      void run();
    }

    return () => {
      mounted = false;
    };
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
    const nowMs = Date.now();
    const recentWindowMs =
      Number(process.env.NEXT_PUBLIC_LOBBY_RECENT_MS) || 5 * 60 * 1000;
    return filterLobbyRooms({
      rooms,
      lobbyCounts,
      nowMs,
      recentWindowMs,
      inProgressDisplayMs: 15 * 60 * 1000,
      createdWindowMs: 10 * 60 * 1000,
    });
  }, [rooms, lobbyCounts]);

  const optionFilteredRooms = useMemo(() => {
    return filterLobbyRoomsByOptions({
      rooms: filteredRooms,
      hideLockedRooms,
      showJoinableOnly,
    });
  }, [filteredRooms, hideLockedRooms, showJoinableOnly]);

  const searchFilteredRooms = useMemo(() => {
    return filterLobbyRoomsBySearch({
      rooms: optionFilteredRooms,
      debouncedSearch,
    });
  }, [optionFilteredRooms, debouncedSearch]);

  // ソート順: 人数多い → 新規作成 → 最終アクティブ
  const sortedRooms = useMemo(() => {
    return sortLobbyRooms({ rooms: searchFilteredRooms, lobbyCounts });
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

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPageIndex(0);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchInput("");
    setPageIndex(0);
  }, []);

  const handleToggleHideLockedRooms = useCallback(() => {
    setHideLockedRooms((prev) => !prev);
    setPageIndex(0);
  }, []);

  const handleToggleShowJoinableOnly = useCallback(() => {
    setShowJoinableOnly((prev) => !prev);
    setPageIndex(0);
  }, []);

  const handleRefreshLobby = useCallback(() => {
    refreshRooms();
    refreshLobbyCounts();
  }, [refreshRooms, refreshLobbyCounts]);

  const handlePrevPage = useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextPage = useCallback(() => {
    setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  const handleRunLoadingTest = useCallback(async () => {
    await transition.navigateWithTransition(window.location.pathname, {
      direction: "fade",
      duration: 0.8,
      showLoading: true,
      loadingSteps: [
        {
          id: "firebase",
          message: "🔥 Firebase接続中...",
          duration: 890,
        },
        {
          id: "room",
          message: "⚔️ ルーム情報取得中...",
          duration: 1130,
        },
        {
          id: "player",
          message: "👥 プレイヤー登録中...",
          duration: 680,
        },
        {
          id: "ready",
          message: "🎮 ゲーム準備完了！",
          duration: 310,
        },
      ],
    });
  }, [transition]);

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
              scheduleIdleTask(() => {
                try {
                  router.prefetch(`/rooms/${room.id}`);
                } catch (idleError) {
                  logDebug("main-menu", "prefetch-room-skipped", idleError);
                }
              }, { timeoutMs: 2000 });
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
          background:
            "radial-gradient(ellipse 76% 58% at center 32%, transparent 0%, rgba(8,12,18,0.12) 42%, rgba(6,9,15,0.35) 78%, rgba(4,6,11,0.48) 100%)",
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
        <Container maxW="var(--ui-menu-max-w)" px="var(--ui-main-pad)" position="relative" zIndex={1}>
          <VStack gap={{ base: "47px", lg: "61px" }} align="center">
            <VStack gap="19px" align="center" textAlign="center" maxW="4xl">
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
                  <Box
                    h="1px"
                    bg="rgba(255,215,0,0.22)"
                    boxShadow="0 0 3px rgba(255,215,0,0.15)"
                  />
                  <Box
                    h="1px"
                    bg="rgba(0,0,0,0.65)"
                    transform="translateY(-1px)"
                  />
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
              <VStack gap="17px" align="center" w="100%" mt="38px">
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
                    background:
                      "linear-gradient(to bottom, rgba(255,128,45,0.95), rgba(235,110,30,0.92))",
                    boxShadow:
                      "0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,0.62), 4px 5px 0 rgba(0,0,0,0.48), 2px 3px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.25)",
                    textShadow: "2px 2px 0px rgba(0,0,0,0.85)",
                    transitionProperty:
                      "transform, box-shadow, background, border-color",
                    transitionDuration: "183ms",
                    transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                    willChange: "transform",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      background:
                        "linear-gradient(to bottom, rgba(255,145,65,0.98), rgba(255,128,45,0.95))",
                      borderColor: "rgba(255,255,255,0.95)",
                      boxShadow:
                        "0 0 0 2px rgba(235,110,35,0.85), 6px 8px 0 rgba(0,0,0,0.68), 5px 7px 0 rgba(0,0,0,0.54), 3px 5px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
                    },
                    "&:active": {
                      transform: "translateY(1px)",
                      boxShadow:
                        "0 0 0 2px rgba(200,85,20,0.82), 2px 3px 0 rgba(0,0,0,0.62), 1px 2px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.15)",
                    },
                  }}
                >
                  <Plus size={20} style={{ marginRight: "10px" }} />
                  新しい部屋を作成
                </AppButton>

                {/* サブメニュー: 横並び（ドラクエ風） */}
                <HStack gap="15px" justify="center" flexWrap="wrap">
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
                      boxShadow:
                        "2px 3px 0 rgba(0,0,0,0.68), 1px 2px 0 rgba(0,0,0,0.52), inset 1px 1px 0 rgba(255,255,255,0.1)",
                      textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                      transitionProperty:
                        "transform, box-shadow, background, border-color",
                      transitionDuration: "173ms",
                      transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                      willChange: "transform",
                      "&:hover": {
                        background: "rgba(38,42,52,0.95)",
                        borderColor: "rgba(255,255,255,0.85)",
                        transform: "translateY(-1px)",
                        boxShadow:
                          "3px 4px 0 rgba(0,0,0,0.72), 2px 3px 0 rgba(0,0,0,0.58), inset 1px 1px 0 rgba(255,255,255,0.15)",
                      },
                      "&:active": {
                        transform: "translateY(1px)",
                        boxShadow:
                          "1px 2px 0 rgba(0,0,0,0.72), inset 1px 1px 0 rgba(255,255,255,0.08)",
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
                      border: displayName
                        ? "2px solid rgba(255,255,255,0.7)"
                        : "2px solid rgba(255,215,0,0.8)",
                      background: displayName
                        ? "rgba(28,32,42,0.85)"
                        : "rgba(255,215,0,0.15)",
                      boxShadow: displayName
                        ? "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.1)"
                        : "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.15), 0 0 8px rgba(255,215,0,0.3)",
                      textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                      color: displayName
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,235,205,0.98)",
                      transitionProperty:
                        "transform, box-shadow, background, border-color",
                      transitionDuration: "170ms",
                      transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                      willChange: "transform",
                      "&:hover": {
                        background: displayName
                          ? "rgba(38,42,52,0.95)"
                          : "rgba(255,215,0,0.22)",
                        borderColor: displayName
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,215,0,0.95)",
                        transform: "translateY(-1px)",
                        boxShadow: displayName
                          ? "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.15)"
                          : "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.2), 0 0 12px rgba(255,215,0,0.4)",
                      },
                      "&:active": {
                        transform: "translateY(1px)",
                        boxShadow:
                          "1px 1px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.08)",
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
        maxW="var(--ui-menu-max-w)"
        px="var(--ui-main-pad)"
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
            <LobbyRoomListPanel
              firebaseEnabled={firebaseEnabled}
              roomsLoading={roomsLoading}
              showSkeletons={showSkeletons}
              roomCount={searchFilteredRooms.length}
              searchInput={searchInput}
              hideLockedRooms={hideLockedRooms}
              showJoinableOnly={showJoinableOnly}
              paginatedRooms={paginatedRooms}
              lobbyCounts={lobbyCounts}
              pageIndex={pageIndex}
              totalPages={totalPages}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              activeSearch={activeSearch}
              displaySearchKeyword={displaySearchKeyword}
              onRefresh={handleRefreshLobby}
              onSearchChange={handleSearchChange}
              onSearchClear={handleSearchClear}
              onToggleHideLockedRooms={handleToggleHideLockedRooms}
              onToggleShowJoinableOnly={handleToggleShowJoinableOnly}
              onJoinRoom={handleJoinRoom}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onCreateRoom={openCreateFlow}
            />
            <MainMenuSidebar onRunLoadingTest={handleRunLoadingTest} />
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
