import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '../src/services/crypto';

describe('isEncrypted', () => {
  it('returns true for a well-formed encrypted payload', () => {
    expect(
      isEncrypted({ encrypted: true, salt: 'a', iv: 'b', data: 'c' })
    ).toBe(true);
  });

  it('returns false for non-objects and partial shapes', () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted('plain text')).toBe(false);
    expect(isEncrypted({ encrypted: true })).toBe(false);
    expect(isEncrypted({ encrypted: true, salt: 'a' })).toBe(false);
    expect(isEncrypted({ encrypted: false, salt: 'a', iv: 'b', data: 'c' })).toBe(false);
    expect(isEncrypted({ salt: 'a', iv: 'b', data: 'c' })).toBe(false);
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips plaintext with the same password', async () => {
    const payload = await encrypt('secret', 'hello world');
    expect(await decrypt('secret', payload)).toBe('hello world');
  });

  it('round-trips non-ASCII and long text', async () => {
    const text = '中文内容 🚀\nwith newlines & special <chars>';
    const payload = await encrypt('pw', text);
    expect(await decrypt('pw', payload)).toBe(text);
  });

  it('produces different salt/iv/data on each encryption', async () => {
    const a = await encrypt('pw', 'same');
    const b = await encrypt('pw', 'same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('produces encrypted payloads that isEncrypted accepts', async () => {
    const payload = await encrypt('pw', 'x');
    expect(isEncrypted(payload)).toBe(true);
  });

  it('throws when decrypting with the wrong password', async () => {
    const payload = await encrypt('right', 'data');
    await expect(decrypt('wrong', payload)).rejects.toThrow();
  });

  it('decrypts the same ciphertext regardless of timing (stable format)', async () => {
    const payload = await encrypt('stable', 'v1');
    const again = await decrypt('stable', payload);
    expect(again).toBe('v1');
  });
});