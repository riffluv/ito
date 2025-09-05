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
  const canDecide = !!me?.id && typeof me?.number === "number" && text.trim().length > 0;
  const allSubmitted = computeAllSubmitted({ mode: actualResolveMode, eligibleIds, proposal });
  const canSubmit = canSubmitCard({ mode: actualResolveMode, canDecide, ready, placed, cluesReady });

  const handleDecide = async () => {
    if (!canDecide || !me?.id) return;
    try {
      await updateClue1(roomId, me.id, text.trim());
      notify({ title: "連想ワードを記録しました", type: "success" });
    } catch (e: any) {
      notify({ title: "記録に失敗しました", description: e?.message, type: "error" });
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
    await submitSortedOrder(roomId, proposal || []);
  };

  const continueRound = async () => {
    await continueAfterFailAction(roomId);
  };

  const resetGame = async () => {
    const { resetRoomToWaiting } = await import("@/lib/firebase/rooms");
    await resetRoomToWaiting(roomId);
  };

  return (
    <HStack gap={6} align="center" justify="space-between" w="100%" position="relative">
      {/* 左: 番号・入力・アクション */}
      <HStack gap={3} align="center" flex="1 1 auto" minW={0}>
        <Box as="span" px={2} py={1} bg="#000" color="#fff" border="1px solid #fff" borderRadius={0} fontWeight={700}
             css={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {typeof me?.number === "number" ? me.number : "??"}
        </Box>
        <Input
          placeholder="連想ワード"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleDecide(); }}
          size="sm"
          maxW={{ base: "360px", md: "520px" }}
          bg="#000"
          color="#fff"
          border="1px solid #fff"
          borderRadius={0}
          _placeholder={{ color: "#bbb" }}
          _focus={{ borderColor: "#6366F1", boxShadow: "none" }}
          _hover={{ borderColor: "#fff" }}
        />
        <AppButton size="md" visual="ghost" palette="gray" onClick={handleDecide} disabled={!canDecide}
          css={{ background: "#000", border: `1px solid ${canDecide ? "#fff" : "#666"}`, color: canDecide ? "#fff" : "#888", borderRadius: 0 }}>
          決定
        </AppButton>
        <AppButton size="md" visual="ghost" palette="gray" onClick={handleSubmit} disabled={!canSubmit}
          css={{ background: "#000", border: `1px solid ${canSubmit ? "#fff" : "#666"}`, color: canSubmit ? "#fff" : "#888", borderRadius: 0 }}>
          出す
        </AppButton>
      </HStack>

      {/* 右: HOST 操作（必要時） */}
      <HStack gap={3} align="center" flex="0 0 auto">
        {isHost && roomStatus === "waiting" && (
          <AppButton size="md" visual="ghost" palette="gray" onClick={quickStart}
            css={{ background: "#000", border: "1px solid #fff", color: "#fff", borderRadius: 0 }}>
            ゲーム開始
          </AppButton>
        )}
        {isHost && isSortSubmit(actualResolveMode) && roomStatus === "clue" && (
          <AppButton size="md" visual="ghost" palette="gray" onClick={evalSorted} disabled={!allSubmitted}
            css={{ background: "#000", border: `1px solid ${allSubmitted ? "#fff" : "#666"}`, color: allSubmitted ? "#fff" : "#888", borderRadius: 0 }}>
            判定
          </AppButton>
        )}
        {isHost && ((roomStatus === "reveal" && !!allowContinueAfterFail) || roomStatus === "finished") && (
          <AppButton size="md" visual="ghost" palette="gray" onClick={roomStatus === "finished" ? resetGame : continueRound}
            css={{ background: "#000", border: "1px solid #fff", color: "#fff", borderRadius: 0 }}>
            もう一度
          </AppButton>
        )}

        <HStack gap={2}>
          {isHost && (
            <>
              <IconButton aria-label="お題シャッフル" onClick={() => topicControls.shuffleTopic(roomId, defaultTopicType as any)} size="xs"
                bg="#000" color="#fff" borderWidth={1} borderColor="#fff" borderRadius={0}>
                <FaRegCreditCard />
              </IconButton>
              <IconButton aria-label="数字配布" onClick={() => topicControls.dealNumbers(roomId)} size="xs"
                bg="#000" color="#fff" borderWidth={1} borderColor="#fff" borderRadius={0}>
                <FaDice />
              </IconButton>
              <IconButton aria-label="リセット" onClick={async () => { const { resetRoomToWaiting } = await import("@/lib/firebase/rooms"); await resetRoomToWaiting(roomId); }} size="xs"
                bg="#000" color="#fff" borderWidth={1} borderColor="#fff" borderRadius={0}>
                <FaRedo />
              </IconButton>
            </>
          )}
          {onOpenSettings && (
            <IconButton aria-label="設定" onClick={onOpenSettings} size="xs" bg="transparent" color="gray.400" borderWidth={0}>
              <FiSettings />
            </IconButton>
          )}
          {onLeaveRoom && (
            <IconButton aria-label="退出" onClick={onLeaveRoom} size="xs" bg="transparent" color="gray.400" borderWidth={0} title="ロビーに戻る">
              <FiLogOut />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}
