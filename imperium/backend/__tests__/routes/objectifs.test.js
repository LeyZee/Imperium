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
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));

const db = require('../../database');
const router = require('../../routes/objectifs');
const adminApp = createApp('/api/objectifs', router, 'admin');
const chatteurApp = createApp('/api/objectifs', router, 'chatteur');

describe('GET /api/objectifs/suggestions', () => {
  test('returns suggestions', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ total_brut: 500, debut: '2026-02-01' }]) }));
    const res = await request(adminApp).get('/api/objectifs/suggestions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suggestions');
  });
});

describe('GET /api/objectifs/collectif', () => {
  test('returns null when no collectif', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null), all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/objectifs/collectif').query({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/objectifs/collectif', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/objectifs/collectif').send({ montant_cible: 5000 });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/objectifs/collectif').send({
      montant_cible: 5000, periode_debut: '2026-03-01', periode_fin: '2026-03-15',
      paliers: [{ seuil_pct: 80, bonus_par_chatteur: 20, label: 'Bronze' }],
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/objectifs/paliers-primes', () => {
  test('returns paliers', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, seuil_net_ht: 500, bonus: 15 }]) }));
    const res = await request(adminApp).get('/api/objectifs/paliers-primes').query({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
