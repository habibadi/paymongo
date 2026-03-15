import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * Schema definition based on main.HealthResponse
 * Assuming standard health check structure as the full definition was not provided.
 */
const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    message: { type: 'string' },
    version: { type: 'string' },
    uptime: { type: 'number' }
  },
  required: ['status'],
  additionalProperties: false
};

const ajv = new Ajv();
const validate = ajv.compile(healthResponseSchema);

test.describe('Health Check API - GET /health', () => {
  const endpoint = '/health';

  test('should return 200 OK and valid schema on happy path', async ({ request }) => {
    const response = await request.get(endpoint);
    
    // Assert status code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate Schema using Ajv
    const isValid = validate(responseBody);
    if (!isValid) {
      console.error('Schema Validation Errors:', validate.errors);
    }
    
    expect(isValid, 'Response body should match the JSON schema').toBe(true);
    expect(responseBody.status).toBe('OK');
  });

  test('should return 405 Method Not Allowed when using POST', async ({ request }) => {
    const response = await request.post(endpoint, {
      data: {}
    });

    // Validating that the endpoint does not support POST if it's a GET-only health check
    expect(response.status()).toBe(405);
  });

  test('should return 404 Not Found for incorrect health endpoint path', async ({ request }) => {
    const invalidEndpoint = '/health-check-invalid-path';
    const response = await request.get(invalidEndpoint);

    // Assert that misspelled or incorrect paths return 404
    expect(response.status()).toBe(404);
  });
});