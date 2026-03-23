import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * Technical Requirements:
 * 1. Framework: @playwright/test
 * 2. Schema Validation: AJV (allErrors: true, strict: false)
 * 3. Design: Soft-Fail handling and precise error assertions
 */

const ajv = new Ajv({ allErrors: true, strict: false });

// Schema Definitions from Swagger
const schemas = {
  healthResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      status: { type: "string" }
    },
    required: ["message", "status"]
  },
  paymentResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      status: { type: "string" }
    },
    required: ["message", "status"]
  },
  cardResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      valid: { type: "boolean" }
    },
    required: ["message", "valid"]
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

test.describe('API Automation: Payment & Health Services', () => {

  // --- HAPPY PATHS ---

  test('GET /api/health - Should return 200 OK and valid health status', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    const validate = ajv.compile(schemas.healthResponse);
    const valid = validate(body);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
    
    expect(body.status).toBe('healthy');
  });

  test('POST /api/checkout - Success path with valid data', async ({ request }) => {
    const payload = {
      amount: 50.00,
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    const validate = ajv.compile(schemas.paymentResponse);
    expect(validate(body)).toBe(true);
    
    expect(body.status).toBe('success');
    expect(body.message).toContain('Payment processed successfully!');
  });

  // --- NEGATIVE PATHS (SOFT-FAIL & LOGIC) ---

  test('POST /api/checkout - Soft-Fail: Reject amount >= 999.99', async ({ request }) => {
    const payload = {
      amount: 999.99,
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    
    // Expect 200 OK because of Soft-Fail design
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.status).toBe('failure');
    expect(body.message).toBe('Payment rejected due to business logic (Soft-Fail)');
  });

  test('POST /api/checkout - Bad Request: Amount <= 0', async ({ request }) => {
    const payload = {
      amount: 0,
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', { data: payload });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    
    const validate = ajv.compile(schemas.errorResponse);
    expect(validate(body)).toBe(true);
    expect(body.error).toBe('Missing or invalid required payment fields');
  });

  test('POST /api/validate-card - Soft-Fail: Luhn algorithm failure', async ({ request }) => {
    const payload = { cardNumber: "0000000000000000" };

    const response = await request.post('/api/validate-card', { data: payload });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.valid).toBe(false);
    expect(body.message).toBe('Invalid card number (Luhn check failed)');
  });

  test('POST /api/validate-email - Soft-Fail: Invalid format', async ({ request }) => {
    const payload = { email: "bad-email" };

    const response = await request.post('/api/validate-email', { data: payload });
    
    // Design requirement: 200 OK for invalid format
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.valid).toBe(false);
    expect(body.message).toBe('Email format is invalid');
  });

  test('POST /api/validate-email - Server Error: Trigger internal 500', async ({ request }) => {
    const payload = { email: "trigger-500@internal.com" };

    const response = await request.post('/api/validate-email', { data: payload });
    
    expect(response.status()).toBe(500);
    const body = await response.json();
    
    const validate = ajv.compile(schemas.errorResponse);
    expect(validate(body)).toBe(true);
    expect(body.error).toBe('Internal server error');
  });

});