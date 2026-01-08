"use client";

import { notify, notifyAsync } from "@/components/ui/notify";
import { transferHost } from "@/lib/firebase/rooms";
import { toastIds } from "@/lib/ui/toastIds";
import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { gsap } from "gsap";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

const panelFloat = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(calc(-1.5px * var(--dpi-scale))); }
  100% { transform: translateY(calc(1.2px * var(--dpi-scale))); }
`;

import { PartyMemberCard, type PartyMember } from "./PartyMemberCard";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { DragonQuestPartyHeader } from "./dragon-quest-party/DragonQuestPartyHeader";
import {
  areDragonQuestPartyPropsEqual,
  shallowEqualPartyMember,
  type DragonQuestPartyProps,
} from "./dragon-quest-party/dragonQuestPartyComparators";

const PANEL_TOP = { base: scaleForDpi("108px"), md: scaleForDpi("120px") };
const PANEL_LEFT = { base: scaleForDpi("20px"), md: scaleForDpi("24px") };
const PANEL_WIDTH = { base: scaleForDpi("232px"), md: scaleForDpi("268px") };
const LIST_MAX_HEIGHT = `calc(100vh - ${scaleForDpi("224px")})`;
const LIST_GAP = 2;

function DragonQuestParty({
  players,
  roomStatus,
  onlineCount: _onlineCount,
  onlineUids,
  hostId,
  roomId,
  isHostUser,
  eligibleIds,
  roundIds,
  submittedPlayerIds,
  fallbackNames,
  displayRoomName,
  suspendTransientUpdates = false,
}: DragonQuestPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hostOverride, setHostOverride] = useState<
    { targetId: string; previousId: string | null } | null
  >(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();
  const [ambientPhase, setAmbientPhase] = useState<0 | 1>(0);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [enableScroll, setEnableScroll] = useState(false);
  const playerCacheRef = useRef<Map<string, PartyMember>>(new Map());
  const renderStart =
    typeof performance !== "undefined" ? performance.now() : null;

  const lastStablePlayersRef = useRef<PartyMember[]>(players);
  useEffect(() => {
    if (players.length > 0 || !suspendTransientUpdates) {
      lastStablePlayersRef.current = players;
    }
  }, [players, suspendTransientUpdates]);

  const effectivePlayers =
    suspendTransientUpdates && players.length === 0
      ? lastStablePlayersRef.current
      : players;
  const byId = useMemo(
    () => new Map(effectivePlayers.map((p) => [p.id, p] as const)),
    [effectivePlayers]
  );

  const roundIdsKey = Array.isArray(roundIds) ? roundIds.join(",") : "";
  const eligibleIdsKey = Array.isArray(eligibleIds)
    ? eligibleIds.join(",")
    : "";
  const onlineUidsKey = Array.isArray(onlineUids) ? onlineUids.join(",") : "";

  // 表示プレイヤーの決定ロジック（waitingカードと一致させるため eligibleIds を最優先）
  // - 1) roundIds（deal.players ベース、オンライン/オフライン含む）
  // - 2) eligibleIds（オンラインのラウンド対象）
  // - 3) onlineUids
  // - 4) players
  // - hostId は常に含める
  const displayedIds = useMemo(() => {
    let ids: string[];
    if (roundIdsKey) {
      ids = Array.from(new Set(roundIds ?? []));
    } else if (eligibleIdsKey) {
      ids = Array.from(new Set(eligibleIds ?? []));
    } else if (onlineUidsKey) {
      ids = Array.from(new Set(onlineUids ?? []));
    } else {
      ids = effectivePlayers.map((p) => p.id);
    }
    if (hostId && !ids.includes(hostId)) {
      ids = [hostId, ...ids];
    }
    return ids.filter((id) => byId.has(id));
  }, [
    byId,
    effectivePlayers,
    hostId,
    roundIdsKey,
    eligibleIdsKey,
    onlineUidsKey,
    roundIds,
    eligibleIds,
    onlineUids,
  ]);

  const displayedPlayers: PartyMember[] = useMemo(() => {
    const cache = playerCacheRef.current;
    const nextCache = new Map<string, PartyMember>();
    const result = displayedIds.map((id) => {
      const existing = byId.get(id);
      const fallbackName = fallbackNames?.[id];
      const candidate: PartyMember =
        existing ??
        {
          id,
          uid: id,
          name: fallbackName ? fallbackName : "プレイヤー",
          avatar: "",
          number: null,
          clue1: "",
          ready: false,
          orderIndex: 0,
        };
      const cached = cache.get(id);
      if (cached && shallowEqualPartyMember(cached, candidate)) {
        nextCache.set(id, cached);
        return cached;
      }
      nextCache.set(id, candidate);
      return candidate;
    });
    playerCacheRef.current = nextCache;
    return result;
  }, [byId, displayedIds, fallbackNames]);

  const displayedPlayerMap = useMemo(
    () =>
      new Map(displayedPlayers.map((player) => [player.id, player] as const)),
    [displayedPlayers]
  );
  useEffect(() => {
    setMetric("ui", "dragonQuestPartyPlayers", displayedPlayers.length);
  }, [displayedPlayers.length]);

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
    if (displayedPlayers[0]?.id === displayedHostId) {
      return displayedPlayers;
    }
    return [hostPlayer, ...displayedPlayers.filter((player) => player.id !== displayedHostId)];
  }, [displayedPlayers, displayedHostId]);

  const submittedSet = useMemo(() => {
    if (!Array.isArray(submittedPlayerIds) || submittedPlayerIds.length === 0) {
      return new Set<string>();
    }
    return new Set(submittedPlayerIds);
  }, [submittedPlayerIds]);

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
    if (!hostOverride) {
      return () => undefined;
    }
    if (hostId === hostOverride.targetId) {
      setHostOverride(null);
      return () => undefined;
    }
    if (
      hostId !== null &&
      hostId !== undefined &&
      hostId !== hostOverride.previousId &&
      hostId !== hostOverride.targetId
    ) {
      setHostOverride(null);
    }
    if (hostId === null && hostOverride.previousId === null) {
      setHostOverride(null);
    }
    return () => undefined;
  }, [hostId, hostOverride]);

  useEffect(() => {
    if (!transferTargetId) {
      return undefined;
    }
    if (hostId === transferTargetId) {
      setTransferTargetId(null);
      return undefined;
    }
    return undefined;
  }, [hostId, transferTargetId]);
  useEffect(() => {
    if (renderStart === null || typeof performance === "undefined") {
      return undefined;
    }
    const duration = performance.now() - renderStart;
    setMetric("ui", "dragonQuestPartyRenderMs", Math.round(duration));
    bumpMetric("ui", "dragonQuestPartyRenderCount");
    return undefined;
  }, [renderStart]);

  const handleHostTransfer = useCallback(
    async (targetId: string, targetName: string) => {
      if (!roomId || transferTargetId !== null) return;
      traceAction("ui.host.transfer", { roomId, targetId });
      const previousId = displayedHostId;
      setTransferTargetId(targetId);
      setHostOverride({ targetId, previousId });

      const toastId = toastIds.hostTransfer(roomId, targetId);
      try {
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
          traceError("ui.host.transfer", "result_null", { roomId, targetId });
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
      } catch (error) {
        traceError("ui.host.transfer", error, { roomId, targetId });
        setHostOverride((current) =>
          current && current.targetId === targetId ? null : current
        );
        setTransferTargetId((current) =>
          current === targetId ? null : current
        );
        notify({
          id: toastIds.hostTransfer(roomId, targetId),
          title: "ホスト委譲に失敗しました",
          description:
            error instanceof Error
              ? error.message
              : "ネットワーク状況を確認してもう一度お試しください",
          type: "error",
          duration: 3200,
        });
      }
    },
    [roomId, transferTargetId, displayedHostId]
  );

  useEffect(() => {
    if (!prefersReducedMotion) {
      return undefined;
    }
    const id = window.setInterval(
      () => setAmbientPhase((prev) => (prev === 0 ? 1 : 0)),
      2400
    );
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  const updateScrollOverflow = useCallback(() => {
    if (orderedPlayers.length <= 6) {
      setEnableScroll(false);
      return;
    }
    const el = listContainerRef.current;
    if (!el) return;
    const tolerance = 12; // px
    const isOverflowing = el.scrollHeight - el.clientHeight > tolerance;
    setEnableScroll(isOverflowing);
  }, [orderedPlayers]);

  useEffect(() => {
    updateScrollOverflow();
    return undefined;
  }, [orderedPlayers, updateScrollOverflow]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) {
      return undefined;
    }
    updateScrollOverflow();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateScrollOverflow());
      observer.observe(el);
    }
    const handleResize = () => updateScrollOverflow();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
    };
  }, [updateScrollOverflow]);
  const shouldRevealNumbers = roomStatus === "finished";

  if (actualCount === 0) {
    return (
      <Box
        position="fixed"
        top={PANEL_TOP}
        left={PANEL_LEFT}
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

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={PANEL_TOP}
      left={PANEL_LEFT}
      zIndex={60}
      display="flex"
      flexDirection="column"
      gap={scaleForDpi("3px")}
      w={PANEL_WIDTH}
      maxW={PANEL_WIDTH}
      css={{
        pointerEvents: "none",
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
      <DragonQuestPartyHeader
        displayRoomName={displayRoomName}
        actualCount={actualCount}
        prefersReducedMotion={prefersReducedMotion}
        headerGlowShift={headerGlowShift}
        headerGlowOpacity={headerGlowOpacity}
      />

      <Box
        display="flex"
        flexDirection="column"
        gap={LIST_GAP}
        w="100%"
        maxH={LIST_MAX_HEIGHT}
        overflowY={enableScroll ? "auto" : "visible"}
        pr={enableScroll ? "4px" : 0}
        css={{
          pointerEvents: "auto",
          scrollbarWidth: enableScroll ? "thin" : undefined,
          scrollbarColor: enableScroll
            ? "var(--chakra-colors-accent) transparent"
            : undefined,
          "&::-webkit-scrollbar": {
            width: enableScroll ? scaleForDpi("6px") : "0px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--chakra-colors-accent)",
            borderRadius: scaleForDpi("3px"),
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
        }}
        ref={listContainerRef}
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
  );
}

export default memo(DragonQuestParty, areDragonQuestPartyPropsEqual);
export { DragonQuestParty };
