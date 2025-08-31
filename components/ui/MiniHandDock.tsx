"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { updateClue1 } from "@/lib/firebase/players";
import {
  addCardToProposal,
  commitPlayFromClue,
  continueAfterFail as continueAfterFailAction,
  startGame as startGameAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import type { PlayerDoc } from "@/lib/types";
import { Box, HStack, Input } from "@chakra-ui/react";
import React from "react";

type ResolveMode = "sequential" | "sort-submit";

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
  const actualResolveMode: ResolveMode =
    resolveMode === "sort-submit" ? "sort-submit" : "sequential";
  const sequentialGate =
    actualResolveMode === "sort-submit" ? true : !!cluesReady;
  const canSubmit = canDecide && ready && !placed && sequentialGate;
  const allSubmitted =
    actualResolveMode === "sort-submit" &&
    Array.isArray(eligibleIds) &&
    Array.isArray(proposal) &&
    eligibleIds.length > 0 &&
    eligibleIds.length === proposal.length;

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
    } catch (e: any) {
      notify({
        title: "確定に失敗しました",
        description: e?.message,
        type: "error",
      });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return; // ガード: UI 無効時は動作しない
    try {
      if (actualResolveMode === "sort-submit") {
        if (!placed) await addCardToProposal(roomId, me!.id);
        notify({ title: "提出しました", type: "success" });
      } else {
        if (!cluesReady) {
          notify({
            title: "全員の連想ワードが確定してから出してください",
            type: "info",
          });
          return;
        }
        await commitPlayFromClue(roomId, me!.id);
        notify({ title: "場に出しました", type: "success" });
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

        {isHost &&
          roomStatus === "clue" &&
          actualResolveMode === "sort-submit" && (
            <AppButton
              size="md"
              onClick={evalSorted}
              disabled={!allSubmitted}
              css={{
                background: allSubmitted
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : "linear-gradient(135deg, #6b7280, #4b5563)",
                color: "#fff",
                fontWeight: "700",
                px: "24px",
                py: "12px",
                boxShadow: allSubmitted
                  ? "0 8px 20px rgba(245, 158, 11, 0.4)"
                  : "0 4px 12px rgba(107, 114, 128, 0.3)",
                _hover: allSubmitted
                  ? {
                      transform: "translateY(-2px)",
                      boxShadow: "0 12px 28px rgba(245, 158, 11, 0.5)",
                    }
                  : {},
                transition: "all 0.2s ease",
              }}
            >
              {allSubmitted ? "🎯 判定開始" : "⏳ 提出待ち"}
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

      {/* 右側: ホスト管理機能（視覚的に分離・プロ仕様） */}
      {isHost && (
        <HStack
          gap={2}
          align="center"
          flex="0 0 auto"
          css={{
            borderLeft: "2px solid rgba(107, 114, 128, 0.3)",
            paddingLeft: "12px",
            marginLeft: "8px",
          }}
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
                  css={{
                    fontSize: "xs",
                    px: "10px",
                    py: "6px",
                    border: "1.5px solid rgba(107, 114, 128, 0.4)",
                    color: "rgba(107, 114, 128, 0.9)",
                    _hover: {
                      borderColor: "rgba(107, 114, 128, 0.6)",
                      background: "rgba(107, 114, 128, 0.1)",
                    },
                  }}
                >
                  🎲 お題
                </AppButton>
                <AppButton
                  size="sm"
                  visual="outline"
                  onClick={() => topicControls.dealNumbers(roomId)}
                  css={{
                    fontSize: "xs",
                    px: "10px",
                    py: "6px",
                    border: "1.5px solid rgba(107, 114, 128, 0.4)",
                    color: "rgba(107, 114, 128, 0.9)",
                    _hover: {
                      borderColor: "rgba(107, 114, 128, 0.6)",
                      background: "rgba(107, 114, 128, 0.1)",
                    },
                  }}
                >
                  🔢 数字
                </AppButton>
                <AppButton
                  size="sm"
                  visual="outline"
                  onClick={resetGame}
                  css={{
                    fontSize: "xs",
                    px: "10px",
                    py: "6px",
                    border: "1.5px solid rgba(239, 68, 68, 0.4)",
                    color: "rgba(239, 68, 68, 0.9)",
                    _hover: {
                      borderColor: "rgba(239, 68, 68, 0.6)",
                      background: "rgba(239, 68, 68, 0.1)",
                    },
                  }}
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
            css={{
              background:
                actualResolveMode === "sort-submit"
                  ? "rgba(16, 185, 129, 0.4)"
                  : "rgba(101,67,33,0.4)",
              color: "rgba(255,255,255,0.9)",
              border: `1px solid ${
                actualResolveMode === "sort-submit"
                  ? "rgba(16, 185, 129, 0.5)"
                  : "rgba(160,133,91,0.3)"
              }`,
              whiteSpace: "nowrap",
            }}
          >
            {actualResolveMode === "sequential" ? "順次" : "一括"}
          </Box>
        </HStack>
      )}
    </HStack>
  );
}
