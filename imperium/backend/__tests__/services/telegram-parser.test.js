jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    all: jest.fn(() => []),
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
  })),
}));

jest.mock('../../utils/period', () => ({
  getPeriode: jest.fn((date) => ({ debut: '2026-03-01', fin: '2026-03-15' })),
}));

const db = require('../../database');
const { parseReport, isShiftReport, GROUP_PLATFORM, findChatteur, isDuplicate, findShiftForVente, insertVente, processMessage } = require('../../services/telegram-parser');

/** Helper: set up db.prepare to return different stmts based on SQL pattern */
function mockPrepareBySQL(mapping) {
  db.prepare.mockImplementation((sql) => {
    for (const [pattern, stmt] of Object.entries(mapping)) {
      if (sql.includes(pattern)) return stmt;
    }
    return { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn(() => ({ lastInsertRowid: 1 })) };
  });
}

describe('isShiftReport', () => {
  test('detects "montant brut" format', () => {
    expect(isShiftReport('Montant brut: 150€')).toBe(true);
  });

  test('detects "montants générés" format', () => {
    expect(isShiftReport('Fin de shift 12/03/2026  Montants générés: 18€  Abonnés: Yoh')).toBe(true);
  });

  test('detects "montant généré" singular format', () => {
    expect(isShiftReport('Montant généré: 50€')).toBe(true);
  });

  test('detects "fin de shift" with amount', () => {
    expect(isShiftReport('Fin de shift 12/03/2026 50€')).toBe(true);
  });

  test('rejects random messages', () => {
    expect(isShiftReport('Salut tout le monde')).toBe(false);
    expect(isShiftReport('Bonjour')).toBe(false);
  });

  test('rejects null/empty', () => {
    expect(isShiftReport(null)).toBe(false);
    expect(isShiftReport('')).toBe(false);
  });

  test('rejects "fin de shift" without amount', () => {
    expect(isShiftReport('Fin de shift terminé')).toBe(false);
  });
});

describe('parseReport', () => {
  test('parses montant brut with number', () => {
    const result = parseReport('Montant brut: 150.50$');
    expect(result.montant_brut).toBeCloseTo(150.50);
    expect(result.date).toBeDefined();
  });

  test('parses montant brut with comma separator', () => {
    const result = parseReport('montant brut : 1234,56€');
    expect(result.montant_brut).toBeCloseTo(1234.56);
  });

  test('parses montant brut case insensitive', () => {
    const result = parseReport('MONTANT BRUT: 200');
    expect(result.montant_brut).toBe(200);
  });

  test('parses "Montants générés: 18€" format', () => {
    const result = parseReport('Fin de shift 12/03/2026  Montants générés: 18€  Abonnés: Yoh');
    expect(result.montant_brut).toBe(18);
    expect(result.date).toBe('2026-03-12');
  });

  test('parses "Montant généré: 50€" singular format', () => {
    const result = parseReport('Montant généré: 50€');
    expect(result.montant_brut).toBe(50);
  });

  test('parses "Montants generes" without accents', () => {
    const result = parseReport('Montants generes: 75€');
    expect(result.montant_brut).toBe(75);
  });

  test('fallback: parses standalone amount with currency', () => {
    const result = parseReport('Fin de shift 12/03/2026 25€');
    expect(result.montant_brut).toBe(25);
    expect(result.date).toBe('2026-03-12');
  });

  test('fallback: parses dollar amount', () => {
    const result = parseReport('Fin de shift 100$');
    expect(result.montant_brut).toBe(100);
  });

  test('extracts date from message dd/mm/yyyy', () => {
    const result = parseReport('15/03/2024 Montant brut: 100');
    expect(result.date).toBe('2024-03-15');
    expect(result.montant_brut).toBe(100);
  });

  test('extracts date from message dd-mm-yy', () => {
    const result = parseReport('01-06-24 montant brut 50');
    expect(result.date).toBe('2024-06-01');
  });

  test('uses today date when no date in message', () => {
    const result = parseReport('Montant brut: 75');
    const today = new Date().toISOString().split('T')[0];
    expect(result.date).toBe(today);
  });

  test('returns error when no montant found at all', () => {
    const result = parseReport('Hello, this is a random message');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('parser');
  });

  test('returns error for zero montant', () => {
    const result = parseReport('Montant brut: 0');
    expect(result.error).toBeDefined();
  });

  test('returns error for negative montant', () => {
    const result = parseReport('Montant brut: -50');
    expect(result.error).toBeDefined();
  });

  test('parses comma decimal in "montants générés" format', () => {
    const result = parseReport('Montants générés: 123,45€');
    expect(result.montant_brut).toBeCloseTo(123.45);
  });
});

