const request = require('supertest');
const { createApp, mockStmt } = require('../helpers/setup');

jest.mock('../../database', () => ({
  prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn(() => ({ lastInsertRowid: 1 })) })),
  transaction: jest.fn((fn) => fn),
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
jest.mock('../../utils/notifier', () => ({ notifyChatteur: jest.fn(), notifyAdminsAndManagers: jest.fn() }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/rateCache', () => ({ getExchangeRate: jest.fn(() => 0.92) }));
jest.mock('../../utils/validation', () => ({ validateDate: jest.fn(() => null), validatePassword: jest.fn(), validateEmail: jest.fn(), validatePhoto: jest.fn() }));

const db = require('../../database');
const { recalculatePaies } = require('../../services/paie-calculator');
const { logActivity } = require('../../utils/activityLogger');
const router = require('../../routes/ventes');
const adminApp = createApp('/api/ventes', router, 'admin');
const chatteurApp = createApp('/api/ventes', router, 'chatteur');
const managerApp = createApp('/api/ventes', router, 'manager');

const VALID_VENTE = {
  chatteur_id: 1, modele_id: 1, plateforme_id: 1, montant_brut: 100,
  periode_debut: '2026-03-01', periode_fin: '2026-03-15', shift_id: 1,
};

describe('GET /api/ventes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns sales', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ id: 1, montant_brut: 100 }]) }));
    const res = await request(adminApp).get('/api/ventes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('chatteur only sees own sales', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    const res = await request(chatteurApp).get('/api/ventes');
    expect(res.status).toBe(200);
    // The SQL should contain chatteur_id filter — verified via mock call
    const sqlCall = db.prepare.mock.calls[0][0];
    expect(sqlCall).toContain('v.chatteur_id = ?');
  });
});

describe('POST /api/ventes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 success', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 1, chatteur_id: 1, modele_id: 1, plateforme_id: 1 })) })) // shift check
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ '1': 1 })) })) // link check
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 5 })) })) // insert
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ prenom: 'Test' })) })) // chatteur name
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ nom: 'OF', devise: 'USD' })) })); // plateforme
    const res = await request(adminApp).post('/api/ventes').send(VALID_VENTE);
    expect(res.status).toBe(201);
    expect(recalculatePaies).toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'create_vente', 'vente', expect.any(Number), expect.any(String));
  });

  test('400 missing fields', async () => {
    const res = await request(adminApp).post('/api/ventes').send({ chatteur_id: 1 });
    expect(res.status).toBe(400);
  });

  test('400 missing shift_id', async () => {
    const res = await request(adminApp).post('/api/ventes').send({
      chatteur_id: 1, plateforme_id: 1, montant_brut: 100,
      periode_debut: '2026-03-01', periode_fin: '2026-03-15',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('shift_id');
  });

  test('400 invalid montant (negative)', async () => {
    const res = await request(adminApp).post('/api/ventes').send({
      ...VALID_VENTE, montant_brut: -10,
    });
    expect(res.status).toBe(400);
  });

  test('400 invalid montant (zero)', async () => {
    const res = await request(adminApp).post('/api/ventes').send({
      ...VALID_VENTE, montant_brut: 0,
    });
    expect(res.status).toBe(400);
  });

  test('400 shift not found', async () => {
    db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn(() => null) })); // shift not found
    const res = await request(adminApp).post('/api/ventes').send(VALID_VENTE);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Shift introuvable');
  });

  test('400 shift belongs to another chatteur', async () => {
    db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 1, chatteur_id: 999, modele_id: 1, plateforme_id: 1 })) })); // shift for other chatteur
    const res = await request(adminApp).post('/api/ventes').send(VALID_VENTE);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('appartient pas');
  });

  test('400 invalid modele-plateforme association', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 1, chatteur_id: 1, modele_id: 1, plateforme_id: 1 })) })) // shift
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => null) })) // link not found
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ pseudo: 'M1' })) })) // modele name
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ nom: 'OF' })) })); // plateforme name
    const res = await request(adminApp).post('/api/ventes').send({
      ...VALID_VENTE, plateforme_id: 99,
    });
    expect(res.status).toBe(400);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).post('/api/ventes').send(VALID_VENTE);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/ventes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates sale', async () => {
    const current = { id: 1, chatteur_id: 1, modele_id: 1, plateforme_id: 1, periode_debut: '2026-03-01', periode_fin: '2026-03-15' };
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => current),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/ventes/1').send({ montant_brut: 200 });
    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'update_vente', 'vente', 1);
  });

  test('404 vente not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/ventes/999').send({ montant_brut: 200 });
    expect(res.status).toBe(404);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).put('/api/ventes/1').send({ montant_brut: 200 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/ventes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes and recalculates', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, chatteur_id: 1, montant_brut: 100, periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).delete('/api/ventes/1');
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'delete_vente', 'vente', 1, '100');
  });

  test('404 vente not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).delete('/api/ventes/999');
    expect(res.status).toBe(404);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).delete('/api/ventes/1');
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/ventes/:id/valider', () => {
  beforeEach(() => jest.clearAllMocks());

  test('validates vente', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, chatteur_id: 1, montant_brut: 100, periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/ventes/1/valider').send({ statut: 'validée' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('validée');
    expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'validate_vente', 'vente', 1, expect.stringContaining('validée'));
  });

  test('rejects vente', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, chatteur_id: 1, montant_brut: 50, periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
      run: jest.fn(),
    }));
    const res = await request(adminApp).put('/api/ventes/1/valider').send({ statut: 'rejetée' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('rejetée');
    // Should also recalculate paies on rejection (to remove rejected vente from paies)
    expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'reject_vente', 'vente', 1, expect.stringContaining('rejetée'));
  });

  test('400 invalid statut', async () => {
    const res = await request(adminApp).put('/api/ventes/1/valider').send({ statut: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Statut invalide');
  });

  test('404 vente not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(adminApp).put('/api/ventes/99/valider').send({ statut: 'validée' });
    expect(res.status).toBe(404);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).put('/api/ventes/1/valider').send({ statut: 'validée' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/ventes/summary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns summary with totals', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ all: jest.fn(() => [
        { nom: 'OnlyFans', tva_rate: 0.2, commission_rate: 0.2, devise: 'USD', total_brut: 1000, nb_chatteurs: 3 },
      ])}))
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 1, prenom: 'Test', total_brut: 500 })) }));
    const res = await request(adminApp).get('/api/ventes/summary?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body.total_brut_usd).toBeDefined();
    expect(res.body.taux_change).toBe(0.92);
    expect(res.body.by_plateforme).toHaveLength(1);
  });

  test('filters rejected ventes', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []), get: jest.fn(() => null) }));
    await request(adminApp).get('/api/ventes/summary?periode_debut=2026-03-01&periode_fin=2026-03-15');
    const firstCall = db.prepare.mock.calls[0][0];
    expect(firstCall).toContain("statut != 'rejetée'");
  });
});

