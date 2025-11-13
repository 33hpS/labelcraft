// Minimal JWT HS256 verification for Cloudflare Workers
// Usage: const { valid, payload, error } = await verifyJWTFromRequest(request, env.JWT_SECRET)

function base64urlDecode(input) {
  // Replace URL-safe chars
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '='
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  const decoded = atob(input);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function importHS256Key(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

export async function verifyJWT(token, secret) {
  try {
    if (!token || !secret) return { valid: false, error: 'missing_token_or_secret' };
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'invalid_format' };
    const [headerB64, payloadB64, signatureB64] = parts;

    const headerJson = new TextDecoder().decode(base64urlDecode(headerB64));
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') return { valid: false, error: 'unsupported_alg' };

    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    // Verify exp if present
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return { valid: false, error: 'token_expired', payload };
    }

    const key = await importHS256Key(secret);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64urlDecode(signatureB64);

    const ok = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    return ok ? { valid: true, payload } : { valid: false, error: 'signature_invalid', payload };
  } catch (e) {
    return { valid: false, error: 'jwt_error', details: e.message };
  }
}

export async function verifyJWTFromRequest(request, secret) {
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { valid: false, error: 'no_bearer' };
  }
  const token = auth.slice(7).trim();
  return verifyJWT(token, secret);
}

// ============ JWT SIGNING (HS256) ============
function base64urlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return b64;
}

async function importHS256KeyForSign(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signJWT(payload, secret, { expiresInSec = 8 * 60 * 60, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  if (!secret) throw new Error('missing_secret');
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: nowSec,
    exp: nowSec + (expiresInSec || 0),
    ...payload,
  };

  const enc = new TextEncoder();
  const headerStr = JSON.stringify(header);
  const payloadStr = JSON.stringify(fullPayload);

  const headerB64 = base64urlEncode(enc.encode(headerStr));
  const payloadB64 = base64urlEncode(enc.encode(payloadStr));

  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const key = await importHS256KeyForSign(secret);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  const token = `${headerB64}.${payloadB64}.${signatureB64}`;
  return { token, payload: fullPayload };
}
