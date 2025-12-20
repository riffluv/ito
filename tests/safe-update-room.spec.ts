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

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "退出" }).click();
  await page.waitForURL("/", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "新しい部屋を作成" }).first()).toBeVisible({
    timeout: 30_000,
  });

  const applyButton = page.getByRole("button", { name: "今すぐ適用" });
  await expect(applyButton).toBeVisible({ timeout: 60_000 });

  await page.evaluate(() => {
    localStorage.removeItem("e2e-sw-controller-change");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      localStorage.setItem("e2e-sw-controller-change", "1");
    });
  });

  const waitForApplyOutcome = async (timeoutMs = 60_000) => {
    const handle = await page.waitForFunction(
      (initialScriptUrl) => {
        const url = navigator.serviceWorker?.controller?.scriptURL ?? "";
        const changed = Boolean(url && url !== initialScriptUrl);
        const controllerChanged =
          window.localStorage.getItem("e2e-sw-controller-change") === "1";
        const phase = window.__ITO_METRICS__?.safeUpdate?.phase ?? null;
        if (changed && controllerChanged) return "applied";
        if (phase === "failed") return "failed";
        return "";
      },
      initialUrl,
      { timeout: timeoutMs }
    );
    return String(await handle.jsonValue());
  };

  await applyButton.click();
  await page.waitForLoadState("load");

  await waitForServiceWorkerController(page, 60_000);
  let outcome = await waitForApplyOutcome(60_000);
  if (outcome === "failed") {
    const retryButton = page.getByRole("button", { name: "再試行する" });
    await expect(retryButton).toBeVisible({ timeout: 30_000 });
    await retryButton.click();
    await page.waitForLoadState("load");
    await waitForServiceWorkerController(page, 60_000);
    outcome = await waitForApplyOutcome(60_000);
  }
  expect(outcome).toBe("applied");
});
