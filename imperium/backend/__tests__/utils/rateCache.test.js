jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
  })),
}));

jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const db = require('../../database');

// Must re-require to reset module-level cache between tests
let rateCache;

function loadFresh() {
  jest.resetModules();
  // Re-apply mocks after reset
  jest.doMock('../../database', () => ({
    prepare: jest.fn(() => ({
      get: jest.fn(() => null),
      run: jest.fn(() => ({ lastInsertRowid: 1 })),
    })),
  }));
  jest.doMock('../../utils/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }));
  return require('../../utils/rateCache');
}

describe('getExchangeRate', () => {
  test('returns DB rate when available', () => {
    const mod = loadFresh();
    const freshDb = require('../../database');
    freshDb.prepare.mockReturnValue({
      get: jest.fn(() => ({ taux: 0.89 })),
    });

    expect(mod.getExchangeRate()).toBe(0.89);
  });

  test('returns fallback 0.92 when no DB row', () => {
    const mod = loadFresh();
    const freshDb = require('../../database');
    freshDb.prepare.mockReturnValue({
      get: jest.fn(() => null),
    });

    expect(mod.getExchangeRate()).toBe(0.92);
  });

  test('caches rate and reuses on second call', () => {
    const mod = loadFresh();
    const freshDb = require('../../database');
    const getMock = jest.fn(() => ({ taux: 0.88 }));
    freshDb.prepare.mockReturnValue({ get: getMock });

    mod.getExchangeRate();
    mod.getExchangeRate();

    // DB should only be called once due to caching
    expect(freshDb.prepare).toHaveBeenCalledTimes(1);
  });

  test('invalidateRateCache clears cache', () => {
    const mod = loadFresh();
    const freshDb = require('../../database');

    // First call populates cache
    const getMock = jest.fn()
      .mockReturnValueOnce({ taux: 0.88 })
      .mockReturnValueOnce({ taux: 0.90 });
    freshDb.prepare.mockReturnValue({ get: getMock });

    expect(mod.getExchangeRate()).toBe(0.88);

    // Invalidate and re-fetch
    mod.invalidateRateCache();
    expect(mod.getExchangeRate()).toBe(0.90);
    expect(freshDb.prepare).toHaveBeenCalledTimes(2);
  });
});
