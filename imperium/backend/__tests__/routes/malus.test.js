const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1 })) })),
  transaction: jest.fn((fn) => fn),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
}));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../services/paie-calculator', () => ({ recalculatePaies: jest.fn() }));

const db = require('../../database');
const { recalculatePaies } = require('../../services/paie-calculator');
const router = require('../../routes/malus');
const adminApp = createApp('/api/malus', router, 'admin');
const chatteurApp = createApp('/api/malus', router, 'chatteur');

describe('GET /api/malus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns malus list', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, montant: 50 }]) }));
    const res = await request(adminApp).get('/api/malus');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/malus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => null) })) // anti-duplicate: no existing
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) })); // INSERT
    const res = await request(adminApp).post('/api/malus').send({
      chatteur_id: 1, montant: 50, periode: '2026-03-01', type_malus: 'montant',
    });
    expect(res.status).toBe(201);
    expect(recalculatePaies).toHaveBeenCalled();
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/malus').send({ chatteur_id: 1 });
    expect(res.status).toBe(400);
  });

  test('409 duplicate same type', async () => {
    db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 99 })) })); // anti-duplicate: found
    const res = await request(adminApp).post('/api/malus').send({
      chatteur_id: 1, montant: 50, periode: '2026-03-01', type_malus: 'montant',
    });
    expect(res.status).toBe(409);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/malus').send({
      chatteur_id: 1, montant: 50, periode: '2026-03-01',
    });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/malus/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates malus', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, periode: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/malus/1').send({ montant: 100 });
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalled();
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/malus/999').send({ montant: 100 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/malus/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft deletes and recalculates', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ periode: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).delete('/api/malus/1');
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalled();
  });
});
