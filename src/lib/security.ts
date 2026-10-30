import crypto from 'crypto';

const COOKIE_NAME = 'exp_user_id';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function getCookieSecret(): string {
  return process.env.COOKIE_SIGNING_SECRET || 'dev-default-cookie-signing-secret-minimum-32-chars';
}

function getIpSalt(): string {
  return process.env.IP_HASH_SALT || 'dev-default-ip-hash-salt-minimum-32-chars';
}

/**
 * Signs a user ID with HMAC-SHA256.
 */
export function signUserId(userId: string): string {
  const hmac = crypto.createHmac('sha256', getCookieSecret());
  hmac.update(userId);
  const sig = hmac.digest('hex');
  return `${userId}.${sig}`;
}

/**
 * Verifies a signed cookie value. Returns userId if valid, or null if invalid or tampered.
 */
export function verifySignedUserId(signedValue: string | null | undefined): string | null {
  if (!signedValue || !signedValue.includes('.')) {
    return null;
  }

  const parts = signedValue.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [userId, sig] = parts;
  if (!userId || !sig) {
    return null;
  }

  const hmac = crypto.createHmac('sha256', getCookieSecret());
  hmac.update(userId);
  const expectedSig = hmac.digest('hex');

  // Constant-time comparison
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return userId;
}

/**
 * Computes a salted SHA-256 hash of an IP address (N-25).
 */
export function hashIp(ipAddress: string | null | undefined): string {
  const ip = ipAddress || '127.0.0.1';
  const hmac = crypto.createHmac('sha256', getIpSalt());
  hmac.update(ip);
  return hmac.digest('hex');
}

export { COOKIE_NAME, ONE_YEAR_SECONDS };

