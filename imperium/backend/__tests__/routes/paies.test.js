const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1 })) })),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
}));
jest.mock('../../services/paie-calculator', () => ({ recalculatePaies: jest.fn().mockReturnValue({ created: 5 }) }));
jest.mock('../../services/facture-generator', () => ({ generateFacture: jest.fn() }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/notifier', () => ({ notifyChatteur: jest.fn(), notifyAdminsAndManagers: jest.fn() }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/csvExport', () => ({ sendCSV: jest.fn((res) => res.json({ csv: true })) }));
jest.mock('archiver', () => jest.fn(() => ({ on: jest.fn(), pipe: jest.fn(), append: jest.fn(), finalize: jest.fn() })));

const db = require('../../database');
const { recalculatePaies } = require('../../services/paie-calculator');
const router = require('../../routes/paies');
const adminApp = createApp('/api/paies', router, 'admin');
const managerApp = createApp('/api/paies', router, 'manager');
const chatteurApp = createApp('/api/paies', router, 'chatteur');

describe('GET /api/paies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 without params', async () => {
    const res = await request(adminApp).get('/api/paies');
    expect(res.status).toBe(400);
  });

  test('returns paies with params', async () => {
    const paie = { chatteur_id: 1, chatteur_prenom: 'A', net_ht_eur: 100, total_chatteur: 80, prime: 5, role: 'chatteur', chatteur_couleur: 1 };
    db.prepare.mockReturnValue(mockStmt({
      all: jest.fn(() => [paie]),
      get: jest.fn(() => ({ taux: 0.92, agency_gross: 50 })),
    }));
    const res = await request(adminApp).get('/api/paies').query({ debut: '2026-03-01', fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(res.body.paies).toBeDefined();
    expect(res.body.resume).toBeDefined();
  });
});

describe('POST /api/paies/recalculer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('recalculates as admin', async () => {
    const res = await request(adminApp).post('/api/paies/recalculer').send({ debut: '2026-03-01', fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
  });

  test('400 without params', async () => {
    const res = await request(adminApp).post('/api/paies/recalculer').send({});
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/paies/recalculer').send({ debut: '2026-03-01', fin: '2026-03-15' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/paies/:id/statut', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates statut', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ chatteur_id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/paies/1/statut').send({ statut: 'validé' });
    expect(res.status).toBe(200);
  });

  test('400 invalid statut', async () => {
    const res = await request(adminApp).put('/api/paies/1/statut').send({ statut: 'invalide' });
    expect(res.status).toBe(400);
  });

  test('403 manager cannot mark payé', async () => {
    const res = await request(managerApp).put('/api/paies/1/statut').send({ statut: 'payé' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/paies/mes-paies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns paies for chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ taux_commission: 0.15, role: 'chatteur', taux_net_equipe: 0 })),
      all: jest.fn(() => []),
    }));
    const res = await request(chatteurApp).get('/api/paies/mes-paies');
    expect(res.status).toBe(200);
    expect(res.body.paies).toBeDefined();
  });

  test('403 for admin', async () => {
    const res = await request(adminApp).get('/api/paies/mes-paies');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/paies/periodes', () => {
  test('returns periods', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ periode_debut: '2026-03-01', periode_fin: '2026-03-15' }]) }));
    const res = await request(adminApp).get('/api/paies/periodes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/paies/facture', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/paies/facture');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/paies/previsionnel', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/paies/previsionnel');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/paies/export-csv', () => {
  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/paies/export-csv');
    expect(res.status).toBe(400);
  });
});
