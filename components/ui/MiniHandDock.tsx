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
      // ✅ ドラクエ風デザイン統一（他の要素と同じ太い白枠 - より際立つ）
      bg="rgba(8,9,15,0.9)"
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      boxShadow="inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)"
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: "-3px",
        left: "-3px",
        right: "-3px",
        bottom: "-3px",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 0,
        pointerEvents: "none",
      }}
    >
      {/* 左: 入力・アクション */}
      <HStack gap={3} align="center" minW={0} gridArea="left">
        <Input
          placeholder="連想ワード"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDecide();
          }}
          size="sm"
          maxW={{ base: "100%", md: "520px" }}
          bg="rgba(8,9,15,0.85)"
          color="white"
          border="2px solid rgba(255,255,255,0.6)"
          borderRadius={6}
          boxShadow="inset 0 2px 0 rgba(0,0,0,0.4), inset 0 -2px 0 rgba(255,255,255,0.1), 0 2px 0 rgba(0,0,0,0.2)"
          _placeholder={{ color: "rgba(255,255,255,0.5)" }}
          _focus={{
            borderColor: "#4a9eff",
            boxShadow:
              "inset 0 2px 0 rgba(0,0,0,0.4), inset 0 -2px 0 rgba(74,158,255,0.2), 0 0 0 2px rgba(74,158,255,0.3)",
            bg: "rgba(8,9,15,0.9)",
          }}
          _hover={{
            borderColor: "rgba(255,255,255,0.8)",
            bg: "rgba(8,9,15,0.9)",
          }}
        />
        <AppButton
          size="md"
          visual="solid"
          palette="brand"
          onClick={handleDecide}
          disabled={!canDecide}
        >
          決定
        </AppButton>
        <AppButton
          size="md"
          visual="solid"
          palette="brand"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          出す
        </AppButton>
      </HStack>

      {/* 中央: ヒーロー番号（ドラクエ風） */}
      <Box gridArea="center" display="flex" justifyContent="center">
        <Box
          w="4ch"
          minW="4ch"
          h="60px" // 固定高さで常に同じサイズ
          minH="60px"
          textAlign="center"
          display="flex"
          alignItems="center"
          justifyContent="center"
          px={3}
          bg="rgba(8,9,15,0.9)"
          color="white"
          border="3px solid rgba(255,255,255,0.9)"
          borderRadius={8}
          fontWeight={800}
          fontSize={
            typeof me?.number === "number" && String(me.number).length >= 3
              ? { base: "34px", md: "42px" } // 3桁数字（100対応）- 視認性向上
              : { base: "36px", md: "44px" } // 1-2桁数字
          }
          lineHeight={1}
          whiteSpace="nowrap"
          boxShadow="inset 0 3px 0 rgba(255,255,255,0.15), inset 0 -3px 0 rgba(0,0,0,0.4), 0 4px 0 rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)"
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
            letterSpacing:
              typeof me?.number === "number" && String(me.number).length >= 3
                ? "-0.1em"
                : "normal",
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
            visual="solid"
            onClick={quickStart}
            bg="linear-gradient(135deg, rgba(16,112,48,0.95), rgba(8,80,32,0.98))" // ドラクエ風緑グラデーション（冒険の始まり）
            color="white"
            border="3px solid rgba(255,255,255,0.95)" // 太いドラクエ風ボーダー
            borderRadius={0}
            fontWeight="700"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            boxShadow="inset 0 2px 0 rgba(255,223,0,0.2), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)"
            _hover={{
              bg: "linear-gradient(135deg, rgba(32,148,64,0.98), rgba(16,112,48,1))", // ホバー時より明るい緑
              color: "rgba(255,255,255,0.95)",
              textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
              borderColor: "rgba(255,255,255,1)",
              transform: "translateY(-1px)", // 軽いリフトアップ
            }}
            _active={{
              bg: "linear-gradient(135deg, rgba(8,80,32,1), rgba(4,64,24,1))", // クリック時はより暗い緑
              color: "rgba(255,255,255,0.9)",
              boxShadow: "inset 0 4px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
              transform: "translateY(0)", // 元の位置に戻る
            }}
            _disabled={{
              bg: "rgba(60,60,60,0.9)",
              color: "rgba(255,255,255,0.4)",
              borderColor: "rgba(120,120,120,0.5)",
              cursor: "not-allowed",
              textShadow: "1px 1px 0px #000",
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
            bg="linear-gradient(135deg, rgba(48,16,112,0.95), rgba(32,8,80,0.98))" // ドラクエ風紫グラデーション
            color="white"
            border="3px solid rgba(255,255,255,0.95)" // 太いドラクエ風ボーダー
            borderRadius={0}
            fontWeight="700"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            boxShadow="inset 0 2px 0 rgba(255,223,0,0.2), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)"
            _hover={{
              bg: "linear-gradient(135deg, rgba(64,32,148,0.98), rgba(48,16,112,1))", // ホバー時より明るい紫
              color: "rgba(255,255,255,0.95)",
              textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
              borderColor: "rgba(255,255,255,1)",
              transform: "translateY(-1px)", // 軽いリフトアップ
            }}
            _active={{
              bg: "linear-gradient(135deg, rgba(32,8,80,1), rgba(24,4,64,1))", // クリック時はより暗い紫
              color: "rgba(255,255,255,0.9)",
              boxShadow: "inset 0 4px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
              transform: "translateY(0)", // 元の位置に戻る
            }}
            _disabled={{
              bg: "rgba(60,60,60,0.9)",
              color: "rgba(255,255,255,0.4)",
              borderColor: "rgba(120,120,120,0.5)",
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
              bg="linear-gradient(135deg, rgba(112,48,16,0.95), rgba(80,32,8,0.98))" // ドラクエ風オレンジ系グラデーション
              color="white"
              border="3px solid rgba(255,255,255,0.95)" // 太いドラクエ風ボーダー
              borderRadius={0}
              fontWeight="700"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              boxShadow="inset 0 2px 0 rgba(255,223,0,0.2), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)"
              _hover={{
                bg: "linear-gradient(135deg, rgba(148,64,32,0.98), rgba(112,48,16,1))", // ホバー時より明るいオレンジ
                color: "rgba(255,255,255,0.95)",
                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                borderColor: "rgba(255,255,255,1)",
                transform: "translateY(-1px)", // 軽いリフトアップ
              }}
              _active={{
                bg: "linear-gradient(135deg, rgba(80,32,8,1), rgba(64,24,4,1))", // クリック時はより暗いオレンジ
                color: "rgba(255,255,255,0.9)",
                boxShadow: "inset 0 4px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
                transform: "translateY(0)", // 元の位置に戻る
              }}
              _disabled={{
                bg: "rgba(60,60,60,0.9)",
                color: "rgba(255,255,255,0.4)",
                borderColor: "rgba(120,120,120,0.5)",
                cursor: "not-allowed",
                textShadow: "1px 1px 0px #000",
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
