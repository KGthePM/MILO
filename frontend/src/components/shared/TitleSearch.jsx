import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { accentFor, iconFor } from '../../utils/contentTypes';

// Debounced "Find a title" box shared by the podcast (iTunes) and movie/TV
// (TMDB) Add and Edit modals. Purely additive: it fills the form below, and
// every failure is surfaced as a quiet hint rather than an error state, so the
// form stays usable by hand if lookup is unavailable.
//
// - `search(term, { signal, limit })` returns raw results; `toRow(result)`
//   maps one to `{ key, thumb, title, subtitle }` for display.
// - `onPick(result)` may return a promise (movie/TV fetch details on pick);
//   the picked row shows a spinner until it settles.
// - `initialTerm` lets the Edit modals seed the box with the record's own
//   title so matches are already listed on open.
export default function TitleSearch({
  contentType,
  search,
  toRow,
  onPick,
  initialTerm = '',
  label,
  placeholder,
  failMessage,
  footnote,
}) {
  const accent = accentFor(contentType);
  const FallbackIcon = iconFor(contentType);
  const [term, setTerm] = useState(initialTerm);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);
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
        const found = await search(q, { signal: controller.signal, limit: 8 });
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
  }, [term, search]);

  // Abort any in-flight lookup when the modal closes mid-request.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handlePick = async (result, key) => {
    setPendingKey(key);
    try {
      await onPick(result);
    } finally {
      setPendingKey(null);
      setTerm('');
      setResults([]);
    }
  };

  return (
    <div className="mb-5 pb-5 border-b border-white/10">
      <label className="block text-sm font-medium mb-2 text-white/80">
        {label} <span className="text-white/40 font-normal">— or just fill it in below</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-lg glass"
          placeholder={placeholder}
        />
        {loading && (
          <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${accent.text}`} size={18} />
        )}
      </div>

      {failed && (
        <p className="mt-2 text-xs text-amber-300/80">{failMessage}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-1 max-h-56 overflow-y-auto">
          {results.map((r) => {
            const row = toRow(r);
            const isPending = pendingKey === row.key;
            return (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={pendingKey !== null}
                  onClick={() => handlePick(r, row.key)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors disabled:cursor-wait ${accent.rowHover}`}
                >
                  {row.thumb ? (
                    <img src={row.thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${accent.tileSoft}`}>
                      <FallbackIcon size={16} className={accent.iconSoft} />
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white truncate">{row.title}</span>
                    {row.subtitle && (
                      <span className="block text-xs text-white/50 truncate">{row.subtitle}</span>
                    )}
                  </span>
                  {isPending && (
                    <Loader2 className={`animate-spin flex-shrink-0 ${accent.text}`} size={16} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {footnote && <p className="mt-2 text-[11px] text-white/30">{footnote}</p>}
    </div>
  );
}
