"use client";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { RoomStats } from "@/lib/types";
import {
  Box,
  Flex,
  Portal,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import { castMvpVote } from "@/lib/game/mvp";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  buildMvpTally,
  buildSortedPlayers,
  computeVoteProgress,
  type LedgerPlayer,
} from "@/components/ui/mvp-ledger/mvpLedgerDerivations";
import { buildLedgerStatsSummary } from "@/components/ui/mvp-ledger/mvpLedgerStats";
import { MvpLedgerFooter } from "@/components/ui/mvp-ledger/MvpLedgerFooter";
import { MvpLedgerHeader } from "@/components/ui/mvp-ledger/MvpLedgerHeader";
import { MvpLedgerTableHeaderRow } from "@/components/ui/mvp-ledger/MvpLedgerTableHeaderRow";
import { MvpLedgerTableRow } from "@/components/ui/mvp-ledger/MvpLedgerTableRow";
import { useMvpLedgerPixiBackground } from "@/components/ui/mvp-ledger/useMvpLedgerPixiBackground";
import { useMvpLedgerOpenAnimation } from "@/components/ui/mvp-ledger/useMvpLedgerOpenAnimation";
import { useMvpLedgerEscClose } from "@/components/ui/mvp-ledger/useMvpLedgerEscClose";

interface MvpLedgerProps {
  isOpen: boolean;
  onClose: () => void;
  players: LedgerPlayer[];
  orderList: string[];
  topic?: string | null;
  failed?: boolean;
  roomId: string;
  myId: string;
  mvpVotes?: Record<string, string> | null;
  stats: RoomStats | null;
  readOnly?: boolean;
  contextLabel?: string | null;
}

