const { config } = require('../config');
const { toVariantGid } = require('../utils/gids');
const { AppError } = require('../errors/AppError');
const { shopifyGraphQLData } = require('../clients/shopifyGraphQL');
const { CREATE_DRAFT_ORDER } = require('../graphql/draftOrders');
const { getVariantByGid } = require('./variant.service');
const { validateCreateDraftOrderBody } = require('../validators/draftOrder.validator');

function buildLineCustomAttributes(cartItem, parsedMarkup, shopifyUnitPrice) {
  const customAttributes = [];

  if (cartItem.properties) {
    for (const [key, value] of Object.entries(cartItem.properties)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      customAttributes.push({
        key: String(key),
        value: String(value),
      });
    }
  }

  customAttributes.push({
    key: 'Practitioner Markup',
    value: parsedMarkup.toFixed(2),
  });

  customAttributes.push({
    key: 'Original Unit Price',
    value: shopifyUnitPrice.toFixed(2),
  });

  return customAttributes;
}

function buildDraftOrderInput({
  variantGid,
  quantity,
  finalUnitPrice,
  customAttributes,
  cart,
  baseTotal,
  parsedMarkup,
  finalTotal,
  customerEmail,
}) {
  const draftOrderInput = {
    lineItems: [
      {
        variantId: variantGid,
        quantity,
        priceOverride: {
          amount: finalUnitPrice.toFixed(2),
          currencyCode: config.draftOrder.currencyCode,
        },
        customAttributes,
      },
    ],
    tags: config.draftOrder.tags,
    note:
      `Kefi practitioner order. ` +
      `Base total: $${baseTotal.toFixed(2)}. ` +
      `Practitioner markup: $${parsedMarkup.toFixed(2)}. ` +
      `Final total: $${finalTotal.toFixed(2)}.`,
    customAttributes: [
      { key: 'Kefi Cart Token', value: cart.token || '' },
      { key: 'Base Cart Total', value: baseTotal.toFixed(2) },
      { key: 'Practitioner Markup', value: parsedMarkup.toFixed(2) },
      { key: 'Final Customer Total', value: finalTotal.toFixed(2) },
    ],
  };

  if (customerEmail) {
    draftOrderInput.email = customerEmail;
  }

  return draftOrderInput;
}

async function createDraftOrderFromCart(body) {
  const { cart, cartItem, quantity, parsedMarkup, customerEmail } =
    validateCreateDraftOrderBody(body);

  const variantGid = toVariantGid(cartItem.variant_id);
  const { unitPrice: shopifyUnitPrice } = await getVariantByGid(variantGid);

  const baseTotal = shopifyUnitPrice * quantity;
  const finalTotal = Number((baseTotal + parsedMarkup).toFixed(2));
  const finalUnitPrice = Number((finalTotal / quantity).toFixed(2));

  const customAttributes = buildLineCustomAttributes(
    cartItem,
    parsedMarkup,
    shopifyUnitPrice
  );

  const input = buildDraftOrderInput({
    variantGid,
    quantity,
    finalUnitPrice,
    customAttributes,
    cart,
    baseTotal,
    parsedMarkup,
    finalTotal,
    customerEmail,
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

  return {
    checkoutUrl: result.draftOrder.invoiceUrl,
    draftOrder: {
      id: result.draftOrder.id,
      name: result.draftOrder.name,
      status: result.draftOrder.status,
      email: result.draftOrder.email,
      baseTotal: Number(baseTotal.toFixed(2)),
      markup: Number(parsedMarkup.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      currency: result.draftOrder.currencyCode || config.draftOrder.currencyCode,
    },
  };
}

module.exports = {
  createDraftOrderFromCart,
};
