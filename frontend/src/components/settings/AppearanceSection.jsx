import { useState } from 'react';
import { RotateCcw, PlayCircle, Lightbulb } from 'lucide-react';
import { loadUserPrefs, saveUserPrefs, setIntroSeen, resetHints } from '../../utils/userPrefs';
import { DEFAULT_GENRE_COLORS, GENRE_LIST } from '../../utils/genreColors';

export default function AppearanceSection() {
  const [prefs, setPrefs] = useState(loadUserPrefs());

  // Merge onto a fresh read, not this component's copy: onboarding state in
  // the same prefs object changes elsewhere (hints, the reel) while this tab
  // is open, and writing back a stale copy would silently undo it.
  const update = (next) => {
    const merged = { ...loadUserPrefs(), genreColors: next.genreColors };
    setPrefs(merged);
    saveUserPrefs(merged);
  };
  const [tipsReset, setTipsReset] = useState(false);

  const setGenreColor = (genre, color) => {
    update({
      ...prefs,
      genreColors: { ...prefs.genreColors, [genre]: color },
    });
  };

  const resetGenre = (genre) => {
    const next = { ...prefs.genreColors };
    delete next[genre];
    update({ ...prefs, genreColors: next });
  };

  const resetAllGenres = () => update({ ...prefs, genreColors: {} });

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Genre glow colors</h3>
          <button
            onClick={resetAllGenres}
            className="flex items-center gap-1 text-white/50 hover:text-white text-xs"
          >
            <RotateCcw size={12} /> Reset all
          </button>
        </div>
        <p className="text-white/60 text-sm mb-4">
          Each genre's border + glow on movie cards. Click a swatch to pick a custom color.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GENRE_LIST.map((genre) => {
            const current = prefs.genreColors[genre] || DEFAULT_GENRE_COLORS[genre];
            const isOverridden = !!prefs.genreColors[genre];
            return (
              <div
                key={genre}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10"
                style={{ boxShadow: `0 0 10px ${current}55` }}
              >
                <input
                  type="color"
                  value={current}
                  onChange={(e) => setGenreColor(genre, e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer bg-transparent border border-white/20"
                  title={`${genre} color`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{genre}</div>
                  <div className="text-white/40 text-xs font-mono">{current}</div>
                </div>
                {isOverridden && (
                  <button
                    onClick={() => resetGenre(genre)}
                    className="text-white/50 hover:text-white text-xs flex items-center gap-1"
                    title="Reset to default"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-2">Guidance</h3>
        <p className="text-white/60 text-sm mb-4">
          Rewatch the intro, or bring back the one-time tips that point out features as you reach them.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIntroSeen(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/10 text-white/80 hover:text-white hover:bg-white/10 text-sm transition-all"
          >
            <PlayCircle size={16} /> Replay intro
          </button>
          <button
            onClick={() => { resetHints(); setTipsReset(true); }}
            disabled={tipsReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/10 text-white/80 hover:text-white hover:bg-white/10 text-sm transition-all disabled:opacity-60 disabled:cursor-default"
          >
            <Lightbulb size={16} /> {tipsReset ? 'Tips will show again' : 'Show tips again'}
          </button>
        </div>
      </section>
    </div>
  );
}
