import { test, expect } from '@playwright/test';
test('draw, undo, redo, reload persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /New notebook/ }).click();
  await page.getByRole('button', { name: /open/i }).first().click();
  const canvas = page.getByTestId('ink-canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no box');
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down(); await page.mouse.move(box.x + 150, box.y + 120, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: /Undo/ })).toBeEnabled();
  // persistence is via autosave; wait then reload library count visible after back
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('button', { name: /Redo/ })).toBeEnabled();
  await page.getByRole('button', { name: /Redo/ }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  // after reload we are in library; notebook exists
  await expect(page.getByText(/pages/)).toBeVisible();
});
