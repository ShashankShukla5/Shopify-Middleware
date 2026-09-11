const { prisma } = require('../db/prisma');
const { toDraftOrderGid, toOrderGid } = require('../utils/gids');
const { upsertPractitionerFromShopifyCustomer } = require('./practitioner.service');
const {
  PAYMENT_STATUS,
  mapShopifyFinancialStatus,
  isPaidStatus,
  isCancelledStatus,
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
  const paymentStatus = PAYMENT_STATUS.PENDING;

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
        invoiceRecipientEmail: invoiceRecipient?.email || null,
        invoiceRecipientType:
          invoiceRecipient?.recipientType === 'client' ? 'CLIENT' : null,
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
            note: emailSent
              ? 'Invoice emailed to client'
              : clientEmail
                ? 'Draft created; invoice send failed'
                : 'Draft created; no client email, invoice not sent',
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

function draftOrderIdCandidates(draftOrderId) {
  if (draftOrderId == null || draftOrderId === '') {
    return [];
  }

  const raw = String(draftOrderId);
  const gid = toDraftOrderGid(raw);
  const numeric = raw.startsWith('gid://')
    ? raw.split('/').pop()
    : raw;

  return [...new Set([gid, numeric, raw].filter(Boolean))];
}

async function findOrderByShopifyDraftId(tx, draftOrderId) {
  const candidates = draftOrderIdCandidates(draftOrderId);
  if (!candidates.length) {
    return null;
  }

  return tx.order.findFirst({
    where: {
      shopifyDraftOrderId: { in: candidates },
    },
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

    if (isCancelledStatus(existing.paymentStatus)) {
      console.warn(
        `[financials] Skipping paid link for cancelled Order ${existing.id}`
      );
      return existing;
    }

    const nextStatus = mapShopifyFinancialStatus(payload.financial_status);
    const fromStatus = existing.paymentStatus;

    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        shopifyOrderId: toOrderGid(shopifyOrderId),
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

/**
 * draft_orders/update — when status is completed and order_id is set,
 * store the real Shopify order id and mark payment as PAID.
 */
async function markPaidFromDraftOrderWebhook(payload) {
  const draftId = payload?.id;
  const status = String(payload?.status || '').toLowerCase();
  const orderId = payload?.order_id;

  if (!draftId) {
    return null;
  }

  if (status !== 'completed' || !orderId) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findOrderByShopifyDraftId(tx, draftId);

    if (!existing) {
      console.warn(
        `[financials] No Order found for completed draft ${draftId}`
      );
      return null;
    }

    if (isCancelledStatus(existing.paymentStatus)) {
      console.warn(
        `[financials] Skipping paid update for cancelled Order ${existing.id}`
      );
      return existing;
    }

    const nextStatus = PAYMENT_STATUS.PAID;
    const fromStatus = existing.paymentStatus;
    const shopifyOrderId = toOrderGid(orderId);

    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        shopifyOrderId,
        shopifyOrderName: payload.order_name || payload.name || existing.shopifyOrderName,
        shopifyDraftOrderName:
          payload.name || existing.shopifyDraftOrderName,
        paymentStatus: nextStatus,
        paidAt: existing.paidAt || new Date(),
        ...(fromStatus !== nextStatus || existing.shopifyOrderId !== shopifyOrderId
          ? {
              paymentEvents: {
                create: {
                  fromStatus,
                  toStatus: nextStatus,
                  source: 'draft_orders_update_webhook',
                  note: `Draft completed → Shopify order ${orderId}`,
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

/**
 * draft_orders/delete — mark the practitioner order as CANCELLED.
 * Does not overwrite PAID (draft already completed into a real order).
 */
async function markCancelledFromDraftOrderWebhook(payload) {
  const draftId = payload?.id;
  if (!draftId) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findOrderByShopifyDraftId(tx, draftId);

    if (!existing) {
      console.warn(
        `[financials] No Order found for deleted draft ${draftId}`
      );
      return null;
    }

    if (isPaidStatus(existing.paymentStatus)) {
      console.warn(
        `[financials] Skipping cancel for already-paid Order ${existing.id}`
      );
      return existing;
    }

    if (isCancelledStatus(existing.paymentStatus)) {
      return existing;
    }

    const fromStatus = existing.paymentStatus;
    const nextStatus = PAYMENT_STATUS.CANCELLED;

    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: nextStatus,
        paymentEvents: {
          create: {
            fromStatus,
            toStatus: nextStatus,
            source: 'draft_orders_delete_webhook',
            note: `Draft order ${draftId} deleted/cancelled in Shopify`,
          },
        },
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
  markPaidFromDraftOrderWebhook,
  markCancelledFromDraftOrderWebhook,
};
