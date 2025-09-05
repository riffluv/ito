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
import { Box, HStack, IconButton, Input } from "@chakra-ui/react";
import React from "react";
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
import { FiLogOut, FiSettings } from "react-icons/fi";

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
      notify({
        title: "記録に失敗しました",
        description: e?.message,
        type: "error",
      });
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
    if (!allSubmitted) return;
    await submitSortedOrder(roomId, proposal || []);
  };

  const continueRound = async () => {
    await continueAfterFailAction(roomId);
  };

  const resetGame = async () => {
    const { resetRoomToWaiting } = await import("@/lib/firebase/rooms");
    await resetRoomToWaiting(roomId);
  };

  // 配布演出: 数字が来た瞬間に軽くポップ（レイアウト不変）
  const [pop, setPop] = React.useState(false);
  React.useEffect(() => {
    if (typeof me?.number === "number") {
      setPop(true);
      const id = setTimeout(() => setPop(false), 180);
      return () => clearTimeout(id);
    }
  }, [me?.number]);

  return (
    <Box
      display="grid"
      gridTemplateAreas={{
        base: "'left' 'center' 'right'",
        md: "'left center right'",
      }}
      gridTemplateColumns={{
        base: "1fr",
        md: "minmax(0,1fr) auto minmax(0,1fr)",
      }}
      alignItems="center"
      columnGap={{ base: 3, md: 6 }}
      rowGap={{ base: 3, md: 0 }}
      w="100%"
      p={4}
      bg="rgba(10,11,20,0.9)" // ドラクエ風の透明感のある背景
      borderTop="2px solid rgba(255,255,255,0.3)" // ドラクエ風のボーダー
      backdropFilter="blur(8px)"
    >
      {/* 左: 入力・アクション */}
      <HStack gap={3} align="center" minW={0} gridArea="left">
        <Input
          placeholder="連想ワード"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDecide();
          }}
          size="sm"
          maxW={{ base: "100%", md: "520px" }}
          bg="rgba(0,0,0,0.6)" // ドラクエ風の深い背景
          color="#fff"
          border="1px solid rgba(255,255,255,0.4)" // ドラクエ風のボーダー
          borderRadius={4}
          _placeholder={{ color: "rgba(255,255,255,0.6)" }}
          _focus={{
            borderColor: "#4a9eff", // ドラクエ風の青
            boxShadow: "0 0 0 1px #4a9eff",
            bg: "rgba(0,0,0,0.8)",
          }}
          _hover={{ borderColor: "rgba(255,255,255,0.6)" }}
        />
        <AppButton
          size="md"
          visual="ghost"
          palette="gray"
          onClick={handleDecide}
          disabled={!canDecide}
          css={{
            background: canDecide
              ? "rgba(74,158,255,0.8)"
              : "rgba(255,255,255,0.1)",
            border: `1px solid ${canDecide ? "#4a9eff" : "rgba(255,255,255,0.3)"}`,
            color: canDecide ? "#fff" : "rgba(255,255,255,0.5)",
            borderRadius: 4,
            backdropFilter: "blur(4px)",
          }}
        >
          決定
        </AppButton>
        <AppButton
          size="md"
          visual="ghost"
          palette="gray"
          onClick={handleSubmit}
          disabled={!canSubmit}
          css={{
            background: canSubmit
              ? "rgba(74,158,255,0.8)"
              : "rgba(255,255,255,0.1)",
            border: `1px solid ${canSubmit ? "#4a9eff" : "rgba(255,255,255,0.3)"}`,
            color: canSubmit ? "#fff" : "rgba(255,255,255,0.5)",
            borderRadius: 4,
            backdropFilter: "blur(4px)",
          }}
        >
          出す
        </AppButton>
      </HStack>

      {/* 中央: ヒーロー番号（ドラクエ風） */}
      <Box gridArea="center" display="flex" justifyContent="center">
        <Box
          w="4ch"
          minW="4ch"
          textAlign="center"
          px={3}
          py={2}
          bg="rgba(0,0,0,0.8)" // ドラクエ風の深い背景
          color="#fff"
          border="2px solid rgba(255,255,255,0.6)" // ドラクエ風のボーダー
          borderRadius={6}
          fontWeight={800}
          fontSize={{ base: "36px", md: "44px" }}
          lineHeight={1}
          boxShadow="inset 0 1px 2px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.3)"
          css={{
            fontVariantNumeric: "tabular-nums",
            fontFamily:
              "'SF Mono','Cascadia Mono','Menlo','Roboto Mono',monospace",
            transform: pop ? "scale(1.06)" : "scale(1)",
            transition:
              "transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease",
            backdropFilter: "blur(4px)",
            background:
              typeof me?.number === "number"
                ? "linear-gradient(135deg, rgba(74,158,255,0.2), rgba(0,0,0,0.8))"
                : "rgba(0,0,0,0.8)",
          }}
        >
          {typeof me?.number === "number" ? me.number : "??"}
        </Box>
      </Box>

      {/* 右: ホスト操作 */}
      <HStack gap={3} align="center" justifyContent="flex-end" gridArea="right">
        {isHost && roomStatus === "waiting" && (
          <AppButton
            size="md"
            visual="ghost"
            palette="gray"
            onClick={quickStart}
            css={{
              background: "#000",
              border: "1px solid #fff",
              color: "#fff",
              borderRadius: 0,
            }}
          >
            ゲーム開始
          </AppButton>
        )}
        {isHost && isSortSubmit(actualResolveMode) && roomStatus === "clue" && (
          <AppButton
            size="md"
            visual="ghost"
            palette="gray"
            onClick={evalSorted}
            disabled={!allSubmitted}
            css={{
              background: "#000",
              border: `1px solid ${allSubmitted ? "#fff" : "#666"}`,
              color: allSubmitted ? "#fff" : "#888",
              borderRadius: 0,
            }}
          >
            判定
          </AppButton>
        )}
        {isHost &&
          ((roomStatus === "reveal" && !!allowContinueAfterFail) ||
            roomStatus === "finished") && (
            <AppButton
              size="md"
              visual="ghost"
              palette="gray"
              onClick={roomStatus === "finished" ? resetGame : continueRound}
              css={{
                background: "#000",
                border: "1px solid #fff",
                color: "#fff",
                borderRadius: 0,
              }}
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
                size="xs"
                bg="#000"
                color="#fff"
                borderWidth={1}
                borderColor="#fff"
                borderRadius={0}
              >
                <FaRegCreditCard />
              </IconButton>
              <IconButton
                aria-label="数字配布"
                onClick={() => topicControls.dealNumbers(roomId)}
                size="xs"
                bg="#000"
                color="#fff"
                borderWidth={1}
                borderColor="#fff"
                borderRadius={0}
              >
                <FaDice />
              </IconButton>
              <IconButton
                aria-label="リセット"
                onClick={resetGame}
                size="xs"
                bg="#000"
                color="#fff"
                borderWidth={1}
                borderColor="#fff"
                borderRadius={0}
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
