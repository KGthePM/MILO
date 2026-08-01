import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Film, Tv, Clock, Plus, RefreshCw, Settings as SettingsIcon, LogIn, LogOut, Users } from 'lucide-react';
import { IS_CLOUD } from '../../utils/mode';
import { getSupabase } from '../../utils/supabase';
import ConfirmDialog from './ConfirmDialog';

function Divider() {
  return <div className="w-px h-8 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />;
}

function IconBtn({ onClick, title, children, accent = 'white', as = 'button', to, motionProps }) {
  const accentClass =
    accent === 'cyan'
      ? 'text-neon-cyan hover:text-white hover:bg-neon-cyan/20'
      : accent === 'magenta'
      ? 'text-neon-magenta hover:text-white hover:bg-neon-magenta/20'
      : accent === 'red'
      ? 'text-red-400 hover:text-white hover:bg-red-500/20'
      : 'text-white/70 hover:text-white hover:bg-white/10';

  const base = `flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all shrink-0 ${accentClass}`;

  if (as === 'link') {
    return (
      <Link to={to} title={title} className={base}>
        {children}
      </Link>
    );
  }

  return (
    <motion.button onClick={onClick} title={title} className={base} {...motionProps}>
      {children}
    </motion.button>
  );
}

export default function FloatingCommandBar({ page, onAdd, onRefresh }) {
  const location = useLocation();
  const isMovies = page === 'movies';
  const accent = isMovies ? 'cyan' : 'magenta';
  const [session, setSession] = useState(null);
  const [showSignOut, setShowSignOut] = useState(false);

  useEffect(() => {
    if (!IS_CLOUD) return;
    let mounted = true;
    const check = async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (mounted) setSession(session);
      } catch (e) {
        console.error('Session check failed:', e);
      }
    };
    check();
    const { data: sub } = getSupabase().auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (IS_CLOUD) await getSupabase().auth.signOut();
  };

  const onMoviesPath = location.pathname === '/' || location.pathname === '/movies';
  const onTvPath = location.pathname.startsWith('/tv');
  const onTimelinePath = location.pathname.startsWith('/timeline');

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed bottom-2 left-2 right-2 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40"
    >
      <div
        className={`glass rounded-2xl px-1.5 py-1.5 sm:px-2 sm:py-2 flex items-center justify-between sm:justify-start gap-0.5 sm:gap-1 shadow-2xl ${
          isMovies ? 'neon-border-cyan' : 'neon-border-magenta'
        }`}
      >
        {/* Page toggle */}
        <Link
          to="/movies"
          title="Movies"
          className={`flex items-center gap-2 px-2.5 sm:px-4 h-11 rounded-xl font-medium text-sm transition-all shrink-0 ${
            onMoviesPath
              ? 'bg-neon-cyan/20 text-neon-cyan neon-border-cyan'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Film size={18} />
          <span className="hidden sm:inline">Movies</span>
        </Link>
        <Link
          to="/tv"
          title="TV Series"
          className={`flex items-center gap-2 px-2.5 sm:px-4 h-11 rounded-xl font-medium text-sm transition-all shrink-0 ${
            onTvPath
              ? 'bg-neon-magenta/20 text-neon-magenta neon-border-magenta'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Tv size={18} />
          <span className="hidden sm:inline">TV</span>
        </Link>
        <Link
          to="/timeline"
          title="Timeline"
          className={`flex items-center gap-2 px-2.5 sm:px-4 h-11 rounded-xl font-medium text-sm transition-all shrink-0 ${
            onTimelinePath
              ? 'bg-white/15 text-white neon-border-magenta'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock size={18} />
          <span className="hidden sm:inline">Timeline</span>
        </Link>

        <Divider />

        {/* Primary action: Add */}
        {onAdd && (
          <motion.button
            onClick={onAdd}
            title={isMovies ? 'Add Movie' : 'Add TV Series'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 h-11 px-3 sm:px-4 rounded-xl font-semibold text-sm transition-all pulse-glow shrink-0 ${
              isMovies
                ? 'bg-neon-cyan/20 border border-neon-cyan/60 text-neon-cyan neon-text-cyan hover:bg-neon-cyan/30'
                : 'bg-neon-magenta/20 border border-neon-magenta/60 text-neon-magenta neon-text-magenta hover:bg-neon-magenta/30'
            }`}
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add</span>
          </motion.button>
        )}

        {/* Refresh */}
        {onRefresh && (
          <IconBtn
            onClick={onRefresh}
            title="Refresh"
            motionProps={{ whileHover: { rotate: 180 }, transition: { duration: 0.3 } }}
          >
            <RefreshCw size={20} />
          </IconBtn>
        )}

        <Divider />

        {/* Friends (cloud only) */}
        {IS_CLOUD && (
          <IconBtn as="link" to="/friends" title="Friends" accent={location.pathname.startsWith('/friends') ? 'cyan' : 'white'}>
            <Users size={20} />
          </IconBtn>
        )}

        {/* Settings */}
        <IconBtn as="link" to="/settings" title="Settings">
          <SettingsIcon size={20} />
        </IconBtn>

        {/* Auth (cloud only) — at far end, separated to avoid accidental taps */}
        {IS_CLOUD && (
          <>
            <Divider />
            {session ? (
              <motion.button
                onClick={() => setShowSignOut(true)}
                title="Sign out"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 h-11 px-2.5 sm:px-3 rounded-xl font-medium text-sm transition-all shrink-0 text-red-400 hover:text-white hover:bg-red-500/20"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Sign out</span>
              </motion.button>
            ) : (
              <IconBtn as="link" to="/landing" title="Sign in" accent="cyan">
                <LogIn size={20} />
              </IconBtn>
            )}
          </>
        )}
      </div>
    </motion.div>
    <ConfirmDialog
      open={showSignOut}
      title="Sign out?"
      message="You'll need to sign in again to access your library."
      confirmLabel="Sign out"
      cancelLabel="Cancel"
      danger
      onConfirm={async () => {
        setShowSignOut(false);
        await handleLogout();
      }}
      onCancel={() => setShowSignOut(false)}
    />
    </>
  );
}
