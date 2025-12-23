import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  devices,
  type Page,
} from "@playwright/test";

const iPad = devices["iPad Pro 11"];
const { defaultBrowserType: _defaultBrowserType, ...iPadOptions } = iPad;

test.describe.configure({ mode: 'serial' });

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
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.getByRole("button", { name: "新しい部屋を作成" }).first().click();

  const createDialog = page.getByRole("dialog", { name: "へやを つくる" });
  await expect(createDialog).toBeVisible({ timeout: 20_000 });

  const roomInput = createDialog.getByPlaceholder("れい: 友達とあそぶ");
  await expect(roomInput).toBeVisible({ timeout: 20_000 });
  await roomInput.fill(roomName);

  const roomUrl = /\/rooms\/[^/]+$/;
  const createdDialog = page.getByRole("dialog", { name: /へやが できました/ });
  const createButton = createDialog.getByRole("button", { name: "作成" });

  let navigated = false;
  for (let attempt = 0; attempt < 3 && !navigated; attempt += 1) {
    await createButton.click({ force: true });

    const race = await Promise.race([
      page
        .waitForURL(roomUrl, { timeout: 8_000 })
        .then(() => "navigated")
        .catch(() => null),
      createdDialog
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => "created")
        .catch(() => null),
    ]);

    if (race === "navigated") {
      navigated = true;
      break;
    }

    if (race === "created") {
      const enterRoom = createdDialog.getByRole("button", { name: "へやへ すすむ" });
      await expect(enterRoom).toBeVisible({ timeout: 30_000 });
      await Promise.all([
        enterRoom.click(),
        page.waitForURL(roomUrl, { timeout: 45_000 }),
      ]);
      navigated = true;
      break;
    }

    await page.waitForTimeout(500);
  }

  if (!navigated) {
    throw new Error("Failed to navigate to room after creation");
  }

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

test.describe("iPad Pro touch layout", () => {
  test.use({
    ...iPadOptions,
  });

  test('パーティーパネルが可視である', async ({ page }) => {
    test.setTimeout(180_000);

    const id = Math.random().toString(36).slice(2, 8);
    const hostName = `e2e-host-${id}`;
    const roomName = `e2e-room-${id}`;
    await createRoomAsHost(page, hostName, roomName);

    await expect(page.getByText(/ゲーム準備中/)).toBeVisible();

    const emblem = page.locator('img[alt="party emblem"]').first();
    await expect(emblem).toBeVisible();
  });

  test('フッターボタンがコンパクトでスクロールバーが出ない', async ({ page }) => {
    test.setTimeout(180_000);

    const id = Math.random().toString(36).slice(2, 8);
    const hostName = `e2e-host-${id}`;
    const roomName = `e2e-room-${id}`;
    await createRoomAsHost(page, hostName, roomName);

    const overflow = await page.evaluate(() => {
      const body = document.body;
      const doc = document.documentElement;
      return body.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(4);

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible();

    const box = await startButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeLessThanOrEqual(68);
  });

  test("ドラッグ可能カードが touch-action: none を維持する", async ({ page, browser }) => {
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

      const boardTouchAction = await boardRoot.evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(boardTouchAction).toBe("pan-y");

      const myCard = page.getByLabel(`${hostName}のカード`);
      const cardTouchAction = await myCard.evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(cardTouchAction).toBe("none");
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
