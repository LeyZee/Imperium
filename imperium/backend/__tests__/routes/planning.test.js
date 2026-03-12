const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1 })) })),
  transaction: jest.fn(fn => fn),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
}));
jest.mock('../../utils/constants', () => ({
  TIMEZONES: ['Europe/Paris', 'Africa/Porto-Novo', 'Indian/Antananarivo'],
  CRENEAUX: {
    1: { label: '08h-14h', start: '08:00', end: '14:00' },
    2: { label: '14h-20h', start: '14:00', end: '20:00' },
    3: { label: '20h-02h', start: '20:00', end: '02:00' },
    4: { label: '02h-08h', start: '02:00', end: '08:00' },
  },
}));
jest.mock('../../utils/csvExport', () => ({ sendCSV: jest.fn((res) => res.json({ csv: true })) }));

const db = require('../../database');
const router = require('../../routes/planning');
const adminApp = createApp('/api/shifts', router, 'admin');
const chatteurApp = createApp('/api/shifts', router, 'chatteur');

describe('GET /api/shifts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns shifts', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, creneau: 1, date: '2026-03-12' }]) }));
    const res = await request(adminApp).get('/api/shifts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/shifts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => null), // no conflict
      run: jest.fn(() => ({ lastInsertRowid: 5 })),
    }));
    const res = await request(adminApp).post('/api/shifts').send({
      chatteur_id: 1, date: '2026-03-12', creneau: 1, modele_id: 1, plateforme_id: 1,
    });
    expect(res.status).toBe(201);
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/shifts').send({ chatteur_id: 1 });
    expect(res.status).toBe(400);
  });

  test('400 invalid creneau', async () => {
    const res = await request(adminApp).post('/api/shifts').send({
      chatteur_id: 1, date: '2026-03-12', creneau: 5,
    });
    expect(res.status).toBe(400);
  });

  test('409 conflict', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => ({ id: 99 })) }));
    const res = await request(adminApp).post('/api/shifts').send({
      chatteur_id: 1, modele_id: 1, plateforme_id: 1, date: '2026-03-12', creneau: 1,
    });
    expect(res.status).toBe(409);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/shifts').send({
      chatteur_id: 1, date: '2026-03-12', creneau: 1,
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/shifts/:id', () => {
  test('deletes shift', async () => {
    db.prepare.mockReturnValue(mockStmt({ run: jest.fn() }));
    const res = await request(adminApp).delete('/api/shifts/1');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/shifts/bulk', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 bulk create', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null), run: jest.fn() }));
    // transaction mock returns the function itself
    db.transaction.mockImplementation(fn => fn);
    const res = await request(adminApp).post('/api/shifts/bulk').send({
      chatteur_id: 1, dates: ['2026-03-12'], creneaux: [1, 2],
    });
    expect(res.status).toBe(201);
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/shifts/bulk').send({ chatteur_id: 1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/shifts/conflits', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/shifts/conflits');
    expect(res.status).toBe(400);
  });

  test('returns conflicts data', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/shifts/conflits').query({ date_debut: '2026-03-10', date_fin: '2026-03-16' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('doublons');
    expect(res.body).toHaveProperty('non_couverts');
  });
});

describe('GET /api/shifts/template', () => {
  test('returns templates', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/shifts/template');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/shifts/template/save', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing date', async () => {
    const res = await request(adminApp).post('/api/shifts/template/save').send({});
    expect(res.status).toBe(400);
  });

  test('saves template', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []), run: jest.fn() }));
    db.transaction.mockImplementation(fn => fn);
    const res = await request(adminApp).post('/api/shifts/template/save').send({ date: '2026-03-12' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/shifts/en-ligne', () => {
  test('returns online info', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(adminApp).get('/api/shifts/en-ligne');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('en_ligne');
    expect(res.body).toHaveProperty('creneau_actuel');
  });
});

describe('GET /api/shifts/export-csv', () => {
  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/shifts/export-csv');
    expect(res.status).toBe(400);
  });
});
