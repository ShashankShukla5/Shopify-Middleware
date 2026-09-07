function formatMoneySet(moneySet) {
  if (!moneySet?.shopMoney) {
    return null;
  }

  const { amount, currencyCode } = moneySet.shopMoney;
  return `${amount} ${currencyCode}`;
}

function toMoneyNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : NaN;
}

module.exports = {
  formatMoneySet,
  toMoneyNumber,
};
