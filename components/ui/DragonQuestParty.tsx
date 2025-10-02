"use client";

import { notify } from "@/components/ui/notify";
import Tooltip from "@/components/ui/Tooltip";
import { transferHost } from "@/lib/firebase/rooms";
import { Badge, Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  displayRoomName?: string; // ルーム名表示用
}

type PlayerStatusTone =
  | "submitted"
  | "clue-entered"
  | "clue-pending"
  | "waiting"
  | "reveal"
  | "finished"
  | "default";

// ドラクエ風プレイヤー状態表示
const getPlayerStatus = (
  player: PlayerDoc & { id: string },
  roomStatus: string,
  submitted: boolean
): { icon: string; status: string; tone: PlayerStatusTone } => {
  if (roomStatus === "clue") {
    if (submitted) {
      return { icon: "✅", status: "提出済み", tone: "submitted" };
    }
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "📝", status: "連想OK", tone: "clue-entered" };
    }
    return { icon: "💡", status: "考え中", tone: "clue-pending" };
  }

  if (roomStatus === "waiting") {
    return { icon: "🛡️", status: "待機中", tone: "waiting" };
  }

  if (roomStatus === "reveal") {
    return { icon: "🎲", status: "判定中", tone: "reveal" };
  }

  if (roomStatus === "finished") {
    return { icon: "🏆", status: "結果発表", tone: "finished" };
  }

  return { icon: "🎲", status: "参加中", tone: "default" };
};

// 一流デザイナー風スタイリング: 多層・非対称・質感重視
const CARD_BACKGROUND =
  "linear-gradient(145deg, rgba(18,28,42,0.92) 0%, rgba(12,20,35,0.94) 35%, rgba(8,15,28,0.96) 75%, rgba(5,12,22,0.98) 100%)";
const CARD_HOVER_BACKGROUND =
  "linear-gradient(145deg, rgba(28,38,55,0.96) 0%, rgba(22,32,48,0.97) 35%, rgba(18,28,42,0.98) 75%, rgba(15,25,38,0.99) 100%)";
const CARD_BOX_SHADOW =
  "0 2px 4px rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.8)";
const CARD_HOVER_BOX_SHADOW =
  "0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.6), 0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.9)";
const CARD_FLASH_SHADOW =
  "0 6px 12px rgba(255,255,255,0.3), 0 12px 24px rgba(255,255,255,0.2), 0 18px 36px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.4)";
const CLUE_FLASH_BRIGHTNESS = 1.4;
const SUBMIT_FLASH_BRIGHTNESS = 1.8;
const GAUGE_HEIGHT = "10px";
const PANEL_WIDTH = { base: "232px", md: "268px" };
const LIST_MAX_HEIGHT = "calc(100vh - 224px)";
const CARD_HEIGHT = "56px";
const CARD_AVATAR_SIZE = "44px";
const CARD_RADIUS = "4px";
const LIST_GAP = 2;
const CARD_HOVER_LIFT = "-3px";

const STATUS_STYLE_MAP: Record<
  PlayerStatusTone,
  {
    badgeBg: string;
    badgeBorder: string;
    badgeColor: string;
    iconColor: string;
  }
