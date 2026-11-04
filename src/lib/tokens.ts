import crypto from 'crypto';

/**
 * Generates a cryptographically secure, high-entropy random token.
 * Defaults to 32 bytes (256 bits) returning 64 hex characters.
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Computes a deterministic SHA-256 hash of a plain token.
 * Only the hash is ever stored in the database.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Constant-time comparison between two token hashes to prevent timing attacks.
 */
export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const computedHash = hashToken(rawToken);
  try {
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}
