/**
 * 統一カード型定義
 * 全てのカードコンポーネントで共通して使用する型定義
 */

import type { BoxProps } from "@chakra-ui/react";
import type { CardStyleVariant, CardSize } from "./card.styles";

// ベースカードプロパティ
export interface BaseCardProps extends Omit<BoxProps, "variant" | "size"> {
  variant?: CardStyleVariant;
  size?: CardSize;
  index?: number;
  "data-testid"?: string;
}

// 空きスロットカードプロパティ
export interface EmptyCardProps extends BaseCardProps {
  variant?: "empty";
  slotNumber?: number;
  totalSlots?: number; // 全スロット数（LOW/HIGH判定用）
  isDroppable?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

// ゲームカードプロパティ
export interface GameCardProps extends BaseCardProps {
  variant?: "game";
  name?: string;
  clue?: string;
  number?: number | null;
  state?: "default" | "success" | "fail";
  successLevel?: "mild" | "final";
  boundary?: boolean;
  flipped?: boolean;
  waitingInCentral?: boolean;
}

// 数字カードプロパティ
export interface NumberCardProps extends BaseCardProps {
  variant?: "number";
  value: number | null | undefined;
  label?: string;
  draggableId?: string;
  onDragStart?: (e: React.DragEvent) => void;
}