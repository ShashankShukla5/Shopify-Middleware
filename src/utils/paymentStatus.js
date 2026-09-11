const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

/**
 * Map Shopify order financial_status → PENDING | PAID.
 * Invoice delivery is tracked separately via Order.invoiceSent.
 * CANCELLED is set only by draft delete / cancel webhooks.
 */
function mapShopifyFinancialStatus(financialStatus) {
  const value = String(financialStatus || '').toLowerCase();
  return value === 'paid' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
}

function isPaidStatus(status) {
  return status === PAYMENT_STATUS.PAID;
}

function isCancelledStatus(status) {
  return status === PAYMENT_STATUS.CANCELLED;
}

module.exports = {
  PAYMENT_STATUS,
  mapShopifyFinancialStatus,
  isPaidStatus,
  isCancelledStatus,
};
