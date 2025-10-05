"use client";

import { notify, notifyAsync } from "@/components/ui/notify";
import Tooltip from "@/components/ui/Tooltip";
import { transferHost } from "@/lib/firebase/rooms";
import { Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PartyMemberCard, type PartyMember } from "./PartyMemberCard";

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
const LIST_MAX_HEIGHT = "calc(100vh - 224px)";
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
    const list = [...displayedPlayers];
    list.sort((a, b) => {
      if (displayedHostId) {
        if (a.id === displayedHostId && b.id !== displayedHostId) return -1;
        if (b.id === displayedHostId && a.id !== displayedHostId) return 1;
      }
      return a.orderIndex - b.orderIndex;
    });
    return list;
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

    const result = await notifyAsync(
      () => transferHost(roomId, targetId),
      {
        pending: {
          id: `${roomId}-transfer-${targetId}`,
          title: `${targetName} をホストに設定中…`,
          type: "info",
          duration: 1500,
        },
        success: {
          id: `${roomId}-transfer-${targetId}`,
          title: `${targetName} がホストになりました`,
          type: "success",
          duration: 2000,
        },
        error: {
          id: `${roomId}-transfer-${targetId}`,
          title: "委譲に失敗しました",
          type: "error",
          duration: 3000,
        },
      }
    );

    if (!result) {
      setHostOverride((current) =>
        current && current.targetId === targetId ? null : current
      );
      setTransferTargetId((current) =>
        current === targetId ? null : current
      );
      notify({
        title: "ホスト委譲を元に戻しました",
        description: "ネットワーク状況を確認してもう一度お試しください",
        type: "warning",
        duration: 3200,
      });
    }
    },
    [roomId, transferTargetId, displayedHostId]
  );

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
