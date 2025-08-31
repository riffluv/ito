"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import { AppButton } from "@/components/ui/AppButton";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, HStack, Text } from "@chakra-ui/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo, useState } from "react";

export function SortBoard({
  players,
  proposal,
  onChange,
  onConfirm,
  disabled,
}: {
  players: (PlayerDoc & { id: string })[];
  proposal: string[];
  onChange: (list: string[]) => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const ids = proposal;
  const map = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      setActiveId(null);
      return;
    }
    onChange(arrayMove(ids, oldIndex, newIndex));
    setActiveId(null);
  };

  return (
    <Panel 
      title="並べ替える"
      css={{
        // 🎮 PREMIUM SORT PANEL
        background: `
          linear-gradient(135deg, 
            rgba(101,67,33,0.1) 0%, 
            rgba(80,53,26,0.2) 100%
          )
        `,
        border: "1px solid rgba(160,133,91,0.3)",
        backdropFilter: "blur(10px)",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const player = map.get(active.id as string);
              return `カード「${player?.name || active.id}」の並び替えを開始しました。矢印キーで移動できます。`;
            },
            onDragOver: ({ active, over }) => {
              if (over) {
                const activePlayer = map.get(active.id as string);
                const overPlayer = map.get(over.id as string);
                return `カード「${activePlayer?.name || active.id}」を「${overPlayer?.name || over.id}」の位置に移動中です。`;
              }
              return `カード「${active.id}」を移動中です。`;
            },
            onDragEnd: ({ active, over }) => {
              const activePlayer = map.get(active.id as string);
              if (over) {
                const overPlayer = map.get(over.id as string);
                return `カード「${activePlayer?.name || active.id}」を「${overPlayer?.name || over.id}」の位置に配置しました。`;
              }
              return `カード「${activePlayer?.name || active.id}」の並び替えを終了しました。`;
            },
            onDragCancel: ({ active }) => {
              const activePlayer = map.get(active.id as string);
              return `カード「${activePlayer?.name || active.id}」の並び替えをキャンセルしました。`;
            },
          },
        }}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <Box
            display="grid"
            gridTemplateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }}
            gap={4}
          >
            {ids.map((id, idx) => {
              const p = map.get(id);
              if (!p) return null;
              return (
                <SortableItem key={id} id={id} disabled={disabled}>
                  <Box
                    p={4}
                    borderRadius="16px"
                    css={{
                      // 🎮 PREMIUM SORTABLE CARD
                      background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                      backdropFilter: "blur(10px)",
                      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                      cursor: disabled ? "default" : "grab",
                      "&:hover": !disabled ? {
                        transform: "translateY(-4px) scale(1.02)",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,215,0,0.4)",
                      } : {},
                      "&:active": !disabled ? {
                        cursor: "grabbing",
                        transform: "scale(0.98)",
                      } : {},
                    }}
                  >
                    <HStack justify="space-between">
                      <Text 
                        lineClamp={1}
                        css={{
                          color: "#ffffff",
                          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                          fontWeight: 600,
                        }}
                      >
                        {p.name}
                      </Text>
                      <Text 
                        fontSize="xs"
                        css={{
                          color: "#ffd700",
                          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                          fontWeight: 700,
                          background: "rgba(255,215,0,0.1)",
                          px: 2,
                          py: 1,
                          borderRadius: "6px",
                          border: "1px solid rgba(255,215,0,0.3)",
                        }}
                      >
                        #{idx + 1}
                      </Text>
                    </HStack>
                    <Text 
                      mt={2} 
                      fontSize="sm" 
                      lineClamp={2}
                      css={{
                        color: "rgba(255,255,255,0.7)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                      }}
                    >
                      連想: {p.clue1 || "（未設定）"}
                    </Text>
                  </Box>
                </SortableItem>
              );
            })}
          </Box>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <Box
              p={4}
              borderRadius="16px"
              css={{
                // 🎮 PREMIUM DRAG OVERLAY
                background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)",
                border: "2px solid rgba(255,215,0,0.6)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.3)",
                backdropFilter: "blur(15px)",
                transform: "scale(1.08) rotate(2deg)",
                zIndex: 1000,
              }}
            >
              <Text css={{
                color: "#ffd700",
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                fontWeight: 700,
              }}>
                {map.get(activeId)?.name}
              </Text>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      <HStack mt={6} justify="flex-end">
        <AppButton
          colorPalette="orange"
          onClick={onConfirm}
          disabled={disabled}
          css={{
            // 🎮 PREMIUM CONFIRM BUTTON
            background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.3) 100%)",
            border: "1px solid rgba(245,158,11,0.5)",
            color: "#fbbf24",
            px: 8,
            py: 3,
            fontSize: "1rem",
            fontWeight: 700,
            borderRadius: "12px",
            _hover: {
              background: "linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(217,119,6,0.4) 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(245,158,11,0.3)",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
              _hover: {
                transform: "none",
                background: "initial",
              },
            },
          }}
        >
          並びを確定
        </AppButton>
      </HStack>
    </Panel>
  );
}
