import { isPresetId, getPresetDirective } from '../recommendations/presets';

export function normalizeTitle(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cheap order-independent hash (djb2 over sorted parts, base36). Mirrored
// verbatim in backend/ollama-recommender.js — keep output byte-identical so a
// signature computed in one mode isn't falsely stale in the other.
export function hashStrings(parts) {
  const s = [...parts].sort().join(';');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Hash over id|rating|status so rating/status edits change the signature,
// not just adds/removes. Mirrored verbatim in backend/ollama-recommender.js.
export function hashLibrary(rows) {
  return hashStrings((rows || []).map((r) => `${r.id}|${r.rating ?? ''}|${r.status ?? ''}`));
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
  // Only titles rated poorly qualify as "disliked" — an all-high-rated library
  // shouldn't present its 8/10s as steer-away material.
  const n = byRatingDesc.length;
  const poorlyRatedCount = byRatingDesc.filter((m) => m.rating <= 6).length;
  let lovedCount = Math.min(15, n);
  let dislikedCount = n >= 8 ? Math.min(10, poorlyRatedCount) : 0;
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

// Feedback the user gave on past AI recommendations, folded into the rec prompt
// as a strong steering signal. Input: { interested: [], notForMe: [], seenIt: [] }
// (title strings, already deduped/capped by the caller). Mirrored verbatim in
// backend/ollama-recommender.js. Keep the two in sync.
export function formatRecFeedbackForPrompt(feedback) {
  if (!feedback || typeof feedback !== 'object') return '';
  const notForMe = Array.isArray(feedback.notForMe) ? feedback.notForMe : [];
  const interested = Array.isArray(feedback.interested) ? feedback.interested : [];
  const seenIt = Array.isArray(feedback.seenIt) ? feedback.seenIt : [];
  if (!notForMe.length && !interested.length && !seenIt.length) return '';
  const lines = [];
  if (notForMe.length) {
    lines.push(`- Rejected ("not for me") — never recommend these again, and avoid recommending similar titles; learn what these have in common: ${notForMe.join('; ')}`);
  }
  if (interested.length) {
    lines.push(`- Added to my watchlist from your past recommendations — do NOT recommend them again, but they show exactly what excites me; favor more like these: ${interested.join('; ')}`);
  }
  if (seenIt.length) {
    lines.push(`- Already seen (not in my log) — do NOT recommend: ${seenIt.join('; ')}`);
  }
  return `I have reacted to past AI recommendations — use this as a strong signal:\n${lines.join('\n')}`;
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

  // When a saved taste profile is present, lead with its distilled read plus a
  // condensed "loved" grounding instead of double-sending the full digest.
  const profileText = formatTasteProfileForPrompt(options.tasteProfile);
  let signal;
  if (profileText) {
    const topLoved = [...userMovies]
      .filter((m) => typeof m.rating === 'number' && !Number.isNaN(m.rating))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8)
      .map((m) => `- ${formatDigestLine(m)}`)
      .join('\n');
    signal = `${profileText}${topLoved ? `\n\nA few of my highest-rated ${contentLabel} for grounding:\n${topLoved}` : ''}`;
  } else {
    signal = buildLibraryDigest(userMovies, contentLabel);
  }

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

  // Feedback titles are the durable layer: dedupe them against the watched list,
  // and let feedback wording win over the plain recently-shown exclusion.
  const watchedNorm = new Set((userMovies || []).map((m) => normalizeTitle(m.title)));
  const dropWatched = (titles) => (Array.isArray(titles) ? titles.filter((t) => !watchedNorm.has(normalizeTitle(t))) : []);
  const feedback = options.feedback || {};
  const fbNotForMe = dropWatched(feedback.notForMe);
  const fbInterested = dropWatched(feedback.interested);
  const fbSeenIt = dropWatched(feedback.seenIt);
  const feedbackNorm = new Set([...fbNotForMe, ...fbInterested, ...fbSeenIt].map(normalizeTitle));
  const shownExclusions = extraExclusions.filter((t) => !feedbackNorm.has(normalizeTitle(t)));

  let exclusionBlock = `\n\nIMPORTANT: I have already watched the following ${contentLabel}. Do NOT recommend any of these, or any obvious re-releases / remasters / alternate cuts / sequels-I've-already-seen of them:\n\n${watchedTitlesList}\n\nReturn only titles I have NOT seen.`;
  if (shownExclusions.length) {
    exclusionBlock += `\n\nAlso do NOT recommend any of these — I was just shown them and want something new:\n${shownExclusions.map((t) => `- ${t}`).join('\n')}`;
  }
  const feedbackBlock = formatRecFeedbackForPrompt({ notForMe: fbNotForMe, interested: fbInterested, seenIt: fbSeenIt });
  if (feedbackBlock) {
    exclusionBlock += `\n\n${feedbackBlock}`;
  }

  let userPrompt = '';
  if (isPresetId(type)) {
    userPrompt = `${signal}\n\n${getPresetDirective(type)}\n\nRecommend 5 ${contentLabel} that fit this mood while still matching what I love and avoiding what I dislike, explaining why each fits.`;
  } else if (type === 'similar') {
    userPrompt = `${signal}

Analyze the patterns in my preferences (genre, director, themes, style, era) and especially what I rate highly versus poorly. Recommend 5 ${contentLabel} that match what I love and avoid what I dislike, explaining why each fits my taste.

Consider:
- Genres and sub-genres I rate highly (favor my highest-average-rated genres)
- Directors or creators with similar styles
- Comparable themes and storytelling approaches
- Similar production era or aesthetic`;
  } else if (type === 'hidden_gems') {
    userPrompt = `${signal}

I want to discover lesser-known ${contentLabel} (hidden gems) that match my taste. Recommend 5 ${contentLabel} that are:
- Not mainstream blockbusters or huge hits
- Highly rated but may have flown under the radar
- A strong match for what I love, steering clear of what I've rated poorly

For each, explain why it's a hidden gem that fits my taste perfectly.`;
  } else {
    userPrompt = `${signal}\n\nRecommend 5 ${contentLabel} I'd enjoy, matching what I love and avoiding what I dislike.`;
  }

  userPrompt += exclusionBlock;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Taste Analysis — a persisted, distilled profile compiled from the digest.
// buildTasteAnalysisPrompt / parseTasteProfileJSON / formatTasteProfileForPrompt
// are mirrored verbatim in backend/ollama-recommender.js. Keep the two in sync.
// ---------------------------------------------------------------------------

export function buildTasteAnalysisPrompt(digest, contentLabel = 'movies & TV') {
  const systemPrompt = `You are a film and television taste analyst. Study the user's library digest and compile a concise, structured profile of their taste.

Base every field strictly on the evidence in the digest — especially what they rate highly versus poorly. Do not invent facts. Be specific and vivid, not generic.

Return ONLY valid JSON in this exact shape:
{
  "persona": "short vivid label + 1-2 sentence description",
  "summary": "2-3 sentence plain-English read of their taste",
  "favoriteGenres": [{ "genre": "string", "note": "why it fits them" }],
  "favoriteDirectors": ["string"],
  "favoriteEras": ["string"],
  "themes": ["string"],
  "styles": ["string"],
  "dislikes": ["string"],
  "patterns": ["string"],
  "hiddenGemAffinity": "string",
  "movieVsTV": "string"
}`;

  const userPrompt = `${digest}

Analyze my ${contentLabel} taste and return the JSON profile described. Focus on:
- What my highest-rated titles and highest-average-rated genres reveal about what I love
- What my lowest-rated titles reveal about what to steer away from (dislikes)
- Recurring themes, styles, directors, and eras
- Patterns (e.g. rating auteur work above box-office hits) and any hidden-gem affinity
- How my movie taste compares to my TV taste`;

  return { systemPrompt, userPrompt };
}

export function parseTasteProfileJSON(text) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  const isProfile = (o) => o && typeof o === 'object' && (o.persona || o.summary);

  try {
    const direct = JSON.parse(cleaned);
    if (isProfile(direct)) return direct;
  } catch { /* fall through */ }

  for (const candidate of extractJsonObjects(cleaned)) {
    if (!candidate.includes('"persona"') && !candidate.includes('"summary"')) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (isProfile(parsed)) return parsed;
    } catch { /* try next */ }
  }

  return null;
}

// Compact text block injected into the recommendation + assistant prompts when a
// saved profile exists. Mirrored in backend/ollama-recommender.js.
export function formatTasteProfileForPrompt(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const lines = [];
  if (profile.persona) lines.push(`Persona: ${profile.persona}`);
  if (profile.summary) lines.push(`Summary: ${profile.summary}`);
  const genres = Array.isArray(profile.favoriteGenres)
    ? profile.favoriteGenres
        .map((g) => (typeof g === 'string' ? g : g && g.genre ? (g.note ? `${g.genre} (${g.note})` : g.genre) : ''))
        .filter(Boolean)
    : [];
  if (genres.length) lines.push(`Favorite genres: ${genres.join('; ')}`);
  if (Array.isArray(profile.favoriteDirectors) && profile.favoriteDirectors.length)
    lines.push(`Favorite directors: ${profile.favoriteDirectors.join(', ')}`);
  if (Array.isArray(profile.favoriteEras) && profile.favoriteEras.length)
    lines.push(`Favorite eras: ${profile.favoriteEras.join(', ')}`);
  if (Array.isArray(profile.themes) && profile.themes.length)
    lines.push(`Themes they love: ${profile.themes.join(', ')}`);
  if (Array.isArray(profile.styles) && profile.styles.length)
    lines.push(`Styles they love: ${profile.styles.join(', ')}`);
  if (Array.isArray(profile.dislikes) && profile.dislikes.length)
    lines.push(`Dislikes (steer away): ${profile.dislikes.join(', ')}`);
  if (Array.isArray(profile.patterns) && profile.patterns.length)
    lines.push(`Patterns: ${profile.patterns.join('; ')}`);
  if (profile.hiddenGemAffinity) lines.push(`Hidden-gem affinity: ${profile.hiddenGemAffinity}`);
  if (profile.movieVsTV) lines.push(`Movie vs TV: ${profile.movieVsTV}`);
  if (!lines.length) return '';
  return `Here is my saved taste profile (a distilled read of my library — treat it as the primary guide):\n${lines.join('\n')}`;
}

export function buildAssistantPrompt(userMessage, movies = [], tvSeries = [], analytics = null, history = [], tasteProfile = null) {
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

  const profileText = formatTasteProfileForPrompt(tasteProfile);
  if (profileText) context += `\n${profileText}\n`;

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

  // Salvage: reasoning models (GLM, etc.) sometimes exhaust the token budget on
  // reasoning and get truncated mid-JSON, so the top-level object never closes
  // and nothing above parses. Recover whatever complete recommendation objects
  // did make it into the array before the cutoff.
  const salvaged = salvageRecommendations(cleaned);
  if (salvaged.length) return { recommendations: salvaged };

  return null;
}

// Walk the `"recommendations"` array and return each complete, parseable item
// object (must have a non-empty title). Stops at the truncation point. Unlike
// extractJsonObjects, this captures objects nested inside the array even when
// the enclosing top-level object is never closed.
function salvageRecommendations(text) {
  const key = text.indexOf('"recommendations"');
  if (key === -1) return [];
  const open = text.indexOf('[', key);
  if (open === -1) return [];

  const items = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = open + 1; i < text.length; i++) {
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
          try {
            const item = JSON.parse(text.slice(start, i + 1));
            if (item && typeof item === 'object' && item.title) items.push(item);
          } catch { /* skip malformed item */ }
          start = -1;
        }
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }
  return items;
}
