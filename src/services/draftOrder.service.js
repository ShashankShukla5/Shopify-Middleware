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

function buildLineCustomAttributes(pricedLine) {
  const customAttributes = buildReadableLineAttributes(pricedLine.cartItem);

  customAttributes.push({
    key: 'Practitioner Markup',
    value: pricedLine.markupPerUnit.toFixed(2),
  });

  customAttributes.push({
    key: 'Original Unit Price',
    value: pricedLine.baseUnitPrice.toFixed(2),
  });

  customAttributes.push({
    key: 'Final Customer Price',
    value: pricedLine.finalUnitPrice.toFixed(2),
  });

  customAttributes.push({
    key: 'Price Source',
    value: pricedLine.source,
  });

  return customAttributes;
}

function resolveInvoiceRecipient({ clientEmail, practitionerCustomer }) {
  if (clientEmail) {
    return {
      email: clientEmail,
      recipientType: 'client',
    };
  }

  if (!practitionerCustomer.email) {
    throw new AppError(
      'No client email provided and practitioner has no email on file in Shopify',
      400
    );
  }

  return {
    email: practitionerCustomer.email,
    recipientType: 'practitioner',
  };
}

function buildDraftOrderInput({
  cart,
  priced,
  clientEmail,
  practitionerCustomer,
}) {
  if (!practitionerCustomer.email) {
    throw new AppError('Practitioner has no email on file in Shopify', 400);
  }

  const currencyCode = cart.currency || config.draftOrder.currencyCode;

  const draftOrderInput = {
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
    tags: config.draftOrder.tags,
    note:
      `Kefi practitioner order. ` +
      `Base total: $${priced.baseTotal.toFixed(2)}. ` +
      `Practitioner markup: $${priced.markupTotal.toFixed(2)}. ` +
      `Final total: $${priced.finalTotal.toFixed(2)}.`,
    customAttributes: [
      { key: 'Kefi Cart Token', value: cart.token || '' },
      { key: 'Base Cart Total', value: priced.baseTotal.toFixed(2) },
      { key: 'Practitioner Markup', value: priced.markupTotal.toFixed(2) },
      { key: 'Final Customer Total', value: priced.finalTotal.toFixed(2) },
      { key: 'Practitioner Customer ID', value: practitionerCustomer.id },
    ],
    purchasingEntity: {
      customerId: practitionerCustomer.id,
    },
  };

  if (clientEmail && clientEmail !== practitionerCustomer.email) {
    draftOrderInput.customAttributes.push({
      key: 'Client Email',
      value: clientEmail,
    });
  }

  return draftOrderInput;
}

async function createDraftOrderFromCart(body) {
  const { cart, cartItems, clientEmail, practitioner } =
    validateCreateDraftOrderBody(body);

  const practitionerCustomer = await getCustomerById(practitioner.id);
  const invoiceRecipient = resolveInvoiceRecipient({
    clientEmail,
    practitionerCustomer,
  });
  const priced = priceCartLines(cartItems);

  console.log('[draft-order] creating draft order', {
    clientEmail: clientEmail || null,
    draftOrderEmail: practitionerCustomer.email,
    invoiceRecipientType: invoiceRecipient.recipientType,
    invoiceRecipientEmail: invoiceRecipient.email,
    practitionerCustomerId: practitionerCustomer.id,
    lineCount: priced.lines.length,
    baseTotal: priced.baseTotal,
    markupTotal: priced.markupTotal,
    finalTotal: priced.finalTotal,
  });

  const input = buildDraftOrderInput({
    cart,
    priced,
    clientEmail,
    practitionerCustomer,
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

  try {
    console.log(
      `[draft-order] Sending invoice to ${invoiceRecipient.recipientType} ${invoiceRecipient.email} for draft order ${draftOrder.id}`
    );
    await sendDraftOrderInvoice({
      draftOrderId: draftOrder.id,
      email: invoiceRecipient.email,
    });
    emailSent = true;
    console.log(
      `[draft-order] Invoice sent successfully to ${invoiceRecipient.recipientType} ${invoiceRecipient.email} for draft order ${draftOrder.id}`
    );
  } catch (error) {
    console.error(
      `[draft-order] Failed to send invoice to ${invoiceRecipient.recipientType} ${invoiceRecipient.email} for draft order ${draftOrder.id}:`,
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

  return {
    success: emailSent,
    emailSent,
    draftOrderCreated: true,
    clientEmail: clientEmail || null,
    invoiceSentTo: invoiceRecipient.email,
    invoiceRecipientType: invoiceRecipient.recipientType,
    checkoutUrl: draftOrder.invoiceUrl,
    invoiceUrl: draftOrder.invoiceUrl,
    message: emailSent
      ? invoiceRecipient.recipientType === 'client'
        ? 'Invoice sent successfully to the client.'
        : 'Invoice sent successfully to the practitioner.'
      : 'Draft Order created, but the invoice email could not be sent.',
    draftOrder: draftOrderSummary,
  };
}

module.exports = {
  createDraftOrderFromCart,
};
