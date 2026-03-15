import { test, expect, Page } from '@playwright/test';

test.describe('Payment Checkout Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Helper: fill all checkout fields with given values
  async function fillCheckoutForm(page: Page, {
    email = 'customer@example.com',
    card = '4242 4242 4242 4242',
    expiry = '12/25',
    cvv = '123',
    amount = '100.00'
  } = {}) {
    await page.getByPlaceholder('you@example.com').fill(email);
    // Use exact:true for card placeholder — partial '123' would also match CVV 
    await page.getByPlaceholder('1234 5678 9012 3456', { exact: true }).fill(card);
    await page.getByPlaceholder('MM/YY', { exact: true }).fill(expiry);
    // Use label or exact match for CVV — placeholder '123' must be exact to avoid
    // ambiguity with the card number field which contains '123' in its placeholder
    await page.getByLabel('CVV').fill(cvv);
    await page.getByPlaceholder('0.00', { exact: true }).fill(amount);
  }

  test('Happy Path - Successfully submit a payment', async ({ page }) => {
    await fillCheckoutForm(page, {
      email: 'customer@example.com',
      card: '4242 4242 4242 4242',
      expiry: '12/25',
      cvv: '123',
      amount: '99.99'
    });

    // Click the submit button
    await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

    // Assert that a success message appears
    await expect(page.getByText(/processed successfully|✅/i)).toBeVisible({ timeout: 10000 });
  });

  test('Negative Path - Submit with an invalid card number (Luhn fail)', async ({ page }) => {
    await fillCheckoutForm(page, {
      email: 'customer@example.com',
      card: '1111 1111 1111 1111',  // Fails Luhn check
      expiry: '12/25',
      cvv: '123',
      amount: '99.99'
    });

    // Trigger card validation by blurring from card field
    await page.getByPlaceholder('1234 5678 9012 3456', { exact: true }).blur();

    // Assert card error indicator appears
    await expect(page.getByText('❌ Invalid card number')).toBeVisible({ timeout: 5000 });
  });

  test('Negative Path - Verify form HTML5 validation blocks empty submission', async ({ page }) => {
    const emailInput = page.getByPlaceholder('you@example.com');

    // Click submit without filling any field
    await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

    // HTML5 required attribute should block submission — email is invalid
    const isEmailValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isEmailValid).toBe(false);

    // No success message should appear
    await expect(page.getByText(/processed successfully|✅/i)).not.toBeVisible();
  });
});