import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

// JSON Schema Definitions based on Swagger
const paymentResponseSchema = {
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "status": { "type": "string" }
  },
  "required": ["message", "status"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": { "type": "string" }
  },
  "required": ["error"]
};

test.describe('Checkout API - /api/checkout', () => {

  test('should process payment successfully (Happy Path)', async ({ request }) => {
    const payload = {
      amount: 50,
      cardNumber: "4242 4242 4242 4242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    // Validate Status Code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate Schema
    const validate = ajv.compile(paymentResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Validate Business Logic
    expect(responseBody.status).toBe('success');
  });

  test('should return 400 Bad Request when input type is invalid (Negative Path)', async ({ request }) => {
    const payload = {
      amount: "fifty", // Should be number
      cardNumber: "4242 4242 4242 4242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    // Validate Status Code
    expect(response.status()).toBe(400);

    const responseBody = await response.json();

    // Validate Schema
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    expect(responseBody.error).toBeDefined();
  });

  test('should handle invalid business logic with 200 OK Soft-Fail (Negative Path)', async ({ request }) => {
    // Scenario: Business logic invalid (e.g. card declined/wrong logic) returns 200 but status not success
    const payload = {
      amount: 1000000, // Trigger logic failure via high amount
      cardNumber: "0000 0000 0000 0000",
      cvv: "000",
      expiry: "01/01"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    // Per requirement: Business logic invalid returns 200 OK
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate Schema remains consistent
    const validate = ajv.compile(paymentResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Assert Soft-Fail indicator
    expect(responseBody.status).not.toBe('success');
  });

});