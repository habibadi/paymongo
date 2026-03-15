const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
    try {
        const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy to get the object
        console.log("Checking models...");
        // There is no listModels on the genAI object directly in some versions, 
        // but it is usually available via the client.
        // Let's just try to test a a few common names.
        const testModels = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
        for (const m of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                await model.generateContent("test");
                console.log(`✅ ${m} is available`);
            } catch (e) {
                console.log(`❌ ${m} error: ${e.message}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
list();
