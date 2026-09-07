const { AppError } = require('../errors/AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateOptionalEmail(email, label) {
  if (email == null || String(email).trim() === '') {
    return null;
  }

  const normalized = String(email).trim();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AppError(`Invalid ${label}`, 400);
  }

  return normalized;
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

function validateCartItems(items) {
  return items.map((cartItem, index) => {
    const label = `line ${index + 1}`;

    if (!cartItem || typeof cartItem !== 'object') {
      throw new AppError(`Cart ${label} is invalid`, 400);
    }

    if (!cartItem.variant_id) {
      throw new AppError(`Cart ${label} is missing variant ID`, 400);
    }

    const quantity = Number(cartItem.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(`Invalid product quantity on ${label}`, 400);
    }

    return cartItem;
  });
}

function validateCreateDraftOrderBody(body = {}) {
  const { cart, clientEmail, practitioner } = body;

  if (!cart || typeof cart !== 'object') {
    throw new AppError('Cart is required', 400);
  }

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  return {
    cart,
    cartItems: validateCartItems(cart.items),
    clientEmail: validateOptionalEmail(clientEmail, 'client email'),
    practitioner: validatePractitioner(practitioner),
  };
}

module.exports = {
  validateCreateDraftOrderBody,
};
