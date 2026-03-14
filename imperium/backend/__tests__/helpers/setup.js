/**
 * Shared test helpers for route tests.
 * Provides app factory, mock DB, and role helpers.
 */
const express = require('express');

// Default mock user (admin)
const USERS = {
  admin: { id: 1, role: 'admin', email: 'admin@test.com', chatteur_id: null },
  manager: { id: 2, role: 'manager', email: 'manager@test.com', chatteur_id: 10 },
  chatteur: { id: 3, role: 'chatteur', email: 'chatteur@test.com', chatteur_id: 20 },
};

/**
 * Create an Express app with a route mounted, auth mocked, and error handler.
 * @param {string} path - Route path prefix (e.g. '/api/malus')
 * @param {object} router - Express router module
 * @param {string} role - Default role: 'admin', 'manager', or 'chatteur'
 */
function createApp(path, router, role = 'admin') {
  const app = express();
  app.use(express.json());

  // Inject req.user based on role (skips real auth middleware)
  app.use((req, res, next) => {
    // Allow per-request role override via header
    const overrideRole = req.headers['x-test-role'];
    req.user = USERS[overrideRole] || USERS[role];
    next();
  });

  app.use(path, router);

  // Error handler matching the real server's pattern
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  });

  return app;
}

/**
 * Create a chainable mock for db.prepare().
 * Usage in jest.mock:
 *   const db = require('../../database');
 *   db.prepare.mockReturnValue({ get: jest.fn().mockReturnValue(...) });
 */
function mockStmt(overrides = {}) {
  return {
    all: jest.fn().mockReturnValue([]),
    get: jest.fn().mockReturnValue(null),
    run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    ...overrides,
  };
}

module.exports = { createApp, mockStmt, USERS };
