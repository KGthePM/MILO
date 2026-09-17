// Face ID / Touch ID app lock — a privacy curtain, not authentication.
//
// The Supabase session stays signed in (that's the point: no logouts when iOS
// purges webview storage). This module gates *when the app UI is visible*:
// when enabled, MILO asks for biometrics on cold start and whenever the app
// returns to the foreground after being backgrounded.
//
// Setting is stored via @capacitor/preferences (UserDefaults) — not
// localStorage — so it survives WKWebView storage purges, and it's read
// before first paint of the gated UI (AppLockGate shows a curtain until the
// check completes).

const PREF_KEY = 'milo.applock.enabled';

export async function getAppLockEnabled() {
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: PREF_KEY });
  return value === 'true';
}

export async function setAppLockEnabled(enabled) {
  const { Preferences } = await import('@capacitor/preferences');
  if (enabled) {
    await Preferences.set({ key: PREF_KEY, value: 'true' });
  } else {
    await Preferences.remove({ key: PREF_KEY });
  }
}

// Resolves { available, biometryType } — used by the settings toggle so it
// can disable itself on devices with no biometrics and show which type.
export async function getBiometryStatus() {
  const { BiometricAuth, BiometryType } = await import(
    '@aparajita/capacitor-biometric-auth'
  );
  try {
    const status = await BiometricAuth.checkBiometry();
    return {
      available: status.isAvailable && status.biometryType !== BiometryType.none,
      biometryType: status.biometryType,
    };
  } catch {
    return { available: false, biometryType: 0 };
  }
}

// Runs the system Face ID prompt. Resolves true on success; false if the
// user cancelled / failed / biometry became unavailable while backgrounded.
// allowDeviceCredential: true → falls back to the device passcode, so users
// on passcode-only devices (or after failed Face ID attempts) can still unlock
// instead of being locked out.
export async function runBiometricPrompt(reason) {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  try {
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
      iosFallbackTitle: 'Enter Passcode',
      cancelTitle: 'Cancel',
    });
    return true;
  } catch {
    return false;
  }
}

export const BIOMETRY_LABELS = {
  0: 'Biometrics',
  1: 'Touch ID',
  2: 'Face ID',
  3: 'Fingerprint',
  4: 'Face',
  5: 'Iris',
};
