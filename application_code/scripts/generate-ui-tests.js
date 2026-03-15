/**
 * AI-Powered UI/E2E Test Generator
 * ============================================
 * Strategy: "Cleaned HTML DOM Injection + Anti-Fragile Guardrails"
 *
 * How it works:
 *   1. CHANGE DETECTION: Hashes page.tsx to detect UI changes (like Swagger hashing for APIs)
 *   2. DOM SNAPSHOT: Fetches running UI (or reads TSX statically) and cleans the HTML
 *   3. AI GENERATION: Injects clean DOM into Gemini prompt for accurate selector generation
 *   4. GUARDRAILS: 4-layer validation to reject fragile/hallucinated tests before saving
 *   5. HARD FAIL: process.exit(1) after MAX_RETRIES across all models
 *
 * Anti-Fragile Guardrails:
 *   G1 - XPath / unstable selector check (reject page.locator('//...') or .nth())
 *   G2 - Business flow completeness check (min fill() and click() counts)
 *   G3 - Hardcoded sleep anti-pattern check (reject waitForTimeout)
 *   G4 - Success state assertion check (must use toBeVisible/toHaveText/toContainText)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
// Also try dotenvx if available (used in Docker/CI)
try {
    require('@dotenvx/dotenvx').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
} catch (_) { /* If not available, plain dotenv is enough */ }

console.log('🎭 AI UI/E2E Test Generator starting...');

// ─── 1. SECRET HANDLING ──────────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not set in environment variables!');
    process.exit(1);
}
console.log('✅ Secret handling verified: GEMINI_API_KEY is present.');

// ─── 2. CONFIGURATION ────────────────────────────────────────────────────────
const MODELS_PRIORITY = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
];

const MAX_RETRIES = 3;
const STAGING_UI_URL = process.env.STAGING_BASE_URL || 'http://localhost:3000';

// Page definitions — this is the "Swagger equivalent" for UI
// Each page has: url, a required set of interactions, and business rules
const UI_PAGES = [
    {
        name: 'checkout',
        url: '/',  // The checkout page is at root
        filename: 'checkout_flow.spec.ts',
        description: 'Payment Checkout Form',
        // Minimum interactions required (Guardrail 2 thresholds)
        minFillCount: 4,   // email, cardNumber, expiry/cvv, amount
        minClickCount: 1,  // submit button
        businessFlows: [
            'Happy Path: Fill all fields correctly and submit to get success message',
            'Negative Path: Submit with invalid card number to get error message',
            'Negative Path: Submit without filling required fields to see HTML5 validation',
        ],
        // What the success assertion should look for
        successIndicators: ['Payment processed', 'processed successfully', '✅'],
    }
];

// ─── 3. CHANGE DETECTION (like Swagger hashing but for page.tsx) ─────────────
const pageTsxPath = path.resolve(__dirname, '../app/page.tsx');
const uiCachePath = path.resolve(__dirname, '../../.cache/ui_hashes.json');
const cacheDir = path.dirname(uiCachePath);

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

let previousUiHashes = {};
if (fs.existsSync(uiCachePath)) {
    previousUiHashes = JSON.parse(fs.readFileSync(uiCachePath, 'utf8'));
}

const currentUiHashes = {};
const changedPages = [];

for (const page of UI_PAGES) {
    const sourceFile = pageTsxPath; // Could be extended per-page
    if (!fs.existsSync(sourceFile)) {
        console.warn(`⚠️  Source file not found: ${sourceFile}. Forcing regeneration.`);
        changedPages.push(page);
        continue;
    }
    const content = fs.readFileSync(sourceFile, 'utf8');
    // Hash only the JSX return block (UI structure), not business logic
    const jsxMatch = content.match(/return\s*\(([\s\S]*)\);?\s*\}/);
    const hashSource = jsxMatch ? jsxMatch[1] : content;
    const hash = crypto.createHash('sha256').update(hashSource).digest('hex');
    
    currentUiHashes[page.name] = hash;
    if (previousUiHashes[page.name] !== hash) {
        console.log(`  🔄 UI Change detected: ${page.name} page`);
        changedPages.push(page);
    }
}

console.log(`\n📊 UI Diff Results: Found ${changedPages.length} changed page(s).`);

if (changedPages.length === 0) {
    console.log('✅ No UI changes detected. Nothing to generate.');
    process.exit(0);
}

// ─── 4. HTML DOM FETCHER + CLEANER ───────────────────────────────────────────
/**
 * Fetches the live HTML from the running UI server.
 * Falls back to extracting structure from page.tsx if server is unreachable.
 */
