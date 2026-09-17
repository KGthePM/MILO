import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { IS_CLOUD } from '../utils/mode';
import { getSupabase } from '../utils/supabase';

// Password reset — the landing screen for recovery email links.
//
// Flow: user taps "Forgot password?" on the sign-in card → Supabase emails a
// recovery link → the link opens the app/site here (web: redirected to
// /reset-password with the session restored by supabase-js; native: the deep
// link listener exchanges the code and navigates here). The recovery session
// is a real session, so updateUser() sets the new password immediately.

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(null); // null = checking
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_CLOUD) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setHasSession(!!data.session));
  }, []);

  if (!IS_CLOUD) {
    return (
      <div className="min-h-screen bg-black text-white/60 flex items-center justify-center">
        Password reset is only available in cloud mode.
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setInfo('Password updated. Redirecting…');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen safe-area-plus bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center p-6">
      <div className="relative z-10 w-full max-w-md glass rounded-2xl p-8 neon-border-cyan">
        <div className="flex flex-col items-center text-center mb-5">
          <h1 className="text-2xl font-bold">
            <span className="neon-text-cyan">MI</span><span className="neon-text-magenta">LO</span>
          </h1>
          <p className="text-white/60 text-sm mt-2 flex items-center gap-2">
            <KeyRound size={14} /> Set a new password
          </p>
        </div>

        {hasSession === false ? (
          <div className="text-center space-y-4">
            <p className="text-white/60 text-sm">
              This link has expired or was already used. Request a new one from the
              sign-in screen.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-white font-semibold"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-white/70 text-sm block mb-1">New password</span>
              <input
                type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-white/70 text-sm block mb-1">Confirm new password</span>
              <input
                type="password" required minLength={6} value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
              />
            </label>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            {info && <div className="text-green-400 text-sm">{info}</div>}
            <button
              type="submit" disabled={submitting}
              className="w-full px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all text-white font-semibold disabled:opacity-50"
            >
              {submitting ? '…' : 'Update password'}
            </button>
            <button
              type="button" onClick={() => navigate('/')}
              className="w-full text-white/40 text-sm hover:text-white/70 flex items-center justify-center gap-1"
            >
              <ArrowLeft size={13} /> Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