describe('GROUP_PLATFORM', () => {
  test('maps known Telegram groups to platform IDs', () => {
    expect(GROUP_PLATFORM['-1003327391292']).toBe(2); // Reveal
    expect(GROUP_PLATFORM['-1003428313874']).toBe(2); // Reveal
    expect(GROUP_PLATFORM['-1003438053612']).toBe(1); // OnlyFans
  });

  test('returns undefined for unknown group', () => {
    expect(GROUP_PLATFORM['unknown-id']).toBeUndefined();
  });
});

describe('findChatteur', () => {
  beforeEach(() => jest.clearAllMocks());

  test('finds by telegram_user_id (exact match)', () => {
    const chatteur = { id: 1, prenom: 'AXEL', telegram_user_id: 12345 };
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => chatteur), all: jest.fn(() => []), run: jest.fn() },
    });
    const result = findChatteur('Axel', 12345);
    expect(result).toEqual(chatteur);
  });

  test('falls back to fuzzy name match', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() },
      'SELECT * FROM chatteurs WHERE actif': { get: jest.fn(), all: jest.fn(() => [
        { id: 1, prenom: 'AXEL', telegram_user_id: null },
        { id: 2, prenom: 'CHARBEL', telegram_user_id: null },
      ]), run: jest.fn() },
      'UPDATE chatteurs': { get: jest.fn(), all: jest.fn(), run: jest.fn() },
    });
    const result = findChatteur('Axel', 99999);
    expect(result.prenom).toBe('AXEL');
  });

  test('returns null when name is null and no ID', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() },
    });
    const result = findChatteur(null, null);
    expect(result).toBeNull();
  });

  test('returns undefined when no match found', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() },
      'SELECT * FROM chatteurs WHERE actif': { get: jest.fn(), all: jest.fn(() => [
        { id: 1, prenom: 'AXEL', telegram_user_id: null },
      ]), run: jest.fn() },
    });
    const result = findChatteur('UnknownPerson', 99999);
    expect(result).toBeUndefined();
  });

  test('auto-saves telegram_user_id on name match', () => {
    const runMock = jest.fn();
    db.prepare.mockImplementation((sql) => {
      if (sql.includes('UPDATE chatteurs SET')) return { get: jest.fn(), all: jest.fn(), run: runMock };
      if (sql.includes('telegram_user_id = ?')) return { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() };
      if (sql.includes('WHERE actif = 1')) return { get: jest.fn(), all: jest.fn(() => [
        { id: 5, prenom: 'PIERRE', telegram_user_id: null },
      ]), run: jest.fn() };
      return { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() };
    });
    findChatteur('Pierre', 55555);
    expect(runMock).toHaveBeenCalledWith(55555, 5);
  });
});

describe('isDuplicate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('detects existing duplicate', () => {
    mockPrepareBySQL({
      'SELECT id FROM ventes': { get: jest.fn(() => ({ id: 42 })), all: jest.fn(), run: jest.fn() },
    });
    const result = isDuplicate(1, 2, 100, '2026-03-01', '2026-03-15');
    expect(result).toEqual({ id: 42 });
  });

  test('returns null when no duplicate', () => {
    mockPrepareBySQL({
      'SELECT id FROM ventes': { get: jest.fn(() => null), all: jest.fn(), run: jest.fn() },
    });
    const result = isDuplicate(1, 2, 100, '2026-03-01', '2026-03-15');
    expect(result).toBeNull();
  });
});

describe('findShiftForVente', () => {
  beforeEach(() => jest.clearAllMocks());

  test('finds shift within ±1 day window', () => {
    const shift = { id: 10, modele_id: 3 };
    mockPrepareBySQL({
      'SELECT id, modele_id FROM shifts': { get: jest.fn(() => shift), all: jest.fn(), run: jest.fn() },
    });
    const result = findShiftForVente(1, 2, '2026-03-10');
    expect(result).toEqual(shift);
  });

  test('returns null when no matching shift', () => {
    mockPrepareBySQL({
      'SELECT id, modele_id FROM shifts': { get: jest.fn(() => null), all: jest.fn(), run: jest.fn() },
    });
    const result = findShiftForVente(1, 2, '2026-03-10');
    expect(result).toBeNull();
  });
});

