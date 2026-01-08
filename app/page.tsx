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
import { useLobbyRoomListState } from "@/components/main-menu/useLobbyRoomListState";
import { useMainMenuRoomFlow } from "@/components/main-menu/useMainMenuRoomFlow";
import { useMainMenuWarmup } from "@/components/main-menu/useMainMenuWarmup";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { stripMinimalTag } from "@/lib/game/displayMode";
import { logInfo } from "@/lib/utils/log";
import { Box, Container, Grid } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MainMenu() {
  const router = useRouter();
  const { user, displayName, setDisplayName } = useAuth();
  const transition = useTransition();
  useMainMenuWarmup({ router });

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

  const {
    nameDialog,
    createDialog,
    tempName,
    nameDialogMode,
    passwordPrompt,
    passwordSubmitting,
    passwordError,
    handleJoinRoom,
    handlePasswordSubmit,
    handlePasswordCancel,
    openCreateFlow,
    openNameChange,
    handleNameDialogCancel,
    handleNameDialogSubmit,
  } = useMainMenuRoomFlow({
    displayName,
    setDisplayName,
    transition,
    router,
    roomMap,
  });

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
            <MainMenuSidebar />
          </Grid>
        </Container>

        <NameDialog
          isOpen={nameDialog.open}
          defaultValue={tempName}
          mode={nameDialogMode}
          onCancel={handleNameDialogCancel}
          onSubmit={handleNameDialogSubmit}
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
