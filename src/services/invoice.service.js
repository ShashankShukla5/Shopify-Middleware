const { shopifyGraphQL } = require('../clients/shopifyGraphQL');
const { ORDER_INVOICE_SEND, DRAFT_ORDER_INVOICE_SEND } = require('../graphql/invoices');
const { toOrderGid } = require('../utils/gids');

async function sendOrderInvoice({ orderId, email, subject, customMessage }) {
  const variables = {
    orderId: toOrderGid(orderId),
    email: {
      to: email,
      ...(subject ? { subject } : {}),
      ...(customMessage ? { customMessage } : {}),
    },
  };

  const response = await shopifyGraphQL(ORDER_INVOICE_SEND, variables);
  const mutationResult = response?.data?.orderInvoiceSend;

  if (!mutationResult) {
    throw new Error(`orderInvoiceSend returned no result: ${JSON.stringify(response)}`);
  }

  if (mutationResult.userErrors?.length) {
    const errorMessage = mutationResult.userErrors
      .map((error) => error.message)
      .join('; ');
    throw new Error(`Shopify invoice error: ${errorMessage}`);
  }

  return {
    order: mutationResult.order,
    graphqlResponse: response,
  };
}

async function sendDraftOrderInvoice({
  draftOrderId,
  email,
  subject,
  customMessage,
}) {
  const variables = {
    id: draftOrderId,
    email: {
      to: email,
      ...(subject ? { subject } : {}),
      ...(customMessage ? { customMessage } : {}),
    },
  };

  const response = await shopifyGraphQL(DRAFT_ORDER_INVOICE_SEND, variables);
  const mutationResult = response?.data?.draftOrderInvoiceSend;

  if (!mutationResult) {
    throw new Error(
      `draftOrderInvoiceSend returned no result: ${JSON.stringify(response)}`
    );
  }

  if (mutationResult.userErrors?.length) {
    const errorMessage = mutationResult.userErrors
      .map((error) => error.message)
      .join('; ');
    throw new Error(`Shopify draft invoice error: ${errorMessage}`);
  }

  return {
    draftOrder: mutationResult.draftOrder,
    graphqlResponse: response,
  };
}

function buildPractitionerDraftInvoiceEmail({
  practitionerEmail,
  draftOrderName,
  checkoutUrl,
  finalTotal,
  currency,
}) {
  const totalLabel =
    finalTotal != null && currency
      ? `${currency} ${Number(finalTotal).toFixed(2)}`
      : null;

  return {
    email: practitionerEmail,
    subject: `Checkout link for ${draftOrderName || 'your practitioner order'}`,
    customMessage:
      `A checkout link is ready for ${draftOrderName || 'this order'}` +
      (totalLabel ? ` (${totalLabel})` : '') +
      `.\n\n` +
      `Share this link with your client, or complete payment here:\n\n` +
      `${checkoutUrl}\n`,
  };
}

function buildDefaultInvoiceEmail(payload, orderId) {
  const firstName = payload.customer?.first_name || 'there';
  const paymentUrl = payload.order_status_url;

  return {
    email: payload.contact_email,
    subject: `Payment required for your ${orderId} order`,
    customMessage:
      `Hi ${firstName},\n\n` +
      `Thank you for your order! Please complete your payment by clicking the link below:\n\n` +
      `[Complete Payment](${paymentUrl})\n\n` +
      `If you have any questions, feel free to reach out to us.\n\n` +
      `Best regards,\nDispensary and Co.`,
  };
}

module.exports = {
  sendOrderInvoice,
  sendDraftOrderInvoice,
  buildPractitionerDraftInvoiceEmail,
  buildDefaultInvoiceEmail,
};
