jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    all: jest.fn(() => []),
    get: jest.fn(() => null),
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
const { notify, notifyAdminsAndManagers, notifyChatteur, notifyAllChatteurs } = require('../../utils/notifier');

function mockPrepareBySQL(mapping) {
  db.prepare.mockImplementation((sql) => {
    for (const [pattern, stmt] of Object.entries(mapping)) {
      if (sql.includes(pattern)) return stmt;
    }
    return { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn(() => ({ lastInsertRowid: 1 })) };
  });
}

describe('notify', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts notification into DB', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    db.prepare.mockReturnValue({ run: runMock });

    notify(1, 'vente', 'Titre', 'Message', '/link');

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notifications'));
    expect(runMock).toHaveBeenCalledWith(1, 'vente', 'Titre', 'Message', '/link');
  });

  test('handles null message and link', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    db.prepare.mockReturnValue({ run: runMock });

    notify(1, 'annonce', 'Titre');
    expect(runMock).toHaveBeenCalledWith(1, 'annonce', 'Titre', null, null);
  });

  test('logs warning on DB error instead of throwing', () => {
    db.prepare.mockImplementation(() => { throw new Error('DB locked'); });

    expect(() => notify(1, 'vente', 'Test')).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'Notification insert failed',
      expect.objectContaining({ error: 'DB locked' })
    );
  });
});

describe('notifyAdminsAndManagers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('notifies all admin and manager users', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    mockPrepareBySQL({
      "role IN ('admin', 'manager')": { all: jest.fn(() => [{ id: 1 }, { id: 2 }]) },
      'INSERT INTO notifications': { run: runMock },
    });

    notifyAdminsAndManagers('annonce', 'Hey', 'Msg');
    expect(runMock).toHaveBeenCalledTimes(2);
  });

  test('logs warning on error', () => {
    db.prepare.mockImplementation(() => { throw new Error('fail'); });
    expect(() => notifyAdminsAndManagers('annonce', 'Test')).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('notifyChatteur', () => {
  beforeEach(() => jest.clearAllMocks());

  test('finds user_id from chatteur_id and notifies', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    mockPrepareBySQL({
      'FROM chatteurs': { get: jest.fn(() => ({ user_id: 5 })) },
      'INSERT INTO notifications': { run: runMock },
    });

    notifyChatteur(10, 'paie', 'Paie prête', 'Détails', '/paie');
    expect(runMock).toHaveBeenCalledWith(5, 'paie', 'Paie prête', 'Détails', '/paie');
  });

  test('does nothing if chatteur has no user_id', () => {
    const runMock = jest.fn();
    mockPrepareBySQL({
      'FROM chatteurs': { get: jest.fn(() => ({ user_id: null })) },
      'INSERT INTO notifications': { run: runMock },
    });

    notifyChatteur(10, 'vente', 'Test');
    expect(runMock).not.toHaveBeenCalled();
  });

  test('logs warning on error', () => {
    db.prepare.mockImplementation(() => { throw new Error('fail'); });
    expect(() => notifyChatteur(1, 'vente', 'Test')).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('notifyAllChatteurs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('notifies all active chatteurs with user_id', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 1 }));
    mockPrepareBySQL({
      'FROM chatteurs WHERE actif': { all: jest.fn(() => [{ user_id: 3 }, { user_id: 7 }]) },
      'INSERT INTO notifications': { run: runMock },
    });

    notifyAllChatteurs('annonce', 'Annonce', 'Important');
    expect(runMock).toHaveBeenCalledTimes(2);
  });
});
