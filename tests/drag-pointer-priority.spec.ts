/**
 * ドラッグ操作でポインター座標が最優先されることを確認する E2E テスト
 * 左端スロットへの誤吸着を防ぐ
 */

import { test, expect } from "@playwright/test";

test.describe("ドラッグ操作のポインター座標優先", () => {
  test.beforeEach(async ({ page }) => {
    // テスト用ルームへ移動
    await page.goto("/rooms/test-room");
    await page.waitForTimeout(1000); // 初期化待ち
  });

  test("複数の空きスロットがある状態で、カーソル位置のスロットが直接選ばれる", async ({ page }) => {
    // ボード要素が存在することを確認
    const boardRoot = page.locator("[data-board-root]");
    await expect(boardRoot).toBeVisible();

    // 空きスロット（EmptyCard）を取得
    const emptySlots = page.locator("[data-slot]");
    const slotCount = await emptySlots.count();

    // 最低3つのスロットが必要（左端、中央、右端）
    if (slotCount < 3) {
      test.skip();
      return;
    }

    // 各スロットの位置を取得
    const slotPositions = await Promise.all(
      Array.from({ length: slotCount }, async (_, i) => {
        const slot = emptySlots.nth(i);
        const box = await slot.boundingBox();
        return {
          index: i,
          id: await slot.getAttribute("id"),
          box,
          centerX: box ? box.x + box.width / 2 : 0,
          centerY: box ? box.y + box.height / 2 : 0,
        };
      })
    );

    // 左端と右端のスロットを特定
    const leftmostSlot = slotPositions.reduce((prev, curr) =>
      curr.centerX < prev.centerX ? curr : prev
    );
    const rightmostSlot = slotPositions.reduce((prev, curr) =>
      curr.centerX > prev.centerX ? curr : prev
    );

    // 待機カード（draggable）を取得
    const waitingCards = page.locator('[draggable="true"]');
    const cardCount = await waitingCards.count();

    if (cardCount === 0) {
      test.skip(); // ドラッグ可能なカードがない場合はスキップ
      return;
    }

    // 最初のカードを取得
    const firstCard = waitingCards.first();
    const cardBox = await firstCard.boundingBox();

    if (!cardBox || !rightmostSlot.box) {
      test.skip();
      return;
    }

    // カードを右端スロットへドラッグ
    // ポインターを右端スロット中心に持っていく
    await firstCard.hover();
    await page.mouse.down();

    // 右端スロットの中心へマウスを移動
    await page.mouse.move(rightmostSlot.centerX, rightmostSlot.centerY, { steps: 10 });
    await page.waitForTimeout(300); // magnet が効くまで待つ

    // 右端スロットが magnet ターゲットになっていることを確認
    const rightSlotElement = page.locator(`#${rightmostSlot.id}`);
    const isMagnetTarget = await rightSlotElement.getAttribute("data-magnet-target");

    // magnet-target 属性が "true" になっているか確認
    // （左端スロットではなく、カーソル位置の右端スロットが選ばれている）
    expect(isMagnetTarget).toBe("true");

    // 念のため左端スロットが magnet ターゲットでないことを確認
    const leftSlotElement = page.locator(`#${leftmostSlot.id}`);
    const leftIsMagnetTarget = await leftSlotElement.getAttribute("data-magnet-target");
    expect(leftIsMagnetTarget).not.toBe("true");

    await page.mouse.up();
  });

  test("ドラッグ中にカーソルを移動すると、magnet ターゲットが追従する", async ({ page }) => {
    const boardRoot = page.locator("[data-board-root]");
    await expect(boardRoot).toBeVisible();

    const emptySlots = page.locator("[data-slot]");
    const slotCount = await emptySlots.count();

    if (slotCount < 2) {
      test.skip();
      return;
    }

    // 最初の2つのスロットを取得
    const slot0 = emptySlots.nth(0);
    const slot1 = emptySlots.nth(1);

    const box0 = await slot0.boundingBox();
    const box1 = await slot1.boundingBox();

    if (!box0 || !box1) {
      test.skip();
      return;
    }

    const center0 = { x: box0.x + box0.width / 2, y: box0.y + box0.height / 2 };
    const center1 = { x: box1.x + box1.width / 2, y: box1.y + box1.height / 2 };

    // 待機カードを取得
    const waitingCards = page.locator('[draggable="true"]');
    const cardCount = await waitingCards.count();

    if (cardCount === 0) {
      test.skip();
      return;
    }

    const firstCard = waitingCards.first();
    await firstCard.hover();
    await page.mouse.down();

    // まず slot-0 へ移動
    await page.mouse.move(center0.x, center0.y, { steps: 5 });
    await page.waitForTimeout(200);

    // slot-0 が magnet ターゲットになっていることを確認
    const slot0Id = await slot0.getAttribute("id");
    if (slot0Id) {
      const slot0Element = page.locator(`#${slot0Id}`);
      const isMagnetTarget0 = await slot0Element.getAttribute("data-magnet-target");
      expect(isMagnetTarget0).toBe("true");
    }

    // 次に slot-1 へ移動
    await page.mouse.move(center1.x, center1.y, { steps: 5 });
    await page.waitForTimeout(200);

    // slot-1 が magnet ターゲットになっていることを確認
    const slot1Id = await slot1.getAttribute("id");
    if (slot1Id) {
      const slot1Element = page.locator(`#${slot1Id}`);
      const isMagnetTarget1 = await slot1Element.getAttribute("data-magnet-target");
      expect(isMagnetTarget1).toBe("true");
    }

    // slot-0 は magnet ターゲットでなくなっている
    if (slot0Id) {
      const slot0Element = page.locator(`#${slot0Id}`);
      const isMagnetTarget0After = await slot0Element.getAttribute("data-magnet-target");
      expect(isMagnetTarget0After).not.toBe("true");
    }

    await page.mouse.up();
  });

  test("ポインターがボード外に出ると、magnet がリリースされる", async ({ page }) => {
    const boardRoot = page.locator("[data-board-root]");
    await expect(boardRoot).toBeVisible();

    const waitingCards = page.locator('[draggable="true"]');
    const cardCount = await waitingCards.count();

    if (cardCount === 0) {
      test.skip();
      return;
    }

    const firstCard = waitingCards.first();
    const boardBox = await boardRoot.boundingBox();

    if (!boardBox) {
      test.skip();
      return;
    }

    await firstCard.hover();
    await page.mouse.down();

    // ボード中心へ移動（magnet が効く）
    const boardCenterX = boardBox.x + boardBox.width / 2;
    const boardCenterY = boardBox.y + boardBox.height / 2;
    await page.mouse.move(boardCenterX, boardCenterY, { steps: 5 });
    await page.waitForTimeout(200);

    // magnet ターゲットがあることを確認
    const magnetTargets = page.locator("[data-magnet-target='true']");
    const targetCountBefore = await magnetTargets.count();
    expect(targetCountBefore).toBeGreaterThan(0);

    // ボード外（下方）へ移動
    const outsideY = boardBox.y + boardBox.height + 100;
    await page.mouse.move(boardCenterX, outsideY, { steps: 5 });
    await page.waitForTimeout(200);

    // magnet ターゲットがなくなっていることを確認
    const targetCountAfter = await magnetTargets.count();
    expect(targetCountAfter).toBe(0);

    await page.mouse.up();
  });
});
