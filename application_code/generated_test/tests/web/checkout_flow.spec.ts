import { test, expect } from '@playwright/test';

/**
 * checkout_flow.spec.ts
 * Senior SDET Professional Grade - Self-Healing Applied
 * Fix: Refined locators to match provided DOM snapshot exactly.
 */

test.describe('Checkout Flow - Payment Form', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the checkout page
    await page.goto('/checkout');
  });

  test('Happy Path: Fill all fields correctly and submit', async ({ page }) => {
    // 1. Check Backend Status (Matches button text exactly)
    const statusBtn = page.getByRole('button', { name: '🔌 Check Backend Status' });
    await expect(statusBtn).toBeVisible();
    await statusBtn.click();

    // 2. Fill Form using Label Locators (Matches [icon]Text labels in DOM)
    // Using regex to handle the [icon] prefix in labels for higher stability
    await page.getByLabel(/Email Address/i).fill('test.user@example.com');
    await page.getByLabel(/Card Number/i).fill('1234 5678 9012 3456');
    
    // Requirement: Exact match for short placeholders
    await page.getByPlaceholder('MM/YY', { exact: true }).fill('12/25');
    
    // Requirement: Explicitly use Label for CVV
    await page.getByLabel(/CVV/i).fill('123');
    
    await page.getByLabel(/Amount \(USD\)/i).fill('99.99');

    // 3. Submit Payment
    // Matches button text including potential icon text nodes
    const submitBtn = page.getByRole('button', { name: /Complete Payment/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Assert Success
    // Note: Success state is not in the provided DOM, but we assume it appears after submit
    await expect(page.getByText(/Payment successful/i)).toBeVisible();
  });

  test('Negative Path: Submit with invalid card number', async ({ page }) => {
    await page.getByLabel(/Email Address/i).fill('error@example.com');
    await page.getByLabel(/Card Number/i).fill('0000 0000 0000 0000'); 
    await page.getByPlaceholder('MM/YY', { exact: true }).fill('12/25');
    await page.getByLabel(/CVV/i).fill('999');
    await page.getByLabel(/Amount \(USD\)/i).fill('10.00');

    await page.getByRole('button', { name: /Complete Payment/i }).click();

    // Web-First assertion for simulated error response
    const errorMessage = page.getByText(/Invalid card number/i);
    await expect(errorMessage).toBeVisible();
  });

  test('Negative Path: HTML5 Validation for Required Fields', async ({ page }) => {
    const emailInput = page.getByLabel(/Email Address/i);
    const submitBtn = page.getByRole('button', { name: /Complete Payment/i });

    // Trigger validation
    await submitBtn.click();

    // Check HTML5 validation state (native browser behavior)
    await expect(emailInput).toHaveJSProperty('validity.valid', false);
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('Data Integrity: Verify Placeholders and Constraints', async ({ page }) => {
    // Verify placeholders match DOM exactly
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('1234 5678 9012 3456')).toBeVisible();
    await expect(page.getByPlaceholder('MM/YY', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('123', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('0.00')).toBeVisible();

    // Verify field constraints from DOM
    await expect(page.getByLabel(/Card Number/i)).toHaveAttribute('maxLength', '19');
    await expect(page.getByLabel(/CVV/i)).toHaveAttribute('type', 'password');
  });

});