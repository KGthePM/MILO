import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { IS_CLOUD } from '../utils/mode';
import NeonHorizon from '../components/shared/NeonHorizon';
import { getSupabase } from '../utils/supabase';
import { TESTFLIGHT_URL } from '../utils/native';
import { CONTENT_TYPES, CONTENT_TYPE_KEYS, TYPE_ICONS, ACCENT } from '../utils/contentTypes';
import { useEffect, useState, useCallback } from 'react';
import {
  Film, Tv, Bot, Sparkles, Search, BarChart3, Palette, Clock,
  Cpu, Server, Database, Wind, Zap, Github, Download, Play,
  ChevronDown, ChevronRight, Maximize, X, Smartphone, Mic, BookOpen, Users,
  Eye, Compass,
} from 'lucide-react';

const GITHUB_URL = 'https://github.com/KGthePM/milo';

const SCREENSHOTS = [
  {
    src: '/landing/MILO_SC1.png',
    alt: 'MILO Movies Dashboard',
    icon: Film,
    iconClass: 'text-neon-cyan',
    borderClass: 'hover:neon-border-cyan',
    title: 'Movies Dashboard',
    desc: 'Track, search, and manage your entire movie collection with beautiful analytics',
  },
  {
    src: '/landing/MILO_SC2.png',
    alt: 'MILO TV Series Dashboard',
    icon: Tv,
    iconClass: 'text-neon-magenta',
    borderClass: 'hover:neon-border-magenta',
    title: 'TV Series Dashboard',
    desc: 'Follow your favorite shows with episode tracking and watch timeline visualization',
  },
  {
    src: '/landing/MILO_SC3.png',
    alt: 'MILO AI Recommendations',
    icon: Bot,
    iconClass: 'text-neon-purple',
    borderClass: 'hover:neon-border-purple',
    title: 'AI Recommendations',
    desc: 'Get personalized suggestions powered by AI with Similar and Hidden Gems modes',
  },
  {
    src: '/landing/MILO_SC4.png',
    alt: 'MILO Podcasts Library',
    icon: Mic,
    iconClass: ACCENT.purple.text,
    borderClass: '',
    title: 'Podcasts',
    desc: 'Every show you listen to, with iTunes artwork and a queue for what you want to hear next',
  },
  {
    src: '/landing/MILO_SC5.png',
    alt: 'MILO Books Library',
    icon: BookOpen,
    iconClass: ACCENT.orange.text,
    borderClass: '',
    title: 'Books',
    desc: 'A shelf for everything you have read, with Open Library covers and a Goodreads import',
  },
  // Friends is cloud-only, so its screenshot only advertises it where it exists.
  IS_CLOUD && {
    src: '/landing/MILO_SC6.png',
    alt: 'MILO Friends',
    icon: Users,
    iconClass: 'text-neon-cyan',
    borderClass: '',
    title: 'Friends',
    desc: 'Browse the people you know by what they watch, hear, and read',
  },
].filter(Boolean);

