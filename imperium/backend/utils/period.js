/**
 * Calcule la période de paie pour une date donnée.
 * Période 1 : du 1er au 15 du mois (jours 1-14)
 * Période 2 : du 15 au 1er du mois suivant (jours 15-31)
 */
function getPeriode(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');

  if (day < 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }

  // 15 → 1er du mois suivant
  const next = new Date(y, d.getMonth() + 1, 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

module.exports = { getPeriode };
