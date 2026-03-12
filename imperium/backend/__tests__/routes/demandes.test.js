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
jest.mock('../../utils/notifier', () => ({ notifyChatteur: jest.fn(), notifyAdminsAndManagers: jest.fn() }));

const db = require('../../database');
const router = require('../../routes/demandes');
const adminApp = createApp('/api/demandes', router, 'admin');
const chatteurApp = createApp('/api/demandes', router, 'chatteur');

describe('GET /api/demandes', () => {
  test('returns demandes', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/demandes');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/demandes/pending', () => {
  test('returns pending for admin', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/demandes/pending');
    expect(res.status).toBe(200);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).get('/api/demandes/pending');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/demandes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 as chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({
      run: jest.fn(() => ({ lastInsertRowid: 5 })),
      get: jest.fn(() => ({ prenom: 'Jean' })),
    }));
    const res = await request(chatteurApp).post('/api/demandes').send({
      type: 'conge', date_debut: '2026-03-20', date_fin: '2026-03-25',
    });
    expect(res.status).toBe(201);
  });

  test('400 missing fields', async () => {
    const res = await request(chatteurApp).post('/api/demandes').send({ type: 'conge' });
    expect(res.status).toBe(400);
  });

  test('400 invalid type', async () => {
    const res = await request(chatteurApp).post('/api/demandes').send({
      type: 'invalid', date_debut: '2026-03-20', date_fin: '2026-03-25',
    });
    expect(res.status).toBe(400);
  });

  test('400 echange without echange_avec_id', async () => {
    const res = await request(chatteurApp).post('/api/demandes').send({
      type: 'echange', date_debut: '2026-03-20', date_fin: '2026-03-25',
    });
    expect(res.status).toBe(400);
  });

  test('403 admin (no chatteur_id)', async () => {
    const res = await request(adminApp).post('/api/demandes').send({
      type: 'conge', date_debut: '2026-03-20', date_fin: '2026-03-25',
    });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/demandes/:id/review', () => {
  beforeEach(() => jest.clearAllMocks());

  test('approves demande', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, statut: 'en_attente', chatteur_id: 20, type: 'conge' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/demandes/1/review').send({ statut: 'approuve' });
    expect(res.status).toBe(200);
  });

  test('400 invalid statut', async () => {
    const res = await request(adminApp).put('/api/demandes/1/review').send({ statut: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('404 not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/demandes/999/review').send({ statut: 'approuve' });
    expect(res.status).toBe(404);
  });

  test('400 already reviewed', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, statut: 'approuve' })),
    }));
    const res = await request(adminApp).put('/api/demandes/1/review').send({ statut: 'refuse' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/demandes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('admin can delete', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, statut: 'en_attente', chatteur_id: 20 })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).delete('/api/demandes/1');
    expect(res.status).toBe(200);
  });

  test('404 not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).delete('/api/demandes/999');
    expect(res.status).toBe(404);
  });

  test('chatteur cannot delete others demande', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, statut: 'en_attente', chatteur_id: 99 })),
    }));
    const res = await request(chatteurApp).delete('/api/demandes/1');
    expect(res.status).toBe(403);
  });

  test('chatteur cannot delete non-pending', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, statut: 'approuve', chatteur_id: 20 })),
    }));
    const res = await request(chatteurApp).delete('/api/demandes/1');
    expect(res.status).toBe(400);
  });
});
