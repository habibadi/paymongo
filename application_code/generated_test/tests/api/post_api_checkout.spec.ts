import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

/**
 * Schemas defined based on Swagger Definitions
 * main.PaymentRequest, main.PaymentResponse, main.ErrorResponse
 */
const paymentRequestSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    amount: { type: 'number' },
    paymentMethod: { type: 'string' },
    cardNumber: { type: 'string' },
    expiryDate: { type: 'string' },
    cvv: { type: 'string' }
  },
  required: ['orderId', 'amount', 'paymentMethod']
};

const paymentResponseSchema = {
  type: 'object',
  properties: {
    transactionId: { type: 'string' },
    status: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['transactionId', 'status']
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'integer' },
    message: { type: 'string' },
    errors: { type: 'array', items: { type: 'string' } }
  },
  required: ['message']
};

test.describe('POST /api/checkout', () => {
  const endpoint = '/api/checkout';

  test('should successfully process payment (Happy Path)', async ({ request }) => {
    const validPayload = {
      orderId: 'ORD-12345',
      amount: 150.50,
      paymentMethod: 'credit_card',
      cardNumber: '4111222233334444',
      expiryDate: '12/25',
      cvv: '123'
    };

    const response = await request.post(endpoint, {
      data: validPayload
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(paymentResponseSchema);
    const isValid = validate(responseBody);

    if (!isValid) {
      console.error('Schema Validation Errors:', ajv.errorsText(validate.errors));
    }

    expect(isValid).toBe(true);
    expect(responseBody.status).toBe('success');
  });

  test('should return 400 Bad Request when mandatory fields are missing', async ({ request }) => {
    const invalidPayload = {
      orderId: 'ORD-12345'
      // amount and paymentMethod missing
    };

    const response = await request.post(endpoint, {
      data: invalidPayload
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    const isValid = validate(responseBody);

    if (!isValid) {
      console.error('Schema Validation Errors:', ajv.errorsText(validate.errors));
    }

    expect(isValid).toBe(true);
    expect(responseBody.message).toContain('required');
  });

  test('should return 400 Bad Request for invalid data types', async ({ request }) => {
    const malformedPayload = {
      orderId: 'ORD-12345',
      amount: "one hundred", // Should be number
      paymentMethod: 'credit_card'
    };

    const response = await request.post(endpoint, {
      data: malformedPayload
    });

    // Validating response code 400
    expect(response.status()).toBe(400);

    // Defensive check before parsing JSON
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const isValid = validate(responseBody);
      
      expect(isValid).toBe(true);
    } else {
      const text = await response.text();
      console.warn('Response was not JSON:', text);
      expect(response.status()).toBe(400);
    }
  });
});