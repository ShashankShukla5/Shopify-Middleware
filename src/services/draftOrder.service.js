const crypto = require('crypto');
const { config } = require('../config');
const { toVariantGid } = require('../utils/gids');
const { AppError } = require('../errors/AppError');
const { shopifyGraphQLData } = require('../clients/shopifyGraphQL');
const { CREATE_DRAFT_ORDER } = require('../graphql/draftOrders');
const { getCustomerById } = require('./customer.service');
const { sendDraftOrderInvoice } = require('./invoice.service');
const { validateCreateDraftOrderBody } = require('../validators/draftOrder.validator');
const { priceCartLines } = require('./cartPricing.service');
const { buildReadableLineAttributes } = require('../utils/kefiAttributes');
const { savePractitionerOrderFinancials } = require('./practitionerOrder.service');

function buildLineCustomAttributes(pricedLine) {
  // Fulfillment/Kefi fields only — no markup, base price, or commission data.
  return buildReadableLineAttributes(pricedLine.cartItem);
}

function resolveInvoiceRecipient(clientEmail) {
  if (!clientEmail) {
    return null;
  }

  return {
    email: clientEmail,
    recipientType: 'client',
  };
}

function buildDraftOrderInput({
  cart,
  priced,
  practitionerCustomer,
  financialRecordId,
}) {
  if (!practitionerCustomer.email) {
    throw new AppError('Practitioner has no email on file in Shopify', 400);
  }

  const currencyCode = cart.currency || config.draftOrder.currencyCode;

  return {
    email: practitionerCustomer.email,
    lineItems: priced.lines.map((line) => ({
      variantId: toVariantGid(line.cartItem.variant_id),
      quantity: line.quantity,
      priceOverride: {
        amount: line.finalUnitPrice.toFixed(2),
        currencyCode,
      },
      customAttributes: buildLineCustomAttributes(line),
    })),
    tags: [...config.draftOrder.tags, `kefi-fin-${financialRecordId}`],
    note: 'Practitioner order',
    purchasingEntity: {
      customerId: practitionerCustomer.id,
    },
  };
}

async function createDraftOrderFromCart(body) {
  const { cart, cartItems, clientEmail, practitioner } =
    validateCreateDraftOrderBody(body);

  const practitionerCustomer = await getCustomerById(practitioner.id);
  const invoiceRecipient = resolveInvoiceRecipient(clientEmail);
  const priced = priceCartLines(cartItems);
  // Shopify tags max length is 40. Full UUIDs push `kefi-fin-<uuid>` over that.
  const financialRecordId = crypto.randomBytes(12).toString('hex');

  console.log('[draft-order] creating draft order', {
    clientEmail: clientEmail || null,
    draftOrderEmail: practitionerCustomer.email,
    invoiceRecipientType: invoiceRecipient?.recipientType || null,
    invoiceRecipientEmail: invoiceRecipient?.email || null,
    practitionerCustomerId: practitionerCustomer.id,
    financialRecordId,
    lineCount: priced.lines.length,
    baseTotal: priced.baseTotal,
    markupTotal: priced.markupTotal,
    finalTotal: priced.finalTotal,
  });

  const input = buildDraftOrderInput({
    cart,
    priced,
    practitionerCustomer,
    financialRecordId,
  });

  const data = await shopifyGraphQLData(CREATE_DRAFT_ORDER, { input });
  const result = data.draftOrderCreate;

  if (result.userErrors?.length) {
    console.error('Shopify Draft Order errors:', result.userErrors);
    throw new AppError('Shopify could not create the Draft Order', 400, {
      errors: result.userErrors,
    });
  }

  if (!result.draftOrder) {
    throw new AppError('Shopify did not return a Draft Order', 500);
  }

  if (!result.draftOrder.invoiceUrl) {
    throw new AppError(
      'Draft Order was created but Shopify did not return an invoice URL',
      500,
      { draftOrderId: result.draftOrder.id }
    );
  }

  const draftOrder = result.draftOrder;
  let emailSent = false;
  let emailSkipped = !invoiceRecipient;

  if (invoiceRecipient) {
    try {
      console.log(
        `[draft-order] Sending invoice to client ${invoiceRecipient.email} for draft order ${draftOrder.id}`
      );
      await sendDraftOrderInvoice({
        draftOrderId: draftOrder.id,
        email: invoiceRecipient.email,
      });
      emailSent = true;
      console.log(
        `[draft-order] Invoice sent successfully to client ${invoiceRecipient.email} for draft order ${draftOrder.id}`
      );
    } catch (error) {
      console.error(
        `[draft-order] Failed to send invoice to client ${invoiceRecipient.email} for draft order ${draftOrder.id}:`,
        error.message
      );
    }
  } else {
    console.log(
      `[draft-order] No client email provided; skipping invoice email for draft order ${draftOrder.id}`
    );
  }

  try {
    await savePractitionerOrderFinancials({
      id: financialRecordId,
      practitionerCustomer,
      draftOrder,
      priced,
      cart,
      clientEmail,
      invoiceRecipient,
      emailSent,
    });
    console.log(
      `[draft-order] Stored financials in PostgreSQL for ${financialRecordId} / ${draftOrder.id}`
    );
  } catch (error) {
    console.error(
      `[draft-order] Failed to store financials for draft order ${draftOrder.id}:`,
      error.message
    );
  }

  const draftOrderSummary = {
    id: draftOrder.id,
    name: draftOrder.name,
    status: draftOrder.status,
    email: draftOrder.email,
    customer: draftOrder.customer,
    baseTotal: priced.baseTotal,
    markup: priced.markupTotal,
    finalTotal: priced.finalTotal,
    currency: draftOrder.currencyCode || cart.currency || config.draftOrder.currencyCode,
    lines: priced.lines.map((line) => ({
      variantId: line.cartItem.variant_id,
      source: line.source,
      quantity: line.quantity,
      baseUnitPrice: line.baseUnitPrice,
      markupPerUnit: line.markupPerUnit,
      finalUnitPrice: line.finalUnitPrice,
      finalLineTotal: line.finalLineTotal,
    })),
  };

  let message;
  if (emailSent) {
    message = 'Invoice sent successfully to the client.';
  } else if (emailSkipped) {
    message = 'Draft Order created. No client email provided, so no invoice email was sent.';
  } else {
    message = 'Draft Order created, but the invoice email could not be sent.';
  }

  return {
    success: true,
    emailSent,
    emailSkipped,
    draftOrderCreated: true,
    clientEmail: clientEmail || null,
    invoiceSentTo: invoiceRecipient?.email || null,
    invoiceRecipientType: invoiceRecipient?.recipientType || null,
    checkoutUrl: draftOrder.invoiceUrl,
    invoiceUrl: draftOrder.invoiceUrl,
    message,
    draftOrder: draftOrderSummary,
  };
}

module.exports = {
  createDraftOrderFromCart,
};
