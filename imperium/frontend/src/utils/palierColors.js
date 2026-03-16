/**
 * Shared palier color system.
 * Colors are stored per-palier in DB (`couleur` field = hex string).
 * This module provides predefined options + helpers to derive light/border/text variants.
 */

// Predefined color options for the palier color picker
export const PALIER_COLOR_OPTIONS = [
  { hex: '#CD7F32', label: 'Bronze' },
  { hex: '#A8A9AD', label: 'Argent' },
  { hex: '#f5b731', label: 'Or' },
  { hex: '#06b6d4', label: 'Diamant' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#ef4444', label: 'Rouge' },
  { hex: '#10b981', label: 'Vert' },
  { hex: '#3b82f6', label: 'Bleu' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#ec4899', label: 'Rose' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#64748b', label: 'Gris' },
];

// Known label→color defaults (fallback when couleur is not set in DB)
const KNOWN_DEFAULTS = {
  bronze:  '#CD7F32',
  argent:  '#A8A9AD',
  or:      '#f5b731',
  diamant: '#06b6d4',
  platine: '#8b5cf6',
};

// Fallback palette for unknown labels with no couleur
const FALLBACK_PALETTE = ['#64748b', '#16a34a', '#0ea5e9', '#8b5cf6', '#f59e0b'];

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Darken a hex color by a factor (0-1)
 */
function darken(hex, factor = 0.4) {
  const { r, g, b } = hexToRgb(hex);
  const d = (v) => Math.round(v * (1 - factor));
  return `#${d(r).toString(16).padStart(2, '0')}${d(g).toString(16).padStart(2, '0')}${d(b).toString(16).padStart(2, '0')}`;
}

/**
 * Get the base hex color for a palier.
 * Priority: palier.couleur > known label default > fallback by index
 */
export function getPalierHex(palier, index = 0) {
  if (palier.couleur) return palier.couleur;
  if (palier.label) {
    const known = KNOWN_DEFAULTS[palier.label.toLowerCase()];
    if (known) return known;
  }
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/**
 * Get full color set for a palier (bg, light, border, text).
 * Used by all display components.
 *
 * @param {Object} palier - { couleur?, label?, ... }
 * @param {number} index - position index (fallback)
 * @returns {{ bg: string, light: string, border: string, text: string }}
 */
export function getTierColorFromPalier(palier, index = 0) {
  const hex = getPalierHex(palier, index);
  const { r, g, b } = hexToRgb(hex);
  return {
    bg: hex,
    light: `rgba(${r},${g},${b},0.12)`,
    border: `rgba(${r},${g},${b},0.3)`,
    text: darken(hex, 0.4),
  };
}

/**
 * Build PALIER_COLORS map from palier array (for admin Dashboard widget).
 * Returns { 'Bronze': { bg, border, text }, ... }
 */
export function buildPalierColorsMap(paliers) {
  const map = {};
  for (let i = 0; i < paliers.length; i++) {
    const p = paliers[i];
    const tc = getTierColorFromPalier(p, i);
    map[p.label] = { bg: tc.light, border: tc.bg, text: tc.text };
  }
  return map;
}
