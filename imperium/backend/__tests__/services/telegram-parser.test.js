// Mock database to avoid SQLite lock issues
jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    all: jest.fn(() => []),
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
  })),
}));

const { parseReport, GROUP_PLATFORM } = require('../../services/telegram-parser');

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

  test('returns error when no montant brut found', () => {
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
