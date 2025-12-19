/**
 * ホストの不意切断（mid-game）で自動クレームが成立することを確認
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
  const roomUrlPattern = /\/rooms\/[^/]+$/;
  const entry = await Promise.race([
    enterRoom.waitFor({ state: "visible", timeout: 30_000 }).then(() => "button"),
    page.waitForURL(roomUrlPattern, { timeout: 45_000 }).then(() => "url"),
  ]).catch(() => null);

  if (entry === "button") {
    await enterRoom.click();
    await page.waitForURL(roomUrlPattern, { timeout: 45_000 });
  } else if (entry !== "url") {
    await page.waitForURL(roomUrlPattern, { timeout: 45_000 });
  }

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

test("ホストの不意切断で自動クレームが成立する", async ({ browser }) => {
  test.setTimeout(300_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const playerName = `e2e-p2-${id}`;
  const roomName = `e2e-room-${id}`;

  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await hostPage.emulateMedia({ reducedMotion: "reduce" });

  const { origin, roomId } = await createRoomAsHost(hostPage, hostName, roomName);
  await waitForPhase(hostPage, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, playerName);
    contexts.push(p2.context);
    pages.push(p2.page);

    await expect(hostPage.getByText(/参加人数：2人/)).toBeVisible({ timeout: 45_000 });

    const startButton = hostPage.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([
      waitForPhase(hostPage, "clue", 60_000),
      waitForPhase(p2.page, "clue", 60_000),
    ]);

    await waitForOnlineCount(p2.page, 2, 30_000);

    await hostPage.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await hostPage.waitForTimeout(800);
    await hostContext.close().catch(() => undefined);

    await waitForOnlineCount(p2.page, 1, 60_000);
    await p2.page.waitForFunction(
      () => window.__ITO_METRICS__?.room?.selfOnline === 1,
      null,
      { timeout: 60_000 }
    );

    await p2.page.waitForFunction(
      () => {
        const room = window.__ITO_METRICS__?.room;
        return room?.isHost === 1 || room?.hostLikelyUnavailable === 1;
      },
      null,
      { timeout: 150_000 }
    );

    const hostState = await p2.page.evaluate(() => ({
      isHost: window.__ITO_METRICS__?.room?.isHost ?? 0,
      hostLikelyUnavailable: window.__ITO_METRICS__?.room?.hostLikelyUnavailable ?? 0,
    }));

    if (hostState.isHost !== 1) {
      await p2.page.waitForFunction(
        () => window.__ITO_METRICS__?.room?.isHost === 1,
        null,
        { timeout: 150_000 }
      );
    }

    const dealButton = p2.page.locator('button:has(img[alt="Deal numbers"])');
    await expect(dealButton).toBeVisible({ timeout: 120_000 });
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
    await hostContext.close().catch(() => undefined);
  }
});
