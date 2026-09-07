const { shopifyGraphQL } = require('../clients/shopifyGraphQL');
const { ORDER_INVOICE_SEND } = require('../graphql/invoices');
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
  buildDefaultInvoiceEmail,
};
