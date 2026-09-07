const ORDER_PAYMENT_SELECTION_SET = `
  id
  name
  displayFinancialStatus
  unpaid
  fullyPaid
  totalOutstandingSet {
    shopMoney {
      amount
      currencyCode
    }
  }
  paymentGatewayNames
  paymentCollectionDetails {
    additionalPaymentCollectionUrl
  }
  statusPageUrl
`;

function buildOrderQuery(selectionSet) {
  return `
    query PaymentCollectionDiagnostic($id: ID!) {
      order(id: $id) {
        ${selectionSet}
      }
    }
  `;
}

module.exports = {
  ORDER_PAYMENT_SELECTION_SET,
  buildOrderQuery,
};
