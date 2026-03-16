/**
 * Repair corrupted DB by exporting data table by table.
 */
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'imperium.db');

// Clean up stale .lock directory
const lockDir = DB_PATH + '.lock';
try {
  if (fs.existsSync(lockDir)) fs.rmdirSync(lockDir);
} catch (e) { /* ignore */ }

// Known tables from the schema
const KNOWN_TABLES = [
  'users', 'chatteurs', 'modeles', 'plateformes', 'modeles_plateformes',
  'shifts', 'shift_templates', 'ventes', 'paies', 'malus',
  'notifications', 'annonces', 'migrations', 'telegram_state',
  'activity_log', 'paliers_primes', 'objectifs_collectifs',
  'telegram_log', 'shift_reports'
];

console.log('Opening corrupted database...');
const db = new Database(DB_PATH);
db.exec('PRAGMA writable_schema = ON');

// Try to read each table's schema and data
const tableData = {};
const tableSchemas = {};

for (const name of KNOWN_TABLES) {
  try {
    // Try to get the CREATE TABLE statement
    const rows = db.prepare(`SELECT sql FROM sqlite_master WHERE name = ? AND type = 'table'`).all(name);
    if (rows.length > 0 && rows[0].sql) {
      tableSchemas[name] = rows[0].sql;
    }
  } catch (e) {
    // Can't read sqlite_master, we'll use the schema from database.js
  }

  try {
    const data = db.prepare(`SELECT * FROM "${name}"`).all();
    tableData[name] = data;
    console.log(`  ${name}: ${data.length} rows`);
  } catch (e) {
    console.log(`  ${name}: FAILED (${e.message.substring(0, 50)})`);
    tableData[name] = null;
  }
}

db.close();

// Now create a new clean DB
const BACKUP_PATH = DB_PATH + '.corrupted';
const NEW_PATH = DB_PATH + '.new';

console.log(`\nBacking up corrupted DB to ${BACKUP_PATH}`);
try { fs.copyFileSync(DB_PATH, BACKUP_PATH); } catch {}

console.log('Creating new clean DB...');
if (fs.existsSync(NEW_PATH)) fs.unlinkSync(NEW_PATH);

// We need to initialize the new DB with the full schema.
// The easiest way: require database.js but point to new path.
// Instead, let's just copy the initDB schema manually.

const newDb = new Database(NEW_PATH);
newDb.exec('PRAGMA foreign_keys = ON');
newDb.exec('PRAGMA journal_mode = WAL');

