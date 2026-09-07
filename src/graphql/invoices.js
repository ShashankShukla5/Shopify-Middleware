const ORDER_INVOICE_SEND = `
  mutation OrderInvoiceSend($orderId: ID!, $email: EmailInput) {
    orderInvoiceSend(id: $orderId, email: $email) {
      order {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

module.exports = {
  ORDER_INVOICE_SEND,
};
