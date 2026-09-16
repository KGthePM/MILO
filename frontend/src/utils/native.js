// Native-platform (Capacitor) helpers. Imported from web code, so every
// Capacitor API call is dynamically imported — the plugin modules must never
// be part of a plain-web bundle graph at module-eval time.
//
// IS_NATIVE is computed synchronously from the webview origin, matching the
// protocol check in _openaiCompatible.js.

export const IS_NATIVE = (() => {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:';
})();

// supabase-js storage adapter backed by @capacitor/preferences (UserDefaults
// on iOS). Async — supabase-js awaits getItem/setItem/removeItem.
export function nativeStorageAdapter() {
  return {
    async getItem(key) {
      const { Preferences } = await import('@capacitor/preferences');
      return (await Preferences.get({ key })).value;
    },
    async setItem(key, value) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    },
    async removeItem(key) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    },
  };
}
