const { createHmac, timingSafeEqual } = require('node:crypto');

const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('AUTH_SECRET must be configured with at least 32 characters');
    error.statusCode = 500;
    throw error;
  }
  return secret;
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createAccessToken(userId, role) {
  if (role !== 'organizer' && role !== 'attendee') {
    throw new Error('Unsupported access-token role');
  }
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
  })).toString('base64url');
  return `${payload}.${sign(payload, getSecret())}`;
}

function verifyAccessToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const secret = getSecret();
  const expected = Buffer.from(sign(payload, secret), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string' || !claims.sub ||
      (claims.role !== 'organizer' && claims.role !== 'attendee') ||
      typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return { id: claims.sub, role: claims.role };
}

module.exports = { createAccessToken, verifyAccessToken };
