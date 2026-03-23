import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

/**
 * Test Suite: Checkout API
 * Endpoint: POST /api/checkout
 */

const ajv = new Ajv({ allErrors: true, strict: false });

// JSON Schemas based on Swagger Definitions
const paymentResponseSchema = {
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "status": { "type": "string" }
  },
  "required": ["message", "status"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": { "type": "string" }
  },
  "required": ["error"]
};

test.describe('POST /api/checkout', () => {

  test('should successfully process payment (Happy Path)', async ({ request }) => {
    const payload = {
      amount: 50,
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    const responseBody = await response.json();

    // Validate Status Code
    expect(response.status()).toBe(200);

    // Validate Schema
    const validate = ajv.compile(paymentResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Validate Business Logic
    expect(responseBody.status).toBe('success');
    expect(responseBody.message).toContain('successfully');
  });

  test('should return 400 Bad Request when amount is wrong data type (Negative Path - Format)', async ({ request }) => {
    const payload = {
      amount: "invalid_number", // Should be number
      cardNumber: "4242424242424242",
      cvv: "123",
      expiry: "12/26"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    const responseBody = await response.json();

    // Validate Status Code
    expect(response.status()).toBe(400);

    // Validate Schema
    const validate = ajv.compile(errorResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Validate Error Message
    expect(responseBody.error).toBeDefined();
  });

  test('should return 200 OK with failure status for rejected card (Negative Path - Soft Fail)', async ({ request }) => {
    const payload = {
      amount: 100,
      cardNumber: "0000000000000000", // Scenario: Declined Card
      cvv: "000",
      expiry: "01/25"
    };

    const response = await request.post('/api/checkout', {
      data: payload
    });

    const responseBody = await response.json();

    /** 
     * Requirement 8: Soft-Fail Design
     * Logic failure returns 200 OK but with status "failure"
     */
    expect(response.status()).toBe(200);

    // Validate Schema (still follows PaymentResponse)
    const validate = ajv.compile(paymentResponseSchema);
    const valid = validate(responseBody);
    expect(valid, `Schema validation errors: ${JSON.stringify(validate.errors)}`).toBe(true);

    // Validate Soft-Fail Property Values
    expect(responseBody.status).toBe('failure');
    expect(responseBody.message).toBe('rejected');
  });

});