import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Schema Definitions from Swagger
 */
const cardResponseSchema = {
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "valid": { "type": "boolean" }
  },
  "required": ["message", "valid"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": { "type": "string" }
  },
  "required": ["error"]
};

test.describe('POST /api/validate-card', () => {

  test('Happy Path - Should return valid true for a standard card number', async ({ request }) => {
    const payload = {
      cardNumber: "4242424242424242"
    };

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Assertion: Status Code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Assertion: Schema Validation
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Assertion: Business Logic
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('validated');
  });

  test('Negative Path - Soft-Fail - Should return valid false for invalid Luhn number', async ({ request }) => {
    const payload = {
      cardNumber: "0000000000000000"
    };

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Assertion: Status Code (Soft-Fail expects 200 OK)
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Assertion: Schema Validation
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);
    expect(valid).toBe(true);

    // Assertion: Precision Business Message
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe("Invalid card number (Luhn check failed)");
  });

  test('Negative Path - Bad Request - Should return 400 when cardNumber is missing', async ({ request }) => {
    const payload = {}; // Missing required cardNumber field

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Assertion: Status Code
    expect(response.status()).toBe(400);

    const responseBody = await response.json();

    // Assertion: Schema Validation
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    expect(valid).toBe(true);

    // Assertion: Error Message
    expect(responseBody.error).toBeTruthy();
  });

});