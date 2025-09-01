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
// LEGACY PREMIUM (to be refactored): premiumGameStyles 依存を今後 surface/accent トークン + recipe 化予定
// PREMIUM_* 依存除去中: 旧ゴールド/パープル装飾を semantic tokens ベースのフラット/マットスタイルへ移行
// import { PREMIUM_COMPONENTS, PREMIUM_TYPOGRAPHY, CARD_MATERIALS } from "@/theme/premiumGameStyles";
import { Box, HStack, IconButton, Input } from "@chakra-ui/react";
import React from "react";
import { FiLogOut, FiSettings } from "react-icons/fi";

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
  // ヘッダー統合機能
  roomName?: string;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>;
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
  // ヘッダー統合機能
  roomName = "",
  onOpenSettings,
  onLeaveRoom,
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

  // フェーズ表示ラベル（ヘッダー統合）
  const phaseLabel =
    {
      waiting: "待機",
      clue: "入力",
      playing: "並べ替え",
      reveal: "公開",
      finished: "結果",
    }[roomStatus as string] || "準備中";

  return (
    <HStack
      gap={4}
      align="center"
      justify="space-between"
      w="100%"
      position="relative"
      px={6}
      py={3}
      borderRadius="18px"
      bg="surfaceOverlay"
      border="1px solid"
      borderColor="borderSubtle"
      boxShadow="0 4px 16px rgba(0,0,0,0.4)"
    >
      {/* 左側: プレイヤーアクション（最優先） */}
      <HStack gap={3} align="center" flex="0 0 auto">
        <Box
          minW="60px"
          h="44px"
          px={3}
          borderRadius="10px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontWeight={700}
          fontSize="lg"
          cursor={canSubmit ? "grab" : "pointer"}
          draggable={canSubmit}
          onDragStart={(e) => {
            if (canSubmit && me?.id) {
              e.dataTransfer.setData("text/plain", me.id);
              e.currentTarget.style.cursor = "grabbing";
            }
          }}
          onDragEnd={(e) => {
            e.currentTarget.style.cursor = canSubmit ? "grab" : "pointer";
          }}
          bg={canSubmit ? "accentSubtle" : "surfaceSubtle"}
          border="1px solid"
          borderColor={canSubmit ? "borderAccent" : "borderSubtle"}
          color={canSubmit ? "accent" : "fgMuted"}
          transition="all .18s"
          _hover={
            canSubmit
              ? { bg: "accentSubtle", transform: "translateY(-2px)" }
              : {}
          }
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
          bg="surfaceRaised"
          border="1px solid"
          borderColor="borderSubtle"
          color="fgDefault"
          _placeholder={{ color: "fgMuted" }}
          _focus={{
            borderColor: "accent",
            boxShadow: "0 0 0 1px var(--chakra-colors-accent)",
          }}
          _hover={{ borderColor: "borderDefault" }}
          fontWeight={500}
        />

        <AppButton
          size="sm"
          visual={canDecide ? "solid" : "subtle"}
          onClick={handleDecide}
          disabled={!canDecide}
          colorScheme={canDecide ? "orange" : undefined}
        >
          確定
        </AppButton>
        <AppButton
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          visual={canSubmit ? "solid" : "subtle"}
          colorScheme={canSubmit ? "orange" : undefined}
        >
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
            visual="solid"
            colorScheme="orange"
            px={6}
            py={3}
          >
            🎮 ゲーム開始
          </AppButton>
        )}

        {isHost && roomStatus === "clue" && isSortSubmit(actualResolveMode) && (
          <AppButton
            size="md"
            onClick={evalSorted}
            disabled={!allSubmitted}
            px={6}
            py={3}
            visual={allSubmitted ? "solid" : "subtle"}
            colorScheme={allSubmitted ? "orange" : undefined}
          >
            {allSubmitted ? "🎯 判定開始" : "⏳ 提出待ち"}
          </AppButton>
        )}

        {isHost && roomStatus === "finished" && (
          <AppButton
            size="md"
            onClick={continueRound}
            px={6}
            py={3}
            visual="solid"
            colorScheme="orange"
          >
            🔄 もう一度
          </AppButton>
        )}
      </Box>

      {/* 右側: ホスト管理機能 + ヘッダー機能統合 */}
      <HStack gap={2} align="center" flex="0 0 auto">
        {/* ホスト管理機能（ホストの場合のみ） */}
        {isHost && (
          <HStack
            gap={2}
            align="center"
            pl={3}
            position="relative"
            _before={{
              content: '""',
              position: "absolute",
              left: "-8px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "1px",
              height: "60%",
              bg: "borderSubtle",
            }}
          >
            {roomStatus === "clue" && (
              <>
                <Box
                  fontSize="xs"
                  fontWeight="600"
                  color="accent"
                  mb="1px"
                  textTransform="uppercase"
                  letterSpacing="0.5px"
                >
                  HOST
                </Box>
                <HStack gap={2}>
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      topicControls.shuffleTopic(
                        roomId,
                        defaultTopicType as any
                      )
                    }
                    colorScheme="orange"
                    fontSize="xs"
                    fontWeight={500}
                    px={3}
                    py={2}
                    borderRadius="lg"
                    letterSpacing="tight"
                  >
                    🎲 お題
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={() => topicControls.dealNumbers(roomId)}
                    colorScheme="orange"
                    fontSize="xs"
                    fontWeight={500}
                    px={3}
                    py={2}
                    borderRadius="lg"
                    letterSpacing="tight"
                  >
                    🔢 数字
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={resetGame}
                    colorScheme="red"
                    fontSize="xs"
                    fontWeight={500}
                    px={3}
                    py={2}
                    borderRadius="lg"
                    letterSpacing="tight"
                  >
                    🔄 リセット
                  </AppButton>
                </HStack>
              </>
            )}

            <Box
              px={3}
              py={2}
              borderRadius="lg"
              fontSize="xs"
              fontWeight={600}
              bg={
                isSortSubmit(actualResolveMode)
                  ? "successSubtle"
                  : "accentSubtle"
              }
              color={isSortSubmit(actualResolveMode) ? "success" : "accent"}
              border="0"
              boxShadow={"0 2px 4px rgba(0,0,0,0.1)"}
              transition="all 0.2s ease"
              _hover={{
                transform: "translateY(-1px)",
                boxShadow: "0 4px 8px rgba(0,0,0,0.15)"
              }}
              letterSpacing="tight"
            >
              {isSortSubmit(actualResolveMode) ? "一括モード" : "順次モード"}
            </Box>
          </HStack>
        )}

        {/* ルーム情報: UI表示は削除、内部システムは保持 
            将来的には他の場所（ヘッダーやデバッグパネルなど）で使用可能 */}

        {/* 設定・退室ボタン */}
        <HStack gap={2} align="center">
          {onOpenSettings && (
            <IconButton
              aria-label="設定"
              onClick={onOpenSettings}
              size="sm"
              variant="outline"
              color="fgMuted"
              _hover={{ 
                bg: "surfaceRaised", 
                color: "accent", 
                borderColor: "accent",
                transform: "translateY(-1px)",
                boxShadow: "0 4px 8px rgba(0,0,0,0.15)"
              }}
              borderRadius="lg"
              borderColor="borderDefault"
              transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <FiSettings />
            </IconButton>
          )}
          {onLeaveRoom && (
            <IconButton
              aria-label="ルームを退出"
              onClick={onLeaveRoom}
              size="sm"
              variant="outline"
              title="メインメニューに戻る"
              color="red.500"
              borderColor="red.200"
              _hover={{ 
                bg: "red.50", 
                color: "red.600",
                borderColor: "red.300",
                transform: "translateY(-1px)",
                boxShadow: "0 4px 8px rgba(239, 68, 68, 0.15)"
              }}
              borderRadius="lg"
              transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <FiLogOut />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}
