require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { htmlToText } = require('html-to-text');

const baseUrl = 'https://lled.educ.ubc.ca';

async function testScraper() {
    try {
        console.log('Testing web scraping...');
        console.log(`Fetching ${baseUrl}...`);
        
        const response = await axios.get(baseUrl);
        const $ = cheerio.load(response.data);
        
        // Remove unwanted elements
        $('script, style, nav, header, footer, .sidebar, .menu, .comments, .advertisement').remove();
        
        // Get main content
        const mainContent = $('main, article, .content, .entry-content, .post-content').text();
        
        // Convert to readable text
        const text = htmlToText(mainContent, {
            wordwrap: null,
            preserveNewlines: true,
            selectors: [
                { selector: 'img', format: 'skip' },
                { selector: 'a', options: { ignoreHref: true } }
            ]
        });

        console.log('\nExtracted content sample:');
        console.log('------------------------');
        console.log(text.slice(0, 500) + '...');
        console.log('------------------------');
        console.log('\nTotal content length:', text.length, 'characters');
        
    } catch (error) {
        console.error('Error during test:', error.message);
    }
}

testScraper();