/**
 * Direct DB seed — no HTTP, inserts data directly via database.js
 * Run: node seed-direct.js
 */
require('dotenv').config();
const db = require('./database');
const bcrypt = require('bcryptjs');

// ===== 1. Chatteurs =====
const chatteursData = [
  { prenom: 'AXEL', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 8, username: 'axel', password: 'Demo2026!' },
  { prenom: 'BIG-C', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 19, username: 'bigc', password: 'Demo2026!' },
  { prenom: 'CARINE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 12, username: 'carine', password: 'Demo2026!' },
  { prenom: 'CHARBEL', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 1, username: 'charbel', password: 'Demo2026!' },
  { prenom: 'HERMINE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 17, username: 'hermine', password: 'Demo2026!' },
  { prenom: 'PIERRE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 22, username: 'pierre', password: 'Demo2026!' },
  { prenom: 'CELESTIN', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 16, username: 'celestin', password: 'Demo2026!' },
  { prenom: 'MARIE-ANGE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 4, username: 'marieange', password: 'Demo2026!' },
  { prenom: 'JAMES', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 10, username: 'james', password: 'Demo2026!' },
  { prenom: 'NANCIA', role: 'chatteur', taux_commission: 0.15, pays: 'Madagascar', couleur: 7, username: 'nancia', password: 'Demo2026!' },
  { prenom: 'GILLES', role: 'manager', taux_commission: 0.10, taux_net_equipe: 0.05, pays: 'Bénin', couleur: 18, username: 'gilles', password: 'Demo2026!' },
];

// ===== 2. Modeles =====
const modelesData = [
  { pseudo: 'MESSALINA' },
  { pseudo: 'ANGEL' },
  { pseudo: 'EMMY' },
  { pseudo: 'SOUKI' },
  { pseudo: 'LILY' },
];

// ===== 3. Ventes (period 2026-03-01 to 2026-03-15) =====
// From the Google Sheets screenshot
const ventesData = [
  // AXEL - Reveal - 196€ TTC
  { chatteur: 'AXEL', plateforme: 'Reveal', montant_brut: 196.00 },
  // BIG-C - Reveal - 30€ TTC
  { chatteur: 'BIG-C', plateforme: 'Reveal', montant_brut: 30.00 },
  // CARINE - Reveal - 1462€ TTC
  { chatteur: 'CARINE', plateforme: 'Reveal', montant_brut: 1462.00 },
  // CHARBEL - Reveal - 106€ TTC
  { chatteur: 'CHARBEL', plateforme: 'Reveal', montant_brut: 106.00 },
  // HERMINE - OnlyFans - 2045.85 USD
  { chatteur: 'HERMINE', plateforme: 'OnlyFans', montant_brut: 2045.85 },
  // PIERRE - Reveal - 0€
  // (no vente)
  // CELESTIN - OnlyFans - 391.64 USD
  { chatteur: 'CELESTIN', plateforme: 'OnlyFans', montant_brut: 391.64 },
  // CELESTIN - Reveal - 929.48€ TTC
  { chatteur: 'CELESTIN', plateforme: 'Reveal', montant_brut: 929.48 },
  // MARIE-ANGE - Reveal - 0€
  // (no vente)
  // JAMES - OnlyFans - 0 USD
  // (no vente)
  // NANCIA - Reveal - 463€ TTC
  { chatteur: 'NANCIA', plateforme: 'Reveal', montant_brut: 463.00 },
];

// ===== EXECUTION =====

console.log('=== Seed direct ===\n');

// 1. Create user accounts for chatteurs
const chatteurMap = {};
for (const c of chatteursData) {
  const email = c.username.replace('-', '') + '@impera-agency.com';
  const hash = bcrypt.hashSync(c.password, 10);
  const userRole = c.role === 'manager' ? 'manager' : 'chatteur';

  // Check if user already exists
  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    db.prepare('INSERT INTO users (username, email, password_hash, role, prenom) VALUES (?, ?, ?, ?, ?)').run(
      email, email, hash, userRole, c.prenom
    );
    user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    console.log(`  User created: ${email} (${userRole})`);
  }

  // Check if chatteur already exists
  let chatteur = db.prepare('SELECT id FROM chatteurs WHERE prenom = ?').get(c.prenom);
  if (!chatteur) {
    db.prepare(`INSERT INTO chatteurs (user_id, prenom, role, taux_commission, taux_net_equipe, pays, couleur, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`).run(
      user.id, c.prenom, c.role, c.taux_commission, c.taux_net_equipe || 0, c.pays, c.couleur
    );
    chatteur = db.prepare('SELECT id FROM chatteurs WHERE prenom = ?').get(c.prenom);
    console.log(`  Chatteur created: ${c.prenom} (id=${chatteur.id})`);
  } else {
    console.log(`  Chatteur exists: ${c.prenom} (id=${chatteur.id})`);
  }
  chatteurMap[c.prenom] = chatteur.id;
}

// 2. Ensure modeles exist
const modeleMap = {};
for (const m of modelesData) {
  let modele = db.prepare('SELECT id FROM modeles WHERE pseudo = ?').get(m.pseudo);
  if (!modele) {
    db.prepare('INSERT INTO modeles (pseudo, part_percent, actif) VALUES (?, 0.35, 1)').run(m.pseudo);
    modele = db.prepare('SELECT id FROM modeles WHERE pseudo = ?').get(m.pseudo);
    console.log(`  Modele created: ${m.pseudo} (id=${modele.id})`);
  }
  modeleMap[m.pseudo] = modele.id;
}

// 3. Ensure platforms exist and get IDs
const pfMap = {};
const pfs = db.prepare('SELECT id, nom FROM plateformes WHERE actif = 1').all();
for (const p of pfs) {
  pfMap[p.nom] = p.id;
  console.log(`  Platform: ${p.nom} (id=${p.id})`);
}

// 4. Modeles_plateformes mapping
const modPlat = {
  'MESSALINA': ['OnlyFans', 'Reveal'],
  'ANGEL': ['OnlyFans', 'Reveal'],
  'EMMY': ['OnlyFans'],
  'SOUKI': ['OnlyFans'],
  'LILY': ['Reveal'],
};
for (const [pseudo, plats] of Object.entries(modPlat)) {
  for (const pName of plats) {
    if (modeleMap[pseudo] && pfMap[pName]) {
      try {
        db.prepare('INSERT OR IGNORE INTO modeles_plateformes (modele_id, plateforme_id) VALUES (?, ?)').run(modeleMap[pseudo], pfMap[pName]);
      } catch {}
    }
  }
}

// 5. Insert ventes for period 2026-03-01 to 2026-03-15
const periodeDebut = '2026-03-01';
const periodeFin = '2026-03-15';

console.log(`\n--- Ventes (${periodeDebut} → ${periodeFin}) ---`);
for (const v of ventesData) {
  const chatteurId = chatteurMap[v.chatteur];
  const plateformeId = pfMap[v.plateforme];
  if (!chatteurId || !plateformeId) {
    console.log(`  SKIP: ${v.chatteur} / ${v.plateforme} — not found`);
    continue;
  }

  // Check for existing vente
  const existing = db.prepare(
    'SELECT id FROM ventes WHERE chatteur_id = ? AND plateforme_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).get(chatteurId, plateformeId, periodeDebut, periodeFin);

  if (existing) {
    console.log(`  EXISTS: ${v.chatteur} / ${v.plateforme} — ${v.montant_brut}`);
    continue;
  }

  db.prepare(`INSERT INTO ventes (chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    chatteurId, plateformeId, v.montant_brut, periodeDebut, periodeFin, 'Seed from Google Sheets', 'admin'
  );
  console.log(`  ADDED: ${v.chatteur} / ${v.plateforme} — ${v.montant_brut} ${v.plateforme === 'OnlyFans' ? 'USD' : 'EUR'}`);
}

// 6. Create paliers for the period
console.log('\n--- Paliers primes ---');
const paliers = [
  { label: 'Bronze', seuil: 500, bonus: 10, emoji: '🥉' },
  { label: 'Argent', seuil: 1000, bonus: 25, emoji: '🥈' },
  { label: 'Or', seuil: 1500, bonus: 40, emoji: '🥇' },
  { label: 'Diamant', seuil: 2000, bonus: 50, emoji: '💎' },
];
for (const p of paliers) {
  const existing = db.prepare('SELECT id FROM paliers_primes WHERE periode_debut = ? AND periode_fin = ? AND label = ?')
    .get(periodeDebut, periodeFin, p.label);
  if (!existing) {
    db.prepare('INSERT INTO paliers_primes (periode_debut, periode_fin, seuil_net_ht, bonus, label, emoji, actif) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .run(periodeDebut, periodeFin, p.seuil, p.bonus, p.label, p.emoji);
    console.log(`  Created: ${p.emoji} ${p.label} (seuil=${p.seuil}€, bonus=+${p.bonus}€)`);
  }
}

console.log('\n=== Seed complete! ===');
console.log(`\nLogin credentials:`);
console.log(`  Admin:   admin@impera-agency.com / Admin123!`);
console.log(`  Manager: gilles@impera-agency.com / Demo2026!`);
console.log(`  Chatteur: axel@impera-agency.com / Demo2026!`);
