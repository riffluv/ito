"use client";

import { Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { notify } from "@/components/ui/notify";
import { transferHost } from "@/lib/firebase/rooms";

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
  submittedPlayerIds?: string[]; // 「提出済み」扱いにするプレイヤーID
  fallbackNames?: Record<string, string>;
}

// ドラクエ風プレイヤー状態表示
const getPlayerStatus = (
  player: PlayerDoc & { id: string },
  roomStatus: string,
  submitted: boolean
) => {
  // clueフェーズでの連想ワード入力状況
  if (roomStatus === "clue") {
    if (submitted) {
      return { icon: "✅", color: "#22c55e", status: "提出済み" };
    }
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "📝", color: "#fbbf24", status: "連想OK" };
    }
    return { icon: "💡", color: "#fbbf24", status: "考え中" };
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

const CARD_BACKGROUND = "linear-gradient(135deg, rgba(25,35,50,0.9) 0%, rgba(15,25,40,0.9) 100%)";
const CARD_HOVER_BACKGROUND = "linear-gradient(135deg, rgba(35,45,65,0.95) 0%, rgba(25,35,55,0.95) 100%)";
const CARD_BOX_SHADOW = "0 4px 16px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.15)";
const CARD_HOVER_BOX_SHADOW = "0 8px 24px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.25)";
const CARD_FLASH_SHADOW = "0 12px 32px rgba(0,0,0,0.9), inset 0 3px 0 rgba(255,255,255,0.3)";
const CLUE_FLASH_BRIGHTNESS = 1.4;
const SUBMIT_FLASH_BRIGHTNESS = 1.8;
const GAUGE_ROW_HEIGHT = "14px";
const GAUGE_HEIGHT = "10px";

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
  submittedPlayerIds,
  fallbackNames,
}: DragonQuestPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerCardRef = useCallback((playerId: string, node: HTMLDivElement | null) => {
    const map = cardRefs.current;
    if (node) {
      map.set(playerId, node);
    } else {
      map.delete(playerId);
    }
  }, []);
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
  const displayedPlayers = displayedIds.map((id) => {
    const existing = byId.get(id);
    if (existing) return existing;
    const fallbackName = fallbackNames?.[id];
    return ({
      id,
      uid: id,
      name: fallbackName ? fallbackName : "プレイヤー",
      avatar: "",
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
    } as any);
  });

  const submittedSet = useMemo(() => {
    if (!Array.isArray(submittedPlayerIds) || submittedPlayerIds.length === 0) {
      return new Set<string>();
    }
    return new Set(submittedPlayerIds);
  }, [submittedPlayerIds?.join(",")]);

  // 実際の参加者数は表示対象の長さと一致させる（UIの一貫性を担保）
  const actualCount = displayedPlayers.length;
  const previousCount = useRef(actualCount);
  const previousSubmitted = useRef<Set<string>>(new Set());
  const previousClues = useRef<Map<string, string>>(new Map());

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

  // 段階1: 連想ワード入力決定時の軽い白フラッシュ
  useEffect(() => {
    displayedPlayers.forEach((player) => {
      const currentClue = player.clue1?.trim() || "";
      const previousClue = previousClues.current.get(player.id) || "";

      if (!previousClue && currentClue) {
        const playerCard = cardRefs.current.get(player.id);

        if (playerCard) {
          gsap
            .timeline({ defaults: { overwrite: "auto" } })
            .to(playerCard, {
              duration: 0.18,
              filter: `brightness(${CLUE_FLASH_BRIGHTNESS})`,
              boxShadow: CARD_FLASH_SHADOW,
              ease: "power2.out",
            })
            .to(playerCard, {
              duration: 0.28,
              filter: "brightness(1)",
              boxShadow: CARD_BOX_SHADOW,
              ease: "power3.out",
              onComplete: () => {
                gsap.set(playerCard, { clearProps: "filter" });
              },
            });
        }
      }

      previousClues.current.set(player.id, currentClue);
    });
  }, [displayedPlayers.map(p => `${p.id}:${p.clue1}`).join(',')]);

  // 段階2: 上のスロット提出時の攻撃エフェクト
  useEffect(() => {
    const newSubmitted = Array.from(submittedSet).filter(
      (id) => !previousSubmitted.current.has(id)
    );

    newSubmitted.forEach((playerId) => {
      const playerCard = cardRefs.current.get(playerId);

      if (playerCard) {
        gsap
          .timeline({ defaults: { overwrite: "auto" } })
          .to(playerCard, {
            duration: 0.05,
            background: "rgba(255,255,255,0.95)",
            boxShadow: CARD_FLASH_SHADOW,
            transform: "scale(1.03)",
            ease: "none",
          })
          .to(playerCard, {
            duration: 0.03,
            background: "rgba(200,220,240,0.8)",
            transform: "scale(0.99)",
            ease: "none",
          })
          .to(playerCard, {
            duration: 0.06,
            background: "rgba(255,245,200,0.9)",
            transform: "scale(1.02)",
            ease: "none",
          })
          .to(playerCard, {
            duration: 0.04,
            background: "rgba(180,200,220,0.7)",
            transform: "scale(0.995)",
            ease: "none",
          })
          .to(playerCard, {
            duration: 0.15,
            background: CARD_BACKGROUND,
            boxShadow: CARD_BOX_SHADOW,
            transform: "scale(1)",
            ease: "power2.out",
            onComplete: () => {
              gsap.set(playerCard, { clearProps: "background,transform" });
            },
          });
      }
    });

    previousSubmitted.current = new Set(submittedSet);
  }, [submittedSet]);

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
        p={4}
        bg="rgba(0,0,0,0.7)"
        borderRadius="8px"
        boxShadow="0 8px 32px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)"
        css={{
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
      >
        {/* パーティーヘッダー */}
        <Box display="flex" alignItems="center" gap={2}>
          <Text fontSize="lg" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">
            ⚔️
          </Text>
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="white"
            textShadow="0 2px 4px rgba(0,0,0,0.8)"
            fontFamily="system-ui"
            letterSpacing="0.5px"
          >
            なかま ({actualCount})
          </Text>
        </Box>

        {/* メンバーリスト */}
        <Box
          display="flex"
          flexDirection="column"
          gap={2}
          w={{ base: "240px", md: "280px" }}
          mt={4}
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
              const isSubmitted = submittedSet.has(player.id);
              const hasClue = !!fresh.clue1?.trim();
              const { icon, color, status } = getPlayerStatus(
                fresh,
                roomStatus,
                isSubmitted
              );
              const isHost = hostId && player.id === hostId;
              const canTransfer = !!(isHostUser && roomId && player.id !== hostId);
              const onTransfer = async () => {
                if (!canTransfer) return;
                try {
                  await transferHost(roomId!, player.id);
                  notify({ title: `ホストを ${fresh.name} に委譲`, type: "success" });
                } catch (e: any) {
                  const raw = String(e?.message || e || "");
                  let description = "ホスト委譲に失敗しました。";
                  if (raw === "not-host") description = "ホストのみが委譲できます。";
                  else if (raw === "target-not-found") description = "対象プレイヤーが見つかりません。";
                  else if (raw === "room-not-found") description = "ルームが存在しません。";
                  notify({ title: "委譲に失敗しました", description, type: "error" });
                }
              };

              return (
                <Box
                  key={player.id}
                  ref={(node: HTMLDivElement | null) => registerCardRef(player.id, node)}
                  data-player-id={player.id}
                  borderRadius="6px"
                  w="100%"
                  h="72px"
                  position="relative"
                  overflow="hidden"
                  boxShadow={CARD_BOX_SHADOW}
                  transition="all 0.2s ease"
                  px="12px"
                  pt="6px"
                  pb="10px"
                  bg={CARD_BACKGROUND}
                  css={{
                    cursor: canTransfer ? "pointer" : "default",
                    backdropFilter: "blur(8px)",
                  }}
                  _hover={{
                    bg: CARD_HOVER_BACKGROUND,
                    transform: "translateY(-2px)",
                    boxShadow: CARD_HOVER_BOX_SHADOW,
                  }}
                  onDoubleClick={onTransfer}
                >
                  {/* 本格RPG風レイアウト - 縦2段構成 */}
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={2}
                  >
                    {/* アバター */}
                    <Box
                      flexShrink={0}
                      width="44px"
                      height="44px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      alignSelf="center"
                      position="relative"
                    >
                      {fresh.avatar?.startsWith('/avatars/') ? (
                        <img
                          src={fresh.avatar}
                          alt="avatar"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '44px',
                            height: '44px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) contrast(1.1)',
                          }}
                        />
                      ) : (
                        <Text
                          fontSize="2xl"
                          filter="drop-shadow(0 4px 8px rgba(0,0,0,0.95))"
                          position="absolute"
                          top="50%"
                          left="50%"
                          transform="translate(-50%, -50%)"
                        >
                          {fresh.avatar || "⚔️"}
                        </Text>
                      )}
                    </Box>

                    {/* プレイヤー情報 - 縦固定レイアウト */}
                    <Box
                      flex={1}
                      minW={0}
                      display="grid"
                      gridTemplateRows="18px 14px 14px"
                      rowGap="5px"
                    >
                      {/* 第1行: 名前 + ホストマーク（固定高さ） */}
                      <Box
                        h="18px"
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        overflow="hidden"
                      >
                        <Text
                          fontSize="md"
                          fontWeight="bold"
                          color={isHost ? "#ffd700" : "white"}
                          textShadow="0 2px 4px rgba(0,0,0,0.9)"
                          fontFamily="system-ui"
                          truncate
                          lineHeight="18px"
                          whiteSpace="nowrap"
                          title={`${isHost ? "ホスト: " : ""}${fresh.name}${canTransfer ? "（ダブルクリックでホスト委譲）" : ""}`}
                        >
                          {fresh.name}
                        </Text>
                        {isHost && (
                          <Text
                            fontSize="sm"
                            color="#ffd700"
                            textShadow="0 2px 4px rgba(0,0,0,0.9)"
                            lineHeight="18px"
                          >
                            👑
                          </Text>
                        )}
                      </Box>

                      {/* 第2行: 連想ワード表示（完全固定高さ） */}
                      <Box
                        h="14px"
                        display="flex"
                        alignItems="center"
                        overflow="hidden"
                      >
                        <Text
                          fontSize="xs"
                          color="rgba(255,255,255,0.6)"
                          fontFamily="system-ui"
                          fontStyle="italic"
                          truncate
                          lineHeight="14px"
                          whiteSpace="nowrap"
                          title={
                            isSubmitted && hasClue
                              ? `連想ワード: ${fresh.clue1.trim()}`
                              : hasClue
                              ? "連想ワード: 未提出"
                              : "連想ワード: 未入力"
                          }
                        >
                          {isSubmitted && hasClue
                            ? `"${fresh.clue1.trim()}"`
                            : hasClue
                            ? "準備中..."
                            : "---"}
                        </Text>
                      </Box>

                      {/* 第3行: 本格RPG風ロングゲージバー */}
                      <Box display="flex" alignItems="flex-end" gap={2} h={GAUGE_ROW_HEIGHT} minH={GAUGE_ROW_HEIGHT}>
                        <Box
                          flex={1}
                          h={GAUGE_HEIGHT}
                          minH={GAUGE_HEIGHT}
                          maxH={GAUGE_HEIGHT}
                          bg="linear-gradient(180deg, rgba(8,12,20,0.95) 0%, rgba(20,30,45,0.95) 100%)"
                          borderRadius="3px"
                          overflow="hidden"
                          border="2px solid rgba(255,255,255,0.18)"
                          position="relative"
                          boxShadow="inset 0 3px 6px rgba(0,0,0,0.9), inset 0 -1px 3px rgba(255,255,255,0.12)"
                          maxW="140px"
                        >
                          <Box
                            height="100%"
                            width={
                              isSubmitted
                                ? "100%"
                                : hasClue
                                ? "60%"
                                : "0%"
                            }
                            bg={isSubmitted
                              ? "linear-gradient(90deg, #10b981 0%, #059669 30%, #047857 70%, #065f46 100%)"
                              : hasClue
                              ? "linear-gradient(90deg, #f59e0b 0%, #d97706 30%, #b45309 70%, #92400e 100%)"
                              : "transparent"
                            }
                            transition="all 0.5s ease"
                            position="relative"
                            css={{
                              boxShadow: "0 0 4px currentColor",
                            }}
                          />
                          {/* 上部ハイライト - より強く */}
                          <Box
                            position="absolute"
                            top="0"
                            left="0"
                            right="0"
                            height="35%"
                            bg="linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.15) 70%, transparent 100%)"
                            pointerEvents="none"
                            borderRadius="3px 3px 0 0"
                          />
                          {/* 底面シャドウ */}
                          <Box
                            position="absolute"
                            bottom="0"
                            left="0"
                            right="0"
                            height="2px"
                            bg="rgba(0,0,0,0.6)"
                            pointerEvents="none"
                          />
                        </Box>

                        {/* ステータステキスト */}
                        <Text
                          fontSize="2xs"
                          color="rgba(255,255,255,0.5)"
                          fontFamily="monospace"
                          fontWeight="bold"
                          minW="20px"
                          textAlign="center"
                          lineHeight={GAUGE_HEIGHT}
                        >
                          {isSubmitted ? "✓" : hasClue ? "•" : ""}
                        </Text>
                      </Box>
                    </Box>
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
