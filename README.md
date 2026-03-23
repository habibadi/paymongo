# AI-Driven SDET Test Generation Pipeline (V2) 🚀🛡️

This repository contains an enterprise-grade automated pipeline for **Programmatic LLM-Based Test Generation** and execution. It covers both **API (REST)** and **E2E (UI)** testing using Gemini AI, Playwright, and **Browser-Use AI Agents**.

---

## 🏛️ Architecture Overview
The system treats AI as a **pipeline component**, not just a manual helper. It follows a **"Detect → Navigate → Generate → Validate → Heal → Notify"** workflow:

1. **Change Detection**: Hashes `swagger.json` and `page.tsx` to only regenerate tests for changed endpoints/pages.
2. **Autonomous UI Exploration (Browser-Use)**: A Python-based AI agent drives a headless browser like a real user, recording every DOM state and interaction flow — no manual selectors required.
3. **Context Injection & Generation**: Injects clean Swagger snippets (API) or Agent Interaction Logs (UI) into Gemini to generate pure, robust Playwright `*.spec.ts` scripts.
4. **Static Guardrails**: 5-layer validation (Imports, Skeleton, Assertions, Integrity, ESLint) to reject malformed AI outputs before they ever run.
5. **Self-Healing Loop**: Runs a "Trial Run" with the generated code. If it fails, the error log + failing spec + fresh DOM are fed back to Gemini for automatic correction.
6. **CI Quality Gate**: Orchestrates a 4-container environment (`api` + `ui` + `test-generator` + `tester`) to block PRs with failing test generations.

---

## 🧠 LLM Prompt Design

### 1. API Prompt Strategy (Swagger-to-Test)
- **Schema-Aware**: Injects full Swagger `definitions` so the LLM understands complex `$ref` payload relationships.
- **Ajv Validation**: Mandates `ajv` for strict schema validation on all responses.
- **Business Logic Precision**: Explicitly distinguishes `400 Bad Request` (`amount: 0`) from `200 OK` Soft-Fail (business logic rejections).
- **Exact Message Assertions**: Enforces strict string checks on Server Error messages to eliminate AI hallucinations (e.g., simulated 500 errors).

### 2. UI/E2E Prompt Strategy (Browser-Use Agent + DOM-to-Flow)
- **Agentic Navigation**: The `browser-use` Python agent navigates the live frontend using `HEADLESS=true` and `ANONYMIZED_TELEMETRY=false`, compatible with any cloud CI runner without an X11 server.
- **Cleaned DOM Injection**: Strips noisy Tailwind/CSS classes, SVGs, and scripts — the LLM only sees structural DOM elements (`role`, `label`, `name`, `id`).
- **Anti-Fragile Hybrid Selectors**: Forbids `.nth()` and XPath. Mandates `getByRole` / `getByLabel`. Hybrid pattern: `page.getByRole().or(page.locator("X_PATH"))` uses agent JSON-extracted coordinates as fallback — making test immune to CSS/class refactors.
- **Exact Matching**: Enforces `{ exact: true }` for short sensitive fields like CVV and Expiry.

---

## 🩹 Handling AI Failure & Flakiness

### 1. Preventing Hallucinations
- **Guardrail G5 (UI)**: Detects if AI "invents" button labels (e.g., generic `/submit/i`) that don't exist in the provided DOM.
- **Guardrail G6 (Assertion)**: Rejects invalid assertion methods like `.getAttribute()` and enforces web-first alternatives like `.toHaveAttribute()`.

### 2. Self-Healing Workflow
If a generated test fails its **Trial Run**:
- The error log (e.g., `TimeoutError: waiting for locator...`) is captured.
- A **Healing Prompt** is built: `[Failed Code] + [Error Log] + [Fresh DOM]`.
- Gemini reconciles the error and outputs a pass-ready corrected version.

### 3. Preventing Flaky UI Tests
- **Web-First Assertions**: Uses `.toBeVisible()` instead of fragile `.locator().count() > 0`.
- **Label-First Strategy**: `page.tsx` includes `htmlFor` and `id` attribute links so the AI can always use `getByLabel` — significantly more stable than CSS selectors.
- **Safe Fallback Models**: If quota is hit, the generation script auto-cycles from `gemini-3-pro-preview` down to `gemini-3-flash-preview`.

---

## 📊 CI/CD Pipeline & Discord Notification

The unified pipeline (`.github/workflows/quality-gate.yml`) ensures no broken code reaches production:

1. **Secret Injection**: `GEMINI_API_KEY` and `DISCORD_WEBHOOK` are securely injected from Repository Secrets.
![Discord Notification](discord.png)
2. **Atomic Generation**: Runs `node scripts/generate-tests.js` (API) and `docker compose run --rm test-generator` (UI). If all retries and model fallbacks fail, the pipeline **HARD FAILS**.
3. **Docker Orchestration**: Spins up `api`, `ui`, `test-generator`, and `playwright-tester` containers.
4. **Artifacts**: Uploads full `playwright-report` as a GitHub Actions artifact on every run (retained 7 days).
5. **Discord Bot**: Sends a rich embed with Pass/Fail stats parsed from JUnit XML, plus `playwright-report.zip` attached directly to the message. Notifications are logically gated — if tests never started, it reports "Testing stage not reached or failed early" instead of a confusing empty report.

---

## 📈 Scaling to Many Endpoints
- **Intelligent Caching**: Uses `.cache/api_hashes.json` and `.cache/ui_hashes.json`. AI tokens are only spent on code that actually changed.
- **Parallel Generation**: Node.js (API) and Python (UI) generators can be extended to run simultaneously across multiple model families.

---

## 🔑 Secret Handling & Setup

### Local Execution (Docker Compose)
1. Create `application_code/.env`:
   ```bash
   GEMINI_API_KEY=your_key_here
   STAGING_BASE_URL=http://localhost:3000
   ```
2. Run the full orchestrator:
   ```bash
   cd application_code
   
   # 1. Start background services
   docker compose up -d api ui
   
   # 2. Run Browser-Use AI Agent (UI test generator)
   docker compose run --rm test-generator
   
   # 3. Run Playwright Quality Gate (API + UI)
   docker compose run --rm tester
   ```
3. Check `generated_test/` for generated `.spec.ts` files, interaction logs (`.md` / `.json`), and the full `playwright-report/` HTML.

### CI Execution (GitHub Actions)
- Add `GEMINI_API_KEY` and `DISCORD_WEBHOOK` to **GitHub Repository Secrets**.
- The `quality-gate.yml` workflow auto-triggers on any Push/PR to `main`.

---

## 🚀 Quick Repro Steps
```bash
# 1. Generate API Tests (detects Swagger changes, calls Gemini)
node scripts/generate-tests.js

# 2. Generate UI Tests (Browser-Use Agent navigates live UI)
docker compose run --rm test-generator

# 3. Run Quality Gate (Orchestrated Docker)
docker compose run --rm tester
```

---
*Developed by Antigravity AI SDET Suite.*
