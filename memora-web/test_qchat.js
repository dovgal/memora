const jwt = require('jsonwebtoken');
const fs = require('fs');

const SECRET = 'super-secret-jwt-key';
const LOG_FILE = 'qchat_log.txt';

function log(msg) {
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

async function main() {
    fs.writeFileSync(LOG_FILE, ''); // Clear log

    // 1. Generate mocking JWT
    const token = jwt.sign(
        { sub: "11111111-1111-1111-1111-111111111111", role: 'student', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
        SECRET
    );

    log("Creating new set for testing...");
    // 2. Create Set via API
    const createRes = await fetch('http://localhost:8000/api/sets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: "Planetary Science",
            description: "Test Set",
            isPublic: true,
            flashcards: [
                { term: "Mars", definition: "The red planet." },
                { term: "Earth", definition: "Our home planet." }
            ]
        })
    });

    if (!createRes.ok) {
        log("Failed to create set: " + await createRes.text());
        return;
    }

    const setData = await createRes.json();
    const setId = setData.id;
    log(`Created Set ID: ${setId}`);

    // 3. Test Context Injection
    log("\n--- Testing Context Injection (Valid Question) ---");
    await hitEndpoint(setId, token, "What color is Mars?");

    // 4. Test Guardrails
    log("\n--- Testing Guardrails (Off-topic Question) ---");
    await hitEndpoint(setId, token, "Write a python script to reverse a list.");
}

async function hitEndpoint(setId, token, prompt) {
    const payload = {
        messages: [
            { role: "user", content: prompt }
        ]
    };

    console.log(`Prompt: "${prompt}"`);
    process.stdout.write("Response: ");

    try {
        const response = await fetch(`http://localhost:8000/api/ai/qchat/${setId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        console.log(); // newline
                        return;
                    }
                    if (data !== 'keep-alive') {
                        process.stdout.write(data);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

main().catch(console.error);
