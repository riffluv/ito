/**
 * ゲーム開始〜演出〜結果サウンドまでが各1回で完走することを確認
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

const installRevealPlanCapture = async (page: Page) => {
  await page.addInitScript(() => {
    const g = window as typeof window & {
      __ITO_REVEAL_PLAN_CAPTURED__?: boolean;
      __ITO_REVEAL_PLAN_BUILT_EVER__?: number | null;
      __ITO_REVEAL_PLAN_LENGTH_EVER__?: number | null;
      __ITO_REVEAL_PLAN_LAST_END_EVER__?: number | null;
    };
    if (g.__ITO_REVEAL_PLAN_CAPTURED__) return;
    g.__ITO_REVEAL_PLAN_CAPTURED__ = true;

    const capture = (key: string, captureKey: string) => {
      let current = (window as Record<string, unknown>)[key];
      Object.defineProperty(window, key, {
        configurable: true,
        get() {
          return current;
        },
        set(value) {
          current = value;
          if (typeof value === "number") {
            (window as Record<string, unknown>)[captureKey] = value;
          }
        },
      });
    };

    capture("__ITO_REVEAL_PLAN_BUILT_AT__", "__ITO_REVEAL_PLAN_BUILT_EVER__");
    capture("__ITO_REVEAL_PLAN_LENGTH__", "__ITO_REVEAL_PLAN_LENGTH_EVER__");
    capture("__ITO_REVEAL_PLAN_LAST_END__", "__ITO_REVEAL_PLAN_LAST_END_EVER__");
  });
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

const waitForShowtimeScenario = async (
  page: Page,
  scenario: string,
  minCompleted: number,
  timeoutMs = 60_000
) => {
  await page.waitForFunction(
    ([targetScenario, minCount]) => {
      const bucket = window.__ITO_METRICS__?.showtime ?? {};
      const lastScenario = bucket.lastScenario ?? null;
      const completed = typeof bucket.playCompleted === "number" ? bucket.playCompleted : 0;
      return lastScenario === targetScenario && completed >= minCount;
    },
    [scenario, minCompleted],
    { timeout: timeoutMs }
  );
};

const waitForRevealPlanCaptured = async (page: Page, timeoutMs = 60_000) => {
  await page.waitForFunction(
    () => {
      const builtAt = (window as Record<string, unknown>).__ITO_REVEAL_PLAN_BUILT_EVER__;
      const length = (window as Record<string, unknown>).__ITO_REVEAL_PLAN_LENGTH_EVER__;
      const lastEnd = (window as Record<string, unknown>).__ITO_REVEAL_PLAN_LAST_END_EVER__;
      return (
        typeof builtAt === "number" &&
        typeof length === "number" &&
        length > 0 &&
        (typeof lastEnd === "number" || lastEnd === null)
      );
    },
    null,
    { timeout: timeoutMs }
  );
};

const createRoomAsHost = async (page: Page, hostName: string, roomName: string) => {
  await installDisplayNameForPage(page, hostName);
  await installRevealPlanCapture(page);
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

const joinRoomAsPlayer = async (browser: Browser, origin: string, roomId: string, playerName: string) => {
  const context = await browser.newContext();
  await installDisplayNameForContext(context, playerName);
  const page = await context.newPage();
  await installRevealPlanCapture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return { context, page };
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

const attachResultSoundListener = (page: Page) => {
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[trace:action]") && text.includes("audio.result.play")) {
      logs.push(text);
    }
  });
  return logs;
};

test("演出と結果サウンドが各1回で完走する", async ({ page, browser }) => {
  test.setTimeout(480_000);

  const id = Math.random().toString(36).slice(2, 8);
  const hostName = `e2e-host-${id}`;
  const p2Name = `e2e-p2-${id}`;
  const p3Name = `e2e-p3-${id}`;
  const roomName = `e2e-room-${id}`;

  const { origin, roomId } = await createRoomAsHost(page, hostName, roomName);
  await waitForPhase(page, "waiting", 60_000);

  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const audioLogs: Array<{ name: string; logs: string[] }> = [];
  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, p2Name);
    contexts.push(p2.context);
    pages.push(p2.page);
    const p3 = await joinRoomAsPlayer(browser, origin, roomId, p3Name);
    contexts.push(p3.context);
    pages.push(p3.page);

    await expect(page.getByText(/参加人数：3人/)).toBeVisible({ timeout: 45_000 });

    audioLogs.push({ name: "host", logs: attachResultSoundListener(page) });
    audioLogs.push({ name: "p2", logs: attachResultSoundListener(p2.page) });
    audioLogs.push({ name: "p3", logs: attachResultSoundListener(p3.page) });

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([page, ...pages].map((p) => waitForPhase(p, "clue", 60_000)));
    await Promise.all([
      waitForShowtimeScenario(page, "round:start", 1, 60_000),
      waitForShowtimeScenario(p2.page, "round:start", 1, 60_000),
      waitForShowtimeScenario(p3.page, "round:start", 1, 60_000),
    ]);

    await Promise.all([
      decideClueAndSubmitCard(page, "りんご"),
      decideClueAndSubmitCard(p2.page, "みかん"),
      decideClueAndSubmitCard(p3.page, "ぶどう"),
    ]);

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

    await Promise.all([
      waitForShowtimeScenario(page, "round:reveal", 2, 60_000),
      waitForShowtimeScenario(p2.page, "round:reveal", 2, 60_000),
      waitForShowtimeScenario(p3.page, "round:reveal", 2, 60_000),
    ]);

    await waitForRevealPlanCaptured(page, 60_000);

    audioLogs.forEach(({ name, logs }) => {
      const plays = logs.filter((text) => text.includes("audio.result.play"));
      if (plays.length > 0) {
        expect(plays.length, `${name} should play result sound once`).toBe(1);
      }
    });
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});
