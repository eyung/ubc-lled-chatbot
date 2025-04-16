require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { htmlToText } = require('html-to-text');
const SiteMapper = require('sitemapper');
const puppeteer = require('puppeteer');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const baseUrl = 'https://lled.educ.ubc.ca';
const sitemap = new SiteMapper();
const visited = new Set();
const MAX_PAGES = 100; // Limit number of pages to process
const CHUNK_SIZE = 500; // Approx chars per chunk

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
                    if (url.includes(baseUrl)) {
                        urls.add(url);
                    }
                });
                if (urls.size > 0) break;
            } catch (error) {
                console.log(`No sitemap found at ${sitemapUrl}`);
            }
        }

        // Fallback to recursive crawling if no sitemap
        if (urls.size === 0) {
            console.log('No sitemap found, starting from homepage...');
            urls.add(baseUrl);
            
            // Get links from homepage
            const response = await axios.get(baseUrl);
            const $ = cheerio.load(response.data);
            $('a').each((i, link) => {
                const href = $(link).attr('href');
                if (href && href.startsWith(baseUrl)) {
                    urls.add(href);
                }
            });
        }

        console.log(`Found ${urls.size} URLs to process`);
        const allContent = [];
        let processed = 0;

        for (const url of urls) {
            if (processed >= MAX_PAGES) break;
            if (visited.has(url)) continue;

            console.log(`Processing ${url} (${processed + 1}/${Math.min(urls.size, MAX_PAGES)})...`);
            const content = await extractContent(url);
            visited.add(url);
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

// Main function to generate embeddings
async function generateEmbeddings() {
    try {
        console.log('Starting website crawl...');
        const contentChunks = await crawlWebsite();
        console.log(`Found ${contentChunks.length} content chunks from ${visited.size} pages`);

        const embeddings = [];

        // Generate embeddings for each chunk
        for (const [index, chunk] of contentChunks.entries()) {
            console.log(`Generating embedding for chunk ${index + 1}/${contentChunks.length}...`);
            
            try {
                const response = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: chunk.text,
                });

                embeddings.push({
                    ...chunk,
                    embedding: response.data[0].embedding
                });
            } catch (error) {
                console.error(`Error generating embedding for chunk ${index + 1}:`, error.message);
            }

            // Add a small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
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

        console.log(`Generated and saved embeddings for ${embeddings.length} chunks`);
    } catch (error) {
        console.error('Error in embedding generation:', error);
    }
}

// Run the script
generateEmbeddings().catch(console.error);