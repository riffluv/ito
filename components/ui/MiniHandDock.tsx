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
import { setRoomOptions } from "@/lib/firebase/rooms";
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
  const sequentialGate = resolveMode === "sort-submit" ? true : !!cluesReady; // 順次は全員readyで解禁
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
    // status: waiting想定だが安全に実行
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

  return (
    <HStack gap={3} align="center" justify="space-between" w="100%">
      {/* 左: 数字チップ＋入力＋提出 */}
      {/* 自分の数字チップ */}
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

      {/* 連想ワード入力 */}
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

      {/* 確定／出す */}
      <AppButton size="sm" visual="subtle" onClick={handleDecide} disabled={!canDecide}>
        確定
      </AppButton>
      <AppButton size="sm" onClick={handleSubmit} disabled={!canSubmit}>
        出す
      </AppButton>

      {/* 右: ホスト操作（モック同列） */}
      {isHost && (
        <HStack gap={2} ml={{ base: 2, md: 4 }} align="center">
          {roomStatus === "waiting" && (
            <AppButton size="sm" onClick={quickStart}>ゲーム開始</AppButton>
          )}
          {roomStatus === "clue" && (
            <AppButton size="sm" visual="subtle" onClick={() => topicControls.shuffleTopic(roomId, defaultTopicType as any)}>
              お題シャッフル
            </AppButton>
          )}
          {roomStatus === "clue" && (
            <AppButton size="sm" visual="subtle" onClick={() => topicControls.dealNumbers(roomId)}>
              数字配布
            </AppButton>
          )}
          {roomStatus === "clue" && resolveMode === "sort-submit" && (
            <AppButton size="sm" onClick={evalSorted} disabled={!allSubmitted}>
              {allSubmitted ? "せーので判定" : "提出待ち"}
            </AppButton>
          )}
          {roomStatus === "finished" && (
            <AppButton size="sm" onClick={continueRound}>もう一度</AppButton>
          )}

          {/* モード切替（順次/一括） */}
          <HStack gap={1} ml={{ base: 1, md: 2 }}>
            <AppButton
              size="xs"
              visual={resolveMode === "sequential" ? "solid" : "subtle"}
              onClick={() => setRoomOptions(roomId, { allowContinueAfterFail, resolveMode: "sequential", defaultTopicType } as any)}
            >
              順次
            </AppButton>
            <AppButton
              size="xs"
              visual={resolveMode === "sort-submit" ? "solid" : "subtle"}
              onClick={() => setRoomOptions(roomId, { allowContinueAfterFail, resolveMode: "sort-submit", defaultTopicType } as any)}
            >
              一括
            </AppButton>
          </HStack>
        </HStack>
      )}
    </HStack>
  );
}
