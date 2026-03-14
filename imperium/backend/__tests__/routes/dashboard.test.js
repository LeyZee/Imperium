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
jest.mock('../../utils/period', () => ({
  getPeriode: jest.fn().mockReturnValue({ debut: '2026-03-01', fin: '2026-03-15' }),
}));

const db = require('../../database');
const router = require('../../routes/dashboard');
const adminApp = createApp('/api/dashboard', router, 'admin');
const chatteurApp = createApp('/api/dashboard', router, 'chatteur');

describe('GET /api/dashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns KPIs for admin', async () => {
    const defaultStmt = {
      all: jest.fn(() => []),
      get: jest.fn(() => ({ taux: 0.92, c: 5, total: 100, prenom: 'Test' })),
    };
    db.prepare.mockReturnValue(defaultStmt);

    const res = await request(adminApp).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalBrutEur');
    expect(res.body).toHaveProperty('totalNetHt');
    expect(res.body).toHaveProperty('nbChatteurs');
    expect(res.body).toHaveProperty('tendances');
    expect(res.body).toHaveProperty('periodes');
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).get('/api/dashboard');
    expect(res.status).toBe(403);
  });

  test('accepts custom period params', async () => {
    const defaultStmt = {
      all: jest.fn(() => []),
      get: jest.fn(() => ({ taux: 0.92, c: 5, total: 0 })),
    };
    db.prepare.mockReturnValue(defaultStmt);

    const res = await request(adminApp).get('/api/dashboard').query({ debut: '2026-03-01', fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(res.body.periode.debut).toBe('2026-03-01');
  });
});
