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
      bg={UI_TOKENS.COLORS.panelBg}
      border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
      borderRadius={0}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: "-3px",
        left: "-3px",
        right: "-3px",
        bottom: "-3px",
        border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
        borderRadius: 0,
        pointerEvents: "none",
      }}
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
        bg={UI_TOKENS.COLORS.dqBlue}
        color="white"
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        fontWeight="600"
        boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
        _hover={{
          bg: UI_TOKENS.COLORS.dqBlueHover,
          borderColor: "white",
          transform: "translateY(-1px)",
        }}
        _active={{
          transform: "translateY(0)",
          boxShadow: UI_TOKENS.SHADOWS.buttonPressed,
        }}
        transition="all 0.15s ease"
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
        bg={UI_TOKENS.COLORS.dqGreen}
        color="white"
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        fontWeight="600"
        boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
        _hover={{
          bg: UI_TOKENS.COLORS.dqGreenHover,
          borderColor: "white",
          transform: "translateY(-1px)",
        }}
        _active={{
          transform: "translateY(0)",
          boxShadow: UI_TOKENS.SHADOWS.buttonPressed,
        }}
        transition="all 0.15s ease"
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
            px={4}
            py={2}
            bg={UI_TOKENS.GRADIENTS.forestGreen}
            color="white"
            border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
            borderRadius={0}
            fontWeight="700"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            boxShadow={UI_TOKENS.BUTTON_SHADOWS.raised}
            _hover={{
              bg: UI_TOKENS.GRADIENTS.forestGreenHover,
              color: UI_TOKENS.COLORS.whiteAlpha95,
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              borderColor: "white",
              transform: "translateY(-1px)",
            }}
            _active={{
              bg: UI_TOKENS.GRADIENTS.forestGreenActive,
              color: UI_TOKENS.COLORS.whiteAlpha90,
              boxShadow: UI_TOKENS.BUTTON_SHADOWS.active,
              transform: "translateY(0)",
            }}
            transition="all 0.15s ease"
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
            px={4}
            py={2}
            bg={UI_TOKENS.GRADIENTS.royalPurple}
            color="white"
            border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
            borderRadius={0}
            fontWeight="700"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            boxShadow={UI_TOKENS.BUTTON_SHADOWS.raised}
            _hover={{
              bg: UI_TOKENS.GRADIENTS.royalPurpleHover,
              color: UI_TOKENS.COLORS.whiteAlpha95,
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              borderColor: "white",
              transform: "translateY(-1px)",
            }}
            _active={{
              bg: UI_TOKENS.GRADIENTS.royalPurpleActive,
              color: UI_TOKENS.COLORS.whiteAlpha90,
              boxShadow: UI_TOKENS.BUTTON_SHADOWS.active,
              transform: "translateY(0)",
            }}
            _disabled={{
              bg: UI_TOKENS.COLORS.blackAlpha60,
              color: UI_TOKENS.COLORS.whiteAlpha40,
              borderColor: UI_TOKENS.COLORS.whiteAlpha50,
              cursor: "not-allowed",
              textShadow: "1px 1px 0px #000",
            }}
            transition="all 0.15s ease"
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
              px={4}
              py={2}
              bg={UI_TOKENS.GRADIENTS.orangeSunset}
              color="white"
              border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
              borderRadius={0}
              fontWeight="700"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              boxShadow={UI_TOKENS.BUTTON_SHADOWS.raised}
              _hover={{
                bg: UI_TOKENS.GRADIENTS.orangeSunsetHover,
                color: UI_TOKENS.COLORS.whiteAlpha95,
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                borderColor: "white",
                transform: "translateY(-1px)",
              }}
              _active={{
                bg: UI_TOKENS.GRADIENTS.orangeSunsetActive,
                color: UI_TOKENS.COLORS.whiteAlpha90,
                boxShadow: UI_TOKENS.BUTTON_SHADOWS.active,
                transform: "translateY(0)",
              }}
              transition="all 0.15s ease"
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
                bg={UI_TOKENS.COLORS.panelBg}
                color="white"
                border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                borderRadius={0}
                boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
                _hover={{
                  bg: UI_TOKENS.COLORS.dqBlue,
                  borderColor: "white",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                  boxShadow: UI_TOKENS.SHADOWS.buttonPressed,
                }}
                transition="all 0.15s ease"
              >
                <FaRegCreditCard />
              </IconButton>
              <IconButton
                aria-label="数字配布"
                onClick={() => topicControls.dealNumbers(roomId)}
                size="sm"
                w="36px"
                h="36px"
                bg={UI_TOKENS.COLORS.panelBg}
                color="white"
                border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                borderRadius={0}
                boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
                _hover={{
                  bg: UI_TOKENS.COLORS.dqGreen,
                  borderColor: "white",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                  boxShadow: UI_TOKENS.SHADOWS.buttonPressed,
                }}
                transition="all 0.15s ease"
              >
                <FaDice />
              </IconButton>
              <IconButton
                aria-label="リセット"
                onClick={resetGame}
                size="sm"
                w="36px"
                h="36px"
                bg={UI_TOKENS.COLORS.panelBg}
                color="white"
                border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                borderRadius={0}
                boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
                _hover={{
                  bg: UI_TOKENS.COLORS.dqRed,
                  borderColor: "white",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                  boxShadow: UI_TOKENS.SHADOWS.buttonPressed,
                }}
                transition="all 0.15s ease"
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