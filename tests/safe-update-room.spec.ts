/**
 * Safe Update の実運用フロー（更新待機→適用）をルーム内で再現
 * - Firebase Emulator 前提（本番誤爆防止）
 */

import { expect, test, type Page } from "@playwright/test";

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

const waitForServiceWorkerController = async (page: Page, timeoutMs = 60_000) => {
  await page.waitForFunction(
    () => {
      return Boolean(navigator.serviceWorker?.controller?.scriptURL);
    },
    null,
    { timeout: timeoutMs }
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

test("Safe Update をルーム内で待機→適用できる", async ({ page }) => {
  test.setTimeout(240_000);

  const debug = process.env.E2E_DEBUG_SAFE_UPDATE === "1";

  const dumpSwState = async (label: string) => {
    if (!debug) return;
    const info = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
        activeUrl: reg?.active?.scriptURL ?? null,
        activeState: reg?.active?.state ?? null,
        waitingUrl: reg?.waiting?.scriptURL ?? null,
        waitingState: reg?.waiting?.state ?? null,
        installingUrl: reg?.installing?.scriptURL ?? null,
        installingState: reg?.installing?.state ?? null,
      };
    });
    // eslint-disable-next-line no-console
    console.log(`[sw:${label}]`, info);
  };

  if (debug) {
    page.on("console", async (msg) => {
      const type = msg.type();
      const text = msg.text();
      const shouldLog =
        text.includes("[trace:") ||
        text.includes("safeUpdate") ||
        text.includes("sw.") ||
        type === "error";
      if (!shouldLog) return;
      try {
        const args = await Promise.all(
          msg.args().map(async (arg) => {
            try {
              return await arg.jsonValue();
            } catch {
              return String(arg);
            }
          })
        );
        // eslint-disable-next-line no-console
        console.log(`[browser:${type}]`, ...args);
      } catch {
        // eslint-disable-next-line no-console
        console.log(`[browser:${type}]`, text);
      }
    });
    page.on("pageerror", (error) => {
      // eslint-disable-next-line no-console
      console.log("[pageerror]", error);
    });
  }

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const roomName = `e2e-room-${id}`;

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

  await waitForPhase(page, "waiting", 60_000);

  await waitForServiceWorkerController(page, 60_000);
  const initialUrl = await page.evaluate(
    () => navigator.serviceWorker?.controller?.scriptURL ?? ""
  );
  expect(initialUrl.length).toBeGreaterThan(0);
  await dumpSwState("room:initial");

  const nextVersion = `e2e-${Date.now()}`;
  await page.evaluate(async (version) => {
    await navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: "/" });
  }, nextVersion);

  await page.waitForFunction(
    () => {
      const phase = window.__ITO_METRICS__?.safeUpdate?.phase ?? null;
      return phase && phase !== "idle";
    },
    null,
    { timeout: 60_000 }
  );

  const updateButton = page.getByRole("button", { name: "更新 (注意)" });
  await expect(updateButton).toBeVisible({ timeout: 60_000 });
  await dumpSwState("room:waiting-detected");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "退出" }).click();
  await page.waitForURL("/", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "新しい部屋を作成" }).first()).toBeVisible({
    timeout: 30_000,
  });

  const applyButton = page.getByRole("button", { name: "今すぐ適用" });
  await expect(applyButton).toBeVisible({ timeout: 60_000 });
  await dumpSwState("lobby:before-apply");

  await applyButton.click();
  await page.waitForLoadState("load");
  await dumpSwState("lobby:after-apply-click");

  await waitForServiceWorkerController(page, 60_000);
  await page.waitForFunction(
    (expectedVersion) => {
      const url = navigator.serviceWorker?.controller?.scriptURL ?? "";
      return url.includes(`v=${expectedVersion}`);
    },
    nextVersion,
    { timeout: 120_000 }
  );
});
