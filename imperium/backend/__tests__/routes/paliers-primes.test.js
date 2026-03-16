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
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));

const db = require('../../database');
const router = require('../../routes/objectifs');
const adminApp = createApp('/api/objectifs', router, 'admin');
const chatteurApp = createApp('/api/objectifs', router, 'chatteur');

const VALID_PALIERS = {
  periode_debut: '2026-03-01',
  periode_fin: '2026-03-15',
  paliers: [
    { seuil_net_ht: 500, bonus: 15, label: 'Bronze', emoji: '🥉' },
    { seuil_net_ht: 1000, bonus: 30, label: 'Argent', emoji: '🥈' },
    { seuil_net_ht: 1500, bonus: 50, label: 'Or', emoji: '🥇' },
  ],
};

describe('GET /api/objectifs/paliers-primes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty array when no paliers exist', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp)
      .get('/api/objectifs/paliers-primes?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 400 without period params', async () => {
    const res = await request(adminApp).get('/api/objectifs/paliers-primes');
    expect(res.status).toBe(400);
  });

  test('returns paliers sorted by seuil_net_ht', async () => {
    const mockPaliers = [
      { id: 1, seuil_net_ht: 500, bonus: 15, label: 'Bronze', emoji: '🥉', actif: 1 },
      { id: 2, seuil_net_ht: 1000, bonus: 30, label: 'Argent', emoji: '🥈', actif: 1 },
    ];
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => mockPaliers) }));
    const res = await request(adminApp)
      .get('/api/objectifs/paliers-primes?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].label).toBe('Bronze');
  });

  test('chatteurs can read paliers', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(chatteurApp)
      .get('/api/objectifs/paliers-primes?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/objectifs/paliers-primes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates paliers (admin)', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => null),
      run: jest.fn(() => ({ lastInsertRowid: 1 })),
    }));
    db.transaction.mockImplementation(fn => fn);

    const res = await request(adminApp)
      .post('/api/objectifs/paliers-primes')
      .send(VALID_PALIERS);
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(3);
  });

  test('rejects without paliers', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/paliers-primes')
      .send({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(400);
  });

  test('rejects negative seuil_net_ht', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/paliers-primes')
      .send({
        ...VALID_PALIERS,
        paliers: [{ seuil_net_ht: -100, bonus: 10, label: 'Bad' }],
      });
    expect(res.status).toBe(400);
  });

  test('rejects missing label', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/paliers-primes')
      .send({
        ...VALID_PALIERS,
        paliers: [{ seuil_net_ht: 500, bonus: 15 }],
      });
    expect(res.status).toBe(400);
  });

  test('rejects duplicate period', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1 })),
    }));
    const res = await request(adminApp)
      .post('/api/objectifs/paliers-primes')
      .send(VALID_PALIERS);
    expect(res.status).toBe(409);
  });

  test('chatteur cannot create', async () => {
    const res = await request(chatteurApp)
      .post('/api/objectifs/paliers-primes')
      .send(VALID_PALIERS);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/objectifs/paliers-primes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates paliers (admin)', async () => {
    db.prepare.mockReturnValue(mockStmt({
      run: jest.fn(() => ({ changes: 1 })),
    }));
    db.transaction.mockImplementation(fn => fn);

    const res = await request(adminApp)
      .put('/api/objectifs/paliers-primes')
      .send(VALID_PALIERS);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  test('rejects without paliers', async () => {
    const res = await request(adminApp)
      .put('/api/objectifs/paliers-primes')
      .send({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(400);
  });

  test('chatteur cannot update', async () => {
    const res = await request(chatteurApp)
      .put('/api/objectifs/paliers-primes')
      .send(VALID_PALIERS);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/objectifs/paliers-primes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft deletes paliers (admin)', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ changes: 3 })) }));
    const res = await request(adminApp)
      .delete('/api/objectifs/paliers-primes?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    // Verify it's a soft delete (UPDATE actif = 0)
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('actif = 0');
  });

  test('returns 400 without period params', async () => {
    const res = await request(adminApp).delete('/api/objectifs/paliers-primes');
    expect(res.status).toBe(400);
  });

  test('chatteur cannot delete', async () => {
    const res = await request(chatteurApp)
      .delete('/api/objectifs/paliers-primes?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(403);
  });
});
