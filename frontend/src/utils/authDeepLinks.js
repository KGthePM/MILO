// Deep links (email verification + password recovery) for the native app.
//
// Supabase auth emails embed links like
//   https://<ref>.supabase.co/auth/v1/verify?...&redirect_to=<URL>
//   https://<ref>.supabase.co/auth/v1/recover?...&redirect_to=<URL>
// On web, supabase-js parses the token out of the landing URL
// (detectSessionInUrl). On native (capacitor://localhost) there is no URL to
// land on — the OS opens the redirect target, which Capacitor surfaces as an
// appUrlOpen event. Supabase v2 email links use PKCE, so the payload arrives
// as ?code=... and is exchanged via exchangeCodeForSession().
//
// Registered from AuthGate (once per app mount) on native only; web builds
// never evaluate the @capacitor/app import.

export function registerAuthDeepLinkListener(sb, onRecovery) {
  let cleanedUp = false;
  let handle = null;

  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      handle = await App.addListener('appUrlOpen', async (event) => {
        try {
          const url = new URL(event.url);
          const code = url.searchParams.get('code');
          if (!code) return;

          const isRecovery =
            url.searchParams.get('type') === 'recovery' ||
            url.pathname.includes('/recover');
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) return;

          // Route to the reset screen using the in-app router (the deep link
          // URL's own path is a supabase.co hostname the SPA can't serve).
          if (isRecovery) onRecovery?.();
          // Otherwise onAuthStateChange fires with the verified session.
        } catch {
          // Malformed deep link — ignore rather than crash the listener.
        }
      });
    } catch {
      // @capacitor/app unavailable — no listener.
    }
  })();

  return () => {
    if (cleanedUp || !handle) return;
    cleanedUp = true;
    handle.remove?.();
  };
}
