/**
 * Pagination helper for SQLite queries.
 * @param {object} options
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=50] - Items per page (max 200)
 * @returns {{ limit: number, offset: number, page: number }}
 */
function parsePagination({ page = 1, limit = 50 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  return { page: p, limit: l, offset: (p - 1) * l };
}

/**
 * Wraps query results with pagination metadata.
 * @param {Array} data - Query results
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_prev: page > 1,
    }
  };
}

module.exports = { parsePagination, paginatedResponse };
