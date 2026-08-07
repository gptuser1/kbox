import { describe, it, expect } from 'vitest';
import { localtimeNow, _resetKvState } from '../src/kv';

describe('localtimeNow', () => {
  it('returns a CST timestamp string in YYYY-MM-DD HH:mm:ss format', () => {
    const result = localtimeNow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('_resetKvState', () => {
  it('clears cached table state without throwing', () => {
    expect(() => _resetKvState()).not.toThrow();
  });
});