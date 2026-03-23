/**
 * AI-Powered UI/E2E Test Generator using BROWSER-USE (PROTOTYPE)
 * ==============================================================
 * Strategy: "Active Agent Exploration + Code Generation"
 *
 * How it works:
 *   1. BROWSER-USE: Creates a task for an AI agent to explore the live application.
 *   2. ACTION LOG: Extracts the verified steps, selectors, and outcomes from the agent.
 *   3. AI GENERATION: Injects the action log into Gemini to generate the test code.
 *   4. TRIAL RUN: Executes the generated test locally.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

try {
    require('@dotenvx/dotenvx').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
} catch (_) {}

console.log('🎭 Browser-Use E2E Test Generator (Prototype) starting...');

// ─── 1. CONFIGURATION ────────────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY;
const browserUseApiKey = process.env.BROWSER_USE_API_KEY; // Required for actual Cloud API

if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not set!');
    process.exit(1);
}
if (!browserUseApiKey) {
    console.error('⚠️ Warning: BROWSER_USE_API_KEY is not set! Using MOCK agent logs for demonstration.');
}

const STAGING_UI_URL = process.env.STAGING_BASE_URL || 'http://localhost:3000';

const UI_PAGES = [
    {
        name: 'checkout',
        url: '/',
        filename: 'checkout_flow_bu.spec.ts',
        businessFlows: [
            'Fill Payment Checkout Form with valid card (4111...)',
            'Submit and verify the success message appears'
        ]
    }
];

// ─── 2. BROWSER-USE API INTEGRATION ──────────────────────────────────────────
async function executeBrowserUseTask(pageUrl, flows) {
    console.log(`  🤖 Delegating task to browser-use agent for ${pageUrl}...`);
    
    // -------------------------------------------------------------------------
    // PROTOTYPE MOCK: SIMULATING THE RETURNED LOGS FROM A CLOUD AGENT
    // -------------------------------------------------------------------------
    if (!browserUseApiKey) {
        // Simulating Agent Execution Time
        await new Promise(r => setTimeout(r, 2000));
        console.log(`  ✅ Agent finished exploration.`);
        return `
[Action 1] Navigated to ${STAGING_UI_URL}${pageUrl}
[Action 2] Input "John Doe" into input field (Name on Card)
[Action 3] Input "4111 1111 1111 1111" into input field (Card Number)
[Action 4] Input "12/25" into input field (Expiry Date)
[Action 5] Input "123" into input field (CVV)
[Action 6] Clicked Button containing text "Pay Now"
[Action 7] Element containing text "Payment processed successfully" became visible.
[Status] Task completed successfully.
        `.trim();
    }

    // -------------------------------------------------------------------------
    // ACTUAL API CALL IMPLEMENTATION (Reference Example)
    // -------------------------------------------------------------------------
    console.log(`  🌐 Connecting to Browser-Use Cloud API...`);
    const instructions = `Go to ${STAGING_UI_URL}${pageUrl}. ${flows.join('. ')}`;
    
    try {
        // 1. Create Task
        /*
        const taskRes = await fetch('https://api.browser-use.com/v2/tasks', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${browserUseApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: instructions })
        });
        const taskData = await taskRes.json();
        const taskId = taskData.id;
        */

        // 2. Poll Status (Wait until 'done' or 'failed')
        /*
        let status = 'processing';
        while (status === 'processing' || status === 'queued') {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await fetch(`https://api.browser-use.com/v2/tasks/${taskId}/status`, ...);
            status = (await statusRes.json()).status;
        }
        */

        // 3. Fetch History/Logs
        /*
        const logsRes = await fetch(`https://api.browser-use.com/v2/tasks/${taskId}/logs`, ...);
        const actionLogs = await logsRes.text();
        return actionLogs;
        */
       return "Cloud API execution not fully wired in prototype.";
    } catch (err) {
        console.error("  ❌ Browser-Use API Error:", err);
        return "";
    }
}

// ─── 3. AI PROMPTS ───────────────────────────────────────────────────────────
const UI_SYSTEM_PROMPT = `
System Role: Senior SDET Expert.
Task: Generate high-stability Playwright .spec.ts code based on verified Agent Action Logs.

RULES:
1. Translate the Action Logs directly into Playwright locators: page.getByRole, page.getByLabel, page.getByText, page.getByPlaceholder.
2. The Action Logs represent exactly what the Agent did to succeed. Follow the exact same sequence.
3. NEVER use test.locator() or test.getByLabel(). All locators MUST be called on the 'page' object.
4. Use Web-First Assertions: \`expect(page.getByText(...)).toBeVisible()\`.
5. Navigation: use \`await page.goto('/')\` as specified in Action 1.
6. Do not include global definitions, define selectors inside tests.
`;

// ─── 4. TRIAL RUN ────────────────────────────────────────────────────────────
async function runTrialTest(filePath) {
    console.log(`  🧪 Trial execution for ${path.basename(filePath)}...`);
    const configPath = path.resolve(__dirname, '../../playwright_template/playwright.config.ts');
    // Using --project=chromium to make trial runs faster
    const cmd = `npx playwright test "${filePath}" --config="${configPath}" --project=chromium`;
    try {
        execSync(cmd, { stdio: 'pipe', env: { ...process.env, CI: 'true' } });
        console.log(`  ✅ Trial PASSED!`);
        return true;
    } catch (err) {
        console.warn(`  🩹 Trial FAILED. Error executing test.`);
        return false;
    }
}

// ─── 5. MAIN LOGIC ───────────────────────────────────────────────────────────
async function generateBrowserUseTests() {
    const genAI = new GoogleGenerativeAI(apiKey);
    const targetDir = path.resolve(__dirname, '../generated_test/tests/web');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const page of UI_PAGES) {
        console.log(`\n📄 Starting Page Flow: ${page.name}`);
        
        // Step 1: Get Verified Flow from Browser-Use
        const actionLogs = await executeBrowserUseTask(page.url, page.businessFlows);
        
        // Step 2: Use Gemini to convert Action Logs -> Playwright Spec
        const prompt = UI_SYSTEM_PROMPT + `\nVERIFIED ACTION LOGS:\n${actionLogs}`;
        const userReq = `Generate the Playwright script for file: ${page.filename}`;

        // Assuming gemini-3-flash-preview is fast and good enough for translation
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        try {
            console.log(`  ✨ Generating Playwright Code from Logs...`);
            const result = await model.generateContent([prompt, userReq]);
            let code = result.response.text();
            
            // Extract code from markdown block
            if (code.includes('```')) {
                code = code.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/i)?.[1] || code;
            }

            const filePath = path.join(targetDir, page.filename);
            fs.writeFileSync(filePath, code);
            console.log(`  ✅ Script generated at ${filePath}`);

            // Step 3: Run trial
            await runTrialTest(filePath);
            
        } catch (e) {
            console.error(`  ❌ Failed: ${e.message}`);
        }
    }
}

generateBrowserUseTests();
