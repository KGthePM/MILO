require('dotenv').config();

const http = require('http');
const { formatTasteProfileForPrompt } = require('./ollama-recommender');

// Build context string from user data
function buildContext(movies = [], tvSeries = [], analytics = null, tasteProfile = null) {
  movies = movies.filter(m => (m.status || 'watched') === 'watched');
  tvSeries = tvSeries.filter(t => (t.status || 'watched') === 'watched');

  let context = 'User viewing history:\n\n';

  if (movies.length > 0) {
    const topMovies = movies
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(m => `${m.title} (${m.rating}/10${m.genre ? ', ' + m.genre : ''}${m.director ? ', dir. ' + m.director : ''})`)
      .join('\n- ');

    const genres = [...new Set(movies.map(m => m.genre).filter(Boolean))];
    const directors = [...new Set(movies.map(m => m.director).filter(Boolean))];

    context += `Top rated movies:\n- ${topMovies}\n`;
    if (genres.length > 0) context += `\nFavorite movie genres: ${genres.join(', ')}\n`;
    if (directors.length > 0) context += `Favorite directors: ${directors.join(', ')}\n`;
  }

  if (tvSeries.length > 0) {
    const topTV = tvSeries
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(t => `${t.title} (${t.rating}/10${t.genre ? ', ' + t.genre : ''}${t.num_seasons ? ', ' + t.num_seasons + ' seasons' : ''})`)
      .join('\n- ');

    const tvGenres = [...new Set(tvSeries.map(t => t.genre).filter(Boolean))];

    context += `\nTop rated TV series:\n- ${topTV}\n`;
    if (tvGenres.length > 0) context += `\nFavorite TV genres: ${tvGenres.join(', ')}\n`;
  }

  if (analytics) {
    context += `\nTotal content watched: ${analytics.totalWatched || 0}\n`;
    context += `Average rating: ${analytics.averageRating?.toFixed(1) || 'N/A'}/10\n`;
  }

  const profileText = formatTasteProfileForPrompt(tasteProfile);
  if (profileText) context += `\n${profileText}\n`;

  return context;
}

// Format conversation history into a transcript block
function formatHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const recent = history.slice(-20);
  const lines = recent
    .filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => `${m.role === 'user' ? 'User' : 'MILO'}: ${m.content}`);
  if (lines.length === 0) return '';
  return `Previous conversation:\n${lines.join('\n')}\n\n`;
}

// Build prompt for MILO
function buildPrompt(userMessage, context, history = []) {
  const systemPrompt = `You are MILO (Movie Intelligence & Learning Overseer), a sophisticated AI assistant for Cine-metric, a personal movie and TV tracking application.

Your personality:
- Professional, knowledgeable, and slightly witty
- Helpful and concise in your responses
- Deeply passionate about movies and TV shows
- Like a friendly film critic or knowledgeable cinema enthusiast

Your capabilities:
- Provide personalized recommendations based on viewing history
- Analyze user preferences and patterns
- Suggest similar content based on specific movies/TV shows
- Help discover hidden gems matching their taste
- Answer questions about their viewing habits

Guidelines:
- Keep responses focused and concise (2-4 sentences typically)
- Be specific and personalized using their actual viewing history
- When recommending, explain WHY it fits their taste
- If they have no history, suggest popular titles to get started
- Be encouraging about their viewing journey

Context about the user:
${context}`;

  const transcript = formatHistory(history);
  const userPrompt = transcript
    ? `${transcript}Current message: ${userMessage}`
    : userMessage;

  return { systemPrompt, userPrompt };
}

// Call Ollama API
async function callOllama(prompt, systemPrompt, model) {
  return new Promise((resolve, reject) => {
    if (!model) {
      reject(new Error('No model specified. Pick one from the dropdown.'));
      return;
    }

    const postData = JSON.stringify({
      model,
      prompt: systemPrompt + '\n\n' + prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 500
      }
    });

    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const url = new URL(ollamaUrl);

    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 480000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.response);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Generate response from MILO
async function generateResponse(message, movies, tvSeries, analytics, model, history = [], tasteProfile = null) {
  const resolvedModel = model || process.env.OLLAMA_MODEL;
  if (!resolvedModel) {
    throw new Error('No model specified. Pick one from the dropdown.');
  }

  try {
    const context = buildContext(movies, tvSeries, analytics, tasteProfile);
    const { systemPrompt, userPrompt } = buildPrompt(message, context, history);
    const response = await callOllama(userPrompt, systemPrompt, resolvedModel);

    return { response, modelUsed: resolvedModel };
  } catch (error) {
    console.error('Error generating MILO response:', error.message);
    throw error;
  }
}

module.exports = {
  generateResponse,
  buildContext
};
