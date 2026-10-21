import { test, expect } from '@playwright/test';

test.describe('Theme System & Persistence', () => {
  test('Landing page renders with theme toggle and defaults correctly', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="appearance" i], button[aria-label*="light" i], button[aria-label*="dark" i]').first();
    await expect(themeToggle).toBeVisible();
  });

  test('Login page has accessible theme control and supports switching', async ({ page }) => {
    await page.goto('/login');

    const themeToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="appearance" i], button[aria-label*="light" i], button[aria-label*="dark" i]').first();
    await expect(themeToggle).toBeVisible();

    // Open theme menu
    await themeToggle.click();

    // Verify Light, Dark, System options
    await expect(page.locator('button:has-text("Light")')).toBeVisible();
    await expect(page.locator('button:has-text("Dark")')).toBeVisible();
    await expect(page.locator('button:has-text("System")')).toBeVisible();

    // Select Dark mode
    await page.locator('button:has-text("Dark")').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Refresh and check persistence
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Switch to Light mode
    const refreshedToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="appearance" i], button[aria-label*="light" i], button[aria-label*="dark" i]').first();
    await refreshedToggle.click();
    await page.locator('button:has-text("Light")').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Refresh and verify Light mode persists
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
