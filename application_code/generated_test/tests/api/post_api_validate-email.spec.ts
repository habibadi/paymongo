import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * Senior SDET API Automation
 * Endpoint: POST /api/validate-email
 */

const ajv = new Ajv({ allErrors: true, strict: false });

// Schema Definitions based on Swagger
const emailResponseSchema = {
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "Email is valid"
    },
    "valid": {
      "type": "boolean",
      "example": true
    }
  },
  "required": ["message", "valid"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "example": "Internal server error"
    }
  },
  "required": ["error"]
};

test.describe('POST /api/validate-email API Tests', () => {

  test('Should return 200 OK with valid: true for a correct email format (Happy Path)', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: {
        email: "qa.test@example.com"
      }
    });

    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    
    // Schema Validation
    const validate = ajv.compile(emailResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    // Business Logic Assertion
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('valid');
  });

  test('Should return 200 OK with valid: false for invalid business logic email (Soft-Fail)', async ({ request }) => {
    // Scenario: Email is syntactically correct but rejected by business logic
    const response = await request.post('/api/validate-email', {
      data: {
        email: "rejected@blacklisted.com"
      }
    });

    // Based on Soft-Fail design: Business logic invalid returns 200 OK
    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    
    // Schema Validation
    const validate = ajv.compile(emailResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    // Business Logic Assertion - Soft Fail
    expect(responseBody.valid).toBe(false);
  });

  test('Should return 400 Bad Request when sending invalid data types', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: {
        email: 12345 // Incorrect type: number instead of string
      }
    });

    // Server returns 400 for input format errors
    expect(response.status()).toBe(400);
  });

  test('Should return 500 Internal Server Error for server-side failures', async ({ request }) => {
    // Triggering 500 (scenario-based)
    const response = await request.post('/api/validate-email', {
      data: {
        email: "trigger-500@error.com"
      }
    });

    expect(response.status()).toBe(500);
    
    const responseBody = await response.json();
    
    // Schema Validation for Error Response
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    expect(responseBody).toHaveProperty('error');
  });

});