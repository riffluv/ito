"use client";
import { Box } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UI_TOKENS } from "@/theme/layout";
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
    isOver,
  } = useSortable({ id, disabled });
  
  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition, // ドラッグ中は滑らかな移動のためtransition無効
    cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
    touchAction: "none", // prevent scroll while dragging per dnd-kit docs
    userSelect: isDragging ? "none" : undefined,
    WebkitUserSelect: isDragging ? "none" : undefined,
    // オリジナル要素はドラッグ中は透明にしてレイアウトだけ保持（DragOverlayと二重に見えないように）
    ...(isDragging ? { opacity: 0, zIndex: 5 } : null),
  };
  
  return (
    <Box 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      position="relative"
      css={{
        // ドラッグ中の視覚効果
        // ドラッグ中のオリジナル要素は不可視（透明）に留める
        ...(isDragging && {
          pointerEvents: "none",
        }),
        
        // 他のアイテムがホバー中の視覚フィードバック（ベストプラクティス：線なし）
        ...(isOver && !isDragging && {
          backgroundColor: "rgba(255,255,255,0.08)",
          borderColor: "rgba(255,255,255,0.6)",
          transform: "scale(1.01)",
          transition: `transform 0.2s ${UI_TOKENS.EASING.standard}, background-color 0.2s ${UI_TOKENS.EASING.standard}, border-color 0.2s ${UI_TOKENS.EASING.standard}`,
        }),
        
        // ホバー時の微細なフィードバック
        "&:hover:not([data-dragging])": {
          transform: "translateY(-2px)",
          transition: "transform 0.2s ease-out",
        },
      }}
      data-dragging={isDragging ? "true" : undefined}
    >
      {children}
      
    </Box>
  );
}
