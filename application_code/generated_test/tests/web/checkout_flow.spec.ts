import { test, expect } from '@playwright/test';

test.describe('Payment Checkout Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Happy Path - Successfully submit a payment', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill('customer@example.com');
    await page.getByPlaceholder('1234 5678 9012 3456').fill('4242 4242 4242 4242');
    await page.getByPlaceholder('MM/YY').fill('12/25');
    await page.getByPlaceholder('123').fill('123');
    await page.getByPlaceholder('0.00').fill('100.00');

    await page.getByRole('button', { name: /submit/i }).or(page.getByRole('button')).last().click();

    const successMessage = page.locator('text=/processed|✅/');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).getByText(/processed successfully|✅/).toBeVisible();
  });

  test('Negative Path - Submit with an invalid card number', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill('customer@example.com');
    await page.getByPlaceholder('1234 5678 9012 3456').fill('1111 1111 1111 1111');
    await page.getByPlaceholder('MM/YY').fill('12/25');
    await page.getByPlaceholder('123').fill('123');
    await page.getByPlaceholder('0.00').fill('100.00');

    await page.getByRole('button', { name: /submit/i }).or(page.getByRole('button')).last().click();

    const errorMessage = page.getByText('❌');
    await expect(errorMessage).toBeVisible();
  });

  test('Negative Path - Verify form HTML5 validation blocks empty submission', async ({ page }) => {
    const emailInput = page.getByPlaceholder('you@example.com');
    const cardNumberInput = page.getByPlaceholder('1234 5678 9012 3456');

    await page.getByRole('button', { name: /submit/i }).or(page.getByRole('button')).last().click();

    const isEmailValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    const isCardValid = await cardNumberInput.evaluate((el: HTMLInputElement) => el.checkValidity());

    expect(isEmailValid).toBe(false);
    expect(isCardValid).toBe(false);

    await expect(page.getByText(/processed|✅/)).not.toBeVisible();
  });
});