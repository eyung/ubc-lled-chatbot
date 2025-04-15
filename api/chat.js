require('dotenv').config();
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const cosineSimilarity = require('cosine-similarity');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Rate limiting
const rateLimit = {};
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Load embeddings
let websiteChunks = [];
async function loadEmbeddings() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/website_chunks.json'), 'utf8');
        websiteChunks = JSON.parse(data);
    } catch (error) {
        console.error('Error loading embeddings:', error);
        websiteChunks = [];
    }
}
loadEmbeddings();

// Find relevant context using cosine similarity
function findRelevantContext(queryEmbedding, topK = 3) {
    return websiteChunks
        .map(chunk => ({
            ...chunk,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(chunk => chunk.text)
        .join('\n');
}

// Rate limit middleware
function checkRateLimit(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    
    if (!rateLimit[ip]) {
        rateLimit[ip] = {
            count: 1,
            firstRequest: now
        };
        return next();
    }

    if (now - rateLimit[ip].firstRequest > RATE_WINDOW) {
        rateLimit[ip] = {
            count: 1,
            firstRequest: now
        };
        return next();
    }

    if (rateLimit[ip].count >= RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    rateLimit[ip].count++;
    next();
}

// Chat endpoint
router.post('/chat', checkRateLimit, async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get embedding for the user's query
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: message,
        });
        
        const queryEmbedding = embeddingResponse.data[0].embedding;
        const relevantContext = findRelevantContext(queryEmbedding);

        // Generate chat completion
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant for the UBC LLED (Language and Literacy Education) department. 
                    Use the following context to help answer the user's question: ${relevantContext}`
                },
                { role: "user", content: message }
            ],
            max_tokens: 500,
            temperature: 0.5,
        });

        res.json({ 
            response: completion.choices[0].message.content,
            usage: completion.usage
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing your request',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;