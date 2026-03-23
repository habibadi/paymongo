import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

const schemas = {
  paymentResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      status: { type: "string" }
    },
    required: ["message", "status"]
  },
  errorResponse: {
    type: "object",
    properties: {
      error: { type: "string" }
    },
    required: ["error"]
  }
};

test.describe('POST /api/checkout API Automation', () => {

  test('Happy Path: Should process payment successfully', async ({ request }) => {
    const payload = {
      amount: 50.00,
      cardNumber: "4242 4242 4242 4242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    const responseBody = await response.json();

    // Assertion Status Code
    expect(response.status()).toBe(200);

    // Assertion Business Logic
    expect(responseBody.status).toBe('success');
    expect(responseBody.message).toContain('Payment processed successfully');

    // Schema Validation
    const validate = ajv.compile(schemas.paymentResponse);
    const valid = validate(responseBody);
    if (!valid) {
      throw new Error(`JSON Schema validation failed: ${JSON.stringify(validate.errors)}`);
    }
    expect(valid).toBe(true);
  });

  test('Negative Path: Soft-Fail - Payment rejected due to business logic', async ({ request }) => {
    const payload = {
      amount: 0.00, // Trigger Soft-Fail as per requirement
      cardNumber: "4242 4242 4242 4242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    const responseBody = await response.json();

    // Assertion Status Code (Soft-Fail expects 200)
    expect(response.status()).toBe(200);

    // Assertion Precise Message
    expect(responseBody.status).toBe('failure');
    expect(responseBody.message).toBe('Payment rejected due to business logic (Soft-Fail)');

    // Schema Validation
    const validate = ajv.compile(schemas.paymentResponse);
    const valid = validate(responseBody);
    expect(valid).toBe(true);
  });

  test('Negative Path: Bad Request - Invalid amount field', async ({ request }) => {
    const payload = {
      amount: -1, // Trigger 400 Bad Request
      cardNumber: "4242 4242 4242 4242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    const responseBody = await response.json();

    // Assertion Status Code
    expect(response.status()).toBe(400);

    // Assertion Precise Error Message
    expect(responseBody.error).toBe('Missing or invalid required payment fields');

    // Schema Validation
    const validate = ajv.compile(schemas.errorResponse);
    const valid = validate(responseBody);
    expect(valid).toBe(true);
  });

});