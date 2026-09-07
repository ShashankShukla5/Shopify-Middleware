const { shopifyGraphQLData } = require('../clients/shopifyGraphQL');
const { GET_CUSTOMER } = require('../graphql/customers');
const { AppError } = require('../errors/AppError');
const { toCustomerGid } = require('../utils/gids');

async function getCustomerById(customerId) {
  const customerGid = toCustomerGid(customerId);
  const data = await shopifyGraphQLData(GET_CUSTOMER, { id: customerGid });
  const customer = data.customer;

  if (!customer) {
    throw new AppError('Practitioner customer not found in Shopify', 404);
  }

  return customer;
}

module.exports = {
  getCustomerById,
};
