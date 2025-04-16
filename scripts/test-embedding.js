const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

async function testSinglePage() {
    try {
        // Read and validate API key
        const envPath = path.resolve(__dirname, '../.env');
        const envContent = fs.readFileSync(envPath, 'utf8')
            .toString() // Ensure string conversion
            .replace(/^\uFEFF/, ''); // Remove BOM if present
        
        // Extract API key, handling possible formats
        let apiKey = '';
        const match = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
        if (match) {
            apiKey = match[1].trim();
        } else {
            apiKey = envContent.trim(); // Assume content is just the key
        }

        // Detailed validation
        console.log('\nAPI Key validation:');
        console.log('- Raw content length:', envContent.length);
        console.log('- Extracted key length:', apiKey.length);
            model: "text-embedding-ada-002",
            input: "Hello, this is a test."
        });

        console.log('Success! Generated embedding vector length:', testResponse.data[0].embedding.length);

        // Save test result
        const dataDir = path.join(__dirname, '../data');
        await fs.promises.mkdir(dataDir, { recursive: true });
        
        await fs.promises.writeFile(
            path.join(dataDir, 'test_embedding.json'),
            JSON.stringify({
                text: "Hello, this is a test.",
                embedding: testResponse.data[0].embedding
            }, null, 2)
        );

        console.log('\nTest successful! Results saved to data/test_embedding.json');

    } catch (error) {
        console.error('\nError occurred:');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testSinglePage().catch(console.error);