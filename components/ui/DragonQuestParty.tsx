"use client";

import { notify, notifyAsync } from "@/components/ui/notify";
import Tooltip from "@/components/ui/Tooltip";
import { transferHost } from "@/lib/firebase/rooms";
import { toastIds } from "@/lib/ui/toastIds";
import { Box, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";

const panelFloat = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-1.5px); }
  100% { transform: translateY(1.2px); }
`;

const headerPulse = keyframes`
  0% { box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08); }
  40% { box-shadow: 0 3px 9px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12); }
  100% { box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08); }
`;

const headerGlint = keyframes`
  0% { transform: translateX(-140%) rotate(9deg); opacity: 0; }
  12% { transform: translateX(20%) rotate(9deg); opacity: 0.35; }
  18% { transform: translateX(80%) rotate(9deg); opacity: 0.12; }
  28% { transform: translateX(140%) rotate(9deg); opacity: 0; }
  100% { transform: translateX(140%) rotate(9deg); opacity: 0; }
`;

import { PartyMemberCard, type PartyMember } from "./PartyMemberCard";
import { UNIFIED_LAYOUT } from "@/theme/layout";

interface DragonQuestPartyProps {
  players: PartyMember[];
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

const PANEL_WIDTH = { base: "232px", md: "268px" };
const PANEL_WIDTH_DPI125 = { base: "220px", md: "252px" };
const LIST_MAX_HEIGHT = "calc(100vh - 224px)";
const LIST_MAX_HEIGHT_DPI125 = "calc(100vh - 200px)";
const LIST_GAP = 2;

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
  const [hostOverride, setHostOverride] = useState<
    { targetId: string; previousId: string | null } | null
  >(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();
  const [ambientPhase, setAmbientPhase] = useState<0 | 1>(0);
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
  const displayedPlayers: PartyMember[] = displayedIds.map((id) => {
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
    } as PartyMember;
  });

  const displayedPlayerMap = useMemo(
    () =>
      new Map(displayedPlayers.map((player) => [player.id, player] as const)),
    [displayedPlayers]
  );

  const displayedHostId = hostOverride?.targetId ?? hostId ?? null;
  const transferInFlight = transferTargetId !== null;
  const effectiveIsHostUser = Boolean(isHostUser && !hostOverride);

  const orderedPlayers = useMemo(() => {
    if (!displayedHostId) {
      return displayedPlayers;
    }
    const hostPlayer = displayedPlayers.find((player) => player.id === displayedHostId);
    if (!hostPlayer) {
      return displayedPlayers;
    }
    return [hostPlayer, ...displayedPlayers.filter((player) => player.id !== displayedHostId)];
  }, [displayedPlayers, displayedHostId]);

  const submittedSet = useMemo(() => {
    if (!Array.isArray(submittedPlayerIds) || submittedPlayerIds.length === 0) {
      return new Set<string>();
    }
    return new Set(submittedPlayerIds);
  }, [submittedPlayerIds?.join(",")]);

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
        { scale: 0.94, opacity: 0.72 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.34,
          ease: "power2.out",
          clearProps: "transform,opacity",
        }
      );
    }

    previousCount.current = actualCount;
  }, [actualCount]);

  useEffect(() => {
    if (!hostOverride) return;
    if (hostId === hostOverride.targetId) {
      setHostOverride(null);
      return;
    }
    if (
      hostId != null &&
      hostId !== hostOverride.previousId &&
      hostId !== hostOverride.targetId
    ) {
      setHostOverride(null);
    }
    if (hostId == null && hostOverride.previousId == null) {
      setHostOverride(null);
    }
  }, [hostId, hostOverride]);

  useEffect(() => {
    if (!transferTargetId) return;
    if (hostId === transferTargetId) {
      setTransferTargetId(null);
    }
  }, [hostId, transferTargetId]);

  const handleHostTransfer = useCallback(
    async (targetId: string, targetName: string) => {
      if (!roomId || transferTargetId !== null) return;
      const previousId = displayedHostId;
      setTransferTargetId(targetId);
      setHostOverride({ targetId, previousId });

    const toastId = toastIds.hostTransfer(roomId, targetId);
    const result = await notifyAsync(
      () => transferHost(roomId, targetId),
      {
        pending: {
          id: toastId,
          title: `${targetName} をホストに設定中…`,
          type: "info",
          duration: 1500,
        },
        success: {
          id: toastId,
          title: `${targetName} がホストになりました`,
          type: "success",
          duration: 2000,
        },
        error: {
          id: toastId,
          title: "委譲に失敗しました",
          type: "error",
          duration: 3000,
        },
      }
    );

    if (result === null) {
      setHostOverride((current) =>
        current && current.targetId === targetId ? null : current
      );
      setTransferTargetId((current) =>
        current === targetId ? null : current
      );
      notify({
        id: toastId,
        title: "ホスト委譲を元に戻しました",
        description: "ネットワーク状況を確認してもう一度お試しください",
        type: "warning",
        duration: 3200,
      });
    }
  },
  [roomId, transferTargetId, displayedHostId]
);

  useEffect(() => {
    if (!prefersReducedMotion) return;
    const id = window.setInterval(
      () => setAmbientPhase((prev) => (prev === 0 ? 1 : 0)),
      2400
    );
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  const enableScroll = orderedPlayers.length > 6;
  const shouldRevealNumbers = roomStatus === "finished";

  if (actualCount === 0) {
    return (
      <Box
        position="fixed"
        top={{ base: "108px", md: "120px" }}
        left={{ base: "20px", md: "24px" }}
        zIndex={60}
        pointerEvents="none"
      />
    );
  }

  const reducedPanelTranslate = prefersReducedMotion
    ? ambientPhase === 1
      ? "-2px"
      : "0px"
    : undefined;
  const headerGlowOpacity = prefersReducedMotion
    ? ambientPhase === 1
      ? 0.36
      : 0.18
    : 0.7;
  const headerGlowShift = prefersReducedMotion
    ? ambientPhase === 1
      ? "translateX(30%) rotate(12deg)"
      : "translateX(-30%) rotate(12deg)"
    : "translateX(-120%) rotate(12deg)";
  const headerBoxShadow = prefersReducedMotion
    ? ambientPhase === 1
      ? "0 3px 9px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)"
      : "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)"
    : "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)";

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "108px", md: "120px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={60}
      css={{
        pointerEvents: "none",
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          top: "96px",
          left: "16px",
        },
      }}
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
        css={{
          pointerEvents: "auto",
          position: "relative",
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            width: PANEL_WIDTH_DPI125.base,
            maxWidth: PANEL_WIDTH_DPI125.base,
            padding: "12px",
            "@media (min-width: 768px)": {
              width: PANEL_WIDTH_DPI125.md,
              maxWidth: PANEL_WIDTH_DPI125.md,
            },
          },
          ...(prefersReducedMotion
            ? {
                transform: `translateY(${reducedPanelTranslate})`,
                transition: "transform 1.3s ease-in-out",
              }
            : {
                animation: `${panelFloat} 7.4s cubic-bezier(0.44, 0.12, 0.34, 0.96) infinite alternate`,
              }),
        }}
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
            boxShadow: headerBoxShadow,
            backdropFilter: "blur(4px)",
            position: "relative",
            overflow: "hidden",
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              paddingLeft: "8px",
              paddingRight: "8px",
              paddingTop: "6px",
              paddingBottom: "6px",
              gap: "6px",
            },
            ...(prefersReducedMotion
              ? {
                  transition:
                    "box-shadow 1.2s ease-in-out, filter 1.2s ease-in-out",
                }
              : {
                  animation: `${headerPulse} 9.8s ease-in-out infinite`,
                }),
            '&::after': {
              content: "''",
              position: "absolute",
              inset: "-40%",
              background:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 60%)",
              transform: headerGlowShift,
              ...(prefersReducedMotion
                ? {
                    transition:
                      "opacity 1.2s ease-in-out, transform 1.2s ease-in-out",
                  }
                : {
                    animation: `${headerGlint} 6.2s cubic-bezier(0.16, 0.84, 0.33, 1) infinite`,
                  }),
              pointerEvents: "none",
              mixBlendMode: "screen",
              opacity: headerGlowOpacity,
            },
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
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                width: "20px",
                height: "20px",
              },
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
              css={{
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  fontSize: "13px",
                  maxWidth: "140px",
                },
              }}
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
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              marginTop: "12px",
              maxHeight: LIST_MAX_HEIGHT_DPI125,
            },
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
            const fresh = (displayedPlayerMap.get(player.id) ?? player) as PartyMember;
            const isSubmitted = submittedSet.has(player.id);
            const isHostCard = displayedHostId === player.id;
            const canTransfer = Boolean(
              roomId &&
                effectiveIsHostUser &&
                player.id !== displayedHostId &&
                !transferInFlight
            );
            const onTransfer = canTransfer
              ? () => handleHostTransfer(player.id, fresh.name)
              : undefined;

            return (
              <PartyMemberCard
                key={player.id}
                player={fresh}
                roomStatus={roomStatus}
                isHost={isHostCard}
                isSubmitted={isSubmitted}
                shouldRevealNumbers={shouldRevealNumbers}
                canTransfer={canTransfer}
                onTransfer={onTransfer}
                isTransferPending={transferTargetId === player.id}
              />
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default DragonQuestParty;
