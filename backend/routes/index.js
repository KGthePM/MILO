const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const ollamaRecommender = require('../ollama-recommender');
const assistant = require('../assistant');
const letterboxdImporter = require('../letterboxd-importer');
const dbImporter = require('../db-importer');
const multer = require('multer');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });
const router = express.Router();

router.get('/ollama/models', (req, res) => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const url = new URL(ollamaUrl);

  const options = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: '/api/tags',
    method: 'GET',
    timeout: parseInt(process.env.OLLAMA_MODELS_TIMEOUT_MS, 10) || 30000
  };

  const request = http.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const allNames = (parsed.models || []).map(m => m.name);
        const models = allNames.filter(name => !/embed/i.test(name));
        res.json({ models });
      } catch {
        res.json({ models: [], error: 'Failed to parse Ollama response' });
      }
    });
  });

  request.on('error', (err) => res.json({ models: [], error: `Ollama unavailable: ${err.message}` }));
  request.on('timeout', () => { request.destroy(); res.json({ models: [], error: 'Ollama timeout' }); });
  request.end();
});

router.get('/ollama/status', (req, res) => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const configuredModel = process.env.OLLAMA_MODEL || 'qwen2.5:2b';
  const url = new URL(ollamaUrl);
  const options = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: '/api/tags',
    method: 'GET',
    timeout: parseInt(process.env.OLLAMA_STATUS_TIMEOUT_MS, 10) || 15000
  };
  const request = http.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const models = (parsed.models || []).map(m => m.name);
        res.json({ reachable: true, configuredModel, modelAvailable: models.includes(configuredModel), availableModels: models });
      } catch {
        res.json({ reachable: true, configuredModel, modelAvailable: false, availableModels: [], error: 'Failed to parse Ollama response' });
      }
    });
  });
  request.on('error', () => res.json({ reachable: false, configuredModel, modelAvailable: false, availableModels: [], error: 'Ollama unreachable' }));
  request.on('timeout', () => { request.destroy(); res.json({ reachable: false, configuredModel, modelAvailable: false, availableModels: [], error: 'Ollama timeout' }); });
  request.end();
});

