/**
 * E2E Integration Test: Login → Create Vente → Recalculate Paie → Generate Facture
 *
 * Tests the critical business flow end-to-end using mocked DB.
 * Validates that each step in the pipeline works correctly and that
 * the data flows between services properly.
 */

const { createApp, mockStmt, USERS } = require('../helpers/setup');

// --- Mocks ---
jest.mock('../../database', () => {
  const mockDb = {
    prepare: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn((fn) => fn), // transparent transaction wrapper
  };
  return mockDb;
});

jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  adminOnly: (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    next();
  },
  adminOrManager: (req, res, next) => {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  },
  signToken: jest.fn().mockReturnValue('mock-jwt-token'),
}));

jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/notifier', () => ({ notifyChatteur: jest.fn() }));
jest.mock('../../utils/rateCache', () => ({
  getExchangeRate: jest.fn().mockReturnValue(0.92),
  invalidateRateCache: jest.fn(),
}));
jest.mock('../../services/paie-calculator', () => ({
  recalculatePaies: jest.fn().mockReturnValue({
    periode_debut: '2026-03-01',
    periode_fin: '2026-03-15',
    taux_change: 0.92,
    total_net_ht_equipe: 5000,
    nb_paies: 3,
    top3: [],
  }),
}));
jest.mock('../../services/facture-generator', () => {
  const { PassThrough } = require('stream');
  return {
    generateFacture: jest.fn().mockImplementation(() => {
      const stream = new PassThrough();
      // End the stream after a tick so pipe completes
      process.nextTick(() => { stream.end('mock-pdf-data'); });
      return { stream, filename: 'IMPERA_001_TEST.pdf' };
    }),
  };
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const request = require('supertest');
const db = require('../../database');
const { recalculatePaies } = require('../../services/paie-calculator');
const { generateFacture } = require('../../services/facture-generator');
const bcrypt = require('bcryptjs');

// --- App setup ---
const authRouter = require('../../routes/auth');
const ventesRouter = require('../../routes/ventes');
const paiesRouter = require('../../routes/paies');

const express = require('express');
const cookieParser = require('cookie-parser');

function createE2EApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mock auth: inject user from x-test-role header
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'] || 'admin';
    req.user = USERS[role];
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/ventes', ventesRouter);
  app.use('/api/paies', paiesRouter);

  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  });

  return app;
}

