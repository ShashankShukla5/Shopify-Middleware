function escapeCsvCell(value) {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  escapeCsvCell,
  rowsToCsv,
};
