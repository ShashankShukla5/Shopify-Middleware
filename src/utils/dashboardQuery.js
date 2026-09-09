const { AppError } = require('../errors/AppError');
const { isValidPaymentStatus } = require('./earningsClassification');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseOptionalDate(value, label) {
  if (value == null || value === '') {
    return null;
  }

  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(`Invalid ${label}. Use YYYY-MM-DD.`, 400);
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${label}`, 400);
  }

  return { raw, date };
}

function buildCreatedAtFilter(from, to) {
  const fromParsed = parseOptionalDate(from, 'from date');
  const toParsed = parseOptionalDate(to, 'to date');

  if (fromParsed && toParsed && fromParsed.date > toParsed.date) {
    throw new AppError('"from" date must be on or before "to" date', 400);
  }

  if (!fromParsed && !toParsed) {
    return undefined;
  }

  const createdAt = {};
  if (fromParsed) {
    createdAt.gte = fromParsed.date;
  }
  if (toParsed) {
    // Inclusive end of day UTC
    const end = new Date(`${toParsed.raw}T23:59:59.999Z`);
    createdAt.lte = end;
  }

  return createdAt;
}

function parsePagination(query = {}) {
  const pageRaw = query.page == null || query.page === '' ? DEFAULT_PAGE : Number(query.page);
  const limitRaw =
    query.limit == null || query.limit === '' ? DEFAULT_LIMIT : Number(query.limit);

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    throw new AppError('Invalid page. Must be an integer >= 1.', 400);
  }

  if (!Number.isInteger(limitRaw) || limitRaw < 1) {
    throw new AppError('Invalid limit. Must be an integer >= 1.', 400);
  }

  if (limitRaw > MAX_LIMIT) {
    throw new AppError(`Invalid limit. Maximum is ${MAX_LIMIT}.`, 400);
  }

  return {
    page: pageRaw,
    limit: limitRaw,
    skip: (pageRaw - 1) * limitRaw,
  };
}

function parseStatusFilter(status) {
  if (status == null || status === '') {
    return null;
  }

  const normalized = String(status).trim().toUpperCase();
  if (!isValidPaymentStatus(normalized)) {
    throw new AppError('Invalid payment status. Use PENDING or PAID.', 400);
  }

  return normalized;
}

function parseSearch(search) {
  if (search == null || String(search).trim() === '') {
    return null;
  }

  return String(search).trim();
}

function buildOrderWhere({ practitionerId, from, to, status, search }) {
  const where = {
    practitionerId,
  };

  const createdAt = buildCreatedAtFilter(from, to);
  if (createdAt) {
    where.createdAt = createdAt;
  }

  const paymentStatus = parseStatusFilter(status);
  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  const searchTerm = parseSearch(search);
  if (searchTerm) {
    where.OR = [
      { shopifyOrderName: { contains: searchTerm, mode: 'insensitive' } },
      { shopifyDraftOrderName: { contains: searchTerm, mode: 'insensitive' } },
      { clientEmail: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  return where;
}

function resolveOrderNumber(order) {
  return order.shopifyOrderName || order.shopifyDraftOrderName || order.id;
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildCreatedAtFilter,
  parsePagination,
  parseStatusFilter,
  parseSearch,
  buildOrderWhere,
  resolveOrderNumber,
};
