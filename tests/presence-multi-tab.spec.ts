/**
 * 2タブ/複数端末の入退室でpresence人数が崩れないことを確認
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

const waitForPresenceReady = async (page: Page, timeoutMs = 60_000) => {
  await page.waitForFunction(
    () => window.__ITO_METRICS__?.room?.presenceReady === 1,
    null,
    { timeout: timeoutMs }
  );
};

const waitForOnlineCount = async (page: Page, count: number, timeoutMs = 60_000) => {
  await page.waitForFunction(
    (expected) => {
      const online = window.__ITO_METRICS__?.room?.online;
      return typeof online === "number" && online === expected;
    },
    count,
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

const joinRoomAsPlayer = async (
  browser: Browser,
  origin: string,
  roomId: string,
  playerName: string
) => {
  const context = await browser.newContext();
  await installDisplayNameForContext(context, playerName);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return { context, page };
};

const openRoomInContext = async (context: BrowserContext, origin: string, roomId: string) => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return page;
};

test("同一ユーザーの複数タブでオンライン人数が崩れない", async ({ page, browser }) => {
  test.setTimeout(240_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const playerName = `e2e-p2-${id}`;
  const roomName = `e2e-room-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);
  await waitForPhase(page, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, playerName);
    contexts.push(p2.context);
    pages.push(p2.page);

    await waitForPresenceReady(page, 60_000);
    await waitForOnlineCount(page, 2, 60_000);

    const p2Tab = await openRoomInContext(p2.context, origin, roomId);
    pages.push(p2Tab);
    await waitForPhase(p2Tab, "waiting", 60_000);

    await waitForOnlineCount(page, 2, 60_000);

    await p2Tab.close();
    await page.waitForTimeout(1500);
    await waitForOnlineCount(page, 2, 30_000);

    await p2.page.close();
    await waitForOnlineCount(page, 1, 60_000);
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});
