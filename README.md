# AI-Driven SDET Test Generation Pipeline

This project demonstrates an automated pipeline for generating and executing API and E2E tests using AI (Gemini Pro) and Playwright.

## Project Structure

- `application_code/`: Main application (Go API & Next.js UI).
  - `scripts/`: AI Test Generator and execution scripts.
  - `generated_test/`: Output folder for AI-generated tests.
- `playwright_template/`: The "Blueprint" used by the AI to structure tests.
- `.github/workflows/`: CI/CD configuration for GitHub Actions.
- `docker-compose.yaml`: Orchestrates the entire environment.

## Secret Handling & Environment Variables

This project follows security best practices for handling sensitive API keys (Gemini API):

### 1. Local Development
- **File**: Environment variables are managed via a `.env` file in the root directory.
- **Git Safety**: `.env` is listed in `.gitignore` to prevent accidental commits of secrets.
- **Injection**: To run the AI generator locally:
  1. Create a `.env` file: `echo GEMINI_API_KEY=your_key_here > .env`
  2. The scripts and Playwright config will automatically load this key using the `dotenv` package.

### 2. CI/CD (GitHub Actions)
- **Injection**: The key is injected via **GitHub Repository Secrets**.
- **Setup**: 
  - Go to `Settings > Secrets and variables > Actions`.
  - Add a secret named `GEMINI_API_KEY`.
- **Workflow**: The `ai-test-gen.yml` workflow maps this secret to the `GEMINI_API_KEY` environment variable during the "Run AI Test Generator" and "Build and Run Tests" steps.

### 3. Execution Logic
- All scripts (like `generate-tests.js`) check for the existence of `process.env.GEMINI_API_KEY`.
- If the key is missing, the process will fail with a clear error message, preventing unauthorized or unconfigured runs.

## Quick Start (Local)

1. **Prerequisites**: Ensure Docker and Node.js are installed.
2. **Setup Env**: Create a `.env` file with your `GEMINI_API_KEY`.
3. **Run Pipeline**:
   ```bash
   node application_code/scripts/generate-tests.js
   docker-compose up --build --exit-code-from tester
   ```

## CI/CD Pipeline Status

The pipeline automatically:
1. Generates tests (Mocked).
2. Orchestrates API and UI services.
3. Runs Playwright tests against the isolated environment.
4. **Discord Notifications**: Reports success/failure and attaches test artifacts to Discord.
