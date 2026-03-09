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
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT,
      adresse TEXT,
      code_postal TEXT,
      ville TEXT,
      pays TEXT DEFAULT 'France',
      iban TEXT,
      taux_commission REAL NOT NULL DEFAULT 0.15,
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
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
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
      date DATE NOT NULL,
      creneau INTEGER NOT NULL CHECK(creneau IN (1, 2, 3, 4)),
      fuseau_horaire TEXT NOT NULL DEFAULT 'Europe/Paris',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      ventes_brutes_usd REAL NOT NULL DEFAULT 0,
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
