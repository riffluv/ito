"use client";
import { Box } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

export function SortableItem({
  id,
  children,
  disabled,
}: {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: disabled ? "default" : "grab",
    touchAction: "none", // prevent scroll while dragging per dnd-kit docs
    userSelect: isDragging ? "none" : undefined,
    WebkitUserSelect: isDragging ? "none" : undefined,
    ...(isDragging ? { zIndex: 5 } : null),
  };
  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </Box>
  );
}
