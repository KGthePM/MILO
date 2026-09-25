import { useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, FileDown, Loader2, AlertCircle, Check, BookOpen } from 'lucide-react';
import { useBooks } from '../../utils/BookContext';
import { bookApi } from '../../api/bookApi';
import { parseGoodreadsCSV, processGoodreadsRows, enrichWithOpenLibrary } from '../../api/goodreadsClient';
import { CONTENT_TYPES } from '../../utils/contentTypes';

const BOOK = CONTENT_TYPES.book;

// Goodreads library import. Three beats: pick the export, see exactly what will
// and won't come across (and why), then import — covers are looked up on the
// way in, so the shelf lands looking like a shelf rather than a wall of
// placeholder tiles.
export default function GoodreadsImportModal({ isOpen, onClose }) {
  const { books, refreshBooks } = useBooks();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | parsing | covers | saving | done
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [imported, setImported] = useState(0);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const busy = phase === 'parsing' || phase === 'covers' || phase === 'saving';

  const reset = () => {
    setFile(null);
    setRows(null);
    setPreview(null);
    setPhase('idle');
    setProgress({ done: 0, total: 0 });
    setImported(0);
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.csv')) {
      setError('Please pick the .csv file Goodreads exported.');
      return;
    }
    setFile(picked);
    setError(null);
    setPhase('parsing');
    try {
      const parsed = await parseGoodreadsCSV(picked);
      setRows(parsed);
      setPreview(processGoodreadsRows(parsed, books));
      setPhase('idle');
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      setFile(null);
      setPhase('idle');
    }
  };

  const handleImport = async () => {
    if (!preview?.allBooks.length) return;
    setError(null);
    try {
      setPhase('covers');
      const enriched = await enrichWithOpenLibrary(preview.allBooks, (done, total) =>
        setProgress({ done, total })
      );
      setPhase('saving');
      const result = await bookApi.importBooks(enriched);
      setImported(result.imported);
      await refreshBooks();
      setPhase('done');
    } catch (err) {
      // A cloud import inserts in chunks, so it can stop partway. Re-check the
      // file against the library as it is now, so pressing Import again only
      // adds what's still missing instead of duplicating what already landed.
      try {
        setPreview(processGoodreadsRows(rows, await bookApi.getBooks()));
        refreshBooks();
      } catch { /* keep the old preview */ }
      setError(`Import stopped partway: ${err.message || 'unknown error'}. Anything already added is now skipped — press Import to finish.`);
      setPhase('idle');
    }
  };

  const skipped = preview
    ? [
        preview.unrated && { n: preview.unrated, why: `marked read but unrated — MILO needs a rating, so add those by hand` },
        preview.duplicates && { n: preview.duplicates, why: 'already in your MILO library' },
        preview.otherShelf && { n: preview.otherShelf, why: 'on a custom shelf (like DNF)' },
      ].filter(Boolean)
    : [];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto neon-border-orange"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-orange/20 rounded-lg">
              <BookOpen size={22} className="text-neon-orange" />
            </div>
            <h2 className="text-2xl font-bold neon-text-orange">Import from Goodreads</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="text-white/70 hover:text-white transition-colors disabled:opacity-40"
          >
            <X size={24} />
          </button>
        </div>

        {phase === 'done' ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-orange/40 bg-black/40">
              <Check size={26} className="text-neon-orange" />
            </div>
            <h3 className="text-xl font-bold neon-text-orange">
              {imported} book{imported === 1 ? '' : 's'} on your shelf
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Your taste profile will pick them up the next time it refreshes.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-6 py-2.5 rounded-lg bg-neon-orange/20 border border-neon-orange/50 text-neon-orange font-semibold hover:bg-neon-orange/30 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {!file ? (
              <>
                <label
                  htmlFor="goodreads-file"
                  className="block border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-neon-orange/50 transition-colors cursor-pointer"
                >
                  <input id="goodreads-file" type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
                  <FileDown size={44} className="mx-auto text-neon-orange mb-3" />
                  <p className="text-white font-semibold">Choose your Goodreads export</p>
                  <p className="text-white/50 text-sm mt-1">
                    <code>goodreads_library_export.csv</code>
                  </p>
                </label>
                <p className="text-white/40 text-xs leading-relaxed">
                  In Goodreads: <span className="text-white/60">My Books → Import and export → Export Library</span>.
                  Goodreads emails or shows a link to the file when it's ready.
                </p>
              </>
            ) : (
              <div className="glass rounded-lg p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-white text-sm truncate">
                  <FileDown size={18} className="text-neon-orange shrink-0" />
                  <span className="truncate">{file.name}</span>
                </span>
                {!busy && (
                  <button onClick={reset} className="text-white/50 hover:text-white" title="Choose a different file">
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {phase === 'parsing' && (
              <div className="flex items-center justify-center py-6 text-white/70">
                <Loader2 className="animate-spin text-neon-orange mr-3" size={24} /> Reading your library…
              </div>
            )}

            {preview && phase !== 'parsing' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-lg p-4">
                    <div className="text-2xl font-bold text-neon-orange">{preview.read}</div>
                    <div className="text-white/60 text-sm">{BOOK.verb}, with ratings</div>
                  </div>
                  <div className="glass rounded-lg p-4">
                    <div className="text-2xl font-bold text-amber-300">{preview.toRead}</div>
                    <div className="text-white/60 text-sm">to your {BOOK.verbTo} list</div>
                  </div>
                </div>
                <p className="-mt-2 text-white/40 text-xs">
                  Currently-reading books go on the {BOOK.verbTo} list. Star ratings are doubled onto MILO's 1–10 scale.
                </p>

                {skipped.length > 0 && (
                  <ul className="space-y-1 text-sm text-white/50">
                    {skipped.map(({ n, why }) => (
                      <li key={why}>
                        <span className="text-white/70 font-medium">{n}</span> skipped: {why}
                      </li>
                    ))}
                  </ul>
                )}

                {preview.preview.length > 0 && (
                  <div className="glass rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {preview.preview.map((b) => (
                          <tr key={b.title} className="border-t border-white/10 first:border-t-0">
                            <td className="p-3">
                              <div className="text-white line-clamp-1">{b.title}</div>
                              {b.author && <div className="text-white/40 text-xs line-clamp-1">{b.author}</div>}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {b.rating != null ? (
                                <span className="text-neon-orange font-semibold">{b.rating}/10</span>
                              ) : (
                                <span className="text-amber-300/80 text-xs">{BOOK.verbTo}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {preview.toImport === 0 && (
                  <p className="text-amber-200/80 text-sm">Nothing new to import from this file.</p>
                )}
              </>
            )}

            {(phase === 'covers' || phase === 'saving') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Loader2 className="animate-spin text-neon-orange" size={16} />
                  {phase === 'covers'
                    ? `Finding covers… ${progress.done}/${progress.total}`
                    : 'Adding books to your shelf…'}
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-neon-orange/70 transition-all"
                    style={{
                      width: phase === 'saving'
                        ? '100%'
                        : `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClose}
                disabled={busy}
                className="flex-1 px-6 py-3 rounded-lg glass text-white/70 hover:text-white hover:bg-white/10 font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || preview.toImport === 0 || busy}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-neon-orange/20 border border-neon-orange/50 text-neon-orange font-semibold hover:bg-neon-orange/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={18} />
                Import {preview?.toImport || 0} book{preview?.toImport === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
