import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Schema Definitions from Swagger
 */
const schemas = {
  'main.CardResponse': {
    type: 'object',
    properties: {
      message: { type: 'string' },
      valid: { type: 'boolean' }
    },
    required: ['message', 'valid']
  },
  'main.EmailResponse': {
    type: 'object',
    properties: {
      message: { type: 'string' },
      valid: { type: 'boolean' }
    },
    required: ['message', 'valid']
  },
  'main.ErrorResponse': {
    type: 'object',
    properties: {
      error: { type: 'string' }
    },
    required: ['error']
  },
  'main.HealthResponse': {
    type: 'object',
    properties: {
      message: { type: 'string' },
      status: { type: 'string' }
    },
    required: ['message', 'status']
  },
  'main.PaymentResponse': {
    type: 'object',
    properties: {
      message: { type: 'string' },
      status: { type: 'string' }
    },
    required: ['message', 'status']
  }
};

test.describe('API Automation Scenarios', () => {

  /**
   * GET /api/health
   */
  test('GET /api/health - Happy Path', async ({ request }) => {
    const response = await request.get('/api/health');
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('healthy');

    const validate = ajv.compile(schemas['main.HealthResponse']);
    const valid = validate(responseBody);
    expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}`).toBe(true);
  });

  /**
   * POST /api/validate-card
   */
  test('POST /api/validate-card - Happy Path', async ({ request }) => {
    const response = await request.post('/api/validate-card', {
      data: { cardNumber: '4242424242424242' }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.valid).toBe(true);

    const validate = ajv.compile(schemas['main.CardResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  test('POST /api/validate-card - Negative Luhn Failure (Soft-Fail)', async ({ request }) => {
    const response = await request.post('/api/validate-card', {
      data: { cardNumber: '0000000000000000' }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe('Invalid card number (Luhn check failed)');

    const validate = ajv.compile(schemas['main.CardResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  /**
   * POST /api/validate-email
   */
  test('POST /api/validate-email - Happy Path', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: { email: 'user@example.com' }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.valid).toBe(true);

    const validate = ajv.compile(schemas['main.EmailResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  test('POST /api/validate-email - Negative Invalid Format (Soft-Fail)', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: { email: 'bad-email' }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.valid).toBe(false);
    expect(responseBody.message).toBe('Email format is invalid');

    const validate = ajv.compile(schemas['main.EmailResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  test('POST /api/validate-email - Server Error (500)', async ({ request }) => {
    const response = await request.post('/api/validate-email', {
      data: { email: 'trigger-500@internal.com' }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(500);
    expect(responseBody.error).toBe('Email validation service temporarily unavailable (Simulated 500)');

    const validate = ajv.compile(schemas['main.ErrorResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  /**
   * POST /api/checkout
   */
  test('POST /api/checkout - Happy Path', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {
        amount: 50,
        cardNumber: '4242424242424242',
        cvv: '123',
        expiry: '12/26'
      }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('success');

    const validate = ajv.compile(schemas['main.PaymentResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  test('POST /api/checkout - Negative Amount Logic (Soft-Fail)', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {
        amount: 999.99,
        cardNumber: '4242424242424242',
        cvv: '123',
        expiry: '12/26'
      }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.status).toBe('failure');
    expect(responseBody.message).toBe('Payment rejected due to business logic (Soft-Fail)');

    const validate = ajv.compile(schemas['main.PaymentResponse']);
    expect(validate(responseBody)).toBe(true);
  });

  test('POST /api/checkout - Negative Invalid Amount (400)', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {
        amount: -10,
        cardNumber: '4242424242424242',
        cvv: '123',
        expiry: '12/26'
      }
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(400);
    expect(responseBody.error).toBe('Missing or invalid required payment fields');

    const validate = ajv.compile(schemas['main.ErrorResponse']);
    expect(validate(responseBody)).toBe(true);
  });
});