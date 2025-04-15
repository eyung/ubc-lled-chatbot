require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Example website content - replace this with actual content from LLED website
const websiteContent = `
The Department of Language and Literacy Education (LLED) at UBC is committed to research and teaching in the areas of language, literacy, and literature in their broadest sense.

Our programs include:
- Bachelor of Education (BEd) with specialization in LLED
- Master of Education (MEd) in LLED
- Master of Arts (MA) in LLED
- Doctor of Philosophy (PhD) in LLED

We focus on:
- Applied linguistics and sociolinguistics
- Modern language education
- Literacy and multimodal literacies
- Literature and digital media
- Indigenous language education
`;

async function generateEmbeddings() {
    try {
        // Split content into chunks (simplified version)
        const chunks = websiteContent
            .split('\n\n')
            .filter(chunk => chunk.trim().length > 0);

        const embeddings = [];

        // Generate embeddings for each chunk
        for (const chunk of chunks) {
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: chunk.trim(),
            });

            embeddings.push({
                text: chunk.trim(),
                embedding: response.data[0].embedding
            });
        }

        // Ensure data directory exists
        const dataDir = path.join(__dirname, '../data');
        try {
            await fs.mkdir(dataDir);
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }

        // Save embeddings to file
        await fs.writeFile(
            path.join(dataDir, 'website_chunks.json'),
            JSON.stringify(embeddings, null, 2)
        );

        console.log(`Generated embeddings for ${embeddings.length} chunks`);
    } catch (error) {
        console.error('Error generating embeddings:', error);
    }
}

generateEmbeddings();