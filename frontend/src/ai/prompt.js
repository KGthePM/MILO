export function normalizeTitle(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Library digest — the richer taste signal fed into the recommendation prompt.
// Mirrored verbatim in backend/ollama-recommender.js. Keep the two in sync.
// ---------------------------------------------------------------------------

function truncateNotes(notes, max = 120) {
  if (!notes) return '';
  const s = String(notes).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatDigestLine(m) {
  const bits = [`${m.rating}/10`];
  if (m.genre) bits.push(m.genre);
  if (m.director) bits.push('dir. ' + m.director);
  if (m.release_year) bits.push(String(m.release_year));
  const notes = truncateNotes(m.notes);
  return `${m.title} (${bits.join(', ')})${notes ? ` — ${notes}` : ''}`;
}

export function buildLibraryDigest(userMovies, contentLabel) {
  const rated = userMovies.filter((m) => typeof m.rating === 'number' && !Number.isNaN(m.rating));
  const byRatingDesc = [...rated].sort((a, b) => b.rating - a.rating);

  // Partition into non-overlapping loved (top) and disliked (bottom) so a small
  // library isn't printed twice.
  const n = byRatingDesc.length;
  let lovedCount = Math.min(15, n);
  let dislikedCount = n >= 8 ? Math.min(10, n) : 0;
  if (lovedCount + dislikedCount > n) {
    dislikedCount = Math.min(dislikedCount, Math.floor(n / 2));
    lovedCount = Math.min(lovedCount, n - dislikedCount);
  }
  const loved = byRatingDesc.slice(0, lovedCount);
  const lovedBlock = loved.map((m) => `- ${formatDigestLine(m)}`).join('\n');

  let dislikedBlock = '';
  if (dislikedCount) {
    const disliked = byRatingDesc.slice(n - dislikedCount).reverse();
    dislikedBlock = disliked.map((m) => `- ${formatDigestLine(m)}`).join('\n');
  }

  const genreStats = {};
  for (const m of userMovies) {
    if (!m.genre) continue;
    const g = genreStats[m.genre] || (genreStats[m.genre] = { count: 0, sum: 0, rated: 0 });
    g.count++;
    if (typeof m.rating === 'number' && !Number.isNaN(m.rating)) { g.sum += m.rating; g.rated++; }
  }
  const genreLines = Object.entries(genreStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([g, s]) => `${g}: ${s.count} watched, avg ${s.rated ? (s.sum / s.rated).toFixed(1) : 'n/a'}/10`)
    .join('\n- ');

  const dirCounts = {};
  for (const m of userMovies) {
    if (!m.director) continue;
    dirCounts[m.director] = (dirCounts[m.director] || 0) + 1;
  }
  const directorLine = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([d, c]) => (c > 1 ? `${d} (${c})` : d))
    .join(', ');

  const decadeCounts = {};
  for (const m of userMovies) {
    const y = parseInt(m.release_year, 10);
    if (!y) continue;
    const decade = `${Math.floor(y / 10) * 10}s`;
    decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
  }
  const eraLine = Object.entries(decadeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([d, c]) => `${d} (${c})`)
    .join(', ');

  let digest = `Here is a digest of my ${contentLabel} library.\n\nLoved (my highest-rated):\n${lovedBlock}`;
  if (dislikedBlock) {
    digest += `\n\nDisliked (my lowest-rated — steer away from anything like these):\n${dislikedBlock}`;
  }
  if (genreLines) digest += `\n\nGenre distribution (count + average rating — high averages are what I truly love):\n- ${genreLines}`;
  if (directorLine) digest += `\n\nDirectors I return to: ${directorLine}`;
  if (eraLine) digest += `\n\nEras I watch (by release decade): ${eraLine}`;
  return digest;
}

export function buildRecommendationPrompt(userMovies, type, contentType, options = {}) {
  const contentLabel = contentType === 'tv' ? 'TV series' : 'movies';
  const extraExclusions = Array.isArray(options.extraExclusions) ? options.extraExclusions : [];

  const systemPrompt = `You are a ${contentLabel} recommendation expert. Analyze the user's viewing history and provide personalized recommendations.

Never recommend a title the user has already watched.

Return ONLY valid JSON in this format:
{
  "recommendations": [
    {
      "title": "string",
      "year": "number",
      "genre": "string",
      "explanation": "brief explanation (50-100 words)",
      "confidence": 1-10
    }
  ]
}`;

  if (!userMovies || userMovies.length === 0) {
    return {
      systemPrompt,
      userPrompt: `The user has no ${contentLabel} in their database. Suggest 5 popular ${contentLabel} across different genres to help them get started.`,
    };
  }

  const digest = buildLibraryDigest(userMovies, contentLabel);

  const watchedSorted = [...userMovies]
    .sort((a, b) => {
      const ad = a.date_watched || a.created_at || '';
      const bd = b.date_watched || b.created_at || '';
      return bd.localeCompare(ad);
    })
    .slice(0, 300);
  const watchedTitlesList = [...new Set(watchedSorted.map((m) => m.title).filter(Boolean))]
    .map((t) => `- ${t}`)
    .join('\n');
  let exclusionBlock = `\n\nIMPORTANT: I have already watched the following ${contentLabel}. Do NOT recommend any of these, or any obvious re-releases / remasters / alternate cuts / sequels-I've-already-seen of them:\n\n${watchedTitlesList}\n\nReturn only titles I have NOT seen.`;
  if (extraExclusions.length) {
    exclusionBlock += `\n\nAlso do NOT recommend any of these — I was just shown them and want something new:\n${extraExclusions.map((t) => `- ${t}`).join('\n')}`;
  }

  let userPrompt = '';
  if (type === 'similar') {
    userPrompt = `${digest}

Analyze the patterns in my preferences (genre, director, themes, style, era) and especially what I rate highly versus poorly. Recommend 5 ${contentLabel} that match what I love and avoid what I dislike, explaining why each fits my taste.

Consider:
- Genres and sub-genres I rate highly (favor my highest-average-rated genres)
- Directors or creators with similar styles
- Comparable themes and storytelling approaches
- Similar production era or aesthetic`;
  } else if (type === 'hidden_gems') {
    userPrompt = `${digest}

I want to discover lesser-known ${contentLabel} (hidden gems) that match my taste. Recommend 5 ${contentLabel} that are:
- Not mainstream blockbusters or huge hits
- Highly rated but may have flown under the radar
- A strong match for what I love, steering clear of what I've rated poorly

For each, explain why it's a hidden gem that fits my taste perfectly.`;
  } else {
    userPrompt = `${digest}\n\nRecommend 5 ${contentLabel} I'd enjoy, matching what I love and avoiding what I dislike.`;
  }

  userPrompt += exclusionBlock;

  return { systemPrompt, userPrompt };
}

export function buildAssistantPrompt(userMessage, movies = [], tvSeries = [], analytics = null, history = []) {
  let context = 'User viewing history:\n\n';

  if (movies.length > 0) {
    const topMovies = [...movies]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(
        (m) =>
          `${m.title} (${m.rating}/10${m.genre ? ', ' + m.genre : ''}${m.director ? ', dir. ' + m.director : ''})`
      )
      .join('\n- ');
    const genres = [...new Set(movies.map((m) => m.genre).filter(Boolean))];
    const directors = [...new Set(movies.map((m) => m.director).filter(Boolean))];
    context += `Top rated movies:\n- ${topMovies}\n`;
    if (genres.length) context += `\nFavorite movie genres: ${genres.join(', ')}\n`;
    if (directors.length) context += `Favorite directors: ${directors.join(', ')}\n`;
  }

  if (tvSeries.length > 0) {
    const topTV = [...tvSeries]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(
        (t) =>
          `${t.title} (${t.rating}/10${t.genre ? ', ' + t.genre : ''}${t.num_seasons ? ', ' + t.num_seasons + ' seasons' : ''})`
      )
      .join('\n- ');
    const tvGenres = [...new Set(tvSeries.map((t) => t.genre).filter(Boolean))];
    context += `\nTop rated TV series:\n- ${topTV}\n`;
    if (tvGenres.length) context += `\nFavorite TV genres: ${tvGenres.join(', ')}\n`;
  }

  if (analytics) {
    context += `\nTotal content watched: ${analytics.totalWatched || 0}\n`;
    context += `Average rating: ${analytics.averageRating?.toFixed?.(1) || 'N/A'}/10\n`;
  }

  const systemPrompt = `You are MILO (Movie Intelligence & Learning Overseer), a sophisticated AI assistant for a personal movie and TV tracking application.

Your personality:
- Professional, knowledgeable, and slightly witty
- Helpful and concise in your responses
- Deeply passionate about movies and TV shows
- Like a friendly film critic or knowledgeable cinema enthusiast

Guidelines:
- Keep responses focused and concise (2-4 sentences typically)
- Be specific and personalized using their actual viewing history
- When recommending, explain WHY it fits their taste
- If they have no history, suggest popular titles to get started
- Be encouraging about their viewing journey

Context about the user:
${context}`;

  const recent = Array.isArray(history) ? history.slice(-20) : [];
  const transcriptLines = recent
    .filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => `${m.role === 'user' ? 'User' : 'MILO'}: ${m.content}`);
  const userPrompt = transcriptLines.length
    ? `Previous conversation:\n${transcriptLines.join('\n')}\n\nCurrent message: ${userMessage}`
    : userMessage;

  return { systemPrompt, userPrompt };
}

// Extract every balanced `{...}` object from a string, respecting string
// literals and escapes so stray braces inside prose or strings don't confuse it.
function extractJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          objects.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return objects;
}

export function parseRecommendationsJSON(text) {
  if (!text) return null;

  // Reasoning models (GLM, DeepSeek, etc.) often emit <think>…</think> blocks
  // and/or wrap JSON in markdown code fences. Strip both before parsing.
  let cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  // Fast path: the whole thing is valid JSON.
  try {
    const direct = JSON.parse(cleaned);
    if (direct && Array.isArray(direct.recommendations)) return direct;
  } catch { /* fall through */ }

  // Otherwise scan for the first balanced object that has a recommendations array.
  for (const candidate of extractJsonObjects(cleaned)) {
    if (!candidate.includes('"recommendations"')) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && Array.isArray(parsed.recommendations)) return parsed;
    } catch { /* try next */ }
  }

  return null;
}
