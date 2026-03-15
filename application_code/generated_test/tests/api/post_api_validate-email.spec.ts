import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

/**
 * JSON Schema Definitions based on Swagger Refs
 * main.EmailResponse
 */
const emailResponseSchema = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    message: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['isValid'],
  additionalProperties: true
};

/**
 * main.ErrorResponse
 */
const errorResponseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    code: { type: 'integer' },
    details: { type: 'string' }
  },
  required: ['message'],
  additionalProperties: true
};

test.describe('POST /api/validate-email', () => {
  
  test('should return 200 OK and valid schema for a correctly formatted email', async ({ request }) => {
    const payload = {
      email: 'john.doe@example.com'
    };

    const response = await request.post('/api/validate-email', {
      data: payload
    });

    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    const validate = ajv.compile(emailResponseSchema);
    const valid = validate(responseBody);
    
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(responseBody.isValid).toBeDefined();
  });

  test('should return 400 Bad Request when email field is missing or invalid', async ({ request }) => {
    const payload = {
      email: 'invalid-email-format'
    };

    const response = await request.post('/api/validate-email', {
      data: payload
    });

    // Validating status 400 as a standard negative path for input validation
    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);
      expect(valid, `Error schema validation failed: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  test('should return 500 Internal Server Error when server encounters an issue', async ({ request }) => {
    // Simulating a payload that might trigger a server-side exception
    const payload = {
      email: 'trigger-500-error@system.local'
    };

    const response = await request.post('/api/validate-email', {
      data: payload
    });

    expect(response.status()).toBe(500);

    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);
      
      expect(valid, `500 Error schema validation failed: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(responseBody.message).toBeDefined();
    } else {
      // Fallback check if response is not JSON
      const textResponse = await response.text();
      expect(textResponse).not.toBeNull();
    }
  });

});