/**
 * ゲーム中にURLアクセスした観戦者が、ホストのリセットで自動参戦できることを確認
 * - Firebase Emulator 前提（本番誤爆防止）
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

const waitForPhase = async (page: Page, phase: string, timeoutMs = 60_000) => {
  await page.waitForFunction(
    (expected) => {
      const status = window.__ITO_METRICS__?.phase?.status ?? null;
      return status === expected;
    },
    phase,
    { timeout: timeoutMs }
  );
};

const createRoomAsHost = async (page: Page, hostName: string, roomName: string) => {
  await installDisplayNameForPage(page, hostName);
  await ensureE2EEmulators(page);

  await page.emulateMedia({ reducedMotion: "reduce" });

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

const openRoom = async (
  browser: Browser,
  origin: string,
  roomId: string,
  displayName: string
) => {
  const context = await browser.newContext();
  await installDisplayNameForContext(context, displayName);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return { context, page };
};

test("ゲーム中の観戦者がリセットで自動参戦できる", async ({ page, browser }) => {
  test.setTimeout(300_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const roomName = `e2e-room-${id}`;
  const spectatorName = `e2e-spectator-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);
  await waitForPhase(page, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  try {
    const p2 = await openRoom(browser, origin, roomId, `e2e-p2-${id}`);
    contexts.push(p2.context);
    pages.push(p2.page);

    await expect(page.getByText(/参加人数：2人/)).toBeVisible({ timeout: 45_000 });

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([waitForPhase(page, "clue", 60_000), waitForPhase(p2.page, "clue", 60_000)]);

    const spectator = await openRoom(browser, origin, roomId, spectatorName);
    contexts.push(spectator.context);
    pages.push(spectator.page);

    await waitForPhase(spectator.page, "clue", 60_000);
    await expect(spectator.page.getByText("▼ 観戦中 ▼")).toBeVisible({ timeout: 60_000 });
    await expect(spectator.page.getByText("ゲーム進行中です")).toBeVisible({ timeout: 60_000 });

    const resetButton = page.locator('button:has(img[alt="Reset game"])');
    await expect(resetButton).toBeVisible({ timeout: 30_000 });
    await expect(resetButton).toBeEnabled({ timeout: 30_000 });
    await resetButton.click();

    await waitForPhase(page, "waiting", 60_000);

    await waitForPhase(spectator.page, "waiting", 90_000);
    await expect(spectator.page.getByText(/参加人数：/)).toBeVisible({ timeout: 90_000 });
    await expect(spectator.page.getByText("▼ 観戦中 ▼")).toBeHidden({ timeout: 90_000 });
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});

