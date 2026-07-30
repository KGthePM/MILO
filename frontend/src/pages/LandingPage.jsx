import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { IS_CLOUD } from '../utils/mode';
import { getSupabase } from '../utils/supabase';
import { useEffect, useState, useCallback } from 'react';
import {
  Film, Tv, Bot, Sparkles, Search, BarChart3, Palette, Clock,
  Cpu, Server, Database, Wind, Zap, Github, Download, Play,
  ChevronDown, Maximize, X,
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
];

const FEATURES = [
  { icon: Film, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', title: 'Movies & TV Tracking', desc: 'Add, edit, and manage your entire movie and TV series collection with detailed information' },
  { icon: Sparkles, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', title: 'AI-Powered Recommendations', desc: 'Get personalized suggestions with Similar and Hidden Gems modes' },
  { icon: Clock, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', title: 'Watch Timeline', desc: 'Visual timeline of your viewing history with animated nodes and date grouping' },
  { icon: Search, iconBg: 'bg-neon-cyan/20', iconClass: 'text-neon-cyan', border: 'hover:neon-border-cyan', title: 'Advanced Search', desc: 'Search by title, notes, and filter by genre and rating for quick navigation' },
  { icon: BarChart3, iconBg: 'bg-neon-magenta/20', iconClass: 'text-neon-magenta', border: 'hover:neon-border-magenta', title: 'Analytics Dashboard', desc: 'View statistics, average ratings, top genres, and insights about your viewing habits' },
  { icon: Palette, iconBg: 'bg-neon-purple/20', iconClass: 'text-neon-purple', border: 'hover:neon-border-purple', title: 'Futuristic Dark Theme', desc: 'Beautiful dark UI with neon accents, glassmorphism effects, and smooth animations' },
];

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

const revealProps = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -50px 0px' },
  transition: { duration: 0.6, ease: 'easeOut' },
};

export default function LandingPage() {
  const [session, setSession] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const navigate = useNavigate();

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
              <a href="#tech" className="text-white/70 hover:text-neon-cyan transition-colors">Tech Stack</a>
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

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
            <div className="flex justify-center mb-6">
              <div className="glass rounded-2xl p-4 pulse-glow">
                <img src="/landing/milo_icon.jpeg" alt="MILO Logo" className="w-20 h-20 object-contain rounded-lg" />
              </div>
            </div>
            <h1 className="text-5xl sm:text-7xl font-extrabold mb-6">
              <span className="neon-text-cyan">MI</span><span className="neon-text-magenta">LO</span>
            </h1>
            <p className="text-xl sm:text-2xl text-white/80 mb-4">
              AI-Powered Movie &amp; TV Tracking Dashboard
            </p>
            <p className="text-lg text-white/50 mb-8 max-w-2xl mx-auto">
              Track your watch history with intelligent recommendations, beautiful analytics, and a futuristic dark theme
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
            {SCREENSHOTS.map((shot, i) => {
              const Icon = shot.icon;
              return (
                <motion.div
                  key={shot.src}
                  {...revealProps}
                  transition={{ ...revealProps.transition, delay: 0.1 * i }}
                  className={`glass rounded-xl overflow-hidden transition-all duration-300 ${shot.borderClass}`}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox(shot)}
                    className="relative group block w-full cursor-pointer"
                    aria-label={`Enlarge ${shot.title} screenshot`}
                  >
                    <img src={shot.src} alt={shot.alt} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" />
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
                  {...revealProps}
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
                  {...revealProps}
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
          <motion.div {...revealProps} className="glass rounded-2xl p-12 neon-border-cyan">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4"><span className="neon-text-cyan">Ready to Start Tracking?</span></h2>
            <p className="text-lg text-white/50 mb-8">Start building your personal entertainment library today</p>
            <button
              onClick={goToApp}
              className="pulse-glow inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all"
            >
              <Sparkles size={20} />
              <span>{ctaLabel}</span>
            </button>
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
            <p>&copy; {new Date().getFullYear()} MILO. Built with ❤️ for movie lovers.</p>
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
