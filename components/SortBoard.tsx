"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import { AppButton } from "@/components/ui/AppButton";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
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
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
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
    <Panel title="並べ替える" variant="subtle" elevated={false}>
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
                    rounded="lg"
                    bg="surfaceRaised"
                    borderWidth="1px"
                    borderColor="borderSubtle"
                    shadow="xs"
                    transition="background-color .25s, box-shadow .25s, transform .25s, border-color .25s"
                    cursor={disabled ? "default" : "grab"}
                    _hover={
                      !disabled
                        ? {
                            bg: "accentSubtle",
                            borderColor: "accent",
                            shadow: "sm",
                            transform: "translateY(-3px)",
                          }
                        : undefined
                    }
                    _active={
                      !disabled ? { transform: "translateY(-1px)" } : undefined
                    }
                  >
                    <HStack justify="space-between">
                      <Text lineClamp={1} fontWeight={600} color="fgDefault">
                        {p.name}
                      </Text>
                      <Text
                        fontSize="xs"
                        fontWeight={700}
                        px={2}
                        py={1}
                        rounded="sm"
                        bg="accentSubtle"
                        color="accent"
                        borderWidth="1px"
                        borderColor="accent"
                      >
                        #{idx + 1}
                      </Text>
                    </HStack>
                    <Text mt={2} fontSize="sm" lineClamp={2} color="fgMuted">
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
              rounded="lg"
              bg="accentSubtle"
              borderWidth="2px"
              borderColor="accent"
              shadow="lg"
              transform="scale(1.05)"
              zIndex={1000}
            >
              <Text color="accent" fontWeight={700}>
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
          size="md"
        >
          並びを確定
        </AppButton>
      </HStack>
    </Panel>
  );
}
