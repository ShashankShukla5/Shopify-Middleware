const { AppError } = require('../errors/AppError');
const { toMoneyNumber } = require('../utils/money');
const { config } = require('../config');

function isKefiBundleItem(cartItem) {
  const properties = cartItem?.properties || {};
  return Boolean(
    cartItem?.has_components ||
      properties._builder_subproducts ||
      properties.__bundle_builder ||
      properties.__KF ||
      properties.__bundle_builder_fields
  );
}

/**
 * Shopify Ajax `/cart.js` stores most money fields in cents (220 = $2.20).
 * `presentment_price` is already a decimal in the shop currency.
 */
function cartLineUnitPriceInDollars(cartItem) {
  if (cartItem.presentment_price != null) {
    const amount = toMoneyNumber(cartItem.presentment_price);
    if (Number.isFinite(amount) && amount >= 0) {
      return amount;
    }
  }

  const cents = Number(cartItem.final_price ?? cartItem.price);
  if (!Number.isFinite(cents) || cents < 0) {
    throw new AppError('Cart item is missing a valid price', 400);
  }

  return toMoneyNumber(cents / 100);
}

function parsePractitionerMarkup(cartItem, lineIndex) {
  const raw = cartItem?.properties?._practitioner_markup;
  if (raw == null || raw === '') {
    return 0;
  }

  const markup = Number(raw);
  const label = `line ${lineIndex + 1}`;

  if (!Number.isFinite(markup)) {
    throw new AppError(`Invalid practitioner markup on ${label}`, 400);
  }

  if (markup < 0) {
    throw new AppError(`Markup cannot be negative on ${label}`, 400);
  }

  if (markup > config.draftOrder.maxMarkup) {
    throw new AppError(
      `Markup cannot exceed $${config.draftOrder.maxMarkup} on ${label}`,
      400
    );
  }

  return toMoneyNumber(markup);
}

function priceCartLine(cartItem, lineIndex = 0) {
  const quantity = Number(cartItem.quantity);
  const baseUnitPrice = cartLineUnitPriceInDollars(cartItem);
  const markupPerUnit = parsePractitionerMarkup(cartItem, lineIndex);
  const isKefi = isKefiBundleItem(cartItem);

  const baseLineTotal = toMoneyNumber(baseUnitPrice * quantity);
  const markupTotal = toMoneyNumber(markupPerUnit * quantity);
  const finalLineTotal = toMoneyNumber(baseLineTotal + markupTotal);
  const finalUnitPrice = toMoneyNumber(baseUnitPrice + markupPerUnit);

  return {
    cartItem,
    quantity,
    isKefi,
    source: isKefi ? 'kefi_cart' : 'shopify_cart',
    baseUnitPrice,
    markupPerUnit,
    baseLineTotal,
    markupTotal,
    finalLineTotal,
    finalUnitPrice,
  };
}

function priceCartLines(cartItems) {
  const lines = cartItems.map((item, index) => priceCartLine(item, index));

  const baseTotal = toMoneyNumber(
    lines.reduce((sum, line) => sum + line.baseLineTotal, 0)
  );
  const markupTotal = toMoneyNumber(
    lines.reduce((sum, line) => sum + line.markupTotal, 0)
  );
  const finalTotal = toMoneyNumber(baseTotal + markupTotal);

  return {
    lines,
    baseTotal,
    markupTotal,
    finalTotal,
  };
}

module.exports = {
  isKefiBundleItem,
  parsePractitionerMarkup,
  priceCartLine,
  priceCartLines,
};
