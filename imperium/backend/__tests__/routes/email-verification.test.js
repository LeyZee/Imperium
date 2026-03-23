/**
 * Tests for email verification flow (auth.js change-email/verify-email routes)
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

const chatteurApp = createApp('/api/auth', authRouter, 'chatteur');
const adminApp = createApp('/api/auth', authRouter, 'admin');

// SQLite datetime() returns without 'Z' — route appends 'Z' for parsing
const futureExpiry = '2099-01-01 00:00:00';
const pastExpiry = '2020-01-01 00:00:00';

describe('POST /api/auth/change-email', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 sends verification email', async () => {
    // change-email calls: get conflict user, get conflict chatteur, run invalidate, run insert, get chatteur prenom
    const getMock = jest.fn()
      .mockReturnValueOnce(null)   // no user conflict
      .mockReturnValueOnce(null)   // no chatteur conflict
      .mockReturnValueOnce({ prenom: 'TEST' }); // chatteur prenom
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn(() => ({ changes: 1 })) }));
    const res = await request(chatteurApp).post('/api/auth/change-email').send({ new_email: 'new@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/vérification/i);
    expect(sendEmail).toHaveBeenCalledWith('new@example.com', expect.any(String), expect.any(String));
  });

  test('400 without new_email', async () => {
    const res = await request(chatteurApp).post('/api/auth/change-email').send({});
    expect(res.status).toBe(400);
  });

  test('400 for invalid email format', async () => {
    const res = await request(chatteurApp).post('/api/auth/change-email').send({ new_email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('409 when email already taken', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 99 })),  // user conflict found
    }));
    const res = await request(chatteurApp).post('/api/auth/change-email').send({ new_email: 'taken@example.com' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/auth/verify-email/:token', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns success for valid token', async () => {
    // verify-email calls: get JOIN row, get conflict check, run update users, run update chatteurs, run mark used
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, user_id: 3, new_email: 'new@t.com', current_email: 'old@t.com', expires_at: futureExpiry, used_at: null })
      .mockReturnValueOnce(null);  // no conflict
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));

    const res = await request(chatteurApp).get('/api/auth/verify-email/abc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.new_email).toBe('new@t.com');
  });

  test('returns invalid for unknown token', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(chatteurApp).get('/api/auth/verify-email/bad-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('invalid');
  });

  test('returns used for consumed token', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, user_id: 3, new_email: 'new@t.com', expires_at: futureExpiry, used_at: '2026-01-01' })),
    }));
    const res = await request(chatteurApp).get('/api/auth/verify-email/abc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('used');
  });

  test('returns expired for old token', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, user_id: 3, new_email: 'new@t.com', expires_at: pastExpiry, used_at: null })),
    }));
    const res = await request(chatteurApp).get('/api/auth/verify-email/abc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('expired');
  });

  test('returns conflict if email taken at verification time', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, user_id: 3, new_email: 'new@t.com', current_email: 'old@t.com', expires_at: futureExpiry, used_at: null })
      .mockReturnValueOnce({ id: 99 });  // email now taken
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));

    const res = await request(chatteurApp).get('/api/auth/verify-email/abc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('conflict');
  });
});

describe('PUT /api/auth/profile — email change guard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('chatteur blocked from direct email change', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 3, email: 'old@t.com', password_hash: 'h', role: 'chatteur' })),
    }));
    const res = await request(chatteurApp).put('/api/auth/profile').send({ email: 'new@t.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/changement d'email/i);
  });

  test('admin can change email directly', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, email: 'old@admin.com', password_hash: 'h', role: 'admin' })
      .mockReturnValueOnce(null)  // no conflict
      .mockReturnValueOnce({ id: 1, email: 'new@admin.com', role: 'admin' });
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));
    const res = await request(adminApp).put('/api/auth/profile').send({ email: 'new@admin.com' });
    expect(res.status).toBe(200);
  });
});
