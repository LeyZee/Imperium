/**
 * Seed script: Import chatteurs, modèles, and shifts from Google Sheets data
 * Run: node seed.js
 */

const BASE = 'http://localhost:3001';

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@impera-agency.com', password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!' })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${err.error || res.statusText}`);
  }
  // Extract token from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/token=([^;]+)/);
  if (match) return match[1];
  // Fallback: try JSON body
  const data = await res.json().catch(() => ({}));
  return data.token;
}

function api(token) {
  const headers = { 'Content-Type': 'application/json', 'Cookie': `token=${token}` };
  return {
    get: async (path) => { const r = await fetch(`${BASE}${path}`, { headers }); return r.json(); },
    post: async (path, body) => {
      const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || r.statusText); }
      return r.json();
    }
  };
}

async function main() {
  const token = await login();
  const client = api(token);
  console.log('Logged in as admin');

  // ===== 1. Create or lookup Chatteurs =====
  // Couleurs = indices dans CHATTEUR_COLORS (constants/colors.js)
  // Correspondance Google Sheets :
  //   AXEL=8 (Orange foncé), BIG-C=19 (Bleu), CARINE=12 (Vert clair),
  //   CHARBEL=1 (Rouge), HERMINE=17 (Teal foncé), PIERRE=22 (Violet),
  //   CELESTIN=16 (Cyan), MARIE-ANGE=4 (Magenta), JAMES=10 (Jaune/Or),
  //   NANCIA=7 (Orange), GILLES=18 (Bleu clair)
  const chatteursData = [
    { prenom: 'AXEL', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 8, username: 'axel', password: 'imperium2026' },
    { prenom: 'BIG-C', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 19, username: 'bigc', password: 'imperium2026' },
    { prenom: 'CARINE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 12, username: 'carine', password: 'imperium2026' },
    { prenom: 'CHARBEL', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 1, username: 'charbel', password: 'imperium2026' },
    { prenom: 'HERMINE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 17, username: 'hermine', password: 'imperium2026' },
    { prenom: 'PIERRE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 22, username: 'pierre', password: 'imperium2026' },
    { prenom: 'CELESTIN', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 16, username: 'celestin', password: 'imperium2026' },
    { prenom: 'MARIE-ANGE', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 4, username: 'marieange', password: 'imperium2026' },
    { prenom: 'JAMES', role: 'chatteur', taux_commission: 0.15, pays: 'Bénin', couleur: 10, username: 'james', password: 'imperium2026' },
    { prenom: 'NANCIA', role: 'chatteur', taux_commission: 0.15, pays: 'Madagascar', couleur: 7, username: 'nancia', password: 'imperium2026' },
    { prenom: 'GILLES', role: 'manager', taux_commission: 0.10, taux_net_equipe: 0.05, pays: 'Bénin', couleur: 18, username: 'gilles', password: 'imperium2026' },
  ];

  // Fetch existing chatteurs first
  const existingChatteurs = await client.get('/api/chatteurs');
  const chatteurMap = {}; // prenom -> id
  for (const c of existingChatteurs) {
    chatteurMap[c.prenom] = c.id;
  }
  console.log(`Found ${existingChatteurs.length} existing chatteurs`);

  // Create missing ones
  for (const c of chatteursData) {
    if (chatteurMap[c.prenom]) {
      console.log(`  Chatteur exists: ${c.prenom} (id=${chatteurMap[c.prenom]})`);
      continue;
    }
    try {
      const result = await client.post('/api/chatteurs', c);
      chatteurMap[c.prenom] = result.id;
      console.log(`  Chatteur created: ${c.prenom} (id=${result.id})`);
    } catch (e) {
      console.log(`  Chatteur FAIL: ${c.prenom} — ${e.message}`);
    }
  }

  // ===== 2. Create or lookup Modèles =====
  const modelesData = [
    { pseudo: 'MESSALINA', part_percent: 0.35 },
    { pseudo: 'ANGEL', part_percent: 0.35 },
    { pseudo: 'EMMY', part_percent: 0.25 },
    { pseudo: 'SOUKI', part_percent: 0.35 },
    { pseudo: 'LILY', part_percent: 0.35 },
  ];

  const existingModeles = await client.get('/api/modeles');
  const modeleMap = {}; // pseudo -> id
  for (const m of existingModeles) {
    modeleMap[m.pseudo] = m.id;
  }
  console.log(`Found ${existingModeles.length} existing modèles`);

  // Create missing ones
  for (const m of modelesData) {
    if (modeleMap[m.pseudo]) {
      console.log(`  Modèle exists: ${m.pseudo} (id=${modeleMap[m.pseudo]})`);
      continue;
    }
    try {
      const result = await client.post('/api/modeles', m);
      modeleMap[m.pseudo] = result.id;
      console.log(`  Modèle created: ${m.pseudo} (id=${result.id})`);
    } catch (e) {
      console.log(`  Modèle FAIL: ${m.pseudo} — ${e.message}`);
    }
  }

  console.log('\nChatteur map:', chatteurMap);
  console.log('Modèle map:', modeleMap);

  // ===== 2b. Fetch Plateformes & create modeles_plateformes =====
  const plateformes = await client.get('/api/plateformes');
  const pfMap = {}; // nom -> id
  for (const p of plateformes) pfMap[p.nom] = p.id;
  console.log('Plateforme map:', pfMap);

  // Associations modèle ↔ plateforme
  const modelePlatformes = {
    'MESSALINA': ['OnlyFans', 'Reveal'],
    'ANGEL': ['OnlyFans', 'Reveal'],
    'EMMY': ['OnlyFans'],
    'SOUKI': ['OnlyFans'],
    'LILY': ['Reveal'],
  };
  for (const [pseudo, pfNames] of Object.entries(modelePlatformes)) {
    const mid = modeleMap[pseudo];
    if (!mid) continue;
    for (const pfName of pfNames) {
      const pid = pfMap[pfName];
      if (!pid) continue;
      try {
        await client.post(`/api/modeles/${mid}/plateformes`, { plateforme_id: pid });
        console.log(`  Link: ${pseudo} ↔ ${pfName}`);
      } catch (e) {
        // already exists
      }
    }
  }

  // ===== 3. Create Shifts for current week (March 9-15, 2026) =====
  // Creneaux: 1=08h-14h, 2=14h-20h, 3=20h-02h, 4=02h-08h
  const dates = {
    lun: '2026-03-09', mar: '2026-03-10', mer: '2026-03-11',
    jeu: '2026-03-12', ven: '2026-03-13', sam: '2026-03-14', dim: '2026-03-15'
  };

  const shifts = [];

  // --- OnlyFans shifts ---
  const OF = 'OnlyFans', REV = 'Reveal';

  // MESSALINA, ANGEL, EMMY share same schedule (OnlyFans)
  const ofModels = ['MESSALINA', 'ANGEL', 'EMMY'];
  for (const model of ofModels) {
    for (const day of ['lun', 'mar', 'jeu', 'ven', 'sam']) {
      shifts.push({ date: dates[day], creneau: 1, chatteur: 'JAMES', modele: model, pf: OF });
      shifts.push({ date: dates[day], creneau: 2, chatteur: 'HERMINE', modele: model, pf: OF });
      shifts.push({ date: dates[day], creneau: 3, chatteur: 'HERMINE', modele: model, pf: OF });
    }
    // Wed: no C1
    shifts.push({ date: dates.mer, creneau: 2, chatteur: 'HERMINE', modele: model, pf: OF });
    shifts.push({ date: dates.mer, creneau: 3, chatteur: 'HERMINE', modele: model, pf: OF });
    // Sun
    shifts.push({ date: dates.dim, creneau: 1, chatteur: 'JAMES', modele: model, pf: OF });
    shifts.push({ date: dates.dim, creneau: 2, chatteur: 'CELESTIN', modele: model, pf: OF });
    shifts.push({ date: dates.dim, creneau: 3, chatteur: 'CELESTIN', modele: model, pf: OF });
  }

  // SOUKI (OF): C2=CELESTIN instead of HERMINE
  for (const day of ['lun', 'mar', 'jeu', 'ven', 'sam']) {
    shifts.push({ date: dates[day], creneau: 1, chatteur: 'JAMES', modele: 'SOUKI', pf: OF });
    shifts.push({ date: dates[day], creneau: 2, chatteur: 'CELESTIN', modele: 'SOUKI', pf: OF });
    shifts.push({ date: dates[day], creneau: 3, chatteur: 'HERMINE', modele: 'SOUKI', pf: OF });
  }
  shifts.push({ date: dates.mer, creneau: 2, chatteur: 'CELESTIN', modele: 'SOUKI', pf: OF });
  shifts.push({ date: dates.mer, creneau: 3, chatteur: 'HERMINE', modele: 'SOUKI', pf: OF });
  shifts.push({ date: dates.dim, creneau: 1, chatteur: 'JAMES', modele: 'SOUKI', pf: OF });
  shifts.push({ date: dates.dim, creneau: 2, chatteur: 'CELESTIN', modele: 'SOUKI', pf: OF });
  shifts.push({ date: dates.dim, creneau: 3, chatteur: 'CELESTIN', modele: 'SOUKI', pf: OF });

  // --- Reveal shifts ---
  // MESSALINA (Reveal)
  for (const day of ['lun', 'mar', 'jeu', 'ven', 'sam']) {
    shifts.push({ date: dates[day], creneau: 1, chatteur: 'NANCIA', modele: 'MESSALINA', pf: REV });
    shifts.push({ date: dates[day], creneau: 2, chatteur: 'CARINE', modele: 'MESSALINA', pf: REV });
    shifts.push({ date: dates[day], creneau: 3, chatteur: 'CELESTIN', modele: 'MESSALINA', pf: REV });
  }
  shifts.push({ date: dates.mer, creneau: 1, chatteur: 'CARINE', modele: 'MESSALINA', pf: REV });
  shifts.push({ date: dates.mer, creneau: 2, chatteur: 'CARINE', modele: 'MESSALINA', pf: REV });
  shifts.push({ date: dates.mer, creneau: 3, chatteur: 'CELESTIN', modele: 'MESSALINA', pf: REV });
  shifts.push({ date: dates.dim, creneau: 1, chatteur: 'NANCIA', modele: 'MESSALINA', pf: REV });
  shifts.push({ date: dates.dim, creneau: 2, chatteur: 'CARINE', modele: 'MESSALINA', pf: REV });
  shifts.push({ date: dates.dim, creneau: 3, chatteur: 'PIERRE', modele: 'MESSALINA', pf: REV });

  // LILY (Reveal) — from Google Sheets
  // Lun: C1=MARIE-ANGE, C2=BIG-C, C3=PIERRE
  shifts.push({ date: dates.lun, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.lun, creneau: 2, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.lun, creneau: 3, chatteur: 'PIERRE', modele: 'LILY', pf: REV });
  // Mar: C1=MARIE-ANGE, C2=MARIE-ANGE, C3=CHARBEL
  shifts.push({ date: dates.mar, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.mar, creneau: 2, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.mar, creneau: 3, chatteur: 'CHARBEL', modele: 'LILY', pf: REV });
  // Mer: C1=MARIE-ANGE, C2=BIG-C, C3=CHARBEL
  shifts.push({ date: dates.mer, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.mer, creneau: 2, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.mer, creneau: 3, chatteur: 'CHARBEL', modele: 'LILY', pf: REV });
  // Jeu: C1=MARIE-ANGE, C2=MARIE-ANGE, C3=PIERRE
  shifts.push({ date: dates.jeu, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.jeu, creneau: 2, chatteur: 'MARIE-ANGE', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.jeu, creneau: 3, chatteur: 'PIERRE', modele: 'LILY', pf: REV });
  // Ven: C1=?, C2=BIG-C, C3=CHARBEL
  shifts.push({ date: dates.ven, creneau: 2, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.ven, creneau: 3, chatteur: 'CHARBEL', modele: 'LILY', pf: REV });
  // Sam: C1=BIG-C, C2=BIG-C, C3=CHARBEL
  shifts.push({ date: dates.sam, creneau: 1, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.sam, creneau: 2, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.sam, creneau: 3, chatteur: 'CHARBEL', modele: 'LILY', pf: REV });
  // Dim: C1=?, C2=BIG-C, C3=AXEL
  shifts.push({ date: dates.dim, creneau: 2, chatteur: 'BIG-C', modele: 'LILY', pf: REV });
  shifts.push({ date: dates.dim, creneau: 3, chatteur: 'AXEL', modele: 'LILY', pf: REV });

  // ANGEL (Reveal) — from Google Sheets
  // Lun: C1=MARIE-ANGE, C2=BIG-C, C3=PIERRE
  shifts.push({ date: dates.lun, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.lun, creneau: 2, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.lun, creneau: 3, chatteur: 'PIERRE', modele: 'ANGEL', pf: REV });
  // Mar: C1=MARIE-ANGE, C2=MARIE-ANGE, C3=CHARBEL
  shifts.push({ date: dates.mar, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.mar, creneau: 2, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.mar, creneau: 3, chatteur: 'CHARBEL', modele: 'ANGEL', pf: REV });
  // Mer: C1=MARIE-ANGE, C2=BIG-C, C3=CHARBEL
  shifts.push({ date: dates.mer, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.mer, creneau: 2, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.mer, creneau: 3, chatteur: 'CHARBEL', modele: 'ANGEL', pf: REV });
  // Jeu: C1=MARIE-ANGE, C2=MARIE-ANGE, C3=PIERRE
  shifts.push({ date: dates.jeu, creneau: 1, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.jeu, creneau: 2, chatteur: 'MARIE-ANGE', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.jeu, creneau: 3, chatteur: 'PIERRE', modele: 'ANGEL', pf: REV });
  // Ven: C1=?, C2=BIG-C, C3=AXEL
  shifts.push({ date: dates.ven, creneau: 2, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.ven, creneau: 3, chatteur: 'AXEL', modele: 'ANGEL', pf: REV });
  // Sam: C1=BIG-C, C2=BIG-C, C3=AXEL
  shifts.push({ date: dates.sam, creneau: 1, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.sam, creneau: 2, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.sam, creneau: 3, chatteur: 'AXEL', modele: 'ANGEL', pf: REV });
  // Dim: C1=?, C2=BIG-C, C3=AXEL
  shifts.push({ date: dates.dim, creneau: 2, chatteur: 'BIG-C', modele: 'ANGEL', pf: REV });
  shifts.push({ date: dates.dim, creneau: 3, chatteur: 'AXEL', modele: 'ANGEL', pf: REV });

  // Insert all shifts
  console.log(`\nInserting ${shifts.length} shifts...`);
  let ok = 0, skip = 0;
  for (const s of shifts) {
    const chatteur_id = chatteurMap[s.chatteur];
    const modele_id = modeleMap[s.modele];
    if (!chatteur_id) { console.log(`  WARN: unknown chatteur ${s.chatteur}`); skip++; continue; }
    if (!modele_id) { console.log(`  WARN: unknown modele ${s.modele}`); skip++; continue; }
    const plateforme_id = s.pf ? pfMap[s.pf] : null;
    try {
      await client.post('/api/shifts', { chatteur_id, modele_id, plateforme_id, date: s.date, creneau: s.creneau });
      ok++;
    } catch (e) {
      skip++;
    }
  }

  console.log(`\nDone! ${ok} shifts created, ${skip} skipped (already exist).`);
}

main().catch(console.error);
