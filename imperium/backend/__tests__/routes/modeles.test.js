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
const router = require('../../routes/modeles');
const adminApp = createApp('/api/modeles', router, 'admin');
const chatteurApp = createApp('/api/modeles', router, 'chatteur');

describe('GET /api/modeles', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns models with platforms', async () => {
    const models = [{ id: 1, pseudo: 'Model1', actif: 1 }];
    const links = [{ modele_id: 1, id: 10, nom: 'OnlyFans' }];
    db.prepare
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => models) }))
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => links) }));
    const res = await request(adminApp).get('/api/modeles');
    expect(res.status).toBe(200);
    expect(res.body[0].plateformes).toEqual([{ id: 10, nom: 'OnlyFans' }]);
  });
});

describe('GET /api/modeles/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns model', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, pseudo: 'M1' })) }));
    const res = await request(adminApp).get('/api/modeles/1');
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).get('/api/modeles/999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/modeles', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) }));
    const res = await request(adminApp).post('/api/modeles').send({ pseudo: 'New' });
    expect(res.status).toBe(201);
    expect(res.body.pseudo).toBe('New');
  });

  test('400 missing pseudo', async () => {
    const res = await request(adminApp).post('/api/modeles').send({});
    expect(res.status).toBe(400);
  });

  test('400 invalid part_percent', async () => {
    const res = await request(adminApp).post('/api/modeles').send({ pseudo: 'X', part_percent: 0.10 });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/modeles').send({ pseudo: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/modeles/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates model', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/modeles/1').send({ pseudo: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/modeles/999').send({ pseudo: 'X' });
    expect(res.status).toBe(404);
  });

  test('400 invalid part_percent', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })) }));
    const res = await request(adminApp).put('/api/modeles/1').send({ part_percent: 0.60 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/modeles/:id', () => {
  test('soft deletes', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/modeles/1');
    expect(res.status).toBe(200);
  });
});

describe('Model-Platform associations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /:id/plateformes returns list', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, nom: 'OF' }]) }));
    const res = await request(adminApp).get('/api/modeles/1/plateformes');
    expect(res.status).toBe(200);
  });

  test('POST /:id/plateformes creates association', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).post('/api/modeles/1/plateformes').send({ plateforme_id: 2 });
    expect(res.status).toBe(201);
  });

  test('POST /:id/plateformes 400 without plateforme_id', async () => {
    const res = await request(adminApp).post('/api/modeles/1/plateformes').send({});
    expect(res.status).toBe(400);
  });

  test('DELETE /:id/plateformes/:pid removes association', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/modeles/1/plateformes/2');
    expect(res.status).toBe(200);
  });
});
