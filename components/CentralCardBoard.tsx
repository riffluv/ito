"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import {
  addCardToProposal,
  commitPlayFromClue,
  finalizeReveal,
  setOrderProposal,
} from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";
import GameCard from "@/components/ui/GameCard";
import BoardArea from "@/components/ui/BoardArea";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useRef, useState } from "react";

export function CentralCardBoard({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  proposal,
  cluesReady,
  failed,
  failedAt,
  resolveMode,
}: {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus?: string;
  proposal?: string[];
  cluesReady?: boolean;
  failed?: boolean;
  failedAt?: number | null;
  resolveMode?: string;
}) {
  // --- Reveal Animation (sort-submit 判定後) ---
  const [revealAnimating, setRevealAnimating] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0); // 次にフリップする index (既に revealIndex 個がオープン)
  const prevStatusRef = useRef(roomStatus);

  useEffect(() => {
    // clue -> finished への遷移タイミングで開始 (sort-submit のみ)
    const prev = prevStatusRef.current;
    const startedReveal =
      resolveMode === "sort-submit" &&
      prev === "clue" &&
      roomStatus === "reveal" &&
      (orderList?.length || 0) > 0;
    if (startedReveal) {
      setRevealAnimating(true);
      // 0 から開始し、別 effect で最初のフリップを短 delay で行う
      setRevealIndex(0);
    }
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderList?.join(",")]);

  useEffect(() => {
    if (!revealAnimating) return;
    const total = orderList?.length || 0;
    if (revealIndex >= total) {
      setRevealAnimating(false);
      finalizeReveal(roomId).catch(() => void 0);
      return;
    }
    // 最初の 1 枚は短い待機で即フリップして「固まった」印象を避ける
    const delay = revealIndex === 0 ? 120 : 800; // ms
    const t = setTimeout(
      () =>
        setRevealIndex((i) => {
          if (i >= total) return i;
          return i + 1;
        }),
      delay
    );
    return () => clearTimeout(t);
  }, [revealAnimating, revealIndex, orderList?.length, roomId]);
  const map = new Map(players.map((p) => [p.id, p]));
  const [pending, setPending] = useState<string[]>([]);
  const [isOver, setIsOver] = useState(false);

  // sequential モード向けのローカル評価: サーバ更新を待たずに即時に失敗を検出して表示するため
  const currentPlaced = useMemo(() => {
    const base = orderList || [];
    const extra = pending.filter((id) => !base.includes(id));
    return [...base, ...extra];
  }, [orderList?.join(","), pending.join(",")]);
  const localFailedAt = useMemo(() => {
    if (resolveMode === "sort-submit") return null;
    for (let i = 0; i < (currentPlaced.length || 0) - 1; i++) {
      const a = map.get(currentPlaced[i]) as any;
      const b = map.get(currentPlaced[i + 1]) as any;
      if (
        !a ||
        !b ||
        typeof a.number !== "number" ||
        typeof b.number !== "number"
      )
        continue;
      if (a.number > b.number) return i + 1; // 1-based
    }
    return null;
  }, [currentPlaced.join(","), players.map((p) => p.number).join(",")]);

  // If server-side orderList contains an id, clear it from pending
  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    setPending((cur) => cur.filter((id) => !orderList.includes(id)));
  }, [orderList.join(",")]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;
    setIsOver(false);
    if (pid !== meId) {
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }
    const me = map.get(meId as string) as any;
    if (!me || typeof me.number !== "number") {
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }
    if (roomStatus !== "clue") {
      notify({ title: "今はカードを出せません", type: "info" });
      return;
    }
    if (resolveMode === "sort-submit") {
      // 判定はまだ行わない。proposal に追加。
      try {
        await addCardToProposal(roomId, meId);
        setPending((p) => (p.includes(pid) ? p : [...p, pid]));
        notify({ title: "カードを場に置きました", type: "success" });
      } catch (err: any) {
        notify({
          title: "配置に失敗しました",
          description: err?.message,
          type: "error",
        });
      }
      return;
    }
    // 従来モード: 全員の連想ワード確定後に即判定
    if (!cluesReady) {
      notify({
        title: "全員が連想ワードを決定してから出してください",
        type: "info",
      });
      return;
    }
    try {
      await commitPlayFromClue(roomId, meId);
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      notify({ title: "カードを場に置きました（判定実行）", type: "success" });
    } catch (err: any) {
      notify({
        title: "配置に失敗しました",
        description: err?.message,
        type: "error",
      });
    }
  };

  // helper to render a card box
  const renderCard = (id: string, idx?: number) => {
    const p = map.get(id) as any;
    const number = p?.number;
    const isPlaced =
      (orderList || []).includes(id) ||
      pending.includes(id) ||
      (proposal || []).includes(id);
    const numberVisibleBase = typeof number === "number" && isPlaced;
    let showNumber = numberVisibleBase;
    if (resolveMode === "sort-submit" && roomStatus !== "finished") {
      showNumber = false; // 判定前は伏せ
    }
    if (revealAnimating && typeof idx === "number") {
      showNumber = idx < revealIndex;
    }
    const isFlippedNow =
      roomStatus === "finished" ||
      (roomStatus === "reveal" && typeof idx === "number" && idx < revealIndex);
    // Unified color logic for both modes:
    // - Determine an effective failure index (client-local detection takes precedence)
    // - For sequential: failure is considered confirmed immediately when effectiveFailedAt exists
    // - For sort-submit: failure is confirmed only once the reveal has reached the failing card (or finished)
    const effectiveFailedAt = localFailedAt ?? failedAt;
    const failureConfirmed = (() => {
      if (typeof effectiveFailedAt !== "number") return false;
      if (resolveMode === "sort-submit") {
        // during reveal, confirm when revealIndex has reached the failing card
        if (roomStatus === "finished") return !!failed;
        return revealIndex >= effectiveFailedAt;
      }
      return true; // sequential: confirmed immediately
    })();

    // For sort-submit a card is "revealed" when it's been flipped; for sequential any placed card is visible
    const cardIsRevealed =
      resolveMode === "sort-submit"
        ? typeof idx === "number" &&
          (roomStatus === "finished" ||
            (roomStatus === "reveal" && idx < revealIndex))
        : isPlaced;

    const shouldShowGreen = cardIsRevealed && !failureConfirmed;
    const shouldShowRed = cardIsRevealed && failureConfirmed;

    // persistent flip デザイン: reveal / finished 後も同一 UI
    const persistentFlip =
      resolveMode === "sort-submit" && typeof idx === "number";
    const flipped =
      persistentFlip &&
      (roomStatus === "finished"
        ? true
        : roomStatus === "reveal" && idx < revealIndex);
    // 一斉フレームでの transform 適用によるチラつきを避けるため、最初のカードのみ短 delay でフリップさせたので追加の suppress は不要

    if (persistentFlip) {
      return (
        <GameCard
          key={id}
          variant="flip"
          flipped={flipped}
          index={typeof idx === "number" ? idx : null}
          name={p?.name}
          clue={p?.clue1}
          number={typeof number === "number" ? number : null}
          state={shouldShowRed ? "fail" : shouldShowGreen ? "success" : "default"}
        />
      );
    }

    return (
      <>
        <GameCard
          key={id}
          variant="flat"
          index={typeof idx === "number" ? idx : null}
          name={p?.name}
          clue={
            resolveMode === "sort-submit" && roomStatus !== "finished"
              ? p?.clue1 || "(連想待ち)"
              : p?.clue1
          }
          number={showNumber && typeof number === "number" ? number : null}
          state={shouldShowRed ? "fail" : shouldShowGreen ? "success" : "default"}
        />
        {typeof effectiveFailedAt === "number" &&
          typeof idx === "number" &&
          effectiveFailedAt === idx + 1 &&
          cardIsRevealed && (
            <Text mt={2} fontSize="xs" color="red.300" fontWeight="bold">
              ← ここで失敗！
            </Text>
          )}
      </>
    );
  };

  // sort-submit 用 DnD 並べ替え
  const activeProposal = useMemo(() => proposal || [], [proposal?.join(",")]);
  const onDragEnd = async (e: DragEndEvent) => {
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = activeProposal.indexOf(String(active.id));
    const newIndex = activeProposal.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(activeProposal, oldIndex, newIndex);
    try {
      await setOrderProposal(roomId, reordered);
    } catch {
      /* ignore */
    }
  };

  return (
    <Panel title="カードボード（出した順）">
      <Box position="relative">
        <Box textAlign="center" mb={2}>
          <Box
            as="span"
            display="inline-block"
            px={3}
            py={1.5}
            rounded="12px"
            bg="rgba(123,211,182,0.08)"
            fontWeight={700}
          >
            🎯 カードボード（出した順）
          </Box>
        </Box>
        {failed && roomStatus === "finished" && (
          <Box
            position="absolute"
            top={-10}
            right={0}
            transform="translateY(-100%)"
            bgGradient="linear(90deg, rgba(255,70,70,0.9), rgba(120,0,0,0.9))"
            px={3.5}
            py={1.5}
            rounded="12px"
            fontWeight={800}
            color="#fff"
            letterSpacing={1}
            boxShadow="0 4px 18px -4px rgba(255,0,0,0.4)"
            zIndex={10}
          >
            失敗！昇順が崩れました（#{failedAt} 枚目）
          </Box>
        )}
        {/* no separate header hint; placeholder inside board will show waiting message when appropriate */}

        <BoardArea
          onDragOver={(e) => {
            e.preventDefault();
            // only show hover highlight when drops are allowed
            if (!(roomStatus === "clue" && cluesReady === false)) {
              setIsOver(true);
            }
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={onDrop}
          isOver={isOver}
        >
          {resolveMode === "sort-submit" && roomStatus === "clue" ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={activeProposal}>
                {activeProposal.length > 0 &&
                  activeProposal.map((id, idx) => (
                    <SortableItem id={id} key={id}>
                      {renderCard(id, idx)}
                    </SortableItem>
                  ))}
              </SortableContext>
            </DndContext>
          ) : (
            <>
              {orderList &&
                orderList.length > 0 &&
                orderList.map((id, idx) => renderCard(id, idx))}
              {proposal && proposal.length > 0
                ? proposal
                    .filter((id) => !orderList?.includes(id))
                    .map((id) => renderCard(id))
                : null}
            </>
          )}

          {/* optimistic local pending (fallback) */}
          {resolveMode === "sort-submit" &&
            roomStatus === "clue" &&
            activeProposal.length === 0 && (
              <Text color="gray.400">
                自分のカードをドラッグして場に置き、連想ワードで相談しましょう。
              </Text>
            )}
          {resolveMode !== "sort-submit" &&
            (!orderList || orderList.length === 0) &&
            (!proposal || proposal.length === 0) &&
            pending.length === 0 &&
            (roomStatus === "clue" && cluesReady === false ? (
              <Box role="status" aria-live="polite">
                <Text fontWeight={700} color="fgMuted">
                  全員が連想ワードを決定するまでお待ちください
                </Text>
              </Box>
            ) : (
              <Text color="gray.400">
                まだカードが出されていません。自分のカードをドラッグしてここに置いてください。
              </Text>
            ))}

          {resolveMode !== "sort-submit" && pending && pending.length > 0
            ? pending
                .filter((id) => !(orderList || []).includes(id))
                .filter((id) => !(proposal || []).includes(id))
                .map((id) => renderCard(id))
            : null}
          {/* 失敗後も継続可能: 下部に説明 */}
          {failed && (
            <Box flexBasis="100%">
              <Text fontSize="sm" color="red.300">
                失敗後も全員のカードが出揃うまで並べ続けます。
              </Text>
            </Box>
          )}
        </BoardArea>
      </Box>
    </Panel>
  );
}

export default CentralCardBoard;
