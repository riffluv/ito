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
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
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

  // sanitize: Firestore 未設定時には sort-submit を既定値とする
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
      gap={6}
      align="center"
      justify="space-between"
      w="100%"
      position="relative"
      css={{
        padding: "20px 32px",
        background: "rgba(18,19,23,0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        boxShadow:
          "0 8px 32px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",

        // === SOPHISTICATED VISUAL ACCENT ===
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "80px",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
          borderRadius: "1px",
        },
      }}
    >
      {/* 左側: プレイヤーアクション（最優先） */}
      <HStack gap={3} align="center" flex="0 0 auto">
        {/* 🎯 PREMIUM NUMBER DISPLAY - Sophisticated Card Number */}
        <Box
          css={{
            minWidth: "64px",
            height: "48px",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            // === REFINED TYPOGRAPHY ===
            fontWeight: 700,
            fontSize: "1.25rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            letterSpacing: "-0.02em",

            // === SOPHISTICATED STYLING ===
            background: canSubmit
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.03)",
            border: `1.5px solid ${canSubmit ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: "12px",
            color: canSubmit
              ? "rgba(255,255,255,0.95)"
              : "rgba(255,255,255,0.5)",

            // === PREMIUM INTERACTION ===
            cursor: canSubmit ? "grab" : "default",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",

            // === SUBTLE VISUAL EFFECTS ===
            boxShadow: canSubmit
              ? "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
              : "0 1px 3px rgba(0,0,0,0.1)",

            "&:hover": canSubmit
              ? {
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.2)",
                  transform: "translateY(-2px)",
                  boxShadow:
                    "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
                }
              : {},

            "&:active": canSubmit
              ? {
                  transform: "translateY(0) scale(0.98)",
                }
              : {},
          }}
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
        >
          {typeof me?.number === "number" ? me.number : "?"}
        </Box>

        {/* 🎯 REFINED INPUT FIELD - Sophisticated Text Entry */}
        <Input
          placeholder="連想ワード"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDecide();
          }}
          css={{
            width: { base: "180px", md: "240px" },
            height: "48px",
            padding: "0 16px",

            // === SOPHISTICATED STYLING ===
            background: "rgba(255,255,255,0.04)",
            border: "1.5px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",

            // === REFINED TYPOGRAPHY ===
            fontSize: "0.9375rem",
            fontWeight: 500,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "-0.01em",

            // === PREMIUM INTERACTION ===
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",

            "&::placeholder": {
              color: "rgba(255,255,255,0.5)",
              fontWeight: 400,
            },

            "&:focus": {
              background: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.2)",
              boxShadow: "0 0 0 3px rgba(255,255,255,0.08)",
              outline: "none",
            },

            "&:hover:not(:focus)": {
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.12)",
            },
          }}
        />

        <AppButton
          size="md"
          visual={canDecide ? "solid" : "ghost"}
          palette={canDecide ? "brand" : "gray"}
          onClick={handleDecide}
          disabled={!canDecide}
          css={{
            height: "48px",
            padding: "0 20px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "0.875rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            letterSpacing: "-0.01em",
            background: canDecide
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${canDecide ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
            color: canDecide
              ? "rgba(255,255,255,0.95)"
              : "rgba(255,255,255,0.5)",
            boxShadow: canDecide
              ? "0 2px 8px rgba(0,0,0,0.1)"
              : "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": canDecide
              ? {
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.2)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }
              : {},
          }}
        >
          確定
        </AppButton>
        <AppButton
          size="md"
          visual={canSubmit ? "solid" : "ghost"}
          palette={canSubmit ? "brand" : "gray"}
          onClick={handleSubmit}
          disabled={!canSubmit}
          css={{
            height: "48px",
            padding: "0 20px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "0.875rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            letterSpacing: "-0.01em",
            background: canSubmit
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${canSubmit ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
            color: canSubmit
              ? "rgba(255,255,255,0.95)"
              : "rgba(255,255,255,0.5)",
            boxShadow: canSubmit
              ? "0 2px 8px rgba(0,0,0,0.1)"
              : "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": canSubmit
              ? {
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.2)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }
              : {},
          }}
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
            size="lg"
            onClick={quickStart}
            visual="solid"
            palette="brand"
            css={{
              height: "52px",
              padding: "0 32px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "1rem",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: "-0.01em",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.95)",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.25)",
                transform: "translateY(-2px)",
                boxShadow:
                  "0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              },
            }}
          >
            🎮 ゲーム開始
          </AppButton>
        )}

        {isHost && roomStatus === "clue" && isSortSubmit(actualResolveMode) && (
          <AppButton
            size="lg"
            onClick={evalSorted}
            disabled={!allSubmitted}
            visual={allSubmitted ? "solid" : "surface"}
            palette={allSubmitted ? "brand" : "gray"}
            css={{
              height: "52px",
              padding: "0 32px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "1rem",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: "-0.01em",
              background: allSubmitted
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${allSubmitted ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
              color: allSubmitted
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.5)",
              boxShadow: allSubmitted
                ? "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "0 1px 3px rgba(0,0,0,0.1)",
              backdropFilter: "blur(8px)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": allSubmitted
                ? {
                    background: "rgba(255,255,255,0.12)",
                    borderColor: "rgba(255,255,255,0.25)",
                    transform: "translateY(-2px)",
                    boxShadow:
                      "0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }
                : {},
            }}
          >
            {allSubmitted ? "🎯 判定開始" : "⏳ 提出待ち"}
          </AppButton>
        )}

        {isHost && roomStatus === "finished" && (
          <AppButton
            size="lg"
            onClick={continueRound}
            visual="solid"
            palette="brand"
            css={{
              height: "52px",
              padding: "0 32px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "1rem",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: "-0.01em",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.95)",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.25)",
                transform: "translateY(-2px)",
                boxShadow:
                  "0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              },
            }}
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
            gap={4}
            align="center"
            position="relative"
            css={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              backdropFilter: "blur(4px)",
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
                  <IconButton
                    aria-label="お題をシャッフル"
                    onClick={() =>
                      topicControls.shuffleTopic(
                        roomId,
                        defaultTopicType as any
                      )
                    }
                    size="sm"
                    bg="accentSubtle"
                    borderWidth={0}
                    color="accent"
                    borderRadius="md"
                    p={2}
                    minW={0}
                    width="auto"
                    height="auto"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ transform: "scale(1.05)" }}
                    _active={{ transform: "scale(0.98)" }}
                    transition="all 0.12s ease"
                    css={{ fontSize: "20px" }}
                  >
                    <FaRegCreditCard />
                  </IconButton>

                  <IconButton
                    aria-label="数字をシャッフル"
                    onClick={() => topicControls.dealNumbers(roomId)}
                    size="sm"
                    bg="accentSubtle"
                    borderWidth={0}
                    color="accent"
                    borderRadius="md"
                    p={2}
                    minW={0}
                    width="auto"
                    height="auto"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ transform: "scale(1.05)" }}
                    _active={{ transform: "scale(0.98)" }}
                    transition="all 0.12s ease"
                    css={{ fontSize: "20px" }}
                  >
                    <FaDice />
                  </IconButton>

                  <IconButton
                    aria-label="ゲームをリセット"
                    onClick={resetGame}
                    size="sm"
                    bg="accentSubtle"
                    borderWidth={0}
                    color="accent"
                    borderRadius="md"
                    p={2}
                    minW={0}
                    width="auto"
                    height="auto"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ transform: "scale(1.05)" }}
                    _active={{ transform: "scale(0.98)" }}
                    transition="all 0.12s ease"
                    css={{ fontSize: "20px" }}
                  >
                    <FaRedo />
                  </IconButton>
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
                boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
              }}
              letterSpacing="tight"
            >
              一括モード
            </Box>
          </HStack>
        )}

        {/* ルーム情報: UI表示は削除、内部システムは保持 
            将来的には他の場所（ヘッダーやデバッグパネルなど）で使用可能 */}

        {/* 設定・退室ボタン */}
        <HStack gap={4} align="center">
          {onOpenSettings && (
            <IconButton
              aria-label="設定"
              onClick={onOpenSettings}
              size="sm"
              bg="transparent"
              color="gray.400"
              borderWidth="0"
              p={1}
              minW={0}
              width="auto"
              height="auto"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              fontSize="16px"
              _hover={{
                color: "white",
                transform: "scale(1.1)",
              }}
              _active={{
                transform: "scale(0.95)",
              }}
              transition="all 0.15s ease"
            >
              <FiSettings />
            </IconButton>
          )}
          {onLeaveRoom && (
            <IconButton
              aria-label="ルームを退出"
              onClick={onLeaveRoom}
              size="sm"
              title="メインメニューに戻る"
              bg="transparent"
              color="gray.400"
              borderWidth="0"
              p={1}
              minW={0}
              width="auto"
              height="auto"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              fontSize="16px"
              _hover={{
                color: "red.400",
                transform: "scale(1.1)",
              }}
              _active={{
                transform: "scale(0.95)",
              }}
              transition="all 0.15s ease"
            >
              <FiLogOut />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}
