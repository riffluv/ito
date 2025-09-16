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
        // ドラクエ風ベース状態：完全透明背景 + 古い石板の破線枠
        background: "transparent", // 完全透明でHD-2D背景を活かす
        border: "3px dashed rgba(255, 255, 255, 0.3)", // 古い石板の破線
        borderRadius: 0, // 角ばったドラクエ風
        // ドラクエ風シンプル遷移
        transition: `border-color 0.2s ${UI_TOKENS.EASING.standard}, transform 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.2s ${UI_TOKENS.EASING.standard}`,
        position: "relative",

        // 古い遺跡っぽい内側装飾
        "&::before": {
          content: '""',
          position: "absolute",
          top: "6px",
          left: "6px",
          right: "6px",
          bottom: "6px",
          border: "1px dotted rgba(255, 255, 255, 0.15)",
          borderRadius: 0,
        },

        // ホバー状態：古い石が光る感じ
        "&:hover": {
          borderColor: "rgba(255, 255, 255, 0.6)",
          transform: "scale(1.02)",
          boxShadow: "inset 0 0 8px rgba(255, 255, 255, 0.1)",
        },

        // ドラッグ中の状態：ドロップ可能を控えめに表示
        ...(isDragActive && isDroppable && !dndDroppable.isOver && {
          borderColor: "rgba(255, 255, 255, 0.4)",
          boxShadow: "inset 0 0 6px rgba(255, 255, 255, 0.05)",
        }),

        // ドロップ可能時：ドラクエ風光る効果
        ...(id && dndDroppable.isOver && {
          borderColor: "rgba(255, 255, 255, 0.9)",
          borderWidth: "3px",
          borderStyle: "solid", // 実線に変更
          transform: "scale(1.05)",
          boxShadow: `
            inset 0 0 12px rgba(255, 255, 255, 0.2),
            0 0 8px rgba(255, 255, 255, 0.3),
            ${UI_TOKENS.SHADOWS.panelDistinct}
          `,
          animation: "dragonQuestGlow 1s ease-in-out infinite", // 新しいアニメーション
        }),

        // ドロップ不可：暗くしてわかりやすく
        ...(!isDroppable && isDragActive && {
          borderColor: "rgba(255, 255, 255, 0.2)",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.4)",
          cursor: "not-allowed",
        }),
      }}
      {...props}
    >
      {children || (slotNumber !== undefined ? (
        <span style={{
          color: "rgba(255, 255, 255, 0.7)", // ドラクエ風白文字
          fontSize: "16px", // 少し大きく
          fontWeight: "bold", // 太字でドラクエ風
          fontFamily: "monospace", // ドラクエ風フォント統一
          textShadow: "1px 1px 0px #000", // ドラクエ風テキストシャドウ
          letterSpacing: "1px" // 文字間隔
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
        @keyframes dragonQuestGlow {
          0%, 100% {
            border-color: rgba(255, 255, 255, 0.9);
            box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.2), 0 0 8px rgba(255, 255, 255, 0.3), ${UI_TOKENS.SHADOWS.panelDistinct};
            transform: scale(1.05);
          }
          50% {
            border-color: rgba(255, 255, 255, 1.0);
            box-shadow: inset 0 0 16px rgba(255, 255, 255, 0.3), 0 0 12px rgba(255, 255, 255, 0.4), ${UI_TOKENS.SHADOWS.panelDistinct};
            transform: scale(1.08);
          }
        }
      `}</style>
    </BaseCard>
  );
}

export default EmptyCard;
