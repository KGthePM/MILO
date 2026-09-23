import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Film, Tv, Mic, Clock, Plus, RefreshCw, Settings as SettingsIcon, LogIn, LogOut, Users } from 'lucide-react';
import { IS_CLOUD } from '../../utils/mode';
import { getSupabase } from '../../utils/supabase';
import { CONTENT_TYPES, ACCENT, getContentType } from '../../utils/contentTypes';
import ConfirmDialog from './ConfirmDialog';

// Full literal class strings — Tailwind cannot see interpolated names.
const ICON_BTN_ACCENT = {
  cyan: 'text-neon-cyan hover:text-white hover:bg-neon-cyan/20',
  magenta: 'text-neon-magenta hover:text-white hover:bg-neon-magenta/20',
  purple: 'text-neon-purple hover:text-white hover:bg-neon-purple/20',
  red: 'text-red-400 hover:text-white hover:bg-red-500/20',
  white: 'text-white/70 hover:text-white hover:bg-white/10',
};

const NAV_ICONS = { movie: Film, tv: Tv, podcast: Mic };

function Divider() {
  return <div className="w-px h-8 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />;
}

function IconBtn({ onClick, title, children, accent = 'white', as = 'button', to, motionProps }) {
  const accentClass = ICON_BTN_ACCENT[accent] || ICON_BTN_ACCENT.white;

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
  // `page` has historically been 'movies' (plural) on the Movies page; map it
  // onto the registry key rather than adding another special case.
  const activeType = getContentType(page === 'movies' ? 'movie' : page);
  const A = ACCENT[activeType.accent];
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

  const onTimelinePath = location.pathname.startsWith('/timeline');
  const isActivePath = (key) =>
    key === 'movie'
      ? location.pathname === '/' || location.pathname === '/movies'
      : location.pathname.startsWith(CONTENT_TYPES[key].path);

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
        className={`glass rounded-2xl px-1.5 py-1.5 sm:px-2 sm:py-2 flex items-center justify-between sm:justify-start gap-0.5 sm:gap-1 shadow-2xl ${A.border}`}
      >
        {/* Page toggle — one entry per content type */}
        {Object.values(CONTENT_TYPES).map((ct) => {
          const Icon = NAV_ICONS[ct.key];
          const active = isActivePath(ct.key);
          const ctAccent = ACCENT[ct.accent];
          return (
            <Link
              key={ct.key}
              to={ct.path}
              title={ct.nav}
              className={`flex items-center gap-2 px-2.5 sm:px-4 h-11 rounded-xl font-medium text-sm transition-all shrink-0 ${
                active
                  ? `${ctAccent.bgSoft} ${ctAccent.text} ${ctAccent.border}`
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{ct.nav}</span>
            </Link>
          );
        })}
        <Link
          to="/timeline"
          title="Timeline"
          className={`flex items-center gap-2 px-2.5 sm:px-4 h-11 rounded-xl font-medium text-sm transition-all shrink-0 ${
            onTimelinePath
              ? `bg-white/15 text-white ${A.border}`
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
            title={`Add ${activeType.singular}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 h-11 px-3 sm:px-4 rounded-xl font-semibold text-sm transition-all pulse-glow shrink-0 border ${A.bgSoft} ${A.ring} ${A.text} ${A.glow} ${A.bgHover}`}
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

        {/* Auth (cloud only) — at far end, separated to avoid accidental taps.
            Hidden below sm: the bar's ~390px of shrink-0 content overflows
            ≤390pt screens; sign-out remains available in Settings. */}
        {IS_CLOUD && (
          <div className="hidden sm:flex items-center">
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
          </div>
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
