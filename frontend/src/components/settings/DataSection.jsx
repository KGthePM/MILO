import { useState } from 'react';
import { Upload, Database, Download, LogOut, LogIn, Film, Tv, Mic, BookOpen, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import LetterboxdImportModal from '../LetterboxdImportModal';
import { useMovies } from '../../utils/MovieContext';
import { IS_CLOUD } from '../../utils/mode';
import { getSupabase } from '../../utils/supabase';
import { api as movieApi } from '../../api/movieApi';
import { tvApi } from '../../api/tvApi';
import { podcastApi } from '../../api/podcastApi';
import { bookApi } from '../../api/bookApi';
import { TMDB_ENABLED } from '../../api/tmdbLookup';
import tmdbLogo from '../../assets/tmdb-logo.svg';

// Base columns shared by every export; each content type appends its own.
const BASE_EXPORT_COLUMNS = ['title', 'rating', 'genre', 'date_watched', 'notes', 'status'];
const EXPORT_COLUMNS = {
  movies: [...BASE_EXPORT_COLUMNS, 'director', 'release_year'],
  tv: [...BASE_EXPORT_COLUMNS, 'num_seasons', 'total_episodes'],
  podcasts: [...BASE_EXPORT_COLUMNS, 'host', 'publisher', 'episodes_heard'],
  books: [...BASE_EXPORT_COLUMNS, 'author', 'release_year', 'pages_read', 'page_count'],
};

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows, columns) {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsvValue(row[c])).join(',')).join('\n');
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export default function DataSection({ session, onSignOut }) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(null); // 'movies' | 'tv' | 'podcasts' | 'books' | null
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { fetchMovies } = useMovies();

  const handleExport = async (kind) => {
    setExportError('');
    setExporting(kind);
    try {
      const rows = kind === 'movies'
        ? await movieApi.getMovies({ type: 'movie' })
        : kind === 'tv'
        ? await tvApi.getSeries()
        : kind === 'podcasts'
        ? await podcastApi.getPodcasts()
        : await bookApi.getBooks();
      const csv = rowsToCsv(rows || [], EXPORT_COLUMNS[kind]);
      triggerDownload(`milo-${kind}-${todayStamp()}.csv`, csv);
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err?.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      const { error } = await getSupabase().rpc('delete_my_account', { p_confirm: 'DELETE' });
      if (error) throw error;
      onSignOut();
    } catch (err) {
      setDeleteError(err?.message || 'Account deletion failed');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h3 className="text-white font-semibold mb-2">Import</h3>
        <p className="text-white/60 text-sm mb-4">
          Bring in ratings from Letterboxd or restore from a MILO database file.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-cyan/50 transition-all text-left"
          >
            <Upload size={22} className="text-neon-cyan shrink-0" />
            <div>
              <div className="text-white font-medium">Letterboxd CSV</div>
              <div className="text-white/50 text-xs">Import ratings.csv export</div>
            </div>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-cyan/50 transition-all text-left"
          >
            <Database size={22} className="text-neon-cyan shrink-0" />
            <div>
              <div className="text-white font-medium">MILO database</div>
              <div className="text-white/50 text-xs">Import .db / .sqlite file</div>
            </div>
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-2">Export</h3>
        <p className="text-white/60 text-sm mb-4">
          Download your library as CSV. Opens in any spreadsheet app and re-imports cleanly.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleExport('movies')}
            disabled={exporting !== null}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-magenta/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Film size={22} className="text-neon-magenta shrink-0" />
            <div>
              <div className="text-white font-medium">
                {exporting === 'movies' ? 'Exporting…' : 'Movies CSV'}
              </div>
              <div className="text-white/50 text-xs">Download all movies</div>
            </div>
            <Download size={18} className="ml-auto text-white/40 shrink-0" />
          </button>
          <button
            onClick={() => handleExport('tv')}
            disabled={exporting !== null}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-magenta/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Tv size={22} className="text-neon-magenta shrink-0" />
            <div>
              <div className="text-white font-medium">
                {exporting === 'tv' ? 'Exporting…' : 'TV CSV'}
              </div>
              <div className="text-white/50 text-xs">Download all TV series</div>
            </div>
            <Download size={18} className="ml-auto text-white/40 shrink-0" />
          </button>
          <button
            onClick={() => handleExport('podcasts')}
            disabled={exporting !== null}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-purple/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic size={22} className="text-neon-purple shrink-0" />
            <div>
              <div className="text-white font-medium">
                {exporting === 'podcasts' ? 'Exporting…' : 'Podcasts CSV'}
              </div>
              <div className="text-white/50 text-xs">Download all podcasts</div>
            </div>
            <Download size={18} className="ml-auto text-white/40 shrink-0" />
          </button>
          <button
            onClick={() => handleExport('books')}
            disabled={exporting !== null}
            className="flex items-center gap-3 p-4 rounded-lg glass border border-white/10 hover:border-neon-orange/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookOpen size={22} className="text-neon-orange shrink-0" />
            <div>
              <div className="text-white font-medium">
                {exporting === 'books' ? 'Exporting…' : 'Books CSV'}
              </div>
              <div className="text-white/50 text-xs">Download all books</div>
            </div>
            <Download size={18} className="ml-auto text-white/40 shrink-0" />
          </button>
        </div>
        {exportError && (
          <p className="mt-3 text-sm text-red-400">{exportError}</p>
        )}
      </section>

      {IS_CLOUD && (
        <section>
          <h3 className="text-white font-semibold mb-2">Account</h3>
          {session ? (
            <div className="flex items-center justify-between p-4 rounded-lg glass border border-white/10">
              <div>
                <div className="text-white/50 text-xs">Signed in as</div>
                <div className="text-white font-medium">{session.user?.email}</div>
              </div>
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-white hover:bg-cyan-500/30"
            >
              <LogIn size={16} /> Sign in
            </Link>
          )}
          {session && !deleteConfirmOpen && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="mt-3 w-full flex items-center gap-3 p-4 rounded-lg glass border border-red-500/20 hover:border-red-500/50 transition-all text-left"
            >
              <Trash2 size={20} className="text-red-400 shrink-0" />
              <div>
                <div className="text-white font-medium">Delete account</div>
                <div className="text-white/50 text-xs">Permanently remove your account and all MILO data</div>
              </div>
            </button>
          )}
          {session && deleteConfirmOpen && (
            <div className="mt-3 p-4 rounded-lg border border-red-500/40 bg-red-500/5 space-y-3">
              <div className="flex items-center gap-2 text-red-300 text-sm font-medium">
                <AlertTriangle size={16} /> Delete your account permanently?
              </div>
              <p className="text-white/60 text-sm">
                This erases your profile, friends, ratings, watchlist, taste profile, and AI feedback —
                immediately and unrecoverably. Export your library first if you want a copy.
              </p>
              <label className="block">
                <span className="text-white/70 text-sm">Type DELETE to confirm</span>
                <input
                  type="text"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1 w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-red-500 outline-none"
                />
              </label>
              {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setDeleteConfirmOpen(false); setDeletePhrase(''); setDeleteError(''); }}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deletePhrase.trim() !== 'DELETE'}
                  className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TMDB's API terms require its notice whenever the movie/TV lookup is
          enabled. Open Library (book lookup) is always on and asks for credit. */}
      <section>
        <h3 className="text-white font-semibold mb-2">Credits</h3>
        <div className="space-y-2">
          {TMDB_ENABLED && (
            <div className="flex items-center gap-4 p-4 rounded-lg glass border border-white/10">
              <img src={tmdbLogo} alt="TMDB" className="h-4 w-auto shrink-0" />
              <p className="text-white/50 text-xs">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
            </div>
          )}
          <div className="flex items-center gap-4 p-4 rounded-lg glass border border-white/10">
            <BookOpen size={16} className="text-neon-orange shrink-0" />
            <p className="text-white/50 text-xs">
              Book data and covers from Open Library (openlibrary.org), a project of the Internet Archive.
            </p>
          </div>
        </div>
      </section>

      <LetterboxdImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => fetchMovies()}
      />
    </div>
  );
}
