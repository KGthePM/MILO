import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Sparkles, AtSign } from 'lucide-react';
import { IS_CLOUD } from '../utils/mode';
import { IS_NATIVE } from '../utils/native';
import { getSupabase } from '../utils/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AuthGate({ children }) {
  if (!IS_CLOUD) return children;
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    let sb;
    try { sb = getSupabase(); } catch (e) { setError(e.message); setLoading(false); return; }

    const maybeRedirect = (s) => {
      if (s && (pathRef.current === '/landing' || pathRef.current === '/signin')) {
        navigate('/');
      }
    };

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      maybeRedirect(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      maybeRedirect(s);
    });
    return () => { mounted = false; sub.subscription?.unsubscribe(); };
  }, [navigate]);

  // Send signed-out visitors landing on the root to the marketing page
  // instead of dropping them straight onto the sign-in form.
  // Native apps open at / and stay there: sign-in IS the welcome screen,
  // never the web marketing page.
  useEffect(() => {
    if (!loading && !session && !IS_NATIVE && location.pathname === '/') {
      navigate('/landing', { replace: true });
    }
  }, [loading, session, location.pathname, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setInfo(null); setSubmitting(true);
    try {
      const sb = getSupabase();
      if (mode === 'signin') {
        // The first field accepts an email or a username. Anything with an
        // '@' is treated as an email; otherwise resolve username -> email.
        const identifier = email.trim();
        let loginEmail = identifier;
        if (!identifier.includes('@')) {
          const { data: resolvedEmail, error: rpcErr } = await sb.rpc('email_for_username', {
            p_username: identifier,
          });
          if (rpcErr) throw rpcErr;
          if (!resolvedEmail) throw new Error('No account found with that username.');
          loginEmail = resolvedEmail;
        }
        const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      } else {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) throw new Error('Pick a username so friends can find you.');
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { username: trimmedUsername } },
        });
        if (error) throw error;
        setInfo('Check your inbox to confirm your email.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // While redirecting a signed-out root visitor to /landing, show the
  // loading placeholder rather than briefly flashing the sign-in form.
  // Native never performs that redirect (sign-in IS the entry screen), so
  // it must fall through to the sign-in form — not spin here forever.
  if (loading || (!IS_NATIVE && !session && location.pathname === '/')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/60">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative overflow-hidden min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-black p-6">
        {/* Ambient tri-color glow blobs — the three content-type accents.
            bg-neon-magenta (not magenta-500): Tailwind has no "magenta"
            palette entry; the app's magenta is the custom neon-magenta. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-32 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl"
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-neon-magenta/20 blur-3xl"
          animate={{ opacity: [0.25, 0.5, 0.25], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl"
          animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md glass rounded-2xl p-8 neon-border-cyan"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <Sparkles className="text-neon-cyan mb-3" size={24} />
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold leading-none">
                <span className="neon-text-cyan">MI</span><span className="neon-text-magenta">LO</span>
              </h1>
              <span className="rounded-full border border-cyan-500/40 text-cyan-300 text-[10px] uppercase tracking-widest px-2 py-0.5">
                Cloud
              </span>
            </div>
            <p className="text-white/40 font-light text-sm mt-3">Movie Intelligence &amp; Learning Overseer</p>
          </div>
          <p className="text-white/70 mb-6 text-sm text-center">
            {mode === 'signin' ? 'Sign in to your movie, TV & podcast tracker.' : 'Create your account — track movies, TV & podcasts.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-white/70 text-sm flex items-center gap-2 mb-1">
                <Mail size={14}/> {mode === 'signin' ? 'Email or username' : 'Email'}
              </span>
              <input
                type={mode === 'signin' ? 'text' : 'email'} required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
              />
            </label>
            {mode === 'signup' && (
              <label className="block">
                <span className="text-white/70 text-sm flex items-center gap-2 mb-1"><AtSign size={14}/> Username</span>
                <input
                  type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                  placeholder="friends will find you by this"
                  className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
                />
                <span className="text-white/40 text-xs mt-1 block">Letters, numbers, and underscores only.</span>
              </label>
            )}
            <label className="block">
              <span className="text-white/70 text-sm flex items-center gap-2 mb-1"><Lock size={14}/> Password</span>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
              />
            </label>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            {info && <div className="text-green-400 text-sm">{info}</div>}
            <button
              type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all text-white font-semibold disabled:opacity-50"
            >
              <LogIn size={16} />
              {submitting ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
            className="mt-4 text-white/50 text-sm hover:text-white/80 w-full text-center"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          <p className="mt-6 text-white/30 text-xs text-center">Your library, your keys — AI powered</p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
