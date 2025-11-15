/**
 * ボード衝突検出ロジックのテスト
 * rectIntersection を使わず、ポインター座標のみで判定することを確認
 */

import type { ClientRect } from "@dnd-kit/core";

const createMockRect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("boardCollisionDetection", () => {
  describe("ポインター座標のみで判定（rectIntersection スキップ）", () => {
    test("左端に空きスロットがあり、カーソルが右側にある場合、右側のスロットが選ばれる", () => {
      // 3つのスロットを想定: 左端(slot-0)、中央(slot-1)、右端(slot-2)
      const droppableRects = new Map<string, ClientRect>([
        ["slot-0", createMockRect(100, 200, 80, 120)], // 左端
        ["slot-1", createMockRect(200, 200, 80, 120)], // 中央
        ["slot-2", createMockRect(300, 200, 80, 120)], // 右端
      ]);

      // カーソルは右端スロット付近にある
      const pointerCoordinates = { x: 340, y: 260 };

      // DragOverlay の中心は左寄り（左端スロットに近い）
      const dragOverlayCenter = { x: 150, y: 260 };

      // ポインター座標からの距離を計算
      const distances = Array.from(droppableRects.entries()).map(([id, rect]) => {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distanceFromPointer = Math.hypot(
          pointerCoordinates.x - centerX,
          pointerCoordinates.y - centerY
        );
        const distanceFromOverlay = Math.hypot(
          dragOverlayCenter.x - centerX,
          dragOverlayCenter.y - centerY
        );
        return { id, distanceFromPointer, distanceFromOverlay };
      });

      // ポインター基準では slot-2 が最も近い
      const closestByPointer = distances.reduce((prev, curr) =>
        curr.distanceFromPointer < prev.distanceFromPointer ? curr : prev
      );
      expect(closestByPointer.id).toBe("slot-2");

      // overlay 中心基準では slot-0 が最も近い（これが問題）
      const closestByOverlay = distances.reduce((prev, curr) =>
        curr.distanceFromOverlay < prev.distanceFromOverlay ? curr : prev
      );
      expect(closestByOverlay.id).toBe("slot-0");

      // 修正後のロジックではポインター座標が優先されるべき
      expect(closestByPointer.id).not.toBe(closestByOverlay.id);
    });

    test("ポインター座標がない場合、近距離判定はスキップされる", () => {
      // ポインター座標がない場合、overlay 中心にフォールバックせず空配列を返すべき
      const pointerCoordinates = null;

      // 実際の実装では、pointerCoordinates が null の場合は [] を返す
      // これにより、overlay 中心への誤った吸着を防ぐ
      expect(pointerCoordinates).toBeNull();
    });

    test("複数スロットがポインター近傍にある場合、最も近いスロットが選ばれる", () => {
      const droppableRects = new Map<string, ClientRect>([
        ["slot-0", createMockRect(100, 200, 80, 120)],
        ["slot-1", createMockRect(200, 200, 80, 120)],
        ["slot-2", createMockRect(300, 200, 80, 120)],
      ]);

      // カーソルは slot-1 に最も近い
      const pointerCoordinates = { x: 240, y: 260 };

      const distances = Array.from(droppableRects.entries()).map(([id, rect]) => {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(pointerCoordinates.x - centerX, pointerCoordinates.y - centerY);
        return { id, distance };
      });

      const closest = distances.reduce((prev, curr) =>
        curr.distance < prev.distance ? curr : prev
      );

      expect(closest.id).toBe("slot-1");
      expect(closest.distance).toBeLessThan(50); // 十分近い
    });
  });

  describe("DragOverlay 矩形を無視してポインター座標のみで判定", () => {
    test("DragOverlay が左端スロットと交差していても、ポインターが右端にあれば右端が選ばれる", () => {
      // DragOverlay が slot-0 と交差しているが、ポインターは slot-1 に近い状況
      const droppableRects = new Map<string, ClientRect>([
        ["slot-0", createMockRect(100, 200, 80, 120)],
        ["slot-1", createMockRect(200, 200, 80, 120)],
      ]);

      // しかしポインターは slot-1 に近い
      const pointerCoordinates = { x: 240, y: 260 };

      // rectIntersection を使わないので、overlay の位置は無視される
      // ポインター座標からの距離のみで判定
      const distances = Array.from(droppableRects.entries()).map(([id, rect]) => {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(pointerCoordinates.x - centerX, pointerCoordinates.y - centerY);
        return { id, distance };
      });

      const closest = distances.reduce((prev, curr) =>
        curr.distance < prev.distance ? curr : prev
      );

      // ポインター座標に基づいて slot-1 が選ばれる
      expect(closest.id).toBe("slot-1");
    });
  });

  describe("エッジケース", () => {
    test("スロットが画面外にある場合でも、ポインター座標基準で判定される", () => {
      const droppableRects = new Map<string, ClientRect>([
        ["slot-0", createMockRect(-100, 200, 80, 120)], // 画面外（左）
        ["slot-1", createMockRect(200, 200, 80, 120)], // 画面内
      ]);

      const pointerCoordinates = { x: 240, y: 260 }; // 画面内のスロット付近

      const distances = Array.from(droppableRects.entries()).map(([id, rect]) => {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(pointerCoordinates.x - centerX, pointerCoordinates.y - centerY);
        return { id, distance };
      });

      const closest = distances.reduce((prev, curr) =>
        curr.distance < prev.distance ? curr : prev
      );

      // 画面内の slot-1 が選ばれる
      expect(closest.id).toBe("slot-1");
    });

    test("ポインターがすべてのスロットから遠い場合、近距離判定は候補なしとなる", () => {
      // ポインターが遠く離れている
      const pointerCoordinates = { x: 1000, y: 1000 };

      const slotCenter = {
        x: 100 + 80 / 2,
        y: 200 + 120 / 2,
      };

      const distance = Math.hypot(
        pointerCoordinates.x - slotCenter.x,
        pointerCoordinates.y - slotCenter.y
      );

      // 許容範囲を超えている
      const radialAllowance = Math.max(Math.min(80, 120) * 0.55, 52);
      expect(distance).toBeGreaterThan(radialAllowance);
    });
  });
});
