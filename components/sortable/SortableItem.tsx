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
    isOver,
  } = useSortable({ id, disabled });
  
  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition, // ドラッグ中は滑らかな移動のためtransition無効
    cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
    touchAction: "none", // prevent scroll while dragging per dnd-kit docs
    userSelect: isDragging ? "none" : undefined,
    WebkitUserSelect: isDragging ? "none" : undefined,
    ...(isDragging ? { zIndex: 5 } : null),
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
        ...(isDragging && {
          opacity: 0.6,
          transform: `${style.transform} scale(1.05)`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          filter: "brightness(1.1)",
        }),
        
        // 他のアイテムがホバー中の挿入位置表示
        ...(isOver && !isDragging && {
          "&::before": {
            content: '""',
            position: "absolute",
            left: "-8px",
            top: "0",
            bottom: "0",
            width: "4px",
            backgroundColor: "#4a9eff",
            borderRadius: "2px",
            boxShadow: "0 0 8px rgba(74,158,255,0.6)",
            zIndex: 10,
            animation: "insertIndicator 1s ease-in-out infinite alternate",
          },
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
      
      {/* アニメーション定義 */}
      <style>{`
        @keyframes insertIndicator {
          0% {
            opacity: 0.8;
          }
          100% {
            opacity: 1;
            box-shadow: 0 0 12px rgba(74,158,255,0.8);
          }
        }
      `}</style>
    </Box>
  );
}