describe('E2E Flow: Login → Vente → Paie → Facture', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createE2EApp();
  });

  // ─── Step 1: Login ───
  describe('Step 1: Login', () => {
    it('should authenticate admin successfully', async () => {
      const hash = bcrypt.hashSync('Admin123!', 10);
      db.prepare
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue(null) })) // checkLockout: no lockout entry
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ id: 1, email: 'admin@test.com', password_hash: hash, role: 'admin' }) })) // SELECT user
        .mockReturnValueOnce(mockStmt({ run: jest.fn() })) // resetAttempts: DELETE lockout
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue(null) })); // SELECT chatteur

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123!' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('admin');
    });

    it('should reject wrong password', async () => {
      db.prepare
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue(null) })) // checkLockout
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ id: 1, email: 'admin@test.com', password_hash: bcrypt.hashSync('correct', 10), role: 'admin' }) })) // SELECT user
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue(null) })) // recordFailedAttempt: SELECT attempts
        .mockReturnValueOnce(mockStmt({ run: jest.fn() })); // recordFailedAttempt: INSERT OR REPLACE

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 2: Create Vente ───
  describe('Step 2: Create Vente', () => {
    it('should create a vente and trigger paie recalculation', async () => {
      // Mock shift lookup + modele-plateforme association check + insert + notifications
      db.prepare
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ id: 1, chatteur_id: 1, modele_id: 1, plateforme_id: 1 }) })) // shift
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ '1': 1 }) })) // link exists
        .mockReturnValueOnce(mockStmt({ run: jest.fn().mockReturnValue({ lastInsertRowid: 42 }) })) // INSERT
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ prenom: 'Test' }) })) // chatteur name
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ nom: 'OF', devise: 'USD' }) })); // plateforme

      const res = await request(app)
        .post('/api/ventes')
        .set('x-test-role', 'admin')
        .send({
          chatteur_id: 1,
          modele_id: 1,
          plateforme_id: 1,
          montant_brut: 500,
          periode_debut: '2026-03-01',
          periode_fin: '2026-03-15',
          shift_id: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      // Verify recalculatePaies was called with correct period
      expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
    });

    it('should reject negative montant', async () => {
      const res = await request(app)
        .post('/api/ventes')
        .set('x-test-role', 'admin')
        .send({
          chatteur_id: 1,
          plateforme_id: 1,
          montant_brut: -50,
          periode_debut: '2026-03-01',
          periode_fin: '2026-03-15',
          shift_id: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalide/i);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/ventes')
        .set('x-test-role', 'admin')
        .send({ chatteur_id: 1 });

      expect(res.status).toBe(400);
    });

    it('should reject chatteur role trying to create vente', async () => {
      const res = await request(app)
        .post('/api/ventes')
        .set('x-test-role', 'chatteur')
        .send({
          chatteur_id: 1,
          plateforme_id: 1,
          montant_brut: 100,
          periode_debut: '2026-03-01',
          periode_fin: '2026-03-15',
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── Step 3: Recalculate Paies ───
  describe('Step 3: Recalculate Paies', () => {
    it('should recalculate paies for admin', async () => {
      const res = await request(app)
        .post('/api/paies/recalculer')
        .set('x-test-role', 'admin')
        .send({ debut: '2026-03-01', fin: '2026-03-15' });

      expect(res.status).toBe(200);
      expect(recalculatePaies).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
      expect(res.body.periode_debut).toBe('2026-03-01');
    });

    it('should reject non-admin role', async () => {
      const res = await request(app)
        .post('/api/paies/recalculer')
        .set('x-test-role', 'manager')
        .send({ debut: '2026-03-01', fin: '2026-03-15' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid dates', async () => {
      const res = await request(app)
        .post('/api/paies/recalculer')
        .set('x-test-role', 'admin')
        .send({ debut: 'not-a-date', fin: '2026-03-15' });

      expect(res.status).toBe(400);
    });

    it('should reject missing dates', async () => {
      const res = await request(app)
        .post('/api/paies/recalculer')
        .set('x-test-role', 'admin')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 4: View Paies ───
  describe('Step 4: View Paies', () => {
    it('should return paies for a period', async () => {
      const mockPaies = [
        { id: 1, chatteur_id: 1, plateforme_id: 1, net_ht_eur: 1000, total_chatteur: 150, role: 'chatteur', chatteur_prenom: 'TEST', prime: 0 },
      ];
      db.prepare
        .mockReturnValueOnce(mockStmt({ all: jest.fn().mockReturnValue(mockPaies) })) // paies query
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ agency_gross: 3000 }) })) // agency gross
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ pending_net_ht: 0, nb_pending: 0 }) })); // preview (pending ventes)

      const res = await request(app)
        .get('/api/paies?debut=2026-03-01&fin=2026-03-15')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.paies).toBeDefined();
      expect(res.body.resume).toBeDefined();
    });

    it('should reject missing period', async () => {
      const res = await request(app)
        .get('/api/paies')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const res = await request(app)
        .get('/api/paies?debut=foobar&fin=2026-03-15')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 5: Generate Facture PDF ───
  describe('Step 5: Generate Facture PDF', () => {
    it('should generate facture for admin', async () => {
      // Mock pending ventes check → 0 pending
      db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ cnt: 0 }) }));

      const res = await request(app)
        .get('/api/paies/facture?chatteur_id=1&debut=2026-03-01&fin=2026-03-15')
        .set('x-test-role', 'admin');

      // generateFacture returns a stream that pipes to res
      expect(generateFacture).toHaveBeenCalledWith(1, '2026-03-01', '2026-03-15');
    });

    it('should reject chatteur accessing another chatteur facture', async () => {
      const res = await request(app)
        .get('/api/paies/facture?chatteur_id=999&debut=2026-03-01&fin=2026-03-15')
        .set('x-test-role', 'chatteur');

      expect(res.status).toBe(403);
    });

    it('should allow chatteur to access own facture', async () => {
      // Mock pending ventes check → 0 pending
      db.prepare.mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ cnt: 0 }) }));

      await request(app)
        .get('/api/paies/facture?chatteur_id=20&debut=2026-03-01&fin=2026-03-15')
        .set('x-test-role', 'chatteur');

      expect(generateFacture).toHaveBeenCalledWith(20, '2026-03-01', '2026-03-15');
    });

    it('should reject missing params', async () => {
      const res = await request(app)
        .get('/api/paies/facture?chatteur_id=1')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 6: Export CSV ───
  describe('Step 6: Export CSV', () => {
    it('should reject invalid dates on paies export', async () => {
      const res = await request(app)
        .get('/api/paies/export-csv?debut=invalid&fin=2026-03-15')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(400);
    });

    it('should reject invalid dates on ventes export', async () => {
      const res = await request(app)
        .get('/api/ventes/export-csv?periode_debut=invalid&periode_fin=2026-03-15')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 7: Paie status workflow ───
  describe('Step 7: Paie status workflow (calculé → validé → payé)', () => {
    it('should allow admin to change status to validé', async () => {
      db.prepare.mockReturnValue(mockStmt({
        get: jest.fn().mockReturnValue({ chatteur_id: 1 }),
        run: jest.fn().mockReturnValue({ changes: 1 }),
      }));

      const res = await request(app)
        .put('/api/paies/1/statut')
        .set('x-test-role', 'admin')
        .send({ statut: 'validé' });

      expect(res.status).toBe(200);
    });

    it('should prevent manager from marking payé', async () => {
      const res = await request(app)
        .put('/api/paies/1/statut')
        .set('x-test-role', 'manager')
        .send({ statut: 'payé' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid statut', async () => {
      const res = await request(app)
        .put('/api/paies/1/statut')
        .set('x-test-role', 'admin')
        .send({ statut: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Step 8: Chatteur mes-paies ───
  describe('Step 8: Chatteur mes-paies', () => {
    it('should return own paies for chatteur', async () => {
      db.prepare
        .mockReturnValueOnce(mockStmt({ get: jest.fn().mockReturnValue({ taux_commission: 0.15, role: 'chatteur' }) }))
        .mockReturnValueOnce(mockStmt({ all: jest.fn().mockReturnValue([{ id: 1, total_chatteur: 100 }]) }));

      const res = await request(app)
        .get('/api/paies/mes-paies')
        .set('x-test-role', 'chatteur');

      expect(res.status).toBe(200);
      expect(res.body.paies).toBeDefined();
      expect(res.body.taux_commission).toBe(0.15);
    });

    it('should reject admin trying mes-paies', async () => {
      const res = await request(app)
        .get('/api/paies/mes-paies')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(403);
    });
  });
});
