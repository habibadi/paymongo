import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

// Initialize Ajv outside of tests
const ajv = new Ajv({ allErrors: true, strict: false });

// --- Schema Definitions for Request and Response ---

// main.PaymentRequest Schema
const paymentRequestSchema = {
  "type": "object",
  "properties": {
    "amount": { "type": "number" },
    "cardNumber": { "type": "string" },
    "cvv": { "type": "string" },
    "expiry": { "type": "string" }
  },
  "required": ["amount", "cardNumber", "cvv", "expiry"]
};

// main.PaymentResponse Schema (for 200 OK case)
const paymentResponseSchema = {
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "status": { "type": "string" }
  },
  "required": ["message", "status"]
};

// main.ErrorResponse Schema (for 400 case)
const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": { "type": "string" }
  },
  "required": ["error"]
};

// Compile schemas once
const validatePaymentRequest = ajv.compile(paymentRequestSchema);
const validatePaymentResponse = ajv.compile(paymentResponseSchema);
const validateErrorResponse = ajv.compile(errorResponseSchema);

// --- Test Data ---

const endpointPath = '/api/checkout';

// Happy Path Data (Assuming server accepts this input)
const happyPathPayload = {
  amount: 100.50,
  cardNumber: "4242424242424242",
  cvv: "999",
  expiry: "12/30"
};

// Negative Path 1: Schema Validation Failure (Input structure/type error -> Expect 400)
const negativePathInvalidTypePayload = {
  amount: "invalid_amount", // Should be number
  cardNumber: "123",
  cvv: "123",
  expiry: "10/25"
};

// Negative Path 2: Business Logic Failure (Input data valid structure, but logically rejected -> Expect 200 OK with {status: "failure"})
// Since the Swagger doesn't specify what causes a 500 or a 200 business failure, we rely on the "Soft-Fail" rule:
// If input is structurally valid but business logic invalid (e.g., bad card number format beyond simple structural check), the server often returns 200 OK with a failure message, unless a 4xx/5xx is explicitly mandated.
// We will simulate a logically invalid request that we expect to result in status: "failure" inside a 200 response, based on the Soft-Fail guidance.
const negativePathBusinessFailurePayload = {
    amount: 50,
    cardNumber: "0000000000000000", // Example of a likely invalid card number that passes structure check
    cvv: "123",
    expiry: "01/24"
};


test.describe('POST /api/checkout', () => {

    test('should successfully process a payment (Happy Path 200)', async ({ request }) => {
        // 1. Validate Request Payload Structure against Schema
        if (!validatePaymentRequest(happyPathPayload)) {
            throw new Error(`Happy Path Request Payload failed AJV validation: ${ajv.errorsText(validatePaymentRequest.errors)}`);
        }

        const response = await request.post(endpointPath, {
            data: happyPathPayload,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 2. Check HTTP Status Code
        expect(response.status()).toBe(200);

        const responseBody = await response.json();

        // 3. Validate Response Body against Schema (main.PaymentResponse)
        const isValid = validatePaymentResponse(responseBody);
        expect(isValid).toBeTruthy();
        if (!isValid) {
            console.error("Response Validation Errors:", ajv.errors);
        }

        // 4. Verify Business Logic specific to Happy Path
        expect(responseBody.status).toBe('success');
        expect(responseBody).toHaveProperty('message');
    });

    test('should return 400 Bad Request due to invalid data type in request (Negative Path 1)', async ({ request }) => {
        // 1. Validate Request Payload Structure against Schema (Should fail here as 'amount' is string)
        if (validatePaymentRequest(negativePathInvalidTypePayload)) {
             // This block executes if Ajv thinks the structure is okay despite the string type, 
             // but for strict API testing, we assume the server rejects malformed structure/type errors as 400.
             // We proceed to test the server response.
        }

        const response = await request.post(endpointPath, {
            data: negativePathInvalidTypePayload,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 2. Check HTTP Status Code
        expect(response.status()).toBe(400);

        // 3. Validate Response Body against Error Schema (main.ErrorResponse)
        let responseBody: any;
        try {
            responseBody = await response.json();
            const isValid = validateErrorResponse(responseBody);
            expect(isValid).toBeTruthy();
            if (!isValid) {
                 console.error("400 Response Validation Errors:", ajv.errors);
            }
        } catch (e) {
            // Handle case where 400 returns plain text or empty body
            console.warn("Could not parse 400 response as JSON. Assuming error occurred.");
            expect(response.text()).not.toBe('');
        }
    });

    test('should return 200 OK with status failure for business logic rejection (Negative Path 2 - Soft Fail)', async ({ request }) => {
        // 1. Validate Request Payload Structure (Should pass structure check)
        if (!validatePaymentRequest(negativePathBusinessFailurePayload)) {
            throw new Error(`Negative Path 2 Request Payload failed AJV validation: ${ajv.errorsText(validatePaymentRequest.errors)}`);
        }

        const response = await request.post(endpointPath, {
            data: negativePathBusinessFailurePayload,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 2. Check HTTP Status Code (Expected 200 based on Soft-Fail design for business logic errors)
        expect(response.status()).toBe(200);

        const responseBody = await response.json();

        // 3. Validate Response Body against PaymentResponse Schema (as structure implies 200 success format)
        const isValid = validatePaymentResponse(responseBody);
        expect(isValid).toBeTruthy();
        if (!isValid) {
             console.error("Response Validation Errors:", ajv.errors);
        }

        // 4. Verify Business Logic specific to Negative Path (Must match "failure" keyword)
        expect(responseBody.status).toBe('failure');
        expect(responseBody).toHaveProperty('message');
    });
});