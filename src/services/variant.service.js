const { shopifyGraphQLData } = require('../clients/shopifyGraphQL');
const { GET_VARIANT } = require('../graphql/variants');
const { AppError } = require('../errors/AppError');

async function getVariantByGid(variantGid) {
  const data = await shopifyGraphQLData(GET_VARIANT, { id: variantGid });
  const variant = data.productVariant;

  if (!variant) {
    throw new AppError('Product variant not found in Shopify', 404);
  }

  const unitPrice = Number(variant.price);
  if (!Number.isFinite(unitPrice)) {
    throw new AppError('Invalid Shopify variant price', 500);
  }

  return { variant, unitPrice };
}

module.exports = {
  getVariantByGid,
};
