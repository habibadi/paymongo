import { test, expect } from '@playwright/test';

test.describe('Web Automation Example', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to base URL before each test
        await page.goto('/');
    });

    test('should load homepage successfully', async ({ page }) => {
        // Example: Check if page loads and has expected title
        await expect(page).toHaveTitle(/Home|Welcome|Payment Checkout App/i);

        // Example: Check if main navigation is visible
        const navigation = page.locator('nav, .navbar, [role="navigation"]');
        await expect(navigation).toBeVisible();
    });

    test('should handle form submission', async ({ page }) => {
        // Example: Fill and submit a form
        const nameInput = page.locator('input[name="name"], #name');
        const emailInput = page.locator('input[name="email"], #email');
        const submitButton = page.locator('button[type="submit"], input[type="submit"]');

        // Only run if form elements exist
        if ((await nameInput.count()) > 0) {
            await nameInput.fill('Test User');
            await emailInput.fill('test@example.com');
            await submitButton.click();

            // Check for success message or redirect
            await expect(page.locator('.success, .alert-success')).toBeVisible({ timeout: 5000 });
        }
    });

});

test.describe('E-commerce Checkout Example', () => {
    test('should handle checkout flow', async ({ page }) => {
        // Open the app
        await page.goto('/');

        // Fill email and card number
        await page.fill('input[name="email"]', 'tester@example.com');
        await page.fill('input[name="cardNumber"]', '4242 4242 4242 4242');
        
        // Focus next field to trigger card validation blur event reliably
        await page.focus('input[name="expiry"]');
        
        // Wait for card validation to finish (Luhn check)
        await expect(page.locator('text=Valid card number')).toBeVisible({ timeout: 10000 });

        // Fill remaining fields
        await page.fill('input[name="expiry"]', '12/26');
        await page.fill('input[name="cvv"]', '123');
        await page.fill('input[name="amount"]', '99.99');

        // Submit order
        await page.click('button[type="submit"]');

        // Wait for final success confirmation text
        await expect(page.locator('text=Payment processed successfully')).toBeVisible({
            timeout: 10000,
        });
    });
});
