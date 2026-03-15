const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log("🤖 AI Test Generator starting...");

// 1. Secret Handling Check
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY is not set in environment variables!");
    process.exit(1);
}
console.log("✅ Secret handling verified: GEMINI_API_KEY is present.");

const MODELS_PRIORITY = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-flash-lite-latest"
];

// Helper for rate limiting (Free tier)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
2. Schema Validation: Wajib menggunakan library ajv untuk memvalidasi response body terhadap skema JSON yang ada di Swagger. Gunakan \`const ajv = new Ajv({ allErrors: true, strict: false });\` agar tidak error saat ada keyword "example" dari Swagger.
3. Test Scenarios: Buat minimal 1 Happy Path (2xx/3xx) dan 2 Negative Path (4xx/5xx).
4. Format: Hasilkan hanya kode TypeScript. Jangan ada penjelasan teks di luar blok kode.
5. Variable Naming: Gunakan gaya camelCase. Nama tes harus deskriptif.
6. Endpoint & Method: Gunakan HTTP method dan Endpoint Path persis seperti yang diberikan di text input. Jangan mengubah atau mengarang endpoint path sendiri. Gunakan path relatif (misal: /api/checkout) karena baseURL sudah diatur global.
7. Handling Response: Pastikan ekspektasi HTTP status code persis dan akurat sesuai dengan kondisi test. Jika response berisiko bukan JSON (misalnya error 404 dari server HTML), berhati-hatilah saat memanggil \`response.json()\`. Pastikan parameter ajv memvalidasi error message jika tersedia.
8. Soft-Fail & Context: Aplikasi ini memiliki desain "Soft-Fail". Jika input salah format (contoh tipe data) server return 400. TAPI jika secara business logic invalid (contoh: kartu kredit salah), server MERESPON 200 OK dengan property JSON seperti \`status: "failure"\` dan \`message: "rejected"\`. JANGAN GUNAKAN "failed", GUNAKAN "failure". BACA DESKRIPSI SWAGGER DENGAN SANGAT TELITI! Jika deskripsi spesifik bilang "AKAN SELALU RETURN 500" maka buat test case yang ekspektasi 500.
9. Schema Definitions: Skema yang sesungguhnya ada pada input "Full Swagger Definitions". Cek "$ref" secara presisi di bagian tersebut untuk mengetahui apakah nama field itu \`valid\` atau \`isValid\`, dll. JANGAN MENGARANG SKEMA SENDIRI!

Input Swagger Snippet & Definitions:
JSON
[MASUKKAN POTONGAN SWAGGER DISINI]

Output Format Example:
TypeScript
import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

// ... kode tes ...
`;

async function generateAllTests() {
    const MAX_RETRIES = 3;
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const api of changedApis) {
        let success = false;
        
        // Model Priority Fallback Loop
        for (const modelName of MODELS_PRIORITY) {
            console.log(`🤖 Attempting with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                // Construct User Prompt
                const userPrompt = `Generate a Playwright API test for this specific endpoint only:
HTTP Method: ${api.method.toUpperCase()}
Endpoint Path: ${api.path}

API Schema Snippet:
JSON
${JSON.stringify(api.schemaSnippet, null, 2)}

Full Swagger Definitions (Reference these for understanding $refs in Responses and Requests):
JSON
${JSON.stringify(swaggerData.definitions, null, 2)}`;
                
                console.log(`✨ Calling Gemini (${modelName}) for: ${api.key} (Attempt ${attempt}/${MAX_RETRIES})...`);
                
                try {
                    // Add a large delay to handle Free Tier RPM limits (Quota is tight)
                    await delay(60000); 
                    const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
                    const response = await result.response;
                    let text = response.text();

                    // Guardrail 1: Formatting (Extract code from markdown if present)
                    if (text.includes('```typescript')) {
                        text = text.split('```typescript')[1].split('```')[0].trim();
                    } else if (text.includes('```ts')) {
                        text = text.split('```ts')[1].split('```')[0].trim();
                    } else if (text.includes('```')) {
                        text = text.split('```')[1].split('```')[0].trim();
                    }

                    // Guardrail 2: Playwright Skeleton Check
                    if (!text.includes('import { test') && !text.includes('import {test')) {
                        throw new Error("Missing Playwright imports (`import { test...`)");
                    }
                    if (!text.includes('test(') && !text.includes('test.describe(')) {
                        throw new Error("Missing Playwright test skeleton (`test(` or `test.describe(`)");
                    }

                    // Guardrail 3: Assertion Check
                    if (!text.includes('expect(')) {
                        throw new Error("Missing assertions (`expect(`)");
                    }

                    // Guardrail 4: Endpoint Integrity Check
                    const methodLower = api.method.toLowerCase();
                    if (!text.includes(api.path)) {
                        throw new Error(`Hallucination detected: Exact API path '${api.path}' not found in code`);
                    }
                    if (!text.toLowerCase().includes(`.${methodLower}(`)) {
                        throw new Error(`Hallucination detected: HTTP Method request.${methodLower}() not found in code`);
                    }

                    // Sanitize filename
                    const safePath = api.path.replace(/\//g, '_').replace(/^_/, '');
                    const filename = `${api.method.toLowerCase()}_${safePath}.spec.ts`;
                    const filePath = path.join(targetApiDir, filename);

                    fs.writeFileSync(filePath, text);
                    console.log(`  📝 Saved: tests/api/${filename}`);

                    // Guardrail 5: Syntax & Format Check (ESLint)
                    console.log(`  🛡️ Running Linting Guardrail on ${filename}...`);
                    try {
                        const eslintConfig = path.resolve(__dirname, '../../playwright_template/.eslintrc.js');
                        execSync(`npx eslint -c "${eslintConfig}" "${filePath}"`, { stdio: 'pipe' });
                        console.log(`  ✅ Linting passed for ${filename}`);
                    } catch (error) {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); 
                        throw new Error("ESLint syntax/formatting check failed (Code is malformed)");
                    }
                    
                    // If we reach here, all guardrails passed!
                    success = true;
                    break; // Exit the retry loop

                } catch (error) {
                    console.error(`  ❌ Attempt ${attempt} failed with ${modelName}: ${error.message}`);
                    
                    // If it's a quota error, we might want to skip directly to the next model
                    if (error.message.includes("429") || error.message.includes("quota")) {
                        console.log(`  ⚠️ Quota limit hit for ${modelName}. Switching to next model...`);
                        break; // Exit attempt loop to try next model
                    }

                    if (attempt < MAX_RETRIES) {
                        console.log(`  🔄 Retrying with ${modelName}...`);
                    }
                }
            }

            if (success) break; // Exit model fallback loop if successful
        }

        if (!success) {
            console.error(`  🚫 All models failed for ${api.key}. Skipping this endpoint.`);
        }
    }

    // Save state after successful generation attempts
    fs.writeFileSync(cachePath, JSON.stringify(currentHashes, null, 2));
    console.log("\n💾 Saved current API state to cache.");
    console.log("✅ AI Test Generation completed successfully.");
}

// Execute the async flow
if (changedApis.length > 0) {
    generateAllTests();
} else {
    console.log("✅ No changes detected. Nothing to generate.");
}
