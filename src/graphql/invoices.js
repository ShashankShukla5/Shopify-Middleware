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

const DRAFT_ORDER_INVOICE_SEND = `
  mutation DraftOrderInvoiceSend($id: ID!, $email: EmailInput) {
    draftOrderInvoiceSend(id: $id, email: $email) {
      draftOrder {
        id
        name
        invoiceUrl
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
  DRAFT_ORDER_INVOICE_SEND,
};
