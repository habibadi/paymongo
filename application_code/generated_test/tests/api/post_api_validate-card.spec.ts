import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * JSON Schema definitions based on Swagger Full Definitions
 */
const cardResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    valid: { type: "boolean" }
  },
  required: ["message", "valid"]
};

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" }
  },
  required: ["error"]
};

test.describe('POST /api/validate-card', () => {
  
  test('should return 200 OK and valid true for a correct card number format', async ({ request }) => {
    const response = await request.post('/api/validate-card', {
      data: {
        cardNumber: "4242424242424242"
      }
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);

    if (!valid) {
      console.error('AJV Schema Errors:', validate.errors);
    }

    expect(valid).toBe(true);
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('valid');
  });

  test('should return 200 OK with valid false when business logic determines card is invalid', async ({ request }) => {
    // Scenario: Business logic validation failure (Soft-Fail approach)
    const response = await request.post('/api/validate-card', {
      data: {
        cardNumber: "0000000000000000"
      }
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);

    expect(valid).toBe(true);
    
    // Per technical requirements: business logic invalidity is handled within a 200 response
    expect(responseBody.valid).toBe(false);
  });

  test('should return 400 Bad Request when request body has incorrect data type', async ({ request }) => {
    const response = await request.post('/api/validate-card', {
      data: {
        cardNumber: 123456789 // Should be string according to main.CardRequest
      }
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);

    if (!valid) {
      console.error('AJV Schema Errors:', validate.errors);
    }

    expect(valid).toBe(true);
    expect(responseBody.error).toBeDefined();
  });

  test('should return 400 Bad Request when mandatory fields are missing', async ({ request }) => {
    const response = await request.post('/api/validate-card', {
      data: {} // cardNumber is missing
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      expect(validate(responseBody)).toBe(true);
    } else {
      // Fallback if server returns non-json error for malformed requests
      expect(response.ok()).toBe(false);
    }
  });

});