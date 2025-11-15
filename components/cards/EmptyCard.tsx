/**
 * 統一空きスロットコンポーネント
 * CentralCardBoardの2箇所の重複を解決する統一実装
 */

"use client";
import React, { useCallback, useEffect, useRef } from "react";
import { UI_TOKENS } from "@/theme/layout";
import { useDroppable } from "@dnd-kit/core";
import { BaseCard } from "./BaseCard";
import type { EmptyCardProps } from "./card.types";
import { gsap } from "gsap";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

// EmptyCardPropsを拡張してidプロパティを追加
interface ExtendedEmptyCardProps extends EmptyCardProps {
  id?: string; // @dnd-kit用のID
  isDragActive?: boolean; // 全体でドラッグが行われているかどうか
  isMagnetTarget?: boolean;
  magnetStrength?: number;
  prefersReducedMotion?: boolean;
}

export function EmptyCard({
  slotNumber,
  totalSlots,
  isDroppable = true,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  id,
  isDragActive = false,
  isMagnetTarget = false,
  magnetStrength = 0,
  prefersReducedMotion = false,
  ...props
}: ExtendedEmptyCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const wasOverRef = useRef(false);

  // 資料推奨: 吸着時の音・触覚フィードバック
  const playDropSuccess = useSoundEffect("drop_success");

  // @dnd-kitのuseDroppable（IDがある場合のみ）
  const { isOver, setNodeRef } = useDroppable({
    id: id || `empty-slot-${slotNumber}`,
    disabled: !isDroppable || !id,
  });

  // 資料推奨: 吸着時のスケールバウンス効果 (1→1.05→1.0) + 音・触覚フィードバック
  useEffect(() => {
    const wasOver = wasOverRef.current;

    // ドロップ完了検知: isOver が true→false に変化した瞬間
    if (wasOver && !isOver) {
      // 音・触覚フィードバックは CentralCardBoard で一元管理するため、ここでは再生しない
      // （２重音の問題を防ぐため）
      // if (!isDragActive && magnetStrength >= 0.85) {
      //   console.log('🎵 EmptyCard playDropSuccess');
      //   playDropSuccess({ volumeMultiplier: 0.7, playbackRate: 1.1 });
      //   try {
      //     if (
      //       typeof navigator !== "undefined" &&
      //       typeof navigator.vibrate === "function"
      //     ) {
      //       navigator.vibrate(8);
      //     }
      //   } catch {
      //     // ignore vibration errors
      //   }
      // }
      if (cardRef.current && !prefersReducedMotion) {
        gsap.timeline()
          .to(cardRef.current, {
            scale: 1.05,
            duration: 0.1,
            ease: "power2.out",
          })
          .to(cardRef.current, {
            scale: 1.0,
            duration: 0.1,
            ease: "back.out(1.7)", // easeOutBack でバウンス感
          });
      }
    }

    wasOverRef.current = isOver;
  }, [
    isOver,
    prefersReducedMotion,
    playDropSuccess,
    isDragActive,
    magnetStrength,
  ]);

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

  // @dnd-kitとHTML5ドラッグ&ドロップの両方に対応 + スケールアニメーション用ref統合
  const combinedRef = useCallback(
    (element: HTMLElement | null) => {
      cardRef.current = element;
      if (id && setNodeRef) {
        setNodeRef(element);
      }
    },
    [id, setNodeRef]
  );

  const transformDuration = prefersReducedMotion ? 0.05 : 0.18;
  const boxShadowDuration = prefersReducedMotion ? 0.05 : 0.2;
  const magnetTimingFunction = prefersReducedMotion ? "linear" : "cubic-bezier(0.2, 0.8, 0.4, 1)";

  return (
    <BaseCard
      ref={combinedRef}
      variant="empty"
      data-slot
      data-magnet-target={isMagnetTarget ? "true" : undefined}
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
        transition: `border-color 0.2s ${UI_TOKENS.EASING.standard}, transform ${transformDuration}s ${prefersReducedMotion ? "linear" : "cubic-bezier(0.25, 0.75, 0.5, 1)"}, box-shadow ${boxShadowDuration}s ${UI_TOKENS.EASING.standard}`,
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
        ...(isDragActive && isDroppable && !isOver && {
          borderColor: "rgba(255, 255, 255, 0.4)",
          boxShadow: "inset 0 0 6px rgba(255, 255, 255, 0.05)",
        }),

        // マグネット候補の視覚強調（段階的な吸着感）
        ...(isMagnetTarget && !isOver && {
          borderColor: `rgba(255, 255, 255, ${0.45 + Math.min(0.45, magnetStrength * 0.55)})`,
          boxShadow: `inset 0 0 ${6 + magnetStrength * 10}px rgba(255, 255, 255, ${0.05 + magnetStrength * 0.25}), 0 0 ${8 + magnetStrength * 12}px rgba(255, 255, 255, ${0.12 + magnetStrength * 0.18})`,
          transform: `scale(${1 + magnetStrength * (prefersReducedMotion ? 0.025 : 0.045)})`,
          transitionTimingFunction: magnetTimingFunction,
        }),

        // ドロップ可能時：ドラクエ風光る効果
        ...(id && isOver && {
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
        <SlotLabel slotNumber={slotNumber} totalSlots={totalSlots} />
      ) : "?")}

      {/* オーバーレイ: isOver 時の視覚強調（リング + ✓） */}
      {id && isOver && (
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

// LOW/HIGHラベルコンポーネント（Octopath風）
function SlotLabel({ slotNumber, totalSlots }: { slotNumber: number; totalSlots?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const diamondTopRef = useRef<HTMLDivElement>(null);
  const diamondBottomRef = useRef<HTMLDivElement>(null);

  // LOW/HIGH判定（1がLOW、最後がHIGH）
  const isLow = slotNumber === 1;
  const isHigh = totalSlots ? slotNumber === totalSlots : false;
  const showLabel = isLow || isHigh;

  useEffect(() => {
    const boxNode = boxRef.current;
    const diamondTopNode = diamondTopRef.current;
    const diamondBottomNode = diamondBottomRef.current;
    if (!showLabel || !boxNode || !diamondTopNode || !diamondBottomNode) {
      return () => undefined;
    }

    // 枠の脈打ちアニメ（非定型値）
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(boxNode, {
      opacity: 0.96,
      duration: 0.87,
      ease: "sine.inOut",
    })
    .to(boxNode, {
      opacity: 0.58,
      duration: 0.93,
      ease: "sine.inOut",
    });

    // ダイヤモンド装飾の回転アニメ（左右非対称）
    gsap.to(diamondTopNode, {
      rotation: 359,
      duration: 4.2,
      repeat: -1,
      ease: "none",
    });

    gsap.to(diamondBottomNode, {
      rotation: -362,
      duration: 3.8,
      repeat: -1,
      ease: "none",
    });

    return () => {
      tl.kill();
      gsap.killTweensOf([boxNode, diamondTopNode, diamondBottomNode]);
    };
  }, [showLabel]);

  if (showLabel) {
    return (
      <div ref={boxRef} style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        position: "relative",
      }}>
        {/* 上部のダイヤモンド装飾 */}
        <div
          ref={diamondTopRef}
          style={{
            position: "absolute",
            top: "-28px",
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: "13px",
            height: "13px",
            background: "rgba(255,255,255,0.88)",
            border: "2px solid rgba(255,255,255,0.95)",
            boxShadow: "0 0 9px rgba(255,255,255,0.7), inset -1px -1px 2px rgba(0,0,0,0.3)",
          }}
        />

        {/* LOWまたはHIGH */}
        <span style={{
          color: "rgba(255,255,255,0.92)",
          fontSize: "18px",
          fontWeight: "800",
          fontFamily: "monospace",
          textShadow: "0 0 8px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.9), 1px 1px 0px #000",
          letterSpacing: "0.083em",
        }}>
          {isLow ? "LOW" : "HIGH"}
        </span>

        {/* (小) または (大) */}
        <span style={{
          color: "rgba(255,255,255,0.58)",
          fontSize: "11px",
          fontWeight: "600",
          fontFamily: "monospace",
          textShadow: "1px 1px 0px #000",
          letterSpacing: "0.021em",
        }}>
          {isLow ? "(小)" : "(大)"}
        </span>

        {/* 下部のダイヤモンド装飾 */}
        <div
          ref={diamondBottomRef}
          style={{
            position: "absolute",
            bottom: "-26px",
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: "11px",
            height: "11px",
            background: "rgba(255,255,255,0.85)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 0 7px rgba(255,255,255,0.65), inset -1px -1px 2px rgba(0,0,0,0.28)",
          }}
        />
      </div>
    );
  }

  // 通常のスロット番号
  return (
    <span style={{
      color: "rgba(255, 255, 255, 0.7)",
      fontSize: "16px",
      fontWeight: "bold",
      fontFamily: "monospace",
      textShadow: "1px 1px 0px #000",
      letterSpacing: "0.93px",
    }}>
      {slotNumber}
    </span>
  );
}

export default EmptyCard;
