"use client";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import NameDialog from "@/components/NameDialog";
import { RoomPasswordPrompt } from "@/components/RoomPasswordPrompt";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { RichBlackBackground } from "@/components/ui/RichBlackBackground";
import { useTransition } from "@/components/ui/TransitionProvider";
import { notify } from "@/components/ui/notify";
import { MainMenuHero } from "@/components/main-menu/MainMenuHero";
import { LobbyRoomListPanel } from "@/components/main-menu/LobbyRoomListPanel";
import { MainMenuSidebar } from "@/components/main-menu/MainMenuSidebar";
import { buildPixiWorkerUrl } from "@/components/main-menu/buildPixiWorkerUrl";
import { useLobbyRoomListState } from "@/components/main-menu/useLobbyRoomListState";
import type { LobbyRoom } from "@/components/main-menu/types";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { stripMinimalTag } from "@/lib/game/displayMode";
import { verifyPassword } from "@/lib/security/password";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { logDebug, logError, logInfo } from "@/lib/utils/log";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import { Box, Container, Grid, useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function MainMenu() {
  const router = useRouter();
  const { user, displayName, setDisplayName } = useAuth();
  const transition = useTransition();
  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "edit">(
    "create"
  );
  const pendingJoinRef = useRef<LobbyRoom | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    room: LobbyRoom;
  } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

  const {
    roomsLoading,
    roomsError,
    showSkeletons,
    roomCount,
    searchInput,
    hideLockedRooms,
    showJoinableOnly,
    paginatedRooms,
    lobbyCounts,
    roomMap,
    pageIndex,
    totalPages,
    hasPrevPage,
    hasNextPage,
    activeSearch,
    displaySearchKeyword,
    onSearchChange: handleSearchChange,
    onSearchClear: handleSearchClear,
    onToggleHideLockedRooms: handleToggleHideLockedRooms,
    onToggleShowJoinableOnly: handleToggleShowJoinableOnly,
    onRefresh: handleRefreshLobby,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
  } = useLobbyRoomListState({
    enabled: !!(firebaseEnabled && user),
    excludeUid: user?.uid,
  });

  useEffect(() => {
    if (!roomsError) return;
    notify({
      title: "ルーム取得に失敗しました",
      description: roomsError.message,
      type: "error",
    });
  }, [roomsError]);

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
      <MainMenuHero
        displayName={displayName}
        onCreateRoom={openCreateFlow}
        onOpenPlayerSettings={openNameChange}
      />

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
              roomCount={roomCount}
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
