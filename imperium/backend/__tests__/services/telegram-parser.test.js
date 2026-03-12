// Mock database to avoid SQLite lock issues
jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    all: jest.fn(() => []),
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
  })),
}));

const { parseReport, isShiftReport, GROUP_PLATFORM } = require('../../services/telegram-parser');

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
