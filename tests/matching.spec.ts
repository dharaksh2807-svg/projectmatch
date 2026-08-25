import { test, expect } from '@playwright/test';

test.describe('Matching API Route', () => {
  test('API returns 401 for unauthorized access to matches endpoint', async ({ request }) => {
    // This is an unauthenticated request to the API
    const response = await request.get('/api/matches/candidates?projectId=test');
    
    // Assuming the API is protected, it should return 401 Unauthorized
    expect(response.status()).toBe(401);
  });
  
  test('API returns 401 for unauthorized access to test-matching endpoint', async ({ request }) => {
    // This is an unauthenticated request to the API
    const response = await request.get('/api/test-matching');
    
    // Should return 401
    expect(response.status()).toBe(401);
  });
});
