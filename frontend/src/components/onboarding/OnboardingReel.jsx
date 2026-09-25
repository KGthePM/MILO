import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search, ThumbsUp, ThumbsDown, EyeOff, Sparkles, ArrowRight, ArrowLeft,
  CalendarDays, Palette, Users, ShieldCheck, Download, KeyRound,
} from 'lucide-react';
import NeonHorizon from '../shared/NeonHorizon';
import useOnboarding from './useOnboarding';
import { setIntroSeen } from '../../utils/userPrefs';
import { CONTENT_TYPES, CONTENT_TYPE_KEYS, accentFor, iconFor } from '../../utils/contentTypes';
import { loadAISettings, getActiveKey } from '../../utils/aiSettings';
import { IS_CLOUD } from '../../utils/mode';
import { IS_NATIVE } from '../../utils/native';
import miloIcon from '/milo-ai-icon.jpeg';

// First-launch intro reel. Five cards over the same canvas deep-field as the
// sign-in screen, so the sign-in warp lands straight into it rather than into
// a popup. It sells ideas rather than touring live UI: a brand-new library is
// empty, so pointing at real controls would point at nothing. The per-feature
// "you are here" moments are DiscoveryHint's job.
//
// Cards are solid translucent panels, deliberately not `.glass` — a
// backdrop-filter over the moving horizon would recomposite every frame
// (DESIGN.md §2). The accents appear only where they mean a content type; the
// reel's own chrome uses the four-type gradient, which reads as "all of MILO".

const STEP_COUNT = 5;
const SWIPE_PX = 60;
const SWIPE_VELOCITY = 400;

// Real prompts from AssistantModal's quick actions, so the demo is honest.
const ASSISTANT_DEMO_CHIPS = ['Analyze my taste', 'Recommend hidden gems', 'What should I read next?'];

function aiNeedsSetup() {
  if (!IS_CLOUD) return false;
  const s = loadAISettings();
  return !s.model || (s.provider !== 'ollama' && !getActiveKey(s));
}

