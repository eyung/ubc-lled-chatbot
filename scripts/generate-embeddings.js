const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { htmlToText } = require('html-to-text');
const SiteMapper = require('sitemapper');
const puppeteer = require('puppeteer');

// Read API key directly from .env file
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKey = envContent.trim().split('=')[1];

console.log('API Key loaded:', apiKey ? 'Yes' : 'No');

const openai = new OpenAI({
    apiKey: apiKey,
    timeout: 30000, // 30 second timeout
    maxRetries: 3
});

const baseUrl = 'https://lled.educ.ubc.ca';
const sitemap = new SiteMapper();
const visited = new Set();
const MAX_PAGES = 100; // Limit number of pages to process
const CHUNK_SIZE = 500; // Approx chars per chunk

// Retry function with exponential backoff
async function withRetry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
            console.log(`Error details: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// Function to clean and chunk text
function chunkText(text, metadata) {
    // Clean the text
    const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

    // Split into sentences (rough approximation)
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > CHUNK_SIZE) {
            if (currentChunk) {
                chunks.push({
                    text: currentChunk.trim(),
                    ...metadata
                });
            }
            currentChunk = sentence;
        } else {
            currentChunk += ' ' + sentence;
        }
    }
    
    if (currentChunk) {
        chunks.push({
            text: currentChunk.trim(),
            ...metadata
        });
    }
    return chunks;
}

// Function to extract text content from a webpage
async function extractContent(url) {
    try {
        // Launch browser for JavaScript-rendered content
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Set viewport and timeout
        await page.setViewport({ width: 1280, height: 800 });
        await page.setDefaultNavigationTimeout(30000);

        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Extract metadata
        const title = await page.title();
        const h1 = await page.$eval('h1', el => el.textContent).catch(() => '');

        // Get the main content
        const content = await page.evaluate(() => {
            // Remove unwanted elements
            document.querySelectorAll('nav, header, footer, .sidebar, .menu, .comments, .advertisement, script, style').forEach(el => el.remove());
            
            // Prioritize main content areas
            const mainContent = document.querySelector('main, article, .content, .entry-content, .post-content');
            return mainContent ? mainContent.textContent : document.body.textContent;
        });

        await browser.close();

        // Convert HTML to readable text
        const text = htmlToText(content, {
            wordwrap: null,
            preserveNewlines: true,
            selectors: [
                { selector: 'img', format: 'skip' },
                { selector: 'a', options: { ignoreHref: true } }
            ]
        });

        return {
            content: text,
            metadata: {
                url,
                title,
                heading: h1
            }
        };
    } catch (error) {
        console.error(`Error extracting content from ${url}:`, error.message);
        return null;
    }
}

// Function to check if a URL is a WordPress page (not a post)
function isWordPressPage(url) {
    // Only include URLs that match these specific page patterns
    const pagePatterns = [
        /\/programs\/[^\/]+\/?$/,  // Program pages
        /\/courses\/?$/,  // Main courses page
        /\/students\/[^\/]+\/?$/,  // Student pages
        /\/faculty\/[^\/]+\/?$/,  // Faculty pages
        /\/research\/[^\/]+\/?$/,  // Research pages
        /\/about\/[^\/]+\/?$/,  // About pages
        /\/resources\/[^\/]+\/?$/,  // Resource pages
        /\/funding-awards\/?$/,  // Funding page
        /\/graduate\/?$/,  // Graduate programs
        /\/undergraduate\/?$/,  // Undergraduate programs
        /\/admissions\/?$/,  // Admissions info
        /\/contact\/?$/  // Contact page
    ];

    // If URL exactly matches any page patterns, include it
    return pagePatterns.some(pattern => pattern.test(url));
}

// Function to discover and crawl pages
async function crawlWebsite() {
    try {
        console.log('Fetching sitemap...');
        // Try to get sitemap from common locations
        const sitemapUrls = [
            `${baseUrl}/sitemap.xml`,
            `${baseUrl}/sitemap_index.xml`,
            `${baseUrl}/wp-sitemap.xml`
        ];

        let urls = new Set();
        for (const sitemapUrl of sitemapUrls) {
            try {
                const { sites } = await sitemap.fetch(sitemapUrl);
                sites.forEach(url => {
                    if (url.includes(baseUrl) && isWordPressPage(url)) {
                        urls.add(url);
                    }
                });
                if (urls.size > 0) {
                    console.log(`Found ${urls.size} WordPress pages in sitemap`);
                    break;
                }
            } catch (error) {
                console.log(`No sitemap found at ${sitemapUrl}`);
            }
        }

        // Fallback to recursive crawling if no sitemap
        if (urls.size === 0) {
            console.log('No sitemap found, starting recursive crawl from homepage...');
            urls.add(baseUrl);
            
            // Function to recursively discover pages
            async function crawlPage(url) {
                if (visited.has(url)) return;
                visited.add(url);
                
                try {
                    console.log(`Discovering links on ${url}...`);
                    const response = await axios.get(url);
                    const $ = cheerio.load(response.data);
                    
                    // Focus on navigation menus and content areas
                    const menuSelectors = [
                        '#primary-menu', // Main navigation
                        '.nav-menu',
                        '.menu',
                        '#main-nav',
                        '.main-navigation',
                        '#navigation'
                    ];
                    
                    const linkSelectors = menuSelectors.map(s => `${s} a`).join(',') + ',article a,.entry-content a';
                    
                    $(linkSelectors).each((i, link) => {
                        const href = $(link).attr('href');
                        if (href && href.startsWith(baseUrl) && isWordPressPage(href)) {
                            urls.add(href);
                            // Recursively crawl if under limit
                            if (urls.size < MAX_PAGES) {
                                crawlPage(href);
                            }
                        }
                    });
                } catch (error) {
                    console.error(`Error crawling ${url}:`, error.message);
                }
            }
            
            await crawlPage(baseUrl);
        }

        // Process discovered pages
        console.log(`Found ${urls.size} WordPress pages to process`);
        const allContent = [];
        let processed = 0;

        for (const url of urls) {
            if (processed >= MAX_PAGES) break;

            console.log(`Processing ${url} (${processed + 1}/${Math.min(urls.size, MAX_PAGES)})...`);
            const content = await extractContent(url);
            processed++;

            if (content && content.content.trim()) {
                const chunks = chunkText(content.content, content.metadata);
                allContent.push(...chunks);
            }

            // Add a small delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return allContent;
    } catch (error) {
        console.error('Error crawling website:', error);
        return [];
    }
}

// Test OpenAI API connection
async function testApiConnection() {
    try {
        console.log('Testing OpenAI API connection...');
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: "test",
        });
        console.log('OpenAI API connection successful!');
        return true;
    } catch (error) {
        console.error('OpenAI API connection test failed:', error.message);
        if (error.message.includes('401')) {
            console.error('This appears to be an authentication error. Please check your API key.');
        } else if (error.message.includes('429')) {
            console.error('Rate limit exceeded. Please try again later.');
        }
        return false;
    }
}

// Main function to generate embeddings
async function generateEmbeddings() {
    // Test API connection first
    const apiTest = await testApiConnection();
    if (!apiTest) {
        console.error('Aborting due to API connection test failure');
        process.exit(1);
    }

    const dataDir = path.join(__dirname, '../data');
    const outputPath = path.join(dataDir, 'website_chunks.json');
    let embeddings = [];
    
    try {
        // Create data directory
        await fs.promises.mkdir(dataDir, { recursive: true });
        console.log('Data directory ready at:', dataDir);

        // Load existing embeddings if any
        try {
            const existing = await fs.promises.readFile(outputPath, 'utf8');
            embeddings = JSON.parse(existing);
            console.log(`Loaded ${embeddings.length} existing embeddings`);
        } catch (error) {
            console.log('No existing embeddings found, starting fresh');
        }

        console.log('Starting website crawl...');
        const contentChunks = await crawlWebsite();
        console.log(`Found ${contentChunks.length} content chunks from ${visited.size} pages`);

        // Clear any failed embeddings from previous runs
        embeddings = embeddings.filter(e => e.embedding !== null && !e.error);
        console.log(`Filtered out failed embeddings, ${embeddings.length} successful embeddings remain`);

        // Track only successfully processed URLs
        const processedUrls = new Set(
            embeddings.map(e => e.metadata?.url || e.url)
        );

        // Generate embeddings for each chunk
        for (const [index, chunk] of contentChunks.entries()) {
            const chunkUrl = chunk.metadata?.url || chunk.url;
            
            if (processedUrls.has(chunkUrl)) {
                console.log(`Skipping chunk ${index + 1} - already has successful embedding`);
                continue;
            }

            console.log(`Processing chunk ${index + 1}/${contentChunks.length}...`);
            console.log(`URL: ${chunkUrl}`);
            console.log(`Content preview: ${chunk.text.slice(0, 100)}...`);

            try {
                const embedding = await withRetry(async () => {
                    const response = await openai.embeddings.create({
                        model: "text-embedding-ada-002",
                        input: chunk.text,
                    });
                    return response.data[0].embedding;
                });

                // Add successful embedding
                embeddings.push({
                    text: chunk.text,
                    url: chunkUrl,
                    title: chunk.metadata?.title || chunk.title,
                    heading: chunk.metadata?.heading || chunk.heading,
                    embedding
                });
                processedUrls.add(chunkUrl); // Track this URL as successfully processed

                // Save progress every 5 chunks
                if (embeddings.length % 5 === 0) {
                    await fs.promises.writeFile(
                        outputPath,
                        JSON.stringify(embeddings, null, 2)
                    );
                    console.log(`Progress saved: ${embeddings.length} embeddings`);
                }
            } catch (error) {
                console.error('Failed to generate embedding after all retries:', error);
                // Save the chunk without embedding for later retry
                embeddings.push({
                    ...chunk,
                    embedding: null,
                    error: error.message
                });
                await fs.promises.writeFile(
                    outputPath,
                    JSON.stringify(embeddings, null, 2)
                );
                console.log('Saved failed chunk for later retry');
            }

            // Delay between chunks to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Final save
        await fs.promises.writeFile(
            outputPath,
            JSON.stringify(embeddings, null, 2)
        );

        const successfulEmbeddings = embeddings.filter(e => e.embedding !== null);
        const failedEmbeddings = embeddings.filter(e => e.embedding === null);

        console.log(`
Embedding generation complete:
- Total chunks processed: ${embeddings.length}
- Successful embeddings: ${successfulEmbeddings.length}
- Failed embeddings: ${failedEmbeddings.length}
- Output saved to: ${outputPath}
        `);

        if (failedEmbeddings.length > 0) {
            console.log('Failed chunks can be retried later');
        }

    } catch (error) {
        console.error('Fatal error in embedding generation:', error);
        // Save whatever progress we have
        if (embeddings.length > 0) {
            await fs.promises.writeFile(
                outputPath,
                JSON.stringify(embeddings, null, 2)
            );
            console.log(`Saved ${embeddings.length} embeddings before error`);
        }
        throw error;
    }
}

// Run the script
generateEmbeddings().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});