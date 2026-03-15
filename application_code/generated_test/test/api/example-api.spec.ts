import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../utils/api-helper';

test.describe('API Testing Example', () => {
    
    test('should get health check endpoint', async ({ request }) => {
        const response = await request.get('/api/health');

        expect(response.status()).toBe(200);

        const responseBody = await response.json();
        expect(responseBody).toHaveProperty('status');
        expect(responseBody.status).toBe('healthy');
    });

    test('should validate card number via API', async ({ request }) => {
        const apiHelper = new ApiHelper(request);
        
        // Example: Validate a card number using our API
        const response = await apiHelper.post('/api/validate-card', {
            cardNumber: '4242424242424242',
        });

        expect(response.status()).toBe(200);

        const result = await response.json();
        expect(result).toHaveProperty('valid');
        expect(result.valid).toBe(true);
    });

    test('should process checkout payment', async ({ request }) => {
        const apiHelper = new ApiHelper(request);

        const response = await apiHelper.post('/api/checkout', {
            cardNumber: '4242 4242 4242 4242',
            expiry: '12/26',
            cvv: '123',
            amount: 50.00
        });

        expect(response.status()).toBe(200);

        const responseData = await response.json();
        expect(responseData).toHaveProperty('status');
        expect(responseData.status).toBe('success');
        expect(responseData.message).toContain('successfully');
    });

    test('should handle error responses for email validation (soft fail simulation)', async ({ request }) => {
        // Our API is designed to return 500 for email validation to test soft-failure
        const response = await request.post('/api/validate-email', {
            data: { email: 'test@example.com' }
        });

        expect(response.status()).toBe(500);

        const errorResponse = await response.json();
        expect(errorResponse).toHaveProperty('error');
    });

    test('should handle nonexistent endpoints', async ({ request }) => {
        const response = await request.get('/api/not-found');
        expect(response.status()).toBe(404);
    });
});
