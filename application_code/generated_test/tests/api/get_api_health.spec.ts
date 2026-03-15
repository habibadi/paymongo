import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, verbose: true });

/**
 * Schema definition based on main.HealthResponse
 */
const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    version: { type: 'string' },
    uptime: { type: 'number' }
  },
  required: ['status'],
  additionalProperties: true
};

test.describe('GET /api/health', () => {
  
  test('should return 200 OK and valid schema - Happy Path', async ({ request }) => {
    const response = await request.get('/api/health');
    
    // Validate Status Code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    
    // Validate Schema using Ajv
    const validate = ajv.compile(healthResponseSchema);
    const isValid = validate(responseBody);
    
    if (!isValid) {
      console.error('Ajv Validation Errors:', validate.errors);
    }
    
    expect(isValid, 'Response schema should match the definition').toBe(true);
    expect(responseBody.status).toBeDefined();
  });

  test('should return 405 Method Not Allowed when using POST - Negative Path', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {}
    });

    // Validating that the health endpoint does not accept POST method
    expect(response.status()).toBe(405);
  });

  test('should return 404 Not Found for incorrect sub-resource - Negative Path', async ({ request }) => {
    const response = await request.get('/api/health/undefined-route');

    // Validating behavior for invalid extended path
    expect(response.status()).toBe(404);
    
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const errorBody = await response.json();
      expect(errorBody).toBeDefined();
    }
  });

});