// Copy the full schema from database.js initDB
newDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'chatteur', 'manager')),
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chatteurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    prenom TEXT NOT NULL,
    email TEXT,
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    pays TEXT DEFAULT 'France',
    iban TEXT,
    taux_commission REAL DEFAULT 0.08,
    role TEXT DEFAULT 'chatteur' CHECK(role IN ('chatteur', 'manager', 'va', 'directeur')),
    actif INTEGER DEFAULT 1,
    couleur INTEGER DEFAULT 0,
    photo TEXT,
    photo_mime TEXT,
    taux_net_equipe REAL,
    is_nouveau INTEGER DEFAULT 0,
    telegram_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS modeles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL,
    part_percent REAL DEFAULT 40.0,
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plateformes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    devise TEXT DEFAULT 'USD',
    taux_conversion REAL DEFAULT 0.92,
    actif INTEGER DEFAULT 1,
    couleur_fond TEXT,
    couleur_texte TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS modeles_plateformes (
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    PRIMARY KEY (modele_id, plateforme_id)
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    date TEXT NOT NULL,
    creneau INTEGER NOT NULL CHECK(creneau BETWEEN 1 AND 4),
    fuseau_horaire TEXT DEFAULT 'Europe/Paris',
    notification_sent INTEGER DEFAULT 0,
    reminder_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    jour_semaine INTEGER NOT NULL CHECK(jour_semaine BETWEEN 0 AND 6),
    creneau INTEGER NOT NULL CHECK(creneau BETWEEN 1 AND 4),
    fuseau_horaire TEXT DEFAULT 'Europe/Paris',
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ventes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    montant_brut REAL NOT NULL,
    date_vente TEXT,
    periode_debut TEXT,
    periode_fin TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS paies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    periode_debut TEXT NOT NULL,
    periode_fin TEXT NOT NULL,
    total_brut_usd REAL DEFAULT 0,
    total_brut_eur REAL DEFAULT 0,
    part_modele REAL DEFAULT 0,
    net_ht_eur REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    taux_commission REAL DEFAULT 0.08,
    prime REAL DEFAULT 0,
    malus_total REAL DEFAULT 0,
    total_final REAL DEFAULT 0,
    statut TEXT DEFAULT 'brouillon',
    facture_numero TEXT,
    facture_generee INTEGER DEFAULT 0,
    taux_conversion REAL DEFAULT 0.92,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS malus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    modele_id INTEGER REFERENCES modeles(id),
    plateforme_id INTEGER REFERENCES plateformes(id),
    type TEXT NOT NULL,
    montant REAL NOT NULL,
    raison TEXT,
    date_malus TEXT,
    periode_debut TEXT,
    periode_fin TEXT,
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatteur_id INTEGER REFERENCES chatteurs(id),
    type TEXT DEFAULT 'info',
    title TEXT,
    message TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS annonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id),
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telegram_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS paliers_primes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periode_debut TEXT NOT NULL,
    periode_fin TEXT NOT NULL,
    label TEXT NOT NULL,
    seuil_net_ht REAL NOT NULL,
    bonus REAL NOT NULL DEFAULT 0,
    emoji TEXT DEFAULT '',
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS objectifs_collectifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periode_debut TEXT NOT NULL,
    periode_fin TEXT NOT NULL,
    objectif_total_net_ht REAL NOT NULL,
    bonus_par_chatteur REAL NOT NULL DEFAULT 0,
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telegram_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT DEFAULT 'out',
    chat_id TEXT,
    chatteur_id INTEGER,
    chatteur_prenom TEXT,
    message_type TEXT DEFAULT 'message',
    content TEXT,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shift_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER REFERENCES shifts(id),
    chatteur_id INTEGER REFERENCES chatteurs(id),
    montant REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create indexes
try {
  newDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_telegram_log_created ON telegram_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_telegram_log_chatteur ON telegram_log(chatteur_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_log_type ON telegram_log(message_type);
  `);
} catch {}

// Now import data
console.log('\nImporting data...');
for (const name of KNOWN_TABLES) {
  const data = tableData[name];
  if (!data || data.length === 0) {
    console.log(`  ${name}: skipped (no data)`);
    continue;
  }

  try {
    const cols = Object.keys(data[0]);
    // Check which columns exist in new table
    const tableInfo = newDb.prepare(`PRAGMA table_info("${name}")`).all();
    const validCols = cols.filter(c => tableInfo.some(ti => ti.name === c));

    if (validCols.length === 0) {
      console.log(`  ${name}: no matching columns`);
      continue;
    }

    const placeholders = validCols.map(() => '?').join(',');
    const insert = newDb.prepare(`INSERT OR IGNORE INTO "${name}" (${validCols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`);

    let imported = 0;
    for (const row of data) {
      try {
        insert.run(...validCols.map(c => row[c] ?? null));
        imported++;
      } catch (e) { /* skip bad rows */ }
    }
    console.log(`  ${name}: ${imported}/${data.length} rows imported`);
  } catch (e) {
    console.log(`  ${name}: import failed (${e.message.substring(0, 60)})`);
  }
}

// Verify
console.log('\nIntegrity check on new DB...');
const check = newDb.prepare('PRAGMA integrity_check').all();
for (const r of check) console.log(`  ${JSON.stringify(r)}`);

newDb.close();

// Replace
console.log('\nReplacing corrupted DB...');
fs.unlinkSync(DB_PATH);
try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}
fs.renameSync(NEW_PATH, DB_PATH);

console.log('DB repaired successfully!');
