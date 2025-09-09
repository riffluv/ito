/**
 * 統一空きスロットコンポーネント
 * CentralCardBoardの2箇所の重複を解決する統一実装
 */

"use client";
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { BaseCard } from "./BaseCard";
import type { EmptyCardProps } from "./card.types";

// EmptyCardPropsを拡張してidプロパティを追加
interface ExtendedEmptyCardProps extends EmptyCardProps {
  id?: string; // @dnd-kit用のID
}

export function EmptyCard({
  slotNumber,
  isDroppable = true,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  id,
  ...props
}: ExtendedEmptyCardProps) {
  // @dnd-kitのuseDroppable（IDがある場合のみ）
  const dndDroppable = useDroppable({
    id: id || `empty-slot-${slotNumber}`,
    disabled: !isDroppable || !id,
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver?.(e);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // 子要素への移動ではリセットしない
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragLeave?.(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop?.(e);
  };

  // @dnd-kitとHTML5ドラッグ&ドロップの両方に対応
  const combinedRef = (element: HTMLElement | null) => {
    if (id && dndDroppable.setNodeRef) {
      dndDroppable.setNodeRef(element);
    }
  };

  return (
    <BaseCard
      ref={combinedRef}
      variant="empty"
      data-slot
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      cursor={isDroppable ? "copy" : "not-allowed"}
      css={{
        // @dnd-kitのisOver状態でのスタイル
        ...(id && dndDroppable.isOver && {
          backgroundColor: "rgba(74,158,255,0.1)",
          borderColor: "rgba(74,158,255,0.6)",
          transform: "scale(1.02)",
        }),
      }}
      {...props}
    >
      {children || (slotNumber !== undefined ? slotNumber : "?")}
    </BaseCard>
  );
}

export default EmptyCard;