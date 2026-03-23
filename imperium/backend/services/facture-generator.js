const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const roundCents = (n) => Math.round(n * 100) / 100;

// ── Agency information (CLIENT on the invoice — prestataire is the chatteur) ──
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
const getOrCreateInvoice = db.transaction((chatteurId, debut, fin, montantHT) => {
  const existing = db.prepare(
    'SELECT * FROM factures WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).get(chatteurId, debut, fin);

  if (existing) {
    return { invoiceNum: existing.invoice_num, seqNum: existing.seq_num, isDuplicate: true };
  }

  const lastSeq = db.prepare('SELECT MAX(seq_num) as max_seq FROM factures').get();
  const nextSeq = (lastSeq?.max_seq || 0) + 1;
  const year = new Date(debut + 'T00:00:00').getFullYear();
  const invoiceNum = `FA-${year}-${String(nextSeq).padStart(5, '0')}`;

  db.prepare(
    'INSERT INTO factures (invoice_num, seq_num, chatteur_id, periode_debut, periode_fin, montant_ht) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(invoiceNum, nextSeq, chatteurId, debut, fin, montantHT);

  return { invoiceNum, seqNum: nextSeq, isDuplicate: false };
});

/**
 * Generate a professional, French-compliant invoice PDF with full calculation detail.
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

  const malus = db.prepare(`
    SELECT * FROM malus
    WHERE chatteur_id = ? AND periode <= ? AND COALESCE(periode_fin, periode) >= ? AND actif != 0
    ORDER BY periode
  `).all(chatteurId, fin, debut);

  const primesManuelles = db.prepare(`
    SELECT * FROM primes_manuelles
    WHERE chatteur_id = ? AND actif = 1 AND periode_debut >= ? AND periode_fin <= ?
    ORDER BY created_at
  `).all(chatteurId, debut, fin);

  // ── Aggregates ──
  const totals = paies.reduce((acc, p) => ({
    commission: acc.commission + (p.commission_chatteur || 0),
    malus: acc.malus + (p.malus_total || 0),
    prime: acc.prime + (p.prime || 0),
    total: acc.total + (p.total_chatteur || 0),
  }), { commission: 0, malus: 0, prime: 0, total: 0 });

  // Separate primes: Top 3 (cagnotte) vs manuelles
  const totalPrimeManuelle = primesManuelles.reduce((s, pm) => s + (pm.montant || 0), 0);
  const totalPrimeCagnotte = roundCents(totals.prime - totalPrimeManuelle);

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

  // ── Colors ──
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

  // ── PDF ──
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 0, left: 50, right: 50 },
    bufferPages: true,
  });

  const L = 50;
  const R = doc.page.width - 50;
  const pageW = R - L;
  const pageBottom = doc.page.height - 80; // leave space for footer
  const fmtEur = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
  const fmtNum = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';

  function roundRect(x, y, w, h, r) {
    doc.moveTo(x + r, y)
      .lineTo(x + w - r, y).quadraticCurveTo(x + w, y, x + w, y + r)
      .lineTo(x + w, y + h - r).quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      .lineTo(x + r, y + h).quadraticCurveTo(x, y + h, x, y + h - r)
      .lineTo(x, y + r).quadraticCurveTo(x, y, x + r, y)
      .closePath();
    return doc;
  }

  function drawFooter(pageNum, totalPages) {
    const fY = doc.page.height - 30;
    doc.rect(L + 80, fY - 2, pageW - 160, 1).fill(gold);
    doc.fontSize(6).font('Helvetica').fillColor(gray)
      .text(`Page ${pageNum || ''}${totalPages ? ` / ${totalPages}` : ''}`, L, fY + 4, { width: pageW, align: 'center', lineBreak: false });
  }

  function checkPageBreak(needed) {
    if (doc.y + needed > pageBottom) {
      drawFooter();
      doc.addPage();
      doc.rect(L, 34, pageW, 1.5).fill(gold);
      doc.y = 50;
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════
  // HEADER — Facture emise par le prestataire (chatteur)
  // ═══════════════════════════════════════
  doc.rect(L, 34, pageW, 1.5).fill(gold);
  let y = 44;

  doc.fontSize(18).font('Helvetica-Bold').fillColor(navy).text('FACTURE', L, y - 1);
  doc.fontSize(7.5).font('Helvetica').fillColor(gray)
    .text(`${(chatteur.prenom || '').toUpperCase()} > ${AGENCY.nom}`, L, y + 17);

  doc.fontSize(7).font('Helvetica').fillColor(gray)
    .text(`\u00c9mise le ${todayLabel}`, L, y, { width: pageW, align: 'right' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(navy)
    .text(invoiceNum, L, y + 12, { width: pageW, align: 'right' });

  const badgeLabel = isDuplicate ? 'DUPLICATA' : 'ORIGINAL';
  const badgeColor = isDuplicate ? '#f59e0b' : '#10b981';
  const badgeW = isDuplicate ? 62 : 55;
  const badgeX = R - badgeW;
  roundRect(badgeX, y + 27, badgeW, 14, 7).fill(badgeColor);
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(white)
    .text(badgeLabel, badgeX, y + 30, { width: badgeW, align: 'center' });

  y += 50;
  doc.fontSize(7).font('Helvetica').fillColor(gray)
    .text(`P\u00e9riode : du ${periodeLabel}`, L, y, { width: pageW });

  // ═══════════════════════════════════════
  // PARTIES
  // ═══════════════════════════════════════
  y += 18;
  const colMid = L + pageW / 2 + 15;
  const colLeftW = colMid - L - 25;
  const colRightW = R - colMid;

  // Left: PRESTATAIRE (emetteur de la facture)
  let yP = y;
  doc.fontSize(6).font('Helvetica-Bold').fillColor(gold).text('PRESTATAIRE (EMETTEUR)', L, yP);
  yP += 3;
  doc.moveTo(L, yP + 7).lineTo(L + 85, yP + 7).lineWidth(0.8).strokeColor(gold).stroke();
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
  // Statut juridique
  doc.fontSize(6).font('Helvetica').fillColor(gray)
    .text(isFrance ? 'Micro-entrepreneur' : 'Prestataire individuel non immatricul\u00e9', L, yP);
  yP += 9;
  // Taux de commission
  doc.fontSize(6.5).font('Helvetica').fillColor(darkGray)
    .text(`Taux de commission : ${fmtPct(chatteur.taux_commission * 100)}`, L, yP);
  yP += 10;

  // Right: CLIENT (destinataire de la facture)
  let yC = y;
  doc.fontSize(6).font('Helvetica-Bold').fillColor(gold).text('CLIENT (DESTINATAIRE)', colMid, yC);
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
  doc.fontSize(6).text(`SIREN ${AGENCY.siren}  |  RCS ${AGENCY.rcs}`, colMid, yC); yC += 9;
  doc.text(`TVA ${AGENCY.tva_intra}`, colMid, yC);

  // ═══════════════════════════════════════
  // OBJET
  // ═══════════════════════════════════════
  y = Math.max(yP, yC) + 16;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.4).strokeColor(lightGray).stroke();
  y += 10;

  doc.rect(L, y, 2, 38).fill(gold);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(navy)
    .text('Objet de la prestation', L + 10, y + 1);
  doc.fontSize(7).font('Helvetica').fillColor(darkGray)
    .text(`1 prestation forfaitaire de gestion de comptes sur plateforme${uniquePlatforms.length > 1 ? 's' : ''} de contenu num\u00e9rique (${uniquePlatforms.join(', ')}).`, L + 10, y + 12, { width: pageW - 16 });
  doc.fontSize(6.5).fillColor(gray)
    .text('Community management, conversations clients, fid\u00e9lisation, d\u00e9veloppement d\u2019audience, suivi commercial.', L + 10, y + 22, { width: pageW - 16 });
  doc.fontSize(6.5).fillColor(darkGray)
    .text(`Date d\u2019ex\u00e9cution : du ${periodeLabel}`, L + 10, y + 32, { width: pageW - 16 });

  // ═══════════════════════════════════════
  // TABLE RECAPITULATIVE
  // ═══════════════════════════════════════
  y += 50;
  doc.y = y;

  // Conversion note
  if (hasUSD) {
    const usdPaies = paies.filter(p => p.devise === 'USD');
    const rate = usdPaies[0]?.taux_change || 0.92;
    doc.fontSize(6.5).font('Helvetica').fillColor(gray)
      .text(`(i)  Conversion USD > EUR au taux de ${fmtNum(rate)} (1 $ = ${fmtNum(rate)} \u20ac)`, L, y);
    y += 12;
  }

  // Define columns — enriched with intermediate values
  const cols = [
    { label: 'Plateforme', x: L, w: 90 },
    ...(hasUSD ? [{ label: 'Brut ($)', x: L + 90, w: 58, align: 'right' }] : []),
    { label: 'TTC EUR', x: L + (hasUSD ? 148 : 90), w: hasUSD ? 58 : 70, align: 'right' },
    { label: 'HT EUR', x: L + (hasUSD ? 206 : 160), w: hasUSD ? 58 : 70, align: 'right' },
    { label: 'Net HT', x: L + (hasUSD ? 264 : 230), w: hasUSD ? 58 : 70, align: 'right' },
    { label: 'Taux', x: L + (hasUSD ? 322 : 300), w: 40, align: 'right' },
    { label: 'Commission', x: L + (hasUSD ? 362 : 340), w: R - L - (hasUSD ? 362 : 340), align: 'right' },
  ];

  // Table header
  const thH = 22;
  doc.rect(L, y, pageW, thH).fill(subtleGray);
  doc.rect(L, y + thH - 5, pageW, 1).fill(gold);
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(navy);
  for (const c of cols) {
    doc.text(c.label, c.x + 4, y + 7, { width: c.w - 8, align: c.align || 'left' });
  }
  y += thH;

  // Data rows
  const rH = 22;
  let ri = 0;
  for (const p of paies) {
    const pct = fmtPct(chatteur.taux_commission * 100);
    const isUSD = p.devise === 'USD';

    checkPageBreak(rH);
    y = doc.y;

    if (ri > 0) {
      doc.moveTo(L + 4, y).lineTo(R - 4, y).lineWidth(0.3).strokeColor(lightGray).stroke();
    }

    let ci = 0;
    // Plateforme
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(navy)
      .text(p.plateforme_nom || 'N/A', cols[ci].x + 4, y + 6, { width: cols[ci].w - 8 });
    ci++;

    // Brut ($) — only if hasUSD
    if (hasUSD) {
      doc.fontSize(7).font('Helvetica').fillColor(isUSD ? '#0284c7' : gray)
        .text(isUSD ? `${fmtNum(p.ventes_brutes)} $` : '\u2014', cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });
      ci++;
    }

    // TTC EUR
    doc.fontSize(7).font('Helvetica').fillColor(darkGray)
      .text(fmtEur(p.ventes_ttc_eur), cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });
    ci++;

    // HT EUR
    doc.fontSize(7).font('Helvetica').fillColor(darkGray)
      .text(fmtEur(p.ventes_ht_eur), cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });
    ci++;

    // Net HT
    doc.fontSize(7).font('Helvetica-Bold').fillColor(darkGray)
      .text(fmtEur(p.net_ht_eur), cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });
    ci++;

    // Taux
    doc.fontSize(7).font('Helvetica').fillColor(gray)
      .text(pct, cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });
    ci++;

    // Commission
    doc.fontSize(7).font('Helvetica-Bold').fillColor(navy)
      .text(fmtEur(p.commission_chatteur), cols[ci].x + 4, y + 6, { width: cols[ci].w - 8, align: 'right' });

    y += rH; ri++;
    doc.y = y;
  }

  // Table bottom line
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.8).strokeColor(lightGray).stroke();

  // ═══════════════════════════════════════
  // AJUSTEMENTS (Primes + Malus)
  // ═══════════════════════════════════════
  const hasAdjustments = totals.prime > 0 || malus.length > 0;
  if (hasAdjustments) {
    y += 10;
    checkPageBreak(30);
    y = doc.y;

    doc.fontSize(7).font('Helvetica-Bold').fillColor(navy).text('Ajustements', L, y);
    y += 12;

    const adjLabelW = 340;
    const adjValW = pageW - adjLabelW;

    // Prime de performance (palier individuel + collectif)
    if (totalPrimeCagnotte > 0) {
      checkPageBreak(16);
      y = doc.y;
      doc.fontSize(7).font('Helvetica').fillColor(green)
        .text('+  Prime de performance (palier)', L + 8, y, { width: adjLabelW - 8 });
      doc.font('Helvetica-Bold')
        .text(`+${fmtEur(totalPrimeCagnotte)}`, L + adjLabelW, y, { width: adjValW, align: 'right' });
      y += 14;
      doc.y = y;
    }

    // Primes manuelles
    for (const pm of primesManuelles) {
      checkPageBreak(16);
      y = doc.y;
      const pmLabel = `+  Prime \u2014 ${pm.raison || 'Bonus'}`;
      doc.fontSize(7).font('Helvetica').fillColor(green)
        .text(pmLabel, L + 8, y, { width: adjLabelW - 8 });
      doc.font('Helvetica-Bold')
        .text(`+${fmtEur(pm.montant)}`, L + adjLabelW, y, { width: adjValW, align: 'right' });
      y += 14;
      doc.y = y;
    }

    // Malus
    const totalNetHT = paies.reduce((sum, p) => sum + (p.net_ht_eur || 0), 0);
    for (const m of malus) {
      checkPageBreak(16);
      y = doc.y;
      const isPercent = m.type_malus === 'pourcentage';
      const realAmount = isPercent ? roundCents((m.montant / 100) * totalNetHT) : m.montant;
      const label = isPercent
        ? `P\u00e9nalit\u00e9 \u2014 ${m.raison || 'Ajustement'} (${fmtPct(m.montant)})`
        : `P\u00e9nalit\u00e9 \u2014 ${m.raison || 'Ajustement'}`;

      doc.fontSize(7).font('Helvetica').fillColor(red)
        .text(label, L + 8, y, { width: adjLabelW - 8 });
      doc.font('Helvetica-Bold')
        .text(`-${fmtEur(realAmount)}`, L + adjLabelW, y, { width: adjValW, align: 'right' });
      y += 14;
      doc.y = y;
    }

    // Separator after adjustments
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.3).strokeColor(lightGray).stroke();
    y += 4;
    doc.y = y;
  }

  // ═══════════════════════════════════════
  // TOTAUX DETAILLES
  // ═══════════════════════════════════════
  checkPageBreak(90);
  y = doc.y + 6;
  const tW = 230;
  const tX = R - tW;
  const tLbl = 140;
  const tVal = 80;

  // Sous-total commissions
  doc.fontSize(7.5).font('Helvetica').fillColor(darkGray)
    .text('Sous-total commissions', tX, y, { width: tLbl, align: 'right' });
  doc.font('Helvetica-Bold')
    .text(fmtEur(totals.commission), tX + tLbl + 10, y, { width: tVal, align: 'right' });
  y += 14;

  // Total primes
  if (totals.prime > 0) {
    doc.fontSize(7.5).font('Helvetica').fillColor(green)
      .text('Total primes', tX, y, { width: tLbl, align: 'right' });
    doc.font('Helvetica-Bold')
      .text(`+${fmtEur(totals.prime)}`, tX + tLbl + 10, y, { width: tVal, align: 'right' });
    y += 14;
  }

  // Total penalites
  if (totals.malus > 0) {
    doc.fontSize(7.5).font('Helvetica').fillColor(red)
      .text('Total p\u00e9nalit\u00e9s', tX, y, { width: tLbl, align: 'right' });
    doc.font('Helvetica-Bold')
      .text(`-${fmtEur(totals.malus)}`, tX + tLbl + 10, y, { width: tVal, align: 'right' });
    y += 14;
  }

  // Separator
  doc.moveTo(tX, y).lineTo(R, y).lineWidth(0.5).strokeColor(darkGray).stroke();
  y += 6;

  // Total HT
  doc.fontSize(8).font('Helvetica').fillColor(darkGray)
    .text('Total HT', tX, y, { width: tLbl, align: 'right' });
  doc.font('Helvetica-Bold')
    .text(fmtEur(totals.total), tX + tLbl + 10, y, { width: tVal, align: 'right' });
  y += 14;

  // TVA
  doc.font('Helvetica').fillColor(gray)
    .text('TVA (0 %)', tX, y, { width: tLbl, align: 'right' });
  doc.text('0,00 \u20ac', tX + tLbl + 10, y, { width: tVal, align: 'right' });
  y += 16;

  // NET A PAYER — gold accent + navy box
  doc.moveTo(tX, y).lineTo(R, y).lineWidth(1).strokeColor(gold).stroke();
  y += 6;
  doc.rect(tX, y, tW, 26).fill(navy);
  doc.rect(tX, y, 3, 26).fill(gold);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(white)
    .text('NET \u00c0 PAYER', tX + 12, y + 7, { width: tLbl - 6, align: 'right' });
  doc.fontSize(12).fillColor(lightGold)
    .text(fmtEur(totals.total), tX + tLbl + 10, y + 5, { width: tVal, align: 'right' });
  y += 36;
  doc.y = y;

  // ═══════════════════════════════════════
  // TVA MENTION + CONDITIONS
  // ═══════════════════════════════════════
  checkPageBreak(50);
  y = doc.y;

  doc.rect(L, y, 2, 12).fill(gold);
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#78650d')
    .text(tvaMention, L + 10, y + 1, { width: pageW - 16 });
  y += 18;

  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(navy).text('Conditions de r\u00e8glement', L, y);
  y += 10;
  doc.fontSize(6.5).font('Helvetica').fillColor(darkGray)
    .text('\u00c9ch\u00e9ance : \u00e0 r\u00e9ception de la facture', L, y, { width: pageW });
  y += 9;
  doc.fontSize(6.5).fillColor(gray)
    .text('Mode de paiement : virement via WorldRemit', L, y, { width: pageW });
  y += 9;
  doc.fontSize(5.5).fillColor(gray)
    .text('P\u00e9nalit\u00e9s de retard : 3\u00d7 le taux d\u2019int\u00e9r\u00eat l\u00e9gal (art. L.441-10 C. com.)  |  Indemnit\u00e9 de recouvrement : 40 \u20ac (art. D.441-5 C. com.)', L, y, { width: pageW });
  y += 16;
  doc.y = y;

  // ═══════════════════════════════════════
  // DETAIL CALCUL PAR PLATEFORME
  // ═══════════════════════════════════════
  checkPageBreak(40);
  y = doc.y;

  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.4).strokeColor(lightGray).stroke();
  y += 10;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(navy)
    .text('D\u00e9tail des calculs par plateforme', L, y);
  y += 4;
  doc.moveTo(L, y + 8).lineTo(L + 170, y + 8).lineWidth(0.8).strokeColor(gold).stroke();
  y += 16;
  doc.y = y;

  for (let pi = 0; pi < paies.length; pi++) {
    const p = paies[pi];
    const isUSD = p.devise === 'USD';
    const blockHeight = isUSD ? 90 : 70;

    checkPageBreak(blockHeight);
    y = doc.y;

    // Platform name header
    const pfLabel = `${p.plateforme_nom || 'N/A'}${isUSD ? ' (USD)' : ' (EUR)'}`;
    roundRect(L, y, pageW, 16, 3).fill(subtleGray);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(navy)
      .text(pfLabel, L + 8, y + 4);
    y += 22;

    const detailX1 = L + 16;
    const detailX2 = L + 200;
    const detailW = 120;
    const lineH = 12;

    // Ventes brutes
    doc.fontSize(7).font('Helvetica').fillColor(darkGray)
      .text('Ventes brutes', detailX1, y);
    doc.font('Helvetica-Bold')
      .text(isUSD ? `${fmtNum(p.ventes_brutes)} $` : fmtEur(p.ventes_brutes), detailX2, y, { width: detailW, align: 'right' });
    y += lineH;

    // Taux de change (USD only)
    if (isUSD) {
      doc.font('Helvetica').fillColor(gray)
        .text(`Taux de change`, detailX1, y);
      doc.text(`\u00d7 ${fmtNum(p.taux_change)} (1 $ = ${fmtNum(p.taux_change)} \u20ac)`, detailX2, y, { width: detailW, align: 'right' });
      y += lineH;
    }

    // Montant TTC EUR
    doc.font('Helvetica').fillColor(darkGray)
      .text('Montant TTC EUR', detailX1, y);
    doc.text(fmtEur(p.ventes_ttc_eur), detailX2, y, { width: detailW, align: 'right' });
    y += lineH;

    // TVA plateforme
    const tvaPercent = Math.round((p.tva_rate || 0) * 100).toLocaleString('fr-FR');
    const tvaMontant = roundCents((p.ventes_ttc_eur || 0) - (p.ventes_ht_eur || 0));
    doc.font('Helvetica').fillColor(gray)
      .text(`TVA plateforme (${tvaPercent} %)`, detailX1, y);
    doc.text(`-${fmtEur(tvaMontant)}  >  HT = ${fmtEur(p.ventes_ht_eur)}`, detailX2, y, { width: detailW, align: 'right' });
    y += lineH;

    // Commission plateforme
    const commPfPercent = Math.round((p.commission_rate || 0) * 100).toLocaleString('fr-FR');
    const commPfMontant = roundCents((p.ventes_ht_eur || 0) - (p.net_ht_eur || 0));
    doc.font('Helvetica').fillColor(gray)
      .text(`Commission plateforme (${commPfPercent} %)`, detailX1, y);
    doc.text(`-${fmtEur(commPfMontant)}  >  Net HT = ${fmtEur(p.net_ht_eur)}`, detailX2, y, { width: detailW, align: 'right' });
    y += lineH;

    // Commission prestataire
    doc.font('Helvetica-Bold').fillColor(navy)
      .text(`Commission prestataire (${fmtPct(chatteur.taux_commission * 100)})`, detailX1, y);
    doc.text(fmtEur(p.commission_chatteur), detailX2, y, { width: detailW, align: 'right' });
    y += lineH + 6;

    // Separator between platforms
    if (pi < paies.length - 1) {
      doc.moveTo(L + 16, y).lineTo(R - 16, y).lineWidth(0.3).strokeColor(lightGray).stroke();
      y += 8;
    }
    doc.y = y;
  }

  // ═══════════════════════════════════════
  // FOOTER — page numbers on all pages
  // ═══════════════════════════════════════
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    drawFooter(i + 1, totalPages);
  }

  doc.end();

  const filename = `IMPERA_${invoiceNum}_${(chatteur.prenom || 'inconnu').toUpperCase()}.pdf`;
  return { stream: doc, filename };
}

module.exports = { generateFacture };
