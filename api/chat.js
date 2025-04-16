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
        // In production, use the absolute path to the embeddings file
        const embeddingsPath = path.join(
            process.env.VERCEL_ENV ? '/var/task' : process.cwd(),
            'data/website_chunks.json'
        );
        console.log('Loading embeddings from:', embeddingsPath);
        const data = await fs.readFile(embeddingsPath, 'utf8');
        websiteChunks = JSON.parse(data);
        console.log(`Loaded ${websiteChunks.length} embeddings successfully`);
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
        .slice(0, topK);
}

// Format context with metadata
function formatContext(contextChunks) {
    return contextChunks.map(chunk => {
        const sourceInfo = chunk.metadata ? 
            `[Source: ${chunk.metadata.title || 'Untitled'} - ${chunk.metadata.url}]` : '';
        return `${chunk.text}\n${sourceInfo}`;
    }).join('\n\n');
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
        const relevantContextChunks = findRelevantContext(queryEmbedding);
        const formattedContext = formatContext(relevantContextChunks);

        // Generate chat completion
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant for the UBC LLED (Language and Literacy Education) department. 
                    Use the following context to help answer the user's question. Include relevant source links in your response when appropriate: 

                    ${formattedContext}`
                },
                { role: "user", content: message }
            ],
            max_tokens: 500,
            temperature: 0.5,
        });

        res.json({ 
            response: completion.choices[0].message.content,
            sources: relevantContextChunks.map(chunk => ({
                title: chunk.metadata?.title || 'Untitled',
                url: chunk.metadata?.url || '',
                similarity: chunk.similarity
            })),
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