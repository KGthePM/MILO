#!/usr/bin/env node
// Generate the Apple "client secret" JWT for Supabase's Sign in with Apple
// provider. Supabase requires this even though the native iOS flow doesn't
// consume it — the web OAuth flow exchanges it for tokens server-side.
//
// Usage:
//   node generate-apple-client-secret.js <path/to/AuthKey_XXXXXX.p8> <KEY_ID> <TEAM_ID> <SERVICES_ID> [seconds-valid]
//
// Output: the JWT on stdout (paste into Supabase → Authentication →
// Providers → Apple → Secret Key). Default validity 15777000s (~183 days).
// Apple caps JWTs at 6 months, so Supabase docs recommend regenerating every
// ~6 months — web-only login breaks quietly when it lapses (native flow is
// unaffected).

const fs = require('fs');
const crypto = require('crypto');

const [p8Path, keyId, teamId, servicesId, validFor = '15777000'] = process.argv.slice(2);

if (!p8Path || !keyId || !teamId || !servicesId) {
  console.error(
    'Usage: node generate-apple-client-secret.js <AuthKey.p8> <KEY_ID> <TEAM_ID> <SERVICES_ID> [seconds-valid]'
  );
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, 'utf8');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
const payload = b64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + parseInt(validFor, 10),
    aud: 'https://appleid.apple.com',
    sub: servicesId,
  })
);

const signingInput = `${header}.${payload}`;
// ES256 signatures in JWTs are raw r||s (IEEE P1363), not ASN.1 DER —
// Node needs dsaEncoding: 'ieee-p1363' to emit that form.
const signature = crypto
  .createSign('SHA256')
  .update(signingInput)
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

console.log(`${signingInput}.${b64url(signature)}`);
