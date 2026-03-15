/**
 * AI-Powered UI/E2E Test Generator with SELF-HEALING
 * ==================================================
 * Strategy: "Cleaned HTML DOM Injection + Anti-Fragile Guardrails + Execution Feedback"
 *
 * How it works:
 *   1. CHANGE DETECTION: Hashes page.tsx to detect UI changes.
 *   2. DOM SNAPSHOT: Fetches live/static HTML and cleans it.
 *   3. AI GENERATION: Injects DOM into Gemini for accurate selectors.
 *   4. GUARDRAILS: Static analysis to reject fragile code.
 *   5. TRIAL RUN: Executes the generated test locally.
 *   6. SELF-HEALING: If Trial Run fails, feeds error back to Gemini for automatic fix.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

try {
    require('@dotenvx/dotenvx').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
} catch (_) {}

console.log('🎭 AI UI/E2E Test Generator (with Self-Healing) starting...');

// ─── 1. CONFIGURATION ────────────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not set!');
    process.exit(1);
}

const MODELS_PRIORITY = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview"
];
const MAX_RETRIES = 2;
const STAGING_UI_URL = process.env.STAGING_BASE_URL || 'http://localhost:3000';

const UI_PAGES = [
    {
        name: 'checkout',
        url: '/',
        filename: 'checkout_flow.spec.ts',
        description: 'Payment Checkout Form',
        minFillCount: 4,
        minClickCount: 1,
        businessFlows: [
            'Happy Path: Fill all fields correctly and submit to get success message',
            'Negative Path: Submit with invalid card number to get error message',
            'Negative Path: Submit without filling required fields to see HTML5 validation',
        ],
        successIndicators: ['Payment processed', 'processed successfully', '✅'],
    }
];

// ─── 2. CHANGE DETECTION ─────────────────────────────────────────────────────
const pageTsxPath = path.resolve(__dirname, '../app/page.tsx');
const uiCachePath = path.resolve(__dirname, '../../.cache/ui_hashes.json');
const cacheDir = path.dirname(uiCachePath);
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

let previousUiHashes = fs.existsSync(uiCachePath) ? JSON.parse(fs.readFileSync(uiCachePath, 'utf8')) : {};
const currentUiHashes = {};
const changedPages = [];

for (const page of UI_PAGES) {
    const sourceFile = pageTsxPath;
    if (!fs.existsSync(sourceFile)) {
        changedPages.push(page);
        continue;
    }
    const content = fs.readFileSync(sourceFile, 'utf8');
    const jsxMatch = content.match(/return\s*\(([\s\S]*)\);?\s*\}/);
    const hashSource = jsxMatch ? jsxMatch[1] : content;
    const hash = crypto.createHash('sha256').update(hashSource).digest('hex');
    
    currentUiHashes[page.name] = hash;
    if (previousUiHashes[page.name] !== hash) {
        console.log(`  🔄 UI Change detected: ${page.name} page`);
        changedPages.push(page);
    }
}

if (changedPages.length === 0) {
    console.log('✅ No UI changes detected.');
    process.exit(0);
}

// ─── 3. DOM UTILS ────────────────────────────────────────────────────────────
async function fetchAndCleanDOM(pageUrl) {
    const fullUrl = `${STAGING_UI_URL}${pageUrl}`;
    try {
        const html = await new Promise((resolve, reject) => {
            const req = http.get(fullUrl, { timeout: 3000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
        return cleanHTML(html);
    } catch (err) {
        return extractDomFromTsx(pageTsxPath);
    }
}

function cleanHTML(rawHtml) {
    let clean = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[\s\S]*?<\/style>/gi, '')
                       .replace(/<svg[\s\S]*?<\/svg>/gi, '[icon]')
                       .replace(/\s+class(Name)?="[^"]{40,}"/gi, '')
                       .replace(/<!--[\s\S]*?-->/g, '');
    
    const importantElements = [];
    const elementPattern = /<(button|label|input|form|span|p|h[1-6])[^>]*>([\s\S]*?)<\/\1>|<(input|img)[^>]*\/?>/gi;
    let match;
    while ((match = elementPattern.exec(clean)) !== null) {
        let tagContent = match[0];
        if (tagContent.includes('name=') || tagContent.includes('placeholder=') || 
            tagContent.includes('id=') || tagContent.includes('role=') ||
            tagContent.includes('type=') || /<button|<label/i.test(tagContent)) {
            importantElements.push(tagContent.trim());
        }
    }
    return importantElements.length > 0 ? importantElements.join('\n') : clean.substring(0, 3000);
}

function extractDomFromTsx(tsxPath) {
    const content = fs.readFileSync(tsxPath, 'utf8');
    const matches = content.match(/<(button|label|input|form)[^>]*>([\s\S]*?)<\/\1>|<input[^>]*\/?>/gi) || [];
    return `[Static Analysis from page.tsx]\n${matches.join('\n')}`;
}

// ─── 4. AI PROMPTS ───────────────────────────────────────────────────────────
const UI_SYSTEM_PROMPT = `
System Role: Senior SDET Expert.
Task: Generate high-stability Playwright .spec.ts code.

RULES:
1. Use page.getByRole, page.getByLabel, page.getByPlaceholder, page.getByText. 
2. NEVER use test.locator() or test.getByLabel(). All locators MUST be called on the 'page' object.
3. DO NOT define locators in a global 'SELECTORS' object at the top level. Define them inside test blocks.
4. Button text must match the DOM. If button has "$99.99", include it in assertion.
5. Use Web-First Assertions: expect(page.locator(...)).toBeVisible(), .toHaveAttribute(), .toContainText().
6. Use { exact: true } for short placeholders (123, MM/YY).
7. CVV: use page.getByLabel('CVV').
8. Navigation: use page.goto('/') for the main form.
`;

const UI_HEALING_PROMPT = `
System Role: Senior SDET Expert (Self-Healing Mode).
Context: The previous test code FAILED at runtime. Fix it.

ERROR: [ERROR_MESSAGE]
FAILED CODE:
[FAILED_CODE]
DOM SNAPSHOT:
[CLEANED_DOM]

Task: Correct the locators/assertions. Output ONLY the improved .spec.ts code.
`;

// ─── 5. GUARDRAILS ───────────────────────────────────────────────────────────
function runUiGuardrails(code, pageConfig) {
    const reasons = [];
    if (/expect\(.*\)\.getAttribute/i.test(code)) reasons.push('G6: Use .toHaveAttribute()');
    if (/\.locator\(['"`]\/\//.test(code)) reasons.push('G1: No XPath');
    if (/\.nth\(\d+\)/.test(code)) reasons.push('G1: No .nth()');
    if (/test\.(locator|getByLabel|getByRole|getByText)/i.test(code)) reasons.push('G7: Locators must be called on "page", not "test"');
    if (!code.includes('expect(')) reasons.push('G4: Missing assertions');
    if (reasons.length > 0) throw new Error(`Guardrails failed:\n${reasons.join('\n')}`);
}

// ─── 6. TRIAL RUN UTILS ──────────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTrialTest(filePath) {
    console.log(`  🧪 Trial execution for ${path.basename(filePath)}...`);
    const configPath = path.resolve(__dirname, '../../playwright_template/playwright.config.ts');
    const cmd = `npx playwright test "${filePath}" --config="${configPath}" --project=chromium`;
    try {
        execSync(cmd, { stdio: 'pipe', env: { ...process.env, CI: 'true' } });
        console.log(`  ✅ Trial PASSED!`);
        return { success: true };
    } catch (err) {
        const log = err.stdout.toString() + err.stderr.toString();
        const msg = (log.match(/Error:([\s\S]*?)(?=\n\s*at)/i) || [null, log.substring(0, 300)])[1];
        console.warn(`  🩹 Trial FAILED: ${msg.trim().substring(0, 80)}...`);
        return { success: false, error: msg.trim() };
    }
}

// ─── 7. MAIN LOGIC ───────────────────────────────────────────────────────────
async function generateAllUiTests() {
    const genAI = new GoogleGenerativeAI(apiKey);
    const targetDir = path.resolve(__dirname, '../generated_test/tests/web');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const page of changedPages) {
        console.log(`\n📄 Page: ${page.name}`);
        const cleanedDom = await fetchAndCleanDOM(page.url);
        const prompt = UI_SYSTEM_PROMPT + `\nDOM:\n${cleanedDom}`;
        const userReq = `Test flows: ${page.businessFlows.join(', ')}\nFile: ${page.filename}`;

        let success = false;
        for (const modelName of MODELS_PRIORITY) {
            if (success) break;
            const model = genAI.getGenerativeModel({ model: modelName });

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    console.log(`  ✨ Generation (Attempt ${attempt})...`);
                    await delay(60000); // Increased for rate limit safety
                    const result = await model.generateContent([prompt, userReq]);
                    let code = result.response.text();
                    if (code.includes('```')) code = code.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/i)?.[1] || code;

                    runUiGuardrails(code, page);
                    const filePath = path.join(targetDir, page.filename);
                    fs.writeFileSync(filePath, code);

                    // SELF-HEALING
                    const trial = await runTrialTest(filePath);
                    if (!trial.success) {
                        console.log('  🩹 Healing...');
                        const healPrompt = UI_HEALING_PROMPT.replace('[ERROR_MESSAGE]', trial.error)
                                                           .replace('[FAILED_CODE]', code)
                                                           .replace('[CLEANED_DOM]', cleanedDom);
                        const healResult = await model.generateContent([healPrompt]);
                        let healedCode = healResult.response.text();
                        if (healedCode.includes('```')) healedCode = healedCode.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/i)?.[1] || healedCode;
                        
                        fs.writeFileSync(filePath, healedCode);
                        const finalTrial = await runTrialTest(filePath);
                        if (!finalTrial.success) throw new Error(`Healing failed: ${finalTrial.error}`);
                    }

                    success = true;
                    break;
                } catch (e) {
                    console.error(`  ❌ Failed: ${e.message.split('\n')[0]}`);
                }
            }
        }
    }
    fs.writeFileSync(uiCachePath, JSON.stringify(currentUiHashes, null, 2));
    console.log('✅ Done.');
}

generateAllUiTests().catch(e => console.error(e));
