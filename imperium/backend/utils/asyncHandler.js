/**
 * Wraps route handlers to catch sync/async errors and pass them to Express error handler.
 * Handles both Promise rejections and synchronous exceptions (e.g., from node-sqlite3-wasm).
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

module.exports = asyncHandler;
