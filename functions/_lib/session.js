// Signed session cookie (HS256 JWT) using Web Crypto — no external libraries.
const enc = new TextEncoder();
const COOKIE = 'mathify_session';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJSON(obj) { return b64url(enc.encode(JSON.stringify(obj))); }
function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is missing or too short');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sign(payload, secret) {
  const head = b64urlJSON({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJSON({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64url(sig);
}

export async function verify(token, secret) {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(s), enc.encode(h + '.' + b));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(b)));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

export function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function cookieHeader(name, value, { maxAge = MAX_AGE, secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (secure ? '; Secure' : '');
}

export const SESSION_COOKIE = COOKIE;
