const { Database } = require('node-sqlite3-wasm');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'imperium.db');
const dbStartTime = Date.now();

// Clean up stale .lock directory from node-sqlite3-wasm crashes
const lockDir = DB_PATH + '.lock';
try {
  if (fs.existsSync(lockDir)) {
    fs.rmdirSync(lockDir);
    console.log('Cleaned up stale DB lock directory');
  }
} catch (e) { /* ignore */ }

const db = new Database(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON');

// WAL mode: enables concurrent reads without blocking writes (major perf boost)
db.exec('PRAGMA journal_mode = WAL');
// Synchronous NORMAL: safe for WAL mode, faster than FULL
db.exec('PRAGMA synchronous = NORMAL');

function initDB() {
  db.exec(`
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
  // Default admin user — uses env var or generates random password
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(['admin']);
  if (!adminExists) {
    const crypto = require('crypto');
    const defaultPwd = process.env.ADMIN_DEFAULT_PASSWORD || crypto.randomBytes(16).toString('hex');
    const hash = bcrypt.hashSync(defaultPwd, 10);
    db.prepare('INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)').run(
      ['admin', hash, 'admin', 'admin@impera-agency.com']
    );
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.log(`\n🔑  Compte admin créé. Mot de passe temporaire : ${defaultPwd}`);
      console.log('    Changez-le immédiatement après la première connexion.\n');
    }
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

// === Migration System ===
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Fix directeur role — schema was patched offline via fix-db.js
// This block only runs the UPDATE if the CHECK constraint already includes 'directeur'
try {
  const schemaRow = db.prepare('SELECT sql FROM sqlite_master WHERE type=? AND name=?').get(['table', 'chatteurs']);
  if (schemaRow && schemaRow.sql && schemaRow.sql.includes('directeur')) {
    db.exec("UPDATE chatteurs SET role = 'directeur' WHERE role = 'manager' AND user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)");
  }
  db.exec("INSERT OR IGNORE INTO migrations (name) VALUES ('fix_directeur_role')");
} catch (e) {
  if (!e.message?.includes('no such table')) {
    console.error('Directeur role fix:', e.message);
  }
}

function runMigration(name, fn) {
  // Use prepare+finalize to check, properly releasing locks
  const stmt = db.prepare('SELECT 1 FROM migrations WHERE name = ?');
  const existing = stmt.get([name]);
  stmt.finalize();
  if (existing) return;
  try {
    fn();
    db.exec(`INSERT OR IGNORE INTO migrations (name) VALUES ('${name.replace(/'/g, "''")}')`);
    console.log('Migration applied:', name);
  } catch (e) {
    if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
      db.exec(`INSERT OR IGNORE INTO migrations (name) VALUES ('${name.replace(/'/g, "''")}')`);
      console.log('Migration skipped (already applied):', name);
    } else {
      console.error('Migration FAILED:', name, '-', e.message);
    }
  }
}

// --- Migrations ---

runMigration('add_chatteurs_role', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN role TEXT NOT NULL DEFAULT 'chatteur'");
});

runMigration('add_chatteurs_taux_net_equipe', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN taux_net_equipe REAL NOT NULL DEFAULT 0");
});

runMigration('add_modeles_pseudo', () => {
  const modelSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='modeles'").get([]);
  if (modelSql && modelSql.sql && modelSql.sql.includes('prenom') && !modelSql.sql.includes('pseudo')) {
    db.exec("ALTER TABLE modeles ADD COLUMN pseudo TEXT");
    db.exec("UPDATE modeles SET pseudo = prenom WHERE pseudo IS NULL");
  }
});

runMigration('add_chatteurs_couleur', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN couleur INTEGER NOT NULL DEFAULT 0");
});

runMigration('add_chatteurs_statut', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN statut TEXT NOT NULL DEFAULT 'actif'");
});

runMigration('add_modeles_statut', () => {
  db.exec("ALTER TABLE modeles ADD COLUMN statut TEXT NOT NULL DEFAULT 'actif'");
});

runMigration('sync_actif_statut', () => {
  db.exec("UPDATE chatteurs SET statut = 'inactif' WHERE actif = 0 AND statut = 'actif'");
  db.exec("UPDATE modeles SET statut = 'inactif' WHERE actif = 0 AND statut = 'actif'");
});

runMigration('recreate_paies_with_plateforme', () => {
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
});

runMigration('add_plateformes_couleurs', () => {
  db.exec("ALTER TABLE plateformes ADD COLUMN couleur_fond TEXT NOT NULL DEFAULT '#1b2e4b'");
  db.exec("ALTER TABLE plateformes ADD COLUMN couleur_texte TEXT NOT NULL DEFAULT '#ffffff'");
});