export default function OnboardingReel() {
  const { introSeen } = useOnboarding();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const open = !introSeen;

  // Replay from Settings reopens at the first card.
  useEffect(() => {
    if (open) { setStep(0); setDir(1); }
  }, [open]);

  const goTo = useCallback((target) => {
    const next = Math.max(0, Math.min(STEP_COUNT - 1, target));
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  }, [step]);
  const nextStep = useCallback(() => goTo(step + 1), [goTo, step]);
  const prevStep = useCallback(() => goTo(step - 1), [goTo, step]);
  const finish = useCallback(() => setIntroSeen(true), []);

  const finishTo = (path) => {
    navigate(path);
    finish();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, nextStep, prevStep, finish]);

  const onDragEnd = (_e, { offset, velocity }) => {
    if (offset.x < -SWIPE_PX || velocity.x < -SWIPE_VELOCITY) nextStep();
    else if (offset.x > SWIPE_PX || velocity.x > SWIPE_VELOCITY) prevStep();
  };

  const slide = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d) => ({ opacity: 0, x: d * 48 }),
        center: { opacity: 1, x: 0 },
        exit: (d) => ({ opacity: 0, x: d * -48 }),
      };

  const cards = [
    <CardTypes key="types" reduceMotion={reduceMotion} />,
    <CardLearns key="learns" onSetupAI={() => finishTo('/settings?tab=ai')} />,
    <CardAssistant key="assistant" />,
    <CardYours key="yours" />,
    <CardStart
      key="start"
      onImport={() => finishTo('/settings?tab=data')}
      onAdd={(type) => finishTo(`${CONTENT_TYPES[type].path}?add=1`)}
      onExplore={finish}
    />,
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="reel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to MILO"
          className="fixed inset-0 z-[60] bg-bg-primary"
        >
          <NeonHorizon className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/30 via-bg-primary/10 to-bg-primary/80 pointer-events-none" />

          <div className="relative h-full flex flex-col safe-area">
            <div className="flex items-center justify-between px-5 pt-4 sm:px-8 sm:pt-6">
              <span className="text-xs tracking-[0.35em] text-white/50 font-semibold">MILO</span>
              <button
                type="button"
                onClick={finish}
                className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Skip
              </button>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-4 overflow-hidden">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  drag={reduceMotion ? false : 'x'}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={onDragEnd}
                  className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-bg-secondary/85 p-6 sm:p-8 touch-pan-y"
                >
                  {cards[step]}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-4 px-5 pb-5 sm:px-8 sm:pb-8">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
                {Array.from({ length: STEP_COUNT }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className="p-1"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-colors duration-300 ${
                        i === step
                          ? 'w-8 bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-orange'
                          : 'w-1.5 bg-white/25'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {step < STEP_COUNT - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition-colors"
                >
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <span className="w-[76px]" aria-hidden="true" />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// --- Cards -----------------------------------------------------------------

function Heading({ eyebrow, children }) {
  return (
    <>
      <p className="text-xs uppercase tracking-[0.25em] text-white/40 mb-2">{eyebrow}</p>
      <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">{children}</h2>
    </>
  );
}

function CardTypes({ reduceMotion }) {
  return (
    <div>
      <Heading eyebrow="Your library">Everything you watch, hear and read.</Heading>
      <p className="text-white/70 leading-relaxed mb-6">
        Movies, TV, podcasts and books in one place — each with its own colour, all feeding one picture of your taste.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
        {CONTENT_TYPE_KEYS.map((key, i) => {
          const A = accentFor(key);
          const Icon = iconFor(key);
          return (
            <motion.div
              key={key}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.25 }}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border ${A.tileSoft} ${A.edgeSoft}`}
            >
              <Icon size={22} className={A.text} />
              <span className="text-[11px] sm:text-xs text-white/80">{CONTENT_TYPES[key].nav}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
          <Search size={15} className="text-white/40" />
          <span className="text-white/90">Arrival</span>
          <span className="w-px h-4 bg-white/60" aria-hidden="true" />
        </div>
        <p className="text-xs text-white/50 mt-2 px-1">
          Type a name in any Add form — MILO fills in the artwork, year and details.
        </p>
      </div>
    </div>
  );
}

function CardLearns({ onSetupAI }) {
  const needsKey = aiNeedsSetup();
  const chip = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-black/20 text-xs text-white/70';
  return (
    <div>
      <Heading eyebrow="Recommendations">MILO learns what you actually love.</Heading>
      <p className="text-white/70 leading-relaxed mb-6">
        It reads your ratings, builds a taste profile, and finds picks from close matches to hidden gems. Every reaction sharpens the next round.
      </p>
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 mb-5">
        <p className="text-sm text-white/80 italic mb-3">
          <span className="not-italic text-white/40 text-xs uppercase tracking-wider mr-2">MILO noticed</span>
          you rate slow-burn sci-fi higher than anything else.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className={chip}><ThumbsUp size={12} /> Interested</span>
          <span className={chip}><ThumbsDown size={12} /> Not for me</span>
          <span className={chip}><EyeOff size={12} /> Seen it</span>
        </div>
      </div>
      {IS_CLOUD ? (
        needsKey && (
          <div className="flex items-start gap-3 text-sm">
            <KeyRound size={16} className="text-neon-yellow shrink-0 mt-0.5" />
            <p className="text-white/60">
              MILO's AI runs on a key you control — it never passes through our servers.{' '}
              <button type="button" onClick={onSetupAI} className="text-neon-yellow hover:underline font-medium">
                Set up AI
              </button>{' '}
              now, or whenever you're ready.
            </p>
          </div>
        )
      ) : (
        <p className="text-sm text-white/50">Runs entirely on your own Ollama models.</p>
      )}
    </div>
  );
}

function CardAssistant() {
  return (
    <div>
      <Heading eyebrow="The assistant">Ask MILO anything.</Heading>
      <p className="text-white/70 leading-relaxed mb-6">
        A conversation that already knows your whole library — what to watch tonight, why you keep abandoning fantasy, what to read after the last great one.
      </p>
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3 mb-5">
        <div className="flex justify-end">
          <span className="max-w-[80%] rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-sm text-white/90">
            What should I watch this weekend?
          </span>
        </div>
        <div className="flex items-end gap-2">
          <img src={miloIcon} alt="" className="w-7 h-7 rounded-full object-cover" />
          <span className="rounded-2xl rounded-bl-sm border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/60">
            You've rated three Villeneuve films a 9 or higher…
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {ASSISTANT_DEMO_CHIPS.map((c) => (
            <span key={c} className="text-xs px-2.5 py-1 rounded-full border border-white/15 text-white/60">{c}</span>
          ))}
        </div>
      </div>
      <p className="text-sm text-white/50">
        Tap the MILO button in the bottom corner, from anywhere in the app.
      </p>
    </div>
  );
}

function CardYours() {
  const rows = [
    { Icon: CalendarDays, title: 'Timeline', body: 'Everything you’ve logged, laid out by date across all four types.' },
    { Icon: Palette, title: 'Genre colours', body: 'Every genre glows its own colour. Repaint any of them in Settings → Appearance.' },
    IS_CLOUD && { Icon: Users, title: 'Friends', body: 'Add friends and browse their libraries for your next pick.' },
    IS_NATIVE && { Icon: ShieldCheck, title: 'Face ID lock', body: 'Keep your library private behind Face ID — Settings → Security.' },
  ].filter(Boolean);

  return (
    <div>
      <Heading eyebrow="Make it yours">The small things add up.</Heading>
      <ul className="mt-5 space-y-4">
        {rows.map(({ Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
              <Icon size={17} className="text-white/80" />
            </span>
            <div>
              <p className="text-white font-medium">{title}</p>
              <p className="text-sm text-white/60 leading-snug">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardStart({ onImport, onAdd, onExplore }) {
  return (
    <div>
      <Heading eyebrow="Begin">Start your reel.</Heading>
      <p className="text-white/70 leading-relaxed mb-6">
        MILO gets sharper with every title. The fastest start is the library you already have.
      </p>

      <button
        type="button"
        onClick={onImport}
        className="w-full flex items-center gap-3 text-left rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 p-4 mb-3 transition-colors"
      >
        <Download size={20} className="text-white/80 shrink-0" />
        <div className="flex-1">
          <p className="text-white font-semibold">Bring your library</p>
          <p className="text-sm text-white/50">Import from Letterboxd or Goodreads</p>
        </div>
        <ArrowRight size={16} className="text-white/40" />
      </button>

      <div className="rounded-xl border border-white/15 bg-white/5 p-4 mb-4">
        <p className="text-white font-semibold mb-3">Log your first title</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CONTENT_TYPE_KEYS.map((key) => {
            const A = accentFor(key);
            const Icon = iconFor(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onAdd(key)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-sm text-white transition-colors ${A.btnSmall}`}
              >
                <Icon size={14} className={A.text} />
                {CONTENT_TYPES[key].nav}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="w-full flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white py-2 transition-colors"
      >
        <Sparkles size={14} /> Just explore
      </button>
    </div>
  );
}
