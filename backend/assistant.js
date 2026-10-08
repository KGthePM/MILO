require('dotenv').config();

const http = require('http');
const { formatTasteProfileForPrompt, buildLibraryDigest } = require('./ollama-recommender');

// ---------------------------------------------------------------------------
// Assistant (chat) prompt. Mirrored from buildAssistantPrompt in
// frontend/src/ai/prompt.js — keep the context blocks and the system-prompt
// wording in sync. Exclusion lists are capped tighter here because Ollama's
// default context window is small and silently truncates the prompt.
// ---------------------------------------------------------------------------

const ASSISTANT_TYPES = [
  { key: 'movie', label: 'movies', short: 'Movies' },
  { key: 'tv', label: 'TV series', short: 'TV' },
  { key: 'podcast', label: 'podcasts', short: 'Podcasts' },
  { key: 'book', label: 'books', short: 'Books' },
];

const GENRE_ALIASES = {
  Comedy: ['comedy', 'comedies', 'comedic', 'funny', 'hilarious', 'laugh', 'laughs', 'sitcom', 'sitcoms', 'rom-com', 'rom-coms', 'romcom', 'romcoms'],
  Horror: ['horror', 'horrors', 'scary', 'spooky', 'creepy', 'frightening', 'slasher', 'slashers'],
  'Sci-Fi': ['sci-fi', 'scifi', 'sci fi', 'science fiction', 'space opera'],
  Action: ['action', 'action-packed'],
  Drama: ['drama', 'dramas', 'dramatic'],
  Thriller: ['thriller', 'thrillers', 'suspense', 'suspenseful'],
  Romance: ['romance', 'romances', 'romantic', 'love story', 'love stories', 'rom-com', 'rom-coms', 'romcom', 'romcoms'],
  Animation: ['animation', 'animated', 'anime', 'cartoon', 'cartoons'],
  Documentary: ['documentary', 'documentaries', 'docuseries', 'docs'],
  Fantasy: ['fantasy'],
  Reality: ['reality tv', 'reality television', 'reality show', 'reality shows', 'reality series', 'talk show', 'talk shows', 'late night', 'late-night', 'dating show', 'dating shows', 'competition show', 'competition shows', 'trash tv', 'unscripted', 'housewives', 'bravo'],
  Mystery: ['mystery', 'mysteries', 'whodunit', 'whodunits', 'detective'],
  'True Crime': ['true crime'],
  'Young Adult': ['young adult'],
  'Graphic Novel': ['graphic novel', 'graphic novels', 'comic', 'comics'],
  'Biography & Memoir': ['biography', 'biographies', 'memoir', 'memoirs'],
  Nonfiction: ['nonfiction', 'non-fiction'],
  'Self-Help': ['self-help', 'self help'],
};

const TYPE_HINTS = {
  movie: /\b(movies?|films?|cinema|watch)\b/,
  tv: /\b(tv|shows?|series|sitcoms?|watch|binge)\b/,
  podcast: /\b(podcasts?|listen|listening)\b/,
  book: /\b(books?|novels?|read|reading)\b/,
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentions(text, term) {
  return new RegExp(`(^|[^a-z])${escapeRegExp(term)}([^a-z]|$)`).test(text);
}

const isRated = (m) => typeof m.rating === 'number' && !Number.isNaN(m.rating);
const isWatched = (m) => (m.status || 'watched') === 'watched';

function formatFocusLine(m) {
  const bits = [`${m.rating}/10`];
  if (m.genre) bits.push(m.genre);
  if (m.director) bits.push('dir. ' + m.director);
  if (m.author) bits.push('by ' + m.author);
  if (m.release_year) bits.push(String(m.release_year));
  return `${m.title} (${bits.join(', ')})`;
}

function detectRequestFocus(message, libraryGenres = []) {
  const text = String(message || '').toLowerCase();
  const genres = new Set();
  for (const [genre, terms] of Object.entries(GENRE_ALIASES)) {
    if (terms.some((t) => mentions(text, t))) genres.add(genre);
  }
  for (const g of libraryGenres) {
    const lower = String(g).toLowerCase();
    if (mentions(text, lower) || mentions(text, `${lower}s`)) genres.add(g);
  }
  const types = Object.keys(TYPE_HINTS).filter((t) => TYPE_HINTS[t].test(text));
  return { genres: [...genres], types };
}

function buildFocusBlock(message, lists, cap = 30) {
  const libraryGenres = [...new Set(ASSISTANT_TYPES.flatMap(({ key }) => (lists[key] || []).map((m) => m.genre).filter(Boolean)))];
  const { genres, types } = detectRequestFocus(message, libraryGenres);
  if (!genres.length) return '';
  const inScope = ASSISTANT_TYPES.filter(({ key }) => !types.length || types.includes(key));
  const parts = [];
  for (const genre of genres) {
    const g = genre.toLowerCase();
    const rows = inScope
      .flatMap(({ key }) => (lists[key] || [])
        .filter((m) => isRated(m) && String(m.genre || '').toLowerCase() === g)
        .map((m) => ({ ...m, _type: key })))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, cap);
    if (rows.length) {
      parts.push(`Every ${genre} title I've rated (high = the kind that works for me, low = the kind that doesn't):\n${rows
        .map((m) => `- [${m._type}] ${formatFocusLine(m)}`)
        .join('\n')}`);
    } else {
      parts.push(`I haven't logged any ${genre} yet — use my overall taste to judge which kind of ${genre} would suit me.`);
    }
  }
  return `FOCUS — this request is about ${genres.join(' / ')}:\n${parts.join('\n\n')}`;
}

