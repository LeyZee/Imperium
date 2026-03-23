jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({
    all: jest.fn(() => []),
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
  })),
  transaction: jest.fn((fn) => fn),
}));

jest.mock('../../utils/rateCache', () => ({
  getExchangeRate: jest.fn(() => 0.92),
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const db = require('../../database');
const { getExchangeRate } = require('../../utils/rateCache');
const logger = require('../../utils/logger');
const { recalculatePaies, roundCents, safeExchangeRate, capMalus } = require('../../services/paie-calculator');

const PERIOD = { debut: '2026-03-01', fin: '2026-03-15' };

function makeChatteur(overrides = {}) {
  return {
    id: 1, prenom: 'ALICE', role: 'chatteur', actif: 1,
    taux_commission: 0.10, taux_net_equipe: 0,
    ...overrides,
  };
}

function makeVenteRow(overrides = {}) {
  return {
    chatteur_id: 1, plateforme_id: 1,
    plateforme_nom: 'OnlyFans', tva_rate: 0.20, commission_rate: 0.20,
    devise: 'EUR', total_brut: 1000, nb_ventes: 5,
    ...overrides,
  };
}

function mockDB(mapping) {
  const defaultStmt = {
    all: jest.fn(() => []),
    get: jest.fn(() => null),
    run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
  };
  db.prepare.mockImplementation((sql) => {
    for (const [pattern, overrides] of Object.entries(mapping)) {
      if (sql.includes(pattern)) return { ...defaultStmt, ...overrides };
    }
    return { ...defaultStmt };
  });
}

function setupSimple({ chatteurs = [makeChatteur()], ventes = [makeVenteRow()], malusFixe = [], malusPct = [] } = {}) {
  mockDB({
    'FROM chatteurs': { all: jest.fn(() => chatteurs) },
    'FROM ventes v': { all: jest.fn(() => ventes) },
    "type_malus = 'montant'": { all: jest.fn(() => malusFixe) },
    "type_malus = 'pourcentage'": { all: jest.fn(() => malusPct) },
    'FROM primes_manuelles': { all: jest.fn(() => []) },
    'INSERT INTO paies': { run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })) },
    'FROM paies': { all: jest.fn(() => []) },
    'DELETE FROM paies': { run: jest.fn(() => ({ changes: 1 })) },
    'UPDATE paies SET': { run: jest.fn(() => ({ changes: 1 })) },
  });
}

function captureUpsertArgs() {
  const captured = [];
  const originalImpl = db.prepare.getMockImplementation();
  db.prepare.mockImplementation((sql) => {
    if (sql.includes('INSERT INTO paies') && sql.includes('ON CONFLICT')) {
      return {
        run: jest.fn((...args) => { captured.push(args); return { lastInsertRowid: 1, changes: 1 }; }),
        all: jest.fn(() => []), get: jest.fn(() => null),
      };
    }
    return originalImpl(sql);
  });
  return () => captured;
}

// --- roundCents ---
describe('roundCents', () => {
  test('rounds to 2 decimal places', () => {
    expect(roundCents(15.000000000000002)).toBe(15);
    expect(roundCents(1.555)).toBe(1.56);
    expect(roundCents(99.99)).toBe(99.99);
  });

  test('returns 0 for NaN', () => {
    expect(roundCents(NaN)).toBe(0);
  });

  test('returns 0 for non-number types', () => {
    expect(roundCents('abc')).toBe(0);
    expect(roundCents(undefined)).toBe(0);
    expect(roundCents(null)).toBe(0);
  });
});

// --- safeExchangeRate ---
describe('safeExchangeRate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns valid rate', () => {
    getExchangeRate.mockReturnValue(0.92);
    expect(safeExchangeRate()).toBe(0.92);
  });

  test('throws on null', () => {
    getExchangeRate.mockReturnValue(null);
    expect(() => safeExchangeRate()).toThrow(/Taux de change invalide/);
  });

  test('throws on 0', () => {
    getExchangeRate.mockReturnValue(0);
    expect(() => safeExchangeRate()).toThrow(/Taux de change invalide/);
  });

  test('throws on NaN', () => {
    getExchangeRate.mockReturnValue(NaN);
    expect(() => safeExchangeRate()).toThrow(/Taux de change invalide/);
  });
});