> = {
  submitted: {
    badgeBg: "successSubtle",
    badgeBorder: "successBorder",
    badgeColor: "successText",
    iconColor: "successText",
  },
  "clue-entered": {
    badgeBg: "accentSubtle",
    badgeBorder: "accentRing",
    badgeColor: "accent",
    iconColor: "accent",
  },
  "clue-pending": {
    badgeBg: "rgba(255,255,255,0.06)",
    badgeBorder: "borderSubtle",
    badgeColor: "textMuted",
    iconColor: "textMuted",
  },
  waiting: {
    badgeBg: "rgba(255,255,255,0.05)",
    badgeBorder: "borderSubtle",
    badgeColor: "textMuted",
    iconColor: "textMuted",
  },
  reveal: {
    badgeBg: "rgba(58,176,255,0.18)",
    badgeBorder: "accentRing",
    badgeColor: "accent",
    iconColor: "accent",
  },
  finished: {
    badgeBg: "rgba(217,180,74,0.18)",
    badgeBorder: "rgba(217,180,74,0.45)",
    badgeColor: "highlight",
    iconColor: "highlight",
  },
  default: {
    badgeBg: "rgba(255,255,255,0.05)",
    badgeBorder: "borderSubtle",
    badgeColor: "textMuted",
    iconColor: "textMuted",
  },
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
  submittedPlayerIds,
  fallbackNames,
  displayRoomName,
}: DragonQuestPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerCardRef = useCallback(
    (playerId: string, node: HTMLDivElement | null) => {
      const map = cardRefs.current;
      if (node) {
        map.set(playerId, node);
      } else {
        map.delete(playerId);
      }
    },
    []
  );
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
    return {
      id,
      uid: id,
      name: fallbackName ? fallbackName : "プレイヤー",
      avatar: "",
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
    } as any;
  });

  const displayedPlayerMap = useMemo(
    () =>
      new Map(displayedPlayers.map((player) => [player.id, player] as const)),
    [displayedPlayers]
  );

  const orderedPlayers = useMemo(() => {
    const list = [...displayedPlayers];
    list.sort((a, b) => {
      if (hostId) {
        if (a.id === hostId && b.id !== hostId) return -1;
        if (b.id === hostId && a.id !== hostId) return 1;
      }
      return a.orderIndex - b.orderIndex;
    });
    return list;
  }, [displayedPlayers, hostId]);

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
  }, [displayedPlayers.map((p) => `${p.id}:${p.clue1}`).join(",")]);

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

  const enableScroll = orderedPlayers.length > 6;
  const shouldRevealNumbers = roomStatus === "finished";

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "108px", md: "120px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={60}
      css={{ pointerEvents: "none" }}
    >
      <Box
        p={4}
        bg="bgPanel"
        border="1px solid"
        borderColor="borderDefault"
        borderRadius="md"
        boxShadow="panel"
        w={PANEL_WIDTH}
        maxW={PANEL_WIDTH}
        css={{ pointerEvents: "auto" }}
      >
        {/* Octopath Traveler-style party header */}
        <Box
          display="flex"
          alignItems="center"
          gap={2}
          minW={0}
          px={2.5}
          py={1.5}
          bg="rgba(12,14,20,0.85)"
          border="1px solid rgba(255,255,255,0.15)"
          borderRadius="2px"
          css={{
            boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            backdropFilter: "blur(4px)",
          }}
        >
          {/* フラッグエンブレム */}
          <Box
            position="relative"
            w="24px"
            h="24px"
            flexShrink={0}
            css={{
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))",
            }}
          >
            <img
              src="/images/flag.webp"
              alt="party emblem"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </Box>

          {/* パーティ名 */}
          <Tooltip
            content={displayRoomName || ""}
            openDelay={300}
            disabled={!displayRoomName}
          >
            <Text
              fontSize="sm"
              fontWeight={600}
              color="rgba(255,255,255,0.95)"
              letterSpacing="0.3px"
              maxW="160px"
              truncate
              textShadow="0 1px 2px rgba(0,0,0,0.6)"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {displayRoomName && displayRoomName.trim().length > 0
                ? displayRoomName
                : "なかま"}
            </Text>
          </Tooltip>

          {/* 人数表示 */}
          <Text
            fontSize="xs"
            color="rgba(255,255,255,0.65)"
            fontWeight={500}
            flexShrink={0}
            fontFamily="monospace"
            letterSpacing="0.5px"
            lineHeight="1"
            alignSelf="center"
          >
            ({actualCount})
          </Text>
        </Box>

        <Box
          mt={4}
          display="flex"
          flexDirection="column"
          gap={LIST_GAP}
          w="100%"
          maxH={LIST_MAX_HEIGHT}
          overflowY={enableScroll ? "auto" : "visible"}
          pr={enableScroll ? 1 : 0}
          css={{
            pointerEvents: "auto",
            scrollbarWidth: enableScroll ? "thin" : undefined,
            scrollbarColor: enableScroll
              ? "var(--chakra-colors-accent) transparent"
              : undefined,
            "&::-webkit-scrollbar": {
              width: enableScroll ? "6px" : "0px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--chakra-colors-accent)",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
          }}
        >
          {orderedPlayers.map((player) => {
            const fresh = displayedPlayerMap.get(player.id) || player;
            const isSubmitted = submittedSet.has(player.id);
            const hasClue = !!fresh.clue1?.trim();
            const statusMeta = getPlayerStatus(fresh, roomStatus, isSubmitted);
            const toneStyle =
              STATUS_STYLE_MAP[statusMeta.tone] ?? STATUS_STYLE_MAP.default;
            const isHost = hostId && player.id === hostId;
            const canTransfer = !!(
              isHostUser &&
              roomId &&
              player.id !== hostId
            );
            const onTransfer = async () => {
              if (!canTransfer) return;
              try {
                await transferHost(roomId!, player.id);
                notify({
                  title: `ホストを ${fresh.name} に委譲`,
                  type: "success",
                });
              } catch (e: any) {
                const raw = String(e?.message || e || "");
                let description = "ホスト委譲に失敗しました。";
                if (raw === "not-host")
                  description = "ホストのみが委譲できます。";
                else if (raw === "target-not-found")
                  description = "対象プレイヤーが見つかりません。";
                else if (raw === "room-not-found")
                  description = "ルームが存在しません。";
                notify({
                  title: "委譲に失敗しました",
                  description,
                  type: "error",
                });
              }
            };
            const handleKeyDown = (
              event: ReactKeyboardEvent<HTMLDivElement>
            ) => {
              if (!canTransfer) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTransfer();
              }
            };
            const trimmedClue = fresh.clue1?.trim() ?? "";
            const gaugeFillWidth = isSubmitted
              ? "100%"
              : hasClue
                ? "60%"
                : "0%";
            const playerNumberValue =
              typeof fresh.number === "number" ? fresh.number : null;
            const revealNumber =
              shouldRevealNumbers && playerNumberValue !== null;
            const clueRevealed = isSubmitted || revealNumber;
            const clueDisplay = clueRevealed
              ? trimmedClue.length > 0
                ? `「${trimmedClue}」`
                : "連想ワード未入力"
              : hasClue
                ? "準備中..."
                : "連想ワード未入力";
            const clueTitle = clueRevealed
              ? trimmedClue || "連想ワード未入力"
              : hasClue
                ? "準備中..."
                : "連想ワード未入力";
            const passiveHoverStyle = {
              bg: CARD_HOVER_BACKGROUND,
              transform: "translateY(-1px)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
            } as const;
            const actionableHoverStyle = {
              bg: CARD_HOVER_BACKGROUND,
              transform: `translateY(${CARD_HOVER_LIFT})`,
              boxShadow: CARD_HOVER_BOX_SHADOW,
            } as const;
            const hoverStyle = canTransfer
              ? actionableHoverStyle
              : passiveHoverStyle;

            const cardContent = (
              <Box
                key={player.id}
                ref={(node: HTMLDivElement | null) =>
                  registerCardRef(player.id, node)
                }
                data-player-id={player.id}
                display="grid"
                gridTemplateColumns="auto 1fr auto"
                columnGap="8px"
                rowGap="2px"
                alignItems="center"
                borderRadius={CARD_RADIUS}
                minH={CARD_HEIGHT}
                border="1px solid"
                borderColor="borderSubtle"
                bg={CARD_BACKGROUND}
                boxShadow="card"
                px="12px"
                py="5px"
                transition="transform 0.2s var(--chakra-easings-stateInOut, cubic-bezier(0.25, 0.46, 0.45, 0.94)), box-shadow 0.2s var(--chakra-easings-stateInOut, cubic-bezier(0.25, 0.46, 0.45, 0.94)), background 0.2s ease"
                css={{
                  cursor: canTransfer ? "pointer" : "default",
                  pointerEvents: "auto",
                  backdropFilter: "blur(8px) saturate(1.2)",
                  position: "relative",
                  // 金属フレーム風の上部ハイライト
                  "&::before": {
                    content: "''",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background:
                      "linear-gradient(90deg, rgba(120,160,200,0.15) 0%, rgba(180,200,220,0.4) 15%, rgba(220,240,255,0.7) 35%, rgba(180,200,220,0.4) 65%, rgba(120,160,200,0.15) 100%)",
                    pointerEvents: "none",
                    filter: "blur(0.5px)",
                  },
                  // 立体感を出す底部シャドウ（強化版）
                  "&::after": {
                    content: "''",
                    position: "absolute",
                    bottom: -3,
                    left: "2px",
                    right: "2px",
                    height: "5px",
                    background:
                      "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.75) 85%, rgba(0,0,0,0.5) 100%)",
                    opacity: 0.9,
                    filter: "blur(1.5px)",
                    pointerEvents: "none",
                  },
                }}
                _hover={hoverStyle}
                _focus={{ outline: "none" }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "focusRing",
                  outlineOffset: "2px",
                  boxShadow: "0 0 0 3px rgba(124, 185, 255, 0.35)",
                }}
                tabIndex={canTransfer ? 0 : undefined}
                role={canTransfer ? "button" : undefined}
                aria-label={
                  canTransfer
                    ? `${fresh.name} にホストを委譲`
                    : `${fresh.name} のステータス`
                }
                onDoubleClick={onTransfer}
                onKeyDown={handleKeyDown}
              >
                <Box
                  gridRow="1 / span 2"
                  w={CARD_AVATAR_SIZE}
                  h={CARD_AVATAR_SIZE}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                  css={{
                    // 六角形風の斜めフレーム（SSRPG感）
                    clipPath: "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
                    "&::before": {
                      content: "''",
                      position: "absolute",
                      inset: "-2px",
                      background: "linear-gradient(135deg, rgba(100,150,220,0.6) 0%, rgba(60,90,140,0.4) 50%, rgba(30,50,80,0.6) 100%)",
                      clipPath: "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
                      zIndex: -1,
                      filter: "blur(1px)",
                    }
                  }}
                >
                  {fresh.avatar?.startsWith("/avatars/") ? (
                    <img
                      src={fresh.avatar}
                      alt="avatar"
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter:
                          "drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 4px 8px rgba(0,0,0,0.6)) contrast(1.15) saturate(1.1)",
                      }}
                    />
                  ) : (
                    <Text
                      fontSize="2xl"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.7))"
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                    >
                      {fresh.avatar || "⚔️"}
                    </Text>
                  )}
                </Box>

                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  minW={0}
                  lineHeight="1"
                >
                  <Text
                    fontSize="md"
                    fontWeight="bold"
                    color={isHost ? "highlight" : "textPrimary"}
                    textShadow="0 2px 4px rgba(0,0,0,0.9)"
                    fontFamily="system-ui"
                    truncate
                    title={`${isHost ? "ホスト: " : ""}${fresh.name}`}
                  >
                    {fresh.name}
                  </Text>
                </Box>

                {/* SSS級RPG風のステータスバッジ */}
                <Box
                  justifySelf="end"
                  alignSelf="start"
                  display="inline-flex"
                  alignItems="center"
                  gap="1"
                  px="7px"
                  py="2px"
                  position="relative"
                  css={{
                    background: `linear-gradient(135deg, ${
                      statusMeta.tone === "submitted"
                        ? "rgba(22, 163, 74, 0.25) 0%, rgba(21, 128, 61, 0.35) 100%"
                        : statusMeta.tone === "clue-entered"
                        ? "rgba(217, 119, 6, 0.25) 0%, rgba(180, 83, 9, 0.35) 100%"
                        : "rgba(60, 60, 80, 0.25) 0%, rgba(40, 40, 60, 0.35) 100%"
                    })`,
                    border: "1px solid",
                    borderColor:
                      statusMeta.tone === "submitted"
                        ? "rgba(34, 197, 94, 0.5)"
                        : statusMeta.tone === "clue-entered"
                        ? "rgba(245, 158, 11, 0.5)"
                        : "rgba(100, 116, 139, 0.4)",
                    borderRadius: "2px",
                    clipPath: "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
                    boxShadow: `
                      0 2px 4px rgba(0, 0, 0, 0.4),
                      inset 0 1px 0 rgba(255, 255, 255, 0.1),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                    `,
                    "&::before": {
                      content: "''",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "1px",
                      background:
                        statusMeta.tone === "submitted"
                          ? "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.8) 50%, transparent 100%)"
                          : statusMeta.tone === "clue-entered"
                          ? "linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.8) 50%, transparent 100%)"
                          : "linear-gradient(90deg, transparent 0%, rgba(150, 160, 180, 0.6) 50%, transparent 100%)",
                      pointerEvents: "none",
                    },
                  }}
                >
                  <Box
                    as="span"
                    fontSize="xs"
                    lineHeight="1"
                    css={{
                      filter:
                        statusMeta.tone === "submitted"
                          ? "drop-shadow(0 0 3px rgba(34, 197, 94, 0.8))"
                          : statusMeta.tone === "clue-entered"
                          ? "drop-shadow(0 0 3px rgba(245, 158, 11, 0.8))"
                          : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))",
                    }}
                  >
                    {statusMeta.icon}
                  </Box>
                  <Text
                    fontSize="2xs"
                    fontWeight="bold"
                    letterSpacing="0.5px"
                    textTransform="uppercase"
                    css={{
                      color:
                        statusMeta.tone === "submitted"
                          ? "#86EFAC"
                          : statusMeta.tone === "clue-entered"
                          ? "#FCD34D"
                          : "#CBD5E1",
                      textShadow:
                        statusMeta.tone === "submitted"
                          ? "0 0 8px rgba(34, 197, 94, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8)"
                          : statusMeta.tone === "clue-entered"
                          ? "0 0 8px rgba(245, 158, 11, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8)"
                          : "0 1px 2px rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    {statusMeta.status}
                  </Text>
                </Box>

                <Box
                  gridColumn="2 / span 2"
                  display="flex"
                  flexDirection="column"
                  gap="2px"
                  minW={0}
                >
                  <Text
                    fontSize="2xs"
                    color="textMuted"
                    fontStyle={
                      clueRevealed && trimmedClue ? "italic" : "normal"
                    }
                    lineHeight="1.1"
                    truncate
                  >
                    {clueDisplay}
                  </Text>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      flex={1}
                      h={GAUGE_HEIGHT}
                      minH={GAUGE_HEIGHT}
                      bg="linear-gradient(180deg, rgba(5,8,15,0.98) 0%, rgba(10,15,25,0.96) 35%, rgba(18,25,38,0.94) 100%)"
                      borderRadius="2px"
                      overflow="hidden"
                      border="1px solid"
                      borderColor="rgba(80,110,150,0.35)"
                      position="relative"
                      maxW="148px"
                      css={{
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.6)"
                      }}
                    >
                      <Box
                        height="100%"
                        width={gaugeFillWidth}
                        bg={
                          isSubmitted
                            ? "linear-gradient(90deg, #16A34A 0%, #22C55E 45%, #15803D 90%)"
                            : hasClue
                              ? "linear-gradient(90deg, #D97706 0%, #F59E0B 45%, #B45309 90%)"
                              : "transparent"
                        }
                        transition="all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
                        position="relative"
                        css={{
                          boxShadow: isSubmitted
                            ? "0 0 8px rgba(34,197,94,0.7), 0 0 16px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.3)"
                            : hasClue
                              ? "0 0 8px rgba(245,158,11,0.6), 0 0 16px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.25)"
                              : "none",
                        }}
                      />
                      {/* クリスタル質感のハイライト */}
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        height="40%"
                        bg="linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 60%, transparent 100%)"
                        pointerEvents="none"
                      />
                      {/* パルス効果（提出時） */}
                      {isSubmitted && (
                        <Box
                          position="absolute"
                          top="0"
                          left="0"
                          right="0"
                          bottom="0"
                          bg="linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)"
                          css={{
                            animation: "pulse-sweep 2s ease-in-out infinite",
                            "@keyframes pulse-sweep": {
                              "0%": { transform: "translateX(-100%)" },
                              "50%": { transform: "translateX(100%)" },
                              "100%": { transform: "translateX(-100%)" }
                            }
                          }}
                          pointerEvents="none"
                        />
                      )}
                      {/* 底部の深み */}
                      <Box
                        position="absolute"
                        bottom="0"
                        left="0"
                        right="0"
                        height="2px"
                        bg="linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.4) 100%)"
                        pointerEvents="none"
                      />
                    </Box>

                    <Box
                      minW="30px"
                      h="18px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text
                        fontSize="2xs"
                        color="highlight"
                        textShadow="0 2px 4px rgba(0,0,0,0.7)"
                        fontFamily="mono"
                        fontWeight="bold"
                        letterSpacing="0.4px"
                        textAlign="center"
                        opacity={revealNumber ? 1 : 0}
                        transition="opacity 0.24s ease"
                        aria-hidden={!revealNumber}
                      >
                        {playerNumberValue !== null ? playerNumberValue : "00"}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              </Box>
            );

            return canTransfer ? (
              <Tooltip
                key={player.id}
                content={`${fresh.name} にホスト権限を譲渡`}
                openDelay={200}
                showArrow
              >
                {cardContent}
              </Tooltip>
            ) : (
              cardContent
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default DragonQuestParty;
