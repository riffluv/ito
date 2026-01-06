import {
  closestCenter,
  pointerWithin,
  type Collision,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";

export const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length) {
    return pointerHits;
  }

  const { droppableRects, pointerCoordinates } = args;
  if (pointerCoordinates) {
    const candidates: { id: UniqueIdentifier; value: number }[] = [];
    droppableRects.forEach((rect, id) => {
      const dropCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const dx = pointerCoordinates.x - dropCenter.x;
      const dy = pointerCoordinates.y - dropCenter.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const axisAllowanceX = Math.max(rect.width * 0.45, 36);
      const axisAllowanceY = Math.max(rect.height * 0.4, 42);
      if (absDx > axisAllowanceX || absDy > axisAllowanceY) {
        return;
      }

      const radialAllowance = Math.max(Math.min(rect.width, rect.height) * 0.55, 52);
      const distance = Math.hypot(dx, dy);
      if (distance > radialAllowance) {
        return;
      }

      candidates.push({ id, value: distance });
    });

    if (candidates.length) {
      candidates.sort((a, b) => a.value - b.value);
      const best = candidates[0];
      const collision: Collision = { id: best.id, data: { value: best.value } };
      return [collision];
    }

    // マウス/タッチ位置が存在し、近接候補も無い場合は「未ヒット」とみなす
    // （1人部屋で唯一のスロットが常に選ばれる暴走を防止）
    return [];
  }

  // キーボード操作など pointerCoordinates が無い場合のみフォールバック
  return closestCenter(args);
};

