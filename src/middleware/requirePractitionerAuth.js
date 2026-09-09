const crypto = require('crypto');
const { AppError } = require('../errors/AppError');
const { config } = require('../config');
const { findPractitionerByShopifyCustomerId } = require('../services/practitioner.service');

function extractBearerToken(req) {
  const header = req.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function extractShopifyCustomerId(req) {
  const fromHeader = req.get('X-Shopify-Customer-Id');
  if (fromHeader) {
    return String(fromHeader).trim();
  }

  const bearer = extractBearerToken(req);
  if (bearer) {
    return bearer;
  }

  return null;
}

function verifyOptionalCustomerSignature(customerId, signature) {
  const secret = config.dashboard?.authSecret;
  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(String(customerId), 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(String(signature), 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Authenticate practitioner for dashboard APIs.
 *
 * Source of identity (same trust model as draft-order create):
 * - Header: X-Shopify-Customer-Id
 * - Or Authorization: Bearer <shopifyCustomerId>
 *
 * Optional stronger check when DASHBOARD_AUTH_SECRET is set:
 * - Header: X-Shopify-Customer-Signature = HMAC-SHA256(customerId, secret) hex
 *
 * Never trusts practitionerId from query/body/params.
 */
async function requirePractitionerAuth(req, _res, next) {
  try {
    const customerId = extractShopifyCustomerId(req);
    if (!customerId) {
      throw new AppError('Unauthenticated practitioner', 401);
    }

    const signature = req.get('X-Shopify-Customer-Signature');
    if (!verifyOptionalCustomerSignature(customerId, signature)) {
      throw new AppError('Unauthenticated practitioner', 401);
    }

    const practitioner = await findPractitionerByShopifyCustomerId(customerId);
    if (!practitioner) {
      throw new AppError('Not authorized to use the practitioner dashboard', 403);
    }

    if (practitioner.status !== 'ACTIVE') {
      throw new AppError('Not authorized to use the practitioner dashboard', 403);
    }

    req.practitioner = practitioner;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requirePractitionerAuth,
  extractShopifyCustomerId,
};
