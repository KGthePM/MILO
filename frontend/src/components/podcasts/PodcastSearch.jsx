import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Mic } from 'lucide-react';
import { searchPodcasts } from '../../api/podcastLookup';

// Lookup against the iTunes Search API. Purely additive: it fills the form
// below, and every failure is surfaced as a dismissible hint rather than an
// error state, so the form stays usable by hand if lookup is unavailable.
// Shared by the Add and Edit modals; `initialTerm` lets the Edit modal seed
// the box with the podcast's own title so matches are already listed on open.
export default function PodcastSearch({ onPick, initialTerm = '' }) {
  const [term, setTerm] = useState(initialTerm);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    setFailed(false);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const found = await searchPodcasts(q, { signal: controller.signal, limit: 8 });
        setResults(found);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setResults([]);
        setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [term]);

  // Abort any in-flight lookup when the modal closes mid-request.
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="mb-5 pb-5 border-b border-white/10">
      <label className="block text-sm font-medium mb-2 text-white/80">
        Find a podcast <span className="text-white/40 font-normal">— or just fill it in below</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-lg glass"
          placeholder="Search by show name..."
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-neon-purple animate-spin" size={18} />
        )}
      </div>

      {failed && (
        <p className="mt-2 text-xs text-amber-300/80">
          Couldn't reach the podcast directory. Fill in the details below instead.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-1 max-h-56 overflow-y-auto">
          {results.map((r) => (
            <li key={r.itunesId}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setTerm('');
                  setResults([]);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-neon-purple/15 transition-colors"
              >
                {r.artwork_url ? (
                  <img src={r.artwork_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-neon-purple/10 flex items-center justify-center flex-shrink-0">
                    <Mic size={16} className="text-neon-purple/70" />
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{r.title}</span>
                  <span className="block text-xs text-white/50 truncate">{r.host}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
