const GET_VARIANT = `
  query GetVariant($id: ID!) {
    productVariant(id: $id) {
      id
      title
      sku
        price
        taxable
        product {
        id
        title
        vendor
      }
    }
  }
`;

module.exports = {
  GET_VARIANT,
};
