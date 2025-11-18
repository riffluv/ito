"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DndContextProps,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
  type Modifier,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { SortableContext } from "@dnd-kit/sortable";

import { EmptyCard } from "@/components/cards";
import { SortableItem } from "@/components/sortable/SortableItem";
import WaitingArea from "@/components/ui/WaitingArea";
import type { DragSlotDescriptor } from "@/components/hooks/useBoardSlots";
import { useMagnetSnapshot, type MagnetController } from "@/components/hooks/useMagnetController";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type { MagnetResult } from "@/lib/ui/dragMagnet";
import { UNIFIED_LAYOUT } from "@/theme/layout";

import { BoardFrame } from "./BoardFrame";
import { GHOST_CARD_STYLE, RETURN_DROP_ZONE_ID } from "./constants";

type CursorSnapOffset = {
  x: number;
  y: number;
};

/**
 * 磁力吸着を DragOverlay の transform に直接適用する modifier
 * これにより overlayInnerStyle との競合を完全に排除
 */
function createMagnetModifier(
  magnetState: MagnetResult,
  dragLift: number,
  prefersReducedMotion: boolean
): Modifier {
  return ({ transform }) => {
    // 磁力が働き始めた時点で dragLift を完全に抑制
    const magnetActiveThreshold = prefersReducedMotion ? 0.08 : 0.05;
    const shouldSuppressLift = magnetState.shouldSnap || magnetState.strength > magnetActiveThreshold;

    let liftAfterMagnet = 0;
    if (!shouldSuppressLift) {
      const liftBaseline = dragLift * 0.65;
      const liftNeutralizeStart = prefersReducedMotion ? 0.02 : 0.01;
      const liftNeutralizeEnd = magnetActiveThreshold;
      const liftNeutralizeRange = Math.max(0.001, liftNeutralizeEnd - liftNeutralizeStart);
      const strength = magnetState.strength;
      const liftNeutralizer =
        strength <= liftNeutralizeStart
          ? 0
          : Math.min(1, (strength - liftNeutralizeStart) / liftNeutralizeRange);
      liftAfterMagnet = liftBaseline * (1 - liftNeutralizer);
    }

    // 磁力の強さを距離に応じて調整（吸着後も引き離せるように）
    // ドキュメント推奨: スナップ距離24px以内で強い吸着、それ以外は軽い引き寄せ
    const snapDistance = prefersReducedMotion ? 20 : 24;
    const isVeryClose = Number.isFinite(magnetState.distance) && magnetState.distance < snapDistance;

    // 距離が近い場合のみ完全吸着、それ以外は段階的に弱める
    let magnetStrength = 0.3; // デフォルト: 軽い引き寄せ
    if (isVeryClose) {
      magnetStrength = 1.0; // 完全吸着
    } else if (magnetState.shouldSnap) {
      magnetStrength = 0.5; // 中程度の磁力（引き離しやすい）
    }

    // DragOverlay の transform に磁力補正を加算
    const magnetDx = magnetState.dx * magnetStrength;
    const magnetDy = magnetState.dy * magnetStrength;

    return {
      ...transform,
      x: transform.x + magnetDx,
      y: transform.y + magnetDy - liftAfterMagnet,
      scaleX: 1,
      scaleY: 1,
    };
  };
}

function createCursorSnapModifier(cursorOffset: CursorSnapOffset | null): Modifier {
  if (!cursorOffset) {
    return ({ transform }) => transform;
  }

  return ({ transform }) => {
    return {
      ...transform,
      x: transform.x + cursorOffset.x,
      y: transform.y + cursorOffset.y,
    };
  };
}

interface InteractiveBoardProps {
  slots: DragSlotDescriptor[];
  magnetController: MagnetController;
  prefersReducedMotion: boolean;
  activeId: string | null;
  isOver: boolean;
  canDrop: boolean;
  sensors: DndContextProps["sensors"];
  collisionDetection: CollisionDetection;
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  dropAnimation: DropAnimation;
  renderCard: (id: string, idx?: number) => React.ReactNode;
  activeProposal: (string | null)[];
  waitingPlayers: (PlayerDoc & { id: string })[];
  meId: string;
  displayMode?: "full" | "minimal";
  roomStatus: RoomDoc["status"];
  boardRef: React.Ref<HTMLDivElement>;
  isRevealing: boolean;
  cursorSnapOffset: CursorSnapOffset | null;
}

