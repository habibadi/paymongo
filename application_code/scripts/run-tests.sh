#!/bin/bash

# run-tests.sh
# This script runs inside the Docker container

echo "🚀 Setting up test environment..."

# 1. Sync Blueprint to generated_test folder
mkdir -p /test-runner/generated_test/tests
cp -r /test-runner/blueprint/config /test-runner/generated_test/
cp -r /test-runner/blueprint/utils /test-runner/generated_test/
cp /test-runner/blueprint/playwright.config.ts /test-runner/generated_test/
cp /test-runner/blueprint/package.json /test-runner/generated_test/

# 2. Create a dummy .env file so playwright.config.ts doesn't fail loading it
# Environment variables from docker-compose will still take precedence if configured correctly
touch /test-runner/generated_test/.env

# 3. Install dependencies
cd /test-runner/generated_test
npm install

# 3. Wait for services to be ready (Handling via docker-compose depends_on healthcheck is better, but here's a backup)
echo "⏳ Waiting for API and UI to be stable..."
sleep 5

# 4. Run Playwright Tests
echo "🎭 Running Playwright Tests..."
npx playwright test
