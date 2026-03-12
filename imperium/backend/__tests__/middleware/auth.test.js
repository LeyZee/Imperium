const jwt = require('jsonwebtoken');

// Must set JWT_SECRET before requiring auth middleware
process.env.JWT_SECRET = 'test-secret-for-auth-tests';

const { authMiddleware, adminOnly, signToken } = require('../../middleware/auth');
const ApiError = require('../../utils/ApiError');

function mockReq(overrides = {}) {
  return {
    cookies: {},
    headers: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('signToken', () => {
  test('creates a valid JWT', () => {
    const token = signToken({ id: 1, role: 'admin' });
    const decoded = jwt.verify(token, 'test-secret-for-auth-tests');
    expect(decoded.id).toBe(1);
    expect(decoded.role).toBe('admin');
  });

  test('token expires in 24h by default', () => {
    const token = signToken({ id: 1 });
    const decoded = jwt.verify(token, 'test-secret-for-auth-tests');
    // exp should be roughly 24h from now
    const diff = decoded.exp - decoded.iat;
    expect(diff).toBe(86400); // 24 * 60 * 60
  });
});

describe('authMiddleware', () => {
  test('passes with valid cookie token', () => {
    const token = signToken({ id: 1, role: 'admin' });
    const req = mockReq({ cookies: { token } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
  });

  test('passes with valid Authorization header', () => {
    const token = signToken({ id: 2, role: 'chatteur' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(2);
  });

  test('throws ApiError 401 when no token', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    expect(() => authMiddleware(req, res, next)).toThrow(ApiError);
    try {
      authMiddleware(req, res, next);
    } catch (err) {
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain('Token manquant');
    }
  });

  test('throws ApiError 401 for expired token', () => {
    const token = jwt.sign({ id: 1 }, 'test-secret-for-auth-tests', { expiresIn: '0s' });
    const req = mockReq({ cookies: { token } });
    const res = mockRes();
    const next = jest.fn();

    // Wait a tick for expiry
    expect(() => authMiddleware(req, res, next)).toThrow(ApiError);
  });

  test('throws ApiError 401 for invalid token', () => {
    const req = mockReq({ cookies: { token: 'invalid.token.here' } });
    const res = mockRes();
    const next = jest.fn();

    expect(() => authMiddleware(req, res, next)).toThrow(ApiError);
  });

  test('prefers cookie over Authorization header', () => {
    const cookieToken = signToken({ id: 1, role: 'admin' });
    const headerToken = signToken({ id: 2, role: 'chatteur' });
    const req = mockReq({
      cookies: { token: cookieToken },
      headers: { authorization: `Bearer ${headerToken}` },
    });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);
    expect(req.user.id).toBe(1); // cookie takes priority
  });
});

describe('adminOnly', () => {
  test('passes for admin role', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('throws ApiError 403 for non-admin', () => {
    const req = { user: { role: 'chatteur' } };
    const res = mockRes();
    const next = jest.fn();

    expect(() => adminOnly(req, res, next)).toThrow(ApiError);
    try {
      adminOnly(req, res, next);
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });
});
