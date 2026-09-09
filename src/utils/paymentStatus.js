const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
};

/**
 * Map Shopify order financial_status → PENDING | PAID.
 * Invoice delivery is tracked separately via Order.invoiceSent.
 */
function mapShopifyFinancialStatus(financialStatus) {
  const value = String(financialStatus || '').toLowerCase();
  return value === 'paid' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
}

function isPaidStatus(status) {
  return status === PAYMENT_STATUS.PAID;
}

module.exports = {
  PAYMENT_STATUS,
  mapShopifyFinancialStatus,
  isPaidStatus,
};