describe('GET /api/ventes/export-csv', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 missing params', async () => {
    const res = await request(adminApp).get('/api/ventes/export-csv');
    expect(res.status).toBe(400);
  });

  test('success with valid period', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => [{ montant_brut: 100, chatteur: 'Test' }]) }));
    const res = await request(adminApp).get('/api/ventes/export-csv?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(200);
  });

  test('403 for chatteur role', async () => {
    const res = await request(chatteurApp).get('/api/ventes/export-csv?periode_debut=2026-03-01&periode_fin=2026-03-15');
    expect(res.status).toBe(403);
  });

  test('filters rejected ventes in export', async () => {
    db.prepare.mockReturnValue(mockStmt({ all: jest.fn(() => []) }));
    await request(adminApp).get('/api/ventes/export-csv?periode_debut=2026-03-01&periode_fin=2026-03-15');
    const sqlCall = db.prepare.mock.calls[0][0];
    expect(sqlCall).toContain("statut != 'rejetée'");
  });
});

describe('POST /api/ventes/mes-ventes (chatteur self-service)', () => {
  beforeEach(() => jest.clearAllMocks());

  const SELF_VENTE = {
    modele_id: 1, plateforme_id: 1, montant_brut: 50,
    date: '2026-03-10', shift_id: 5,
  };

  test('201 creates own vente with en_attente status', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 5, chatteur_id: 20, modele_id: 1, plateforme_id: 1 })) })) // shift
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => null) })) // period lock check
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ '1': 1 })) })) // modele-pf link
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ prenom: 'Chatteur' })) })) // chatteur name
      .mockReturnValueOnce(mockStmt({ run: jest.fn(() => ({ lastInsertRowid: 10 })) })) // insert
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ nom: 'OF' })) })) // plateforme
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ pseudo: 'Model1' })) })); // modele
    const res = await request(chatteurApp).post('/api/ventes/mes-ventes').send(SELF_VENTE);
    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(expect.any(Number), 'create_vente_chatteur', 'vente', expect.any(Number), expect.stringContaining('self-service'));
  });

  test('400 missing fields', async () => {
    const res = await request(chatteurApp).post('/api/ventes/mes-ventes').send({ montant_brut: 50 });
    expect(res.status).toBe(400);
  });

  test('403 shift belongs to another chatteur', async () => {
    db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 5, chatteur_id: 999, modele_id: 1, plateforme_id: 1 })) }));
    const res = await request(chatteurApp).post('/api/ventes/mes-ventes').send(SELF_VENTE);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('appartient pas');
  });

  test('403 period is locked', async () => {
    db.prepare
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ id: 5, chatteur_id: 20, modele_id: 1, plateforme_id: 1 })) })) // shift
      .mockReturnValueOnce(mockStmt({ get: jest.fn(() => ({ statut: 'validé' })) })); // period locked
    const res = await request(chatteurApp).post('/api/ventes/mes-ventes').send(SELF_VENTE);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('validée');
  });

  test('403 for admin (no chatteur_id)', async () => {
    const res = await request(adminApp).post('/api/ventes/mes-ventes').send(SELF_VENTE);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/ventes/mes-ventes/:id (chatteur self-service)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates own vente', async () => {
    const venteData = { id: 1, chatteur_id: 20, modele_id: 1, plateforme_id: 1, periode_debut: '2026-03-01', periode_fin: '2026-03-15' };
    const getMock = jest.fn()
      .mockReturnValueOnce(venteData) // SELECT vente
      .mockReturnValueOnce(null) // isPeriodeLocked → not locked
      .mockReturnValueOnce({ '1': 1 }) // modele-pf link
      .mockReturnValueOnce(venteData); // prenom lookup fallback
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));
    const res = await request(chatteurApp).put('/api/ventes/mes-ventes/1').send({ montant_brut: 75 });
    expect(res.status).toBe(200);
  });

  test('403 vente belongs to another chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, chatteur_id: 999, modele_id: 1, plateforme_id: 1, periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
    }));
    const res = await request(chatteurApp).put('/api/ventes/mes-ventes/1').send({ montant_brut: 75 });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('propres ventes');
  });

  test('403 period locked', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, chatteur_id: 20, modele_id: 1, plateforme_id: 1, periode_debut: '2026-03-01', periode_fin: '2026-03-15' }) // vente
      .mockReturnValueOnce({ statut: 'payé' }); // lock check
    db.prepare.mockReturnValue(mockStmt({ get: getMock }));
    const res = await request(chatteurApp).put('/api/ventes/mes-ventes/1').send({ montant_brut: 75 });
    expect(res.status).toBe(403);
  });

  test('404 vente not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(chatteurApp).put('/api/ventes/mes-ventes/999').send({ montant_brut: 75 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/ventes/mes-ventes/:id (chatteur self-service)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes own vente', async () => {
    const venteData = { id: 1, chatteur_id: 20, montant_brut: 50, periode_debut: '2026-03-01', periode_fin: '2026-03-15' };
    const getMock = jest.fn()
      .mockReturnValueOnce(venteData) // SELECT vente
      .mockReturnValueOnce(null) // isPeriodeLocked → not locked
      .mockReturnValueOnce({ prenom: 'Test' }); // chatteur prenom for notification
    db.prepare.mockReturnValue(mockStmt({ get: getMock, run: jest.fn() }));
    const res = await request(chatteurApp).delete('/api/ventes/mes-ventes/1');
    expect(res.status).toBe(200);
    expect(recalculatePaies).toHaveBeenCalled();
  });

  test('403 vente belongs to another chatteur', async () => {
    db.prepare.mockReturnValue(mockStmt({
      get: jest.fn(() => ({ id: 1, chatteur_id: 999, montant_brut: 50, periode_debut: '2026-03-01', periode_fin: '2026-03-15' })),
    }));
    const res = await request(chatteurApp).delete('/api/ventes/mes-ventes/1');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('propres ventes');
  });

  test('403 period locked', async () => {
    const getMock = jest.fn()
      .mockReturnValueOnce({ id: 1, chatteur_id: 20, montant_brut: 50, periode_debut: '2026-03-01', periode_fin: '2026-03-15' }) // vente
      .mockReturnValueOnce({ statut: 'validé' }); // lock check
    db.prepare.mockReturnValue(mockStmt({ get: getMock }));
    const res = await request(chatteurApp).delete('/api/ventes/mes-ventes/1');
    expect(res.status).toBe(403);
  });

  test('404 vente not found', async () => {
    db.prepare.mockReturnValue(mockStmt({ get: jest.fn(() => null) }));
    const res = await request(chatteurApp).delete('/api/ventes/mes-ventes/999');
    expect(res.status).toBe(404);
  });
});
