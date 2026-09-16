import { createClient } from '@supabase/supabase-js';
import { IS_CLOUD } from './mode';
import { IS_NATIVE, nativeStorageAdapter } from './native';

let _client = null;

export function getSupabase() {
  if (!IS_CLOUD) return null;
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Cloud mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Add them to .env.local or switch to VITE_MILO_MODE=local.'
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // detectSessionInUrl parses tokens out of the URL on load. On iOS
      // (capacitor://localhost) confirmation links must be handled by the
      // deep-link listener instead — leave URL parsing to the web build.
      detectSessionInUrl: !IS_NATIVE,
      // localStorage inside a WKWebView can be purged by the OS under storage
      // pressure, logging users out. @capacitor/preferences (UserDefaults)
      // survives; supabase-js supports async storage adapters.
      ...(IS_NATIVE ? { storage: nativeStorageAdapter() } : {}),
    },
  });
  return _client;
}
