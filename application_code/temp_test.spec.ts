import { test, expect } from '@playwright/test';
test('dummy', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
});
