function toGid(type, id) {
  if (!id) {
    throw new Error(`${type} ID is required`);
  }

  const raw = String(id);
  if (raw.startsWith('gid://')) {
    return raw;
  }

  return `gid://shopify/${type}/${raw}`;
}

function toVariantGid(variantId) {
  return toGid('ProductVariant', variantId);
}

function toOrderGid(orderId) {
  return toGid('Order', orderId);
}

module.exports = {
  toGid,
  toVariantGid,
  toOrderGid,
};
