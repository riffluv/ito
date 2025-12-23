/**
 * 同じスロットへの同時ドロップでも同期が破綻しないことを確認
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

const joinRoomAsPlayer = async (browser: Browser, origin: string, roomId: string, playerName: string) => {
  const context = await browser.newContext();
  await installDisplayNameForContext(context, playerName);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/rooms/${roomId}`);
  await page.waitForTimeout(1200);
  return { context, page };
};

const decideClue = async (page: Page, clue: string) => {
  const clueInput = page.getByLabel("連想ワード");
  await expect(clueInput).toBeVisible({ timeout: 45_000 });
  await expect(clueInput).toBeEnabled({ timeout: 45_000 });
  await clueInput.fill(clue);

  const decideButton = page.getByRole("button", { name: "決定" });
  await expect(decideButton).toBeVisible({ timeout: 20_000 });
  await expect(decideButton).toBeEnabled({ timeout: 20_000 });
  await decideButton.click();
};

const dragOwnWaitingCardToSlot = async (
  page: Page,
  playerName: string,
  slotIndex: number,
  slots: ReturnType<Page["locator"]>
) => {
  const card = page.getByLabel(`${playerName}のカード`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();

  const targetSlot = slots.nth(slotIndex);
  const box = await targetSlot.boundingBox();
  if (!box) throw new Error("target slot bounding box missing");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await card.hover();
  await page.mouse.down();
  await page.mouse.move(center.x, center.y, { steps: 10 });
  await page.waitForTimeout(220);
  await page.mouse.up();
};

const slotIndexForToken = async (
  token: ReturnType<Page["locator"]>,
  slots: ReturnType<Page["locator"]>
) => {
  const tokenBox = await token.boundingBox();
  if (!tokenBox) return -1;
  const center = { x: tokenBox.x + tokenBox.width / 2, y: tokenBox.y + tokenBox.height / 2 };

  const count = await slots.count();
  let bestIndex = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const slotBox = await slots.nth(i).boundingBox();
    if (!slotBox) continue;

    const inside =
      center.x >= slotBox.x &&
      center.x <= slotBox.x + slotBox.width &&
      center.y >= slotBox.y &&
      center.y <= slotBox.y + slotBox.height;
    if (inside) return i;

    const cx = slotBox.x + slotBox.width / 2;
    const cy = slotBox.y + slotBox.height / 2;
    const dx = center.x - cx;
    const dy = center.y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
};

const getSlotIndexForPlayer = async (
  page: Page,
  playerName: string,
  slots: ReturnType<Page["locator"]>
) => {
  const waitingCard = page.locator(
    `[data-waiting-card][data-player-name="${playerName}"]`
  );
  if ((await waitingCard.count()) > 0) return null;
  const boardRoot = page.locator("[data-board-root]");
  const token = boardRoot.getByText(playerName, { exact: true });
  if ((await token.count()) === 0) return null;
  const idx = await slotIndexForToken(token.first(), slots);
  return idx >= 0 ? idx : null;
};

const waitForConflictResolution = async (
  page: Page,
  slots: ReturnType<Page["locator"]>,
  hostName: string,
  p2Name: string,
  conflictIdx: number,
  timeoutMs = 60_000
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [hostIdx, p2Idx] = await Promise.all([
      getSlotIndexForPlayer(page, hostName, slots),
      getSlotIndexForPlayer(page, p2Name, slots),
    ]);
    const hostInConflict = hostIdx === conflictIdx;
    const p2InConflict = p2Idx === conflictIdx;
    if (hostInConflict !== p2InConflict) {
      return { hostIdx, p2Idx };
    }
    await page.waitForTimeout(200);
  }
  throw new Error("conflict did not resolve within timeout");
};

const expectPlayerCardInSlot = async (page: Page, playerName: string, slotIndex: number) => {
  const boardRoot = page.locator("[data-board-root]");
  await expect(boardRoot).toBeVisible({ timeout: 45_000 });

  const token = boardRoot.getByText(playerName, { exact: true }).first();
  await expect(token).toBeVisible({ timeout: 45_000 });

  const slots = boardRoot.locator("[data-slot]");
  await expect(slots.first()).toBeVisible({ timeout: 45_000 });

  await expect
    .poll(async () => slotIndexForToken(token, slots), { timeout: 45_000 })
    .toBe(slotIndex);
};

const pickSlotIndex = (slotCount: number, avoid: number[]) => {
  for (let i = 0; i < slotCount; i += 1) {
    if (!avoid.includes(i)) return i;
  }
  return 0;
};

test("同じスロットへの同時ドロップでも同期が破綻しない", async ({ page, browser }) => {
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
  try {
    const p2 = await joinRoomAsPlayer(browser, origin, roomId, p2Name);
    contexts.push(p2.context);
    pages.push(p2.page);
    const p3 = await joinRoomAsPlayer(browser, origin, roomId, p3Name);
    contexts.push(p3.context);
    pages.push(p3.page);

    await expect(page.getByText(/参加人数：3人/)).toBeVisible({ timeout: 45_000 });

    const startButton = page.getByRole("button", { name: "ゲーム開始" });
    await expect(startButton).toBeVisible({ timeout: 45_000 });
    await expect(startButton).toBeEnabled({ timeout: 45_000 });
    await startButton.click();

    await Promise.all([page, ...pages].map((p) => waitForPhase(p, "clue", 60_000)));
    await Promise.all([
      decideClue(page, "りんご"),
      decideClue(p2.page, "みかん"),
      decideClue(p3.page, "ぶどう"),
    ]);

    const slots = page.locator("[data-board-root] [data-slot]");
    await expect(slots.first()).toBeVisible({ timeout: 45_000 });
    const slotCount = await slots.count();
    expect(slotCount).toBeGreaterThanOrEqual(3);

    const conflictIdx = Math.min(Math.floor(slotCount / 2), slotCount - 1);
    const otherIdx = pickSlotIndex(slotCount, [conflictIdx]);
    const thirdIdx = pickSlotIndex(slotCount, [conflictIdx, otherIdx]);

    await Promise.all([
      dragOwnWaitingCardToSlot(page, hostName, conflictIdx, slots),
      dragOwnWaitingCardToSlot(p2.page, p2Name, conflictIdx, p2.page.locator("[data-board-root] [data-slot]")),
    ]);

    const { hostIdx } = await waitForConflictResolution(
      page,
      slots,
      hostName,
      p2Name,
      conflictIdx,
      90_000
    );

    const hostPlaced = hostIdx === conflictIdx;
    const winnerName = hostPlaced ? hostName : p2Name;
    const loserName = hostPlaced ? p2Name : hostName;
    const loserPage = hostPlaced ? p2.page : page;

    const allPages = [page, p2.page, p3.page];
    await expect
      .poll(
        async () =>
          Promise.all(
            allPages.map((p) =>
              getSlotIndexForPlayer(p, winnerName, p.locator("[data-board-root] [data-slot]"))
            )
          ),
        { timeout: 60_000 }
      )
      .toEqual(allPages.map(() => conflictIdx));

    await expect
      .poll(
        async () =>
          Promise.all(
            allPages.map((p) =>
              getSlotIndexForPlayer(p, loserName, p.locator("[data-board-root] [data-slot]"))
            )
          ),
        { timeout: 60_000 }
      )
      .toEqual(allPages.map(() => null));

    await dragOwnWaitingCardToSlot(loserPage, loserName, otherIdx, loserPage.locator("[data-board-root] [data-slot]"));
    await dragOwnWaitingCardToSlot(p3.page, p3Name, thirdIdx, p3.page.locator("[data-board-root] [data-slot]"));

    for (const p of allPages) {
      await expectPlayerCardInSlot(p, winnerName, conflictIdx);
      await expectPlayerCardInSlot(p, loserName, otherIdx);
      await expectPlayerCardInSlot(p, p3Name, thirdIdx);
    }

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