const FEATURES = [
  // The three content-type cards take their accent from the registry; the rest
  // are decorative and keep the page's cyan/magenta/purple rotation.
  { icon: Film, iconBg: ACCENT.cyan.bgSoft, iconClass: ACCENT.cyan.text, border: 'hover:neon-border-cyan', title: 'Movies & TV', desc: 'Log films and series with ratings, notes, posters, and episode counts, with details filled in from TMDB' },
  { icon: Mic, iconBg: ACCENT.purple.bgSoft, iconClass: ACCENT.purple.text, border: '', title: 'Podcasts', desc: 'Search any show on iTunes for artwork and autofill, then track what you have heard and what is next' },
  { icon: BookOpen, iconBg: ACCENT.orange.bgSoft, iconClass: ACCENT.orange.text, border: '', title: 'Books', desc: 'Open Library covers, a Read / To Read shelf, and your whole Goodreads library in one import' },
  { icon: Sparkles, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', title: 'AI-Powered Recommendations', desc: 'Similar and Hidden Gems picks across movies, TV, podcasts, and books' },
  { icon: Clock, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', title: 'Timeline', desc: 'Everything you have logged, laid out by date across all four types' },
  { icon: Search, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', title: 'Advanced Search', desc: 'Search by title, notes, and filter by genre and rating for quick navigation' },
  { icon: BarChart3, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', title: 'Analytics Dashboard', desc: 'Statistics, average ratings, top genres, and insights into your habits across every medium' },
  IS_CLOUD && { icon: Users, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', title: 'Friends', desc: 'Add friends and browse their libraries for your next pick' },
  { icon: Palette, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', title: 'Futuristic Dark Theme', desc: 'Dark UI with neon accents, glassmorphism effects, and smooth animations' },
].filter(Boolean);

const TECH = [
  { icon: Cpu, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', name: 'React 18', label: 'Frontend Framework' },
  { icon: Server, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', name: 'Node.js', label: 'Backend Runtime' },
  { icon: Database, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', name: 'SQLite', label: 'Database' },
  { icon: Wind, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', name: 'Tailwind CSS', label: 'Styling Framework' },
  { icon: Zap, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', name: 'Vite', label: 'Build Tool' },
  { icon: Sparkles, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', name: 'Framer Motion', label: 'Animations' },
  { icon: Palette, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', name: 'Lucide Icons', label: 'Icon Library' },
  { icon: Bot, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', name: 'Supabase + AI', label: 'Cloud & Recs' },
];

const MILO_ACRONYM = [
  { text: 'Media', glow: 'neon-text-cyan' },
  { text: 'Intelligence', glow: 'neon-text-magenta' },
  { text: 'Learning', glow: 'neon-text-purple' },
  { text: 'Overseer', glow: 'neon-text-cyan' },
];

const MILO_MEANING = [
  { letter: 'M', word: 'Media', icon: Film, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', glow: 'neon-text-cyan', border: 'hover:neon-border-cyan', desc: 'Films, shows, podcasts, books: every story you take in, in one place.', lineage: true },
  { letter: 'I', word: 'Intelligence', icon: Sparkles, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', glow: 'neon-text-magenta', border: 'hover:neon-border-magenta', desc: 'AI-powered recommendations, tuned to your taste.' },
  { letter: 'L', word: 'Learning', icon: BarChart3, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', glow: 'neon-text-purple', border: 'hover:neon-border-purple', desc: 'The more you log, the better it understands what you love.' },
  { letter: 'O', word: 'Overseer', icon: Database, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', glow: 'neon-text-cyan', border: 'hover:neon-border-cyan', desc: 'Your whole history, organized and at a glance.' },
];

// The March of Media: the order MILO grew in, one line each on how that type
// gets into your library.
const MARCH_NOTES = {
  movie: 'Where it started. Find any film on TMDB and the poster, director, and genre fill themselves in.',
  tv: 'Seasons and episodes, pulled straight from TMDB.',
  podcast: 'Search every show on iTunes. Artwork and host come along.',
  book: 'Open Library covers, and your whole Goodreads shelf in one import.',
};

// A static, made-up friend shelf for the Friends pitch. One title per type.
const FRIEND_SHELF = [
  { type: 'movie', title: 'The Long Night Drive', meta: '2019', rating: 9 },
  { type: 'tv', title: 'Harbor Lights', meta: '3 seasons', rating: 8 },
  { type: 'podcast', title: 'Signal & Noise', meta: '112 episodes', rating: 8.5 },
  { type: 'book', title: 'The Glass Orchard', meta: '384 pages', rating: 9.5 },
];

const revealProps = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -50px 0px' },
  transition: { duration: 0.6, ease: 'easeOut' },
};

export default function LandingPage() {
  const [session, setSession] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  // Screenshots whose PNG failed to load. Those cards drop out instead of
  // rendering a broken image.
  const [missingShots, setMissingShots] = useState(() => new Set());
  const navigate = useNavigate();
  // framer-motion is invisible to the CSS reduced-motion block, so the scroll
  // reveals opt out here: with `initial: false` each block renders settled.
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion ? { ...revealProps, initial: false } : revealProps;

  useEffect(() => {
    if (!IS_CLOUD) return;
    (async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (session) navigate('/');
      } catch (e) {
        console.error('Session check failed:', e);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const goToApp = useCallback(() => {
    navigate(IS_CLOUD ? '/signin' : '/');
  }, [navigate]);

  const ctaLabel = IS_CLOUD ? 'Sign In to Get Started' : 'Start Tracking';

  return (
    <div className="landing-page gradient-bg min-h-screen text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img src="/landing/milo_icon.jpeg" alt="MILO Logo" className="w-8 h-8 object-contain rounded" />
              <span className="text-2xl font-bold">
                <span className="neon-text-cyan">MI</span><span className="neon-text-magenta">LO</span>
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-white/70 hover:text-neon-cyan transition-colors">Features</a>
              {IS_CLOUD && <a href="#friends" className="text-white/70 hover:text-neon-cyan transition-colors">Friends</a>}
              <a href="#tech" className="text-white/70 hover:text-neon-cyan transition-colors">Tech Stack</a>
              <a href={TESTFLIGHT_URL} target="_blank" rel="noreferrer" className="text-white/70 hover:text-neon-cyan transition-colors flex items-center space-x-1">
                <Smartphone size={18} />
                <span>iOS Beta</span>
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-white/70 hover:text-neon-cyan transition-colors flex items-center space-x-1">
                <Github size={18} />
                <span>GitHub</span>
              </a>
              <button onClick={goToApp} className="text-white/70 hover:text-neon-cyan transition-colors">Sign In</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-gradient min-h-screen flex items-center justify-center pt-16 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-cyan/10 rounded-full blur-3xl float-animation"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-magenta/10 rounded-full blur-3xl float-animation" style={{ animationDelay: '2s' }}></div>
        </div>
        {/* Same canvas deep-field as the sign-in screen. Absolute, not fixed —
            this is a hero section, not the viewport. */}
        <NeonHorizon eggs="idle" className="absolute inset-0" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
            <div className="flex justify-center mb-6">
              <div className="glass rounded-2xl p-4 pulse-glow">
                <img src="/landing/milo_icon.jpeg" alt="MILO Logo" className="w-20 h-20 object-contain rounded-lg" />
              </div>
            </div>
            <h1 className="text-5xl sm:text-7xl font-extrabold mb-4">
              <span className="neon-text-cyan">MI</span><span className="neon-text-magenta">LO</span>
            </h1>
            <div className="flex flex-wrap justify-center items-baseline gap-x-3 gap-y-1 text-lg sm:text-xl font-semibold mb-4">
              {MILO_ACRONYM.map((word, i) => (
                <span key={word.text} className="flex items-baseline">
                  {i > 0 && <span className="text-white/25 mr-3">&middot;</span>}
                  <span className="text-white/70">
                    <span className={`text-2xl sm:text-3xl font-extrabold ${word.glow}`}>{word.text[0]}</span>
                    {word.text.slice(1)}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-xl sm:text-2xl text-white/80 mb-4">
              Movies, TV, podcasts &amp; books. One AI-powered library.
            </p>
            <p className="text-lg text-white/50 mb-8 max-w-2xl mx-auto">
              Track everything you watch, hear, and read, with intelligent recommendations, beautiful analytics, and a futuristic dark theme
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={goToApp}
              className="pulse-glow group px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg flex items-center space-x-2 hover:from-cyan-600 hover:to-cyan-700 transition-all"
            >
              <Play size={20} className="group-hover:scale-110 transition-transform" />
              <span>{ctaLabel}</span>
            </button>
            <a
              href={TESTFLIGHT_URL} target="_blank" rel="noreferrer"
              className="group px-8 py-4 glass text-white font-semibold rounded-lg flex items-center space-x-2 hover:neon-border-magenta transition-all"
            >
              <Smartphone size={20} className="text-neon-magenta group-hover:scale-110 transition-transform" />
              <span>Join the iOS Beta</span>
            </a>
            <a
              href={GITHUB_URL} target="_blank" rel="noreferrer"
              className="px-8 py-4 glass text-white font-semibold rounded-lg flex items-center space-x-2 hover:border-cyan-500/50 transition-all"
            >
              <Download size={20} />
              <span>Download / Clone</span>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12"
          >
            <p className="text-sm text-white/40 mb-4">Open Source • Built with •</p>
            <div className="flex justify-center items-center space-x-4">
              <Cpu size={24} className="text-neon-cyan" />
              <Server size={24} className="text-neon-magenta" />
              <Database size={24} className="text-neon-purple" />
              <Zap size={24} className="text-neon-yellow" />
            </div>
          </motion.div>
        </div>

        <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-neon-cyan transition-colors">
          <ChevronDown size={32} className="animate-bounce" />
        </a>
      </section>

      {/* What MILO stands for */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4"><span className="neon-text-magenta">The mind behind MILO</span></h2>
            <p className="text-xl text-white/50">Every letter earns its place &mdash; here's what MILO stands for</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {MILO_MEANING.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.letter}
                  {...reveal}
                  transition={{ ...revealProps.transition, delay: 0.08 * i }}
                  className={`glass rounded-xl p-6 text-center ${m.border}`}
                >
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-lg ${m.iconBg} flex items-center justify-center`}>
                    <Icon size={28} className={m.iconClass} />
                  </div>
                  <div className={`text-6xl font-extrabold leading-none mb-2 ${m.glow}`}>{m.letter}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    <span className={m.glow}>{m.word[0]}</span>{m.word.slice(1)}
                  </h3>
                  <p className="text-sm text-white/50">{m.desc}</p>
                  {m.lineage && (
                    <div className="mt-4 flex items-center justify-center gap-1" aria-label="Movies, TV, podcasts, books">
                      {CONTENT_TYPE_KEYS.map((k, j) => {
                        const TypeIcon = TYPE_ICONS[k];
                        return (
                          <span key={k} className="flex items-center gap-1">
                            {j > 0 && <ChevronRight size={12} className="text-white/25" />}
                            <TypeIcon size={18} className={ACCENT[CONTENT_TYPES[k].accent].text} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The March of Media: the ape-to-human diagram, for a library */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4"><span className="neon-text-purple">The March of Media</span></h2>
            <p className="text-xl text-white/50 max-w-2xl mx-auto">
              MILO started with films. Shows came next, then podcasts, and now books. Same M, bigger meaning.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-3">
            {CONTENT_TYPE_KEYS.map((k, i) => {
              const ct = CONTENT_TYPES[k];
              const a = ACCENT[ct.accent];
              const TypeIcon = TYPE_ICONS[k];
              return (
                <div key={k} className="contents">
                  {i > 0 && (
                    <div className="flex items-center justify-center text-white/25 shrink-0" aria-hidden="true">
                      <ChevronRight size={22} className="hidden lg:block" />
                      <ChevronDown size={22} className="lg:hidden" />
                    </div>
                  )}
                  <motion.div
                    {...reveal}
                    transition={{ ...revealProps.transition, delay: 0.08 * i }}
                    className="glass rounded-xl p-5 text-center w-full max-w-sm lg:max-w-none lg:flex-1 min-w-0"
                  >
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-lg ${a.bgSoft} flex items-center justify-center`}>
                      <TypeIcon size={24} className={a.text} />
                    </div>
                    <h3 className={`text-xl font-bold mb-1 ${a.glow}`}>{ct.nav}</h3>
                    <p className="text-xs uppercase tracking-wider text-white/40 mb-3">{ct.verb} &middot; {ct.verbTo}</p>
                    <p className="text-sm text-white/60 leading-snug">{MARCH_NOTES[k]}</p>
                  </motion.div>
                </div>
              );
            })}
            <div className="flex items-center justify-center text-white/25 shrink-0" aria-hidden="true">
              <ChevronRight size={22} className="hidden lg:block" />
              <ChevronDown size={22} className="lg:hidden" />
            </div>
            <motion.div
              {...reveal}
              transition={{ ...revealProps.transition, delay: 0.32 }}
              className="flex lg:flex-col items-center justify-center gap-3 lg:gap-1 px-4 py-2 shrink-0"
            >
              <span className="text-6xl font-extrabold leading-none neon-text-cyan">M</span>
              <span className="text-lg font-semibold text-white/70">= Media</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* App Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="neon-text-cyan">See MILO in Action</span>
            </h2>
            <p className="text-xl text-white/50">Experience the power of MILO's intuitive interface</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SCREENSHOTS.filter((shot) => !missingShots.has(shot.src)).map((shot, i) => {
              const Icon = shot.icon;
              return (
                <motion.div
                  key={shot.src}
                  {...reveal}
                  transition={{ ...revealProps.transition, delay: 0.06 * i }}
                  className={`glass rounded-xl overflow-hidden transition-all duration-300 ${shot.borderClass}`}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox(shot)}
                    className="relative group block w-full cursor-pointer"
                    aria-label={`Enlarge ${shot.title} screenshot`}
                  >
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      onError={() => setMissingShots((prev) => new Set(prev).add(shot.src))}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-neon-cyan/20 border-2 border-neon-cyan/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Maximize size={26} className="text-neon-cyan" />
                    </div>
                  </button>
                  <div className="p-6">
                    <h3 className="text-2xl font-semibold text-white mb-2 flex items-center">
                      <Icon size={24} className={`${shot.iconClass} mr-2`} />
                      {shot.title}
                    </h3>
                    <p className="text-white/50">{shot.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4"><span className="neon-text-cyan">Powerful Features</span></h2>
            <p className="text-xl text-white/50">Everything you need to track your entertainment journey</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  {...reveal}
                  transition={{ ...revealProps.transition, delay: 0.05 * i }}
                  className={`feature-card glass rounded-xl p-6 ${f.border}`}
                >
                  <div className={`feature-icon w-14 h-14 rounded-lg ${f.iconBg} flex items-center justify-center mb-4`}>
                    <Icon size={28} className={f.iconClass} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-white">{f.title}</h3>
                  <p className="text-white/50">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Friends (cloud only, like the feature itself) */}
      {IS_CLOUD && (
        <section id="friends" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div {...reveal}>
              <h2 className="text-4xl sm:text-5xl font-bold mb-4"><span className="neon-text-magenta">Know your friends by their shelves</span></h2>
              <p className="text-xl text-white/50 mb-8">
                What someone watches, listens to, and reads says a lot about them. MILO lets you look.
              </p>
              <ul className="space-y-5">
                {[
                  { Icon: Eye, title: 'See their whole library', body: 'Films, shows, podcasts, and books your friends have shared, with their ratings.' },
                  { Icon: Users, title: 'Understand them better', body: 'The 9/10 they gave a slow documentary tells you more than small talk would.' },
                  { Icon: Compass, title: 'Find your next pick', body: 'A friend’s shelf beats an algorithm. Pull ideas from the people you know.' },
                ].map(({ Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-neon-magenta/20 flex items-center justify-center">
                      <Icon size={20} className="text-neon-magenta" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{title}</p>
                      <p className="text-white/50">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Static mock of a friend's shelf. Solid panels, not .glass. */}
            <motion.div {...reveal} transition={{ ...revealProps.transition, delay: 0.1 }} className="rounded-2xl bg-bg-secondary border border-white/10 p-6" aria-hidden="true">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-magenta to-neon-purple flex items-center justify-center text-xl font-bold text-white">J</div>
                <div>
                  <p className="text-white font-semibold">Jules</p>
                  <p className="text-sm text-white/40">412 titles &middot; 4 shelves</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FRIEND_SHELF.map((item) => {
                  const ct = CONTENT_TYPES[item.type];
                  const a = ACCENT[ct.accent];
                  const TypeIcon = TYPE_ICONS[item.type];
                  return (
                    <div key={item.type} className={`rounded-xl bg-bg-primary border ${a.edgeSoft} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`flex items-center gap-1.5 text-xs uppercase tracking-wider ${a.text}`}>
                          <TypeIcon size={14} />
                          {ct.nav}
                        </span>
                        <span className={`text-sm font-bold ${a.text}`}>{item.rating}</span>
                      </div>
                      <p className="text-white font-medium truncate">{item.title}</p>
                      <p className="text-xs text-white/40">{item.meta} &middot; {ct.verb}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Tech Stack */}
      <section id="tech" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4"><span className="neon-text-purple">Built with Modern Tech</span></h2>
            <p className="text-xl text-white/50">Powered by cutting-edge technologies</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {TECH.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.name}
                  {...reveal}
                  transition={{ ...revealProps.transition, delay: 0.05 * i }}
                  className={`tech-card glass rounded-xl p-6 text-center ${t.border}`}
                >
                  <div className={`tech-icon w-16 h-16 mx-auto mb-4 ${t.iconBg} rounded-lg flex items-center justify-center transition-transform`}>
                    <Icon size={32} className={t.iconClass} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{t.name}</h3>
                  <p className="text-sm text-white/50">{t.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...reveal} className="glass rounded-2xl p-12 neon-border-cyan">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4"><span className="neon-text-cyan">Ready to Start Tracking?</span></h2>
            <p className="text-lg text-white/50 mb-8">Start building your personal entertainment library today</p>
            <button
              onClick={goToApp}
              className="pulse-glow inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all"
            >
              <Sparkles size={20} />
              <span>{ctaLabel}</span>
            </button>
            <p className="mt-6 text-sm text-white/50">
              On iPhone?{' '}
              <a href={TESTFLIGHT_URL} target="_blank" rel="noreferrer" className="text-neon-magenta hover:underline">
                Join the TestFlight beta &rarr;
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <img src="/landing/milo_icon.jpeg" alt="MILO Logo" className="w-6 h-6 object-contain rounded" />
            <span className="text-xl font-bold text-white">MILO</span>
          </div>
          <div className="text-white/50 text-sm">
            <p>&copy; {new Date().getFullYear()} MILO. Built with ❤️ for people who love stories.</p>
          </div>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-white/50 hover:text-neon-cyan transition-colors">
            <Github size={20} />
          </a>
        </div>
      </footer>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-5 right-6 text-white/80 hover:text-neon-cyan transition-all"
              aria-label="Close"
            >
              <X size={36} />
            </button>
            <motion.img
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-neon-cyan"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
