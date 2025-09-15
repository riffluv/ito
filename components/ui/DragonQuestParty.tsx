"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import { transferHost } from "@/lib/firebase/rooms";
import { sendSystemMessage } from "@/lib/firebase/chat";

interface PlayerDoc {
  name: string;
  avatar: string;
  number: number | null;
  clue1: string;
  ready: boolean;
  orderIndex: number;
  uid?: string;
}

interface DragonQuestPartyProps {
  players: (PlayerDoc & { id: string })[];
  roomStatus: string;
  onlineCount?: number; // 実際のオンライン参加者数
  onlineUids?: string[]; // オンライン参加者の id 列
  hostId?: string; // ホストのUID
  variant?: "fixed" | "panel"; // panel: サイドレール内に収めて使う
  roomId?: string; // 手動委譲用
  isHostUser?: boolean; // 自分がホストか
  eligibleIds?: string[]; // ラウンド対象（オンライン）
  roundIds?: string[]; // 今ラウンドの全対象（オフライン含む）
}

// ドラクエ風プレイヤー状態表示
const getPlayerStatus = (
  player: PlayerDoc & { id: string },
  roomStatus: string
) => {
  // clueフェーズでの連想ワード入力状況
  if (roomStatus === "clue") {
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "✅", color: "#22c55e", status: "連想完了" };
    } else {
      return { icon: "📝", color: "#fbbf24", status: "考え中" };
    }
  }

  // waitingフェーズでの準備状況
  if (roomStatus === "waiting") {
    return { icon: "🛡️", color: "#94a3b8", status: "待機中" };
  }

  // revealフェーズ（カードめくり中）
  if (roomStatus === "reveal") {
    return { icon: "🎲", color: "#3b82f6", status: "判定中" };
  }

  // finishedフェーズ（結果発表）
  if (roomStatus === "finished") {
    return { icon: "🏆", color: "#f59e0b", status: "結果発表" };
  }

  // フォールバック（通常は到達しない）
  return { icon: "🎲", color: "#3b82f6", status: "参加中" };
};

