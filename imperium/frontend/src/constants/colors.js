/**
 * Palette de couleurs pour les chatteurs.
 * Chaque chatteur se voit attribuer un index (stocké en DB).
 * Utilisé sur : page Chatteurs (pastille + picker) et page Shifts (cellules).
 */

export const CHATTEUR_COLORS = [
  // --- Rouges ---
  { bg: '#ffcdd2', text: '#b71c1c', border: '#ef9a9a', label: 'Rouge clair' },       // 0
  { bg: '#e53935', text: '#ffffff', border: '#c62828', label: 'Rouge' },               // 1
  { bg: '#b71c1c', text: '#ffffff', border: '#7f0000', label: 'Rouge foncé' },         // 2

  // --- Roses & Magenta ---
  { bg: '#f8bbd0', text: '#880e4f', border: '#f48fb1', label: 'Rose clair' },         // 3
  { bg: '#e91e63', text: '#ffffff', border: '#c2185b', label: 'Magenta' },             // 4
  { bg: '#ad1457', text: '#ffffff', border: '#880e4f', label: 'Magenta foncé' },       // 5

  // --- Oranges ---
  { bg: '#ffe0b2', text: '#e65100', border: '#ffcc80', label: 'Orange clair' },        // 6
  { bg: '#ff9800', text: '#ffffff', border: '#f57c00', label: 'Orange' },              // 7
  { bg: '#e65100', text: '#ffffff', border: '#bf360c', label: 'Orange foncé' },        // 8

  // --- Jaunes ---
  { bg: '#fff9c4', text: '#f57f17', border: '#fff176', label: 'Jaune clair' },        // 9
  { bg: '#ffd966', text: '#7c4700', border: '#ffc107', label: 'Jaune / Or' },         // 10
  { bg: '#f9a825', text: '#ffffff', border: '#f57f17', label: 'Jaune foncé' },        // 11

  // --- Verts ---
  { bg: '#c8e6c9', text: '#1b5e20', border: '#a5d6a7', label: 'Vert clair' },        // 12
  { bg: '#66bb6a', text: '#ffffff', border: '#43a047', label: 'Vert' },                // 13
  { bg: '#2e7d32', text: '#ffffff', border: '#1b5e20', label: 'Vert foncé' },          // 14

  // --- Cyans / Teal ---
  { bg: '#b2ebf2', text: '#006064', border: '#80deea', label: 'Cyan clair' },         // 15
  { bg: '#00bcd4', text: '#ffffff', border: '#0097a7', label: 'Cyan' },                // 16
  { bg: '#00695c', text: '#ffffff', border: '#004d40', label: 'Teal foncé' },          // 17

  // --- Bleus ---
  { bg: '#bbdefb', text: '#0d47a1', border: '#90caf9', label: 'Bleu clair' },         // 18
  { bg: '#1e88e5', text: '#ffffff', border: '#1565c0', label: 'Bleu' },                // 19
  { bg: '#0d47a1', text: '#ffffff', border: '#002171', label: 'Bleu foncé' },          // 20

  // --- Violets / Pourpres ---
  { bg: '#e1bee7', text: '#6a1b9a', border: '#ce93d8', label: 'Violet clair' },       // 21
  { bg: '#9c27b0', text: '#ffffff', border: '#7b1fa2', label: 'Violet' },              // 22
  { bg: '#4a148c', text: '#ffffff', border: '#311b92', label: 'Violet foncé' },        // 23
];
