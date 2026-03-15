import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv();

// JSON Schemas based on Swagger definitions
const emailResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    message: { type: 'string' },
    isValid: { type: 'boolean' }
  },
  required: ['status', 'isValid']
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'integer' },
    message: { type: 'string' }
  },
  required: ['error', 'code']
};

test.describe('Email Validation API Tests', () => {
  const endpoint = '/api/validate-email'; // Placeholder path based on snippet context

  test('should validate a correct email format successfully (Happy Path)', async ({ request }) => {
    const payload = {
      email: 'test.user@example.com'
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    const responseBody = await response.json();

    // Assert status code
    expect(response.status()).toBe(200);

    // Schema validation
    const validate = ajv.compile(emailResponseSchema);
    const valid = validate(responseBody);
    
    if (!valid) {
      console.error('AJV Validation Errors:', validate.errors);
    }
    expect(valid).toBe(true);
    expect(responseBody.isValid).toBe(true);
  });

  test('should return 400 for invalid email format (Negative Path)', async ({ request }) => {
    const payload = {
      email: 'invalid-email-format'
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    // In many API designs, validation errors return 400 or 422
    expect(response.status()).toBe(400);
    
    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    expect(validate(responseBody)).toBe(true);
  });

  test('should return error when email field is missing (Negative Path)', async ({ request }) => {
    const payload = {}; // Missing required 'email' field

    const response = await request.post(endpoint, {
      data: payload
    });

    // Validating against the documented 500 or expected 400 for bad request
    const status = response.status();
    expect([400, 500]).toContain(status);

    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    expect(validate(responseBody)).toBe(true);
  });

  test('should handle internal server error according to schema (Negative Path)', async ({ request }) => {
    // Simulating a condition that triggers 500 if applicable, 
    // or simply asserting structure if the environment hits an error
    const payload = {
      email: 'trigger-500@internal.com' 
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    if (response.status() === 500) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);
      
      if (!valid) {
        console.error('AJV Validation Errors (500):', validate.errors);
      }
      expect(valid).toBe(true);
    }
  });
});