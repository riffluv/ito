import { test, expect, chromium, BrowserContext, Page } from "@playwright/test";

/**
 * 多人数（デフォ6人）で結果サウンドが各1回だけ鳴ることを検証する E2E の雛形。
 * - 実環境に依存するため、デフォルトでは skip にしています。
 * - 実行前に RESULT_SOUND_ROOM_URL を「waiting 状態のルーム URL」に設定してください。
 * - リビール開始の操作が環境により異なるため、triggerReveal を環境に合わせて実装してください。
 *
 * 実行例:
 * RESULT_SOUND_ROOM_URL="https://localhost:3000/rooms/abcd" RESULT_SOUND_USERS=6 npx playwright test tests/resultSound.multi.spec.ts
 */
test.describe.skip("result sound multi-user (manual env)", () => {
  const userCount = Number(process.env.RESULT_SOUND_USERS ?? 6);
  const roomUrl = process.env.RESULT_SOUND_ROOM_URL;

  test("victory/failure sound plays once per user", async () => {
    if (!roomUrl) {
      test.skip("RESULT_SOUND_ROOM_URL を設定してください（waiting 状態のルーム URL）");
    }

    const browser = await chromium.launch({ headless: true });
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const playLogs: Array<string[]> = [];

    try {
      for (let i = 0; i < userCount; i += 1) {
        const context = await browser.newContext({
          viewport: { width: 900, height: 700 },
        });
        const page = await context.newPage();
        const logs: string[] = [];
        page.on("console", (msg) => {
          const text = msg.text();
          if (
            text.includes("[trace:action]") &&
            text.includes("audio.result.play")
          ) {
            logs.push(text);
          }
        });
        await page.goto(roomUrl!, { waitUntil: "domcontentloaded" });
        pages.push(page);
        contexts.push(context);
        playLogs.push(logs);
      }

      // 全員の SoundProvider ready を待つ（最大 6 秒）
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            () => (window as typeof window & { __AUDIO_READY__?: boolean }).__AUDIO_READY__ === true,
            null,
            { timeout: 6000 }
          )
        )
      );

      // TODO: 環境に合わせてリビール開始を実装してください。
      await triggerReveal(pages[0]);

      // 各ページで結果サウンドの trace が1回以上出るまで待つ（最大 8 秒）
      await Promise.all(
        playLogs.map((logs) =>
          waitForCondition(
            () => logs.some((line) => line.includes("audio.result.play")),
            8000
          )
        )
      );

      // 各ページごとに1回だけ鳴っていること（現状は “少なくとも1回” を確認）
      playLogs.forEach((logs, index) => {
        expect(
          logs.filter((line) => line.includes("audio.result.play")).length,
          `page ${index} should have at least one result sound`
        ).toBeGreaterThanOrEqual(1);
      });
    } finally {
      await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
      await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
      await browser.close();
    }
  });
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

async function triggerReveal(page: Page) {
  // ▼ ここを環境に合わせて書き換えてください ▼
  // 例: ボタンを押す／API を叩く／特定のカスタムイベントを dispatch する、など。
  await page.evaluate(() => {
    throw new Error("triggerReveal を環境に合わせて実装してください");
  });
}

async function waitForCondition(
  fn: () => boolean,
  timeoutMs: number,
  intervalMs = 100
): Promise<void> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fn()) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error("condition not met within timeout");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
