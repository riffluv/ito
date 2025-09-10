"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

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
  hostId?: string; // ホストのUID
}

// ドラクエ風プレイヤー状態表示
const getPlayerStatus = (
  player: PlayerDoc & { id: string },
  roomStatus: string
) => {
  // clueフェーズでの連想ワード入力状況
  if (roomStatus === "clue") {
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "◆", color: "#8b5cf6", status: "じゅんび完了" };
    } else {
      return { icon: "◇", color: "#fbbf24", status: "かんがえ中" };
    }
  }

  // waitingフェーズでの準備状況
  if (roomStatus === "waiting") {
    if (player.ready) {
      return { icon: "●", color: "#8b5cf6", status: "参戦準備OK" };
    } else {
      return { icon: "○", color: "#94a3b8", status: "待機中" };
    }
  }

  // その他のフェーズ
  return { icon: "■", color: "#3b82f6", status: "参加中" };
};

export function DragonQuestParty({
  players,
  roomStatus,
  onlineCount,
  hostId,
}: DragonQuestPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 実際の参加者数（オンライン優先、フォールバックは全プレイヤー数）
  const actualCount = onlineCount ?? players.length;
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
      top={{ base: "80px", md: "88px" }} // SimplePhaseDisplayの下
      left={{ base: "20px", md: "24px" }}
      zIndex={49}
      css={{
        pointerEvents: "none",
        // 明示的に変形/不透明度のデフォルトを指定しておくと
        // アニメーションの途中状態が残った場合の見栄えを安定させる
        transform: "none",
        opacity: 1,
      }}
    >
      <Box
        bg="linear-gradient(135deg, rgba(16,64,16,0.95), rgba(8,48,8,0.98))" // ドラクエ風深い森の緑グラデーション
        border="3px solid rgba(255,255,255,0.95)" // 太いドラクエ風ボーダー
        borderRadius={0}
        px={4}
        py={2}
        css={{
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 6px 12px rgba(0,0,0,0.3)",
          backdropFilter: "blur(8px) saturate(1.2)",
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
        >
          {players
            .sort((a, b) => {
              // ホストを最上位に固定し、その後はorderIndexで昇順
              if (hostId) {
                if (a.id === hostId && b.id !== hostId) return -1;
                if (b.id === hostId && a.id !== hostId) return 1;
              }
              return a.orderIndex - b.orderIndex;
            })
            .map((player) => {
              const { icon, color, status } = getPlayerStatus(
                player,
                roomStatus
              );
              const isHost = hostId && player.id === hostId;

              return (
                <Box
                  key={player.id}
                  bg="rgba(16,20,32,0.8)" // より濃い独自色
                  border="1px solid rgba(255,255,255,0.6)"
                  borderRadius={0}
                  px={2}
                  py={1}
                  w="100%"
                  css={{
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.25)",
                  }}
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
                      color={isHost ? "#FFD700" : "white"}
                      textShadow="1px 1px 0px #000"
                      fontFamily="monospace"
                      letterSpacing="0.3px"
                      w={{ base: "160px", md: "170px" }} // レスポンシブ幅
                      truncate
                      title={`${isHost ? "👑 " : "⚔️ "}${player.name} - ${status}`}
                      css={
                        isHost
                          ? {
                              animation:
                                "hostGlow 2s ease-in-out infinite alternate",
                              textShadow:
                                "0 0 8px rgba(255, 215, 0, 0.6), 0 0 16px rgba(255, 215, 0, 0.4), 1px 1px 0px #000",
                            }
                          : undefined
                      }
                    >
                      {isHost ? "👑 " : "⚔️ "}
                      {player.name}
                    </Text>

                    {/* 状態アイコン - 適切な固定幅 */}
                    <Text
                      fontSize={{ base: "sm", md: "md" }}
                      style={{ color }}
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                      w="24px"
                      textAlign="center"
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
            color="rgba(255,255,255,0.7)"
            textAlign="center"
            mt={2}
            fontFamily="monospace"
          >
            {players.filter((p) => p.clue1 && p.clue1.trim() !== "").length}/
            {actualCount} 完了
          </Text>
        )}
      </Box>
    </Box>
  );
}

export default DragonQuestParty;
