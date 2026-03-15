# AI-Driven SDET Test Generation Pipeline

This project demonstrates an automated pipeline for generating and executing API and E2E tests using AI (Gemini Pro) and Playwright.

## Project Structure

- `application_code/`: Main application (Go API & Next.js UI).
  - `scripts/`: AI Test Generator and execution scripts.
  - `generated_test/`: Output folder for AI-generated tests.
- `playwright_template/`: The "Blueprint" used by the AI to structure tests.
- `.github/workflows/`: CI/CD configuration for GitHub Actions.
- `docker-compose.yaml`: Orchestrates the entire environment.

## Quick Start (Local)

1. Start the services:
   ```bash
   docker-compose up --build
   ```

2. Generate and run tests:
   ```bash
   # Make sure GEMINI_API_KEY is in your environment
   node application_code/scripts/generate-tests.js
   docker-compose up tester
   ```

## CI/CD Pipeline

The pipeline is triggered on every push. It uses the `tester` service in Docker to ensure a clean, isolated environment for test execution.
