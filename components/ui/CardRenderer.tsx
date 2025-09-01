import GameCard from "@/components/ui/GameCard";
import type { PlayerDoc } from "@/lib/types";

interface CardRendererProps {
  id: string;
  player: (PlayerDoc & { id: string }) | undefined;
  idx?: number;
  orderList?: string[];
  pending: string[];
  proposal?: string[];
  resolveMode?: string;
  roomStatus?: string;
  revealIndex: number;
  revealAnimating: boolean;
  failed?: boolean;
  failedAt?: number | null;
  localFailedAt?: number | null;
}

export function CardRenderer({
  id,
  player,
  idx,
  orderList,
  pending,
  proposal,
  resolveMode,
  roomStatus,
  revealIndex,
  revealAnimating,
  failed,
  failedAt,
  localFailedAt,
}: CardRendererProps) {
  const number = player?.number;
  const isPlaced =
    (orderList || []).includes(id) ||
    pending.includes(id) ||
    (proposal || []).includes(id);

  const numberVisibleBase = typeof number === "number" && isPlaced;
  let showNumber = numberVisibleBase;

  // 🎮 一括モードの正しい数字表示ロジック
  if (resolveMode === "sort-submit") {
    if (roomStatus === "finished") {
      // ゲーム終了時は全て表示
      showNumber = numberVisibleBase;
    } else if (
      roomStatus === "reveal" &&
      revealAnimating &&
      typeof idx === "number"
    ) {
      // リビール演出中は順次表示
      showNumber = numberVisibleBase && idx < revealIndex;
    } else {
      // 配置時は連想ワードのまま（数字は隠す）
      showNumber = false;
    }
  }

  // 順次モードの場合はrevealAnimating処理
  if (
    revealAnimating &&
    typeof idx === "number" &&
    resolveMode !== "sort-submit"
  ) {
    showNumber = idx < revealIndex;
  }

  const effectiveFailedAt = localFailedAt ?? failedAt;

  const failureConfirmed = (() => {
    if (typeof effectiveFailedAt !== "number") return false;
    if (resolveMode === "sort-submit") {
      if (roomStatus === "finished") return !!failed;
      return revealIndex >= effectiveFailedAt;
    }
    return true;
  })();

  const cardIsRevealed =
    resolveMode === "sort-submit"
      ? typeof idx === "number" &&
        (roomStatus === "finished" ||
          (roomStatus === "reveal" && idx < revealIndex))
      : isPlaced;

  // Only surface success/fail coloring while reveal animation is active or after
  // the reveal is finalized (finished). This prevents a brief "all red" flash
  // immediately when the room status flips to 'reveal' before the client-side
  // animation index is initialized.
  const animationActive = roomStatus === "finished" || revealAnimating;
  const shouldShowGreen =
    cardIsRevealed && !failureConfirmed && animationActive;
  const shouldShowRed = cardIsRevealed && failureConfirmed && animationActive;

  // 🎮 UNIFIED CARD DESIGN: すべてのモードでflat variantに統一
  // 一括モードも順次モードも同じGameCardデザインを使用
  return (
    <GameCard
      key={id}
      variant="flat"
      index={typeof idx === "number" ? idx : null}
      name={player?.name}
      clue={
        resolveMode === "sort-submit" && roomStatus !== "finished"
          ? player?.clue1 || "(連想待ち)"
          : player?.clue1
      }
      number={showNumber && typeof number === "number" ? number : null}
      state={shouldShowRed ? "fail" : shouldShowGreen ? "success" : "default"}
    />
  );
}