router.get('/movies', (req, res) => {
  const { search, genre, minRating, maxRating, startDate, endDate, type, status, sortBy } = req.query;

  let query = 'SELECT * FROM movies WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (title LIKE ? OR notes LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  if (minRating) {
    query += ' AND rating >= ?';
    params.push(minRating);
  }

  if (maxRating) {
    query += ' AND rating <= ?';
    params.push(maxRating);
  }

  if (startDate) {
    query += ' AND date_watched >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date_watched <= ?';
    params.push(endDate);
  }

  const sortClauses = {
    'most_recent': 'CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'highest_rated': 'rating DESC, CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'lowest_rated': 'rating ASC, CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'title_asc': 'title ASC',
    'title_desc': 'title DESC'
  };
  query += ` ORDER BY ${sortClauses[sortBy] || sortClauses['most_recent']}`;

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/movies', (req, res) => {
  const { title, rating, genre, date_watched, notes, director, release_year, type, num_seasons, total_episodes, status } = req.body;
  const resolvedStatus = status || 'watched';
  const resolvedType = type || 'movie';

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (resolvedStatus === 'watched' && (rating === undefined || rating === null || rating === '')) {
    res.status(400).json({ error: 'Rating is required for watched items' });
    return;
  }

  if (rating !== undefined && rating !== null && rating !== '' && (rating < 1 || rating > 10)) {
    res.status(400).json({ error: 'Rating must be between 1 and 10' });
    return;
  }

  const ratingValue = (rating === undefined || rating === '' ? null : rating);

  db.get(
    'SELECT id, status FROM movies WHERE title = ? AND type = ? LIMIT 1',
    [title, resolvedType],
    (dupErr, existing) => {
      if (dupErr) {
        res.status(500).json({ error: dupErr.message });
        return;
      }
      if (existing && existing.status !== resolvedStatus) {
        res.status(409).json({
          error: 'Title already exists with a different status',
          existingId: existing.id,
          currentStatus: existing.status,
          requestedStatus: resolvedStatus
        });
        return;
      }

      const query = `
        INSERT INTO movies (title, rating, genre, date_watched, notes, director, release_year, type, num_seasons, total_episodes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [title, ratingValue, genre, date_watched, notes, director, release_year, resolvedType, num_seasons, total_episodes, resolvedStatus], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json({ id: this.lastID, title, rating: ratingValue, genre, date_watched, notes, director, release_year, type: resolvedType, num_seasons, total_episodes, status: resolvedStatus });
      });
    }
  );
});

router.put('/movies/:id', (req, res) => {
  const { title, rating, genre, date_watched, notes, director, release_year, type, num_seasons, total_episodes, status } = req.body;
  const { id } = req.params;
  const resolvedStatus = status || 'watched';

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (resolvedStatus === 'watched' && (rating === undefined || rating === null || rating === '')) {
    res.status(400).json({ error: 'Rating is required for watched items' });
    return;
  }

  if (rating !== undefined && rating !== null && rating !== '' && (rating < 1 || rating > 10)) {
    res.status(400).json({ error: 'Rating must be between 1 and 10' });
    return;
  }

  const ratingValue = (rating === undefined || rating === '' ? null : rating);

  const query = `
    UPDATE movies
    SET title = ?, rating = ?, genre = ?, date_watched = ?, notes = ?, director = ?, release_year = ?, type = ?, num_seasons = ?, total_episodes = ?, status = ?
    WHERE id = ?
  `;

  db.run(query, [title, ratingValue, genre, date_watched, notes, director, release_year, type || 'movie', num_seasons, total_episodes, resolvedStatus, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Movie not found' });
      return;
    }
    res.json({ id, title, rating: ratingValue, genre, date_watched, notes, director, release_year, type: type || 'movie', num_seasons, total_episodes, status: resolvedStatus });
  });
});

router.delete('/movies/:id', (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM movies WHERE id = ?';

  db.run(query, [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Movie not found' });
      return;
    }
    res.json({ message: 'Movie deleted successfully' });
  });
});

router.get('/tv', (req, res) => {
  const { search, genre, minRating, maxRating, startDate, endDate, status, sortBy } = req.query;

  let query = 'SELECT * FROM movies WHERE type = ?';
  const params = ['tv'];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (title LIKE ? OR notes LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  if (minRating) {
    query += ' AND rating >= ?';
    params.push(minRating);
  }

  if (maxRating) {
    query += ' AND rating <= ?';
    params.push(maxRating);
  }

  if (startDate) {
    query += ' AND date_watched >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date_watched <= ?';
    params.push(endDate);
  }

  const sortClauses = {
    'most_recent': 'CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'highest_rated': 'rating DESC, CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'lowest_rated': 'rating ASC, CASE WHEN date_watched IS NULL THEN 1 ELSE 0 END, date_watched DESC',
    'title_asc': 'title ASC',
    'title_desc': 'title DESC'
  };
  query += ` ORDER BY ${sortClauses[sortBy] || sortClauses['most_recent']}`;

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/tv/analytics', (req, res) => {
  const queries = [
    "SELECT COUNT(*) as total FROM movies WHERE type = ? AND status = 'watched'",
    "SELECT AVG(rating) as avg_rating FROM movies WHERE type = ? AND status = 'watched'",
    "SELECT genre, COUNT(*) as count FROM movies WHERE type = ? AND status = 'watched' AND genre IS NOT NULL GROUP BY genre ORDER BY count DESC",
    "SELECT date_watched, COUNT(*) as count FROM movies WHERE type = ? AND status = 'watched' AND date_watched IS NOT NULL GROUP BY date_watched ORDER BY date_watched DESC"
  ];

  Promise.all(queries.map(q => new Promise((resolve, reject) => {
    db.all(q, ['tv'], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  })))
  .then(([total, avgRating, genreData, timelineData]) => {
    const topGenres = genreData.slice(0, 5);
    const recommendations = generateTVRecommendations(genreData);

    res.json({
      total: total[0].total,
      avgRating: avgRating[0].avg_rating ? Math.round(avgRating[0].avg_rating * 100) / 100 : 0,
      topGenres,
      timeline: timelineData,
      recommendations
    });
  })
  .catch(err => {
    res.status(500).json({ error: err.message });
  });
});

router.post('/tv', (req, res) => {
  const { title, rating, genre, date_watched, notes, num_seasons, total_episodes, release_year, status } = req.body;
  const resolvedStatus = status || 'watched';

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (resolvedStatus === 'watched' && (rating === undefined || rating === null || rating === '')) {
    res.status(400).json({ error: 'Rating is required for watched items' });
    return;
  }

  if (rating !== undefined && rating !== null && rating !== '' && (rating < 1 || rating > 10)) {
    res.status(400).json({ error: 'Rating must be between 1 and 10' });
    return;
  }

  const ratingValue = (rating === undefined || rating === '' ? null : rating);

  db.get(
    "SELECT id, status FROM movies WHERE title = ? AND type = 'tv' LIMIT 1",
    [title],
    (dupErr, existing) => {
      if (dupErr) {
        res.status(500).json({ error: dupErr.message });
        return;
      }
      if (existing && existing.status !== resolvedStatus) {
        res.status(409).json({
          error: 'Title already exists with a different status',
          existingId: existing.id,
          currentStatus: existing.status,
          requestedStatus: resolvedStatus
        });
        return;
      }

      const query = `
        INSERT INTO movies (title, rating, genre, date_watched, notes, type, num_seasons, total_episodes, release_year, status)
        VALUES (?, ?, ?, ?, ?, 'tv', ?, ?, ?, ?)
      `;

      db.run(query, [title, ratingValue, genre, date_watched, notes, num_seasons, total_episodes, release_year, resolvedStatus], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json({ id: this.lastID, title, rating: ratingValue, genre, date_watched, notes, type: 'tv', num_seasons, total_episodes, release_year, status: resolvedStatus });
      });
    }
  );
});

router.put('/tv/:id', (req, res) => {
  const { title, rating, genre, date_watched, notes, num_seasons, total_episodes, release_year, status } = req.body;
  const { id } = req.params;
  const resolvedStatus = status || 'watched';

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (resolvedStatus === 'watched' && (rating === undefined || rating === null || rating === '')) {
    res.status(400).json({ error: 'Rating is required for watched items' });
    return;
  }

  if (rating !== undefined && rating !== null && rating !== '' && (rating < 1 || rating > 10)) {
    res.status(400).json({ error: 'Rating must be between 1 and 10' });
    return;
  }

  const ratingValue = (rating === undefined || rating === '' ? null : rating);

  const query = `
    UPDATE movies
    SET title = ?, rating = ?, genre = ?, date_watched = ?, notes = ?, type = 'tv', num_seasons = ?, total_episodes = ?, release_year = ?, status = ?
    WHERE id = ? AND type = 'tv'
  `;

  db.run(query, [title, ratingValue, genre, date_watched, notes, num_seasons, total_episodes, release_year, resolvedStatus, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'TV series not found' });
      return;
    }
    res.json({ id, title, rating: ratingValue, genre, date_watched, notes, type: 'tv', num_seasons, total_episodes, release_year, status: resolvedStatus });
  });
});

router.delete('/tv/:id', (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM movies WHERE id = ? AND type = ?';

  db.run(query, [id, 'tv'], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'TV series not found' });
      return;
    }
    res.json({ message: 'TV series deleted successfully' });
  });
});

router.get('/recommendations', async (req, res) => {
  const { type = 'all', content = 'movie', refresh = 'false', model } = req.query;
  const shouldRefresh = refresh === 'true';

  try {
    const contentTypes = content === 'all' ? ['movie', 'tv'] : [content];
    const recommendationTypes = type === 'all' ? ['similar', 'hidden_gems'] : [type];

    const query = `SELECT * FROM movies WHERE type IN (${contentTypes.map(() => '?').join(',')}) AND status = 'watched'`;
    const params = contentTypes;

    // Wrap db.all in a promise
    const userMovies = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (shouldRefresh) {
      recommendationTypes.forEach(recType => {
        contentTypes.forEach(contentType => {
          ollamaRecommender.clearCache(contentType, recType, model);
        });
      });
    }

    // Enrich with the saved taste profile when one exists (falls back silently).
    const tasteRow = await readTasteProfile('all');
    let tasteProfile = null;
    if (tasteRow) {
      try { tasteProfile = JSON.parse(tasteRow.profile_json); } catch { tasteProfile = null; }
    }

    let allRecommendations = [];
    let aiError = null;

    for (const recType of recommendationTypes) {
      for (const contentType of contentTypes) {
        try {
          const result = await ollamaRecommender.generateRecommendations(
            userMovies,
            recType,
            contentType,
            model,
            { refresh: shouldRefresh, tasteProfile }
          );

          if (result.recommendations && result.recommendations.length > 0) {
            allRecommendations = allRecommendations.concat(
              result.recommendations.map(rec => ({
                ...rec,
                type: recType,
                contentType,
                cached: result.cached
              }))
            );
          }
        } catch (error) {
          aiError = error;
          console.error(`AI recommendation failed for ${contentType}/${recType}:`, error.message);
        }
      }
    }

    if (allRecommendations.length > 0) {
      res.json({
        recommendations: allRecommendations,
        source: 'ai',
        message: 'AI-powered recommendations based on your viewing history'
      });
    } else {
      const fallbackRecommendations = content === 'tv'
        ? generateTVRecommendationsFallback(userMovies)
        : generateRecommendationsFallback(userMovies);

      res.json({
        recommendations: fallbackRecommendations,
        source: 'simple',
        message: aiError
          ? 'AI recommendations failed — see details below.'
          : 'No AI recommendations yet. Try adding more movies or TV series!',
        aiErrorMessage: aiError ? aiError.message : null
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Taste Profile (persisted, user-initiated) -----------------------------

const tasteAnalyzer = require('../taste-analyzer');

function fetchWatched(type) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM movies WHERE type = ? AND status = 'watched'", [type], (err, rows) => {
      if (err) reject(err); else resolve(rows || []);
    });
  });
}

function readTasteProfile(scope = 'all') {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM taste_profiles WHERE scope = ?', [scope], (err, row) => {
      if (err) reject(err); else resolve(row || null);
    });
  });
}

function rowToProfileResponse(row, currentSignature) {
  if (!row) return { profile: null };
  let profile = null;
  try { profile = JSON.parse(row.profile_json); } catch { profile = null; }
  return {
    profile,
    model: row.model,
    generatedAt: row.generated_at,
    signature: row.library_signature,
    stale: currentSignature != null && row.library_signature !== currentSignature,
  };
}

router.get('/taste-profile', async (req, res) => {
  try {
    const [movies, tvSeries, row] = await Promise.all([
      fetchWatched('movie'),
      fetchWatched('tv'),
      readTasteProfile('all'),
    ]);
    const currentSignature = tasteAnalyzer.profileSignature(movies, tvSeries);
    res.json(rowToProfileResponse(row, currentSignature));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/taste-profile', async (req, res) => {
  const { model } = req.body || {};
  try {
    const [movies, tvSeries] = await Promise.all([fetchWatched('movie'), fetchWatched('tv')]);
    if (movies.length === 0 && tvSeries.length === 0) {
      return res.status(400).json({ error: 'Add some watched titles before analyzing your taste.' });
    }

    const { profile, model: usedModel, signature } =
      await tasteAnalyzer.generateTasteProfile(movies, tvSeries, model);

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO taste_profiles (scope, model, profile_json, library_signature, generated_at)
         VALUES ('all', ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(scope) DO UPDATE SET
           model = excluded.model,
           profile_json = excluded.profile_json,
           library_signature = excluded.library_signature,
           generated_at = CURRENT_TIMESTAMP`,
        [usedModel, JSON.stringify(profile), signature],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const row = await readTasteProfile('all');
    res.json(rowToProfileResponse(row, signature));
  } catch (error) {
    console.error('Taste analysis failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/assistant/chat', async (req, res) => {
  const { message, model, movies, tvSeries, analytics, history } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const tasteRow = await readTasteProfile('all');
    let tasteProfile = null;
    if (tasteRow) {
      try { tasteProfile = JSON.parse(tasteRow.profile_json); } catch { tasteProfile = null; }
    }
    const result = await assistant.generateResponse(message, movies || [], tvSeries || [], analytics || null, model, history || [], tasteProfile);
    res.json(result);
  } catch (error) {
    console.error('MILO assistant error:', error.message);
    res.status(500).json({ error: error.message, fallback: true });
  }
});

router.get('/analytics', (req, res) => {
  const { type } = req.query;
  const baseWhere = type ? "WHERE type = ? AND status = 'watched'" : "WHERE status = 'watched'";
  const typeParams = type ? [type] : [];

  const queries = [
    `SELECT COUNT(*) as total FROM movies ${baseWhere}`,
    `SELECT AVG(rating) as avg_rating FROM movies ${baseWhere}`,
    `SELECT genre, COUNT(*) as count FROM movies ${baseWhere} AND genre IS NOT NULL GROUP BY genre ORDER BY count DESC`,
    `SELECT date_watched, COUNT(*) as count FROM movies ${baseWhere} AND date_watched IS NOT NULL GROUP BY date_watched ORDER BY date_watched DESC`
  ];

  Promise.all(queries.map((q) => new Promise((resolve, reject) => {
    const params = typeParams;
    db.all(q, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  })))
  .then(([total, avgRating, genreData, timelineData]) => {
    const topGenres = genreData.slice(0, 5);
    const recommendations = type === 'tv' 
      ? generateTVRecommendations(genreData)
      : generateRecommendations(genreData);

    res.json({
      total: total[0].total,
      avgRating: avgRating[0].avg_rating ? Math.round(avgRating[0].avg_rating * 100) / 100 : 0,
      topGenres,
      timeline: timelineData,
      recommendations
    });
  })
  .catch(err => {
    res.status(500).json({ error: err.message });
  });
});

function generateRecommendations(genreData) {
  if (!genreData || genreData.length === 0) {
    return { message: 'Add more movies to get personalized recommendations!' };
  }

  const topGenre = genreData[0].genre;
  const genreBasedRecommendations = {
    'Action': 'The Dark Knight, Mad Max: Fury Road, John Wick, Mission Impossible, Die Hard',
    'Comedy': 'The Grand Budapest Hotel, Airplane!, Monty Python and the Holy Grail, Superbad, What We Do in the Shadows',
    'Drama': 'The Shawshank Redemption, The Godfather, Pulp Fiction, 12 Angry Men, Schindler\'s List',
    'Sci-Fi': 'Blade Runner, Inception, Interstellar, The Matrix, Arrival',
    'Horror': 'The Shining, Get Out, A Quiet Place, Hereditary, The Witch',
    'Thriller': 'Se7en, Silence of the Lambs, Zodiac, Prisoners, Gone Girl',
    'Romance': 'Eternal Sunshine of the Spotless Mind, Before Sunset, La La Land, The Notebook, Pride and Prejudice',
    'Animation': 'Spirited Away, Spider-Man: Into the Spider-Verse, Toy Story, Coco, Your Name',
    'Documentary': 'Planet Earth, Jiro Dreams of Sushi, The Social Dilemma, 13th, Free Solo',
    'Fantasy': 'The Lord of the Rings, Pan\'s Labyrinth, The Shape of Water, Harry Potter, The Princess Bride'
  };

  return {
    favoriteGenre: topGenre,
    suggestions: genreBasedRecommendations[topGenre] || 'Explore different genres to get recommendations!',
    message: `Based on your love for ${topGenre} movies, you might enjoy:`
  };
}

function generateTVRecommendations(genreData) {
  if (!genreData || genreData.length === 0) {
    return { message: 'Add more TV series to get personalized recommendations!' };
  }

  const topGenre = genreData[0].genre;
  const tvGenreBasedRecommendations = {
    'Action': "The Mandalorian, Game of Thrones, Vikings, The Boys, Peaky Blinders",
    'Comedy': "The Office, Parks & Recreation, Brooklyn Nine-Nine, It's Always Sunny in Philadelphia, Community",
    'Drama': "Breaking Bad, Better Call Saul, The Wire, Succession, The Sopranos",
    'Sci-Fi': "Stranger Things, Black Mirror, The Expanse, Westworld, Severance",
    'Horror': "The Haunting of Hill House, American Horror Story, Penny Dreadful, The Walking Dead",
    'Thriller': "Mindhunter, True Detective, The Killing, Hannibal, Ozark",
    'Romance': "Bridgerton, Outlander, Normal People, Love, Death & Robots, The Marvelous Mrs. Maisel",
    'Animation': "BoJack Horseman, Rick and Morty, Arcane, Avatar: The Last Airbender, Blue Eye Samurai",
    'Documentary': "Planet Earth, The Last Dance, Making a Murderer, Wild Wild Country, Chef's Table",
    'Fantasy': "Game of Thrones, The Witcher, His Dark Materials, Carnival Row, The Dark Crystal"
  };

  return {
    favoriteGenre: topGenre,
    suggestions: tvGenreBasedRecommendations[topGenre] || 'Explore different genres to get recommendations!',
    message: `Based on your love for ${topGenre} TV series, you might enjoy:`
  };
}

function generateRecommendationsFallback(userMovies) {
  if (!userMovies || userMovies.length === 0) {
    return [];
  }

  const genreCounts = {};
  userMovies.forEach(movie => {
    if (movie.genre) {
      genreCounts[movie.genre] = (genreCounts[movie.genre] || 0) + 1;
    }
  });

  const topGenre = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const genreBasedMovies = {
    'Action': [
      { title: 'John Wick 4', year: 2023, genre: 'Action', explanation: 'Intense action sequences and stylish choreography', confidence: 8 },
      { title: 'Mission: Impossible 7', year: 2023, genre: 'Action', explanation: 'High-stakes spy thriller with incredible stunts', confidence: 8 },
      { title: 'Extraction 2', year: 2023, genre: 'Action', explanation: 'Brutal fight scenes and non-stop adrenaline', confidence: 7 }
    ],
    'Comedy': [
      { title: 'Everything Everywhere All at Once', year: 2022, genre: 'Comedy', explanation: 'Mind-bending comedy with incredible heart', confidence: 9 },
      { title: 'The Menu', year: 2022, genre: 'Comedy', explanation: 'Dark comedy satire of fine dining culture', confidence: 8 }
    ],
    'Drama': [
      { title: 'The Holdovers', year: 2023, genre: 'Drama', explanation: 'Character-driven story with excellent performances', confidence: 8 },
      { title: 'Past Lives', year: 2023, genre: 'Drama', explanation: 'Beautiful exploration of love and destiny', confidence: 8 }
    ],
    'Sci-Fi': [
      { title: 'Dune: Part Two', year: 2024, genre: 'Sci-Fi', explanation: 'Epic sci-fi with stunning visuals and deep themes', confidence: 9 },
      { title: 'Poor Things', year: 2023, genre: 'Sci-Fi', explanation: 'Bizarre and brilliant sci-fi satire', confidence: 8 }
    ],
    'Horror': [
      { title: 'Talk to Me', year: 2023, genre: 'Horror', explanation: 'Fresh take on supernatural horror with real stakes', confidence: 8 },
      { title: 'Hereditary', year: 2018, genre: 'Horror', explanation: 'Psychological horror masterpiece', confidence: 9 }
    ],
    'Thriller': [
      { title: 'The Killer', year: 2023, genre: 'Thriller', explanation: 'Stylish assassin thriller with meticulous direction', confidence: 8 },
      { title: 'Saltburn', year: 2023, genre: 'Thriller', explanation: 'Twisted psychological thriller', confidence: 7 }
    ]
  };

  const recommendations = genreBasedMovies[topGenre] || [
    { title: 'Oppenheimer', year: 2023, genre: 'Drama', explanation: 'Historical epic with brilliant performances', confidence: 9 },
    { title: 'Barbie', year: 2023, genre: 'Comedy', explanation: 'Subversive comedy with surprising depth', confidence: 8 }
  ];

  return recommendations.map(rec => ({ ...rec, type: 'similar', contentType: 'movie', cached: true }));
}

function generateTVRecommendationsFallback(userTV) {
  if (!userTV || userTV.length === 0) {
    return [];
  }

  const genreCounts = {};
  userTV.forEach(tv => {
    if (tv.genre) {
      genreCounts[tv.genre] = (genreCounts[tv.genre] || 0) + 1;
    }
  });

  const topGenre = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const genreBasedTV = {
    'Action': [
      { title: 'Fallout', year: 2024, genre: 'Action', explanation: 'Gripping post-apocalyptic adventure', confidence: 9 },
      { title: 'Shogun', year: 2024, genre: 'Action', explanation: 'Epic historical drama with stunning production', confidence: 9 }
    ],
    'Comedy': [
      { title: 'The Bear', year: 2022, genre: 'Comedy', explanation: 'Intense workplace comedy with incredible depth', confidence: 9 },
      { title: 'Abbott Elementary', year: 2021, genre: 'Comedy', explanation: 'Heartwarming mockumentary about teaching', confidence: 8 }
    ],
    'Drama': [
      { title: 'Succession', year: 2018, genre: 'Drama', explanation: 'Brilliant family drama with sharp writing', confidence: 10 },
      { title: 'The Last of Us', year: 2023, genre: 'Drama', explanation: 'Emotional post-apocalyptic journey', confidence: 9 }
    ],
    'Sci-Fi': [
      { title: 'Severance', year: 2022, genre: 'Sci-Fi', explanation: 'Mind-bending workplace thriller', confidence: 9 },
      { title: '3 Body Problem', year: 2024, genre: 'Sci-Fi', explanation: 'Complex sci-fi adaptation', confidence: 8 }
    ],
    'Horror': [
      { title: 'Yellowjackets', year: 2021, genre: 'Horror', explanation: 'Psychological horror with survival mystery', confidence: 8 },
      { title: 'The Last of Us', year: 2023, genre: 'Horror', explanation: 'Emotional horror masterpiece', confidence: 9 }
    ]
  };

  const recommendations = genreBasedTV[topGenre] || [
    { title: 'True Detective', year: 2014, genre: 'Drama', explanation: 'Atmospheric crime anthology', confidence: 8 },
    { title: 'Black Mirror', year: 2011, genre: 'Sci-Fi', explanation: 'Thought-provoking tech anthology', confidence: 8 }
  ];

  return recommendations.map(rec => ({ ...rec, type: 'similar', contentType: 'tv', cached: true }));
}

router.post('/letterboxd/preview', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData = await letterboxdImporter.parseLetterboxdCSV(req.file.path);
    const result = await letterboxdImporter.processLetterboxdImport(csvData, false);

    fs.unlinkSync(req.file.path);

    res.json(result);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/letterboxd/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData = await letterboxdImporter.parseLetterboxdCSV(req.file.path);
    const result = await letterboxdImporter.processLetterboxdImport(csvData, false);

    if (result.toImport > 0) {
      await letterboxdImporter.importMovies(result.allMovies);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      ...result,
      imported: result.toImport
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/db/preview', upload.single('dbFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const rows = await dbImporter.parseMiloDb(req.file.path);
    const result = await dbImporter.processDbImport(rows);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/db/import', upload.single('dbFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const rows = await dbImporter.parseMiloDb(req.file.path);
    const result = await dbImporter.processDbImport(rows);
    if (result.toImport > 0) {
      await dbImporter.importRows(result.allMovies);
    }
    fs.unlinkSync(req.file.path);
    res.json({ ...result, imported: result.toImport });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;