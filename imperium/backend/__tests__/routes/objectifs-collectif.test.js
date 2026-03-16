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

const VALID_COLLECTIF = {
  montant_cible: 5000,
  periode_debut: '2026-03-01',
  periode_fin: '2026-03-15',
  description: 'Objectif mars',
  paliers: [
    { seuil_pct: 80, bonus_par_chatteur: 20, label: 'Bronze', emoji: 'B' },
    { seuil_pct: 100, bonus_par_chatteur: 40, label: 'Argent', emoji: 'A' },
    { seuil_pct: 120, bonus_par_chatteur: 75, label: 'Or', emoji: 'O' },
  ],
};

describe('GET /api/objectifs/collectif', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when no collectif exists', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp)
      .get('/api/objectifs/collectif?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('returns 400 without period params', async () => {
    const res = await request(adminApp).get('/api/objectifs/collectif');
    expect(res.status).toBe(400);
  });

  test('returns collectif with paliers and progress', async () => {
    const mockObj = { id: 1, montant_cible: 5000, periode_debut: '2026-03-01', periode_fin: '2026-03-15', description: 'Test', actif: 1 };
    const mockPaliers = [
      { id: 1, seuil_pct: 80, bonus_par_chatteur: 20, label: 'Bronze', emoji: 'B' },
      { id: 2, seuil_pct: 100, bonus_par_chatteur: 40, label: 'Argent', emoji: 'A' },
    ];
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => mockObj) }))   // objectifs_collectifs query
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => mockPaliers) })) // paliers query
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ total: 4200 })) })); // SUM(net_ht_eur)

    const res = await request(adminApp)
      .get('/api/objectifs/collectif?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body.montant_cible).toBe(5000);
    expect(res.body.paliers).toHaveLength(2);
    expect(res.body.actual_net_ht).toBe(4200);
    expect(res.body.progress_pct).toBe(84);
    // Bronze (80%) should be reached, Argent (100%) not
    expect(res.body.palier_atteint.label).toBe('Bronze');
  });

  test('chatteurs can read the collectif', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(chatteurApp)
      .get('/api/objectifs/collectif?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/objectifs/collectif', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates collectif with paliers (admin)', async () => {
    // First call: check existing (returns null), then insert calls
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => null),
      run: jest.fn(() => ({ lastInsertRowid: 1 })),
    }));
    db.transaction.mockImplementation(fn => fn);

    const res = await request(adminApp)
      .post('/api/objectifs/collectif')
      .send(VALID_COLLECTIF);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('rejects without paliers', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/collectif')
      .send({ montant_cible: 5000, periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(400);
  });

  test('rejects negative montant_cible', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/collectif')
      .send({ ...VALID_COLLECTIF, montant_cible: -100 });
    expect(res.status).toBe(400);
  });

  test('rejects palier with missing label', async () => {
    const res = await request(adminApp)
      .post('/api/objectifs/collectif')
      .send({
        ...VALID_COLLECTIF,
        paliers: [{ seuil_pct: 80, bonus_par_chatteur: 20 }],
      });
    expect(res.status).toBe(400);
  });

  test('rejects duplicate period', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1 })), // existing found
    }));
    const res = await request(adminApp)
      .post('/api/objectifs/collectif')
      .send(VALID_COLLECTIF);
    expect(res.status).toBe(409);
  });

  test('chatteur cannot create', async () => {
    const res = await request(chatteurApp)
      .post('/api/objectifs/collectif')
      .send(VALID_COLLECTIF);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/objectifs/collectif/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates collectif (admin)', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1 })),
      run: jest.fn(() => ({ changes: 1 })),
    }));
    db.transaction.mockImplementation(fn => fn);

    const res = await request(adminApp)
      .put('/api/objectifs/collectif/1')
      .send({ montant_cible: 6000 });
    expect(res.status).toBe(200);
  });

  test('returns 404 for non-existent', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp)
      .put('/api/objectifs/collectif/999')
      .send({ montant_cible: 6000 });
    expect(res.status).toBe(404);
  });

  test('chatteur cannot update', async () => {
    const res = await request(chatteurApp)
      .put('/api/objectifs/collectif/1')
      .send({ montant_cible: 6000 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/objectifs/collectif/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft deletes collectif (admin)', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ changes: 1 })) }));
    const res = await request(adminApp).delete('/api/objectifs/collectif/1');
    expect(res.status).toBe(200);
    // Verify it's a soft delete (UPDATE actif = 0, not a real DELETE)
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('actif = 0');
  });

  test('chatteur cannot delete', async () => {
    const res = await request(chatteurApp).delete('/api/objectifs/collectif/1');
    expect(res.status).toBe(403);
  });
});
