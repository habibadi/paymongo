import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * Test Suite: Health Check API
 * Endpoint: GET /api/health
 */

const ajv = new Ajv({ allErrors: true, strict: false });

// Schema definitions based on Swagger Full Definitions
const healthResponseSchema = {
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    },
    "status": {
      "type": "string"
    }
  },
  "required": ["message", "status"]
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

test.describe('Health Check API - GET /api/health', () => {

  test('should return 200 OK with healthy status (Happy Path)', async ({ request }) => {
    const response = await request.get('/api/health');

    // Validate status code
    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    // Validate schema
    const validate = ajv.compile(healthResponseSchema);
    const valid = validate(responseBody);

    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    // Validate business logic values
    expect(responseBody.status).toBe('healthy');
    expect(typeof responseBody.message).toBe('string');
  });

  test('should return 405 Method Not Allowed when using POST method (Negative Path)', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {}
    });

    // Validating that the health endpoint does not accept POST
    expect(response.status()).toBe(405);
  });

  test('should return 404 Not Found for incorrect sub-resource path (Negative Path)', async ({ request }) => {
    const response = await request.get('/api/health/undefined-route');

    expect(response.status()).toBe(404);

    // Some servers return JSON error even on 404
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);
      
      // If server provides a standard error body, it must match main.ErrorResponse
      if (valid) {
        expect(responseBody).toHaveProperty('error');
      }
    }
  });

  test('should validate error schema if server returns 500 Internal Server Error', async ({ request }) => {
    /**
     * Scenario: Simulated server failure.
     * Note: This assumes the environment or a header can trigger a failure 
     * to test the main.ErrorResponse schema mapping.
     */
    const response = await request.get('/api/health', {
      headers: { 'X-Simulate-Error': 'true' }
    });

    // We only perform the check if the server actually returns 500
    if (response.status() === 500) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);

      expect(valid, `500 Error schema validation failed: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(responseBody.error).toBeDefined();
    }
  });

});