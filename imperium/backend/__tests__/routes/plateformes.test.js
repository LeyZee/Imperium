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

const db = require('../../database');
const router = require('../../routes/plateformes');
const adminApp = createApp('/api/plateformes', router, 'admin');
const chatteurApp = createApp('/api/plateformes', router, 'chatteur');

describe('GET /api/plateformes', () => {
  test('returns platforms', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, nom: 'OnlyFans' }]) }));
    const res = await request(adminApp).get('/api/plateformes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/plateformes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns platform', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, nom: 'OF' })) }));
    const res = await request(adminApp).get('/api/plateformes/1');
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).get('/api/plateformes/999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/plateformes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 3 })) }));
    const res = await request(adminApp).post('/api/plateformes').send({ nom: 'NewPF' });
    expect(res.status).toBe(201);
  });

  test('400 missing nom', async () => {
    const res = await request(adminApp).post('/api/plateformes').send({});
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/plateformes').send({ nom: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/plateformes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates platform', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/plateformes/1').send({ nom: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/plateformes/999').send({ nom: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/plateformes/:id', () => {
  test('soft deletes', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/plateformes/1');
    expect(res.status).toBe(200);
  });
});
