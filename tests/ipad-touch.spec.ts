import { test, expect, devices } from '@playwright/test';

const iPad = devices['iPad Pro 12.9'];

test.describe.configure({ mode: 'serial' });

test.describe('iPad Pro touch layout', () => {
  test.use({
    ...iPad,
    viewport: iPad.viewport,
    userAgent: iPad.userAgent,
  });

  test('パーティーパネルが可視である', async ({ page }) => {
    await page.goto('/rooms/test-room');
    await page.waitForTimeout(500);

    const partyHeader = page.locator('text=なかま').first();
    await expect(partyHeader).toBeVisible();

    const emblem = page.locator('img[alt="party emblem"]').first();
    await expect(emblem).toBeVisible();
  });

  test('フッターボタンがコンパクトでスクロールバーが出ない', async ({ page }) => {
    await page.goto('/rooms/test-room');
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => {
      const body = document.body;
      const doc = document.documentElement;
      return body.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(4);

    const decideButton = page.getByRole('button', { name: /決定/ });
    await expect(decideButton).toBeVisible();

    const box = await decideButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeLessThanOrEqual(68);
  });

  test('ドラッグ可能領域が touch-action: none を維持する', async ({ page }) => {
    await page.goto('/rooms/test-room');
    await page.waitForTimeout(500);

    const touchAction = await page.evaluate(() => {
      const board =
        (document.querySelector('[data-board-root]') as HTMLElement | null) ??
        (document.querySelector('[data-testid="cardboard"]') as HTMLElement | null);
      return board ? getComputedStyle(board).touchAction : null;
    });

    expect(touchAction).toBe('none');
  });
});
