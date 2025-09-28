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

const CARD_BACKGROUND =
  "linear-gradient(135deg, rgba(25,35,50,0.9) 0%, rgba(15,25,40,0.9) 100%)";
const CARD_HOVER_BACKGROUND =
  "linear-gradient(135deg, rgba(35,45,65,0.95) 0%, rgba(25,35,55,0.95) 100%)";
const CARD_BOX_SHADOW =
  "0 4px 16px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.15)";
const CARD_HOVER_BOX_SHADOW =
  "0 8px 24px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.25)";
const CARD_FLASH_SHADOW =
  "0 12px 32px rgba(0,0,0,0.9), inset 0 3px 0 rgba(255,255,255,0.3)";
const CLUE_FLASH_BRIGHTNESS = 1.4;
const SUBMIT_FLASH_BRIGHTNESS = 1.8;
const GAUGE_HEIGHT = "10px";
const PANEL_WIDTH = { base: "232px", md: "268px" };
const LIST_MAX_HEIGHT = "calc(100vh - 224px)";
const CARD_HEIGHT = "60px";
const CARD_AVATAR_SIZE = "42px";
const CARD_RADIUS = "6px";
const LIST_GAP = 2;
const CARD_HOVER_LIFT = "-2px";

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
        <Box display="flex" alignItems="center" gap={2} minW={0}>
          <Text fontSize="lg" textShadow="0 2px 4px rgba(0,0,0,0.8)">
            ⚔️
          </Text>
          <Tooltip
            content={displayRoomName || ""}
            openDelay={300}
            disabled={!displayRoomName}
          >
            <Text
              fontSize="md"
              fontWeight="bold"
              color="textPrimary"
              textShadow="0 2px 4px rgba(0,0,0,0.8)"
              letterSpacing="0.5px"
              maxW="196px"
              truncate
            >
              {(displayRoomName && displayRoomName.trim().length > 0
                ? displayRoomName
                : "なかま") + `（${actualCount}）`}
            </Text>
          </Tooltip>
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
            const clueDisplay =
              trimmedClue.length > 0
                ? `「${trimmedClue}」`
                : "連想ワード未入力";
            const gaugeFillWidth = isSubmitted
              ? "100%"
              : hasClue
                ? "60%"
                : "0%";
            const playerNumberValue =
              typeof fresh.number === "number" ? fresh.number : null;
            const revealNumber =
              shouldRevealNumbers && playerNumberValue !== null;
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
            const cardTitle = canTransfer
              ? `${fresh.name}（ダブルクリックでホスト委譲）`
              : fresh.name;

            return (
              <Box
                key={player.id}
                ref={(node: HTMLDivElement | null) =>
                  registerCardRef(player.id, node)
                }
                data-player-id={player.id}
                display="grid"
                gridTemplateColumns="auto 1fr auto"
                columnGap="10px"
                rowGap="4px"
                alignItems="center"
                borderRadius={CARD_RADIUS}
                minH={CARD_HEIGHT}
                border="1px solid"
                borderColor="borderSubtle"
                bg={CARD_BACKGROUND}
                boxShadow="card"
                px="12px"
                py="7px"
                transition="transform 0.2s var(--chakra-easings-stateInOut, cubic-bezier(0.25, 0.46, 0.45, 0.94)), box-shadow 0.2s var(--chakra-easings-stateInOut, cubic-bezier(0.25, 0.46, 0.45, 0.94)), background 0.2s ease"
                css={{
                  cursor: canTransfer ? "pointer" : "default",
                  pointerEvents: "auto",
                  backdropFilter: "blur(6px)",
                  position: "relative",
                  "&::before": {
                    content: "''",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.55) 35%, rgba(255,255,255,0.18) 100%)",
                    pointerEvents: "none",
                  },
                  "&::after": {
                    content: "''",
                    position: "absolute",
                    bottom: -2,
                    left: "4px",
                    right: "4px",
                    height: "3px",
                    background:
                      "linear-gradient(90deg, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.5) 85%)",
                    opacity: 0.75,
                    filter: "blur(0.5px)",
                    pointerEvents: "none",
                  },
                }}
                _hover={hoverStyle}
                _focusWithin={{
                  outline: "2px solid",
                  outlineColor: "focusRing",
                  outlineOffset: "2px",
                }}
                tabIndex={canTransfer ? 0 : undefined}
                role={canTransfer ? "button" : undefined}
                aria-label={
                  canTransfer
                    ? `${fresh.name} にホストを委譲`
                    : `${fresh.name} のステータス`
                }
                title={cardTitle}
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
                        borderRadius: "8px",
                        filter:
                          "drop-shadow(0 4px 8px rgba(0,0,0,0.9)) contrast(1.1)",
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

                <Box
                  display="flex"
                  alignItems="center"
                  gap={2}
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
                  {isHost && (
                    <Text
                      fontSize="sm"
                      color="highlight"
                      textShadow="0 2px 4px rgba(0,0,0,0.9)"
                    >
                      👑
                    </Text>
                  )}
                </Box>

                <Badge
                  justifySelf="end"
                  alignSelf="start"
                  display="inline-flex"
                  alignItems="center"
                  gap="1"
                  bg={toneStyle.badgeBg}
                  border="1px solid"
                  borderColor={toneStyle.badgeBorder}
                  color={toneStyle.badgeColor}
                  fontSize="2xs"
                  fontWeight="semibold"
                  px="6px"
                  py="2px"
                  borderRadius="sm"
                  textTransform="none"
                  letterSpacing="0.3px"
                >
                  <Box as="span" fontSize="xs" lineHeight="1">
                    {statusMeta.icon}
                  </Box>
                  {statusMeta.status}
                </Badge>

                <Box
                  gridColumn="2 / span 2"
                  display="flex"
                  flexDirection="column"
                  gap="4px"
                  minW={0}
                >
                  <Text
                    fontSize="xs"
                    color="textMuted"
                    fontStyle={trimmedClue ? "italic" : "normal"}
                    truncate
                    title={trimmedClue || "連想ワード未入力"}
                  >
                    {clueDisplay}
                  </Text>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      flex={1}
                      h={GAUGE_HEIGHT}
                      minH={GAUGE_HEIGHT}
                      bg="linear-gradient(180deg, rgba(8,12,20,0.95) 0%, rgba(20,30,45,0.95) 100%)"
                      borderRadius="3px"
                      overflow="hidden"
                      border="1px solid"
                      borderColor="rgba(255,255,255,0.18)"
                      position="relative"
                      maxW="156px"
                    >
                      <Box
                        height="100%"
                        width={gaugeFillWidth}
                        bg={
                          isSubmitted
                            ? "linear-gradient(90deg, #22C55E 0%, #16A34A 90%)"
                            : hasClue
                              ? "linear-gradient(90deg, #F59E0B 0%, #D97706 90%)"
                              : "transparent"
                        }
                        transition="all 0.4s ease"
                        position="relative"
                        css={{
                          boxShadow: isSubmitted
                            ? "0 0 6px rgba(34,197,94,0.6)"
                            : hasClue
                              ? "0 0 6px rgba(217,180,74,0.4)"
                              : "none",
                        }}
                      />
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        height="35%"
                        bg="linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 70%, transparent 100%)"
                        pointerEvents="none"
                      />
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

                    <Box
                      minW="32px"
                      h="20px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text
                        fontSize="xs"
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
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default DragonQuestParty;
