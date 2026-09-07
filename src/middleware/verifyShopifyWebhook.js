const { config } = require('../config');
const { verifyShopifyWebhookHmac } = require('../utils/webhookHmac');

function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const topic = req.get('X-Shopify-Topic');
  const shopDomainHeader = req.get('X-Shopify-Shop-Domain');
  const webhookId = req.get('X-Shopify-Webhook-Id');
  const secret = config.shopify.webhookSecret;

  if (!Buffer.isBuffer(req.body)) {
    console.error(
      '[webhook] Raw body missing. Mount this route with express.raw({ type: "application/json" }).'
    );
    return res.status(500).send('Webhook misconfigured: raw body required');
  }

  if (!secret) {
    console.error('[webhook] SHOPIFY_WEBHOOK_SECRET is not set');
    return res.status(500).send('Server misconfigured');
  }

  const valid = verifyShopifyWebhookHmac(req.body, hmacHeader, secret);
  if (!valid) {
    console.error('[webhook] HMAC verification failed', {
      topic,
      shopDomainHeader,
      webhookId,
      hasHmacHeader: Boolean(hmacHeader),
      bodyBytes: req.body.length,
    });
    return res.status(401).send('Unauthorized');
  }

  try {
    req.webhookPayload = JSON.parse(req.body.toString('utf8'));
  } catch (parseError) {
    console.error('[webhook] Failed to parse JSON after HMAC verification:', parseError.message);
    return res.status(400).send('Invalid JSON');
  }

  req.webhookMeta = { topic, shopDomainHeader, webhookId };
  return next();
}

module.exports = {
  verifyShopifyWebhook,
};
