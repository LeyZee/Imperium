/**
 * Seed shifts for OnlyFans + Reveal models (1-15 March 2026)
 * From the Google Sheets planning screenshots
 */
require('dotenv').config();
const db = require('./database');

function getChatteurId(prenom) {
  const row = db.prepare('SELECT id FROM chatteurs WHERE prenom = ?').get(prenom);
  return row?.id;
}
function getModeleId(pseudo) {
  const row = db.prepare('SELECT id FROM modeles WHERE pseudo = ?').get(pseudo);
  return row?.id;
}

const OF_ID = db.prepare("SELECT id FROM plateformes WHERE nom = 'OnlyFans'").get()?.id;
const REV_ID = db.prepare("SELECT id FROM plateformes WHERE nom = 'Reveal'").get()?.id;
console.log('OnlyFans:', OF_ID, '| Reveal:', REV_ID);

const C = {
  JAMES: getChatteurId('JAMES'),
  HERMINE: getChatteurId('HERMINE'),
  CELESTIN: getChatteurId('CELESTIN'),
  NANCIA: getChatteurId('NANCIA'),
  CARINE: getChatteurId('CARINE'),
  'MARIE-ANGE': getChatteurId('MARIE-ANGE'),
  'BIG-C': getChatteurId('BIG-C'),
  PIERRE: getChatteurId('PIERRE'),
  CHARBEL: getChatteurId('CHARBEL'),
  AXEL: getChatteurId('AXEL'),
};

// Dates: March 1-15, 2026
// dow: 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
const dates = [];
for (let d = 1; d <= 15; d++) {
  const date = new Date(2026, 2, d);
  dates.push({ str: `2026-03-${String(d).padStart(2, '0')}`, dow: date.getDay() });
}

let count = 0;

function add(chatteur, modele, plateforme, date, creneau, tz) {
  const cId = C[chatteur];
  if (!cId) return;
  try {
    const existing = db.prepare(
      'SELECT id FROM shifts WHERE chatteur_id = ? AND modele_id = ? AND plateforme_id = ? AND date = ? AND creneau = ?'
    ).get(cId, modele, plateforme, date, creneau);
    if (existing) return;
    db.prepare('INSERT INTO shifts (chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cId, modele, plateforme, date, creneau, tz);
    count++;
  } catch (e) { console.log(`ERR: ${e.message}`); }
}

const TZ_BENIN = 'Africa/Porto-Novo';

// ══════════════════════════════════════════════════
// ONLYFANS SHIFTS
// ══════════════════════════════════════════════════
// Same pattern for MESSALINA, ANGEL, EMMY:
//   C1 (08h-14h): JAMES (all days except Wed)
//   C2 (14h-20h): HERMINE (all), + CELESTIN (Sam+Dim)
//   C3 (20h-02h): HERMINE (all), + CELESTIN (Sam+Dim)
//   C4: nobody
//
// SOUKI different:
//   C1: JAMES (all except Wed)
//   C2: CELESTIN (all), CELESTIN (Sam+Dim already covered)
//   C3: HERMINE (all), + CELESTIN (Sam+Dim)
//   C4: nobody

console.log('\n=== OnlyFans shifts ===');
for (const modeleName of ['MESSALINA', 'ANGEL', 'EMMY', 'SOUKI']) {
  const mId = getModeleId(modeleName);
  if (!mId) { console.log(`Modele not found: ${modeleName}`); continue; }

  for (const { str, dow } of dates) {
    // C1: JAMES except Wednesday
    if (dow !== 3) add('JAMES', mId, OF_ID, str, 1, TZ_BENIN);

    // C2
    if (modeleName === 'SOUKI') {
      add('CELESTIN', mId, OF_ID, str, 2, TZ_BENIN);
    } else {
      add('HERMINE', mId, OF_ID, str, 2, TZ_BENIN);
      if (dow === 0 || dow === 6) add('CELESTIN', mId, OF_ID, str, 2, TZ_BENIN);
    }

    // C3: HERMINE all + CELESTIN weekends
    add('HERMINE', mId, OF_ID, str, 3, TZ_BENIN);
    if (dow === 0 || dow === 6) add('CELESTIN', mId, OF_ID, str, 3, TZ_BENIN);
  }
  console.log(`  ${modeleName}: done`);
}

// ══════════════════════════════════════════════════
// REVEAL SHIFTS
// ══════════════════════════════════════════════════
// MESSALINA (Reveal):
//   C1 (08h-14h): NANCIA (Lun-Mar, Jeu-Ven-Sam-Dim), CARINE (Mer)
//   C2 (14h-20h): CARINE (all)
//   C3 (20h-02h): CELESTIN (Lun-Sam), PIERRE (Dim)
//   C4: nobody

console.log('\n=== Reveal shifts ===');
{
  const mId = getModeleId('MESSALINA');
  for (const { str, dow } of dates) {
    // C1: NANCIA (Lun, Mar, Jeu, Ven, Sam, Dim), CARINE (Mer)
    if (dow === 3) {
      add('CARINE', mId, REV_ID, str, 1, TZ_BENIN);
    } else {
      add('NANCIA', mId, REV_ID, str, 1, TZ_BENIN);
    }
    // C2: CARINE all
    add('CARINE', mId, REV_ID, str, 2, TZ_BENIN);
    // C3: CELESTIN (Lun-Sam), PIERRE (Dim)
    if (dow === 0) {
      add('PIERRE', mId, REV_ID, str, 3, TZ_BENIN);
    } else {
      add('CELESTIN', mId, REV_ID, str, 3, TZ_BENIN);
    }
  }
  console.log('  MESSALINA: done');
}

// LILY (Reveal):
//   C1 (08h-14h): MARIE-ANGE (Lun-Jeu), ? (Ven), BIG-C (Sam), ? (Dim)
//   C2 (14h-20h): BIG-C (Lun), MARIE-ANGE (Mar), ? (Mer), MARIE-ANGE (Jeu), BIG-C (Ven-Sam-Dim)
//     Wait, let me re-read the screenshot more carefully:
//   C1: MARIE-ANGE (Lun, Mar, Mer, Jeu), ? (Ven), BIG-C (Sam), ? (Dim)
//   C2: BIG-C (Lun), MARIE-ANGE (Mar), BIG-C (Mer), MARIE-ANGE (Jeu), BIG-C (Ven, Sam, Dim)
//   C3: PIERRE (Lun), CHARBEL (Mar, Mer), PIERRE (Jeu), CHARBEL (Ven, Sam), AXEL (Dim)
{
  const mId = getModeleId('LILY');
  for (const { str, dow } of dates) {
    // C1: MARIE-ANGE Mon-Thu, BIG-C Sat
    if (dow >= 1 && dow <= 4) add('MARIE-ANGE', mId, REV_ID, str, 1, TZ_BENIN);
    if (dow === 6) add('BIG-C', mId, REV_ID, str, 1, TZ_BENIN);

    // C2: alternating pattern
    if (dow === 1) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);       // Lun
    if (dow === 2) add('MARIE-ANGE', mId, REV_ID, str, 2, TZ_BENIN);  // Mar
    if (dow === 3) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);       // Mer
    if (dow === 4) add('MARIE-ANGE', mId, REV_ID, str, 2, TZ_BENIN);  // Jeu
    if (dow === 5) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);       // Ven
    if (dow === 6) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);       // Sam
    if (dow === 0) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);       // Dim

    // C3: PIERRE/CHARBEL/AXEL
    if (dow === 1) add('PIERRE', mId, REV_ID, str, 3, TZ_BENIN);      // Lun
    if (dow === 2) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);     // Mar
    if (dow === 3) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);     // Mer
    if (dow === 4) add('PIERRE', mId, REV_ID, str, 3, TZ_BENIN);      // Jeu
    if (dow === 5) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);     // Ven
    if (dow === 6) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);     // Sam
    if (dow === 0) add('AXEL', mId, REV_ID, str, 3, TZ_BENIN);        // Dim
  }
  console.log('  LILY: done');
}

