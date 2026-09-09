const { PAYMENT_STATUS } = require('./paymentStatus');

/**
 * Isolated earnings classification for the dashboard.
 * Invoice sent is independent of paymentStatus (see Order.invoiceSent).
 */
const PAID_EARNINGS_STATUSES = [PAYMENT_STATUS.PAID];

const PENDING_EARNINGS_STATUSES = [PAYMENT_STATUS.PENDING];

const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

function isValidPaymentStatus(status) {
  return ALL_PAYMENT_STATUSES.includes(status);
}

module.exports = {
  PAID_EARNINGS_STATUSES,
  PENDING_EARNINGS_STATUSES,
  ALL_PAYMENT_STATUSES,
  isValidPaymentStatus,
};
