import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

// --- Schemas from Definitions ---

const cardRequestSchema = {
  "type": "object",
  "properties": {
    "cardNumber": {
      "type": "string",
      "example": "4242424242424242"
    }
  },
  "required": ["cardNumber"]
};

const cardResponseSchema = {
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "Card number is valid"
    },
    "valid": {
      "type": "boolean",
      "example": true
    }
  },
  "required": ["message", "valid"]
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "example": "Internal server error"
    }
  },
  "required": ["error"]
};

// --- Test Suite for POST /api/validate-card ---

test.describe('API Card Validation: POST /api/validate-card', () => {

    const endpointPath = '/api/validate-card';

    // 1. Happy Path: Card validation successful (HTTP 200)
    test('should return 200 OK and response matching schema for a valid card request', async ({ request }) => {
        const validCardNumber = '4242424242424242'; // Using example data
        const requestBody = {
            cardNumber: validCardNumber
        };

        const response = await request.post(endpointPath, {
            data: requestBody
        });

        // 1. Check HTTP Status Code
        expect(response.status()).toBe(200);

        // 2. Check Response Body Schema using Ajv
        const responseJson = await response.json();
        const validate = ajv.compile(cardResponseSchema);
        const isValid = validate(responseJson);

        expect(isValid).toBeTruthy();
        if (!isValid) {
            console.error("Validation Errors:", validate.errors);
        }

        // 3. Business Logic Check (Soft-Fail context implies we expect 'valid: true' on success)
        expect(responseJson.valid).toBe(true);
        expect(responseJson.message).toContain('valid');
    });

    // 2. Negative Path: Missing required field (HTTP 400 - Bad Request due to bad format)
    test('should return 400 Bad Request when cardNumber is missing in the request body', async ({ request }) => {
        const requestBody = {}; // Missing cardNumber

        const response = await request.post(endpointPath, {
            data: requestBody
        });

        // 1. Check HTTP Status Code
        expect(response.status()).toBe(400);

        // 2. Check Response Body Schema using Ajv for Error Response
        const responseJson = await response.json();
        const validate = ajv.compile(errorResponseSchema);
        const isValid = validate(responseJson);

        expect(isValid).toBeTruthy();
        if (!isValid) {
            console.error("Validation Errors:", validate.errors);
        }
        
        // 3. Check Error message content if available
        expect(responseJson.error).toBeDefined();
    });

    // 3. Negative Path: Invalid data type for cardNumber (HTTP 400 - Bad Request due to type mismatch)
    test('should return 400 Bad Request when cardNumber is not a string', async ({ request }) => {
        const requestBody = {
            cardNumber: 1234567890123456 // Using number instead of string
        };

        const response = await request.post(endpointPath, {
            data: requestBody
        });

        // 1. Check HTTP Status Code
        expect(response.status()).toBe(400);

        // 2. Check Response Body Schema using Ajv for Error Response
        const responseJson = await response.json();
        const validate = ajv.compile(errorResponseSchema);
        const isValid = validate(responseJson);

        expect(isValid).toBeTruthy();
        if (!isValid) {
            console.error("Validation Errors:", validate.errors);
        }
    });
});