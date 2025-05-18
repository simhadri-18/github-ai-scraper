const { OpenAI } = require('openai');
require('dotenv').config();

let openai;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('⚠️ OPENAI_API_KEY not found in environment variables');
  }
  
  openai = new OpenAI({
    apiKey: apiKey
  });
} catch (err) {
  console.error(`Error initializing OpenAI client: ${err.message}`);
}

async function summarizeProfile(profile) {
  if (!openai) {
    return "Error: OpenAI client not initialized. Check your API key.";
  }
  
  const prompt = `
  GitHub Profile Summary:
  Username: ${profile.username}
  Name: ${profile.displayName}
  Bio: ${profile.bio}
  Location: ${profile.location}
  Profile URL: ${profile.profileUrl}

  Based on this information, summarize the user's main skills, tech stack, and notable contributions.
  If the information is limited, make educated guesses based on what's available.
  Format your response in a concise paragraph.
  `;

  try {
    console.log(`Requesting AI summary for user: ${profile.username}`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    console.log(`Received AI summary for user: ${profile.username}`);
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error(`OpenAI API error for ${profile.username}: ${err.message}`);
    
    // Handle common OpenAI errors
    if (err.message.includes('API key')) {
      return "Error: Invalid or missing OpenAI API key. Check your environment variables.";
    } else if (err.message.includes('rate limit')) {
      return "Error: OpenAI rate limit reached. Try again later.";
    }
    
    return `Error generating summary: ${err.message}`;
  }
}

// Add retry functionality for OpenAI requests
async function summarizeProfileWithRetry(profile, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await summarizeProfile(profile);
    } catch (err) {
      retries++;
      console.log(`Retry ${retries}/${maxRetries} for ${profile.username}`);
      
      if (retries >= maxRetries) {
        return `Failed to summarize after ${maxRetries} attempts: ${err.message}`;
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { summarizeProfile, summarizeProfileWithRetry };
