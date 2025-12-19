import { AppButton } from "@/components/ui/AppButton";
import type { SeatRequestViewState } from "@/lib/spectator/v2/useSpectatorController";
import type { SpectatorReason } from "@/lib/state/roomMachine";
import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { type ReactNode } from "react";

type SpectatorNoticeProps = {
  reason: SpectatorReason | null;
  seatRequestState: SeatRequestViewState;
  seatRequestPending: boolean;
  seatRequestTimedOut: boolean;
  seatRequestButtonDisabled: boolean;
  spectatorUpdateButton?: ReactNode;
  onRetryJoin: () => void;
  onForceExit: () => void;
};

const StatusMessage: React.FC<{
  seatRequestState: SeatRequestViewState;
  seatRequestTimedOut: boolean;
}> = ({ seatRequestState, seatRequestTimedOut }) => {
  switch (seatRequestState.status) {
    case "pending":
      return (
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color={UI_TOKENS.COLORS.whiteAlpha80}
          lineHeight={1.6}
        >
          席に戻る申請を送信しました。ホストの承認を待っています…
        </Text>
      );
    case "accepted":
      return (
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color={UI_TOKENS.COLORS.whiteAlpha90}
          fontWeight={600}
          lineHeight={1.6}
        >
          席の準備ができました。まもなく自動で戻ります！
        </Text>
      );
    case "rejected":
      return (
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color={UI_TOKENS.COLORS.orangeRed}
          lineHeight={1.6}
        >
          席に戻る申請が見送られました。もう少し待ってから再度お試しください。
        </Text>
      );
    default:
      if (seatRequestTimedOut) {
        return (
          <Text
            fontSize={{ base: "sm", md: "md" }}
            color={UI_TOKENS.COLORS.whiteAlpha60}
            lineHeight={1.6}
          >
            応答がありませんでした。電波状況を確認してから、ロビーへ戻って入り直してください。
          </Text>
        );
      }
      return null;
  }
};

export function SpectatorNotice({
  reason,
  seatRequestState,
  seatRequestTimedOut,
  spectatorUpdateButton,
  onForceExit,
}: SpectatorNoticeProps) {
  if (!reason) {
    return null;
  }

  if (reason === "version-mismatch") {
    return (
      <VStack
        gap={3}
        align="center"
        justify="center"
        py={{ base: 3, md: 4 }}
        px={{ base: 3, md: 4 }}
      >
        <Text
          fontSize={{ base: "md", md: "lg" }}
          fontWeight={700}
          color="rgba(255,255,255,0.95)"
          textShadow="0 2px 4px rgba(0,0,0,0.55)"
          textAlign="center"
        >
          新しいバージョンがあります。アップデートしてください！
        </Text>
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color={UI_TOKENS.COLORS.whiteAlpha80}
          textAlign="center"
        >
          下の「今すぐ更新」ボタンから更新を適用してください。
        </Text>
        <HStack gap={3} flexWrap="wrap" justify="center">
          {spectatorUpdateButton}
          <AppButton
            palette={spectatorUpdateButton ? "gray" : "brand"}
            size="md"
            onClick={() => {
              try {
                window.location.reload();
              } catch {
                // ignore
              }
            }}
          >
            今すぐ更新
          </AppButton>
          <AppButton palette="gray" size="md" onClick={onForceExit}>
            ロビーへ戻る
          </AppButton>
        </HStack>
      </VStack>
    );
  }

  const titleText =
    reason === "mid-game"
      ? "ゲーム進行中です"
      : reason === "waiting-open"
        ? "ホストが再開準備中だよ"
        : reason === "waiting-closed"
          ? "次のゲーム準備中です"
          : "観戦中";

  const descriptionText =
    reason === "mid-game"
      ? "いまは観戦のみです。ホストが待機状態に戻したら参戦できます！"
      : reason === "waiting-open"
        ? "ホストが待機状態に戻したら参戦できます！少し待ってね。"
        : reason === "waiting-closed"
          ? "参加受付が閉じています。ホストの操作が完了するまで観戦でお待ちください。"
          : "ホストの操作が完了するまで観戦でお待ちください。";

  return (
    <Box
      position="relative"
      border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
      borderRadius={0}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      bg={UI_TOKENS.GRADIENTS.dqPanel}
      color={UI_TOKENS.COLORS.textBase}
      px={{ base: 5, md: 6 }}
      py={{ base: 5, md: 5 }}
      display="flex"
      flexDirection="column"
      gap={3}
      maxW={{ base: "100%", md: "520px" }}
      mx="auto"
      _before={{
        content: '""',
        position: "absolute",
        inset: "8px",
        border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
        pointerEvents: "none",
      }}
    >
      <Box display="flex" flexDir="column" gap={3} alignItems="center">
        <Text
          fontSize={{ base: "sm", md: "md" }}
          fontWeight={800}
          letterSpacing="0.2em"
          textTransform="uppercase"
          fontFamily="monospace"
        >
          ▼ 観戦中 ▼
        </Text>
        <Box textAlign="center">
          <Text
            fontSize={{ base: "md", md: "lg" }}
            fontWeight={700}
            textShadow="2px 2px 0 rgba(0,0,0,0.8)"
          >
            {titleText}
          </Text>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            color={UI_TOKENS.COLORS.whiteAlpha80}
            lineHeight={1.7}
            mt={1}
          >
            {descriptionText}
          </Text>
        </Box>
      </Box>
      <StatusMessage
        seatRequestState={seatRequestState}
        seatRequestTimedOut={seatRequestTimedOut}
      />
      <Box
        display="flex"
        flexDir={{ base: "column", md: "row" }}
        gap={3}
        justifyContent="center"
      >
        {spectatorUpdateButton}
        <AppButton palette="brand" size="md" onClick={onForceExit}>
          ロビーへ戻る
        </AppButton>
      </Box>
    </Box>
  );
}
