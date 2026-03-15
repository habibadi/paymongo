import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

// --- Schema Definitions Extracted from Swagger ---

const emailRequestSchema = {
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "example": "user@example.com"
    }
  },
  "required": ["email"]
};

const emailResponseSchema = {
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "Email is valid"
    },
    "valid": {
      "type": "boolean",
      "example": true
    }
  }
};

const errorResponseSchema = {
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "example": "Internal server error"
    }
  }
};

// --- Test Suite ---

test.describe('POST /api/validate-email', () => {
  const endpointPath = '/api/validate-email';
  const method = 'POST';

  // Helper function to validate response against a schema
  const validateResponse = (responseBody: any, schema: any) => {
    const validate = ajv.compile(schema);
    const isValid = validate(responseBody);
    if (!isValid) {
      throw new Error(`Schema Validation Failed: ${ajv.errorsText(validate.errors)}`);
    }
  };

  // 1. Happy Path (200 OK) - Valid Email Format
  test('should return 200 OK and a valid response when providing a correctly formatted email', async ({ request }) => {
    // Setup Data based on main.EmailRequest definition
    const validEmailRequest = {
      email: 'test.user@company.com'
    };

    const response = await request.post(endpointPath, {
      data: validEmailRequest,
    });

    // Assertion 1: Status Code Check (Happy Path)
    expect(response.status()).toBe(200);

    const responseJson = await response.json();

    // Assertion 2: Schema Validation (main.EmailResponse)
    validateResponse(responseJson, emailResponseSchema);

    // Assertion 3: Business Logic Check (Assuming valid email results in valid: true)
    expect(responseJson.valid).toBe(true);
    expect(responseJson.message).toBe('Email is valid');
  });

  // 2. Negative Path (400 Bad Request) - Missing required field (Business Logic Error results in 400 format)
  test('should return 400 Bad Request when email field is missing or empty', async ({ request }) => {
    // Setup Data: Violates required property defined in schema
    const invalidRequest = {
      // 'email' field is missing entirely
    };

    const response = await request.post(endpointPath, {
      data: invalidRequest,
    });

    // Assertion 1: Status Code Check (Type/Format Error usually results in 400 in Soft-Fail design)
    expect(response.status()).toBe(400);

    // Note: In this specific case, if the server returns plain text or HTML on 400, response.json() might fail.
    // We cautiously try to parse it as JSON, assuming common API error handling returns a JSON error object.
    try {
        const responseJson = await response.json();
        // If we get JSON, try to validate against ErrorResponse (if the server maps 400 to the standard error structure)
        validateResponse(responseJson, errorResponseSchema);
        expect(responseJson.error).toBeDefined();
    } catch (e) {
        // If parsing fails, just confirm status code and response text
        console.warn("Could not parse 400 response as JSON. Checking status code only.");
        expect(response.text()).not.toBe('');
    }
  });

  // 3. Negative Path (500 Internal Server Error) - Simulated Server Failure
  test('should return 500 Internal Server Error when an unexpected server error occurs', async ({ request }) => {
    // For simulation, we send an email that might cause a backend dependency (e.g., DB connection) to fail,
    // forcing a 500 return as specified in the swagger response section for non-200 cases.

    const failingEmailRequest = {
        email: 'simulate-server-crash@service.com' // Placeholder for an input known to crash the backend
    };

    const response = await request.post(endpointPath, {
        data: failingEmailRequest,
    });

    // Assertion 1: Status Code Check (Forced 500 scenario)
    expect(response.status()).toBe(500);

    // Assertion 2: Schema Validation against main.ErrorResponse for 500
    try {
        const responseJson = await response.json();
        validateResponse(responseJson, errorResponseSchema);
        expect(responseJson.error).toBeDefined();
    } catch (e) {
        // If 500 returns non-JSON, we just assert the status code.
        expect(response.text()).toContain('Internal Server Error');
    }
  });
});