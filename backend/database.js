const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'movies.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      rating REAL CHECK(rating IS NULL OR (rating >= 1 AND rating <= 10)),
      genre TEXT,
      date_watched TEXT,
      notes TEXT,
      director TEXT,
      release_year INTEGER,
      type TEXT DEFAULT 'movie',
      num_seasons INTEGER,
      total_episodes INTEGER,
      status TEXT NOT NULL DEFAULT 'watched',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Movies table ready');
      migrateDatabase();
      ensureTasteProfilesTable();
      ensureRecFeedbackTable();
    }
  });
}

// Persisted Taste Profile artifact (one row per scope; 'all' = unified movies+TV).
// Idempotent — safe to run on every startup.
function ensureTasteProfilesTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS taste_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL DEFAULT 'all' UNIQUE,
      model TEXT,
      profile_json TEXT NOT NULL,
      library_signature TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating taste_profiles table:', err.message);
    } else {
      console.log('Taste profiles table ready');
    }
  });
}

// Feedback on AI recommendations (mirrors supabase/migrations/0007_rec_feedback.sql
// minus user_id). One row per (normalized_title, content_type); re-reacting upserts.
// Idempotent — safe to run on every startup.
function ensureRecFeedbackTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS rec_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'movie',
      feedback TEXT NOT NULL CHECK(feedback IN ('interested', 'not_for_me', 'seen_it')),
      year INTEGER,
      genre TEXT,
      rec_type TEXT,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (normalized_title, content_type)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating rec_feedback table:', err.message);
    } else {
      console.log('Rec feedback table ready');
    }
  });
}

function migrateDatabase() {
  db.all("PRAGMA table_info(movies)", [], (err, columns) => {
    if (err) {
      console.error('Error checking table columns:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);
    const ratingCol = columns.find(col => col.name === 'rating');
    const needsMigration = !columnNames.includes('director') ||
                          columns.find(col => col.name === 'rating' && col.type === 'INTEGER') ||
                          !columnNames.includes('type') ||
                          !columnNames.includes('num_seasons') ||
                          !columnNames.includes('total_episodes') ||
                          !columnNames.includes('release_year') ||
                          !columnNames.includes('status') ||
                          (ratingCol && ratingCol.notnull === 1);

    const checkDateWatchedConstraint = (callback) => {
      db.run("INSERT INTO movies (title, rating, date_watched) VALUES ('_migration_test', 1, NULL)", function(err) {
        if (err) {
          if (err.message.includes('NOT NULL')) {
            callback(true);
          } else {
            callback(false);
          }
        } else {
          db.run("DELETE FROM movies WHERE title = '_migration_test'", () => {
            callback(false);
          });
        }
      });
    };

    checkDateWatchedConstraint((hasNotNullConstraint) => {
      if (!needsMigration && !hasNotNullConstraint) {
        recoverTvTypes();
      }
      if (needsMigration || hasNotNullConstraint) {
        console.log('Running database migration...');

        db.run('DROP TABLE IF EXISTS movies_new', (err) => {
          if (err) {
            console.error('Error dropping existing movies_new table:', err.message);
            return;
          }

          db.run(`
            CREATE TABLE movies_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              rating REAL CHECK(rating IS NULL OR (rating >= 1 AND rating <= 10)),
              genre TEXT,
              date_watched TEXT,
              notes TEXT,
              director TEXT,
              release_year INTEGER,
              type TEXT DEFAULT 'movie',
              num_seasons INTEGER,
              total_episodes INTEGER,
              status TEXT NOT NULL DEFAULT 'watched',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('Error creating new table:', err.message);
              return;
            }

            const targetCols = ['id', 'title', 'rating', 'genre', 'date_watched', 'notes', 'director', 'release_year', 'type', 'num_seasons', 'total_episodes', 'status', 'created_at'];
            const has = (c) => columnNames.includes(c);
            const sourceExpr = (col) => {
              if (col === 'type') {
                return has('type') ? "COALESCE(type, 'movie')" : "'movie'";
              }
              if (col === 'status') {
                return has('status') ? "COALESCE(status, 'watched')" : "'watched'";
              }
              if (['director', 'release_year', 'num_seasons', 'total_episodes'].includes(col)) {
                return has(col) ? col : 'NULL';
              }
              return col;
            };
            const selectList = targetCols.map(sourceExpr).join(', ');
            const insertList = targetCols.join(', ');

            db.run(`
              INSERT INTO movies_new (${insertList})
              SELECT ${selectList}
              FROM movies
            `, (err) => {
              if (err) {
                console.error('Error copying data:', err.message);
                return;
              }

              db.run('DROP TABLE movies', (err) => {
                if (err) {
                  console.error('Error dropping old table:', err.message);
                  return;
                }

                db.run('ALTER TABLE movies_new RENAME TO movies', (err) => {
                  if (err) {
                    console.error('Error renaming table:', err.message);
                    return;
                  }
                  console.log('Database migration completed successfully');
                  recoverTvTypes();
                });
              });
            });
          });
        });
      }
    });
  });
}

function recoverTvTypes() {
  db.run(
    `UPDATE movies
       SET type = 'tv'
     WHERE type = 'movie'
       AND (num_seasons IS NOT NULL OR total_episodes IS NOT NULL)`,
    function (err) {
      if (err) {
        console.error('Error recovering TV types:', err.message);
        return;
      }
      if (this.changes > 0) {
        console.log(`Recovered ${this.changes} row(s) misclassified as movies back to TV series`);
      }
    }
  );
}

module.exports = db;