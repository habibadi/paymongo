import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

const schemas = {
  emailRequest: {
    type: "object",
    properties: {
      email: { type: "string" }
    },
    required: ["email"]
  },
  emailResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      valid: { type: "boolean" }
    },
    required: ["message", "valid"]
  },
  errorResponse: {
    type: "object",
    properties: {
      error: { type: "string" }
    },
    required: ["error"]
  }
};

test.describe('POST /api/validate-email', () => {
  
  test('Happy Path - Should return 200 OK for valid email format', async ({ request }) => {
    const payload = { email: 'user@example.com' };
    
    const response = await request.post('/api/validate-email', {
      data: payload
    });

    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    const validate = ajv.compile(schemas.emailResponse);
    const valid = validate(responseBody);
    
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.valid).toBe(true);
    expect(responseBody.message).toContain('Email is valid');
  });

  test('Negative Path - Should return 200 OK with valid false for invalid email regex (Soft-Fail)', async ({ request }) => {
    const payload = { email: 'bad-email' };
    
    const response = await request.post('/api/validate-email', {
      data: payload
    });

    // Per Requirement: Soft-fail scenario returns 200 OK
    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    const validate = ajv.compile(schemas.emailResponse);
    const valid = validate(responseBody);
    
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe('Email format is invalid');
  });

  test('Negative Path - Should return 500 Internal Server Error for trigger email', async ({ request }) => {
    const payload = { email: 'trigger-500@internal.com' };
    
    const response = await request.post('/api/validate-email', {
      data: payload
    });

    expect(response.status()).toBe(500);
    
    const responseBody = await response.json();
    const validate = ajv.compile(schemas.errorResponse);
    const valid = validate(responseBody);
    
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.error).toBe('Email validation service temporarily unavailable (Simulated 500)');
  });

});