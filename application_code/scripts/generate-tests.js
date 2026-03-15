/**
 * generate-tests.js (MOCK)
 * This script simulates the AI Test Generation process.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log("🤖 AI Test Generator starting...");

// 1. Secret Handling Check
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY is not set in environment variables!");
    process.exit(1);
}
console.log("✅ Secret handling verified: GEMINI_API_KEY is present.");

// 2. Helper to filter only schema-relevant parts for hashing
function getComparableSchema(config) {
    return {
        parameters: config.parameters || [],
        responses: config.responses || {},
        requestBody: config.requestBody || {}
    };
}

// 3. API Parsing and Diffing Logic
console.log("🔍 Parsing Swagger and calculating endpoint diffs...");
const swaggerPath = path.resolve(__dirname, '../docs/swagger.json');
const cachePath = path.resolve(__dirname, '../../.cache/api_hashes.json');

// Ensure cache directory exists
const cacheDir = path.dirname(cachePath);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

let previousHashes = {};
if (fs.existsSync(cachePath)) {
    previousHashes = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
}

const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
const currentHashes = {};
const changedApis = [];

for (const [apiPath, methods] of Object.entries(swaggerData.paths)) {
    for (const [method, config] of Object.entries(methods)) {
        const endpointKey = `${method.toUpperCase()} ${apiPath}`;
        
        // Create hash ONLY from parameters/responses (ignore descriptions)
        const comparableSchema = getComparableSchema(config);
        const configString = JSON.stringify(comparableSchema);
        const hash = crypto.createHash('sha256').update(configString).digest('hex');
        
        currentHashes[endpointKey] = hash;

        if (previousHashes[endpointKey] !== hash) {
            changedApis.push({
                key: endpointKey,
                method: method,
                path: apiPath,
                schemaSnippet: comparableSchema
            });
        }
    }
}

console.log("📊 API Diff Results:");
if (changedApis.length === 0) {
    console.log("  No APIs changed. Skipping generation.");
    // Early exit in real world
    // process.exit(0);
} else {
    console.log(`  Found ${changedApis.length} changed/new APIs:`);
    changedApis.forEach(api => console.log(`  - ${api.key}`));
}

// 4. Per-Endpoint Generation Logic
console.log("\n🧠 Sending requests to Gemini Pro for changed APIs... (MOCKED)");

const targetApiDir = path.resolve(__dirname, '../generated_test/tests/api');
if (!fs.existsSync(targetApiDir)) {
    fs.mkdirSync(targetApiDir, { recursive: true });
}

// System Prompt Template (simulating the Gating Logic)
const SYSTEM_PROMPT = `
System Role:
Anda adalah Senior SDET Expert yang berfokus pada API Automation menggunakan Playwright dan Ajv. Tugas Anda adalah menghasilkan file test Playwright .spec.ts yang siap pakai berdasarkan potongan Swagger yang diberikan.

Technical Requirements:
1. Framework: Gunakan @playwright/test.
2. Schema Validation: Wajib menggunakan library ajv untuk memvalidasi response body terhadap skema JSON yang ada di Swagger.
3. Test Scenarios: Buat minimal 1 Happy Path (2xx) dan 2 Negative Path (4xx/400/404/422).
4. Format: Hasilkan hanya kode TypeScript. Jangan ada penjelasan teks di luar blok kode.
5. Variable Naming: Gunakan gaya camelCase. Nama tes harus deskriptif.
`;

setTimeout(() => {
    changedApis.forEach(api => {
        // Construct User Prompt
        const userPrompt = `Generate a Playwright API test for this specific endpoint only:\nJSON\n${JSON.stringify(api.schemaSnippet, null, 2)}`;
        
        console.log(`✨ Gemini processing: ${api.key}`);
        // console.log("Prompt preview length:", userPrompt.length);
        
        // Sanitize filename
        const safePath = api.path.replace(/\//g, '_').replace(/^_/, '');
        const filename = `${api.method.toLowerCase()}_${safePath}.spec.ts`;
        const filePath = path.join(targetApiDir, filename);

        // MOCK: Generate individual file content based on blueprint structure
        const mockContent = `import { test, expect } from '@playwright/test';
// MOCK AJV IMPORT
// import Ajv from 'ajv';

test.describe('API Endpoint: ${api.key}', () => {
    test('should handle ${api.key} - Happy Path', async ({ request }) => {
        // Auto-generated generated test for ${api.key}
        const res = await request.${api.method.toLowerCase()}('${api.path}');
        expect(res.status()).toBeLessThan(500);
    });
});
`;
        fs.writeFileSync(filePath, mockContent);
        console.log(`  📝 Created: tests/api/${filename}`);
    });

    // Save state after successful generation
    fs.writeFileSync(cachePath, JSON.stringify(currentHashes, null, 2));
    console.log("\n💾 Saved current API state to cache.");

    console.log("✅ AI Test Generation completed successfully.");
}, 1500);
