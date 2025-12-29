/**
 * waiting エリアカード消失の再現（optimistic waiting）
 *
 * 目的:
 * - RESET を押した直後、FSM が status=waiting を先行させる間に
 *   Firestore の order/proposal が古いままでも waiting カードが消えないこと。
 *
 * 期待:
 * - optimistic waiting 中でも waiting-area に参加者カードが表示される
 *
 * 前提:
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
  // presence が上がるまで少し待つ
  await page.waitForTimeout(1200);
  return { context, page };
};

const decideClue = async (page: Page, clue: string) => {
  const clueInput = page.getByLabel("連想ワード");
  await expect(clueInput).toBeVisible({ timeout: 45_000 });
  await expect(clueInput).toBeEnabled({ timeout: 45_000 });
  await clueInput.fill(clue);

  const decideButton = page.getByRole("button", { name: /決定/ });
  await expect(decideButton).toBeVisible({ timeout: 20_000 });
  await expect(decideButton).toBeEnabled({ timeout: 20_000 });
  await decideButton.click();
};

const waitForMyDraggableCard = async (page: Page, playerName: string) => {
  const boardRoot = page.locator("[data-board-root]");
  const boardCard = boardRoot
    .locator("[data-interactive='true']")
    .filter({ hasText: playerName })
    .first();
  const waitingCard = page.getByLabel(`${playerName}のカード`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (await boardCard.isVisible().catch(() => false)) return boardCard;
    if (await waitingCard.isVisible().catch(() => false)) return waitingCard;
    await page.waitForTimeout(100);
  }
  throw new Error(`Failed to locate draggable card for ${playerName}`);
};

const dragCardToSlot = async (page: Page, playerName: string, slotIndex: number) => {
  const slots = page.locator("[data-slot]");
  const slotCount = await slots.count();
  expect(slotCount).toBeGreaterThan(slotIndex);

  const targetSlot = slots.nth(slotIndex);
  const box = await targetSlot.boundingBox();
  if (!box) throw new Error("missing slot bounding box");

  const card = await waitForMyDraggableCard(page, playerName);
  await expect(card).toBeVisible({ timeout: 20_000 });

  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await card.hover();
  await page.mouse.down();
  await page.mouse.move(center.x, center.y, { steps: 8 });
  await page.waitForTimeout(150);
  await page.mouse.up();
};

test("RESET の optimistic waiting 中でも waiting カードが消えない", async ({ page, browser }) => {
  test.setTimeout(360_000);

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

    await expect(page.getByText(/参加人数：2人/)).toBeVisible({ timeout: 45_000 });

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([page, p2.page].map((p) => waitForPhase(p, "clue", 60_000)));

    await Promise.all([decideClue(page, "りんご"), decideClue(p2.page, "みかん")]);

    await dragCardToSlot(page, hostName, 0);
    await dragCardToSlot(p2.page, playerName, 1);

    // 2人とも置けたら waiting-area は消える（clue中）
    const waitingArea = page.locator('[data-testid="waiting-area"]');
    await expect(waitingArea).toHaveCount(0);

    // reset API を意図的に遅延し、FSM だけが先に waiting になる状態を作る
    let delayed = false;
    await page.route(`**/api/rooms/${roomId}/reset`, async (route) => {
      if (delayed) {
        await route.continue();
        return;
      }
      delayed = true;
      await new Promise<void>((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });

    const resetButton = page.locator('button:has(img[alt="Reset game"])');
    await expect(resetButton).toBeVisible({ timeout: 45_000 });
    await expect(resetButton).toBeEnabled({ timeout: 45_000 });
    await resetButton.click();

    // optimistic で waiting に遷移する（この時点では Firestore の order/proposal が古い可能性がある）
    await waitForPhase(page, "waiting", 20_000);

    const waitingAreaAfterReset = page.locator('[data-testid="waiting-area"]');
    await expect(waitingAreaAfterReset).toBeVisible({ timeout: 10_000 });
    await expect(waitingAreaAfterReset.getByText(hostName)).toBeVisible({ timeout: 10_000 });
    await expect(waitingAreaAfterReset.getByText(playerName)).toBeVisible({ timeout: 10_000 });

    await page.unroute(`**/api/rooms/${roomId}/reset`);
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});

