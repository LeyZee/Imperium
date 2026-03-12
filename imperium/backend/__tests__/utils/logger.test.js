const logger = require('../../utils/logger');

describe('logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logger.error outputs JSON with level "error"', () => {
    logger.error('test error', { code: 500 });
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('test error');
    expect(output.code).toBe(500);
    expect(output.timestamp).toBeDefined();
  });

  test('logger.warn outputs JSON with level "warn"', () => {
    logger.warn('test warning');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('test warning');
  });

  test('logger.info outputs JSON with level "info"', () => {
    logger.info('test info');
    expect(consoleSpy.log).toHaveBeenCalled();
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test info');
  });

  test('logger.debug outputs JSON with level "debug"', () => {
    logger.debug('debug msg');
    expect(consoleSpy.log).toHaveBeenCalled();
    // Find the debug call (info may also be called)
    const calls = consoleSpy.log.mock.calls.map(c => JSON.parse(c[0]));
    const debugCall = calls.find(c => c.level === 'debug');
    expect(debugCall).toBeDefined();
    expect(debugCall.message).toBe('debug msg');
  });

  test('logger includes metadata in output', () => {
    logger.error('db error', { table: 'users', query: 'SELECT' });
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
    expect(output.table).toBe('users');
    expect(output.query).toBe('SELECT');
  });

  test('logger outputs valid ISO timestamp', () => {
    logger.info('timestamp test');
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    const date = new Date(output.timestamp);
    expect(date.toISOString()).toBe(output.timestamp);
  });
});
