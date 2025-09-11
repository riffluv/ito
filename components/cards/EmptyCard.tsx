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
  isDragActive?: boolean; // 全体でドラッグが行われているかどうか
}

export function EmptyCard({
  slotNumber,
  isDroppable = true,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  id,
  isDragActive = false,
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
        transition:
          "background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        
        // ホバー状態を見えやすく
        "&:hover": {
          borderColor: "rgba(255,255,255,0.5)",
          backgroundColor: "rgba(8,9,15,0.8)",
          transform: "scale(1.02)",
        },

        // ドラッグ中の状態：ドロップ可能なスロットを微かに示唆
        ...(isDragActive && isDroppable && !dndDroppable.isOver && {
          borderColor: "rgba(139, 92, 246, 0.3)", // より控えめな色で
          backgroundColor: "rgba(139, 92, 246, 0.02)", // さらに微かに
          // アニメーションなしで、静的な状態表示
        }),

        // @dnd-kitのisOver状態での洗練されたドロップフィードバック（テキストや矢印は表示しない）
        ...(id && dndDroppable.isOver && {
          backgroundColor: "rgba(139, 92, 246, 0.15)", // 紫ベース
          borderColor: "rgba(139, 92, 246, 0.9)",
          borderStyle: "solid",
          transform: "scale(1.05)", // より明確なスケール
          animation: "dragonQuestDrop 0.8s ease-in-out infinite",
          // ドラクエ風の強い光る効果（テキスト装飾は削除）
          boxShadow: "inset 0 0 12px rgba(139, 92, 246, 0.4), 0 4px 16px rgba(139, 92, 246, 0.3), 0 0 24px rgba(139, 92, 246, 0.2)",
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
      
      {/* ドラクエ風アニメーション定義 */}
      <style>{`
        @keyframes dragonQuestReady {
          0%, 100% {
            border-color: rgba(139, 92, 246, 0.4);
            box-shadow: inset 0 0 8px rgba(139, 92, 246, 0.1), 0 2px 8px rgba(0,0,0,0.1);
          }
          50% {
            border-color: rgba(139, 92, 246, 0.8);
            box-shadow: inset 0 0 12px rgba(139, 92, 246, 0.3), 0 2px 12px rgba(139, 92, 246, 0.15);
          }
        }
        
        @keyframes dragonQuestDrop {
          0%, 100% {
            box-shadow: inset 0 0 12px rgba(139, 92, 246, 0.4), 0 4px 16px rgba(139, 92, 246, 0.3), 0 0 24px rgba(139, 92, 246, 0.2);
            transform: scale(1.05);
          }
          50% {
            box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.6), 0 4px 20px rgba(139, 92, 246, 0.4), 0 0 32px rgba(139, 92, 246, 0.3);
            transform: scale(1.08);
          }
        }
        
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
