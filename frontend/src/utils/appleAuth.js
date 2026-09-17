// Sign in with Apple — native (Capacitor) + web (OAuth redirect) flows.
//
// NATIVE (iOS app): @capgo/capacitor-social-login presents the native Apple
// sheet (Face ID popup) and returns Apple's identity token, which we exchange
// for a Supabase session via signInWithIdToken. No Services ID, no secret —
// gotrue validates the JWT against Apple's public keys; the only server
// config is the bundle ID listed in the Apple provider's Client IDs.
//
// Nonce: deliberately omitted. Apple's native sheet embeds the nonce claim as
// base64url(SHA-256(nonce)) while gotrue compares hex(SHA-256(nonce)) — they
// can never match (supabase/auth#2378). Sending no nonce means no claim, and
// gotrue skips the check when neither side has one. Same trade Supabase's own
// native Google flow makes with "Skip nonce check". The token comes straight
// from the OS API in-process and is exchanged immediately over TLS, so replay
// risk is negligible.
//
// WEB: supabase.auth.signInWithOAuth does a full-page redirect through
// Supabase's Apple provider (requires the Services ID + key setup in the
// dashboard — see the setup notes in AGENTS.md).
//
// Every Capacitor API is dynamically imported so this module stays out of the
// plain-web bundle graph (same pattern as utils/native.js).

export async function nativeAppleSignIn() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({ apple: {} });
  const result = await SocialLogin.login({
    provider: 'apple',
    options: { scopes: ['email', 'name'] },
  });
  const idToken = result?.result?.idToken;
  if (!idToken) throw new Error('Apple sign-in did not return an identity token.');
  return {
    idToken,
    profile: result?.result?.profile || null,
  };
}

export async function webAppleSignIn(sb) {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// After a native Apple sign-in, copy the granted name onto the user's profile
// as display_name — but never overwrite a name the user set themselves.
export async function maybeApplyAppleDisplayName(sb, appleProfile) {
  try {
    if (!appleProfile) return;
    const name = [appleProfile.givenName, appleProfile.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!name) return;
    const { data: { user } = {}, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return;
    const { data: profile } = await sb
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.display_name) return; // user already chose a name — leave it
    await sb.from('profiles').update({ display_name: name }).eq('id', user.id);
  } catch {
    // Cosmetic only — never fail sign-in over the display name.
  }
}
