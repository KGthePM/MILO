import { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { IS_NATIVE } from '../../utils/native';

// Privacy curtain for the Face ID app lock. While locked, MILO renders only
// this screen — no library data mounts, no providers fetch. Unlocking
// requires a successful biometric / passcode prompt.
//
// Native-only; web and local mode render children untouched.

export default function AppLockGate({ children }) {
  const [locked, setLocked] = useState(null); // null = checking

  useEffect(() => {
    if (!IS_NATIVE) return;
    let active = true;

    (async () => {
      const { getAppLockEnabled, getBiometryStatus, runBiometricPrompt } = await import(
        '../../utils/appLock'
      );
      const enabled = await getAppLockEnabled();
      if (!enabled) {
        if (active) setLocked(false);
        return;
      }
      const { available } = await getBiometryStatus();
      if (!available) {
        // Lock enabled but device can't do biometrics (e.g. removed fingerprints
        // since enabling). Fail open rather than lock the user out of the app.
        if (active) setLocked(false);
        return;
        // Note: runBiometricPrompt allows device-credential fallback, so this
        // only triggers when the device has neither biometrics nor passcode.
      }
      const ok = await runBiometricPrompt('Unlock MILO');
      if (active) setLocked(!ok);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Re-lock when the app is backgrounded, so coming back always re-prompts.
  useEffect(() => {
    if (!IS_NATIVE) return;
    let remove = null;
    (async () => {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) {
          const { getAppLockEnabled } = await import('../../utils/appLock');
          if (await getAppLockEnabled()) setLocked(true);
        }
      });
      remove = () => listener.remove?.();
    })();
    return () => remove?.();
  }, []);

  if (!IS_NATIVE || locked === false) return children;
  if (locked === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Lock className="text-white/20" size={40} />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Lock className="text-white/20" size={40} />
        <p className="text-white/40 text-sm mt-4">MILO is locked</p>
        <button
          onClick={async () => {
            const { runBiometricPrompt } = await import('../../utils/appLock');
            const ok = await runBiometricPrompt('Unlock MILO');
            if (ok) setLocked(false);
          }}
          className="mt-5 px-5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-white font-semibold"
        >
          Unlock
        </button>
        <p className="mt-4 text-white/25 text-xs flex items-center justify-center gap-1">
          <ShieldCheck size={12} /> Protected by Face ID
        </p>
      </div>
    </div>
  );
}
