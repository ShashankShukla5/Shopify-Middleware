const assert = require('assert');
const {
  buildOrderWhere,
  parsePagination,
  resolveOrderNumber,
} = require('../src/utils/dashboardQuery');
const { toMoneyNumber } = require('../src/utils/moneySerialize');
const { rowsToCsv } = require('../src/utils/csv');
const {
  isValidPaymentStatus,
  PAID_EARNINGS_STATUSES,
  PENDING_EARNINGS_STATUSES,
} = require('../src/utils/earningsClassification');

assert.strictEqual(toMoneyNumber('12.50'), 12.5);
assert.strictEqual(toMoneyNumber(null), 0);

assert.throws(() => parsePagination({ page: 0 }), /Invalid page/);
assert.throws(() => parsePagination({ limit: 101 }), /Maximum is 100/);
assert.deepStrictEqual(parsePagination({}), { page: 1, limit: 20, skip: 0 });

assert.throws(
  () => buildOrderWhere({ practitionerId: 'p1', from: '09-01-2026' }),
  /Invalid from date/
);
assert.throws(
  () => buildOrderWhere({ practitionerId: 'p1', status: 'NOPE' }),
  /Invalid payment status/
);

const where = buildOrderWhere({
  practitionerId: 'p1',
  from: '2026-09-01',
  to: '2026-09-30',
  status: 'PAID',
  search: '10025',
});
assert.strictEqual(where.practitionerId, 'p1');
assert.strictEqual(where.paymentStatus, 'PAID');
assert.ok(where.createdAt.gte);
assert.ok(where.createdAt.lte);
assert.ok(Array.isArray(where.OR));

assert.strictEqual(
  resolveOrderNumber({
    id: 'abc',
    shopifyOrderName: '#10025',
    shopifyDraftOrderName: '#D1',
  }),
  '#10025'
);
assert.strictEqual(
  resolveOrderNumber({ id: 'abc', shopifyDraftOrderName: '#D1' }),
  '#D1'
);

assert.ok(isValidPaymentStatus('PAID'));
assert.ok(isValidPaymentStatus('PENDING'));
assert.ok(isValidPaymentStatus('CANCELLED'));
assert.ok(!isValidPaymentStatus('paid'));
assert.ok(!isValidPaymentStatus('DRAFT'));
assert.ok(!isValidPaymentStatus('INVOICE_SENT'));
assert.deepStrictEqual(PAID_EARNINGS_STATUSES, ['PAID']);
assert.deepStrictEqual(PENDING_EARNINGS_STATUSES, ['PENDING']);

const csv = rowsToCsv(
  ['Order Number', 'Markup Total'],
  [{ 'Order Number': '#1', 'Markup Total': 10 }]
);
assert.ok(csv.includes('Order Number,Markup Total'));
assert.ok(csv.includes('#1,10'));

console.log('dashboard unit checks passed');
