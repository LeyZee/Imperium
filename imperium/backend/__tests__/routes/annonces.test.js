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
const router = require('../../routes/annonces');
const adminApp = createApp('/api/annonces', router, 'admin');
const chatteurApp = createApp('/api/annonces', router, 'chatteur');

describe('GET /api/annonces', () => {
  test('returns announcements', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, title: 'Test' }]) }));
    const res = await request(adminApp).get('/api/annonces');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/annonces', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) }));
    const res = await request(adminApp).post('/api/annonces').send({ title: 'New', content: 'Content here' });
    expect(res.status).toBe(201);
  });

  test('400 missing title/content', async () => {
    const res = await request(adminApp).post('/api/annonces').send({ title: 'Only title' });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/annonces').send({ title: 'X', content: 'Y' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/annonces/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1 })), run: jest.fn() }));
    const res = await request(adminApp).put('/api/annonces/1').send({ title: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/annonces/999').send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/annonces/:id', () => {
  test('soft deletes', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/annonces/1');
    expect(res.status).toBe(200);
  });
});
