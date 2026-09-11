const express = require('express');
const { config } = require('../config');
const { verifyShopifyWebhook } = require('../middleware/verifyShopifyWebhook');
const { sendOrderInvoice, buildDefaultInvoiceEmail } = require('../services/invoice.service');
const { toOrderGid } = require('../utils/gids');
const {
  linkShopifyOrderFromWebhook,
  markPaidFromDraftOrderWebhook,
  markCancelledFromDraftOrderWebhook,
} = require('../services/practitionerOrder.service');

const router = express.Router();

/**
 * orders/create — backup linker via kefi-fin-* tag when a draft becomes an order.
 */
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

  try {
    const linked = await linkShopifyOrderFromWebhook(payload);
    if (linked) {
      console.log(
        `[webhook] Linked Shopify order ${orderId} to Order ${linked.id} (status=${linked.paymentStatus})`
      );
    }
  } catch (error) {
    console.error('[webhook] Failed to link practitioner financials:', error.message);
  }

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

/**
 * draft_orders/update
 * When a draft is completed (paid/checkout finished), Shopify sets status=completed
 * and order_id to the real Order. We store that id and mark payment PAID.
 */
router.post('/draft-orders-update', verifyShopifyWebhook, async (req, res) => {
  const { topic, shopDomainHeader, webhookId } = req.webhookMeta;
  const payload = req.webhookPayload;

  console.log('\n[webhook] HMAC verified OK', {
    topic,
    shopDomainHeader,
    webhookId,
    draftOrderId: payload?.id,
    status: payload?.status,
    orderId: payload?.order_id || null,
  });

  try {
    const updated = await markPaidFromDraftOrderWebhook(payload);
    if (updated) {
      console.log(
        `[webhook] Draft ${payload.id} → Order ${updated.id} paid (shopifyOrderId=${updated.shopifyOrderId})`
      );
    } else {
      console.log(
        `[webhook] draft-orders-update ignored (status=${payload?.status}, order_id=${payload?.order_id || 'none'})`
      );
    }
  } catch (error) {
    console.error('[webhook] draft-orders-update failed:', error.message);
  }

  return res.status(200).send('OK');
});

/**
 * draft_orders/delete
 * Draft deleted/cancelled in Shopify → mark our row CANCELLED (unless already PAID).
 */
router.post('/draft-orders-delete', verifyShopifyWebhook, async (req, res) => {
  const { topic, shopDomainHeader, webhookId } = req.webhookMeta;
  const payload = req.webhookPayload;

  console.log('\n[webhook] HMAC verified OK', {
    topic,
    shopDomainHeader,
    webhookId,
    draftOrderId: payload?.id,
  });

  try {
    const updated = await markCancelledFromDraftOrderWebhook(payload);
    if (updated) {
      console.log(
        `[webhook] Draft ${payload.id} → Order ${updated.id} status=${updated.paymentStatus}`
      );
    }
  } catch (error) {
    console.error('[webhook] draft-orders-delete failed:', error.message);
  }

  return res.status(200).send('OK');
});

module.exports = router;
