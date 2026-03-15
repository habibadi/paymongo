import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

// JSON Schemas derived from Swagger Definitions
const mainHealthResponseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    status: { type: 'string' }
  },
  required: ['message', 'status'],
  additionalProperties: false
};

const mainErrorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  },
  required: ['error'],
  additionalProperties: false
};

test.describe('API Automation: GET /api/health', () => {
  
  test('should return 200 OK and valid health status (Happy Path)', async ({ request }) => {
    const response = await request.get('/api/health');
    
    // Assert status code
    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    
    // Validate Schema
    const validate = ajv.compile(mainHealthResponseSchema);
    const valid = validate(responseBody);
    
    if (!valid) {
      console.error('AJV Schema Errors:', validate.errors);
    }
    
    expect(valid).toBe(true);
    expect(responseBody.status).toBe('healthy');
  });

  test('should return 405 Method Not Allowed when using POST (Negative Path)', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {}
    });

    // Validating that the health endpoint does not accept POST
    expect(response.status()).toBe(405);
    
    // Safety check for JSON parsing in case of HTML error pages
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(mainErrorResponseSchema);
      const valid = validate(responseBody);
      expect(valid).toBe(true);
    }
  });

  test('should return 404 Not Found for incorrect health endpoint path (Negative Path)', async ({ request }) => {
    const response = await request.get('/api/healthcheck-invalid');

    expect(response.status()).toBe(404);
    
    // Most servers return 404 for non-existent paths, check if it follows error schema if JSON
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(mainErrorResponseSchema);
      expect(validate(responseBody)).toBe(true);
    }
  });

});