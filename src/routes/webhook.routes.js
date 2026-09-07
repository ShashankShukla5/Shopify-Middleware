const express = require('express');
const { config } = require('../config');
const { verifyShopifyWebhook } = require('../middleware/verifyShopifyWebhook');
const { sendOrderInvoice, buildDefaultInvoiceEmail } = require('../services/invoice.service');
const { toOrderGid } = require('../utils/gids');

const router = express.Router();

router.post('/orders-create', verifyShopifyWebhook, async (req, res) => {
  const { topic, shopDomainHeader, webhookId } = req.webhookMeta;
  const payload = req.webhookPayload;

  console.log('\n[webhook] HMAC verified OK', {
    topic,
    shopDomainHeader,
    webhookId,
  });

  const orderId = payload.id;
  if (!orderId) {
    console.error('[webhook] Payload missing order id');
    return res.status(200).send('OK - missing order id, nothing to query');
  }

  console.log(`[webhook] Extracted Shopify Order ID: ${orderId}`);

  const contactEmail = payload.contact_email;
  const shouldAutoSendInvoice =
    config.invoice.autoSend && contactEmail === config.invoice.autoSendTo;

  if (shouldAutoSendInvoice) {
    const invoice = buildDefaultInvoiceEmail(payload, orderId);
    try {
      console.log(`[webhook] Sending invoice for order ${orderId} to ${invoice.email}`);
      await sendOrderInvoice({
        orderId: toOrderGid(orderId),
        email: invoice.email,
        subject: invoice.subject,
        customMessage: invoice.customMessage,
      });
      console.log(`[webhook] Invoice sent for order ${orderId} to ${invoice.email}`);
    } catch (error) {
      console.error(`[webhook] Failed to send invoice for order ${orderId}:`, error.message);
    }
  }

  return res.status(200).send('OK');
});

module.exports = router;