describe('insertVente', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts with correct fields and validée status', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 99 }));
    mockPrepareBySQL({
      'INSERT INTO ventes': { get: jest.fn(), all: jest.fn(), run: runMock },
    });
    const result = insertVente(1, 2, 100, '2026-03-01', '2026-03-15', 'Import Telegram — test', 5, 3);
    expect(result.lastInsertRowid).toBe(99);
    expect(runMock).toHaveBeenCalledWith(1, 3, 2, 100, '2026-03-01', '2026-03-15', 'Import Telegram — test', 5);
  });

  test('handles null shift_id and modele_id', () => {
    const runMock = jest.fn(() => ({ lastInsertRowid: 100 }));
    mockPrepareBySQL({
      'INSERT INTO ventes': { get: jest.fn(), all: jest.fn(), run: runMock },
    });
    const result = insertVente(1, 2, 50, '2026-03-01', '2026-03-15', 'Import Telegram — test', null, null);
    expect(result.lastInsertRowid).toBe(100);
    expect(runMock).toHaveBeenCalledWith(1, null, 2, 50, '2026-03-01', '2026-03-15', 'Import Telegram — test', null);
  });
});

describe('processMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('skips non-report messages', () => {
    const result = processMessage({
      group_id: '-1003327391292',
      sender_name: 'Axel',
      sender_id: 123,
      message: 'Bonjour tout le monde',
    });
    expect(result.skipped).toBe(true);
  });

  test('returns error for unknown group', () => {
    const result = processMessage({
      group_id: '999999',
      sender_name: 'Axel',
      sender_id: 123,
      message: 'Montant brut: 100€',
    });
    expect(result.error).toContain('Groupe non reconnu');
  });

  test('returns error when chatteur not found', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => null), all: jest.fn(() => []), run: jest.fn() },
      'SELECT * FROM chatteurs WHERE actif': { get: jest.fn(), all: jest.fn(() => []), run: jest.fn() },
    });
    const result = processMessage({
      group_id: '-1003327391292',
      sender_name: 'Unknown',
      sender_id: 123,
      message: 'Montant brut: 100€',
    });
    expect(result.error).toContain('Chatteur non trouvé');
  });

  test('returns error for duplicate', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => ({ id: 1, prenom: 'AXEL', telegram_user_id: 123 })), all: jest.fn(() => []), run: jest.fn() },
      'SELECT id FROM ventes': { get: jest.fn(() => ({ id: 42 })), all: jest.fn(), run: jest.fn() },
    });
    const result = processMessage({
      group_id: '-1003327391292',
      sender_name: 'Axel',
      sender_id: 123,
      message: 'Montant brut: 100€',
    });
    expect(result.error).toContain('Doublon');
    expect(result.existing_id).toBe(42);
  });

  test('full success flow — creates vente', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => ({ id: 1, prenom: 'AXEL', telegram_user_id: 123 })), all: jest.fn(() => []), run: jest.fn() },
      'SELECT id FROM ventes': { get: jest.fn(() => null), all: jest.fn(), run: jest.fn() },
      'SELECT id, modele_id FROM shifts': { get: jest.fn(() => ({ id: 10, modele_id: 3 })), all: jest.fn(), run: jest.fn() },
      'INSERT INTO ventes': { get: jest.fn(), all: jest.fn(), run: jest.fn(() => ({ lastInsertRowid: 99 })) },
    });

    const result = processMessage({
      group_id: '-1003327391292',
      sender_name: 'Axel',
      sender_id: 123,
      message: 'Montant brut: 150€',
    });

    expect(result.success).toBe(true);
    expect(result.vente_id).toBe(99);
    expect(result.chatteur).toBe('AXEL');
    expect(result.montant_brut).toBe(150);
    expect(result.plateforme_id).toBe(2); // Reveal
    expect(result.shift_id).toBe(10);
  });

  test('success without matching shift', () => {
    mockPrepareBySQL({
      'telegram_user_id': { get: jest.fn(() => ({ id: 1, prenom: 'AXEL', telegram_user_id: 123 })), all: jest.fn(() => []), run: jest.fn() },
      'SELECT id FROM ventes': { get: jest.fn(() => null), all: jest.fn(), run: jest.fn() },
      'SELECT id, modele_id FROM shifts': { get: jest.fn(() => null), all: jest.fn(), run: jest.fn() },
      'INSERT INTO ventes': { get: jest.fn(), all: jest.fn(), run: jest.fn(() => ({ lastInsertRowid: 100 })) },
    });

    const result = processMessage({
      group_id: '-1003438053612', // OnlyFans
      sender_name: 'Axel',
      sender_id: 123,
      message: 'Montant brut: 200$',
    });

    expect(result.success).toBe(true);
    expect(result.shift_id).toBeNull();
    expect(result.plateforme_id).toBe(1); // OnlyFans
  });
});
