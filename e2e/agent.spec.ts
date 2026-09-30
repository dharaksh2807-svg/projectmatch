import { test, expect } from '@playwright/test';

test.describe('Agent & Chat Basic Workflow', () => {
  test('redirects to sign in when not authenticated', async ({ page }) => {
    await page.goto('/chat');
    // Expect to be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
