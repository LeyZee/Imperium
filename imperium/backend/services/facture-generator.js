const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const db = require('../database');

// ── Logo path ──
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// ── Agency information ──
const AGENCY = {
  nom: 'IMPERA Agency',
  forme: 'SARL au capital de 1 000,00 \u20ac',
  adresse: '1262 route de la Dombes',
  cp_ville: '01330 AMBERIEUX EN DOMBES',
  pays: 'France',
  email: 'contact@impera-agency.com',
  siren: '989 572 276',
  rcs: 'BOURG-EN-BRESSE',
  tva_intra: 'FR24989572276',
};

const EU_COUNTRIES = new Set([
  'France', 'Allemagne', 'Belgique', 'Italie', 'Espagne', 'Portugal',
  'Pays-Bas', 'Luxembourg', 'Autriche', 'Irlande', 'Gr\u00e8ce', 'Finlande',
  'Su\u00e8de', 'Danemark', 'Pologne', 'Roumanie', 'Bulgarie', 'Hongrie',
  'R\u00e9publique tch\u00e8que', 'Croatie', 'Slovaquie', 'Slov\u00e9nie',
  'Lituanie', 'Lettonie', 'Estonie', 'Chypre', 'Malte',
]);

const ROLE_LABELS = {
  chatteur: 'Gestionnaire de comptes',
  manager: 'Manager d\u2019\u00e9quipe',
  va: 'Assistant virtuel',
};

// ──────────────────────────────────────────────
// Sequential invoice numbering with DB tracking
// ──────────────────────────────────────────────
/**
 * Get or create a sequential invoice record in the database.
 * Ensures unique invoice numbers per chatteur+period.
 *
 * @param {number} chatteurId - Chatteur ID
 * @param {string} debut - Period start date (YYYY-MM-DD)
 * @param {string} fin - Period end date (YYYY-MM-DD)
 * @param {number} montantHT - Invoice HT amount in EUR
 * @returns {{ invoiceNum: string, seqNum: number, isDuplicate: boolean }}
 */