runMigration('seed_platform_colors', () => {
  db.exec("UPDATE plateformes SET couleur_fond = '#00AFF0', couleur_texte = '#ffffff' WHERE nom = 'OnlyFans' AND couleur_fond = '#1b2e4b'");
  db.exec("UPDATE plateformes SET couleur_fond = '#000000', couleur_texte = '#ffffff' WHERE nom = 'Reveal' AND couleur_fond = '#1b2e4b'");
});

runMigration('add_photos_prenom', () => {
  try { db.exec("ALTER TABLE users ADD COLUMN photo TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN prenom TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE chatteurs ADD COLUMN photo TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE modeles ADD COLUMN photo TEXT"); } catch (e) {}
});

runMigration('add_malus_actif', () => {
  db.exec("ALTER TABLE malus ADD COLUMN actif INTEGER NOT NULL DEFAULT 1");
});

runMigration('add_chatteurs_taux_horaire', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN taux_horaire REAL NOT NULL DEFAULT 0");
});

runMigration('add_users_email_index', () => {
  db.exec("UPDATE users SET email = username WHERE email IS NULL");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");
});

runMigration('add_updated_at_columns', () => {
  for (const table of ['chatteurs', 'modeles', 'ventes', 'paies', 'shifts']) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (e) {}
  }
});

runMigration('add_performance_indexes', () => {
  db.exec("CREATE INDEX IF NOT EXISTS idx_chatteurs_user_id ON chatteurs(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_chatteur_periode ON ventes(chatteur_id, periode_debut, periode_fin)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_plateforme ON ventes(plateforme_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_date_creneau ON shifts(date, creneau)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_modele_plateforme ON shifts(modele_id, plateforme_id, date, creneau)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_chatteur ON shifts(chatteur_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_malus_chatteur_periode ON malus(chatteur_id, periode)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_paies_periode ON paies(periode_debut, periode_fin)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_chatteurs_actif ON chatteurs(actif)");
});

runMigration('add_manager_user_role', () => {
  // SQLite cannot ALTER CHECK constraints — recreate the table
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'chatteur', 'manager')),
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      photo TEXT,
      prenom TEXT
    );
    INSERT INTO users_new (id, username, password_hash, role, email, created_at, photo, prenom)
      SELECT id, username, password_hash, role, email, created_at, photo, prenom FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
  `);
});

runMigration('fix_manager_user_role_check', () => {
  // Fix: previous migration may have failed partially. Redo the table recreation.
  db.exec(`DROP TABLE IF EXISTS users_new`);
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'chatteur', 'manager')),
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      photo TEXT,
      prenom TEXT
    );
    INSERT INTO users_new (id, username, password_hash, role, email, created_at, photo, prenom)
      SELECT id, username, password_hash, role, email, created_at, photo, prenom FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
  `);
});

// --- Phase 0: Activity logs ---
runMigration('create_activity_logs', () => {
  db.exec(`
    CREATE TABLE activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
  `);
});

// --- Phase 1: Primes manuelles, Notes, Annonces ---
runMigration('create_primes_manuelles', () => {
  db.exec(`
    CREATE TABLE primes_manuelles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      montant REAL NOT NULL,
      raison TEXT,
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_primes_chatteur_periode ON primes_manuelles(chatteur_id, periode_debut, periode_fin);
  `);
});

