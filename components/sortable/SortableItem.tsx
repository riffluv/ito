"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function SortableItem({ id, children, disabled }: { id: string; children: ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: disabled ? "default" : "grab",
    ...(isDragging ? { zIndex: 5, transform: `${CSS.Transform.toString(transform)} scale(1.04) rotate(0.5deg)` } : null),
  };
  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </Box>
  );
}
