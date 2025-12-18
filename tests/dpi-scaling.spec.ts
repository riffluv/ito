/**
 * DPI / deviceScaleFactor でレイアウトが破綻しないことを確認する E2E。
 *
 * - Windows 125%/150% を deviceScaleFactor で近似
 * - /rooms/test-room の固定依存を廃止し、テスト内で部屋を作成する
 * - スナップショット比較は不安定になりやすいので数値検証に寄せる
 */

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

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

const startGameAndMakeBoardStable = async (page: Page, hostName: string) => {
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

  const boardRoot = page.locator("[data-board-root]");
  await expect(boardRoot).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-slot]").first()).toBeVisible({ timeout: 20_000 });
};

const assertNoHorizontalOverflow = async (page: Page, tolerancePx = 6) => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(tolerancePx);
};

const assertBoardFitsViewport = async (page: Page, tolerancePx = 6) => {
  const board = page.locator("[data-board-root]");
  await expect(board).toBeVisible();

  const box = await board.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  if (!box || !viewport) return;

  expect(box.width).toBeLessThanOrEqual(viewport.width + tolerancePx);
};

const assertSlotAspectRatio = async (page: Page) => {
  const slot = page.locator("[data-slot]").first();
  await expect(slot).toBeVisible();

  const box = await slot.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const actual = box.width / box.height;
  const expected = 5 / 7;
  const tolerance = 0.08; // transforms/border の誤差を許容
  expect(actual).toBeGreaterThan(expected - tolerance);
  expect(actual).toBeLessThan(expected + tolerance);
};

const viewports = [
  { name: "Desktop HD", width: 1280, height: 800 },
  { name: "Desktop FHD", width: 1920, height: 1080 },
  { name: "Laptop", width: 1440, height: 900 },
];

const dpiScales = [
  { name: "100% DPI", deviceScaleFactor: 1 },
  { name: "125% DPI", deviceScaleFactor: 1.25 },
  { name: "150% DPI", deviceScaleFactor: 1.5 },
] as const;

test.describe("DPI Scaling Validation", () => {
  for (const dpi of dpiScales) {
    test.describe(dpi.name, () => {
      test.use({ deviceScaleFactor: dpi.deviceScaleFactor });

      test("board fits viewport and slots keep ratio", async ({ page, browser }) => {
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: "reduce" });

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

          await startGameAndMakeBoardStable(page, hostName);

          for (const viewport of viewports) {
            await test.step(viewport.name, async () => {
              await page.setViewportSize({ width: viewport.width, height: viewport.height });
              await page.waitForTimeout(350);
              await assertBoardFitsViewport(page);
              await assertNoHorizontalOverflow(page);
              await assertSlotAspectRatio(page);
            });
          }
        } finally {
          await Promise.all(contexts.map((c) => c.close()));
        }
      });
    });
  }

  test("CSS custom properties are defined", async ({ page }) => {
    await page.goto("/");
    const cssProperties = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        cardGap: style.getPropertyValue("--card-gap").trim(),
        cardMin: style.getPropertyValue("--card-min").trim(),
        cardIdeal: style.getPropertyValue("--card-ideal").trim(),
        cardMax: style.getPropertyValue("--card-max").trim(),
        cardAspect: style.getPropertyValue("--card-aspect").trim(),
      };
    });

    expect(cssProperties.cardGap).not.toBe("");
    expect(cssProperties.cardMin).not.toBe("");
    expect(cssProperties.cardIdeal).not.toBe("");
    expect(cssProperties.cardMax).not.toBe("");
    expect(cssProperties.cardAspect).toContain("5 / 7");
  });
});
