jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
  })),
}));

jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const db = require('../../database');
const logger = require('../../utils/logger');
const { logActivity } = require('../../utils/activityLogger');

describe('logActivity', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts activity log into DB', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    db.prepare.mockReturnValue({ run: runMock });

    logActivity(1, 'create_vente', 'vente', 42, '100€');

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO activity_logs'));
    expect(runMock).toHaveBeenCalledWith(1, 'create_vente', 'vente', 42, '100€');
  });

  test('handles null optional fields', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    db.prepare.mockReturnValue({ run: runMock });

    logActivity(1, 'login');
    expect(runMock).toHaveBeenCalledWith(1, 'login', null, null, null);
  });

  test('handles null userId with ?? null', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    db.prepare.mockReturnValue({ run: runMock });

    logActivity(null, 'system_action');
    expect(runMock).toHaveBeenCalledWith(null, 'system_action', null, null, null);
  });

  test('logs warning on DB error instead of throwing', () => {
    db.prepare.mockImplementation(() => { throw new Error('DB error'); });

    expect(() => logActivity(1, 'test')).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'Activity log insert failed',
      expect.objectContaining({ error: 'DB error' })
    );
  });
});
