import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, AtSign, Film, Tv, Podcast, KeyRound } from 'lucide-react';
import { CONTENT_TYPES, CONTENT_TYPE_KEYS, ACCENT } from '../utils/contentTypes';
import { IS_CLOUD } from '../utils/mode';
import { IS_NATIVE } from '../utils/native';
import { getSupabase } from '../utils/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { nativeAppleSignIn, webAppleSignIn, maybeApplyAppleDisplayName } from '../utils/appleAuth';
import { registerAuthDeepLinkListener } from '../utils/authDeepLinks';

// Icons for the sign-in capability pills. Keyed off the content-type registry
// so adding a type there surfaces a gap here rather than silently dropping it.
const TYPE_ICONS = { movie: Film, tv: Tv, podcast: Podcast };

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
    // Native: email links (verify / password recovery) arrive as appUrlOpen
    // deep links instead of landing on a URL supabase-js can parse.
    let removeDeepLink = null;
    if (IS_NATIVE) {
      removeDeepLink = registerAuthDeepLinkListener(sb, () => navigate('/reset-password'));
    }
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
      removeDeepLink?.();
    };
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
      if (mode === 'forgot') {
        // redirectTo drives where Supabase's recovery email sends the user.
        // Native: a capacitor:// URL — iOS hands it to the app as an
        // appUrlOpen deep link (handled in utils/authDeepLinks.js) instead of
        // dumping them into Safari on the marketing site. Must be allowlisted
        // in Supabase → Auth → URL Configuration.
        const redirectTo = IS_NATIVE
          ? 'capacitor://localhost/reset-password'
          : window.location.origin + '/reset-password';
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setInfo('Password reset link sent — check your inbox.');
        return;
      }
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

  // Sign in with Apple — native sheet on iOS, OAuth redirect on web.
  const appleSignIn = async () => {
    setError(null); setInfo(null); setSubmitting(true);
    try {
      const sb = getSupabase();
      if (IS_NATIVE) {
        const { idToken, profile } = await nativeAppleSignIn();
        const { error } = await sb.auth.signInWithIdToken({
          provider: 'apple',
          token: idToken,
        });
        if (error) throw error;
        await maybeApplyAppleDisplayName(sb, profile);
      } else {
        await webAppleSignIn(sb);
      }
    } catch (err) {
      setError(err?.message || 'Apple sign-in failed.');
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
      <div className="relative overflow-hidden min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-black safe-area-plus">
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
        {/* Synthwave horizon — a perspective grid receding toward the middle
            of the screen. Pure CSS (.auth-horizon in index.css) so it costs no
            React renders and loops as a composited translate3d. The extra
            -stage element is required: the fade mask and the perspective have to
            sit on separate elements or WebKit flattens the grid away entirely.
            See the comment in index.css before merging these divs. */}
        <div aria-hidden="true" className="auth-horizon">
          <div className="auth-horizon-stage">
            <div className="auth-horizon-plane">
              <div className="auth-horizon-grid" />
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md glass rounded-2xl p-8 neon-border-cyan"
        >
          {/* Tri-accent arc orbiting the card edge. */}
          <div aria-hidden="true" className="auth-sheen" />
          <div className="flex flex-col items-center text-center mb-5">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold leading-none">
                <span className="neon-text-cyan auth-power-on-cyan">MI</span><span className="neon-text-magenta auth-power-on-magenta">LO</span>
              </h1>
              <span className="rounded-full border border-cyan-500/40 text-cyan-300 text-[10px] uppercase tracking-widest px-2 py-0.5">
                Cloud
              </span>
            </div>
            <p className="text-white/40 font-light text-sm mt-3">Movie Intelligence &amp; Learning Overseer</p>
          </div>

          {/* What MILO actually covers — the one thing the sign-in screen never
              said out loud. Built from the registry, with ACCENT class strings
              kept literal so Tailwind's extractor can see them. */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {CONTENT_TYPE_KEYS.map((key, i) => {
              const { nav, accent } = CONTENT_TYPES[key];
              const Icon = TYPE_ICONS[key];
              const a = ACCENT[accent];
              return (
                <span
                  key={key}
                  className={`auth-pill flex items-center gap-1.5 rounded-full border ${a.ringSoft} bg-black/30 px-3 py-1.5 text-xs ${a.text}`}
                  style={{ animationDelay: `${1.05 + i * 0.12}s` }}
                >
                  <Icon size={13} />
                  {nav}
                </span>
              );
            })}
          </div>
          <p className="text-white/70 mb-6 text-sm text-center">
            {mode === 'signin' && 'Sign in to your movie, TV & podcast tracker.'}
            {mode === 'signup' && 'Create your account — track movies, TV & podcasts.'}
            {mode === 'forgot' && 'Enter your email and we\u2019ll send a reset link.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-white/70 text-sm flex items-center gap-2 mb-1">
                <Mail size={14}/> {mode === 'signin' ? 'Email or username' : mode === 'forgot' ? 'Email' : 'Email'}
              </span>
              <input
                type={mode === 'signup' ? 'email' : 'text'} required value={email} onChange={(e) => setEmail(e.target.value)}
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
            {mode !== 'forgot' && (
              <label className="block">
                <span className="text-white/70 text-sm flex items-center gap-2 mb-1"><Lock size={14}/> Password</span>
                <input
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
                />
              </label>
            )}
            {error && <div className="text-red-400 text-sm">{error}</div>}
            {info && <div className="text-green-400 text-sm">{info}</div>}
            <button
              type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all text-white font-semibold disabled:opacity-50"
            >
              <LogIn size={16} />
              {submitting ? '…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                onClick={appleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {/* Apple logo — inline SVG (lucide has no Apple mark) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Sign in with Apple
              </button>
            </>
          )}

          <button
            onClick={() => {
              const next = mode === 'signin' ? 'signup' : 'signin';
              setMode(next); setPassword(''); setError(null); setInfo(null);
            }}
            className="mt-4 text-white/50 text-sm hover:text-white/80 w-full text-center"
          >
            {mode === 'signin' && "Don't have an account? Sign up"}
            {mode === 'signup' && 'Already have an account? Sign in'}
            {mode === 'forgot' && 'Already know it? Back to sign in'}
          </button>
          {mode === 'signin' && (
            <button
              onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
              className="mt-1 text-white/40 text-sm hover:text-white/70 w-full text-center flex items-center justify-center gap-1"
            >
              <KeyRound size={13} /> Forgot password?
            </button>
          )}
          <p className="mt-6 text-white/30 text-xs text-center">Your library, your keys — AI powered</p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
