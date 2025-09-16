/**
 * 統一空きスロットコンポーネント
 * CentralCardBoardの2箇所の重複を解決する統一実装
 */

"use client";
import React from "react";
import { UI_TOKENS } from "@/theme/layout";
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
        // ベース状態：魔法陣に合わせた紫系の点線ボーダー
        border: `2px dashed rgba(167, 139, 250, 0.4)`,
        borderRadius: "8px",
        backgroundColor: "linear-gradient(135deg, rgba(139, 69, 197, 0.08), rgba(67, 56, 202, 0.05))",
        boxShadow: `
          inset 0 0 12px rgba(139, 69, 197, 0.15),
          0 0 8px rgba(167, 139, 250, 0.2),
          0 2px 8px rgba(0, 0, 0, 0.1)
        `,
        transition:
          "background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        
        // ホバー状態：魔法陣風のグロー効果
        "&:hover": {
          borderColor: "rgba(167, 139, 250, 0.7)",
          backgroundColor: "linear-gradient(135deg, rgba(139, 69, 197, 0.15), rgba(67, 56, 202, 0.12))",
          transform: "scale(1.02)",
          boxShadow: `
            inset 0 0 20px rgba(139, 69, 197, 0.25),
            0 0 16px rgba(167, 139, 250, 0.4),
            0 4px 20px rgba(0, 0, 0, 0.2)
          `,
        },

        // ドラッグ中の状態：ドロップ可能なスロットを微かに示唆
        ...(isDragActive && isDroppable && !dndDroppable.isOver && {
          borderColor: UI_TOKENS.COLORS.purpleAlpha30,
          backgroundColor: UI_TOKENS.COLORS.purpleAlpha02,
          // アニメーションなしで、静的な状態表示
        }),

        // @dnd-kitのisOver状態での洗練されたドロップフィードバック（テキストや矢印は表示しない）
        ...(id && dndDroppable.isOver && {
          backgroundColor: UI_TOKENS.COLORS.purpleAlpha15,
          borderColor: UI_TOKENS.COLORS.purpleAlpha80,
          borderWidth: "3px",
          borderStyle: "solid",
          transform: "scale(1.08)",
          animation: "dragonQuestDrop 0.8s ease-in-out infinite",
          boxShadow: `${UI_TOKENS.SHADOWS.activeArea}, 0 0 0 6px ${UI_TOKENS.COLORS.purpleAlpha15}`,
        }),

        // ドロップ不可のスロット上にドラッグ中の視覚フィードバック
        ...(!isDroppable && isDragActive && {
          borderColor: UI_TOKENS.COLORS.whiteAlpha40,
          backgroundColor: "rgba(0,0,0,0.2)",
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.3)",
          cursor: "not-allowed",
        }),
      }}
      {...props}
    >
      {children || (slotNumber !== undefined ? (
        <span style={{
          color: "rgba(196, 181, 253, 0.8)",
          fontSize: "14px",
          fontWeight: "500",
          textShadow: "0 0 8px rgba(139, 69, 197, 0.6)"
        }}>
          {slotNumber}
        </span>
      ) : "?")}

      {/* オーバーレイ: isOver 時の視覚強調（リング + ✓） */}
      {id && dndDroppable.isOver && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            color: "white",
            fontWeight: 800,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            fontFamily: "monospace",
          }}
        >
          ✓
        </span>
      )}

      {/* オーバーレイ: ドロップ不可の明示 */}
      {!isDroppable && isDragActive && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            color: "#ffdddd",
            fontWeight: 800,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            fontFamily: "monospace",
            opacity: 0.9,
          }}
        >
          ×
        </span>
      )}
      
      {/* ドラクエ風アニメーション定義 */}
      <style>{`
        @keyframes dragonQuestReady {
          0%, 100% {
            border-color: ${UI_TOKENS.COLORS.purpleAlpha40};
            box-shadow: inset 0 0 8px ${UI_TOKENS.COLORS.purpleAlpha15}, 0 2px 8px ${UI_TOKENS.COLORS.blackAlpha20};
          }
          50% {
            border-color: ${UI_TOKENS.COLORS.purpleAlpha80};
            box-shadow: inset 0 0 12px ${UI_TOKENS.COLORS.purpleAlpha30}, 0 2px 12px ${UI_TOKENS.COLORS.purpleAlpha15};
          }
        }
        
        @keyframes dragonQuestDrop {
          0%, 100% {
            box-shadow: inset 0 0 12px ${UI_TOKENS.COLORS.purpleAlpha40}, 0 6px 18px ${UI_TOKENS.COLORS.purpleAlpha30}, 0 0 28px ${UI_TOKENS.COLORS.purpleAlpha15};
            transform: scale(1.08);
          }
          50% {
            box-shadow: inset 0 0 20px ${UI_TOKENS.COLORS.purpleAlpha60}, 0 6px 22px ${UI_TOKENS.COLORS.purpleAlpha40}, 0 0 34px ${UI_TOKENS.COLORS.purpleAlpha30};
            transform: scale(1.12);
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
