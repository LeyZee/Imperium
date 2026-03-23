const asyncHandler = require('../../utils/asyncHandler');

describe('asyncHandler', () => {
  const mockReq = {};
  const mockRes = {};

  test('calls next with error on sync throw', () => {
    const next = jest.fn();
    const handler = asyncHandler(() => { throw new Error('sync error'); });
    handler(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('calls next with error on async rejection', async () => {
    const next = jest.fn();
    const handler = asyncHandler(async () => { throw new Error('async error'); });
    handler(mockReq, mockRes, next);
    await new Promise(r => setTimeout(r, 10));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('does not call next on success', () => {
    const next = jest.fn();
    const handler = asyncHandler((req, res) => { /* success */ });
    handler(mockReq, mockRes, next);
    expect(next).not.toHaveBeenCalled();
  });
});
