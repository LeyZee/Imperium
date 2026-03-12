import { describe, test, expect, beforeEach, vi } from 'vitest';
import { getCached, setCache, invalidateCache, clearCache } from '../../utils/apiCache';

describe('apiCache', () => {
  beforeEach(() => {
    clearCache();
  });

  test('returns null for unknown key', () => {
    expect(getCached('unknown')).toBeNull();
  });

  test('stores and retrieves data', () => {
    const data = { id: 1, name: 'test' };
    setCache('test-key', data);
    expect(getCached('test-key')).toEqual(data);
  });

  test('returns null for expired entry', () => {
    vi.useFakeTimers();
    setCache('expire-key', { value: 1 }, 1000); // 1 second TTL
    expect(getCached('expire-key')).toEqual({ value: 1 });

    vi.advanceTimersByTime(1500); // advance past TTL
    expect(getCached('expire-key')).toBeNull();
    vi.useRealTimers();
  });

  test('invalidateCache removes matching keys', () => {
    setCache('/api/ventes/1', { id: 1 });
    setCache('/api/ventes/2', { id: 2 });
    setCache('/api/chatteurs/1', { id: 3 });

    invalidateCache('/api/ventes');
    expect(getCached('/api/ventes/1')).toBeNull();
    expect(getCached('/api/ventes/2')).toBeNull();
    expect(getCached('/api/chatteurs/1')).toEqual({ id: 3 });
  });

  test('clearCache removes everything', () => {
    setCache('a', 1);
    setCache('b', 2);
    clearCache();
    expect(getCached('a')).toBeNull();
    expect(getCached('b')).toBeNull();
  });

  test('uses default TTL of 5 minutes', () => {
    vi.useFakeTimers();
    setCache('ttl-key', 'data');

    vi.advanceTimersByTime(299000); // 4m59s
    expect(getCached('ttl-key')).toBe('data');

    vi.advanceTimersByTime(2000); // 5m01s total
    expect(getCached('ttl-key')).toBeNull();
    vi.useRealTimers();
  });

  test('custom TTL overrides default', () => {
    vi.useFakeTimers();
    setCache('custom-ttl', 'data', 5000); // 5s TTL

    vi.advanceTimersByTime(4000);
    expect(getCached('custom-ttl')).toBe('data');

    vi.advanceTimersByTime(2000); // 6s total
    expect(getCached('custom-ttl')).toBeNull();
    vi.useRealTimers();
  });
});
