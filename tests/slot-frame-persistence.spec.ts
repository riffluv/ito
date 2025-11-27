/**
 * 待機エリアから 2/3 番目のスロットへドラッグしても、左端スロット枠が DOM から消えないことを検証する E2E
 * 以前は EmptyCard/SortableItem の切り替えで slot-0 が一瞬アンマウントし点滅していた。
 */

import { expect, test } from "@playwright/test";

test.describe("スロット枠の持続性", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rooms/test-room");
    await page.waitForTimeout(1000); // 初期化待ち
  });

  test("待機→スロット2/3へのドロップ中も slot-0 が DOM に残る", async ({ page }) => {
    const boardRoot = page.locator("[data-board-root]");
    await expect(boardRoot).toBeVisible();

    const slots = page.locator("[data-slot]");
    const slotCount = await slots.count();
    if (slotCount < 3) {
      test.skip();
      return;
    }

    const leftSlot = slots.first();
    const leftHandle = await leftSlot.elementHandle();
    if (!leftHandle) {
      test.skip();
      return;
    }
    const leftId = await leftSlot.getAttribute("id");

    const targetIndex = slotCount >= 3 ? 2 : 1; // 2/3番目を優先
    const targetSlot = slots.nth(targetIndex);

    const waitingCards = page.locator('[draggable="true"]');
    const cardCount = await waitingCards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    const card = waitingCards.first();
    const targetBox = await targetSlot.boundingBox();
    if (!targetBox) {
      test.skip();
      return;
    }

    const centerX = targetBox.x + targetBox.width / 2;
    const centerY = targetBox.y + targetBox.height / 2;

    await card.hover();
    await page.mouse.down();
    await page.mouse.move(centerX, centerY, { steps: 10 });
    await page.waitForTimeout(300); // ドロップ処理・再描画を待つ
    await page.mouse.up();

    // slot-0 が依然として DOM に存在し、可視であることを確認
    await expect(leftSlot).toBeVisible();
    const stillInDom = await leftHandle.evaluate((el) => document.body.contains(el));
    expect(stillInDom).toBeTruthy();

    if (leftId) {
      const visibleById = page.locator(`#${leftId}`);
      await expect(visibleById).toBeVisible();
    }
  });
});
