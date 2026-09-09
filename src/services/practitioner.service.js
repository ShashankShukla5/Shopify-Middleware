const { prisma } = require('../db/prisma');
const { toCustomerGid } = require('../utils/gids');

function extractNumericShopifyCustomerId(customer) {
  const gid = String(customer.id || '');
  const match = gid.match(/Customer\/(\d+)/);
  if (match) {
    return match[1];
  }

  return String(customer.id);
}

/**
 * Upsert practitioner from verified Shopify Customer.
 * Dashboard auth/scoping should always go through this table.
 */
async function upsertPractitionerFromShopifyCustomer(customer) {
  const shopifyCustomerGid = toCustomerGid(customer.id);
  const shopifyCustomerId = extractNumericShopifyCustomerId(customer);

  if (!customer.email) {
    throw new Error('Practitioner Shopify customer is missing an email');
  }

  return prisma.practitioner.upsert({
    where: { shopifyCustomerGid },
    create: {
      shopifyCustomerId,
      shopifyCustomerGid,
      email: customer.email,
      firstName: customer.firstName || null,
      lastName: customer.lastName || null,
      displayName: customer.displayName || null,
      lastSyncedAt: new Date(),
    },
    update: {
      shopifyCustomerId,
      email: customer.email,
      firstName: customer.firstName || null,
      lastName: customer.lastName || null,
      displayName: customer.displayName || null,
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * Resolve Practitioner for dashboard auth from a Shopify customer id or GID.
 */
async function findPractitionerByShopifyCustomerId(customerId) {
  if (customerId == null || String(customerId).trim() === '') {
    return null;
  }

  const raw = String(customerId).trim();
  const gid = raw.startsWith('gid://') ? raw : `gid://shopify/Customer/${raw}`;
  const numeric = raw.startsWith('gid://')
    ? extractNumericShopifyCustomerId({ id: raw })
    : raw;

  return prisma.practitioner.findFirst({
    where: {
      OR: [{ shopifyCustomerId: numeric }, { shopifyCustomerGid: gid }],
    },
  });
}

module.exports = {
  upsertPractitionerFromShopifyCustomer,
  extractNumericShopifyCustomerId,
  findPractitionerByShopifyCustomerId,
};
