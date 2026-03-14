/**
 * Convert array of objects to CSV string.
 * Uses semicolon separator and BOM for French Excel compatibility.
 *
 * @param {Array<Object>} data - rows
 * @param {Array<{key: string, label: string}>} columns - column definitions
 * @returns {string} CSV content with BOM
 */
function toCSV(data, columns) {
  const header = columns.map(c => `"${c.label}"`).join(';');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';')
  );
  // BOM for Excel UTF-8 compatibility
  return '\ufeff' + header + '\n' + rows.join('\n');
}

/**
 * Send CSV response with proper headers.
 */
function sendCSV(res, filename, data, columns) {
  const csv = toCSV(data, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { toCSV, sendCSV };
