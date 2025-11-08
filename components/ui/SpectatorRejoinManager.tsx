"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Box, Dialog, HStack, Spinner, Text, Textarea, VStack } from "@chakra-ui/react";

import { AppButton } from "@/components/ui/AppButton";
import type { SpectatorHostRequest } from "@/lib/spectator/v2/useSpectatorHostQueue";
import type { PlayerDoc } from "@/lib/types";
import { UI_TOKENS } from "@/theme/layout";

type SpectatorRejoinManagerProps = {
  roomId: string;
  requests: SpectatorHostRequest[];
  loading: boolean;
  error: string | null;
  spectatorRecallEnabled: boolean;
  canRecallSpectators: boolean;
  recallPending: boolean;
  onRecallSpectators: () => Promise<void>;
  players: (PlayerDoc & { id: string })[];
  onApprove: (request: SpectatorHostRequest) => Promise<void>;
  onReject: (request: SpectatorHostRequest, reason: string | null) => Promise<void>;
};

const MAX_REASON_LENGTH = 160;

const formatRequestedAt = (timestamp: number | null) => {
  if (!timestamp) return "時刻不明";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "時刻不明";
  }
};

const sourceLabel = (source: SpectatorHostRequest["source"]) =>
  source === "auto" ? "自動申請" : "手動申請";

