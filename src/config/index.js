require('dotenv').config();

const DEFAULT_API_VERSION = '2025-07';
const DEFAULT_PORT = 3000;
const DEFAULT_CURRENCY = 'AUD';
const MAX_MARKUP = 1000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadConfig() {
  const apiVersion = process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

  return {
    port: Number(process.env.PORT) || DEFAULT_PORT,
    shopify: {
      shopDomain,
      accessToken,
      apiVersion,
      webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
      graphqlUrl: shopDomain
        ? `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`
        : '',
    },
    draftOrder: {
      currencyCode: process.env.SHOPIFY_CURRENCY_CODE || DEFAULT_CURRENCY,
      maxMarkup: Number(process.env.MAX_MARKUP) || MAX_MARKUP,
      tags: ['Kefi', 'Practitioner Order'],
    },
    invoice: {
      autoSend: Boolean(process.env.AUTO_SEND_INVOICE),
      autoSendTo:
        process.env.AUTO_INVOICE_EMAIL || 'hello@dispensaryandco.com.au',
    },
  };
}

const config = loadConfig();

function warnMissingEnv() {
  const missing = [];
  if (!config.shopify.shopDomain) missing.push('SHOPIFY_SHOP_DOMAIN');
  if (!config.shopify.accessToken) missing.push('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (!config.shopify.webhookSecret) missing.push('SHOPIFY_WEBHOOK_SECRET');

  if (missing.length) {
    console.warn(
      `[startup] Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env.`
    );
  }

  if (!process.env.SHOPIFY_API_VERSION) {
    console.warn(
      `[startup] SHOPIFY_API_VERSION not set; defaulting to ${DEFAULT_API_VERSION}`
    );
  }
}

function assertShopifyAdminConfigured() {
  requireEnv('SHOPIFY_SHOP_DOMAIN');
  requireEnv('SHOPIFY_ADMIN_ACCESS_TOKEN');
}

module.exports = {
  config,
  warnMissingEnv,
  assertShopifyAdminConfigured,
  DEFAULT_API_VERSION,
  MAX_MARKUP,
  DEFAULT_CURRENCY,
};