export function MvpLedger({
  isOpen,
  onClose,
  players,
  orderList,
  topic,
  failed,
  roomId,
  myId,
  mvpVotes = null,
  stats,
  readOnly = false,
  contextLabel = null,
}: MvpLedgerProps) {
  const prefersReduced = useReducedMotionPreference();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<HTMLDivElement[]>([]);

  const { fallbackPanel } = useMvpLedgerPixiBackground({ isOpen, failed, boardRef });

  const sortedPlayers = useMemo(() => {
    return buildSortedPlayers(players, orderList);
  }, [players, orderList]);

  const validTargets = useMemo(
    () => new Set(sortedPlayers.map((p) => p.id)),
    [sortedPlayers]
  );

  // MVP投票の集計
  const mvpStats = useMemo(() => {
    return buildMvpTally({ mvpVotes, sortedPlayers, myId });
  }, [mvpVotes, sortedPlayers, myId]);

  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const playLedgerClose = useSoundEffect("ledger_close");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { percent: voteProgressPercent } = useMemo(
    () => computeVoteProgress(mvpStats),
    [mvpStats]
  );
  const statsSummary = useMemo(() => buildLedgerStatsSummary(stats), [stats]);

  const handleVote = useCallback(
    async (votedPlayerId: string) => {
      if (readOnly) return; // 閲覧専用モードでは投票不可
      if (!votedPlayerId || votedPlayerId === myId) return; // 自分には投票できない
      if (pendingTarget) return; // 多重送信ガード
      if (!validTargets.has(votedPlayerId)) return;
      if (mvpStats.myVote) return; // すでに投票済みなら何もしない

      setPendingTarget(votedPlayerId);
      try {
        await castMvpVote(roomId, myId, votedPlayerId);

        const playerName = sortedPlayers.find(p => p.id === votedPlayerId)?.name;
        notify({
          id: `mvp-vote-success:${roomId}`,
          title: "MVP投票完了",
          description: `${playerName || "このプレイヤー"} に投票しました`,
          type: "success",
        });
      } catch (error) {
        console.error("MVP投票エラー:", error);
        notify({
          id: `mvp-vote-error:${roomId}`,
          title: "MVP投票に失敗しました",
          description: "通信状態を確認して再度お試しください。",
          type: "error",
        });
      } finally {
        setPendingTarget(null);
      }
    },
    [myId, roomId, mvpStats.myVote, pendingTarget, validTargets, sortedPlayers, readOnly]
  );

  const handleCloseClick = useCallback(() => {
    if (isClosing) return; // クールダウン中は何もしない

    playLedgerClose();

    const button = closeButtonRef.current;
    if (button && !prefersReduced) {
      setIsClosing(true);

      // ハイライト流れアニメーション
      const highlight = document.createElement("div");
      highlight.style.cssText = `
        position: absolute;
        top: 0;
        right: 100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        pointer-events: none;
      `;
      button.style.position = "relative";
      button.style.overflow = "hidden";
      button.appendChild(highlight);

      gsap.to(highlight, {
        right: "-50%",
        duration: 0.25,
        ease: "power2.out",
        onComplete: () => {
          highlight.remove();
        },
      });

      // クールダウン終了後に実際のクローズ処理
      setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 280);
    } else {
      onClose();
    }
  }, [isClosing, onClose, playLedgerClose, prefersReduced]);

  const handleOverlayClose = useCallback(() => {
    if (isClosing) return;
    playLedgerClose();
    onClose();
  }, [isClosing, onClose, playLedgerClose]);

  useMvpLedgerOpenAnimation({ isOpen, prefersReduced, overlayRef, boardRef, rowRefs });

  useEffect(() => {
    if (!isOpen) {
      rowRefs.current = [];
    }
  }, [isOpen]);

  useMvpLedgerEscClose({ isOpen, onRequestClose: handleCloseClick });

  const wrapperMarginTop = useBreakpointValue({ base: "12vh", md: "10vh" });
  const columnTemplate = {
    base: "50px 64px minmax(0, 1.65fr) minmax(0, 2.5fr) 88px 108px",
    md: "62px 74px minmax(0, 1.75fr) minmax(0, 2.7fr) 100px 132px",
  } as const;

  const voteControlWidth = {
    base: "56px",
    md: "64px",
  } as const;

  if (!isOpen) return null;

  return (
    <Portal>
      <Box
        ref={overlayRef}
        position="fixed"
        inset={0}
        zIndex={100}
        bg="rgba(8, 9, 15, 0.88)"
        backdropFilter="blur(6px)"
        onClick={handleOverlayClose}
      />
      <Flex
        position="fixed"
        inset={0}
        zIndex={120}
        justify="center"
        align="flex-start"
        pointerEvents="none"
      >
        <Flex
          ref={boardRef}
          data-pixi-target="battle-records-board"
          role="dialog"
          aria-modal
          aria-label="連想記録簿"
          direction="column"
          maxW={{ base: "95vw", md: "min(1000px, 88vw)" }}
          maxH={{ base: "92vh", md: "88vh" }}
          w="100%"
          mt={wrapperMarginTop}
          bg={
            fallbackPanel
              ? "linear-gradient(180deg, rgba(8,9,15,0.94) 0%, rgba(9,11,18,0.9) 100%)"
              : "transparent"
          }
          border={fallbackPanel ? "3px solid rgba(255,255,255,0.92)" : "none"}
          boxShadow={
            fallbackPanel
              ? "0 12px 38px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4)"
              : "none"
          }
          transformOrigin="center"
          color="white"
          fontFamily="monospace"
          overflow="hidden"
          position="relative"
          pointerEvents="auto"
          onClick={(e) => e.stopPropagation()}
        >
          <MvpLedgerHeader
            failed={failed}
            topic={topic}
            contextLabel={contextLabel}
            statsSummary={statsSummary}
            onCloseClick={handleCloseClick}
          />

          {/* 表部分 - CSS Grid使用 */}
          <Box
            px={{ base: "19px", md: "27px" }}
            py={{ base: "12px", md: "16px" }}
            position="relative"
            zIndex={20}
            flex="1"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            {/* Grid定義 */}
            <MvpLedgerTableHeaderRow
              columnTemplate={columnTemplate}
              voteControlWidth={voteControlWidth}
            />

            {/* 表データ */}
            <Box
              mt="9px"
              flex="1"
              overflowY="auto"
              pr={{ base: "3px", md: "6px" }}
              css={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.6) transparent",
                "&::-webkit-scrollbar": {
                  width: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: "0",
                },
              }}
            >
              <Stack gap={{ base: "0", md: "0" }}>
                {sortedPlayers.map((player, index) => (
                  <MvpLedgerTableRow
                    key={player.id}
                    player={player}
                    index={index}
                    columnTemplate={columnTemplate}
                    voteControlWidth={voteControlWidth}
                    myId={myId}
                    readOnly={readOnly}
                    pendingTarget={pendingTarget}
                    onVote={handleVote}
                    mvpStats={mvpStats}
                    rowRef={(el) => {
                      if (el) rowRefs.current[index] = el;
                    }}
                  />
                ))}
              </Stack>
            </Box>
          </Box>

          <MvpLedgerFooter
            mvpStats={mvpStats}
            sortedPlayers={sortedPlayers}
            voteProgressPercent={voteProgressPercent}
            isClosing={isClosing}
            closeButtonRef={closeButtonRef}
            onCloseClick={handleCloseClick}
          />
        </Flex>
      </Flex>
    </Portal>
  );
}

// (moved to components/ui/mvp-ledger/mvpLedgerStats.tsx)
