"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
    <Panel title="並べ替える">
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <Box
            display="grid"
            gridTemplateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }}
            gap={3}
          >
            {ids.map((id, idx) => {
              const p = map.get(id);
              if (!p) return null;
              return (
                <SortableItem key={id} id={id} disabled={disabled}>
                  <Box
                    p={3}
                    borderWidth="1px"
                    borderColor="borderDefault"
                    borderRadius="xl"
                    bg="panelSubBg"
                    boxShadow="card"
                  >
                    <HStack justify="space-between">
                      <Text lineClamp={1}>{p.name}</Text>
                      <Text fontSize="xs" color="fgMuted">
                        #{idx + 1}
                      </Text>
                    </HStack>
                    <Text mt={1} fontSize="sm" color="fgMuted" lineClamp={2}>
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
              p={3}
              borderRadius="xl"
              bg="panelBg"
              boxShadow="cardHover"
              transform="scale(1.04) rotate(0.5deg)"
            >
              <Text>{map.get(activeId)?.name}</Text>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      <HStack mt={4} justify="flex-end">
        <Button colorPalette="orange" onClick={onConfirm} disabled={disabled}>
          並びを確定
        </Button>
      </HStack>
    </Panel>
  );
}
