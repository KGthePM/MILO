import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { isContentType } from '../utils/contentTypes';

const IMPORTABLE_COLUMNS = [
  'title',
  'rating',
  'genre',
  'date_watched',
  'notes',
  'director',
  'release_year',
  'type',
  'num_seasons',
  'total_episodes',
  'host',
  'publisher',
  'episodes_heard',
  'artwork_url',
];

let _SQL = null;
async function getSQL() {
  if (_SQL) return _SQL;
  const initSqlJs = (await import('sql.js')).default;
  _SQL = await initSqlJs({ locateFile: () => wasmUrl });
  return _SQL;
}

// Falls back to 'movie' only for genuinely unknown values. Checking against the
// registry (rather than `t === 'tv' ? 'tv' : 'movie'`) is what keeps a third
// content type from being silently imported as a movie.
export function normalizeType(t) {
  return isContentType(t) ? t : 'movie';
}

export async function parseMiloDb(file) {
  const SQL = await getSQL();
  const buf = new Uint8Array(await file.arrayBuffer());
  let database;
  try {
    database = new SQL.Database(buf);
  } catch (e) {
    throw new Error('File is not a valid SQLite database.');
  }

  const tableCheck = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='movies'"
  );
  if (tableCheck.length === 0) {
    database.close();
    throw new Error('Source database does not contain a `movies` table.');
  }

  const infoRes = database.exec('PRAGMA table_info(movies)');
  const availableCols = new Set(infoRes[0].values.map((row) => row[1]));
  if (!availableCols.has('title') || !availableCols.has('rating')) {
    database.close();
    throw new Error('Source `movies` table is missing required columns (title, rating).');
  }

  const selectList = IMPORTABLE_COLUMNS
    .map((c) => (availableCols.has(c) ? c : `NULL AS ${c}`))
    .join(', ');

  const res = database.exec(
    `SELECT ${selectList} FROM movies WHERE title IS NOT NULL AND title != '_migration_test'`
  );
  database.close();

  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((vals) => {
    const obj = {};
    columns.forEach((c, idx) => {
      obj[c] = vals[idx];
    });
    return obj;
  });
}

export function processDbRows(rows, existingKeys = new Set()) {
  const toImport = [];
  const duplicates = [];
  const skipped = [];
  const seen = new Set(existingKeys);

  for (const row of rows) {
    const title = row.title && String(row.title).trim();
    if (!title) {
      skipped.push({ reason: 'Missing title' });
      continue;
    }
    const rating = parseFloat(row.rating);
    if (isNaN(rating) || rating < 1 || rating > 10) {
      skipped.push({ title, reason: 'Invalid rating' });
      continue;
    }
    const type = normalizeType(row.type);
    const key = `${title} ${type}`;
    if (seen.has(key)) {
      duplicates.push({ title, type });
      continue;
    }
    seen.add(key);
    toImport.push({
      title,
      rating,
      genre: row.genre || '',
      date_watched: row.date_watched || null,
      notes: row.notes || '',
      director: row.director || '',
      release_year: row.release_year != null ? Number(row.release_year) || null : null,
      type,
      num_seasons: row.num_seasons != null ? Number(row.num_seasons) || null : null,
      total_episodes: row.total_episodes != null ? Number(row.total_episodes) || null : null,
      host: row.host || null,
      publisher: row.publisher || null,
      episodes_heard: row.episodes_heard != null ? Number(row.episodes_heard) || null : null,
      artwork_url: row.artwork_url || null,
    });
  }

  return {
    totalInCSV: rows.length,
    skippedNoRating: skipped.length,
    duplicates: duplicates.length,
    toImport: toImport.length,
    preview: toImport.slice(0, 5),
    allMovies: toImport,
  };
}
