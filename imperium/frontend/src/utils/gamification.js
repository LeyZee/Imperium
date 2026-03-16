/**
 * Gamification utilities — pure functions for prime system engagement
 * No React dependencies — can be unit tested independently
 */

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

  // Recrue: first time earning a prime (totalPodiums === 1 and current has prime)
  const isNewcomer = totalPodiums === 1 && (current?.total_prime || 0) > 0;
  badges.push({ id: 'newcomer', emoji: '\uD83C\uDF1F', label: 'Recrue', earned: isNewcomer });

  return { streak, bestPrime, bestPaie, totalPodiums, badges };
}