runMigration('create_notes', () => {
  db.exec(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_notes_chatteur ON notes(chatteur_id);
  `);
});

runMigration('create_annonces', () => {
  db.exec(`
    CREATE TABLE annonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

// --- Phase 2: Demandes congés/échanges ---
runMigration('create_demandes', () => {
  db.exec(`
    CREATE TABLE demandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('conge', 'echange')),
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      motif TEXT,
      echange_avec_id INTEGER REFERENCES chatteurs(id),
      statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'approuve', 'refuse')),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_demandes_chatteur ON demandes(chatteur_id);
    CREATE INDEX idx_demandes_statut ON demandes(statut);
  `);
});

// --- Phase 3: Objectifs ---
runMigration('create_objectifs', () => {
  db.exec(`
    CREATE TABLE objectifs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER REFERENCES chatteurs(id) ON DELETE CASCADE,
      modele_id INTEGER REFERENCES modeles(id) ON DELETE SET NULL,
      montant_cible REAL NOT NULL,
      periode_debut DATE NOT NULL,
      periode_fin DATE NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_objectifs_chatteur ON objectifs(chatteur_id, periode_debut, periode_fin);
  `);
});

// --- Phase 4: Notifications ---
runMigration('create_notifications', () => {
  db.exec(`
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
  `);
});

runMigration('sync_manager_user_roles', () => {
  // Sync user.role to 'manager' for any user linked to a chatteur with role='manager'
  db.exec(`
    UPDATE users SET role = 'manager'
    WHERE id IN (SELECT user_id FROM chatteurs WHERE role = 'manager' AND user_id IS NOT NULL)
    AND role != 'manager';
  `);
});

runMigration('link_users_to_chatteurs', () => {
  // Link user accounts to chatteur records by matching username to prenom (case-insensitive)
  // This fixes chatteurs created by seed without proper user_id linking
  const unlinked = db.all(`
    SELECT c.id as chatteur_id, c.prenom, u.id as user_id, u.username
    FROM chatteurs c
    JOIN users u ON (
      LOWER(REPLACE(u.username, '-', '')) = LOWER(REPLACE(REPLACE(c.prenom, '-', ''), ' ', ''))
      OR LOWER(u.email) LIKE LOWER(c.prenom) || '%'
    )
    WHERE c.user_id IS NULL AND u.role IN ('chatteur', 'manager')
  `);
  for (const row of unlinked) {
    db.prepare('UPDATE chatteurs SET user_id = ? WHERE id = ? AND user_id IS NULL').run([row.user_id, row.chatteur_id]);
    // Also sync prenom to users table if missing
    db.prepare('UPDATE users SET prenom = ? WHERE id = ? AND prenom IS NULL').run([row.prenom, row.user_id]);
  }
});

runMigration('assign_chatteur_emails', () => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, c.prenom
    FROM users u
    LEFT JOIN chatteurs c ON c.user_id = u.id
    WHERE u.role IN ('chatteur', 'manager')
    AND (u.email IS NULL OR u.email NOT LIKE '%@%')
  `).all([]);

  for (const u of users) {
    const base = (u.username || u.prenom || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    if (!base) continue;
    const email = base + '@impera-agency.com';
    db.prepare('UPDATE users SET email = ?, username = ? WHERE id = ?')
      .run([email, email, u.id]);
    db.prepare('UPDATE chatteurs SET email = ? WHERE user_id = ?')
      .run([email, u.id]);
  }
  if (users.length > 0) console.log(`Assigned emails to ${users.length} users`);
});

runMigration('add_malus_type', () => {
  db.exec("ALTER TABLE malus ADD COLUMN type_malus TEXT NOT NULL DEFAULT 'montant'");
});

runMigration('add_malus_periode_fin', () => {
  db.exec("ALTER TABLE malus ADD COLUMN periode_fin DATE");
  // Copy periode to periode_fin for existing rows so the range query works
  db.exec("UPDATE malus SET periode_fin = periode WHERE periode_fin IS NULL");
});

// --- Beta: Additional performance indexes ---
runMigration('add_beta_performance_indexes', () => {
  db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_created ON ventes(created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_paies_statut ON paies(statut)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_paies_chatteur_periode ON paies(chatteur_id, periode_debut, periode_fin)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_date_only ON shifts(date)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_primes_chatteur_periode ON primes_manuelles(chatteur_id, periode_debut, periode_fin)");
});

// --- Modele colors (pastel feminine palette) ---
runMigration('add_modeles_couleurs', () => {
  db.exec("ALTER TABLE modeles ADD COLUMN couleur_fond TEXT NOT NULL DEFAULT '#f5b731'");
  db.exec("ALTER TABLE modeles ADD COLUMN couleur_texte TEXT NOT NULL DEFAULT '#ffffff'");
});

runMigration('seed_modele_colors', () => {
  // Assign distinct pastel colors to existing modeles
  const modeles = db.prepare('SELECT id, pseudo FROM modeles ORDER BY id').all();
  const pastelColors = [
    '#F2A7C3', // rose doux
    '#C4A6E8', // lavande
    '#A7D8F0', // bleu ciel
    '#F7C59F', // pêche
    '#B5E6C5', // menthe
  ];
  modeles.forEach((m, i) => {
    db.prepare('UPDATE modeles SET couleur_fond = ?, couleur_texte = ? WHERE id = ?')
      .run(pastelColors[i % pastelColors.length], '#ffffff', m.id);
  });
});

// Fix modele text colors — white on pastel is unreadable
runMigration('fix_modele_text_colors', () => {
  const colorMap = {
    '#F2A7C3': '#8B1A4A', // rose → texte bordeaux
    '#C4A6E8': '#4A1D96', // lavande → texte violet foncé
    '#A7D8F0': '#0C4A6E', // bleu ciel → texte bleu foncé
    '#F7C59F': '#7C2D12', // pêche → texte marron
    '#B5E6C5': '#14532D', // menthe → texte vert foncé
  };
  for (const [bg, text] of Object.entries(colorMap)) {
    db.prepare('UPDATE modeles SET couleur_texte = ? WHERE couleur_fond = ?').run(text, bg);
  }
});

// --- Add SACHA (owner) as manager for payroll calculation ---
runMigration('add_sacha_manager', () => {
  // SACHA is the admin (user_id=1) and gets 5% of total_net_ht_equipe
  const adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminUser) return;

  // Check if a chatteur entry already exists for this user
  const existing = db.prepare('SELECT id FROM chatteurs WHERE user_id = ?').get(adminUser.id);
  if (existing) return;

  db.prepare(`
    INSERT INTO chatteurs (user_id, prenom, role, taux_commission, taux_net_equipe, actif, pays)
    VALUES (?, 'SACHA', 'manager', 0.0, 0.05, 1, 'France')
  `).run(adminUser.id);
});

runMigration('add_directeur_role', () => {
  // placeholder — actual fix runs before runMigration calls (see above)
});

// --- Quick win: Additional composite indexes for common queries ---
runMigration('add_composite_indexes_v2', () => {
  // Ventes: filtrage par chatteur + montant (doublons Telegram, dashboard)
  db.exec("CREATE INDEX IF NOT EXISTS idx_ventes_chatteur_montant ON ventes(chatteur_id, montant_brut)");
  // Shifts: requête planning par chatteur + date
  db.exec("CREATE INDEX IF NOT EXISTS idx_shifts_chatteur_date ON shifts(chatteur_id, date)");
  // Malus: lookup par période range
  db.exec("CREATE INDEX IF NOT EXISTS idx_malus_periode_range ON malus(periode, periode_fin)");
  // Factures: lookup rapide par chatteur + période
  db.exec("CREATE INDEX IF NOT EXISTS idx_factures_chatteur_periode ON factures(chatteur_id, periode_debut, periode_fin)");
  // Activity logs: filtrage par user + type
  db.exec("CREATE INDEX IF NOT EXISTS idx_activity_user_action ON activity_logs(user_id, action)");
  // Objectifs: chatteur + période (suggestions endpoint)
  db.exec("CREATE INDEX IF NOT EXISTS idx_objectifs_chatteur_actif ON objectifs(chatteur_id, actif)");
});

runMigration('create_objectifs_personnels', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS objectifs_personnels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatteur_id INTEGER NOT NULL,
      montant_cible REAL NOT NULL,
      periode_debut TEXT NOT NULL,
      periode_fin TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chatteur_id) REFERENCES chatteurs(id),
      UNIQUE(chatteur_id, periode_debut, periode_fin)
    )
  `);
});

runMigration('create_invitation_tokens', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitation_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

runMigration('create_email_verifications', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      new_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

runMigration('add_shifts_notification_sent', () => {
  db.exec("ALTER TABLE shifts ADD COLUMN notification_sent INTEGER DEFAULT 0");
});

runMigration('add_ventes_statut', () => {
  db.exec("ALTER TABLE ventes ADD COLUMN statut TEXT NOT NULL DEFAULT 'validée'");
  db.exec("CREATE INDEX idx_ventes_statut ON ventes(statut)");
});

runMigration('add_ventes_shift_id', () => {
  db.exec("ALTER TABLE ventes ADD COLUMN shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL");
  db.exec("CREATE INDEX idx_ventes_shift ON ventes(shift_id)");
});

runMigration('add_chatteurs_telegram_user_id', () => {
  db.exec("ALTER TABLE chatteurs ADD COLUMN telegram_user_id INTEGER");
  db.exec("CREATE UNIQUE INDEX idx_chatteurs_telegram_uid ON chatteurs(telegram_user_id) WHERE telegram_user_id IS NOT NULL");
});

runMigration('add_shift_reports', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      chatteur_id INTEGER NOT NULL REFERENCES chatteurs(id),
      raison TEXT NOT NULL,
      commentaire TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shift_id)
    )
  `);
});

runMigration('add_login_lockout_table', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_lockouts (
      username TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT NULL
    )
  `);
});

console.log(`DB initialized in ${Date.now() - dbStartTime}ms`);

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
