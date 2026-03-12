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
jest.mock('bcryptjs', () => ({ compareSync: jest.fn(() => true), hashSync: jest.fn(() => 'h') }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const db = require('../../database');
const router = require('../../routes/chatteurs');
const adminApp = createApp('/api/chatteurs', router, 'admin');
const managerApp = createApp('/api/chatteurs', router, 'manager');
const chatteurApp = createApp('/api/chatteurs', router, 'chatteur');

const sample = { id: 1, prenom: 'Jean', email: 'j@t.com', iban: 'FR123', adresse: '1 rue', code_postal: '75001', ville: 'Paris', taux_commission: 0.15, taux_net_equipe: 0, taux_horaire: 0, user_id: 5, user_email: 'j@t.com', couleur: 1, role: 'chatteur', actif: 1, pays: 'France' };

describe('GET /api/chatteurs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns chatteurs for admin', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [sample]) }));
    const res = await request(adminApp).get('/api/chatteurs');
    expect(res.status).toBe(200);
    expect(res.body[0].iban).toBe('FR123');
  });

  test('strips sensitive fields for chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [sample]) }));
    const res = await request(chatteurApp).get('/api/chatteurs');
    expect(res.status).toBe(200);
    expect(res.body[0].iban).toBeUndefined();
    expect(res.body[0].taux_commission).toBeUndefined();
    expect(res.body[0].prenom).toBe('Jean');
  });
});

describe('GET /api/chatteurs/classement', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 without params', async () => {
    const res = await request(adminApp).get('/api/chatteurs/classement');
    expect(res.status).toBe(400);
  });

  test('returns classement with params', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []), get: jest.fn(() => ({ total: 5000 })) }));
    const res = await request(adminApp).get('/api/chatteurs/classement').query({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(res.body.prime_rates).toEqual([0.005, 0.0025, 0.0012]);
  });
});

describe('GET /api/chatteurs/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => sample) }));
    const res = await request(adminApp).get('/api/chatteurs/1');
    expect(res.status).toBe(200);
  });

  test('404 not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).get('/api/chatteurs/999');
    expect(res.status).toBe(404);
  });

  test('403 chatteur accessing other profile', async () => {
    const res = await request(chatteurApp).get('/api/chatteurs/1');
    expect(res.status).toBe(403);
  });

  test('chatteur can access own profile', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ ...sample, id: 20 })) }));
    const res = await request(chatteurApp).get('/api/chatteurs/20');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/chatteurs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 5 })) }));
    const res = await request(adminApp).post('/api/chatteurs').send({ prenom: 'Nouveau' });
    expect(res.status).toBe(201);
  });

  test('400 without prenom', async () => {
    const res = await request(adminApp).post('/api/chatteurs').send({ email: 'x@t.com' });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/chatteurs').send({ prenom: 'Test' });
    expect(res.status).toBe(403);
  });

  test('403 manager creating manager', async () => {
    const res = await request(managerApp).post('/api/chatteurs').send({ prenom: 'Mgr', role: 'manager' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/chatteurs/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates successfully', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/chatteurs/1').send({ prenom: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('404 not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/chatteurs/999').send({ prenom: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/chatteurs/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft deletes', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/chatteurs/1');
    expect(res.status).toBe(200);
  });

  test('403 manager self-delete', async () => {
    const res = await request(managerApp).delete('/api/chatteurs/10');
    expect(res.status).toBe(403);
  });

  test('403 manager delete another manager', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ role: 'manager' })) }));
    const res = await request(managerApp).delete('/api/chatteurs/5');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/chatteurs/:id/kpis', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns KPIs', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []), get: jest.fn(() => ({ total: 0, nb: 0, moyenne: 0 })) }));
    const res = await request(adminApp).get('/api/chatteurs/1/kpis').query({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ventes');
    expect(res.body).toHaveProperty('rang');
  });

  test('403 chatteur accessing other KPIs', async () => {
    const res = await request(chatteurApp).get('/api/chatteurs/1/kpis');
    expect(res.status).toBe(403);
  });
});
