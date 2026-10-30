import { describe, it, expect } from 'vitest';
import { signUserId, verifySignedUserId, hashIp } from '@/lib/security';

describe('Security and Identity (FR-20, N-25)', () => {
  it('signs and verifies user ID correctly', () => {
    const userId = 'usr_test_12345';
    const signed = signUserId(userId);

    expect(signed).toContain(userId);
    const verified = verifySignedUserId(signed);
    expect(verified).toBe(userId);
  });

  it('rejects tampered signed cookie', () => {
    const userId = 'usr_test_12345';
    const signed = signUserId(userId);

    // Tamper with userId or signature
    const tampered = `usr_hacked_99999.${signed.split('.')[1]}`;
    expect(verifySignedUserId(tampered)).toBeNull();

    const tamperedSig = `${userId}.bad_signature`;
    expect(verifySignedUserId(tamperedSig)).toBeNull();
  });

  it('rejects malformed cookie values', () => {
    expect(verifySignedUserId(null)).toBeNull();
    expect(verifySignedUserId('')).toBeNull();
    expect(verifySignedUserId('no-dot-here')).toBeNull();
    expect(verifySignedUserId('a.b.c')).toBeNull();
  });

  it('hashes IP addresses with salt (never raw)', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '10.0.0.1';

    const hash1 = hashIp(ip1);
    const hash2 = hashIp(ip2);

    expect(hash1).not.toBe(ip1);
    expect(hash1).toHaveLength(64); // SHA-256 hex
    expect(hash1).not.toBe(hash2);
    // Same IP yields same salted hash
    expect(hashIp(ip1)).toBe(hash1);
  });
});

