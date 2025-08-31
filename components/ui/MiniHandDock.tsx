"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { updateClue1 } from "@/lib/firebase/players";
import {
  canSubmitCard,
  computeAllSubmitted,
  isSortSubmit,
  normalizeResolveMode,
  ResolveMode,
} from "@/lib/game/resolveMode";
import {
  addCardToProposal,
  commitPlayFromClue,
  continueAfterFail as continueAfterFailAction,
  startGame as startGameAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import type { PlayerDoc } from "@/lib/types";
import { handDockStyles } from "@/theme/itoStyles";
import { Box, HStack, Input } from "@chakra-ui/react";
import React from "react";

interface MiniHandDockProps {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: ResolveMode | null; // Firestore上 undefined/null のフォールバックを吸収
  proposal?: string[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
  defaultTopicType?: string;
  allowContinueAfterFail?: boolean; // ここでは現在未使用（将来: 失敗継続ボタン制御で利用予定）
}

export default function MiniHandDock({
  roomId,
  me,
  resolveMode,
  proposal,
  eligibleIds,
  cluesReady,
  isHost,
  roomStatus,
  defaultTopicType = "通常版",
  allowContinueAfterFail = false,
}: MiniHandDockProps) {
  const [text, setText] = React.useState<string>(me?.clue1 || "");
  const placed = !!proposal?.includes(me?.id || "");
  const ready = !!(me && (me as any).ready === true);
  const canDecide =
    !!me?.id && typeof me?.number === "number" && text.trim().length > 0;

  // sanitize: Firestore 未設定時には sequential を既定値とする
  const actualResolveMode = normalizeResolveMode(resolveMode);
  const allSubmitted = computeAllSubmitted({
    mode: actualResolveMode,
    eligibleIds,
    proposal,
  });
  const canSubmit = canSubmitCard({
    mode: actualResolveMode,
    canDecide,
    ready,
    placed,
    cluesReady,
  });

  React.useEffect(() => {
    setText(me?.clue1 || "");
  }, [me?.clue1]);

  // デバッグ用: モード設定の確認
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // 開発時のみモード/状態のデバッグログ
    // eslint-disable-next-line no-console
    console.log("[MiniHandDock] Mode Debug", {
      resolveMode,
      actualResolveMode,
      roomStatus,
      isHost,
    });
  }, [resolveMode, actualResolveMode, roomStatus, isHost]);

  const handleDecide = async () => {
    if (!canDecide) return;
    try {
      await updateClue1(roomId, me!.id, text.trim());
      notify({ title: "連想ワードを確定しました", type: "success" });
      if (process.env.NODE_ENV !== "production") {
        const g: any = globalThis as any;
        g.__ITO_DEV_STATS ||= {};
        g.__ITO_DEV_STATS.decide = (g.__ITO_DEV_STATS.decide || 0) + 1;
      }
    } catch (e: any) {
      notify({
        title: "確定に失敗しました",
        description: e?.message,
        type: "error",
      });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!me?.id) return;
    try {
      if (isSortSubmit(actualResolveMode)) {
        if (!placed) {
          await addCardToProposal(roomId, me.id);
          notify({ title: "提出しました", type: "success" });
          if (process.env.NODE_ENV !== "production") {
            const g: any = globalThis as any;
            g.__ITO_DEV_STATS ||= {};
            g.__ITO_DEV_STATS.submit = (g.__ITO_DEV_STATS.submit || 0) + 1;
          }
        }
      } else {
        if (!cluesReady) {
          notify({
            title: "全員の連想ワードが確定してから出してください",
            type: "info",
          });
          return;
        }
        await commitPlayFromClue(roomId, me.id);
        notify({ title: "場に出しました", type: "success" });
        if (process.env.NODE_ENV !== "production") {
          const g: any = globalThis as any;
          g.__ITO_DEV_STATS ||= {};
          g.__ITO_DEV_STATS.play = (g.__ITO_DEV_STATS.play || 0) + 1;
        }
      }
    } catch (e: any) {
      notify({
        title: "提出に失敗しました",
        description: e?.message,
        type: "error",
      });
    }
  };

  const quickStart = async () => {
    await startGameAction(roomId);
    await topicControls.selectCategory(roomId, defaultTopicType as any);
    await topicControls.dealNumbers(roomId);
  };

  const evalSorted = async () => {
    if (!allSubmitted) return; // ホスト以外あるいは未提出状態での誤クリック防止
    try {
      const list = proposal || [];
      await submitSortedOrder(roomId, list);
    } catch (error: any) {
      notify({
        title: "判定に失敗しました",
        description: error?.message,
        type: "error",
      });
    }
  };

  const continueRound = async () => {
    await continueAfterFailAction(roomId);
  };

  const resetGame = async () => {
    try {
      const { resetRoomToWaiting } = await import("@/lib/firebase/rooms");
      await resetRoomToWaiting(roomId);
      notify({ title: "ゲームを完全にリセットしました", type: "success" });
    } catch (error: any) {
      notify({
        title: "リセットに失敗しました",
        description: error?.message,
        type: "error",
      });
    }
  };

  return (
    <HStack
      gap={4}
      align="center"
      justify="space-between"
      w="100%"
      position="relative"
    >
      {/* 左側: プレイヤーアクション（最優先） */}
      <HStack gap={3} align="center" flex="0 0 auto">
        <Box
          minW="64px"
          h="44px"
          px={3}
          borderRadius="12px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontWeight={800}
          fontSize="lg"
          css={handDockStyles.numberBox}
        >
          {typeof me?.number === "number" ? me.number : "?"}
        </Box>
        <Input
          placeholder="連想ワード"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDecide();
          }}
          size="sm"
          w={{ base: "180px", md: "240px" }}
          borderRadius="20px"
          css={handDockStyles.clueInput}
        />

        <AppButton
          size="sm"
          visual="subtle"
          onClick={handleDecide}
          disabled={!canDecide}
        >
          確定
        </AppButton>
        <AppButton size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          出す
        </AppButton>
      </HStack>

      {/* 中央: ゲーム進行の主要アクション（市販ゲーム標準） */}
      <Box
        position="absolute"
        left="50%"
        transform="translateX(-50%)"
        zIndex={10}
      >
        {isHost && roomStatus === "waiting" && (
          <AppButton
            size="md"
            onClick={quickStart}
            css={handDockStyles.startButton}
          >
            🎮 ゲーム開始
          </AppButton>
        )}

        {isHost && roomStatus === "clue" && isSortSubmit(actualResolveMode) && (
          <AppButton
            size="md"
            onClick={evalSorted}
            disabled={!allSubmitted}
            css={{
              ...(allSubmitted
                ? handDockStyles.evaluateEnabled
                : handDockStyles.evaluateDisabled),
              ...handDockStyles.evaluateShared,
              _hover: allSubmitted ? handDockStyles.evaluateShared._hover : {},
            }}
          >
            {allSubmitted ? "🎯 判定開始" : "⏳ 提出待ち"}
          </AppButton>
        )}

        {isHost && roomStatus === "finished" && (
          <AppButton
            size="md"
            onClick={continueRound}
            css={handDockStyles.retryButton}
          >
            🔄 もう一度
          </AppButton>
        )}
      </Box>

      {/* 右側: ホスト管理機能（視覚的に分離・プロ仕様） */}
      {isHost && (
        <HStack
          gap={2}
          align="center"
          flex="0 0 auto"
          css={handDockStyles.hostDivider}
        >
          {roomStatus === "clue" && (
            <>
              <Box
                fontSize="xs"
                fontWeight="600"
                color="rgba(107, 114, 128, 0.8)"
                mb="1px"
                css={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
              >
                HOST
              </Box>
              <HStack gap={1}>
                <AppButton
                  size="sm"
                  visual="outline"
                  onClick={() =>
                    topicControls.shuffleTopic(roomId, defaultTopicType as any)
                  }
                  css={handDockStyles.tinyOutlineNeutral}
                >
                  🎲 お題
                </AppButton>
                <AppButton
                  size="sm"
                  visual="outline"
                  onClick={() => topicControls.dealNumbers(roomId)}
                  css={handDockStyles.tinyOutlineNeutral}
                >
                  🔢 数字
                </AppButton>
                <AppButton
                  size="sm"
                  visual="outline"
                  onClick={resetGame}
                  css={handDockStyles.tinyOutlineDanger}
                >
                  🔄
                </AppButton>
              </HStack>
            </>
          )}

          <Box
            px={2}
            py={1}
            borderRadius="4px"
            fontSize="xs"
            fontWeight="500"
            css={handDockStyles.modeBadge(isSortSubmit(actualResolveMode))}
          >
            {isSortSubmit(actualResolveMode) ? "一括" : "順次"}
          </Box>
        </HStack>
      )}
    </HStack>
  );
}
