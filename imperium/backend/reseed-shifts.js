/**
 * Reseed shifts: delete all shifts for the week and re-create from Google Sheets data
 * Run: node reseed-shifts.js
 */
const BASE = 'http://localhost:3001';

async function main() {
  // Login
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Get current shifts to delete them
  const data = await (await fetch(`${BASE}/api/shifts/semaine?date=2026-03-09`, { headers: h })).json();
  console.log(`Deleting ${data.shifts.length} existing shifts...`);
  for (const s of data.shifts) {
    await fetch(`${BASE}/api/shifts/${s.id}`, { method: 'DELETE', headers: h });
  }

  // Get chatteur and modele IDs
  const chatteurs = await (await fetch(`${BASE}/api/chatteurs`, { headers: h })).json();
  const modeles = await (await fetch(`${BASE}/api/modeles`, { headers: h })).json();
  const cMap = {}; for (const c of chatteurs) cMap[c.prenom] = c.id;
  const mMap = {}; for (const m of modeles) mMap[m.pseudo] = m.id;

  console.log('Chatteurs:', Object.keys(cMap).join(', '));
  console.log('Modeles:', Object.keys(mMap).join(', '));

  const dates = {
    L: '2026-03-09', M: '2026-03-10', Me: '2026-03-11',
    J: '2026-03-12', V: '2026-03-13', S: '2026-03-14', D: '2026-03-15'
  };

  const shifts = [];

  // === OnlyFans (plateforme_id=1) ===
  const OF = 1;

  // MESSALINA, ANGEL, EMMY: same schedule on OnlyFans
  for (const model of ['MESSALINA', 'ANGEL', 'EMMY']) {
    for (const day of ['L', 'M', 'J', 'V', 'S']) {
      shifts.push({ d: dates[day], c: 1, ch: 'JAMES', mod: model, p: OF });
      shifts.push({ d: dates[day], c: 2, ch: 'HERMINE', mod: model, p: OF });
      shifts.push({ d: dates[day], c: 3, ch: 'HERMINE', mod: model, p: OF });
    }
    // Wednesday: no C1, only C2+C3
    shifts.push({ d: dates.Me, c: 2, ch: 'HERMINE', mod: model, p: OF });
    shifts.push({ d: dates.Me, c: 3, ch: 'HERMINE', mod: model, p: OF });
    // Sunday
    shifts.push({ d: dates.D, c: 1, ch: 'JAMES', mod: model, p: OF });
    shifts.push({ d: dates.D, c: 2, ch: 'CELESTIN', mod: model, p: OF });
    shifts.push({ d: dates.D, c: 3, ch: 'CELESTIN', mod: model, p: OF });
  }

  // SOUKI: C2=CELESTIN instead of HERMINE
  for (const day of ['L', 'M', 'J', 'V', 'S']) {
    shifts.push({ d: dates[day], c: 1, ch: 'JAMES', mod: 'SOUKI', p: OF });
    shifts.push({ d: dates[day], c: 2, ch: 'CELESTIN', mod: 'SOUKI', p: OF });
    shifts.push({ d: dates[day], c: 3, ch: 'HERMINE', mod: 'SOUKI', p: OF });
  }
  shifts.push({ d: dates.Me, c: 2, ch: 'CELESTIN', mod: 'SOUKI', p: OF });
  shifts.push({ d: dates.Me, c: 3, ch: 'HERMINE', mod: 'SOUKI', p: OF });
  shifts.push({ d: dates.D, c: 1, ch: 'JAMES', mod: 'SOUKI', p: OF });
  shifts.push({ d: dates.D, c: 2, ch: 'CELESTIN', mod: 'SOUKI', p: OF });
  shifts.push({ d: dates.D, c: 3, ch: 'CELESTIN', mod: 'SOUKI', p: OF });

  // === Reveal (plateforme_id=2) ===
  const REV = 2;

  // MESSALINA Reveal
  for (const day of ['L', 'M', 'J', 'V', 'S']) {
    shifts.push({ d: dates[day], c: 1, ch: 'NANCIA', mod: 'MESSALINA', p: REV });
    shifts.push({ d: dates[day], c: 2, ch: 'CARINE', mod: 'MESSALINA', p: REV });
    shifts.push({ d: dates[day], c: 3, ch: 'CELESTIN', mod: 'MESSALINA', p: REV });
  }
  shifts.push({ d: dates.Me, c: 1, ch: 'CARINE', mod: 'MESSALINA', p: REV });
  shifts.push({ d: dates.Me, c: 2, ch: 'CARINE', mod: 'MESSALINA', p: REV });
  shifts.push({ d: dates.Me, c: 3, ch: 'CELESTIN', mod: 'MESSALINA', p: REV });
  shifts.push({ d: dates.D, c: 1, ch: 'NANCIA', mod: 'MESSALINA', p: REV });
  shifts.push({ d: dates.D, c: 2, ch: 'CARINE', mod: 'MESSALINA', p: REV });
  shifts.push({ d: dates.D, c: 3, ch: 'PIERRE', mod: 'MESSALINA', p: REV });

  // LILY Reveal (per-day from Google Sheets)
  // Monday
  shifts.push({ d: dates.L, c: 1, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.L, c: 2, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.L, c: 3, ch: 'PIERRE', mod: 'LILY', p: REV });
  // Tuesday
  shifts.push({ d: dates.M, c: 1, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.M, c: 2, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.M, c: 3, ch: 'CHARBEL', mod: 'LILY', p: REV });
  // Wednesday
  shifts.push({ d: dates.Me, c: 1, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.Me, c: 2, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.Me, c: 3, ch: 'CHARBEL', mod: 'LILY', p: REV });
  // Thursday
  shifts.push({ d: dates.J, c: 1, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.J, c: 2, ch: 'MARIE-ANGE', mod: 'LILY', p: REV });
  shifts.push({ d: dates.J, c: 3, ch: 'PIERRE', mod: 'LILY', p: REV });
  // Friday: C1 empty
  shifts.push({ d: dates.V, c: 2, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.V, c: 3, ch: 'CHARBEL', mod: 'LILY', p: REV });
  // Saturday
  shifts.push({ d: dates.S, c: 1, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.S, c: 2, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.S, c: 3, ch: 'CHARBEL', mod: 'LILY', p: REV });
  // Sunday: C1 empty
  shifts.push({ d: dates.D, c: 2, ch: 'BIG-C', mod: 'LILY', p: REV });
  shifts.push({ d: dates.D, c: 3, ch: 'AXEL', mod: 'LILY', p: REV });

  // ANGEL Reveal (per-day from Google Sheets)
  // Monday
  shifts.push({ d: dates.L, c: 1, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.L, c: 2, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.L, c: 3, ch: 'PIERRE', mod: 'ANGEL', p: REV });
  // Tuesday
  shifts.push({ d: dates.M, c: 1, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.M, c: 2, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.M, c: 3, ch: 'CHARBEL', mod: 'ANGEL', p: REV });
  // Wednesday
  shifts.push({ d: dates.Me, c: 1, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.Me, c: 2, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.Me, c: 3, ch: 'CHARBEL', mod: 'ANGEL', p: REV });
  // Thursday
  shifts.push({ d: dates.J, c: 1, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.J, c: 2, ch: 'MARIE-ANGE', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.J, c: 3, ch: 'PIERRE', mod: 'ANGEL', p: REV });
  // Friday: C1 empty
  shifts.push({ d: dates.V, c: 2, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.V, c: 3, ch: 'AXEL', mod: 'ANGEL', p: REV });
  // Saturday
  shifts.push({ d: dates.S, c: 1, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.S, c: 2, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.S, c: 3, ch: 'AXEL', mod: 'ANGEL', p: REV });
  // Sunday: C1 empty
  shifts.push({ d: dates.D, c: 2, ch: 'BIG-C', mod: 'ANGEL', p: REV });
  shifts.push({ d: dates.D, c: 3, ch: 'AXEL', mod: 'ANGEL', p: REV });

  // Insert all
  console.log(`\nInserting ${shifts.length} shifts...`);
  let ok = 0, err = 0;
  for (const s of shifts) {
    const chatteur_id = cMap[s.ch];
    const modele_id = mMap[s.mod];
    if (!chatteur_id || !modele_id) {
      console.log(`  SKIP: unknown ${s.ch}/${s.mod}`);
      err++;
      continue;
    }
    const res = await fetch(`${BASE}/api/shifts`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ chatteur_id, modele_id, plateforme_id: s.p, date: s.d, creneau: s.c })
    });
    if (res.ok) ok++;
    else {
      const e = await res.json();
      console.log(`  ERR ${s.mod} ${s.d} C${s.c}: ${e.error}`);
      err++;
    }
  }

  console.log(`\nDone! ${ok} created, ${err} errors.`);

  // Verify
  const v = await (await fetch(`${BASE}/api/shifts/semaine?date=2026-03-09`, { headers: h })).json();
  const ofCount = v.shifts.filter(s => s.plateforme_id === 1).length;
  const revCount = v.shifts.filter(s => s.plateforme_id === 2).length;
  console.log(`Verification: OnlyFans=${ofCount}, Reveal=${revCount}, total=${v.shifts.length}`);

  // Per-model breakdown
  const models = ['MESSALINA', 'ANGEL', 'EMMY', 'SOUKI', 'LILY'];
  for (const name of models) {
    const of = v.shifts.filter(s => s.modele_pseudo === name && s.plateforme_id === 1).length;
    const rev = v.shifts.filter(s => s.modele_pseudo === name && s.plateforme_id === 2).length;
    console.log(`  ${name}: OF=${of}, Reveal=${rev}`);
  }
}

main().catch(console.error);
