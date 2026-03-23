const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log("AI Test Generator starting...");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set!");
    process.exit(1);
}

const MODELS_PRIORITY = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-flash-lite-latest"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getComparableSchema(config) {
    return {
        parameters: config.parameters || [],
        responses: config.responses || {},
        requestBody: config.requestBody || {}
    };
}

const swaggerPath = path.resolve(__dirname, '../docs/swagger.json');
const cachePath = path.resolve(__dirname, '../../.cache/api_hashes.json');

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

if (changedApis.length === 0) {
    process.exit(0);
}

const targetApiDir = path.resolve(__dirname, '../generated_test/tests/api');
if (!fs.existsSync(targetApiDir)) {
    fs.mkdirSync(targetApiDir, { recursive: true });
}

const SYSTEM_PROMPT = `
System Role:
Anda adalah Senior SDET Expert yang berfokus pada API Automation menggunakan Playwright dan Ajv. Tugas Anda adalah menghasilkan file test Playwright .spec.ts yang siap pakai berdasarkan potongan Swagger yang diberikan.

Technical Requirements:
1. Framework: Gunakan @playwright/test.
2. Schema Validation: Wajib menggunakan library ajv untuk memvalidasi response body terhadap skema JSON yang ada di Swagger. Gunakan const ajv = new Ajv({ allErrors: true, strict: false });
3. Test Scenarios: Buat minimal 1 Happy Path (2xx/3xx) dan 2 Negative Path (4xx/5xx).
4. Format: Hasilkan hanya kode TypeScript. Jangan ada penjelasan teks di luar blok kode.
5. Variable Naming: Gunakan gaya camelCase.
6. Endpoint & Method: Gunakan HTTP method dan Endpoint Path persis seperti yang diberikan di text input. Gunakan path relatif (misal: /api/checkout).
7. Handling Response: Pastikan ekspektasi HTTP status code persis dan akurat. Gunakan response.status() untuk asersi.
8. Soft-Fail & Context: Aplikasi ini memiliki desain "Soft-Fail". ASERSILAH status code dan pesan secara presisi:
   - POST /api/checkout: Jika input amount >= 999.99 atau cardNumber "0000000000000000", ekspektasi status 200 OK dengan status: "failure" dan message: "Payment rejected due to business logic (Soft-Fail)".
   - POST /api/checkout: Jika input amount <= 0, ekspektasi status 400 Bad Request dengan error: "Missing or invalid required payment fields".
   - POST /api/validate-card: Jika Luhn gagal (misal '000...'), ekspektasi status 200 OK dengan valid: false dan message: "Invalid card number (Luhn check failed)".
   - POST /api/validate-email: Jika format email salah secara regex (misal 'bad-email'), ekspektasi status 200 OK (BUKAN 400) dengan valid: false dan message: "Email format is invalid".
9. Server Errors (500): Server merespon 500 HANYA jika email adalah 'trigger-500@internal.com'. Ekspektasi status 500 dengan error: "Email validation service temporarily unavailable (Simulated 500)".
10. Schema Definitions: Skema ada pada input "Full Swagger Definitions". Cek $ref secara presisi.

Input Swagger Snippet & Definitions:
JSON
[MASUKKAN POTONGAN SWAGGER DISINI]

Output Format Example:
TypeScript
import { test, expect } from '@playwright/test';
import Ajv from 'ajv';
`;

async function generateAllTests() {
    const MAX_RETRIES = 3;
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const api of changedApis) {
        let success = false;
        
        for (const modelName of MODELS_PRIORITY) {
            console.log("Attempting with model: " + modelName);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                const userPrompt = "Generate a Playwright API test for: " + api.key + "\n" +
                    "Endpoint: " + api.path + "\n" +
                    "Schema: " + JSON.stringify(api.schemaSnippet) + "\n" +
                    "Definitions: " + JSON.stringify(swaggerData.definitions);
                
                console.log("Calling Gemini for: " + api.key + " (Attempt " + attempt + ")");
                
                try {
                    await delay(60000); 
                    const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
                    const response = await result.response;
                    let text = response.text();

                    if (text.includes('```typescript')) {
                        text = text.split('```typescript')[1].split('```')[0].trim();
                    } else if (text.includes('```ts')) {
                        text = text.split('```ts')[1].split('```')[0].trim();
                    } else if (text.includes('```')) {
                        text = text.split('```')[1].split('```')[0].trim();
                    }

                    if (!text.includes('import { test')) throw new Error("Missing imports");
                    if (!text.includes('test(')) throw new Error("Missing test skeleton");

                    const safePath = api.path.replace(/\//g, '_').replace(/^_/, '');
                    const filename = api.method.toLowerCase() + "_" + safePath + ".spec.ts";
                    const filePath = path.join(targetApiDir, filename);

                    fs.writeFileSync(filePath, text);
                    console.log("Saved: " + filename);

                    try {
                        const eslintConfig = path.resolve(__dirname, '../../playwright_template/.eslintrc.js');
                        execSync(`npx eslint -c "${eslintConfig}" "${filePath}"`, { stdio: 'pipe' });
                    } catch (e) {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); 
                        throw new Error("Lint failed");
                    }
                    
                    success = true;
                    break;
                } catch (error) {
                    console.error("Attempt failed: " + error.message);
                    if (error.message.includes("429") || error.message.includes("quota")) break;
                }
            }
            if (success) break;
        }
    }

    fs.writeFileSync(cachePath, JSON.stringify(currentHashes, null, 2));
    console.log("Process complete.");
}

generateAllTests();
