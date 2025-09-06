/**
 * 統一空きスロットコンポーネント
 * CentralCardBoardの2箇所の重複を解決する統一実装
 */

import { BaseCard } from "./BaseCard";
import type { EmptyCardProps } from "./card.types";

export function EmptyCard({
  slotNumber,
  isDroppable = true,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  ...props
}: EmptyCardProps) {
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

  return (
    <BaseCard
      variant="empty"
      data-slot
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      cursor={isDroppable ? "copy" : "not-allowed"}
      {...props}
    >
      {children || (slotNumber !== undefined ? slotNumber : "?")}
    </BaseCard>
  );
}

export default EmptyCard;