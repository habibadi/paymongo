import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

// JSON Schema definitions based on Swagger refs
const cardResponseSchema = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    cardType: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['isValid'],
  additionalProperties: false
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['code', 'message'],
  additionalProperties: false
};

test.describe('POST /api/validate-card', () => {
  const endpoint = '/api/validate-card';

  test('should return 200 OK for a valid card number (Happy Path)', async ({ request }) => {
    const payload = {
      cardNumber: '4111222233334444',
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: '123'
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    const validate = ajv.compile(cardResponseSchema);
    const valid = validate(responseBody);

    if (!valid) {
      console.error('AJV Validation Errors:', validate.errors);
    }
    expect(valid).toBe(true);
    expect(responseBody.isValid).toBe(true);
  });

  test('should return 400 Bad Request for invalid card format (Negative Path)', async ({ request }) => {
    const payload = {
      cardNumber: 'invalid_card_string',
      expiryMonth: 1,
      expiryYear: 2020,
      cvv: '99'
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);

    if (!valid) {
      console.error('AJV Validation Errors:', validate.errors);
    }
    expect(valid).toBe(true);
    expect(responseBody.message).toBeDefined();
  });

  test('should return 400 Bad Request when required fields are missing (Negative Path)', async ({ request }) => {
    const payload = {
      cardNumber: '4111222233334444'
      // Missing other required fields
    };

    const response = await request.post(endpoint, {
      data: payload
    });

    // Check if response is JSON before parsing to handle potential HTML error pages
    const contentType = response.headers()['content-type'];
    expect(response.status()).toBe(400);
    
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await response.json();
      const validate = ajv.compile(errorResponseSchema);
      const valid = validate(responseBody);
      expect(valid).toBe(true);
    } else {
      throw new Error(`Expected JSON response but received ${contentType}`);
    }
  });
});