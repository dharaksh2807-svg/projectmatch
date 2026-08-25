import { test, expect } from '@playwright/test';

test.describe('Authentication and Dashboard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    // Attempt to navigate directly to the dashboard
    await page.goto('/dashboard');
    
    // Should be redirected to the login page
    await expect(page).toHaveURL(/.*\/login.*/);
  });
  
  test('shows sign in button on login page', async ({ page }) => {
    await page.goto('/login');
    
    // Verify the Sign in with GitHub button exists
    const signInButton = page.locator('button:has-text("Sign in with GitHub")');
    await expect(signInButton).toBeVisible();
  });
  
  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Verify the main heading
    await expect(page.locator('h1')).toContainText('Find Your Dream Team');
    
    // Verify Get Started button
    const getStartedLink = page.locator('a:has-text("Get Started")').first();
    await expect(getStartedLink).toBeVisible();
  });
});