// ANGEL (Reveal):
//   C1: MARIE-ANGE (Lun-Jeu), ? (Ven), BIG-C (Sam), ? (Dim)
//   C2: BIG-C (Lun), MARIE-ANGE (Mar), BIG-C (Mer), MARIE-ANGE (Jeu), BIG-C (Ven, Sam, Dim)
//   C3: PIERRE (Lun), CHARBEL (Mar), CHARBEL (Mer), PIERRE (Jeu), AXEL (Ven, Sam, Dim)
{
  const mId = getModeleId('ANGEL');
  for (const { str, dow } of dates) {
    // C1: MARIE-ANGE Mon-Thu, BIG-C Sat
    if (dow >= 1 && dow <= 4) add('MARIE-ANGE', mId, REV_ID, str, 1, TZ_BENIN);
    if (dow === 6) add('BIG-C', mId, REV_ID, str, 1, TZ_BENIN);

    // C2
    if (dow === 1) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 2) add('MARIE-ANGE', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 3) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 4) add('MARIE-ANGE', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 5) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 6) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);
    if (dow === 0) add('BIG-C', mId, REV_ID, str, 2, TZ_BENIN);

    // C3: PIERRE (Lun), CHARBEL (Mar, Mer), PIERRE (Jeu), AXEL (Ven, Sam, Dim)
    if (dow === 1) add('PIERRE', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 2) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 3) add('CHARBEL', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 4) add('PIERRE', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 5) add('AXEL', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 6) add('AXEL', mId, REV_ID, str, 3, TZ_BENIN);
    if (dow === 0) add('AXEL', mId, REV_ID, str, 3, TZ_BENIN);
  }
  console.log('  ANGEL: done');
}

console.log(`\nTotal: ${count} shifts created`);
console.log('Done!');
