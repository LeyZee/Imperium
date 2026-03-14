const { parsePagination, paginatedResponse } = require('../../utils/pagination');

describe('parsePagination', () => {
  test('defaults to page 1, limit 50', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  test('calculates offset correctly', () => {
    const result = parsePagination({ page: 3, limit: 20 });
    expect(result.offset).toBe(40);
  });

  test('caps limit at 200', () => {
    const result = parsePagination({ limit: 500 });
    expect(result.limit).toBe(200);
  });

  test('handles invalid values', () => {
    const result = parsePagination({ page: -1, limit: 'abc' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });
});

describe('paginatedResponse', () => {
  test('returns correct pagination metadata', () => {
    const result = paginatedResponse([1, 2, 3], 25, 1, 10);
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.total_pages).toBe(3);
    expect(result.pagination.has_next).toBe(true);
    expect(result.pagination.has_prev).toBe(false);
  });

  test('last page has no next', () => {
    const result = paginatedResponse([1], 15, 2, 10);
    expect(result.pagination.has_next).toBe(false);
    expect(result.pagination.has_prev).toBe(true);
  });
});
