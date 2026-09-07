const { AppError } = require('../errors/AppError');
const { toMoneyNumber } = require('../utils/money');

function isKefiBundleItem(cartItem) {
  const properties = cartItem?.properties || {};
  return Boolean(
    cartItem?.has_components ||
      properties._builder_subproducts ||
      properties.__bundle_builder ||
      properties.__KF
  );
}

function parseBundleSubproducts(cartItem) {
  const raw = cartItem?.properties?._builder_subproducts;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new AppError('Kefi bundle subproducts could not be parsed', 400);
  }
}

/**
 * Shopify Ajax `/cart.js` stores most money fields in cents (220 = $2.20).
 * `presentment_price` is already a decimal in the shop currency.
 */
function cartLineUnitPriceInDollars(cartItem) {
  if (cartItem.presentment_price != null) {
    const amount = toMoneyNumber(cartItem.presentment_price);
    if (Number.isFinite(amount)) {
      return amount;
    }
  }

  const cents = Number(cartItem.price);
  if (!Number.isFinite(cents)) {
    throw new AppError('Cart item is missing a valid price', 400);
  }

  return toMoneyNumber(cents / 100);
}

function kefiBundleUnitPrice(cartItem) {
  const components = parseBundleSubproducts(cartItem);
  if (components.length) {
    const unit = components.reduce((sum, component) => {
      const price = Number(component.price);
      const quantity = Number(component.quantity || 1);
      if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
        throw new AppError('Kefi bundle subproduct has an invalid price or quantity', 400);
      }
      return sum + price * quantity;
    }, 0);

    return toMoneyNumber(unit);
  }

  return cartLineUnitPriceInDollars(cartItem);
}

/**
 * Kefi parent variants are often $0 in Shopify catalog; the real amount is the
 * formulation total. Regular products still use Admin catalog price.
 */
function resolveLineUnitPrice({ cartItem, catalogUnitPrice }) {
  if (isKefiBundleItem(cartItem)) {
    const unitPrice = kefiBundleUnitPrice(cartItem);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new AppError('Invalid Kefi bundle price', 400);
    }

    return {
      unitPrice,
      source: 'kefi_bundle',
      catalogUnitPrice,
    };
  }

  if (!Number.isFinite(catalogUnitPrice) || catalogUnitPrice < 0) {
    throw new AppError('Invalid Shopify variant price', 500);
  }

  return {
    unitPrice: toMoneyNumber(catalogUnitPrice),
    source: 'shopify_catalog',
    catalogUnitPrice: toMoneyNumber(catalogUnitPrice),
  };
}

module.exports = {
  isKefiBundleItem,
  resolveLineUnitPrice,
};
