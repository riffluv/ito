/**
 * ドラッグ操作でポインター座標が最優先されることを確認する E2E テスト
 * 左端スロットへの誤吸着を防ぐ
 */

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const waitForMyDraggableCard = async (page: Page, playerName: string) => {
  const boardRoot = page.locator("[data-board-root]");
  const boardCard = boardRoot
    .locator("[data-interactive='true']")
    .filter({ hasText: playerName })
    .first();
  const waitingCard = page.getByLabel(`${playerName}のカード`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (await boardCard.isVisible().catch(() => false)) return boardCard;
    if (await waitingCard.isVisible().catch(() => false)) return waitingCard;
    await page.waitForTimeout(100);
  }
  throw new Error(`Failed to locate draggable card for ${playerName}`);
};

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
  await expect(enterRoom).toBeVisible({ timeout: 90_000 });
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
  // presence が上がるまで少し待つ
  await page.waitForTimeout(1200);
  return { context, page, playerName };
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

  const myCard = await waitForMyDraggableCard(page, hostName);
  await expect(myCard).toBeVisible({ timeout: 20_000 });
  const touchAction = await myCard.evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
  expect(touchAction).toBe("none");
};

const withRoom = async (
  page: Page,
  browser: Browser,
  run: (ctx: {
    hostName: string;
    roomId: string;
  }) => Promise<void>
) => {
  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const roomName = `e2e-room-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);

  const otherContexts: BrowserContext[] = [];
  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, `e2e-p2-${id}`);
    otherContexts.push(p2.context);

    // 参加者が UI に反映されるまで待つ（players の反映は非同期）
    await expect(page.getByLabel(`${p2.playerName}のカード`)).toBeVisible({ timeout: 45_000 });

    await startGameAndMakeCardDraggable(page, hostName);

    await run({ hostName, roomId });
  } finally {
    await Promise.all(
      otherContexts.map(async (context) => {
        try {
          await Promise.race([
            context.close(),
            new Promise<void>((resolve) => {
              setTimeout(resolve, 5000);
            }),
          ]);
        } catch {
          // ignore teardown errors/timeouts (WSL crash mitigation)
        }
      })
    );
  }
};

test.describe("ドラッグ操作のポインター座標優先", () => {
  test("複数の空きスロットがある状態で、カーソル位置のスロットが直接選ばれる", async ({ page, browser }) => {
    test.setTimeout(180_000);

    await withRoom(page, browser, async ({ hostName }) => {
      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const emptySlots = page.locator("[data-slot]");
      const slotCount = await emptySlots.count();
      expect(slotCount).toBeGreaterThanOrEqual(2);

      const slotPositions = await Promise.all(
        Array.from({ length: slotCount }, async (_, i) => {
          const slot = emptySlots.nth(i);
          const box = await slot.boundingBox();
          return {
            index: i,
            box,
            centerX: box ? box.x + box.width / 2 : 0,
            centerY: box ? box.y + box.height / 2 : 0,
          };
        })
      );

      const leftmost = slotPositions.reduce((prev, curr) => (curr.centerX < prev.centerX ? curr : prev));
      const rightmost = slotPositions.reduce((prev, curr) => (curr.centerX > prev.centerX ? curr : prev));
      if (!rightmost.box) throw new Error("missing slot bounding box");

      const myCard = await waitForMyDraggableCard(page, hostName);
      await myCard.hover();
      await page.mouse.down();

      await page.mouse.move(rightmost.centerX, rightmost.centerY, { steps: 10 });
      await page.waitForTimeout(300);

      await expect(emptySlots.nth(rightmost.index)).toHaveAttribute("data-magnet-target", "true");
      await expect(emptySlots.nth(leftmost.index)).not.toHaveAttribute("data-magnet-target", "true");

      await page.mouse.up();
    });
  });

  test("ドラッグ中にカーソルを移動すると、magnet ターゲットが追従する", async ({ page, browser }) => {
    test.setTimeout(180_000);

    await withRoom(page, browser, async ({ hostName }) => {
      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const emptySlots = page.locator("[data-slot]");
      const slotCount = await emptySlots.count();
      expect(slotCount).toBeGreaterThanOrEqual(2);

      const slot0 = emptySlots.nth(0);
      const slot1 = emptySlots.nth(1);
      const box0 = await slot0.boundingBox();
      const box1 = await slot1.boundingBox();
      if (!box0 || !box1) throw new Error("missing slot bounding box");

      const center0 = { x: box0.x + box0.width / 2, y: box0.y + box0.height / 2 };
      const center1 = { x: box1.x + box1.width / 2, y: box1.y + box1.height / 2 };

      const myCard = await waitForMyDraggableCard(page, hostName);
      await myCard.hover();
      await page.mouse.down();

      await page.mouse.move(center0.x, center0.y, { steps: 5 });
      await page.waitForTimeout(200);
      await expect(slot0).toHaveAttribute("data-magnet-target", "true");

      await page.mouse.move(center1.x, center1.y, { steps: 5 });
      await page.waitForTimeout(200);
      await expect(slot1).toHaveAttribute("data-magnet-target", "true");
      await expect(slot0).not.toHaveAttribute("data-magnet-target", "true");

      await page.mouse.up();
    });
  });

  test("ポインターがボード外に出ると、magnet がリリースされる", async ({ page, browser }) => {
    test.setTimeout(180_000);

    await withRoom(page, browser, async ({ hostName }) => {
      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const slots = page.locator("[data-slot]");
      await expect(slots.first()).toBeVisible();
      const firstSlotBox = await slots.first().boundingBox();
      if (!firstSlotBox) throw new Error("missing slot bounding box");

      const myCard = await waitForMyDraggableCard(page, hostName);
      const boardBox = await boardRoot.boundingBox();
      if (!boardBox) throw new Error("missing board bounding box");

      await myCard.hover();
      await page.mouse.down();

      const slotCenterX = firstSlotBox.x + firstSlotBox.width / 2;
      const slotCenterY = firstSlotBox.y + firstSlotBox.height / 2;
      await page.mouse.move(slotCenterX, slotCenterY, { steps: 5 });
      await page.waitForTimeout(200);

      const magnetTargets = page.locator("[data-magnet-target='true']");
      const targetCountBefore = await magnetTargets.count();
      expect(targetCountBefore).toBeGreaterThan(0);

      const outsideY = boardBox.y + boardBox.height + 100;
      await page.mouse.move(slotCenterX, outsideY, { steps: 5 });
      await page.waitForTimeout(200);

      const targetCountAfter = await magnetTargets.count();
      expect(targetCountAfter).toBe(0);

      await page.mouse.up();
    });
  });

  test("ドラッグ中にウィンドウがblurするとドラッグがキャンセルされる", async ({ page, browser }) => {
    test.setTimeout(180_000);

    await withRoom(page, browser, async ({ hostName }) => {
      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const slots = page.locator("[data-slot]");
      await expect(slots.first()).toBeVisible();
      const firstSlotBox = await slots.first().boundingBox();
      if (!firstSlotBox) throw new Error("missing slot bounding box");

      const myCard = await waitForMyDraggableCard(page, hostName);
      await myCard.hover();
      await page.mouse.down();

      const slotCenterX = firstSlotBox.x + firstSlotBox.width / 2;
      const slotCenterY = firstSlotBox.y + firstSlotBox.height / 2;
      await page.mouse.move(slotCenterX, slotCenterY, { steps: 6 });
      await page.waitForTimeout(150);

      const overlay = page.locator("[data-floating-card='true']");
      await expect(overlay).toBeVisible();

      await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
      });

      await expect(overlay).toHaveCount(0);
      await expect(page.locator("[data-magnet-target='true']")).toHaveCount(0);
    });
  });

  test("ドラッグ中にtouchcancelが発火するとドラッグがキャンセルされる", async ({ page, browser }) => {
    test.setTimeout(180_000);

    await withRoom(page, browser, async ({ hostName }) => {
      const boardRoot = page.locator("[data-board-root]");
      await expect(boardRoot).toBeVisible();

      const slots = page.locator("[data-slot]");
      await expect(slots.first()).toBeVisible();
      const firstSlotBox = await slots.first().boundingBox();
      if (!firstSlotBox) throw new Error("missing slot bounding box");

      const myCard = await waitForMyDraggableCard(page, hostName);
      await myCard.hover();
      await page.mouse.down();

      const slotCenterX = firstSlotBox.x + firstSlotBox.width / 2;
      const slotCenterY = firstSlotBox.y + firstSlotBox.height / 2;
      await page.mouse.move(slotCenterX, slotCenterY, { steps: 6 });
      await page.waitForTimeout(150);

      const overlay = page.locator("[data-floating-card='true']");
      await expect(overlay).toBeVisible();

      await page.evaluate(() => {
        window.dispatchEvent(new Event("touchcancel"));
      });

      await expect(overlay).toHaveCount(0);
      await expect(page.locator("[data-magnet-target='true']")).toHaveCount(0);
    });
  });
});
