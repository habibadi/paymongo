import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, verbose: true });

// JSON Schemas derived from Swagger definitions
const paymentResponseSchema = {
  type: 'object',
  properties: {
    transactionId: { type: 'string' },
    status: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['transactionId', 'status'],
  additionalProperties: false
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    errorCode: { type: 'string' },
    errorMessage: { type: 'string' },
    details: { type: 'array', items: { type: 'string' } }
  },
  required: ['errorCode', 'errorMessage'],
  additionalProperties: false
};

test.describe('Payment API Validation', () => {
  const endpoint = '/api/v1/payments';

  test('should successfully process payment - Happy Path', async ({ request }) => {
    const validPayload = {
      amount: 150.00,
      currency: 'USD',
      paymentMethod: 'credit_card',
      orderId: 'ORD-12345'
    };

    const response = await request.post(endpoint, {
      data: validPayload
    });

    // Assert Status Code
    expect(response.status()).toBe(200);

    // Validate Schema
    const responseBody = await response.json();
    const validate = ajv.compile(paymentResponseSchema);
    const isValid = validate(responseBody);

    if (!isValid) {
      console.error('AJV Schema Validation Errors:', validate.errors);
    }
    
    expect(isValid, 'Response body should match PaymentResponse schema').toBe(true);
    expect(responseBody.status).toBe('SUCCESS');
  });

  test('should return 400 Bad Request when amount is missing - Negative Path', async ({ request }) => {
    const invalidPayload = {
      currency: 'USD',
      paymentMethod: 'credit_card'
      // amount is missing
    };

    const response = await request.post(endpoint, {
      data: invalidPayload
    });

    // Assert Status Code
    expect(response.status()).toBe(400);

    // Validate Schema
    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);

    if (!isValid) {
      console.error('AJV Schema Validation Errors:', validate.errors);
    }

    expect(isValid, 'Response body should match ErrorResponse schema').toBe(true);
    expect(responseBody.errorCode).toBe('INVALID_PAYLOAD');
  });

  test('should return 400 Bad Request when currency format is invalid - Negative Path', async ({ request }) => {
    const invalidPayload = {
      amount: 100,
      currency: 'INVALID_CURRENCY_CODE',
      paymentMethod: 'debit_card',
      orderId: 'ORD-999'
    };

    const response = await request.post(endpoint, {
      data: invalidPayload
    });

    // Assert Status Code
    expect(response.status()).toBe(400);

    // Validate Schema
    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);

    expect(isValid, 'Response body should match ErrorResponse schema').toBe(true);
    expect(responseBody.errorMessage).toContain('currency');
  });
});