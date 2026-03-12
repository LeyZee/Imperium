const db = require('../database');
const logger = require('./logger');

let cachedRate = null;
let cacheExpires = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get USD→EUR exchange rate with in-memory cache (1h TTL)
 * @returns {number}
 */
function getExchangeRate() {
  const now = Date.now();
  if (cachedRate !== null && now < cacheExpires) {
    return cachedRate;
  }
  const row = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  cachedRate = row?.taux || 0.92;
  cacheExpires = now + CACHE_TTL;
  return cachedRate;
}

/**
 * Invalidate cache (call after taux_change is updated)
 */
function invalidateRateCache() {
  cachedRate = null;
  cacheExpires = 0;
}

/**
 * Fetch latest USD→EUR rate from frankfurter.app and persist to DB
 */
async function refreshExchangeRate() {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    const taux = data.rates.EUR;
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT OR REPLACE INTO taux_change (devise_base, devise_cible, taux, date_maj)
      VALUES (?, ?, ?, ?)
    `).run('USD', 'EUR', taux, today);

    invalidateRateCache();
    logger.info(`Exchange rate refreshed: 1 USD = ${taux} EUR`);
    return taux;
  } catch (err) {
    // Silently fall back to cached/DB value
    const existing = getExchangeRate();
    logger.warn(`Exchange rate refresh failed (using ${existing}): ${err.message}`);
    return existing;
  }
}

module.exports = { getExchangeRate, invalidateRateCache, refreshExchangeRate };
