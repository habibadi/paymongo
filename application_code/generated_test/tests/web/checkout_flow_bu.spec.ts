import { test, expect } from '@playwright/test';

test('checkout flow verification', async ({ page }) => {
  // 1. Navigation: Navigated to http://localhost:3000/
  await page.goto('/');

  // 2. Input Email: Typed 'john.doe@example.com' into the 'Email Address' input field
  await page.getByLabel('Email Address')
    .or(page.locator('xpath=html/body/div[2]/div/form/div[1]/div/input'))
    .fill('john.doe@example.com');

  // 3. Input Card Number: Typed '4111 1111 1111 1111' into the 'Card Number' input field
  await page.getByLabel('Card Number')
    .or(page.locator('xpath=html/body/div[2]/div/form/div[2]/div/input'))
    .fill('4111 1111 1111 1111');

  // 4. Input Expiry: Typed '12/26' into the 'Expiry' input field
  await page.getByLabel('Expiry')
    .or(page.locator('xpath=html/body/div[2]/div/form/div[3]/div[1]/input'))
    .fill('12/26');

  // 5. Input CVV: Typed '123' into the 'CVV' input field
  await page.getByLabel('CVV')
    .or(page.locator('xpath=html/body/div[2]/div/form/div[3]/div[2]/input'))
    .fill('123');

  // 6. Input Amount: Typed '50.00' into the 'Amount (USD)' input field
  await page.getByLabel('Amount (USD)')
    .or(page.locator('xpath=html/body/div[2]/div/form/div[4]/div/input'))
    .fill('50.00');

  // 7. Submit Payment: Clicked the 'Pay $50.00' button
  await page.getByRole('button', { name: 'Pay $50.00' })
    .or(page.locator('xpath=html/body/div[2]/div/form/button'))
    .click();

  // 8. Verification: Confirmed that the message '✅ Payment processed successfully!' appeared
  await expect(page.getByText('✅ Payment processed successfully!'))
    .toBeVisible();
});