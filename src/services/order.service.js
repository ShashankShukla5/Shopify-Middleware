const { shopifyGraphQL } = require('../clients/shopifyGraphQL');
const { ORDER_PAYMENT_SELECTION_SET, buildOrderQuery } = require('../graphql/orders');
const { toOrderGid } = require('../utils/gids');
const {
  extractUnsupportedFields,
  stripFieldFromSelection,
} = require('../utils/graphqlSelection');

async function fetchOrderPaymentDiagnostics(orderId) {
  const gid = toOrderGid(orderId);
  let selectionSet = ORDER_PAYMENT_SELECTION_SET;
  const removedFields = [];
  const maxAttempts = 12;
  let lastResponse = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const query = buildOrderQuery(selectionSet);
    const response = await shopifyGraphQL(query, { id: gid }, { throwOnErrors: false });
    lastResponse = response;

    const errors = response.errors || [];
    if (errors.length === 0) {
      return {
        orderGid: gid,
        order: response.data?.order ?? null,
        graphqlResponse: response,
        removedFields,
        attempts: attempt,
      };
    }

    const unsupported = extractUnsupportedFields(errors);
    if (unsupported.length === 0) {
      return {
        orderGid: gid,
        order: response.data?.order ?? null,
        graphqlResponse: response,
        removedFields,
        attempts: attempt,
        fatalErrors: errors,
      };
    }

    console.warn(
      `[shopify] GraphQL attempt ${attempt}: unsupported/inaccessible fields:`,
      unsupported
    );

    let updated = selectionSet;
    for (const field of unsupported) {
      if (!removedFields.includes(field)) {
        removedFields.push(field);
      }
      updated = stripFieldFromSelection(updated, field);
    }

    if (updated === selectionSet) {
      return {
        orderGid: gid,
        order: response.data?.order ?? null,
        graphqlResponse: response,
        removedFields,
        attempts: attempt,
        fatalErrors: errors,
      };
    }

    selectionSet = updated;
  }

  return {
    orderGid: gid,
    order: lastResponse?.data?.order ?? null,
    graphqlResponse: lastResponse,
    removedFields,
    attempts: maxAttempts,
    fatalErrors: lastResponse?.errors || [
      { message: 'Exceeded max GraphQL field-stripping attempts' },
    ],
  };
}

function extractAdditionalPaymentCollectionUrl(order) {
  if (!order) {
    return null;
  }

  const fromDetails = order.paymentCollectionDetails?.additionalPaymentCollectionUrl;
  if (fromDetails !== undefined) {
    return fromDetails;
  }

  if (Object.prototype.hasOwnProperty.call(order, 'additionalPaymentCollectionUrl')) {
    return order.additionalPaymentCollectionUrl;
  }

  return null;
}

module.exports = {
  fetchOrderPaymentDiagnostics,
  extractAdditionalPaymentCollectionUrl,
};
