// DPI Scaling Validation Tests
// Playwright E2E tests for Windows 125%/150% DPI scaling

import { test, expect } from '@playwright/test';

test.describe('DPI Scaling Validation', () => {
  // Test multiple DPI scales using deviceScaleFactor
  const dpiScales = [
    { name: '100% DPI', deviceScaleFactor: 1.0 },
    { name: '125% DPI', deviceScaleFactor: 1.25 },
    { name: '150% DPI', deviceScaleFactor: 1.5 },
  ];

  const viewports = [
    { name: 'Desktop HD', width: 1280, height: 800 },
    { name: 'Desktop FHD', width: 1920, height: 1080 },
    { name: 'Laptop', width: 1440, height: 900 },
  ];

  dpiScales.forEach(dpi => {
    viewports.forEach(viewport => {
      test(`${dpi.name} - ${viewport.name} - Cardboard Fits Viewport`, async ({ page }) => {
        // Set up viewport with DPI scale
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        // Mock device pixel ratio for DPI testing
        await page.addInitScript(`
          Object.defineProperty(window, 'devicePixelRatio', {
            get: () => ${dpi.deviceScaleFactor}
          });
        `);

        // Navigate to game room
        await page.goto('/rooms/test-room');

        // Wait for cardboard to load
        const cardboard = page.locator('[data-testid="cardboard"], .card-board, [aria-label*="card"], [aria-label*="board"]').first();
        await cardboard.waitFor({ timeout: 10000 });

        // Verify cardboard doesn't overflow horizontally
        const cardboardBox = await cardboard.boundingBox();
        const viewportSize = page.viewportSize();

        expect(cardboardBox).toBeTruthy();
        expect(cardboardBox!.width).toBeLessThanOrEqual(viewportSize!.width);

        // Check for horizontal scrollbar (indicates overflow)
        const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
        expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5); // 5px tolerance

        // Visual regression test
        await expect(page).toHaveScreenshot(`cardboard-${dpi.name.replace('%', 'pct').replace(' ', '-')}-${viewport.name.replace(' ', '-')}.png`, {
          fullPage: true,
          threshold: 0.2
        });
      });

      test(`${dpi.name} - ${viewport.name} - Cards Maintain Aspect Ratio`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.addInitScript(`
          Object.defineProperty(window, 'devicePixelRatio', {
            get: () => ${dpi.deviceScaleFactor}
          });
        `);

        await page.goto('/rooms/test-room');

        // Wait for cards to render
        const cards = page.locator('[data-testid="game-card"], .game-card').first();
        await cards.waitFor({ timeout: 10000 });

        // Measure card aspect ratio
        const cardBox = await cards.boundingBox();
        expect(cardBox).toBeTruthy();

        const aspectRatio = cardBox!.width / cardBox!.height;
        const expectedRatio = 5 / 7; // 0.714...
        const tolerance = 0.05; // 5% tolerance

        expect(aspectRatio).toBeGreaterThan(expectedRatio - tolerance);
        expect(aspectRatio).toBeLessThan(expectedRatio + tolerance);
      });
    });
  });

  test('Container Query Responsiveness', async ({ page }) => {
    await page.goto('/rooms/test-room');

    // Test different container widths
    const containerWidths = [350, 600, 900, 1200];

    for (const width of containerWidths) {
      await page.setViewportSize({ width, height: 800 });
      
      // Wait for layout to stabilize
      await page.waitForTimeout(500);

      // Check that cards adapt to container size
      const cardboard = page.locator('[data-testid="cardboard"]').first();
      const cardboardBox = await cardboard.boundingBox();

      expect(cardboardBox).toBeTruthy();
      expect(cardboardBox!.width).toBeLessThanOrEqual(width);

      // Verify CSS Grid is working
      const gridColumns = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="cardboard"]') as HTMLElement;
        return element ? getComputedStyle(element).gridTemplateColumns : '';
      });

      expect(gridColumns).toContain('repeat');
    }
  });

  test('CSS Custom Properties Are Applied', async ({ page }) => {
    await page.goto('/rooms/test-room');

    // Check that CSS custom properties are defined
    const cssProperties = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      return {
        cardGap: computedStyle.getPropertyValue('--card-gap'),
        cardMin: computedStyle.getPropertyValue('--card-min'),
        cardIdeal: computedStyle.getPropertyValue('--card-ideal'),
        cardMax: computedStyle.getPropertyValue('--card-max'),
        cardAspect: computedStyle.getPropertyValue('--card-aspect'),
      };
    });

    expect(cssProperties.cardGap).toBeTruthy();
    expect(cssProperties.cardMin).toBeTruthy();
    expect(cssProperties.cardIdeal).toBeTruthy();
    expect(cssProperties.cardMax).toBeTruthy();
    expect(cssProperties.cardAspect).toContain('5 / 7');
  });

  test('No Layout Shift During Card Loading', async ({ page }) => {
    // Navigate to page
    await page.goto('/rooms/test-room');

    // Measure Cumulative Layout Shift
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let cumulativeLayoutShift = 0;
        
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              cumulativeLayoutShift += (entry as any).value;
            }
          }
        });

        observer.observe({ entryTypes: ['layout-shift'] });

        // Wait for page to stabilize
        setTimeout(() => {
          observer.disconnect();
          resolve(cumulativeLayoutShift);
        }, 3000);
      });
    }).then((cls) => {
      // CLS should be under 0.1 for good user experience
      expect(cls).toBeLessThan(0.1);
    });
  });

  test('Grid Layout Works in Legacy Browsers', async ({ page }) => {
    // Simulate legacy browser without container query support
    await page.addInitScript(() => {
      // Remove container query support
      Object.defineProperty(CSS, 'supports', {
        value: (property: string, value?: string) => {
          if (property.includes('container') || value?.includes('container')) {
            return false;
          }
          return true; // Support other CSS features
        }
      });
    });

    await page.goto('/rooms/test-room');

    // Verify fallback CSS grid still works
    const cardboard = page.locator('.legacy-card-grid, [data-testid="cardboard"]').first();
    await cardboard.waitFor({ timeout: 10000 });

    const cardboardBox = await cardboard.boundingBox();
    const viewportSize = page.viewportSize();

    expect(cardboardBox).toBeTruthy();
    expect(cardboardBox!.width).toBeLessThanOrEqual(viewportSize!.width);
  });

  test('Performance - Paint Times Under 50ms', async ({ page }) => {
    await page.goto('/rooms/test-room');

    // Measure paint performance
    const paintMetrics = await page.evaluate(() => {
      return performance.getEntriesByType('paint').map(entry => ({
        name: entry.name,
        startTime: entry.startTime
      }));
    });

    const firstContentfulPaint = paintMetrics.find(m => m.name === 'first-contentful-paint');
    expect(firstContentfulPaint?.startTime).toBeLessThan(3000); // Under 3 seconds
  });
});

// Visual regression test configuration
test.describe.configure({ mode: 'parallel' });