"use client";
import React from "react";
import { Box, HStack, Input } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import type { PlayerDoc } from "@/lib/types";
import { updateClue1 } from "@/lib/firebase/players";
import {
  addCardToProposal,
  commitPlayFromClue,
  startGame as startGameAction,
  submitSortedOrder,
  continueAfterFail as continueAfterFailAction,
} from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import { notify } from "@/components/ui/notify";

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
}: {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: string;
  proposal?: string[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
  defaultTopicType?: string;
  allowContinueAfterFail?: boolean;
}) {
  const [text, setText] = React.useState<string>(me?.clue1 || "");
  const placed = !!proposal?.includes(me?.id || "");
  const ready = !!(me && (me as any).ready === true);
  const canDecide = !!me?.id && typeof me?.number === "number" && text.trim().length > 0;
  const sequentialGate = resolveMode === "sort-submit" ? true : !!cluesReady;
  const canSubmit = canDecide && ready && !placed && sequentialGate;
  const allSubmitted =
    resolveMode === "sort-submit" &&
    Array.isArray(eligibleIds) &&
    Array.isArray(proposal) &&
    eligibleIds.length > 0 &&
    eligibleIds.length === proposal.length;

  React.useEffect(() => setText(me?.clue1 || ""), [me?.clue1]);

  const handleDecide = async () => {
    if (!canDecide) return;
    try {
      await updateClue1(roomId, me!.id, text.trim());
      notify({ title: "連想ワードを確定しました", type: "success" });
    } catch (e: any) {
      notify({ title: "確定に失敗しました", description: e?.message, type: "error" });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      if (resolveMode === "sort-submit") {
        if (!placed) await addCardToProposal(roomId, me!.id);
        notify({ title: "提出しました", type: "success" });
      } else {
        if (!cluesReady) {
          notify({ title: "全員の連想ワードが確定してから出してください", type: "info" });
          return;
        }
        await commitPlayFromClue(roomId, me!.id);
        notify({ title: "場に出しました", type: "success" });
      }
    } catch (e: any) {
      notify({ title: "提出に失敗しました", description: e?.message, type: "error" });
    }
  };

  const quickStart = async () => {
    await startGameAction(roomId);
    await topicControls.selectCategory(roomId, defaultTopicType as any);
    await topicControls.dealNumbers(roomId);
  };

  const evalSorted = async () => {
    if (!allSubmitted) return;
    const list = proposal || [];
    await submitSortedOrder(roomId, list);
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
    <HStack gap={4} align="center" justify="space-between" w="100%" position="relative">
      {/* 左側: ゲームフローグループ（数字→入力→確定→出す） */}
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
          css={{
            background: "#0f172a",
            color: "#fff",
            boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
          }}
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
          css={{
            background: "rgba(101,67,33,0.8)",
            border: "1px solid rgba(160,133,91,0.6)",
            color: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
          }}
        />

        <AppButton size="sm" visual="subtle" onClick={handleDecide} disabled={!canDecide}>
          確定
        </AppButton>
        <AppButton size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          出す
        </AppButton>
      </HStack>

      {/* 中央: ゲーム開始ボタン（市販ゲーム風） */}
      <Box position="absolute" left="50%" transform="translateX(-50%)" zIndex={10}>
        {isHost && roomStatus === "waiting" && (
          <AppButton 
            size="md"
            onClick={quickStart}
            css={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              fontWeight: "700",
              px: "24px",
              py: "12px",
              boxShadow: "0 8px 20px rgba(16, 185, 129, 0.4)",
              _hover: {
                transform: "translateY(-2px)",
                boxShadow: "0 12px 28px rgba(16, 185, 129, 0.5)",
              },
              transition: "all 0.2s ease",
            }}
          >
            🎮 ゲーム開始
          </AppButton>
        )}
        
        {isHost && roomStatus === "finished" && (
          <AppButton 
            size="md"
            onClick={continueRound}
            css={{
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "#fff",
              fontWeight: "700",
              px: "24px",
              py: "12px",
              boxShadow: "0 8px 20px rgba(59, 130, 246, 0.4)",
              _hover: {
                transform: "translateY(-2px)",
                boxShadow: "0 12px 28px rgba(59, 130, 246, 0.5)",
              },
              transition: "all 0.2s ease",
            }}
          >
            🔄 もう一度
          </AppButton>
        )}
      </Box>

      {/* 右側: ホスト操作グループ（tooltip干渉対策） */}
      {isHost && (
        <HStack gap={2} align="center" flex="0 0 auto" css={{ pointerEvents: "auto" }}>
          {roomStatus === "clue" && resolveMode === "sort-submit" && (
            <AppButton 
              size="sm" 
              onClick={evalSorted} 
              disabled={!allSubmitted}
              css={{ 
                whiteSpace: "nowrap",
                pointerEvents: "auto",
                position: "relative",
                zIndex: 5,
              }}
            >
              {allSubmitted ? "🎯 判定" : "⏳ 待機"}
            </AppButton>
          )}

          {roomStatus === "clue" && (
            <HStack gap={1} opacity={0.85}>
              <AppButton 
                size="sm" 
                visual="subtle" 
                onClick={() => topicControls.shuffleTopic(roomId, defaultTopicType as any)}
                css={{
                  fontSize: "xs",
                  px: "8px",
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: 5,
                }}
              >
                🎲
              </AppButton>
              <AppButton 
                size="sm" 
                visual="subtle" 
                onClick={() => topicControls.dealNumbers(roomId)}
                css={{
                  fontSize: "xs",
                  px: "8px", 
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: 5,
                }}
              >
                🔢
              </AppButton>
              <AppButton 
                size="sm" 
                visual="subtle" 
                onClick={resetGame}
                css={{
                  fontSize: "xs",
                  px: "8px",
                  pointerEvents: "auto", 
                  position: "relative",
                  zIndex: 5,
                }}
              >
                🔄
              </AppButton>
            </HStack>
          )}

          <Box
            px={2}
            py={1}
            borderRadius="6px"
            fontSize="xs"
            fontWeight="500"
            css={{
              background: "rgba(101,67,33,0.6)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(160,133,91,0.4)",
              whiteSpace: "nowrap",
            }}
          >
            {resolveMode === "sequential" ? "順次" : "一括"}
          </Box>
        </HStack>
      )}
    </HStack>
  );
}