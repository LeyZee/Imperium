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

describe('GET /api/objectifs', () => {
  test('returns objectives', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, montant_cible: 1000 }]) }));
    const res = await request(adminApp).get('/api/objectifs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/objectifs/progress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 without params', async () => {
    const res = await request(adminApp).get('/api/objectifs/progress');
    expect(res.status).toBe(400);
  });

  test('returns progress', async () => {
    db.prepare.mockReturnValue(mockStmt({
      all: jest.fn(() => [{ id: 1, montant_cible: 1000, chatteur_id: null, modele_id: null }]),
      get: jest.fn(() => ({ total: 500 })),
    }));
    const res = await request(adminApp).get('/api/objectifs/progress').query({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/objectifs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) }));
    const res = await request(adminApp).post('/api/objectifs').send({
      montant_cible: 1000, periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(201);
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/objectifs').send({ montant_cible: 1000 });
    expect(res.status).toBe(400);
  });

  test('400 montant <= 0', async () => {
    const res = await request(adminApp).post('/api/objectifs').send({
      montant_cible: -10, periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/objectifs').send({
      montant_cible: 1000, periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/objectifs/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/objectifs/1').send({ montant_cible: 2000 });
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/objectifs/999').send({ montant_cible: 2000 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/objectifs/:id', () => {
  test('soft deletes', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/objectifs/1');
    expect(res.status).toBe(200);
  });
});
