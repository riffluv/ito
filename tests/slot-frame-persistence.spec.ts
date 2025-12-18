/**
 * 待機エリアから 2/3 番目のスロットへドラッグしても、左端スロット枠が DOM から消えないことを検証する E2E
 * 以前は EmptyCard/SortableItem の切り替えで slot-0 が一瞬アンマウントし点滅していた。
 */

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const ensureE2EEmulators = async (page: Page) => {
  await page.goto("/");
  const emulatorReady = await page.evaluate(() => {
    const g = globalThis as typeof globalThis & {
      __AUTH_EMULATOR_INITIALIZED__?: boolean;
      __FIRESTORE_EMULATOR_INITIALIZED__?: boolean;
      __RTDB_EMULATOR_INITIALIZED__?: boolean;
    };
    return {
      auth: g.__AUTH_EMULATOR_INITIALIZED__ === true,
      firestore: g.__FIRESTORE_EMULATOR_INITIALIZED__ === true,
      rtdb: g.__RTDB_EMULATOR_INITIALIZED__ === true,
    };
  });
  expect(emulatorReady.auth, "Auth emulator must be enabled for E2E tests").toBe(true);
  expect(emulatorReady.firestore, "Firestore emulator must be enabled for E2E tests").toBe(true);
  expect(emulatorReady.rtdb, "RTDB emulator must be enabled for E2E tests").toBe(true);
};

const installDisplayNameForPage = async (page: Page, displayName: string) => {
  await page.addInitScript(
    (name) => {
      localStorage.setItem("displayName", String(name));
    },
    displayName
  );
};

const installDisplayNameForContext = async (context: BrowserContext, displayName: string) => {
  await context.addInitScript(
    (name) => {
      localStorage.setItem("displayName", String(name));
    },
    displayName
  );
};

const createRoomAsHost = async (page: Page, hostName: string, roomName: string) => {
  await installDisplayNameForPage(page, hostName);
  await ensureE2EEmulators(page);
  await page.getByRole("button", { name: "新しい部屋を作成" }).first().click();
  const roomInput = page.getByPlaceholder("れい: 友達とあそぶ");
  await expect(roomInput).toBeVisible({ timeout: 20_000 });
  await roomInput.fill(roomName);
  await page.getByRole("button", { name: "作成" }).click();

  const enterRoom = page.getByRole("button", { name: "へやへ すすむ" });
  await expect(enterRoom).toBeVisible({ timeout: 30_000 });
  await enterRoom.click();
  await page.waitForURL(/\/rooms\/[^/]+$/, { timeout: 45_000 });

  const url = new URL(page.url());
  const roomId = url.pathname.split("/rooms/")[1] ?? "";
  if (!roomId) throw new Error(`Failed to resolve roomId from URL: ${page.url()}`);
  return { origin: url.origin, roomId };
};

const joinRoomAsPlayer = async (browser: Browser, origin: string, roomId: string, playerName: string) => {
  const context = await browser.newContext();
  await installDisplayNameForContext(context, playerName);
  const page = await context.newPage();
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return { context, page };
};

const startGameAndMakeCardDraggable = async (page: Page, hostName: string) => {
  const startButton = page.getByRole("button", { name: "ゲーム開始" });
  await expect(startButton).toBeVisible({ timeout: 45_000 });
  await expect(startButton).toBeEnabled({ timeout: 45_000 });
  await startButton.click();

  const clueInput = page.getByLabel("連想ワード");
  await expect(clueInput).toBeVisible({ timeout: 45_000 });
  await clueInput.fill("りんご");

  const decideButton = page.getByRole("button", { name: /決定/ });
  await expect(decideButton).toBeVisible({ timeout: 20_000 });
  await expect(decideButton).toBeEnabled({ timeout: 20_000 });
  await decideButton.click();

  const myCard = page.getByLabel(`${hostName}のカード`);
  await expect(myCard).toBeVisible({ timeout: 20_000 });
};

test.describe("スロット枠の持続性", () => {
  test("待機→スロット2/3へのドロップ中も slot-0 が DOM に残る", async ({ page, browser }) => {
    test.setTimeout(180_000);

    const id = Math.random().toString(36).slice(2, 8);
    const hostName = `e2e-host-${id}`;
    const roomName = `e2e-room-${id}`;

    const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);

    const contexts: BrowserContext[] = [];
    try {
      const p2 = await joinRoomAsPlayer(browser, origin, roomId, `e2e-p2-${id}`);
      contexts.push(p2.context);
      const p3 = await joinRoomAsPlayer(browser, origin, roomId, `e2e-p3-${id}`);
      contexts.push(p3.context);

      await expect(page.getByText(/参加人数：3人/)).toBeVisible({ timeout: 45_000 });

      await startGameAndMakeCardDraggable(page, hostName);

      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const slots = page.locator("[data-slot]");
      const slotCount = await slots.count();
      expect(slotCount).toBeGreaterThanOrEqual(3);

      const leftSlot = slots.first();
      const leftHandle = await leftSlot.elementHandle();
      if (!leftHandle) throw new Error("left slot handle missing");

      const targetIndex = slotCount >= 3 ? 2 : 1; // 2/3番目を優先
      const targetSlot = slots.nth(targetIndex);
      const targetBox = await targetSlot.boundingBox();
      if (!targetBox) throw new Error("target slot bounding box missing");

      const centerX = targetBox.x + targetBox.width / 2;
      const centerY = targetBox.y + targetBox.height / 2;

      const myCard = page.getByLabel(`${hostName}のカード`);
      await myCard.hover();
      await page.mouse.down();
      await page.mouse.move(centerX, centerY, { steps: 10 });
      await page.waitForTimeout(300);
      await page.mouse.up();

      await expect(leftSlot).toBeVisible();
      const stillInDom = await leftHandle.evaluate((el) => document.body.contains(el));
      expect(stillInDom).toBeTruthy();
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
