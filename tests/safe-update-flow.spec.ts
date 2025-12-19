/**
 * Safe Update の実運用フロー（更新待機→適用）をE2Eで検証
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

const waitForServiceWorkerController = async (page: Page, timeoutMs = 60_000) => {
  await page.waitForFunction(
    () => {
      return Boolean(navigator.serviceWorker?.controller?.scriptURL);
    },
    null,
    { timeout: timeoutMs }
  );
};

test("Safe Update の待機→手動適用→更新反映が通る", async ({ page }) => {
  test.setTimeout(240_000);

  await ensureE2EEmulators(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await waitForServiceWorkerController(page, 60_000);

  const initialUrl = await page.evaluate(
    () => navigator.serviceWorker?.controller?.scriptURL ?? ""
  );
  expect(initialUrl.length).toBeGreaterThan(0);

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

  const applyButton = page.getByRole("button", { name: "今すぐ適用" });
  await expect(applyButton).toBeVisible({ timeout: 60_000 });

  await applyButton.click();
  await page.waitForLoadState("load");

  await waitForServiceWorkerController(page, 60_000);
  await page.waitForFunction(
    (version) => {
      const url = navigator.serviceWorker?.controller?.scriptURL ?? "";
      return url.includes(`v=${version}`);
    },
    nextVersion,
    { timeout: 60_000 }
  );
});