// Wrapped in transaction to prevent race condition on seq_num
const getOrCreateInvoice = db.transaction((chatteurId, debut, fin, montantHT) => {
  // Check if invoice already exists for this chatteur+period
  const existing = db.prepare(
    'SELECT * FROM factures WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).get(chatteurId, debut, fin);

  if (existing) {
    return { invoiceNum: existing.invoice_num, seqNum: existing.seq_num, isDuplicate: true };
  }

  // Get next sequential number (global, across all invoices) — atomic inside transaction
  const lastSeq = db.prepare('SELECT MAX(seq_num) as max_seq FROM factures').get();
  const nextSeq = (lastSeq?.max_seq || 0) + 1;

  // Format: FA-YYYY-NNNNN (sequential, no gaps)
  const year = new Date(debut + 'T00:00:00').getFullYear();
  const invoiceNum = `FA-${year}-${String(nextSeq).padStart(5, '0')}`;

  db.prepare(
    'INSERT INTO factures (invoice_num, seq_num, chatteur_id, periode_debut, periode_fin, montant_ht) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(invoiceNum, nextSeq, chatteurId, debut, fin, montantHT);

  return { invoiceNum, seqNum: nextSeq, isDuplicate: false };
});

/**
 * Generate a compact, single-page, French-compliant invoice PDF.
 * Features: logo, sequential numbering, USD/EUR conversion, Original/Duplicata.
 *
 * @param {number} chatteurId - Chatteur ID to generate invoice for
 * @param {string} debut - Period start date (YYYY-MM-DD)
 * @param {string} fin - Period end date (YYYY-MM-DD)
 * @returns {{ stream: PDFDocument, filename: string }} PDF stream and suggested filename
 * @throws {Error} If chatteur has no paies for the period
 */
function generateFacture(chatteurId, debut, fin) {
  // ── Fetch data ──
  const chatteur = db.prepare(`
    SELECT c.*, u.email as user_email FROM chatteurs c
    LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(chatteurId);
  if (!chatteur) throw new Error('Chatteur introuvable');

  const paies = db.prepare(`
    SELECT p.*, pl.nom as plateforme_nom, pl.devise, pl.tva_rate, pl.commission_rate
    FROM paies p LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.chatteur_id = ? AND p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY p.net_ht_eur DESC
  `).all(chatteurId, debut, fin);
  if (paies.length === 0) throw new Error('Aucune paie pour cette periode');

  const malus = db.prepare(
    'SELECT * FROM malus WHERE chatteur_id = ? AND periode >= ? AND periode <= ? ORDER BY periode'
  ).all(chatteurId, debut, fin);

  // ── Aggregates ──
  const totals = paies.reduce((acc, p) => ({
    commission: acc.commission + (p.commission_chatteur || 0),
    malus: acc.malus + (p.malus_total || 0),
    prime: acc.prime + (p.prime || 0),
    total: acc.total + (p.total_chatteur || 0),
  }), { commission: 0, malus: 0, prime: 0, total: 0 });

  // ── Sequential invoice number ──
  const { invoiceNum, isDuplicate } = getOrCreateInvoice(chatteurId, debut, fin, totals.total);

  // ── Labels ──
  const dDebut = new Date(debut + 'T00:00:00');
  const dFin = new Date(fin + 'T00:00:00');
  const periodeLabel = `${dDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${dFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const todayLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── TVA mention ──
  const pays = chatteur.pays || 'France';
  const isFrance = pays === 'France';
  const isEU = EU_COUNTRIES.has(pays);
  const tvaMention = isFrance
    ? 'TVA non applicable, article 293 B du Code G\u00e9n\u00e9ral des Imp\u00f4ts'
    : isEU
      ? 'TVA non applicable \u2014 Prestation intracommunautaire (autoliquidation, art. 283-2 du CGI)'
      : 'TVA non applicable \u2014 Prestataire \u00e9tabli hors de l\u2019Union europ\u00e9enne';

  const roleLabel = ROLE_LABELS[chatteur.role] || ROLE_LABELS.chatteur;
  const uniquePlatforms = [...new Set(paies.map(p => p.plateforme_nom).filter(Boolean))];
  const hasUSD = paies.some(p => p.devise === 'USD');

  // ── PDF ──
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 0, left: 50, right: 50 },
    bufferPages: true,
  });

  const navy = '#1b2e4b';
  const gold = '#c9981a';
  const lightGold = '#f5b731';
  const gray = '#8494a7';
  const darkGray = '#334155';
  const lightGray = '#e2e8f0';
  const subtleGray = '#f1f5f9';
  const white = '#ffffff';
  const red = '#dc2626';
  const green = '#059669';

  const L = 50;
  const R = doc.page.width - 50;
  const pageW = R - L;
  const fmtEur = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
  const fmtNum = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Helper: draw a rounded rect (PDFKit doesn't have roundedRect natively on older versions)
  function roundRect(x, y, w, h, r) {
    doc.moveTo(x + r, y)
      .lineTo(x + w - r, y).quadraticCurveTo(x + w, y, x + w, y + r)
      .lineTo(x + w, y + h - r).quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      .lineTo(x + r, y + h).quadraticCurveTo(x, y + h, x, y + h - r)
      .lineTo(x, y + r).quadraticCurveTo(x, y, x + r, y)
      .closePath();
    return doc;
  }

  // ═══════════════════════════════════════
  // HEADER — Thin gold line + Logo/Title + Ref
  // ═══════════════════════════════════════
  doc.rect(L, 34, pageW, 1.5).fill(gold);
  let y = 44;

  // Logo (left)
  if (HAS_LOGO) {
    try {
      doc.image(LOGO_PATH, L, y, { width: 42, height: 42 });
    } catch (_) { /* logo load failed, continue without */ }
  }

  const textStart = HAS_LOGO ? L + 52 : L;
  doc.fontSize(18).font('Helvetica-Bold').fillColor(navy).text('FACTURE', textStart, y - 1);
  doc.fontSize(7.5).font('Helvetica').fillColor(gray).text(AGENCY.nom, textStart, y + 17);

  // Right side: date + invoice number
  doc.fontSize(7).font('Helvetica').fillColor(gray)
    .text(`\u00c9mise le ${todayLabel}`, L, y, { width: pageW, align: 'right' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(navy)
    .text(invoiceNum, L, y + 12, { width: pageW, align: 'right' });

  // Original / Duplicata badge (pill shape)
  const badgeLabel = isDuplicate ? 'DUPLICATA' : 'ORIGINAL';
  const badgeColor = isDuplicate ? '#f59e0b' : '#10b981';
  const badgeW = isDuplicate ? 62 : 55;
  const badgeX = R - badgeW;
  roundRect(badgeX, y + 27, badgeW, 14, 7).fill(badgeColor);
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(white)
    .text(badgeLabel, badgeX, y + 30, { width: badgeW, align: 'center' });

  y += 50;
  // Period line
  doc.fontSize(7).font('Helvetica').fillColor(gray)
    .text(`P\u00e9riode : du ${periodeLabel}`, L, y, { width: pageW });

  // ═══════════════════════════════════════
  // PARTIES — Two columns with subtle styling
  // ═══════════════════════════════════════
  y += 18;
  const colMid = L + pageW / 2 + 15;
  const colLeftW = colMid - L - 25;
  const colRightW = R - colMid;

  // Left: PRESTATAIRE
  let yP = y;
  doc.fontSize(6).font('Helvetica-Bold').fillColor(gold).text('PRESTATAIRE', L, yP);
  yP += 3;
  doc.moveTo(L, yP + 7).lineTo(L + 55, yP + 7).lineWidth(0.8).strokeColor(gold).stroke();
  yP += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(navy)
    .text((chatteur.prenom || '\u2014').toUpperCase(), L, yP);
  yP += 14;
  doc.fontSize(7).font('Helvetica').fillColor('#7c3aed')
    .text(`Prestataire ind\u00e9pendant \u2014 ${roleLabel}`, L, yP);
  yP += 12;
  doc.fontSize(7).font('Helvetica').fillColor(darkGray);
  if (chatteur.adresse) { doc.text(chatteur.adresse, L, yP); yP += 10; }
  if (chatteur.code_postal || chatteur.ville) {
    doc.text(`${chatteur.code_postal || ''} ${chatteur.ville || ''}`.trim(), L, yP); yP += 10;
  }
  doc.font('Helvetica-Bold').fillColor(navy).text(pays.toUpperCase(), L, yP); yP += 10;
  const email = chatteur.user_email || chatteur.email;
  if (email) { doc.font('Helvetica').fillColor(gray).text(email, L, yP); yP += 10; }

  // Right: CLIENT
  let yC = y;
  doc.fontSize(6).font('Helvetica-Bold').fillColor(gold).text('CLIENT', colMid, yC);
  yC += 3;
  doc.moveTo(colMid, yC + 7).lineTo(colMid + 35, yC + 7).lineWidth(0.8).strokeColor(gold).stroke();
  yC += 14;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(navy)
    .text(AGENCY.nom.toUpperCase(), colMid, yC);
  yC += 14;
  doc.fontSize(7).font('Helvetica').fillColor(darkGray);
  doc.text(AGENCY.adresse, colMid, yC); yC += 10;
  doc.text(AGENCY.cp_ville, colMid, yC); yC += 10;
  doc.font('Helvetica-Bold').text(AGENCY.pays.toUpperCase(), colMid, yC); yC += 10;
  doc.font('Helvetica').fillColor(gray).text(AGENCY.email, colMid, yC); yC += 10;
  doc.fontSize(6).text(`SIREN ${AGENCY.siren}  \u2022  RCS ${AGENCY.rcs}`, colMid, yC); yC += 9;
  doc.text(`TVA ${AGENCY.tva_intra}`, colMid, yC);

  // ═══════════════════════════════════════
  // OBJET — Subtle left accent, no filled background
  // ═══════════════════════════════════════
  y = Math.max(yP, yC) + 16;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.4).strokeColor(lightGray).stroke();
  y += 10;

  doc.rect(L, y, 2, 28).fill(gold);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(navy)
    .text('Objet de la prestation', L + 10, y + 1);
  doc.fontSize(7).font('Helvetica').fillColor(darkGray)
    .text(`Gestion de comptes sur plateforme${uniquePlatforms.length > 1 ? 's' : ''} de contenu num\u00e9rique (${uniquePlatforms.join(', ')}).`, L + 10, y + 12, { width: pageW - 16 });
  doc.fontSize(6.5).fillColor(gray)
    .text('Community management, conversations clients, fid\u00e9lisation, d\u00e9veloppement d\u2019audience, suivi commercial.', L + 10, y + 22, { width: pageW - 16 });

  // ═══════════════════════════════════════
  // TABLE — Light elegant design
  // ═══════════════════════════════════════
  y += 40;

  // Conversion note
  if (hasUSD) {
    const usdPaies = paies.filter(p => p.devise === 'USD');
    const rate = usdPaies[0]?.taux_change || 0.92;
    doc.fontSize(6.5).font('Helvetica').fillColor(gray)
      .text(`\u2139  Conversion USD \u2192 EUR au taux de ${fmtNum(rate)} (1 $ = ${fmtNum(rate)} \u20ac)`, L, y);
    y += 12;
  }

  const cols = [
    { label: 'D\u00e9signation', x: L, w: hasUSD ? 180 : 225 },
    ...(hasUSD ? [{ label: 'Brut ($)', x: L + 180, w: 60, align: 'right' }] : []),
    { label: 'Base HT', x: L + (hasUSD ? 240 : 225), w: hasUSD ? 70 : 85, align: 'right' },
    { label: 'Taux', x: L + (hasUSD ? 310 : 310), w: 50, align: 'right' },
    { label: 'Montant HT', x: L + (hasUSD ? 360 : 360), w: R - L - (hasUSD ? 360 : 360), align: 'right' },
  ];

  // Table header — light background, gold bottom accent
  const thH = 22;
  doc.rect(L, y, pageW, thH).fill(subtleGray);
  doc.moveTo(L, y + thH).lineTo(R, y + thH).lineWidth(1.2).strokeColor(gold).stroke();
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(navy);
  for (const c of cols) {
    doc.text(c.label, c.x + 6, y + 7, { width: c.w - 12, align: c.align || 'left' });
  }
  y += thH;

  // Data rows — clean with subtle dividers
  const rH = 22;
  let ri = 0;
  for (const p of paies) {
    const pct = `${(chatteur.taux_commission * 100).toFixed(1)}%`;
    const isUSD = p.devise === 'USD';

    if (ri > 0) {
      doc.moveTo(L + 6, y).lineTo(R - 6, y).lineWidth(0.3).strokeColor(lightGray).stroke();
    }

    doc.fontSize(7.5).font('Helvetica').fillColor(darkGray)
      .text(`Gestion de compte \u2014 ${p.plateforme_nom || 'N/A'}`, cols[0].x + 6, y + 6, { width: cols[0].w - 12 });

    let colIdx = 1;
    if (hasUSD) {
      doc.fontSize(7).fillColor(isUSD ? '#0284c7' : gray)
        .text(isUSD ? `${fmtNum(p.ventes_brutes)} $` : '\u2014', cols[colIdx].x + 6, y + 6, { width: cols[colIdx].w - 12, align: 'right' });
      colIdx++;
    }
    doc.fontSize(7).fillColor(gray)
      .text(fmtEur(p.net_ht_eur), cols[colIdx].x + 6, y + 6, { width: cols[colIdx].w - 12, align: 'right' });
    colIdx++;
    doc.text(pct, cols[colIdx].x + 6, y + 6, { width: cols[colIdx].w - 12, align: 'right' });
    colIdx++;
    doc.font('Helvetica-Bold').fillColor(navy)
      .text(fmtEur(p.commission_chatteur), cols[colIdx].x + 6, y + 6, { width: cols[colIdx].w - 12, align: 'right' });

    y += rH; ri++;
  }

  // Prime row
  if (totals.prime > 0) {
    doc.moveTo(L + 6, y).lineTo(R - 6, y).lineWidth(0.3).strokeColor(lightGray).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor(green)
      .text('\u2605  Prime de performance (Top 3)', cols[0].x + 6, y + 6, { width: 280 });
    doc.font('Helvetica-Bold')
      .text(`+${fmtEur(totals.prime)}`, cols[cols.length - 1].x + 6, y + 6, { width: cols[cols.length - 1].w - 12, align: 'right' });
    y += rH; ri++;
  }

  // Malus rows
  for (const m of malus) {
    doc.moveTo(L + 6, y).lineTo(R - 6, y).lineWidth(0.3).strokeColor(lightGray).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor(red)
      .text(`P\u00e9nalit\u00e9 \u2014 ${m.raison || 'Ajustement'}`, cols[0].x + 6, y + 6, { width: 280 });
    doc.font('Helvetica-Bold')
      .text(`\u2212${fmtEur(m.montant)}`, cols[cols.length - 1].x + 6, y + 6, { width: cols[cols.length - 1].w - 12, align: 'right' });
    y += rH; ri++;
  }

  // Table bottom line
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.8).strokeColor(lightGray).stroke();

  // ═══════════════════════════════════════
  // TOTALS — Elegant right-aligned
  // ═══════════════════════════════════════
  y += 10;
  const tW = 210;
  const tX = R - tW;
  const tLbl = 120;
  const tVal = 80;

  doc.fontSize(8).font('Helvetica').fillColor(darkGray)
    .text('Total HT', tX, y, { width: tLbl, align: 'right' });
  doc.font('Helvetica-Bold')
    .text(fmtEur(totals.total), tX + tLbl + 10, y, { width: tVal, align: 'right' });
  y += 14;
  doc.font('Helvetica').fillColor(gray)
    .text('TVA (0 %)', tX, y, { width: tLbl, align: 'right' });
  doc.text('0,00 \u20ac', tX + tLbl + 10, y, { width: tVal, align: 'right' });
  y += 16;

  // NET À PAYER — gold accent line + clean box
  doc.moveTo(tX, y).lineTo(R, y).lineWidth(1).strokeColor(gold).stroke();
  y += 6;
  doc.rect(tX, y, tW, 26).fill(navy);
  // Small gold accent on the left edge of the box
  doc.rect(tX, y, 3, 26).fill(gold);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(white)
    .text('NET \u00c0 PAYER', tX + 12, y + 7, { width: tLbl - 6, align: 'right' });
  doc.fontSize(12).fillColor(lightGold)
    .text(fmtEur(totals.total), tX + tLbl + 10, y + 5, { width: tVal, align: 'right' });
  y += 36;

  // ═══════════════════════════════════════
  // TVA MENTION + CONDITIONS
  // ═══════════════════════════════════════
  doc.rect(L, y, 2, 12).fill(gold);
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#78650d')
    .text(tvaMention, L + 10, y + 1, { width: pageW - 16 });
  y += 18;

  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(navy).text('Conditions de r\u00e8glement', L, y);
  y += 10;
  doc.fontSize(6.5).font('Helvetica').fillColor(gray)
    .text('Paiement via WorldRemit, \u00e0 r\u00e9ception de la facture.', L, y, { width: pageW });
  y += 9;
  doc.fontSize(5.5).fillColor(gray)
    .text('P\u00e9nalit\u00e9s de retard : 3\u00d7 le taux d\u2019int\u00e9r\u00eat l\u00e9gal (art. L.441-10 C. com.)  \u2022  Indemnit\u00e9 de recouvrement : 40 \u20ac (art. D.441-5 C. com.)', L, y, { width: pageW });

  // ═══════════════════════════════════════
  // FOOTER — Elegant centered
  // ═══════════════════════════════════════
  const fY = doc.page.height - 40;
  doc.moveTo(L + 40, fY - 4).lineTo(R - 40, fY - 4).lineWidth(0.3).strokeColor(lightGray).stroke();
  doc.fontSize(6).font('Helvetica-Bold').fillColor(navy)
    .text(AGENCY.nom, L, fY, { width: pageW, align: 'center' });
  doc.fontSize(5).font('Helvetica').fillColor(gray)
    .text(`${AGENCY.forme}  \u2022  SIREN ${AGENCY.siren}  \u2022  RCS ${AGENCY.rcs}  \u2022  TVA ${AGENCY.tva_intra}`, L, fY + 9, { width: pageW, align: 'center' });
  doc.fontSize(5).text(`${AGENCY.adresse}, ${AGENCY.cp_ville}`, L, fY + 17, { width: pageW, align: 'center' });
  doc.rect(L + 80, doc.page.height - 14, pageW - 160, 1).fill(gold);

  doc.end();

  const filename = `IMPERA_${invoiceNum}_${(chatteur.prenom || 'inconnu').toUpperCase()}.pdf`;
  return { stream: doc, filename };
}

module.exports = { generateFacture };
