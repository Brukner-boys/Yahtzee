'use strict';

const crypto = require('node:crypto');

const HMAC_ALGO = 'sha256';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret() {
  const env = process.env.HMAC_SECRET;
  if (env && env.length >= 16) return env;
  // Dev fallback ONLY — not for production. Warn loudly.
  if (!global.__yatziWarnedSecret) {
    console.warn('[auth] HMAC_SECRET env var not set; using ephemeral dev secret (tokens invalid after restart)');
    global.__yatziWarnedSecret = true;
    global.__yatziEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return global.__yatziEphemeralSecret;
}

function sign(payload) {
  const secret = getSecret();
  return crypto.createHmac(HMAC_ALGO, secret).update(payload).digest();
}

function createToken(claims, ttlSeconds) {
  if (!claims || typeof claims !== 'object') throw new Error('claims required');
  const exp = Math.floor(Date.now() / 1000) + (ttlSeconds || 3600 * 6);
  const body = Object.assign({}, claims, { exp });
  const payload = b64url(JSON.stringify(body));
  const sig = b64url(sign(payload));
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64url(sign(payload));
  // constant-time compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let body;
  try { body = JSON.parse(b64urlDecode(payload).toString('utf8')); } catch (e) { return null; }
  if (!body || typeof body !== 'object') return null;
  if (typeof body.exp !== 'number') return null;
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

function randomId(bytes) {
  return crypto.randomBytes(bytes || 12).toString('hex');
}

module.exports = { createToken, verifyToken, randomId };