export function SpectatorRejoinManager({
  roomId,
  requests,
  loading,
  error,
  spectatorRecallEnabled,
  canRecallSpectators,
  recallPending,
  onRecallSpectators,
  players,
  onApprove,
  onReject,
}: SpectatorRejoinManagerProps) {
  const [pendingAction, setPendingAction] = useState<{ sessionId: string; action: "approve" | "reject" } | null>(
    null
  );
  const [rejectDialog, setRejectDialog] = useState<{
    request: SpectatorHostRequest;
    reason: string;
  } | null>(null);

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerDoc & { id: string }>();
    for (const player of players) {
      map.set(player.id, player);
    }
    return map;
  }, [players]);

  const getDisplayName = useCallback(
    (viewerUid: string | null) => {
      if (!viewerUid) {
        return "観戦者";
      }
      const player = playersById.get(viewerUid);
      if (player) {
        return player.name || "観戦者";
      }
      return `観戦者(${viewerUid.slice(0, 6)})`;
    },
    [playersById]
  );

  const handleApprove = useCallback(
    async (request: SpectatorHostRequest) => {
      setPendingAction({ sessionId: request.sessionId, action: "approve" });
      try {
        await onApprove(request);
      } catch {
        // parent handles notification
      } finally {
        setPendingAction(null);
      }
    },
    [onApprove]
  );

  const handleRejectClick = useCallback((request: SpectatorHostRequest) => {
    setRejectDialog({
      request,
      reason: "",
    });
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectDialog) return;
    setPendingAction({ sessionId: rejectDialog.request.sessionId, action: "reject" });
    const trimmed = rejectDialog.reason.trim();
    const resolvedReason = trimmed.length > 0 ? trimmed : null;
    try {
      await onReject(rejectDialog.request, resolvedReason);
      setRejectDialog(null);
    } catch {
      // keep dialog open for retry
    } finally {
      setPendingAction(null);
    }
  }, [onReject, rejectDialog]);

  const isPending = useCallback(
    (sessionId: string, action: "approve" | "reject") => {
      return pendingAction?.sessionId === sessionId && pendingAction?.action === action;
    },
    [pendingAction]
  );

  const handleRejectDialogClose = useCallback(() => {
    if (pendingAction?.action === "reject") return;
    setRejectDialog(null);
  }, [pendingAction]);

  const recallButtonDisabled =
    recallPending || spectatorRecallEnabled || !canRecallSpectators;

  const handleSpectatorRecall = useCallback(() => {
    if (recallPending || spectatorRecallEnabled || !canRecallSpectators) {
      return;
    }
    void onRecallSpectators();
  }, [onRecallSpectators, recallPending, spectatorRecallEnabled, canRecallSpectators]);

  const recallButtonLabel = recallPending
    ? "呼び出し中..."
    : spectatorRecallEnabled
    ? "観戦受付中"
    : "観戦者を呼ぶ";

  return (
    <>
      <Box
        border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
        bg={UI_TOKENS.GRADIENTS.dqPanel}
        color={UI_TOKENS.COLORS.textBase}
        px={{ base: 4, md: 5 }}
        py={{ base: 4, md: 4 }}
        display="flex"
        flexDirection="column"
        gap={3}
      >
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight={700}>
            観戦者の復帰申請
          </Text>
          <HStack gap={3} align="center" flexWrap="wrap">
            <HStack gap={2}>
              <Badge colorScheme={spectatorRecallEnabled ? "green" : "gray"}>
                {spectatorRecallEnabled ? "待機ウィンドウ開放中" : "待機ウィンドウ閉鎖中"}
              </Badge>
              <Badge colorScheme={requests.length > 0 ? "orange" : "gray"}>
                {requests.length > 0 ? `${requests.length} 件待機中` : "待機なし"}
              </Badge>
            </HStack>
            {canRecallSpectators ? (
              <AppButton
                palette="brand"
                size="sm"
                visual={spectatorRecallEnabled ? "outline" : "solid"}
                onClick={handleSpectatorRecall}
                disabled={recallButtonDisabled}
              >
                {recallPending ? (
                  <HStack gap={2} align="center">
                    <Spinner size="xs" />
                    <Text as="span">呼び出し中...</Text>
                  </HStack>
                ) : (
                  recallButtonLabel
                )}
              </AppButton>
            ) : null}
          </HStack>
        </HStack>
        {loading ? (
          <HStack gap={3} align="center">
            <Spinner size="sm" />
            <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80}>
              申請を読み込み中…
            </Text>
          </HStack>
        ) : null}
        {error ? (
          <Box
            border="1px solid rgba(255, 120, 120, 0.4)"
            bg="rgba(80, 0, 0, 0.45)"
            color="rgba(255, 220, 220, 0.95)"
            px={3}
            py={2}
            fontSize="sm"
          >
            復帰申請の取得に失敗しました: {error}
          </Box>
        ) : null}
        <VStack align="stretch" gap={3}>
          {requests.map((request) => {
            const displayName = getDisplayName(request.viewerUid);
            return (
              <Box
                key={request.sessionId}
                border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha40}`}
                px={3}
                py={3}
                bg="rgba(0,0,0,0.35)"
              >
                <VStack align="stretch" gap={2}>
                  <HStack justify="space-between" flexWrap="wrap" gap={2}>
                    <Text fontWeight={600} fontSize="md">
                      {displayName}
                    </Text>
                    <HStack gap={2}>
                      <Badge colorScheme={request.source === "auto" ? "purple" : "cyan"}>
                        {sourceLabel(request.source)}
                      </Badge>
                      <Badge colorScheme="gray">
                        申請 {formatRequestedAt(request.requestedAt)}
                      </Badge>
                    </HStack>
                  </HStack>
                  <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80}>
                    セッション: {request.sessionId} / ルーム: {roomId}
                  </Text>
                  <HStack gap={3} flexWrap="wrap">
                    <AppButton
                      palette="brand"
                      size="sm"
                      disabled={isPending(request.sessionId, "approve")}
                      onClick={() => {
                        void handleApprove(request);
                      }}
                    >
                      {isPending(request.sessionId, "approve") ? (
                        <HStack gap={2}>
                          <Spinner size="xs" />
                          <Text as="span">承認中...</Text>
                        </HStack>
                      ) : (
                        "承認して席に戻す"
                      )}
                    </AppButton>
                    <AppButton
                      palette="gray"
                      visual="outline"
                      size="sm"
                      disabled={isPending(request.sessionId, "reject")}
                      onClick={() => handleRejectClick(request)}
                    >
                      {isPending(request.sessionId, "reject") ? (
                        <HStack gap={2}>
                          <Spinner size="xs" />
                          <Text as="span">拒否中...</Text>
                        </HStack>
                      ) : (
                        "見送る"
                      )}
                    </AppButton>
                  </HStack>
                </VStack>
              </Box>
            );
          })}
          {!loading && !error && requests.length === 0 ? (
            <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80}>
              現在、承認待ちの観戦者はいません。
            </Text>
          ) : null}
        </VStack>
      </Box>

      <Dialog.Root open={!!rejectDialog} onOpenChange={(details) => !details.open && handleRejectDialogClose()}>
        <Dialog.Backdrop
          css={{
            background: "rgba(8, 10, 20, 0.7)",
            backdropFilter: "blur(8px)",
          }}
        />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="480px"
            borderRadius={0}
            border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
            bg={UI_TOKENS.GRADIENTS.dqPanel}
            boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
            px={0}
            py={0}
          >
            <Dialog.Header
              px={5}
              py={4}
              borderBottom={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
              fontWeight={700}
            >
              観戦者を見送る理由
            </Dialog.Header>
            <Dialog.Body px={5} py={4}>
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80}>
                  理由は任意です。入力すると観戦者に通知されます（最大 {MAX_REASON_LENGTH} 文字）。
                </Text>
                <VStack align="stretch" gap={2}>
                  <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80} fontWeight={600}>
                    見送り理由
                  </Text>
                  <Textarea
                    value={rejectDialog?.reason ?? ""}
                    onChange={(event) => {
                      const next = event.target.value.slice(0, MAX_REASON_LENGTH);
                      setRejectDialog((prev) => (prev ? { ...prev, reason: next } : prev));
                    }}
                    placeholder="例: 次のラウンドまでお待ちください"
                    maxLength={MAX_REASON_LENGTH}
                    rows={4}
                    resize="vertical"
                    bg="rgba(0,0,0,0.35)"
                    borderColor={UI_TOKENS.COLORS.whiteAlpha40}
                    color={UI_TOKENS.COLORS.textBase}
                    _focusVisible={{
                      borderColor: UI_TOKENS.COLORS.whiteAlpha90,
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
                    }}
                  />
                  <Text fontSize="xs" color={UI_TOKENS.COLORS.whiteAlpha60} textAlign="right">
                    {(rejectDialog?.reason.length ?? 0)}/{MAX_REASON_LENGTH}
                  </Text>
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer
              px={5}
              py={4}
              borderTop={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
              display="flex"
              gap={3}
              justifyContent="flex-end"
            >
              <AppButton palette="gray" visual="outline" size="sm" onClick={handleRejectDialogClose}>
                キャンセル
              </AppButton>
              <AppButton
                palette="brand"
                size="sm"
                disabled={
                  !rejectDialog ||
                  isPending(rejectDialog.request.sessionId, "reject") ||
                  !rejectDialog.request.sessionId
                }
                onClick={() => {
                  void handleRejectConfirm();
                }}
              >
                {rejectDialog && isPending(rejectDialog.request.sessionId, "reject") ? (
                  <HStack gap={2}>
                    <Spinner size="xs" />
                    <Text as="span">送信中...</Text>
                  </HStack>
                ) : (
                  "見送りを確定"
                )}
              </AppButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
