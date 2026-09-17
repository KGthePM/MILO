import { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Smartphone } from 'lucide-react';

// Security settings — Face ID app lock toggle (native only; the tab itself is
// hidden on web/local). Enabling runs one biometric check immediately so the
// user confirms the mechanism works before relying on it.

export default function SecuritySection() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);
  const [label, setLabel] = useState('Biometrics');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { getAppLockEnabled, getBiometryStatus, BIOMETRY_LABELS } = await import(
        '../../utils/appLock'
      );
      const [on, status] = await Promise.all([getAppLockEnabled(), getBiometryStatus()]);
      if (!active) return;
      setEnabled(on);
      setAvailable(status.available);
      setLabel(BIOMETRY_LABELS[status.biometryType] || 'Biometrics');
    })();
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    if (busy || !available) return;
    setBusy(true);
    try {
      if (enabled) {
        const { setAppLockEnabled } = await import('../../utils/appLock');
        await setAppLockEnabled(false);
        setEnabled(false);
      } else {
        const { setAppLockEnabled, runBiometricPrompt } = await import('../../utils/appLock');
        // Verify the mechanism before arming the lock.
        const ok = await runBiometricPrompt(`Lock MILO with ${label}?`);
        if (ok) {
          await setAppLockEnabled(true);
          setEnabled(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <ShieldCheck className="text-neon-cyan" size={20} /> Security
      </h2>
      <p className="text-white/40 text-sm mb-6">Protect your library on this device.</p>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <Lock className="text-neon-cyan shrink-0 mt-0.5" size={18} />
          <div className="min-w-0">
            <p className="text-white font-medium text-sm">
              {label} app lock
            </p>
            <p className="text-white/40 text-xs mt-1">
              {available
                ? `Ask for ${label} every time MILO is opened or returns from the background. You stay signed in — this locks the app, not your account.`
                : `${label} isn't set up on this device. Add it in iOS Settings first.`}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy || !available}
          aria-pressed={enabled}
          className={`relative shrink-0 w-12 h-7 rounded-full border transition-all disabled:opacity-40 ${
            enabled
              ? 'bg-cyan-500/40 border-cyan-400/60'
              : 'bg-white/5 border-white/15'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              enabled ? 'left-6' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <Smartphone className="text-white/30 shrink-0 mt-0.5" size={16} />
        <p className="text-white/30 text-xs">
          If {label} fails twice, MILO falls back to your device passcode. Disabling
          the lock doesn't sign you out.
        </p>
      </div>
    </div>
  );
}
