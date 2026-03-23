import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * API Automation Test: POST /api/validate-email
 * Framework: Playwright Test
 * Validation: Ajv JSON Schema
 */

const ajv = new Ajv({ allErrors: true, strict: false });

// Schema definitions based on Swagger $ref
const emailResponseSchema = {
  "type": "object",
  "properties": {
    "message": { "type": "string", "example": "Email is valid (or 'Email format is invalid')" },
    "valid": { "type": "boolean", "example": true }
  },
  "required": ["message", "valid"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": { "type": "string", "example": "Internal server error" }
  },
  "required": ["error"]
};

test.describe('API Test: POST /api/validate-email', () => {

  test('Happy Path: Should validate a correct email format successfully', async ({ request }) => {
    const emailPayload = {
      email: "test.user@example.com"
    };

    const response = await request.post('/api/validate-email', {
      data: emailPayload
    });

    // Assert Status Code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Schema Validation
    const validate = ajv.compile(emailResponseSchema);
    const isValid = validate(responseBody);
    if (!isValid) {
      throw new Error(`JSON Schema Validation Error: ${JSON.stringify(validate.errors)}`);
    }

    // Business Logic Assertion
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('Email is valid');
  });

  test('Negative Path: Should return 200 OK with valid false for incorrect email format (Soft-Fail)', async ({ request }) => {
    const emailPayload = {
      email: "bad-email"
    };

    const response = await request.post('/api/validate-email', {
      data: emailPayload
    });

    // Assert Status Code per requirement (200 OK for Soft-Fail)
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Schema Validation
    const validate = ajv.compile(emailResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid).toBe(true);

    // Precise Business Logic Assertion
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe("Email format is invalid");
  });

  test('Negative Path: Should return 500 Internal Server Error for specific trigger email', async ({ request }) => {
    const emailPayload = {
      email: "trigger-500@internal.com"
    };

    const response = await request.post('/api/validate-email', {
      data: emailPayload
    });

    // Assert Status Code
    expect(response.status()).toBe(500);

    const responseBody = await response.json();

    // Schema Validation against ErrorResponse
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);
    expect(isValid).toBe(true);

    // Error Message Assertion
    expect(responseBody.error).toBeDefined();
  });

});