function InteractiveBoardBase({
  slots,
  magnetController,
  prefersReducedMotion,
  activeId,
  isOver,
  canDrop,
  sensors,
  collisionDetection,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  dropAnimation,
  renderCard,
  activeProposal,
  waitingPlayers,
  meId,
  displayMode,
  roomStatus,
  boardRef,
  isRevealing,
  cursorSnapOffset,
}: InteractiveBoardProps) {
  const magnetSnapshot = useMagnetSnapshot(magnetController);
  const magnetState = magnetController.getProjectedMagnetState();
  const sortableItems = useMemo(
    () => activeProposal.filter((id): id is string => typeof id === "string" && id.length > 0),
    [activeProposal]
  );
  const [dragTilt, setDragTilt] = useState(0);
  const [dragLift, setDragLift] = useState(0);
  const [magnetEnterPulse, setMagnetEnterPulse] = useState(false);

  useEffect(() => {
    if (!magnetSnapshot.targetId) {
      setMagnetEnterPulse(false);
      return;
    }
    setMagnetEnterPulse(true);
    if (typeof window === "undefined") return undefined;
    const duration = prefersReducedMotion ? 90 : 170;
    const timer = window.setTimeout(() => setMagnetEnterPulse(false), duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [magnetSnapshot.targetId, prefersReducedMotion]);

  useEffect(() => {
    if (!activeId) {
      setDragTilt(0);
      setDragLift(0);
      return;
    }
    const tiltRange = prefersReducedMotion ? 1.4 : 2.8;
    const randomTilt = Math.random() * tiltRange * 2 - tiltRange;
    setDragTilt(Number(randomTilt.toFixed(2)));
    setDragLift(prefersReducedMotion ? 2 : 8);
  }, [activeId, prefersReducedMotion]);

  const overlayShellStyle = useMemo<React.CSSProperties>(() => {
    const baseShadowStrength = prefersReducedMotion ? 0.18 : 0.26;
    const strength = magnetState.strength;
    const blur = 14 + strength * 18;
    const yOffset = 8 + strength * 10;
    const opacity = baseShadowStrength + strength * 0.22;
    return {
      ...GHOST_CARD_STYLE,
      cursor: "grabbing",
      filter: `drop-shadow(0 ${yOffset.toFixed(2)}px ${blur.toFixed(2)}px rgba(0, 0, 0, ${opacity.toFixed(
        3
      )}))`,
    };
  }, [magnetState.strength, prefersReducedMotion]);

  const magnetModifier = useMemo(
    () => createMagnetModifier(magnetState, dragLift, prefersReducedMotion),
    [magnetState, dragLift, prefersReducedMotion]
  );

  const cursorSnapModifier = useMemo(
    () => createCursorSnapModifier(cursorSnapOffset),
    [cursorSnapOffset]
  );

  const overlayModifiers = useMemo(
    () => [cursorSnapModifier, magnetModifier, restrictToWindowEdges],
    [cursorSnapModifier, magnetModifier]
  );

  const overlayInnerStyle = useMemo<React.CSSProperties>(() => {
    if (!activeId) {
      return {
        transform: "scale(1)",
      };
    }
    const strength = magnetState.strength;
    const baseScale = prefersReducedMotion ? 1.02 : 1.05;
    const magnetScaleBoost = strength * (prefersReducedMotion ? 0.016 : 0.05);
    const enterBoost = magnetEnterPulse ? (prefersReducedMotion ? 0.018 : 0.06) : 0;
    const tiltInfluence = strength * (prefersReducedMotion ? 0.6 : 1.4);
    const rotate = dragTilt + tiltInfluence;
    const liftFilterStrength = Math.max(0, strength - 0.08);
    const transitionDuration = prefersReducedMotion ? 110 : 190;

    // translate は magnetModifier で処理されるため、ここでは scale と rotate のみ
    return {
      transform: `scale(${(baseScale + magnetScaleBoost + enterBoost).toFixed(4)}) rotate(${rotate.toFixed(
        2
      )}deg)`,
      transition: `transform ${transitionDuration}ms cubic-bezier(0.2, 0.75, 0.4, 1), filter ${
        transitionDuration + 40
      }ms cubic-bezier(0.2, 0.7, 0.4, 1)`,
      filter:
        liftFilterStrength > 0
          ? `drop-shadow(0 ${4 + liftFilterStrength * 10}px ${12 + liftFilterStrength * 18}px rgba(0, 0, 0, ${
              0.18 + liftFilterStrength * 0.28
            }))`
          : undefined,
      willChange: "transform",
    };
  }, [activeId, dragTilt, magnetState.strength, magnetEnterPulse, prefersReducedMotion]);

  return (
    <DndContext
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestor]}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => {
            const id = String(active.id);
            return `${id}のカードをドラッグ開始`;
          },
          onDragOver: ({ active, over }) => {
            if (over) {
              const overIndex = activeProposal.indexOf(over.id as string);
              return `${String(active.id)}を${overIndex + 1}番スロットに移動中`;
            }
            return `${String(active.id)}を移動中`;
          },
          onDragEnd: ({ active, over }) => {
            if (over) {
              const overIndex = activeProposal.indexOf(over.id as string);
              return `${String(active.id)}を${overIndex + 1}番スロットに配置`;
            }
            return `${String(active.id)}の移動をキャンセル`;
          },
          onDragCancel: ({ active }) => `${String(active.id)}のドラッグをキャンセル`,
        },
      }}
    >
      <BoardFrame isActive={isOver && canDrop} containerRef={boardRef}>
        <SortableContext items={sortableItems}>
          {slots.map((slot) => {
            if (slot.showCard && slot.cardId) {
              if (slot.proposalCardId && slot.proposalCardId === slot.cardId) {
                return (
                  <SortableItem id={slot.cardId} key={slot.cardId}>
                    {renderCard(slot.cardId, slot.idx)}
                  </SortableItem>
                );
              }
              return (
                <React.Fragment key={`ghost-${slot.idx}-${slot.cardId}`}>
                  {renderCard(slot.cardId, slot.idx)}
                </React.Fragment>
              );
            }

            const isTarget = magnetSnapshot.targetId === slot.droppableId;
            return (
              <EmptyCard
                key={`slot-${slot.idx}`}
                slotNumber={slot.idx + 1}
                totalSlots={slot.totalSlots}
                alignSelf="flex-start"
                id={slot.droppableId}
                isDroppable
                isDragActive={!!activeId}
                isMagnetTarget={isTarget}
                magnetStrength={isTarget ? magnetSnapshot.strength : 0}
                prefersReducedMotion={prefersReducedMotion}
              />
            );
          })}
        </SortableContext>
      </BoardFrame>

      <DragOverlay dropAnimation={dropAnimation} modifiers={overlayModifiers}>
        {activeId
          ? (() => {
              const idx = activeProposal.indexOf(activeId);
              if (idx >= 0) {
                return (
                  <div
                    style={overlayShellStyle}
                    data-floating-card="true"
                    data-magnet-strength={magnetState.strength.toFixed(2)}
                  >
                    <div style={overlayInnerStyle}>{renderCard(activeId, idx)}</div>
                  </div>
                );
              }
              return (
                <div
                  style={overlayShellStyle}
                  data-floating-card="true"
                  data-magnet-strength={magnetState.strength.toFixed(2)}
                >
                  <div style={overlayInnerStyle}>{renderCard(activeId)}</div>
                </div>
              );
            })()
          : null}
      </DragOverlay>

      {(roomStatus === "clue" || roomStatus === "waiting") && !isRevealing && waitingPlayers.length > 0 && (
        <Box
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          mt={{ base: 4, md: 5 }}
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              marginTop: "1.25rem !important",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              marginTop: "1rem !important",
            },
          }}
        >
          <WaitingArea
            players={waitingPlayers}
            isDraggingEnabled
            meId={meId}
            displayMode={displayMode}
            returnDropZoneId={RETURN_DROP_ZONE_ID}
            hideClues={roomStatus !== "clue"}
            gameStarted={roomStatus === "clue"}
          />
        </Box>
      )}
    </DndContext>
  );
}

export const InteractiveBoard = React.memo(InteractiveBoardBase);
InteractiveBoard.displayName = "CentralInteractiveBoard";