export function DragonQuestParty({
  players,
  roomStatus,
  onlineCount,
  onlineUids,
  hostId,
  variant = "fixed",
  roomId,
  isHostUser,
  eligibleIds,
  roundIds,
}: DragonQuestPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 表示プレイヤーの決定ロジック（waitingカードと一致させるため eligibleIds を最優先）
  // - 1) roundIds（deal.players ベース、オンライン/オフライン含む）
  // - 2) eligibleIds（オンラインのラウンド対象）
  // - 3) onlineUids
  // - 4) players
  // - hostId は常に含める
  const byId = new Map(players.map((p) => [p.id, p] as const));
  let displayedIds: string[];
  if (Array.isArray(roundIds) && roundIds.length > 0) {
    displayedIds = Array.from(new Set(roundIds));
  } else if (Array.isArray(eligibleIds) && eligibleIds.length > 0) {
    displayedIds = Array.from(new Set(eligibleIds));
  } else if (Array.isArray(onlineUids) && onlineUids.length > 0) {
    displayedIds = Array.from(new Set(onlineUids));
  } else {
    displayedIds = players.map((p) => p.id);
  }
  if (hostId && !displayedIds.includes(hostId)) {
    displayedIds = [hostId, ...displayedIds];
  }
  const displayedPlayers = displayedIds.map((id) =>
    byId.get(id) ||
    ({ id, name: "プレイヤー", avatar: "", number: null, clue1: "", ready: false, orderIndex: 0 } as any)
  );

  // 実際の参加者数は表示対象の長さと一致させる（UIの一貫性を担保）
  const actualCount = displayedPlayers.length;
  const previousCount = useRef(actualCount);

  // メンバー数変化時のアニメーション
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // メンバー数が変わった時
    if (previousCount.current !== actualCount) {
      // from -> to アニメーションを行い、終了時に inline の transform/opacity をクリアして
      // ブラウザ差でスタイルが残る問題を防ぐ
      gsap.fromTo(
        container,
        { scale: 0.9, opacity: 0.7 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: "back.out(1.2)",
          clearProps: "transform,opacity",
        }
      );
    }

    previousCount.current = actualCount;
  }, [actualCount]);

  if (actualCount === 0) return null;

  return (
    <Box
      ref={containerRef}
      position="fixed"
      // 左上アナウンス帯の高さに合わせて、十分なクリアランスを確保
      top={{ base: "112px", md: "128px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={60}
      css={{
        pointerEvents: "none",
        transform: "none",
        opacity: 1,
      }}
    >
      <Box
        bg={UI_TOKENS.COLORS.panelBg}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
        borderRadius={0}
        px={4}
        py={2}
        css={{
          boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          backdropFilter: "blur(8px) saturate(1.1)",
          pointerEvents: "auto",
        }}
      >
        {/* ドラクエ風パーティーヘッダー */}
        <Text
          fontSize={{ base: "xs", md: "sm" }}
          fontWeight={600}
          color="white"
          textShadow="1px 1px 0px #000"
          letterSpacing="0.5px"
          fontFamily="monospace"
          mb={2}
          textAlign="center"
        >
          ▼ なかま ({actualCount}人) ▼
        </Text>

        {/* メンバーリスト - DPIスケール対応の適切な固定幅 */}
        <Box
          display="flex"
          flexDirection="column"
          gap={1}
          w={{ base: "200px", md: "220px" }}
          css={{ pointerEvents: "auto" }}
        >
          {[...displayedPlayers]
            .sort((a, b) => {
              // ホストを最上位に固定し、その後はorderIndexで昇順
              if (hostId) {
                if (a.id === hostId && b.id !== hostId) return -1;
                if (b.id === hostId && a.id !== hostId) return 1;
              }
              return a.orderIndex - b.orderIndex;
            })
            .map((player) => {
              const fresh = displayedPlayers.find((p) => p.id === player.id) || player;
              const { icon, color, status } = getPlayerStatus(
                fresh,
                roomStatus
              );
              const isHost = hostId && player.id === hostId;
              const canTransfer = !!(isHostUser && roomId && player.id !== hostId);
              const onTransfer = async () => {
                if (!canTransfer) return;
                try {
                  await transferHost(roomId!, player.id);
                  notify({ title: `ホストを ${fresh.name} に委譲`, type: "success" });
                  try {
                    await sendSystemMessage(roomId!, `👑 ホストが ${fresh.name} さんに委譲されました`);
                  } catch {}
                } catch (e: any) {
                  notify({ title: "委譲に失敗しました", description: String(e?.message || e), type: "error" });
                }
              };

              return (
                <Box
                  key={player.id}
                  data-player-id={player.id}
                  bg={UI_TOKENS.COLORS.panelBg}
                  border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
                  borderRadius={0}
                  px={2}
                  py={1}
                  w="100%"
                  css={{
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                    // 行の縦幅を一定にする（アイコン差で高さが変わらないよう固定）
                    minHeight: "28px",
                    display: "flex",
                    alignItems: "center",
                    cursor: canTransfer ? "pointer" : "default",
                  }}
                  onDoubleClick={onTransfer}
                >
                  {/* プレイヤー情報 */}
                  <HStack
                    gap={2}
                    align="center"
                    justify="space-between"
                    w="100%"
                  >
                    {/* プレイヤー名 - DPIスケール対応の適切な幅 */}
                    <Text
                      fontSize={{ base: "xs", md: "sm" }}
                      fontWeight={500}
                      color={isHost ? UI_TOKENS.COLORS.accentGold : "white"}
                      textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                      fontFamily="monospace"
                      letterSpacing="0.3px"
                      w={{ base: "160px", md: "170px" }} // レスポンシブ幅
                      truncate
                      title={`${isHost ? "👑 " : "⚔️ "}${fresh.name} - ${status}${canTransfer ? "（ダブルクリックでホスト委譲）" : ""}`}
                      css={
                        isHost
                          ? {
                              animation:
                                "hostGlow 2s ease-in-out infinite alternate",
                              textShadow: UI_TOKENS.TEXT_SHADOWS.heroGold,
                            }
                          : undefined
                      }
                    >
                      {isHost ? "👑 " : "⚔️ "}
                      {fresh.name}
                    </Text>

                    {/* 状態アイコン - 適切な固定幅 */}
                    <Text
                      fontSize={{ base: "sm", md: "md" }}
                      style={{ color }}
                      filter={UI_TOKENS.FILTERS.dropShadowSoft}
                      w="24px"
                      textAlign="center"
                      lineHeight="1"
                      h="18px"
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      {icon}
                    </Text>
                  </HStack>
                </Box>
              );
            })}
        </Box>

        {/* 進行状況サマリー */}
        {roomStatus === "clue" && (
          <Text
            fontSize="xs"
            color={UI_TOKENS.COLORS.textMuted}
            textAlign="center"
            mt={2}
            fontFamily="monospace"
          >
            {
              displayedPlayers.filter((p) => p.clue1 && p.clue1.trim() !== "")
                .length
            }
            /{actualCount} 完了
          </Text>
        )}
      </Box>
    </Box>
  );
}

export default DragonQuestParty;