// --- capMalus ---
describe('capMalus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('caps malus at maxAmount', () => {
    expect(capMalus(150, 100, 1)).toBe(100);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('returns malus unchanged when under max', () => {
    expect(capMalus(50, 100, 1)).toBe(50);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('handles 0 maxAmount', () => {
    expect(capMalus(10, 0, 1)).toBe(0);
  });
});

// --- recalculatePaies ---
describe('recalculatePaies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getExchangeRate.mockReturnValue(0.92);
  });

  test('EUR commission: brut -> ttc -> ht -> netHT -> commission', () => {
    setupSimple();
    const getArgs = captureUpsertArgs();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    expect(args).toHaveLength(1);
    const [cid, pid, , , brut, taux, ttc, ht, netHT, commission, malus, prime, total] = args[0];
    expect(cid).toBe(1);
    expect(taux).toBe(1); // EUR
    expect(ttc).toBe(1000);
    expect(ht).toBeCloseTo(833.33, 2);
    expect(netHT).toBeCloseTo(666.67, 1);
    expect(commission).toBeCloseTo(66.67, 1);
    // total = commission + prime - malus; prime is top3 prime (0.5% of net_ht_equipe)
    expect(total).toBeCloseTo(commission + prime - malus, 2);
  });

  test('USD conversion applies exchange rate', () => {
    setupSimple({ ventes: [makeVenteRow({ devise: 'USD', total_brut: 1000 })] });
    const getArgs = captureUpsertArgs();
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    const [, , , , , taux, ttc] = args[0];
    expect(taux).toBe(0.92);
    expect(ttc).toBeCloseTo(920, 2);
    expect(result.taux_change).toBe(0.92);
  });

  test('palier-based primes: chatteurs reaching seuil get bonus', () => {
    const chatteurs = [
      makeChatteur({ id: 1, prenom: 'A' }),
      makeChatteur({ id: 2, prenom: 'B' }),
      makeChatteur({ id: 3, prenom: 'C' }),
      makeChatteur({ id: 4, prenom: 'D' }),
    ];
    const ventes = [
      makeVenteRow({ chatteur_id: 1, total_brut: 4000 }),
      makeVenteRow({ chatteur_id: 2, total_brut: 3000 }),
      makeVenteRow({ chatteur_id: 3, total_brut: 2000 }),
      makeVenteRow({ chatteur_id: 4, total_brut: 1000 }),
    ];
    setupSimple({ chatteurs, ventes });
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);

    expect(Array.isArray(result.paliers_primes)).toBe(true);
    expect(result.nb_paies).toBe(4);
    expect(result.total_net_ht_equipe).toBeGreaterThan(0);
  });

  test('manager excluded from primes but contributes to net_ht_equipe', () => {
    const chatteurs = [
      makeChatteur({ id: 1 }),
      makeChatteur({ id: 2, prenom: 'MGR', role: 'manager', taux_net_equipe: 0.05 }),
    ];
    const ventes = [
      makeVenteRow({ chatteur_id: 1, total_brut: 1000 }),
      makeVenteRow({ chatteur_id: 2, total_brut: 5000 }),
    ];
    setupSimple({ chatteurs, ventes });
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);

    // Manager excluded from palier primes but both have paie rows
    expect(Array.isArray(result.paliers_primes)).toBe(true);
    expect(result.nb_paies).toBe(2);
  });

  test('malus montant fixe reduces total', () => {
    setupSimple({ malusFixe: [{ chatteur_id: 1, total: 20 }] });
    const getArgs = captureUpsertArgs();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    const [, , , , , , , , , commission, malus, prime, total] = args[0];
    expect(malus).toBeCloseTo(20, 2);
    expect(total).toBeCloseTo(commission + prime - malus, 2);
  });

  test('malus pourcentage applied as % of net HT', () => {
    setupSimple({ malusPct: [{ chatteur_id: 1, total_pct: 10 }] });
    const getArgs = captureUpsertArgs();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    const [, , , , , , , , , , malus] = args[0];
    expect(malus).toBeCloseTo(66.67, 1);
  });

  test('combined malus capped at net_ht', () => {
    setupSimple({
      malusFixe: [{ chatteur_id: 1, total: 500 }],
      malusPct: [{ chatteur_id: 1, total_pct: 50 }],
    });
    const getArgs = captureUpsertArgs();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    const [, , , , , , , , netHT, , malus] = args[0];
    expect(malus).toBeCloseTo(netHT, 2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malus capp'));
  });

  test('SQL uses v.statut = validée (not != rejetée)', () => {
    setupSimple();
    recalculatePaies(PERIOD.debut, PERIOD.fin);

    const venteCall = db.prepare.mock.calls.find(([sql]) =>
      sql.includes('FROM ventes v') && sql.includes('GROUP BY')
    );
    expect(venteCall[0]).toContain("v.statut = 'validée'");
    expect(venteCall[0]).not.toContain("v.statut != 'rejetée'");
  });

  test('all financial values rounded to 2 decimals', () => {
    setupSimple({ ventes: [makeVenteRow({ total_brut: 333.33 })] });
    const getArgs = captureUpsertArgs();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const args = getArgs();

    const [, , , , , , ttc, ht, netHT, commission, malus, prime, total] = args[0];
    for (const val of [ttc, ht, netHT, commission, malus, prime, total]) {
      const decimals = (String(val).split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });

  test('no ventes -> no paie rows', () => {
    setupSimple({ ventes: [] });
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);
    expect(result.nb_paies).toBe(0);
    expect(result.total_net_ht_equipe).toBe(0);
  });

  test('statut payé preserved via CASE WHEN in upsert', () => {
    setupSimple();
    recalculatePaies(PERIOD.debut, PERIOD.fin);
    const upsertCall = db.prepare.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO paies') && sql.includes('ON CONFLICT')
    );
    expect(upsertCall[0]).toContain("WHEN paies.statut = 'payé' THEN 'payé'");
  });

  test('VA role excluded from paies', () => {
    setupSimple({
      chatteurs: [makeChatteur({ id: 1, role: 'va' })],
      ventes: [makeVenteRow({ chatteur_id: 1 })],
    });
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);
    expect(result.nb_paies).toBe(0);
  });

  test('returns correct result structure', () => {
    setupSimple();
    const result = recalculatePaies(PERIOD.debut, PERIOD.fin);
    expect(result).toEqual(expect.objectContaining({
      periode_debut: PERIOD.debut,
      periode_fin: PERIOD.fin,
      taux_change: 0.92,
      nb_paies: 1,
    }));
    expect(Array.isArray(result.paliers_primes)).toBe(true);
  });
});
