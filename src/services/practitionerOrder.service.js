const { prisma } = require('../db/prisma');
const { upsertPractitionerFromShopifyCustomer } = require('./practitioner.service');
const {
  PAYMENT_STATUS,
  mapShopifyFinancialStatus,
  isPaidStatus,
} = require('../utils/paymentStatus');

async function savePractitionerOrderFinancials({
  id,
  practitionerCustomer,
  draftOrder,
  priced,
  cart,
  clientEmail,
  invoiceRecipient,
  emailSent,
}) {
  const currency = draftOrder.currencyCode || cart.currency || 'AUD';
  const paymentStatus = emailSent
    ? PAYMENT_STATUS.INVOICE_SENT
    : PAYMENT_STATUS.DRAFT;

  const practitioner = await upsertPractitionerFromShopifyCustomer(
    practitionerCustomer
  );

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        id,
        practitionerId: practitioner.id,
        shopifyDraftOrderId: draftOrder.id,
        shopifyDraftOrderName: draftOrder.name || null,
        clientEmail: clientEmail || null,
        invoiceRecipientEmail: invoiceRecipient.email,
        invoiceRecipientType:
          invoiceRecipient.recipientType === 'client'
            ? 'CLIENT'
            : 'PRACTITIONER',
        currency,
        baseTotal: priced.baseTotal,
        markupTotal: priced.markupTotal,
        finalTotal: priced.finalTotal,
        paymentStatus,
        invoiceSent: Boolean(emailSent),
        invoiceSentAt: emailSent ? new Date() : null,
        cartToken: cart.token || null,
        items: {
          create: priced.lines.map((line) => ({
            shopifyVariantId: String(line.cartItem.variant_id),
            shopifyProductId: line.cartItem.product_id
              ? String(line.cartItem.product_id)
              : null,
            productTitle:
              line.cartItem.product_title || line.cartItem.title || null,
            sku: line.cartItem.sku || null,
            quantity: line.quantity,
            priceSource: line.source,
            baseUnitPrice: line.baseUnitPrice,
            markupPerUnit: line.markupPerUnit,
            markupTotal: line.markupTotal,
            finalUnitPrice: line.finalUnitPrice,
            finalLineTotal: line.finalLineTotal,
          })),
        },
        paymentEvents: {
          create: {
            fromStatus: null,
            toStatus: paymentStatus,
            source: 'draft_order_create',
            note: emailSent ? 'Invoice emailed' : 'Draft created; invoice not sent',
          },
        },
      },
      include: {
        items: true,
        practitioner: true,
        paymentEvents: true,
      },
    });

    return order;
  });
}

/**
 * When a Draft Order completes into a Shopify Order, link IDs and refresh payment status
 * using merchant tag `kefi-fin-<orderId>`.
 */
async function linkShopifyOrderFromWebhook(payload) {
  const shopifyOrderId = payload.id ? String(payload.id) : null;
  if (!shopifyOrderId) {
    return null;
  }

  const tags = String(payload.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const finTag = tags.find((tag) => tag.startsWith('kefi-fin-'));
  if (!finTag) {
    return null;
  }

  const recordId = finTag.slice('kefi-fin-'.length);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      console.warn(`[financials] No Order found for tag ${finTag}`);
      return null;
    }

    const nextStatus = mapShopifyFinancialStatus(payload.financial_status);
    const fromStatus = existing.paymentStatus;

    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        shopifyOrderId: `gid://shopify/Order/${shopifyOrderId}`,
        shopifyOrderName: payload.name || null,
        paymentStatus: nextStatus,
        paidAt:
          isPaidStatus(nextStatus) && !existing.paidAt
            ? new Date()
            : existing.paidAt,
        ...(fromStatus !== nextStatus
          ? {
              paymentEvents: {
                create: {
                  fromStatus,
                  toStatus: nextStatus,
                  source: 'orders_create_webhook',
                  note: `Shopify financial_status=${payload.financial_status || 'unknown'}`,
                },
              },
            }
          : {}),
      },
      include: {
        practitioner: true,
        items: true,
      },
    });

    return updated;
  });
}

module.exports = {
  savePractitionerOrderFinancials,
  linkShopifyOrderFromWebhook,
};
