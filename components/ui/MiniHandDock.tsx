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
import { handDockStyles } from "@/theme/itoStyles";
import { PREMIUM_COMPONENTS, PREMIUM_TYPOGRAPHY, CARD_MATERIALS } from "@/theme/premiumGameStyles";
import { Box, HStack, Input, IconButton, Text } from "@chakra-ui/react";
import { FiSettings, FiLogOut } from "react-icons/fi";
import React from "react";

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
  const phaseLabel = {
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
      css={{
        // 🔮 ARTIFACT-STYLE MYSTICAL DOCK
        ...PREMIUM_COMPONENTS.MYSTICAL_PANEL,
        padding: "1rem 1.5rem",
        borderRadius: "20px",
        border: "1px solid rgba(168, 85, 247, 0.6)",
        background: `
          linear-gradient(135deg, 
            rgba(139, 92, 246, 0.16) 0%,
            rgba(168, 85, 247, 0.12) 25%,
            rgba(147, 51, 234, 0.14) 50%,
            rgba(109, 40, 217, 0.12) 75%,
            rgba(94, 39, 176, 0.16) 100%
          )
        `,
        boxShadow: `
          0 16px 48px rgba(94, 39, 176, 0.4),
          0 8px 24px rgba(0, 0, 0, 0.6),
          inset 0 2px 0 rgba(168, 85, 247, 0.3),
          inset 0 -2px 0 rgba(67, 56, 202, 0.4)
        `,
        backdropFilter: "blur(28px) saturate(1.4)",
      }}
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
          css={{
            // 🎮 PREMIUM NUMBER BOX
            ...CARD_MATERIALS.PREMIUM_BASE,
            border: "2px solid rgba(255,215,0,0.5)",
            background: `
              linear-gradient(135deg, 
                rgba(255,215,0,0.2) 0%, 
                rgba(184,134,11,0.3) 100%
              )
            `,
            boxShadow: `
              0 4px 16px rgba(0,0,0,0.4),
              inset 0 1px 0 rgba(255,255,255,0.2)
            `,
            color: "#ffd700",
            ...PREMIUM_TYPOGRAPHY.CARD_NUMBER,
            // ドラッグ可能時のホバー効果
            "&:hover": canSubmit ? {
              transform: "translateY(-2px) scale(1.02)",
              boxShadow: `
                0 8px 24px rgba(0,0,0,0.5),
                0 0 20px rgba(255,215,0,0.3)
              `,
            } : {},
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
            // 🎮 PREMIUM CLUE INPUT
            ...CARD_MATERIALS.PREMIUM_BASE,
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.2)",
            color: "#ffffff",
            placeholder: "rgba(255,255,255,0.6)",
            _placeholder: { color: "rgba(255,255,255,0.6)" },
            _focus: {
              borderColor: "rgba(255,215,0,0.8)",
              boxShadow: "0 0 20px rgba(255,215,0,0.3)",
              background: "rgba(255,255,255,0.15)",
            },
            _hover: {
              borderColor: "rgba(255,255,255,0.4)",
            },
            backdropFilter: "blur(8px)",
            ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
          }}
        />

        <AppButton
          size="sm"
          visual="subtle"
          onClick={handleDecide}
          disabled={!canDecide}
          css={{
            // 🎮 PREMIUM BUTTON STYLING
            ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
            color: "#ffd700",
            _hover: { 
              background: "linear-gradient(135deg, rgba(255,215,0,0.3) 0%, rgba(184,134,11,0.4) 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
              _hover: {
                transform: "none",
                background: "initial",
              },
            },
          }}
        >
          確定
        </AppButton>
        <AppButton 
          size="sm" 
          onClick={handleSubmit} 
          disabled={!canSubmit}
          css={{
            // 🎮 PREMIUM SUBMIT BUTTON
            ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
            background: "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(21,128,61,0.3) 100%)",
            border: "1px solid rgba(34,197,94,0.5)",
            color: "#22c55e",
            _hover: { 
              background: "linear-gradient(135deg, rgba(34,197,94,0.3) 0%, rgba(21,128,61,0.4) 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 20px rgba(34,197,94,0.2)",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
              _hover: {
                transform: "none",
                background: "initial",
              },
            },
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
            size="md"
            onClick={quickStart}
            css={{
              // 🎮 PREMIUM START BUTTON
              ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
              background: `
                linear-gradient(135deg, 
                  rgba(59,130,246,0.2) 0%, 
                  rgba(37,99,235,0.4) 50%,
                  rgba(29,78,216,0.3) 100%
                )
              `,
              border: "2px solid rgba(59,130,246,0.6)",
              color: "#60a5fa",
              fontSize: "1rem",
              px: 6,
              py: 3,
              borderRadius: "16px",
              ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
              _hover: {
                background: `
                  linear-gradient(135deg, 
                    rgba(59,130,246,0.3) 0%, 
                    rgba(37,99,235,0.5) 50%,
                    rgba(29,78,216,0.4) 100%
                  )
                `,
                transform: "translateY(-3px) scale(1.05)",
                boxShadow: `
                  0 12px 40px rgba(59,130,246,0.3),
                  0 4px 16px rgba(0,0,0,0.4)
                `,
              },
            }}
          >
            🎮 ゲーム開始
          </AppButton>
        )}

        {isHost && roomStatus === "clue" && isSortSubmit(actualResolveMode) && (
          <AppButton
            size="md"
            onClick={evalSorted}
            disabled={!allSubmitted}
            css={{
              // 🎮 PREMIUM EVALUATE BUTTON
              ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
              background: allSubmitted
                ? `linear-gradient(135deg, 
                    rgba(245,158,11,0.2) 0%, 
                    rgba(217,119,6,0.4) 50%,
                    rgba(180,83,9,0.3) 100%
                  )`
                : "rgba(107,114,128,0.2)",
              border: allSubmitted 
                ? "2px solid rgba(245,158,11,0.6)"
                : "2px solid rgba(107,114,128,0.4)",
              color: allSubmitted ? "#fbbf24" : "#9ca3af",
              fontSize: "1rem",
              px: 6,
              py: 3,
              borderRadius: "16px",
              ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
              _hover: allSubmitted ? {
                background: `
                  linear-gradient(135deg, 
                    rgba(245,158,11,0.3) 0%, 
                    rgba(217,119,6,0.5) 50%,
                    rgba(180,83,9,0.4) 100%
                  )
                `,
                transform: "translateY(-3px) scale(1.05)",
                boxShadow: `
                  0 12px 40px rgba(245,158,11,0.3),
                  0 4px 16px rgba(0,0,0,0.4)
                `,
              } : {},
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
              // 🎮 PREMIUM RETRY BUTTON
              ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
              background: `
                linear-gradient(135deg, 
                  rgba(139,92,246,0.2) 0%, 
                  rgba(124,58,237,0.4) 50%,
                  rgba(109,40,217,0.3) 100%
                )
              `,
              border: "2px solid rgba(139,92,246,0.6)",
              color: "#a78bfa",
              fontSize: "1rem",
              px: 6,
              py: 3,
              borderRadius: "16px",
              ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
              _hover: {
                background: `
                  linear-gradient(135deg, 
                    rgba(139,92,246,0.3) 0%, 
                    rgba(124,58,237,0.5) 50%,
                    rgba(109,40,217,0.4) 100%
                  )
                `,
                transform: "translateY(-3px) scale(1.05)",
                boxShadow: `
                  0 12px 40px rgba(139,92,246,0.3),
                  0 4px 16px rgba(0,0,0,0.4)
                `,
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
          <HStack gap={2} align="center" css={{
            // 🎮 HOST DIVIDER PREMIUM STYLING
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              left: "-8px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "2px",
              height: "60%",
              background: "linear-gradient(to bottom, transparent, rgba(160,133,91,0.6), transparent)",
            },
            pl: 3,
          }}>
            {roomStatus === "clue" && (
              <>
                <Box
                  fontSize="xs"
                  fontWeight="600"
                  color="rgba(255,215,0,0.8)"
                  mb="1px"
                  css={{ 
                    textTransform: "uppercase", 
                    ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  }}
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
                      // 🎮 PREMIUM TINY BUTTON
                      ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
                      fontSize: "0.75rem",
                      px: 2,
                      py: 1,
                      minH: "auto",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      _hover: {
                        background: "rgba(255,255,255,0.1)",
                        transform: "translateY(-1px)",
                        color: "#ffffff",
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
                      // 🎮 PREMIUM TINY BUTTON
                      ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
                      fontSize: "0.75rem",
                      px: 2,
                      py: 1,
                      minH: "auto",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      _hover: {
                        background: "rgba(255,255,255,0.1)",
                        transform: "translateY(-1px)",
                        color: "#ffffff",
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
                      // 🎮 PREMIUM DANGER BUTTON
                      ...PREMIUM_COMPONENTS.ARTIFACT_BUTTON,
                      fontSize: "0.75rem",
                      px: 2,
                      py: 1,
                      minH: "auto",
                      color: "rgba(239,68,68,0.8)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      _hover: {
                        background: "rgba(239,68,68,0.1)",
                        transform: "translateY(-1px)",
                        color: "#f87171",
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
              borderRadius="6px"
              fontSize="xs"
              fontWeight="500"
              css={{
                // 🎮 MODE BADGE PREMIUM STYLING
                background: isSortSubmit(actualResolveMode)
                  ? "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(21,128,61,0.3) 100%)"
                  : "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.3) 100%)",
                border: isSortSubmit(actualResolveMode)
                  ? "1px solid rgba(34,197,94,0.5)"
                  : "1px solid rgba(59,130,246,0.5)",
                color: isSortSubmit(actualResolveMode) ? "#22c55e" : "#60a5fa",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
              }}
            >
              {isSortSubmit(actualResolveMode) ? "一括" : "順次"}
            </Box>
          </HStack>
        )}

        {/* ルーム情報: UI表示は削除、内部システムは保持 
            将来的には他の場所（ヘッダーやデバッグパネルなど）で使用可能 */}

        {/* 設定・退室ボタン */}
        <HStack gap={1} align="center">
          {onOpenSettings && (
            <IconButton
              aria-label="設定"
              onClick={onOpenSettings}
              size="sm"
              variant="ghost"
              css={{
                // 🎮 PREMIUM ICON BUTTON
                color: "rgba(255,255,255,0.7)",
                _hover: { 
                  background: "rgba(255,255,255,0.1)", 
                  color: "#ffffff",
                  transform: "translateY(-1px)",
                },
                borderRadius: "8px",
                transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            >
              <FiSettings />
            </IconButton>
          )}
          {onLeaveRoom && (
            <IconButton
              aria-label="ルームを退出"
              onClick={onLeaveRoom}
              size="sm"
              variant="ghost"
              title="メインメニューに戻る"
              css={{
                // 🎮 PREMIUM LOGOUT BUTTON
                color: "rgba(239,68,68,0.7)",
                _hover: { 
                  background: "rgba(239,68,68,0.1)", 
                  color: "#f87171",
                  transform: "translateY(-1px)",
                },
                borderRadius: "8px",
                transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            >
              <FiLogOut />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}