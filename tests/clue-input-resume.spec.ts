import { expect, test } from "@playwright/test";

test("background/resume keeps clue input editable after game start", async ({ page, context }) => {
  test.setTimeout(120_000);

  const id = Math.random().toString(36).slice(2, 8);
  const playerName = `e2e-${id}`;
  const roomName = `e2e-${id}`;

  await page.goto("/");

  await page.getByRole("button", { name: "新しい部屋を作成" }).first().click();

  const nameInput = page.getByPlaceholder("れい: コーヒーやめます");
  const roomInput = page.getByPlaceholder("れい: 友達とあそぶ");

  // NameDialog が開く場合があるので、どちらかが表示されるまで待つ（初回レンダリングのレース対策）
  await expect(nameInput.or(roomInput)).toBeVisible({ timeout: 20_000 });

  if (await nameInput.isVisible()) {
    await nameInput.fill(playerName);
    await page.getByRole("button", { name: "きめる" }).click();
    await expect(roomInput).toBeVisible({ timeout: 20_000 });
  }

  await roomInput.fill(roomName);
  await page.getByRole("button", { name: "作成" }).click();

  const enterRoom = page.getByRole("button", { name: "へやへ すすむ" });
  await expect(enterRoom).toBeVisible({ timeout: 30_000 });
  await enterRoom.click();

  // Known repro: background during room loading, then resume and start the game.
  const backgroundDuringLoad = await context.newPage();
  await backgroundDuringLoad.goto("about:blank");
  await backgroundDuringLoad.bringToFront();
  await backgroundDuringLoad.waitForTimeout(3500);
  await page.bringToFront();
  await backgroundDuringLoad.close();

  const startButton = page.getByRole("button", { name: "ゲーム開始" });
  await expect(startButton).toBeVisible({ timeout: 45_000 });
  await expect(startButton).toBeEnabled({ timeout: 45_000 });

  await startButton.click();

  const clueInput = page.getByLabel("連想ワード");
  await expect(clueInput).toBeVisible({ timeout: 45_000 });
  await expect(clueInput).toBeEnabled({ timeout: 45_000 });

  await clueInput.fill("りんご");
  await expect(clueInput).toHaveValue("りんご");
});
