/**
 * Tests for backend/routes/auth.js
 */
const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })) })),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  signToken: jest.fn().mockReturnValue('mock-token'),
}));
jest.mock('bcryptjs', () => ({
  compareSync: jest.fn((pwd) => pwd === 'correct-password'),
  hashSync: jest.fn(() => 'hashed-password'),
}));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const db = require('../../database');
const bcrypt = require('bcryptjs');
const authRouter = require('../../routes/auth');

const adminApp = createApp('/api/auth', authRouter, 'admin');
const chatteurApp = createApp('/api/auth', authRouter, 'chatteur');

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 when email missing', async () => {
    const res = await request(adminApp).post('/api/auth/login').send({ password: 'abc' });
    expect(res.status).toBe(400);
  });

  test('400 when password missing', async () => {
    const res = await request(adminApp).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  test('401 when email not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).post('/api/auth/login').send({ email: 'x@test.com', password: 'abc' });
    expect(res.status).toBe(401);
  });

  test('401 when password wrong', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, email: 'a@t.com', password_hash: 'h', role: 'admin' })) }));
    bcrypt.compareSync.mockReturnValueOnce(false);
    const res = await request(adminApp).post('/api/auth/login').send({ email: 'a@t.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('200 on success with cookie', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, email: 'a@t.com', password_hash: 'h', role: 'admin', prenom: 'A' })) }));
    bcrypt.compareSync.mockReturnValueOnce(true);
    const res = await request(adminApp).post('/api/auth/login').send({ email: 'a@t.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  test('returns success message', async () => {
    const res = await request(adminApp).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/déconnexion/i);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns current user', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, role: 'admin', email: 'a@t.com' })) }));
    const res = await request(adminApp).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@t.com');
  });

  test('404 if user not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).get('/api/auth/me');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 as admin', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 10 })) }));
    const res = await request(adminApp).post('/api/auth/register').send({ email: 'new@test.com', password: 'Abcdef1!' });
    expect(res.status).toBe(201);
  });

  test('403 for non-admin', async () => {
    const res = await request(chatteurApp).post('/api/auth/register').send({ email: 'x@t.com', password: 'Abcdef1!' });
    expect(res.status).toBe(403);
  });

  test('400 when email missing', async () => {
    const res = await request(adminApp).post('/api/auth/register').send({ password: 'Abcdef1!' });
    expect(res.status).toBe(400);
  });

  test('409 for duplicate email', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 99 })) }));
    const res = await request(adminApp).post('/api/auth/register').send({ email: 'dup@t.com', password: 'Abcdef1!' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/auth/password', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 on success', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, password_hash: 'h' })), run: jest.fn() }));
    bcrypt.compareSync.mockReturnValueOnce(true);
    const res = await request(adminApp).put('/api/auth/password').send({ current_password: 'correct-password', new_password: 'NewPass1!' });
    expect(res.status).toBe(200);
  });

  test('401 for wrong current password', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 1, password_hash: 'h' })) }));
    bcrypt.compareSync.mockReturnValueOnce(false);
    const res = await request(adminApp).put('/api/auth/password').send({ current_password: 'wrong', new_password: 'NewPass1!' });
    expect(res.status).toBe(401);
  });

  test('400 when fields missing', async () => {
    const res = await request(adminApp).put('/api/auth/password').send({ current_password: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/auth/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates email', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, email: 'old@t.com', password_hash: 'h', role: 'admin' })
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ id: 1, email: 'new@t.com', role: 'admin' });
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));
    const res = await request(adminApp).put('/api/auth/profile').send({ email: 'new@t.com' });
    expect(res.status).toBe(200);
  });

  test('409 for email conflict', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, email: 'old@t.com', password_hash: 'h', role: 'admin' })
      .mockReturnValueOnce({ id: 99 });
    db.prepare.mockReturnValue(mockStmt({ get: getMock }));
    const res = await request(adminApp).put('/api/auth/profile').send({ email: 'taken@t.com' });
    expect(res.status).toBe(409);
  });

  test('404 if user not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/auth/profile').send({ prenom: 'X' });
    expect(res.status).toBe(404);
  });
});
