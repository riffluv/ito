/**
 * 切断（ブラウザ閉じ）後でも残ったプレイヤーで完走できることを確認
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

const readAuthStateFromIndexedDb = async (): Promise<{ uid: string; token: string } | null> => {
  try {
    const dbName = "firebaseLocalStorageDb";
    const storeName = "firebaseLocalStorage";
    const keyPrefix = "firebase:authUser:";
    const state = await new Promise<{ uid: string; token: string } | null>((resolve) => {
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
            const token =
              typeof matched?.value?.stsTokenManager?.accessToken === "string"
                ? matched.value.stsTokenManager.accessToken
                : null;
            const uid =
              typeof matched?.value?.uid === "string"
                ? matched.value.uid
                : typeof matched?.value?.user?.uid === "string"
                ? matched.value.user.uid
                : null;
            db.close();
            if (!token || !uid) {
              resolve(null);
              return;
            }
            resolve({ uid, token });
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    });
    return state;
  } catch {
    return null;
  }
};

const getAuthStateFromIndexedDb = async (page: Page, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await page.evaluate(readAuthStateFromIndexedDb);
    if (state) return state;
    await page.waitForTimeout(400);
  }
  throw new Error("Failed to resolve Firebase auth state from IndexedDB");
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

const prunePlayersAsHost = async (
  page: Page,
  origin: string,
  roomId: string,
  targets: string[]
) => {
  const { uid, token } = await getAuthStateFromIndexedDb(page);
  const response = await page.request.post(`${origin}/api/rooms/${roomId}/prune`, {
    data: {
      token,
      callerUid: uid,
      targets,
      clientVersion: CLIENT_VERSION,
    },
  });
  expect(response.ok(), `prune route failed (${response.status()})`).toBe(true);
  const json = await response.json();
  if (Array.isArray(json.failed) && json.failed.length > 0) {
    throw new Error(`prune route failed for targets: ${json.failed.join(",")}`);
  }
};

const decideClueAndSubmitCard = async (page: Page, clue: string) => {
  const clueInput = page.getByLabel("連想ワード");
  await expect(clueInput).toBeVisible({ timeout: 45_000 });
  await expect(clueInput).toBeEnabled({ timeout: 45_000 });
  await clueInput.fill(clue);

  const decideButton = page.getByRole("button", { name: "決定" });
  await expect(decideButton).toBeVisible({ timeout: 20_000 });
  await expect(decideButton).toBeEnabled({ timeout: 20_000 });
  await decideButton.click();

  const submitButton = page.getByRole("button", { name: "出す" });
  await expect(submitButton).toBeVisible({ timeout: 20_000 });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await submitButton.click();
};

test("ブラウザを閉じたプレイヤーがいても残りで完走できる", async ({ page, browser }) => {
  test.setTimeout(600_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const playerTwoName = `e2e-p2-${id}`;
  const playerThreeName = `e2e-p3-${id}`;
  const roomName = `e2e-room-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);
  await waitForPhase(page, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, playerTwoName);
    contexts.push(p2.context);
    pages.push(p2.page);
    const p3 = await joinRoomAsPlayer(browser, origin, roomId, playerThreeName);
    contexts.push(p3.context);
    pages.push(p3.page);

    await expect(page.getByText(/参加人数：3人/)).toBeVisible({ timeout: 45_000 });

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([page, p2.page, p3.page].map((p) => waitForPhase(p, "clue", 60_000)));

    const { uid: playerThreeUid } = await getAuthStateFromIndexedDb(p3.page, 30_000);

    // ブラウザを閉じたことを想定してタブを終了
    await p3.page.close();
    await p3.context.close();

    await Promise.all([
      decideClueAndSubmitCard(page, "りんご"),
      decideClueAndSubmitCard(p2.page, "みかん"),
    ]);

    // Emulator では onDisconnect が安定しないため、ホスト側から prune を実行して除外を再現
    await prunePlayersAsHost(page, origin, roomId, [playerThreeUid]);
    await expect(page.getByText(playerThreeName)).toHaveCount(0, {
      timeout: 120_000,
    });

    const seinoButton = page.locator("button", { hasText: "せーの" }).first();
    await expect(seinoButton).toBeVisible({ timeout: 120_000 });
    await expect(seinoButton).toBeEnabled({ timeout: 120_000 });
    await seinoButton.click();

    await page.waitForFunction(
      () => {
        const status = window.__ITO_METRICS__?.phase?.status ?? null;
        return status === "reveal" || status === "finished";
      },
      null,
      { timeout: 60_000 }
    );
    await page.waitForFunction(
      () => (window.__ITO_METRICS__?.phase?.status ?? null) === "finished",
      null,
      { timeout: 120_000 }
    );
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});
