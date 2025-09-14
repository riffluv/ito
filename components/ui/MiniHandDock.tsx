"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
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
import { Box, HStack, IconButton, Input } from "@chakra-ui/react";
import React from "react";
import { UI_TOKENS } from "@/theme/layout";
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
import { FiLogOut, FiSettings } from "react-icons/fi";
import { DiamondNumberCard } from "./DiamondNumberCard";

interface MiniHandDockProps {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: ResolveMode | null;
  proposal?: string[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
  defaultTopicType?: string;
  allowContinueAfterFail?: boolean;
  roomName?: string;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>;
  pop?: boolean;
}

export default function MiniHandDock(props: MiniHandDockProps) {
  const {
    roomId,
    me,
    resolveMode,
    proposal,
    eligibleIds,
    cluesReady,
    isHost,
    roomStatus,
    defaultTopicType = "通常版",
    allowContinueAfterFail,
    onOpenSettings,
    onLeaveRoom,
    pop = false,
  } = props;

  const [text, setText] = React.useState<string>(me?.clue1 || "");
  React.useEffect(() => setText(me?.clue1 || ""), [me?.clue1]);

  const actualResolveMode = normalizeResolveMode(resolveMode);
  const placed = !!proposal?.includes(me?.id || "");
  const ready = !!(me && (me as any).ready === true);
  const canDecide =
    !!me?.id && typeof me?.number === "number" && text.trim().length > 0;
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

  const handleDecide = async () => {
    if (!canDecide || !me?.id) return;

    try {
      await updateClue1(roomId, me.id, text.trim());
      notify({ title: "連想ワードを記録しました", type: "success" });
    } catch (e: any) {
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError("連想ワード記録");
        notify({
          title: "接続制限のため記録不可",
          description: "現在連想ワードを記録できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "記録に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !me?.id) return;

    try {
      if (isSortSubmit(actualResolveMode)) {
        if (!placed) await addCardToProposal(roomId, me.id);
      } else {
        if (!cluesReady) return;
        await commitPlayFromClue(roomId, me.id);
      }
      notify({ title: "提出しました", type: "success" });
    } catch (e: any) {
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError("カード提出");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在カードを提出できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "提出に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
  };

  const quickStart = async () => {
    await startGameAction(roomId);
    await topicControls.selectCategory(roomId, defaultTopicType as any);
    await topicControls.dealNumbers(roomId);
  };

  const evalSorted = async () => {
    if (!allSubmitted) return;
    const list = (proposal || []).filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    await submitSortedOrder(roomId, list);
  };

  const continueRound = async () => {
    await continueAfterFailAction(roomId);
  };

  const resetGame = async () => {
    try {
      const { resetRoomToWaiting } = await import("@/lib/firebase/rooms");
      const inProgress = roomStatus === "clue" || roomStatus === "reveal";
      await resetRoomToWaiting(roomId, inProgress ? { force: true } : undefined);
      notify({ title: "ゲームをリセット！", type: "success" });
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      notify({ title: "リセットに失敗しました", description: msg, type: "error" });
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="100%"
      maxW="900px"
      mx="auto"
      px={6}
      py={4}
      gap={{ base: 3, md: 5 }}
      bg="rgba(0, 0, 0, 0.75)"
      backdropFilter="blur(8px)"
      borderRadius={8}
      boxShadow="0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(255, 255, 255, 0.05) inset"
      border="1px solid rgba(255, 255, 255, 0.1)"
      position="relative"
    >
      <DiamondNumberCard
        number={me?.number || null}
        isAnimating={pop}
      />
      <Input
        placeholder="連想ワード"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={50}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDecide();
        }}
        size="sm"
        bg={UI_TOKENS.COLORS.panelBg}
        color="white"
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
        borderRadius={4}
        boxShadow="inset 1px 1px 2px rgba(0,0,0,0.4), 0 1px 2px rgba(255,255,255,0.1)"
        _placeholder={{ color: UI_TOKENS.COLORS.whiteAlpha50 }}
        _focus={{
          borderColor: UI_TOKENS.COLORS.dqBlue,
          boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.4), 0 0 0 2px rgba(58,176,255,0.4)",
          bg: UI_TOKENS.COLORS.panelBg,
        }}
        _hover={{
          borderColor: UI_TOKENS.COLORS.whiteAlpha80,
          bg: UI_TOKENS.COLORS.panelBg,
        }}
        maxW="300px"
      />
      <AppButton
        size="sm"
        visual="solid"
        palette="brand"
        onClick={handleDecide}
        disabled={!canDecide}
        px={4}
        py={2}
        borderRadius={6}
        bg="linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
        border="1px solid rgba(59, 130, 246, 0.3)"
        boxShadow="0 4px 12px rgba(37, 99, 235, 0.4), 0 1px 3px rgba(255, 255, 255, 0.1) inset"
        _hover={{
          transform: "translateY(-1px)",
          boxShadow: "0 6px 16px rgba(37, 99, 235, 0.5), 0 1px 3px rgba(255, 255, 255, 0.15) inset",
        }}
        _active={{
          transform: "translateY(0)",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3), 0 1px 2px rgba(255, 255, 255, 0.1) inset",
        }}
        transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        決定
      </AppButton>
      <AppButton
        size="sm"
        visual="solid"
        palette="brand"
        onClick={handleSubmit}
        disabled={!canSubmit}
        px={4}
        py={2}
        borderRadius={6}
        bg="linear-gradient(135deg, #059669 0%, #047857 100%)"
        border="1px solid rgba(16, 185, 129, 0.3)"
        boxShadow="0 4px 12px rgba(5, 150, 105, 0.4), 0 1px 3px rgba(255, 255, 255, 0.1) inset"
        _hover={{
          transform: "translateY(-1px)",
          boxShadow: "0 6px 16px rgba(5, 150, 105, 0.5), 0 1px 3px rgba(255, 255, 255, 0.15) inset",
        }}
        _active={{
          transform: "translateY(0)",
          boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3), 0 1px 2px rgba(255, 255, 255, 0.1) inset",
        }}
        transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        出す
      </AppButton>

      <HStack gap={3} align="center">
        {isHost && roomStatus === "waiting" && (
          <AppButton
            size="md"
            visual="solid"
            onClick={quickStart}
            minW="110px"
            px={6}
            py={3}
            borderRadius={8}
            bg="linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)"
            color="white"
            border="1px solid rgba(239, 68, 68, 0.4)"
            fontWeight="600"
            fontSize="14px"
            boxShadow="0 6px 20px rgba(220, 38, 38, 0.4), 0 2px 4px rgba(255, 255, 255, 0.1) inset"
            _hover={{
              bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
              transform: "translateY(-1.5px)",
              boxShadow: "0 8px 25px rgba(220, 38, 38, 0.5), 0 2px 6px rgba(255, 255, 255, 0.15) inset",
            }}
            _active={{
              transform: "translateY(0)",
              boxShadow: "0 3px 12px rgba(220, 38, 38, 0.3), 0 1px 3px rgba(255, 255, 255, 0.1) inset",
            }}
            transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
          >
            ゲーム開始
          </AppButton>
        )}
        {isHost && isSortSubmit(actualResolveMode) && roomStatus === "clue" && (
          <AppButton
            size="md"
            visual="solid"
            onClick={evalSorted}
            disabled={!allSubmitted}
            minW="110px"
            px={6}
            py={3}
            borderRadius={8}
            bg="linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)"
            color="white"
            border="1px solid rgba(139, 92, 246, 0.4)"
            fontWeight="600"
            fontSize="14px"
            boxShadow="0 6px 20px rgba(124, 58, 237, 0.4), 0 2px 4px rgba(255, 255, 255, 0.1) inset"
            _hover={{
              bg: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
              transform: "translateY(-1.5px)",
              boxShadow: "0 8px 25px rgba(124, 58, 237, 0.5), 0 2px 6px rgba(255, 255, 255, 0.15) inset",
            }}
            _active={{
              transform: "translateY(0)",
              boxShadow: "0 3px 12px rgba(124, 58, 237, 0.3), 0 1px 3px rgba(255, 255, 255, 0.1) inset",
            }}
            _disabled={{
              bg: "rgba(55, 65, 81, 0.5)",
              color: "rgba(156, 163, 175, 0.5)",
              cursor: "not-allowed",
              transform: "none",
              boxShadow: "none",
            }}
            transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
          >
            せーの！
          </AppButton>
        )}
        {isHost &&
          ((roomStatus === "reveal" && !!allowContinueAfterFail) ||
            roomStatus === "finished") && (
            <AppButton
              size="md"
              visual="solid"
              onClick={roomStatus === "finished" ? resetGame : continueRound}
              minW="110px"
              px={6}
              py={3}
              borderRadius={8}
              bg="linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #c2410c 100%)"
              color="white"
              border="1px solid rgba(251, 146, 60, 0.4)"
              fontWeight="600"
              fontSize="14px"
              boxShadow="0 6px 20px rgba(234, 88, 12, 0.4), 0 2px 4px rgba(255, 255, 255, 0.1) inset"
              _hover={{
                bg: "linear-gradient(135deg, #fb923c 0%, #ea580c 50%, #dc2626 100%)",
                transform: "translateY(-1.5px)",
                boxShadow: "0 8px 25px rgba(234, 88, 12, 0.5), 0 2px 6px rgba(255, 255, 255, 0.15) inset",
              }}
              _active={{
                transform: "translateY(0)",
                boxShadow: "0 3px 12px rgba(234, 88, 12, 0.3), 0 1px 3px rgba(255, 255, 255, 0.1) inset",
              }}
              transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              もう一度
            </AppButton>
          )}

        <HStack gap={2}>
          {isHost && (
            <>
              <IconButton
                aria-label="お題シャッフル"
                onClick={() =>
                  topicControls.shuffleTopic(roomId, defaultTopicType as any)
                }
                size="sm"
                w="36px"
                h="36px"
                bg="rgba(55, 65, 81, 0.8)"
                color="rgba(209, 213, 219, 0.9)"
                border="1px solid rgba(75, 85, 99, 0.5)"
                borderRadius={6}
                _hover={{
                  bg: "rgba(75, 85, 99, 0.9)",
                  color: "white",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                }}
                _active={{
                  transform: "translateY(0)",
                  bg: "rgba(55, 65, 81, 0.9)",
                }}
                transition="all 0.2s ease"
              >
                <FaRegCreditCard />
              </IconButton>
              <IconButton
                aria-label="数字配布"
                onClick={() => topicControls.dealNumbers(roomId)}
                size="sm"
                w="36px"
                h="36px"
                bg="rgba(55, 65, 81, 0.8)"
                color="rgba(209, 213, 219, 0.9)"
                border="1px solid rgba(75, 85, 99, 0.5)"
                borderRadius={6}
                _hover={{
                  bg: "rgba(75, 85, 99, 0.9)",
                  color: "white",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                }}
                _active={{
                  transform: "translateY(0)",
                  bg: "rgba(55, 65, 81, 0.9)",
                }}
                transition="all 0.2s ease"
              >
                <FaDice />
              </IconButton>
              <IconButton
                aria-label="リセット"
                onClick={resetGame}
                size="sm"
                w="36px"
                h="36px"
                bg="rgba(55, 65, 81, 0.8)"
                color="rgba(209, 213, 219, 0.9)"
                border="1px solid rgba(75, 85, 99, 0.5)"
                borderRadius={6}
                _hover={{
                  bg: "rgba(75, 85, 99, 0.9)",
                  color: "white",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                }}
                _active={{
                  transform: "translateY(0)",
                  bg: "rgba(55, 65, 81, 0.9)",
                }}
                transition="all 0.2s ease"
              >
                <FaRedo />
              </IconButton>
            </>
          )}
          {onOpenSettings && (
            <IconButton
              aria-label="設定"
              onClick={onOpenSettings}
              size="xs"
              bg="transparent"
              color="gray.400"
              borderWidth={0}
            >
              <FiSettings />
            </IconButton>
          )}
          {onLeaveRoom && (
            <IconButton
              aria-label="退出"
              onClick={onLeaveRoom}
              size="xs"
              bg="transparent"
              color="gray.400"
              borderWidth={0}
              title="ロビーに戻る"
            >
              <FiLogOut />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}