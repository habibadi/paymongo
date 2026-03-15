// checkout_flow.spec.ts
import { test, expect } from '@playwright/test';

// Define stable selectors based on the DOM structure and required roles/labels
const SELECTORS = {
    // Buttons
    checkBackendStatusButton: 'button:has-text("🔌 Check Backend Status")',
    completePaymentButton: 'button:has-text("Complete Payment")',

    // Form Fields (Using getByRole('textbox') combined with labels/IDs where appropriate)
    // Playwright's getByRole is generally the most robust way to select inputs associated with a label.
    emailInput: test.locator('input[name="email"]'), // Specific name attribute if available, otherwise rely on label logic below
    cardNumberInput: test.locator('input[name="cardNumber"]'),
    expiryInput: test.locator('input[name="expiry"]'),
    cvvInput: test.locator('input[name="cvv"]'),
    amountInput: test.locator('input[name="amount"]'),
    
    // Helper locators derived from robust selection logic or visible attributes
    emailInputByLabel: () => test.getByLabel('Email Address'),
    cardNumberInputByLabel: () => test.getByLabel('Card Number'),
    expiryInputByLabel: () => test.getByLabel('Expiry'),
    cvvInputByLabel: () => test.getByLabel('CVV'),
    amountInputByLabel: () => test.getByLabel('Amount (USD)'),
    
    // Success/Error messages (Use text() matcher for reliability across different element types)
    successMessage: (text: string) => `text=${text}`, 
    errorMessage: (text: string) => `text=${text}`, 
};

test.describe('Checkout Flow Stability Tests', () => {
    
    test.beforeEach(async ({ page }) => {
        // Setup: Navigate to the page where the form is located
        await page.goto('/checkout'); 
        
        // Ensure the primary button is present and visible before starting interaction
        await expect(page.getByRole('button', { name: '🔌 Check Backend Status' })).toBeVisible();
    });

    test('Happy Path: Should successfully complete a payment transaction', async ({ page }) => {
        // 1. Fill all fields correctly using the most specific locators (getByLabel variants)
        await expect(SELECTORS.emailInputByLabel()).toBeEditable();
        await SELECTORS.emailInputByLabel().fill('test.user@example.com');

        await SELECTORS.cardNumberInputByLabel().fill('4111111111111112'); // Valid format mock

        // Fill MM/YY and CVV
        await SELECTORS.expiryInputByLabel().fill('12/25'); 
        await SELECTORS.cvvInputByLabel().fill('456'); 
        
        await SELECTORS.amountInputByLabel().fill('99.99');

        // 2. Submit the form
        await page.getByRole('button', { name: 'Complete Payment' }).click();

        // 3. Assertion for success (Assuming 'Payment Successful' is the expected confirmation text)
        // Note: This relies on 'Payment Successful' being present in the DOM after submission.
        await expect(page.locator(SELECTORS.successMessage('Payment Successful'))).toBeVisible();
    });

    test('Negative Path: Should display error for invalid card number format', async ({ page }) => {
        // 1. Fill necessary fields, providing an intentionally invalid/short card number
        await SELECTORS.emailInputByLabel().fill('bad.card@example.com');
        
        // Invalid/Short Card Number
        await SELECTORS.cardNumberInputByLabel().fill('1234567890'); 

        await SELECTORS.expiryInputByLabel().fill('01/24');
        await SELECTORS.cvvInputByLabel().fill('999');
        await SELECTORS.amountInputByLabel().fill('10.00');

        // 2. Submit the form
        await page.getByRole('button', { name: 'Complete Payment' }).click();

        // 3. Assertion for error message (Example: Card number format error)
        // Asserting against the expected specific error message text.
        await expect(page.locator(SELECTORS.errorMessage('Invalid Card Format'))).toBeVisible();
        
        // Verify the card input still contains the bad value
        await expect(SELECTORS.cardNumberInputByLabel()).toHaveValue('1234567890');
    });

    test('Negative Path: Should show HTML5 validation for required fields', async ({ page }) => {
        // 1. Do not fill any fields

        // 2. Attempt to submit the form
        await page.getByRole('button', { name: 'Complete Payment' }).click();
        
        // 3. Assertion: Check for required validation on the first required field (Email)
        
        const emailField = SELECTORS.emailInputByLabel();
        
        // When clicking submit without filling required fields, the browser focuses the first invalid element.
        // We check if the element is required and if it reflects an invalid state (though state checking can be flaky).
        await expect(emailField).toBeRequired();
        
        // A more reliable check for native validation failure after submission is often checking the 'required' attribute
        // and verifying that the form submission attempt did not result in success (e.g., checking input values remain empty).
        await expect(emailField).toHaveAttribute('required');
        
        await expect(emailField).toHaveValue('');
        await expect(SELECTORS.cardNumberInputByLabel()).toHaveValue('');
        
        // Ensure the payment button is still enabled (i.e., the form did not successfully submit)
        await expect(page.getByRole('button', { name: 'Complete Payment' })).toBeEnabled();
    });

    test('Interaction Check: Backend Status button functionality', async ({ page }) => {
        // Rule: Test if the specific status button is present and interactable
        const statusButton = page.getByRole('button', { name: '🔌 Check Backend Status' });
        await expect(statusButton).toBeVisible();
        
        await statusButton.click();
        
        // If the button performs an action that changes the DOM or UI state, assert that change here.
        // Since no DOM change is defined, we only confirm clickability.
    });
});