/** Chuyen mang object thanh CSV (co BOM de Excel doc dung tieng Viet) */
function toCsv(rows) {
  if (!rows.length) return '﻿';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return '﻿' + lines.join('\r\n');
}

/** Tra ve JSON hoac file CSV tuy theo ?format=csv */
function sendRows(req, res, rows, filename) {
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(rows));
  }
  return res.json({ data: rows });
}

module.exports = { toCsv, sendRows };
