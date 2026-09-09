/**
 * Serialize Prisma Decimal (or number/string) to a plain JS number for JSON.
 * Relies on DB/Prisma for arithmetic — this only formats for API responses.
 */
function toMoneyNumber(value) {
  if (value == null) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'object' && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
  toMoneyNumber,
};
