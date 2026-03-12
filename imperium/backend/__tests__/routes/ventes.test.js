const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1 })) })),
}));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => { if (req.user.role !== 'admin') { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
  adminOrManager: (req, res, next) => { if (!['admin','manager'].includes(req.user.role)) { const e = new Error('Accès refusé'); e.statusCode = 403; throw e; } next(); },
}));
jest.mock('../../services/paie-calculator', () => ({ recalculatePaies: jest.fn() }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/pagination', () => ({
  parsePagination: jest.fn().mockReturnValue({ page: 1, limit: 50, offset: 0 }),
  paginatedResponse: jest.fn((data, total, page, limit) => ({ data, total, page, limit })),
}));
jest.mock('../../utils/csvExport', () => ({ sendCSV: jest.fn((res) => res.json({ csv: true })) }));

const db = require('../../database');
const { recalculatePaies } = require('../../services/paie-calculator');
const router = require('../../routes/ventes');
const adminApp = createApp('/api/ventes', router, 'admin');
const chatteurApp = createApp('/api/ventes', router, 'chatteur');

describe('GET /api/ventes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns sales', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, montant_brut: 100 }]) }));
    const res = await request(adminApp).get('/api/ventes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/ventes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    // modele-plateforme check + insert
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ '1': 1 })) })) // link exists
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) }));
    const res = await request(adminApp).post('/api/ventes').send({
      chatteur_id: 1, modele_id: 1, plateforme_id: 1, montant_brut: 100,
      periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(201);
    expect(recalculatePaies).toHaveBeenCalled();
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/ventes').send({ chatteur_id: 1 });
    expect(res.status).toBe(400);
  });

  test('400 invalid montant', async () => {
    const res = await request(adminApp).post('/api/ventes').send({
      chatteur_id: 1, plateforme_id: 1, montant_brut: -10,
      periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(400);
  });

  test('400 invalid modele-plateforme', async () => {
    db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn(() => null) })) // link not found
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ pseudo: 'M1' })) }))
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ nom: 'OF' })) }));
    const res = await request(adminApp).post('/api/ventes').send({
      chatteur_id: 1, modele_id: 1, plateforme_id: 99, montant_brut: 100,
      periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur', async () => {
    const res = await request(chatteurApp).post('/api/ventes').send({
      chatteur_id: 1, plateforme_id: 1, montant_brut: 100,
      periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/ventes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates sale', async () => {
    const current = { id: 1, modele_id: 1, plateforme_id: 1, periode_debut: '2026-03-01', periode_fin: '2026-03-15' };
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => current),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/ventes/1').send({ montant_brut: 200 });
    expect(res.status).toBe(200);
  });

  test('404', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/ventes/999').send({ montant_brut: 200 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/ventes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes and recalculates', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).delete('/api/ventes/1');
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalled();
  });
});

describe('GET /api/ventes/export-csv', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/ventes/export-csv');
    expect(res.status).toBe(400);
  });
});
