const ApiError = require('../../utils/ApiError');

describe('ApiError', () => {
  test('creates error with statusCode and message', () => {
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('ApiError');
    expect(err.details).toBeNull();
  });

  test('creates error with details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new ApiError(400, 'Validation failed', details);
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(details);
  });

  test('has stack trace', () => {
    const err = new ApiError(500, 'Server error');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ApiError');
  });

  test('works with common HTTP status codes', () => {
    expect(new ApiError(400, 'Bad Request').statusCode).toBe(400);
    expect(new ApiError(401, 'Unauthorized').statusCode).toBe(401);
    expect(new ApiError(403, 'Forbidden').statusCode).toBe(403);
    expect(new ApiError(409, 'Conflict').statusCode).toBe(409);
    expect(new ApiError(500, 'Internal').statusCode).toBe(500);
  });
});
