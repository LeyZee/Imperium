/**
 * Tests for invitation flow (auth.js invite/setup-password routes)
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
  compareSync: jest.fn(() => false),
  hashSync: jest.fn(() => 'hashed-password'),
}));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  buildInvitationEmail: jest.fn().mockReturnValue('<html>invitation</html>'),
  buildEmailVerificationEmail: jest.fn().mockReturnValue('<html>verify</html>'),
}));

const db = require('../../database');
const { sendEmail } = require('../../utils/email');
const authRouter = require('../../routes/auth');

const adminApp = createApp('/api/auth', authRouter, 'admin');
const chatteurApp = createApp('/api/auth', authRouter, 'chatteur');

// SQLite datetime() returns without 'Z' — route appends 'Z' for parsing
const futureExpiry = '2099-01-01 00:00:00';
const pastExpiry = '2020-01-01 00:00:00';

describe('POST /api/auth/invite', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 sends invitation', async () => {
    // invite route calls: get user, get chatteur, run invalidate, run insert
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 5, email: 'test@t.com', password_hash: '!PENDING_INVITATION!' }) // user
      .mockReturnValueOnce({ prenom: 'TEST' }); // chatteur
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn(() => ({ changes: 1 })) }));
    const res = await request(adminApp).post('/api/auth/invite').send({ user_id: 5 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/invitation/i);
    expect(sendEmail).toHaveBeenCalled();
  });

  test('400 without user_id', async () => {
    const res = await request(adminApp).post('/api/auth/invite').send({});
    expect(res.status).toBe(400);
  });

  test('404 user not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).post('/api/auth/invite').send({ user_id: 999 });
    expect(res.status).toBe(404);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).post('/api/auth/invite').send({ user_id: 5 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/setup-password/:token', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns valid for good token', async () => {
    // Single JOIN query returns full row
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({
        id: 1, user_id: 5, token: 'abc',
        expires_at: futureExpiry,
        used_at: null,
        email: 'test@t.com', prenom: 'TEST',
      })),
    }));
    const res = await request(adminApp).get('/api/auth/setup-password/abc');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.email).toBe('test@t.com');
    expect(res.body.prenom).toBe('TEST');
  });

  test('returns invalid for unknown token', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).get('/api/auth/setup-password/bad-token');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toBe('invalid');
  });

  test('returns used for consumed token', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({
        id: 1, user_id: 5, token: 'abc',
        expires_at: futureExpiry,
        used_at: '2026-01-01',
        email: 'test@t.com', prenom: 'TEST',
      })),
    }));
    const res = await request(adminApp).get('/api/auth/setup-password/abc');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toBe('used');
  });

  test('returns expired for old token', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({
        id: 1, user_id: 5, token: 'abc',
        expires_at: pastExpiry,
        used_at: null,
        email: 'test@t.com', prenom: 'TEST',
      })),
    }));
    const res = await request(adminApp).get('/api/auth/setup-password/abc');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toBe('expired');
  });
});

describe('POST /api/auth/setup-password/:token', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 sets password and auto-login', async () => {
    // POST setup-password does: get token row (JOIN), run update password, run mark used
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({
        id: 1, user_id: 5, token: 'abc',
        expires_at: futureExpiry,
        used_at: null,
        email: 'test@t.com', user_role: 'chatteur', chatteur_id: 20, prenom: 'TEST',
      })),
      run: jest.fn(),
    }));

    const res = await request(adminApp).post('/api/auth/setup-password/abc').send({ password: 'MyPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@t.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('400 without password', async () => {
    const res = await request(adminApp).post('/api/auth/setup-password/abc').send({});
    expect(res.status).toBe(400);
  });

  test('400 for used token', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({
        id: 1, user_id: 5, token: 'abc',
        expires_at: futureExpiry,
        used_at: '2026-01-01',
        email: 'test@t.com', user_role: 'chatteur',
      })),
    }));
    const res = await request(adminApp).post('/api/auth/setup-password/abc').send({ password: 'MyPass1!' });
    expect(res.status).toBe(400);
  });
});
