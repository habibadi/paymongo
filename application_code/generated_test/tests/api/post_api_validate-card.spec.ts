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

test.describe('API Automation: POST /api/validate-card', () => {
  const endpoint = '/api/validate-card';

  test('Happy Path: Should return 200 OK for a valid card number', async ({ request }) => {
    const payload = {
      cardNumber: "4242424242424242"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(200);
    
    // Schema Validation
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Data Assertions
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('validated');
  });

  test('Negative Path: Should return 200 OK with Soft-Fail for invalid Luhn check', async ({ request }) => {
    const payload = {
      cardNumber: "0000000000000000"
    };

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(200);

    // Schema Validation
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Data Assertions for Soft-Fail logic
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe("Invalid card number (Luhn check failed)");
  });

  test('Negative Path: Should return 400 Bad Request for missing required fields', async ({ request }) => {
    const payload = {}; // Missing cardNumber

    const response = await request.post(endpoint, { data: payload });
    const responseBody = await response.json();

    // Assertions
    expect(response.status()).toBe(400);

    // Schema Validation for Error Response
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Data Assertions
    expect(responseBody.error).toBeDefined();
  });
});