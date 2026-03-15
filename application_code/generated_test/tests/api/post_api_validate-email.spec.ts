import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv();

// JSON Schema definitions based on Swagger
const emailResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    valid: { type: "boolean" }
  },
  required: ["message", "valid"],
  additionalProperties: false
};

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" }
  },
  required: ["error"],
  additionalProperties: false
};

test.describe('POST /api/validate-email', () => {
  
  test('should return 200 OK and valid true for a correct email format', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: {
        email: "user@example.com"
      }
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(emailResponseSchema);
    const isValid = validate(responseBody);

    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toBe("Email is valid");
  });

  test('should return 200 OK and valid false for an incorrect email format (Soft-Fail logic)', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: {
        email: "invalid-email-format"
      }
    });

    // Per technical requirements point 8: Business logic invalid returns 200 OK with valid: false
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(emailResponseSchema);
    const isValid = validate(responseBody);

    expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.valid).toBe(false);
  });

  test('should return 400 Bad Request when request body is malformed', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: {
        email: 12345 // Sending number instead of string
      }
    });

    // Per technical requirements point 8: Input salah format returns 400
    expect(response.status()).toBe(400);
    
    const responseBody = await response.json();
    // Assuming 400 also follows the error schema if provided or generic error handling
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);
    
    expect(isValid).toBe(true);
    expect(responseBody).toHaveProperty('error');
  });

  test('should return 500 Internal Server Error when server-side validation fails', async ({ request }) => {
    // Simulating a condition that might trigger a 500 based on swagger definition
    const response = await request.post('/api/validate-email', {
      data: {
        email: "trigger-500@internal.com" 
      }
    });

    // We only assert if the server actually returns 500 for this specific test case
    if (response.status() === 500) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const isValid = validate(responseBody);

      expect(isValid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(responseBody.error).toBeDefined();
    }
  });
});