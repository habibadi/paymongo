import { test, expect } from '@playwright/test';

/**
 * checkout_flow.spec.ts
 * Senior SDET Professional Grade - Robust & Optimized
 * Fix: Uses root URL (/), safe regex for emojis, and specific success/failure matching.
 */

test.describe('Checkout Flow - Payment Form', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the root checkout page (Next.js app serves form at /)
    await page.goto('/');
  });

  test('Happy Path: Fill all fields correctly and submit', async ({ page }) => {
    // 1. Check Backend Status (Uses regex to avoid icon/emoji matching issues)
    const statusBtn = page.getByRole('button', { name: /Check Backend Status/i });
    await expect(statusBtn).toBeVisible();
    await statusBtn.click();
    
    // Verify status message appears
    await expect(page.getByText(/Backend Status|Server is running/i)).toBeVisible();

    // 2. Fill Form using labels (synchronizes with app/page.tsx)
    await page.getByLabel(/Email Address/i).fill('test.user@example.com');
    await page.getByLabel(/Card Number/i).fill('4242 4242 4242 4242');
    
    // Exact match for short placeholders as per best practices
    await page.getByPlaceholder('MM/YY', { exact: true }).fill('12/28');
    
    // Explicitly use Label for CVV (Standard requirement)
    await page.getByLabel(/CVV/i).fill('123');
    
    await page.getByLabel(/Amount \(USD/i).fill('99.99');

    // 3. Submit Payment
    // Button text is dynamic: "Pay $99.99"
    const submitBtn = page.getByRole('button', { name: /Pay|Complete Payment/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Assert Success (Wait for processing and then success)
    await expect(page.getByText(/processed successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('Negative Path: Submit with invalid card number (Luhn Failure)', async ({ page }) => {
    await page.getByLabel(/Email Address/i).fill('error@example.com');
    // 0000...0000 matches luhnCheck == false in main.go due to hardcoded check
    await page.getByLabel(/Card Number/i).fill('0000 0000 0000 0000'); 
    await page.getByPlaceholder('MM/YY', { exact: true }).fill('12/28');
    await page.getByLabel(/CVV/i).fill('999');
    await page.getByLabel(/Amount \(USD/i).fill('10.00');

    // Attempt to submit
    await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

    // Check for form-level error message
    await expect(page.getByText(/Please enter a valid card number/i)).toBeVisible();
  });

  test('Negative Path: HTML5 Validation for Required Fields', async ({ page }) => {
    const emailInput = page.getByLabel(/Email Address/i);
    const submitBtn = page.getByRole('button', { name: /Pay|Complete Payment/i });

    // Submit while empty
    await submitBtn.click();

    // Check HTML5 validity state
    await expect(emailInput).toHaveJSProperty('validity.valid', false);
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('Data Integrity: Verify Placeholders and Constraints', async ({ page }) => {
    // Verify placeholders match DOM for accessibility
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('1234 5678 9012 3456')).toBeVisible();
    await expect(page.getByPlaceholder('MM/YY', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('123', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('0.00')).toBeVisible();

    // Verify constraints
    await expect(page.getByLabel(/Card Number/i)).toHaveAttribute('maxLength', '19');
    await expect(page.getByLabel(/CVV/i)).toHaveAttribute('type', 'password');
  });

});