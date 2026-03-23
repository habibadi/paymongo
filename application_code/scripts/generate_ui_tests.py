import asyncio
import os
import re
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use import Agent, Browser

# Load environment variables (mostly for GEMINI_API_KEY)
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# --- MONKEYPATCH browser-use v0.12.2 serializer bug ---
from browser_use.llm.google.serializer import GoogleMessageSerializer
from browser_use.llm.messages import UserMessage, BaseMessage
original_serialize = GoogleMessageSerializer.serialize_messages

def patched_serialize(messages: list[BaseMessage], **kwargs):
    processed = []
    for m in messages:
        if isinstance(m, str):
            processed.append(UserMessage(content=m))
        else:
            processed.append(m)
    return original_serialize(processed, **kwargs)

GoogleMessageSerializer.serialize_messages = patched_serialize
# -----------------------------------------------------

async def main():
    print('🎭 Browser-Use Open Source E2E Test Generator starting...')

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY is not set!")
        return
        
    staging_url = os.getenv("STAGING_BASE_URL", "http://localhost:3000")
    # For CI environments running inside Docker, this should be True.
    is_headless = os.getenv("HEADLESS", "false").lower() == "true"
    
    # Disable telemetry to bypass internal v0.12.2 bug
    os.environ["ANONYMIZED_TELEMETRY"] = "false"
    
    # Configure headless via environment variable for browser_use <= 0.1.20
    if is_headless:
        os.environ["BROWSER_USE_HEADLESS"] = "true"
    else:
        os.environ["BROWSER_USE_HEADLESS"] = "false"
    
    # Initialize the LLM specifically for Browser-Use
    # Using the official browser-use ChatGoogle wrapper
    from browser_use import ChatGoogle
    llm = ChatGoogle(model="gemini-3-flash-preview", api_key=api_key)
    
    # Standard Langchain LLM for code generation
    codegen_llm = ChatGoogleGenerativeAI(model="gemini-3-flash-preview", google_api_key=api_key)
    
    # Configure the browser
    # Explicitly pass headless=True/False if we want to see the progress.
    browser = Browser(headless=is_headless)
    
    tasks_to_generate = [
        {
            "name": "checkout",
            "url": "/",
            "filename": "checkout_flow_bu.spec.ts",
            "instruction": f"Go to {staging_url}/. Fill Payment Checkout Form with valid card (e.g. 4111 1111 1111 1111). Submit and verify the payment success message appears. Finally, output a highly detailed, step-by-step chronological log of exactly what inputs you typed and buttons you clicked to succeed."
        }
    ]
    
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../generated_test/tests/web'))
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for task_info in tasks_to_generate:
        print(f"\n📄 Starting Browser-Use Agent for: {task_info['name']}")
        
        # Step 1: Let the Open Source Agent explore and solve the UI
        print(f"  🤖 Agent navigating to {staging_url}{task_info['url']}...")
        agent = Agent(task=task_info['instruction'], llm=llm, browser=browser)
        history = await agent.run()
        
        # Extract the detailed textual summary the agent outputted
        action_logs = history.final_result()
        if not action_logs:
            # Fallback to dumping the raw step-by-step history 
            action_logs = str(history.model_dump_json())
            
        print(f"  ✅ Agent finished exploration. Action Logs captured.")

        # Extract DOM element paths (XPath, selectors) used during the action
        # This acts as a backup/fallback locator strategy
        interacted_elements = []
        try:
            import json
            history_data = json.loads(history.model_dump_json())
            
            # Navigate the history tree to find interacted elements
            # Browser-Use history usually contains 'history' list -> 'state' -> 'interacted_element'
            for step in history_data.get('history', []):
                state = step.get('state', {})
                interacted = state.get('interacted_element', None)
                if interacted:
                    interacted_elements.append(interacted)
                    
            # Save the backup elements to JSON
            elements_path = os.path.join(output_dir, task_info['filename'].replace('.spec.ts', '_elements.json'))
            with open(elements_path, 'w', encoding='utf-8') as f:
                json.dump(interacted_elements, f, indent=2)
            print(f"  💾 Backup Locators (XPath/DOM) saved at {elements_path}")
        except Exception as e:
            print(f"  ⚠️ Could not extract backup locators: {e}")

        # Step 2: Use LLM to convert Verified Action Logs -> Playwright Spec
        system_prompt = """
System Role: Senior SDET Expert.
Task: Generate high-stability Playwright .spec.ts code based on verified Agent Action Logs.

RULES:
1. Translate the Action Logs directly into Playwright locators: page.getByRole, page.getByLabel.
2. For EVERY locator you generate, you MUST add a fallback using the provided Backup Locators JSON (match by text or action order).
3. Use the `.or(page.locator("XPATH_HERE"))` syntax for fallbacks.
   Example: `await page.getByRole('button', { name: 'Submit' }).or(page.locator('xpath=//button[@id="sub"]')).click();`
4. NEVER use test.locator() or test.getByLabel(). All locators MUST be called on the 'page' object.
5. Use Web-First Assertions: `expect(page.getByText(...)).toBeVisible()`.
6. Navigation: use `await page.goto('/')`.
7. Output ONLY the code inside ```typescript...``` block.
        """
        
        prompt = f"{system_prompt}\n\nVERIFIED ACTION LOGS:\n{action_logs}\n\nBACKUP LOCATORS (JSON):\n{json.dumps(interacted_elements, indent=2)}\n\nGenerate the Playwright script for file: {task_info['filename']}"
        
        print(f"  ✨ Generating Playwright Code from Logs with Healing/Fallback rules...")
        response = codegen_llm.invoke(prompt)
        code = response.content
        
        # Handle list-type responses (Gemini 3 models return blocks of content)
        if isinstance(code, list):
            code = ''.join([str(p.get('text', '')) if isinstance(p, dict) else str(p) for p in code])
        elif not isinstance(code, str):
            code = str(code)
            
        # Output Parsing
        match = re.search(r'```(?:typescript|ts)?\n([\s\S]*?)\n```', code, re.IGNORECASE)
        if match:
            code = match.group(1)
            
        file_path = os.path.join(output_dir, task_info['filename'])
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code.strip())
            
        # Save the detailed Action Log for the user to read
        log_path = os.path.join(output_dir, task_info['filename'].replace('.spec.ts', '_log.md'))
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(action_logs)
            
        print(f"  ✅ Script generated at {file_path}")
        print(f"  📖 Action Log saved at {log_path}")
        
    # Free resources (browser handles its own cleanup in 0.12.2)
    print("\n🎉 AI Test Generation Complete.")

if __name__ == "__main__":
    asyncio.run(main())
