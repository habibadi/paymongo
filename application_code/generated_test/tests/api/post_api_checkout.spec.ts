import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

const definitions = {
  "main.ErrorResponse": {
    "type": "object",
    "properties": {
      "error": { "type": "string", "example": "Internal server error" }
    }
  },
  "main.PaymentResponse": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "example": "Payment processed successfully! (or 'Payment rejected due to business logic (Soft-Fail)')" },
      "status": { "type": "string", "example": "success" }
    }
  }
};

test.describe('POST /api/checkout', () => {
  const endpoint = '/api/checkout';

  test('Happy Path - Successfully process payment', async ({ request }) => {
    const payload = {
      amount: 50,
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('success');
    expect(responseBody.message).toContain('Payment processed successfully');

    // Schema Validation
    const validate = ajv.compile(definitions["main.PaymentResponse"]);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
  });

  test('Negative Path - Soft-Fail Business Logic (Rejection)', async ({ request }) => {
    const payload = {
      amount: 1000, // Rejection trigger: amount >= 999.99
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions per requirement: Status 200 OK with specific message
    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('failure');
    expect(responseBody.message).toBe('Payment rejected due to business logic (Soft-Fail)');

    // Schema Validation
    const validate = ajv.compile(definitions["main.PaymentResponse"]);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
  });

  test('Negative Path - 400 Bad Request (Invalid Amount)', async ({ request }) => {
    const payload = {
      amount: -1, // Error trigger: amount <= 0
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(400);
    expect(responseBody.error).toBe('Missing or invalid required payment fields');

    // Schema Validation
    const validate = ajv.compile(definitions["main.ErrorResponse"]);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
  });

  test('Negative Path - Soft-Fail Business Logic (Invalid Card Number)', async ({ request }) => {
    const payload = {
      amount: 100,
      cardNumber: "0000000000000000", // Rejection trigger
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('failure');
    expect(responseBody.message).toBe('Payment rejected due to business logic (Soft-Fail)');

    // Schema Validation
    const validate = ajv.compile(definitions["main.PaymentResponse"]);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
  });
});