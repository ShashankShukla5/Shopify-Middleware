const PAYMENT_STATUS = {
  DRAFT: 'DRAFT',
  INVOICE_SENT: 'INVOICE_SENT',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  VOIDED: 'VOIDED',
  CANCELLED: 'CANCELLED',
};

/**
 * Map Shopify order financial_status → our PaymentStatus enum.
 */
function mapShopifyFinancialStatus(financialStatus) {
  const value = String(financialStatus || '').toLowerCase();

  switch (value) {
    case 'pending':
      return PAYMENT_STATUS.PENDING;
    case 'authorized':
      return PAYMENT_STATUS.AUTHORIZED;
    case 'partially_paid':
      return PAYMENT_STATUS.PARTIALLY_PAID;
    case 'paid':
      return PAYMENT_STATUS.PAID;
    case 'partially_refunded':
      return PAYMENT_STATUS.PARTIALLY_REFUNDED;
    case 'refunded':
      return PAYMENT_STATUS.REFUNDED;
    case 'voided':
      return PAYMENT_STATUS.VOIDED;
    default:
      return PAYMENT_STATUS.PENDING;
  }
}

function isPaidStatus(status) {
  return status === PAYMENT_STATUS.PAID;
}

module.exports = {
  PAYMENT_STATUS,
  mapShopifyFinancialStatus,
  isPaidStatus,
};
