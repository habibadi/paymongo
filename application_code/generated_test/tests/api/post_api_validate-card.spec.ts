import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

// JSON Schemas derived from Swagger definitions
const cardResponseSchema = {
  type: "object",
  properties: {
    isValid: { type: "boolean" },
    cardType: { type: "string" },
    message: { type: "string" }
  },
  required: ["isValid"]
};

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    code: { type: "integer" },
    message: { type: "string" }
  },
  required: ["error"]
};

test.describe('Card Validation API - POST /validate', () => {
  const endpoint = '/validate';

  test('should return 200 OK for a valid card number format', async ({ request }) => {
    const payload = {
      card: "4111222233334444"
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    const responseBody = await response.json();

    // Assert Status Code
    expect(response.status()).toBe(200);

    // Schema Validation
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);
    
    if (!valid) {
      throw new Error(`Schema validation errors: ${JSON.stringify(validate.errors)}`);
    }

    // Business Logic Assertion
    expect(responseBody.isValid).toBeDefined();
  });

  test('should return 400 Bad Request when card field is missing', async ({ request }) => {
    const payload = {};

    const response = await request.post(endpoint, {
      data: payload
    });

    const responseBody = await response.json();

    // Assert Status Code
    expect(response.status()).toBe(400);

    // Schema Validation
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    
    if (!valid) {
      throw new Error(`Schema validation errors: ${JSON.stringify(validate.errors)}`);
    }

    // Assert Error Message
    expect(responseBody.error).toBeTruthy();
  });

  test('should return 400 Bad Request for invalid data type in card field', async ({ request }) => {
    const payload = {
      card: 123456789 // Should be a string based on common CardRequest definitions
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    const responseBody = await response.json();

    // Assert Status Code
    expect(response.status()).toBe(400);

    // Schema Validation
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    
    if (!valid) {
      throw new Error(`Schema validation errors: ${JSON.stringify(validate.errors)}`);
    }
  });
});