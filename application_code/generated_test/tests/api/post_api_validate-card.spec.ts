import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv();

// JSON Schema definitions based on Swagger Full Definitions
const cardResponseSchema = {
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    },
    "valid": {
      "type": "boolean"
    }
  },
  "required": ["message", "valid"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": {
      "type": "string"
    }
  },
  "required": ["error"]
};

test.describe('POST /api/validate-card', () => {
  
  test('should return 200 OK and valid true for correct card format (Happy Path)', async ({ request }) => {
    const payload = {
      cardNumber: "4242424242424242"
    };

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Validate Status Code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate Schema using Ajv
    const validate = ajv.compile(cardResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Business Logic Assertion
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('valid');
  });

  test('should return 200 OK and valid false for business logic failure (Soft-Fail)', async ({ request }) => {
    // Scenario: Card number is formatted as string but is logically invalid
    const payload = {
      cardNumber: "0000000000000000"
    };

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Per documentation: Business logic invalid returns 200 OK
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate Schema
    const validate = ajv.compile(cardResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid).toBe(true);

    // Business Logic Assertion: valid should be false
    expect(responseBody.valid).toBe(false);
  });

  test('should return 400 Bad Request for invalid data type in request body', async ({ request }) => {
    // Scenario: Sending a number instead of a string for cardNumber
    const payload = {
      cardNumber: 1234567890123456
    };

    const response = await request.post('/api/validate-card', {
      data: payload
    });

    // Per documentation: Wrong format/type returns 400
    expect(response.status()).toBe(400);

    const responseBody = await response.json();

    // Validate Schema using ErrorResponse
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Verify error message exists
    expect(responseBody.error).toBeDefined();
    expect(typeof responseBody.error).toBe('string');
  });

});