async function fetchAndCleanDOM(pageUrl) {
    const fullUrl = `${STAGING_UI_URL}${pageUrl}`;
    console.log(`  🌐 Attempting to fetch live DOM from: ${fullUrl}`);
    
    try {
        const html = await new Promise((resolve, reject) => {
            const req = http.get(fullUrl, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });

        console.log('  ✅ Live DOM fetched successfully. Cleaning...');
        return cleanHTML(html);
    } catch (err) {
        console.warn(`  ⚠️  Could not fetch live DOM (server not running?): ${err.message}`);
        console.log('  📄 Falling back to static page.tsx analysis...');
        return extractDomFromTsx(pageTsxPath);
    }
}

/**
 * Cleans raw HTML to remove noise (scripts, styles, SVGs, long class names).
 * Keeps only elements relevant to test selector generation:
 * input, button, form, label, [name], [placeholder], [data-testid], [id], [role]
 */
function cleanHTML(rawHtml) {
    // Remove script tags and their content
    let clean = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Remove style tags
    clean = clean.replace(/<style[\s\S]*?<\/script>/gi, ''); // Fix typo here too
    // Remove SVG elements
    clean = clean.replace(/<svg[\s\S]*?<\/svg>/gi, '[icon]');
    // Remove long class attributes
    clean = clean.replace(/\s+class(Name)?="[^"]{40,}"/gi, '');
    // Remove comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    
    // Improved extraction: include inner text for buttons and labels
    const importantElements = [];
    const elementPattern = /<(button|label|input|form|span|p|h[1-6])[^>]*>([\s\S]*?)<\/\1>|<(input|img)[^>]*\/?>/gi;
    
    let match;
    while ((match = elementPattern.exec(clean)) !== null) {
        let tagContent = match[0];
        // Keep if it has interactive attributes or is a button/label with text
        if (tagContent.includes('name=') || tagContent.includes('placeholder=') || 
            tagContent.includes('id=') || tagContent.includes('role=') ||
            tagContent.includes('type=') || /<button|<label/i.test(tagContent)) {
            
            // Further clean long class names inside the tagContent
            const finalTag = tagContent.replace(/\s+class(Name)?="[^"]+"/gi, (m) => m.length > 50 ? '' : m);
            importantElements.push(finalTag.trim());
        }
    }

    if (importantElements.length > 0) {
        return importantElements.join('\n');
    }

    return clean.substring(0, 3000);
}

/**
 * Extracts DOM structure from page.tsx as a fallback.
 */
function extractDomFromTsx(tsxPath) {
    const content = fs.readFileSync(tsxPath, 'utf8');
    // Simple regex to find buttons and inputs with their labels
    const matches = content.match(/<(button|label|input|form)[^>]*>([\s\S]*?)<\/\1>|<input[^>]*\/?>/gi) || [];
    const cleaned = matches.map(m => m.replace(/className="[^"]{40,}"/g, '')).join('\n');
    return `[Static Analysis from page.tsx]\n${cleaned}`;
}

// ─── 5. SYSTEM PROMPT ────────────────────────────────────────────────────────
const UI_SYSTEM_PROMPT = `
System Role:
Anda adalah Senior SDET Expert yang ahli dalam Playwright E2E Testing.
Tugas Anda adalah menghasilkan file test Playwright .spec.ts yang kuat dan stabil.

⚠️ CRITICAL RULES:
1. FORBIDDEN LOCATORS: JANGAN GUNAKAN XPath (page.locator('//')), CSS selector panjang, atau .nth().
   HANYA gunakan getByRole, getByLabel, getByPlaceholder, getByText.

2. BUTTON LOCATORS — SANGAT PENTING:
   - JANGAN PERNAH menggunakan { name: /submit/i } jika teks pada button bukan "Submit".
   - Lihat teks di dalam tag <button> yang diberikan di DOM snippet.
   - Jika tombol berisi teks "Pay $99.99", gunakan getByRole('button', { name: /Pay|Complete/i }).

3. STRICT MODE SAFETY:
   - getByPlaceholder() WAJIB menggunakan { exact: true } untuk placeholder pendek (CVV, 123, MM/YY).

4. CVV FIELD: Gunakan getByLabel('CVV') karena field ini sering ambiguous dengan nomor kartu.

5. ASSERTIONS: Setiap test wajib memvalidasi state UI (misal: await expect(page.getByText('✅')).toBeVisible()).

Context: Checkout Page. Success message contains 'processed' or '✅'. Failure contains '❌'.

Cleaned HTML DOM:
[INJECT_DOM_HERE]
`;


// ─── 6. GUARDRAILS ───────────────────────────────────────────────────────────
/**
 * Runs all 5 Anti-Fragile Guardrails against generated code.
 */
function runUiGuardrails(code, pageConfig) {
    const failureReasons = [];

    // ── Guardrail 5: Button Label Hallucination Check ────────────────────────
    if (/getByRole\(['"`]button['"`],\s*{\s*name:\s*\/submit\/i\s*}\)/i.test(code)) {
        failureReasons.push(
            'G5_BUTTON_NAME: Generic /submit/i button locator detected. ' +
            'HALLUCINATION WARNING: The actual button text in the DOM is likely "Pay" or "Complete Payment". ' +
            'Use the actual labels found in the HTML snippet provided.'
        );
    }

    // ── Guardrail 1b: Ambiguous Placeholder Check ────────────────────────────
    const bareShortPlaceholders = code.match(/getByPlaceholder\(['"`][^'"` ]{1,7}['"`]\)/g) || [];
    const ambiguous = bareShortPlaceholders.filter(p => !p.includes('exact'));
    if (ambiguous.length > 0) {
        failureReasons.push(`G1_PLACEHOLDER: Ambiguous short getByPlaceholder() without exact:true: ${ambiguous.join(', ')}`);
    }

    // ── Guardrail 1: XPath / Unstable Locator Check ──────────────────────────
    if (/page\.locator\(['"`]\/\//i.test(code)) {
        failureReasons.push('G1_XPATH: XPath locator detected.');
    }
    if (/\.nth\(\d+\)/i.test(code) && !/\/\/ .*.nth/.test(code)) {
        failureReasons.push('G1_NTH: Positional .nth() selector detected.');
    }

    // ── Guardrail 2: Business Flow Completeness Check ─────────────────────────
    const fillCount = (code.match(/\.fill\(/g) || []).length;
    const clickCount = (code.match(/\.click\(/g) || []).length;
    
    if (fillCount < pageConfig.minFillCount) {
        failureReasons.push(
            `G2_FILL: Only ${fillCount} fill() actions found. ` +
            `Minimum required: ${pageConfig.minFillCount} ` +
            `(email, cardNumber, expiry, cvv, amount). ` +
            `Test is incomplete — missing form field interactions.`
        );
    }
    if (clickCount < pageConfig.minClickCount) {
        failureReasons.push(
            `G2_CLICK: Only ${clickCount} click() actions found. ` +
            `Minimum required: ${pageConfig.minClickCount} (submit button). ` +
            `Test must click the submit button to complete the flow.`
        );
    }

    // ── Guardrail 3: Anti-Pattern Check (Hardcoded Sleep) ────────────────────
    if (/page\.waitForTimeout\s*\(/i.test(code)) {
        failureReasons.push(
            'G3_SLEEP: page.waitForTimeout() detected. ' +
            'FORBIDDEN - this causes flaky tests. ' +
            'Playwright auto-waits. Use expect(locator).toBeVisible() or page.waitForURL() instead.'
        );
    }

    // ── Guardrail 4: Success State Assertion Check ────────────────────────────
    if (!code.includes('expect(')) {
        failureReasons.push(
            'G4_ASSERT: No expect() assertions found. ' +
            'Every test MUST validate what happened on the UI after the action.'
        );
    }
    const hasWebFirstAssertion = 
        code.includes('.toBeVisible()') ||
        code.includes('.toHaveText(') ||
        code.includes('.toContainText(') ||
        code.includes('.toHaveURL(') ||
        code.includes('.toHaveValue(') ||
        code.includes('page.url()');
    
    if (!hasWebFirstAssertion) {
        failureReasons.push(
            'G4_ASSERTION_TYPE: No web-first assertions found. ' +
            'Must use Playwright web-first assertions like: ' +
            '.toBeVisible(), .toHaveText(), .toContainText(), or .toHaveURL()'
        );
    }

    // ── Playwright Structure Check ────────────────────────────────────────────
    if (!code.includes("import { test") && !code.includes("import {test")) {
        failureReasons.push('STRUCTURE: Missing Playwright import (import { test, expect })');
    }
    if (!code.includes('test(') && !code.includes('test.describe(')) {
        failureReasons.push('STRUCTURE: Missing test() or test.describe() block');
    }

    if (failureReasons.length > 0) {
        const errorMsg = failureReasons.map((r, i) => `  [${i+1}] ${r}`).join('\n');
        throw new Error(`Guardrail violations:\n${errorMsg}`);
    }
}

// ─── 7. HELPER ───────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── 8. MAIN GENERATOR ───────────────────────────────────────────────────────
async function generateAllUiTests() {
    const genAI = new GoogleGenerativeAI(apiKey);
    const targetDir = path.resolve(__dirname, '../generated_test/tests/web');
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const page of changedPages) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📄 Generating E2E tests for: ${page.name} (${page.description})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Step 1: Get cleaned DOM snapshot
        const cleanedDom = await fetchAndCleanDOM(page.url);
        console.log(`  📦 DOM snapshot ready (${cleanedDom.length} chars after cleaning)`);

        // Step 2: Build the prompt with injected DOM
        const prompt = UI_SYSTEM_PROMPT.replace('[INJECT_DOM_HERE]', cleanedDom);
        
        const userRequest = `
Generate Playwright E2E tests for the "${page.description}" page.

Page URL: ${page.url}
Business Flows to Test:
${page.businessFlows.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Success Indicators (what to assert after submit):
${page.successIndicators.map(s => `- "${s}"`).join('\n')}

IMPORTANT: Use the cleaned DOM above to pick accurate selectors.
Generate complete test code — no placeholders, no TODOs.
`;

        // Step 3: Model Priority Fallback + Retry Loop
        let success = false;
        const allFailureReasons = [];

        for (const modelName of MODELS_PRIORITY) {
            if (success) break;
            console.log(`\n🤖 Attempting with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                console.log(`✨ Calling Gemini (${modelName}) for: ${page.name} (Attempt ${attempt}/${MAX_RETRIES})...`);

                try {
                    await delay(60000); // Rate limit buffer
                    const result = await model.generateContent([prompt, userRequest]);
                    let generatedCode = result.response.text();

                    // Guardrail 0: Formatting — strip markdown code fences
                    if (generatedCode.includes('```typescript')) {
                        generatedCode = generatedCode.split('```typescript')[1].split('```')[0].trim();
                    } else if (generatedCode.includes('```ts')) {
                        generatedCode = generatedCode.split('```ts')[1].split('```')[0].trim();
                    } else if (generatedCode.includes('```')) {
                        generatedCode = generatedCode.split('```')[1].split('```')[0].trim();
                    }

                    // Guardrails 1-4: Anti-Fragile checks
                    runUiGuardrails(generatedCode, page);

                    // All guardrails passed — save the file
                    const filePath = path.join(targetDir, page.filename);
                    fs.writeFileSync(filePath, generatedCode);
                    console.log(`  📝 Saved: generated_test/tests/web/${page.filename}`);

                    // Guardrail 5: ESLint syntax check
                    console.log(`  🛡️  Running Linting Guardrail on ${page.filename}...`);
                    try {
                        const eslintConfig = path.resolve(__dirname, '../../playwright_template/.eslintrc.js');
                        execSync(`npx eslint -c "${eslintConfig}" "${filePath}"`, { stdio: 'pipe' });
                        console.log(`  ✅ Linting passed for ${page.filename}`);
                    } catch (lintErr) {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                        throw new Error('ESLint check failed — code is syntactically malformed');
                    }

                    success = true;
                    break;

                } catch (error) {
                    const reason = error.message;
                    console.error(`  ❌ Attempt ${attempt} failed: ${reason.split('\n')[0]}`);
                    allFailureReasons.push(`[${modelName} attempt ${attempt}] ${reason}`);

                    if (reason.includes('429') || reason.includes('quota')) {
                        console.log(`  ⚠️  Quota limit hit for ${modelName}. Switching to next model...`);
                        break; // Try next model immediately
                    }

                    if (attempt < MAX_RETRIES) {
                        console.log(`  🔄 Retrying with same model (providing failure feedback)...`);
                    }
                }
            }
        }

        // ── HARD FAIL: All models and retries exhausted ────────────────────────
        if (!success) {
            console.error('\n');
            console.error('╔══════════════════════════════════════════════════════════════╗');
            console.error('║          ❌ FATAL: UI TEST GENERATION ABORTED                ║');
            console.error('╚══════════════════════════════════════════════════════════════╝');
            console.error(`\n[ERROR] Page "${page.name}" failed after ${MAX_RETRIES} retries across all ${MODELS_PRIORITY.length} models.`);
            console.error('\n[FAILURE LOG]');
            allFailureReasons.forEach((r, i) => console.error(`  ${i + 1}. ${r.split('\n')[0]}`));
            console.error('\n[ACTION REQUIRED]');
            console.error('  - Review the guardrail violations above');
            console.error('  - Check if UI server is running for live DOM injection');
            console.error('  - Verify GEMINI_API_KEY quota limits');
            process.exit(1); // CI pipeline will mark this step as FAILED ❌
        }
    }

    // ── Save updated UI hashes to cache ────────────────────────────────────────
    fs.writeFileSync(uiCachePath, JSON.stringify(currentUiHashes, null, 2));
    console.log('\n💾 Saved UI state to cache.');
    console.log('✅ AI UI Test Generation completed successfully.');
}

// ─── 9. EXECUTE ──────────────────────────────────────────────────────────────
generateAllUiTests().catch(err => {
    console.error('[FATAL] Unhandled error in generator:', err.message);
    process.exit(1);
});
