import { test, expect } from '@playwright/test';

test.describe('Web Automation Example', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to base URL before each test
        await page.goto('/');
    });

    test('should load homepage successfully', async ({ page }) => {
        // Example: Check if page loads and has expected title
        await expect(page).toHaveTitle(/Home|Welcome|Payment Checkout App/i);

        // Example: Check if main navigation is visible (commented out as app lacks nav tag)
        // const navigation = page.locator('nav, .navbar, [role="navigation"]');
        // await expect(navigation).toBeVisible();
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
        await page.getByPlaceholder('you@example.com').fill('tester@example.com');
        await page.getByPlaceholder('1234 5678 9012 3456').fill('4242 4242 4242 4242');
        
        // Trigger blur by clicking outside or focusing another field
        await page.getByPlaceholder('MM/YY').focus();
        
        // Wait for card validation to finish (Luhn check) - matching the actual UI text with emoji
        await expect(page.getByText(/Valid card number/)).toBeVisible({ timeout: 10000 });

        // Fill remaining fields
        await page.getByPlaceholder('MM/YY').fill('12/26');
        await page.getByPlaceholder('123').fill('123');
        await page.getByPlaceholder('0.00').fill('99.99');

        // Submit order
        await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

        // Wait for final success confirmation text
        await expect(page.getByText(/processed successfully|✅/)).toBeVisible({
            timeout: 10000,
        });
    });
});
