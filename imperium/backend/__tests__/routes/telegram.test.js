const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1, changes: 0 })) })),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
}));
jest.mock('../../services/paie-calculator', () => ({ recalculatePaies: jest.fn() }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../services/telegram-poller', () => ({
  getStatus: jest.fn(() => ({
    running: false,
    botUsername: null,
    startedAt: null,
    uptime: 0,
    messagesProcessed: 0,
    lastMessageAt: null,
    lastError: null,
    errorsCount: 0,
    currentOffset: 0,
    hasBotToken: true,
  })),
  start: jest.fn(),
  stop: jest.fn(),
}));
jest.mock('../../services/telegram-parser', () => ({
  processMessage: jest.fn(),
  GROUP_PLATFORM: { '-1003327391292': 2 },
}));

const db = require('../../database');
const telegramPoller = require('../../services/telegram-poller');
const { recalculatePaies } = require('../../services/paie-calculator');
const { logActivity } = require('../../utils/activityLogger');
const router = require('../../routes/telegram');
const adminApp = createApp('/api/telegram', router, 'admin');
const chatteurApp = createApp('/api/telegram', router, 'chatteur');

describe('GET /api/telegram/status', () => {
  beforeEach(() => jest.clearAllMocks());

  test('admin gets status with recent imports', async () => {
    telegramPoller.getStatus.mockReturnValue({
      running: true, botUsername: 'testbot', hasBotToken: true,
      startedAt: new Date().toISOString(), uptime: 3600,
      messagesProcessed: 10, lastMessageAt: null, lastError: null, errorsCount: 0, currentOffset: 50,
    });
    db.prepare
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => [{ id: 1, montant_brut: 100, chatteur_prenom: 'AXEL' }]) })) // recent imports
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ count: 5 })) })); // today count
    const res = await request(adminApp).get('/api/telegram/status');
    expect(res.status).toBe(200);
    expect(res.body.running).toBe(true);
    expect(res.body.botUsername).toBe('testbot');
    expect(res.body.recentImports).toBeDefined();
    expect(res.body.todayImports).toBe(5);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).get('/api/telegram/status');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/telegram/start', () => {
  beforeEach(() => jest.clearAllMocks());

  test('starts bot when stopped', async () => {
    telegramPoller.getStatus.mockReturnValue({ running: false, hasBotToken: true });
    telegramPoller.start.mockResolvedValue();
    // After start, getStatus returns running state
    telegramPoller.getStatus
      .mockReturnValueOnce({ running: false, hasBotToken: true })
      .mockReturnValueOnce({ running: true, hasBotToken: true });
    const res = await request(adminApp).post('/api/telegram/start');
    expect(res.status).toBe(200);
    expect(telegramPoller.start).toHaveBeenCalled();
  });

  test('409 if already running', async () => {
    telegramPoller.getStatus.mockReturnValue({ running: true, hasBotToken: true });
    const res = await request(adminApp).post('/api/telegram/start');
    expect(res.status).toBe(409);
  });

  test('400 if no bot token', async () => {
    telegramPoller.getStatus.mockReturnValue({ running: false, hasBotToken: false });
    const res = await request(adminApp).post('/api/telegram/start');
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/telegram/start');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/telegram/stop', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stops bot when running', async () => {
    telegramPoller.getStatus.mockReturnValue({ running: true, hasBotToken: true });
    const res = await request(adminApp).post('/api/telegram/stop');
    expect(res.status).toBe(200);
    expect(telegramPoller.stop).toHaveBeenCalled();
  });

  test('409 if already stopped', async () => {
    telegramPoller.getStatus.mockReturnValue({ running: false, hasBotToken: true });
    const res = await request(adminApp).post('/api/telegram/stop');
    expect(res.status).toBe(409);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/telegram/stop');
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/telegram/imports', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes all telegram imports and recalculates paies', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => [
        { periode_debut: '2026-03-01', periode_fin: '2026-03-15' },
      ])})) // affected periods
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ changes: 5 })) })); // delete
    const res = await request(adminApp).delete('/api/telegram/imports');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'delete_all_telegram_imports', 'vente', null, '5 imports supprimés');
  });

  test('handles zero imports gracefully', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => []) }))
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ changes: 0 })) }));
    const res = await request(adminApp).delete('/api/telegram/imports');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(recalculatePaies).not.toHaveBeenCalled();
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).delete('/api/telegram/imports');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/telegram/report (webhook)', () => {
  beforeEach(() => jest.clearAllMocks());

  // These tests need TELEGRAM_SECRET to be set, which it isn't in test env
  // The telegramAuth middleware will throw 503 if TELEGRAM_SECRET is empty
  test('503 when TELEGRAM_SECRET not configured', async () => {
    const res = await request(adminApp).post('/api/telegram/report').send({
      group_id: '-1003327391292',
      sender_name: 'Test',
      message: 'Montant brut: 100€',
    });
    // Should get 503 because TELEGRAM_SECRET is empty in test env
    expect(res.status).toBe(503);
  });
});

describe('GET /api/telegram/report', () => {
  beforeEach(() => jest.clearAllMocks());

  test('admin gets imported ventes list', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, montant_brut: 100, chatteur: 'AXEL', plateforme: 'Reveal' }]) }));
    const res = await request(adminApp).get('/api/telegram/report');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).get('/api/telegram/report');
    expect(res.status).toBe(403);
  });
});
