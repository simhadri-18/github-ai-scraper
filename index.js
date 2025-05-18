const express = require('express');
const { scrapeGithubUsers } = require('./githubScraper');
const { summarizeProfileWithRetry } = require('./openaiClient');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Add middleware to parse JSON
app.use(express.json());

// Store the results in memory
let cachedResults = {};

// Helper function to check if OpenAI API key is set
function checkApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not set in environment variables. AI summarization will fail.');
    return false;
  }
  return true;
}

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    apiKeyConfigured: checkApiKey()
  });
});

// Main scraping endpoint
app.get('/scrape', async (req, res) => {
  console.log('Received scrape request');
  const startTime = Date.now();
  
  try {
    // Get parameters from query string with defaults
    const keyword = req.query.q || 'javascript developer';
    const pages = Math.min(parseInt(req.query.pages || 2), 5); // Limit to max 5 pages
    const cacheKey = `${keyword}-${pages}`;
    
    // Check if we have cached results
    if (cachedResults[cacheKey] && req.query.refresh !== 'true') {
      console.log(`Returning cached results for "${keyword}"`);
      return res.json(cachedResults[cacheKey]);
    }
    
    console.log(`Starting scrape for "${keyword}" across ${pages} pages`);
    
    // Scrape GitHub users
    const users = await scrapeGithubUsers(keyword, pages);
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      return res.status(404).json({ 
        error: 'No users found',
        keyword,
        pages
      });
    }
    
    const results = [];
    const hasApiKey = checkApiKey();
    
    // Process each user - with or without AI summarization
    for (const [index, user] of users.entries()) {
      console.log(`Processing user ${index + 1}/${users.length}: ${user.username}`);
      
      let summary = 'API key not configured';
      if (hasApiKey) {
        summary = await summarizeProfileWithRetry(user);
      }
      
      results.push({ ...user, summary });
    }
    
    // Cache the results
    cachedResults[cacheKey] = results;
    
    // Calculate execution time
    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`Request completed in ${executionTime} seconds`);
    
    // Return results
    res.json(results);
    
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).json({ 
      error: 'Something went wrong',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🔍 Try the scraper at: http://localhost:${PORT}/scrape?q=javascript%20developer`);
  console.log(`💡 Health check: http://localhost:${PORT}/health`);
  checkApiKey();
});