/**
 * One-time migration: assign plateforme_id to existing shifts
 */
const BASE = 'http://localhost:3001';

async function main() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const data = await (await fetch(`${BASE}/api/shifts/semaine?date=2026-03-09`, { headers: h })).json();
  console.log(`${data.shifts.length} shifts total`);
  console.log(`With plateforme_id: ${data.shifts.filter(s => s.plateforme_id).length}`);
  console.log(`Without plateforme_id: ${data.shifts.filter(s => s.plateforme_id === null || s.plateforme_id === undefined).length}`);

  // OnlyFans chatteurs: JAMES(9), HERMINE(5), CELESTIN(7)
  const OF_CHATTEURS = [9, 5, 7];

  let updated = 0;
  for (const s of data.shifts) {
    if (s.plateforme_id) continue;

    let pid;
    if (s.modele_id === 3 || s.modele_id === 4) {
      pid = 1; // EMMY, SOUKI → OnlyFans only
    } else if (s.modele_id === 5) {
      pid = 2; // LILY → Reveal only
    } else {
      // MESSALINA or ANGEL → determine by chatteur
      pid = OF_CHATTEURS.includes(s.chatteur_id) ? 1 : 2;
    }

    // Delete old, create new with plateforme_id
    await fetch(`${BASE}/api/shifts/${s.id}`, { method: 'DELETE', headers: h });
    const res = await fetch(`${BASE}/api/shifts`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ chatteur_id: s.chatteur_id, modele_id: s.modele_id, plateforme_id: pid, date: s.date, creneau: s.creneau })
    });
    if (res.ok) updated++;
    else {
      const e = await res.json();
      console.log(`ERR shift ${s.id}: ${e.error}`);
    }
  }

  console.log(`\nMigrated ${updated} shifts`);

  // Verify
  const data2 = await (await fetch(`${BASE}/api/shifts/semaine?date=2026-03-09`, { headers: h })).json();
  const of = data2.shifts.filter(s => s.plateforme_id === 1).length;
  const rev = data2.shifts.filter(s => s.plateforme_id === 2).length;
  const none = data2.shifts.filter(s => s.plateforme_id === null || s.plateforme_id === undefined).length;
  console.log(`Result: OnlyFans=${of}, Reveal=${rev}, null=${none}, total=${data2.shifts.length}`);
}

main().catch(console.error);
