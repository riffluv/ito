/**
 * waiting中にrecallOpen=falseの場合、観戦UIが「参加受付が閉じています」を表示する
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

const CLIENT_VERSION = "dev";

const readAuthTokenFromIndexedDb = async (): Promise<string | null> => {
  try {
    const dbName = "firebaseLocalStorageDb";
    const storeName = "firebaseLocalStorage";
    const keyPrefix = "firebase:authUser:";
    const token = await new Promise<string | null>((resolve) => {
      const openReq = indexedDB.open(dbName);
      openReq.onerror = () => resolve(null);
      openReq.onupgradeneeded = () => resolve(null);
      openReq.onsuccess = () => {
        const db = openReq.result;
        try {
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const getAllReq = store.getAll();
          getAllReq.onerror = () => {
            db.close();
            resolve(null);
          };
          getAllReq.onsuccess = () => {
            const entries = (getAllReq.result as Array<{ fbase_key?: unknown; value?: any }>) ?? [];
            const matched = entries.find(
              (entry) => typeof entry?.fbase_key === "string" && entry.fbase_key.startsWith(keyPrefix)
            );
            const accessToken =
              typeof matched?.value?.stsTokenManager?.accessToken === "string"
                ? matched.value.stsTokenManager.accessToken
                : null;
            db.close();
            resolve(accessToken);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    });
    return token;
  } catch {
    return null;
  }
};

const getAuthTokenFromIndexedDb = async (page: Page, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const token = await page.evaluate(readAuthTokenFromIndexedDb);
    if (token) return token;
    await page.waitForTimeout(400);
  }
  throw new Error("Failed to resolve Firebase auth token from IndexedDB");
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

const setRecallOpen = async (page: Page, origin: string, roomId: string, value: boolean) => {
  const token = await getAuthTokenFromIndexedDb(page);
  const response = await page.request.post(`${origin}/api/rooms/${roomId}/reset`, {
    data: {
      token,
      clientVersion: CLIENT_VERSION,
      recallSpectators: value,
      requestId: `e2e-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
  expect(response.ok(), `reset route failed (${response.status()})`).toBe(true);
  const json = await response.json();
  expect(json.ok).toBe(true);
};

test("recallOpen=false で観戦UIが待機クローズ表示になる", async ({ page, browser }) => {
  test.setTimeout(240_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const roomName = `e2e-room-${id}`;
  const spectatorName = `e2e-spectator-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);
  await waitForPhase(page, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  try {
    await setRecallOpen(page, origin, roomId, false);

    const spectator = await openRoom(browser, origin, roomId, spectatorName);
    contexts.push(spectator.context);
    pages.push(spectator.page);

    await waitForPhase(spectator.page, "waiting", 60_000);
    await expect(spectator.page.getByText("▼ 観戦中 ▼")).toBeVisible({ timeout: 60_000 });
    await expect(spectator.page.getByText("次のゲーム準備中です")).toBeVisible({ timeout: 60_000 });
    await expect(
      spectator.page.getByText(
        "参加受付が閉じています。ホストの操作が完了するまで観戦でお待ちください。"
      )
    ).toBeVisible({ timeout: 60_000 });
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});
