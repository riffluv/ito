"use client";

import RoomNotifyBridge from "@/components/RoomNotifyBridge";
import NameDialog from "@/components/NameDialog";
import GameLayout from "@/components/ui/GameLayout";
import { AppButton } from "@/components/ui/AppButton";
import { SimplePhaseDisplay } from "@/components/ui/SimplePhaseDisplay";
import MinimalChat from "@/components/ui/MinimalChat";
import { RoomPasswordPrompt } from "@/components/RoomPasswordPrompt";
import { DebugMetricsHUD } from "@/components/ui/DebugMetricsHUD";
import { PixiGuideButtonsAuto } from "@/components/ui/pixi/PixiGuideButtons";
import { UI_TOKENS } from "@/theme/layout";
import { Dialog, Box, Text, VStack, HStack } from "@chakra-ui/react";
import { lazy, Suspense } from "react";

import type { RoomViewProps } from "./types";

const SettingsModal = lazy(() => import("@/components/SettingsModal"));
const MvpLedger = lazy(() =>
  import("@/components/ui/MvpLedger").then((mod) => ({ default: mod.MvpLedger }))
);

export function RoomView({
  roomId,
  room,
  nodes,
  overlays,
  dealRecoveryOpen,
  onDealRecoveryDismiss,
  needName,
  onSubmitName,
  simplePhase,
  chat,
  passwordDialog,
  settings,
  ledger,
  me,
  isSpectatorMode,
  meHasPlacedCard,
  showNotifyBridge = true,
}: RoomViewProps) {
  return (
    <>
      {overlays.joinStatusBanner}
      {overlays.safeUpdateBannerNode}
      {overlays.versionMismatchOverlay}
      {showNotifyBridge ? <RoomNotifyBridge roomId={roomId} /> : null}
      <GameLayout
        variant="immersive"
        header={nodes.header}
        sidebar={nodes.sidebar}
        main={nodes.main}
        handArea={nodes.handArea}
      />

      <Dialog.Root
        open={dealRecoveryOpen}
        onOpenChange={(open) => {
          if (!open) {
            onDealRecoveryDismiss();
          }
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={9999}
        >
          <Dialog.Content
            css={{
              background: UI_TOKENS.COLORS.panelBg,
              border: "3px solid " + UI_TOKENS.COLORS.whiteAlpha90,
              borderRadius: 0,
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
              maxWidth: "480px",
              width: "90vw",
            }}
          >
            <Box
              p={5}
              css={{
                borderBottom: "2px solid " + UI_TOKENS.COLORS.whiteAlpha30,
              }}
            >
              <Dialog.Title>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color="white"
                  fontFamily="monospace"
                >
                  あれれ？カードが配れていないよ！
                </Text>
              </Dialog.Title>
            </Box>
            <Dialog.Body p={6}>
              <VStack align="stretch" gap={4}>
                <Text
                  color={UI_TOKENS.COLORS.whiteAlpha90}
                  fontSize="md"
                  fontFamily="monospace"
                  lineHeight={1.7}
                >
                  前のホストが急にいなくなっちゃったから、数字の配布が途中で止まってしまったんだ。
                  右下の「リセット」を押して最初に戻してから、もう一度「ゲーム開始」してね！
                </Text>
                <Text color={UI_TOKENS.COLORS.whiteAlpha80}>
                  リセットすれば、ちゃんとカードが配り直されるから安心してね！
                </Text>
                <HStack justify="flex-end" pt={2}>
                  <AppButton palette="brand" size="md" onClick={onDealRecoveryDismiss}>
                    わかった！
                  </AppButton>
                </HStack>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <NameDialog
        isOpen={needName}
        defaultValue=""
        onCancel={() => {
          /* keep open until set */
        }}
        onSubmit={onSubmitName}
        submitting={false}
        mode="create"
      />

      <SimplePhaseDisplay
        roomStatus={simplePhase.status}
        canStartSorting={simplePhase.canStartSorting}
        topicText={simplePhase.topic}
      />

      <MinimalChat
        roomId={roomId}
        players={chat.players}
        hostId={chat.hostId}
        onOpenLedger={chat.onOpenLedger}
        isGameFinished={chat.isFinished}
      />

      <RoomPasswordPrompt
        isOpen={passwordDialog.isOpen}
        roomName={passwordDialog.roomName}
        isLoading={passwordDialog.isLoading}
        error={passwordDialog.error}
        onSubmit={passwordDialog.onSubmit}
        onCancel={passwordDialog.onCancel}
      />

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={settings.isOpen}
          onClose={settings.onClose}
          roomId={roomId}
          currentOptions={settings.options}
          isHost={settings.isHost}
          roomStatus={settings.roomStatus}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MvpLedger
          isOpen={ledger.isOpen}
          onClose={ledger.onClose}
          players={ledger.players}
          orderList={ledger.orderList}
          topic={ledger.topic}
          failed={ledger.failed}
          roomId={ledger.roomId}
          myId={ledger.myId}
          mvpVotes={ledger.mvpVotes}
          stats={ledger.stats}
        />
      </Suspense>

      <DebugMetricsHUD />

      <PixiGuideButtonsAuto
        currentPhase={room.status}
        me={me}
        disabled={isSpectatorMode}
        hasPlacedCard={meHasPlacedCard}
      />
    </>
  );
}
