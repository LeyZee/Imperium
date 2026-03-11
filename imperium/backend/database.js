const { Database } = require('node-sqlite3-wasm');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'imperium.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'chatteur')),
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chatteurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      prenom TEXT NOT NULL,
      email TEXT,
      adresse TEXT,
      code_postal TEXT,
      ville TEXT,
      pays TEXT DEFAULT 'France',
      iban TEXT,
      taux_commission REAL NOT NULL DEFAULT 0.15,
      role TEXT NOT NULL DEFAULT 'chatteur' CHECK(role IN ('chatteur', 'manager', 'va')),
      taux_net_equipe REAL NOT NULL DEFAULT 0,
      couleur INTEGER NOT NULL DEFAULT 0,
      is_nouveau INTEGER NOT NULL DEFAULT 0,
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plateformes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      tva_rate REAL NOT NULL DEFAULT 0.0,
      commission_rate REAL NOT NULL DEFAULT 0.20,
      devise TEXT NOT NULL DEFAULT 'USD',
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS modeles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pseudo TEXT NOT NULL,
      part_percent REAL NOT NULL DEFAULT 0.35,
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      modele_id INTEGER REFERENCES modeles(id) ON DELETE SET NULL,
      plateforme_id INTEGER NOT NULL REFERENCES plateformes(id) ON DELETE RESTRICT,
      montant_brut REAL NOT NULL,
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS malus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      montant REAL NOT NULL,
      raison TEXT,
      periode DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS taux_change (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      devise_base TEXT NOT NULL,
      devise_cible TEXT NOT NULL DEFAULT 'EUR',
      taux REAL NOT NULL,
      date_maj DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(devise_base, devise_cible, date_maj)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      modele_id INTEGER REFERENCES modeles(id) ON DELETE SET NULL,
      plateforme_id INTEGER REFERENCES plateformes(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      creneau INTEGER NOT NULL CHECK(creneau IN (1, 2, 3, 4)),
      fuseau_horaire TEXT NOT NULL DEFAULT 'Europe/Paris',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS modeles_plateformes (
      modele_id INTEGER NOT NULL REFERENCES modeles(id) ON DELETE CASCADE,
      plateforme_id INTEGER NOT NULL REFERENCES plateformes(id) ON DELETE CASCADE,
      PRIMARY KEY (modele_id, plateforme_id)
    );

    CREATE TABLE IF NOT EXISTS shift_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      modele_id INTEGER REFERENCES modeles(id) ON DELETE SET NULL,
      plateforme_id INTEGER REFERENCES plateformes(id) ON DELETE SET NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
      creneau INTEGER NOT NULL CHECK(creneau IN (1, 2, 3, 4)),
      fuseau_horaire TEXT NOT NULL DEFAULT 'Europe/Paris'
    );

    CREATE TABLE IF NOT EXISTS telegram_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      plateforme_id INTEGER REFERENCES plateformes(id) ON DELETE SET NULL,
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      ventes_brutes REAL NOT NULL DEFAULT 0,
      taux_change REAL NOT NULL DEFAULT 1,
      ventes_ttc_eur REAL NOT NULL DEFAULT 0,
      ventes_ht_eur REAL NOT NULL DEFAULT 0,
      net_ht_eur REAL NOT NULL DEFAULT 0,
      commission_chatteur REAL NOT NULL DEFAULT 0,
      malus_total REAL NOT NULL DEFAULT 0,
      prime REAL NOT NULL DEFAULT 0,
      total_chatteur REAL NOT NULL DEFAULT 0,
      statut TEXT NOT NULL DEFAULT 'calculé' CHECK(statut IN ('calculé', 'validé', 'payé')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chatteur_id, plateforme_id, periode_debut, periode_fin)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_num TEXT UNIQUE NOT NULL,
      seq_num INTEGER NOT NULL,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id),
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      montant_ht REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chatteur_id, periode_debut, periode_fin)
    );
  `);

  // Seed default data
  seedDefaults();
}

function seedDefaults() {
  // Default admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(['admin']);
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)').run(
      ['admin', hash, 'admin', 'admin@impera-agency.com']
    );
  }

  // Default platforms
  const pfCount = db.prepare('SELECT COUNT(*) as c FROM plateformes').get([]);
  if (!pfCount || pfCount.c === 0) {
    db.prepare('INSERT INTO plateformes (nom, tva_rate, commission_rate, devise) VALUES (?, ?, ?, ?)').run(
      ['OnlyFans', 0.0, 0.20, 'USD']
    );
    db.prepare('INSERT INTO plateformes (nom, tva_rate, commission_rate, devise) VALUES (?, ?, ?, ?)').run(
      ['Reveal', 0.20, 0.18, 'EUR']
    );
  }

  // Default modeles_plateformes mapping
  const mpCount = db.prepare('SELECT COUNT(*) as c FROM modeles_plateformes').get([]);
  if (!mpCount || mpCount.c === 0) {
    const modeles = db.prepare('SELECT id, pseudo FROM modeles').all([]);
    const plateformes = db.prepare('SELECT id, nom FROM plateformes').all([]);
    const of = plateformes.find(p => p.nom === 'OnlyFans');
    const rev = plateformes.find(p => p.nom === 'Reveal');
    if (of && rev && modeles.length > 0) {
      const mapping = {
        'MESSALINA': [of.id, rev.id],
        'ANGEL': [of.id, rev.id],
        'EMMY': [of.id],
        'SOUKI': [of.id],
        'LILY': [rev.id],
      };
      for (const m of modeles) {
        const pids = mapping[m.pseudo] || [];
        for (const pid of pids) {
          try {
            db.prepare('INSERT OR IGNORE INTO modeles_plateformes (modele_id, plateforme_id) VALUES (?, ?)').run([m.id, pid]);
          } catch (e) { /* ignore */ }
        }
      }
    }
  }

  // Default exchange rate USD→EUR
  const tauxExists = db.prepare('SELECT id FROM taux_change WHERE devise_base = ? AND devise_cible = ?').get(['USD', 'EUR']);
  if (!tauxExists) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT OR IGNORE INTO taux_change (devise_base, devise_cible, taux, date_maj) VALUES (?, ?, ?, ?)').run(
      ['USD', 'EUR', 0.92, today]
    );
  }
}

initDB();

// Migration: add plateforme_id to shifts if missing (existing DBs)
try {
  db.exec("ALTER TABLE shifts ADD COLUMN plateforme_id INTEGER REFERENCES plateformes(id) ON DELETE SET NULL");
} catch (e) { /* already exists */ }

// Migration: chatteurs — add role, taux_net_equipe (for old DBs with is_manager/nom)
try {
  db.exec("ALTER TABLE chatteurs ADD COLUMN role TEXT NOT NULL DEFAULT 'chatteur'");
} catch (e) { /* already exists */ }
try {
  db.exec("ALTER TABLE chatteurs ADD COLUMN taux_net_equipe REAL NOT NULL DEFAULT 0");
} catch (e) { /* already exists */ }

// Migration: modeles — recreate with pseudo if old schema (nom+prenom)
try {
  const modelSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='modeles'").get([]);
  if (modelSql && modelSql.sql && modelSql.sql.includes('prenom') && !modelSql.sql.includes('pseudo')) {
    db.exec("ALTER TABLE modeles ADD COLUMN pseudo TEXT");
    db.exec("UPDATE modeles SET pseudo = prenom WHERE pseudo IS NULL");
  }
} catch (e) { /* ignore */ }

// Migration: add couleur column to chatteurs
try {
  db.exec("ALTER TABLE chatteurs ADD COLUMN couleur INTEGER NOT NULL DEFAULT 0");
} catch (e) { /* already exists */ }

// Migration: add statut column to chatteurs and modeles
try {
  db.exec("ALTER TABLE chatteurs ADD COLUMN statut TEXT NOT NULL DEFAULT 'actif'");
} catch (e) { /* already exists */ }
try {
  db.exec("ALTER TABLE modeles ADD COLUMN statut TEXT NOT NULL DEFAULT 'actif'");
} catch (e) { /* already exists */ }
// Migrate existing actif=0 rows to statut='inactif'
try {
  db.exec("UPDATE chatteurs SET statut = 'inactif' WHERE actif = 0 AND statut = 'actif'");
  db.exec("UPDATE modeles SET statut = 'inactif' WHERE actif = 0 AND statut = 'actif'");
} catch (e) { /* ignore */ }

// Migration: recreate paies table with plateforme_id in UNIQUE constraint
try {
  const hasCol = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='paies'").get([]);
  if (hasCol && hasCol.sql && !hasCol.sql.includes('plateforme_id')) {
    db.exec("DROP TABLE IF EXISTS paies");
    db.exec(`
      CREATE TABLE paies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
        plateforme_id INTEGER REFERENCES plateformes(id) ON DELETE SET NULL,
        periode_debut DATE NOT NULL,
        periode_fin DATE NOT NULL,
        ventes_brutes REAL NOT NULL DEFAULT 0,
        taux_change REAL NOT NULL DEFAULT 1,
        ventes_ttc_eur REAL NOT NULL DEFAULT 0,
        ventes_ht_eur REAL NOT NULL DEFAULT 0,
        net_ht_eur REAL NOT NULL DEFAULT 0,
        commission_chatteur REAL NOT NULL DEFAULT 0,
        malus_total REAL NOT NULL DEFAULT 0,
        prime REAL NOT NULL DEFAULT 0,
        total_chatteur REAL NOT NULL DEFAULT 0,
        statut TEXT NOT NULL DEFAULT 'calculé' CHECK(statut IN ('calculé', 'validé', 'payé')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chatteur_id, plateforme_id, periode_debut, periode_fin)
      )
    `);
  }
} catch (e) { /* ignore */ }

// Migration: add couleur_fond and couleur_texte to plateformes
try { db.exec("ALTER TABLE plateformes ADD COLUMN couleur_fond TEXT NOT NULL DEFAULT '#1b2e4b'"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE plateformes ADD COLUMN couleur_texte TEXT NOT NULL DEFAULT '#ffffff'"); } catch (e) { /* already exists */ }
// Seed platform colors
try {
  db.exec("UPDATE plateformes SET couleur_fond = '#00AFF0', couleur_texte = '#ffffff' WHERE nom = 'OnlyFans' AND couleur_fond = '#1b2e4b'");
  db.exec("UPDATE plateformes SET couleur_fond = '#000000', couleur_texte = '#ffffff' WHERE nom = 'Reveal' AND couleur_fond = '#1b2e4b'");
} catch (e) { /* ignore */ }

// Migration: add photo to users, chatteurs, modeles + prenom to users
try { db.exec("ALTER TABLE users ADD COLUMN photo TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN prenom TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE chatteurs ADD COLUMN photo TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE modeles ADD COLUMN photo TEXT"); } catch (e) { /* already exists */ }

// Migration: add taux_horaire for VA chatteurs
try { db.exec("ALTER TABLE chatteurs ADD COLUMN taux_horaire REAL NOT NULL DEFAULT 0"); } catch (e) { /* already exists */ }

// Migration: email unique index + backfill null emails
try { db.exec("UPDATE users SET email = username WHERE email IS NULL"); } catch (e) { /* ignore */ }
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL"); } catch (e) { /* already exists */ }

// Performance indexes
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_chatteur_periode ON ventes(chatteur_id, periode_debut, periode_fin)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_plateforme ON ventes(plateforme_id)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_date_creneau ON shifts(date, creneau)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_modele_plateforme ON shifts(modele_id, plateforme_id, date, creneau)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_chatteur ON shifts(chatteur_id)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_malus_chatteur_periode ON malus(chatteur_id, periode)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_paies_periode ON paies(periode_debut, periode_fin)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_chatteurs_actif ON chatteurs(actif, statut)"); } catch (e) {}

// Compatibility wrapper: makes node-sqlite3-wasm behave like better-sqlite3
// (accepts spread args instead of requiring an array)
function wrapStmt(stmt) {
  function norm(args) {
    if (args.length === 0) return undefined;
    if (args.length === 1) return args[0];
    return args; // multiple args → array → bindArray
  }
  return {
    run(...args) { return stmt.run(norm(args)); },
    get(...args) { return stmt.get(norm(args)); },
    all(...args) { return stmt.all(norm(args)); },
  };
}

const compatDb = {
  prepare(sql) { return wrapStmt(db.prepare(sql)); },
  exec(sql) { return db.exec(sql); },
  transaction(fn) {
    // Returns a callable that wraps fn in BEGIN/COMMIT/ROLLBACK
    return function(...args) {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch {}
        throw err;
      }
    };
  },
};

module.exports = compatDb;
