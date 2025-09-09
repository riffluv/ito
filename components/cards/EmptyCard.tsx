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
        // ベース状態：ドラクエ風の点線ボーダーで空きスロットを明確に
        border: "2px dashed rgba(255,255,255,0.3)",
        borderRadius: "8px",
        backgroundColor: "rgba(8,9,15,0.6)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        
        // ホバー状態を見えやすく
        "&:hover": {
          borderColor: "rgba(255,255,255,0.5)",
          backgroundColor: "rgba(8,9,15,0.8)",
          transform: "scale(1.02)",
        },

        // @dnd-kitのisOver状態での強化されたドロップフィードバック
        ...(id && dndDroppable.isOver && {
          backgroundColor: "rgba(74,158,255,0.15)",
          borderColor: "#4a9eff",
          borderStyle: "solid",
          transform: "scale(1.05)",
          boxShadow: "0 0 20px rgba(74,158,255,0.4), inset 0 0 20px rgba(74,158,255,0.1)",
          // ドロップ可能を示すアニメーション効果
          "&::before": {
            content: '""',
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            backgroundColor: "rgba(74,158,255,0.4)",
            animation: "dropPulse 1.5s ease-in-out infinite",
          },
          "&::after": {
            content: '"ここに配置"',
            position: "absolute",
            bottom: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "10px",
            color: "#4a9eff",
            fontWeight: "600",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
          }
        }),
      }}
      {...props}
    >
      {children || (slotNumber !== undefined ? (
        <span style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: "14px",
          fontWeight: "500",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)"
        }}>
          {slotNumber}
        </span>
      ) : "?")}
      
      {/* ドロップパルス アニメーション定義 */}
      <style>{`
        @keyframes dropPulse {
          0%, 100% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }
      `}</style>
    </BaseCard>
  );
}

export default EmptyCard;