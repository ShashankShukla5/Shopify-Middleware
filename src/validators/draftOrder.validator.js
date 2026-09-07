const { AppError } = require('../errors/AppError');
const { config } = require('../config');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateOptionalEmail(email, label) {
  if (!email) {
    return null;
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(`Invalid ${label}`, 400);
  }

  return String(email).trim();
}

function validatePractitioner(practitioner) {
  if (!practitioner || typeof practitioner !== 'object') {
    throw new AppError('Practitioner is required', 400);
  }

  if (practitioner.id == null || practitioner.id === '') {
    throw new AppError('Practitioner ID is required', 400);
  }

  return {
    id: practitioner.id,
  };
}

function validateCreateDraftOrderBody(body = {}) {
  const { cart, markup, customerEmail, practitioner } = body;

  if (!cart || typeof cart !== 'object') {
    throw new AppError('Cart is required', 400);
  }

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  const parsedMarkup = Number(markup);

  if (!Number.isFinite(parsedMarkup)) {
    throw new AppError('Invalid practitioner markup', 400);
  }

  if (parsedMarkup < 0) {
    throw new AppError('Markup cannot be negative', 400);
  }

  if (parsedMarkup > config.draftOrder.maxMarkup) {
    throw new AppError(
      `Markup cannot exceed $${config.draftOrder.maxMarkup}`,
      400
    );
  }

  const validatedCustomerEmail = validateOptionalEmail(
    customerEmail,
    'customer email'
  );
  const validatedPractitioner = validatePractitioner(practitioner);

  if (cart.items.length !== 1) {
    throw new AppError(
      'This checkout currently supports one Kefi formulation per cart.',
      400
    );
  }

  const cartItem = cart.items[0];

  if (!cartItem.variant_id) {
    throw new AppError('Cart item is missing variant ID', 400);
  }

  const quantity = Number(cartItem.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('Invalid product quantity', 400);
  }

  return {
    cart,
    cartItem,
    quantity,
    parsedMarkup,
    customerEmail: validatedCustomerEmail,
    practitioner: validatedPractitioner,
  };
}

module.exports = {
  validateCreateDraftOrderBody,
};