function recentFirst(rows) {
  const at = (m) => m.date_watched || m.created_at || '';
  return [...rows].sort((a, b) => String(at(b)).localeCompare(String(at(a))));
}

function titleLines(lists, pick, cap) {
  return ASSISTANT_TYPES
    .map(({ key, short }) => {
      const titles = [...new Set(recentFirst((lists[key] || []).filter(pick)).map((m) => m.title).filter(Boolean))].slice(0, cap);
      return titles.length ? `${short}: ${titles.join('; ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

// Build context string from user data
function buildContext(movies = [], tvSeries = [], podcasts = [], books = [], analytics = null, tasteProfile = null, { message = '', recentlySuggested = [] } = {}) {
  const all = { movie: movies || [], tv: tvSeries || [], podcast: podcasts || [], book: books || [] };
  const watched = Object.fromEntries(Object.entries(all).map(([k, rows]) => [k, rows.filter(isWatched)]));
  const hasHistory = Object.values(watched).some((rows) => rows.length);

  const blocks = [];
  for (const { key, label } of ASSISTANT_TYPES) {
    if (watched[key].some(isRated)) blocks.push(buildLibraryDigest(watched[key], label));
  }

  if (analytics) {
    blocks.push(`Total logged: ${analytics.totalWatched || 0}. Average rating: ${analytics.averageRating?.toFixed?.(1) || 'N/A'}/10.`);
  }

  const profileText = formatTasteProfileForPrompt(tasteProfile);
  if (profileText) blocks.push(profileText);

  const focus = buildFocusBlock(message, watched);
  if (focus) blocks.push(focus);

  const seen = titleLines(watched, () => true, 100);
  if (seen) blocks.push(`Already watched / listened to / read — NEVER suggest these, or remakes / re-releases of them:\n${seen}`);

  const onList = titleLines(all, (m) => !isWatched(m), 75);
  if (onList) blocks.push(`Already on my to-watch / to-listen / to-read list — don't suggest these as new picks (mention them untagged if relevant):\n${onList}`);

  const recent = (Array.isArray(recentlySuggested) ? recentlySuggested : [])
    .filter((p) => p && p.title)
    .slice(0, 60)
    .map((p) => `${p.title}${p.type ? ` (${p.type})` : ''}`);
  if (recent.length) blocks.push(`You suggested these to me in recent chats — don't repeat them unless I ask for them by name:\n${recent.join('; ')}`);

  return hasHistory || blocks.length ? blocks.join('\n\n') : 'The user has not logged anything yet.';
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
  const systemPrompt = `You are MILO (Media Intelligence & Learning Overseer), a sophisticated AI assistant for a personal movie, TV, podcast, and book tracking application.

Your personality:
- Professional, knowledgeable, and slightly witty
- Deeply passionate about movies, TV shows, podcasts, and books
- Like a friendly critic with deep, eclectic taste — not a top-10 list

Guidelines:
- In conversation, keep replies focused and concise (2-4 sentences).
- When I ask for recommendations, give 4-6 picks, each on its own line with a one-sentence reason that names a specific title from my library it connects to (e.g. "you gave Hot Fuzz a 9").
- Personalize from the context below: my high AND low ratings, the FOCUS block when present, my taste profile, and my reactions to past recommendations.
- Skip the default crowd-pleasers everyone gets recommended for a genre — only choose an obvious title when my history points straight at it. Make at least one pick a deeper cut I'm unlikely to have heard of, and vary eras, countries, and sub-genres.
- Never suggest anything I've already watched, listened to, or read, anything already on my list, anything I rejected, or anything you suggested to me recently — all listed below. Check every pick against those lists before answering.
- If I ask for a specific type ("movies", "shows", "podcasts", "books"), stick to it. Otherwise cross-media connections are welcome (a novel behind a film I loved, a show adapted from a book).
- If I have no history, suggest popular, widely loved titles to get started.
- Plain text only: no markdown bold or headings. A simple "- " list is fine.
- Be encouraging about my viewing, listening, and reading.

Tagging recommendations:
- Wrap every title you RECOMMEND in double brackets with its type and year: [[Title|type|year]]
- type is exactly one of: movie, tv, podcast, book. Year is the release / first-published year; leave it empty if unsure: [[Title|podcast|]]
- Only tag new suggestions. Titles already in the user's library are mentioned plainly, untagged.
- Tag each title once, inline where it reads naturally. The app turns tags into one-tap "add to list" buttons, so never mention the brackets.
- Example: If Arrival stayed with you, try [[Annihilation|movie|2018]] — and the novella behind Arrival, [[Stories of Your Life and Others|book|2002]].

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
        num_predict: 900
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
async function generateResponse(message, movies, tvSeries, podcasts, books, analytics, model, history = [], tasteProfile = null, recentlySuggested = []) {
  const resolvedModel = model || process.env.OLLAMA_MODEL;
  if (!resolvedModel) {
    throw new Error('No model specified. Pick one from the dropdown.');
  }

  try {
    const context = buildContext(movies, tvSeries, podcasts, books, analytics, tasteProfile, { message, recentlySuggested });
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
