"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
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
      // 左側配置（チャット被り回避）
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
        css={{
          background: "rgba(8,9,15,0.9)",
          border: "3px solid rgba(255,255,255,0.9)",
          borderRadius: 0,
          padding: "8px",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
          pointerEvents: "auto",
        }}
      >
        {/* オクトパス風パーティーヘッダー */}
        <Box
          bg="rgba(0, 0, 0, 0.6)"
          border={`1px solid rgba(255,255,255,0.2)`}
          px={2}
          py={1}
          mb={2}
          css={{
            borderRadius: 0,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <Text
            fontSize={{ base: "sm", md: "md" }}
            fontWeight={600}
            color="white"
            textShadow="1px 1px 0px rgba(0,0,0,0.8)"
            letterSpacing="0.3px"
            fontFamily="monospace"
            textAlign="left"
            pl={1}
          >
            PARTY ({actualCount})
          </Text>
        </Box>

        {/* 極限コンパクト メンバーリスト */}
        <Box
          display="flex"
          flexDirection="column"
          gap={0.25}
          w={{ base: "240px", md: "280px" }}
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
                  bg="rgba(20, 23, 34, 0.8)"
                  borderRadius={0}
                  px={2}
                  py={0.25}
                  w="100%"
                  position="relative"
                  css={{
                    boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                    cursor: canTransfer ? "pointer" : "default",
                    border: isHost ? "1px solid rgba(255, 215, 0, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                  }}
                  onDoubleClick={onTransfer}
                >
                  {/* アバター + 情報レイアウト */}
                  <Box display="flex" alignItems="center" gap={2}>
                    {/* アバター表示エリア */}
                    <Box
                      flexShrink={0}
                      width="32px"
                      height="32px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="lg"
                    >
                      {fresh.avatar?.startsWith('/avatars/') ? (
                        <img
                          src={fresh.avatar}
                          alt="avatar"
                          width="32"
                          height="32"
                          style={{
                            objectFit: 'cover',
                            borderRadius: '4px',
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'
                          }}
                        />
                      ) : (
                        <Text
                          fontSize="xl"
                          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                        >
                          {fresh.avatar || "⚔️"}
                        </Text>
                      )}
                    </Box>

                    {/* プレイヤー情報 */}
                    <Box display="flex" flexDirection="column" gap={0} flex={1} minW={0}>
                      {/* プレイヤー名（強調） */}
                      <Text
                        fontSize={{ base: "lg", md: "xl" }}
                        fontWeight={800}
                        color={isHost ? "#ffd700" : "white"}
                        textShadow={isHost
                          ? "0 0 8px rgba(255, 215, 0, 0.8), 1px 1px 2px rgba(0,0,0,0.8)"
                          : "1px 1px 2px rgba(0,0,0,0.8)"
                        }
                        fontFamily="monospace"
                        letterSpacing="0.4px"
                        truncate
                        title={`${isHost ? "ホスト: " : ""}${fresh.name}${canTransfer ? "（ダブルクリックでホスト委譲）" : ""}`}
                        css={
                          isHost
                            ? {
                                animation: "hostGlow 4s ease-in-out infinite alternate",
                              }
                            : undefined
                        }
                      >
                        {fresh.name}
                      </Text>

                      {/* 連想ワード + 状態表示（1行構成） */}
                      <HStack justify="space-between" align="center" w="100%">
                        <HStack spacing={1} flex={1} minW={0}>
                          <Text
                            fontSize="xs"
                            color="rgba(255, 139, 139, 0.9)"
                            fontFamily="monospace"
                            fontWeight={600}
                            flexShrink={0}
                          >
                            💭
                          </Text>
                          <Text
                            fontSize={{ base: "xs", md: "sm" }}
                            fontWeight={600}
                            color={fresh.clue1?.trim() ? "white" : "rgba(255,255,255,0.4)"}
                            textShadow="1px 1px 0px rgba(0,0,0,0.6)"
                            fontFamily="monospace"
                            truncate
                            flex={1}
                            title={fresh.clue1?.trim() || "未入力"}
                          >
                            {fresh.clue1?.trim() || "---"}
                          </Text>
                        </HStack>

                      </HStack>
                    </Box>
                  </Box>

                  {/* 状態アイコン（右上・位置統一） */}
                  <Box
                    position="absolute"
                    top="4px"
                    right="6px"
                    width="16px"
                    height="16px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    title={status}
                  >
                    {fresh.ready ? (
                      <Box
                        borderRadius="50%"
                        css={{
                          background: "#22c55e",
                          border: "1px solid #16a34a",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Text
                          fontSize="xs"
                          fontWeight={700}
                          color="white"
                          textShadow="0 1px 1px rgba(0,0,0,0.8)"
                        >
                          ✓
                        </Text>
                      </Box>
                    ) : (
                      <Text
                        fontSize="sm"
                        style={{ color }}
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                        textAlign="center"
                        lineHeight="16px"
                      >
                        {icon}
                      </Text>
                    )}
                  </Box>

                </Box>
              );
            })}
        </Box>

      </Box>
    </Box>
  );
}

export default DragonQuestParty;
