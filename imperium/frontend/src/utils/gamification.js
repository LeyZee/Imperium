/**
 * Gamification utilities — pure functions for prime system engagement
 * No React dependencies — can be unit tested independently
 */

/**
 * Compute cagnotte milestones (thermometer) based on historical average
 * @param {number} moyennePrimePool - Average prime pool from last N periods
 * @param {number} currentPrimePool - Current period's prime pool
 * @returns {Array|null} Array of 4 milestone objects, or null if no history
 */
export function computeMilestones(moyennePrimePool, currentPrimePool) {
  if (!moyennePrimePool || moyennePrimePool <= 0) return null;

  const paliers = [
    { pct: 0.50,  label: 'D\u00e9marrage', emoji: '\uD83C\uDF31' },
    { pct: 0.875, label: 'En route',       emoji: '\uD83D\uDD25' },
    { pct: 1.25,  label: 'Objectif',       emoji: '\uD83D\uDE80' },
    { pct: 1.625, label: 'Record',         emoji: '\uD83D\uDC51' },
  ];

  return paliers.map(p => ({
    seuil: Math.round(moyennePrimePool * p.pct * 100) / 100,
    label: p.label,
    emoji: p.emoji,
    pct: p.pct,
    atteint: currentPrimePool >= moyennePrimePool * p.pct,
  }));
}

/**
 * Compute streaks, records, and badges from chatteur's performance history
 * @param {Array} historique - Array of period objects with total_prime, total_paie (chronological)
 * @returns {Object} { streak, bestPrime, bestPaie, totalPodiums, badges }
 */
export function computeStreaksAndRecords(historique) {
  if (!historique || historique.length === 0) {
    return {
      streak: 0,
      bestPrime: 0,
      bestPaie: 0,
      totalPodiums: 0,
      badges: [],
    };
  }

  // Streak = consecutive recent periods with prime > 0 (from most recent backwards)
  let streak = 0;
  for (let i = historique.length - 1; i >= 0; i--) {
    if ((historique[i].total_prime || 0) > 0) {
      streak++;
    } else {
      break;
    }
  }

  const bestPrime = Math.max(0, ...historique.map(h => h.total_prime || 0));
  const bestPaie = Math.max(0, ...historique.map(h => h.total_paie || 0));
  const totalPodiums = historique.filter(h => (h.total_prime || 0) > 0).length;

  // Badges
  const badges = [];
  const current = historique[historique.length - 1];
  const previous = historique.length >= 2 ? historique[historique.length - 2] : null;

  // Rising Star: current prime > previous prime (both > 0)
  if (current && previous && (current.total_prime || 0) > 0 && (previous.total_prime || 0) > 0
      && (current.total_prime || 0) > (previous.total_prime || 0)) {
    badges.push({ id: 'rising', emoji: '\u2B50', label: 'En progression', earned: true });
  } else {
    badges.push({ id: 'rising', emoji: '\u2B50', label: 'En progression', earned: false });
  }

  // R\u00e9gulier: streak >= 3
  badges.push({ id: 'regulier', emoji: '\uD83C\uDFC6', label: 'R\u00e9gulier', earned: streak >= 3 });

  // Recrue: first time on podium (totalPodiums === 1 and current has prime)
  const isNewcomer = totalPodiums === 1 && (current?.total_prime || 0) > 0;
  badges.push({ id: 'newcomer', emoji: '\uD83C\uDF1F', label: 'Recrue', earned: isNewcomer });

  return { streak, bestPrime, bestPaie, totalPodiums, badges };
}

/**
 * Compute micro-milestones toward the podium (25/50/75/100% of 3rd place)
 * @param {number} myNetHT - User's net HT for this period
 * @param {number} thirdPlaceNetHT - 3rd place's net HT
 * @param {number} myRang - User's rank (1-based)
 * @returns {Object|null} { jalons, nextJalonAmount, progressPct } or null if top 3 / not ranked
 */
export function computeMicroMilestones(myNetHT, thirdPlaceNetHT, myRang) {
  // Hide if already top 3 or not ranked at all
  if (myRang <= 3 || myRang <= 0 || !thirdPlaceNetHT || thirdPlaceNetHT <= 0) {
    return null;
  }

  const checkpoints = [0.25, 0.50, 0.75, 1.00];
  const jalons = checkpoints.map(pct => ({
    pct,
    label: pct < 1 ? `${Math.round(pct * 100)}%` : 'Podium',
    targetAmount: Math.round(thirdPlaceNetHT * pct * 100) / 100,
    passed: myNetHT >= thirdPlaceNetHT * pct,
  }));

  const progressPct = Math.min(100, Math.round((myNetHT / thirdPlaceNetHT) * 100));

  // Next milestone = first not-passed jalon
  const nextJalon = jalons.find(j => !j.passed);
  const nextJalonAmount = nextJalon
    ? Math.round((nextJalon.targetAmount - myNetHT) * 100) / 100
    : 0;

  return { jalons, nextJalonAmount, progressPct };
}
